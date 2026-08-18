'use strict';
// ============================================================
// smoke-agent-mode-s4.js — 「模式 b · agent 模式」S4 循环 + 覆盖脊柱守卫
//   验:多轮 tool-calling 循环(感知→裁断+守护写→收尾) + 真 mutate + 叙述焊死 + 脊柱检测
//       + 每条失败路径留在 Agent 支路(无能力/抛错/退化空回合) + maxRounds 封顶
// ============================================================

const path = require('path');
const { ROOT, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

require(path.join(ROOT, 'tm-ai-change-pathutils.js'));
require(path.join(ROOT, 'tm-endturn-agent-read-tools.js'));
require(path.join(ROOT, 'tm-endturn-agent-write-tools.js'));
require(path.join(ROOT, 'tm-endturn-record-specs.js'));        // 自动收尾深化(deepen_narrative)需 recordSpecs
require(path.join(ROOT, 'tm-endturn-agent-depth-tools.js'));   // 场景5 自动收尾兜底需深化工具
require(path.join(ROOT, 'tm-endturn-agent-mode.js'));

const AM = globalThis.TM.Endturn.AgentMode;
assert(AM && typeof AM.run === 'function', 'AgentMode.run 已导出');
assert(typeof AM._stage === 'string' && AM._stage.length > 0, '_stage 为进度标记字符串(随刀推进·不锁具体值)');

// T2·健壮参数:字符串数字→数字 + 键名别名(弱模型错传容错)
(function () {
  var c = AM.coerceArgs({ delta: '-5', amount: '100000', soldiers: '8000', index: '2', value: '忧', field: 'minxin', person: '张三', office: '尚书', army: '关宁军', province: '辽东' });
  assert(c.delta === -5 && c.amount === 100000 && c.soldiers === 8000 && c.index === 2, 'coerceArgs:数字字符串→数字(delta/amount/soldiers/index)');
  assert(c.value === '忧', 'coerceArgs:value 不强转(set_field 值任意类型保留)');
  assert(c.path === 'minxin' && c.name === '张三' && c.position === '尚书' && c.armyName === '关宁军' && c.region === '辽东', 'coerceArgs:键别名(field→path/person→name/office→position/army→armyName/province→region)');
})();

// ⚠ engine-first 回合错位:gm.turn=N+1(引擎先算后)·玩家操作盖 N 章·_playerOpsDigest 须按 playerTurn=N 收全(否则朝会/鸿雁/问对静默丢失·不进推演)
(function () {
  var gmP = {
    turn: 6,  // N+1(engine-first 后)
    memorials: [{ turn: 5, reply: '着户部会核', title: '辽饷告急', from: '袁崇焕', status: 'annotated' }],
    _courtRecords: [{ turn: 5, topic: '早朝·辽饷', transcript: [{ speaker: '帝', text: '先核辽饷' }], decisions: [{ label: '核饷' }] }],
    letters: [{ sentTurn: 5, to: '袁崇焕', content: '密访辽饷实额' }],
    wenduiHistory: { '袁崇焕': [{ turn: 5, role: 'player', content: '卿可有复辽之策' }] }
  };
  var ops = AM.playerOpsDigest({ input: { edicts: ['彻查辽饷'] } }, gmP, 5);  // playerTurn=N=5
  assert(/诏令/.test(ops) && /彻查辽饷/.test(ops), '玩家操作:诏令收入(engine-first)');
  assert(/奏疏朱批/.test(ops) && /辽饷告急/.test(ops), '玩家操作:奏疏朱批收入(N章·gm.turn=N+1)');
  assert(/朝会问对/.test(ops) && /先核辽饷/.test(ops), '玩家操作:朝会问对收入(修复前会丢)');
  assert(/鸿雁/.test(ops) && /密访辽饷/.test(ops), '玩家操作:鸿雁收入(修复前会丢)');
  assert(/人物问对/.test(ops) && /复辽之策/.test(ops), '玩家操作:人物问对收入(修复前会丢)');
  // 上一回合(N-1=4)的操作不应混入
  var gmP2 = { turn: 6, letters: [{ sentTurn: 4, to: 'x', content: '上回合旧信' }] };
  var ops2 = AM.playerOpsDigest({ input: {} }, gmP2, 5);
  assert(!/上回合旧信/.test(ops2 || ''), '玩家操作:上回合(N-1)操作不混入(只收本回合 N)');

  // Q1·诏书/行止多回合滚动存(owner"这个也应多回合读")
  var gmD = {};
  AM.playerOpsDigest({ input: { edicts: ['彻查辽饷亏空'], xinglu: '夜召辅臣议辽事' } }, gmD, 5);
  AM.playerOpsDigest({ input: { edicts: ['增辽东军饷十万'] } }, gmD, 6);
  assert(Array.isArray(gmD._agentRecentDirectives) && gmD._agentRecentDirectives.length === 2, '诏书/行止滚动存(2回合累积)');
  assert(gmD._agentRecentDirectives[0].turn === 5 && /彻查辽饷/.test(gmD._agentRecentDirectives[0].edicts.join('')) && /夜召辅臣/.test(gmD._agentRecentDirectives[0].xinglu), '诏书+行止存对(turn5)');
  AM.playerOpsDigest({ input: { edicts: ['x'] } }, gmD, 6);
  assert(gmD._agentRecentDirectives.length === 2, '同回合不重复存(去重)');
  var dossier = AM.memoryDossier(gmD);
  assert(/诏书\/行止/.test(dossier) && /增辽东军饷/.test(dossier) && /彻查辽饷/.test(dossier), '_memoryDossier 读到多回合诏书/行止(跨回合)');
  // C·命门:agent 近回合诏书/行止存进自有 _agentRecentDirectives·不动 LLM 规则库 _playerDirectives(此前共享→agent slice/some 逐出天意/规则·数据损坏 bug·已分离)
  var gmC = { _playerDirectives: [{ type: 'rule', content: '人事调动即刻瞬间抵达', turn: 1, _absolute: true }] };
  AM.playerOpsDigest({ input: { edicts: ['查辽饷'] } }, gmC, 5);
  assert(gmC._playerDirectives.length === 1 && gmC._playerDirectives[0].type === 'rule', 'C:agent 不动 LLM 规则库 _playerDirectives(天意/持久规则不被逐出·数据损坏修复)');
  assert(Array.isArray(gmC._agentRecentDirectives) && gmC._agentRecentDirectives.length === 1, 'C:agent 诏书/行止存进自有 _agentRecentDirectives(与 LLM 规则库分离)');
})();

// 脚本化 callAIWithTools(逐轮返回预设响应)
function setScript(arr) {
  let i = 0;
  globalThis.callAIWithTools = async function (prompt, tools, opts) { return arr[i++] || { toolCalls: [], text: '' }; };
}
function makeGM() {
  return { turn: 7, eraName: '建炎元年', guoku: 12000, neitang: 3000, chars: [{ id: 'c1', name: '张三', mood: '' }], facs: [{ name: '北府' }], evtLog: [], memorials: [] };
}

(async function () {
  // ── 工具集:读+写+finalize 齐 ──
  const toolNames = AM.allTools().map(function (t) { return t.name; });
  assert(toolNames.indexOf('get_overview') >= 0 && toolNames.indexOf('set_field') >= 0 && toolNames.indexOf('finalize_turn') >= 0, 'allTools 含读+写+finalize');

  // ── 脊柱注入 + gap 检测(单元)──
  assert(/覆盖脊柱/.test(AM.buildSystemPrompt()) && /财政/.test(AM.buildSystemPrompt()), 'system prompt 注入覆盖脊柱');
  // 自适应一致:缺口=维度有活动(玩家意图在 _turnPlayerOps)但 agent 未处理(blob 无关键词)·军事有意图却没碰→缺口
  const gapGM = { _agentWriteLog: [{ path: 'guoku', reason: '赈灾' }], _turnReport: [{ type: 'narrative', text: 'x' }], _turnPlayerOps: '诏令:整饬边军备战' };
  const gaps0 = AM.detectSpineGaps(gapGM);
  assert(gaps0.indexOf('财政') < 0 && gaps0.indexOf('时政叙事与摘要') < 0, 'gap 检测:财政+叙事 已覆盖不算缺口');
  assert(gaps0.indexOf('军事') >= 0, 'gap 检测:军事有玩家意图(整饬边军)但 agent 未处理→算缺口(自适应:有活动才要求)');

  // ── 场景1:happy-path 多轮 ──
  let gm = makeGM(); let ctx = { GM: gm, input: { edicts: ['开仓赈灾令'] } };
  globalThis.P = { conf: { agentModeDepthGate: false } };  // S4 测基础循环·深度门(D1)由 d1d6 专测
  setScript([
    { toolCalls: [{ name: 'get_overview', input: {} }, { name: 'adjust_field', input: { path: 'guoku', delta: -2000, reason: '赈灾拨款' } }], text: '' },
    { toolCalls: [{ name: 'push_field', input: { path: 'evtLog', value: { turn: 7, type: 'relief', text: '开仓赈灾' }, reason: '赈灾事件' } }, { name: 'finalize_turn', input: { narrative: '本回合开仓赈灾,国库支绌。', summary: '赈灾安民' } }], text: '' }
  ]);
  let res = await AM.run(ctx);
  assert(res.ok === true && res.fallback === false, '场景1:run 成功接管 {ok:true,fallback:false}');
  assert(gm.evtLog.length === 1 && gm.evtLog[0].text === '开仓赈灾', '场景1:push_field 真改 evtLog(直接 mutate 证据)');
  // adjust 落地(经 normalize 容错·查报告条目证 delta 应用)
  const guokuEntry = gm._turnReport.find(function (e) { return e.type === 'change' && /guoku/.test(String(e.path)); });
  assert(guokuEntry && typeof guokuEntry.new === 'number' && guokuEntry.new === guokuEntry.old - 2000, '场景1:adjust_field guoku 真减2000(报告条目证)');
  assert(gm._agentOverrides && gm._agentOverrides['guoku'], '场景1:guoku 引擎让步标记已打');
  const narr = gm._turnReport.find(function (e) { return e.type === 'narrative'; });
  const summ = gm._turnReport.find(function (e) { return e.type === 'summary'; });
  assert(narr && narr.text === '本回合开仓赈灾,国库支绌。' && narr._agent, '场景1:agent 叙事入 _turnReport(焊死)');
  assert(summ && summ.text === '赈灾安民', '场景1:摘要入 _turnReport');
  assert(gm._agentTurnMeta && gm._agentTurnMeta.rounds === 2 && gm._agentTurnMeta.writeOk === 2 && gm._agentTurnMeta.finalized === true, '场景1:_agentTurnMeta(轮2/落地2/已收尾)');
  assert(res.aiResult && res.aiResult.agentMode === true && res.aiResult.summary === '赈灾安民', '场景1:aiResult 携 agentMode/summary');

  // ── 场景2:退化(模型啥也不干)→ Agent 失败并回滚 ──
  gm = makeGM(); ctx = { GM: gm, input: {} };
  setScript([{ toolCalls: [], text: '' }]);
  res = await AM.run(ctx);
  assert(res.fallback === false && res.ok === false && res.mode === 'agent', '场景2:零落地零叙事零收尾 → Agent 失败(不提交空回合)');

  // ── 场景3:无 callAIWithTools → Agent 失败 ──
  gm = makeGM(); ctx = { GM: gm, input: {} };
  const savedCawt = globalThis.callAIWithTools;
  delete globalThis.callAIWithTools;
  res = await AM.run(ctx);
  assert(res.fallback === false && /callAIWithTools/.test(res.reason || ''), '场景3:无 callAIWithTools → Agent 失败');
  globalThis.callAIWithTools = savedCawt;

  // ── 场景4:首轮抛错 → Agent 失败 ──
  gm = makeGM(); ctx = { GM: gm, input: {} };
  globalThis.callAIWithTools = async function () { throw new Error('网络炸了'); };
  res = await AM.run(ctx);
  assert(res.fallback === false && /首轮/.test(res.reason || ''), '场景4:首轮抛错 → Agent 失败且不穿越 LLM');

  // ── 场景5:模型永不 finalize → maxRounds 封顶·有落地→自动收尾(loop 补 deepen+finalize)·不出残缺回合 ──
  //   (2026-06 弱模型兜底:真机逮 deepseek-v4-flash 落地却从不 deepen/finalize·改为 loop 自动补史记+记忆收尾)
  gm = makeGM(); ctx = { GM: gm, input: {} };
  globalThis.P = { conf: { agentModeMaxRounds: 3, agentModeDepthGate: false } };
  // 每轮都写一次、从不 finalize
  let calls5 = 0;
  globalThis.callAIWithTools = async function () { calls5++; return { toolCalls: [{ name: 'set_field', input: { path: 'chars.0.mood', value: '忧' + calls5, reason: '心绪变化' } }], text: '' }; };
  // 自动收尾会补调 deepen_narrative/recall_consolidate(callAIMessages)·给内容感知 stub
  globalThis.callAIMessages = async function (msgs) {
    var u = (msgs && msgs[1] && msgs[1].content) || '';
    if (/脉络/.test(u)) return JSON.stringify({ beats: ['甲'], tone: 't' });
    if (/撰写《后人戏说》/.test(u)) return JSON.stringify({ houren_xishuo: '是日宫中无事。' });
    if (/据此产出完整史记/.test(u)) return JSON.stringify({ shizhengji: '本回合时政记。', shilu: '实录。', zhengwen: '政文。', playerStatus: '状态', playerInner: '内心', suggestions: ['进言'], title: '标题', summary: '摘要' });
    if (/causal_edges/.test(u)) return JSON.stringify({ memory: '记忆', state_board: { mood: 'm', recent_summary: 's', open_loops: [], unfulfilled_promises: [] } });
    return JSON.stringify({});
  };
  res = await AM.run(ctx);
  assert(res.ok === true && gm._agentTurnMeta.rounds === 3 && gm._agentTurnMeta.finalized === true, '场景5:maxRounds=3 封顶·有落地→自动收尾·finalized=true(不出残缺回合)');
  assert(gm._agentChronicle && /时政记/.test(gm._agentChronicle.shizhengji || ''), '场景5:自动收尾补出史记(deepen_narrative)');
  assert(gm._agentTurnMeta.depthTools && gm._agentTurnMeta.depthTools.deepen_narrative, '场景5:自动收尾记账 deepen_narrative');
  assert(gm._turnReport.some(function (e) { return e.type === 'narrative'; }), '场景5:有叙事(史记)');
  globalThis.callAIMessages = undefined;
  globalThis.P = { conf: { agentModeDepthGate: false } };  // S4 测基础循环·深度门(D1)由 d1d6 专测

  console.log('[smoke-agent-mode-s4] pass assertions=' + passed.value);
})().catch(function (e) { console.error(e); process.exit(1); });
