// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-authority-engines.js — 皇威/皇权/民心三系统 + 变量联动
 *
 * 实施：
 *  - 设计方案-皇威系统.md（14 上升 + 14 下降 + 5 段 + 暴君/失威 + 感知扭曲）
 *  - 设计方案-皇权系统.md（8 上升 + 8 下降 + 3 段 + 四象限）
 *  - 设计方案-民心系统.md（14 来源 + 5 级 + 8 传导 + 分区分阶层）
 *  - 设计方案-变量联动总表.md（7×6 = 42 项联动矩阵）
 *
 * 腐败系统由 tm-corruption-engine.js 已有实现。
 *
 * Phase 3 R12d (2026-05-04): inline tm-phase-f1-fixes.js LAYERED override.
 *  - _updatePerceivedHuangwei now uses the full five-stage polish model.
 *  - PhaseF1 compatibility namespace is a defensive shim; no separate patch file.
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  皇威 HUANGWEI — 五段语义
  // ═══════════════════════════════════════════════════════════════════

  var HUANGWEI_PHASE = {
    tyrant:  { range:[90,100], name:'暴君',   description:'献媚丛生，进谏灭绝' },
    majesty: { range:[70,90],  name:'威严',   description:'有威而可畏，施行适当', optimal:true },
    normal:  { range:[50,70],  name:'常望',   description:'中庸常态' },
    decline: { range:[30,50],  name:'衰微',   description:'诏书被质疑' },
    lost:    { range:[0,30],   name:'失威',   description:'诏书被无视' }
  };

  var HUANGWEI_SOURCES_14 = [
    'militaryVictory','territoryExpansion','grandCeremony','executeRebelMinister',
    'suppressRevolt','auspicious','benevolence','selfBlame',
    'tribute','imperialFuneral','rehabilitation','culturalAchievement',
    'personalCampaign','structuralReform'
  ];

  var HUANGWEI_DRAINS_14 = [
    'militaryDefeat','diplomaticHumiliation','idleGovern','courtScandal',
    'heavenlySign','forcedAbdication','brokenPromise','deposeFailure',
    'imperialFlight','capitalFall','personalCampaignFail','familyScandal',
    'memorialObjection','lostVirtueRumor'
  ];

  function _readInitialValue(key, defaultVal) {
    var sc = null;
    try { sc = (typeof global.findScenarioById === 'function') ? global.findScenarioById(global.GM.sid) : null; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-authority-engines');}catch(_){}}
    var initial = sc && sc.authorityConfig && sc.authorityConfig.initial;
    if (initial && typeof initial[key] === 'number') return initial[key];
    return defaultVal;
  }

  function _readInitialObject(key) {
    var sc = null;
    try { sc = (typeof global.findScenarioById === 'function') ? global.findScenarioById(global.GM.sid) : null; } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-authority-engines');}catch(_){}}
    var initial = sc && sc.authorityConfig && sc.authorityConfig.initial;
    return (initial && typeof initial[key] === 'object') ? initial[key] : null;
  }

  function _ensureHuangwei() {
    var G = global.GM;
    if (!G) return null;
    if (!G.huangwei || typeof G.huangwei === 'number') {
      var oldVal = typeof G.huangwei === 'number' ? G.huangwei : _readInitialValue('huangwei', 50);
      var hwSub = _readInitialObject('huangweiSubDims') || {};
      var tyrInit = _readInitialObject('tyrant') || {};
      G.huangwei = {
        index: oldVal,
        phase: 'normal',
        trend: 'stable',
        subDims: {
          court:      { value: typeof hwSub.court === 'number' ? hwSub.court : oldVal, trend:'stable' },
          provincial: { value: typeof hwSub.provincial === 'number' ? hwSub.provincial : oldVal, trend:'stable' },
          military:   { value: typeof hwSub.military === 'number' ? hwSub.military : oldVal, trend:'stable' },
          foreign:    { value: typeof hwSub.foreign === 'number' ? hwSub.foreign : oldVal, trend:'stable' }
        },
        perceivedIndex: oldVal,
        visibilityTier: 'moderate',
        sources: {}, drains: {},
        tyrantSyndrome: { active: !!tyrInit.syndromeActive, activatedTurn: tyrInit.syndromeActive ? 0 : null, flatteryMemorialRatio:0, overExecutionLog:[], hiddenDamage:{} },
        lostAuthorityCrisis: { active: !!tyrInit.lostCrisisActive, activatedTurn: tyrInit.lostCrisisActive ? 0 : null, objectionFrequency:1, provincialWatching:false, foreignEmboldened:0 },
        history: { tyrantPeriods:[], crisisPeriods:[], pastHumiliations:[] }
      };
      HUANGWEI_SOURCES_14.forEach(function(s){ G.huangwei.sources[s] = 0; });
      HUANGWEI_DRAINS_14.forEach(function(d){ G.huangwei.drains[d] = 0; });
    } else {
      // 补齐缺失字段
      if (!G.huangwei.subDims) G.huangwei.subDims = { court:{value:G.huangwei.index||50}, provincial:{value:G.huangwei.index||50}, military:{value:G.huangwei.index||50}, foreign:{value:G.huangwei.index||50} };
      if (!G.huangwei.sources) G.huangwei.sources = {};
      if (!G.huangwei.drains) G.huangwei.drains = {};
      if (!G.huangwei.tyrantSyndrome) G.huangwei.tyrantSyndrome = { active:false };
      if (!G.huangwei.lostAuthorityCrisis) G.huangwei.lostAuthorityCrisis = { active:false };
      if (!G.huangwei.history) G.huangwei.history = { tyrantPeriods:[], crisisPeriods:[], pastHumiliations:[] };
      HUANGWEI_SOURCES_14.forEach(function(s){ if (G.huangwei.sources[s] === undefined) G.huangwei.sources[s] = 0; });
      HUANGWEI_DRAINS_14.forEach(function(d){ if (G.huangwei.drains[d] === undefined) G.huangwei.drains[d] = 0; });
    }
    return G.huangwei;
  }

  function _getHuangweiPhase(idx) {
    if (idx >= 90) return 'tyrant';
    if (idx >= 70) return 'majesty';
    if (idx >= 50) return 'normal';
    if (idx >= 30) return 'decline';
    return 'lost';
  }

  function _updatePerceivedHuangwei(hw) {
    var t = hw.index;
    var corruptMult = 1;
    var G = global.GM;
    if (G && G.corruption && typeof G.corruption === 'object') {
      var corr = G.corruption.overall || 0;
      corruptMult = 1 + corr / 200;
    }
    if (t >= 90) {
      hw.perceivedIndex = Math.min(100, t + 8 * corruptMult);
    } else if (t >= 70) {
      hw.perceivedIndex = Math.min(100, t + 2 * corruptMult);
    } else if (t >= 50) {
      hw.perceivedIndex = Math.min(100, t + 3 * corruptMult);
    } else if (t >= 30) {
      hw.perceivedIndex = Math.min(100, t + 6 * corruptMult);
    } else {
      hw.perceivedIndex = Math.max(0, t + Math.min(4, corruptMult * 2));
    }
  }

  function adjustHuangwei(source, delta, reason, opts) {
    var hw = _ensureHuangwei();
    if (!hw) return { ok: false, reason: 'missing-huangwei' };
    var amount = Number(delta);
    if (!isFinite(amount) || amount === 0) return { ok: false, reason: 'invalid-delta' };
    var cleanReason = _authorityCleanReason(reason, {
      defaultReason: source || 'huangwei-change',
      allowUnattributed: true
    });
    var oldIdx = typeof hw.index === 'number' && isFinite(hw.index) ? hw.index : 50;
    hw.index = Math.max(0, Math.min(100, oldIdx + amount));
    var applied = hw.index - oldIdx;
    if (applied > 0 && hw.sources[source] !== undefined) hw.sources[source] += applied;
    if (applied < 0 && hw.drains[source] !== undefined) hw.drains[source] += -applied;
    // 阶段迁移
    var newPhase = _getHuangweiPhase(hw.index);
    if (newPhase !== hw.phase) {
      hw.phase = newPhase;
      if (global.addEB) global.addEB('皇威', '转入 ' + HUANGWEI_PHASE[newPhase].name + ' 段（' + Math.round(hw.index) + '）');
    }
    hw.trend = applied > 0 ? 'rising' : applied < 0 ? 'falling' : 'stable';
    // 同步四维
    if (source === 'militaryVictory' || source === 'militaryDefeat' || source === 'personalCampaign' || source === 'personalCampaignFail') {
      hw.subDims.military.value = Math.max(0, Math.min(100, hw.subDims.military.value + applied * 1.5));
    }
    if (source === 'tribute' || source === 'diplomaticHumiliation' || source === 'territoryExpansion') {
      hw.subDims.foreign.value = Math.max(0, Math.min(100, hw.subDims.foreign.value + applied * 1.5));
    }
    if (source === 'executeRebelMinister' || source === 'memorialObjection' || source === 'courtScandal') {
      hw.subDims.court.value = Math.max(0, Math.min(100, hw.subDims.court.value + applied * 1.5));
    }
    if (source === 'suppressRevolt' || source === 'forcedAbdication') {
      hw.subDims.provincial.value = Math.max(0, Math.min(100, hw.subDims.provincial.value + applied * 1.5));
    }
    _recordAuthorityChange('huangwei', '\u7687\u5a01', 'huangwei.index', oldIdx, hw.index, cleanReason, source);
    return { ok: true, oldValue: oldIdx, newValue: hw.index, delta: applied, reason: cleanReason };
  }

  function _tickHuangwei(ctx, mr) {
    var hw = _ensureHuangwei();
    if (!hw) return;
    // 暴君综合症检测
    if (hw.index > 90 && !hw.tyrantSyndrome.active) {
      hw.tyrantSyndrome.active = true;
      hw.tyrantSyndrome.activatedTurn = ctx.turn;
      if (global.addEB) global.addEB('皇威', '暴君段激活：献媚丛生');
    } else if (hw.index < 85 && hw.tyrantSyndrome.active) {
      hw.tyrantSyndrome.active = false;
      hw.history.tyrantPeriods.push({ start: hw.tyrantSyndrome.activatedTurn, end: ctx.turn });
    }
    // 失威危机
    if (hw.index < 30 && !hw.lostAuthorityCrisis.active) {
      hw.lostAuthorityCrisis.active = true;
      hw.lostAuthorityCrisis.activatedTurn = ctx.turn;
      if (global.addEB) global.addEB('皇威', '失威危机：诏令频遭抗疏');
    } else if (hw.index > 35 && hw.lostAuthorityCrisis.active) {
      hw.lostAuthorityCrisis.active = false;
      hw.history.crisisPeriods.push({ start: hw.lostAuthorityCrisis.activatedTurn, end: ctx.turn });
    }
    // 自然衰减（无事迹 → 缓慢下降）
    var totalAction = 0;
    Object.keys(hw.sources).forEach(function(s) { totalAction += hw.sources[s]; });
    var idleTurns = (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(6) : 6;
    if (totalAction < 1 && (ctx.turn - (hw.history.lastActionTurn || 0)) > idleTurns) {
      adjustHuangwei('idleGovern', -0.3 * mr, '无事迹');
    }
    // 怠政自动触发
    var yearBoundary = (typeof global.isYearBoundary === 'function')
      ? global.isYearBoundary(ctx.turn)
      : (function(t) {
          t = Number(t || 0);
          return t > 0 && Math.floor((t * 30) / 365) > Math.floor(((t - 1) * 30) / 365);
        })(ctx.turn);
    if (global.GM._edictTracker && global.GM._edictTracker.length === 0 && yearBoundary) {
      adjustHuangwei('idleGovern', -1 * mr, '久无诏令');
    }
    _updatePerceivedHuangwei(hw);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇权 HUANGQUAN — 三段
  // ═══════════════════════════════════════════════════════════════════

  var HUANGQUAN_PHASE = {
    strong:   { range:[70,100], name:'强皇权', description:'皇帝意志可贯彻' },
    moderate: { range:[40,70],  name:'中皇权', description:'皇帝需协商', optimal:true },
    weak:     { range:[0,40],   name:'弱皇权', description:'傀儡/权臣时代' }
  };

  var HUANGQUAN_SOURCES_8 = ['purge','secretPolice','personalRule','structureReform','militaryCentral','tour','heirDecision','executePM'];
  var HUANGQUAN_DRAINS_8 = ['trustedMinister','eunuchsRelatives','youngOrIllness','factionConsuming','idleGovern','militaryDefeat','cabinetization','memorialObjection'];

  function _ensureHuangquan() {
    var G = global.GM;
    if (!G) return null;
    if (!G.huangquan || typeof G.huangquan === 'number') {
      var oldVal = typeof G.huangquan === 'number' ? G.huangquan : _readInitialValue('huangquan', 55);
      var hqSub = _readInitialObject('huangquanSubDims') || {};
      var pmInit = _readInitialObject('powerMinister') || {};
      G.huangquan = {
        index: oldVal,
        phase: 'moderate',
        trend: 'stable',
        subDims: {
          central:    { value: typeof hqSub.central === 'number' ? hqSub.central : oldVal },
          provincial: { value: typeof hqSub.provincial === 'number' ? hqSub.provincial : oldVal },
          military:   { value: typeof hqSub.military === 'number' ? hqSub.military : oldVal },
          imperial:   { value: typeof hqSub.imperial === 'number' ? hqSub.imperial : oldVal }
        },
        sources: {}, drains: {},
        ministers: { ironGrip:false, factionControl:0, objectionRate:0.2 },
        powerMinister: pmInit.name ? { name: pmInit.name, activatedTurn: 0, controlLevel: pmInit.controlLevel || 0.3, faction: [], interceptions: 0, counterEdicts: 0 } : null,
        history: { purges:[], reforms:[] }
      };
      HUANGQUAN_SOURCES_8.forEach(function(s){ G.huangquan.sources[s] = 0; });
      HUANGQUAN_DRAINS_8.forEach(function(d){ G.huangquan.drains[d] = 0; });
    } else {
      if (!G.huangquan.sources) G.huangquan.sources = {};
      if (!G.huangquan.drains) G.huangquan.drains = {};
      if (!G.huangquan.ministers) G.huangquan.ministers = {};
      if (!G.huangquan.history) G.huangquan.history = { purges:[], reforms:[] };
      HUANGQUAN_SOURCES_8.forEach(function(s){ if (G.huangquan.sources[s] === undefined) G.huangquan.sources[s] = 0; });
      HUANGQUAN_DRAINS_8.forEach(function(d){ if (G.huangquan.drains[d] === undefined) G.huangquan.drains[d] = 0; });
    }
    return G.huangquan;
  }

  function _getHuangquanPhase(idx) {
    if (idx >= 70) return 'strong';
    if (idx >= 40) return 'moderate';
    return 'weak';
  }

  function _authorityCleanReason(reason, opts) {
    if (typeof reason === 'string' && reason.trim()) return reason.trim();
    if (opts && typeof opts.defaultReason === 'string' && opts.defaultReason.trim()) return opts.defaultReason.trim();
    if (opts && opts.ai) return '\u0041\u0049\u63a8\u6f14';
    if (opts && opts.allowUnattributed) return '\u672a\u6807\u6ce8\u6765\u6e90';
    return '';
  }

  function _rememberAuthorityBlocked(kind, delta, reason, source) {
    var G = global.GM;
    if (!G) return;
    if (!G._authorityBlocked) G._authorityBlocked = [];
    G._authorityBlocked.push({
      kind: kind,
      source: source || '',
      delta: delta,
      reason: reason || 'missing-reason',
      turn: G.turn || 0,
      seq: G._authorityBlocked.length + 1
    });
    if (G._authorityBlocked.length > 100) G._authorityBlocked = G._authorityBlocked.slice(-100);
  }

  function _recordAuthorityChange(kind, label, path, oldValue, newValue, reason, source) {
    var G = global.GM;
    if (!G || oldValue === newValue) return;
    if (!G.turnChanges) G.turnChanges = {};
    if (!G.turnChanges.variables) G.turnChanges.variables = [];
    var cleanReason = reason || '\u672a\u6807\u6ce8\u6765\u6e90';
    var entry = G.turnChanges.variables.find(function(v){ return v && v.path === path; });
    if (entry) {
      entry.newValue = newValue;
      entry.delta = newValue - (typeof entry.oldValue === 'number' ? entry.oldValue : oldValue);
      entry.reason = cleanReason;
      entry.reasons = entry.reasons || [];
      entry.reasons.push({ type: source || kind, amount: newValue - oldValue, desc: cleanReason });
    } else {
      G.turnChanges.variables.push({
        name: label,
        label: label,
        path: path,
        oldValue: oldValue,
        newValue: newValue,
        delta: newValue - oldValue,
        reason: cleanReason,
        reasons: [{ type: source || kind, amount: newValue - oldValue, desc: cleanReason }]
      });
    }
    if (!G._authorityLog) G._authorityLog = [];
    G._authorityLog.push({
      kind: kind,
      label: label,
      path: path,
      source: source || '',
      oldValue: oldValue,
      newValue: newValue,
      delta: newValue - oldValue,
      reason: cleanReason,
      turn: G.turn || 0,
      seq: G._authorityLog.length + 1
    });
    if (G._authorityLog.length > 200) G._authorityLog = G._authorityLog.slice(-200);
  }

  function getUnifiedHuangquanPhaseHandler() {
    var G = global.GM;
    if (!G || !G.huangquan) return null;
    var idx = G.huangquan.index || 55;
    if (idx >= 70) return {
      phase: 'absolute',
      name: '专制段',
      decreeMode: 'fiveElementsStrict',
      ministerBehavior: 'obedient',
      aiObjectionRate: 0.1,
      memorialFilterActive: false,
      executionMult: 1.2,
      description: '皇权在上，纲纪严明；五要素不全则圣裁补全'
    };
    if (idx >= 35) return {
      phase: 'balanced',
      name: '制衡段',
      decreeMode: 'ministerAmplify',
      ministerBehavior: 'proactive',
      aiObjectionRate: 0.25,
      memorialFilterActive: false,
      executionMult: 1.0,
      description: '上下协力，大臣补全诏命细节'
    };
    return {
      phase: 'minister',
      name: '权臣段',
      decreeMode: 'ministerIntercept',
      ministerBehavior: 'intercept',
      aiObjectionRate: 0.5,
      memorialFilterActive: true,
      executionMult: 0.5,
      description: '权臣坐大，诏命被阻或篡改'
    };
  }

  function checkDecreeRealtime(text) {
    var handler = getUnifiedHuangquanPhaseHandler();
    if (!handler) return { ok: true };
    if (handler.decreeMode !== 'fiveElementsStrict') {
      return { ok: true, mode: handler.decreeMode, suggest: 'AI 将按朝代惯例补全' };
    }
    var source = String(text || '');
    var elements = {
      time:  /(春|夏|秋|冬|月|日|岁|限|期|即日|立|年底|半年)/,
      place: /(京|省|府|县|道|路|州|全国|天下|边|畿|江南|河北|中原)/,
      who:   /(尚书|侍郎|令|丞|御史|将军|总督|巡抚|知|提督|宣抚|节度|刺史)/,
      money: /(帑|银|钱|粮|布|万|石|支|拨|出|自.*出|由.*支)/,
      audit: /(限|考|核|验|察|赏|罚|功|过|黜陟|迁)/
    };
    var labels = { time: '时日', place: '地点', who: '执行人', money: '经费', audit: '考核' };
    var missing = [];
    Object.keys(elements).forEach(function(k) {
      if (!elements[k].test(source)) missing.push(labels[k]);
    });
    return {
      ok: missing.length === 0,
      mode: 'fiveElementsStrict',
      missing: missing,
      phase: handler.name,
      suggest: missing.length > 0 ? ('陛下此诏，尚缺 ' + missing.join('、') + '，请圣裁。') : '五要素具备，可即下。'
    };
  }

  function adjustHuangquan(source, delta, reason, opts) {
    var hq = _ensureHuangquan();
    if (!hq) return { ok: false, reason: 'missing-huangquan' };
    var amount = Number(delta);
    if (!isFinite(amount) || amount === 0) return { ok: false, reason: 'invalid-delta' };
    var cleanReason = _authorityCleanReason(reason, opts);
    if (!cleanReason) {
      _rememberAuthorityBlocked('huangquan', amount, 'missing-reason', source);
      return { ok: false, blocked: true, reason: 'missing-reason' };
    }
    var oldValue = typeof hq.index === 'number' && isFinite(hq.index) ? hq.index : 55;
    hq.index = Math.max(0, Math.min(100, oldValue + amount));
    var applied = hq.index - oldValue;
    if (applied > 0 && hq.sources[source] !== undefined) hq.sources[source] += applied;
    if (applied < 0 && hq.drains[source] !== undefined) hq.drains[source] += -applied;
    var newPhase = _getHuangquanPhase(hq.index);
    if (newPhase !== hq.phase) {
      hq.phase = newPhase;
      if (global.addEB) global.addEB('皇权', '转入 ' + HUANGQUAN_PHASE[newPhase].name + '（' + Math.round(hq.index) + '）');
    }
    hq.trend = applied > 0 ? 'rising' : applied < 0 ? 'falling' : 'stable';
    _recordAuthorityChange('huangquan', '\u7687\u6743', 'huangquan.index', oldValue, hq.index, cleanReason, source);
    return { ok: true, oldValue: oldValue, newValue: hq.index, delta: applied, reason: cleanReason };
  }

  function setHuangquan(value, reason, opts) {
    var hq = _ensureHuangquan();
    if (!hq) return { ok: false, reason: 'missing-huangquan' };
    var target = Number(value);
    if (!isFinite(target)) return { ok: false, reason: 'invalid-value' };
    target = Math.max(0, Math.min(100, target));
    var oldValue = typeof hq.index === 'number' && isFinite(hq.index) ? hq.index : 55;
    return adjustHuangquan((opts && opts.source) || 'set', target - oldValue, reason, opts);
  }

  function _tickHuangquan(ctx, mr) {
    var hq = _ensureHuangquan();
    if (!hq) return;
    // 长期信任权臣坐大
    var longTrusted = (global.GM.chars || []).filter(function(c) {
      return c.alive !== false && c.officialTitle && (c.officialTitle.indexOf('宰相') >= 0 || c.officialTitle.indexOf('丞相') >= 0 || c.officialTitle.indexOf('首辅') >= 0);
    });
    if (longTrusted.length > 0) {
      var top = longTrusted[0];
      if ((top._tenureMonths || 0) > 60 && top.ambition > 70) {
        adjustHuangquan('trustedMinister', -0.2 * mr, '权臣坐大');
      }
    }
    // 外戚/宦官
    var scandalous = (global.GM.chars || []).filter(function(c) {
      return c.alive !== false && (c.role === 'eunuch' || c.role === 'empress_relative' || c.role === 'consort_relative');
    });
    if (scandalous.length > 2) {
      adjustHuangquan('eunuchsRelatives', -0.15 * mr * scandalous.length / 2, '内宦外戚');
    }
    // 执行度传导（皇权 > 70 → 诏令 100% 执行；< 40 → 50% 被打折）
    var execRate = 0.5 + (hq.index / 100) * 0.5;
    hq.executionRate = execRate;
    // 大臣抗疏率（皇权越低抗疏越多）
    hq.ministers.objectionRate = Math.max(0.05, Math.min(0.6, 0.6 - hq.index / 200));
  }

  function _executePurge(targetName) {
    var hq = _ensureHuangquan();
    if (!hq) return { ok: false };
    var target = (global.GM.chars || []).find(function(c) { return c.name === targetName; });
    if (!target) return { ok: false };
    target.alive = false;
    target._purgedTurn = global.GM.turn;
    hq.history.purges.push({ target: targetName, turn: global.GM.turn });
    adjustHuangquan('purge', 8, '清洗 ' + targetName);
    if (global.addEB) global.addEB('皇权', '清洗 ' + targetName);
    // 其他大臣被震慑，忠诚临时上升但长期降
    (global.GM.chars || []).forEach(function(c) {
      if (c.alive !== false && c.officialTitle) {
        if (global.adjustCharacterLoyalty) {
          global.adjustCharacterLoyalty(c, 3, '\u7687\u6743\u6E05\u6D17' + targetName + '\u540E\u767E\u5B98\u9707\u6151', { source:'authority-purge-shock' });
        } else {
          var oldL = (typeof c.loyalty === 'number' && isFinite(c.loyalty)) ? c.loyalty : 50;
          c.loyalty = Math.min(100, oldL + 3);
        }
        c.stress = Math.min(100, (c.stress || 0) + 15);
      }
    });
    return { ok: true };
  }

  // ═══════════════════════════════════════════════════════════════════
  //  民心 MINXIN — 5 级分段
  // ═══════════════════════════════════════════════════════════════════

  var MINXIN_PHASE = {
    adoring:  { range:[80,100], name:'民感戴',   description:'歌功颂德，效忠守法' },
    peaceful: { range:[60,80],  name:'民安',     description:'安居乐业', optimal:true },
    uneasy:   { range:[40,60],  name:'民疑',     description:'流言渐起' },
    angry:    { range:[20,40],  name:'民怨',     description:'抗租闹粮，流民增' },
    revolt:   { range:[0,20],   name:'民变',     description:'揭竿而起' }
  };

  var MINXIN_SOURCES_14 = [
    'taxation','corvee','disasterRelief','judicialFairness',
    'localOfficial','priceStability','security','socialMobility',
    'culturalPolicy','heavenSign','auspicious','prophecy',
    'warResult','imperialVirtue'
  ];

  function _ensureMinxin() {
    var G = global.GM;
    if (!G) return null;
    if (!G.minxin || typeof G.minxin === 'number') {
      var oldVal = typeof G.minxin === 'number' ? G.minxin : _readInitialValue('minxin', 60);
      var mxClInit = _readInitialObject('minxinByClass') || {};
      G.minxin = {
        trueIndex: oldVal,
        perceivedIndex: oldVal,
        phase: 'peaceful',
        trend: 'stable',
        sources: {},
        byRegion: {},
        byClass: {},
        prophecy: { intensity: 0, pendingTriggers: [] },
        revolts: []
      };
      MINXIN_SOURCES_14.forEach(function(s){ G.minxin.sources[s] = 0; });
      // 从编辑器初值读分阶层起始值
      Object.keys(mxClInit).forEach(function(cl) {
        G.minxin.byClass[cl] = { index: mxClInit[cl], trend: 'stable', factors: {} };
      });
    } else {
      if (!G.minxin.sources) G.minxin.sources = {};
      if (!G.minxin.byRegion) G.minxin.byRegion = {};
      if (!G.minxin.byClass) G.minxin.byClass = {};
      if (!G.minxin.prophecy) G.minxin.prophecy = { intensity:0, pendingTriggers:[] };
      if (!G.minxin.revolts) G.minxin.revolts = [];
      if (G.minxin.trueIndex === undefined) G.minxin.trueIndex = 60;
      MINXIN_SOURCES_14.forEach(function(s){ if (G.minxin.sources[s] === undefined) G.minxin.sources[s] = 0; });
    }
    return G.minxin;
  }

  function _getMinxinPhase(idx) {
    if (idx >= 80) return 'adoring';
    if (idx >= 60) return 'peaceful';
    if (idx >= 40) return 'uneasy';
    if (idx >= 20) return 'angry';
    return 'revolt';
  }

  function adjustMinxin(source, delta, reason) {
    var mx = _ensureMinxin();
    if (!mx) return;
    mx.trueIndex = Math.max(0, Math.min(100, mx.trueIndex + delta));
    if (mx.sources[source] !== undefined) mx.sources[source] += delta;
    var newPhase = _getMinxinPhase(mx.trueIndex);
    if (newPhase !== mx.phase) {
      mx.phase = newPhase;
      if (global.addEB) global.addEB('民心', '转入 ' + MINXIN_PHASE[newPhase].name + '（' + Math.round(mx.trueIndex) + '）');
    }
    mx.trend = delta > 0 ? 'rising' : delta < 0 ? 'falling' : 'stable';
  }

  function applyTyrantExecutionAmplification(executionPlan) {
    var G = global.GM;
    if (!G.huangwei || !G.huangwei.tyrantSyndrome || !G.huangwei.tyrantSyndrome.active) return executionPlan;
    var ts = G.huangwei.tyrantSyndrome;
    if (executionPlan.type === 'corvee') {
      executionPlan.scale = (executionPlan.scale || 1) * 1.3;
      executionPlan.deathRate = (executionPlan.deathRate || 0.05) * 1.2;
    }
    if (executionPlan.type === 'refugeeResettlement') {
      executionPlan.coerced = true;
      if (global.addEB) global.addEB('暴君', '招抚变强徙');
      if (global._adjAuthority) global._adjAuthority('minxin', -5);
    }
    if (executionPlan.type === 'envPolicy') {
      executionPlan.penalty = 'extreme';
    }
    if (executionPlan.type === 'punishment') {
      executionPlan.scopeMult = 3;
    }
    if (!ts.overExecutionLog) ts.overExecutionLog = [];
    ts.overExecutionLog.push({ turn: G.turn, plan: executionPlan.type, overScale: 1.3 });
    if (ts.overExecutionLog.length > 20) ts.overExecutionLog.splice(0, ts.overExecutionLog.length - 20);
    return executionPlan;
  }

  function filterQueryOptionsByPhase(allOptions) {
    var G = global.GM;
    var hq = G.huangquan && G.huangquan.index || 55;
    if (hq >= 75) {
      return allOptions.slice(0, 3);
    } else if (hq >= 35) {
      return allOptions;
    } else {
      var pm = G.huangquan.powerMinister;
      if (!pm) return allOptions;
      return allOptions.filter(function(o) {
        return !(o.route === 'integrity' && pm.faction && pm.faction.length > 0);
      });
    }
  }

  function _updateMinxinPerceived() {
    var mx = _ensureMinxin();
    if (!mx) return;
    var G = global.GM;
    // 腐败高 → 感知偏正面（虚报）
    var corruptLevel = 0;
    if (G.corruption && G.corruption.overall !== undefined) corruptLevel = G.corruption.overall;
    else if (typeof G.corruption === 'number') corruptLevel = G.corruption;
    var distortion = corruptLevel / 100 * 15; // 最多高估 15 点
    mx.perceivedIndex = Math.min(100, mx.trueIndex + distortion);
  }

  function _tickMinxin(ctx, mr) {
    var mx = _ensureMinxin();
    if (!mx) return;
    var G = global.GM;
    // 14 来源
    // 赋税
    if (G.taxPressure > 60) adjustMinxin('taxation', -(G.taxPressure - 60) * 0.01 * mr, '赋税过重');
    // 徭役
    if (G.population && G.population.corvee) {
      var corveeBurden = (G.population.corvee.annualCorveeDays || 30) / 30;
      if (corveeBurden > 1.2) adjustMinxin('corvee', -(corveeBurden - 1.2) * 0.5 * mr, '徭役重');
    }
    // 灾赈
    if (G.vars && G.vars.disasterLevel > 0.3) {
      if (G.guoku && G.guoku.money > 50000) adjustMinxin('disasterRelief', +0.3 * mr, '有赈');
      else adjustMinxin('disasterRelief', -0.5 * mr, '无赈');
    }
    // 地方官清浊
    var corruptOfficials = (G.chars || []).filter(function(c) { return c.alive !== false && (c.integrity || 60) < 30; }).length;
    var cleanOfficials = (G.chars || []).filter(function(c) { return c.alive !== false && (c.integrity || 60) > 80; }).length;
    if (corruptOfficials > cleanOfficials) adjustMinxin('localOfficial', -0.1 * mr * (corruptOfficials - cleanOfficials) / 5, '贪官多');
    else if (cleanOfficials > corruptOfficials * 2) adjustMinxin('localOfficial', +0.1 * mr, '清官多');
    // 粮价
    if (G.currency && G.currency.market) {
      var grainPrice = G.currency.market.grainPrice || 100;
      if (grainPrice > 200) adjustMinxin('priceStability', -0.4 * mr, '粮贵');
      else if (grainPrice < 80) adjustMinxin('priceStability', +0.1 * mr, '粮贱');
    }
    // 战事
    if (G.activeWars && G.activeWars.length > 0) adjustMinxin('warResult', -0.2 * mr * G.activeWars.length, '战乱');
    // 皇帝德行
    var hwIdx = (G.huangwei && G.huangwei.index) || 50;
    if (hwIdx > 80) adjustMinxin('imperialVirtue', +0.1 * mr, '君德昭著');
    else if (hwIdx < 30) adjustMinxin('imperialVirtue', -0.2 * mr, '君德失');
    // 谶纬流言（民怨段激化）
    if (mx.trueIndex < 40) {
      mx.prophecy.intensity = Math.min(1, mx.prophecy.intensity + 0.005 * mr);
    } else {
      mx.prophecy.intensity = Math.max(0, mx.prophecy.intensity - 0.002 * mr);
    }
    // 民变触发（B3 分段）
    if (mx.trueIndex < 20 && Math.random() < 0.05 * mr) {
      _triggerRevolt(ctx);
    }
    _updateMinxinPerceived();
  }

  function _triggerRevolt(ctx) {
    var mx = _ensureMinxin();
    if (!mx) return;
    var G = global.GM;
    var region = (G.regions || []).filter(function(r) { return r.unrest > 60; })[0];
    if (!region) return;
    var revolt = {
      id: 'revolt_' + ctx.turn + '_' + Math.floor(Math.random()*10000),
      turn: ctx.turn,
      region: region.id,
      scale: Math.round(Math.random() * 30000 + 5000),
      status: 'ongoing'
    };
    mx.revolts.push(revolt);
    if (global.addEB) global.addEB('民变', region.id + ' 民变，众约 ' + revolt.scale);
    if (typeof G.unrest === 'number') G.unrest = Math.min(100, G.unrest + 5);
    region.unrest = Math.min(100, (region.unrest||30) + 10);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  变量联动 — 7×6 = 42 项
  // ═══════════════════════════════════════════════════════════════════

  /** 核心七变量：guoku / neitang / population / corruption / minxin / huangquan / huangwei
   *  每回合执行 42 联动 */

  function _tickVarLinkage(ctx, mr) {
    var G = global.GM;
    if (!G) return;

    // ── 帑廪 → 其他 ──
    var guokuMoney = (G.guoku && G.guoku.money) || 0;
    // 帑廪 → 内帑（帑廪满时可转入内帑）
    if (guokuMoney > 5000000 && G.neitang) {
      var transfer = guokuMoney * 0.002 * mr;
      G.guoku.money -= transfer;
      G.neitang.money = (G.neitang.money || 0) + transfer;
    }
    // 帑廪 → 户口（帑廪困则徭役重）
    if (guokuMoney < 100000 && G.population && G.population.corvee) {
      G.population.corvee.annualCorveeDays = Math.min(60, (G.population.corvee.annualCorveeDays || 30) + 0.1 * mr);
    }
    // 帑廪 → 腐败（紧时腐败敛财）
    if (guokuMoney < 50000 && G.corruption) {
      if (typeof G.corruption === 'object' && G.corruption.overall !== undefined) {
        G.corruption.overall = Math.min(100, G.corruption.overall + 0.1 * mr);
      }
    }
    // 帑廪 → 民心（充盈时民心升）
    if (guokuMoney > 2000000) adjustMinxin('taxation', 0.05 * mr, '国用充足');
    // 帑廪 → 皇权（充盈时皇权稳）
    if (guokuMoney > 2000000) adjustHuangquan('personalRule', 0.05 * mr, '财赋充足');
    // 帑廪 → 皇威（充盈时威远)
    if (guokuMoney > 5000000) adjustHuangwei('grandCeremony', 0.05 * mr, '殷实');

    // ── 内帑 → 其他 ──
    var neitangMoney = (G.neitang && G.neitang.money) || 0;
    // 内帑 → 帑廪（危机时皇帝出内帑助国）
    if (guokuMoney < 100000 && neitangMoney > 500000) {
      var aid = Math.min(neitangMoney * 0.1, 500000) * mr / 12;
      G.neitang.money -= aid;
      if (G.guoku) G.guoku.money = (G.guoku.money || 0) + aid;
      if (global.addEB && aid > 10000) global.addEB('内帑', '内帑助国 ' + Math.round(aid));
    }
    // 内帑 → 皇威（丰厚时皇威增）
    if (neitangMoney > 3000000) adjustHuangwei('grandCeremony', 0.02 * mr);
    // 内帑 → 腐败（宗室奢靡促腐败）
    if (neitangMoney > 5000000 && G.corruption && typeof G.corruption === 'object') {
      G.corruption.overall = Math.min(100, (G.corruption.overall || 30) + 0.05 * mr);
    }

    // ── 户口 → 其他 ──
    var population = G.population && G.population.national;
    if (population) {
      // 户口 → 帑廪（逃户流失税基）
      var fugRatio = (G.population.fugitives || 0) / Math.max(1, population.mouths);
      if (fugRatio > 0.05 && G.guoku) {
        // 税收损失
        G.guoku.money = Math.max(0, G.guoku.money - population.ding * fugRatio * 2 * mr / 12);
      }
      // 户口 → 民心（逃户增则民怨）
      if (fugRatio > 0.08) adjustMinxin('localOfficial', -0.2 * mr, '逃户众');
      // 户口 → 皇威（人口兴则威）
      if (population.mouths > 100000000) adjustHuangwei('benevolence', 0.03 * mr, '人口繁盛');
    }

    // ── 腐败 → 其他 ──
    var corruptOverall = (G.corruption && G.corruption.overall) || (typeof G.corruption === 'number' ? G.corruption : 30);
    // 腐败 → 帑廪（税收漏损）
    if (corruptOverall > 40 && G.guoku) {
      var loss = Math.max(0, (corruptOverall - 40)) * 1000 * mr / 12;
      G.guoku.money = Math.max(0, G.guoku.money - loss);
    }
    // 腐败 → 内帑（宫内也被侵蚀）
    if (corruptOverall > 60 && G.neitang) {
      G.neitang.money = Math.max(0, (G.neitang.money || 0) - corruptOverall * 100 * mr / 12);
    }
    // 腐败 → 民心（直接）
    if (corruptOverall > 50) adjustMinxin('localOfficial', -(corruptOverall - 50) * 0.005 * mr, '贪腐横行');
    // 腐败 → 皇权（虚报扭曲）
    if (corruptOverall > 70) adjustHuangquan('idleGovern', -0.1 * mr, '虚报失真');
    // 腐败 → 皇威（官场贿赂公开化）
    if (corruptOverall > 80) adjustHuangwei('courtScandal', -0.2 * mr, '贿赂公行');

    // ── 民心 → 其他 ──
    var mx = _ensureMinxin();
    if (mx) {
      // 民心 → 帑廪（征税效率）
      var taxEff = 1 + (mx.trueIndex - 60) / 200;
      G._taxEfficiencyMult = Math.max(0.5, Math.min(1.3, taxEff));
      // 民心 → 户口（逃亡率）
      if (mx.trueIndex < 30 && G.population) {
        G.population.fugitives = (G.population.fugitives || 0) + Math.round(population.mouths * 0.001 * mr);
      }
      // 民心 → 皇权（民变威胁皇权）
      if (mx.trueIndex < 30) adjustHuangquan('idleGovern', -0.15 * mr, '民心向背');
      // 民心 → 皇威
      if (mx.trueIndex > 80) adjustHuangwei('benevolence', 0.05 * mr, '民拥戴');
      else if (mx.trueIndex < 30) adjustHuangwei('lostVirtueRumor', -0.1 * mr, '失德于民');
    }

    // ── 皇权 → 其他 ──
    var hq = _ensureHuangquan();
    if (hq) {
      // 皇权 → 腐败（强时可镇压）
      if (hq.index > 75 && G.corruption && typeof G.corruption === 'object') {
        G.corruption.overall = Math.max(0, G.corruption.overall - 0.1 * mr);
      }
      // 皇权 → 皇威（强皇权 → 诏令执行，威增）
      if (hq.index > 70) adjustHuangwei('structuralReform', 0.05 * mr);
      else if (hq.index < 30) adjustHuangwei('memorialObjection', -0.1 * mr, '皇权旁落');
    }

    // ── 皇威 → 其他 ──
    var hw = _ensureHuangwei();
    if (hw) {
      // 皇威 → 民心
      if (hw.index > 80) adjustMinxin('imperialVirtue', 0.05 * mr);
      else if (hw.index < 30) adjustMinxin('imperialVirtue', -0.1 * mr);
      // 皇威 → 皇权
      if (hw.index > 85) adjustHuangquan('personalRule', 0.03 * mr, '\u7687\u5a01\u6781\u76db\u4f20\u5bfc');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI 上下文
  // ═══════════════════════════════════════════════════════════════════

  function getAuthorityAIContext() {
    var G = global.GM;
    if (!G) return '';
    var lines = [];
    var hw = G.huangwei, hq = G.huangquan, mx = G.minxin;
    if (hw && typeof hw === 'object') {
      var phase = HUANGWEI_PHASE[hw.phase] || HUANGWEI_PHASE.normal;
      lines.push('【皇威】' + Math.round(hw.index) + ' (' + phase.name + ')' + (hw.tyrantSyndrome && hw.tyrantSyndrome.active ? ' · 暴君激活' : '') + (hw.lostAuthorityCrisis && hw.lostAuthorityCrisis.active ? ' · 失威危机' : ''));
      if (hw.perceivedIndex && Math.abs(hw.perceivedIndex - hw.index) > 5) {
        lines.push('（感知 ' + Math.round(hw.perceivedIndex) + ' — 可能被扭曲）');
      }
    }
    if (hq && typeof hq === 'object') {
      var hqPhase = HUANGQUAN_PHASE[hq.phase] || HUANGQUAN_PHASE.moderate;
      lines.push('【皇权】' + Math.round(hq.index) + ' (' + hqPhase.name + ')' + (hq.executionRate ? ' · 诏令执行率 ' + (hq.executionRate*100).toFixed(0) + '%' : ''));
    }
    if (mx && typeof mx === 'object') {
      var mxPhase = MINXIN_PHASE[mx.phase] || MINXIN_PHASE.peaceful;
      lines.push('【民心】真实 ' + Math.round(mx.trueIndex) + ' (' + mxPhase.name + ')' + (mx.perceivedIndex && Math.abs(mx.perceivedIndex - mx.trueIndex) > 5 ? ' 感知 ' + Math.round(mx.perceivedIndex) + '（虚报）' : ''));
      if (mx.prophecy && mx.prophecy.intensity > 0.3) lines.push('谶纬流传 · 强度 ' + (mx.prophecy.intensity*100).toFixed(0) + '%');
      if (mx.revolts && mx.revolts.filter(function(r){return r.status==='ongoing';}).length > 0) {
        var ongoing = mx.revolts.filter(function(r){return r.status==='ongoing';});
        lines.push('进行中民变：' + ongoing.length + ' 处');
      }
    }
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  主 tick + init
  // ═══════════════════════════════════════════════════════════════════

  function init() {
    _ensureHuangwei();
    _ensureHuangquan();
    _ensureMinxin();
  }

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _tickHuangwei(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth] hw:') : console.error('[auth] hw:', e); }
    try { _tickHuangquan(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth] hq:') : console.error('[auth] hq:', e); }
    try { _tickMinxin(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth] mx:') : console.error('[auth] mx:', e); }
    try { _tickVarLinkage(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth] linkage:') : console.error('[auth] linkage:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  // 兼容旧代码的 getter/setter（读取时返回数字，写入时走结构化）
  function getHuangweiValue() { var G = global.GM; if (!G) return 50; return (G.huangwei && typeof G.huangwei === 'object') ? (G.huangwei.index || 50) : (G.huangwei || 50); }
  function getHuangquanValue() { var G = global.GM; if (!G) return 50; return (G.huangquan && typeof G.huangquan === 'object') ? (G.huangquan.index || 50) : (G.huangquan || 50); }
  function getMinxinValue() { var G = global.GM; if (!G) return 60; return (G.minxin && typeof G.minxin === 'object') ? (G.minxin.trueIndex || 60) : (G.minxin || 60); }

  // 通用调节（兼容对象或数字形式，供旧代码调用）
  global._adjAuthority = function(name, delta, reason, opts) {
    var G = global.GM;
    if (!G) return;
    if (name === 'huangquan') {
      return adjustHuangquan((opts && opts.source) || 'legacy-adj-authority', delta, reason, opts);
    }
    var v = G[name];
    if (v === undefined || v === null) return;
    if (typeof v === 'number') {
      G[name] = Math.max(0, Math.min(100, v + delta));
    } else if (typeof v === 'object') {
      var key = name === 'minxin' ? 'trueIndex' : 'index';
      v[key] = Math.max(0, Math.min(100, (v[key] || 50) + delta));
    }
  };

  global.AuthorityEngines = {
    init: init,
    tick: tick,
    adjustHuangwei: adjustHuangwei,
    adjustHuangquan: adjustHuangquan,
    setHuangquan: setHuangquan,
    adjustMinxin: adjustMinxin,
    applyTyrantExecutionAmplification: applyTyrantExecutionAmplification,
    filterQueryOptionsByPhase: filterQueryOptionsByPhase,
    getHuangweiValue: getHuangweiValue,
    getHuangquanValue: getHuangquanValue,
    getMinxinValue: getMinxinValue,
    executePurge: _executePurge,
    getAuthorityAIContext: getAuthorityAIContext,
    HUANGWEI_PHASE: HUANGWEI_PHASE,
    HUANGQUAN_PHASE: HUANGQUAN_PHASE,
    MINXIN_PHASE: MINXIN_PHASE,
    HUANGWEI_SOURCES_14: HUANGWEI_SOURCES_14,
    HUANGWEI_DRAINS_14: HUANGWEI_DRAINS_14,
    HUANGQUAN_SOURCES_8: HUANGQUAN_SOURCES_8,
    HUANGQUAN_DRAINS_8: HUANGQUAN_DRAINS_8,
    MINXIN_SOURCES_14: MINXIN_SOURCES_14,
    _updatePerceivedHuangwei_f1: _updatePerceivedHuangwei,
    getUnifiedHuangquanPhaseHandler: getUnifiedHuangquanPhaseHandler,
    checkDecreeRealtime: checkDecreeRealtime,
    VERSION: 1
  };

  global.applyTyrantExecutionAmplification = applyTyrantExecutionAmplification;
  global.filterQueryOptionsByPhase = filterQueryOptionsByPhase;
  global.checkDecreeRealtime = checkDecreeRealtime;
  global.PhaseF1 = {
    init: function(){},
    tick: function(){},
    updatePerceivedHuangwei: _updatePerceivedHuangwei,
    rotateOfficialsWithDecay: function(pmName) {
      if (!global.PhaseD || !global.PhaseD.COUNTER_STRATEGIES || !global.PhaseD.COUNTER_STRATEGIES.rotate_officials) return { ok: false };
      var G = global.GM;
      var pm = G && G.huangquan && G.huangquan.powerMinister;
      if (!pm || pm.name !== pmName) return { ok: false };
      return global.PhaseD.COUNTER_STRATEGIES.rotate_officials.effect(G);
    },
    getUnifiedHuangquanPhaseHandler: getUnifiedHuangquanPhaseHandler,
    checkDecreeRealtime: checkDecreeRealtime,
    VERSION: 2
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
