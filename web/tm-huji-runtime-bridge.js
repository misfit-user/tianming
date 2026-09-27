// @ts-check
/*
 * tm-huji-runtime-bridge.js
 * Runtime reconciliation for hukou, corvee, and military service pools.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var MAX_OPERATIONS = 80;
  var DEFAULT_MOUTHS_PER_HOUSEHOLD = 5;
  var LEDGER_FIELDS = ['registeredMouths','registeredHouseholds','registeredDing','taxableMouths','taxableHouseholds','hiddenDing','fledDing','baselineExemptDing'];
  function explicitPopulation(root, scenario) {
    return !!(global.HujiEngine && typeof global.HujiEngine.isPopulationLedgerV2 === 'function' && global.HujiEngine.isPopulationLedgerV2(root,scenario));
  }

  function perfCount(name, delta) {
    var perf = TM && TM.perf;
    if (perf && typeof perf.count === 'function') perf.count(name, delta == null ? 1 : delta);
  }

  function perfSpan(name, fn, metadata) {
    var perf = TM && TM.perf;
    if (perf && typeof perf.withSpan === 'function') return perf.withSpan(name, fn, metadata);
    return fn();
  }

  function safeRevision(value) {
    var revision = Number(value);
    return isFinite(revision) && revision >= 0 ? Math.floor(revision) : 0;
  }

  function pickRoot(root) {
    if (root && typeof root === 'object') return root;
    if (global.GM && typeof global.GM === 'object') return global.GM;
    if (global.scriptData && typeof global.scriptData === 'object') return global.scriptData;
    return {};
  }

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

  function number(v, fallback) {
    var n = Number(v);
    return isFinite(n) ? n : (Number(fallback) || 0);
  }

  function firstDefinedFinite(values, fallback) {
    for (var i = 0; i < values.length; i++) {
      var value = values[i];
      if (value === undefined || value === null || (typeof value === 'string' && value.trim() === '')) continue;
      var n = Number(value);
      if (isFinite(n)) return { found:true, value:n };
    }
    return { found:false, value:number(fallback, 0) };
  }

  function round(v) {
    return Math.max(0, Math.round(number(v, 0)));
  }

  // 最大余数法：所有人口分类统一从这里取得精确整数分配，避免小总量下
  // 多个 Math.round() 使分项合计超过总数。
  function allocateExact(total, weights) {
    total = round(total);
    weights = weights && typeof weights === 'object' ? weights : {};
    var keys = Object.keys(weights);
    var out = {};
    keys.forEach(function(key) { out[key] = 0; });
    if (!keys.length || !total) return out;
    var weightTotal = keys.reduce(function(sum, key) {
      return sum + Math.max(0, number(weights[key], 0));
    }, 0);
    if (!(weightTotal > 0)) {
      keys.forEach(function(key) { weights[key] = 1; });
      weightTotal = keys.length;
    }
    var ranked = [];
    var assigned = 0;
    keys.forEach(function(key, index) {
      var quota = total * Math.max(0, number(weights[key], 0)) / weightTotal;
      var value = Math.floor(quota);
      out[key] = value;
      assigned += value;
      ranked.push({ key:key, index:index, fraction:quota - value });
    });
    ranked.sort(function(a, b) { return b.fraction - a.fraction || a.index - b.index; });
    for (var i = 0; i < total - assigned; i++) out[ranked[i % ranked.length].key]++;
    return out;
  }

  function round2(v) {
    return Math.round(number(v, 0) * 100) / 100;
  }

  function addNumericBuckets(target, source) {
    Object.keys(source || {}).forEach(function(key) {
      var value = Number(source[key]);
      if (!isFinite(value)) return;
      target[key] = (Number(target[key]) || 0) + Math.max(0, Math.round(value));
    });
    return target;
  }

  function addPopulationBreakdown(target, source) {
    Object.keys(source || {}).forEach(function(key) {
      var row = source[key];
      if (!row || typeof row !== 'object' || Array.isArray(row)) return;
      if (!target[key]) target[key] = { households:0, mouths:0, ding:0 };
      target[key].households += round(row.households);
      target[key].mouths += round(row.mouths);
      target[key].ding += round(row.ding);
    });
    return target;
  }

  function clamp(n, min, max) {
    n = number(n, min);
    return Math.max(min, Math.min(max, n));
  }

  function compact(v, maxLen) {
    var text = textOf(v).replace(/\s+/g, ' ').trim();
    maxLen = Number(maxLen) || 180;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function textOf(raw) {
    if (raw === undefined || raw === null) return '';
    if (typeof raw === 'string' || typeof raw === 'number' || typeof raw === 'boolean') return String(raw);
    if (Array.isArray(raw)) return raw.map(textOf).filter(Boolean).join(' ');
    if (typeof raw === 'object') {
      var keys = ['text', 'content', 'summary', 'desc', 'description', 'agenda', 'goal', 'objective', 'topic', 'title', 'name', 'action', 'targetText', 'reason'];
      for (var i = 0; i < keys.length; i += 1) {
        if (raw[keys[i]] !== undefined && raw[keys[i]] !== null && raw[keys[i]] !== '') return textOf(raw[keys[i]]);
      }
    }
    return '';
  }

  function unique(list) {
    var seen = {};
    var out = [];
    toArray(list).forEach(function(v) {
      var key = String(v || '').trim();
      if (!key || seen[key]) return;
      seen[key] = true;
      out.push(key);
    });
    return out;
  }

  function ensureStore(root) {
    root = pickRoot(root);
    if (!root._hujiRuntimeBridge || typeof root._hujiRuntimeBridge !== 'object' || Array.isArray(root._hujiRuntimeBridge)) {
      root._hujiRuntimeBridge = {
        turn: Number(root.turn) || 0,
        seq: 0,
        operations: [],
        stats: { maintained: 0, operations: 0 },
        snapshot: null,
        lastPlayerActionSeq: 0
      };
    }
    var store = root._hujiRuntimeBridge;
    if (!Array.isArray(store.operations)) store.operations = [];
    if (!store.stats) store.stats = { maintained: 0, operations: 0 };
    return store;
  }

  function ensureHardEffectStore(root) {
    root = pickRoot(root);
    if (!root._hujiHardEffects || typeof root._hujiHardEffects !== 'object' || Array.isArray(root._hujiHardEffects)) {
      root._hujiHardEffects = { ledger: [] };
    }
    if (!Array.isArray(root._hujiHardEffects.ledger)) root._hujiHardEffects.ledger = [];
    return root._hujiHardEffects;
  }

  function hardLedgerKey(entry) {
    return [
      entry && entry.turn,
      entry && entry.stage,
      entry && entry.kind,
      entry && entry.source
    ].join('|');
  }

  function appendHardLedger(root, entry) {
    var store = ensureHardEffectStore(root);
    var row = Object.assign({
      turn: Number(root && root.turn) || 0,
      stage: 'runtime',
      kind: 'unknown',
      source: 'huji-hard-effects',
      at: Date.now()
    }, entry || {});
    var key = hardLedgerKey(row);
    var replaced = false;
    store.ledger = store.ledger.map(function(old) {
      if (!old || hardLedgerKey(old) !== key) return old;
      replaced = true;
      return row;
    });
    if (!replaced) store.ledger.push(row);
    if (store.ledger.length > 80) store.ledger = store.ledger.slice(-80);
    return clone(row);
  }

  function getScenario(root, options) {
    options = options || {};
    if (options.scenario) return options.scenario;
    if (root && root.scenario) return root.scenario;
    if (root && root.scriptData) return root.scriptData;
    if (global.P && typeof global.P === 'object') return global.P;
    if (root && root.sid && typeof global.findScenarioById === 'function') {
      try { return global.findScenarioById(root.sid); } catch (_) {}
    }
    return null;
  }

  function getPopulationConfig(root, options) {
    var scenario = getScenario(root, options);
    return (scenario && scenario.populationConfig) || (root && root.populationConfig) || {};
  }

  function normalizedIdentity(value) {
    return String(value == null ? '' : value).replace(/[\s·（）()\-—_]/g, '').toLowerCase();
  }

  function playerIdentityAliases(root) {
    var aliases = [];
    function add(value) {
      var normalized = normalizedIdentity(value);
      if (normalized && aliases.indexOf(normalized) < 0) aliases.push(normalized);
    }
    add(global.P && global.P.playerInfo && global.P.playerInfo.factionId);
    add(global.P && global.P.playerInfo && global.P.playerInfo.factionName);
    add(global.P && global.P.playerFactionId);
    add(global.P && global.P.playerFaction);
    add(root && root.playerFactionId);
    add(root && root.playerFaction);
    (root && Array.isArray(root.facs) ? root.facs : []).forEach(function(faction) {
      if (faction && faction.isPlayer) {
        add(faction.id); add(faction.name); add(faction.key); add(faction.factionName);
      }
    });
    return aliases;
  }

  function strictPlayerAdminKey(root, hierarchy) {
    if (!hierarchy || typeof hierarchy !== 'object') return null;
    if (Object.prototype.hasOwnProperty.call(hierarchy, 'player')) return 'player';
    if (Array.isArray(hierarchy.divisions)) return 'divisions';
    try {
      if (typeof global._tmResolvePlayerAdminKey === 'function') {
        var resolved = global._tmResolvePlayerAdminKey(hierarchy, global.P || null, { allowSoleBranchFallback:false });
        if (resolved) return resolved;
      }
    } catch (_) {}
    var wanted = playerIdentityAliases(root);
    var keys = Object.keys(hierarchy).filter(function(key) {
      var branch = hierarchy[key];
      return Array.isArray(branch) || (branch && Array.isArray(branch.divisions));
    });
    for (var i = 0; i < keys.length; i++) {
      var branch = hierarchy[keys[i]] || {};
      if (branch && branch.isPlayer) return keys[i];
      var values = [keys[i], branch.id, branch.key, branch.factionId, branch.factionName, branch.name]
        .map(normalizedIdentity).filter(Boolean);
      if (values.some(function(value) { return wanted.indexOf(value) >= 0; })) return keys[i];
    }
    return null;
  }

  function hasAuthoritativePlayerPopulation(root) {
    var hierarchy = root && root.adminHierarchy;
    if (!hierarchy || typeof hierarchy !== 'object') return false;
    if (Array.isArray(hierarchy.divisions)) return true;
    var branchKeys = Object.keys(hierarchy).filter(function(key) {
      var branch = hierarchy[key];
      return Array.isArray(branch) || (branch && Array.isArray(branch.divisions));
    });
    if (!branchKeys.length) return false;
    if (strictPlayerAdminKey(root, hierarchy)) return true;
    return playerIdentityAliases(root).length > 0;
  }

  function walkAdminNode(node, out) {
    if (!node) return;
    if (Array.isArray(node)) {
      node.forEach(function(child) { walkAdminNode(child, out); });
      return;
    }
    if (typeof node !== 'object') return;
    var kids = node.children || node.divisions || node.subs || node.subdivisions || node.items || [];
    if (Array.isArray(kids) && kids.length) {
      kids.forEach(function(child) { walkAdminNode(child, out); });
      return;
    }
    if (node.id || node.name || node.populationDetail || node.population || node.mouths || node.households) out.push(node);
  }

  function getLeafRegions(root) {
    root = pickRoot(root);
    var leaves = [];
    var authoritativePlayerPopulation = hasAuthoritativePlayerPopulation(root);
    if (root.adminHierarchy) {
      var hierarchy = root.adminHierarchy || {};
      var playerKey = strictPlayerAdminKey(root, hierarchy);
      if (playerKey === 'divisions') {
        walkAdminNode(hierarchy.divisions, leaves);
      } else if (playerKey && global.IntegrationBridge && typeof global.IntegrationBridge.getLeafDivisions === 'function') {
        try { leaves = global.IntegrationBridge.getLeafDivisions(hierarchy, playerKey) || []; } catch (_) { leaves = []; }
      }
      if (!leaves.length && playerKey && playerKey !== 'divisions') walkAdminNode(hierarchy[playerKey], leaves);
    }
    if (!leaves.length && !authoritativePlayerPopulation && Array.isArray(root.regions)) leaves = root.regions.slice();
    var seen = {};
    return leaves.filter(function(row, idx) {
      if (!row || typeof row !== 'object') return false;
      var id = String(row.id || row.name || ('region-' + idx));
      if (seen[id]) return false;
      seen[id] = true;
      return true;
    });
  }

  function detailFromRegion(region, root, config) {
    region = region || {};
    var raw = region.populationDetail || region.population || region.hukou || {};
    if (typeof raw === 'number') raw = { mouths: raw };
    var mouthValue = firstDefinedFinite([raw.mouths, raw.people, raw.population, region.mouths, region.people, region.population], 0);
    var householdValue = firstDefinedFinite([raw.households, raw.hh, raw.registeredHouseholds, region.households], 0);
    var dingValue = firstDefinedFinite([raw.ding, raw.laborDing, raw.maleDing, raw.adultMale, region.ding], 0);
    var hiddenValue = firstDefinedFinite([raw.hiddenCount, raw.hidden, raw.hiddenPopulation, raw.unregistered, region.hiddenCount, region.hidden], 0);
    var fugitiveValue = firstDefinedFinite([raw.fugitives, raw.refugees, raw.escapees, raw.taoohu, region.fugitives, region.refugees], 0);
    var mouths = round(mouthValue.value);
    var households = round(householdValue.value);
    var ding = round(dingValue.value);
    if (!householdValue.found && mouths) households = round(mouths / DEFAULT_MOUTHS_PER_HOUSEHOLD);
    if (!mouthValue.found && households) mouths = round(households * DEFAULT_MOUTHS_PER_HOUSEHOLD);
    if (!dingValue.found && mouths) ding = round(mouths * 0.30);
    var hidden = round(hiddenValue.value);
    var fugitives = round(fugitiveValue.value);
    var ledger = {};
    if (explicitPopulation(root,{populationConfig:config})) LEDGER_FIELDS.forEach(function(key) { ledger[key] = round(firstDefinedFinite([raw[key]],0).value); });
    return Object.assign(ledger, {
      households: households,
      mouths: mouths,
      ding: ding,
      hiddenCount: hidden,
      fugitives: fugitives,
      byAge: clone(raw.byAge || region.byAge || {}),
      byGender: clone(raw.byGender || region.byGender || {}),
      byLegalStatus: clone(raw.byLegalStatus || region.byLegalStatus || {})
    });
  }

  function hasExplicitFiniteField(object, fields) {
    if (!object || typeof object !== 'object') return false;
    return fields.some(function(field) {
      return Object.prototype.hasOwnProperty.call(object, field)
        && firstDefinedFinite([object[field]], 0).found;
    });
  }

  function regionHasAuthoritativeAux(region, fields) {
    if (!region || typeof region !== 'object') return false;
    if (region.populationDetail && typeof region.populationDetail === 'object') {
      return hasExplicitFiniteField(region.populationDetail, fields);
    }
    var raw = region.population || region.hukou;
    return hasExplicitFiniteField(raw, fields) || hasExplicitFiniteField(region, fields);
  }

  function aggregatePopulation(root, config, leaves, options) {
    options = options || {};
    var initial = (config && config.initial) || {};
    var byRegion = {};
    var totals = { households: 0, mouths: 0, ding: 0, hiddenCount: 0, fugitives: 0 };
    var v2 = explicitPopulation(root,{populationConfig:config});
    if (v2) LEDGER_FIELDS.forEach(function(key) { totals[key] = 0; });
    var byAge = {};
    var byGender = {};
    var byLegalStatus = {};
    var hiddenAuthorityComplete = leaves.length > 0;
    var fugitiveAuthorityComplete = leaves.length > 0;
    leaves.forEach(function(region, idx) {
      hiddenAuthorityComplete = hiddenAuthorityComplete
        && regionHasAuthoritativeAux(region, ['hiddenCount', 'hidden', 'hiddenPopulation', 'unregistered']);
      fugitiveAuthorityComplete = fugitiveAuthorityComplete
        && regionHasAuthoritativeAux(region, ['fugitives', 'refugees', 'escapees', 'taoohu']);
      var d = detailFromRegion(region,root,config);
      var id = String(region.id || region.name || ('region-' + idx));
      totals.households += d.households;
      totals.mouths += d.mouths;
      totals.ding += d.ding;
      totals.hiddenCount += d.hiddenCount;
      totals.fugitives += d.fugitives;
      if (v2) LEDGER_FIELDS.forEach(function(key) { totals[key] += d[key] || 0; });
      addNumericBuckets(byAge, d.byAge);
      addNumericBuckets(byGender, d.byGender);
      addPopulationBreakdown(byLegalStatus, d.byLegalStatus);
      var canonical = Object.assign({}, region.populationDetail || {}, d, {
        id: id,
        name: region.name || id,
        regionType: region.regionType || region.type || region.kind || '',
        byAge: clone(d.byAge),
        byGender: clone(d.byGender),
        byLegalStatus: clone(d.byLegalStatus),
        bySettlement: clone(region.bySettlement || (region.populationDetail && region.populationDetail.bySettlement) || {}),
        byEthnicity: clone(region.byEthnicity || (region.populationDetail && region.populationDetail.byEthnicity) || {}),
        byFaith: clone(region.byFaith || region.byReligion || (region.populationDetail && region.populationDetail.byFaith) || {}),
        minxin: number(region.minxinLocal || region.minxin || (region.minxinDetail && region.minxinDetail.trueIndex), 0),
        corruption: number(region.corruptionLocal || region.corruption || (region.corruptionDetail && region.corruptionDetail.true), 0),
        taxLevel: region.taxLevel || '',
        baojiaUnits: round(region.baojiaUnits || (region.populationDetail && region.populationDetail.baojiaUnits) || 0),
        lijiaUnits: round(region.lijiaUnits || (region.populationDetail && region.populationDetail.lijiaUnits) || 0),
        fiscalDetail: clone(region.fiscalDetail || {}),
        corveeDetail: clone(region.corveeDetail || {}),
        militaryDetail: clone(region.militaryDetail || {})
      });
      region.populationDetail = canonical;
      region.byAge = canonical.byAge;
      region.byGender = canonical.byGender;
      region.byLegalStatus = canonical.byLegalStatus;
      if (region.population && typeof region.population === 'object' && region.population !== canonical) {
        region.population.mouths = canonical.mouths;
        region.population.households = canonical.households;
        region.population.ding = canonical.ding;
        region.population.hiddenCount = canonical.hiddenCount;
        region.population.fugitives = canonical.fugitives;
        if (v2) LEDGER_FIELDS.forEach(function(key) { region.population[key] = canonical[key]; });
      }
      // byRegion 是叶级权威表；值与 division.populationDetail 保持同一引用，
      // 任何保甲、逃户或人口治理修改都会真正落到行政区账本。
      byRegion[id] = canonical;
    });

    var hasRegionalTotals = leaves.length > 0 || totals.households || totals.mouths || totals.ding;
    var useRegionalTruth = options.authoritativePlayerPopulation === true || !!hasRegionalTotals;
    var households = useRegionalTruth ? totals.households : round(firstDefinedFinite([initial.nationalHouseholds, root.population && root.population.national && root.population.national.households], 0).value);
    var mouths = useRegionalTruth ? totals.mouths : round(firstDefinedFinite([initial.nationalMouths, root.population && root.population.national && root.population.national.mouths], households * DEFAULT_MOUTHS_PER_HOUSEHOLD).value);
    var ding = useRegionalTruth ? totals.ding : round(firstDefinedFinite([initial.nationalDing, root.population && root.population.national && root.population.national.ding], mouths * 0.30).value);
    var scenarioHidden = round(firstDefinedFinite([initial.hiddenPopulation, initial.hiddenCount, initial.unregisteredPopulation], 0).value);
    var existingHidden = round(firstDefinedFinite([root.population && root.population.hiddenCount, root.population && root.population.hiddenPopulation, root.population && root.population.unregisteredPopulation], 0).value);
    var emptyAuthoritativePlayer = options.authoritativePlayerPopulation === true && leaves.length === 0;
    var existingFugitives = Math.max(
      round(firstDefinedFinite([root.population && root.population.fugitives], 0).value),
      round(firstDefinedFinite([root.hukou && root.hukou.refugees, root.hukou && root.hukou.fugitives], 0).value)
    );
    if (options.authoritativePlayerPopulation === true && leaves.length && root.population._leafPopulationAuxAuthoritative !== true) {
      // 剧本 initial.hiddenPopulation 是新局一次性播种来源；旧 national/hukou
      // 镜像仅在叶级没有明确 hidden 字段时迁入，避免显式 0 被旧值复活。
      var targetHidden = hiddenAuthorityComplete
        ? Math.max(totals.hiddenCount, scenarioHidden)
        : Math.max(totals.hiddenCount, scenarioHidden, existingHidden);
      var targetFugitives = fugitiveAuthorityComplete ? totals.fugitives : Math.max(totals.fugitives, existingFugitives);
      var weights = {};
      leaves.forEach(function(region, index) {
        var id = String(region.id || region.name || ('region-' + index));
        weights[id] = Math.max(0, number(byRegion[id] && byRegion[id].mouths, 0));
      });
      var hiddenAdditions = allocateExact(targetHidden - totals.hiddenCount, weights);
      var fugitiveAdditions = allocateExact(targetFugitives - totals.fugitives, weights);
      leaves.forEach(function(region, index) {
        var id = String(region.id || region.name || ('region-' + index));
        var row = byRegion[id];
        row.hiddenCount = round(row.hiddenCount) + round(hiddenAdditions[id]);
        row.hidden = row.hiddenCount;
        row.fugitives = round(row.fugitives) + round(fugitiveAdditions[id]);
        region.hiddenCount = row.hiddenCount;
        region.hidden = row.hiddenCount;
        region.fugitives = row.fugitives;
      });
      totals.hiddenCount = targetHidden;
      totals.fugitives = targetFugitives;
      root.population._leafPopulationAuxAuthoritative = true;
    }
    var hiddenCount = emptyAuthoritativePlayer ? 0 : (options.authoritativePlayerPopulation === true ? totals.hiddenCount : Math.max(totals.hiddenCount, scenarioHidden, existingHidden));
    var fugitives = emptyAuthoritativePlayer ? 0 : (options.authoritativePlayerPopulation === true ? totals.fugitives : Math.max(totals.fugitives, existingFugitives));
    var national = { households:households, mouths:mouths, ding:ding };
    if (v2) {
      national.actualMouths = mouths;
      LEDGER_FIELDS.forEach(function(key) { national[key] = useRegionalTruth ? (totals[key] || 0) : round(firstDefinedFinite([initial[key],root.population && root.population.national && root.population.national[key]],0).value); });
    }
    return {
      ledgerV2:v2,
      national: national,
      hiddenCount: hiddenCount,
      fugitives: fugitives,
      regionalHidden: totals.hiddenCount,
      regionalFugitives: totals.fugitives,
      byAge: byAge,
      byGender: byGender,
      byLegalStatus: byLegalStatus,
      byRegion: byRegion
    };
  }

  function templateForCategory(cat, desc) {
    var templates = global.HujiEngine && global.HujiEngine.CATEGORY_TEMPLATES || {};
    var tmpl = clone(templates[cat] || {});
    if (!tmpl.name) tmpl.name = desc || cat;
    if (!tmpl.description) tmpl.description = desc || tmpl.desc || tmpl.name || cat;
    return tmpl;
  }

  function categoryShare(cat, enabled) {
    if (cat === 'bianhu') return 0.76;
    if (cat === 'junhu') return 0.07;
    if (cat === 'jianghu') return 0.025;
    if (cat === 'sengdao') return 0.018;
    if (cat === 'yuehu') return 0.01;
    if (cat === 'nubi') return 0.025;
    if (cat === 'huangzhuang') return 0.01;
    if (/tusi|jimi|native|土司|羁縻/.test(cat)) return 0.018;
    if (/salt|zao|yan|daohu|灶|盐/.test(cat)) return 0.018;
    return 0.015 + Math.min(0.015, 0.02 / Math.max(1, enabled.length));
  }

  function materializeCategories(root, config, aggregate) {
    var existing = root.population && root.population.byCategory || {};
    var descs = (config && config.categoryDescriptions) || {};
    var enabled = unique(((config && config.categoryEnabled) || Object.keys(existing)).concat(Object.keys(existing)));
    if (!enabled.length) enabled = ['bianhu', 'junhu', 'jianghu', 'sengdao', 'yuehu'];
    var rawShares = {};
    var totalShare = 0;
    enabled.forEach(function(cat) {
      rawShares[cat] = categoryShare(cat, enabled);
      totalShare += rawShares[cat];
    });
    if (rawShares.bianhu && totalShare < 0.98) {
      rawShares.bianhu += 0.98 - totalShare;
      totalShare = 0.98;
    }
    var out = {};
    var allocations = {
      households:allocateExact(aggregate.national.households, rawShares),
      mouths:allocateExact(aggregate.national.mouths, rawShares),
      ding:allocateExact(aggregate.national.ding, rawShares)
    };
    enabled.forEach(function(cat) {
      var desc = descs[cat] || (existing[cat] && (existing[cat].description || existing[cat].name)) || cat;
      var tmpl = templateForCategory(cat, desc);
      out[cat] = Object.assign({}, existing[cat] || {}, tmpl, {
        id: cat,
        households: allocations.households[cat] || 0,
        mouths: allocations.mouths[cat] || 0,
        ding: allocations.ding[cat] || 0,
        source: 'scenario-runtime-bridge'
      });
    });
    return out;
  }

  function estimateHiddenHouseholds(hiddenCount, national) {
    var mouthsPerHousehold = national && national.households ? (national.mouths / Math.max(1, national.households)) : DEFAULT_MOUTHS_PER_HOUSEHOLD;
    return round(number(hiddenCount, 0) / Math.max(2.5, mouthsPerHousehold || DEFAULT_MOUTHS_PER_HOUSEHOLD));
  }

  function materializeLegalStatus(root, aggregate) {
    var national = aggregate.national;
    var hiddenHouseholds = estimateHiddenHouseholds(aggregate.hiddenCount, national);
    var fugitiveHouseholds = estimateHiddenHouseholds(aggregate.fugitives, national);
    if (aggregate.ledgerV2) {
      var registered = {mouths:national.registeredMouths,households:national.registeredHouseholds,ding:national.registeredDing};
      var hidden = {mouths:aggregate.hiddenCount,households:hiddenHouseholds,ding:national.hiddenDing};
      var fled = {mouths:aggregate.fugitives,households:fugitiveHouseholds,ding:national.fledDing};
      var legal = {huangji:{name:'在籍在地'},taoohu:{name:'籍内逃口'},yinhu:{name:'查估隐口'},unrecorded:{name:'未详入册'}};
      ['mouths','households','ding'].forEach(function(key) {
        var f = Math.min(round(registered[key]),round(fled[key]));
        var h = Math.min(round(hidden[key]),Math.max(0,round(national[key])-round(registered[key])));
        legal.huangji[key] = Math.max(0,round(registered[key])-f);
        legal.taoohu[key] = f; legal.yinhu[key] = h;
        legal.unrecorded[key] = Math.max(0,round(national[key])-round(registered[key])-h);
      });
      return legal;
    }
    var extras = clone(aggregate.byLegalStatus || {});
    ['huangji', 'baiji', 'taohu', 'yinhu'].forEach(function(key) { delete extras[key]; });
    function legalWeights(field, total, hiddenValue, fugitiveValue) {
      var weights = {};
      var classified = 0;
      Object.keys(extras).forEach(function(key) {
        var value = round(extras[key] && extras[key][field]);
        weights[key] = value;
        classified += value;
      });
      hiddenValue = round(hiddenValue);
      fugitiveValue = round(fugitiveValue);
      var visible = Math.max(0, round(total) - hiddenValue - fugitiveValue - classified);
      weights.huangji = visible * 0.94;
      weights.baiji = visible * 0.06;
      weights.taoohu = fugitiveValue;
      weights.yinhu = hiddenValue;
      return allocateExact(total, weights);
    }
    var allocations = {
      households:legalWeights('households', national.households, hiddenHouseholds, fugitiveHouseholds),
      mouths:legalWeights('mouths', national.mouths, aggregate.hiddenCount, aggregate.fugitives),
      ding:legalWeights('ding', national.ding, round(aggregate.hiddenCount * 0.30), round(aggregate.fugitives * 0.30))
    };
    var out = {};
    var keys = unique(Object.keys(extras).concat(['huangji', 'baiji', 'taoohu', 'yinhu']));
    keys.forEach(function(key) {
      out[key] = Object.assign({}, extras[key] || {}, {
        households:allocations.households[key] || 0,
        mouths:allocations.mouths[key] || 0,
        ding:allocations.ding[key] || 0
      });
    });
    return out;
  }

  function syncHukou(root, aggregate, options) {
    root.population = root.population || {};
    root.hukou = root.hukou || {};
    var national = aggregate.national;
    var hiddenHouseholds = estimateHiddenHouseholds(aggregate.hiddenCount, national);
    var fugitiveHouseholds = estimateHiddenHouseholds(aggregate.fugitives, national);
    var hiddenTaxCap = round(national.households * 0.65);
    var taxHiddenHouseholds = Math.min(hiddenTaxCap, hiddenHouseholds + fugitiveHouseholds);
    var v2 = aggregate.ledgerV2;
    var effectiveTaxHouseholds = v2 ? round(national.taxableHouseholds) : Math.max(0,national.households-taxHiddenHouseholds);
    var registeredHouseholds = v2 ? round(national.registeredHouseholds) : national.households;
    var registeredMouths = v2 ? round(national.registeredMouths) : national.mouths;
    var registeredDing = v2 ? round(national.registeredDing) : national.ding;
    if (v2) root.population.accounting = Object.assign({},getPopulationConfig(root,options).accounting || {schema:'tm-population-ledger/2',displayBasis:'registered'});
    root.population.national = Object.assign({}, root.population.national || {}, national, {
      hiddenCount: aggregate.hiddenCount,
      fugitives: aggregate.fugitives,
      hiddenHouseholds: hiddenHouseholds,
      fugitiveHouseholds: fugitiveHouseholds,
      effectiveTaxHouseholds: effectiveTaxHouseholds
    });
    root.population.hiddenCount = aggregate.hiddenCount;
    root.population.fugitives = aggregate.fugitives;
    root.population.byLeafRegion = aggregate.byRegion;
    root.population.byRegion = aggregate.byRegion;
    root.population.byAge = clone(aggregate.byAge || {});
    root.population.ageLayers = clone(aggregate.byAge || {});
    root.population.byGender = clone(aggregate.byGender || {});
    root.population.gender = {
      male:round(aggregate.byGender && aggregate.byGender.male),
      female:round(aggregate.byGender && aggregate.byGender.female),
      total:round(aggregate.byGender && aggregate.byGender.male) + round(aggregate.byGender && aggregate.byGender.female),
      ratio:round(aggregate.byGender && aggregate.byGender.male) / Math.max(1, round(aggregate.byGender && aggregate.byGender.female))
    };
    root.population.agePyramidFine = Object.assign({}, clone(aggregate.byAge || {}), {
      _newlyAdult:number(root.population.agePyramidFine && root.population.agePyramidFine._newlyAdult, 0),
      _leavingDing:number(root.population.agePyramidFine && root.population.agePyramidFine._leavingDing, 0)
    });
    root.population.byCategory = materializeCategories(root, getPopulationConfig(root, options), aggregate);
    root.population.byLegalStatus = materializeLegalStatus(root, aggregate);
    root.hukou.registeredHouseholds = registeredHouseholds;
    root.hukou.registeredMouths = registeredMouths;
    root.hukou.registeredDing = registeredDing;
    root.hukou.registeredTotal = registeredMouths;
    root.hukou.ding = registeredDing;
    if (v2) { root.hukou.mouths = registeredMouths; root.hukou.actualMouths = national.mouths; root.hukou.taxableMouths = national.taxableMouths; root.hukou.taxableHouseholds = effectiveTaxHouseholds; }
    root.hukou.estimatedHidden = aggregate.hiddenCount;
    root.hukou.hiddenHouseholds = hiddenHouseholds;
    root.hukou.refugees = aggregate.fugitives;
    root.hukou.fugitives = aggregate.fugitives;
    root.hukou.fugitiveHouseholds = fugitiveHouseholds;
    root.hukou.effectiveTaxHouseholds = effectiveTaxHouseholds;
    root.hukou.taxBaseRatio = registeredHouseholds ? Number((effectiveTaxHouseholds / Math.max(1,registeredHouseholds)).toFixed(3)) : 0;
    return {
      registeredHouseholds: registeredHouseholds,
      registeredMouths: registeredMouths,
      registeredDing: registeredDing,
      actualMouths: national.mouths,
      taxableMouths: v2 ? national.taxableMouths : undefined,
      hiddenCount: aggregate.hiddenCount,
      hiddenHouseholds: hiddenHouseholds,
      fugitives: aggregate.fugitives,
      effectiveTaxHouseholds: effectiveTaxHouseholds,
      taxBaseRatio: root.hukou.taxBaseRatio,
      regionCount: Object.keys(aggregate.byRegion || {}).length
    };
  }

  function buildCorveeLedger(root, config, aggregate, options) {
    root.population = root.population || {};
    root.population.corvee = root.population.corvee || {};
    root.corvee = root.corvee || {};
    var rules = (config && (config.corveeRules || config.corvee)) || {};
    var annualDays = number(rules.annualCorveeDays || rules.baseDays || root.population.corvee.annualDays, 20);
    var commutationRate = clamp(rules.commutationRate !== undefined ? rules.commutationRate : (root.population.corvee.commutationRate !== undefined ? root.population.corvee.commutationRate : 0.35), 0, 1);
    var executionBase = root.localExecution && root.localExecution.minxinHardLinks && root.localExecution.minxinHardLinks.avgExecutionRate;
    var executionRate = clamp(executionBase !== undefined ? executionBase : (1 - ((root.corruption && root.corruption.trueIndex || 40) / 220)), 0.25, 0.98);
    var byRegion = Object.keys(aggregate.byRegion || {}).map(function(id) {
      var row = aggregate.byRegion[id] || {};
      var demand = round((row.ding || 0) * annualDays);
      var localPenalty = row.minxin ? clamp(row.minxin / 100, 0.35, 1.05) : 0.75;
      var fulfilled = round(demand * executionRate * localPenalty);
      var commuted = round(demand * commutationRate);
      return {
        id: id,
        name: row.name || id,
        regionType: row.regionType || '',
        ding: row.ding || 0,
        demandDays: demand,
        fulfilledDays: fulfilled,
        gapDays: Math.max(0, demand - fulfilled),
        commutedDays: commuted,
        commutedMoney: round(commuted * number(rules.silverPerDay || rules.moneyPerDay, 0.04)),
        burden: row.mouths ? Number((demand / Math.max(1, row.mouths)).toFixed(3)) : 0
      };
    });
    var summary = byRegion.reduce(function(acc, row) {
      acc.totalDemandDays += row.demandDays;
      acc.fulfilledDays += row.fulfilledDays;
      acc.gapDays += row.gapDays;
      acc.commutedMoney += row.commutedMoney;
      return acc;
    }, {
      totalDemandDays: 0,
      fulfilledDays: 0,
      gapDays: 0,
      commutedMoney: 0,
      annualDays: annualDays,
      commutationRate: commutationRate,
      executionRate: Number(executionRate.toFixed(3)),
      regionCount: byRegion.length
    });
    summary.burden = aggregate.national.mouths ? Number((summary.totalDemandDays / Math.max(1, aggregate.national.mouths)).toFixed(3)) : 0;
    summary.fullyCommuted = commutationRate >= 0.95;
    var governanceRelief = root.corvee && root.corvee.governanceRelief || {};
    var governanceGapReduction = round(governanceRelief.gapReduction || governanceRelief.corveeGapReduction || 0);
    if (governanceGapReduction > 0 && summary.gapDays > 0) {
      var appliedRelief = Math.min(summary.gapDays, governanceGapReduction);
      summary.gapDays = Math.max(0, summary.gapDays - appliedRelief);
      summary.fulfilledDays = round(summary.fulfilledDays + appliedRelief);
      summary.governanceGapReduction = appliedRelief;
      summary.governanceReliefSource = governanceRelief.source || 'huji-governance-loop';
      var reliefRemaining = appliedRelief;
      var rawGap = byRegion.reduce(function(sum, row) { return sum + round(row && row.gapDays); }, 0);
      byRegion.forEach(function(row, idx) {
        if (!row || reliefRemaining <= 0) return;
        var current = round(row.gapDays);
        if (!current) return;
        var share = idx === byRegion.length - 1 ? reliefRemaining : Math.min(current, Math.round(appliedRelief * current / Math.max(1, rawGap)));
        if (share <= 0 && current > 0 && reliefRemaining > 0) share = 1;
        share = Math.min(current, reliefRemaining, share);
        row.gapDays = Math.max(0, current - share);
        row.fulfilledDays = round(row.fulfilledDays + share);
        row.governanceGapReduction = round((row.governanceGapReduction || 0) + share);
        reliefRemaining -= share;
      });
    }
    var ledger = {
      turn: Number(options && options.turn) || Number(root.turn) || 0,
      source: options && options.source || 'huji-runtime-bridge',
      summary: summary,
      byRegion: byRegion
    };
    root.corvee.ledger = ledger;
    root.population.corvee.runtimeLedger = ledger;
    root.population.corvee.totalDemandDays = summary.totalDemandDays;
    root.population.corvee.availableDing = aggregate.national.ding;
    return ledger;
  }

  function armySoldiers(army) {
    return round(army && (army.soldiers || army.strength || army.size || army.count || army.troops) || 0);
  }

  function buildMilitaryPool(root, config, aggregate, options) {
    root.population = root.population || {};
    root.population.military = root.population.military || {};
    root.military = root.military || {};
    var rules = (config && (config.militaryRules || config.military)) || {};
    var armies = Array.isArray(root.armies) ? root.armies : [];
    var activeSoldiers = armies.reduce(function(sum, army) { return sum + armySoldiers(army); }, 0);
    var byType = clone(root.population.military.types || {});
    armies.forEach(function(army) {
      if (!army) return;
      var type = army.type || army.branch || 'field';
      if (!byType[type]) byType[type] = { soldiers: 0 };
      byType[type].soldiers = round(byType[type].soldiers || 0) + armySoldiers(army);
    });
    var eligibleDing = aggregate.national.ding;
    var maxExpansionRate = clamp(rules.maxExpansionRate !== undefined ? rules.maxExpansionRate : 0.10, 0.01, 0.50);
    var corruptionDrag = clamp(1 - ((root.corruption && root.corruption.trueIndex || 45) / 180), 0.25, 0.95);
    var minxinDrag = root.minxin ? clamp(((root.minxin.trueIndex !== undefined ? root.minxin.trueIndex : root.minxin.index || root.minxin.value || 50) / 100), 0.25, 1.05) : 0.65;
    var avgRecruitmentEfficiency = Number((corruptionDrag * minxinDrag).toFixed(3));
    var baseAvailable = Math.max(eligibleDing - activeSoldiers, round(eligibleDing * maxExpansionRate));
    var availableRecruits = round(baseAvailable * maxExpansionRate * Math.max(0.35, avgRecruitmentEfficiency));
    var governanceBoost = round(root.military && root.military.governanceServiceBoost && root.military.governanceServiceBoost.availableRecruits || 0);
    if (governanceBoost > 0) availableRecruits += governanceBoost;
    var requestedRecruits = round(root.military.pendingRecruitment || root.military.draftQuota || root.military.requestedRecruits || 0);
    var pool = {
      turn: Number(options && options.turn) || Number(root.turn) || 0,
      activeSoldiers: activeSoldiers,
      eligibleDing: eligibleDing,
      availableRecruits: availableRecruits,
      requestedRecruits: requestedRecruits,
      shortfall: Math.max(0, requestedRecruits - availableRecruits),
      avgRecruitmentEfficiency: avgRecruitmentEfficiency,
      maxExpansionRate: maxExpansionRate,
      governanceBoostAvailableRecruits: governanceBoost,
      byType: byType,
      byCategory: {
        junhu: clone(root.population.byCategory && root.population.byCategory.junhu || {}),
        bianhu: clone(root.population.byCategory && root.population.byCategory.bianhu || {})
      }
    };
    root.military.servicePool = pool;
    root.population.military.servicePool = pool;
    root.population.military.activeSoldiers = activeSoldiers;
    root.population.military.availableRecruits = availableRecruits;
    return pool;
  }

  function recordHardSignal(root, raw) {
    if (!TM.SocialPoliticalSignals || typeof TM.SocialPoliticalSignals.record !== 'function') return null;
    try {
      return TM.SocialPoliticalSignals.record(root, Object.assign({
        sourceSystem: 'huji-hard-effects',
        confidence: 0.82
      }, raw || {}));
    } catch (_) {
      return null;
    }
  }

  function baseIncomeValue(root, field, current) {
    root.guoku = root.guoku || {};
    var baseField = field === 'turnIncome' ? '_hujiHardBaseTurnIncome' : '_hujiHardBaseMonthlyIncome';
    var appliedField = field === 'turnIncome' ? '_hujiHardAppliedTurnIncome' : '_hujiHardAppliedMonthlyIncome';
    var currentValue = round(current);
    var priorBase = round(root.guoku[baseField]);
    var priorApplied = round(root.guoku[appliedField]);
    if (!priorBase || (priorApplied && currentValue && Math.abs(currentValue - priorApplied) > 1)) {
      priorBase = currentValue;
    }
    if (!priorBase) priorBase = currentValue;
    root.guoku[baseField] = priorBase;
    return priorBase;
  }

  function unifiedFiscal(root, options) {
    if(global.CascadeTax&&typeof global.CascadeTax.isUnified==='function')return global.CascadeTax.isUnified(root,'player');
    var sc=getScenario(root,options)||{},p=root.playerInfo||(global.P||{}).playerInfo||{},fac=(root.facs||[]).find(function(f){return f&&(f.id===p.factionId||f.name===p.factionName||f.isPlayer);});
    var cfg=Object.assign({},(global.P||{}).fiscalConfig,sc.fiscalConfig,root.fiscalConfig,fac&&fac.fiscalConfig);
    return !!(cfg.accounting&&cfg.accounting.schema==='tm-fiscal-ledger/2');
  }
  function applyFiscalHardEffect(root, hukou, options) {
    root.guoku = root.guoku && typeof root.guoku === 'object' ? root.guoku : {};
    root.fiscal = root.fiscal && typeof root.fiscal === 'object' ? root.fiscal : {};
    hukou = hukou || {};
    var taxBaseRatio = clamp(hukou.taxBaseRatio != null ? hukou.taxBaseRatio : 1, 0, 1);
    var hiddenPressure = 1 - taxBaseRatio;
    var fugitivePressure = hukou.registeredMouths ? clamp((Number(hukou.fugitives) || 0) / Math.max(1, hukou.registeredMouths), 0, 0.5) : 0;
    var scenario = getScenario(root,options) || {};
    var playerFac = (root.facs || []).find(function(f) { return f && (f.isPlayer || String(f.id) === String(root.playerFactionId || '')); });
    var fiscalConfig = (playerFac && playerFac.fiscalConfig) || root.fiscalConfig || scenario.fiscalConfig || {};
    var explicitTax = unifiedFiscal(root, options); // Per-tax CascadeTax already consumes registered bases or its one legacy-base flee adjustment.
    var collectionMultiplier = explicitTax ? 1 : round2(clamp(taxBaseRatio - hiddenPressure * 0.08 - fugitivePressure * 0.18, 0.22, 1));
    var monthlyBase = baseIncomeValue(root, 'monthlyIncome', root.guoku.monthlyIncome || root.guoku.turnIncome || root.fiscal.expectedRevenue || 0);
    var turnBase = baseIncomeValue(root, 'turnIncome', root.guoku.turnIncome || root.guoku.monthlyIncome || root.fiscal.expectedRevenue || 0);
    var monthly = round(monthlyBase * collectionMultiplier);
    var turnIncome = round(turnBase * collectionMultiplier);
    if (!explicitTax) {
      root.guoku.monthlyIncome = monthly;root.guoku.turnIncome = turnIncome;
      root.guoku.plannedMonthlyIncome = monthlyBase;root.guoku.plannedTurnIncome = turnBase;
      root.guoku.actualTaxRate = Math.min(number(root.guoku.actualTaxRate, 1) || 1, collectionMultiplier);
    }
    root.fiscal.effectiveRevenue = turnIncome;
    root.fiscal.hujiCollectionMultiplier = collectionMultiplier;
    var effect = {
      turn: Number(options && options.turn) || Number(root.turn) || 0,
      baseMonthlyIncome: monthlyBase,
      appliedMonthlyIncome: monthly,
      baseTurnIncome: turnBase,
      appliedTurnIncome: turnIncome,
      revenueLoss: Math.max(0, turnBase - turnIncome),
      collectionMultiplier: collectionMultiplier,
      taxBaseRatio: taxBaseRatio,
      hiddenPressure: round2(hiddenPressure),
      fugitivePressure: round2(fugitivePressure),
      source: 'huji-hard-effects'
    };
    root.guoku._hujiHardAppliedMonthlyIncome = monthly;
    root.guoku._hujiHardAppliedTurnIncome = turnIncome;
    root.guoku.hujiHardEffects = effect;
    root.fiscal.hujiHardEffects = clone(effect);
    if (effect.revenueLoss > 0) {
      recordHardSignal(root, {
        kind: 'hukou-fiscal-taxbase',
        tags: ['hukou', 'fiscal', 'taxbase'],
        intensity: clamp(hiddenPressure + fugitivePressure, 0, 1),
        reason: 'hukou hidden/fugitive pressure reduced effective fiscal collection',
        affectedClasses: [
          { name: '编户齐民', deltaSatisfaction: -0.4, deltaPressure: 0.7, reason: 'tax base audit pressure' },
          { name: '流民', deltaSatisfaction: -0.2, deltaPressure: 0.5, reason: 'fugitive households affect fiscal collection' }
        ]
      });
    }
    return effect;
  }

  function applyMilitaryHardEffect(root, servicePool, options) {
    root.military = root.military && typeof root.military === 'object' ? root.military : {};
    servicePool = servicePool || {};
    var requested = round(servicePool.requestedRecruits || root.military.pendingRecruitment || root.military.draftQuota || 0);
    var available = round(servicePool.availableRecruits || root.military.availableRecruits || 0);
    var approved = requested ? Math.min(requested, available) : available;
    var shortfall = Math.max(0, requested - approved);
    var ratio = requested ? clamp(shortfall / Math.max(1, requested), 0, 1) : 0;
    root.military.availableRecruits = available;
    root.military.recruitmentCapacity = available;
    root.military.approvedRecruitment = approved;
    root.military.recruitmentShortfall = shortfall;
    var penalty = shortfall > 0 ? Math.max(1, Math.ceil(ratio * 8)) : 0;
    var turn = Number(options && options.turn) || Number(root.turn) || 0;
    if (penalty && root.military._hujiHardMoraleTurn !== turn && Array.isArray(root.armies)) {
      root.armies.forEach(function(army) {
        if (!army || typeof army !== 'object') return;
        if (typeof army.morale === 'number') army.morale = clamp(army.morale - penalty, 0, 100);
        if (typeof army.supply === 'number') army.supply = clamp(army.supply - Math.ceil(penalty / 2), 0, 100);
        army.hujiServicePressure = {
          turn: turn,
          moralePenalty: penalty,
          shortfallRatio: round2(ratio)
        };
      });
      root.military._hujiHardMoraleTurn = turn;
    }
    var effect = {
      turn: turn,
      requestedRecruits: requested,
      availableRecruits: available,
      approvedRecruits: approved,
      shortfall: shortfall,
      shortfallRatio: round2(ratio),
      moralePenalty: penalty,
      avgRecruitmentEfficiency: servicePool.avgRecruitmentEfficiency || 0,
      source: 'huji-hard-effects'
    };
    root.military.hujiHardEffects = effect;
    if (shortfall > 0) {
      recordHardSignal(root, {
        kind: 'military-service-pool-shortfall',
        tags: ['military', 'draft', 'hukou'],
        intensity: ratio,
        reason: 'service pool cannot satisfy requested recruitment',
        affectedClasses: [
          { name: '军户', deltaSatisfaction: -1.0, deltaPressure: 1.2, reason: 'draft shortfall and service stress' },
          { name: '边军', deltaSatisfaction: -0.5, deltaPressure: 0.8, reason: 'frontier reinforcement shortage' }
        ]
      });
    }
    return effect;
  }

  function corveeTargetRegions(ledger) {
    return toArray(ledger && ledger.byRegion).filter(function(row) {
      return row && row.gapDays > 0;
    }).slice(0, 8).map(function(row) {
      return {
        region: row.id || row.name,
        weight: Math.max(1, Number(row.gapDays) || 1),
        deltaTrue: null
      };
    });
  }

  function applyCorveeHardEffect(root, ledger, options) {
    root.corvee = root.corvee && typeof root.corvee === 'object' ? root.corvee : {};
    ledger = ledger || {};
    var summary = ledger.summary || {};
    var demand = Math.max(1, Number(summary.totalDemandDays) || 1);
    var gap = Math.max(0, Number(summary.gapDays) || 0);
    var gapRatio = clamp(gap / demand, 0, 1);
    var burden = Number(summary.burden) || 0;
    var burdenPressure = clamp((burden - 8) / 16, 0, 1);
    var minxinDelta = -round2(clamp(gapRatio * 5 + burdenPressure * 3, 0, 8));
    // A2b 激活·役负满意度去重：已种子地域之役负→农户满意度归 Renli(过 gateSatisfaction)·此处按未种子丁占比缩减·避双扣农户
    var _rlShare = (function(){ var rl = (typeof TM !== 'undefined' && TM && TM.Renli) ? TM.Renli : null; return (rl && rl.seededDingShare) ? rl.seededDingShare() : 0; })();
    if (_rlShare > 0) minxinDelta = round2(minxinDelta * (1 - _rlShare));
    var turn = Number(options && options.turn) || Number(root.turn) || 0;
    var applied = false;
    if (minxinDelta < 0 && root.corvee._hujiHardMinxinTurn !== turn) {
      if (TM.MinxinLedger && typeof TM.MinxinLedger.recordAndApply === 'function') {
        try {
          TM.MinxinLedger.recordAndApply(root, {
            sourceSystem: 'huji-hard-effects',
            kind: 'corvee-gap-burden',
            tags: ['corvee', 'minxin', 'hukou'],
            targetRegions: corveeTargetRegions(ledger),
            targetClasses: [
              { name: '农户', weight: 0.7 },
              { name: '匠役', weight: 0.3 }
            ],
            deltaTrue: minxinDelta,
            intensity: clamp(gapRatio + burdenPressure, 0, 1),
            confidence: 0.84,
            reason: 'corvee demand gap and burden lower local minxin'
          }, { turn: turn, source: 'huji-hard-effects-corvee' });
          applied = true;
        } catch (_) {}
      }
      if (!applied) {
        root.minxin = root.minxin && typeof root.minxin === 'object' ? root.minxin : { trueIndex: Number(root.minxin) || 50 };
        root.minxin.trueIndex = clamp(number(root.minxin.trueIndex, 50) + minxinDelta, 0, 100);
        applied = true;
      }
      root.corvee._hujiHardMinxinTurn = turn;
      recordHardSignal(root, {
        kind: 'corvee-gap-burden',
        tags: ['corvee', 'minxin', 'hukou'],
        intensity: clamp(gapRatio + burdenPressure, 0, 1),
        reason: 'corvee demand gap and burden lowered minxin',
        affectedClasses: [
          { name: '农户', deltaSatisfaction: minxinDelta * 0.6, deltaPressure: Math.abs(minxinDelta) * 0.4, reason: 'corvee burden' },
          { name: '匠役', deltaSatisfaction: minxinDelta * 0.4, deltaPressure: Math.abs(minxinDelta) * 0.3, reason: 'labor mobilization' }
        ]
      });
    }
    var effect = {
      turn: turn,
      demandDays: round(summary.totalDemandDays || 0),
      gapDays: round(gap),
      gapRatio: round2(gapRatio),
      burden: round2(burden),
      burdenPressure: round2(burdenPressure),
      minxinDelta: minxinDelta,
      appliedToMinxin: applied,
      source: 'huji-hard-effects'
    };
    root.corvee.hujiHardEffects = effect;
    return effect;
  }

  function tinyiArray(root) {
    if (!Array.isArray(root._pendingTinyiTopics)) root._pendingTinyiTopics = [];
    return root._pendingTinyiTopics;
  }

  function hasTinyiIssue(root, id, topic) {
    var list = tinyiArray(root);
    var normTopic = String(topic || '').replace(/\s+/g, '').toLowerCase();
    return list.some(function(item) {
      if (!item) return false;
      if (id && String(item.id || item.issueId || item.linkedIssue || '') === String(id)) return true;
      if (!normTopic) return false;
      return String(item.topic || item.title || '').replace(/\s+/g, '').toLowerCase() === normTopic;
    });
  }

  function pushHujiTinyi(root, effectType, topic, priority, payload) {
    var id = 'huji-hard-' + effectType + '-' + (Number(root.turn) || 0);
    if (hasTinyiIssue(root, id, topic)) return false;
    var item = Object.assign({
      id: id,
      issueId: id,
      linkedIssue: id,
      topic: topic,
      from: 'huji-hard-effects',
      sourceType: 'huji_hard_effect',
      effectType: effectType,
      turn: Number(root.turn) || 0,
      priority: priority,
      status: 'pending',
      reason: 'Huji hard effect crossed court threshold'
    }, payload || {});
    tinyiArray(root).push(item);
    if (root._pendingTinyiTopics.length > 80) root._pendingTinyiTopics = root._pendingTinyiTopics.slice(-80);
    return true;
  }

  function spawnHardEffectTinyi(root, effects) {
    effects = effects || {};
    var created = 0;
    var fiscal = effects.fiscal || {};
    var military = effects.military || {};
    var corvee = effects.corvee || {};
    if ((fiscal.taxBaseRatio && fiscal.taxBaseRatio < 0.78) || fiscal.hiddenPressure > 0.22) {
      if (pushHujiTinyi(root, 'hukou', '户口失实·清丈黄册与招抚流民·请付廷议', 78, {
        taxBaseRatio: fiscal.taxBaseRatio,
        revenueLoss: fiscal.revenueLoss
      })) created += 1;
    }
    if (corvee.gapRatio > 0.18 || corvee.burdenPressure > 0.25) {
      if (pushHujiTinyi(root, 'corvee', '徭役壅滞·议折银代役与减派', 74, {
        gapRatio: corvee.gapRatio,
        minxinDelta: corvee.minxinDelta
      })) created += 1;
    }
    if (military.shortfall > 0) {
      if (pushHujiTinyi(root, 'military', '兵源不足·议核实军户与募兵补边', 76, {
        requestedRecruits: military.requestedRecruits,
        shortfall: military.shortfall
      })) created += 1;
    }
    if (fiscal.revenueLoss > Math.max(2000, (fiscal.baseTurnIncome || 0) * 0.12)) {
      if (pushHujiTinyi(root, 'fiscal', '税基亏折·议清查隐户与地方上解', 72, {
        collectionMultiplier: fiscal.collectionMultiplier,
        revenueLoss: fiscal.revenueLoss
      })) created += 1;
    }
    return {
      created: created,
      totalPending: tinyiArray(root).filter(function(x) { return x && x.from === 'huji-hard-effects'; }).length,
      source: 'huji-hard-effects'
    };
  }

  function applyHardEffects(root, snapshotLike, options) {
    root = pickRoot(root);
    options = options || {};
    snapshotLike = snapshotLike || {};
    var hukou = snapshotLike.hukou || (root._hujiRuntimeBridge && root._hujiRuntimeBridge.snapshot && root._hujiRuntimeBridge.snapshot.hukou) || {};
    var corvee = snapshotLike.corvee || (root.corvee && root.corvee.ledger) || {};
    var military = snapshotLike.military || (root.military && root.military.servicePool) || {};
    ensureHardEffectStore(root);
    var effects = {
      turn: Number(options.turn) || Number(root.turn) || 0,
      source: options.source || 'huji-hard-effects',
      fiscal: applyFiscalHardEffect(root, hukou, options),
      military: applyMilitaryHardEffect(root, military, options),
      corvee: applyCorveeHardEffect(root, corvee, options)
    };
    effects.tinyi = spawnHardEffectTinyi(root, effects);
    appendHardLedger(root, {
      turn: effects.turn,
      stage: 'pre-fiscal',
      kind: 'fiscal',
      source: effects.source,
      summary: {
        collectionMultiplier: effects.fiscal.collectionMultiplier,
        revenueLoss: effects.fiscal.revenueLoss,
        taxBaseRatio: effects.fiscal.taxBaseRatio
      }
    });
    appendHardLedger(root, {
      turn: effects.turn,
      stage: 'pre-fiscal',
      kind: 'military',
      source: effects.source,
      summary: {
        requestedRecruits: effects.military.requestedRecruits,
        approvedRecruits: effects.military.approvedRecruits,
        shortfall: effects.military.shortfall
      }
    });
    appendHardLedger(root, {
      turn: effects.turn,
      stage: 'pre-fiscal',
      kind: 'corvee',
      source: effects.source,
      summary: {
        gapRatio: effects.corvee.gapRatio,
        minxinDelta: effects.corvee.minxinDelta,
        burdenPressure: effects.corvee.burdenPressure
      }
    });
    appendHardLedger(root, {
      turn: effects.turn,
      stage: 'pre-fiscal',
      kind: 'tinyi',
      source: effects.source,
      summary: {
        created: effects.tinyi.created,
        totalPending: effects.tinyi.totalPending
      }
    });
    effects.ledger = ensureHardEffectStore(root).ledger.slice(-12).map(clone);
    root._hujiHardEffects = Object.assign({}, clone(effects), { ledger: effects.ledger });
    var store = ensureStore(root);
    store.hardEffects = clone(effects);
    return effects;
  }

  function enforceAfterFiscalTick(root, options) {
    root = pickRoot(root);
    options = options || {};
    if(unifiedFiscal(root,options))return {ok:true,skipped:'per-tax-ledger-already-applied',adjustment:0};
    var hard = ensureHardEffectStore(root);
    var fiscal = hard.fiscal || (root.guoku && root.guoku.hujiHardEffects) || (root.fiscal && root.fiscal.hujiHardEffects) || null;
    if (!fiscal || !fiscal.collectionMultiplier) return { ok: false, reason: 'no-fiscal-hard-effect' };
    root.guoku = root.guoku && typeof root.guoku === 'object' ? root.guoku : {};
    root.fiscal = root.fiscal && typeof root.fiscal === 'object' ? root.fiscal : {};
    var g = root.guoku;
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var capTurn = round(fiscal.appliedTurnIncome || fiscal.baseTurnIncome * fiscal.collectionMultiplier || 0);
    var capMonthly = round(fiscal.appliedMonthlyIncome || fiscal.baseMonthlyIncome * fiscal.collectionMultiplier || 0);
    var beforeTurn = round(g.turnIncome || g.monthlyIncome || 0);
    var beforeMonthly = round(g.monthlyIncome || g.turnIncome || 0);
    var nextTurn = capTurn ? Math.min(beforeTurn || capTurn, capTurn) : beforeTurn;
    var nextMonthly = capMonthly ? Math.min(beforeMonthly || capMonthly, capMonthly) : beforeMonthly;
    var collectionMultiplier = clamp(fiscal.collectionMultiplier, 0, 1);
    var adjustment = Math.max(0, beforeTurn - nextTurn);
    if (adjustment > 0 && g._hujiPostFiscalAdjustTurn !== turn) {
      if (g.ledgers && g.ledgers.money) {
        var led = g.ledgers.money;
        led.thisTurnIn = Math.max(0, number(led.thisTurnIn, beforeTurn) - adjustment);
        led.lastTurnIn = Math.max(0, number(led.lastTurnIn, beforeTurn) - adjustment);
        led.stock = number(led.stock, g.balance || 0) - adjustment;
        if (!led.sources) led.sources = {};
        led.sources.hujiTaxbaseLoss = -adjustment;
        g.balance = led.stock;
        g.money = led.stock;
      } else {
        g.balance = number(g.balance, 0) - adjustment;
        g.money = g.balance;
      }
      g._hujiPostFiscalAdjustTurn = turn;
    }
    g.turnIncome = nextTurn;
    g.monthlyIncome = nextMonthly;
    g.actualTaxRate = Math.min(number(g.actualTaxRate, 1) || 1, collectionMultiplier);
    root.fiscal.effectiveRevenue = nextTurn;
    if (g.ledgers && g.ledgers.money) {
      var ledger = g.ledgers.money;
      ledger.thisTurnIn = Math.min(number(ledger.thisTurnIn, nextTurn), nextTurn);
      ledger.lastTurnIn = Math.min(number(ledger.lastTurnIn, nextTurn), nextTurn);
      g.lastDelta = number(ledger.thisTurnIn, nextTurn) - number(ledger.thisTurnOut, g.turnExpense || 0);
    } else {
      g.lastDelta = nextTurn - number(g.turnExpense || g.monthlyExpense, 0);
    }
    var threshold = number(g.annualIncome, nextMonthly * 12) * 0.01;
    g.trend = g.lastDelta > threshold ? 'up' : (g.lastDelta < -threshold ? 'down' : 'stable');
    fiscal.postFiscal = {
      turn: turn,
      beforeTurnIncome: beforeTurn,
      appliedTurnIncome: nextTurn,
      beforeMonthlyIncome: beforeMonthly,
      appliedMonthlyIncome: nextMonthly,
      adjustment: adjustment,
      actualTaxRate: g.actualTaxRate,
      source: options.source || 'huji-post-fiscal'
    };
    fiscal.revenueLoss = Math.max(number(fiscal.revenueLoss, 0), Math.max(0, number(fiscal.baseTurnIncome, beforeTurn) - nextTurn));
    hard.fiscal = clone(fiscal);
    if (hard.source == null) hard.source = options.source || 'huji-post-fiscal';
    hard.turn = turn;
    root.guoku.hujiHardEffects = clone(fiscal);
    root.fiscal.hujiHardEffects = clone(fiscal);
    appendHardLedger(root, {
      turn: turn,
      stage: 'post-fiscal',
      kind: 'fiscal',
      source: options.source || 'huji-post-fiscal',
      summary: {
        beforeTurnIncome: beforeTurn,
        appliedTurnIncome: nextTurn,
        adjustment: adjustment,
        actualTaxRate: g.actualTaxRate,
        collectionMultiplier: collectionMultiplier
      }
    });
    hard.ledger = ensureHardEffectStore(root).ledger.slice(-80);
    var store = ensureStore(root);
    store.hardEffects = clone(hard);
    if (store.snapshot) store.snapshot.hardEffects = clone(hard);
    return { ok: true, hardEffects: clone(hard), fiscal: clone(fiscal) };
  }

  function classImpactsForTags(tags) {
    var out = [];
    if (tags.indexOf('hukou') >= 0) {
      out.push({ name: '编户齐民', deltaSatisfaction: -0.5, deltaPressure: 1.0, reason: 'hukou registration pressure' });
      out.push({ name: '流民', deltaSatisfaction: 0.8, deltaPressure: -0.6, reason: 'resettlement or census attention' });
    }
    if (tags.indexOf('corvee') >= 0) {
      out.push({ name: '农户', deltaSatisfaction: -1.2, deltaPressure: 1.4, reason: 'corvee burden' });
      out.push({ name: '匠役', deltaSatisfaction: -0.8, deltaPressure: 1.0, reason: 'labor mobilization' });
    }
    if (tags.indexOf('military') >= 0) {
      out.push({ name: '军户', deltaSatisfaction: -0.8, deltaPressure: 1.0, reason: 'service pool pressure' });
      out.push({ name: '边军', deltaSatisfaction: 0.4, deltaPressure: -0.2, reason: 'border defense support' });
    }
    return out;
  }

  function classifyPlayerOperation(raw) {
    raw = raw || {};
    var text = [
      raw.channel,
      raw.kind,
      raw.action,
      raw.topic,
      raw.title,
      raw.linkedIssue,
      raw.issueId,
      raw.text,
      raw.content,
      raw.targetText
    ].map(textOf).join(' ');
    var lower = text.toLowerCase();
    var tags = [];
    function add(tag, re) {
      if (re.test(lower) && tags.indexOf(tag) < 0) tags.push(tag);
    }
    add('hukou', /hukou|census|household|population|registry|register|yellow\s*book|hidden|fugitive|refugee|户口|户籍|黄册|白册|隐户|逃户|流民|保甲|里甲|编户|清查|招抚|鎴峰彛|鎴风睄|闅愭埛|閫冩埛|娴佹皯|淇濈敳|閲岀敳|缂栨埛|娓呮煡|鎷涙姎|鎷涙姎娴佹皯|榛勫唽|粍鍐/);
    add('corvee', /corvee|labor|labour|service|commutation|silver|tax\s*labor|徭役|役法|一条鞭|摊丁|折银|工役|河工|营建|大工|开河|修宫|涓€鏉|鎶橀摱|寰焦|宸ュ焦|娌冲伐|钀ュ缓/);
    add('military', /military|army|soldier|draft|recruit|garrison|border|service\s*pool|军户|卫所|募兵|征兵|核实兵额|守边|边防|兵|军|鍐涙埛|鍗墍|鍕熷叺|寰佸叺|瀹堣竟|杈归槻|鍐?/);
    var actionTypes = [];
    if (/edict|decree|诏|诏令/.test(lower)) actionTypes.push('edict');
    if (/memorial|petition|奏|疏|批复/.test(lower)) actionTypes.push('memorial');
    if (/court|debate|廷议|朝议|议/.test(lower)) actionTypes.push('court');
    if (/letter|鸿雁|传书/.test(lower)) actionTypes.push('letter');
    if (!actionTypes.length && raw.channel) actionTypes.push(String(raw.channel));
    return {
      text: compact(textOf(raw) || text, 260),
      tags: unique(tags),
      actionTypes: unique(actionTypes),
      linkedIssue: raw.linkedIssue || raw.issueId || raw.chaoyiTrackId || '',
      confidence: tags.length ? 0.78 : 0
    };
  }

  function recordPlayerOperation(root, raw, options) {
    root = pickRoot(root);
    raw = raw || {};
    options = options || {};
    var classified = classifyPlayerOperation(raw);
    if (!classified.tags.length) return { ok: false, reason: 'not-huji-related', operation: null };
    var store = ensureStore(root);
    store.seq = (Number(store.seq) || 0) + 1;
    store.stats.operations = (Number(store.stats.operations) || 0) + 1;
    var operation = {
      id: 'huji-op-' + (Number(options.turn) || Number(root.turn) || 0) + '-' + store.seq,
      turn: Number(options.turn) || Number(root.turn) || 0,
      seq: store.seq,
      source: options.source || raw.source || raw.channel || 'player-operation',
      channel: raw.channel || raw.kind || '',
      text: classified.text,
      tags: classified.tags,
      actionTypes: classified.actionTypes,
      linkedIssue: classified.linkedIssue,
      sourceActionId: raw.id || raw.seq || raw.actionId || '',
      confidence: classified.confidence,
      reason: raw.reason || classified.text
    };
    var exists = store.operations.some(function(op) {
      return op && op.sourceActionId && operation.sourceActionId && op.sourceActionId === operation.sourceActionId;
    }) || store.operations.some(function(op) {
      return op && op.text === operation.text && op.turn === operation.turn && op.source === operation.source;
    });
    if (!exists) {
      store.operations.push(operation);
      if (store.operations.length > MAX_OPERATIONS) store.operations = store.operations.slice(-MAX_OPERATIONS);
      root.huji_actions = Array.isArray(root.huji_actions) ? root.huji_actions : [];
      root.huji_actions.push(clone(operation));
      if (root.huji_actions.length > MAX_OPERATIONS) root.huji_actions = root.huji_actions.slice(-MAX_OPERATIONS);
      if (TM.SocialPoliticalSignals && typeof TM.SocialPoliticalSignals.record === 'function') {
        try {
          TM.SocialPoliticalSignals.record(root, {
            sourceSystem: 'huji-runtime-bridge',
            kind: 'player-huji-operation',
            tags: classified.tags,
            affectedClasses: classImpactsForTags(classified.tags),
            affectedParties: [],
            intensity: Math.min(0.9, 0.35 + classified.tags.length * 0.15),
            confidence: classified.confidence,
            reason: operation.text,
            linkedIssue: operation.linkedIssue
          });
        } catch (_) {}
      }
    }
    return { ok: true, operation: clone(operation), duplicate: exists };
  }

  function scanPlayerSignals(root, store, options) {
    var playerStore = root._playerActionSignals || {};
    var items = Array.isArray(playerStore.items) ? playerStore.items : [];
    var lastSeq = Number(store.lastPlayerActionSeq) || 0;
    var maxSeq = lastSeq;
    items.forEach(function(signal) {
      var seq = Number(signal && signal.seq) || 0;
      if (seq <= lastSeq) return;
      if (seq > maxSeq) maxSeq = seq;
      recordPlayerOperation(root, {
        id: 'player-signal-' + seq,
        seq: seq,
        source: signal.source || 'player-action-signal',
        channel: signal.kind || signal.action || '',
        text: signal.text || signal.content || '',
        topic: signal.topic || '',
        linkedIssue: signal.linkedIssue || signal.issueId || ''
      }, {
        turn: Number(options && options.turn) || Number(signal.turn) || Number(root.turn) || 0,
        source: 'player-action-signal-scan'
      });
    });
    store.lastPlayerActionSeq = maxSeq;
  }

  function maintain(root, options) {
    root = pickRoot(root);
    options = options || {};
    var isSecondPass = /after-hard-links|second/i.test(String(options.source || ''));
    var spanName = isSecondPass ? 'huji.maintain.second' : 'huji.maintain.first';
    return perfSpan(spanName, function() {
      var store = ensureStore(root);
      var config = getPopulationConfig(root, options);
      var leaves = getLeafRegions(root);
      perfCount('huji.fullMaintainCount', 1);
      perfCount('huji.leafVisits', leaves.length);
      if (options.incrementalRequested === true) {
        perfCount('huji.incrementalMaintainCount', 0);
      }
      var aggregate = aggregatePopulation(root, config, leaves, {
        authoritativePlayerPopulation:hasAuthoritativePlayerPopulation(root)
      });
      var hukouLedger = syncHukou(root, aggregate, options);
      var corveeLedger = buildCorveeLedger(root, config, aggregate, options);
      var militaryServicePool = buildMilitaryPool(root, config, aggregate, options);
      if (options.includePlayerSignals) scanPlayerSignals(root, store, options);
      var hardEffects = null;
      if (options.applyHardEffects !== false) {
        hardEffects = applyHardEffects(root, {
          hukou: hukouLedger,
          corvee: corveeLedger,
          military: militaryServicePool
        }, options);
      }
      var snap = {
        turn: Number(options.turn) || Number(root.turn) || 0,
        source: options.source || 'huji-runtime-bridge',
        hukou: hukouLedger,
        corvee: {
          summary: clone(corveeLedger.summary),
          byRegion: clone(corveeLedger.byRegion)
        },
        military: clone(militaryServicePool),
        hardEffects: clone(hardEffects || store.hardEffects || root._hujiHardEffects || null),
        operations: store.operations.slice(-8).map(clone),
        stats: clone(store.stats)
      };
      store.turn = snap.turn;
      store.snapshot = snap;
      store.stats.maintained = (Number(store.stats.maintained) || 0) + 1;
      root._hujiRuntimeBridgeSnapshot = snap;
      var regionRevisions = {};
      leaves.forEach(function(leaf, index) {
        var id = String(leaf && (leaf.id || leaf.regionId || leaf.name) || ('leaf-' + index));
        var detail = leaf && (leaf.populationDetail || leaf.population) || {};
        regionRevisions[id] = safeRevision(detail._revision || leaf._populationRevision);
      });
      return {
        ok: true,
        sourceRevision: safeRevision(root._hujiSourceRevision),
        populationRevision: safeRevision(root._populationRevision),
        regionRevisions: regionRevisions,
        dirtyDomains: options.dirtyDomains || null,
        aggregate: aggregate,
        snapshot: clone(snap),
        incrementalFallbackReason: options.incrementalRequested === true
          ? 'full-maintain-required-for-cross-ledger-invariants'
          : ''
      };
    }, { source: options.source || 'huji-runtime-bridge' });
  }

  function snapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    var store = ensureStore(root);
    if (!store.snapshot) maintain(root, options);
    var snap = clone(store.snapshot || {});
    var limit = Math.max(1, Math.min(40, Number(options.limit || 8) || 8));
    snap.operations = store.operations.slice(-limit).map(clone);
    return snap;
  }

  function maintainAfterHardLinks(root, firstPass, consumerResult, options) {
    root = pickRoot(root);
    options = options || {};
    var dirty = consumerResult && consumerResult.dirtyDomains;
    var needsSecondPass = !dirty || !!(
      dirty.populationChanged ||
      dirty.hukouChanged ||
      dirty.corveeChanged ||
      dirty.militaryPoolChanged ||
      dirty.fiscalHardEffectChanged ||
      dirty.globalPopulationChanged ||
      (Array.isArray(dirty.dirtyRegionIds) && dirty.dirtyRegionIds.length)
    );
    if (!needsSecondPass) {
      perfCount('huji.secondPassSkipped', 1);
      root._hujiSecondPassDecision = {
        turn: Number(options.turn) || Number(root.turn) || 0,
        skipped: true,
        reason: 'no-huji-dirty-domain',
        sourceRevision: firstPass && firstPass.sourceRevision,
        populationRevision: firstPass && firstPass.populationRevision
      };
      return { ok: true, skipped: true, reason: 'no-huji-dirty-domain', dirtyDomains: dirty };
    }
    return maintain(root, {
      source: options.source || 'pre-submit-huji-runtime-bridge-after-hard-links',
      turn: options.turn != null ? options.turn : root.turn,
      dirtyDomains: dirty || null,
      incrementalRequested: !!(dirty && Array.isArray(dirty.dirtyRegionIds) && dirty.dirtyRegionIds.length && !dirty.globalPopulationChanged)
    });
  }

  function formatForPrompt(root, options) {
    root = pickRoot(root);
    options = options || {};
    var snap = snapshot(root, options);
    if (!snap || !snap.hukou) return '';
    var limit = Math.max(1, Math.min(20, Number(options.limit || 8) || 8));
    var h = snap.hukou || {};
    var c = snap.corvee && snap.corvee.summary || {};
    var m = snap.military || {};
    var he = snap.hardEffects || {};
    var hf = he.fiscal || {};
    var hm = he.military || {};
    var hc = he.corvee || {};
    var ht = he.tinyi || {};
    var hl = toArray(he.ledger).slice(-6);
    var lines = [];
    lines.push('\n\n=== Huji Runtime Bridge ===');
    lines.push('Use this as current hukou/corvee/military runtime truth. It is reconciled from scenario data, admin leaf population, player operations, and minxin hard links.');
    lines.push('hukouLedger: registeredHouseholds=' + (h.registeredHouseholds || 0)
      + ' registeredMouths=' + (h.registeredMouths || 0)
      + ' registeredDing=' + (h.registeredDing || 0)
      + ' hidden=' + (h.hiddenCount || 0)
      + ' fugitives=' + (h.fugitives || 0)
      + ' effectiveTaxHouseholds=' + (h.effectiveTaxHouseholds || 0)
      + ' taxBaseRatio=' + (h.taxBaseRatio || 0));
    lines.push('corveeLedger: demandDays=' + (c.totalDemandDays || 0)
      + ' fulfilledDays=' + (c.fulfilledDays || 0)
      + ' gapDays=' + (c.gapDays || 0)
      + ' burden=' + (c.burden || 0)
      + ' commutationRate=' + (c.commutationRate || 0));
    lines.push('militaryServicePool: activeSoldiers=' + (m.activeSoldiers || 0)
      + ' eligibleDing=' + (m.eligibleDing || 0)
      + ' availableRecruits=' + (m.availableRecruits || 0)
      + ' requestedRecruits=' + (m.requestedRecruits || 0)
      + ' shortfall=' + (m.shortfall || 0)
      + ' recruitmentEfficiency=' + (m.avgRecruitmentEfficiency || 0));
    if (he && (he.fiscal || he.military || he.corvee)) {
      lines.push('hujiHardEffects:');
      lines.push('fiscalHardEffect: collectionMultiplier=' + (hf.collectionMultiplier || 0)
        + ' revenueLoss=' + (hf.revenueLoss || 0)
        + ' taxBaseRatio=' + (hf.taxBaseRatio || 0));
      lines.push('militaryHardEffect: approved=' + (hm.approvedRecruits || 0)
        + ' requested=' + (hm.requestedRecruits || 0)
        + ' shortfall=' + (hm.shortfall || 0)
        + ' moralePenalty=' + (hm.moralePenalty || 0));
      lines.push('corveeHardEffect: gapRatio=' + (hc.gapRatio || 0)
        + ' burdenPressure=' + (hc.burdenPressure || 0)
        + ' minxinDelta=' + (hc.minxinDelta || 0));
      lines.push('tinyiHardEffect: created=' + (ht.created || 0) + ' totalPending=' + (ht.totalPending || 0));
      if (hl.length) {
        lines.push('hujiHardEffectLedger:');
        hl.forEach(function(entry) {
          var summary = entry.summary || {};
          lines.push('- T' + (entry.turn || '') + ' [' + (entry.stage || '') + '/' + (entry.kind || '') + '] '
            + 'loss=' + (summary.revenueLoss != null ? summary.revenueLoss : '')
            + ' shortfall=' + (summary.shortfall != null ? summary.shortfall : '')
            + ' minxinDelta=' + (summary.minxinDelta != null ? summary.minxinDelta : '')
            + ' adjustment=' + (summary.adjustment != null ? summary.adjustment : ''));
        });
      }
    }
    if (snap.operations && snap.operations.length) {
      lines.push('playerHujiOperations:');
      snap.operations.slice(-limit).forEach(function(op) {
        lines.push('- T' + (op.turn || '') + '#' + (op.seq || '') + ' [' + (op.tags || []).join('/') + '] ' + compact(op.text, 150)
          + (op.linkedIssue ? ' issue=' + op.linkedIssue : ''));
      });
    } else {
      lines.push('playerHujiOperations: none');
    }
    return lines.join('\n');
  }

  function diagnosticsText(root, options) {
    return formatForPrompt(root, options);
  }

  TM.HujiRuntimeBridge = {
    maintain: maintain,
    maintainAfterHardLinks: maintainAfterHardLinks,
    applyHardEffects: applyHardEffects,
    enforceAfterFiscalTick: enforceAfterFiscalTick,
    recordPlayerOperation: recordPlayerOperation,
    classifyPlayerOperation: classifyPlayerOperation,
    snapshot: snapshot,
    formatForPrompt: formatForPrompt,
    diagnosticsText: diagnosticsText,
    VERSION: 1
  };

  global.HujiRuntimeBridge = TM.HujiRuntimeBridge;
  if (typeof module !== 'undefined' && module && module.exports) module.exports = TM.HujiRuntimeBridge;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
