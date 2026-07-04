// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   皇威/皇权/民心 三系统 + 变量联动（暴露 AuthorityEngines · _adjAuthority · TM.MinxinLedger）
//   §1 皇威   14 升 + 14 降 + 5 段 + 暴君/失威 + 感知扭曲 · 按源差异化封顶 · 天象扣分衰减
//   §2 皇权   8 升 + 8 降 + 3 段 + 四象限 · 选择性衰减（按前因判定回暖·无信号绝不假回血）
//   §3 民心   14 来源 + 5 级 + 8 传导 + 分区分阶层
//   §4 联动   7×6=42 项联动矩阵：帑廪/内帑/户口/腐败/民心/皇权/皇威 → 其他
//   其他   applyTyrantExecutionAmplification · checkDecreeRealtime · PhaseF1
// ─────────────────────────────────────────────
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

  function _corrIndex(G) {
    var c = G && G.corruption;
    if (typeof c === 'number') return c;
    if (!c || typeof c !== 'object') return 30;
    if (typeof c.trueIndex === 'number') return c.trueIndex;
    if (typeof c.overall === 'number') return c.overall;
    if (typeof c.index === 'number') return c.index;
    return 30;
  }

  function _setCorrIndex(G, value) {
    if (!G || !G.corruption || typeof G.corruption !== 'object') return;
    var next = Math.max(0, Math.min(100, Number(value) || 0));
    G.corruption.trueIndex = next;
    G.corruption.overall = next;
    if (G.corruption.perceivedIndex === undefined) G.corruption.perceivedIndex = next;
  }

  function _addCorrIndex(G, delta) {
    _setCorrIndex(G, _corrIndex(G) + (Number(delta) || 0));
  }

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

  // ── P-ZV7 皇威·按源差异化封顶（E.B 锁定·明史轻重分档）──
  //   加分源各自的累计上限（ceiling）：单一来源最多把皇威抬高这么多。selfBlame(罪己)不当常规加分→0。
  var HUANGWEI_SOURCE_CAP = {
    militaryVictory: 20, territoryExpansion: 18, personalCampaign: 18, suppressRevolt: 15,
    executeRebelMinister: 12, structuralReform: 12, grandCeremony: 10, benevolence: 10,
    tribute: 10, rehabilitation: 8, culturalAchievement: 8, auspicious: 6, imperialFuneral: 6,
    selfBlame: 0, _default: 12
  };
  //   扣分源各自的累计下限（floor·此处存绝对值）：单一来源最多把皇威拉低这么多。越亡国级越深。
  //   heavenlySign(天象) 封顶 25 沿用 P-5TK 特殊数，且其衰减仍走 P-5TK 的 0.10 比例（不进统一 0.5/回合）。
  var HUANGWEI_DRAIN_CAP = {
    imperialFlight: 50, capitalFall: 30, forcedAbdication: 25, personalCampaignFail: 20,
    deposeFailure: 18, militaryDefeat: 18, diplomaticHumiliation: 15, idleGovern: 15,
    brokenPromise: 12, courtScandal: 12, lostVirtueRumor: 10, familyScandal: 10,
    memorialObjection: 8, heavenlySign: 25, selfBlame: 24, _default: 15
  };

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
    // P-ZV7 罪己诏：selfBlame 在 SOURCES_14、不在 DRAINS_14·但罪己走 drains 记账·此处兜底初始化好让 adjustHuangwei 记得进去
    if (G.huangwei.drains && G.huangwei.drains.selfBlame === undefined) G.huangwei.drains.selfBlame = 0;
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
      var corr = _corrIndex(G);
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
    // P-ZV7 ③按源封顶：先按该源已累计余量削这笔 delta（削后 index 与 sources/drains 同口径·同民心套路）。
    //   加分→sources[source] 不超 ceiling；扣分→drains[source] 不超 floor 绝对值。源不在表里走 _default。
    if (amount > 0) {
      var _hwCeil = (HUANGWEI_SOURCE_CAP[source] !== undefined) ? HUANGWEI_SOURCE_CAP[source] : HUANGWEI_SOURCE_CAP._default;
      amount = Math.max(0, Math.min(amount, _hwCeil - (Number(hw.sources[source]) || 0)));
    } else {
      var _hwFloor = (HUANGWEI_DRAIN_CAP[source] !== undefined) ? HUANGWEI_DRAIN_CAP[source] : HUANGWEI_DRAIN_CAP._default;
      amount = -Math.max(0, Math.min(-amount, _hwFloor - (Number(hw.drains[source]) || 0)));
    }
    if (amount === 0) return { ok: false, reason: 'source-capped', source: source };
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
    // 不再因“无事迹/久无诏令”自动衰减；只记录本轮皇威 tick。
    hw.history.lastAuthorityTick = ctx.turn || 0;
    // ── P-5TK·皇威天象扣分衰减+封顶（双账·drains.heavenlySign 累计扣分→回血 index + 同步削 drain 显示·老存档同样回血）──
    // 衰减参数·owner 可调（被动机制参数·非玩家操作效果量）
    var P5TK_HW_HEAL = 0.10, P5TK_HW_CAP = 25, P5TK_HW_MIN = 0.5;
    var hsDrain = hw.drains.heavenlySign || 0;
    if (hsDrain > 0) {
      var hwHeal = Math.min(hsDrain, Math.max(P5TK_HW_MIN, hsDrain * P5TK_HW_HEAL) * mr);
      hw.index = Math.min(100, hw.index + hwHeal);
      hw.drains.heavenlySign = Math.max(0, hsDrain - hwHeal);
    }
    if ((hw.drains.heavenlySign || 0) > P5TK_HW_CAP) {
      hw.index = Math.min(100, hw.index + ((hw.drains.heavenlySign || 0) - P5TK_HW_CAP));
      hw.drains.heavenlySign = P5TK_HW_CAP;
    }
    // ── P-ZV7 ①皇威·扣分项自然衰减：drains 每回合朝 0 衰 0.5×mr 回血 index（加分项 sources 不衰）。
    //   天象 drain 上面已按 P-5TK 特殊数(0.10/封25)单独处理·此处跳过。其余 drain 衰减 + 超本源封顶则削平回血。衰减率·可调。
    var P_ZV7_HW_DECAY = 0.5;
    HUANGWEI_DRAINS_14.forEach(function(d) {
      if (d === 'heavenlySign') return;
      var dv = hw.drains[d] || 0;
      if (dv > 0) {
        var heal = Math.min(dv, P_ZV7_HW_DECAY * mr);
        hw.index = Math.min(100, hw.index + heal);
        hw.drains[d] = Math.max(0, dv - heal);
      }
      var cap = (HUANGWEI_DRAIN_CAP[d] !== undefined) ? HUANGWEI_DRAIN_CAP[d] : HUANGWEI_DRAIN_CAP._default;
      if ((hw.drains[d] || 0) > cap) {
        hw.index = Math.min(100, hw.index + ((hw.drains[d] || 0) - cap));
        hw.drains[d] = cap;
      }
    });
    // selfBlame(罪己)走 drains 但不在 DRAINS_14·同样衰减回血（罪己的皇威损会衰·与民心增益对称·见罪己诏批次）
    if ((hw.drains.selfBlame || 0) > 0) {
      var sbHeal = Math.min(hw.drains.selfBlame, P_ZV7_HW_DECAY * mr);
      hw.index = Math.min(100, hw.index + sbHeal);
      hw.drains.selfBlame = Math.max(0, hw.drains.selfBlame - sbHeal);
    }
    // P-5TK·衰减/封顶改了 hw.index → 同步重算段位 phase + 按新 index 修正暴君/失威 active（否则 index 变了 phase 缓存滞留·面板段位与威望脱节·authority-ui 还拿 phase 算皇威乘数）
    hw.phase = _getHuangweiPhase(hw.index);
    hw.tyrantSyndrome.active = hw.index > 90 ? true : (hw.index < 85 ? false : hw.tyrantSyndrome.active);
    hw.lostAuthorityCrisis.active = hw.index < 30 ? true : (hw.index > 35 ? false : hw.lostAuthorityCrisis.active);
    _updatePerceivedHuangwei(hw);
  }

  // ── P-ZV7 ⑤皇威·读档削平：把各源累计 sources/drains 夹回封顶内·同步修正 index（老档历史超额账规整）。
  //   超 ceiling 的加分→削超额并回落 index；超 floor 的扣分→削超额并回血 index。由 migration 读档调一次（幂等）。
  function regularizeHuangweiCaps(root) {
    var G = root || global.GM;
    if (!G || !G.huangwei) return { adjusted: 0, detail: [] };
    var hw = G.huangwei;
    if (!hw.sources) hw.sources = {};
    if (!hw.drains) hw.drains = {};
    var out = [];
    Object.keys(hw.sources).forEach(function(s) {
      var cap = (HUANGWEI_SOURCE_CAP[s] !== undefined) ? HUANGWEI_SOURCE_CAP[s] : HUANGWEI_SOURCE_CAP._default;
      var cur = Number(hw.sources[s]) || 0;
      if (cur > cap) {
        hw.index = Math.max(0, hw.index - (cur - cap));   // 加分超额→回落 index
        hw.sources[s] = cap; out.push(s + ' +' + cur + '→+' + cap);
      }
    });
    Object.keys(hw.drains).forEach(function(d) {
      var cap = (HUANGWEI_DRAIN_CAP[d] !== undefined) ? HUANGWEI_DRAIN_CAP[d] : HUANGWEI_DRAIN_CAP._default;
      var cur = Number(hw.drains[d]) || 0;
      if (cur > cap) {
        hw.index = Math.min(100, hw.index + (cur - cap));  // 扣分超额→回血 index
        hw.drains[d] = cap; out.push(d + ' -' + cur + '→-' + cap);
      }
    });
    hw.index = Math.max(0, Math.min(100, hw.index));
    if (typeof _getHuangweiPhase === 'function') hw.phase = _getHuangweiPhase(hw.index);
    if (typeof _updatePerceivedHuangwei === 'function') _updatePerceivedHuangwei(hw);
    return { adjusted: out.length, detail: out };
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

  // ── P-ZV7 皇权·按源差异化封顶（E.B 草案·明史轻重）。高位反噬另有民心倒U(tm-feedback-loops 专制过严)·此处不重复罚。
  //   加分源累计上限（ceiling·集权）：单源最多把皇权抬高这么多。
  var HUANGQUAN_SOURCE_CAP = {
    purge: 18, executePM: 15, personalRule: 15, militaryCentral: 15,
    structureReform: 12, secretPolice: 12, heirDecision: 10, tour: 8, _default: 12
  };
  //   扣分源累计下限（floor·此处存绝对值·分权）：单源最多把皇权拉低这么多。
  var HUANGQUAN_DRAIN_CAP = {
    youngOrIllness: 25, trustedMinister: 22, cabinetization: 18, factionConsuming: 18,
    eunuchsRelatives: 15, idleGovern: 15, memorialObjection: 10, militaryDefeat: 10, _default: 15
  };
  // ① 选择性衰减分类：事件类（过去就淡）每回合衰；状态类（前因在就维持·消失才回暖）不无脑衰·靠重评/前因判定。
  var HUANGQUAN_DRAIN_EVENT = { militaryDefeat: 1, memorialObjection: 1 };   // 事件类·每回合衰减回血

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
    // P-ZV7 ③按源封顶：按该源已累计 sources/drains 余量先削这笔 delta（削后 index 与账本同口径·同皇威/民心套路）。
    if (!(opts && opts.skipSourceCap)) {
      if (amount > 0) {
        var _hqCeil = (HUANGQUAN_SOURCE_CAP[source] !== undefined) ? HUANGQUAN_SOURCE_CAP[source] : HUANGQUAN_SOURCE_CAP._default;
        amount = Math.max(0, Math.min(amount, _hqCeil - (Number(hq.sources[source]) || 0)));
      } else {
        var _hqFloor = (HUANGQUAN_DRAIN_CAP[source] !== undefined) ? HUANGQUAN_DRAIN_CAP[source] : HUANGQUAN_DRAIN_CAP._default;
        amount = -Math.max(0, Math.min(-amount, _hqFloor - (Number(hq.drains[source]) || 0)));
      }
      if (amount === 0) return { ok: false, reason: 'source-capped', source: source };
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
    var setOpts = {};
    Object.keys(opts || {}).forEach(function(k){ setOpts[k] = opts[k]; });
    setOpts.skipSourceCap = true;
    return adjustHuangquan((opts && opts.source) || 'set', target - oldValue, reason, setOpts);
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
    // ── P-ZV7 ①A 选择性衰减（皇权扣分多是持续状态·不无脑衰·按前因判定回暖）──
    var P_ZV7_HQ_DECAY = 0.5;
    // 事件类（军败/抗疏）：过去就淡·每回合衰回血
    Object.keys(HUANGQUAN_DRAIN_EVENT).forEach(function(d) {
      var dv = hq.drains[d] || 0;
      if (dv > 0) { var h = Math.min(dv, P_ZV7_HQ_DECAY * mr); hq.index = Math.min(100, hq.index + h); hq.drains[d] = Math.max(0, dv - h); }
    });
    // 状态类·权臣坐大：前因(权臣久任+高野心)还在则上方已维持；前因消失→回暖
    var _trustedActive = longTrusted.length > 0 && (longTrusted[0]._tenureMonths || 0) > 60 && longTrusted[0].ambition > 70;
    if (!_trustedActive && (hq.drains.trustedMinister || 0) > 0) {
      var ht = Math.min(hq.drains.trustedMinister, P_ZV7_HQ_DECAY * mr); hq.index = Math.min(100, hq.index + ht); hq.drains.trustedMinister -= ht;
    }
    // 状态类·宦官外戚：前因(scandalous>2)消失→回暖
    if (scandalous.length <= 2 && (hq.drains.eunuchsRelatives || 0) > 0) {
      var he = Math.min(hq.drains.eunuchsRelatives, P_ZV7_HQ_DECAY * mr); hq.index = Math.min(100, hq.index + he); hq.drains.eunuchsRelatives -= he;
    }
    // ── P-ZV7 ①A·其余 4 个持续状态接前因信号（前因在→维持·消失→0.5 回暖）。无信号则 cleared=false·绝不假回血。──
    var _Ghq = global.GM;
    var _player = (_Ghq.chars || []).find(function(c) { return c && c.isPlayer; });
    var _youngIllCleared = !!_player && (Number(_player.age) || 30) >= 12 && (Number(_player.health) || 80) >= 40;   // 主少/病弱：成年且康复才算清
    var _ps = Number(_Ghq.partyStrife);
    var _factionCleared = isFinite(_ps) && _ps <= 55;                                                              // 党争：>70 起·≤55 消（滞回防抖）
    var _cabCleared = Array.isArray(_Ghq.dynamicInstitutions) && !_Ghq.dynamicInstitutions.some(function(inst) { return /内阁|军机|议政/.test((inst && inst.name) || ''); });  // 内阁化：有这份数据(数组)且其中无内阁/军机机构才算裁撤·清；字段缺失→不判不回血
    var _idleMonths = (global.P && global.P.conf && Number(global.P.conf.idleGovernMonths)) || 6;                  // 怠政阈值·月·玩家可调·默认6
    var _idleThresh = (typeof global.turnsForMonths === 'function') ? global.turnsForMonths(_idleMonths) : _idleMonths;  // 按剧本时间换算成回合
    var _lastCourt = (_Ghq._lastChangchaoDecisionMeta && Number(_Ghq._lastChangchaoDecisionMeta.turn)) || 0;
    var _idleCleared = !!_lastCourt && ((_Ghq.turn || 0) - _lastCourt) < _idleThresh;                             // 怠政：近期开过常朝才清·无常朝记录→不判
    [
      { k: 'youngOrIllness', clear: _youngIllCleared },
      { k: 'factionConsuming', clear: _factionCleared },
      { k: 'cabinetization', clear: _cabCleared },
      { k: 'idleGovern', clear: _idleCleared }
    ].forEach(function(s) {
      if (s.clear && (hq.drains[s.k] || 0) > 0) {
        var hh = Math.min(hq.drains[s.k], P_ZV7_HQ_DECAY * mr);
        hq.index = Math.min(100, hq.index + hh);
        hq.drains[s.k] = Math.max(0, hq.drains[s.k] - hh);
      }
    });
    // 全 drains 超本源封顶 → 削平回血（老路径写入/老档兜底）
    HUANGQUAN_DRAINS_8.forEach(function(d) {
      var cap = (HUANGQUAN_DRAIN_CAP[d] !== undefined) ? HUANGQUAN_DRAIN_CAP[d] : HUANGQUAN_DRAIN_CAP._default;
      if ((hq.drains[d] || 0) > cap) { hq.index = Math.min(100, hq.index + ((hq.drains[d] || 0) - cap)); hq.drains[d] = cap; }
    });
    hq.phase = _getHuangquanPhase(hq.index);   // 衰减/削平改了 index → 重算段位
    // 执行度传导（皇权 > 70 → 诏令 100% 执行；< 40 → 50% 被打折）
    var execRate = 0.5 + (hq.index / 100) * 0.5;
    hq.executionRate = execRate;
    // 大臣抗疏率（皇权越低抗疏越多）
    hq.ministers.objectionRate = Math.max(0.05, Math.min(0.6, 0.6 - hq.index / 200));
  }

  // ── P-ZV7 ⑤皇权·读档削平：把 sources/drains 历史超额账夹回各源封顶内·同步修正 index（老档规整）。
  //   超 ceiling 的加分→削超额回落 index；超 floor 的扣分→削超额回血 index。由 migration 读档调一次（幂等）。
  function regularizeHuangquanCaps(root) {
    var G = root || global.GM;
    if (!G || !G.huangquan) return { adjusted: 0, detail: [] };
    var hq = G.huangquan;
    if (!hq.sources) hq.sources = {};
    if (!hq.drains) hq.drains = {};
    var out = [];
    Object.keys(hq.sources).forEach(function(s) {
      var cap = (HUANGQUAN_SOURCE_CAP[s] !== undefined) ? HUANGQUAN_SOURCE_CAP[s] : HUANGQUAN_SOURCE_CAP._default;
      var cur = Number(hq.sources[s]) || 0;
      if (cur > cap) { hq.index = Math.max(0, hq.index - (cur - cap)); hq.sources[s] = cap; out.push(s + ' +' + cur + '→+' + cap); }
    });
    Object.keys(hq.drains).forEach(function(d) {
      var cap = (HUANGQUAN_DRAIN_CAP[d] !== undefined) ? HUANGQUAN_DRAIN_CAP[d] : HUANGQUAN_DRAIN_CAP._default;
      var cur = Number(hq.drains[d]) || 0;
      if (cur > cap) { hq.index = Math.min(100, hq.index + (cur - cap)); hq.drains[d] = cap; out.push(d + ' -' + cur + '→-' + cap); }
    });
    hq.index = Math.max(0, Math.min(100, hq.index));
    if (typeof _getHuangquanPhase === 'function') hq.phase = _getHuangquanPhase(hq.index);
    return { adjusted: out.length, detail: out };
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

  function adjustMinxin(source, delta, reason, opts) {
    opts = opts || {};
    if (!opts.fromMinxinLedger) {
      try {
        var root = global.GM || (typeof window !== 'undefined' && window.GM) || null;
        if (root && global.TM && global.TM.MinxinLedger && typeof global.TM.MinxinLedger.recordAndApply === 'function') {
          return global.TM.MinxinLedger.recordAndApply(root, {
            sourceSystem: opts.sourceSystem || 'authority-engines',
            kind: source || opts.kind || 'authority-minxin',
            targetRegions: opts.targetRegions || opts.regions || opts.regionWeights || [],
            targetClasses: opts.targetClasses || opts.classes || [],
            affectedParties: opts.affectedParties || [],
            deltaTrue: delta,
            intensity: opts.intensity != null ? opts.intensity : Math.min(1, Math.abs(Number(delta) || 0) / 20),
            confidence: opts.confidence != null ? opts.confidence : 0.8,
            reason: reason || opts.reason || source || 'authority minxin change',
            linkedIssue: opts.linkedIssue || opts.issueId || '',
            policyActionId: opts.policyActionId || opts.actionId || '',
            courtIssueId: opts.courtIssueId || ''
          }, {
            source: opts.source || 'authority-engines',
            turn: root && root.turn
          });
        }
      } catch (_minxinLedgerE) {}
    }
    var mx = _ensureMinxin();
    if (!mx) return;
    mx.trueIndex = Math.max(0, Math.min(100, mx.trueIndex + delta));
    if (mx.sources[source] !== undefined) mx.sources[source] += delta;
    // P-DZ民心·治本：所有民心变化（玩家操作 + 引擎 tick）都把 delta 摊回玩家本势力各 div.minxin 叶子，
    //   叶子成民心唯一真相源、trueIndex 纯由回合末 aggregateRegionsToVariables 从叶子聚合——彻底消除
    //   「trueIndex 独立累积 vs 叶子」两本账。每叶子 += 同一 delta、加权均值即 +delta（数学等价）。
    //   注：引擎线负项（赋税/天象/战乱…）一并生效·民心动力学被打开·各 source 系数须桌面端跑回合配平。opts.persist 已废·留作向后兼容。
    if (Number(delta)) {
      try {
        var _IB = global.IntegrationBridge || (typeof window !== 'undefined' && window.IntegrationBridge) || null;
        var _Gp = global.GM || (typeof window !== 'undefined' && window.GM) || null;
        if (_IB && typeof _IB.getLeafDivisions === 'function' && _Gp && _Gp.adminHierarchy) {
          var _leaves = _IB.getLeafDivisions(_Gp.adminHierarchy, 'player') || [];
          for (var _li = 0; _li < _leaves.length; _li++) {
            var _ld = _leaves[_li];
            if (_ld && typeof _ld.minxin === 'number') _ld.minxin = Math.max(0, Math.min(100, _ld.minxin + delta));
          }
        }
      } catch (_pmE) {}
    }
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
    if (G.corruption) corruptLevel = _corrIndex(G);
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
    // 灾赈（P-ZV7·② 实政对冲·3a 逐笔分权重·自发半）：本回合真实赈灾/水利支出→disasterRelief 正项。
    //   归因按"代码路径"判·不信 AI 自报：此处汇总的是 AI 地方官自发的 disaster_relief/public_works_water
    //   动作（aiOutput.localActions→div.fiscal.expenditures.discretionary·带 turn 戳）·一律按"自发"5 折。
    //   玩家亲下的赈灾（诏令/议题/事件那条·确定的玩家代码路径）另在各自落账点按"奉旨"满额喂 disasterRelief。
    //   灾起而本回合零赈灾→维持负（① 持续状态·前因仍在不回暖）。封顶 disasterRelief −25~+20 交 MINXIN_SOURCE_CAP。
    //   旧逻辑（国库银>5万就算"有赈"）是拿国库余额冒充赈灾·与玩家有没有真开仓无关·已废。权重/折算·可调。
    var _zfReliefSpend = 0;
    try {
      var _IBdr = global.IntegrationBridge || (typeof window !== 'undefined' && window.IntegrationBridge) || null;
      var _drlvs = (_IBdr && typeof _IBdr.getLeafDivisions === 'function' && G.adminHierarchy) ? (_IBdr.getLeafDivisions(G.adminHierarchy, 'player') || []) : [];
      _drlvs.forEach(function(d) {
        var disc = d && d.fiscal && d.fiscal.expenditures && d.fiscal.expenditures.discretionary;
        if (Array.isArray(disc)) disc.forEach(function(act) {
          if (act && act.turn === G.turn && (act.type === 'disaster_relief' || act.type === 'public_works_water')) {
            _zfReliefSpend += (Number(act.amount) || 0);
          }
        });
      });
    } catch (_e) {}
    // 玩家本回合是否亲下赈灾诏（御案/诏书→PlayerActionSignals 带 relief 标签·确定的玩家代码路径）。
    //   若是·则本回合这些赈灾 act 算"奉旨"满额(1.0)·否则纯地方官自发 5 折。这样御案赈灾诏不会被当自发打折。
    //   （要务决断那条赈灾另在 tm-endturn-helpers._chooseIssueOption 直接路由 disasterRelief 满额·与此互不重叠。）
    var _playerOrderedRelief = false;
    try {
      var _pasItems = G._playerActionSignals && Array.isArray(G._playerActionSignals.items) ? G._playerActionSignals.items : [];
      _playerOrderedRelief = _pasItems.some(function(s) {
        return s && s.turn === G.turn && Array.isArray(s.policyTags) && s.policyTags.indexOf('relief') >= 0;
      });
    } catch (_e2) {}
    var P_ZV7_RELIEF_LOCAL_W = 0.5;   // 地方官自发赈灾权重·可调
    var P_ZV7_RELIEF_PER = 50000;     // 每多少两白银折满一档对冲·可调
    if (_zfReliefSpend > 0) {
      var _zfW = _playerOrderedRelief ? 1.0 : P_ZV7_RELIEF_LOCAL_W;   // 玩家本回合下了赈灾诏→奉旨满额·否则地方自发 5 折
      var _zfGain = Math.min(1.5, _zfReliefSpend / P_ZV7_RELIEF_PER * 0.6) * _zfW * mr;
      if (_zfGain > 0) adjustMinxin('disasterRelief', +_zfGain, _playerOrderedRelief ? '奉诏赈灾（实政对冲·满额）' : '地方赈灾·自发（实政对冲·5折）');
    } else if (G.vars && G.vars.disasterLevel > 0.3) {
      adjustMinxin('disasterRelief', -0.5 * mr, '灾起未赈');
    }
    // 地方官清浊
    var corruptOfficials = (G.chars || []).filter(function(c) { return c.alive !== false && (c.integrity || 60) < 30; }).length;
    var cleanOfficials = (G.chars || []).filter(function(c) { return c.alive !== false && (c.integrity || 60) > 80; }).length;
    if (corruptOfficials > cleanOfficials) adjustMinxin('localOfficial', -0.1 * mr * (corruptOfficials - cleanOfficials) / 5, '贪官多');
    else if (cleanOfficials > corruptOfficials * 2) adjustMinxin('localOfficial', +0.1 * mr, '清官多');
    // 民众敬爱：地方官名望(fame)众望所归→民心微涨·恶名昭彰→微跌（设计-角色经济·资源三 民众敬爱）。
    //   并入同一 localOfficial 源(同封顶·防双驱)·小幅(0.05)·只算在职官。fame≠prestige≠功名。
    var belovedOfficials = (G.chars || []).filter(function(c) { return c.alive !== false && c.officialTitle && c.resources && (c.resources.fame || 0) > 50; }).length;
    var hatedOfficials = (G.chars || []).filter(function(c) { return c.alive !== false && c.officialTitle && c.resources && (c.resources.fame || 0) < -30; }).length;
    if (belovedOfficials > hatedOfficials) adjustMinxin('localOfficial', +0.05 * mr * Math.min(3, belovedOfficials - hatedOfficials), '清望素著');
    else if (hatedOfficials > belovedOfficials) adjustMinxin('localOfficial', -0.05 * mr * Math.min(3, hatedOfficials - belovedOfficials), '民怨载道');
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
    // ── P-ZV7·自然回暖：一次性/不可抗力类源（天象/谶纬/祥瑞/战事）负累计每回合朝 0 回 P_ZV7_RECOVER 点
    //   （绝对值·只回暖负项·正项不衰）。"天象本是一时之灾、月余渐平"。封顶交 ledger 的 MINXIN_SOURCE_CAP
    //   按源差异化处理·此处不再单设 -25。持续状态类（赋税/徭役/物价/官吏…）由上方每回合重评 + ledger 封顶平台
    //   驱动·不在此回暖。回暖经 adjustMinxin→ledger→摊叶子·trueIndex 真回（非只动显示细项）。回暖率·机制参数·可调。
    var P_ZV7_RECOVER = 1; // 民心负项每回合自然回暖点数（皇威另配 0.5）
    ['heavenSign', 'prophecy', 'auspicious', 'warResult'].forEach(function(s) {
      var acc = mx.sources[s] || 0;
      if (acc < 0) {
        var heal = Math.min(-acc, P_ZV7_RECOVER * mr);
        if (heal > 0) adjustMinxin(s, heal, '一时之灾渐平（P-ZV7 回暖）');
      }
    });
    // ── P-DZ民心·稳定器（B 方案）：治本打开动力学后，给玩家叶子民心一个向「开局基线」缓慢回归的力，
    //   防引擎负项（赋税/天象/战乱…）累积把民心单调打崩。回归率 P_MX_REGRESS 小·机制参数·可调；
    //   基线 _minxinBase = 叶子开局民心（首回合锚定·保各地差异）·偏离越大拉力越大（线性回归）。──
    try {
      var _IBm = global.IntegrationBridge || (typeof window !== 'undefined' && window.IntegrationBridge) || null;
      if (_IBm && typeof _IBm.getLeafDivisions === 'function' && G && G.adminHierarchy) {
        var P_MX_REGRESS = 0.05; // 每回合（按月 mr）向开局基线回归比例·稳定器强度·可调
        var _mlvs = _IBm.getLeafDivisions(G.adminHierarchy, 'player') || [];
        for (var _mi = 0; _mi < _mlvs.length; _mi++) {
          var _md = _mlvs[_mi];
          if (!_md || typeof _md.minxin !== 'number') continue;
          if (typeof _md._minxinBase !== 'number') _md._minxinBase = _md.minxin; // 首回合锚定开局基线
          var _gap = _md._minxinBase - _md.minxin;
          if (_gap) _md.minxin = Math.max(0, Math.min(100, _md.minxin + _gap * P_MX_REGRESS * mr));
        }
      }
    } catch (_msE) {}
    // B·民变触发改各省：扫玩家叶子，任一省 div.minxin 低于阈值 → 该省按低概率揭竿（不再卡全国 trueIndex<20，
    //   也不再被全国均值掩盖单省塌方）。越烂概率越高；该省已有 ongoing 民变由 _triggerRevolt 内去重。
    //   阈值 P_REVOLT_MX / 基础概率 P_REVOLT_BASE 为机制参数·owner 可调。无 adminHierarchy 时回退旧的全国闸。
    try {
      var _IBr = global.IntegrationBridge || (typeof window !== 'undefined' && window.IntegrationBridge) || null;
      if (_IBr && typeof _IBr.getLeafDivisions === 'function' && G && G.adminHierarchy) {
        var P_REVOLT_MX = 25;      // 本省民心低于此值才可能揭竿
        var P_REVOLT_BASE = 0.05;  // 基础月概率
        var _rlvs = _IBr.getLeafDivisions(G.adminHierarchy, 'player') || [];
        for (var _ri = 0; _ri < _rlvs.length; _ri++) {
          var _rd = _rlvs[_ri];
          if (!_rd || typeof _rd.minxin !== 'number' || _rd.minxin >= P_REVOLT_MX) continue;
          var _sev = Math.min(1, (P_REVOLT_MX - _rd.minxin) / P_REVOLT_MX); // 越烂越高
          if (Math.random() < P_REVOLT_BASE * (0.5 + _sev) * mr) _triggerRevolt(ctx, _rd);
        }
      } else if (mx.trueIndex < 20 && Math.random() < 0.05 * mr) {
        _triggerRevolt(ctx); // 回退：无 adminHierarchy 时仍用旧全国闸 + G.regions 选址
      }
    } catch (_revTrigE) { try { if (mx.trueIndex < 20 && Math.random() < 0.05 * mr) _triggerRevolt(ctx); } catch (_e2) {} }
    _updateMinxinPerceived();
  }

  function _triggerRevolt(ctx, division) {
    var mx = _ensureMinxin();
    if (!mx) return;
    var G = global.GM;
    if (!Array.isArray(mx.revolts)) mx.revolts = [];
    var regionName, regionObj = null;
    if (division && division.name) {
      regionName = division.name;   // B·各省路：region 写行政区名（与 AI 路同口径·C 的 findDivisionByNameOrId 解析器认得→读该省 div.minxin）
    } else {
      regionObj = (G.regions || []).filter(function(r) { return r.unrest > 60; })[0]; // 回退：旧 G.regions 选址
      if (!regionObj) return;
      regionName = regionObj.id;
    }
    // 同省已有 ongoing 民变 → 不重复点燃
    if (mx.revolts.some(function(rv) { return rv.status === 'ongoing' && rv.region === regionName; })) return;
    var revolt = {
      id: 'revolt_' + ctx.turn + '_' + Math.floor(Math.random()*10000),
      turn: ctx.turn,
      region: regionName,
      scale: Math.round(Math.random() * 30000 + 5000),
      status: 'ongoing'
    };
    mx.revolts.push(revolt);
    if (global.addEB) global.addEB('民变', regionName + ' 民变，众约 ' + revolt.scale);
    if (typeof G.unrest === 'number') G.unrest = Math.min(100, G.unrest + 5);
    if (regionObj) regionObj.unrest = Math.min(100, (regionObj.unrest||30) + 10);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  变量联动 — 7×6 = 42 项
  // ═══════════════════════════════════════════════════════════════════

  /** 核心七变量：guoku / neitang / population / corruption / minxin / huangquan / huangwei
   *  每回合执行 42 联动 */

  function _allowPassiveAuthorityLinkage() {
    var G = global.GM;
    return !!(G && G.settings && G.settings.passiveAuthorityLinkage === true);
  }

  var VARIABLE_LINKAGE_VARIABLES = ['guoku', 'neitang', 'population', 'corruption', 'minxin', 'huangquan', 'huangwei'];
  var VARIABLE_LINKAGE_LABELS = {
    guoku: '帑廪',
    neitang: '内帑',
    population: '在籍户口',
    corruption: '腐败',
    minxin: '民心',
    huangquan: '皇权',
    huangwei: '皇威'
  };
  var VARIABLE_LINKAGE_STATUS = {
    DEFAULT: 'implemented_default',
    GATED: 'implemented_gated',
    GAP: 'documented_gap'
  };

  function _varLink(from, to, strength, direction, status, mechanism) {
    return {
      id: from + '_to_' + to,
      from: from,
      to: to,
      fromLabel: VARIABLE_LINKAGE_LABELS[from] || from,
      toLabel: VARIABLE_LINKAGE_LABELS[to] || to,
      strength: strength,
      direction: direction,
      status: status,
      mechanism: mechanism
    };
  }

  var VARIABLE_LINKAGE_MATRIX = [
    _varLink('guoku', 'neitang', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'treasury surplus can feed inner treasury; inner relief can flow back through neitang_to_guoku'),
    _varLink('guoku', 'population', 'medium', 'positive', VARIABLE_LINKAGE_STATUS.DEFAULT, 'fiscal shortage increases fugitive pressure; stable revenue is the baseline for household retention'),
    _varLink('guoku', 'corruption', 'strong', 'negative', VARIABLE_LINKAGE_STATUS.DEFAULT, 'fiscal distress feeds corruption index pressure'),
    _varLink('guoku', 'minxin', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'fiscal abundance/shortage shifts minxin through relief and extraction pressure'),
    _varLink('guoku', 'huangquan', 'medium', 'positive', VARIABLE_LINKAGE_STATUS.DEFAULT, 'healthy public treasury supports decree capacity and imperial authority'),
    _varLink('guoku', 'huangwei', 'medium', 'positive', VARIABLE_LINKAGE_STATUS.DEFAULT, 'healthy public treasury supports visible imperial prestige'),

    _varLink('neitang', 'guoku', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'inner treasury relief transfers money back to public treasury when court money is strained'),
    _varLink('neitang', 'population', 'weak', 'positive', VARIABLE_LINKAGE_STATUS.GAP, 'planned palace relief and reserve spending have no household-retention runtime path yet'),
    _varLink('neitang', 'corruption', 'medium', 'conditional', VARIABLE_LINKAGE_STATUS.DEFAULT, 'large inner treasury encourages palace rent-seeking and raises corruption index'),
    _varLink('neitang', 'minxin', 'medium', 'negative', VARIABLE_LINKAGE_STATUS.GAP, 'planned perception hit for palace hoarding has no minxin runtime path yet'),
    _varLink('neitang', 'huangquan', 'strong', 'positive', VARIABLE_LINKAGE_STATUS.GAP, 'planned discretionary funds to authority execution path is not wired yet'),
    _varLink('neitang', 'huangwei', 'strong', 'positive', VARIABLE_LINKAGE_STATUS.DEFAULT, 'wealthy inner treasury can fund grand ceremony prestige'),

    _varLink('population', 'guoku', 'strong', 'positive', VARIABLE_LINKAGE_STATUS.DEFAULT, 'fugitives reduce tax base and treasury income potential'),
    _varLink('population', 'neitang', 'weak', 'positive', VARIABLE_LINKAGE_STATUS.GAP, 'planned household prosperity to inner tribute path is not wired yet'),
    _varLink('population', 'corruption', 'medium', 'conditional', VARIABLE_LINKAGE_STATUS.DEFAULT, 'fugitive and hidden-household disorder creates local rent-seeking pressure'),
    _varLink('population', 'minxin', 'weak', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'fugitive ratio depresses minxin when household loss grows'),
    _varLink('population', 'huangquan', 'medium', 'positive', VARIABLE_LINKAGE_STATUS.GAP, 'planned registered-household base to authority legitimacy path is not wired yet'),
    _varLink('population', 'huangwei', 'weak', 'positive', VARIABLE_LINKAGE_STATUS.DEFAULT, 'very large settled population adds prestige through prosperous-realm signal'),

    _varLink('corruption', 'guoku', 'strong', 'negative', VARIABLE_LINKAGE_STATUS.DEFAULT, 'high corruption leaks public treasury money each tick'),
    _varLink('corruption', 'neitang', 'medium', 'negative', VARIABLE_LINKAGE_STATUS.DEFAULT, 'high corruption also siphons inner treasury money'),
    _varLink('corruption', 'population', 'strong', 'negative', VARIABLE_LINKAGE_STATUS.DEFAULT, 'high corruption drives fugitives and hidden households upward'),
    _varLink('corruption', 'minxin', 'strong', 'negative', VARIABLE_LINKAGE_STATUS.DEFAULT, 'high corruption directly lowers minxin'),
    _varLink('corruption', 'huangquan', 'strong', 'negative', VARIABLE_LINKAGE_STATUS.GATED, 'passiveAuthorityLinkage can make false reporting weaken huangquan'),
    _varLink('corruption', 'huangwei', 'strong', 'negative', VARIABLE_LINKAGE_STATUS.GATED, 'passiveAuthorityLinkage can make public bribery scandals weaken huangwei'),

    _varLink('minxin', 'guoku', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'true minxin changes tax efficiency multiplier'),
    _varLink('minxin', 'neitang', 'weak', 'negative', VARIABLE_LINKAGE_STATUS.GAP, 'planned public resentment to palace-spending pressure path is not wired yet'),
    _varLink('minxin', 'population', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'low minxin increases fugitives and household loss'),
    _varLink('minxin', 'corruption', 'medium', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'low minxin raises petty extraction tolerance while high minxin suppresses corruption'),
    _varLink('minxin', 'huangquan', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.GATED, 'passiveAuthorityLinkage can make low minxin weaken huangquan'),
    _varLink('minxin', 'huangwei', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.GATED, 'passiveAuthorityLinkage can make high/low minxin raise or lower huangwei'),

    _varLink('huangquan', 'guoku', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'huangquan now adjusts authority tax efficiency and public treasury collection'),
    _varLink('huangquan', 'neitang', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.GAP, 'planned authority control over inner funds is not wired yet'),
    _varLink('huangquan', 'population', 'medium', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'strong authority reduces fugitives/hidden households while weak authority worsens flight'),
    _varLink('huangquan', 'corruption', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'strong huangquan suppresses corruption index'),
    _varLink('huangquan', 'minxin', 'medium', 'mixed', VARIABLE_LINKAGE_STATUS.GAP, 'planned authority fairness/oppression to minxin path is not wired yet'),
    _varLink('huangquan', 'huangwei', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.GATED, 'passiveAuthorityLinkage can let strong/weak huangquan affect huangwei'),

    _varLink('huangwei', 'guoku', 'medium', 'mixed', VARIABLE_LINKAGE_STATUS.GAP, 'planned prestige to fiscal compliance path is not wired yet'),
    _varLink('huangwei', 'neitang', 'medium', 'negative', VARIABLE_LINKAGE_STATUS.GAP, 'planned prestige spectacle spending to inner treasury path is not wired yet'),
    _varLink('huangwei', 'population', 'medium', 'mixed', VARIABLE_LINKAGE_STATUS.GAP, 'planned prestige/fear to household stability path is not wired yet'),
    _varLink('huangwei', 'corruption', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.GAP, 'planned prestige deterrence or impunity to corruption path is not wired yet'),
    _varLink('huangwei', 'minxin', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.DEFAULT, 'high or low huangwei adjusts minxin through imperialVirtue'),
    _varLink('huangwei', 'huangquan', 'strong', 'mixed', VARIABLE_LINKAGE_STATUS.GATED, 'passiveAuthorityLinkage can let very high huangwei feed personal rule')
  ];

  function getVariableLinkageMatrix() {
    return VARIABLE_LINKAGE_MATRIX.map(function(link) {
      return Object.assign({}, link);
    });
  }

  function getVariableLinkageSummary() {
    var summary = {
      total: VARIABLE_LINKAGE_MATRIX.length,
      variables: VARIABLE_LINKAGE_VARIABLES.slice(),
      labels: Object.assign({}, VARIABLE_LINKAGE_LABELS),
      byStatus: {},
      byStrength: {},
      byDirection: {}
    };
    VARIABLE_LINKAGE_MATRIX.forEach(function(link) {
      summary.byStatus[link.status] = (summary.byStatus[link.status] || 0) + 1;
      summary.byStrength[link.strength] = (summary.byStrength[link.strength] || 0) + 1;
      summary.byDirection[link.direction] = (summary.byDirection[link.direction] || 0) + 1;
    });
    return summary;
  }

  function _clampNumber(value, min, max) {
    var n = Number(value);
    if (!isFinite(n)) n = min;
    return Math.max(min, Math.min(max, n));
  }

  function _populationMouths(G) {
    var p = G && G.population;
    var n = p && p.national;
    return Math.max(1, Number((n && n.mouths) || (p && p.mouths) || 1) || 1);
  }

  function _populationDing(G) {
    var p = G && G.population;
    var n = p && p.national;
    return Math.max(1, Number((n && n.ding) || (p && p.ding) || Math.round(_populationMouths(G) * 0.35)) || 1);
  }

  function _populationFugitives(G) {
    var p = G && G.population;
    var n = p && p.national;
    if (!p) return 0;
    if (typeof p.fugitives === 'number') return Math.max(0, p.fugitives);
    if (n && typeof n.fugitives === 'number') return Math.max(0, n.fugitives);
    return 0;
  }

  function _setPopulationFugitives(G, value) {
    if (!G || !G.population) return 0;
    var next = Math.max(0, Math.round(Number(value) || 0));
    G.population.fugitives = next;
    if (G.population.national && typeof G.population.national === 'object') G.population.national.fugitives = next;
    return next;
  }

  function _adjustPopulationFugitives(G, delta) {
    return _setPopulationFugitives(G, _populationFugitives(G) + (Number(delta) || 0));
  }

  function _populationHiddenCount(G) {
    var p = G && G.population;
    var n = p && p.national;
    if (!p) return 0;
    if (typeof p.hiddenCount === 'number') return Math.max(0, p.hiddenCount);
    if (typeof p.hiddenPopulation === 'number') return Math.max(0, p.hiddenPopulation);
    if (n && typeof n.hiddenCount === 'number') return Math.max(0, n.hiddenCount);
    return 0;
  }

  function _setPopulationHiddenCount(G, value) {
    if (!G || !G.population) return 0;
    var next = Math.max(0, Math.round(Number(value) || 0));
    G.population.hiddenCount = next;
    if (typeof G.population.hiddenPopulation === 'number') G.population.hiddenPopulation = next;
    if (G.population.national && typeof G.population.national === 'object') G.population.national.hiddenCount = next;
    return next;
  }

  function _adjustPopulationHiddenCount(G, delta) {
    return _setPopulationHiddenCount(G, _populationHiddenCount(G) + (Number(delta) || 0));
  }

  // ★变量联动 → 财政:走账本流水(ledger.stock ± + thisTurnIn/Out + source/sink 明细 + 同步 balance/money 镜像)。
  //   替代原"裸改 .money 标量"——裸改破坏「ledger.stock 真权威·balance/money 皆其镜像」不变量(见 tm-economy-engine.js _mintCycle 注释)·
  //   且联动改的 money 下回合被结算基线(读 balance/ledger.stock)覆盖而蒸发:既污染显示(money≠账本)又无真实效果。改走账本后真实入账、帑廪/内帑明细可见。
  function _linkageFiscalFlow(container, delta, tag) {
    if (!container || !delta || !isFinite(delta)) return 0;
    if (!container.ledgers) container.ledgers = {};
    var led = container.ledgers.money;
    if (!led || typeof led !== 'object') {
      led = container.ledgers.money = { stock: Number(container.money) || Number(container.balance) || 0, sources: {}, sinks: {}, thisTurnIn: 0, thisTurnOut: 0, history: [] };
    }
    var before = Number(led.stock) || 0;
    var after = Math.max(0, before + delta);
    var applied = after - before;
    led.stock = after;
    if (applied >= 0) {
      led.thisTurnIn = (Number(led.thisTurnIn) || 0) + applied;
      if (!led.sources) led.sources = {};
      led.sources[tag] = (Number(led.sources[tag]) || 0) + applied;
    } else {
      led.thisTurnOut = (Number(led.thisTurnOut) || 0) - applied;
      if (!led.sinks) led.sinks = {};
      led.sinks[tag] = (Number(led.sinks[tag]) || 0) - applied;
    }
    container.balance = led.stock;
    container.money = led.stock;
    return applied;
  }

  function _tickVarLinkage(ctx, mr) {
    var G = global.GM;
    if (!G) return;

    // ── 帑廪 → 其他 ──
    var guokuMoney = (G.guoku && G.guoku.money) || 0;
    // 帑廪 → 内帑（帑廪满时可转入内帑）
    if (guokuMoney > 5000000 && G.neitang) {
      var transfer = guokuMoney * 0.002 * mr;
      _linkageFiscalFlow(G.guoku, -transfer, '转输内帑');
      _linkageFiscalFlow(G.neitang, transfer, '帑廪拨入');
    }
    // 帑廪 → 户口（帑廪困则徭役重）
    if (guokuMoney < 100000 && G.population && G.population.corvee) {
      G.population.corvee.annualCorveeDays = Math.min(60, (G.population.corvee.annualCorveeDays || 30) + 0.1 * mr);
    }
    // 帑廪 → 腐败（紧时腐败敛财）
    if (guokuMoney < 50000 && G.corruption) {
      if (typeof G.corruption === 'object' && G.corruption.overall !== undefined) {
        _addCorrIndex(G, 0.1 * mr);
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
      _linkageFiscalFlow(G.neitang, -aid, '助拨国库');
      if (G.guoku) _linkageFiscalFlow(G.guoku, aid, '内帑助国');
      if (global.addEB && aid > 10000) global.addEB('内帑', '内帑助国 ' + Math.round(aid));
    }
    // 内帑 → 皇威（丰厚时皇威增）
    if (neitangMoney > 3000000) adjustHuangwei('grandCeremony', 0.02 * mr);
    // 内帑 → 腐败（宗室奢靡促腐败）
    if (neitangMoney > 5000000 && G.corruption && typeof G.corruption === 'object') {
      _addCorrIndex(G, 0.05 * mr);
    }

    // ── 户口 → 其他 ──
    var population = G.population && G.population.national;
    if (G.population) {
      // 户口 → 帑廪（逃户流失税基）
      var popMouths = _populationMouths(G);
      var popDing = _populationDing(G);
      var fugRatio = _populationFugitives(G) / popMouths;
      if (fugRatio > 0.05 && G.guoku) {
        // 税收损失
        _linkageFiscalFlow(G.guoku, -(popDing * fugRatio * 2 * mr / 12), '逃户失征');
      }
      // 户口 → 腐败（逃户/隐户越多，胥吏上下其手空间越大）
      var disorderRatio = (_populationFugitives(G) + _populationHiddenCount(G)) / popMouths;
      if (disorderRatio > 0.08 && G.corruption && typeof G.corruption === 'object') {
        _addCorrIndex(G, Math.min(0.35, (disorderRatio - 0.08) * 1.5) * mr);
      }
      // 户口 → 民心（逃户增则民怨）
      if (fugRatio > 0.08) adjustMinxin('localOfficial', -0.2 * mr, '逃户众');
      // 户口 → 皇威（人口兴则威）
      if (_populationMouths(G) > 100000000) adjustHuangwei('benevolence', 0.03 * mr, '人口繁盛');
    }

    // ── 腐败 → 其他 ──
    var corruptOverall = _corrIndex(G);
    // 腐败 → 帑廪（税收漏损）
    if (corruptOverall > 40 && G.guoku) {
      var loss = Math.max(0, (corruptOverall - 40)) * 1000 * mr / 12;
      // 注:腐败漏损或与税收源头 actualTaxRate(computeTaxFlow leakageRate)重叠·真机验金额合理性
      _linkageFiscalFlow(G.guoku, -loss, '贪腐漏损');
    }
    // 腐败 → 内帑（宫内也被侵蚀）
    if (corruptOverall > 60 && G.neitang) {
      _linkageFiscalFlow(G.neitang, -(corruptOverall * 100 * mr / 12), '贪腐侵蚀');
    }
    // 腐败 → 民心（直接）
    if (corruptOverall > 50) adjustMinxin('localOfficial', -(corruptOverall - 50) * 0.005 * mr, '贪腐横行');
    // 腐败 → 户口（苛索/包庇让逃户与隐户上升）
    if (corruptOverall > 65 && G.population) {
      var corrSeverity = (corruptOverall - 65) / 35;
      var corrMouths = _populationMouths(G);
      _adjustPopulationFugitives(G, Math.max(1, Math.round(corrMouths * 0.00035 * corrSeverity * mr)));
      _adjustPopulationHiddenCount(G, Math.max(1, Math.round(corrMouths * 0.00020 * corrSeverity * mr)));
    }
    // 腐败 → 皇权（虚报扭曲）
    if (_allowPassiveAuthorityLinkage() && corruptOverall > 70) adjustHuangquan('idleGovern', -0.1 * mr, '虚报失真');
    // 腐败 → 皇威（官场贿赂公开化）
    if (_allowPassiveAuthorityLinkage() && corruptOverall > 80) adjustHuangwei('courtScandal', -0.2 * mr, '贿赂公行');

    // ── 民心 → 其他 ──
    var mx = _ensureMinxin();
    if (mx) {
      // 民心 → 帑廪（征税效率）
      var taxEff = 1 + (mx.trueIndex - 60) / 200;
      G._taxEfficiencyMult = Math.max(0.5, Math.min(1.3, taxEff));
      // 民心 → 户口（逃亡率）
      if (mx.trueIndex < 30 && G.population) {
        _adjustPopulationFugitives(G, Math.round(_populationMouths(G) * 0.001 * mr));
      }
      // 民心 → 腐败（民怨低迷纵容苛索，民心高则轻微压制贪墨）
      if (G.corruption && typeof G.corruption === 'object') {
        if (mx.trueIndex < 35) _addCorrIndex(G, Math.min(0.25, (35 - mx.trueIndex) * 0.01) * mr);
        else if (mx.trueIndex > 80) _addCorrIndex(G, -Math.min(0.15, (mx.trueIndex - 80) * 0.02) * mr);
      }
      // 民心 → 皇权（民变威胁皇权）
      if (_allowPassiveAuthorityLinkage() && mx.trueIndex < 30) adjustHuangquan('idleGovern', -0.15 * mr, '民心向背');
      // 民心 → 皇威
      if (_allowPassiveAuthorityLinkage() && mx.trueIndex > 80) adjustHuangwei('benevolence', 0.05 * mr, '民拥戴');
      else if (_allowPassiveAuthorityLinkage() && mx.trueIndex < 30) adjustHuangwei('lostVirtueRumor', -0.1 * mr, '失德于民');
    }

    // ── 皇权 → 其他 ──
    var hq = _ensureHuangquan();
    if (hq) {
      // 皇权 → 帑廪（诏令执行率影响征收效率）
      if (G.guoku) {
        var authorityTaxEff = _clampNumber(1 + ((Number(hq.index) || 50) - 55) / 250, 0.75, 1.18);
        G._authorityTaxEfficiencyMult = authorityTaxEff;
        var authorityTaxDelta = Math.round(_populationDing(G) * (authorityTaxEff - 1) * 0.25 * mr);
        _linkageFiscalFlow(G.guoku, authorityTaxDelta, '皇权·征收效率');
      }
      // 皇权 → 户口（强则编审有力，弱则逃亡隐匿增加）
      if (G.population) {
        if (hq.index > 75) {
          _adjustPopulationFugitives(G, -Math.max(1, Math.round(_populationFugitives(G) * 0.01 * mr)));
          _adjustPopulationHiddenCount(G, -Math.max(1, Math.round(_populationHiddenCount(G) * 0.006 * mr)));
        } else if (hq.index < 35) {
          var weakSeverity = (35 - hq.index) / 35;
          _adjustPopulationFugitives(G, Math.max(1, Math.round(_populationMouths(G) * 0.00025 * weakSeverity * mr)));
          _adjustPopulationHiddenCount(G, Math.max(1, Math.round(_populationMouths(G) * 0.00018 * weakSeverity * mr)));
        }
      }
      // 皇权 → 腐败（强时可镇压）
      if (hq.index > 75 && G.corruption && typeof G.corruption === 'object') {
        _addCorrIndex(G, -0.1 * mr);
      }
      // 皇权 → 皇威（强皇权 → 诏令执行，威增）
      if (_allowPassiveAuthorityLinkage() && hq.index > 70) adjustHuangwei('structuralReform', 0.05 * mr);
      else if (_allowPassiveAuthorityLinkage() && hq.index < 30) adjustHuangwei('memorialObjection', -0.1 * mr, '皇权旁落');
    }

    // ── 皇威 → 其他 ──
    var hw = _ensureHuangwei();
    if (hw) {
      // 皇威 → 民心
      if (hw.index > 80) adjustMinxin('imperialVirtue', 0.05 * mr);
      else if (hw.index < 30) adjustMinxin('imperialVirtue', -0.1 * mr);
      // 皇威 → 皇权
      if (_allowPassiveAuthorityLinkage() && hw.index > 85) adjustHuangquan('personalRule', 0.03 * mr, '\u7687\u5a01\u6781\u76db\u4f20\u5bfc');
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

  // ── P-ZV7 罪己诏（批2·关键词触发·6回合限1次）：玩家本回合诏书含"罪己"→认错示天下：
  //   −8皇威(进drain·随0.5衰回血) ＋ +5民心(imperialVirtue 君德·随稳定器淡·与皇威损对称会衰) ＋ 核心重臣 loyalty各+4。
  //   冷却存 hw._selfBlameLastTurn。trade 数·冷却·重臣判定正则·可调。
  function _tickSelfBlameEdict(ctx) {
    var G = global.GM;
    var hw = _ensureHuangwei();
    if (!hw || !G) return;
    var SELFBLAME_COOLDOWN = 6, SELFBLAME_HW = -8, SELFBLAME_MX = 5, SELFBLAME_MINISTER = 4;
    var turn = ctx.turn || G.turn || 0;
    var last = (typeof hw._selfBlameLastTurn === 'number') ? hw._selfBlameLastTurn : -999;
    if ((turn - last) < SELFBLAME_COOLDOWN) return;
    var items = (G._playerActionSignals && Array.isArray(G._playerActionSignals.items)) ? G._playerActionSignals.items : [];
    var hit = items.some(function(s) {
      return s && s.turn === G.turn && /罪己/.test(String(s.text || '') + ' ' + String(s.topic || '') + ' ' + String(s.action || ''));
    });
    if (!hit) return;
    hw._selfBlameLastTurn = turn;
    adjustHuangwei('selfBlame', SELFBLAME_HW, '下罪己诏·认错示天下');                          // −8皇威·进 drains.selfBlame·随衰
    if (typeof adjustMinxin === 'function') adjustMinxin('imperialVirtue', SELFBLAME_MX, '罪己诏·收揽人心', { persist: true });
    var bumped = 0;
    (G.chars || []).forEach(function(c) {
      if (!c || c.alive === false) return;
      var t = String(c.officialTitle || c.title || '');
      if (t && /首辅|次辅|辅臣|大学士|阁|尚书|都御史|督师|总督|太师|太傅|太保/.test(t)) {
        c.loyalty = Math.max(0, Math.min(100, (Number(c.loyalty) || 50) + SELFBLAME_MINISTER));
        bumped++;
      }
    });
    if (global.addEB) global.addEB('皇威', '下罪己诏：皇威 −8、民心 +5、' + bumped + ' 位核心重臣感念（忠诚 +4）');
  }

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _tickHuangwei(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth] hw:') : console.error('[auth] hw:', e); }
    try { _tickSelfBlameEdict(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth] selfBlame:') : console.error('[auth] selfBlame:', e); }
    try { _tickHuangquan(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth] hq:') : console.error('[auth] hq:', e); }
    try { _tickMinxin(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth] mx:') : console.error('[auth] mx:', e); }
    try { _tickVarLinkage(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'auth] linkage:') : console.error('[auth] linkage:', e); }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  // 兼容旧代码的 getter/setter（读取时返回数字，写入时走结构化）
  function getHuangweiValue() { var G = global.GM; if (!G) return 50; return (G.huangwei && typeof G.huangwei === 'object') ? (typeof G.huangwei.index === 'number' ? G.huangwei.index : 50) : (typeof G.huangwei === 'number' ? G.huangwei : 50); }
  function getHuangquanValue() { var G = global.GM; if (!G) return 50; return (G.huangquan && typeof G.huangquan === 'object') ? (typeof G.huangquan.index === 'number' ? G.huangquan.index : 50) : (typeof G.huangquan === 'number' ? G.huangquan : 50); }
  function getMinxinValue() { var G = global.GM; if (!G) return 60; return (G.minxin && typeof G.minxin === 'object') ? (typeof G.minxin.trueIndex === 'number' ? G.minxin.trueIndex : 60) : (typeof G.minxin === 'number' ? G.minxin : 60); }

  // 通用调节（兼容对象或数字形式，供旧代码调用）
  global._adjAuthority = function(name, delta, reason, opts) {
    var G = global.GM;
    if (!G) return;
    if (name === 'huangquan') {
      return adjustHuangquan((opts && opts.source) || 'legacy-adj-authority', delta, reason, opts);
    }
    // 民心走总闸：trueIndex 是叶子聚合缓存·直写会被 aggregateTrue 冲掉——
    // 此 legacy 入口曾让 31 处调用点(饥荒/赈济/赋税反馈/环境联动…)的民心效果静默蒸发(2026-07-04 审查定罪)
    if (name === 'minxin' && typeof TM !== 'undefined' && TM.MinxinLedger && TM.MinxinLedger.recordAndApply) {
      try {
        return TM.MinxinLedger.recordAndApply(G, { sourceSystem: (opts && opts.source) || 'legacy-adj-authority', kind: (opts && opts.kind) || undefined, delta: delta, reason: reason || 'legacy-adj-authority' });
      } catch (_mxE) { /* 走闸失败才落缓存兜底(沙箱等) */ }
    }
    var v = G[name];
    if (v === undefined || v === null) return;
    if (typeof v === 'number') {
      G[name] = Math.max(0, Math.min(100, v + delta));
    } else if (typeof v === 'object') {
      var key = name === 'minxin' ? 'trueIndex' : 'index';
      v[key] = Math.max(0, Math.min(100, (typeof v[key] === 'number' ? v[key] : 50) + delta));
    }
  };

  // P-DZ·phase 同步：把 minxin/huangwei/huangquan 的 phase 缓存重算成当前数值对应段位，
  // 并按当前 index 校正皇威 tyrant/失威状态（保滞回）。治本——数值被 tick 衰减 / aggregate 等
  // 绕过 adjustXxx 的路径改过后，在回合末 aggregate 之后调它一次，phase 与后果不再读到滞留旧段。
  function syncAuthorityPhases() {
    var G = global.GM; if (!G) return;
    if (G.minxin && typeof G.minxin.trueIndex === 'number') G.minxin.phase = _getMinxinPhase(G.minxin.trueIndex);
    if (G.huangquan && typeof G.huangquan.index === 'number') G.huangquan.phase = _getHuangquanPhase(G.huangquan.index);
    if (G.huangwei && typeof G.huangwei.index === 'number') {
      G.huangwei.phase = _getHuangweiPhase(G.huangwei.index);
      var ts = G.huangwei.tyrantSyndrome;
      if (ts) { if (G.huangwei.index > 90) ts.active = true; else if (G.huangwei.index < 85) ts.active = false; }
      var lc = G.huangwei.lostAuthorityCrisis;
      if (lc) { if (G.huangwei.index < 30) lc.active = true; else if (G.huangwei.index > 35) lc.active = false; }
    }
  }

  global.AuthorityEngines = {
    init: init,
    tick: tick,
    adjustHuangwei: adjustHuangwei,
    regularizeHuangweiCaps: regularizeHuangweiCaps,
    adjustHuangquan: adjustHuangquan,
    regularizeHuangquanCaps: regularizeHuangquanCaps,
    setHuangquan: setHuangquan,
    adjustMinxin: adjustMinxin,
    syncAuthorityPhases: syncAuthorityPhases,
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
    _getMinxinPhase: _getMinxinPhase,
    _getHuangweiPhase: _getHuangweiPhase,
    HUANGWEI_SOURCES_14: HUANGWEI_SOURCES_14,
    HUANGWEI_DRAINS_14: HUANGWEI_DRAINS_14,
    HUANGQUAN_SOURCES_8: HUANGQUAN_SOURCES_8,
    HUANGQUAN_DRAINS_8: HUANGQUAN_DRAINS_8,
    MINXIN_SOURCES_14: MINXIN_SOURCES_14,
    _updatePerceivedHuangwei_f1: _updatePerceivedHuangwei,
    getUnifiedHuangquanPhaseHandler: getUnifiedHuangquanPhaseHandler,
    checkDecreeRealtime: checkDecreeRealtime,
    getVariableLinkageMatrix: getVariableLinkageMatrix,
    getVariableLinkageSummary: getVariableLinkageSummary,
    VARIABLE_LINKAGE_VARIABLES: VARIABLE_LINKAGE_VARIABLES,
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
