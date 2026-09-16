// @ts-check
/*
 * tm-minxin-hard-link-consumers.js
 * Adapts minxin hard-link outputs into turn-facing fiscal, military, hukou,
 * and execution fields. This layer is idempotent per call; it constrains
 * forecasts and quotas without directly minting treasury balance.
 */
(function(global) {
  'use strict';

  var TM = global.TM = global.TM || {};
  var MAX_EVENTS = 120;

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

  function toArray(v) {
    if (v === undefined || v === null || v === '') return [];
    return Array.isArray(v) ? v.slice() : [v];
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

  function compact(v, maxLen) {
    var text = String(v == null ? '' : v).replace(/\s+/g, ' ').trim();
    maxLen = Number(maxLen) || 160;
    return text.length > maxLen ? text.slice(0, maxLen) : text;
  }

  function ensureObject(parent, key) {
    if (!parent[key] || typeof parent[key] !== 'object' || Array.isArray(parent[key])) parent[key] = {};
    return parent[key];
  }

  function ensureStore(root) {
    root = pickRoot(root);
    if (!root._minxinHardLinkConsumers || typeof root._minxinHardLinkConsumers !== 'object' || Array.isArray(root._minxinHardLinkConsumers)) {
      root._minxinHardLinkConsumers = {
        turn: Number(root.turn) || 0,
        summary: null,
        events: [],
        stats: { consumes: 0, fiscalCaps: 0, recruitmentCaps: 0, hukouCaps: 0, executionCaps: 0 }
      };
    }
    var store = root._minxinHardLinkConsumers;
    if (!Array.isArray(store.events)) store.events = [];
    if (!store.stats) store.stats = { consumes: 0, fiscalCaps: 0, recruitmentCaps: 0, hukouCaps: 0, executionCaps: 0 };
    return store;
  }

  function getHardLinkSnapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    if ((!root._minxinHardLinks || !root._minxinHardLinks.summary) && TM.MinxinHardLinks && typeof TM.MinxinHardLinks.tick === 'function') {
      try { TM.MinxinHardLinks.tick(root, { turn: options.turn != null ? options.turn : root.turn, source: options.source || 'minxin-hard-link-consumer-autotick' }); } catch (_) {}
    }
    var store = root._minxinHardLinks || {};
    var summary = store.summary || {
      fiscal: root.fiscal && root.fiscal.minxinHardLinks || {},
      military: root.military && root.military.minxinHardLinks || {},
      hukou: root.hukou && root.hukou.minxinHardLinks || {},
      localExecution: root.localExecution && root.localExecution.minxinHardLinks || {}
    };
    return {
      summary: summary,
      regionImpacts: toArray(store.regionImpacts)
    };
  }

  function numFirst(list, fallback) {
    for (var i = 0; i < list.length; i += 1) {
      var n = Number(list[i]);
      if (isFinite(n)) return n;
    }
    return fallback;
  }

  function consumeFiscal(root, snapshot, turn) {
    if(global.CascadeTax&&global.CascadeTax.isUnified&&global.CascadeTax.isUnified(root,'player')){
      var statement=global.FiscalEngine.readAccountStatement({game:root,account:root.guoku,scope:'central'}),a=statement.account;
      var canonical={turn:turn,plannedIncome:statement.budget.totals.central.money,actualIncome:a.turnIncome,remittedIncome:a.turnIncome,flowBasis:a.flowBasis,period:clone(a.accounting),source:'canonical-fiscal-ledger'};
      root.guoku.minxinConsumer=canonical;root.fiscal=root.fiscal||{};root.fiscal.minxinConsumer=clone(canonical);return clone(canonical);
    }
    root.guoku = root.guoku && typeof root.guoku === 'object' ? root.guoku : {};
    root.fiscal = root.fiscal && typeof root.fiscal === 'object' ? root.fiscal : {};
    var hard = snapshot.summary && snapshot.summary.fiscal || {};
    var planned = numFirst([
      root.guoku._preMinxinTurnIncome,
      root.guoku.plannedTurnIncome,
      root.guoku.plannedMonthlyIncome,
      root.guoku.turnIncome,
      root.guoku.monthlyIncome,
      root.fiscal.expectedRevenue,
      hard.claimedRevenue
    ], 0);
    var actual = numFirst([hard.remittedToCenter, hard.actualRevenue], planned);
    if (!actual && planned) actual = planned;
    actual = Math.max(0, Math.round(actual));
    planned = Math.max(actual, Math.round(planned || actual));
    var loss = Math.max(0, planned - actual);
    root.guoku._preMinxinTurnIncome = planned;
    root.guoku.turnIncome = actual;
    root.guoku.monthlyIncome = actual;
    root.guoku.minxinConsumer = {
      turn: turn,
      plannedIncome: planned,
      actualIncome: actual,
      remittedIncome: actual,
      revenueLoss: loss,
      collectionMultiplier: round2(hard.collectionMultiplier || (planned ? actual / planned : 1)),
      source: 'minxin-hard-link-consumer'
    };
    root.fiscal.effectiveRevenue = actual;
    root.fiscal.minxinConsumer = clone(root.guoku.minxinConsumer);
    return clone(root.guoku.minxinConsumer);
  }

  function consumeMilitary(root, snapshot, turn) {
    root.military = root.military && typeof root.military === 'object' ? root.military : {};
    var hard = snapshot.summary && snapshot.summary.military || {};
    var available = Math.max(0, Math.round(numFirst([hard.availableRecruits, root.military.availableRecruits], 0)));
    var shortTerm = Math.max(0, Math.round(numFirst([hard.shortTermRecruits, root.military.minxinHardLinks && root.military.minxinHardLinks.shortTermRecruits], 0)));
    var requested = Math.max(0, Math.round(numFirst([
      root.military.pendingRecruitment,
      root.military.draftQuota,
      root.military.recruitmentQuota,
      root.pendingRecruitment
    ], 0)));
    var capacity = available + shortTerm;
    var approved = requested ? Math.min(requested, capacity) : capacity;
    var shortfall = Math.max(0, requested - approved);
    root.military.availableRecruits = available;
    root.military.recruitmentCapacity = capacity;
    root.military.approvedRecruitment = approved;
    root.military.recruitmentShortfall = shortfall;
    root.military.minxinConsumer = {
      turn: turn,
      requestedRecruits: requested,
      availableRecruits: available,
      shortTermRecruits: shortTerm,
      capacity: capacity,
      approvedRecruits: approved,
      shortfall: shortfall,
      avgRecruitmentEfficiency: round2(hard.avgRecruitmentEfficiency || 0),
      avgDraftResistance: round2(hard.avgDraftResistance || 0),
      source: 'minxin-hard-link-consumer'
    };
    return clone(root.military.minxinConsumer);
  }

  function aggregatePopulation(snapshot) {
    var out = { households: 0, mouths: 0, ding: 0, hiddenHouseholds: 0, refugees: 0 };
    toArray(snapshot.regionImpacts).forEach(function(row) {
      var hukou = row && row.hukou || {};
      out.hiddenHouseholds += Number(hukou.hiddenHouseholds) || 0;
      out.refugees += Number(hukou.fugitives) || 0;
    });
    return out;
  }

  function consumeHukou(root, snapshot, turn) {
    if (global.HujiEngine && global.HujiEngine.isPopulationLedgerV2 && global.HujiEngine.isPopulationLedgerV2(root)) {
      var view = global.HujiEngine.getPopulationView({root:root});
      root.hukou = root.hukou || {};
      Object.assign(root.hukou,{
        registeredHouseholds:view.registeredHouseholds,registeredMouths:view.registeredMouths,
        registeredDing:view.registeredDing,registeredTotal:view.registeredMouths,
        actualMouths:view.actualMouths,taxableMouths:view.taxableMouths,taxableHouseholds:view.taxableHouseholds,
        effectiveTaxHouseholds:view.taxableHouseholds,
        taxBaseRatio:view.registeredHouseholds ? view.taxableHouseholds/view.registeredHouseholds : 0
      });
      root.hukou.minxinConsumer = {
        turn:turn, registeredHouseholds:view.registeredHouseholds, registeredMouths:view.registeredMouths,
        hiddenHouseholds:root.hukou.hiddenHouseholds || 0, refugees:view.fugitives,
        effectiveTaxHouseholds:view.taxableHouseholds,
        taxBaseRatio:view.registeredHouseholds ? view.taxableHouseholds/view.registeredHouseholds : 0,
        source:'minxin-hard-link-consumer'
      };
      return clone(root.hukou.minxinConsumer);
    }
    root.hukou = root.hukou && typeof root.hukou === 'object' ? root.hukou : {};
    root.population = root.population && typeof root.population === 'object' ? root.population : {};
    var hard = snapshot.summary && snapshot.summary.hukou || {};
    var aggregate = aggregatePopulation(snapshot);
    var hidden = Math.max(0, Math.round(numFirst([hard.hiddenHouseholds, aggregate.hiddenHouseholds, root.hukou.estimatedHidden], 0)));
    var refugees = Math.max(0, Math.round(numFirst([hard.refugees, aggregate.refugees, root.hukou.refugees], 0)));
    var registeredHouseholds = Math.max(0, Math.round(numFirst([root.hukou.registeredHouseholds, root.population.national && root.population.national.households], 0)));
    if (!registeredHouseholds) {
      registeredHouseholds = toArray(snapshot.regionImpacts).reduce(function(sum, row) {
        var h = row && row.hukou;
        return sum + Math.max(0, Number(h && h.hiddenHouseholds) || 0);
      }, 0);
    }
    var registeredMouths = Math.max(0, Math.round(numFirst([root.hukou.mouths, root.hukou.registeredMouths, root.population.national && root.population.national.mouths], 0)));
    var effectiveTaxHouseholds = Math.max(0, registeredHouseholds - hidden);
    var taxBaseRatio = registeredHouseholds ? clamp(effectiveTaxHouseholds / registeredHouseholds, 0, 1) : 1;
    root.hukou.registeredHouseholds = registeredHouseholds;
    root.hukou.estimatedHidden = hidden;
    root.hukou.refugees = refugees;
    root.hukou.effectiveTaxHouseholds = effectiveTaxHouseholds;
    root.hukou.taxBaseRatio = round2(taxBaseRatio);
    root.population.national = root.population.national && typeof root.population.national === 'object' ? root.population.national : {};
    root.population.national.households = registeredHouseholds;
    root.population.national.mouths = registeredMouths;
    root.population.national.hiddenCount = hidden;
    root.population.national.fugitives = refugees;
    root.population.national.effectiveTaxHouseholds = effectiveTaxHouseholds;
    root.hukou.minxinConsumer = {
      turn: turn,
      registeredHouseholds: registeredHouseholds,
      registeredMouths: registeredMouths,
      hiddenHouseholds: hidden,
      refugees: refugees,
      effectiveTaxHouseholds: effectiveTaxHouseholds,
      taxBaseRatio: round2(taxBaseRatio),
      source: 'minxin-hard-link-consumer'
    };
    return clone(root.hukou.minxinConsumer);
  }

  function consumeExecution(root, snapshot, turn) {
    root.localExecution = root.localExecution && typeof root.localExecution === 'object' ? root.localExecution : {};
    root.huangquan = root.huangquan && typeof root.huangquan === 'object' ? root.huangquan : {};
    var hard = snapshot.summary && snapshot.summary.localExecution || {};
    var cap = clamp(numFirst([hard.avgExecutionRate], 1), 0.03, 1);
    var base = clamp(numFirst([root.huangquan._preMinxinExecutionRate, root.huangquan.executionRate], 1), 0, 1);
    var effective = round2(Math.min(base, cap));
    root.huangquan._preMinxinExecutionRate = base;
    root.huangquan.executionRate = effective;
    root.huangquan.minxinLocalExecutionCap = round2(cap);
    var queues = []
      .concat(toArray(root.policyQueue))
      .concat(toArray(root._pendingPolicies))
      .concat(toArray(root.edictsQueue));
    queues.forEach(function(item) {
      if (!item || typeof item !== 'object') return;
      item.minxinExecutionCap = effective;
      var itemBase = clamp(numFirst([item._preMinxinExecutionRate, item.executionRate, item.efficacy], base), 0, 1);
      item._preMinxinExecutionRate = itemBase;
      item.effectiveExecutionRate = round2(Math.min(itemBase, effective));
    });
    root.localExecution.minxinConsumer = {
      turn: turn,
      baseExecutionRate: round2(base),
      hardLinkCap: round2(cap),
      effectiveExecutionRate: effective,
      affectedPolicies: queues.filter(function(x) { return x && typeof x === 'object'; }).length,
      source: 'minxin-hard-link-consumer'
    };
    return clone(root.localExecution.minxinConsumer);
  }

  function pushEvent(store, type, payload, turn) {
    var event = {
      id: 'mxconsumer-' + turn + '-' + (store.events.length + 1),
      turn: turn,
      type: type,
      payload: clone(payload)
    };
    store.events.push(event);
    if (store.events.length > MAX_EVENTS) store.events = store.events.slice(-MAX_EVENTS);
    return event;
  }

  function recordSignal(root, summary) {
    if (!TM.SocialPoliticalSignals || typeof TM.SocialPoliticalSignals.record !== 'function') return null;
    var loss = summary && summary.fiscal && summary.fiscal.revenueLoss || 0;
    var shortfall = summary && summary.military && summary.military.shortfall || 0;
    var hidden = summary && summary.hukou && summary.hukou.hiddenHouseholds || 0;
    var exec = summary && summary.execution && summary.execution.effectiveExecutionRate || 1;
    if (!(loss > 0 || shortfall > 0 || hidden > 0 || exec < 0.8)) return null;
    return TM.SocialPoliticalSignals.record(root, {
      sourceSystem: 'minxin-hard-link-consumer',
      kind: 'turn-constraint',
      tags: ['minxin', 'fiscal', 'draft', 'hukou', 'execution'],
      intensity: clamp((loss / 20000) + (shortfall / 5000) + (hidden / 10000) + (1 - exec) * 0.4, 0.1, 1),
      confidence: 0.86,
      reason: 'minxin hard links constrained turn-facing fiscal, recruitment, hukou, and execution fields'
    });
  }

  function dirtyScalarState(root) {
    var national = root && root.population && root.population.national || {};
    var hukou = root && root.hukou || {};
    var military = root && root.military || {};
    var guoku = root && root.guoku || {};
    var fiscal = root && root.fiscal || {};
    return {
      population: [national.mouths, national.households, national.ding, national.hiddenCount, national.fugitives, national.effectiveTaxHouseholds],
      hukou: [hukou.registeredHouseholds, hukou.mouths, hukou.registeredMouths, hukou.estimatedHidden, hukou.refugees, hukou.effectiveTaxHouseholds, hukou.taxBaseRatio],
      military: [military.availableRecruits, military.recruitmentCapacity, military.approvedRecruitment, military.recruitmentShortfall],
      fiscal: [guoku.turnIncome, guoku.monthlyIncome, fiscal.effectiveRevenue]
    };
  }

  function scalarListChanged(before, after) {
    if (!before || !after || before.length !== after.length) return true;
    for (var i = 0; i < before.length; i++) {
      if (before[i] !== after[i]) return true;
    }
    return false;
  }

  function consume(root, options) {
    root = pickRoot(root);
    options = options || {};
    var beforeDirtyState = dirtyScalarState(root);
    var turn = Number(options.turn != null ? options.turn : root.turn) || 0;
    var store = ensureStore(root);
    var snapshot = getHardLinkSnapshot(root, options);
    var fiscal = consumeFiscal(root, snapshot, turn);
    var military = consumeMilitary(root, snapshot, turn);
    var hukou = consumeHukou(root, snapshot, turn);
    var execution = consumeExecution(root, snapshot, turn);
    var summary = { fiscal: fiscal, military: military, hukou: hukou, execution: execution };
    store.turn = turn;
    store.summary = summary;
    store.stats.consumes = (Number(store.stats.consumes) || 0) + 1;
    if (fiscal.revenueLoss > 0) store.stats.fiscalCaps = (Number(store.stats.fiscalCaps) || 0) + 1;
    if (military.shortfall > 0) store.stats.recruitmentCaps = (Number(store.stats.recruitmentCaps) || 0) + 1;
    if (hukou.hiddenHouseholds > 0) store.stats.hukouCaps = (Number(store.stats.hukouCaps) || 0) + 1;
    if (execution.effectiveExecutionRate < execution.baseExecutionRate) store.stats.executionCaps = (Number(store.stats.executionCaps) || 0) + 1;
    pushEvent(store, 'fiscalConsumer', fiscal, turn);
    pushEvent(store, 'recruitmentConsumer', military, turn);
    pushEvent(store, 'hukouConsumer', hukou, turn);
    pushEvent(store, 'executionConsumer', execution, turn);
    recordSignal(root, summary);
    var afterDirtyState = dirtyScalarState(root);
    var dirtyDomains = {
      populationChanged: scalarListChanged(beforeDirtyState.population, afterDirtyState.population),
      hukouChanged: scalarListChanged(beforeDirtyState.hukou, afterDirtyState.hukou),
      corveeChanged: false,
      militaryPoolChanged: scalarListChanged(beforeDirtyState.military, afterDirtyState.military),
      fiscalHardEffectChanged: scalarListChanged(beforeDirtyState.fiscal, afterDirtyState.fiscal),
      dirtyRegionIds: [],
      globalPopulationChanged: scalarListChanged(beforeDirtyState.population, afterDirtyState.population)
    };
    return {
      ok: true,
      summary: clone(summary),
      events: store.events.slice(-4).map(clone),
      dirtyDomains: dirtyDomains
    };
  }

  function snapshot(root, options) {
    root = pickRoot(root);
    options = options || {};
    var limit = Math.max(1, Number(options.limit) || 8);
    var store = ensureStore(root);
    return {
      turn: store.turn || Number(root.turn) || 0,
      summary: clone(store.summary || {}),
      events: store.events.slice(-limit).reverse().map(clone),
      stats: clone(store.stats || {})
    };
  }

  function formatForPrompt(root, options) {
    root = pickRoot(root);
    options = options || {};
    var snap = snapshot(root, options);
    var summary = snap.summary || {};
    var fiscal = summary.fiscal || {};
    var military = summary.military || {};
    var hukou = summary.hukou || {};
    var execution = summary.execution || {};
    var lines = [
      '=== Minxin Hard Link Consumers ===',
      'fiscalConsumer: planned=' + (fiscal.plannedIncome || 0) + ' actual=' + (fiscal.actualIncome || 0) + ' loss=' + (fiscal.revenueLoss || 0) + ' collection=' + (fiscal.collectionMultiplier || 0),
      'recruitmentConsumer: requested=' + (military.requestedRecruits || 0) + ' approved=' + (military.approvedRecruits || 0) + ' shortfall=' + (military.shortfall || 0) + ' resistance=' + (military.avgDraftResistance || 0),
      'hukouConsumer: registeredHouseholds=' + (hukou.registeredHouseholds || 0) + ' effectiveTaxHouseholds=' + (hukou.effectiveTaxHouseholds || 0) + ' hidden=' + (hukou.hiddenHouseholds || 0) + ' refugees=' + (hukou.refugees || 0),
      'executionConsumer: base=' + (execution.baseExecutionRate || 0) + ' cap=' + (execution.hardLinkCap || 0) + ' effective=' + (execution.effectiveExecutionRate || 0) + ' policies=' + (execution.affectedPolicies || 0)
    ];
    snap.events.slice(0, Math.max(0, Math.min(6, Number(options.limit) || 6))).forEach(function(e) {
      lines.push('- ' + e.type + ' T' + e.turn + ' ' + compact(JSON.stringify(e.payload || {}), 220));
    });
    return lines.join('\n');
  }

  function diagnosticsText(root, options) {
    return formatForPrompt(root, options);
  }

  TM.MinxinHardLinkConsumers = {
    consume: consume,
    snapshot: snapshot,
    formatForPrompt: formatForPrompt,
    diagnosticsText: diagnosticsText,
    _ensureStore: ensureStore
  };

  global.MinxinHardLinkConsumers = TM.MinxinHardLinkConsumers;
  if (typeof module !== 'undefined' && module.exports) module.exports = TM.MinxinHardLinkConsumers;
})(typeof window !== 'undefined' ? window : (typeof globalThis !== 'undefined' ? globalThis : this));
