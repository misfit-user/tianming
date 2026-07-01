// @ts-check
// ============================================================
// tm-office-flags.js — 「官制活化（实验）」开关组
//
// 四刀独立开关 + 组闸 officeActivationEnabled。完全照 tm-agent-flags.js 的样子，
// 但属于「官制活化」这一独立工程组（与 agent 升级组互不干扰）。
//   officePowerPerceptionEnabled    Slice① 职权舆图喂进推演
//   officeDutyStateEnabled          Slice② 履职度 + 失职衰减
//   officeAuthorityGateEnabled      Slice③ 权限门控（接活 canPerformAction）
//   officeReformAdjudicationEnabled Slice④ AI 裁定式改制闭环
//   officeRecallAgentEnabled        #1 主推演 office-recall 子调用（按需取数·走次要 API）
//
// 语义：组闸 || 各独立开关。
//   · P.conf.officeActivationEnabled = true → 四刀全启用（实验）
//   · 组闸关 + 某独立开关 = true → 仅那刀启用（细粒度调试）
//   · 全关 → 零回归（写死路径原样跑）
// 用法（控制台或存档设一个即可）：P.conf.officePowerPerceptionEnabled = true
// 各读取点统一调 officeFlagOn('xxxEnabled')。
// ============================================================
(function (global) {
  function officeFlagOn(name) {
    try {
      var P = global.P || {};
      var ai = P.ai || {}, conf = P.conf || {};
      if (ai.officeActivationEnabled || conf.officeActivationEnabled) return true;
      // ① 职权舆图（officePowerPerceptionEnabled）·纯增益：给 AI 结构化官制信息（谁掌什么权/才德/履职/出缺），
      //   零 balance 改动、只增进硬核可信回应 → 默认开（owner 2026-06-30 拍板 flip），显式 false 才关。
      //   ②③④（履职度/权限门/改制裁定·有 balance 后果）仍默认关·owner playtest 后再 flip。
      if (name === 'officePowerPerceptionEnabled') {
        if (ai.officePowerPerceptionEnabled === false || conf.officePowerPerceptionEnabled === false) return false;
        return true;
      }
      return !!(ai[name] || conf[name]);
    } catch (e) { return false; }
  }
  global.officeFlagOn = officeFlagOn;

  var TM = global.TM = global.TM || {};
  TM.OfficeFlags = {
    MASTER: 'officeActivationEnabled',
    LIST: ['officePowerPerceptionEnabled', 'officeDutyStateEnabled', 'officeAuthorityGateEnabled', 'officeReformAdjudicationEnabled', 'officeRecallAgentEnabled'],
    on: officeFlagOn,
    setMaster: function (v) { var P = global.P; if (P) { P.conf = P.conf || {}; P.conf.officeActivationEnabled = !!v; } return !!v; },
    masterOn: function () { var P = global.P || {}; return !!((P.ai && P.ai.officeActivationEnabled) || (P.conf && P.conf.officeActivationEnabled)); },
    status: function () { var o = {}; this.LIST.forEach(function (n) { o[n] = officeFlagOn(n); }); o._master = this.masterOn(); return o; }
  };
})(typeof window !== 'undefined' ? window : globalThis);
