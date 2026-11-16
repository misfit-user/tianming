'use strict';
// ============================================================
// smoke-agent-mode-s7.js — 「模式 b · agent 模式」S7 加载层适配守卫
//   验:① run() 报 agent 拍(引擎/察看/亲裁每轮流式/撰史) ② 引擎 core-start 按 agentModeOn 切 AGENT_BEATS
//       ③ agent 标签 prefix 匹配 + 流式拍轮数夹进 54-84 带 ④ AGENT_BEATS 复用 LLM group(动画复用)
//       ⑤ LLM 路径零回归(agentModeOn 关→BEATS) ⑥ 消费端按 payload.beats 重建源码守卫
// ============================================================

const fs = require('fs');
const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

global.window = global;

// ── Part 2 先做(纯 capture stub·测 run 报拍)·之后再 eval 引擎(会接管 showLoading) ──
require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
require(path.join(ROOT, 'tm-endturn-agent-read-tools.js'));
require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));
require(path.join(ROOT, 'tm-endturn-agent-mode.js'));
const AM = globalThis.TM.Endturn.AgentMode;

(async function () {
  // ── ① run() 报 agent 拍 ──
  var calls = [];
  global.showLoading = function (msg, pct) { calls.push({ msg: String(msg), pct: pct }); };
  global._endTurn_updateSystems = async function () { (global.GM || {}).turn = ((global.GM || {}).turn || 0); }; // 触发 engine 阶段报拍
  var gm = { turn: 7, guoku: 12000, chars: [{ id: 'c1', name: '张三' }], facs: [], evtLog: [], _turnReport: [] };
  global.GM = gm;
  var ctx = { GM: gm, input: { edicts: ['赈灾'] } };
  global.P = { conf: { experimentalEnabled: true, experimentalMode: 'agent', agentModeMaxRounds: 8, agentModeDepthGate: false } };  // S7 测加载拍·深度门(D1)由 d1d6 专测
  var si = 0; var script = [
    { toolCalls: [{ name: 'adjust_field', input: { path: 'guoku', delta: -1000, reason: '赈灾' } }], text: '' },
    { toolCalls: [{ name: 'finalize_turn', input: { narrative: '开仓赈灾', summary: '赈灾' } }], text: '' }
  ];
  global.callAIWithTools = async function () { return script[si++] || { toolCalls: [], text: '' }; };
  var res = await AM.run(ctx);
  assert(res.ok === true, '① run 成功(带报拍)');
  var labels = calls.map(function (c) { return c.msg; });
  assert(labels.some(function (m) { return m.indexOf('⟨执政⟩引擎结算') === 0; }), '① 报 agent-engine 拍');
  assert(labels.some(function (m) { return m.indexOf('⟨执政⟩察看局面') === 0; }), '① 报 agent-perceive 拍');
  assert(labels.some(function (m) { return m.indexOf('⟨执政⟩撰史') === 0; }), '① 报 agent-narrate 拍');
  var loopCalls = calls.filter(function (c) { return c.msg.indexOf('⟨执政⟩亲裁') === 0; });
  assert(loopCalls.length === 2, '① 每轮报 agent-loop 拍(2 轮→2 次)');
  assert(loopCalls[0].pct >= 54 && loopCalls[1].pct > loopCalls[0].pct && loopCalls[1].pct <= 84, '① 轮数流式 pct 递增且在 54-84 带内');

  // ── Part 1:eval 引擎(接管 showLoading)·测拍表切换/匹配/流式/group ──
  var shown = []; var stubMax = 0;
  global.showLoading = function (msg, pct) { var d = Math.max(pct || 5, stubMax); stubMax = d; shown.push({ msg: String(msg), displayed: d }); };
  global.hideLoading = function () { stubMax = 0; };
  global.setLoadingCrawlCeil = function () {};
  var agentOn = true;
  global.agentModeOn = function () { return agentOn; };
  eval(fs.readFileSync(path.join(ROOT, 'tm-endturn-progress.js'), 'utf8'));
  var P = TM.Endturn.Progress;
  var events = [];
  P.on(function (type, payload) { events.push({ type: type, payload: payload }); });

  // ② agentMode 开 → core-start 切 AGENT_BEATS
  global.showLoading('时移事去', 10);
  assert(P.isActive() === true, '② 「时移事去」开闸');
  assert(P.activeBeats() === P.AGENT_BEATS, '② agent 模式 → activeBeats=AGENT_BEATS');
  var startEv = events.filter(function (e) { return e.type === 'start'; }).pop();
  assert(startEv && startEv.payload.beats === P.AGENT_BEATS, '② start 事件 payload.beats=AGENT_BEATS');

  // ③ agent 标签 prefix 匹配 + 流式夹带
  events.length = 0;
  global.showLoading('⟨执政⟩引擎结算·硬核基线…', 40);
  var be = events.filter(function (e) { return e.type === 'beat'; }).pop();
  assert(be && be.payload.beat.id === 'agent-engine', '③ 「⟨执政⟩引擎结算…」prefix 匹配 agent-engine 拍');
  events.length = 0;
  global.showLoading('⟨执政⟩亲裁·第3轮·推演落地…', 72);
  be = events.filter(function (e) { return e.type === 'beat'; }).pop();
  assert(be && be.payload.beat.id === 'agent-loop' && be.payload.beat.stream === true, '③ 亲裁→流式拍 agent-loop');
  assert(be.payload.pct >= 54 && be.payload.pct <= 84, '③ 流式 pct 夹进 54-84 带(实=' + be.payload.pct + ')');

  // ④ AGENT_BEATS 复用 LLM group(→ 消费端动画/视觉自动复用)
  var llmGroups = {}; P.BEATS.forEach(function (b) { llmGroups[b.group] = true; });
  var allReused = P.AGENT_BEATS.every(function (b) { return llmGroups[b.group]; });
  assert(allReused, '④ AGENT_BEATS 所有 group 都在 LLM BEATS 中(动画复用)');

  // ⑤ LLM 路径零回归:关 agent 模式·新回合 → BEATS
  global.hideLoading();
  agentOn = false;
  global.showLoading('时移事去', 10);
  assert(P.activeBeats() === P.BEATS, '⑤ 非 agent 模式 → activeBeats=BEATS(零回归)');

  // ── ⑥ 消费端重建源码守卫 ──

  console.log('[smoke-agent-mode-s7] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
