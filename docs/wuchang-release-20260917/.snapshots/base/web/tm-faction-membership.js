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
  function _refreshIndex(facName) {
    // 单 fac 增量·走整体 rebuild 比较稳 (rebuild 已 O(facs+chars+armies)·开销小)
    if (global.TM && global.TM.FactionIndex && global.TM.FactionIndex.rebuild) {
      try { global.TM.FactionIndex.rebuild(); } catch(_){}
    }
    if (global.TM && global.TM.FactionDerived && global.TM.FactionDerived.compute) {
      try { global.TM.FactionDerived.compute(); } catch(_){}
    }
    // Phase B1-B3·派生经济/凝聚/综合
    if (global.TM && global.TM.FactionDerivedEconomy && global.TM.FactionDerivedEconomy.compute) {
      try { global.TM.FactionDerivedEconomy.compute(); } catch(_){}
    }
    if (global.TM && global.TM.FactionDerivedCohesion && global.TM.FactionDerivedCohesion.compute) {
      try { global.TM.FactionDerivedCohesion.compute(); } catch(_){}
    }
    if (global.TM && global.TM.FactionDerivedStrength && global.TM.FactionDerivedStrength.compute) {
      try { global.TM.FactionDerivedStrength.compute(); } catch(_){}
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
  function assignProvince(provName, newFacName, opts) {
    if (!provName) return false;
    opts = opts || {};
    var g = _gm();
    if (!g) return false;
    var newName = newFacName || '';
    if (!g._provinceToFaction) g._provinceToFaction = {};
    var oldName = g._provinceToFaction[provName] || '';
    if (oldName === newName) return false;

    if (newName && !_findFac(newName)) {
      try { console.warn('[FactionMembership.assignProvince] 目标势力 "' + newName + '" 不在 GM.facs·仍写入·可能 stale ref'); } catch(_){}
    }

    // 1. canonical
    if (newName) g._provinceToFaction[provName] = newName;
    else delete g._provinceToFaction[provName];

    // 2. 同步 provinceStats[].owner
    if (g.provinceStats && g.provinceStats[provName]) {
      g.provinceStats[provName].owner = newName;
    }

    // 3. 同步 facs[].territories / provinceIds
    if (Array.isArray(g.facs)) {
      g.facs.forEach(function(f){
        if (!f || !f.name) return;
        if (f.name === oldName) {
          if (Array.isArray(f.territories)) f.territories = f.territories.filter(function(t){return t!==provName;});
          if (Array.isArray(f.provinceIds)) f.provinceIds = f.provinceIds.filter(function(t){return t!==provName;});
        }
        if (f.name === newName) {
          if (!Array.isArray(f.territories)) f.territories = [];
          if (!Array.isArray(f.provinceIds)) f.provinceIds = [];
          if (f.territories.indexOf(provName) < 0) f.territories.push(provName);
          if (f.provinceIds.indexOf(provName) < 0) f.provinceIds.push(provName);
        }
      });
    }

    // 4. 审计 (province 自己加 _factionHistory·prov 是 string·只能挂在 provinceStats[].factionHistory)
    if (g.provinceStats && g.provinceStats[provName]) {
      var ps = g.provinceStats[provName];
      if (!Array.isArray(ps._factionHistory)) ps._factionHistory = [];
      ps._factionHistory.push({
        from: oldName, to: newName,
        turn: opts.byTurn != null ? opts.byTurn : _now(),
        reason: opts.reason || ''
      });
    }

    if (oldName) _stamp(oldName);
    if (newName) _stamp(newName);
    _refreshIndex();

    if (!opts.silent) {
      _emit('faction:provinceTransferred', { province: provName, from: oldName, to: newName, reason: opts.reason });
    }
    return true;
  }

  function bulkReassignProvinces(filterFn, newFacName, opts) {
    var g = _gm();
    if (!g) return 0;
    opts = opts || {};
    var pToF = g._provinceToFaction || {};
    var changed = 0;
    Object.keys(pToF).forEach(function(provName){
      try {
        if (filterFn(provName, pToF[provName])) {
          if (assignProvince(provName, newFacName, Object.assign({ silent: true }, opts))) changed++;
        }
      } catch(_){}
    });
    if (changed > 0 && !opts.silent) {
      _emit('faction:bulkProvinces', { newFaction: newFacName, count: changed, reason: opts.reason });
    }
    return changed;
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
        if (owner && !pToF[name]) { pToF[name] = owner; sourceCounts.fromStats++; }
      });
    }
    // pass 2·从 fac.territories/provinceIds 拉 (只填空缺)
    if (Array.isArray(g.facs)) {
      g.facs.forEach(function(f){
        if (!f || !f.name) return;
        var arr = (Array.isArray(f.provinceIds) ? f.provinceIds : (Array.isArray(f.territories) ? f.territories : []));
        arr.forEach(function(pid){
          if (pid && !pToF[pid]) { pToF[pid] = f.name; sourceCounts.fromFac++; }
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
    bulkReassignProvinces: bulkReassignProvinces,
    migrateProvinceOwnership: migrateProvinceOwnership
  };
  if (global.TM.Factions && typeof global.TM.Factions.configureMembershipProvider === 'function') {
    var configured = global.TM.Factions.configureMembershipProvider(global.TM.FactionMembership);
    if (!configured || configured.ok !== true) throw new Error('势力成员写口注入失败');
  }
})(typeof window !== 'undefined' ? window : globalThis);
