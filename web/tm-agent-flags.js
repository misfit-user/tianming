// @ts-check
// ============================================================
// tm-agent-flags.js — 「LLM 升级（实验）」总开关 + 「agent 模式(模式 b)」门控
//
// 势力自主决策和长期目标已纳入正式玩法，兼容旧读口时恒为启用。
// 其余 LLM 管线增强仍由 agentUpgradesEnabled 或各独立开关控制；
// Agent 模式走独立回合管线，不同时执行 LLM 管线增强。
// 各读取点统一调用 agentFlagOn，保留 P.conf/P.ai 历史命名空间兼容。
// ============================================================

(function (global) {
  function agentFlagOn(name) {
    try {
      var P = global.P || {};
      var ai = P.ai || {}, conf = P.conf || {};
      // 势力自主与长期目标属于正式玩法，两条回合管线共用，旧开关不再禁用。
      if (name === 'factionAgentEnabled' || name === 'factionGoalStackEnabled') return true;
      // Agent 管线的非核心实验增强仍与 LLM 管线互斥。
      if (agentModeOn()) return false;
      // 总闸（任一命名空间设了都认）
      if (ai.agentUpgradesEnabled || conf.agentUpgradesEnabled) return true;
      // 否则各自独立开关（同时认两个命名空间·解决历史不一致）
      return !!(ai[name] || conf[name]);
    } catch (e) { return false; }
  }
  global.agentFlagOn = agentFlagOn;

  // ── 模式 b · agent 模式(平行回合引擎)门控 ──
  // 【独立于「LLM 升级」总闸】：LLM 升级只增强现管线·agent 模式**替换整个回合引擎**(详设 docs/agent-mode-design.md)。
  // 正途(UI):「开启实验模式」(experimentalEnabled) + 选「Agent 模式」(experimentalMode==='agent')。
  // 旁路(测试/控制台):显式 P.conf.agentModeEnabled = true。两命名空间都认。
  function agentModeOn() {
    try {
      var P = global.P || {};
      var conf = P.conf || {}, ai = P.ai || {};
      var byMode = !!((conf.experimentalEnabled || ai.experimentalEnabled) && ((conf.experimentalMode || ai.experimentalMode) === 'agent'));
      return !!(byMode || conf.agentModeEnabled || ai.agentModeEnabled);
    } catch (e) { return false; }
  }
  global.agentModeOn = agentModeOn;

  // Agent 管线的势力决策执行入口，仍由管线预算限制调用次数。
  function agentLiveWorldOn() {
    try {
      if (!agentModeOn()) return false;
      return true; // Agent 管线也固定接入势力世界；调用次数仍受预算限制。
    } catch (e) { return false; }
  }
  global.agentLiveWorldOn = agentLiveWorldOn;

  var TM = global.TM = global.TM || {};
  TM.AgentFlags = {
    MASTER: 'agentUpgradesEnabled',
    LIST: ['agentRecallEnabled', 'anomalyRoutingEnabled', 'courtDebateEnabled', 'memoryStewardEnabled', 'reflectionAgentEnabled', 'edictOversightEnabled', 'historyAdvisorEnabled', 'factionToolDecisionEnabled'],
    on: agentFlagOn,
    agentModeOn: agentModeOn,  // 模式 b 平行引擎开关(独立于总闸)
    // 一键设/读总闸（写 P.conf·与多数独立开关同命名空间·随游戏设置持久）
    setMaster: function (v) { var P = global.P; if (P) { P.conf = P.conf || {}; P.conf.agentUpgradesEnabled = !!v; } return !!v; },
    masterOn: function () { var P = global.P || {}; return !!((P.ai && P.ai.agentUpgradesEnabled) || (P.conf && P.conf.agentUpgradesEnabled)); },
    // 清空所有独立开关(两命名空间)·让总闸成为唯一控制（"方便"：reset() 后只用 setMaster 一键开关）
    reset: function () { var P = global.P; if (!P) return; ['conf', 'ai'].forEach(function (ns) { if (!P[ns]) return; TM.AgentFlags.LIST.forEach(function (n) { try { delete P[ns][n]; } catch (e) {} }); }); },
    // 调试用：返回各 agent 当前生效态
    status: function () { var o = {}; this.LIST.forEach(function (n) { o[n] = agentFlagOn(n); }); o._master = this.masterOn(); o._agentMode = agentModeOn(); return o; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
