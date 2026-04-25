// @ts-check
/// <reference path="types.d.ts" />
/**
 * tm-phase-f2-linkage.js — F 阶段 ②：事件总线 + §G 联动
 *
 * 补完：
 *  - 22 类事件钩子（peasantBurdenCritical/currencyReform/landAnnexCrisis/debtDefault 等）
 *  - AI prompt 统一模板（精炼/详细两层分流）
 *  - §G 户口 ← 腐败/民心/皇权 具体耦合公式
 *  - 皇威×帑廪×腐败 完整漏损三角（补 phase-e 中简化版）
 *  - 皇威↔户口（暴君逃户/失威瞒报）、皇威↔腐败（三段分化）
 *  - 帑廪负债>年入×0.5 破产事件 7 步链
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  事件总线
  // ═══════════════════════════════════════════════════════════════════

  var EVENT_BUS = {
    listeners: {},
    emit: function(eventName, payload) {
      var listeners = this.listeners[eventName] || [];
      listeners.forEach(function(fn) {
        try { fn(payload); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'eventBus') : console.error('[eventBus]', eventName, e); }
      });
    },
    on: function(eventName, fn) {
      if (!this.listeners[eventName]) this.listeners[eventName] = [];
      this.listeners[eventName].push(fn);
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  //  22 类事件钩子（方案总图 §五）
  // ═══════════════════════════════════════════════════════════════════

  var EVENT_DEFS = [
    // 财政类
    { id:'fiscal.treasury.critical',      name:'帑廪告罄',      test:function(G){return G.guoku && G.guoku.money<(G.guoku.annualIncome||10000000)*0.1;} },
    { id:'fiscal.bankruptcy.trigger',     name:'破产触发',      test:function(G){return G.guoku && G.guoku.money<-(G.guoku.annualIncome||10000000)*0.5;} },
    { id:'fiscal.yearly.archive',         name:'年度决算',      test:function(G){return G.month===1 && G.turn>1;} },
    { id:'peasantBurden.critical',        name:'民负峰值',      test:function(G){var b=G.fiscal&&G.fiscal._peasantBurdenAvg;return b&&b>0.7;} },
    // 货币类
    { id:'currency.reform.proposed',      name:'币改议起',      test:function(G){return G.currency&&G.currency._reformProposalActive;} },
    { id:'currency.moneyShortage',        name:'钱荒',          test:function(G){var m=G.currency&&G.currency.market;return m&&m.moneySupplyRatio&&m.moneySupplyRatio<0.5;} },
    { id:'currency.hyperinflation',       name:'通胀猛涨',      test:function(G){var m=G.currency&&G.currency.market;return m&&Math.abs(m.inflation||0)>0.15;} },
    // 央地类
    { id:'central_local.region_defiance', name:'藩镇抗命',      test:function(G){return G.fiscal&&G.fiscal.regions&&Object.values(G.fiscal.regions).some(function(r){return r.compliance<0.3;});} },
    { id:'central_local.autonomous_rise', name:'藩镇自立',      test:function(G){return G.fiscal&&G.fiscal.regions&&Object.values(G.fiscal.regions).some(function(r){return r.autonomyLevel>0.85;});} },
    { id:'landAnnex.crisis',              name:'兼并危机',      test:function(G){return G.landAnnexation&&(G.landAnnexation.concentration||0)>0.7;} },
    // 户口类
    { id:'population.fugitive.surge',     name:'逃户激增',      test:function(G){return G.population&&(G.population.fugitives||0)>((G.population.national&&G.population.national.mouths)||10000000)*0.06;} },
    { id:'population.corveeDeath.peak',   name:'徭役死峰',      test:function(G){return G.population&&G.population.corvee&&(G.population.corvee.recentDeaths||0)>15000;} },
    { id:'population.plague.outbreak',    name:'疫疠暴发',      test:function(G){return G.population&&G.population.dynamics&&(G.population.dynamics.plagueEvents||[]).some(function(e){return e.status==='active' && (e.affected||0)>100000;});} },
    // 角色经济
    { id:'char_econ.char_bankrupt',       name:'官员破产',      test:function(G){return (G.chars||[]).some(function(c){var cash=c.privateWealth&&c.privateWealth.cash;return c.alive!==false && typeof cash==='number' && cash<-50000;});} },
    { id:'char_econ.debt.default',        name:'债务违约',      test:function(G){return (G.chars||[]).some(function(c){return c._debtDefault;});} },
    { id:'char_econ.confiscated',         name:'抄家落成',      test:function(G){return (G.chars||[]).some(function(c){return c._confiscatedThisTurn;});} },
    // 权威类
    { id:'authority.tyrant.activated',    name:'暴君症候活',    test:function(G){return G.huangwei&&G.huangwei.tyrantSyndrome&&G.huangwei.tyrantSyndrome.active && !G.huangwei.tyrantSyndrome._eventFired;} },
    { id:'authority.lostCrisis.activated',name:'失威危机活',    test:function(G){return G.huangwei&&G.huangwei.lostAuthorityCrisis&&G.huangwei.lostAuthorityCrisis.active && !G.huangwei.lostAuthorityCrisis._eventFired;} },
    { id:'authority.powerMinister.rise',  name:'权臣坐大',      test:function(G){return G.huangquan&&G.huangquan.powerMinister && !G.huangquan.powerMinister._eventFired;} },
    { id:'authority.rebellion.upgrade',   name:'民变升级',      test:function(G){return G.minxin&&(G.minxin.revolts||[]).some(function(r){return r.level>=3 && r.status==='ongoing' && !r._eventFired;});} },
    // 监察/环境/诏令
    { id:'audit.fraud.exposed',           name:'查出舞弊',      test:function(G){var a=G.auditSystem;return a&&a.activeAudits&&a.activeAudits.some(function(au){return au.status==='completed' && au.found && !au._eventFired;});} },
    { id:'env.eco.crisis',                name:'生态危机',      test:function(G){return G.environment&&(G.environment.crisisHistory||[]).some(function(c){return c.turn===G.turn;});} }
  ];

  function _checkEvents(ctx) {
    var G = global.GM;
    EVENT_DEFS.forEach(function(def) {
      try {
        if (def.test(G)) {
          EVENT_BUS.emit(def.id, { eventName: def.name, turn: ctx.turn || 0, state: G });
          // 防重复：发事件后打标
          _markEventFired(G, def.id);
        }
      } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'eventDef') : console.error('[eventDef]', def.id, e); }
    });
  }

  function _markEventFired(G, eventId) {
    // 标记特定事件避免重复
    if (eventId === 'authority.tyrant.activated' && G.huangwei && G.huangwei.tyrantSyndrome) G.huangwei.tyrantSyndrome._eventFired = true;
    if (eventId === 'authority.lostCrisis.activated' && G.huangwei && G.huangwei.lostAuthorityCrisis) G.huangwei.lostAuthorityCrisis._eventFired = true;
    if (eventId === 'authority.powerMinister.rise' && G.huangquan && G.huangquan.powerMinister) G.huangquan.powerMinister._eventFired = true;
    if (eventId === 'authority.rebellion.upgrade' && G.minxin) {
      (G.minxin.revolts || []).forEach(function(r) { if (r.level>=3 && !r._eventFired) r._eventFired = true; });
    }
    if (eventId === 'audit.fraud.exposed' && G.auditSystem) {
      (G.auditSystem.activeAudits || []).forEach(function(au) { if (au.status==='completed' && au.found) au._eventFired = true; });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  §G 户口 ← 腐败/民心/皇权 具体耦合公式
  // ═══════════════════════════════════════════════════════════════════

  function _applyHujiCouplings(ctx, mr) {
    var G = global.GM;
    if (!G.population) return;
    var P = G.population;
    // §G.1 户口 ← 腐败：胥吏勒索 → 隐户率
    var corr = G.corruption && G.corruption.overall || 30;
    var provCorr = G.corruption && G.corruption.byDept && G.corruption.byDept.provincial;
    if (provCorr !== undefined && provCorr > 60) {
      // 每月隐户率 +0.01%
      var hidInc = Math.floor((P.national.households || 0) * 0.0001 * (provCorr - 60) / 40 * mr);
      P.hiddenCount = (P.hiddenCount || 0) + hidInc;
      if (P.byLegalStatus && P.byLegalStatus.huangji) {
        P.byLegalStatus.huangji.households = Math.max(0, (P.byLegalStatus.huangji.households||0) - Math.floor(hidInc/2));
      }
    }
    // §G.2 户口 ← 民心：低民心 → 逃亡率
    var mx = G.minxin && G.minxin.trueIndex || 60;
    if (mx < 35) {
      var fugInc = Math.floor((P.national.mouths || 0) * (0.005 * (35 - mx) / 35) * mr / 12);
      P.fugitives = (P.fugitives || 0) + fugInc;
      // 从编户转逃户
      if (P.byLegalStatus && P.byLegalStatus.huangji && P.byLegalStatus.taoohu) {
        var realFug = Math.min(fugInc, P.byLegalStatus.huangji.mouths || 0);
        P.byLegalStatus.huangji.mouths -= realFug;
        P.byLegalStatus.taoohu.mouths = (P.byLegalStatus.taoohu.mouths || 0) + realFug;
      }
    }
    // §G.3 户口 ← 皇权：清查执行力
    var hq = G.huangquan && G.huangquan.index || 55;
    if (P.meta) {
      var clearCap = 0.3 + (hq / 100) * 0.5;  // 皇权 30 → 0.45；皇权 80 → 0.70
      P.meta.registrationAccuracy = Math.max(0.2, Math.min(0.95, (P.meta.registrationAccuracy || 0.5) * 0.99 + clearCap * 0.01));
    }
    // §G.4 户口 ← 皇威×腐败：暴君+高腐 → 逃户加速
    if (G.huangwei && G.huangwei.tyrantSyndrome && G.huangwei.tyrantSyndrome.active && corr > 50) {
      var tyrantFug = Math.floor((P.national.mouths || 0) * 0.001 * mr / 12);
      P.fugitives = (P.fugitives || 0) + tyrantFug;
    }
    // §G.5 户口 ← 失威：瞒报
    if (G.huangwei && G.huangwei.lostAuthorityCrisis && G.huangwei.lostAuthorityCrisis.active && P.meta) {
      P.meta.underreported = (P.meta.underreported || 0) + Math.floor((P.national.mouths || 0) * 0.002 * mr / 12);
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  皇威×帑廪×腐败 完整漏损三角（替换 tm-phase-e 简化版）
  // ═══════════════════════════════════════════════════════════════════

  function _applyFullLeakageTriangle(ctx, mr) {
    var G = global.GM;
    if (!G.huangwei || !G.corruption || !G.guoku) return;
    var hwIdx = G.huangwei.index || 50;
    var hwPhase = hwIdx >= 90 ? 'tyrant' : hwIdx >= 70 ? 'majesty' : hwIdx >= 50 ? 'normal' : hwIdx >= 30 ? 'decline' : 'lost';
    var corr = G.corruption.overall || 30;
    // 按三段分化：威严→抑腐、暴君→隐匿、失威→公开漏
    var leakRate = 0;
    var extraLoss = 0;
    if (hwPhase === 'majesty') {
      // 威严段抑腐：腐败实际影响衰减
      leakRate = corr / 100 * 0.015;
      if (typeof G.corruption === 'object') G.corruption.overall = Math.max(0, corr - 0.05 * mr);
    } else if (hwPhase === 'tyrant') {
      // 暴君段隐匿：腐败被粉饰，实际漏损更高
      leakRate = corr / 100 * 0.035;
      // 帑廪虚账（账面收入不实）
      if (G.guoku && G.guoku.annualIncome) {
        G.guoku._tyrantInflatedLedger = (G.guoku._tyrantInflatedLedger || 0) + Math.floor(G.guoku.annualIncome * 0.01 * mr / 12);
      }
      extraLoss = Math.floor((G.guoku.annualIncome || 10000000) * leakRate * mr / 12);
    } else if (hwPhase === 'lost') {
      // 失威段公开：漏损空前但显形
      leakRate = corr / 100 * 0.05;
      extraLoss = Math.floor((G.guoku.annualIncome || 10000000) * leakRate * mr / 12);
      // 实征下降：民心也受影响
      if (global._adjAuthority) global._adjAuthority('minxin', -0.1 * mr);
    } else if (hwPhase === 'decline') {
      leakRate = corr / 100 * 0.04;
      extraLoss = Math.floor((G.guoku.annualIncome || 10000000) * leakRate * mr / 12);
    } else {
      leakRate = corr / 100 * 0.025;
      extraLoss = Math.floor((G.guoku.annualIncome || 10000000) * leakRate * mr / 12);
    }
    // 应用
    if (extraLoss > 0 && G.guoku) {
      G.guoku.money = Math.max(-9e9, (G.guoku.money || 0) - extraLoss);
      G.guoku._leakageThisTurn = extraLoss;
    }
    G._leakageState = { phase: hwPhase, rate: leakRate, loss: extraLoss };
    // 事件
    if (hwPhase === 'tyrant' && corr > 55 && G.guoku.money < (G.guoku.annualIncome || 10000000) * 0.1) {
      EVENT_BUS.emit('leakage.triangle.critical', { phase: hwPhase, corr: corr, loss: extraLoss });
      if (global.addEB && Math.random() < 0.05) global.addEB('漏损', '暴君+高贪+紧库，本月吃掉 ' + extraLoss + ' 钱');
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  破产事件 7 步链
  // ═══════════════════════════════════════════════════════════════════

  var BANKRUPTCY_STEPS = [
    { id:1, name:'俸禄半发',    effect:function(G){ G._salaryPayRatio = 0.5; if (global.addEB) global.addEB('破产', '俸禄减半'); } },
    { id:2, name:'官员离心',    effect:function(G){
        (G.chars || []).forEach(function(c){ if (c.alive!==false) c.loyalty = Math.max(0, (c.loyalty||50) - 5); });
        if (global.addEB) global.addEB('破产', '百官怨声四起');
    } },
    { id:3, name:'驿站坍塌',    effect:function(G){
        if (!G._infraState) G._infraState = {};
        G._infraState.postalCollapse = true;
        if (global.addEB) global.addEB('破产', '驿站倒塌，政令滞');
    } },
    { id:4, name:'腐败激增',    effect:function(G){
        if (G.corruption && typeof G.corruption === 'object') G.corruption.overall = Math.min(100, (G.corruption.overall||30) + 10);
        if (global.addEB) global.addEB('破产', '官吏苟且，腐败暴涨');
    } },
    { id:5, name:'边军哗变',    effect:function(G){
        if (G.population && G.population.military) G.population.military._mutinyRisk = (G.population.military._mutinyRisk||0) + 0.2;
        if (global.addEB) global.addEB('破产', '边镇饷断，士卒哗变在即');
    } },
    { id:6, name:'民变迭起',    effect:function(G){
        if (global._adjAuthority) global._adjAuthority('minxin', -10);
        if (G.minxin && !G.minxin.revolts) G.minxin.revolts = [];
        if (G.minxin) G.minxin.revolts.push({
          id: 'bankr_rev_' + (G.turn||0),
          region: '某地', turn: G.turn||0, cause: '破产', status:'ongoing', level: 2, scale: 5000
        });
        if (global.addEB) global.addEB('破产', '民不堪命，处处起事');
    } },
    { id:7, name:'朝廷崩溃',    effect:function(G){
        if (typeof G.huangwei === 'object') G.huangwei.index = Math.max(0, G.huangwei.index - 20);
        if (typeof G.huangquan === 'object') G.huangquan.index = Math.max(0, G.huangquan.index - 15);
        if (global.addEB) global.addEB('破产', '朝廷濒于瓦解');
    } }
  ];

  function _checkAndTriggerBankruptcy(ctx) {
    var G = global.GM;
    if (!G.guoku || !G.guoku.annualIncome) return;
    var annual = G.guoku.annualIncome;
    var debt = -Math.min(0, G.guoku.money || 0);
    var debtRatio = debt / Math.max(1, annual);
    if (!G._bankruptcyState) G._bankruptcyState = { activatedStep: 0, firstTurn: null };
    var bs = G._bankruptcyState;
    if (debtRatio < 0.5) {
      // 恢复：若负债率回到 0.2 以下，复原
      if (debtRatio < 0.2 && bs.activatedStep > 0) {
        bs.activatedStep = 0;
        bs.firstTurn = null;
        G._salaryPayRatio = 1.0;
        if (global.addEB) global.addEB('破产', '帑廪稍缓');
      }
      return;
    }
    // 每过 3 回合升级一步
    if (!bs.firstTurn) bs.firstTurn = ctx.turn || 0;
    var elapsedTurns = (ctx.turn || 0) - bs.firstTurn;
    var targetStep = Math.min(7, Math.floor(elapsedTurns / 3) + 1);
    while (bs.activatedStep < targetStep) {
      bs.activatedStep++;
      var step = BANKRUPTCY_STEPS[bs.activatedStep - 1];
      if (step && step.effect) step.effect(G);
      EVENT_BUS.emit('bankruptcy.step', { step: bs.activatedStep, name: step ? step.name : '', turn: ctx.turn });
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  AI prompt 统一模板
  // ═══════════════════════════════════════════════════════════════════

  /**
   * 统一 AI context 模板。可由所有引擎调用生成统一格式的 prompt 上下文。
   * @param {string} mode - 'concise'（精炼）或 'detailed'（详细）
   */
  function buildUnifiedAIContext(mode) {
    var G = global.GM;
    if (!G) return '';
    mode = mode || 'concise';
    var lines = [];
    // 核心状态
    if (G.dynasty) lines.push('【朝代】' + G.dynasty + (G.year ? '（' + G.year + '年）' : ''));
    if (G.turn) lines.push('【回合】' + G.turn);
    // 七主变量
    var hw = G.huangwei && G.huangwei.index;
    var hq = G.huangquan && G.huangquan.index;
    var mx = G.minxin && G.minxin.trueIndex;
    var mxP = G.minxin && G.minxin.perceivedIndex;
    var corr = G.corruption && G.corruption.overall;
    if (hw !== undefined) lines.push('【皇威】' + Math.round(hw) + (G.huangwei.phase ? '（' + G.huangwei.phase + '）' : ''));
    if (hq !== undefined) lines.push('【皇权】' + Math.round(hq) + (G.huangquan.phase ? '（' + G.huangquan.phase + '）' : ''));
    if (mx !== undefined) lines.push('【民心】' + Math.round(mx) + (mxP !== undefined && Math.abs(mxP-mx)>5 ? '（感知 ' + Math.round(mxP) + '）' : ''));
    if (corr !== undefined) lines.push('【腐败】' + Math.round(corr));
    // 帑廪
    if (G.guoku) lines.push('【帑廪】钱 ' + Math.round((G.guoku.money||0)/10000) + ' 万，粮 ' + Math.round((G.guoku.grain||0)/10000) + ' 万');
    if (mode === 'detailed') {
      // 详细模式：加更多上下文
      if (G.population && G.population.national) {
        lines.push('【户口】口 ' + Math.round(G.population.national.mouths/10000) + ' 万，户 ' + Math.round(G.population.national.households/10000) + ' 万');
      }
      if (G.activeWars && G.activeWars.length) lines.push('【战事】' + G.activeWars.length + ' 处');
      if (G.minxin && G.minxin.revolts) {
        var ongoing = G.minxin.revolts.filter(function(r){return r.status==='ongoing';}).length;
        if (ongoing > 0) lines.push('【民变】' + ongoing + ' 起');
      }
      if (G.huangquan && G.huangquan.powerMinister) lines.push('【权臣】' + G.huangquan.powerMinister.name + '（控 ' + (G.huangquan.powerMinister.controlLevel||0).toFixed(2) + '）');
      if (G.huangwei && G.huangwei.tyrantSyndrome && G.huangwei.tyrantSyndrome.active) lines.push('【暴君症候】活跃');
      if (G.huangwei && G.huangwei.lostAuthorityCrisis && G.huangwei.lostAuthorityCrisis.active) lines.push('【失威危机】活跃');
      if (G._leakageState && G._leakageState.loss > 0) lines.push('【漏损】本月 ' + G._leakageState.loss + ' 钱');
      if (G._bankruptcyState && G._bankruptcyState.activatedStep > 0) lines.push('【破产】阶段 ' + G._bankruptcyState.activatedStep);
    }
    // 各引擎上下文
    if (typeof global.EdictParser !== 'undefined' && global.EdictParser.getAIContext) {
      var ec = global.EdictParser.getAIContext();
      if (ec) lines.push(ec);
    }
    return lines.join('\n');
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    try { _checkEvents(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF2] events:') : console.error('[phaseF2] events:', e); }
    try { _applyHujiCouplings(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF2] hujiCoup:') : console.error('[phaseF2] hujiCoup:', e); }
    try { _applyFullLeakageTriangle(ctx, mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF2] leakage:') : console.error('[phaseF2] leakage:', e); }
    try { _checkAndTriggerBankruptcy(ctx); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'phaseF2] bankruptcy:') : console.error('[phaseF2] bankruptcy:', e); }
  }

  function init() {
    // 默认订阅——输出事件到 EB
    Object.keys({}).forEach(function(){});  // no default listeners
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.EventBus = EVENT_BUS;

  global.PhaseF2 = {
    init: init,
    tick: tick,
    eventBus: EVENT_BUS,
    EVENT_DEFS: EVENT_DEFS,
    BANKRUPTCY_STEPS: BANKRUPTCY_STEPS,
    buildUnifiedAIContext: buildUnifiedAIContext,
    VERSION: 1
  };

  global.buildUnifiedAIContext = buildUnifiedAIContext;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
