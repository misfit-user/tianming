'use strict';
// ============================================================
// smoke-agent-mode-liveworld.js — agent 模式·活世界(势力③ 自主 agent 决策·扩展①)
//   病灶:agent 模式开启时 agentFlagOn('factionAgentEnabled') 被互斥关 + endturn-systems 不跑 NPC → 势力全程不决策(死世界)。
//   修:agent 模式专属子开关 agentLiveWorldEnabled(绕过 LLM 升级互斥)·run() 后台复用 _runOneInTurn 跑势力自主决策。
//   验:① agentLiveWorldOn 开关逻辑(仅 agent 模式有意义)② driver _isEnabled 绕过"精算"gate ③ 关闭零回归 ④ 不破坏 LLM 升级互斥 ⑤ run() 活世界 job wired。
//   纯 node·stub·不调真模型。
// ============================================================
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let passed = 0;
function assert(c, m) { if (!c) throw new Error(m); passed++; }
function runFile(ctx, f) { vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }); }

async function main() {
  const ctx = {
    console: { log() {}, warn() {}, error() {} },
    Math, Date, JSON, Object, Array, Number, String, Boolean, RegExp, isFinite, parseInt, parseFloat,
    setTimeout: function (fn) { return { fn }; }, clearTimeout: function () {}
  };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);

  runFile(ctx, 'tm-agent-flags.js');
  runFile(ctx, 'tm-faction-npc-settings.js');
  runFile(ctx, 'tm-faction-npc-in-turn-driver.js');

  assert(typeof ctx.agentLiveWorldOn === 'function', 'agentLiveWorldOn 已导出');

  // 正式势力世界在两种管线均运行，Agent 入口只属于 Agent 管线。
  ctx.P = { conf: { agentLiveWorldEnabled: false, factionAgentEnabled: false, factionGoalStackEnabled: false }, ai: {} };
  assert(ctx.agentLiveWorldOn() === false, 'LLM 管线不启用 Agent 执行入口');
  assert(ctx.agentFlagOn('factionAgentEnabled') && ctx.agentFlagOn('factionGoalStackEnabled'), '旧关闭值下正式势力机制仍启用');
  ctx.P.conf.agentModeEnabled = true;
  assert(ctx.agentLiveWorldOn(), 'Agent 管线固定接入活世界');
  assert(!ctx.agentFlagOn('courtDebateEnabled') && !ctx.agentFlagOn('memoryStewardEnabled'), '无关实验增强仍受模式互斥');
  ctx.P.playerInfo = { factionName: '明朝廷' };
  ctx.P.conf.npcAiPrecision = false;
  ctx.P.ai.key = 'offline-fixture';
  ctx.GM = { turn: 7, _factionLivingWorld: false, facs: [{name:'明朝廷'}, {name:'后金',derivedStrength:{value:80}}, {name:'察哈尔',derivedStrength:{value:20}}], qijuHistory: [] };
  ctx.TM.FactionNpcLlmDecision = {calls:[], hasRunThisTurn(){return false;}, async decideFor(name){this.calls.push(name);return {applied:true,rationale:name+' 自主措置'};}};
  ctx.TM.FactionNpcNewsBridge = {};
  assert(ctx.TM.FactionNpcSettings.isAiPrecisionEnabled(), 'NPC 真决策忽略退役关闭值');
  const r1=await ctx.TM.FactionNpcInTurnDriver._runOneInTurn(7,'agent-core');
  assert(r1 && r1.applied && ctx.TM.FactionNpcLlmDecision.calls.length===1, 'Agent 真实调度执行一次自主决策');
  ctx.P.conf.agentModeEnabled=false; ctx.GM.turn=8;
  const r2=await ctx.TM.FactionNpcInTurnDriver._runOneInTurn(8,'llm-core');
  assert(r2 && r2.applied && ctx.TM.FactionNpcLlmDecision.calls.length===2, 'LLM 管线同样保留正式决策');
  delete ctx.P.ai.key; ctx.GM.turn=9;
  const r3=await ctx.TM.FactionNpcInTurnDriver._runOneInTurn(9,'no-api');
  assert(r3 && r3.skipped && ctx.TM.FactionNpcLlmDecision.calls.length===2, '无 API 不发起调用');

  // ⑤ run() 活世界 job wired(源码静态验·不跑 run)
  const amSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-agent-mode.js'), 'utf8');
  assert(/_agentLiveWorldOn/.test(amSrc), 'agent-mode 含 _agentLiveWorldOn 开关 helper');
  assert(/FactionNpcInTurnDriver\._runOneInTurn/.test(amSrc), 'agent-mode run() 活世界阶段复用 _runOneInTurn');
  assert(/agent-lw-/.test(amSrc), 'agent-mode 活世界 job 用 agent-lw- 标签(可观测)');
  assert(/_agentLiveWorldRan/.test(amSrc), 'agent-mode 记 _agentLiveWorldRan(观测落地势力数)');

  const patchSrc = fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8');
  assert(!/s-agent-liveworld/.test(patchSrc), '已移除 Agent 活世界的独立设置区');

  console.log('[smoke-agent-mode-liveworld] PASS assertions=' + passed);
}
main().catch(function (e) { console.error(e); process.exit(1); });
