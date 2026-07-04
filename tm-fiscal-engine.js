// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-fiscal-engine.js — 财政引擎 (CascadeTax + FixedExpense + FiscalEngine)
// Domain: 财政 (税收级联 + 固定支出 + 19 原子税种 + 14 项地方支出 + 调拨 + 区域 fiscal cascade + PhaseH 防御 shim)
// Status: active · Last Updated: 2026-05-04 (Phase 3 R10 redistribute + R10 fiscal compat·R11d head note 还原 by Claude)
// Owner: TM 团队
// Imports: GM (global)·findScenarioById·_adjAuthority·EventBus·addEB·TM.errors
// Exports:
//   - global.CascadeTax (VERSION 2)·collect / tick / sumEconomyBase / getDivEconomy / getTopContributors / triggerSurvey / _ensureEconomyBase / _settleLandFlow / DEFAULT_TAXES / DEFAULT_ALLOCATION
//   - global.FixedExpense (VERSION 2)·collect / tick / preview / DEFAULT_RANK_SALARY / DEFAULT_ARMY_PAY / DEFAULT_IMPERIAL_MONTHLY
//   - global.FiscalEngine (R10a 起·api 对象)·DEFAULT_TAXES / DEFAULT_ALLOCATION / ATOMIC_TAX_TYPES_19 / EXPENDITURE_EFFECTS_14 / enableTaxesByDynasty / _ensureRegionFiscal / splitTaxByAllocation / executeLocalAction / createTransferOrder / createTransferOrderAtomic / _tickTransferOrders / init / tick
//   - global.PhaseH (防御 shim)·init / tick (R10 collapse 后保留·防 3rd party reference·0 live caller)
//   - global.TM.Economy (alias)·sum / getDiv / topContributors / triggerSurvey
// Used by: tm-game-loop·tm-endturn-systems·tm-var-drawers·official-scenario-smoke·smoke-1627-fiscal·smoke-guoku-*·tm-fiscal-ui·index/editor.html
// Side effects: GM.fiscalConfig·GM.guoku·GM.regions[*].fiscal mutation·SettlementPipeline·EventBus·addEB·DOM via callers
// Test: official-scenario-smoke·verify-all (35 checks·177 layered baseline)
// Notes: Phase 3·R3 (2026-05-03) 由 tm-fiscal-cascade + tm-fiscal-fixed-expense 5→2 合并·rename 至 tm-fiscal-engine
//        R10a-h (2026-05-04)·吸 tm-tax-atomic §A·D·E·F·G (ATOMIC_TAX_TYPES_19·_ensureRegionFiscal·splitTaxByAllocation·EXPENDITURE_EFFECTS_14·executeLocalAction·_tickTransferOrders)
//        R10 fiscal compat (2026-05-04·Codex)·重构 export 段·api 对象 + CascadeTax/FixedExpense VERSION 2 + PhaseH 防御 shim + TM.Economy alias + 字段双名 alias (claimed/claimedRevenue·remitted/remittedToCenter·retained/retainedBudget) + customTaxes (perMu/flat/perDing) + Tianqi salaryAnnualOverride/armyAnnualOverride
//        R11d (2026-05-04·Claude)·head note 还原·DEFAULT_TAXES + ATOMIC_TAX_TYPES_19 中文显示名还原 (R10 fiscal compat 时被替换为英文·var-drawers L1194 等 UI 直接显示 t.name·中文是用户可见 contract)
// ============================================================
(function(global) {
  'use strict';

  var DEFAULT_TAXES = [
    { id: 'land_grain', name: '田赋（粮）', base: 'arableLand', baseFallback: 'mouths', baseFactor: 0.3, rate: 0.13, storeAs: 'grain', sourceTag: 'tianfu', annual: true },
    { id: 'land_silver', name: '田赋折银', base: 'arableLand', baseFallback: 'mouths', baseFactor: 1, rate: 0.012, storeAs: 'money', sourceTag: 'tianfu_silver', annual: true },
    { id: 'head_tax', name: '丁税', base: 'ding', baseFallback: 'mouths', baseFactor: 1, rate: 0.3, storeAs: 'money', sourceTag: 'dingshui', annual: true },
    { id: 'corvee_cloth', name: '庸役折布', base: 'ding', baseFallback: 'mouths', baseFactor: 1, rate: 0.15, storeAs: 'cloth', sourceTag: 'yongBu', annual: true },
    { id: 'commerce', name: '商税', base: 'commerceVolume', baseFallback: 'prosperity', baseFactor: 1, rate: 0.03, storeAs: 'money', sourceTag: 'shangShui', annual: true },
    { id: 'salt_iron', name: '盐铁专卖', base: 'consumption', baseFallback: 'mouths', baseFactor: 1, rate: 0.2, storeAs: 'money', sourceTag: 'salt_iron', annual: true }
  ];

  var ATOMIC_TAX_TYPES_19 = {
    tianfu:        { name: '田赋',         base: 'land',         rate: 0.05,  enabled: true,  dynasties: 'all' },
    dingshui:      { name: '丁税',         base: 'head',         rate: 0.01,  enabled: true,  dynasties: 'preQing' },
    caoliang:      { name: '漕粮',         base: 'land',         rate: 0.02,  enabled: true,  dynasties: 'MingQing' },
    yanlizhuan:    { name: '盐利专卖',     base: 'consumption',  rate: 0.2,   enabled: true,  dynasties: 'HanTangSongMing' },
    shipaiShui:    { name: '市舶税',       base: 'trade',        rate: 0.1,   enabled: true,  dynasties: 'SongMingQing' },
    quanShui:      { name: '权税/关税',    base: 'trade',        rate: 0.05,  enabled: true,  dynasties: 'all' },
    juanNa:        { name: '捐纳',         base: 'custom',       rate: 0,     enabled: false, dynasties: 'MingQing' },
    qita:          { name: '其他杂税',     base: 'head',         rate: 0.005, enabled: true,  dynasties: 'all' },
    shangshui:     { name: '商税',         base: 'commerce',     rate: 0.03,  enabled: true,  dynasties: 'SongMingQing' },
    chashui:       { name: '茶税',         base: 'consumption',  rate: 0.1,   enabled: true,  dynasties: 'TangSong' },
    jiushui:       { name: '酒税',         base: 'consumption',  rate: 0.15,  enabled: true,  dynasties: 'all' },
    tieshui:       { name: '坑冶税(铁)',   base: 'mining',       rate: 0.1,   enabled: true,  dynasties: 'HanTangSongMing' },
    tongshui:      { name: '坑冶税(铜)',   base: 'mining',       rate: 0.08,  enabled: true,  dynasties: 'TangSong' },
    yongshou:      { name: '庸税（折绢）', base: 'corvee',       rate: 0.02,  enabled: true,  dynasties: 'Tang' },
    diaoshou:      { name: '调税（绢布）', base: 'household',    rate: 0.015, enabled: true,  dynasties: 'Tang' },
    suanmin:       { name: '算缗',         base: 'wealth',       rate: 0.08,  enabled: false, dynasties: 'Han' },
    imperialEstate:{ name: '皇庄租',       base: 'imperial',     rate: 0.15,  enabled: true,  dynasties: 'MingQing', destination: 'neitang' },
    shuimoShui:    { name: '税磨税',       base: 'commerce',     rate: 0.02,  enabled: false, dynasties: 'SongYuan' },
    zajuan:        { name: '杂捐',         base: 'household',    rate: 0.01,  enabled: true,  dynasties: 'all' },
    // 宋特色财源(通用层·dynasty 标签限宋·惠及所有宋系剧本·非绍宋硬编)
    jingzongzhi:   { name: '经总制钱',     base: 'commerce',     rate: 0.04,  enabled: true,  dynasties: 'Song' },
    yuezhuangqian: { name: '月桩钱',       base: 'commerce',     rate: 0.025, enabled: true,  dynasties: 'Song' },
    mianyiqian:    { name: '免役钱',       base: 'household',    rate: 0.02,  enabled: true,  dynasties: 'Song' },
    hemaizhebo:    { name: '和买折帛钱',   base: 'household',    rate: 0.015, enabled: true,  dynasties: 'Song' }
  };

  var EXPENDITURE_EFFECTS_14 = {
    disaster_relief: { refMinxin: 8, cost: 100000, duration: 3 },
    public_works_water: { refFarmland: 0.1, cost: 150000, duration: 12 },
    public_works_road: { refCommerce: 0.05, cost: 80000, duration: 6 },
    local_garrison: { refSecurity: 0.1, cost: 60000, duration: 12 },
    education_school: { refCulture: 0.08, cost: 40000, duration: 24 },
    census_effort: { refHujiAccuracy: 0.1, cost: 50000, duration: 6 },
    patronage_local_elite: { refGentryLoyalty: 5, cost: 30000, duration: 12 },
    religious_patronage: { refMinxin: 3, cost: 25000, duration: 6 },
    embezzlement: { refCorruption: 3, cost: 0 },
    military_spending: { refMilitary: 0.08, cost: 120000, duration: 12 },
    frontier_fortification: { refSecurity: 0.12, cost: 140000, duration: 24 },
    grain_reserve: { refFood: 0.15, cost: 90000, duration: 18 },
    palace_construction: { refPrestige: 0.1, cost: 200000, duration: 36 },
    tax_relief: { refStability: 0.06, cost: 50000, duration: 6 }
  };

  var SINGLE_DYNASTY_MAP = {
    '秦': 'Qin',
    '汉': 'Han',
    '漢': 'Han',
    '魏': 'Wei',
    '晋': 'Jin',
    '晉': 'Jin',
    '唐': 'Tang',
    '宋': 'Song',
    '元': 'Yuan',
    '明': 'Ming',
    '清': 'Qing',
    Qin: 'Qin',
    Han: 'Han',
    Wei: 'Wei',
    Jin: 'Jin',
    Tang: 'Tang',
    Song: 'Song',
    Yuan: 'Yuan',
    Ming: 'Ming',
    Qing: 'Qing'
  };

  var COMBO_DYNASTY_MAP = {
    '汉唐': 'HanTang',
    '漢唐': 'HanTang',
    '唐宋': 'TangSong',
    '宋元': 'SongYuan',
    '明清': 'MingQing',
    '汉唐明': 'HanTangMing',
    '漢唐明': 'HanTangMing',
    '唐宋明': 'TangSongMing',
    '宋明清': 'SongMingQing',
    '宋元明清': 'SongYuanMingQing',
    '汉唐宋': 'HanTangSong',
    '漢唐宋': 'HanTangSong',
    '汉唐明清': 'HanTangMingQing',
    '漢唐明清': 'HanTangMingQing'
  };

  function clone(value) {
    if (!value || typeof value !== 'object') return value;
    return JSON.parse(JSON.stringify(value));
  }

  function getGame(G) {
    if (G) return G;
    if (typeof global.GM !== 'undefined' && global.GM) return global.GM;
    if (typeof GM !== 'undefined' && GM) return GM;
    return null;
  }

  function resolveDynasty(G) {
    var sc = null;
    if (G && G.sid && typeof findScenarioById === 'function') {
      try { sc = findScenarioById(G.sid); } catch (_e) { sc = null; }
    }
    return (G && G.dynasty) || (G && G.eraState && G.eraState.dynasty) || (sc && (sc.dynasty || sc.era)) || '';
  }

  function splitCamelTokens(text) {
    var out = [];
    if (!text) return out;
    var m = String(text).match(/[A-Z][a-z]*/g);
    if (m && m.length) {
      for (var i = 0; i < m.length; i++) out.push(m[i]);
    }
    return out;
  }

  function dynastyTokens(dy) {
    var raw = String(dy || '').replace(/末$/, '');
    var out = [];
    var seen = {};

    function push(token) {
      if (!token || seen[token]) return;
      seen[token] = true;
      out.push(token);
    }

    push(raw);
    if (COMBO_DYNASTY_MAP[raw]) push(COMBO_DYNASTY_MAP[raw]);
    if (SINGLE_DYNASTY_MAP[raw]) push(SINGLE_DYNASTY_MAP[raw]);

    if (/^[A-Za-z]+$/.test(raw)) {
      var camel = splitCamelTokens(raw);
      for (var i = 0; i < camel.length; i++) push(camel[i]);
    } else {
      for (var j = 0; j < raw.length; j++) {
        var ch = raw.charAt(j);
        if (SINGLE_DYNASTY_MAP[ch]) push(SINGLE_DYNASTY_MAP[ch]);
      }
    }

    if (raw === 'preQing') push('preQing');
    return out;
  }

  function dynastyMatches(spec, dyn) {
    if (!spec || spec === 'all') return true;
    var tokens = dynastyTokens(dyn);
    if (!tokens.length) return false;
    if (spec === 'preQing') {
      return tokens.indexOf('Qing') === -1;
    }
    for (var i = 0; i < tokens.length; i++) {
      if (spec.indexOf(tokens[i]) >= 0) return true;
    }
    return spec === String(dyn || '').replace(/末$/, '');
  }

  function normalizeTaxMap(source) {
    var out = {};
    if (!source) return out;
    if (Array.isArray(source)) {
      source.forEach(function(item) {
        if (item && item.id) out[item.id] = clone(item);
      });
      return out;
    }
    if (typeof source === 'object') {
      Object.keys(source).forEach(function(key) {
        var item = source[key];
        if (item && typeof item === 'object') out[key] = clone(item);
      });
    }
    return out;
  }

  function enableTaxesByDynasty(G) {
    G = getGame(G);
    if (!G) return {};

    if (!G.fiscalConfig) G.fiscalConfig = {};

    var sourceMap = normalizeTaxMap(G.fiscalConfig.taxesEnabled || G.fiscalConfig.taxes || {});
    var dynasty = resolveDynasty(G);
    if (!G.dynasty && dynasty) G.dynasty = dynasty;

    var result = {};
    var customKeys = Object.keys(sourceMap);
    for (var i = 0; i < customKeys.length; i++) {
      var customKey = customKeys[i];
      if (!ATOMIC_TAX_TYPES_19[customKey]) result[customKey] = clone(sourceMap[customKey]);
    }

    var taxKeys = Object.keys(ATOMIC_TAX_TYPES_19);
    for (var j = 0; j < taxKeys.length; j++) {
      var tid = taxKeys[j];
      var base = clone(ATOMIC_TAX_TYPES_19[tid]);
      var override = sourceMap[tid] ? clone(sourceMap[tid]) : null;
      var merged = {};
      var k;
      for (k in base) merged[k] = base[k];
      if (override) {
        for (k in override) merged[k] = override[k];
      }
      if (typeof merged.enabled === 'undefined') merged.enabled = true;
      merged.enabled = !!merged.enabled && dynastyMatches(merged.dynasties, dynasty);
      merged.dynasty = dynasty;
      result[tid] = merged;
    }

    G.fiscalConfig.taxes = result;
    G.fiscalConfig.taxesEnabled = result;
    return result;
  }

  function _ensureRegionFiscal(region, parentRegion, seen) {
    if (!region || typeof region !== 'object') return region;

    if (!seen) {
      seen = typeof WeakSet !== 'undefined' ? new WeakSet() : null;
    }
    if (seen) {
      if (seen.has(region)) return region;
      seen.add(region);
    }

    if (!region.fiscal || typeof region.fiscal !== 'object') {
      region.fiscal = region.fiscalDetail && typeof region.fiscalDetail === 'object' ? clone(region.fiscalDetail) : {};
    }
    var f = region.fiscal;
    var fd = region.fiscalDetail && typeof region.fiscalDetail === 'object' ? region.fiscalDetail : null;

    function readFiscalNumber(keys) {
      for (var r = 0; r < keys.length; r++) {
        var key = keys[r];
        if (f[key] != null && f[key] !== '') return Number(f[key]) || 0;
        if (fd && fd[key] != null && fd[key] !== '') return Number(fd[key]) || 0;
      }
      return 0;
    }

    var claimed = readFiscalNumber(['claimed', 'claimedRevenue', 'annualTax']);
    var actual = readFiscalNumber(['actual', 'actualRevenue']);
    var remitted = readFiscalNumber(['remitted', 'remittedToCenter']);
    var retained = readFiscalNumber(['retained', 'retainedBudget']);

    f.claimed = claimed;
    f.actual = actual;
    f.remitted = remitted;
    f.retained = retained;
    f.claimedRevenue = claimed;
    f.actualRevenue = actual;
    f.remittedToCenter = remitted;
    f.retainedBudget = retained;
    if (f.annualTax === undefined) f.annualTax = actual;
    if (f.compliance === undefined) f.compliance = fd && fd.compliance !== undefined ? fd.compliance : 0.85;
    if (f.skimmingRate === undefined) f.skimmingRate = fd && fd.skimmingRate !== undefined ? fd.skimmingRate : 0.1;
    if (f.autonomyLevel === undefined) f.autonomyLevel = fd && fd.autonomyLevel !== undefined ? fd.autonomyLevel : 0.3;
    if (!f.peasantBurden) f.peasantBurden = { claimed: 0, actual: 0 };
    if (!f.ledgers) f.ledgers = {};
    ['money', 'grain', 'cloth'].forEach(function(kind) {
      if (!f.ledgers[kind]) f.ledgers[kind] = {};
      var led = f.ledgers[kind];
      if (typeof led.stock !== 'number') led.stock = Number(led.stock || 0);
      if (typeof led.thisTurnIn !== 'number') led.thisTurnIn = Number(led.thisTurnIn || 0);
      if (typeof led.thisTurnOut !== 'number') led.thisTurnOut = Number(led.thisTurnOut || 0);
      if (typeof led.lastTurnIn !== 'number') led.lastTurnIn = Number(led.lastTurnIn || 0);
      if (typeof led.lastTurnOut !== 'number') led.lastTurnOut = Number(led.lastTurnOut || 0);
      if (!led.sources) led.sources = {};
      if (!led.sinks) led.sinks = {};
      if (!Array.isArray(led.history)) led.history = [];
    });
    if (parentRegion && parentRegion.id && !region.fiscal.parentRegionId) {
      region.fiscal.parentRegionId = parentRegion.id;
    }

    var childGroups = [];
    if (Array.isArray(region.subRegions)) childGroups.push(region.subRegions);
    if (Array.isArray(region.children)) childGroups.push(region.children);
    if (Array.isArray(region.divisions)) childGroups.push(region.divisions);
    for (var i = 0; i < childGroups.length; i++) {
      for (var c = 0; c < childGroups[i].length; c++) {
        _ensureRegionFiscal(childGroups[i][c], region, seen);
      }
    }

    var childSum = 0;
    for (var j = 0; j < childGroups.length; j++) {
      for (var k = 0; k < childGroups[j].length; k++) {
        var sub = childGroups[j][k];
        childSum += Number(sub && sub.fiscal && (sub.fiscal.actualRevenue || sub.fiscal.actual) || 0);
      }
    }
    if (childSum > 0 && region.fiscal.actual < childSum) {
      region.fiscal.actual = childSum;
      region.fiscal.actualRevenue = childSum;
    }
    return region;
  }

  function splitTaxByAllocation(tax, amount, allocationMode) {
    var modes = {
      tang_three: { central: 0.4, provincial: 0.3, local: 0.3 },
      qiyun_cunliu: { central: 0.6, local: 0.4 },
      song_cash: { central: 0.7, local: 0.3 },
      equal: { central: 0.5, local: 0.5 }
    };
    var alloc = modes[allocationMode || 'qiyun_cunliu'] || modes.qiyun_cunliu;
    var result = {};
    var keys = Object.keys(alloc);
    for (var i = 0; i < keys.length; i++) {
      var key = keys[i];
      result[key] = Math.floor(Number(amount || 0) * alloc[key]);
    }
    return result;
  }

  function resolveRegionById(G, id) {
    if (!G || !id) return null;
    if (!Array.isArray(G.regions)) return null;

    var queue = G.regions.slice();
    while (queue.length) {
      var region = queue.shift();
      if (!region || typeof region !== 'object') continue;
      if (region.id === id || region.name === id || region.code === id) return region;
      if (Array.isArray(region.subRegions) && region.subRegions.length) {
        queue = queue.concat(region.subRegions);
      }
    }
    return null;
  }

  function applyEffectDelta(target, key, delta) {
    if (!target || typeof delta !== 'number') return;
    if (typeof target[key] !== 'number') target[key] = 0;
    target[key] += delta;
  }

  function executeLocalAction(action, G, ctx) {
    G = getGame(G);
    if (!G) return { ok: false, reason: 'no game state' };

    var payload = typeof action === 'string' ? { type: action } : (action || {});
    var type = payload.type || payload.actionType || payload.id || '';
    var effect = payload.effect || EXPENDITURE_EFFECTS_14[type] || null;
    if (!effect) return { ok: false, reason: 'unknown action type', type: type };

    var regionId = payload.regionId || payload.region || payload.targetRegionId || payload.toRegion || payload.target || null;
    var targetRegion = resolveRegionById(G, regionId);
    var target = targetRegion || G;

    if (effect.refMinxin !== undefined && typeof global._adjAuthority === 'function') {
      global._adjAuthority('minxin', effect.refMinxin);
    }
    if (effect.refHuangwei !== undefined && typeof global._adjAuthority === 'function') {
      global._adjAuthority('huangwei', effect.refHuangwei);
    }

    var map = {
      refMinxin: 'minxin',
      refFarmland: 'farmland',
      refCommerce: 'commerce',
      refSecurity: 'security',
      refCulture: 'culture',
      refHujiAccuracy: 'hujiAccuracy',
      refGentryLoyalty: 'gentryLoyalty',
      refCorruption: 'corruption',
      refTreasury: 'treasury',
      refFood: 'food',
      refMilitary: 'military',
      refStability: 'stability',
      refPrestige: 'prestige',
      refFaith: 'faith',
      refMorale: 'morale',
      refManpower: 'manpower'
    };

    Object.keys(map).forEach(function(effectKey) {
      if (typeof effect[effectKey] === 'number') {
        applyEffectDelta(target, map[effectKey], effect[effectKey]);
      }
    });

    if (!G.fiscalConfig) G.fiscalConfig = {};
    G.fiscalConfig.lastLocalAction = {
      type: type,
      turn: G.turn || 0,
      regionId: regionId || null,
      cost: effect.cost || 0
    };

    if (typeof global.addEB === 'function') {
      try { global.addEB('fiscal-action', type); } catch (_e) {}
    }

    return { ok: true, type: type, effect: clone(effect), regionId: regionId || null };
  }

  function createTransferOrderAtomic(from, toRegion, amount) {
    var G = getGame();
    if (!G) return null;
    if (!Array.isArray(G._transferOrders)) G._transferOrders = [];

    var turn = Number(G.turn || 0);
    var order = {
      id: 'trans_' + turn + '_' + Math.floor(Math.random() * 10000),
      from: from,
      toRegion: toRegion,
      amount: Number(amount || 0),
      createdTurn: turn,
      expectedArrival: turn + ((typeof global.turnsForMonths === 'function') ? global.turnsForMonths(2) : 2),
      status: 'pending',
      progress: 0
    };
    G._transferOrders.push(order);
    return order;
  }

  function settleTransferOrder(G, order, turn) {
    if (!order || order.status !== 'pending') return false;
    if (turn < order.expectedArrival) return false;

    var fromRegion = null;
    var toRegion = null;
    if (typeof order.from === 'string') fromRegion = resolveRegionById(G, order.from);
    else if (order.from && typeof order.from === 'object') fromRegion = order.from;
    if (typeof order.toRegion === 'string') toRegion = resolveRegionById(G, order.toRegion);
    else if (order.toRegion && typeof order.toRegion === 'object') toRegion = order.toRegion;

    // Transfer attrition: en-route skimming (magnate/bandit wave). Sender remits full; receiver gets less; gap = lost in transit.
    var _amt = Number(order.amount || 0);
    var _lost = (typeof _transferAttritionRate === 'function') ? Math.round(_amt * _transferAttritionRate(G)) : 0;
    var _arrived = Math.max(0, _amt - _lost);
    order.lost = _lost;
    order.arrived = _arrived;
    if (fromRegion && fromRegion.fiscal) {
      fromRegion.fiscal.remitted = Number(fromRegion.fiscal.remitted || 0) - _amt;
    }
    if (toRegion && toRegion.fiscal) {
      toRegion.fiscal.actual = Number(toRegion.fiscal.actual || 0) + _arrived;
      toRegion.fiscal.retained = Number(toRegion.fiscal.retained || 0) + _arrived;
    }

    order.status = 'delivered';
    order.deliveredTurn = turn;
    return true;
  }

  function _tickTransferOrders(ctx, mr) {
    var G = getGame();
    if (!G) return { processed: 0, delivered: 0 };

    if (!Array.isArray(G._transferOrders)) G._transferOrders = [];

    var turn = Number((ctx && ctx.turn) || G.turn || 0);
    var ratio = Number(mr || (ctx && ctx.monthRatio) || 1) || 1;
    var processed = 0;
    var delivered = 0;

    for (var i = 0; i < G._transferOrders.length; i++) {
      var order = G._transferOrders[i];
      if (!order || order.status !== 'pending') continue;
      processed += 1;
      order.progress = Number(order.progress || 0) + ratio;
      if (turn >= Number(order.expectedArrival || 0)) {
        if (settleTransferOrder(G, order, turn)) delivered += 1;
      }
    }

    return { processed: processed, delivered: delivered };
  }

  function init(G) {
    G = getGame(G);
    if (!G) return null;
    enableTaxesByDynasty(G);
    if (Array.isArray(G.regions)) {
      for (var i = 0; i < G.regions.length; i++) {
        _ensureRegionFiscal(G.regions[i], null);
      }
    }
    if (G.adminHierarchy) {
      walkAdminDivisions(G, function(div) {
        _ensureRegionFiscal(div, null);
        _ensureEconomyBase(div);
      }, { leafOnly: false });
    }
    return G;
  }

  function tick(ctx, mr) {
    return _tickTransferOrders(ctx, mr);
  }

  var DEFAULT_ALLOCATION = {
    mode: 'qiyun_cunliu',
    perTax: {
      land_grain: { qiyun: 0.6, cunliu: 0.4 },
      land_silver: { qiyun: 0.7, cunliu: 0.3 },
      head_tax: { qiyun: 0.8, cunliu: 0.2 },
      corvee_cloth: { qiyun: 0.5, cunliu: 0.5 },
      commerce: { qiyun: 0.5, cunliu: 0.5 },
      salt_iron: { qiyun: 0.9, cunliu: 0.1 },
      liaoxiang: { qiyun: 1, cunliu: 0 }
    },
    defaultPerTax: { qiyun: 0.7, cunliu: 0.3 }
  };
  var DEFAULT_LOGISTICS_LOSS = 0.15;

  var DEFAULT_RANK_SALARY = {
    '正一品': 100, '从一品': 90,
    '正二品': 80, '从二品': 72,
    '正三品': 65, '从三品': 58,
    '正四品': 50, '从四品': 44,
    '正五品': 38, '从五品': 33,
    '正六品': 28, '从六品': 24,
    '正七品': 20, '从七品': 17,
    '正八品': 14, '从八品': 12,
    '正九品': 10, '从九品': 8
  };
  var DEFAULT_UNRANKED_SALARY = 6;
  var DEFAULT_ARMY_PAY = { money: 0.5, grain: 0.3, cloth: 0.02 };
  var DEFAULT_IMPERIAL_MONTHLY = { money: 20000, grain: 5000, cloth: 1000 };

  function safeNumber(value, fallback) {
    var n = Number(value);
    return isFinite(n) ? n : (fallback || 0);
  }

  function copyFields(target, source) {
    if (!target || !source || typeof source !== 'object') return target;
    Object.keys(source).forEach(function(key) {
      target[key] = source[key];
    });
    return target;
  }

  function getFiscalConfig(G) {
    G = getGame(G);
    var cfg = {};
    var sc = null;
    if (G && G.sid && typeof global.findScenarioById === 'function') {
      try { sc = global.findScenarioById(G.sid); } catch (_e) { sc = null; }
    }
    if (sc && sc.fiscalConfig) copyFields(cfg, sc.fiscalConfig);
    if (global.P && global.P.fiscalConfig) copyFields(cfg, global.P.fiscalConfig);
    if (G && G.fiscalConfig) copyFields(cfg, G.fiscalConfig);
    if (global.scriptData && global.scriptData.fiscalConfig) copyFields(cfg, global.scriptData.fiscalConfig);
    return cfg;
  }

  function getTurnDays(ctx, G) {
    G = getGame(G);
    if (ctx && ctx.turnDays) return safeNumber(ctx.turnDays, 30);
    if (ctx && ctx.daysPerTurn) return safeNumber(ctx.daysPerTurn, 30);
    if (G && G.turnDays) return safeNumber(G.turnDays, 30);
    var fc = getFiscalConfig(G);
    if (fc.daysPerTurn) return safeNumber(fc.daysPerTurn, 30);
    if (fc.turnDays) return safeNumber(fc.turnDays, 30);
    if (global.scriptData && global.scriptData.turnDays) return safeNumber(global.scriptData.turnDays, 30);
    if (typeof global._getDaysPerTurn === 'function') {
      try {
        var gd = global._getDaysPerTurn();
        if (gd) return safeNumber(gd, 30);
      } catch (_e) {}
    }
    return 30;
  }

  function ensureLedger(root, key, initialStock) {
    if (!root[key] || typeof root[key] !== 'object') root[key] = {};
    var led = root[key];
    if (typeof led.stock !== 'number') led.stock = safeNumber(initialStock, 0);
    if (typeof led.lastTurnIn !== 'number') led.lastTurnIn = safeNumber(led.lastTurnIn, 0);
    if (typeof led.lastTurnOut !== 'number') led.lastTurnOut = safeNumber(led.lastTurnOut, 0);
    if (typeof led.thisTurnIn !== 'number') led.thisTurnIn = safeNumber(led.thisTurnIn, 0);
    if (typeof led.thisTurnOut !== 'number') led.thisTurnOut = safeNumber(led.thisTurnOut, 0);
    if (!led.sources) led.sources = {};
    if (!led.sinks) led.sinks = {};
    if (!Array.isArray(led.history)) led.history = [];
    return led;
  }

  function resetTurnLedger(led, keepSources) {
    if (!led) return;
    led.lastTurnIn = safeNumber(led.thisTurnIn, 0);
    led.lastTurnOut = safeNumber(led.thisTurnOut, 0);
    led.thisTurnIn = 0;
    led.thisTurnOut = 0;
    if (!keepSources) led.sources = {};
    if (!keepSources) led.sinks = {};
  }

  function addToLedger(ledger, amount, sourceTag) {
    amount = safeNumber(amount, 0);
    if (!ledger || amount <= 0) return;
    ledger.stock = safeNumber(ledger.stock, 0) + amount;
    ledger.thisTurnIn = safeNumber(ledger.thisTurnIn, 0) + amount;
    if (sourceTag) {
      if (!ledger.sources) ledger.sources = {};
      ledger.sources[sourceTag] = safeNumber(ledger.sources[sourceTag], 0) + amount;
    }
  }

  function deductFromLedger(ledger, amount, sinkTag) {
    amount = safeNumber(amount, 0);
    if (!ledger || amount <= 0) return { deducted: 0, deficit: 0 };
    var have = safeNumber(ledger.stock, 0);
    var deducted = Math.min(have, amount);
    var deficit = amount - deducted;
    ledger.stock = have - deducted;
    ledger.thisTurnOut = safeNumber(ledger.thisTurnOut, 0) + deducted;
    if (sinkTag) {
      if (!ledger.sinks) ledger.sinks = {};
      ledger.sinks[sinkTag] = safeNumber(ledger.sinks[sinkTag], 0) + deducted;
      if (deficit > 0) ledger.sinks[sinkTag + '_欠'] = safeNumber(ledger.sinks[sinkTag + '_欠'], 0) + deficit;
    }
    if (deficit > 0) ledger.deficit = safeNumber(ledger.deficit, 0) + deficit;
    return { deducted: deducted, deficit: deficit };
  }

  function ensureGuoku(G) {
    G = getGame(G);
    if (!G.guoku) G.guoku = {};
    if (!G.guoku.ledgers) G.guoku.ledgers = {};
    var money = ensureLedger(G.guoku.ledgers, 'money', G.guoku.money || G.guoku.balance || 0);
    var grain = ensureLedger(G.guoku.ledgers, 'grain', G.guoku.grain || 0);
    var cloth = ensureLedger(G.guoku.ledgers, 'cloth', G.guoku.cloth || 0);
    return { money: money, grain: grain, cloth: cloth };
  }

  function ensureNeitang(G) {
    G = getGame(G);
    if (!G.neitang) G.neitang = {};
    if (!G.neitang.ledgers) G.neitang.ledgers = {};
    var money = ensureLedger(G.neitang.ledgers, 'money', G.neitang.money || G.neitang.balance || 0);
    var grain = ensureLedger(G.neitang.ledgers, 'grain', G.neitang.grain || 0);
    var cloth = ensureLedger(G.neitang.ledgers, 'cloth', G.neitang.cloth || 0);
    return { money: money, grain: grain, cloth: cloth };
  }

  function syncAccountScalars(account, ledgers) {
    if (!account || !ledgers) return;
    account.money = safeNumber(ledgers.money && ledgers.money.stock, 0);
    account.grain = safeNumber(ledgers.grain && ledgers.grain.stock, 0);
    account.cloth = safeNumber(ledgers.cloth && ledgers.cloth.stock, 0);
    account.balance = account.money;
  }

  function reconcileLedgerScalar(ledger, scalarValue, balanceValue) {
    if (!ledger) return;
    var stock = safeNumber(ledger.stock, 0);
    var sd = scalarValue != null ? safeNumber(scalarValue, stock) - stock : 0;
    var bd = balanceValue != null ? safeNumber(balanceValue, stock) - stock : 0;
    var diff = Math.abs(sd) >= Math.abs(bd) ? sd : bd;
    if (Math.abs(diff) < 0.5) return;
    ledger.stock = stock + diff;
    if (diff > 0) {
      if (!ledger.sources) ledger.sources = {};
      ledger.sources['外部调整'] = safeNumber(ledger.sources['外部调整'], 0) + diff;
      ledger.thisTurnIn = safeNumber(ledger.thisTurnIn, 0) + diff;
    } else {
      if (!ledger.sinks) ledger.sinks = {};
      ledger.sinks['外部调整'] = safeNumber(ledger.sinks['外部调整'], 0) + (-diff);
      ledger.thisTurnOut = safeNumber(ledger.thisTurnOut, 0) + (-diff);
    }
  }

  function childArrays(node) {
    var out = [];
    if (node && Array.isArray(node.children)) out.push(node.children);
    if (node && Array.isArray(node.divisions)) out.push(node.divisions);
    if (node && Array.isArray(node.subRegions)) out.push(node.subRegions);
    return out;
  }

  function walkAdminDivisions(G, callback, opts) {
    G = getGame(G);
    opts = opts || {};
    if (!G || !G.adminHierarchy) return 0;
    var count = 0;

    function visit(node, parent, faction) {
      if (!node || typeof node !== 'object') return;
      var groups = childArrays(node);
      var hasChild = false;
      for (var g = 0; g < groups.length; g++) {
        if (groups[g].length) hasChild = true;
      }
      if (!opts.leafOnly || !hasChild) {
        count += 1;
        callback(node, parent, faction, hasChild);
      }
      for (var i = 0; i < groups.length; i++) {
        for (var j = 0; j < groups[i].length; j++) visit(groups[i][j], node, faction);
      }
    }

    if (Array.isArray(G.adminHierarchy)) {
      for (var a = 0; a < G.adminHierarchy.length; a++) visit(G.adminHierarchy[a], null, null);
      return count;
    }

    Object.keys(G.adminHierarchy).forEach(function(factionKey) {
      if (opts.faction && factionKey !== opts.faction) return;
      var tree = G.adminHierarchy[factionKey];
      if (tree && Array.isArray(tree.divisions)) {
        for (var i = 0; i < tree.divisions.length; i++) visit(tree.divisions[i], null, factionKey);
      } else if (Array.isArray(tree)) {
        for (var j = 0; j < tree.length; j++) visit(tree[j], null, factionKey);
      } else {
        visit(tree, null, factionKey);
      }
    });
    return count;
  }

  function defaultFarmlandPerHousehold(terrain) {
    var t = String(terrain || '');
    if (t.indexOf('平原') >= 0) return 32;
    if (t.indexOf('盆地') >= 0) return 24;
    if (t.indexOf('丘陵') >= 0) return 22;
    if (t.indexOf('沿海') >= 0) return 16;
    if (t.indexOf('高原') >= 0) return 14;
    if (t.indexOf('山') >= 0) return 9;
    if (t.indexOf('草原') >= 0 || t.indexOf('游牧') >= 0) return 4;
    if (t.indexOf('荒漠') >= 0 || t.indexOf('戈壁') >= 0) return 2;
    return 22;
  }

  function defaultRoadQuality(terrain) {
    var t = String(terrain || '');
    if (t.indexOf('平原') >= 0) return 60;
    if (t.indexOf('沿海') >= 0) return 55;
    if (t.indexOf('盆地') >= 0) return 48;
    if (t.indexOf('丘陵') >= 0) return 42;
    if (t.indexOf('高原') >= 0) return 30;
    if (t.indexOf('山') >= 0) return 22;
    if (t.indexOf('草原') >= 0 || t.indexOf('游牧') >= 0) return 35;
    if (t.indexOf('荒漠') >= 0 || t.indexOf('戈壁') >= 0) return 18;
    return 45;
  }

  function inferResourceText(div) {
    var parts = [];
    if (!div) return '';
    ['name', 'terrain', 'description', 'specialResources', 'resources', 'resourceTags'].forEach(function(key) {
      var v = div[key];
      if (Array.isArray(v)) parts.push(v.join(' '));
      else if (v && typeof v === 'object') parts.push(Object.keys(v).join(' '));
      else if (v != null) parts.push(String(v));
    });
    return parts.join(' ');
  }

  function _ensureEconomyBase(div) {
    if (!div || typeof div !== 'object') return null;
    if (!div.tags) div.tags = {};
    var text = inferResourceText(div);
    var tagDefaults = {
      hasPort: /港|海|市舶|沿海|舟|澳门|月港/.test(text),
      saltRegion: /盐|鹽|长芦|两淮|河东/.test(text),
      mineralRegion: /矿|礦|铁|鐵|铜|銅|银|銀|煤/.test(text),
      horseRegion: /马|馬|牧|草原|边镇|九边/.test(text),
      fishingRegion: /渔|漁|鱼|魚|湖|海|江/.test(text),
      imperialDomain: /皇庄|内府|织造|御|陵|京畿/.test(text)
    };
    Object.keys(tagDefaults).forEach(function(key) {
      if (typeof div.tags[key] !== 'boolean') div.tags[key] = !!tagDefaults[key];
    });

    if (!div.economyBase) div.economyBase = {};
    var eb = div.economyBase;
    var pop = div.populationDetail || (div.population && typeof div.population === 'object' ? div.population : null);
    var mouths = safeNumber(pop && pop.mouths, safeNumber(typeof div.population === 'number' ? div.population : 0, 0));
    var households = safeNumber(pop && pop.households, Math.floor(mouths / 5));
    var ding = safeNumber(pop && pop.ding, Math.floor(mouths * 0.25));

    if (typeof eb.farmland !== 'number') {
      eb.farmland = safeNumber(eb.arableLand, 0)
        || safeNumber(div.arableLand, 0)
        || safeNumber(div.environment && div.environment.arableLand, 0)
        || safeNumber(div.carryingCapacity && div.carryingCapacity.arable, 0)
        || households * defaultFarmlandPerHousehold(div.terrain);
    }
    if (typeof eb.arableLand !== 'number') eb.arableLand = eb.farmland;
    if (typeof eb.households !== 'number') eb.households = households;
    if (typeof eb.mouths !== 'number') eb.mouths = mouths;
    if (typeof eb.ding !== 'number') eb.ding = ding;
    if (typeof eb.commerceCoefficient !== 'number') eb.commerceCoefficient = Math.max(0.4, safeNumber(div.prosperity, 50) / 50);
    if (typeof eb.commerceVolume !== 'number') eb.commerceVolume = Math.round(mouths * 0.05 * eb.commerceCoefficient);
    if (typeof eb.maritimeTradeVolume !== 'number') eb.maritimeTradeVolume = div.tags.hasPort ? Math.round(mouths * 0.02) : 0;
    if (typeof eb.saltProduction !== 'number') eb.saltProduction = div.tags.saltRegion ? Math.round(mouths * 0.5) : 0;
    if (typeof eb.mineralProduction !== 'number') eb.mineralProduction = div.tags.mineralRegion ? Math.round(mouths * 0.1) : 0;
    if (typeof eb.horseProduction !== 'number') eb.horseProduction = div.tags.horseRegion ? Math.round(mouths * 0.001) : 0;
    if (typeof eb.fishingProduction !== 'number') eb.fishingProduction = div.tags.fishingRegion ? Math.round(mouths * 0.05) : 0;
    if (typeof eb.imperialFarmland !== 'number') eb.imperialFarmland = div.tags.imperialDomain ? Math.round(eb.farmland * 0.05) : 0;
    if (!eb.imperialAssets) eb.imperialAssets = {
      zhizao: div.tags.imperialDomain ? 1 : 0,
      kuangchang: div.tags.mineralRegion && div.tags.imperialDomain ? 1 : 0,
      yuyao: 0
    };
    if (typeof eb.postRelays !== 'number') eb.postRelays = Math.max(2, Math.floor(households / 50000));
    if (typeof eb.kejuQuota !== 'number') eb.kejuQuota = Math.max(20, Math.floor(mouths / 100000));
    if (!Array.isArray(eb.disasterRecord)) eb.disasterRecord = [];
    if (typeof eb.landsAnnexed !== 'number') eb.landsAnnexed = 0;
    if (typeof eb.landsReclaimed !== 'number') eb.landsReclaimed = 0;
    if (typeof eb.landsSurveyed !== 'number') eb.landsSurveyed = 0;
    if (typeof eb.roadQuality !== 'number') eb.roadQuality = defaultRoadQuality(div.terrain);
    return eb;
  }

  function _settleLandFlow(div, ctx) {
    if (!div) return null;
    var eb = _ensureEconomyBase(div);
    if (!eb) return null;
    var turnFrac = safeNumber(ctx && ctx.turnFracOfYear, 30 / 365);
    var corruption = safeNumber(div.corruption, safeNumber(div.corruptionLocal, 50));
    var minxin = safeNumber(div.minxin, safeNumber(div.minxinLocal, 50));
    var ccArable = safeNumber(div.carryingCapacity && div.carryingCapacity.arable, 0);
    var historicalCap = safeNumber(div.carryingCapacity && div.carryingCapacity.historicalCap, ccArable * 1.1);
    var carryingLoad = safeNumber(div.carryingCapacity && div.carryingCapacity.currentLoad, 0.85);
    var before = safeNumber(eb.farmland, 0);

    var annexAnnualRate = Math.max(0, (corruption - 50) / 100) * 0.04;
    var annexLoss = Math.round(before * annexAnnualRate * turnFrac);
    if (annexLoss > 0) {
      eb.farmland = Math.max(0, eb.farmland - annexLoss);
      eb.arableLand = eb.farmland;
      eb.landsAnnexed += annexLoss;
    }

    var encourage = !!(global.GM && global.GM.policies && global.GM.policies.encourageFarming);
    var reclaimRate = Math.max(0, 1 - carryingLoad) * 0.015 * (encourage ? 2.5 : 1);
    var reclaimGain = Math.round(before * reclaimRate * turnFrac);
    var cap = Math.max(historicalCap || 0, ccArable * 1.2 || 0, before);
    if (reclaimGain > 0 && eb.farmland < cap) {
      reclaimGain = Math.min(reclaimGain, Math.max(0, cap - eb.farmland));
      eb.farmland += reclaimGain;
      eb.arableLand = eb.farmland;
      eb.landsReclaimed += reclaimGain;
    } else {
      reclaimGain = 0;
    }

    var surveyed = 0;
    if (div._surveyTrigger && eb.landsAnnexed > 0) {
      var pct = 0.30 + Math.max(0, minxin) / 100 * 0.30;
      surveyed = Math.round(eb.landsAnnexed * pct);
      eb.farmland += surveyed;
      eb.arableLand = eb.farmland;
      eb.landsAnnexed = Math.max(0, eb.landsAnnexed - surveyed);
      eb.landsSurveyed += surveyed;
      delete div._surveyTrigger;
    }

    // P1-B1·商贸随人口/繁荣浮动(物产卷·拆自然基础+建筑加成·增量捕获不改 building-works)·去 _ensureEconomyBase:824 懒初始化冻结。
    //   建筑加成 = 现 commerceVolume - 上回合自然基础(building-works/AI 写入的增量·持久保留)。
    //   灾异折损在 computeTaxAmount:1028 算税时乘 disasterPenalty·不改存储·与此重算正交。
    //   开关 productionFloatEnabled 默认开(owner 拍板·物产活化直接生效·显式 false 才冻结)·物产卷 B1-B4 共用。
    if (!(global.P && global.P.conf && global.P.conf.productionFloatEnabled === false)) {   // 默认开·显式 false 才关(owner 拍板·物产活化直接生效)
      var _coefB1 = Math.max(0.4, safeNumber(div.prosperity, 50) / 50);
      var _mouthsB1 = safeNumber(div.populationDetail && div.populationDetail.mouths, safeNumber(eb.mouths, 0));
      var _commNatural = Math.round(_mouthsB1 * 0.05 * _coefB1);
      var _commBuilt = (typeof eb._commerceNaturalLast === 'number')
        ? Math.max(0, safeNumber(eb.commerceVolume, 0) - eb._commerceNaturalLast)
        // 首回合(无 _commerceNaturalLast)：剧本 authored commerceVolume 超出自然基础的部分 = 初始建筑/authored 商业加成·须保留·
        // 否则首回合把 authored 值(如绍宋雅州 664万)整个丢弃·只剩自然基础(mouths×0.05×coef=4.78万)→ 商税骤减 139 倍 → 开局收入畸低(绍宋七万)。跨剧本根治。
        : Math.max(0, safeNumber(eb.commerceVolume, 0) - _commNatural);
      eb.commerceVolume = _commNatural + _commBuilt;
      eb._commerceNaturalLast = _commNatural;
      eb.commerceCoefficient = _coefB1;
      div._thisTurnCommerce = { natural: _commNatural, built: _commBuilt, total: eb.commerceVolume };

      // P1-B2·盐矿马渔/海贸随人口浮动+建筑加成(同 B1 拆基础/加成模型·增量捕获不改 building-works)·仅产区(tag)浮动。
      //   建矿场(building-works +mineralProduction)→增量捕获保留→矿课升(税基 fiscal:1024)。灾异减产走 computeTaxAmount disasterPenalty。
      //   开采枯竭(矿/盐有限衰减)需储量状态·留 B2 后续。
      var _prodFields = [
        ['saltProduction', div.tags.saltRegion ? 0.5 : 0],
        ['mineralProduction', div.tags.mineralRegion ? 0.1 : 0],
        ['horseProduction', div.tags.horseRegion ? 0.001 : 0],
        ['fishingProduction', div.tags.fishingRegion ? 0.05 : 0],
        ['maritimeTradeVolume', div.tags.hasPort ? 0.02 : 0]
      ];
      for (var _pi = 0; _pi < _prodFields.length; _pi++) {
        var _pk = _prodFields[_pi][0], _prate = _prodFields[_pi][1];
        if (_prate <= 0) continue;                                   // 非产区·不浮动(保持 0/剧本值)
        var _pNatural = Math.round(_mouthsB1 * _prate);
        var _pLastKey = '_' + _pk + 'NaturalLast';
        var _pBuilt = (typeof eb[_pLastKey] === 'number') ? Math.max(0, safeNumber(eb[_pk], 0) - eb[_pLastKey]) : 0;
        eb[_pk] = _pNatural + _pBuilt;
        eb[_pLastKey] = _pNatural;
      }

      // P1-B3a·皇庄田 imperialFarmland 随 farmland 同步(farmland 已活·皇庄田跟着浮动·imperialDomain 才有)
      if (div.tags.imperialDomain) eb.imperialFarmland = Math.round(eb.farmland * 0.05);
    }

    div._thisTurnLandFlow = {
      annexed: annexLoss,
      reclaimed: reclaimGain,
      surveyed: surveyed,
      net: -annexLoss + reclaimGain + surveyed,
      before: before,
      after: eb.farmland
    };
    return div._thisTurnLandFlow;
  }

  function estimateNationalMouths(G) {
    G = getGame(G);
    if (G && G.population && G.population.national && G.population.national.mouths > 0) {
      return G.population.national.mouths;
    }
    var total = 0;
    walkAdminDivisions(G, function(div) {
      var pop = div.populationDetail || (div.population && typeof div.population === 'object' ? div.population : null);
      total += safeNumber(pop && pop.mouths, safeNumber(typeof div.population === 'number' ? div.population : 0, 0));
    }, { leafOnly: true });
    return Math.max(50000000, total);
  }

  function normalizeTaxListForCascade(G, fc) {
    var taxes = [];
    // 数据驱动税制根治(2026-06)：剧本工坊/国师 authored 的 fiscalConfig.taxList(数组)为权威·**支持架空朝代**
    //   (税制是剧本内容非引擎常量·dynasty 硬编码遇架空即失效)。未 authored 则回落 DEFAULT_TAXES(零回归)。
    //   fc.taxes 若已是数组(旧式/enableTaxesByDynasty 前)亦兼容。
    if (Array.isArray(fc && fc.taxList) && fc.taxList.length) {
      taxes = fc.taxList.map(function(t) { return clone(t); });
    } else if (Array.isArray(fc && fc.taxes) && fc.taxes.length) {
      taxes = fc.taxes.map(function(t) { return clone(t); });
    } else {
      taxes = DEFAULT_TAXES.map(function(t) { return clone(t); });
    }

    var enabled = fc && fc.taxesEnabled;
    if (enabled && typeof enabled === 'object' && !Array.isArray(enabled)) {
      taxes = taxes.filter(function(t) {
        if (enabled[t.id] === false) return false;
        if (enabled[t.sourceTag] === false) return false;
        return true;
      });
    }

    if (Array.isArray(fc && fc.customTaxes)) {
      fc.customTaxes.forEach(function(ct) {
        if (!ct || !ct.id || !ct.formulaType) return;
        var occupation = typeof ct.occupationRate === 'number' ? Math.max(0, Math.min(0.99, ct.occupationRate)) : 0;
        var nominalRate = typeof ct.nominalRate === 'number' ? ct.nominalRate : ct.rate;
        var effectiveRate = typeof nominalRate === 'number' ? nominalRate * (1 - occupation) : null;
        var converted = null;
        if (ct.formulaType === 'perMu' && effectiveRate > 0) {
          converted = {
            id: ct.id,
            name: ct.name || ct.id,
            base: 'arableLand',
            baseFallback: 'mouths',
            baseFactor: 1,
            rate: effectiveRate,
            storeAs: ct.storeAs || 'money',
            sourceTag: ct.sourceTag || ct.id,
            annual: true,
            _nominalRate: nominalRate,
            _occupationRate: occupation
          };
        } else if (ct.formulaType === 'flat' && safeNumber(ct.amount, 0) > 0) {
          var effectiveAmount = safeNumber(ct.amount, 0) * (1 - occupation);
          converted = {
            id: ct.id,
            name: ct.name || ct.id,
            base: 'mouths',
            baseFallback: null,
            baseFactor: 1,
            rate: effectiveAmount / estimateNationalMouths(G),
            storeAs: ct.storeAs || 'money',
            sourceTag: ct.sourceTag || ct.id,
            annual: true,
            _nominalAmount: ct.amount,
            _occupationRate: occupation
          };
        } else if (ct.formulaType === 'perDing' && effectiveRate > 0) {
          converted = {
            id: ct.id,
            name: ct.name || ct.id,
            base: 'ding',
            baseFallback: 'mouths',
            baseFactor: 1,
            rate: effectiveRate,
            storeAs: ct.storeAs || 'money',
            sourceTag: ct.sourceTag || ct.id,
            annual: true,
            _nominalRate: nominalRate,
            _occupationRate: occupation
          };
        }
        if (converted) taxes.push(converted);
      });
    }
    return taxes;
  }

  function taxBase(div, tax) {
    var eb = _ensureEconomyBase(div) || {};
    var pop = div.populationDetail || (div.population && typeof div.population === 'object' ? div.population : null);
    var mouths = safeNumber(pop && pop.mouths, safeNumber(typeof div.population === 'number' ? div.population : eb.mouths, 0));
    if (tax.base === 'arableLand' || tax.base === 'land') {
      var arable = safeNumber(eb.farmland, 0) || safeNumber(eb.arableLand, 0);
      if (arable <= 0 && tax.baseFallback === 'mouths') arable = mouths * 0.3;
      return arable;
    }
    if (tax.base === 'mouths' || tax.base === 'head') return mouths;
    if (tax.base === 'ding') return safeNumber(pop && pop.ding, Math.floor(mouths * 0.25));
    if (tax.base === 'households' || tax.base === 'household') return safeNumber(pop && pop.households, Math.floor(mouths / 5));
    if (tax.base === 'prosperity') return safeNumber(div.prosperity, 50);
    if (tax.base === 'commerceVolume' || tax.base === 'commerce' || tax.base === 'trade') return safeNumber(eb.commerceVolume, safeNumber(div.prosperity, 50) * 10000);
    if (tax.base === 'consumption') return mouths;
    if (tax.base === 'mining') return safeNumber(eb.mineralProduction, 0);
    if (tax.base === 'imperial') return safeNumber(eb.imperialFarmland, 0) + safeNumber((eb.imperialAssets && Object.keys(eb.imperialAssets).length) || 0, 0) * 10000;
    if (tax.base && eb[tax.base] != null) return safeNumber(eb[tax.base], 0);
    return 0;
  }

  function computeTaxAmount(div, tax, ctx) {
    var base = taxBase(div, tax);
    if (base <= 0) return 0;
    var amount = base * safeNumber(tax.baseFactor, 1) * safeNumber(tax.rate, 0);
    if (tax.annual && ctx && ctx.turnFracOfYear) amount *= ctx.turnFracOfYear;

    var corruption = safeNumber(div.corruption, safeNumber(div.corruptionLocal, 0));
    var corrPenalty = Math.min(0.5, corruption / 100 * 0.4);
    var disasterPenalty = 0;
    if (div.environment && div.environment.currentLoad > 0.9) disasterPenalty = 0.2;
    if (div.environment && div.environment.ecoScars && Object.keys(div.environment.ecoScars).length > 0) disasterPenalty += 0.1;
    if (Array.isArray(div.economyBase && div.economyBase.disasterRecord) && div.economyBase.disasterRecord.length) disasterPenalty += 0.1;
    // 当前活跃天灾(GM.activeDisasters)对受灾区税基的折减·读单一生产者 _disasterEconomyReduce(applyDisasterEconomyReduction 每回合按区域写)
    // 治"灾不削税基":此前 disasterPenalty 只读静态历史/环境疤痕(disasterRecord/ecoScars)·不读正在发生的灾→受灾区照常足额征税
    if (div._disasterEconomyReduce) {
      var _derField = (tax.base === 'commerceVolume' || tax.base === 'commerce' || tax.base === 'trade') ? 'commerceVolume' : 'farmland';
      disasterPenalty += safeNumber(div._disasterEconomyReduce[_derField], 0);
    }
    disasterPenalty = Math.min(0.5, disasterPenalty);

    var exemption = 0;
    if (div.regionType === 'jimi' || div.regionType === 'tusi' || div.regionType === 'fanbang') exemption = 0.7;
    if (div.regionType === 'imperial_clan') exemption = Math.max(exemption, 0.5);

    var disruption = 0;
    if (div._warZone) disruption = 0.3;
    if (div._revoltActive) disruption = Math.max(disruption, 0.5);

    // S6（2026-06-12）逃隐户税基折减：逃户全免、隐户六成不纳，封顶 35%。
    // 无 fugitives/hiddenCount 数据 = 0 = 行为不变（零数据零变更）。
    var fleePenalty = 0;
    try {
      var _fp = (typeof TM !== 'undefined' && TM.FieldPipes) || (typeof window !== 'undefined' && window.TM && window.TM.FieldPipes);
      if (_fp && typeof _fp.fleeTaxPenalty === 'function') fleePenalty = _fp.fleeTaxPenalty(div) || 0;
    } catch (_) {}

    // 地块状态乘子（2026-06-12）：奇观/灾异/圣裁/风云/营造之利 → 地方经济一本账的读取点。
    // 零状态 = 1 = 行为不变；模块缺位安全。
    var statusMult = 1;
    try {
      var _rs = (typeof TM !== 'undefined' && TM.RegionStatus) || (typeof window !== 'undefined' && window.TM && window.TM.RegionStatus);
      if (_rs && typeof _rs.econMult === 'function') statusMult = _rs.econMult(div) || 1;
    } catch (_) {}

    var autonomy = Math.max(0, Math.min(1, safeNumber(div.fiscal && div.fiscal.autonomyLevel, 0)));
    // 年度赋役总纲·税率调整真入征收（2026-06-15·#6 假数字治理收尾）：玩家在赋役滑块设的 taxRateAdjust
    //   此前只算了 _annualFuyiAdjust 却无人读入收入。此处接入权威 cascade 税额路径——仅对年度农赋
    //   （赋役之所指）生效·无政令=0=乘 1 不改旧行为·夹 ±50% 防极端。让"赋役滑块"从空旋钮变真。
    var fuyiMult = 1;
    if (tax && tax.annual) {
      try {
        var _gFuyi = getGame();
        var _fcfg = (_gFuyi && _gFuyi.fiscalConfig) || (typeof P !== 'undefined' && P && P.fiscalConfig) || {};
        var _fa = _fcfg.annualFuyi && Number(_fcfg.annualFuyi.taxRateAdjust);
        if (isFinite(_fa) && _fa !== 0) fuyiMult = 1 + Math.max(-0.5, Math.min(0.5, _fa));
      } catch (_) {}
    }
    // 通胀/降成色侵蚀财政（#27·货币系统接权威税收）：主币购买力 <1(通胀或铜钱降成色)时·money 计价税实收按购买力缺口折减
    //   让"降成色短期铸息暴利→长期通胀蚀税基"成真权衡(原 CurrencyEngine 算通胀/降成色却零反馈进 CascadeTax·通胀拉满国库一文不少)
    //   仅 money 税(粮/布实物不折)·夹 ≤35%·CurrencyEngine 缺位/购买力≥1 = 不折 = 旧行为(零数据零变更)
    var inflationPenalty = 0;
    if ((tax.storeAs || 'money') === 'money') {
      try {
        // 购买力访问器实际挂在 EconomyGapFill/EconomyCore（tm-economy-engine.js），不在 CurrencyEngine——
        // #27 初版误取 CurrencyEngine.getPurchasingPower 恒 undefined，inflationPenalty 永远 0（prod 死线，smoke 桩掩盖）。此处按真命名空间优先查找。
        var _ce = (typeof window !== 'undefined' && (window.EconomyGapFill || window.EconomyCore || window.CurrencyEngine)) || (typeof global !== 'undefined' && (global.EconomyGapFill || global.EconomyCore || global.CurrencyEngine)) || (typeof EconomyGapFill !== 'undefined' && EconomyGapFill) || (typeof CurrencyEngine !== 'undefined' && CurrencyEngine) || null;
        if (_ce && typeof _ce.getPurchasingPower === 'function') {
          var _pp = _ce.getPurchasingPower();
          if (isFinite(_pp) && _pp < 1) inflationPenalty = Math.min(0.35, 1 - _pp);
        }
      } catch (_) {}
    }
    amount = amount * (1 - corrPenalty) * (1 - disasterPenalty) * (1 - exemption) * (1 - disruption) * (1 - fleePenalty) * (1 - autonomy * 0.8) * (1 - inflationPenalty) * statusMult * fuyiMult;
    return Math.max(0, Math.round(amount));
  }

  function splitCascadeAmount(div, tax, amount, ctx) {
    var rules = ctx.centralLocalRules || DEFAULT_ALLOCATION;
    var perTax = rules.perTax || DEFAULT_ALLOCATION.perTax;
    var regionOverride = null;
    if (rules.regionOverrides) {
      regionOverride = rules.regionOverrides[div.id] || rules.regionOverrides[div.name] || null;
    }
    var cfg = (regionOverride && regionOverride.perTax && (regionOverride.perTax[tax.id] || regionOverride.perTax[tax.sourceTag]))
      || perTax[tax.id]
      || perTax[tax.sourceTag]
      || rules.defaultPerTax
      || DEFAULT_ALLOCATION.defaultPerTax;
    var qiyun = cfg.qiyun != null ? safeNumber(cfg.qiyun, 0.7) : safeNumber(cfg.central, 0.7);
    var cunliu = cfg.cunliu != null ? safeNumber(cfg.cunliu, 1 - qiyun) : safeNumber(cfg.local, 1 - qiyun);
    if (tax.id === 'liaoxiang' || tax.sourceTag === 'liaoxiang') {
      qiyun = Math.max(qiyun, 0.95);
      cunliu = Math.max(0, 1 - qiyun);
    }
    var compliance = div.fiscal && div.fiscal.compliance != null ? safeNumber(div.fiscal.compliance, 0.85) : 0.85;
    var qiyunGross = amount * qiyun;
    var cunliuAmount = amount * cunliu;
    var qiyunNet = qiyunGross * compliance;
    var skimmed = qiyunGross - qiyunNet;
    var lossRate = ctx.logisticsLoss != null ? safeNumber(ctx.logisticsLoss, DEFAULT_LOGISTICS_LOSS) : DEFAULT_LOGISTICS_LOSS;
    var lost = qiyunNet * lossRate;
    return {
      toCentral: Math.max(0, Math.round(qiyunNet - lost)),
      cunliu: Math.max(0, Math.round(cunliuAmount)),
      skimmed: Math.max(0, Math.round(skimmed)),
      lostInTransit: Math.max(0, Math.round(lost))
    };
  }

  function ensurePublicTreasury(div) {
    if (!div.publicTreasury) div.publicTreasury = {};
    ['money', 'grain', 'cloth'].forEach(function(kind) {
      if (!div.publicTreasury[kind]) div.publicTreasury[kind] = {};
      var box = div.publicTreasury[kind];
      if (typeof box.stock !== 'number') box.stock = safeNumber(box.stock, 0);
      if (typeof box.available !== 'number') box.available = safeNumber(box.available, box.stock);
      if (typeof box.quota !== 'number') box.quota = safeNumber(box.quota, 0);
      if (typeof box.used !== 'number') box.used = safeNumber(box.used, 0);
      if (typeof box.deficit !== 'number') box.deficit = safeNumber(box.deficit, 0);
    });
    return div.publicTreasury;
  }

  function ensureCharWealth(ch) {
    if (!ch.resources) ch.resources = {};
    if (!ch.resources.privateWealth) ch.resources.privateWealth = {};
    var w = ch.resources.privateWealth;
    if (w.money === undefined && w.cash !== undefined) w.money = w.cash;
    if (w.money === undefined) w.money = 0;
    if (w.grain === undefined) w.grain = 0;
    if (w.cloth === undefined) w.cloth = 0;
    if (w.land === undefined) w.land = 0;
    if (w.treasure === undefined) w.treasure = 0;
    if (w.slaves === undefined) w.slaves = 0;
    if (w.commerce === undefined) w.commerce = 0;
    return w;
  }

  function cascadeDivision(div, taxes, ctx, ledgers, totals, G) {
    if (!div) return;
    _ensureRegionFiscal(div);
    ensurePublicTreasury(div);
    _ensureEconomyBase(div);
    totals.divisionCount += 1;

    ['money', 'grain', 'cloth'].forEach(function(kind) {
      var rf = div.fiscal.ledgers && div.fiscal.ledgers[kind];
      if (rf) resetTurnLedger(rf, true);
    });

    if (div.fiscal && (div.fiscal.claimedRevenue || div.fiscal.actualRevenue || div.fiscal.remittedToCenter)) {
      div._lastTurnFiscal = {
        claimedRevenue: safeNumber(div.fiscal.claimedRevenue, 0),
        actualRevenue: safeNumber(div.fiscal.actualRevenue, 0),
        remittedToCenter: safeNumber(div.fiscal.remittedToCenter, 0),
        retainedBudget: safeNumber(div.fiscal.retainedBudget, 0),
        farmland: safeNumber(div.economyBase && div.economyBase.farmland, 0)
      };
    }

    _settleLandFlow(div, ctx);

    var claimedTotal = 0;
    var actualTotal = 0;
    var remitMoney = 0;
    var retainMoney = 0;
    var contribByCategory = {};
    var govName = div.governor || div.currentHead || null;
    var govChar = null;
    if (govName && Array.isArray(G.chars)) {
      for (var gi = 0; gi < G.chars.length; gi++) {
        if (G.chars[gi] && G.chars[gi].name === govName) { govChar = G.chars[gi]; break; }
      }
    }

    taxes.forEach(function(tax) {
      var amount = computeTaxAmount(div, tax, ctx);
      if (amount <= 0) return;
      var storeAs = tax.storeAs || 'money';
      if (!totals.central[storeAs]) totals.central[storeAs] = 0;
      if (!totals.localRetain[storeAs]) totals.localRetain[storeAs] = 0;
      if (!totals.skimmed[storeAs]) totals.skimmed[storeAs] = 0;
      if (!totals.lostTransit[storeAs]) totals.lostTransit[storeAs] = 0;

      claimedTotal += amount;
      var split = splitCascadeAmount(div, tax, amount, ctx);
      actualTotal += split.toCentral + split.cunliu;

      var centralLedger = storeAs === 'grain' ? ledgers.grain : (storeAs === 'cloth' ? ledgers.cloth : ledgers.money);
      addToLedger(centralLedger, split.toCentral, tax.sourceTag || tax.id);
      totals.central[storeAs] += split.toCentral;
      totals.localRetain[storeAs] += split.cunliu;
      totals.skimmed[storeAs] += split.skimmed;
      totals.lostTransit[storeAs] += split.lostInTransit;
      if (storeAs === 'money') {
        remitMoney += split.toCentral;
        retainMoney += split.cunliu;
      }

      var catKey = tax.sourceTag || tax.id;
      contribByCategory[catKey] = safeNumber(contribByCategory[catKey], 0) + split.toCentral;
      if (!totals.contribByCategory) totals.contribByCategory = {};
      if (!totals.contribByCategory[catKey]) totals.contribByCategory[catKey] = {};
      var divName = div.name || div.id || 'unknown';
      totals.contribByCategory[catKey][divName] = safeNumber(totals.contribByCategory[catKey][divName], 0) + split.toCentral;

      if (div.fiscal.ledgers && div.fiscal.ledgers[storeAs]) {
        var rfLed = div.fiscal.ledgers[storeAs];
        rfLed.stock = safeNumber(rfLed.stock, 0) + split.cunliu;
        rfLed.thisTurnIn = safeNumber(rfLed.thisTurnIn, 0) + split.cunliu;
      }
      if (div.publicTreasury && div.publicTreasury[storeAs]) {
        div.publicTreasury[storeAs].stock = safeNumber(div.publicTreasury[storeAs].stock, 0) + split.cunliu;
        div.publicTreasury[storeAs].available = safeNumber(div.publicTreasury[storeAs].available, 0) + split.cunliu;
      }

      if (govChar && split.skimmed > 0) {
        var wealth = ensureCharWealth(govChar);
        var hit = Math.round(split.skimmed * 0.5);
        if (storeAs === 'money') wealth.money = safeNumber(wealth.money, 0) + hit;
        if (storeAs === 'grain') wealth.grain = safeNumber(wealth.grain, 0) + hit;
        if (storeAs === 'cloth') wealth.cloth = safeNumber(wealth.cloth, 0) + hit;
      }
    });

    // 2026-06-12 归零病修：cascade 在此区划一文未征（无 economyBase 税基/全免科）时，
    // 不得用 0 抹掉剧本静态账——否则册页「应征 234 万/实征 0」自相矛盾、财赋视图直接归零。
    // 一文未征 = 本引擎对此地无话语权，账面保持原样（剧本/上回合值）。
    if (claimedTotal <= 0 && actualTotal <= 0) {
      div.fiscal._cascadeIdleTurn = (ctx && ctx.turn) || true; // 留痕：本回合 cascade 未触此账
      return;
    }
    div.fiscal.claimedRevenue = claimedTotal;
    div.fiscal.actualRevenue = actualTotal;
    div.fiscal.remittedToCenter = remitMoney;
    div.fiscal.retainedBudget = retainMoney;
    div.fiscal.claimed = claimedTotal;
    div.fiscal.actual = actualTotal;
    div.fiscal.remitted = remitMoney;
    div.fiscal.retained = retainMoney;
    div.fiscal.annualTax = ctx.turnFracOfYear > 0 ? Math.round(actualTotal / ctx.turnFracOfYear) : actualTotal;
    div.fiscal._thisTurnRemitMoney = remitMoney;
    div.fiscal.contributionsByCategory = contribByCategory;
  }

  function aggregateParentFiscal(G) {
    function fold(node) {
      if (!node || typeof node !== 'object') return null;
      _ensureRegionFiscal(node);
      var groups = childArrays(node);
      var hasChild = false;
      var sum = { claimedRevenue: 0, actualRevenue: 0, remittedToCenter: 0, retainedBudget: 0 };
      for (var i = 0; i < groups.length; i++) {
        for (var j = 0; j < groups[i].length; j++) {
          hasChild = true;
          var child = fold(groups[i][j]);
          if (!child) continue;
          sum.claimedRevenue += safeNumber(child.claimedRevenue, 0);
          sum.actualRevenue += safeNumber(child.actualRevenue, 0);
          sum.remittedToCenter += safeNumber(child.remittedToCenter, 0);
          sum.retainedBudget += safeNumber(child.retainedBudget, 0);
        }
      }
      if (hasChild) {
        node.fiscal.claimedRevenue = sum.claimedRevenue;
        node.fiscal.actualRevenue = sum.actualRevenue;
        node.fiscal.remittedToCenter = sum.remittedToCenter;
        node.fiscal.retainedBudget = sum.retainedBudget;
        node.fiscal.claimed = sum.claimedRevenue;
        node.fiscal.actual = sum.actualRevenue;
        node.fiscal.remitted = sum.remittedToCenter;
        node.fiscal.retained = sum.retainedBudget;
        return node.fiscal;
      }
      return node.fiscal;
    }
    walkAdminDivisions(G, function(div) { fold(div); }, { leafOnly: false });
  }

  function pushCascadeTurnChanges(G, totals) {
    if (!G.turnChanges || !Array.isArray(G.turnChanges.variables)) return;
    function push(name, value, reason) {
      if (!value) return;
      G.turnChanges.variables.push({
        name: name,
        oldValue: 0,
        newValue: Math.round(value),
        delta: Math.round(value),
        reasons: [{ type: 'cascade', amount: Math.round(value), desc: reason }]
      });
    }
    push('上解中央·钱', totals.central.money, '本回合各区上解中央钱');
    push('上解中央·粮', totals.central.grain, '本回合各区上解中央粮');
    push('上解中央·布', totals.central.cloth, '本回合各区上解中央布');
    push('地方留存·钱', totals.localRetain.money, '州县留存日常用度');
    push('胥吏私分', totals.skimmed.money, '腐败漏损');
    push('路途损耗·钱', totals.lostTransit.money, '漕运/陆运损耗');
  }

  // ═══ 活跃天灾 → 受灾区税基折减（治"灾不削税基"+复活死字段 _disasterEconomyReduce）═══
  // 单一生产者：每回合(collect 开头)按 GM.activeDisasters 的 region 写各 division 的 _disasterEconomyReduce(清-设·无灾即清·防陈旧泄漏)。
  // 两消费方各取：computeTaxAmount(权威 cascade·加进 disasterPenalty) + sumEconomyBase(兜底/聚合·已 *=(1-reduce))·不同收入路径不双扣。
  function _disasterReduceFields(cat, severity) {
    var sv = String(severity == null ? '' : severity).toLowerCase();
    var sevF = (/severe|严重|major|大|extreme|catastroph/.test(sv)) ? 0.35 : (/minor|light|轻|small|小/.test(sv) ? 0.1 : 0.2); // 默认 moderate 0.2(小系数)
    var c = String(cat || '').toLowerCase();
    var farm = 0, commerce = 0;
    if (/(旱|drought)/.test(c)) farm = sevF;
    else if (/(蝗|locust)/.test(c)) farm = sevF;
    else if (/(水|洪|flood)/.test(c)) { farm = sevF; commerce = sevF * 0.5; }
    else if (/(瘟|疫|plague)/.test(c)) { farm = sevF * 0.7; commerce = sevF * 0.5; }
    else if (/(震|quake|earthquake)/.test(c)) { farm = sevF * 0.6; commerce = sevF * 0.6; }
    else { farm = sevF * 0.5; }
    return { farmland: farm, commerceVolume: commerce };
  }
  function _divMatchesDisasterRegion(div, parent, region) {
    if (!region) return false;
    var rg = String(region).trim();
    if (!rg) return false;
    var cands = [div && div.name, div && div.id, div && div.regionName, div && div.province, parent && parent.name, parent && parent.id];
    for (var i = 0; i < cands.length; i++) {
      var c = cands[i]; if (c == null) continue; c = String(c).trim(); if (!c) continue;
      if (c === rg) return true;
      if (rg.length >= 2 && (c.indexOf(rg) >= 0 || rg.indexOf(c) >= 0)) return true; // 省名子串(陕西 ↔ 陕西布政司)·≥2字防单字误配
    }
    return false;
  }
  function applyDisasterEconomyReduction(G) {
    G = getGame(G);
    if (!G || !G.adminHierarchy) return 0;
    var disasters = Array.isArray(G.activeDisasters) ? G.activeDisasters : [];
    var _b4on = !(global.P && global.P.conf && global.P.conf.productionFloatEnabled === false);  // P1-B4·默认开·显式 false 才关(owner 拍板)
    var dlist = [];
    for (var k = 0; k < disasters.length; k++) {
      var d = disasters[k]; if (!d) continue;
      dlist.push({ region: d.region, fields: _disasterReduceFields(d.category || d.type, d.severity), type: d.type || d.category, severity: d.severity });
    }
    var affected = 0;
    walkAdminDivisions(G, function(div, parent) {
      if (!div) return;
      if (!dlist.length) { if (div._disasterEconomyReduce) div._disasterEconomyReduce = null; return; } // 无灾 → 清(防陈旧泄漏)
      var farm = 0, comm = 0, hit = false, matched = null;
      for (var i = 0; i < dlist.length; i++) {
        if (_divMatchesDisasterRegion(div, parent, dlist[i].region)) { hit = true; farm = Math.max(farm, dlist[i].fields.farmland); comm = Math.max(comm, dlist[i].fields.commerceVolume); if (!matched) matched = dlist[i]; }
      }
      if (hit) {
        div._disasterEconomyReduce = { farmland: Math.min(0.6, farm), commerceVolume: Math.min(0.6, comm) };
        affected++;
        // P1-B4·天灾 push disasterRecord(让面板「在灾实录」显近期灾异·同回合同类去重·限近 8 条)
        if (_b4on && matched) {
          if (!div.economyBase) div.economyBase = {};
          if (!Array.isArray(div.economyBase.disasterRecord)) div.economyBase.disasterRecord = [];
          var _drec = div.economyBase.disasterRecord, _exists = false;
          for (var _ri = 0; _ri < _drec.length; _ri++) { if (_drec[_ri] && _drec[_ri].startTurn === G.turn && _drec[_ri].type === matched.type) { _exists = true; break; } }
          if (!_exists) { _drec.push({ type: matched.type, severity: matched.severity, startTurn: G.turn }); if (_drec.length > 8) div.economyBase.disasterRecord = _drec.slice(-8); }
        }
      }
      else if (div._disasterEconomyReduce) { div._disasterEconomyReduce = null; } // 此区已无灾 → 清
    }, { leafOnly: false });
    return affected;
  }

  function cascadeCollect(opts) {
    var G = getGame();
    if (!G || !G.adminHierarchy) return { ok: false, reason: 'no adminHierarchy' };
    // 回合幂等(2026-07-04 审查定罪)：征税埋在 sc1 体内·推演失败重试整段重跑=同回合双征。
    // 非 force 且本回合已开征即跳过；旗标开征即置(宁少征一回合·不双征)。
    if (!(opts && opts.force) && G._lastCascadeTaxTurn != null && G._lastCascadeTaxTurn === (G.turn || 0)) {
      return { ok: false, skipped: 'already-collected-this-turn' };
    }
    G._lastCascadeTaxTurn = G.turn || 0;
    applyDisasterEconomyReduction(G); // 每回合刷新受灾区税基折减(清-设·幂等)·须在 per-division 征税前

    opts = opts || {};
    var fc = getFiscalConfig(G);
    var taxes = normalizeTaxListForCascade(G, fc);
    var ledgers = ensureGuoku(G);
    resetTurnLedger(ledgers.money, false);
    resetTurnLedger(ledgers.grain, false);
    resetTurnLedger(ledgers.cloth, false);
    reconcileLedgerScalar(ledgers.money, G.guoku.money, G.guoku.balance);
    reconcileLedgerScalar(ledgers.grain, G.guoku.grain, null);
    reconcileLedgerScalar(ledgers.cloth, G.guoku.cloth, null);

    var turnDays = getTurnDays(opts, G);
    var turnFrac = Math.max(0.01, Math.min(1, turnDays / 365));
    var ctx = {
      centralLocalRules: fc.centralLocalRules || DEFAULT_ALLOCATION,
      logisticsLoss: fc.logisticsLoss != null ? safeNumber(fc.logisticsLoss, DEFAULT_LOGISTICS_LOSS) : DEFAULT_LOGISTICS_LOSS,
      turnDays: turnDays,
      turnFracOfYear: turnFrac
    };

    var totals = {
      central: { money: 0, grain: 0, cloth: 0 },
      localRetain: { money: 0, grain: 0, cloth: 0 },
      skimmed: { money: 0, grain: 0, cloth: 0 },
      lostTransit: { money: 0, grain: 0, cloth: 0 },
      divisionCount: 0,
      contribByCategory: {}
    };

    walkAdminDivisions(G, function(div) {
      cascadeDivision(div, taxes, ctx, ledgers, totals, G);
    }, { faction: opts.faction || 'player', leafOnly: true });

    aggregateParentFiscal(G);
    syncAccountScalars(G.guoku, ledgers);
    G.guoku.turnIncome = Math.round(totals.central.money);
    G.guoku.turnGrainIncome = Math.round(totals.central.grain);
    G.guoku.turnClothIncome = Math.round(totals.central.cloth);
    G.guoku.turnDays = turnDays;
    G.guoku.monthlyIncome = Math.round(totals.central.money * (30 / Math.max(1, turnDays)));
    G.guoku.monthlyGrainIncome = Math.round(totals.central.grain * (30 / Math.max(1, turnDays)));
    G.guoku.monthlyClothIncome = Math.round(totals.central.cloth * (30 / Math.max(1, turnDays)));
    G.guoku.annualIncome = turnFrac > 0 ? Math.round(totals.central.money / turnFrac) : 0;
    G.guoku.annualGrainIncome = turnFrac > 0 ? Math.round(totals.central.grain / turnFrac) : 0;
    G.guoku.annualClothIncome = turnFrac > 0 ? Math.round(totals.central.cloth / turnFrac) : 0;

    G.guoku.sources = {};
    var tagToLegacy = {
      tianfu: 'tianfu',
      tianfu_silver: 'tianfu',
      dingshui: 'dingshui',
      yongBu: 'qita',
      shangShui: 'shipaiShui',
      yanlizhuan: 'yanlizhuan',
      caoliang: 'caoliang'
    };
    ['money', 'grain', 'cloth'].forEach(function(kind) {
      var led = ledgers[kind];
      Object.keys(led.sources || {}).forEach(function(tag) {
        var key = tagToLegacy[tag] || tag;
        G.guoku.sources[key] = safeNumber(G.guoku.sources[key], 0) + safeNumber(led.sources[tag], 0);
      });
    });

    G.guoku._sourceContributors = totals.contribByCategory || {};
    var customStats = {};
    var customMeta = {};
    taxes.forEach(function(tax) {
      if (tax._nominalRate == null && tax._nominalAmount == null && tax._occupationRate == null) return;
      var key = tax.sourceTag || tax.id;
      var turnAmount = 0;
      var contrib = totals.contribByCategory[key] || {};
      Object.keys(contrib).forEach(function(divName) { turnAmount += safeNumber(contrib[divName], 0); });
      customStats[key] = {
        name: tax.name || key,
        amount: turnFrac > 0 ? Math.round(turnAmount / turnFrac) : Math.round(turnAmount),
        turnAmount: Math.round(turnAmount),
        nominalRate: tax._nominalRate,
        nominalAmount: tax._nominalAmount,
        occupationRate: tax._occupationRate || 0
      };
      customMeta[key] = {
        name: tax.name || key,
        nominalRate: tax._nominalRate,
        nominalAmount: tax._nominalAmount,
        occupationRate: tax._occupationRate || 0,
        effectiveRate: tax.rate,
        formulaType: tax.base === 'arableLand' ? 'perMu' : (tax.base === 'ding' ? 'perDing' : (tax._nominalAmount != null ? 'flat' : 'other'))
      };
    });
    G.guoku._customTaxStats = customStats;
    G.guoku._customTaxMeta = customMeta;
    G._lastCascadeSummary = totals;
    G._lastCascadeTurn = G.turn || 0;
    pushCascadeTurnChanges(G, totals);
    return { ok: true, totals: totals };
  }

  function cascadeTick(ctx) {
    try { return cascadeCollect(ctx); } catch (e) {
      if (global.TM && global.TM.errors && global.TM.errors.capture) global.TM.errors.capture(e, 'CascadeTax.tick');
      else if (typeof console !== 'undefined' && console.error) console.error('[CascadeTax.tick]', e);
      return { ok: false, error: e && e.message || String(e) };
    }
  }

  function sumEconomyBase(field, opts) {
    opts = opts || {};
    var G = getGame();
    if (!G || !G.adminHierarchy) return 0;
    var total = 0;
    walkAdminDivisions(G, function(div) {
      var eb = _ensureEconomyBase(div);
      var value = safeNumber(eb && eb[field], 0);
      if (opts.requireTag && (!div.tags || !div.tags[opts.requireTag])) value = 0;
      var reduce = safeNumber(div._disasterEconomyReduce && div._disasterEconomyReduce[field], 0);
      if (reduce > 0) value *= Math.max(0, 1 - reduce);
      total += value;
    }, { faction: opts.faction || null, leafOnly: false });
    return total;
  }

  function getDivEconomy(divId, field) {
    var found = null;
    walkAdminDivisions(getGame(), function(div) {
      if (found) return;
      if (div.id === divId || div.name === divId || div.code === divId) found = div;
    }, { leafOnly: false });
    if (!found) return 0;
    var eb = _ensureEconomyBase(found);
    return safeNumber(eb && eb[field], 0);
  }

  function getTopContributors(category, topN) {
    var G = getGame();
    if (!G || !G.guoku || !G.guoku._sourceContributors) return [];
    var map = G.guoku._sourceContributors[category] || {};
    var rows = Object.keys(map).map(function(name) {
      return { name: name, amount: safeNumber(map[name], 0) };
    });
    rows.sort(function(a, b) { return b.amount - a.amount; });
    var total = rows.reduce(function(sum, row) { return sum + row.amount; }, 0);
    rows.forEach(function(row) { row.pct = total > 0 ? row.amount / total * 100 : 0; });
    return rows.slice(0, topN || 5);
  }

  function triggerSurvey(divIdOrName) {
    var found = null;
    walkAdminDivisions(getGame(), function(div) {
      if (found) return;
      if (div.id === divIdOrName || div.name === divIdOrName || div.code === divIdOrName) found = div;
    }, { leafOnly: false });
    if (!found) return false;
    found._surveyTrigger = true;
    return true;
  }

  // P-VWF·2026-05-29·确定性升本势力各 division 的 compliance（cascade 真读·splitCascadeAmount qiyunNet=qiyunGross×compliance）
  // 复用 walkAdminDivisions 正确遍历·delta 由对账层给（AI 力度 或 粗保底）·此处只夹安全护栏·返回生效 division 数
  function adjustPlayerCompliance(faction, delta, clampMin, clampMax) {
    var d = Number(delta) || 0;
    if (!d) return 0;
    var lo = typeof clampMin === 'number' ? clampMin : 0.1;
    var hi = typeof clampMax === 'number' ? clampMax : 1;
    var n = 0;
    walkAdminDivisions(getGame(), function(div, parent, fac) {
      if (faction && fac && fac !== faction) return;
      if (div && div.fiscal && typeof div.fiscal.compliance === 'number') {
        div.fiscal.compliance = Math.max(lo, Math.min(hi, div.fiscal.compliance + d));
        n++;
      }
    }, { faction: faction || undefined });
    return n;
  }

  // P-DZ·2026-05-29·确定性降本势力各 division 的 corruption（cascade corrPenalty 真读·computeTaxAmount → 中央实收；且 aggregateRegionsToVariables 把它聚合成 subDepts.provincial.true → 实征率面板）
  // delta 由对账层给（AI 力度 或 粗保底·负值=降浊度）·此处只夹安全护栏·返回生效 division 数
  function adjustPlayerDivisionCorruption(faction, delta, clampMin, clampMax) {
    var d = Number(delta) || 0;
    if (!d) return 0;
    var lo = typeof clampMin === 'number' ? clampMin : 0;
    var hi = typeof clampMax === 'number' ? clampMax : 100;
    var n = 0;
    walkAdminDivisions(getGame(), function(div, parent, fac) {
      if (faction && fac && fac !== faction) return;
      if (div && typeof div.corruption === 'number') {
        div.corruption = Math.max(lo, Math.min(hi, div.corruption + d));
        n++;
      }
    }, { faction: faction || undefined });
    return n;
  }

  // P-VWF·对本势力每个 division 触发清丈（triggerSurvey 现成·按 landsAnnexed 查回隐田）·返回触发数
  function triggerPlayerSurvey(faction) {
    var n = 0;
    walkAdminDivisions(getGame(), function(div, parent, fac) {
      if (faction && fac && fac !== faction) return;
      var id = div && (div.id || div.name || div.code);
      if (id && triggerSurvey(id)) n++;
    }, { faction: faction || undefined });
    return n;
  }

  function getSalaryConfig(G) {
    var fc = getFiscalConfig(G);
    var cfg = {};
    if (fc.fixedExpense) copyFields(cfg, fc.fixedExpense);
    if (G && G.fiscal && G.fiscal.fixedExpense) copyFields(cfg, G.fiscal.fixedExpense);
    return cfg;
  }

  function salaryTable(cfg) {
    var table = {};
    copyFields(table, DEFAULT_RANK_SALARY);
    if (cfg && cfg.salaryMonthlyPerRank) copyFields(table, cfg.salaryMonthlyPerRank);
    return table;
  }

  function salaryUnit(cfg) {
    var note = String((cfg && cfg.salaryNote) || '');
    if (/[石米]|月米石|米石/.test(note)) return 'grain_stone';
    if (/[贯文]/.test(note)) return 'coin';
    return 'silver';
  }

  // S1·俸禄认人开关(默认关)。原 calcSalary 只认「编制×虚拟在岗率」·换谁来当、冗员超编对国库零差别。
  //   开 → 实有人数超编制虚拟在岗时按实有计俸(冗官有财政代价)。关 → 零回归。
  //   启用：P.conf.officeSalaryHeadcountEnabled = true（或 P.ai.同名）。
  function _salaryHeadcountOn() {
    var P = global.P || {};
    return !!((P.conf && P.conf.officeSalaryHeadcountEnabled) || (P.ai && P.ai.officeSalaryHeadcountEnabled));
  }
  // 职位实有人数(跨新旧双模型：actualHolders 已具象 优先·否则 holder + additionalHolders)
  function _salaryActualBodies(pos) {
    if (!pos) return 0;
    var ah = Array.isArray(pos.actualHolders)
      ? pos.actualHolders.filter(function (h) { return h && h.name && h.generated !== false; }).length : 0;
    if (ah > 0) return ah;
    var n = (pos.holder && pos.holder !== '空缺' && pos.holder !== '(空缺)') ? 1 : 0;
    if (Array.isArray(pos.additionalHolders)) n += pos.additionalHolders.filter(Boolean).length;
    return n;
  }

  function calcSalary(ctx) {
    var G = getGame();
    var cfg = getSalaryConfig(G);
    var turnDays = getTurnDays(ctx, G);
    if (cfg.salaryAnnualOverride) {
      var ov = cfg.salaryAnnualOverride;
      var yf = turnDays / 365;
      return {
        total: {
          money: safeNumber(ov.money, 0) * yf,
          grain: safeNumber(ov.grain, 0) * yf,
          cloth: safeNumber(ov.cloth, 0) * yf
        },
        byDept: { override: safeNumber(ov.money, 0) * yf },
        unit: 'annual_override'
      };
    }

    var table = salaryTable(cfg);
    var unit = salaryUnit(cfg);
    var grainRatio = cfg.salaryGrainRatio != null ? safeNumber(cfg.salaryGrainRatio, 0.3) : 0.3;
    var stoneToSilver = cfg.salaryStoneToSilver != null ? safeNumber(cfg.salaryStoneToSilver, 0.6) : 0.6;
    var turnFracMonth = turnDays / 30;
    var virtualFillRate = cfg.virtualFillRate != null ? safeNumber(cfg.virtualFillRate, 0.6) : 0.6;
    var total = { money: 0, grain: 0, cloth: 0 };
    var byDept = {};

    function walkOffice(nodes, path) {
      (nodes || []).forEach(function(node) {
        if (!node) return;
        var dept = (path ? path + '·' : '') + (node.name || '');
        (node.positions || []).forEach(function(pos) {
          if (!pos) return;
          var hasHolder = !!(pos.holder && pos.holder !== '空缺' && pos.holder !== '(空缺)');
          var established = safeNumber(pos.establishedCount, 1);
          var heads = hasHolder ? Math.max(1, Math.floor(established * virtualFillRate)) : 0;
          if (!hasHolder && established > 5) heads = Math.floor(established * virtualFillRate * 0.5);
          // S1·俸禄认人(flag 默认关)：实有人数超过编制虚拟在岗(冗员超编) → 按实有计俸(冗官有财政代价)。
          //   关 → heads 不变=零回归；开且超编 → heads=实有。空缺/常编/缺员不变(只惩超编·缺员不另省)。
          if (_salaryHeadcountOn()) {
            var _bodies = _salaryActualBodies(pos);
            if (_bodies > heads) heads = _bodies;
          }
          if (heads <= 0) return;
          var monthly = pos.salary != null ? safeNumber(pos.salary, 0)
            : (pos.perPersonSalary != null ? safeNumber(pos.perPersonSalary, 0)
              : safeNumber(table[pos.rank], DEFAULT_UNRANKED_SALARY));
          var amount = monthly * turnFracMonth * heads;
          if (pos.salaryKind && total[pos.salaryKind] != null) total[pos.salaryKind] += amount;
          else if (unit === 'grain_stone') {
            total.grain += amount * grainRatio;
            total.money += amount * (1 - grainRatio) * stoneToSilver;
          } else {
            total.money += amount;
          }
          byDept[dept] = safeNumber(byDept[dept], 0) + amount;
        });
        if (node.subs) walkOffice(node.subs, dept);
        if (node.children) walkOffice(node.children, dept);
      });
    }
    walkOffice((G && G.officeTree) || [], '');
    return { total: total, byDept: byDept, unit: unit };
  }

  function calcRoyalStipend(ctx) {
    var G = getGame();
    var fc = getFiscalConfig(G);
    var rcp = (fc.neicangRules && fc.neicangRules.royalClanPressure)
      || (G && G.neitang && G.neitang.neicangRules && G.neitang.neicangRules.royalClanPressure)
      || (G && G.fiscal && G.fiscal.royalClanPressure)
      || null;
    if (!rcp || !rcp.enabled) return { total: { money: 0, grain: 0, cloth: 0 }, members: 0, arrears: 0 };
    var annualStone = safeNumber(rcp.annualStipendPaid, 0) * 10000;
    var turnFrac = getTurnDays(ctx, G) / 365;
    var stoneThis = annualStone * turnFrac;
    var cfg = getSalaryConfig(G);
    var grainRatio = cfg.royalGrainRatio != null ? safeNumber(cfg.royalGrainRatio, 0.5) : 0.5;
    var stoneToSilver = cfg.salaryStoneToSilver != null ? safeNumber(cfg.salaryStoneToSilver, 0.6) : 0.6;
    // 演义旋钮（粮赤字②·E.B 拍 P-FUV）：宗禄（明末宗藩这座大山）折粮按难度松绑——标准/硬核/默认维持满压保真(×1.0)、只叙事档松。
    //   硬核/标准让玩家在真实宗藩+军饷重压下治国；叙事/演义档给宗禄减半、不至于一上来被宗禄压垮。系数·可调。
    var _diff = String((global.P && global.P.conf && global.P.conf.difficulty) || '').toLowerCase();
    var _royalMult = /narrative|叙事|简单|演义/.test(_diff) ? 0.5 : 1.0;   // 仅叙事 0.5·标准/硬核/默认满压保真（P-FUV）
    stoneThis *= _royalMult;
    return {
      total: {
        money: stoneThis * (1 - grainRatio) * stoneToSilver,
        grain: stoneThis * grainRatio,
        cloth: 0
      },
      members: safeNumber(rcp.totalClanMembers, 0),
      arrears: safeNumber(rcp.cumulativeArrears, 0)
    };
  }

  function getArmies(G) {
    if (G && Array.isArray(G.armies)) return G.armies;
    if (G && G.military && Array.isArray(G.military.initialTroops)) return G.military.initialTroops;
    if (G && G.military && Array.isArray(G.military.armies)) return G.military.armies;
    if (global.P && global.P.military && Array.isArray(global.P.military.initialTroops)) return global.P.military.initialTroops;
    return [];
  }

  function calcArmyPay(ctx) {
    var G = getGame();
    var cfg = getSalaryConfig(G);
    var turnDays = getTurnDays(ctx, G);
    // 演义旋钮（P-FUV·军饷半）：军饷按难度松绑·比宗禄轻（军饷是国防核心·连着欠饷/哗变机制）。标准/硬核/默认满压·只叙事 0.7。可调。
    var _diffA = String((global.P && global.P.conf && global.P.conf.difficulty) || '').toLowerCase();
    var _armyMult = /narrative|叙事|简单|演义/.test(_diffA) ? 0.7 : 1.0;   // 仅叙事 0.7·标准/硬核/默认满压（P-FUV）
    if (cfg.armyAnnualOverride) {
      var ov = cfg.armyAnnualOverride;
      var yf = turnDays / 365;
      return {
        total: {
          money: safeNumber(ov.money, 0) * yf * _armyMult,
          grain: safeNumber(ov.grain, 0) * yf * _armyMult,
          cloth: safeNumber(ov.cloth, 0) * yf * _armyMult
        },
        byArmy: { override: { money: safeNumber(ov.money, 0) * yf * _armyMult, soldiers: safeNumber(ov.soldiers, 0) } }
      };
    }
    var pay = {};
    copyFields(pay, DEFAULT_ARMY_PAY);
    if (cfg.armyMonthlyPay) copyFields(pay, cfg.armyMonthlyPay);
    var turnFracMonth = turnDays / 30;
    var total = { money: 0, grain: 0, cloth: 0 };
    var byArmy = {};
    // 根治(2026-06·绍宋财政):军饷只结算玩家势力自己的军·非本势力军不上玩家国库账。
    //   旧 bug:此处遍历 getArmies(全势力 initialTroops) 一律从玩家国库发饷=玩家替金军/群盗买单。
    //   修:按 army.faction 匹配玩家势力名(与 _playerFactionNameForArmy/_isPlayerOwnedArmy 同源)。
    //   向后兼容——无 faction 标记的军(旧剧本如天启)仍计入·行为不变·不回归。
    var _P0 = global.P || {};
    var _pfn = String((_P0.playerInfo && _P0.playerInfo.factionName) || _P0.playerFaction
      || (G && Array.isArray(G.chars) ? ((G.chars.find(function(x){ return x && x.isPlayer; }) || {}).faction || '') : '')).trim();
    getArmies(G).forEach(function(army) {
      if (!army || army.destroyed) return;
      var _af = String(army.faction || army.owner || '').trim();
      if (_pfn && _af && _af !== _pfn && !army._edictBuilt) return;   // 非玩家势力军·不上玩家国库账
      var soldiers = safeNumber(army.soldiers, safeNumber(army.strength, safeNumber(army.size, 0)));
      if (soldiers <= 0) return;
      var moneyPay = army.monthlyMoneyPayPerSoldier != null ? safeNumber(army.monthlyMoneyPayPerSoldier, pay.money) : pay.money;
      var grainPay = army.monthlyGrainPayPerSoldier != null ? safeNumber(army.monthlyGrainPayPerSoldier, pay.grain) : pay.grain;
      var clothPay = army.monthlyClothPayPerSoldier != null ? safeNumber(army.monthlyClothPayPerSoldier, pay.cloth) : pay.cloth;
      var item = {
        money: soldiers * moneyPay * turnFracMonth,
        grain: soldiers * grainPay * turnFracMonth,
        cloth: soldiers * clothPay * turnFracMonth,
        soldiers: soldiers
      };
      total.money += item.money;
      total.grain += item.grain;
      total.cloth += item.cloth;
      byArmy[army.name || army.id || '军'] = item;
    });
    total.money *= _armyMult; total.grain *= _armyMult; total.cloth *= _armyMult;   // 演义旋钮·军饷松绑（P-FUV·硬核 ×1 不动）
    return { total: total, byArmy: byArmy };
  }

  function calcImperialExpense(ctx) {
    var G = getGame();
    var cfg = getSalaryConfig(G);
    var base = {};
    copyFields(base, DEFAULT_IMPERIAL_MONTHLY);
    if (cfg.imperialMonthly) copyFields(base, cfg.imperialMonthly);
    var scale = 1;
    if (G && G.huangwei && typeof G.huangwei.index === 'number') scale = 0.7 + G.huangwei.index / 100 * 0.6;
    var royalCount = 0;
    if (G && Array.isArray(G.chars)) {
      G.chars.forEach(function(ch) {
        if (ch && ch.alive !== false && (ch.isRoyal || ch.royalRelation === 'emperor_family' || (Array.isArray(ch.tags) && ch.tags.indexOf('皇室') >= 0))) royalCount += 1;
      });
    }
    if (royalCount > 10) scale *= 1 + (royalCount - 10) * 0.02;
    var turnFracMonth = getTurnDays(ctx, G) / 30;
    return {
      total: {
        money: safeNumber(base.money, 0) * scale * turnFracMonth,
        grain: safeNumber(base.grain, 0) * scale * turnFracMonth,
        cloth: safeNumber(base.cloth, 0) * scale * turnFracMonth
      },
      scale: scale,
      royalCount: royalCount
    };
  }

  function fixedPreview(ctx) {
    var salary = calcSalary(ctx);
    var royal = calcRoyalStipend(ctx);
    var army = calcArmyPay(ctx);
    var imperial = calcImperialExpense(ctx);
    return {
      salary: salary.total,
      royal: royal.total,
      army: army.total,
      imperial: imperial.total,
      totalMoney: safeNumber(salary.total.money, 0) + safeNumber(royal.total.money, 0) + safeNumber(army.total.money, 0) + safeNumber(imperial.total.money, 0),
      totalGrain: safeNumber(salary.total.grain, 0) + safeNumber(royal.total.grain, 0) + safeNumber(army.total.grain, 0) + safeNumber(imperial.total.grain, 0),
      totalCloth: safeNumber(salary.total.cloth, 0) + safeNumber(royal.total.cloth, 0) + safeNumber(army.total.cloth, 0) + safeNumber(imperial.total.cloth, 0),
      _salaryByDept: salary.byDept,
      _royalMembers: royal.members,
      _royalArrears: royal.arrears,
      _armyByArmy: army.byArmy,
      _imperialScale: imperial.scale,
      _royalCount: imperial.royalCount
    };
  }

  function fixedCollect(ctx) {
    var G = getGame();
    if (!G) return { ok: false, reason: 'no GM' };
    // 回合幂等(同 cascadeCollect)：重试不双扣俸饷·成功旗标 _lastFixedExpenseTurn 在尾部既有
    if (!(ctx && ctx.force) && G._lastFixedExpenseTurn != null && G._lastFixedExpenseTurn === (G.turn || 0)) {
      return { ok: false, skipped: 'already-collected-this-turn' };
    }
    var guokuLedgers = ensureGuoku(G);
    var neitangLedgers = ensureNeitang(G);
    reconcileLedgerScalar(guokuLedgers.money, G.guoku.money, G.guoku.balance);
    reconcileLedgerScalar(guokuLedgers.grain, G.guoku.grain, null);
    reconcileLedgerScalar(guokuLedgers.cloth, G.guoku.cloth, null);
    reconcileLedgerScalar(neitangLedgers.money, G.neitang.money, G.neitang.balance);
    reconcileLedgerScalar(neitangLedgers.grain, G.neitang.grain, null);
    reconcileLedgerScalar(neitangLedgers.cloth, G.neitang.cloth, null);

    var salary = calcSalary(ctx);
    var royal = calcRoyalStipend(ctx);
    var army = calcArmyPay(ctx);
    var imperial = calcImperialExpense(ctx);

    var salaryDed = {
      money: deductFromLedger(guokuLedgers.money, salary.total.money, '俸禄'),
      grain: deductFromLedger(guokuLedgers.grain, salary.total.grain, '俸禄'),
      cloth: deductFromLedger(guokuLedgers.cloth, salary.total.cloth, '俸禄')
    };
    var royalDed = {
      money: deductFromLedger(guokuLedgers.money, royal.total.money, '宗禄'),
      grain: deductFromLedger(guokuLedgers.grain, royal.total.grain, '宗禄'),
      cloth: deductFromLedger(guokuLedgers.cloth, royal.total.cloth, '宗禄')
    };
    var armyDed = {
      money: deductFromLedger(guokuLedgers.money, army.total.money, '军饷'),
      grain: deductFromLedger(guokuLedgers.grain, army.total.grain, '军饷'),
      cloth: deductFromLedger(guokuLedgers.cloth, army.total.cloth, '军饷')
    };
    var imperialDed = {
      money: deductFromLedger(neitangLedgers.money, imperial.total.money, '宫廷'),
      grain: deductFromLedger(neitangLedgers.grain, imperial.total.grain, '宫廷'),
      cloth: deductFromLedger(neitangLedgers.cloth, imperial.total.cloth, '宫廷')
    };

    ['money', 'grain', 'cloth'].forEach(function(kind) {
      var shortfall = safeNumber(imperialDed[kind].deficit, 0);
      if (shortfall <= 0) return;
      var gLed = guokuLedgers[kind];
      var nLed = neitangLedgers[kind];
      var r = deductFromLedger(gLed, shortfall, '户部补内帑');
      if (r.deducted > 0 && nLed) {
        nLed.deficit = Math.max(0, safeNumber(nLed.deficit, 0) - r.deducted);
        if (nLed.sinks && nLed.sinks['宫廷_欠']) nLed.sinks['宫廷_欠'] = Math.max(0, nLed.sinks['宫廷_欠'] - r.deducted);
      }
    });

    syncAccountScalars(G.guoku, guokuLedgers);
    syncAccountScalars(G.neitang, neitangLedgers);
    var turnExpense = {
      salary: salary.total,
      royal: royal.total,
      army: army.total,
      imperial: imperial.total,
      totalMoney: safeNumber(salary.total.money, 0) + safeNumber(royal.total.money, 0) + safeNumber(army.total.money, 0) + safeNumber(imperial.total.money, 0),
      totalGrain: safeNumber(salary.total.grain, 0) + safeNumber(royal.total.grain, 0) + safeNumber(army.total.grain, 0) + safeNumber(imperial.total.grain, 0),
      totalCloth: safeNumber(salary.total.cloth, 0) + safeNumber(royal.total.cloth, 0) + safeNumber(army.total.cloth, 0) + safeNumber(imperial.total.cloth, 0),
      turnDays: getTurnDays(ctx, G)
    };
    G.guoku.turnExpense = Math.round(turnExpense.totalMoney);
    G.guoku.turnGrainExpense = Math.round(turnExpense.totalGrain);
    G.guoku.turnClothExpense = Math.round(turnExpense.totalCloth);
    var turnFrac30 = Math.max(1, getTurnDays(ctx, G)) / 30;
    G.guoku.monthlyExpense = Math.round(turnExpense.totalMoney / turnFrac30);
    G.guoku.annualExpense = Math.round(turnExpense.totalMoney * (365 / Math.max(1, getTurnDays(ctx, G))));
    G._lastFixedExpense = turnExpense;
    G._lastFixedExpenseTurn = G.turn || 0;
    return {
      ok: true,
      salary: salary,
      royal: royal,
      army: army,
      imperial: imperial,
      deducted: { salary: salaryDed, royal: royalDed, army: armyDed, imperial: imperialDed },
      turnExpense: turnExpense
    };
  }

  // 从国库确定性支出·走 ledger（扣 stock + 回写标量·面板即时反映）。amounts:{money,grain,cloth}。
  //   供"建军招募开销/补饷"等复用——AI 定额、此处落账，绝不让花费飘在叙事里；国库不足则尽扣并记欠（deficit）。
  function spendFromGuoku(amounts, sinkTag) {
    var G = getGame();
    if (!G) return { ok: false, reason: 'no GM' };
    amounts = amounts || {};
    var L = ensureGuoku(G);
    reconcileLedgerScalar(L.money, G.guoku.money, G.guoku.balance);
    reconcileLedgerScalar(L.grain, G.guoku.grain, null);
    reconcileLedgerScalar(L.cloth, G.guoku.cloth, null);
    var out = {};
    ['money', 'grain', 'cloth'].forEach(function(kind) {
      var amt = safeNumber(amounts[kind], 0);
      out[kind] = (amt > 0) ? deductFromLedger(L[kind], amt, sinkTag || '支出') : { deducted: 0, deficit: 0 };
    });
    syncAccountScalars(G.guoku, L);
    return { ok: true, deducted: out };
  }

  // 入账（#25·外交收贡/赔款/互市之利等 → 国库）·镜像 spendFromGuoku·走 ledger.stock + thisTurnIn + sources + 同步 balance/money
  function addToGuoku(amounts, sourceTag) {
    var G = getGame();
    if (!G) return { ok: false, reason: 'no GM' };
    amounts = amounts || {};
    var L = ensureGuoku(G);
    reconcileLedgerScalar(L.money, G.guoku.money, G.guoku.balance);
    reconcileLedgerScalar(L.grain, G.guoku.grain, null);
    reconcileLedgerScalar(L.cloth, G.guoku.cloth, null);
    ['money', 'grain', 'cloth'].forEach(function(kind) {
      var amt = safeNumber(amounts[kind], 0);
      if (amt > 0) {
        var led = L[kind];
        led.stock = (Number(led.stock) || 0) + amt;
        led.thisTurnIn = (Number(led.thisTurnIn) || 0) + amt;
        if (!led.sources) led.sources = {};
        led.sources[sourceTag || '入账'] = (Number(led.sources[sourceTag || '入账']) || 0) + amt;
      }
    });
    syncAccountScalars(G.guoku, L);
    return { ok: true };
  }

  // ── 内帑对称写口（2026-07-04 守卫v3收口）────────────────────────────────
  // 此前八处外部金流散写 GM.neitang.balance/money（赐金/科举补贴/宫廷俸禄/侵吞/追赃/抄没/归公/调度）
  // =内帑侧「两本账」病灶：neitang ledger 不知情·monthlySettle 对账漂移。语义与国库口一致：尽扣记欠·同步标量镜像。
  function spendFromNeitang(amounts, sinkTag) {
    var G = getGame();
    if (!G) return { ok: false, reason: 'no GM' };
    amounts = amounts || {};
    var L = ensureNeitang(G);
    reconcileLedgerScalar(L.money, G.neitang.money, G.neitang.balance);
    reconcileLedgerScalar(L.grain, G.neitang.grain, null);
    reconcileLedgerScalar(L.cloth, G.neitang.cloth, null);
    var out = {};
    ['money', 'grain', 'cloth'].forEach(function(kind) {
      var amt = safeNumber(amounts[kind], 0);
      out[kind] = (amt > 0) ? deductFromLedger(L[kind], amt, sinkTag || '内帑支出') : { deducted: 0, deficit: 0 };
    });
    syncAccountScalars(G.neitang, L);
    return { ok: true, deducted: out };
  }

  function addToNeitang(amounts, sourceTag) {
    var G = getGame();
    if (!G) return { ok: false, reason: 'no GM' };
    amounts = amounts || {};
    var L = ensureNeitang(G);
    reconcileLedgerScalar(L.money, G.neitang.money, G.neitang.balance);
    reconcileLedgerScalar(L.grain, G.neitang.grain, null);
    reconcileLedgerScalar(L.cloth, G.neitang.cloth, null);
    ['money', 'grain', 'cloth'].forEach(function(kind) {
      var amt = safeNumber(amounts[kind], 0);
      if (amt > 0) {
        var led = L[kind];
        led.stock = (Number(led.stock) || 0) + amt;
        led.thisTurnIn = (Number(led.thisTurnIn) || 0) + amt;
        if (!led.sources) led.sources = {};
        led.sources[sourceTag || '入账'] = (Number(led.sources[sourceTag || '入账']) || 0) + amt;
      }
    });
    syncAccountScalars(G.neitang, L);
    return { ok: true };
  }

  function fixedTick(ctx) {
    try { return fixedCollect(ctx); } catch (e) {
      if (global.TM && global.TM.errors && global.TM.errors.capture) global.TM.errors.capture(e, 'FixedExpense.tick');
      else if (typeof console !== 'undefined' && console.error) console.error('[FixedExpense.tick]', e);
      return { ok: false, error: e && e.message || String(e) };
    }
  }

  // ── ③ 运行时·玩家在游戏中改税制(通用·惠及所有剧本) ──────────────────────
  //   reform: {op:'rate'|'add'|'remove', taxId, rate?, tax?}
  //   写回 GM.fiscalConfig.taxList(getFiscalConfig 合并时覆盖剧本原表)→CascadeTax 下回合用新表重算。
  //   民心后果:加重民负→民心降·减负→升(税率变化×100·系数可调)。玩家诏令/税制面板调此。
  function applyPlayerTaxReform(reform) {
    var G = getGame();
    if (!G || !reform || !reform.op) return { ok: false, reason: 'no_game_or_reform' };
    var fc = getFiscalConfig(G);
    var src = (Array.isArray(fc.taxList) && fc.taxList.length) ? fc.taxList
            : ((Array.isArray(fc.taxes) && fc.taxes.length) ? fc.taxes : DEFAULT_TAXES);
    var tl = src.map(function(t){ return clone(t); });
    function findIdx(id){ var i; for (i = 0; i < tl.length; i++) if (tl[i].id === id) return i; for (i = 0; i < tl.length; i++) if (tl[i].sourceTag === id || tl[i].name === id) return i; return -1; }
    var change = null, burdenDelta = 0;
    if (reform.op === 'rate') {
      var i = findIdx(reform.taxId); if (i < 0) return { ok: false, reason: 'tax_not_found' };
      var oldR = safeNumber(tl[i].rate, 0), newR = Math.max(0, Math.min(1, safeNumber(reform.rate, oldR)));
      burdenDelta = newR - oldR; tl[i].rate = newR;
      change = { op: 'rate', id: tl[i].id, name: tl[i].name, oldRate: oldR, newRate: newR };
    } else if (reform.op === 'remove') {
      var ri = findIdx(reform.taxId); if (ri < 0) return { ok: false, reason: 'tax_not_found' };
      burdenDelta = -safeNumber(tl[ri].rate, 0); change = { op: 'remove', id: tl[ri].id, name: tl[ri].name }; tl.splice(ri, 1);
    } else if (reform.op === 'add') {
      if (!reform.tax || !reform.tax.id) return { ok: false, reason: 'bad_tax' };
      if (findIdx(reform.tax.id) >= 0) return { ok: false, reason: 'dup_id' };
      tl.push(clone(reform.tax)); burdenDelta = safeNumber(reform.tax.rate, 0);
      change = { op: 'add', id: reform.tax.id, name: reform.tax.name || reform.tax.id };
    } else { return { ok: false, reason: 'unknown_op:' + reform.op }; }
    if (!G.fiscalConfig) G.fiscalConfig = {};
    G.fiscalConfig.taxList = tl;   // 运行时覆盖·CascadeTax 下回合用新表
    var minxinDelta = -Math.round(burdenDelta * 100);
    try { var mx = G.minxin; if (mx) {
      if (typeof mx.trueIndex === 'number') mx.trueIndex = Math.max(0, Math.min(100, mx.trueIndex + minxinDelta));
      if (typeof mx.index === 'number') mx.index = Math.max(0, Math.min(100, mx.index + minxinDelta));
    } } catch (_) {}
    G._fiscalDirty = true;
    G._lastTaxReform = { turn: G.turn || 0, change: change, minxinDelta: minxinDelta };
    return { ok: true, change: change, minxinDelta: minxinDelta, taxCount: tl.length };
  }

  var api = {
    VERSION: 1,
    DEFAULT_TAXES: DEFAULT_TAXES,
    DEFAULT_ALLOCATION: DEFAULT_ALLOCATION,
    ATOMIC_TAX_TYPES_19: ATOMIC_TAX_TYPES_19,
    EXPENDITURE_EFFECTS_14: EXPENDITURE_EFFECTS_14,
    enableTaxesByDynasty: enableTaxesByDynasty,
    _ensureRegionFiscal: _ensureRegionFiscal,
    splitTaxByAllocation: splitTaxByAllocation,
    executeLocalAction: executeLocalAction,
    createTransferOrderAtomic: createTransferOrderAtomic,
    _tickTransferOrders: _tickTransferOrders,
    init: init,
    tick: tick,
    triggerSurvey: triggerSurvey,
    adjustPlayerCompliance: adjustPlayerCompliance,
    adjustPlayerDivisionCorruption: adjustPlayerDivisionCorruption,
    triggerPlayerSurvey: triggerPlayerSurvey,
    spendFromGuoku: spendFromGuoku,
    addToGuoku: addToGuoku,
    spendFromNeitang: spendFromNeitang,
    addToNeitang: addToNeitang,
    applyPlayerTaxReform: applyPlayerTaxReform,
    // S1·俸禄认人单测钩子
    calcSalary: calcSalary,
    _salaryActualBodies: _salaryActualBodies
  };

  global.FiscalEngine = global.FiscalEngine || {};
  Object.keys(api).forEach(function(key) {
    global.FiscalEngine[key] = api[key];
  });
  global.FiscalEngine.createTransferOrder = createTransferOrderAtomic;

  global.PhaseH = global.PhaseH || {};
  global.PhaseH.init = init;
  global.PhaseH.tick = tick;

  global.CascadeTax = {
    VERSION: 2,
    DEFAULT_TAXES: DEFAULT_TAXES,
    DEFAULT_ALLOCATION: DEFAULT_ALLOCATION,
    collect: cascadeCollect,
    tick: cascadeTick,
    applyDisasterEconomyReduction: applyDisasterEconomyReduction,
    _ensureEconomyBase: _ensureEconomyBase,
    _settleLandFlow: _settleLandFlow,
    sumEconomyBase: sumEconomyBase,
    getDivEconomy: getDivEconomy,
    getTopContributors: getTopContributors,
    triggerSurvey: triggerSurvey,
    adjustPlayerCompliance: adjustPlayerCompliance,
    adjustPlayerDivisionCorruption: adjustPlayerDivisionCorruption,
    triggerPlayerSurvey: triggerPlayerSurvey
  };

  global.FixedExpense = {
    VERSION: 2,
    collect: fixedCollect,
    tick: fixedTick,
    preview: fixedPreview,
    DEFAULT_RANK_SALARY: DEFAULT_RANK_SALARY,
    DEFAULT_ARMY_PAY: DEFAULT_ARMY_PAY,
    DEFAULT_IMPERIAL_MONTHLY: DEFAULT_IMPERIAL_MONTHLY
  };

  // ─── R203 (P5-δ 2026-05-04·Claude)·dead code 删除 ───
  // 原有·global.TM.Economy.sum/getDiv/topContributors/triggerSurvey
  // 因·tm-namespaces.js 在本文件 load 之后用 R87 facade 重写 TM.Economy·
  //     这 4 处直写实际从未生效·无 live caller (grep 0 hit)·
  // 替代·tm-namespaces.js R203 段统一接·TM.Fiscal.cascade = window.CascadeTax·
  //       CascadeTax.sumEconomyBase / getDivEconomy / getTopContributors / triggerSurvey 透传
  //       并在 R203 加 TM.Economy.sum 等 alias·保 changelog 历史契约

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
