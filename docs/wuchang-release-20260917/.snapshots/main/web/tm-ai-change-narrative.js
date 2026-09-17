// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-ai-change-narrative.js — AI 推演变化·叙事补录 (拆自 tm-ai-change-applier.js·2026-05-21·Slice 3)
 *
 * 暴露·TM.AIChange.Narrative·27 函数·涵盖·
 *   通用 narrative helper·cleanNarrativeToken / parseNarrativeNumber / entityLoosePattern 等
 *   region narrative·collectAdminDivisions / setRegionOwnerMirrors / setRegionGovernorMirrors 等
 *   faction narrative·setFactionLeader / setFactionRelationPair / applyNarrativeFactionFieldFallback 等
 *   3 大入口·applyNarrativeArmyFieldFallback·applyNarrativeRegionFieldFallback·applyNarrativeFactionFieldFallback
 *   通用 entity merge·mergeUpdatesToEntity
 *
 * 依赖·
 *   TM.AIChange.PathUtils (Slice 1·必须先加载)
 *   TM.AIChange.Army      (Slice 2·必须先加载)
 */
(function(global) {
  'use strict';

  // ── 从 PathUtils 拿到的 helper ──
  var _PathUtils = (global.TM && global.TM.AIChange && global.TM.AIChange.PathUtils) || null;
  if (!_PathUtils) console.warn('[ai-change-narrative] TM.AIChange.PathUtils not loaded·narrative calls may noop');
  var _findDivisionByNameOrId = _PathUtils && _PathUtils.findDivisionByNameOrId;
  var _findDivisionByNameFuzzy = (_PathUtils && _PathUtils.findDivisionByNameFuzzy) || _findDivisionByNameOrId;
  var _recordCharChange       = _PathUtils && _PathUtils.recordCharChange;
  var _isPlainObject          = _PathUtils && _PathUtils.isPlainObject;
  var _isPathBlocked          = _PathUtils && _PathUtils.isPathBlocked;
  var _validateNestedJsonValue= _PathUtils && _PathUtils.validateNestedJsonValue;

  function _safeOwnCopy(obj) {
    var out = Object.create(null);
    if (!obj || typeof obj !== 'object') return out;
    Object.keys(obj).forEach(function(key) { out[key] = obj[key]; });
    return out;
  }

  // ── 从 Army 拿到的 helper ──
  var _Army = (global.TM && global.TM.AIChange && global.TM.AIChange.Army) || null;
  if (!_Army) console.warn('[ai-change-narrative] TM.AIChange.Army not loaded·narrative army calls may noop');
  var applyAIArmyChange              = _Army && _Army.applyAIArmyChange;
  var _clampNum                      = _Army && _Army.clampNum;
  var _normalizeArmyKey              = _Army && _Army.normalizeArmyKey;
  var _armyLooseNamePattern          = _Army && _Army.armyLooseNamePattern;
  var _armyNarrativeAliases          = _Army && _Army.armyNarrativeAliases;
  var _resolveNarrativeCommanderName = _Army && _Army.resolveNarrativeCommanderName;

  // ── 内联·原 applier.js 闭包工具·拆模块后跨闭包看不见·复制 17 行 (与 army.js 同) ──
  function _getNarrativeText(aiOutput) {
    var t = '';
    if (!aiOutput) return t;
    if (aiOutput.narrative)    t += String(aiOutput.narrative) + '\n';
    if (aiOutput.shilu_text)   t += String(aiOutput.shilu_text) + '\n';
    if (aiOutput.shizhengji)   t += String(aiOutput.shizhengji) + '\n';
    if (aiOutput.yupiHuiting)  t += String(aiOutput.yupiHuiting) + '\n';
    if (aiOutput.qijuHistory)  t += String(aiOutput.qijuHistory) + '\n';
    if (aiOutput.event && aiOutput.event.desc) t += String(aiOutput.event.desc) + '\n';
    if (Array.isArray(aiOutput.events)) {
      aiOutput.events.forEach(function(e){ if (e && e.desc) t += String(e.desc) + '\n'; });
    }
    if (Array.isArray(aiOutput.npc_actions)) {
      aiOutput.npc_actions.forEach(function(na){ if (na && na.desc) t += String(na.desc) + '\n'; });
    }
    return t;
  }

    function _cleanNarrativeToken(raw) {
    var text = String(raw || '').trim();
    text = text.replace(/^[\s"'“”‘’《》【】「」『』：:，,。；;]+|[\s"'“”‘’《》【】「」『』：:，,。；;]+$/g, '');
    text = text.replace(/^(?:于|至|往|赴|入|进|驻|驻于|驻防|移驻|调往|调驻|迁都|定都|都于|为|由|归|归属)\s*/, '');
    text = text.replace(/(?:一带|等地|附近|城下|境内|境外|驻防|驻扎|屯驻|防守|节制|统带|统辖|所据|所有|控制).*$/g, '');
    return text.trim();
  }

  function _cleanNarrativeFieldValue(raw) {
    var text = String(raw || '').trim();
    text = text.replace(/^[\s"'“”‘’《》【】「」『』：:，,。；;]+|[\s"'“”‘’《》【】「」『』：:，,。；;]+$/g, '');
    return text.trim();
  }

  function _parseNarrativeNumber(raw) {
    var text = String(raw || '').trim();
    if (!text) return NaN;
    text = text.replace(/,/g, '');
    var unitWan = /万/.test(text);
    var n = parseFloat(text);
    if (isNaN(n)) {
      var cn = {'零':0,'〇':0,'一':1,'二':2,'两':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9};
      function section(s) {
        var total = 0, num = 0;
        for (var i = 0; i < s.length; i += 1) {
          var ch = s.charAt(i);
          if (cn[ch] != null) num = cn[ch];
          else if (ch === '十') { total += (num || 1) * 10; num = 0; }
          else if (ch === '百') { total += (num || 1) * 100; num = 0; }
          else if (ch === '千') { total += (num || 1) * 1000; num = 0; }
        }
        return total + num;
      }
      if (text.indexOf('万') >= 0) {
        var parts = text.split('万');
        n = section(parts[0]) * 10000 + section(parts[1] || '');
        unitWan = false;
      } else {
        n = section(text);
      }
    }
    if (unitWan) n *= 10000;
    return isFinite(n) ? n : NaN;
  }

  function _narrativeValuePattern(entityPat, labelTerms) {
    return new RegExp(entityPat + '[^。；;\\n]{0,80}?(?:' + labelTerms + ')[^。；;\\n]{0,8}?(?:增至|升至|提高到|提高至|降至|降为|减至|减为|改为|更为|为|达到|定为|调整为)\\s*([\\d,.一二两三四五六七八九十百千万〇零]+)\\s*(万)?', 'g');
  }

  function _narrativeTextPattern(entityPat, labelTerms) {
    return new RegExp(entityPat + '[^。；;\\n]{0,80}?(?:' + labelTerms + ')[^。；;\\n]{0,8}?(?:改为|更为|转为|定为|确立为|调整为|奉为|为)\\s*([^，,。；;\\n]{2,24})', 'g');
  }

  function _entityLoosePattern(entity) {
    var names = [];
    ['name','id','label','short','title','officialName'].forEach(function(k) {
      var v = entity && entity[k];
      if (v != null && String(v).trim()) names.push(String(v).trim());
    });
    names = names.filter(function(v, idx) { return v && names.indexOf(v) === idx; });
    if (!names.length) return '';
    return '(?:' + names.map(_armyLooseNamePattern).filter(Boolean).join('|') + ')';
  }

  function _findNarrativeFaction(G, raw) {
    var text = _cleanNarrativeToken(raw);
    if (!text || !G || !Array.isArray(G.facs)) return null;
    var clean = _normalizeArmyKey(text);
    return G.facs.find(function(f) {
      if (!f) return false;
      var vals = [f.name, f.id, f.label, f.short, f.scenarioFactionName].filter(Boolean);
      return vals.some(function(v) {
        var n = _normalizeArmyKey(v);
        return n && (n === clean || clean.indexOf(n) >= 0 || n.indexOf(clean) >= 0);
      });
    }) || null;
  }

  // ★2026-07-16 落库契约硬化刀④·叙事补录人名严格解析:主官/势力首领须精确命中 GM.chars 且在世·返真 char 或 null。
  //   _resolveNarrativeCommanderName(army.js:573) 末尾 fallback(:584-585·查无 char 时返 text.match/slice 的幻影名)会把
  //   不存在/已死者裸写进 div.governor / fac.leader 镜像(census §K K5 病灶)。此处二次严校·把幻影/死者挡在落账之外。
  //   触发面(正则)不动——只在解析后、落账前加闸;命中真活人的原有落账路径全不变(exact/contained 匹配返的正是 GM.chars 名)。
  function _narrativeResolveAliveChar(G, name) {
    if (!G || !Array.isArray(G.chars) || name == null) return null;
    var nm = String(name).trim();
    if (!nm) return null;
    var idMatches = G.chars.filter(function(c) {
      return c && c.id != null && String(c.id).trim() === nm;
    });
    var ch = idMatches.length === 1 ? idMatches[0] : null;
    if (!ch && idMatches.length === 0) {
      var nameMatches = G.chars.filter(function(c) {
        return c && c.name != null && String(c.name).trim() === nm;
      });
      if (nameMatches.length === 1) ch = nameMatches[0];
    }
    if (!ch || ch.alive === false || ch.dead) return null;
    return ch;
  }

  // 不落账候选留痕·既有 console.warn 通道(不造 UI·不新增 GM 写点)·带原句摘录供 playtest 排查
  function _narrativeSkipTrace(where, subject, raw) {
    try { console.warn('[ai-change-narrative] 幻影/死者实体·叙事补录未落账(已留痕)·' + where + '：' + subject + '·据「' + String(raw || '').slice(0, 40) + '」'); } catch(_) {}
  }

  function _resolveNarrativePlaceName(G, raw) {
    var text = _cleanNarrativeToken(raw);
    if (!text) return '';
    var known = [];
    if (G && G.mapData && Array.isArray(G.mapData.regions)) {
      G.mapData.regions.forEach(function(r) {
        ['name','id','title','officialName'].forEach(function(k) {
          if (r && r[k]) known.push(String(r[k]));
        });
      });
    }
    _collectAdminDivisions(G).forEach(function(d) {
      if (d && d.name) known.push(String(d.name));
      if (d && d.id) known.push(String(d.id));
    });
    var clean = _normalizeArmyKey(text);
    var hit = known.find(function(n) {
      var nk = _normalizeArmyKey(n);
      return nk && (nk === clean || clean.indexOf(nk) >= 0 || nk.indexOf(clean) >= 0);
    });
    if (hit) return hit;
    var m = text.match(/[\u4e00-\u9fff·]{2,12}/);
    return m ? m[0] : text.slice(0, 20);
  }

  function _collectAdminDivisions(G) {
    var out = [];
    function walk(list) {
      (list || []).forEach(function(d) {
        if (!d) return;
        out.push(d);
        walk(d.children || d.divisions || d.prefectures || d.counties || []);
      });
    }
    if (G && G.adminHierarchy) {
      Object.keys(G.adminHierarchy).forEach(function(k) {
        var tree = G.adminHierarchy[k];
        walk(tree && (tree.divisions || tree.children || []));
      });
    }
    return out;
  }

  function _mapRegionByNameOrId(G, ref) {
    if (!G || !G.mapData || !Array.isArray(G.mapData.regions) || !ref) return null;
    var clean = _normalizeArmyKey(ref);
    return G.mapData.regions.find(function(r) {
      if (!r) return false;
      return [r.id, r.name, r.title, r.officialName].filter(Boolean).some(function(v) {
        var n = _normalizeArmyKey(v);
        return n && n === clean;
      });
    }) || null;
  }

  function _regionNarrativeRecords(G) {
    var records = [];
    var seen = {};
    function add(name, id, mapRegion, adminDiv) {
      if (!name && !id) return;
      var key = _normalizeArmyKey(id || name);
      if (seen[key]) {
        if (mapRegion && !seen[key].mapRegion) seen[key].mapRegion = mapRegion;
        if (adminDiv && !seen[key].adminDiv) seen[key].adminDiv = adminDiv;
        return;
      }
      var rec = { name:name || id, id:id || name, mapRegion:mapRegion || null, adminDiv:adminDiv || null };
      seen[key] = rec;
      records.push(rec);
    }
    if (G && G.mapData && Array.isArray(G.mapData.regions)) {
      G.mapData.regions.forEach(function(r) {
        var div = _findDivisionByNameOrId(G, r && (r.name || r.id));
        add(r && r.name, r && r.id, r, div);
      });
    }
    _collectAdminDivisions(G).forEach(function(d) {
      add(d && d.name, d && d.id, _mapRegionByNameOrId(G, d && (d.name || d.id)), d);
    });
    return records;
  }

  function _refreshMapFieldViews() {
    try { if (typeof global.updateMapColors === 'function') global.updateMapColors(); } catch(_) {}
    try { if (typeof global.renderMap === 'function') global.renderMap(); } catch(_) {}
    try {
      if (global.TMPhase8FormalBridge && typeof global.TMPhase8FormalBridge.refresh === 'function') {
        global.TMPhase8FormalBridge.refresh();
      }
    } catch(_) {}
  }

  function _writeRegionOwnerAliases(obj, facName, facId, idBacked) {
    if (!obj) return false;
    var changed = false;
    function set(k, v) {
      if (v == null || v === '') return;
      if (obj[k] !== v) {
        obj[k] = v;
        changed = true;
      }
    }
    var ownerValue = idBacked ? facId : facName;
    ['owner', 'currentOwner', 'controller'].forEach(function(k) { set(k, ownerValue); });
    ['factionId', 'factionKey', 'ownerKey', 'currentOwnerKey', 'controllerKey', 'stableOwnerKey', 'stableFactionId', 'mapFactionId'].forEach(function(k) { set(k, facId); });
    ['factionName', 'ownerName', 'currentOwnerName', 'controllerName', 'currentFactionName'].forEach(function(k) { set(k, facName); });
    return changed;
  }

  function _setRegionOwnerMirrors(G, rec, fac, reason) {
    if (!G || !rec || !fac) return false;
    var facName = fac.name || fac.id || '';
    var facId = fac.id || fac.name || '';
    var regionRef = rec.id || rec.name;
    var mapRegion = rec.mapRegion || _mapRegionByNameOrId(G, regionRef);
    var oldOwner = mapRegion ? (mapRegion.ownerName || mapRegion.factionName || mapRegion.owner || '') : '';
    var changed = false;
    try {
      if (global.TMMapRuntime && typeof global.TMMapRuntime.setRegionOwner === 'function') {
        var updated = global.TMMapRuntime.setRegionOwner(regionRef, facName, { mapData:G.mapData, reason:reason || '叙事地块归属补录' });
        if (updated) mapRegion = updated;
      }
    } catch(_) {}
    if (mapRegion) {
      if (_writeRegionOwnerAliases(mapRegion, facName, facId, true)) changed = true;
      if (!mapRegion.data || typeof mapRegion.data !== 'object') mapRegion.data = {};
      if (_writeRegionOwnerAliases(mapRegion.data, facName, facId, false)) changed = true;
      if (fac.color) mapRegion.color = fac.color;
    }
    var div = rec.adminDiv || _findDivisionByNameOrId(G, rec.name || rec.id);
    if (div) {
      if (_writeRegionOwnerAliases(div, facName, facId, false)) changed = true;
    }
    if (!G._provinceToFaction) G._provinceToFaction = {};
    try {
      if (global.TM && TM.FactionMembership && typeof TM.FactionMembership.assignProvince === 'function') {
        TM.FactionMembership.assignProvince(rec.name || rec.id, facName, { reason: reason || '叙事地块归属补录', silent: true });
      }
    } catch(_) {}
    [rec.name, rec.id, mapRegion && mapRegion.name, mapRegion && mapRegion.id].filter(Boolean).forEach(function(k) {
      G._provinceToFaction[k] = facName;
    });
    if (G.provinceStats && typeof G.provinceStats === 'object') {
      var touched = false;
      Object.keys(G.provinceStats).forEach(function(k) {
        var st = G.provinceStats[k];
        if (!st || typeof st !== 'object') return;
        if ([rec.name, rec.id, mapRegion && mapRegion.name, mapRegion && mapRegion.id].filter(Boolean).some(function(v){ return _normalizeArmyKey(v) === _normalizeArmyKey(k); })) {
          _writeRegionOwnerAliases(st, facName, facId, false);
          touched = true;
        }
      });
      if (!touched && (rec.id || rec.name)) {
        G.provinceStats[rec.id || rec.name] = {};
        _writeRegionOwnerAliases(G.provinceStats[rec.id || rec.name], facName, facId, false);
      }
    }
    if (G._turnReport && oldOwner !== facName) {
      G._turnReport.push({ type:'region_update', entity:rec.name || rec.id, field:'owner', old:oldOwner, new:facName, reason:reason || '叙事地块归属补录', turn:G.turn||0 });
    }
    _refreshMapFieldViews();
    return changed || oldOwner !== facName;
  }

  function _cleanRegionOfficeTitle(raw) {
    var text = String(raw || '').trim();
    if (!text) return '';
    var m = text.match(/巡抚|总督|经略|督抚|布政使|按察使|知府|知州|知县|县令|太守|刺史|郡守|守臣|主官|地方官/);
    return m ? m[0] : text.replace(/[^\u4e00-\u9fff·]/g, '').slice(0, 12);
  }

  function _writeRegionGovernorAliases(obj, governor, position) {
    if (!obj) return false;
    var changed = false;
    function set(k, v) {
      if (v == null || v === '') return;
      if (obj[k] !== v) {
        obj[k] = v;
        changed = true;
      }
    }
    ['governor', 'governorName', 'currentGovernor', 'official', 'currentOfficial', 'administrator', 'administratorName', 'localOfficial', 'chiefOfficial'].forEach(function(k) {
      set(k, governor);
    });
    if (position) {
      ['officialPosition', 'office', 'governorTitle', 'officialTitle', 'positionTitle'].forEach(function(k) {
        set(k, position);
      });
    }
    return changed;
  }

  function _syncRegionGovernorCharacter(G, governor, rec, position) {
    if (!G || !Array.isArray(G.chars) || !governor) return false;
    var ch = G.chars.find(function(c) { return c && c.name && String(c.name).trim() === governor; });
    if (!ch) return false;
    var changed = false;
    function set(k, v) {
      if (v == null || v === '') return;
      if (ch[k] !== v) {
        ch[k] = v;
        changed = true;
      }
    }
    var regionName = (rec && (rec.name || rec.id)) || '';
    if (position) {
      set('officialTitle', position);
      set('office', position);
      set('position', position);
    }
    set('location', regionName);
    set('currentRegion', regionName);
    set('governorOf', regionName);
    return changed;
  }

  function _setRegionGovernorMirrors(G, rec, governor, reason, position) {
    if (!G || !rec || !governor) return false;
    position = _cleanRegionOfficeTitle(position);
    var mapRegion = rec.mapRegion || _mapRegionByNameOrId(G, rec.id || rec.name);
    var div = rec.adminDiv || _findDivisionByNameOrId(G, rec.name || rec.id);
    var oldGov = (div && (div.governor || div.official)) || (mapRegion && (mapRegion.governor || mapRegion.official)) || '';
    var changed = false;
    if (mapRegion) {
      if (_writeRegionGovernorAliases(mapRegion, governor, position)) changed = true;
      if (!mapRegion.data || typeof mapRegion.data !== 'object') mapRegion.data = {};
      if (_writeRegionGovernorAliases(mapRegion.data, governor, position)) changed = true;
    }
    if (div) {
      if (_writeRegionGovernorAliases(div, governor, position)) changed = true;
    }
    if (G.provinceStats && typeof G.provinceStats === 'object') {
      Object.keys(G.provinceStats).forEach(function(k) {
        var st = G.provinceStats[k];
        if (!st || typeof st !== 'object') return;
        if ([rec.name, rec.id, mapRegion && mapRegion.name, mapRegion && mapRegion.id].filter(Boolean).some(function(v){ return _normalizeArmyKey(v) === _normalizeArmyKey(k); })) {
          if (_writeRegionGovernorAliases(st, governor, position)) changed = true;
        }
      });
    }
    if (_syncRegionGovernorCharacter(G, governor, rec, position)) changed = true;
    if (G._turnReport && oldGov !== governor) {
      G._turnReport.push({ type:'region_update', entity:rec.name || rec.id, field:'governor', old:oldGov, new:governor, office:position || '', reason:reason || '叙事主官补录', turn:G.turn||0 });
    }
    _refreshMapFieldViews();
    return changed || oldGov !== governor;
  }

  function _setRegionScalarMirrors(G, rec, fields, value, reason) {
    if (!G || !rec || !fields || !fields.length || !isFinite(value)) return false;
    var mapRegion = rec.mapRegion || _mapRegionByNameOrId(G, rec.id || rec.name);
    var div = rec.adminDiv || _findDivisionByNameFuzzy(G, rec.name || rec.id);
    var changed = false;
    var oldValue = mapRegion ? mapRegion[fields[0]] : (div ? div[fields[0]] : undefined);
    function write(obj) {
      if (!obj) return;
      fields.forEach(function(field) {
        if (obj[field] !== value) {
          obj[field] = value;
          changed = true;
        }
      });
    }
    write(mapRegion);
    write(div);
    // 真值源并账：minxinLocal/corruptionLocal 只供叙事/面板显示，而聚合(integration-bridge·G.minxin.trueIndex
    //   读 div.minxin)、民变判级、财政读的是 div.minxin / div.corruption 真值源。只写 *Local 则 AI 叙事的地方
    //   民心/腐败改进不了真值 = 蒸发(民心三刀同病)。故同名规则一并把绝对值落到 div 真值源。
    if (div) {
      if (fields.indexOf('minxinLocal') >= 0) {
        if (div.minxin !== value) { div.minxin = value; changed = true; }
        if (div.minxinDetails && typeof div.minxinDetails === 'object' && div.minxinDetails.trueIndex !== value) {
          div.minxinDetails.trueIndex = value;
        }
      }
      if (fields.indexOf('corruptionLocal') >= 0 && div.corruption !== value) {
        div.corruption = value;
        changed = true;
      }
    }
    if (G.provinceStats && typeof G.provinceStats === 'object') {
      Object.keys(G.provinceStats).forEach(function(k) {
        var st = G.provinceStats[k];
        if (!st || typeof st !== 'object') return;
        if ([rec.name, rec.id, mapRegion && mapRegion.name, mapRegion && mapRegion.id].filter(Boolean).some(function(v){ return _normalizeArmyKey(v) === _normalizeArmyKey(k); })) {
          write(st);
        }
      });
    }
    if (G._turnReport && changed) {
      G._turnReport.push({ type:'region_update', entity:rec.name || rec.id, field:fields[0], old:oldValue, new:value, reason:reason || '叙事地块数值补录', turn:G.turn||0 });
    }
    _refreshMapFieldViews();
    return changed;
  }

  function _applyNarrativeArmyFieldFallback(G, aiOutput) {
    if (!G || !Array.isArray(G.armies) || !aiOutput) return 0;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return 0;
    var count = 0;
    var seen = {};
    G.armies.forEach(function(army) {
      _armyNarrativeAliases(army).forEach(function(alias) {
        var namePat = _armyLooseNamePattern(alias);
        if (!namePat) return;
        var locPat = new RegExp(namePat + '[^。；;\\n]{0,18}?(?:移驻|调驻|驻防|进驻|开赴|开往|调往|移镇|屯驻|驻扎于|驻于|移师)\\s*([^，,。；;\\n\\s]{2,16})', 'g');
        var m;
        while ((m = locPat.exec(narrative)) !== null) {
          var place = _resolveNarrativePlaceName(G, m[1]);
          var key = (army.id || army.name || alias) + '|location|' + place;
          if (!place || seen[key]) continue;
          seen[key] = true;
          var r = applyAIArmyChange({ name: army.name || alias, location: place, garrison: place, reason:'叙事驻地补录' }, { source:'narrative.army_fields' });
          if (r && r.ok && r.changed) count++;
        }
        var armyNumberRules = [
          { labels:'兵力|兵员|军额|人数|兵数', field:'soldiers', clamp:false },
          { labels:'士气|军心', field:'morale', clamp:true },
          { labels:'训练|操练|训练度', field:'training', clamp:true },
          { labels:'补给|粮饷|供给', field:'supply', clamp:true },
          { labels:'忠诚|军忠', field:'loyalty', clamp:true },
          { labels:'控制|军纪|掌控|控制度', field:'control', clamp:true }
        ];
        armyNumberRules.forEach(function(rule) {
          var pat = _narrativeValuePattern(namePat, rule.labels);
          var nm;
          while ((nm = pat.exec(narrative)) !== null) {
            var rawNum = (nm[1] || '') + (nm[2] || '');
            var value = _parseNarrativeNumber(rawNum);
            if (!isFinite(value)) continue;
            value = rule.clamp ? Math.round(_clampNum(value, 0, 100)) : Math.max(0, Math.round(value));
            var nkey = (army.id || army.name || alias) + '|' + rule.field + '|' + value;
            if (seen[nkey]) continue;
            seen[nkey] = true;
            var change = { name: army.name || alias, reason:'叙事军队数值补录' };
            if (rule.field === 'soldiers') {
              var oldS = Math.max(0, Math.round(Number(army.soldiers || army.size || army.strength || 0) || 0));
              change.delta = value - oldS;
            } else {
              change[rule.field] = value;
            }
            var nr = applyAIArmyChange(change, { source:'narrative.army_fields' });
            if (nr && nr.ok && nr.changed) count++;
          }
        });
        var armyTextRules = [
          { labels:'军质|品质|素质|兵员素质|部队质量|军队质量', field:'quality', reason:'叙事军质补录' },
          { labels:'装备状况|装备水平|装备|军械|器械', field:'equipmentCondition', reason:'叙事装备补录' }
        ];
        armyTextRules.forEach(function(rule) {
          var tpat = new RegExp(namePat + '[^。\\n]{0,120}?(?:' + rule.labels + ')\\s*[:：]?\\s*([^，,。；;\\n]{2,48})', 'g');
          var tm;
          while ((tm = tpat.exec(narrative)) !== null) {
            var value = _cleanNarrativeFieldValue(tm[1]);
            if (!value) continue;
            var tkey = (army.id || army.name || alias) + '|' + rule.field + '|' + value;
            if (seen[tkey]) continue;
            seen[tkey] = true;
            var textChange = { name: army.name || alias, reason: rule.reason };
            textChange[rule.field] = value;
            var tr = applyAIArmyChange(textChange, { source:'narrative.army_fields' });
            if (tr && tr.ok && tr.changed) count++;
          }
        });
        (G.facs || []).forEach(function(fac) {
          var facPat = _entityLoosePattern(fac);
          if (!facPat) return;
          var factionPatterns = [
            new RegExp(namePat + '[^。；;\\n]{0,18}?(?:改隶|转隶|划归|归属|隶属|归附|投归|拨归)\\s*' + facPat, 'g'),
            new RegExp(facPat + '[^。；;\\n]{0,12}?(?:接收|收编|统辖|节制|领有)[^。；;\\n]{0,12}?' + namePat, 'g')
          ];
          factionPatterns.forEach(function(pat) {
            var fm;
            while ((fm = pat.exec(narrative)) !== null) {
              var fkey = (army.id || army.name || alias) + '|faction|' + (fac.name || fac.id);
              if (seen[fkey]) continue;
              seen[fkey] = true;
              var fr = applyAIArmyChange({ name: army.name || alias, faction: fac.name || fac.id, reason:'叙事军队归属补录' }, { source:'narrative.army_fields' });
              if (fr && fr.ok && fr.changed) count++;
            }
          });
        });
      });
    });
    return count;
  }

  function _applyNarrativeRegionFieldFallback(G, aiOutput) {
    if (!G || !aiOutput) return 0;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return 0;
    var records = _regionNarrativeRecords(G);
    if (!records.length) return 0;
    var count = 0;
    var seen = {};
    records.forEach(function(rec) {
      var regionPat = _entityLoosePattern({ name:rec.name, id:rec.id });
      if (!regionPat) return;
      (G.facs || []).forEach(function(fac) {
        var facPat = _entityLoosePattern(fac);
        if (!facPat) return;
        var ownerPatterns = [
          new RegExp(facPat + '[^。；;\\n]{0,12}?(?:占领|攻取|夺取|据有|控制|接管|吞并|兼并|收复)[^。；;\\n]{0,8}?' + regionPat, 'g'),
          new RegExp(regionPat + '[^。；;\\n]{0,14}?(?:归|归属|改属|划归|并入|转归|落入|归入|易手于)\\s*' + facPat, 'g'),
          new RegExp(regionPat + '[^。；;\\n]{0,8}?为\\s*' + facPat + '\\s*所(?:据|占|有|控)', 'g')
        ];
        ownerPatterns.forEach(function(pat) {
          var m;
          while ((m = pat.exec(narrative)) !== null) {
            var key = (rec.id || rec.name) + '|owner|' + (fac.id || fac.name);
            if (seen[key]) continue;
            seen[key] = true;
            if (_setRegionOwnerMirrors(G, rec, fac, '叙事地块归属补录')) count++;
          }
        });
      });
      var officeTerms = '巡抚|总督|经略|督抚|布政使|按察使|知府|知州|知县|县令|太守|刺史|郡守|守臣|主官|地方官';
      var govPatterns = [
        { re:new RegExp(regionPat + '[^。；;\\n]{0,14}?(' + officeTerms + ')[^。；;\\n]{0,12}?(?:改任为|任为|更为|换为|改由|补授|起用|任命为|授为|署为)\\s*([^，,。；;\\n\\s]{2,16})', 'g'), role:1, person:2 },
        { re:new RegExp('(?:命|以|任|擢|调|起用|授)\\s*([^，,。；;\\n\\s]{2,16})\\s*(?:为|任|署|出任)\\s*' + regionPat + '[^。；;\\n]{0,8}?(' + officeTerms + ')', 'g'), role:2, person:1 },
        { re:new RegExp('(?:命|以|任|擢|调|起用|授)\\s*([^，,。；;\\n\\s]{2,16})\\s*(?:为|任|署|出任)\\s*(' + officeTerms + ')[^。；;\\n]{0,12}?' + regionPat, 'g'), role:2, person:1 },
        { re:new RegExp('([^，,。；;\\n\\s]{2,16})\\s*(?:出任|接任|署理|改任|补任|就任)\\s*' + regionPat + '[^。；;\\n]{0,8}?(' + officeTerms + ')', 'g'), role:2, person:1 },
        { re:new RegExp('(?:命|以|任|擢|调|起用|授)\\s*([^，,。；;\\n\\s]{2,16})\\s*(?:主政|治理|镇抚|镇守|抚治|出镇)[^。；;\\n]{0,12}?' + regionPat, 'g'), role:0, person:1 }
      ];
      govPatterns.forEach(function(ruleObj) {
        var pat = ruleObj.re;
        var gm;
        while ((gm = pat.exec(narrative)) !== null) {
          var person = _resolveNarrativeCommanderName(G, gm[ruleObj.person]);
          var office = ruleObj.role ? _cleanRegionOfficeTitle(gm[ruleObj.role]) : '';
          var gkey = (rec.id || rec.name) + '|governor|' + person;
          if (!person || seen[gkey]) continue;   // seen 幂等·同回合同一地块同一主官不双落账
          seen[gkey] = true;
          // ★2026-07-16 刀④·实体+死人闸:主官须精确命中 GM.chars 且在世·幻影/死者不落账+留痕。
          //   保留直写(onAppointment 官制树落账与 apply 主流程强耦合·不便单独调用)·但 _setRegionGovernorMirrors
          //   已把 mapRegion/mapRegion.data/div/provinceStats 各 governor 别名键 + char officialTitle/position 一并同步(镜像两侧一致)。
          if (!_narrativeResolveAliveChar(G, person)) { _narrativeSkipTrace('region.governor', (rec.name || rec.id) + '←' + person, gm[0]); continue; }
          if (_setRegionGovernorMirrors(G, rec, person, '叙事主官补录', office)) count++;
        }
      });
      var regionNumberRules = [
        { labels:'驻军|守军|兵力|军力', fields:['troops'], clamp:false },
        { labels:'开发|发展|开发度|发展度', fields:['development'], clamp:true },
        { labels:'繁荣|富庶|繁荣度', fields:['prosperity'], clamp:true },
        { labels:'民心|民情|地方民心', fields:['minxinLocal'], clamp:true },
        { labels:'腐败|贪腐|吏治腐败', fields:['corruptionLocal'], clamp:true },
        { labels:'税负|税压|赋役|税负水平', fields:['taxBurden','taxLevel'], clamp:true }
      ];
      regionNumberRules.forEach(function(rule) {
        var pat = _narrativeValuePattern(regionPat, rule.labels);
        var rm;
        while ((rm = pat.exec(narrative)) !== null) {
          var rawNum = (rm[1] || '') + (rm[2] || '');
          var value = _parseNarrativeNumber(rawNum);
          if (!isFinite(value)) continue;
          value = rule.clamp ? Math.round(_clampNum(value, 0, 100)) : Math.max(0, Math.round(value));
          var rkey = (rec.id || rec.name) + '|' + rule.fields[0] + '|' + value;
          if (seen[rkey]) continue;
          seen[rkey] = true;
          if (_setRegionScalarMirrors(G, rec, rule.fields, value, '叙事地块数值补录')) count++;
        }
      });
    });
    return count;
  }

  function _setFactionLeader(fac, leader, G, reason) {
    if (!fac || leader == null) return false;
    leader = String(leader).trim();
    var leaderId = '';
    // 非空首领必须精确解析到当前在册活人；这里是所有 faction leader 写入的最终 sink。
    // 空字符串用于明确出缺，允许同步清空所有镜像。
    if (leader) {
      var living = _narrativeResolveAliveChar(G, leader);
      if (!living) {
        _narrativeSkipTrace('faction.leader', (fac.name || fac.id) + '←' + leader, reason || 'structured faction update');
        return false;
      }
      leader = living.name;
      leaderId = living.id == null ? '' : String(living.id);
    }
    var old = fac.leader || fac.ruler || (fac.leadership && fac.leadership.ruler) || '';
    var mirrorsAlreadySynced = old === leader && fac.leader === leader && fac.leaderId === leaderId && fac.leaderName === leader && fac.ruler === leader &&
      fac.leadership && fac.leadership.ruler === leader && fac.leaderInfo && fac.leaderInfo.name === leader && fac.leaderInfo.id === leaderId;
    if (mirrorsAlreadySynced) return false;
    fac.leader = leader;
    fac.leaderId = leaderId;
    fac.leaderName = leader;
    fac.ruler = leader;
    if (!fac.leadership || typeof fac.leadership !== 'object') fac.leadership = {};
    fac.leadership.ruler = leader;
    if (!fac.leaderInfo || typeof fac.leaderInfo !== 'object' || Array.isArray(fac.leaderInfo)) fac.leaderInfo = {};
    fac.leaderInfo.name = leader;
    fac.leaderInfo.id = leaderId;
    if (G && G._turnReport) G._turnReport.push({ type:'faction_update', entity:fac.name || fac.id, field:'leader', old:old, new:leader, reason:reason || '叙事首领补录', turn:G.turn||0 });
    return true;
  }

  function _setPartyLeader(party, leader, G, reason) {
    if (!party || leader == null) return false;
    leader = String(leader).trim();
    // party.leader / party.head 是同一语义的历史镜像，统一只接受当前在册活人。
    // 空字符串仍表示明确出缺，并同步清空两侧。
    if (leader) {
      var living = _narrativeResolveAliveChar(G, leader);
      if (!living) {
        _narrativeSkipTrace('party.leader', (party.name || party.id) + '←' + leader, reason || 'structured party update');
        return false;
      }
      leader = living.name;
    }
    var old = party.leader || party.head || '';
    if (party.leader === leader && party.head === leader) return false;
    party.leader = leader;
    party.head = leader;
    return true;
  }

  function _setFactionCapital(fac, capital, G, reason) {
    if (!fac || !capital) return false;
    var old = fac.capital || fac.capitalName || '';
    if (old === capital && fac.capital === capital) return false;
    fac.capital = capital;
    fac.capitalName = capital;
    if (G && G._turnReport) G._turnReport.push({ type:'faction_update', entity:fac.name || fac.id, field:'capital', old:old, new:capital, reason:reason || '叙事都城补录', turn:G.turn||0 });
    return true;
  }

  function _setFactionFields(fac, fields, value, G, reason) {
    if (!fac || !fields || !fields.length || value == null || value === '') return false;
    var old = fac[fields[0]];
    var changed = false;
    fields.forEach(function(field) {
      if (fac[field] !== value) {
        fac[field] = value;
        changed = true;
      }
    });
    if (G && G._turnReport && changed) {
      G._turnReport.push({ type:'faction_update', entity:fac.name || fac.id, field:fields[0], old:old, new:value, reason:reason || '叙事势力字段补录', turn:G.turn||0 });
    }
    return changed;
  }

  function _setFactionRelationPair(G, a, b, kind) {
    if (!G || !a || !b || a === b) return false;
    var hostile = /绝交|断交|宣战|开战|敌对|犯界|寇边|背盟/.test(kind || '');
    var friendly = /结盟|缔盟|和好|通使|修好|朝贡|纳贡|称臣|封贡/.test(kind || '');
    if (!hostile && !friendly) return false;
    var val = hostile ? -80 : 65;
    var oldA = a.relations && a.relations[b.name || b.id];
    var oldB = b.relations && b.relations[a.name || a.id];
    if (!a.relations) a.relations = {};
    if (!b.relations) b.relations = {};
    a.relations[b.name || b.id] = val;
    b.relations[a.name || a.id] = val;
    a.attitude = hostile ? 'hostile' : (kind === '称臣' ? 'vassal' : 'friendly');
    b.attitude = hostile ? 'hostile' : 'friendly';
    var listName = hostile ? 'enemies' : 'allies';
    var otherList = hostile ? 'allies' : 'enemies';
    if (!Array.isArray(a[listName])) a[listName] = [];
    if (!Array.isArray(b[listName])) b[listName] = [];
    if (a[listName].indexOf(b.name || b.id) < 0) a[listName].push(b.name || b.id);
    if (b[listName].indexOf(a.name || a.id) < 0) b[listName].push(a.name || a.id);
    if (Array.isArray(a[otherList])) a[otherList] = a[otherList].filter(function(x){ return x !== (b.name || b.id); });
    if (Array.isArray(b[otherList])) b[otherList] = b[otherList].filter(function(x){ return x !== (a.name || a.id); });
    if (G._turnReport && (oldA !== val || oldB !== val)) {
      G._turnReport.push({ type:'faction_update', entity:(a.name || a.id) + '/' + (b.name || b.id), field:'relation', old:oldA, new:val, reason:'叙事外交补录:' + kind, turn:G.turn||0 });
    }
    return oldA !== val || oldB !== val;
  }

  function _applyNarrativeFactionFieldFallback(G, aiOutput) {
    if (!G || !Array.isArray(G.facs) || !aiOutput) return 0;
    var narrative = _getNarrativeText(aiOutput);
    if (!narrative) return 0;
    var count = 0;
    var seen = {};
    G.facs.forEach(function(fac) {
      var facPat = _entityLoosePattern(fac);
      if (!facPat) return;
      var leaderPatterns = [
        new RegExp(facPat + '[^。；;\\n]{0,10}?(?:奉|拥立|推戴|立|共推)\\s*([^，,。；;\\n\\s]{2,16})\\s*(?:为主|为首|为首领|为汗|为王|为帝|继位|嗣位|掌权)', 'g'),
        new RegExp(facPat + '[^。；;\\n]{0,12}?(?:首领|君主|国主|大汗|汗|主|领袖)[^。；;\\n]{0,12}?(?:改为|更为|换为|由[^，,。；;\\n]{0,10}?改为)\\s*([^，,。；;\\n\\s]{2,16})', 'g'),
        new RegExp('([^，,。；;\\n\\s]{2,16})\\s*(?:继为|成为|出任|接掌|掌管)[^。；;\\n]{0,8}?' + facPat + '[^。；;\\n]{0,8}?(?:首领|国主|大汗|汗|君主|领袖|之主)', 'g')
      ];
      leaderPatterns.forEach(function(pat) {
        var m;
        while ((m = pat.exec(narrative)) !== null) {
          var leader = _resolveNarrativeCommanderName(G, m[1]);
          var key = (fac.id || fac.name) + '|leader|' + leader;
          if (!leader || seen[key]) continue;   // seen 幂等·同回合同一势力同一首领不双落账
          seen[key] = true;
          // ★2026-07-16 刀④·实体+死人闸:势力首领须精确命中 GM.chars 且在世·幻影/死者不落账+留痕。
          //   保留直写(势力继统 sink 耦合 apply 主流程/死亡级联)·_setFactionLeader 已把 fac.leader/ruler/leadership.ruler 三镜像键一并同步。
          if (!_narrativeResolveAliveChar(G, leader)) { _narrativeSkipTrace('faction.leader', (fac.name || fac.id) + '←' + leader, m[0]); continue; }
          if (_setFactionLeader(fac, leader, G, '叙事首领补录')) count++;
        }
      });
      var capPat = new RegExp(facPat + '[^。；;\\n]{0,12}?(?:迁都|定都|建都|移都|都于|驻跸于)\\s*([^，,。；;\\n\\s]{2,16})', 'g');
      var cm;
      while ((cm = capPat.exec(narrative)) !== null) {
        var capital = _resolveNarrativePlaceName(G, cm[1]);
        var ckey = (fac.id || fac.name) + '|capital|' + capital;
        if (!capital || seen[ckey]) continue;
        seen[ckey] = true;
        if (_setFactionCapital(fac, capital, G, '叙事都城补录')) count++;
      }
      var factionTextRules = [
        { labels:'政体|政府形态|体制', fields:['government'] },
        { labels:'类型|势力类型|性质', fields:['type','factionType'] },
        { labels:'战略目标|目标|大略', fields:['goal','strategicGoal'] },
        { labels:'战态|战争状态|军事态势', fields:['warState'] },
        { labels:'国策|政策|施政方针', fields:['policy','statePolicy'] },
        { labels:'经济政策|财政方略', fields:['economicPolicy'] },
        { labels:'意识形态|理念', fields:['ideology'] },
        { labels:'战略重点|军政方略', fields:['strategicPriorities'] }
      ];
      factionTextRules.forEach(function(rule) {
        var pat = _narrativeTextPattern(facPat, rule.labels);
        var tm;
        while ((tm = pat.exec(narrative)) !== null) {
          var value = _cleanNarrativeFieldValue(tm[1]);
          var tkey = (fac.id || fac.name) + '|' + rule.fields[0] + '|' + value;
          if (!value || seen[tkey]) continue;
          seen[tkey] = true;
          if (_setFactionFields(fac, rule.fields, value, G, '叙事势力字段补录')) count++;
        }
      });
      var factionNumberRules = [
        { labels:'动员程度|动员率|动员水平', fields:['mobilization','mobilizationLevel'], clamp:true },
        { labels:'凝聚|凝聚度|内部凝聚', fields:['cohesion'], clamp:true },
        { labels:'稳定|稳定度|政权稳定', fields:['stability'], clamp:true },
        { labels:'民望|声望|威望', fields:['publicOpinion','prestige'], clamp:true }
      ];
      factionNumberRules.forEach(function(rule) {
        var pat = _narrativeValuePattern(facPat, rule.labels);
        var nm;
        while ((nm = pat.exec(narrative)) !== null) {
          var rawNum = (nm[1] || '') + (nm[2] || '');
          var value = _parseNarrativeNumber(rawNum);
          if (!isFinite(value)) continue;
          value = rule.clamp ? Math.round(_clampNum(value, 0, 100)) : Math.max(0, Math.round(value));
          var nkey = (fac.id || fac.name) + '|' + rule.fields[0] + '|' + value;
          if (seen[nkey]) continue;
          seen[nkey] = true;
          if (_setFactionFields(fac, rule.fields, value, G, '叙事势力数值补录')) count++;
        }
      });
    });
    for (var i = 0; i < G.facs.length; i += 1) {
      for (var j = 0; j < G.facs.length; j += 1) {
        if (i === j) continue;
        var a = G.facs[i], b = G.facs[j];
        var aPat = _entityLoosePattern(a), bPat = _entityLoosePattern(b);
        if (!aPat || !bPat) continue;
        var relPat = new RegExp(aPat + '[^。；;\\n]{0,8}?(?:与|同|和)' + bPat + '[^。；;\\n]{0,8}?(绝交|断交|宣战|开战|结盟|缔盟|和好|修好|通使|朝贡|纳贡|称臣|封贡)', 'g');
        var rm;
        while ((rm = relPat.exec(narrative)) !== null) {
          var rkey = (a.id || a.name) + '|' + (b.id || b.name) + '|' + rm[1];
          if (seen[rkey]) continue;
          seen[rkey] = true;
          if (_setFactionRelationPair(G, a, b, rm[1])) count++;
        }
      }
    }
    try { if (global.TM && TM.FactionIndex && typeof TM.FactionIndex.rebuild === 'function') TM.FactionIndex.rebuild(); } catch(_) {}
    try {
      if (global.TMPhase8FormalBridge && typeof global.TMPhase8FormalBridge.refresh === 'function') {
        global.TMPhase8FormalBridge.refresh();
      }
    } catch(_) {}
    return count;
  }

  /** 深度 merge updates 到 entity·每个字段变化记入 _turnReport */
  function _mergeUpdatesToEntity(entity, updates, reportType, entityName, reason, failed, aiOutput) {
    if (!entity || !updates) return 0;
    var G = global.GM;
    var count = 0;
    if (typeof _isPlainObject !== 'function' || !_isPlainObject(updates)) {
      if (Array.isArray(failed)) failed.push({ field:reportType || 'entity_update', entity:entityName || entity.name || entity.id, reason:'updates must be a plain JSON object' });
      return 0;
    }
    var _mergeBasePath = ({
      char_update: 'chars.0',
      faction_update: 'facs.0',
      party_update: 'parties.0',
      class_update: 'classes.0',
      region_update: 'adminHierarchy.0'
    })[reportType] || 'entityUpdates.0';
    // ★ 落地守卫(2026-06-02)·弱模型脏输出探测：剔除 U+FFFD 替换字符·防乱码静默写库
    function _sanitizeAiStr(raw, ctxKey){
      if (typeof raw !== 'string' || raw.indexOf('�') < 0) return raw;
      var cleaned = raw.replace(/�/g, '');
      try {
        if (G) { G._aiDataIntegrityLog = G._aiDataIntegrityLog || []; G._aiDataIntegrityLog.push({ turn: G.turn||0, entity: entityName||'', field: ctxKey||'', removed: raw.length - cleaned.length, sample: raw.slice(0,40) }); }
        console.warn('[ai-applier-guard] U+FFFD 替换字符已剔除·字段=' + (entityName||'') + '.' + (ctxKey||''));
      } catch(_){}
      return cleaned;
    }
    function _blockedMergeKey(key, isChar) {
      if (/^_/.test(key) || /^(?:__proto__|prototype|constructor)$/i.test(key)) return true;
      // 人物存亡与死亡元数据只能由 character_deaths → applyOneDeath 写入。
      return !!(isChar && /^(?:alive|dead|isDead|deceased|positionAtDeath|diedAt|death[a-zA-Z0-9_]*|_death[a-zA-Z0-9_]*)$/i.test(key));
    }
    // "+field" 是旧数组追加语法；只保留代码与提示明确承诺的仕途履历字段。
    // 先剥 "+" 再走同一安全检查，防 +alive / +_deathCause / +__proto__ 绕过。
    var _APPENDABLE_UPDATE_ARRAY_FIELDS = { careerHistory: true };
    function _rejectMergeKey(key, why) {
      if (Array.isArray(failed)) failed.push({
        field: reportType || 'entity_update', entity: entityName || entity.name || entity.id,
        updateKey: key, reason: why || 'blocked update field'
      });
    }
    Object.keys(updates).forEach(function(key){
      var isAppend = /^\+/.test(key);
      var realKey = isAppend ? key.slice(1).trim() : key;
      if (!realKey || _blockedMergeKey(realKey, reportType === 'char_update')) {
        _rejectMergeKey(key, 'blocked update field: ' + realKey);
        return;
      }
      // ── 刀C·C3(2026-07-19)·char_update 敏感字段(失势向量)来源判据 ──
      //   stance/grade(清誉)/reputation/fame/faction 是 AI「按真实历史幻觉」最爱的失势向量·此前任写。过字段级同款来源判据
      //   (validators._sensitiveCharFieldSourced 复用 _writeActionSourced：玩家诏令/司法态/结构化互证[排 char_updates 自证]/本回合弹劾朝议输入)：
      //   无源→跳过该字段(其余字段照常 merge)·validators 侧留痕弱自查纸条；有源→_c3approved 豁免下方 _isPathBlocked 禁区·经既有 generic
      //   路径正常落(这些字段已入禁区堵万能键 anyPathChanges/changes·但 char_updates 经本闸判源后放行)。loyalty 另有 canonical 闸·不在此列。★宁漏勿误杀。
      var _c3approved = false;
      if (reportType === 'char_update' && !isAppend && /^(?:stance|grade|reputation|fame|faction)$/.test(realKey)) {
        var _c3g = global.TM && global.TM.AIChange && global.TM.AIChange.WriteGuards && global.TM.AIChange.WriteGuards.sensitiveCharFieldSourced;
        if (_c3g && !_c3g(G, (aiOutput || null), entity, realKey, entityName)) return;   // 无源·validators 已留痕·跳过该敏感字段
        _c3approved = true;   // 有源·放行·豁免下方 _isPathBlocked(该字段已入禁区仅为堵万能键·char_updates 经本闸放行)
      }
      if (isAppend && !_APPENDABLE_UPDATE_ARRAY_FIELDS[realKey]) {
        _rejectMergeKey(key, 'array append not allowed: ' + realKey);
        return;
      }
      var newVal = _sanitizeAiStr(updates[key], key);
      var valuePath = _mergeBasePath + '.' + realKey;
      if (!_c3approved && (typeof _isPathBlocked !== 'function' || _isPathBlocked(valuePath))) {
        _rejectMergeKey(key, 'blocked update path: ' + valuePath);
        return;
      }
      if (typeof _validateNestedJsonValue !== 'function') {
        _rejectMergeKey(key, 'nested JSON validator unavailable');
        return;
      }
      var valueGate = _validateNestedJsonValue(valuePath, newVal, 0);
      if (!valueGate || !valueGate.ok) {
        _rejectMergeKey(key, (valueGate && valueGate.reason) || 'invalid nested JSON value');
        return;
      }
      var oldVal = entity[realKey];
      // 数组追加（key 以 + 开头·如 "+careerHistory"）
      if (isAppend) {
        if (!Array.isArray(entity[realKey])) entity[realKey] = [];
        if (Array.isArray(newVal)) entity[realKey] = entity[realKey].concat(newVal);
        else entity[realKey].push(newVal);
        count++;
      } else if (typeof newVal === 'object' && newVal !== null && !Array.isArray(newVal) &&
                 typeof entity[realKey] === 'object' && entity[realKey] !== null && !Array.isArray(entity[realKey])) {
        // 对象深 merge
        Object.keys(newVal).forEach(function(subK){
          if (_blockedMergeKey(subK, reportType === 'char_update')) {
            _rejectMergeKey(realKey + '.' + subK, 'blocked nested update field: ' + subK);
            return;
          }
          entity[realKey][subK] = _sanitizeAiStr(newVal[subK], realKey + '.' + subK);
        });
        count++;
      } else if (reportType === 'char_update' && realKey === 'loyalty' && typeof global.setCharacterLoyalty === 'function') {
        var _loySet = global.setCharacterLoyalty(entity, newVal, reason, {
          source: 'ai-char-update-loyalty',
          ai: true,
          defaultReason: 'AI\u63A8\u6F14',
          maxJump: 20
        });
        if (!_loySet || !_loySet.ok || _loySet.blocked) return;
        count++;
      } else {
        entity[realKey] = newVal;
        count++;
      }
      if (G && G._turnReport) {
        G._turnReport.push({
          type: reportType || 'entity_update',
          entity: entityName || entity.name || entity.id,
          field: realKey,
          old: oldVal,
          new: entity[realKey],
          turn: G.turn||0
        });
      }
      // 若是人物更新·同步登记到 turnChanges.characters（供史记数值变化说明显示）
      if (reportType === 'char_update' && entityName && !isAppend) {
        try {
          if (realKey !== 'loyalty') _recordCharChange('chars.' + entityName + '.' + realKey, oldVal, entity[realKey], reason || '');
        } catch(_rcE){ if(window.TM&&TM.errors) TM.errors.capture(_rcE,'applier.recordCharChange'); }
      }
    });
    return count;
  }

  function _applyStructuredPartyUpdate(G, party, pu, failed) {
    if (!party || !pu || pu.updates == null) return 0;
    if (typeof _isPlainObject !== 'function' || !_isPlainObject(pu.updates)) {
      if (Array.isArray(failed)) failed.push({ party_update:pu.name, reason:'updates must be a plain JSON object' });
      return 0;
    }
    var updates = _safeOwnCopy(pu.updates);
    var candidates = [];
    ['leader','head','newLeader','new_leader','leaderName','leader_name','ruler'].forEach(function(key) {
      if (!Object.prototype.hasOwnProperty.call(updates, key)) return;
      candidates.push(String(updates[key] == null ? '' : updates[key]).trim());
      delete updates[key];
    });
    var count = 0;
    if (candidates.length) {
      var unique = candidates.filter(function(v, i, arr) { return arr.indexOf(v) === i; });
      if (unique.length > 1) {
        if (Array.isArray(failed)) failed.push({ party_update:pu.name, reason:'conflicting party leader mirrors' });
      } else {
        var ref = unique[0];
        var living = ref ? _narrativeResolveAliveChar(G, ref) : null;
        if (ref && !living) {
          if (Array.isArray(failed)) failed.push({ party_update:pu.name, reason:'party leader must be an existing living character: ' + ref });
        } else if (_setPartyLeader(party, living ? (living.id || living.name) : '', G, pu.reason || 'AI党派首领变更')) count++;
      }
    }
    return count + _mergeUpdatesToEntity(party, updates, 'party_update', party.name, pu.reason || '', failed);
  }

  // ── Export ──
  var TM = global.TM = global.TM || {};
  TM.AIChange = TM.AIChange || {};
  TM.AIChange.Narrative = {
    applyNarrativeArmyFieldFallback: _applyNarrativeArmyFieldFallback,
    applyNarrativeFactionFieldFallback: _applyNarrativeFactionFieldFallback,
    applyNarrativeRegionFieldFallback: _applyNarrativeRegionFieldFallback,
    applyStructuredPartyUpdate: _applyStructuredPartyUpdate,
    cleanNarrativeFieldValue: _cleanNarrativeFieldValue,
    cleanNarrativeToken: _cleanNarrativeToken,
    cleanRegionOfficeTitle: _cleanRegionOfficeTitle,
    collectAdminDivisions: _collectAdminDivisions,
    entityLoosePattern: _entityLoosePattern,
    findNarrativeFaction: _findNarrativeFaction,
    mapRegionByNameOrId: _mapRegionByNameOrId,
    mergeUpdatesToEntity: _mergeUpdatesToEntity,
    narrativeTextPattern: _narrativeTextPattern,
    narrativeValuePattern: _narrativeValuePattern,
    parseNarrativeNumber: _parseNarrativeNumber,
    refreshMapFieldViews: _refreshMapFieldViews,
    regionNarrativeRecords: _regionNarrativeRecords,
    resolveNarrativePlaceName: _resolveNarrativePlaceName,
    setFactionCapital: _setFactionCapital,
    setFactionFields: _setFactionFields,
    setFactionLeader: _setFactionLeader,
    setPartyLeader: _setPartyLeader,
    safeOwnCopy: _safeOwnCopy,
    resolveAliveChar: _narrativeResolveAliveChar,
    setFactionRelationPair: _setFactionRelationPair,
    setRegionGovernorMirrors: _setRegionGovernorMirrors,
    setRegionOwnerMirrors: _setRegionOwnerMirrors,
    setRegionScalarMirrors: _setRegionScalarMirrors,
    syncRegionGovernorCharacter: _syncRegionGovernorCharacter,
    writeRegionGovernorAliases: _writeRegionGovernorAliases,
    writeRegionOwnerAliases: _writeRegionOwnerAliases,
  };

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = TM.AIChange.Narrative;
  }
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
