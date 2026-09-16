// @ts-check
/*
 * tm-class-minxin-bridge.js
 * Keeps class mood and the minxin class/regional ledger in one explainable account.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};

  function toArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
  }

  function clone(v) {
    if (v === undefined || v === null) return v;
    try { return JSON.parse(JSON.stringify(v)); }
    catch (_) {
      if (Array.isArray(v)) return v.slice();
      if (typeof v === 'object') {
        var out = {};
        Object.keys(v).forEach(function(k) { out[k] = v[k]; });
        return out;
      }
      return v;
    }
  }

  function pickRoot(root) {
    if (root && typeof root === 'object') return root;
    if (global.GM && typeof global.GM === 'object') return global.GM;
    if (global.scriptData && typeof global.scriptData === 'object') return global.scriptData;
    return {};
  }

  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function round2(n) {
    n = Number(n);
    if (!isFinite(n)) n = 0;
    return Math.round(n * 100) / 100;
  }

  function textOf(v) {
    if (v === undefined || v === null) return '';
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') return String(v);
    if (Array.isArray(v)) return v.map(textOf).filter(Boolean).join(' ');
    if (typeof v === 'object') {
      var keys = ['name', 'className', 'title', 'region', 'regionName', 'id', 'text', 'reason', 'summary'];
      for (var i = 0; i < keys.length; i += 1) {
        if (v[keys[i]] !== undefined && v[keys[i]] !== null && v[keys[i]] !== '') return textOf(v[keys[i]]);
      }
    }
    return '';
  }

  function compact(v, maxLen) {
    var text = String(textOf(v) || '').replace(/\s+/g, ' ').trim();
    maxLen = Number(maxLen) || 160;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function normalizeName(v) {
    return String(v || '').replace(/[\s\u3000'"`.,;:!?()[\]{}<>\/\\|_-]+/g, '').toLowerCase().trim();
  }

  function explicitKey(v) {
    return String(v || '').replace(/\s+/g, '').toLowerCase().trim();
  }

  function getClasses(root) {
    root = pickRoot(root);
    if (Array.isArray(root.classes)) return root.classes;
    if (root.scriptData && Array.isArray(root.scriptData.classes)) return root.scriptData.classes;
    if (global.P && Array.isArray(global.P.classes)) return global.P.classes;
    if (global.scriptData && Array.isArray(global.scriptData.classes)) return global.scriptData.classes;
    return [];
  }

  function lookupPath(root, path) {
    root = pickRoot(root);
    var parts = String(path || '').split('.').filter(Boolean);
    var bases = [
      root && root.classMinxin,
      root && root.tuning && root.tuning.classMinxin,
      root && root.config && root.config.classMinxin,
      root && root.settings && root.settings.classMinxin,
      global.P && P.conf && P.conf.classMinxin
    ];
    for (var b = 0; b < bases.length; b += 1) {
      var cur = bases[b];
      if (!cur || typeof cur !== 'object') continue;
      for (var i = 0; i < parts.length; i += 1) {
        if (!cur || typeof cur !== 'object' || !(parts[i] in cur)) {
          cur = undefined;
          break;
        }
        cur = cur[parts[i]];
      }
      if (cur !== undefined && cur !== null && cur !== '') return cur;
    }
    return undefined;
  }

  function tuneNumber(root, path, fallback) {
    var value = lookupPath(root, path);
    var n = Number(value);
    return isFinite(n) ? n : fallback;
  }

  function getTuning(root) {
    root = pickRoot(root);
    return {
      thresholds: {
        pressureRowTrueMax: tuneNumber(root, 'thresholds.pressureRowTrueMax', 45),
        pressureRowDelta: tuneNumber(root, 'thresholds.pressureRowDelta', 0.01),
        byClassOnlyTrueMax: tuneNumber(root, 'thresholds.byClassOnlyTrueMax', 38),
        courtIssueTrueMax: tuneNumber(root, 'thresholds.courtIssueTrueMax', 45),
        courtIssuePressureDelta: tuneNumber(root, 'thresholds.courtIssuePressureDelta', 0.3),
        courtIssueUrgentTrueMax: tuneNumber(root, 'thresholds.courtIssueUrgentTrueMax', 30),
        courtIssueHighTrueMax: tuneNumber(root, 'thresholds.courtIssueHighTrueMax', 38),
        uprisingCandidateTrueMax: tuneNumber(root, 'thresholds.uprisingCandidateTrueMax', 35),
        uprisingCandidatePressureDelta: tuneNumber(root, 'thresholds.uprisingCandidatePressureDelta', 1.2),
        uprisingCandidateByPhase: tuneNumber(root, 'thresholds.uprisingCandidateByPhase', 1),
        uprisingLevel3TrueMax: tuneNumber(root, 'thresholds.uprisingLevel3TrueMax', 18),
        uprisingLevel2TrueMax: tuneNumber(root, 'thresholds.uprisingLevel2TrueMax', 26),
        uprisingLevel3Momentum: tuneNumber(root, 'thresholds.uprisingLevel3Momentum', 52),
        uprisingLevel2Momentum: tuneNumber(root, 'thresholds.uprisingLevel2Momentum', 38)
      }
    };
  }

  function ensureMinxin(root) {
    root = pickRoot(root);
    if (!root.minxin || typeof root.minxin !== 'object' || Array.isArray(root.minxin)) {
      var old = Number(root.minxin);
      if (!isFinite(old)) old = 60;
      root.minxin = { trueIndex: old, perceivedIndex: old, byClass: {}, sources: {} };
    }
    if (!root.minxin.byClass || typeof root.minxin.byClass !== 'object' || Array.isArray(root.minxin.byClass)) root.minxin.byClass = {};
    if (!root.minxin.sources || typeof root.minxin.sources !== 'object' || Array.isArray(root.minxin.sources)) root.minxin.sources = {};
    if (!Array.isArray(root.minxin.alerts)) root.minxin.alerts = [];
    return root.minxin;
  }

  function classKeyOf(input) {
    var cls = input || {};
    var explicit = cls.classKey || cls.key || cls.id || cls.classId;
    if (!explicit && Array.isArray(cls.populationKeys) && cls.populationKeys[0]) explicit = cls.populationKeys[0];
    if (!explicit && Array.isArray(cls.classPopulationKeys) && cls.classPopulationKeys[0]) explicit = cls.classPopulationKeys[0];
    if (!explicit && Array.isArray(cls.popKeys) && cls.popKeys[0]) explicit = cls.popKeys[0];
    if (explicit) return explicitKey(explicit) || 'class';
    if (!explicit) explicit = cls.name || cls.className || cls.class || cls.title || '';
    return normalizeName(explicit || 'class') || 'class';
  }

  function classNameOf(cls) {
    return compact(cls && (cls.name || cls.className || cls.class || cls.title || cls.id || cls.key), 80);
  }

  function findClass(root, input) {
    var wantedName = compact(input && (input.className || input.name || input.class || input.actorId), 120);
    var wantedKey = explicitKey(input && (input.classKey || input.key || input.id));
    var nWanted = normalizeName(wantedName);
    var classes = getClasses(root);
    for (var i = 0; i < classes.length; i += 1) {
      var cls = classes[i];
      if (!cls) continue;
      if (wantedKey && classKeyOf(cls) === wantedKey) return cls;
      if (nWanted && normalizeName(classNameOf(cls)) === nWanted) return cls;
    }
    return null;
  }

  function classSatisfaction(cls, fallback) {
    var n = Number(cls && (cls.satisfaction != null ? cls.satisfaction : (cls.support != null ? cls.support : cls.mood)));
    return isFinite(n) ? clamp(n, 0, 100) : (fallback == null ? 50 : fallback);
  }

  function classInfluence(cls) {
    var n = Number(cls && (cls.influence != null ? cls.influence : cls.classInfluence));
    return isFinite(n) ? clamp(n, 0, 100) : 50;
  }

  function classPopulationShare(cls) {
    var direct = Number(cls && (cls._populationShare != null ? cls._populationShare : cls.populationShare));
    if (isFinite(direct) && direct > 0) return clamp(direct, 0, 1);
    var size = cls && cls.size;
    if (typeof size === 'number' && isFinite(size)) return size > 1 ? clamp(size / 100, 0, 1) : clamp(size, 0, 1);
    if (typeof size === 'string') {
      var m = size.match(/([0-9]+(?:\.[0-9]+)?)\s*%/);
      if (m) return clamp(Number(m[1]) / 100, 0, 1);
      var n = Number(size);
      if (isFinite(n)) return n > 1 ? clamp(n / 100, 0, 1) : clamp(n, 0, 1);
    }
    return 0;
  }

  function unrestPhaseOf(cls) {
    var sat = classSatisfaction(cls, 50);
    var levels = cls && cls.unrestLevels || {};
    var revolt = Number(levels.revolt);
    if (!isFinite(revolt)) revolt = 90;
    if (sat <= 30 || revolt <= 20) return 'uprising';
    if (sat <= 45 || revolt <= 35) return 'brewing';
    if (sat <= 60 || Number(levels.grievance) <= 45) return 'uneasy';
    return 'calm';
  }

  function perceivedBias(root) {
    var mx = ensureMinxin(root);
    var trueIndex = Number(mx.trueIndex);
    var perceivedIndex = Number(mx.perceivedIndex);
    if (!isFinite(trueIndex) || !isFinite(perceivedIndex)) return 0;
    return clamp(perceivedIndex - trueIndex, -20, 30);
  }

  function syncByClass(root, options) {
    root = pickRoot(root);
    options = options || {};
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var mx = ensureMinxin(root);
    var classes = getClasses(root);
    var result = { synced: 0, divergences: [], rows: [] };
    var bias = perceivedBias(root);
    classes.forEach(function(cls) {
      if (!cls || typeof cls !== 'object') return;
      var key = classKeyOf(cls);
      var name = classNameOf(cls);
      var sat = round2(classSatisfaction(cls, 50));
      var influence = round2(classInfluence(cls));
      var old = mx.byClass[key] && typeof mx.byClass[key] === 'object' ? mx.byClass[key] : {};
      var oldIndex = Number(old.true != null ? old.true : old.index);
      if (isFinite(oldIndex) && Math.abs(oldIndex - sat) >= 0.01) {
        result.divergences.push({
          classKey: key,
          className: name,
          before: round2(oldIndex),
          after: sat,
          delta: round2(sat - oldIndex)
        });
      }
      var row = {
        index: sat,
        true: sat,
        perceived: round2(clamp(sat + bias, 0, 100)),
        className: name,
        satisfaction: sat,
        influence: influence,
        unrestPhase: unrestPhaseOf(cls),
        demand: compact(cls.demands || cls.currentDemand || cls.shortGoal || '', 160),
        populationShare: round2(classPopulationShare(cls)),
        lastSyncTurn: turn,
        source: compact(options.source || 'class-minxin-bridge', 80)
      };
      if (old && old.factors) row.factors = clone(old.factors);
      if (old && old.lastPressure) row.lastPressure = clone(old.lastPressure);
      mx.byClass[key] = row;
      result.synced++;
      result.rows.push(clone(row));
    });
    root._classMinxinLastSync = clone({
      turn: turn,
      source: options.source || 'class-minxin-bridge',
      synced: result.synced,
      divergences: result.divergences.slice(0, 12)
    });
    return result;
  }

  function getLeafDivisions(root) {
    root = pickRoot(root);
    var bridge = global.IntegrationBridge || (global.window && global.window.IntegrationBridge);
    if (bridge && typeof bridge.getLeafDivisions === 'function' && root.adminHierarchy) {
      try { return bridge.getLeafDivisions(root.adminHierarchy, 'player') || []; } catch (_) {}
    }
    var leaves = [];
    function walk(nodes) {
      toArray(nodes).forEach(function(node) {
        if (!node || typeof node !== 'object') return;
        var kids = toArray(node.children || node.divisions || node.subs);
        if (!kids.length) leaves.push(node);
        else walk(kids);
      });
    }
    var ah = root.adminHierarchy;
    if (ah && typeof ah === 'object') {
      if (Array.isArray(ah.divisions)) walk(ah.divisions);
      else Object.keys(ah).forEach(function(k) {
        var fac = ah[k];
        walk(fac && (fac.divisions || fac.children || fac.subs));
      });
    }
    return leaves;
  }


  // Current regional conditions are a stock; pressure ledger entries are changes to that stock.
  // Resolve actual administrative ancestry, never a substring of a foreign place name.
  var _regionIndex = {root:null,ah:null,turn:null,entries:null,queries:new Map()};
  function regionEntries(root) {
    root = pickRoot(root);
    var ah = root.adminHierarchy || (global.P && global.P.adminHierarchy) || {};
    var turn=Number(root.turn)||0;
    if (_regionIndex.root===root && _regionIndex.ah===ah && _regionIndex.turn===turn && _regionIndex.entries) return _regionIndex.entries;
    _regionIndex={root:root,ah:ah,turn:turn,entries:null,queries:new Map()};
    var result = [];
    var entries = Array.isArray(ah.divisions) ? [['player', ah]] : Object.keys(ah).map(function(k) { return [k, ah[k]]; });
    entries.forEach(function(pair) {
      var key = pair[0], branch = pair[1] || {};
      var aliases = [key, branch.name, branch.factionId, branch.id];
      if (key === 'player') aliases.push(root.playerFaction, root.playerFactionId, global.P && global.P.playerInfo && global.P.playerInfo.factionName);
      toArray(root.facs || root.factions).forEach(function(f) {
        if (f && (f.isPlayer && key === 'player' || aliases.indexOf(f.id) >= 0 || aliases.indexOf(f.name) >= 0)) aliases.push(f.id, f.name);
      });
      aliases = aliases.filter(Boolean).map(explicitKey);
      function walk(nodes, parents) {
        toArray(nodes).forEach(function(n) {
          if (!n || typeof n !== 'object') return;
          var children = toArray(n.children || n.divisions || n.subs);
          if (children.length) walk(children, parents.concat([n]));
          else result.push({ leaf:n, ancestors:parents, factionKey:key, factionAliases:aliases });
        });
      }
      walk(Array.isArray(branch) ? branch : branch.divisions || branch.children, []);
    });
    _regionIndex.entries=result; return result;
  }

  function resolveRegions(root, descriptor, faction) {
    var d = descriptor && typeof descriptor === 'object' ? descriptor : { region:descriptor };
    var stable = d.regionId || d.mapRegionId || d.adminBinding || d.id;
    var name = d.region || d.regionName || d.name || d.division || d.title;
    var owner = d.factionId || d.faction || d.ownerFactionId || d.owner || d.factionName || faction;
    var requested = explicitKey(stable || name);
    if (!requested) return [];
    var entries=regionEntries(root), cacheKey=explicitKey(owner)+'|'+(stable?'id:':'name:')+requested;
    if(_regionIndex.queries.has(cacheKey))return _regionIndex.queries.get(cacheKey);
    var rows = entries.filter(function(e) {
      if (owner && e.factionAliases.indexOf(explicitKey(owner)) < 0) return false;
      return [e.leaf].concat(e.ancestors).some(function(n) {
        var keys = stable ? [n.id, n.regionId, n.mapRegionId, !n.id ? n.name : null] : [n.id, n.name, n.regionId, n.mapRegionId, n.officialName];
        return keys.filter(Boolean).some(function(k) { return explicitKey(k) === requested; });
      });
    });
    // Unscoped homonyms are unknown, not permission to touch both countries.
    if (!owner && rows.some(function(e) { return e.factionKey !== rows[0].factionKey; })) rows=[];
    _regionIndex.queries.set(cacheKey,rows); return rows;
  }

  function regionSnapshot(root, descriptor) {
    root = pickRoot(root);
    var selected = resolveRegions(root, descriptor);
    var values = [], sum = 0, weightSum = 0, classes = getClasses(root);
    selected.forEach(function(e) {
      var localRows = e.leaf.socialConditions && e.leaf.socialConditions.classes;
      if (Array.isArray(localRows) && localRows.length) {
        localRows.forEach(function(v) {
          if (!v || v.satisfaction==null || !isFinite(Number(v.satisfaction))) return;
          var weight=Number(v.weight!=null?v.weight:1); if(!isFinite(weight)||weight<=0)return;
          var pd=e.leaf.populationDetail||e.leaf.population||{}, localWeight=weight*(selected.length>1?Math.max(1,Number(pd.mouths)||1):1);
          var linked=classes.find(function(c){return c && (v.classId ? String(c.id||c.key)===String(v.classId) : classNameOf(c)===(v.className||v.name));});
          var delta=0;
          if(linked && v.classBaselineSatisfaction!=null && isFinite(Number(v.classBaselineSatisfaction)) && linked.satisfaction!=null && isFinite(Number(linked.satisfaction)))delta=Number(linked.satisfaction)-Number(v.classBaselineSatisfaction);
          var satisfaction=clamp(Number(v.satisfaction)+delta,0,100);
          sum+=(100-satisfaction)*localWeight;weightSum+=localWeight;
          values.push({regionId:e.leaf.id||e.leaf.name,factionId:e.factionKey,classKey:v.classId||v.className||v.name,className:v.className||v.name,satisfaction:satisfaction,localSatisfaction:Number(v.satisfaction),classDelta:delta,weight:weight,reason:v.reason||v.note||''});
        });
        return;
      }
      classes.forEach(function(cls) {
        if (!cls) return;
        var faction = cls.factionId || cls.faction;
        if (faction && e.factionAliases.indexOf(explicitKey(faction)) < 0) return;
        if (!faction && e.factionKey !== 'player') return;
        var variant = null, specificity = -1;
        toArray(cls.regionalVariants).forEach(function(v) {
          if (!v) return;
          var hits = resolveRegions(root, v, faction || e.factionKey);
          if (!hits.some(function(h) { return h.leaf === e.leaf; })) return;
          var rank = 1 / Math.max(1, hits.length);
          if (rank > specificity) { variant = v; specificity = rank; }
        });
        var raw = variant && variant.satisfaction != null ? variant.satisfaction : cls.satisfaction;
        if (raw === null || raw === undefined || raw === '' || !isFinite(Number(raw))) return;
        var explicitWeight = variant && (variant.weight != null ? variant.weight : variant.share);
        var weight = explicitWeight != null ? Number(explicitWeight) : classPopulationShare(cls) || 1;
        if (!isFinite(weight) || weight <= 0) return;
        // An aggregate district uses population weights without treating absent population as zero.
        var pd = e.leaf.populationDetail || e.leaf.population || {};
        var localWeight = weight * (selected.length > 1 ? Math.max(1, Number(pd.mouths) || 1) : 1);
        var satisfaction = clamp(Number(raw), 0, 100);
        sum += (100 - satisfaction) * localWeight; weightSum += localWeight;
        values.push({ regionId:e.leaf.id || e.leaf.name, factionId:e.factionKey, classKey:classKeyOf(cls), className:classNameOf(cls), satisfaction:satisfaction, weight:weight, reason:variant && (variant.note || variant.reason) || compact(cls.demands || '', 160) });
      });
    });
    var recent = toArray(root._classMinxinBridgeLedger).filter(function(row) {
      return toArray(row && row.appliedRegions).concat(toArray(row && row.regionWeights)).some(function(r) {
        return resolveRegions(root, r, row.factionId || '').some(function(h) { return selected.some(function(e) { return e.leaf === h.leaf; }); });
      });
    }).slice(-8);
    var names = [];
    values.slice().sort(function(a,b) { return a.satisfaction - b.satisfaction; }).forEach(function(v) { if (names.indexOf(v.className) < 0) names.push(v.className); });
    return { ready:weightSum > 0, score:weightSum > 0 ? Math.round(sum / weightSum) : null, count:values.length, classNames:names.slice(0,3), reason:values.length ? values.slice().sort(function(a,b) { return a.satisfaction-b.satisfaction; })[0].reason : '', current:values, recent:recent, recentDelta:recent.reduce(function(n,r) { return n + (Number(r.delta)||0); },0) };
  }

  function resolveRegionWeights(root, payload, cls) {
    var rows = [];
    toArray(payload && (payload.regionWeights || payload.regionalWeights || payload.regions)).forEach(function(r) {
      if (!r) return;
      var region = compact(r.region || r.regionName || r.name || r.id || r.division || r, 120);
      if (!region) return;
      var weight = Number(r.weight != null ? r.weight : r.share);
      if (!isFinite(weight) || weight <= 0) weight = 1;
      rows.push({ region: region, regionId: r.regionId, factionId: r.factionId || r.faction || payload.factionId || payload.faction, weight: weight });
    });
    if (!rows.length && cls) {
      toArray(cls.regionalVariants || cls.regionWeights || cls.regions).forEach(function(r) {
        if (!r) return;
        var region = compact(r.region || r.regionName || r.name || r.id || r.division || r, 120);
        if (!region) return;
        var weight = Number(r.weight != null ? r.weight : r.share);
        if (!isFinite(weight) || weight <= 0) weight = 1;
        rows.push({ region: region, regionId: r.regionId, factionId: r.factionId || r.faction || cls.factionId || cls.faction, weight: weight });
      });
    }
    var expanded = [];
    rows.forEach(function(r) {
      var hits = resolveRegions(root, r, cls && (cls.factionId || cls.faction));
      if (!hits.length && !regionEntries(root).length) { expanded.push(r); return; }
      hits.forEach(function(e) { expanded.push({ region:String(e.leaf.id || e.leaf.name), regionId:String(e.leaf.id || e.leaf.name), factionId:e.factionKey, weight:r.weight / hits.length }); });
    });
    var byKey = {};
    expanded.forEach(function(r) {
      var key = explicitKey(r.factionId) + '|' + explicitKey(r.regionId || r.region);
      if (!key) return;
      byKey[key] = byKey[key] || { region:r.region, regionId:r.regionId, factionId:r.factionId, weight:0 };
      byKey[key].weight += r.weight;
    });
    return Object.keys(byKey).map(function(k) { return byKey[k]; });
  }

  function matchLeaf(leaf, region) {
    var wanted = normalizeName(region);
    if (!wanted || !leaf) return false;
    var names = [
      leaf.name, leaf.id, leaf.regionId, leaf.mapRegionId, leaf.officialName,
      leaf.title, leaf.parentDivisionId
    ].map(normalizeName).filter(Boolean);
    return names.some(function(n) {
      return n === wanted || n.indexOf(wanted) >= 0 || wanted.indexOf(n) >= 0;
    });
  }

  function pressureDelta(payload, cls) {
    var satDelta = Number(payload && (payload.satisfactionDelta != null ? payload.satisfactionDelta : payload.satisfaction_delta));
    if (!isFinite(satDelta)) satDelta = 0;
    var unrest = payload && payload.unrestDelta || payload && payload.unrest_delta || {};
    var unrestPressure = 0;
    Object.keys(unrest || {}).forEach(function(k) {
      var n = Number(unrest[k]);
      if (isFinite(n) && n < 0) unrestPressure += Math.abs(n) * 0.03;
      else if (isFinite(n) && n > 0) unrestPressure -= n * 0.02;
    });
    var influence = classInfluence(cls) / 100;
    var share = classPopulationShare(cls) || 0.08;
    var raw = satDelta * (0.16 + share * 0.18 + influence * 0.06) - unrestPressure;
    if (!satDelta && unrestPressure) raw = -unrestPressure;
    return round2(clamp(raw, -2, 2));
  }

  function pressureKey(root, payload, key) {
    payload = payload || {};
    var turn = Number(payload.turn != null ? payload.turn : root.turn) || 0;
    return [
      payload.sourceSystem || payload.source || 'class-minxin-bridge',
      payload.sourceId || payload.id || payload.signalId || payload.reason || 'event',
      key,
      turn
    ].join('|');
  }

  function ensureLedger(root) {
    if (!Array.isArray(root._classMinxinBridgeLedger)) root._classMinxinBridgeLedger = [];
    if (!root._classMinxinBridgeKeys || typeof root._classMinxinBridgeKeys !== 'object') root._classMinxinBridgeKeys = {};
    _pruneBridgeKeys(root);
    return root._classMinxinBridgeLedger;
  }

  // 只增不裁治理（第七轮F·2026-07-07）：去重键 ~80/回合永不清=长局存档/内存漏。
  // pressureKey 尾段恒为写入回合号(|<turn>)→按龄精确清·逾 48 回合出窗（同源信号重放窗远短于此）·
  // 尾段非数字的异形键保留不动·每回合首次 ensure 清一趟。
  function _pruneBridgeKeys(root) {
    var keys = root._classMinxinBridgeKeys;
    var nowTurn = Number(root.turn) || 0;
    if (!keys || keys._prunedAtTurn === nowTurn) return;
    keys._prunedAtTurn = nowTurn;
    for (var k in keys) {
      if (k === '_prunedAtTurn') continue;
      var m = /\|(\d+)$/.exec(k);
      if (m && Number(m[1]) < nowTurn - 48) delete keys[k];
    }
  }

  function addMinxinSource(root, source, delta) {
    var mx = ensureMinxin(root);
    var key = compact(source || 'classPressure', 80);
    mx.sources[key] = round2((Number(mx.sources[key]) || 0) + delta);
  }

  function callAggregate(root) {
    var bridge = global.IntegrationBridge || (global.window && global.window.IntegrationBridge);
    if (bridge && typeof bridge.aggregateRegionsToVariables === 'function') {
      try { bridge.aggregateRegionsToVariables(); return true; } catch (_) { return false; }
    }
    return false;
  }

  function applyClassPressure(root, payload) {
    root = pickRoot(root);
    payload = payload || {};
    var cls = findClass(root, payload) || payload.class || null;
    var key = classKeyOf(cls || payload);
    var className = classNameOf(cls) || compact(payload.className || payload.name || payload.actorId || key, 80);
    ensureMinxin(root);
    syncByClass(root, {
      turn: payload.turn != null ? payload.turn : root.turn,
      source: payload.sourceSystem || payload.source || 'class-minxin-bridge-pressure'
    });

    var dedupe = pressureKey(root, payload, key);
    var ledger = ensureLedger(root);
    if (root._classMinxinBridgeKeys[dedupe]) {
      return { ok: true, duplicate: true, classKey: key, className: className, appliedRegions: [], delta: 0 };
    }
    root._classMinxinBridgeKeys[dedupe] = true;

    var delta = pressureDelta(payload, cls);
    var regionWeights = resolveRegionWeights(root, payload, cls);
    var leaves = null; // 2026-06-06·懒求值·仅 fallback(无 MinxinLedger)路径才需·热路径不再每次遍历数百府州(治过回合卡顿)
    var appliedRegions = [];
    var sourceKey = 'class:' + key;
    var usedMinxinLedger = false;

    if (delta && regionWeights.length && payload.allowMinxinFeedback !== false && TM.MinxinLedger && typeof TM.MinxinLedger.recordAndApply === 'function') {
      try {
        var ledgerResult = TM.MinxinLedger.recordAndApply(root, {
          turn: payload.turn != null ? payload.turn : root.turn,
          sourceSystem: 'class-minxin-bridge',
          kind: 'class-pressure',
          targetRegions: regionWeights,
          targetClasses: [{ name: className, classKey: key, weight: classPopulationShare(cls) || 0.08 }],
          deltaTrue: delta,
          intensity: Math.min(1, Math.max(0.1, Math.abs(delta) / 2)),
          confidence: 0.82,
          linkedIssue: payload.linkedIssue || payload.issueId || '',
          reason: payload.reason || payload.sourceSystem || 'class minxin pressure'
        }, {
          turn: payload.turn != null ? payload.turn : root.turn,
          source: 'class-minxin-bridge',
          // 2026-06-10·批量信号路径(applyPending)逐笔跳过整体级收口·批末 finalizeBatch 一次
          deferFinalize: payload.deferLedgerFinalize === true
        });
        if (ledgerResult && ledgerResult.result && Array.isArray(ledgerResult.result.affectedRegions)) {
          appliedRegions = ledgerResult.result.affectedRegions.map(function(x) {
            return {
              region: x.region,
              before: x.before,
              after: x.after,
              delta: x.delta
            };
          });
          usedMinxinLedger = true;
        }
      } catch (_) {}
    }

    if (!usedMinxinLedger && delta && regionWeights.length && payload.allowMinxinFeedback !== false) {
      if (!leaves) leaves = getLeafDivisions(root);
      var totalWeight = regionWeights.reduce(function(sum, r) { return sum + Math.max(0, Number(r.weight) || 0); }, 0) || 1;
      regionWeights.forEach(function(r) {
        var matched = resolveRegions(root, r).map(function(e) { return e.leaf; });
        if (!matched.length) return;
        var weightedDelta = delta * ((Number(r.weight) || 1) / totalWeight);
        matched.forEach(function(leaf) {
          var old = Number(leaf.minxin != null ? leaf.minxin : leaf.minxinLocal);
          if (!isFinite(old)) return;
          var next = round2(clamp(old + weightedDelta, 0, 100));
          leaf.minxin = next;
          if (leaf.minxinLocal !== undefined) leaf.minxinLocal = next;
          appliedRegions.push({
            region: compact(leaf.id || leaf.name || r.region, 100), regionId:leaf.id || leaf.name, factionId:r.factionId,
            before: round2(old),
            after: next,
            delta: round2(next - old)
          });
        });
      });
      if (appliedRegions.length) {
        addMinxinSource(root, sourceKey, delta);
        callAggregate(root);
      }
    }

    var mx = ensureMinxin(root);
    var byClass = mx.byClass[key] || (mx.byClass[key] = {});
    byClass.lastPressure = {
      turn: Number(payload.turn != null ? payload.turn : root.turn) || 0,
      sourceSystem: compact(payload.sourceSystem || payload.source || 'class-minxin-bridge', 80),
      sourceId: compact(payload.sourceId || payload.id || payload.signalId || '', 120),
      delta: delta,
      appliedRegions: appliedRegions.map(function(x) { return x.region; }),
      reason: compact(payload.reason || '', 180),
      linkedIssue: compact(payload.linkedIssue || payload.issueId || '', 120)
    };

    var row = {
      key: dedupe,
      turn: byClass.lastPressure.turn,
      classKey: key,
      className: className,
      sourceSystem: byClass.lastPressure.sourceSystem,
      sourceId: byClass.lastPressure.sourceId,
      linkedIssue: byClass.lastPressure.linkedIssue,
      reason: byClass.lastPressure.reason,
      delta: delta,
      satisfactionDelta: Number(payload.satisfactionDelta != null ? payload.satisfactionDelta : payload.satisfaction_delta) || 0,
      appliedRegions: appliedRegions,
      regionWeights: regionWeights
    };
    ledger.push(row);
    if (ledger.length > 80) root._classMinxinBridgeLedger = ledger.slice(-80);
    return { ok: true, duplicate: false, classKey: key, className: className, delta: delta, appliedRegions: appliedRegions, ledger: clone(row) };
  }

  function snapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Math.min(40, Number(options.limit || 10) || 10));
    return {
      lastSync: clone(root._classMinxinLastSync || null),
      ledger: toArray(root._classMinxinBridgeLedger).slice(-limit).map(clone),
      byClass: clone((ensureMinxin(root).byClass) || {})
    };
  }

  function classByKey(root) {
    var out = {};
    getClasses(root).forEach(function(cls) {
      if (!cls || typeof cls !== 'object') return;
      out[classKeyOf(cls)] = cls;
    });
    return out;
  }

  function audit(root, options) {
    root = pickRoot(root);
    options = options || {};
    if (options.sync !== false) syncByClass(root, {
      turn: options.turn != null ? options.turn : root.turn,
      source: options.source || 'class-minxin-bridge-audit'
    });
    var mx = ensureMinxin(root);
    var classes = classByKey(root);
    var ledger = toArray(root._classMinxinBridgeLedger);
    var seen = {};
    var duplicates = [];
    var drifts = [];
    var blindRegionWrites = [];
    ledger.forEach(function(row) {
      if (!row || typeof row !== 'object') return;
      var k = row.key || [row.sourceSystem, row.sourceId, row.classKey, row.turn].join('|');
      if (k) {
        if (seen[k]) duplicates.push(k);
        seen[k] = true;
      }
      if (toArray(row.appliedRegions).length && !toArray(row.regionWeights).length) blindRegionWrites.push(k || row.className || row.classKey || '');
    });
    Object.keys(classes).forEach(function(key) {
      var cls = classes[key];
      var row = mx.byClass && mx.byClass[key];
      if (!row) return;
      var sat = classSatisfaction(cls, 50);
      var truth = Number(row.true != null ? row.true : row.index);
      if (isFinite(truth) && Math.abs(truth - sat) >= 0.51) {
        drifts.push({ classKey: key, className: classNameOf(cls), satisfaction: round2(sat), minxin: round2(truth), delta: round2(truth - sat) });
      }
    });
    var result = {
      ok: duplicates.length === 0 && drifts.length === 0 && blindRegionWrites.length === 0,
      turn: Number(options.turn != null ? options.turn : root.turn) || 0,
      source: options.source || 'class-minxin-bridge-audit',
      counts: {
        classes: Object.keys(classes).length,
        byClass: Object.keys(mx.byClass || {}).length,
        ledger: ledger.length,
        duplicates: duplicates.length,
        drifts: drifts.length,
        blindRegionWrites: blindRegionWrites.length
      },
      duplicates: duplicates.slice(0, 12),
      drifts: drifts.slice(0, 12),
      blindRegionWrites: blindRegionWrites.slice(0, 12)
    };
    root._classMinxinBridgeAudit = clone(result);
    return result;
  }

  function ensurePendingTinyi(root) {
    if (!Array.isArray(root._pendingTinyiTopics)) root._pendingTinyiTopics = [];
    if (!root._classMinxinTinyiKeys || typeof root._classMinxinTinyiKeys !== 'object') root._classMinxinTinyiKeys = {};
    return root._pendingTinyiTopics;
  }

  function rowRegionNames(row) {
    var out = [];
    toArray(row && row.appliedRegions).forEach(function(r) {
      var name = compact(r && (r.region || r.name || r.id || r), 80);
      if (name && out.indexOf(name) < 0) out.push(name);
    });
    toArray(row && row.regionWeights).forEach(function(r) {
      var name = compact(r && (r.region || r.name || r.id || r), 80);
      if (name && out.indexOf(name) < 0) out.push(name);
    });
    return out;
  }

  function recentPressureRows(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Math.min(40, Number(options.limit || 12) || 12));
    var mx = ensureMinxin(root);
    var tuning = getTuning(root).thresholds;
    var rows = [];
    toArray(root._classMinxinBridgeLedger).slice(-limit).forEach(function(row) {
      if (!row || typeof row !== 'object') return;
      var delta = Number(row.delta);
      var classKey = row.classKey || classKeyOf(row);
      var byClass = mx.byClass && mx.byClass[classKey] || {};
      var truth = Number(byClass.true != null ? byClass.true : byClass.index);
      var serious = isFinite(truth) && truth <= tuning.pressureRowTrueMax;
      if ((isFinite(delta) && delta < 0 && Math.abs(delta) >= tuning.pressureRowDelta) || serious || row.sourceSystem === 'local') {
        rows.push({ row: row, byClass: byClass, truth: truth, regions: rowRegionNames(row) });
      }
    });
    Object.keys(mx.byClass || {}).forEach(function(key) {
      var byClass = mx.byClass[key] || {};
      var truth = Number(byClass.true != null ? byClass.true : byClass.index);
      if (!isFinite(truth) || truth > tuning.byClassOnlyTrueMax) return;
      var exists = rows.some(function(x) { return x && x.row && x.row.classKey === key; });
      if (!exists) rows.push({
        row: {
          turn: byClass.lastSyncTurn || root.turn || 0,
          classKey: key,
          className: byClass.className || key,
          sourceSystem: byClass.source || 'class-minxin-byclass',
          sourceId: 'byclass-' + key,
          linkedIssue: byClass.lastPressure && byClass.lastPressure.linkedIssue || '',
          reason: byClass.lastPressure && byClass.lastPressure.reason || byClass.demand || 'class minxin low',
          delta: byClass.lastPressure && byClass.lastPressure.delta || 0,
          appliedRegions: byClass.lastPressure && byClass.lastPressure.appliedRegions || []
        },
        byClass: byClass,
        truth: truth,
        regions: toArray(byClass.lastPressure && byClass.lastPressure.appliedRegions).map(function(x) { return compact(x, 80); }).filter(Boolean)
      });
    });
    return rows.slice(-limit);
  }

  function spawnCourtIssues(root, options) {
    root = pickRoot(root);
    options = options || {};
    var pending = ensurePendingTinyi(root);
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var tuning = getTuning(root).thresholds;
    var spawned = [];
    recentPressureRows(root, options).forEach(function(item) {
      var row = item.row || {};
      var byClass = item.byClass || {};
      var delta = Number(row.delta);
      var truth = Number(item.truth);
      var qualifies = (isFinite(truth) && truth <= tuning.courtIssueTrueMax)
        || (isFinite(delta) && delta < 0 && Math.abs(delta) >= tuning.courtIssuePressureDelta);
      if (!qualifies) return;
      var className = compact(row.className || byClass.className || row.classKey || '阶层', 80);
      var demand = compact(byClass.demand || row.reason || '民情压力', 80);
      var sourceId = 'class-minxin:' + (row.key || [row.sourceSystem, row.sourceId, row.classKey, row.turn].join('|'));
      var key = sourceId + '|' + className;
      if (root._classMinxinTinyiKeys[key]) return;
      var existing = pending.some(function(t) {
        return t && (t.sourceId === sourceId || (t.from === 'class-minxin-bridge' && normalizeName(t.sourceClass || t.className) === normalizeName(className) && String(t.linkedIssue || '') === String(row.linkedIssue || '')));
      });
      if (existing) {
        root._classMinxinTinyiKeys[key] = true;
        return;
      }
      root._classMinxinTinyiKeys[key] = true;
      var regions = item.regions || [];
      var topic = '民情·' + className + '·' + demand + '·请付廷议';
      var issue = {
        id: 'cmx-tinyi-' + turn + '-' + (pending.length + 1),
        topic: topic,
        title: topic,
        from: 'class-minxin-bridge',
        sourceType: 'class_pressure',
        sourceId: sourceId,
        turn: turn,
        className: className,
        sourceClass: className,
        demandText: demand,
        linkedIssue: row.linkedIssue || '',
        regions: regions,
        priority: truth <= tuning.courtIssueUrgentTrueMax ? 88 : (truth <= tuning.courtIssueHighTrueMax ? 80 : 72),
        reason: compact(row.reason || byClass.lastPressure && byClass.lastPressure.reason || '', 180),
        origin: {
          sourceType: 'class_minxin_bridge',
          sourceId: sourceId,
          sourceName: className
        }
      };
      pending.unshift(issue);
      spawned.push(issue);
    });
    if (pending.length > 80) root._pendingTinyiTopics = pending.slice(0, 80);
    return { spawned: spawned.length, topics: spawned };
  }

  function ensureUprisingCandidates(root) {
    var mx = ensureMinxin(root);
    if (!Array.isArray(mx.uprisingCandidates)) mx.uprisingCandidates = [];
    if (!root._classMinxinUprisingKeys || typeof root._classMinxinUprisingKeys !== 'object') root._classMinxinUprisingKeys = {};
    return mx.uprisingCandidates;
  }

  function candidateLevel(root, truth, momentum) {
    var tuning = getTuning(root).thresholds;
    if (truth <= tuning.uprisingLevel3TrueMax || momentum >= tuning.uprisingLevel3Momentum) return 3;
    if (truth <= tuning.uprisingLevel2TrueMax || momentum >= tuning.uprisingLevel2Momentum) return 2;
    return 1;
  }

  function spawnUprisingCandidates(root, options) {
    root = pickRoot(root);
    options = options || {};
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var candidates = ensureUprisingCandidates(root);
    var tuning = getTuning(root).thresholds;
    var spawned = [];
    recentPressureRows(root, options).forEach(function(item) {
      var row = item.row || {};
      var byClass = item.byClass || {};
      var truth = Number(item.truth);
      if (!isFinite(truth)) truth = 50;
      var phase = String(byClass.unrestPhase || '').toLowerCase();
      var delta = Number(row.delta);
      var phaseQualifies = tuning.uprisingCandidateByPhase !== 0 && (phase === 'brewing' || phase === 'uprising');
      var qualifies = truth <= tuning.uprisingCandidateTrueMax || phaseQualifies || (isFinite(delta) && delta <= -Math.abs(tuning.uprisingCandidatePressureDelta));
      if (!qualifies) return;
      var className = compact(row.className || byClass.className || row.classKey || '阶层', 80);
      var regions = item.regions && item.regions.length ? item.regions : [''];
      regions.forEach(function(region) {
        var sourceId = 'class-minxin:' + (row.key || [row.sourceSystem, row.sourceId, row.classKey, row.turn].join('|'));
        var id = ['mxuc', turn, normalizeName(className), normalizeName(region || 'general')].join('-');
        if (root._classMinxinUprisingKeys[id] || candidates.some(function(c) { return c && c.id === id; })) {
          root._classMinxinUprisingKeys[id] = true;
          return;
        }
        var momentum = round2(clamp((45 - truth) * 1.35 + Math.abs(isFinite(delta) ? delta : 0) * 8 + (Number(byClass.influence) || 0) * 0.08, 1, 100));
        var cand = {
          id: id,
          level: candidateLevel(root, truth, momentum),
          turn: turn,
          className: className,
          classKey: row.classKey || '',
          region: region || '',
          cause: compact(row.reason || byClass.demand || 'class-minxin pressure', 180),
          momentum: momentum,
          hidden: true,
          linkedIssue: row.linkedIssue || '',
          sourceType: 'class_minxin_bridge',
          sourceId: sourceId
        };
        candidates.push(cand);
        root._classMinxinUprisingKeys[id] = true;
        spawned.push(cand);
      });
    });
    if (candidates.length > 80) ensureMinxin(root).uprisingCandidates = candidates.slice(-80);
    return { spawned: spawned.length, candidates: spawned };
  }

  function maintain(root, options) {
    root = pickRoot(root);
    options = options || {};
    syncByClass(root, {
      turn: options.turn != null ? options.turn : root.turn,
      source: options.source || 'class-minxin-bridge-maintain'
    });
    var court = spawnCourtIssues(root, options);
    var uprising = spawnUprisingCandidates(root, options);
    var gate = audit(root, {
      turn: options.turn != null ? options.turn : root.turn,
      source: options.source || 'class-minxin-bridge-maintain',
      sync: false
    });
    root._classMinxinBridgeMaintenance = {
      turn: gate.turn,
      source: options.source || 'class-minxin-bridge-maintain',
      courtIssues: court.spawned,
      uprisingCandidates: uprising.spawned,
      auditOk: gate.ok
    };
    return { audit: gate, courtIssues: court, uprisingCandidates: uprising };
  }

  function formatLedgerLine(row) {
    var regs = toArray(row.appliedRegions).map(function(x) { return x && (x.region || x.name || x.id || x); }).filter(Boolean).join('/');
    return '- T' + (row.turn || '') + ' ' + (row.className || row.classKey || '')
      + ' delta=' + (row.delta != null ? row.delta : 0)
      + (regs ? ' regions=' + regs : ' regions=byClass-only')
      + (row.linkedIssue ? ' issue=' + row.linkedIssue : '')
      + ' reason=' + compact(row.reason || row.sourceSystem || '', 120);
  }

  function formatByClassLine(key, row) {
    return '- ' + (row.className || key)
      + ' true=' + (row.true != null ? row.true : row.index)
      + ' perceived=' + (row.perceived != null ? row.perceived : '')
      + ' satisfaction=' + (row.satisfaction != null ? row.satisfaction : '')
      + (row.unrestPhase ? ' phase=' + row.unrestPhase : '')
      + (row.lastPressure && row.lastPressure.reason ? ' cause=' + compact(row.lastPressure.reason, 80) : '');
  }

  function classMinxinTopic(topic) {
    if (!topic || typeof topic !== 'object') return false;
    if (topic.from === 'class-minxin-bridge') return true;
    if (topic.origin && topic.origin.sourceType === 'class_minxin_bridge') return true;
    if (String(topic.sourceId || '').indexOf('class-minxin:') === 0) return true;
    if (topic.sourceType === 'class_pressure' && (topic.sourceClass || topic.className || topic.demandText)) return true;
    return false;
  }

  function diagnosticByClassRows(mx, limit) {
    var rows = [];
    Object.keys(mx && mx.byClass || {}).forEach(function(key) {
      var row = clone(mx.byClass[key] || {});
      row.classKey = row.classKey || key;
      rows.push(row);
    });
    rows.sort(function(a, b) {
      var av = Number(a.true != null ? a.true : a.index);
      var bv = Number(b.true != null ? b.true : b.index);
      if (!isFinite(av)) av = 999;
      if (!isFinite(bv)) bv = 999;
      return av - bv;
    });
    return rows.slice(0, limit);
  }

  function auditWarnings(auditResult) {
    var warnings = [];
    if (!auditResult) return warnings;
    var counts = auditResult.counts || {};
    if (!auditResult.ok) {
      warnings.push('audit FAIL duplicates=' + (counts.duplicates || 0) + ' drifts=' + (counts.drifts || 0) + ' blindRegionWrites=' + (counts.blindRegionWrites || 0));
    }
    toArray(auditResult.duplicates).forEach(function(k) {
      if (k) warnings.push('duplicate ' + compact(k, 140));
    });
    toArray(auditResult.drifts).forEach(function(d) {
      if (!d) return;
      warnings.push('drift ' + compact(d.className || d.classKey || 'class', 80) + ' satisfaction=' + (d.satisfaction != null ? d.satisfaction : '') + ' minxin=' + (d.minxin != null ? d.minxin : '') + ' delta=' + (d.delta != null ? d.delta : ''));
    });
    toArray(auditResult.blindRegionWrites).forEach(function(k) {
      if (k) warnings.push('blind-region-write ' + compact(k, 140));
    });
    return warnings;
  }

  function diagnostics(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Math.min(40, Number(options.limit || 10) || 10));
    var mx = ensureMinxin(root);
    var auditResult = root._classMinxinBridgeAudit;
    if (!auditResult || options.audit === true) {
      auditResult = audit(root, {
        turn: options.turn != null ? options.turn : root.turn,
        source: options.source || 'class-minxin-bridge-diagnostics',
        sync: options.sync === true
      });
    }
    var snap = snapshot(root, { limit: limit });
    return {
      audit: clone(auditResult),
      warnings: auditWarnings(auditResult),
      lastSync: clone(root._classMinxinLastSync || snap.lastSync || null),
      maintenance: clone(root._classMinxinBridgeMaintenance || null),
      tuning: clone(getTuning(root)),
      ledger: snap.ledger,
      byClass: diagnosticByClassRows(mx, limit),
      courtTopics: toArray(root._pendingTinyiTopics).filter(classMinxinTopic).slice(0, limit).map(clone),
      uprisingCandidates: toArray(mx.uprisingCandidates).slice(-limit).reverse().map(clone)
    };
  }

  function formatCourtTopicLine(topic) {
    topic = topic || {};
    return '- T' + (topic.turn || '') + ' ' + compact(topic.topic || topic.title || topic.id || 'topic', 100)
      + (topic.sourceClass || topic.className ? ' class=' + compact(topic.sourceClass || topic.className, 60) : '')
      + (topic.linkedIssue || topic.issueId ? ' issue=' + compact(topic.linkedIssue || topic.issueId, 80) : '')
      + (topic.demandText || topic.reason ? ' reason=' + compact(topic.demandText || topic.reason, 120) : '');
  }

  function formatCandidateLine(candidate) {
    candidate = candidate || {};
    return '- ' + compact(candidate.id || candidate.className || 'candidate', 100)
      + ' class=' + compact(candidate.className || candidate.classKey || '', 60)
      + (candidate.region ? ' region=' + compact(candidate.region, 80) : '')
      + ' momentum=' + (candidate.momentum != null ? candidate.momentum : '')
      + ' level=' + (candidate.level != null ? candidate.level : '')
      + (candidate.linkedIssue ? ' issue=' + compact(candidate.linkedIssue, 80) : '')
      + (candidate.cause ? ' cause=' + compact(candidate.cause, 120) : '');
  }

  function diagnosticsText(root, options) {
    var diag = diagnostics(root, options);
    var counts = diag.audit && diag.audit.counts || {};
    var lines = ['=== Class Minxin Bridge Diagnostics ==='];
    if (diag.audit) {
      lines.push('audit=' + (diag.audit.ok ? 'OK' : 'FAIL')
        + ' turn=' + (diag.audit.turn || '')
        + ' source=' + (diag.audit.source || '')
        + ' classes=' + (counts.classes || 0)
        + ' byClass=' + (counts.byClass || 0)
        + ' ledger=' + (counts.ledger || 0)
        + ' duplicates=' + (counts.duplicates || 0)
        + ' drifts=' + (counts.drifts || 0)
        + ' blindRegionWrites=' + (counts.blindRegionWrites || 0));
    }
    if (diag.lastSync) {
      lines.push('lastSync turn=' + (diag.lastSync.turn || '') + ' source=' + (diag.lastSync.source || '') + ' synced=' + (diag.lastSync.synced || 0) + ' divergences=' + toArray(diag.lastSync.divergences).length);
    }
    if (diag.maintenance) {
      lines.push('maintenance turn=' + (diag.maintenance.turn || '') + ' source=' + (diag.maintenance.source || '') + ' courtIssues=' + (diag.maintenance.courtIssues || 0) + ' uprisingCandidates=' + (diag.maintenance.uprisingCandidates || 0) + ' auditOk=' + (diag.maintenance.auditOk === false ? 'false' : 'true'));
    }
    if (diag.tuning && diag.tuning.thresholds) {
      lines.push('tuning pressureRowTrueMax=' + diag.tuning.thresholds.pressureRowTrueMax + ' courtIssueTrueMax=' + diag.tuning.thresholds.courtIssueTrueMax + ' uprisingCandidateTrueMax=' + diag.tuning.thresholds.uprisingCandidateTrueMax);
    }
    if (diag.warnings.length) lines.push('warnings:\n' + diag.warnings.map(function(w) { return '- ' + w; }).join('\n'));
    if (diag.byClass.length) lines.push('byClass:\n' + diag.byClass.map(function(row) { return formatByClassLine(row.classKey || row.className || 'class', row); }).join('\n'));
    if (diag.ledger.length) lines.push('ledger:\n' + diag.ledger.map(formatLedgerLine).join('\n'));
    if (diag.courtTopics.length) lines.push('courtTopics:\n' + diag.courtTopics.map(formatCourtTopicLine).join('\n'));
    if (diag.uprisingCandidates.length) lines.push('uprisingCandidates:\n' + diag.uprisingCandidates.map(formatCandidateLine).join('\n'));
    return lines.join('\n');
  }

  function formatForPrompt(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Math.min(20, Number(options.limit || 8) || 8));
    var snap = snapshot(root, { limit: limit });
    var keys = Object.keys(snap.byClass || {}).slice(0, limit);
    if (!keys.length && !snap.ledger.length) return '';
    var lines = ['\n\n=== Class Minxin Bridge ==='];
    lines.push('Use this as the joined account between class satisfaction/unrest and minxin true regional pressure. Do not double-count sources already derived from minxin.');
    if (snap.lastSync) lines.push('lastSync turn=' + (snap.lastSync.turn || '') + ' synced=' + (snap.lastSync.synced || 0) + ' divergences=' + toArray(snap.lastSync.divergences).length);
    if (keys.length) lines.push('byClass:\n' + keys.map(function(k) { return formatByClassLine(k, snap.byClass[k] || {}); }).join('\n'));
    if (snap.ledger.length) lines.push('recentPressure:\n' + snap.ledger.map(formatLedgerLine).join('\n'));
    return lines.join('\n');
  }

  TM.ClassMinxinBridge = {
    syncByClass: syncByClass,
    applyClassPressure: applyClassPressure,
    getTuning: getTuning,
    audit: audit,
    spawnCourtIssues: spawnCourtIssues,
    spawnUprisingCandidates: spawnUprisingCandidates,
    maintain: maintain,
    snapshot: snapshot,
    diagnostics: diagnostics,
    diagnosticsText: diagnosticsText,
    formatForPrompt: formatForPrompt,
    _classKeyOf: classKeyOf,
    _resolveRegionWeights: resolveRegionWeights,
    _getLeafDivisions: getLeafDivisions, regionEntries:regionEntries, resolveRegions:resolveRegions, regionSnapshot:regionSnapshot
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = TM.ClassMinxinBridge;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));
