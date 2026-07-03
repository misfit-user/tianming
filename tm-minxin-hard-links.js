// @ts-check
/*
 * tm-minxin-hard-links.js
 * Converts living minxin into hard constraints on fiscal collection, draft
 * capacity, hukou leakage, and local execution.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var MAX_ITEMS = 120;

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

  function toArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
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
      var keys = ['text', 'content', 'summary', 'desc', 'description', 'reason', 'topic', 'title', 'name', 'demand', 'kind'];
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

  function ensureStore(root) {
    root = pickRoot(root);
    if (!root._minxinHardLinks || typeof root._minxinHardLinks !== 'object' || Array.isArray(root._minxinHardLinks)) {
      root._minxinHardLinks = {
        turn: Number(root.turn) || 0,
        regionImpacts: [],
        ledger: [],
        stats: { ticks: 0, regions: 0, coerciveDemands: 0 }
      };
    }
    var store = root._minxinHardLinks;
    if (!Array.isArray(store.regionImpacts)) store.regionImpacts = [];
    if (!Array.isArray(store.ledger)) store.ledger = [];
    if (!store.stats) store.stats = { ticks: 0, regions: 0, coerciveDemands: 0 };
    return store;
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
        if (kids.length) walk(kids);
        else leaves.push(node);
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

  function regionIdOf(div) {
    return compact(div && (div.id || div.regionId || div.mapRegionId || div.name), 80) || 'region';
  }

  function regionNameOf(div) {
    return compact(div && (div.name || div.id || div.regionId || div.mapRegionId), 100) || regionIdOf(div);
  }

  function matchRegion(div, wanted) {
    var n = normalizeName(wanted);
    if (!n || !div) return false;
    var names = [div.id, div.name, div.regionId, div.mapRegionId, div.officialName, div.title].map(normalizeName).filter(Boolean);
    return names.some(function(x) { return x === n || x.indexOf(n) >= 0 || n.indexOf(x) >= 0; });
  }

  function ensureObject(parent, key) {
    if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) parent[key] = {};
    return parent[key];
  }

  function getPopulationDetail(div) {
    var pd = ensureObject(div, 'populationDetail');
    if (!isFinite(Number(pd.mouths)) || Number(pd.mouths) <= 0) {
      if (div.population && typeof div.population === 'object') pd.mouths = Number(div.population.mouths || div.population.count) || 0;
      else pd.mouths = Number(div.population) || 0;
    }
    if (!isFinite(Number(pd.households)) || Number(pd.households) <= 0) pd.households = Math.max(1, Math.round((Number(pd.mouths) || 1) / 4));
    if (!isFinite(Number(pd.ding)) || Number(pd.ding) <= 0) pd.ding = Math.max(1, Math.round((Number(pd.mouths) || 1) * 0.24));
    if (!isFinite(Number(pd.hiddenCount))) pd.hiddenCount = 0;
    if (!isFinite(Number(pd.fugitives))) pd.fugitives = 0;
    return pd;
  }

  function getTruth(root, div) {
    var vals = [
      div && div.minxinDetails && div.minxinDetails.trueIndex,
      div && div.minxinDetails && div.minxinDetails.index,
      div && div.minxinLocal,
      div && div.minxin
    ];
    var mx = root && root.minxin;
    var rid = regionIdOf(div);
    var rn = regionNameOf(div);
    if (mx && mx.byRegion) {
      [rid, rn, normalizeName(rid), normalizeName(rn)].forEach(function(k) {
        var row = mx.byRegion[k];
        if (row && typeof row === 'object') vals.push(row.true, row.index, row.trueIndex);
      });
    }
    vals.push(mx && mx.trueIndex, mx && mx.index);
    for (var i = 0; i < vals.length; i += 1) {
      var n = Number(vals[i]);
      if (isFinite(n)) return clamp(n, 0, 100);
    }
    return 60;
  }

  function writeDivisionMinxin(div, next) {
    next = round2(clamp(next, 0, 100));
    div.minxin = next;
    if (div.minxinLocal !== undefined) div.minxinLocal = next;
    if (!div.minxinDetails || typeof div.minxinDetails !== 'object') div.minxinDetails = {};
    div.minxinDetails.trueIndex = next;
    div.minxinDetails.index = next;
  }

  function localCorruption(root, div) {
    var vals = [
      div && div.corruptionLocal,
      div && div.corruption,
      root && root.corruption && root.corruption.subDepts && root.corruption.subDepts.provincial && root.corruption.subDepts.provincial.true,
      root && root.corruption && root.corruption.trueIndex,
      root && root.corruptionIndex
    ];
    for (var i = 0; i < vals.length; i += 1) {
      var n = Number(vals[i]);
      if (isFinite(n)) return clamp(n, 0, 100);
    }
    return 45;
  }

  function taxFactor(div) {
    var raw = String(div && (div.taxLevel || div.tax || div.taxPolicy || div.fiscalPolicy) || '').toLowerCase();
    if (/heavy|high|severe|harsh|\u91cd|\u9ad8|\u82db|\u9177/.test(raw)) return 1.18;
    if (/light|low|reduced|relief|\u8f7b|\u4f4e|\u51cf|\u514d/.test(raw)) return 0.84;
    var n = Number(div && (div.taxRate || div.taxPressure));
    if (isFinite(n) && n > 0) return clamp(n > 2 ? n / 100 : n, 0.7, 1.35);
    return 1;
  }

  function claimedRevenue(div, pd, factor) {
    var fd = div.fiscalDetail || {};
    var direct = Number(fd.claimedRevenue != null ? fd.claimedRevenue : (div.claimedRevenue != null ? div.claimedRevenue : div.revenue));
    if (isFinite(direct) && direct > 0) return direct;
    return Math.max(100, Math.round((Number(pd.mouths) || 1) * 0.8 * factor));
  }

  function calcRegion(root, div, options) {
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var pd = getPopulationDetail(div);
    var fd = ensureObject(div, 'fiscalDetail');
    var md = ensureObject(div, 'militaryDetail');
    var cd = ensureObject(div, 'corveeDetail');
    var truth = getTruth(root, div);
    var corr = localCorruption(root, div);
    var factor = taxFactor(div);
    var households = Math.max(1, Number(pd.households) || 1);
    var mouths = Math.max(1, Number(pd.mouths) || Number(div.population) || 1);
    var ding = Math.max(1, Number(pd.ding) || Math.round(mouths * 0.24));
    var hiddenRatio = clamp((Number(pd.hiddenCount) || 0) / households, 0, 0.65);
    var pressure = clamp((45 - truth) / 45, 0, 1);
    var unrest = clamp((35 - truth) / 35, 0, 1);
    var skimming = clamp((Number(fd.skimmingRate) || 0) + corr / 100 * 0.18, 0, 0.62);
    // 分省分化(2026-07-03)：豪强把持+灾情入实征——旧公式只吃 truth/factor/hidden·剧本种子平→舆图财赋全省一色。
    // 新项只做省间重排·全国总额由 tick 末 claimed 加权归一 K 守恒(不动中央月入观感)。
    var _mag = clamp(Number(div._mxhlMagnate) || 0, 0, 100);
    var _disaster = clamp(Number(div._disasterEconomyReduce) || 0, 0, 0.6);
    var collectionBase = clamp(0.35 + truth / 100 * 0.72 - (factor - 1) * 0.22 - hiddenRatio * 0.28, 0.18, 1.08);
    var collection = clamp(collectionBase - _mag / 100 * 0.10 - _disaster * 0.25, 0.18, 1.08);
    div._mxhlRatios = { base: collectionBase * (1 - skimming * 0.18), next: collection * (1 - skimming * 0.18) };
    var claimed = claimedRevenue(div, pd, factor);
    var actual = Math.max(0, Math.round(claimed * collection * (1 - skimming * 0.18)));
    var remitted = Math.max(0, Math.round(actual * (1 - skimming)));
    var draftResistance = clamp(0.12 + (100 - truth) / 100 * 0.7 + Math.max(0, factor - 1) * 0.2 + corr / 100 * 0.08, 0.02, 0.96);
    var recruitmentEfficiency = clamp(1 - draftResistance * 0.75 - hiddenRatio * 0.25, 0.08, 0.98);
    var availableRecruits = Math.max(0, Math.round(ding * 0.12 * recruitmentEfficiency));
    var corveeEfficiency = clamp(0.28 + truth / 100 * 0.75 - Math.max(0, factor - 1) * 0.12 - hiddenRatio * 0.18, 0.08, 1);
    var executionRate = clamp(0.22 + truth / 100 * 0.64 - corr / 100 * 0.24 - hiddenRatio * 0.16, 0.05, 0.98);
    var hiddenGain = 0;
    var fugitiveGain = 0;
    if (div._minxinHardLinkPopulationTurn !== turn) {
      hiddenGain = Math.round(households * pressure * (0.008 + Math.max(0, factor - 1) * 0.012 + corr / 100 * 0.004));
      fugitiveGain = Math.round(mouths * unrest * (0.0025 + Math.max(0, factor - 1) * 0.003));
      pd.hiddenCount = Math.max(0, Math.round((Number(pd.hiddenCount) || 0) + hiddenGain));
      pd.fugitives = Math.max(0, Math.round((Number(pd.fugitives) || 0) + fugitiveGain));
      div._minxinHardLinkPopulationTurn = turn;
    }
    fd.claimedRevenue = Math.round(claimed);
    fd.actualRevenue = actual;
    fd.remittedToCenter = remitted;
    fd.retainedBudget = Math.max(0, actual - remitted); // P0-1(2026-06-20): 留用地方=实征-起运·此前漏写致面板「留用地方」恒空
    fd.skimmingRate = round2(skimming);
    fd.compliance = round2(collection * 100);
    fd.minxinCollectionMultiplier = round2(collection);
    md.recruitmentEfficiency = round2(recruitmentEfficiency);
    md.availableRecruits = availableRecruits;
    md.draftResistance = round2(draftResistance);
    md.desertionRisk = round2(clamp((100 - truth) / 100 * 0.5 + corr / 100 * 0.16, 0, 0.9));
    cd.executionEfficiency = round2(corveeEfficiency);
    cd.corveeResistance = round2(clamp(1 - corveeEfficiency, 0, 1));
    cd.fugitivesFromCorvee = Math.max(0, Math.round(fugitiveGain * 0.45));
    div.localExecutionRate = round2(executionRate);
    div.executionRate = div.localExecutionRate;
    div._minxinHardLink = {
      turn: turn,
      truth: round2(truth),
      collectionMultiplier: round2(collection),
      recruitmentEfficiency: md.recruitmentEfficiency,
      draftResistance: md.draftResistance,
      corveeEfficiency: cd.executionEfficiency,
      localExecutionRate: div.localExecutionRate,
      hiddenGain: hiddenGain,
      fugitiveGain: fugitiveGain,
      reason: pressure > 0 ? 'low-minxin-pressure' : 'stable-minxin'
    };
    return {
      turn: turn,
      regionId: regionIdOf(div),
      regionName: regionNameOf(div),
      trueMinxin: round2(truth),
      fiscal: { claimedRevenue: Math.round(claimed), actualRevenue: actual, remittedToCenter: remitted, skimmingRate: round2(skimming) },
      collectionMultiplier: round2(collection),
      conscription: { recruitmentEfficiency: md.recruitmentEfficiency, availableRecruits: availableRecruits, draftResistance: md.draftResistance },
      hukou: { hiddenHouseholds: Number(pd.hiddenCount) || 0, fugitives: Number(pd.fugitives) || 0, hiddenGain: hiddenGain, fugitiveGain: fugitiveGain },
      corvee: { executionEfficiency: cd.executionEfficiency, resistance: cd.corveeResistance },
      localExecutionRate: div.localExecutionRate,
      reason: div._minxinHardLink.reason
    };
  }

  function aggregate(root, impacts) {
    var fiscal = { claimedRevenue: 0, actualRevenue: 0, remittedToCenter: 0, revenueGap: 0, collectionMultiplier: 0 };
    var military = { availableRecruits: 0, avgRecruitmentEfficiency: 0, avgDraftResistance: 0, shortTermRecruits: 0 };
    var hukou = { hiddenHouseholds: 0, refugees: 0, hiddenAdded: 0, refugeesAdded: 0 };
    var local = { avgExecutionRate: 0, regions: impacts.length };
    impacts.forEach(function(row) {
      fiscal.claimedRevenue += Number(row.fiscal && row.fiscal.claimedRevenue) || 0;
      fiscal.actualRevenue += Number(row.fiscal && row.fiscal.actualRevenue) || 0;
      fiscal.remittedToCenter += Number(row.fiscal && row.fiscal.remittedToCenter) || 0;
      fiscal.collectionMultiplier += Number(row.collectionMultiplier) || 0;
      military.availableRecruits += Number(row.conscription && row.conscription.availableRecruits) || 0;
      military.avgRecruitmentEfficiency += Number(row.conscription && row.conscription.recruitmentEfficiency) || 0;
      military.avgDraftResistance += Number(row.conscription && row.conscription.draftResistance) || 0;
      hukou.hiddenHouseholds += Number(row.hukou && row.hukou.hiddenHouseholds) || 0;
      hukou.refugees += Number(row.hukou && row.hukou.fugitives) || 0;
      hukou.hiddenAdded += Number(row.hukou && row.hukou.hiddenGain) || 0;
      hukou.refugeesAdded += Number(row.hukou && row.hukou.fugitiveGain) || 0;
      local.avgExecutionRate += Number(row.localExecutionRate) || 0;
    });
    var count = Math.max(1, impacts.length);
    fiscal.revenueGap = Math.max(0, fiscal.claimedRevenue - fiscal.actualRevenue);
    fiscal.collectionMultiplier = round2(fiscal.collectionMultiplier / count);
    military.avgRecruitmentEfficiency = round2(military.avgRecruitmentEfficiency / count);
    military.avgDraftResistance = round2(military.avgDraftResistance / count);
    local.avgExecutionRate = round2(local.avgExecutionRate / count);
    root.fiscal = root.fiscal && typeof root.fiscal === 'object' ? root.fiscal : {};
    root.military = root.military && typeof root.military === 'object' ? root.military : {};
    root.hukou = root.hukou && typeof root.hukou === 'object' ? root.hukou : {};
    root.localExecution = root.localExecution && typeof root.localExecution === 'object' ? root.localExecution : {};
    var priorMilitary = root.military.minxinHardLinks && typeof root.military.minxinHardLinks === 'object' ? root.military.minxinHardLinks : {};
    military.shortTermRecruits = Number(priorMilitary.shortTermRecruits) || 0;
    root.fiscal.minxinHardLinks = fiscal;
    root.military.minxinHardLinks = military;
    root.hukou.minxinHardLinks = hukou;
    root.localExecution.minxinHardLinks = local;
    if (root.minxin && typeof root.minxin === 'object') {
      root.minxin.hardLinkEffects = { fiscal: clone(fiscal), military: clone(military), hukou: clone(hukou), localExecution: clone(local) };
    }
    return { fiscal: fiscal, military: military, hukou: hukou, localExecution: local };
  }

  // 豪强戳(2026-07-03)：把省级 provinceStats.magnatePower 沿 player 子树盖到叶(_mxhlMagnate·每 tick 重盖)，
  // 供 calcRegion 分省分化用。省名与 provinceStats 键做宽松包含匹配(地基 findDivision fuzzy 教训)。
  function _stampMagnate(root) {
    var ps = root && root.provinceStats;
    var ah = root && root.adminHierarchy && root.adminHierarchy.player;
    if (!ps || !ah || !ah.divisions) return;
    var keys = Object.keys(ps);
    function magOf(topName) {
      if (!topName) return 0;
      var hit = ps[topName];
      if (hit && typeof hit.magnatePower === 'number') return hit.magnatePower;
      for (var i = 0; i < keys.length; i += 1) {
        var k = keys[i];
        if (k && (k.indexOf(topName) >= 0 || String(topName).indexOf(k) >= 0)) {
          var v = ps[k] && ps[k].magnatePower;
          if (typeof v === 'number') return v;
        }
      }
      return 0;
    }
    ah.divisions.forEach(function (top) {
      var mag = magOf(top && (top.name || top.id));
      (function walk(d) {
        if (!d) return;
        var kids = d.children || d.divisions;
        if (kids && kids.length) { kids.forEach(walk); return; }
        d._mxhlMagnate = mag;
      })(top);
    });
  }

  function tick(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    try { _stampMagnate(root); } catch (_e) {}
    var leaves = getLeafDivisions(root).filter(function(div) { return div && typeof div === 'object'; });
    var impacts = leaves.map(function(div) { return calcRegion(root, div, { turn: turn }); });
    // 守恒归一(2026-07-03)：新分化项(豪强/灾情)单边压实征·会系统性拉低全国总额。
    // 按 claimed 加权把总额校回旧公式水平：K=Σ(claimed·base)/Σ(claimed·next)·夹[0.85,1.18]·
    // 善治省实征高于均值·劣治省低于——只重排不减总。
    var sBase = 0, sNext = 0;
    leaves.forEach(function (l) {
      var r = l._mxhlRatios; var fd = l.fiscalDetail;
      if (!r || !fd) return;
      var c = Number(fd.claimedRevenue) || 0;
      sBase += c * r.base; sNext += c * r.next;
    });
    var K = (sBase > 0 && sNext > 0) ? clamp(sBase / sNext, 0.85, 1.18) : 1;
    if (Math.abs(K - 1) > 0.0005) {
      leaves.forEach(function (l) {
        var fd = l.fiscalDetail; if (!fd || !l._mxhlRatios) return;
        fd.actualRevenue = Math.max(0, Math.round((Number(fd.actualRevenue) || 0) * K));
        fd.remittedToCenter = Math.max(0, Math.round((Number(fd.remittedToCenter) || 0) * K));
        fd.retainedBudget = Math.max(0, fd.actualRevenue - fd.remittedToCenter);
        if (isFinite(Number(fd.compliance))) fd.compliance = round2(clamp(Number(fd.compliance) * K, 0, 120));
        if (isFinite(Number(fd.minxinCollectionMultiplier))) fd.minxinCollectionMultiplier = round2(clamp(Number(fd.minxinCollectionMultiplier) * K, 0, 1.2));
      });
      impacts.forEach(function (row) {
        if (!row || !row.fiscal) return;
        row.fiscal.actualRevenue = Math.max(0, Math.round((Number(row.fiscal.actualRevenue) || 0) * K));
        row.fiscal.remittedToCenter = Math.max(0, Math.round((Number(row.fiscal.remittedToCenter) || 0) * K));
      });
    }
    store.turn = turn;
    store.regionImpacts = impacts;
    store.summary = aggregate(root, impacts);
    store.stats.ticks = (Number(store.stats.ticks) || 0) + 1;
    store.stats.regions = impacts.length;
    return { ok: true, regions: impacts.length, summary: clone(store.summary) };
  }

  function findTargetDivisions(root, region) {
    var leaves = getLeafDivisions(root).filter(function(div) { return div && typeof div === 'object'; });
    if (!region) return leaves;
    return leaves.filter(function(div) { return matchRegion(div, region); });
  }

  function recordCoerciveDemand(root, raw, options) {
    root = pickRoot(root);
    raw = raw || {};
    options = options || {};
    var store = ensureStore(root);
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var region = compact(raw.region || raw.regionName || raw.targetRegion || '', 100);
    var className = compact(raw.className || raw.class || raw.targetClass || 'Farmers', 80);
    var gain = Math.max(0, Math.round(Number(raw.recruitmentGain || raw.shortTermRecruits || raw.draftGain) || 0));
    var severity = clamp(raw.severity != null ? raw.severity : (gain ? gain / 500 : raw.intensity), 0.2, 2.5);
    var delta = -round2(clamp(raw.deltaTrue != null ? Math.abs(Number(raw.deltaTrue)) : (1.8 + severity * 1.2), 1, 8));
    var reason = compact(raw.text || raw.reason || raw.kind || 'coercive demand', 180);
    root.military = root.military && typeof root.military === 'object' ? root.military : {};
    if (!root.military.minxinHardLinks || typeof root.military.minxinHardLinks !== 'object') root.military.minxinHardLinks = {};
    root.military.minxinHardLinks.shortTermRecruits = Math.round((Number(root.military.minxinHardLinks.shortTermRecruits) || 0) + gain);
    findTargetDivisions(root, region).forEach(function(div) {
      var detail = ensureObject(div, 'militaryDetail');
      detail.coercivePressure = round2((Number(detail.coercivePressure) || 0) + severity);
      detail.draftResistance = round2(clamp((Number(detail.draftResistance) || 0.2) + severity * 0.08, 0, 1));
    });
    var ledgerResult = null;
    if (TM.MinxinLedger && typeof TM.MinxinLedger.recordAndApply === 'function') {
      ledgerResult = TM.MinxinLedger.recordAndApply(root, {
        sourceSystem: 'minxin-hard-links',
        kind: 'coercive-demand',
        tags: ['forced-conscription', 'hard-link', 'draft'],
        targetRegions: region ? [{ region: region, weight: 1, deltaTrue: delta }] : [],
        targetClasses: className ? [{ name: className, weight: 1 }] : [],
        deltaTrue: delta,
        intensity: clamp(severity / 2, 0, 1),
        confidence: 0.82,
        reason: reason,
        linkedIssue: compact(raw.linkedIssue || raw.issueId || '', 100)
      }, { turn: turn, source: options.source || 'minxin-hard-links-coercive-demand', force: true });
    } else {
      findTargetDivisions(root, region).forEach(function(div) { writeDivisionMinxin(div, getTruth(root, div) + delta); });
    }
    if (TM.SocialPoliticalSignals && typeof TM.SocialPoliticalSignals.record === 'function') {
      TM.SocialPoliticalSignals.record(root, {
        sourceSystem: 'minxin-hard-links',
        kind: 'coercive-demand',
        tags: ['forced-conscription', 'hard-link'],
        intensity: clamp(severity / 2, 0, 1),
        confidence: 0.82,
        linkedIssue: compact(raw.linkedIssue || raw.issueId || '', 100),
        reason: reason,
        affectedClasses: [{ name: className, satisfactionDelta: delta, demand: 'reduce coercive demand', reason: reason }]
      });
    }
    var event = {
      id: 'mxhard-coerce-' + turn + '-' + (store.ledger.length + 1),
      turn: turn,
      regionName: region || 'all',
      className: className,
      kind: compact(raw.kind || 'coercive-demand', 80),
      deltaTrue: delta,
      shortTermRecruits: gain,
      reason: reason,
      ledgerResult: ledgerResult && ledgerResult.recorded ? ledgerResult.recorded.id : ''
    };
    store.ledger.push(event);
    if (store.ledger.length > MAX_ITEMS) store.ledger = store.ledger.slice(-MAX_ITEMS);
    store.stats.coerciveDemands = (Number(store.stats.coerciveDemands) || 0) + 1;
    return { ok: true, event: clone(event), ledgerResult: ledgerResult };
  }

  function formatImpact(row) {
    return '- ' + row.regionName + ': minxin=' + row.trueMinxin
      + ' fiscal actual/claimed=' + (row.fiscal && row.fiscal.actualRevenue) + '/' + (row.fiscal && row.fiscal.claimedRevenue)
      + ' conscription eff=' + (row.conscription && row.conscription.recruitmentEfficiency)
      + ' hukou hidden/refugees=' + (row.hukou && row.hukou.hiddenHouseholds) + '/' + (row.hukou && row.hukou.fugitives)
      + ' execution=' + row.localExecutionRate
      + ' reason=' + row.reason;
  }

  function formatForPrompt(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    var limit = Math.max(1, Number(options.limit) || 8);
    var summary = store.summary || {};
    var fiscal = summary.fiscal || (root.fiscal && root.fiscal.minxinHardLinks) || {};
    var military = summary.military || (root.military && root.military.minxinHardLinks) || {};
    var hukou = summary.hukou || (root.hukou && root.hukou.minxinHardLinks) || {};
    var local = summary.localExecution || (root.localExecution && root.localExecution.minxinHardLinks) || {};
    var lines = [
      '=== Minxin Hard Links ===',
      'fiscal: actual=' + (fiscal.actualRevenue || 0) + ' claimed=' + (fiscal.claimedRevenue || 0) + ' gap=' + (fiscal.revenueGap || 0) + ' collection=' + (fiscal.collectionMultiplier || 0),
      'conscription: recruits=' + (military.availableRecruits || 0) + ' avgEfficiency=' + (military.avgRecruitmentEfficiency || 0) + ' resistance=' + (military.avgDraftResistance || 0) + ' shortTermRecruits=' + (military.shortTermRecruits || 0),
      'hukou: hiddenHouseholds=' + (hukou.hiddenHouseholds || 0) + ' refugees=' + (hukou.refugees || 0) + ' hiddenAdded=' + (hukou.hiddenAdded || 0) + ' refugeesAdded=' + (hukou.refugeesAdded || 0),
      'execution: avgLocalExecutionRate=' + (local.avgExecutionRate || 0) + ' regions=' + (local.regions || 0)
    ];
    store.regionImpacts.slice(-limit).forEach(function(row) { lines.push(formatImpact(row)); });
    store.ledger.slice(-Math.min(4, limit)).forEach(function(row) {
      lines.push('- coercive: ' + row.regionName + ' ' + row.kind + ' delta=' + row.deltaTrue + ' recruits=' + row.shortTermRecruits + ' reason=' + row.reason);
    });
    return lines.join('\n');
  }

  function snapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Number(options.limit) || 8);
    var store = ensureStore(root);
    return {
      turn: store.turn || Number(root.turn) || 0,
      summary: clone(store.summary || {
        fiscal: root.fiscal && root.fiscal.minxinHardLinks || {},
        military: root.military && root.military.minxinHardLinks || {},
        hukou: root.hukou && root.hukou.minxinHardLinks || {},
        localExecution: root.localExecution && root.localExecution.minxinHardLinks || {}
      }),
      regionImpacts: store.regionImpacts.slice(-limit).reverse().map(clone),
      ledger: store.ledger.slice(-limit).reverse().map(clone),
      stats: clone(store.stats || {})
    };
  }

  function diagnosticsText(root, options) {
    return formatForPrompt(root, options);
  }

  TM.MinxinHardLinks = {
    tick: tick,
    recordCoerciveDemand: recordCoerciveDemand,
    formatForPrompt: formatForPrompt,
    snapshot: snapshot,
    diagnosticsText: diagnosticsText,
    _getLeafDivisions: getLeafDivisions,
    _ensureStore: ensureStore
  };

  global.MinxinHardLinks = TM.MinxinHardLinks;
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.MinxinHardLinks;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
