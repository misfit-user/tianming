// @ts-check
/// <reference path="types.d.ts" />
/*
 * tm-faction-membership.js — 势力归属单一 mutator (Slice D·2026-05-10)
 *
 * 收口所有 char.faction / army.faction 写操作·避免散落赋值。
 * 副作用·审计·index 增量·event 总线 emit 全在这里·一处即全。
 *
 * API:
 *   TM.FactionMembership.assignChar(char, factionName, opts) — 转籍
 *   TM.FactionMembership.unassignChar(char, opts)            — 退籍 (=assignChar(c, ''))
 *   TM.FactionMembership.assignArmy(army, factionName, opts) — 军队改归属
 *   TM.FactionMembership.bulkReassignChars(filterFn, newFac, opts) — 批量
 *   TM.FactionMembership.bulkReassignArmies(filterFn, newFac, opts) — 批量
 *   TM.FactionMembership.dissolveFaction(facName, opts)      — 势力解散·三档转封策略
 *   TM.FactionMembership.renameFaction(oldName, newName)     — 改名·cascade
 *
 * opts:
 *   { reason: '说明', byTurn: GM.turn, silent: false, targetFactionId: '稳定势力ID' }
 *
 * 副作用:
 *   1. char._factionHistory.push({from, to, turn, reason})
 *   2. army._factionHistory.push({from, to, turn, reason})
 *   3. fac._lastMemberChangeTurn 更新
 *   4. emit GameEventBus 'faction:memberJoined' / 'memberLeft' / 'armyTransferred'
 *   5. _facIndex 增量 (轻刷该 entry)
 *
 * 验证策略:
 *   - newFactionName === '' / null → 退籍 (允许)
 *   - newFactionName 非空但 GM.facs 中不存在 → 输出 warn·仍允许 (兼容剧本预设)
 *   - char/army 为 null → 直接 false
 */
(function(global) {
  'use strict';

  function _gm() { return global.GM || null; }
  // Preparation-only projection of already explicit IDs. No live-world lookup, transfer, history or events.
  function projectLabels(entity, faction, kind) {
    if (!entity || !faction || !faction.id) throw new Error('明确势力标签投影缺少实体或稳定 ID');
    if (kind === 'character') {
      if (entity.factionId !== faction.id) throw new Error('人物标签投影不能改变国籍');
      entity.faction = faction.name;
    } else if (kind === 'army') {
      if (entity.ownerFactionId !== faction.id) throw new Error('部队标签投影不能改变所有者');
      entity.faction = faction.name; entity.factionId = faction.id;
      if ('owner' in entity) delete entity.owner;
    } else if (kind === 'map-region') {
      if ((entity.controllerFactionId || entity.sovereignFactionId) !== faction.id) throw new Error('地图标签投影不能改变主权或控制权');
      entity.owner = faction.name; entity.factionId = faction.id;
    } else throw new Error('不支持的势力标签投影类型');
    return entity;
  }
  function _now() { var g = _gm(); return (g && g.turn) || 0; }
  function _emit(name, payload) {
    try {
      if (global.GameEventBus && global.GameEventBus.emit) global.GameEventBus.emit(name, payload);
    } catch(_){}
  }
  function _findFac(name) {
    if (!name) return null;
    var g = _gm();
    if (!g || !Array.isArray(g.facs)) return null;
    for (var i = 0; i < g.facs.length; i++) if (g.facs[i] && g.facs[i].name === name) return g.facs[i];
    return null;
  }
  function _findFacById(id) {
    if (!id) return null;
    var g = _gm();
    if (!g || !Array.isArray(g.facs)) return null;
    for (var i = 0; i < g.facs.length; i++) if (g.facs[i] && g.facs[i].id === id) return g.facs[i];
    return null;
  }
  function _resolveAssignmentTarget(newFacName, opts) {
    var stableId = opts && opts.targetFactionId != null ? String(opts.targetFactionId).trim() : '';
    if (stableId) return { target: _findFacById(stableId), explicitId: stableId };
    return { target: _findFac(newFacName), explicitId: '' };
  }

  function _inferArmyFaction(a) {
    var g = _gm();
    if (!a || !g || !Array.isArray(g.facs)) return '';
    var facs = g.facs.filter(function(f){ return f && f.name; });
    var text = [a.name, a.armyName, a.commander, a.garrison, a.location, a.description].map(function(x){ return String(x || ''); }).join(' ');
    for (var i = 0; i < facs.length; i++) {
      var name = String(facs[i].name || '');
      if (name && text.indexOf(name) >= 0) return name;
    }
    var commanderText = String(a.commander || '').trim();
    if (commanderText && Array.isArray(g.chars)) {
      for (var c = 0; c < g.chars.length; c++) {
        var ch = g.chars[c];
        if (!ch || !ch.name || !ch.faction) continue;
        var chName = String(ch.name || '').trim();
        if (chName && (commanderText === chName || commanderText.indexOf(chName) >= 0)) return ch.faction;
      }
    }
    var hints = [
      { fac:'明朝廷', re:/京营|关宁|东江|卫所|镇军|山海关|宣府|大同|延绥|宁夏|甘肃|固原|白杆兵|狼兵|福建水师|广东水师|南京京营|通州卫|天津卫|山海卫|登州卫|太原卫|西安卫|苏州卫|杭州卫|宁波卫|福州卫|泉州卫|武昌卫|成都卫|广州卫|桂林卫|云南卫|贵阳卫/ },
      { fac:'后金', re:/后金|八旗|建州|女真归附|两黄旗|两红旗|两白旗|两蓝旗|汉军/ },
      { fac:'郑氏海商', re:/郑芝龙|郑氏|海商/ },
      { fac:'察哈尔', re:/察哈尔|林丹汗/ },
      { fac:'科尔沁蒙古', re:/科尔沁/ },
      { fac:'朝鲜', re:/朝鲜/ },
      { fac:'荷兰·台海(东印度公司)', re:/荷兰|东印度公司/ },
      { fac:'葡萄牙·澳门', re:/葡萄牙|澳门/ },
      { fac:'西班牙·马尼拉', re:/西班牙|马尼拉/ },
      { fac:'陕北饥民(将起)', re:/陕北|饥民|流民/ },
      { fac:'奢安之乱联军', re:/奢安|安邦彦|奢崇明/ }
    ];
    for (var h = 0; h < hints.length; h++) {
      if (hints[h].re.test(text) && _findFac(hints[h].fac)) return hints[h].fac;
    }
    return '';
  }
  /**
   * Slice G·解析 char/army 的当前势力对象·先用 ID 后 fallback name·rename 安全
   * 给 UI/AI 用：const fac = TM.FactionMembership.resolveFaction(char) 直接拿到对象
   */
  function resolveFaction(entity) {
    if (!entity) return null;
    if (entity.factionId) {
      var byId = _findFacById(entity.factionId);
      if (byId) {
        // 名漂移自动修复·若 facs[id].name 已变·entity.faction 跟上
        if (entity.faction !== byId.name) entity.faction = byId.name;
        return byId;
      }
    }
    if (entity.faction) return _findFac(entity.faction);
    return null;
  }
  function _refreshIndex(facName, strict) {
    // 单 fac 增量·走整体 rebuild 比较稳 (rebuild 已 O(facs+chars+armies)·开销小)
    if (global.TM && global.TM.FactionIndex && global.TM.FactionIndex.rebuild) {
      try { global.TM.FactionIndex.rebuild(); } catch(error){if(strict)throw error;}
    }
    if (global.TM && global.TM.FactionDerived && global.TM.FactionDerived.compute) {
      try { global.TM.FactionDerived.compute(); } catch(error){if(strict)throw error;}
    }
    // Phase B1-B3·派生经济/凝聚/综合
    if (global.TM && global.TM.FactionDerivedEconomy && global.TM.FactionDerivedEconomy.compute) {
      try { global.TM.FactionDerivedEconomy.compute(); } catch(error){if(strict)throw error;}
    }
    if (global.TM && global.TM.FactionDerivedCohesion && global.TM.FactionDerivedCohesion.compute) {
      try { global.TM.FactionDerivedCohesion.compute(); } catch(error){if(strict)throw error;}
    }
    if (global.TM && global.TM.FactionDerivedStrength && global.TM.FactionDerivedStrength.compute) {
      try { global.TM.FactionDerivedStrength.compute(); } catch(error){if(strict)throw error;}
    }
  }
  function _ensureHistory(obj) {
    if (!Array.isArray(obj._factionHistory)) obj._factionHistory = [];
  }
  function _stamp(facName) {
    var f = _findFac(facName);
    if (f) f._lastMemberChangeTurn = _now();
  }

  /**
   * 把人物转籍到新势力·空字符串/null = 退籍
   * @returns {boolean} 是否实际发生变化
   */
  function assignChar(char, newFacName, opts) {
    if (!char) return false;
    opts = opts || {};
    var newName = newFacName || '';
    var resolved = _resolveAssignmentTarget(newName, opts);
    if (resolved.explicitId && !resolved.target) {
      try { console.warn('[FactionMembership.assignChar] 目标势力 ID "' + resolved.explicitId + '" 不在 GM.facs·拒绝写入'); } catch(_){}
      return false;
    }
    if (resolved.target) newName = resolved.target.name || newName;
    var oldName = char.faction || '';
    var oldId = char.factionId == null ? '' : String(char.factionId);
    var newId = resolved.target && resolved.target.id != null ? String(resolved.target.id) : '';
    if (oldName === newName && (!newId || oldId === newId)) return false;

    // 验证新势力 (空允许·非空不存在 → warn 但仍写)
    if (newName && !_findFac(newName)) {
      try { console.warn('[FactionMembership.assignChar] 目标势力 "' + newName + '" 不在 GM.facs·仍写入·可能 stale ref'); } catch(_){}
    }

    char.faction = newName;
    // Slice G 同步: 若已有 factionId·按新名 lookup 更新；若无·按新势力补
    if (newName) {
      var fNew = resolved.target || _findFac(newName);
      if (fNew && fNew.id) char.factionId = fNew.id;
    } else if (newName === '') {
      char.factionId = '';
    }

    _ensureHistory(char);
    char._factionHistory.push({
      from: oldName, to: newName,
      turn: opts.byTurn != null ? opts.byTurn : _now(),
      reason: opts.reason || ''
    });

    if (oldName) _stamp(oldName);
    if (newName) _stamp(newName);
    if (!opts.deferRefresh) _refreshIndex();

    if (!opts.silent) {
      if (oldName) _emit('faction:memberLeft', { char: char.name, from: oldName, to: newName, reason: opts.reason });
      if (newName) _emit('faction:memberJoined', { char: char.name, faction: newName, from: oldName, reason: opts.reason });
    }
    return true;
  }

  function unassignChar(char, opts) {
    return assignChar(char, '', opts);
  }

  /**
   * 军队改归属·内部统一只写 .faction (Slice E·a.owner 不再用)
   */
  function assignArmy(army, newFacName, opts) {
    if (!army) return false;
    opts = opts || {};
    var newName = newFacName || '';
    var resolved = _resolveAssignmentTarget(newName, opts);
    if (_gm() && _gm().startContext && newName && !resolved.target) return false;
    if (resolved.explicitId && !resolved.target) {
      try { console.warn('[FactionMembership.assignArmy] 目标势力 ID "' + resolved.explicitId + '" 不在 GM.facs·拒绝写入'); } catch(_){}
      return false;
    }
    if (resolved.target) newName = resolved.target.name || newName;
    var oldName = army.faction || army.owner || '';
    var oldId = army.factionId == null ? '' : String(army.factionId);
    var newId = resolved.target && resolved.target.id != null ? String(resolved.target.id) : '';
    if (oldName === newName && (!newId || oldId === newId)) return false;

    if (newName && !_findFac(newName)) {
      try { console.warn('[FactionMembership.assignArmy] 目标势力 "' + newName + '" 不在 GM.facs·仍写入'); } catch(_){}
    }

    army.faction = newName;
    // Slice E·删 a.owner 字段·避免双源·读路径全部走 a.faction
    if ('owner' in army) try { delete army.owner; } catch(_){ army.owner = undefined; }
    if (newName) {
      var fNew = resolved.target || _findFac(newName);
      if (fNew && fNew.id) army.factionId = fNew.id;
    } else {
      army.factionId = '';
    }
    if (Object.prototype.hasOwnProperty.call(army, 'ownerFactionId')) army.ownerFactionId = army.factionId;

    _ensureHistory(army);
    army._factionHistory.push({
      from: oldName, to: newName,
      turn: opts.byTurn != null ? opts.byTurn : _now(),
      reason: opts.reason || ''
    });

    if (oldName) _stamp(oldName);
    if (newName) _stamp(newName);
    if (!opts.deferRefresh) _refreshIndex();

    if (!opts.silent) {
      _emit('faction:armyTransferred', { army: army.name, from: oldName, to: newName, reason: opts.reason });
    }
    return true;
  }

  function bulkReassignChars(filterFn, newFacName, opts) {
    var g = _gm();
    if (!g || !Array.isArray(g.chars)) return 0;
    opts = opts || {};
    var changed = 0;
    g.chars.forEach(function(c){
      try {
        if (filterFn(c)) {
          if (assignChar(c, newFacName, Object.assign({ silent: true }, opts))) changed++;
        }
      } catch(_){}
    });
    if (changed > 0 && !opts.silent) {
      _emit('faction:bulkChars', { newFaction: newFacName, count: changed, reason: opts.reason });
    }
    return changed;
  }

  function bulkReassignArmies(filterFn, newFacName, opts) {
    var g = _gm();
    if (!g || !Array.isArray(g.armies)) return 0;
    opts = opts || {};
    var changed = 0;
    g.armies.forEach(function(a){
      try {
        if (filterFn(a)) {
          if (assignArmy(a, newFacName, Object.assign({ silent: true }, opts))) changed++;
        }
      } catch(_){}
    });
    if (changed > 0 && !opts.silent) {
      _emit('faction:bulkArmies', { newFaction: newFacName, count: changed, reason: opts.reason });
    }
    return changed;
  }

  /* ─────────────────────────── Slice H·行政区划归属 ───────────────────────────
   * canonical: GM._provinceToFaction[provName] = facName
   * derived (auto-synced):
   *   - GM.provinceStats[provName].owner
   *   - fac.territories / fac.provinceIds
   * 全部 4 处通过 assignProvince 一处写入·消除并行 source。
   */

  /**
   * 单 province 改归属·空 newFacName = 无主
   * @returns {boolean} 实际是否变化
   */
  // Resolve an explicit region reference; names are accepted only when unambiguous.
  function _provinceTransferRecord(g, ref) {
    var map = g.mapData || g.map, regions = (map && map.regions) || [];
    var region = regions.find(function(r) { return r && String(r.id) === String(ref); });
    if (!region) {
      var matches = regions.filter(function(r) { return r && [r.name, r.adminBinding, r.mapRegionId].indexOf(ref) >= 0; });
      if (matches.length > 1) throw new Error('地块引用不唯一，请使用稳定 ID：' + ref);
      region = matches[0] || null;
    }
    var divisions = [], seen = new Set();
    function walk(n) {
      if (!n || typeof n !== 'object' || seen.has(n)) return;
      seen.add(n);
      if (Array.isArray(n)) { n.forEach(walk); return; }
      if (n.id || n.name) divisions.push(n);
      ['children','divisions','prefectures','counties'].forEach(function(k) { if (n[k]) walk(n[k]); });
    }
    Object.keys(g.adminHierarchy || {}).forEach(function(k) { walk(g.adminHierarchy[k]); });
    var binding = region && (region.adminBinding || region.mapRegionId || region.id);
    if(binding && typeof binding==='object')binding=binding.id || binding.divisionId || binding.regionId;
    var division = divisions.find(function(d) { return d.id && String(d.id) === String(binding || ref); });
    if (!division && region) division = divisions.find(function(d) { return Array.isArray(d.mappedRegions) && d.mappedRegions.indexOf(region.id) >= 0; });
    if (!division) {
      var ds = divisions.filter(function(d) { return d.name === (region && region.name || ref); });
      if (ds.length === 1) division = ds[0];
    }
    var aliases = [ref, region && region.id, region && region.name, binding, division && division.id, division && division.name];
    aliases = Array.from(new Set(aliases.filter(function(v) { return v !== undefined && v !== null && v !== ''; }).map(String)));
    var uniqueName=!region || regions.filter(function(r){return r && r.name===region.name;}).length===1;
    if(!uniqueName)aliases=aliases.filter(function(k){return k!==region.name;});
    return { key:uniqueName ? (region && region.name || division && division.name || String(ref)) : region.id, map:map, region:region, division:division, aliases:aliases, name:region && region.name || division && division.name || String(ref), id:region && region.id || division && division.id || String(ref) };
  }

  function _writeProvinceOwner(obj, name, id, mapRecord) {
    if (!obj || typeof obj !== 'object') return false;
    var changed = false;
    function set(k, v) { if (obj[k] !== v) { obj[k] = v; changed = true; } }
    ['owner','currentOwner','controller'].forEach(function(k) { set(k, mapRecord ? id : name); });
    ['factionId','factionKey','ownerKey','currentOwnerKey','controllerKey','stableOwnerKey','stableFactionId','mapFactionId','ownerFactionId','controllerFactionId','sovereignFactionId'].forEach(function(k) { set(k, id); });
    ['factionName','ownerName','currentOwnerName','controllerName','currentFactionName'].forEach(function(k) { set(k, name); });
    if (Object.prototype.hasOwnProperty.call(obj, 'groupKey')) set('groupKey', id);
    return changed;
  }

  function _assignProvinceCore(provName, newFacName, opts) {
    if (!provName) return false;
    opts = opts || {};
    var g = _gm(); if (!g) return false;
    var rec = opts._record || _provinceTransferRecord(g, provName);
    var target = _resolveAssignmentTarget(newFacName, opts);
    if (target.explicitId && !target.target) return false;
    var fac = target.target || _findFacById(newFacName);
    if (!fac && newFacName && typeof global.findScenarioFactionByMapValue === 'function') {
      var resolved = global.findScenarioFactionByMapValue(newFacName, rec.map);
      fac = resolved && (_findFacById(resolved.id) || _findFac(resolved.name));
    }
    var newName = fac ? fac.name : (newFacName || ''), newId = fac ? (fac.id || fac.name) : newName;
    var table = g._provinceToFaction || {}, found = false, oldName = '';
    rec.aliases.some(function(k) { if (Object.prototype.hasOwnProperty.call(table,k)) { oldName=table[k] || ''; found=true; return true; } return false; });
    if (!found) oldName = rec.region && (rec.region.currentOwner || rec.region.owner) || rec.division && (rec.division.currentOwner || rec.division.owner) || g.provinceStats && g.provinceStats[rec.name] && g.provinceStats[rec.name].owner || '';
    var oldFac = _findFacById(oldName) || _findFac(oldName); if (oldFac) oldName=oldFac.name;
    var journal = [], changed = false, seenObjects = new Set();
    function remember(obj) { if (!obj || seenObjects.has(obj)) return; seenObjects.add(obj); journal.push({obj:obj, before:Object.assign({},obj)}); }
    function write(obj, isMap) { if (!obj) return; remember(obj); if (_writeProvinceOwner(obj,newName,newId,isMap)) changed=true; }
    function list(f, key, value) {
      var old=f[key]; if (!Array.isArray(old) && f.name!==newName) return;
      var retained=false;
      var next=(Array.isArray(old)?old:[]).filter(function(v) {
        if(rec.aliases.indexOf(String(v))<0)return true;
        if(f.name===newName && v===value && !retained){retained=true;return true;}
        return false;
      });
      if (f.name===newName && next.indexOf(value)<0) next.push(value);
      if (!Array.isArray(old) || next.length!==old.length || next.some(function(v,i){return v!==old[i];})) { remember(f); f[key]=next; changed=true; }
    }
    var mapOld = rec.region && (rec.region.currentOwner || rec.region.owner) || '';
    var turn=opts.byTurn!=null?opts.byTurn:_now(), reason=opts.reason || '领地易主';
    try {
      remember(g); remember(table);
      if (!g._provinceToFaction) g._provinceToFaction=table;
      rec.aliases.forEach(function(k) {
        if (k!==rec.key && k!==rec.id && !Object.prototype.hasOwnProperty.call(table,k)) return;
        if (table[k]!==newName) { table[k]=newName; changed=true; }
      });
      if (!Object.prototype.hasOwnProperty.call(table,rec.key)) { table[rec.key]=newName; changed=true; }
      write(rec.division,false);
      // A logical cell can retain multiple original accounts. Transfer the whole cell atomically.
      if (rec.division && rec.division.mapAccounting && rec.division.mapAccounting.schema === 'source-partition-v1') {
        function transferAccounts(n) {
          if (!n) return; write(n,false);
          [n.id,n.name].filter(Boolean).forEach(function(k) {
            table[k]=newName;
            if (g.provinceStats && g.provinceStats[k]) write(g.provinceStats[k],false);
          });
          (n.children || []).forEach(transferAccounts);
        }
        transferAccounts(rec.division);
        var hierarchy=g.adminHierarchy, sourceSlot=null;
        function findSlot(parent,key,rootKey) {
          (parent[key] || []).forEach(function(n) {
            if (n===rec.division) sourceSlot={parent:parent,key:key,rootKey:rootKey};
            else ['children','divisions'].forEach(function(k) {
              if(Array.isArray(n[k]))findSlot(n,k,rootKey);
            });
          });
        }
        Object.keys(hierarchy).forEach(function(k) {
          if(hierarchy[k] && Array.isArray(hierarchy[k].divisions))findSlot(hierarchy[k],'divisions',k);
        });
        var player=g.playerInfo || {}, targetKey=newId || '__unassigned_map_accounts';
        if ((player.factionId===newId || player.factionName===newName) && hierarchy.player) targetKey='player';
        if (targetKey!=='player' && rec.map && Array.isArray(rec.map.provinceMigration)) {
          var existingRoots=Object.keys(hierarchy).filter(function(k){var v=hierarchy[k];return k!=='player' && v && (k===newId || v.factionId===newId || v.factionName===newName);});
          if(existingRoots.length===1)targetKey=existingRoots[0];
        }
        if (sourceSlot && sourceSlot.rootKey!==targetKey) {
          remember(sourceSlot.parent);
          sourceSlot.parent[sourceSlot.key]=sourceSlot.parent[sourceSlot.key].filter(function(n){return n!==rec.division;});
          var provinceMap=rec.map, retiredParent=sourceSlot.parent;
          if(provinceMap && Array.isArray(provinceMap.provinceMigration) && sourceSlot.key==='children' && !retiredParent.children.length && provinceMap.provinceMigration.some(function(p){return p.adminId===retiredParent.id;})) {
            var sourceBucket=hierarchy[sourceSlot.rootKey];
            if(sourceBucket && (sourceBucket.divisions||[]).indexOf(retiredParent)>=0) {
              remember(sourceBucket);sourceBucket.divisions=sourceBucket.divisions.filter(function(n){return n!==retiredParent;});
              remember(g);
              if(!g._mapRetiredProvinceContainers)g._mapRetiredProvinceContainers={}; // arch-ok territory transaction archives an empty aggregate, not an account
              remember(g._mapRetiredProvinceContainers);
              g._mapRetiredProvinceContainers[retiredParent.id]={node:retiredParent,rootKey:sourceSlot.rootKey};
            }
          }
          remember(hierarchy);
          if (!hierarchy[targetKey]) hierarchy[targetKey]={factionId:newId,divisions:[]};
          var destination=hierarchy[targetKey], targetContainer=destination.divisions && destination.divisions[0];
          var provinceSource=rec.region && rec.region.sourceProvinceId;
          var provinceEntry=rec.map && (rec.map.provinceMigration||[]).find(function(p){return p.id===provinceSource;});
          if(provinceEntry) {
            var liveContainer=(destination.divisions||[]).find(function(n){return n.id===provinceEntry.adminId;});
            var retired=g._mapRetiredProvinceContainers && g._mapRetiredProvinceContainers[provinceEntry.adminId];
            if(!liveContainer && retired && retired.rootKey===targetKey) {
              remember(destination);destination.divisions=(destination.divisions||[]).concat([retired.node]);
              remember(g._mapRetiredProvinceContainers);delete g._mapRetiredProvinceContainers[provinceEntry.adminId];liveContainer=retired.node;
            }
            if(liveContainer)targetContainer=liveContainer;
          }
          if (targetContainer && Array.isArray(targetContainer.children) && !(rec.map && rec.map.provinceMigration && targetContainer.mapAccounting)) {
            remember(targetContainer); targetContainer.children=targetContainer.children.concat([rec.division]);
          } else {
            remember(destination); destination.divisions=(destination.divisions || []).concat([rec.division]);
          }
        }
      }
      Object.keys(g.provinceStats || {}).forEach(function(k) {
        var st=g.provinceStats[k];
        if (rec.aliases.indexOf(k)>=0 || st && st.id && rec.aliases.indexOf(st.id)>=0) write(st,false);
      });
      write(rec.region,true);
      if (rec.region) {
        var data=Object.assign({},rec.region.data || {});
        if (_writeProvinceOwner(data,newName,newId,false)) { rec.region.data=data; changed=true; }
        if (fac && fac.color) rec.region.color=fac.color;
        else if (!newName) rec.region.color='#cccccc';
        (rec.map.items || []).forEach(function(item) { if (item && String(item.id)===String(rec.region.id)) write(item,true); });
        if (oldName!==newName) {
          rec.region.ownerHistory=(rec.region.ownerHistory || []).concat([{turn:turn,from:mapOld,fromKey:oldFac && oldFac.id || oldName,to:newId,toKey:newId,reason:reason}]);
          rec.region.events=(rec.region.events ? rec.region.events+'\n' : '')+reason;
        }
      }
      (g.facs || []).forEach(function(f) { if (!f || !f.name) return; list(f,'territories',rec.key); list(f,'provinceIds',rec.id); if (Array.isArray(f.territory)) list(f,'territory',rec.key); });
      if (oldName!==newName && g.provinceStats) {
        var history=g.provinceStats[rec.name] || g.provinceStats[rec.id];
        if (history) { remember(history); history._factionHistory=(history._factionHistory || []).concat([{from:oldName,to:newName,turn:turn,reason:reason}]); }
      }
    } catch (error) {
      for (var j=journal.length-1;j>=0;j--) {
        var entry=journal[j];
        Object.keys(entry.obj).forEach(function(k) { if (!Object.prototype.hasOwnProperty.call(entry.before,k)) delete entry.obj[k]; });
        Object.keys(entry.before).forEach(function(k) { if (entry.obj[k]!==entry.before[k]) entry.obj[k]=entry.before[k]; });
      }
      throw error;
    }
    if (!changed && oldName===newName) return false;
    if (opts._deferEffects) return true;
    if (oldName) _stamp(oldName); if (newName) _stamp(newName);
    _refreshIndex(); // Every consumer sees the same completed transfer before recomputing.
    if (oldName!==newName && rec.region && typeof global.pushMapTurnChange==='function') {
      global.pushMapTurnChange({regionId:rec.region.id,regionName:rec.name,field:'owner',oldValue:mapOld,newValue:newId,reason:reason});
    }
    if (!opts.silent) _emit('faction:provinceTransferred',{province:rec.name,regionId:rec.id,from:oldName,to:newName,reason:reason});
    try {
      if (rec.map && typeof global.updateMapColors==='function') global.updateMapColors({refresh:false});
      var ui=global.TMPhase8FormalBridge && global.TMPhase8FormalBridge.map;
      if (ui) {
        if (typeof ui.invalidateFormalMap==='function') ui.invalidateFormalMap();
        if (typeof ui.refreshMapFromRuntime==='function') ui.refreshMapFromRuntime();
      }
      if (typeof global.refreshMapDisplay==='function') global.refreshMapDisplay();
    } catch (error) {
      if (global.TM && global.TM.errors && global.TM.errors.captureSilent) global.TM.errors.captureSilent(error,'territory-map-refresh');
      else if (global.console) global.console.warn('[territory-map-refresh]',error);
    }
    return true;
  }

  // Compatibility aliases in _provinceToFaction must not inflate national totals.
  function getProvinces(factionName) {
    var g=_gm(); if (!g) return [];
    var fac=_findFac(factionName) || _findFacById(factionName), name=fac ? fac.name : factionName;
    var table=g._provinceToFaction || {}, map=g.mapData || g.map, index=new Map(), seen=new Set(), out=[];
    // Only province-migrated maps use authoritative cell enumeration.
    if (map && Array.isArray(map.provinceMigration)) {
      var counts=new Map();(map.regions||[]).forEach(function(r){counts.set(r.name,(counts.get(r.name)||0)+1);});
      return (map.regions||[]).filter(function(r){
        var owner=r.currentOwner || r.owner || r.factionId, f=_findFacById(owner)||_findFac(owner);
        return (f ? f.name : owner)===name;
      }).map(function(r){return counts.get(r.name)>1?r.id:r.name;});
    }
    ((map && map.regions) || []).forEach(function(r) {
      if (!r) return;
      [r.id,r.name,r.adminBinding,r.mapRegionId].concat(r.accountingLeafIds || [], r.accountingLeafNames || []).filter(Boolean).forEach(function(k) {
        k=String(k); if (!index.has(k)) index.set(k,r); else if (index.get(k)!==r) index.set(k,null);
      });
    });
    Object.keys(table).forEach(function(k) {
      if(index.has(k) && index.get(k)===null)return;
      var r=index.get(k), identity=r && (r.id || r.name) || k;
      if (seen.has(identity)) return;
      var owner=table[k];
      if (r) {
        if (Object.prototype.hasOwnProperty.call(table,r.id)) owner=table[r.id];
        else if (Object.prototype.hasOwnProperty.call(table,r.name)) owner=table[r.name];
      }
      var ownerFac=_findFacById(owner) || _findFac(owner); if (ownerFac) owner=ownerFac.name;
      if (owner===name) { seen.add(identity); out.push(r ? (index.get(r.name)===null ? r.id : r.name) : k); }
    });
    return out;
  }

  // 批量易主先校验，国家派生与地图刷新只在全批成功后执行。
  function assignProvince(provName,newFacName,opts){
    if(!provName)return false;opts=opts || {};
    return applyProvinceTransfers([{regionRef:provName,newOwner:opts.targetFactionId || newFacName,reason:opts.reason}],opts).changed || false;
  }
  function applyProvinceTransfers(changes, options) {
    options=options || {};
    var g=_gm();if(!g || !Array.isArray(changes))throw new Error('易主批次格式无效');
    var plans=[],seen=new Map(),facs=Array.isArray(g.facs)?g.facs:[];
    var migratedMap=g.mapData||g.map;
    if(migratedMap && Array.isArray(migratedMap.provinceMigration)) {
      var cells=migratedMap.regions||[],registry=migratedMap.circuitRegistry||[];
      changes=changes.flatMap(function(row){
        if(!row || typeof row!=='object' || Array.isArray(row))return [row];
        var ref=String(row.regionRef);
        if(cells.some(function(r){return String(r.id)===ref || r.name===ref;}))return [row];
        var groups=migratedMap.provinceMigration.filter(function(p){
          var circuit=registry.find(function(c){return c.sourceRegionId===p.id;});
          return p.id===ref || p.name===ref || p.adminId===ref || circuit && (circuit.id===ref || circuit.key===ref);
        });
        if(groups.length>1)throw new Error('省道引用不唯一：'+ref);
        if(!groups.length)return [row];
        if(!groups[0].memberRegionIds.length)throw new Error('省道没有可操作地块：'+ref);
        return groups[0].memberRegionIds.map(function(id){return Object.assign({},row,{regionRef:id});});
      });
    }
    changes.forEach(function(row){
      if(!row || typeof row!=='object' || Array.isArray(row))throw new Error('易主条目格式无效');
      var ref=row.regionRef;
      if(typeof ref!=='string' && typeof ref!=='number')throw new Error('易主缺少地块引用');
      var rec=_provinceTransferRecord(g,String(ref));
      if(!rec.region && !rec.division && !Object.prototype.hasOwnProperty.call(g._provinceToFaction || {},ref))throw new Error('地块不存在：'+ref);
      var owner=row.newOwner;
      if(owner!==null && typeof owner!=='string' && typeof owner!=='number')throw new Error('易主缺少有效的新势力');
      owner=owner==null?'':String(owner).trim();var target=null;
      if(owner){
        var matches=facs.filter(function(f){return f && String(f.id)===owner;});
        if(!matches.length)matches=facs.filter(function(f){return f && f.name===owner;});
        if(!matches.length && typeof global.findScenarioFactionByMapValue==='function'){
          var resolved=global.findScenarioFactionByMapValue(owner,rec.map);
          matches=facs.filter(function(f){return f && resolved && String(f.id)===String(resolved.id);});
        }
        if(matches.length!==1)throw new Error('目标势力不存在或不唯一：'+owner);
        target=matches[0];
      }
      var id=target?(target.id || target.name):'',name=target?target.name:'';
      if(seen.has(rec.id)){if(seen.get(rec.id)!==id)throw new Error('同一地块存在冲突易主：'+rec.id);return;}
      seen.set(rec.id,id);plans.push({rec:rec,id:id,name:name,reason:row.reason || options.reason || '领地易主'});
    });
    if(!plans.length && typeof options.mutate!=='function')return {ok:true,applied:0,ownershipChanges:0};
    var journal=[],remembered=new Set(),receipts=[],dirty=false;
    function remember(obj){
      if(!obj || typeof obj!=='object' || remembered.has(obj))return;
      remembered.add(obj);journal.push({obj:obj,before:Object.assign({},obj),length:Array.isArray(obj)?obj.length:null});
    }
    remember(g);remember(g._provinceToFaction);facs.forEach(remember);
    remember(g.turnChanges);if(g.turnChanges)remember(g.turnChanges.map);
    if (migratedMap && migratedMap.sourceBudgetModel==='source-partition-v1') {
      // A batch rollback must include every container touched by its per-cell transfers.
      remember(g.adminHierarchy);var treeSeen=new Set();
      function rememberTree(n){if(!n || treeSeen.has(n))return;treeSeen.add(n);remember(n);['children','divisions'].forEach(function(k){if(Array.isArray(n[k])){remember(n[k]);n[k].forEach(rememberTree);}});}
      Object.keys(g.adminHierarchy||{}).forEach(function(k){rememberTree(g.adminHierarchy[k]);});
      remember(g._mapRetiredProvinceContainers);Object.keys(g._mapRetiredProvinceContainers||{}).forEach(function(k){rememberTree(g._mapRetiredProvinceContainers[k].node);});
    }
    plans.forEach(function(p){
      remember(p.rec.region);remember(p.rec.division);
      Object.keys(g.provinceStats || {}).forEach(function(k){remember(g.provinceStats[k]);});
      (p.rec.map && p.rec.map.items || []).forEach(function(item){if(item && String(item.id)===String(p.rec.id))remember(item);});
    });
    (options.records || []).forEach(remember);
    try{
      plans.forEach(function(p){
        var rec=p.rec,from=rec.region && (rec.region.currentOwner || rec.region.owner) || '';
        var changed=_assignProvinceCore(rec.id,p.name,{reason:p.reason,silent:true,targetFactionId:p.id,byTurn:options.byTurn,_deferEffects:true,_record:rec});
        if(changed)dirty=true;
        if(changed && String(from)!==String(p.id))receipts.push({province:rec.name,regionId:rec.id,from:from,to:p.id,reason:p.reason});
      });
      if(typeof options.mutate==='function'){var extra=options.mutate();if(extra && typeof extra.then==='function')throw new Error('地图变更必须同步');if(extra!==false)dirty=true;}
      if(dirty){
        receipts.forEach(function(r){var from=_findFacById(r.from) || _findFac(r.from);if(from)_stamp(from.name);var to=_findFacById(r.to) || _findFac(r.to);if(to)_stamp(to.name);});
        _refreshIndex(null,true);
        if(typeof global.pushMapTurnChange==='function')receipts.forEach(function(r){global.pushMapTurnChange({regionId:r.regionId,regionName:r.province,field:'owner',oldValue:r.from,newValue:r.to,reason:r.reason});});
      }
    }catch(error){
      for(var i=journal.length-1;i>=0;i--){var item=journal[i];Object.keys(item.obj).forEach(function(k){if(!Object.prototype.hasOwnProperty.call(item.before,k))delete item.obj[k];});Object.keys(item.before).forEach(function(k){if(item.obj[k]!==item.before[k])item.obj[k]=item.before[k];});if(item.length!==null)item.obj.length=item.length;}
      throw error;
    }
    if(dirty){
      function effect(label,action){try{action();}catch(error){try{if(global.TM && TM.errors && TM.errors.captureSilent)TM.errors.captureSilent(error,label);else console.warn(label,error);}catch(_){}}}
      if(!options.silent)receipts.forEach(function(r){
        var from=_findFacById(r.from),to=_findFacById(r.to);
        _emit('faction:provinceTransferred',{province:r.province,regionId:r.regionId,from:from?from.name:r.from,to:to?to.name:r.to,reason:r.reason});
      });
      effect('territory-colors',function(){if((g.mapData || g.map) && typeof global.updateMapColors==='function')global.updateMapColors({refresh:false});});
      var ui=global.TMPhase8FormalBridge && global.TMPhase8FormalBridge.map;
      effect('territory-invalidate',function(){if(ui && typeof ui.invalidateFormalMap==='function')ui.invalidateFormalMap();});
      effect('territory-formal-refresh',function(){if(ui && typeof ui.refreshMapFromRuntime==='function')ui.refreshMapFromRuntime();});
      effect('territory-legacy-refresh',function(){if(typeof global.refreshMapDisplay==='function')global.refreshMapDisplay();});
    }
    return {ok:true,applied:receipts.length,ownershipChanges:receipts.length,changed:dirty};
  }

  function bulkReassignProvinces(filterFn, newFacName, opts) {
    var g=_gm();if(!g)return 0;opts=opts || {};
    if(typeof filterFn!=='function')throw new Error('批量易主缺少选择条件');
    var table=g._provinceToFaction || {},rows=[];
    Object.keys(table).forEach(function(key){
      if(filterFn(key,table[key]))rows.push({regionRef:key,newOwner:newFacName,reason:opts.reason});
    });
    var result=applyProvinceTransfers(rows,Object.assign({},opts,{silent:true}));
    if(result.applied>0 && !opts.silent)_emit('faction:bulkProvinces',{newFaction:newFacName,count:result.applied,reason:opts.reason});
    return result.applied;
  }

  /**
   * Slice H·一次性 migration: 三源合一到 _provinceToFaction
   * 优先级·已有 _provinceToFaction · 否则 provinceStats[].owner · 否则 fac.territories/provinceIds
   * 然后反向 sync provinceStats + fac.territories·三源齐
   */
  function migrateProvinceOwnership() {
    var g = _gm();
    if (!g) return { adopted: 0, sourceCounts: {} };
    if (!g._provinceToFaction) g._provinceToFaction = {};
    var sourceCounts = { fromMap: 0, fromStats: 0, fromFac: 0, total: 0 };
    var pToF = g._provinceToFaction;

    // pass 1·从 provinceStats 拉 owner 入 map (只填空缺)
    if (g.provinceStats) {
      Object.keys(g.provinceStats).forEach(function(name){
        var owner = g.provinceStats[name] && g.provinceStats[name].owner;
        if (owner && !Object.prototype.hasOwnProperty.call(pToF,name)) { pToF[name] = owner; sourceCounts.fromStats++; }
      });
    }
    // pass 2·从 fac.territories/provinceIds 拉 (只填空缺)
    if (Array.isArray(g.facs)) {
      g.facs.forEach(function(f){
        if (!f || !f.name) return;
        var arr = (Array.isArray(f.provinceIds) ? f.provinceIds : (Array.isArray(f.territories) ? f.territories : []));
        arr.forEach(function(pid){
          if (pid && !Object.prototype.hasOwnProperty.call(pToF,pid)) { pToF[pid] = f.name; sourceCounts.fromFac++; }
        });
      });
    }
    sourceCounts.fromMap = Object.keys(pToF).length - sourceCounts.fromStats - sourceCounts.fromFac;
    sourceCounts.total = Object.keys(pToF).length;

    // pass 3·反向 sync 让 3 源齐
    if (Array.isArray(g.facs)) {
      g.facs.forEach(function(f){
        if (!f || !f.name) return;
        if (!Array.isArray(f.territories)) f.territories = [];
        if (!Array.isArray(f.provinceIds)) f.provinceIds = [];
      });
    }
    Object.keys(pToF).forEach(function(provName){
      var fac = _findFac(pToF[provName]);
      if (fac) {
        if (fac.territories.indexOf(provName) < 0) fac.territories.push(provName);
        if (fac.provinceIds.indexOf(provName) < 0) fac.provinceIds.push(provName);
      }
      if (g.provinceStats && g.provinceStats[provName]) {
        g.provinceStats[provName].owner = pToF[provName];
      }
    });

    var map=g.mapData || g.map,nameCounts=new Map();
    ((map && map.regions) || []).forEach(function(r){if(r && r.name)nameCounts.set(r.name,(nameCounts.get(r.name)||0)+1);});
    var repairs=((map && map.regions) || []).filter(Boolean).map(function(r){
      var key=Object.prototype.hasOwnProperty.call(pToF,r.id)?r.id:r.name;
      if(key===r.name && nameCounts.get(r.name)>1)return null;
      if(!Object.prototype.hasOwnProperty.call(pToF,key))return null;
      var owner=pToF[key];if(owner && !_findFac(owner) && !_findFacById(owner))return null;
      return {regionRef:r.id || r.name,newOwner:owner,reason:'运行态归属对账'};
    }).filter(Boolean);
    if(repairs.length)applyProvinceTransfers(repairs,{silent:true});
    return { adopted: sourceCounts.total, sourceCounts: sourceCounts };
  }

  /**
   * 势力解散·三档转封策略 (Slice F)
   *   1. opts.conqueror 优先   (征服)
   *   2. fac.liege            (宗主吸收)
   *   3. opts.fallback || ''  (无主/流亡)
   * @returns {{chars: number, armies: number, strategy: string, target: string}}
   */
  function dissolveFaction(facName, opts) {
    opts = opts || {};
    var fac = _findFac(facName);
    var target = '';
    var strategy = '';
    if (opts.conqueror) {
      target = opts.conqueror;
      strategy = 'conquered';
    } else if (fac && fac.liege) {
      target = fac.liege;
      strategy = 'absorbed-by-liege';
    } else {
      target = opts.fallback || '';
      strategy = target ? 'reassigned' : 'orphaned';
    }
    var reason = opts.reason || (strategy + (target ? ('→' + target) : ''));
    var charCnt = bulkReassignChars(function(c){ return c.faction === facName; }, target, {
      reason: '势力解散·' + reason, silent: true
    });
    var armyCnt = bulkReassignArmies(function(a){ return (a.faction === facName) || (a.owner === facName); }, target, {
      reason: '势力解散·' + reason, silent: true
    });
    // Slice H·省份也走 cascade
    var provCnt = bulkReassignProvinces(function(_pn, owner){ return owner === facName; }, target, {
      reason: '势力解散·' + reason, silent: true
    });

    _emit('faction:dissolved', { faction: facName, strategy: strategy, target: target, charCnt: charCnt, armyCnt: armyCnt, provCnt: provCnt });
    return { chars: charCnt, armies: armyCnt, provinces: provCnt, strategy: strategy, target: target };
  }

  /**
   * 势力改名·cascade 下属 chars/armies (Slice F)·一站式
   * 1. 改 GM.facs[i].name (该 fn 自己改·调用者无需先改)
   * 2. cascade 所有 char.faction / army.faction 字符串
   * 3. factionId 不变·resolveFaction() 调用即自动 sync 名字
   * @param {string} oldName 旧势力名
   * @param {string} newName 新势力名
   * @param {object} opts {also_rename_facs?: bool=true·若 caller 已经改完 facs 可设 false}
   */
  function renameFaction(oldName, newName, opts) {
    if (!oldName || !newName || oldName === newName) return { chars: 0, armies: 0 };
    opts = opts || {};
    if (opts.also_rename_facs !== false) {
      var fac = _findFac(oldName);
      if (fac) fac.name = newName;
    }
    var charCnt = bulkReassignChars(function(c){ return c.faction === oldName; }, newName, {
      reason: '势力改名·' + oldName + '→' + newName, silent: true
    });
    var armyCnt = bulkReassignArmies(function(a){ return (a.faction === oldName) || (a.owner === oldName); }, newName, {
      reason: '势力改名·' + oldName + '→' + newName, silent: true
    });
    // Slice H·省份归属也 cascade·_provinceToFaction 是 name 索引·必须改
    var provCnt = bulkReassignProvinces(function(_pn, owner){ return owner === oldName; }, newName, {
      reason: '势力改名·' + oldName + '→' + newName, silent: true
    });
    _emit('faction:renamed', { from: oldName, to: newName, charCnt: charCnt, armyCnt: armyCnt, provCnt: provCnt });
    return { chars: charCnt, armies: armyCnt, provinces: provCnt };
  }

  /**
   * 验证 ref integrity·返回所有 stale 引用 (char/army.faction 指向不存在的势力)
   * 用于 smoke 检测·开发时调用 TM.FactionMembership.lint() 看一眼即知
   */
  function lint() {
    var g = _gm();
    if (!g) return { stale: { chars: [], armies: [], provinces: [] } };
    var facNames = new Set((g.facs || []).map(function(f){ return f && f.name; }).filter(Boolean));
    var staleChars = (g.chars || []).filter(function(c){ return c && c.faction && !facNames.has(c.faction); }).map(function(c){ return { name: c.name, faction: c.faction }; });
    var staleArmies = (g.armies || []).filter(function(a){ return a && (a.faction || a.owner) && !facNames.has(a.faction || a.owner); }).map(function(a){ return { name: a.name, faction: a.faction || a.owner }; });
    var staleProvinces = [];
    if (g._provinceToFaction) {
      Object.keys(g._provinceToFaction).forEach(function(pn){
        var owner = g._provinceToFaction[pn];
        if (owner && !facNames.has(owner)) staleProvinces.push({ name: pn, faction: owner });
      });
    }
    // 三源不一致 (provinceStats / fac.territories vs canonical map)
    var inconsistencies = [];
    if (g.provinceStats) {
      Object.keys(g.provinceStats).forEach(function(pn){
        var statOwner = g.provinceStats[pn].owner || '';
        var canonOwner = (g._provinceToFaction && g._provinceToFaction[pn]) || '';
        if (statOwner !== canonOwner) inconsistencies.push({ province: pn, statOwner: statOwner, canonOwner: canonOwner });
      });
    }
    // Slice I·检查 fac.members 双向一致性
    // forall char: char.faction === f.name iff char ∈ f.members.chars
    var bidirIssues = [];
    if (Array.isArray(g.facs)) {
      g.facs.forEach(function(f){
        if (!f || !f.name || !f.members) return;
        var membersChars = f.members.chars || [];
        // 集合 A: members 里的 chars
        var inMembers = new Set(membersChars.map(function(c){return c && c.name;}).filter(Boolean));
        // 集合 B: char.faction === f.name 的 chars
        var inForward = new Set((g.chars||[]).filter(function(c){return c && c.faction === f.name && c.alive !== false;}).map(function(c){return c.name;}));
        // diff
        inMembers.forEach(function(n){ if (!inForward.has(n)) bidirIssues.push({ faction: f.name, char: n, dir: 'in_members_not_forward' }); });
        inForward.forEach(function(n){ if (!inMembers.has(n)) bidirIssues.push({ faction: f.name, char: n, dir: 'in_forward_not_members' }); });
      });
    }
    return { stale: { chars: staleChars, armies: staleArmies, provinces: staleProvinces }, inconsistencies: inconsistencies, bidirIssues: bidirIssues };
  }

  /**
   * Slice E·一次性 migration: 把 GM.armies 里的 .owner 升级到 .faction·删 .owner 字段
   * 同时·若该 army 的 faction 在 GM.facs 找到·补 factionId。
   * 在 startGame 末调用·只跑一次 (idempotent·重跑也安全·只是无副作用)。
   * 注：用 a.owner 兜底 a.faction 的旧 schema 全部走完。
   */
  function migrateArmyOwnerToFaction() {
    var g = _gm();
    if (!g || !Array.isArray(g.armies)) return { migrated: 0, inferred: 0, idCovered: 0 };
    var migrated = 0, inferred = 0, idCovered = 0;
    g.armies.forEach(function(a){
      if (!a) return;
      if (!a.faction && a.owner) {
        a.faction = a.owner;
        migrated++;
      }
      if (!a.faction) {
        var inferredFac = _inferArmyFaction(a);
        if (inferredFac) {
          a.faction = inferredFac;
          a._factionInferred = true;
          inferred++;
        }
      }
      if ('owner' in a) try { delete a.owner; } catch(_){}
      if (a.faction && !a.factionId) {
        var f = _findFac(a.faction);
        if (f && f.id) { a.factionId = f.id; idCovered++; }
      }
    });
    return { migrated: migrated, inferred: inferred, idCovered: idCovered };
  }

  /**
   * Slice G 配套·一次性 migration: 给 GM.chars 也补 factionId
   */
  function migrateCharsAddFactionId() {
    var g = _gm();
    if (!g || !Array.isArray(g.chars)) return 0;
    var n = 0;
    g.chars.forEach(function(c){
      if (!c) return;
      if (c.faction && !c.factionId) {
        var f = _findFac(c.faction);
        if (f && f.id) { c.factionId = f.id; n++; }
      }
    });
    return n;
  }

  global.TM = global.TM || {};
  global.TM.FactionMembership = {
    projectLabels: projectLabels,
    assignChar: assignChar,
    unassignChar: unassignChar,
    assignArmy: assignArmy,
    bulkReassignChars: bulkReassignChars,
    bulkReassignArmies: bulkReassignArmies,
    dissolveFaction: dissolveFaction,
    renameFaction: renameFaction,
    lint: lint,
    migrateArmyOwnerToFaction: migrateArmyOwnerToFaction,
    migrateCharsAddFactionId: migrateCharsAddFactionId,
    resolveFaction: resolveFaction,
    findFacById: _findFacById,
    // Slice H·province
    assignProvince: assignProvince,
    applyProvinceTransfers: applyProvinceTransfers,
    getProvinces: getProvinces,
    bulkReassignProvinces: bulkReassignProvinces,
    migrateProvinceOwnership: migrateProvinceOwnership
  };
  if (global.TM.Factions && typeof global.TM.Factions.configureMembershipProvider === 'function') {
    var configured = global.TM.Factions.configureMembershipProvider(global.TM.FactionMembership);
    if (!configured || configured.ok !== true) throw new Error('势力成员写口注入失败');
  }
})(typeof window !== 'undefined' ? window : globalThis);
