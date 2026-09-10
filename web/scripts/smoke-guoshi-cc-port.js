#!/usr/bin/env node
/* eslint-env node */
'use strict';
/* smoke-guoshi-cc-port — 国师 agent 对照 Claude Code 源码的移植改造 (2026-07-02)
 * A刀 G1 预算核算修真：tokensUsed=下一次请求真实体量(system+工具schema+全对话含入参)——
 *   旧口径只零星累加响应/结果 ≈ 零头·260k 闸形同虚设。
 * A刀 G2 压缩扩到入参：_compactOldToolResults 连早先轮 assistant.toolCalls.input 一并压
 *   (bulkAdd 巨型入参此前永驻上下文)·界限与结果压缩对齐·配对 assistant 保留。
 * (B/C/D 刀断言随后续 commit 追加)
 */
const path = require('path');
const AA = require(path.join(__dirname, '..', 'editor-authoring-agent.js'));
let pass = 0;
function ok(cond, msg) { if (!cond) { console.error('  ✗ FAIL: ' + msg); throw new Error('FAIL: ' + msg); } pass++; console.log('  ✓ ' + msg); }
// 正文与 json() 必须是同一份数据；不能 text() 空串、json() 却返回另一套成功结果。
function jsonResponse(value) { return new Response(JSON.stringify(value), { headers: { 'Content-Type': 'application/json' } }); }

(async function main() {
  // ───────── G1 · 预算核算修真 ─────────
  console.log('— G1 预算核算修真 —');
  // 1a: 工具 schema 计入——胖 tools 直接吃穿预算·未起一轮即 tokenBudget(旧口径从不计 tools·会照跑)
  var fatTools = [{ name: 'dummy', description: 'x'.repeat(400000), parameters: { type: 'object', properties: {} } }];
  var called = 0;
  var r1 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '测试', {
    caller: function () { called++; return Promise.resolve({ text: '', toolCalls: [] }); },
    tools: fatTools, conventions: '', blockingChecks: [], maxTokens: 90000
  });
  ok(r1.stopReason === 'tokenBudget' && called === 0, 'G1 工具schema计入预算(胖tools→零轮即停·旧口径会照跑到撞窗)');
  ok(r1.tokensBreakdown && r1.tokensBreakdown.tools > 90000, 'G1 tokensBreakdown.tools 真算(' + r1.tokensBreakdown.tools + ')');

  // 1b: assistant 入参计入——巨型 applyEdit value 落进对话后体量如实反映
  var big = '注'.repeat(80000);   // CJK×1.3 ≈ 104k tokens
  var rd = 0;
  var r2 = await AA.runAuthoringLoop(AA.makeDraft({ name: '原' }), '改名', {
    caller: function () {
      rd++;
      if (rd === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'w1', name: 'applyEdit', input: { path: 'name', value: big } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'f1', name: 'finish', input: { summary: '完' } }] });
    },
    conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  ok(r2.finished && r2.tokensBreakdown.conversation > 100000, 'G1 巨型入参计入 conversation(' + r2.tokensBreakdown.conversation + '·旧口径漏算)');
  ok(r2.tokensUsed === r2.tokensBreakdown.system + r2.tokensBreakdown.tools + r2.tokensBreakdown.conversation, 'G1 tokensUsed=三项之和(口径自洽)');

  // ───────── G2 · 压缩扩到入参 ─────────
  console.log('— G2 入参压缩 —');
  var conv = [{ role: 'user', text: 'hi' }];
  for (var r = 0; r < 8; r++) {
    conv.push({ role: 'assistant', text: '', toolCalls: [{ id: 't' + r, name: 'applyEdit', input: { path: 'x', value: '很长的入参内容需要被压缩回收'.repeat(40) } }] });
    conv.push({ role: 'tool', toolResults: [{ id: 't' + r, name: 'applyEdit', content: '一段足够长的结果内容'.repeat(20) }] });
  }
  AA._compactOldToolResults(conv, 6);
  var asst = conv.filter(function (m) { return m.role === 'assistant'; });
  var tools_ = conv.filter(function (m) { return m.role === 'tool'; });
  ok(asst[0].toolCalls[0].input._compacted && asst[1].toolCalls[0].input._compacted, 'G2 最早2轮入参压成占位');
  ok(!asst[2].toolCalls[0].input._compacted && !asst[7].toolCalls[0].input._compacted, 'G2 界限对齐:首个保留轮(第3轮)与最近轮入参保详尽');
  ok(tools_[1].toolResults[0].content.indexOf('[已省略') === 0 && tools_[2].toolResults[0].content.indexOf('[已省略') !== 0, 'G2 结果压缩界限不变(最早2轮压·第3轮起保)');
  ok(asst[0].toolCalls[0].id === 't0' && asst[0].toolCalls[0].name === 'applyEdit', 'G2 id/name 保留(provider 配对不破)');
  var before = JSON.stringify(asst[0].toolCalls[0].input);
  AA._compactOldToolResults(conv, 6);
  ok(JSON.stringify(asst[0].toolCalls[0].input) === before, 'G2 幂等(不套娃)');
  // 小入参不压
  var conv2 = [{ role: 'user', text: 'hi' }];
  for (var r2i = 0; r2i < 8; r2i++) {
    conv2.push({ role: 'assistant', text: '', toolCalls: [{ id: 's' + r2i, name: 'getField', input: { path: 'name' } }] });
    conv2.push({ role: 'tool', toolResults: [{ id: 's' + r2i, name: 'getField', content: 'ok' }] });
  }
  AA._compactOldToolResults(conv2, 6);
  ok(!conv2[1].toolCalls[0].input._compacted && conv2[1].toolCalls[0].input.path === 'name', 'G2 小入参(≤200字)原样不动');

  // ───────── G3 · 重复读去重(B刀) ─────────
  console.log('— G3 重复读去重 —');
  var seq = 0;
  var d3 = AA.makeDraft({ name: '甲', factions: [{ name: '明' }] });
  var r3 = await AA.runAuthoringLoop(d3, '测试去重', {
    caller: function () {
      seq++;
      if (seq === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'a1', name: 'getFields', input: { paths: ['name'] } }] });
      if (seq === 2) return Promise.resolve({ text: '', toolCalls: [{ id: 'a2', name: 'getFields', input: { paths: ['name'] } }] });   // 同参重复
      if (seq === 3) return Promise.resolve({ text: '', toolCalls: [{ id: 'w1', name: 'applyEdit', input: { path: 'name', value: '乙' } }] });
      if (seq === 4) return Promise.resolve({ text: '', toolCalls: [{ id: 'a3', name: 'getFields', input: { paths: ['name'] } }] });   // 写后再读→放行
      return Promise.resolve({ text: '', toolCalls: [{ id: 'f1', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  var tr3 = r3.conversation.filter(function (m) { return m.role === 'tool'; }).reduce(function (a, m) { return a.concat(m.toolResults || []); }, []);
  var g3reads = tr3.filter(function (tr) { return tr.name === 'getFields'; });
  ok(g3reads.length === 3, 'G3 三次 getFields 都有结果条目(结构不缺)');
  ok(g3reads[0].content.indexOf('完全相同') < 0, 'G3 首读正常返回');
  ok(g3reads[1].content.indexOf('完全相同') >= 0 && g3reads[1].content.indexOf('勿重复查询') >= 0, 'G3 同参重复读 → 存根(引用先前结果)');
  ok(g3reads[2].content.indexOf('完全相同') < 0 && g3reads[2].content.indexOf('乙') >= 0, 'G3 写入后同参读放行(拿到新鲜值)');

  // ───────── G3 · 纯勘察防打转(B刀) ─────────
  console.log('— G3 防打转 —');
  var sq = 0;
  var r4 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '测试防打转', {
    caller: function () {
      sq++;
      if (sq <= 4) return Promise.resolve({ text: '', toolCalls: [{ id: 'q' + sq, name: 'searchEntities', input: { query: '查' + sq } }] });   // 各轮不同参·避开去重
      return Promise.resolve({ text: '', toolCalls: [{ id: 'f2', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  ok(r4.conversation.some(function (m) { return m.role === 'user' && /纯勘察/.test(m.text || ''); }), 'G3 连续3轮纯勘察 → 催动手 nudge');
  ok(r4.finished, 'G3 nudge 后正常收尾(不误伤流程)');
  var sq2 = 0;
  var r5 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '审阅一下', {
    reviewOnly: true,
    caller: function () {
      sq2++;
      if (sq2 <= 4) return Promise.resolve({ text: '', toolCalls: [{ id: 'p' + sq2, name: 'searchEntities', input: { query: '查' + sq2 } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'sr', name: 'submitReview', input: { findings: [], summary: '无碍' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  ok(!r5.conversation.some(function (m) { return m.role === 'user' && /纯勘察/.test(m.text || ''); }), 'G3 只读(审阅)模式纯勘察是本分 → 豁免');

  // ───────── G5 · todoWrite 任务表(C刀) ─────────
  console.log('— G5 todoWrite —');
  ok(AA.AGENT_TOOLS.some(function (t) { return t.name === 'todoWrite'; }), 'G5 todoWrite 已注册进工具清单');
  var dT = AA.makeDraft({ name: '甲' });
  var rT1 = AA.dispatchTool(dT, 'todoWrite', { todos: [{ content: '补势力', status: 'in_progress' }, { content: '补人物', status: 'pending' }] });
  ok(rT1.ok && rT1.todos === 2 && /恰保持一项 in_progress/.test(rT1.message), 'G5 合法整表 → 成功消息自带用法再教育');
  var rT2 = AA.dispatchTool(dT, 'todoWrite', { todos: [{ content: 'a', status: 'in_progress' }, { content: 'b', status: 'in_progress' }] });
  ok(rT2.ok && /收敛为一项/.test(rT2.message), 'G5 两项同时 in_progress → 警示收敛');
  var rT3 = AA.dispatchTool(dT, 'todoWrite', { todos: [{ content: 'a', status: '做完了' }] });
  ok(rT3.ok === false && /status 非法/.test(rT3.reason), 'G5 非法 status → 报错教学(枚举值)');
  var rT4 = AA.dispatchTool(dT, 'todoWrite', { todos: [{ content: 'a', status: 'completed' }, { content: 'b', status: 'completed' }] });
  ok(rT4.ok && rT4.todos === 0 && /已自动清空/.test(rT4.message), 'G5 全部 completed → 表自动清空');

  // 经 loop:任务表 3 轮未更新 → 节流提醒折叠进工具结果(不伪造独立轮)
  var tq = 0;
  var rT5 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '多步任务', {
    caller: function () {
      tq++;
      if (tq === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'td1', name: 'todoWrite', input: { todos: [{ content: '补齐三将属性', status: 'in_progress' }, { content: '补齐势力资料', status: 'pending' }] } }] });
      if (tq <= 5) return Promise.resolve({ text: '', toolCalls: [{ id: 'rq' + tq, name: 'searchEntities', input: { query: '将' + tq } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'f3', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  var _allToolText = rT5.conversation.filter(function (m) { return m.role === 'tool'; }).reduce(function (a, m) { return a.concat((m.toolResults || []).map(function (t) { return t.content; })); }, []).join('\n');
  ok(_allToolText.indexOf('<系统提醒>任务表已') >= 0 && _allToolText.indexOf('补齐三将属性') >= 0, 'G5 ≥3轮未更新+有未完项 → 提醒折叠进工具结果');
  ok(!rT5.conversation.some(function (m) { return m.role === 'user' && /任务表已/.test(m.text || ''); }), 'G5 提醒不独立成 user 消息(不伪造轮边界)');
  ok(Array.isArray(rT5.todos) && rT5.todos.length === 2, 'G5 收尾 result.todos 面向 UI 暴露(2 项未完)');

  // ───────── G4 · 外部修改新鲜度防护(D刀) ─────────
  console.log('— G4 外部修改防护 —');
  var dExt = AA.makeDraft({ name: '甲', factions: [{ name: '明' }] });
  var xq = 0;
  var rX = await AA.runAuthoringLoop(dExt, '测试外部修改', {
    caller: function () {
      xq++;
      if (xq === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'x1', name: 'applyEdit', input: { path: 'name', value: '乙' } }] });
      if (xq === 2) {
        dExt.factions.push({ name: '清' });   // 模拟:agent 运行期间用户在编辑器里改了 factions
        return Promise.resolve({ text: '', toolCalls: [{ id: 'x2', name: 'applyEdit', input: { path: 'factions.0.name', value: '后金' } }] });
      }
      if (xq === 3) return Promise.resolve({ text: '', toolCalls: [{ id: 'x3', name: 'getFields', input: { paths: ['factions'] } }] });   // 按提示重读→刷新指纹
      if (xq === 4) return Promise.resolve({ text: '', toolCalls: [{ id: 'x4', name: 'applyEdit', input: { path: 'factions.0.name', value: '后金' } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'xf', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  var trX = rX.conversation.filter(function (m) { return m.role === 'tool'; }).reduce(function (a, m) { return a.concat(m.toolResults || []); }, []);
  ok(rX.draft.name === '乙', 'G4 无外部改动的写正常落地');
  var xErr = trX.filter(function (t) { return t.content.indexOf('被外部修改') >= 0; });
  ok(xErr.length === 1 && xErr[0].id === 'x2', 'G4 外部改动后的写被拦(external-modified·勿覆盖用户改动)');
  ok(rX.draft.factions[0].name === '后金' && rX.draft.factions[1].name === '清', 'G4 重读刷新指纹后写放行·用户新增的势力保住');
  // 自家连续写不误报
  var dSelf = AA.makeDraft({ name: '甲' });
  var sq3 = 0;
  var rSelf = await AA.runAuthoringLoop(dSelf, '连续写', {
    caller: function () {
      sq3++;
      if (sq3 === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 's1', name: 'applyEdit', input: { path: 'name', value: '乙' } }] });
      if (sq3 === 2) return Promise.resolve({ text: '', toolCalls: [{ id: 's2', name: 'applyEdit', input: { path: 'name', value: '丙' } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'sf', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  var trSelf = rSelf.conversation.filter(function (m) { return m.role === 'tool'; }).reduce(function (a, m) { return a.concat(m.toolResults || []); }, []);
  ok(rSelf.draft.name === '丙' && !trSelf.some(function (t) { return t.content.indexOf('被外部修改') >= 0; }), 'G4 自家连续写同区段不误报(写后指纹即刷新)');

  // ───────── G7 · todo 收尾闸(CC verification nudge 对照) ─────────
  console.log('— G7 todo 收尾闸 —');
  // 7a: finish 时任务表有未完项 → 顶回一次(带原因+出路)·完成后 finish 放行
  var vq = 0;
  var rV = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '两步任务', {
    caller: function () {
      vq++;
      if (vq === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'v1', name: 'todoWrite', input: { todos: [{ content: '补三将属性', status: 'in_progress' }, { content: '补势力资料', status: 'pending' }] } }] });
      if (vq === 2) return Promise.resolve({ text: '', toolCalls: [{ id: 'v2', name: 'finish', input: { summary: '做完了' } }] });   // 未完就想溜
      if (vq === 3) return Promise.resolve({ text: '', toolCalls: [{ id: 'v3', name: 'todoWrite', input: { todos: [{ content: '补三将属性', status: 'completed' }, { content: '补势力资料', status: 'completed' }] } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'v4', name: 'finish', input: { summary: '真做完了' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  var trV = rV.conversation.filter(function (m) { return m.role === 'tool'; }).reduce(function (a, m) { return a.concat(m.toolResults || []); }, []);
  var vBounce = trV.filter(function (t) { return t.content.indexOf('todos-pending') >= 0 || t.content.indexOf('项未完成') >= 0; });
  ok(vBounce.length === 1 && vBounce[0].id === 'v2', 'G7 未完 todo 时 finish → 顶回(带项数与出路)');
  ok(vBounce[0].content.indexOf('补三将属性') >= 0 && vBounce[0].content.indexOf('todoWrite 更新任务表') >= 0, 'G7 顶回消息点名未完项+给"确不需要做"的出路');
  ok(rV.finished && rV.stopReason === 'finish' && rV.todos.length === 0, 'G7 完成任务表后 finish 放行·表已自动清');
  // 7b: 未完成不能靠反复finish抹掉；沿用有限finish尝试上限，明确受阻而非无限循环。
  var wq = 0;
  var rW = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '固执收尾', {
    caller: function () {
      wq++;
      if (wq === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'w1t', name: 'todoWrite', input: { todos: [{ content: '某项', status: 'pending' }] } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'wf' + wq, name: 'finish', input: { summary: '就这样' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  ok(!rW.finished && wq === 4 && rW.stopReason === 'finishBlocked', 'G7 反复坚持仍不虚报完成·3次finish后受阻停止');
  ok(rW.todos.length === 1 && rW.todos[0].content === '某项', 'G7 未完项经 result.todos 交 UI(用户可见"没做完啥")');
  // 7c: noToolCalls nudge 感知任务表(点名未完项)
  var nq = 0;
  var rN = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '卡壳任务', {
    caller: function () {
      nq++;
      if (nq === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'n1', name: 'todoWrite', input: { todos: [{ content: '补齐某将', status: 'in_progress' }] } }] });
      if (nq === 2) return Promise.resolve({ text: '我想想…', toolCalls: [] });   // 卡壳没调工具
      if (nq === 3) return Promise.resolve({ text: '', toolCalls: [{ id: 'n3', name: 'todoWrite', input: { todos: [{ content: '补齐某将', status: 'completed' }] } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'nf', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  var nNudge = rN.conversation.filter(function (m) { return m.role === 'user' && /没有调用任何工具/.test(m.text || ''); });
  ok(nNudge.length === 1 && nNudge[0].text.indexOf('补齐某将') >= 0, 'G7 noToolCalls nudge 点名未完 todo(有的放矢)');
  ok(rN.finished, 'G7 nudge 后正常收尾');

  // ───────── G8 · 宏压缩 + 超限自愈(CC autocompact 对照) ─────────
  console.log('— G8 宏压缩/超限自愈 —');
  // 8a: 超限文案识别(四 provider + 阴性)
  ok(AA._OVERFLOW_RE.test("This model's maximum context length is 65536 tokens. However, your messages resulted in 80000 tokens"), 'G8 识别 OpenAI/DeepSeek 超限文案');
  ok(AA._OVERFLOW_RE.test('prompt is too long: 210942 tokens > 200000 maximum'), 'G8 识别 Anthropic 超限文案');
  ok(AA._OVERFLOW_RE.test('The input token count (1189256) exceeds the maximum number of tokens allowed (1048576)'), 'G8 识别 Gemini 超限文案');
  ok(AA._OVERFLOW_RE.test('input length and max_tokens exceed context limit: 195000 + 8000 > 200000'), 'G8 识别 Anthropic 新式超限文案');
  ok(!AA._OVERFLOW_RE.test('Invalid request: model `gpt-99` not found') && !AA._OVERFLOW_RE.test('invalid tool schema at tools[3]'), 'G8 普通 400 不误判为超限');
  // 8b: 尾部切片轮界对齐(落在 tool 上前挪含配对 assistant·短对话整段保留)
  var cv8 = [{ role: 'user', text: 'u' }, { role: 'assistant', text: '', toolCalls: [{ id: 'a', name: 'x', input: {} }] }, { role: 'tool', toolResults: [] }, { role: 'assistant', text: '', toolCalls: [{ id: 'b', name: 'y', input: {} }] }, { role: 'tool', toolResults: [] }];
  var t8 = AA._compactTailSlice(cv8, 3);
  ok(t8.length === 4 && t8[0].role === 'assistant' && t8[0].toolCalls[0].id === 'a', 'G8 切片起点落 tool → 前挪对齐配对 assistant(不孤儿化)');
  ok(AA._compactTailSlice(cv8, 9).length === 5 && AA._compactTailSlice(cv8, 0).length === 0, 'G8 短对话整段保留·keep=0 全压');
  // 8c: 主动宏压缩经 loop——对话吃到高水位 → 摘要请求 → 替换旧对话 → 继续收尾
  var big8 = '事'.repeat(30000);
  var mq = 0, sumReqs = 0;
  var r8 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '压缩演练', {
    macroCompactAt: 0.2, macroKeepTail: 0,
    caller: function (conv, tools2) {
      if (tools2 && tools2.length === 1 && tools2[0].name === 'submitSummary') {
        sumReqs++;
        ok(String(conv[0].text).indexOf('七段') >= 0 && String(conv[0].text).indexOf('压缩演练') >= 0, 'G8 摘要请求带七段要求+拍平的对话记录');
        return Promise.resolve({ text: '', toolCalls: [{ id: 'sm', name: 'submitSummary', input: { summary: '①用户要求压缩演练 ②已改 name 字段并写入长注 ③任务表无未完项 ④草稿结构完好 ⑤无错误 ⑥正准备收尾 ⑦下一步:finish。' + '摘'.repeat(200) } }] });
      }
      mq++;
      if (mq === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'm1', name: 'applyEdit', input: { path: 'name', value: big8 } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'mf', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 200000
  });
  ok(sumReqs === 1 && r8.macroCompactions === 1, 'G8 高水位触发宏压缩恰一次');
  ok(r8.finished && r8.conversation[0].text.indexOf('【前情摘要·上下文已压缩】') === 0, 'G8 压缩后对话以前情摘要开头·任务照常收尾');
  ok(r8.conversation[0].text.indexOf('当前草稿最新状态') >= 0 && r8.conversation[0].text.indexOf('当中断从未发生') >= 0, 'G8 摘要头带草稿重读+续作指令(不复述不寒暄)');
  ok(JSON.stringify(r8.conversation).length < big8.length, 'G8 旧巨型内容真被压掉(对话体量骤减)');
  ok(r8.transcript.some(function (t) { return t.name === 'macroCompact' && t.result && t.result.ok; }), 'G8 宏压缩留 transcript 记录(UI 可见)');
  // 8d: 超限被动自愈——真实请求抛 overflow → 压缩 → 重试本轮成功
  var oq = 0, oSum = 0;
  var fatReq = '需求很长' + '求'.repeat(28000);
  var r9 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), fatReq, {
    macroKeepTail: 0,
    caller: function (conv, tools2) {
      if (tools2 && tools2.length === 1 && tools2[0].name === 'submitSummary') { oSum++; return Promise.resolve({ text: '①用户给了超长需求 ②尚未改动 ③无任务表 ④草稿完好 ⑤首轮请求超窗 ⑥压缩自救 ⑦下一步:直接完成需求并 finish。' + '摘'.repeat(200), toolCalls: [] }); }
      oq++;
      if (oq === 1) { var eo = new Error('上下文超限（对话+工具已超过模型窗口）：prompt is too long'); eo.status = 400; eo.overflow = true; return Promise.reject(eo); }
      return Promise.resolve({ text: '', toolCalls: [{ id: 'of', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  ok(oSum === 1 && r9.finished && r9.macroCompactions === 1, 'G8 超限 → 宏压缩 → 重试本轮成功(纯文本摘要兜底也认)');
  ok(r9.iterations <= 2, 'G8 超限重试不计入迭代预算');
  // 8e: 对话太小压了也救不了 → 不浪费摘要调用·失败原样抛·partial 挂已完成工作
  var pq = 0;
  var e8 = null;
  try {
    await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '小对话', {
      caller: function () {
        pq++;
        var eo = new Error('上下文超限（对话+工具已超过模型窗口）：prompt is too long'); eo.status = 400; eo.overflow = true; return Promise.reject(eo);
      }, conventions: '', blockingChecks: [], maxTokens: 5000000
    });
  } catch (ex) { e8 = ex; }
  ok(e8 && pq === 1, 'G8 小对话超限不尝试压缩(不多打一次摘要调用)·原样失败');
  ok(e8 && e8.partial && Array.isArray(e8.partial.transcript) && Array.isArray(e8.partial.todos) && e8.partial.conversation, 'G8 终局失败 err.partial 保留已完成工作(调用方可续)');
  // 8f: 非瞬态 API 错误(鉴权等)也挂 partial
  var e9 = null;
  try {
    await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '鉴权炸', {
      caller: function () { var ea = new Error('API Key 无效（HTTP 401）'); ea.status = 401; return Promise.reject(ea); },
      conventions: '', blockingChecks: [], maxTokens: 5000000
    });
  } catch (ex2) { e9 = ex2; }
  ok(e9 && e9.partial && e9.partial.draft, 'G8 非瞬态错误同样挂 partial(草稿引用在内·改动不丢)');

  // ───────── G9 · 运行中插话 steering(CC message queue 对照) ─────────
  console.log('— G9 运行中插话 —');
  // 9a: 跑动中 steer → 本轮工具结果后注入 → 下一轮照办 → 收尾
  var sa = 0, saOk = null;
  var rS = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '先查一下', {
    caller: function () {
      sa++;
      if (sa === 1) { saOk = AA.steer('把名字改成乙'); return Promise.resolve({ text: '', toolCalls: [{ id: 'sa1', name: 'getFields', input: { paths: ['name'] } }] }); }
      if (sa === 2) return Promise.resolve({ text: '', toolCalls: [{ id: 'sa2', name: 'applyEdit', input: { path: 'name', value: '乙' } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'saf', name: 'finish', input: { summary: '按新指示改完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  ok(saOk === true, 'G9 运行中 steer() 返回 true(已入队)');
  var sMsg = rS.conversation.filter(function (m) { return m.role === 'user' && /用户在你工作期间发来新指示/.test(m.text || ''); });
  ok(sMsg.length === 1 && sMsg[0].text.indexOf('把名字改成乙') >= 0 && sMsg[0].text.indexOf('勿忽略') >= 0, 'G9 插话包装注入(CC 必须处理·勿忽略语义)');
  ok(rS.finished && rS.draft.name === '乙' && rS.steered === 1, 'G9 agent 按插话照办·result.steered 计数');
  ok(rS.transcript.some(function (t) { return t.name === 'steer'; }), 'G9 插话留 transcript 记录(UI 可见)');
  // 9b: 插话与 finish 同轮竞速 → finish 顶回(steer-pending)·处理完再收尾
  var sb = 0;
  var rS2 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '改个名', {
    caller: function () {
      sb++;
      if (sb === 1) { AA.steer('慢着·改成丙不是乙'); return Promise.resolve({ text: '', toolCalls: [{ id: 'sb1', name: 'applyEdit', input: { path: 'name', value: '乙' } }, { id: 'sbf', name: 'finish', input: { summary: '完' } }] }); }
      if (sb === 2) return Promise.resolve({ text: '', toolCalls: [{ id: 'sb2', name: 'applyEdit', input: { path: 'name', value: '丙' } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'sbf2', name: 'finish', input: { summary: '真完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  var sbTr = rS2.conversation.filter(function (m) { return m.role === 'tool'; }).reduce(function (a, m) { return a.concat(m.toolResults || []); }, []);
  ok(sbTr.some(function (t) { return t.id === 'sbf' && t.content.indexOf('steer-pending') >= 0; }), 'G9 未处理插话时 finish → 顶回(steer-pending)');
  ok(rS2.finished && rS2.draft.name === '丙', 'G9 顶回后按新指示改·再收尾成功');
  // 9c: 无活跃运行 steer → false
  ok(AA.steer('没人在跑') === false, 'G9 无活跃运行时 steer 返回 false');
  // 9d: 模型卡壳(没调工具)时插话即推动力·不打泛泛 nudge
  var sd = 0;
  var rS3 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '干活', {
    caller: function () {
      sd++;
      if (sd === 1) { AA.steer('直接把名字改成丁然后结束'); return Promise.resolve({ text: '我想想…', toolCalls: [] }); }
      if (sd === 2) return Promise.resolve({ text: '', toolCalls: [{ id: 'sd2', name: 'applyEdit', input: { path: 'name', value: '丁' } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'sdf', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  ok(!rS3.conversation.some(function (m) { return m.role === 'user' && /没有调用任何工具/.test(m.text || ''); }), 'G9 卡壳时插话顶替泛泛 nudge(不耗配额)');
  ok(rS3.finished && rS3.draft.name === '丁', 'G9 卡壳被插话重新推动·照办收尾');
  // 9e: UI 接线源契约(编辑器输入框运行中回车 → onSteer·运行态占位提示插话)
  var uiSrc = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/ui\.running && typeof onSteer === 'function'\) onSteer\(\)/.test(uiSrc) && /function onSteer\(\)/.test(uiSrc), 'G9 UI 接线:运行中回车路由到 onSteer');
  ok(uiSrc.indexOf('回车可随时插话') >= 0 && /AA\.steer\(t\)/.test(uiSrc), 'G9 UI 接线:运行态占位提示+steer 调用');

  // ───────── H1 · 输出截断自愈(CC max_tokens 动态调整对照) ─────────
  console.log('— H1 输出截断自愈 —');
  // 1: parse 层 surfacing(三 provider)·斩断的 toolCall 不再吞成空入参执行
  var pT = AA._parseOpenAI({ choices: [{ finish_reason: 'length', message: { content: '写到一半', tool_calls: [{ id: 't1', function: { name: 'applyEdit', arguments: '{"path":"na' } }] } }] });
  ok(pT.truncated === true && pT.badToolJson === true && pT.toolCalls.length === 0, 'H1 OpenAI 截断+斩断JSON → truncated/badToolJson·坏调用不执行(旧行为:空入参静默跑)');
  var pC = AA._parseOpenAI({ choices: [{ finish_reason: 'stop', message: { content: '', tool_calls: [{ id: 't2', function: { name: 'applyEdit', arguments: '{"path":"name","value":"乙"}' } }] } }] });
  ok(pC.truncated === false && !pC.badToolJson && pC.toolCalls[0].input.value === '乙', 'H1 正常响应不受影响');
  ok(AA._parseAnthropic({ stop_reason: 'max_tokens', content: [{ type: 'text', text: 'x' }] }).truncated === true, 'H1 Anthropic stop_reason=max_tokens → truncated');
  ok(AA._parseGemini({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'x' }] } }] }).truncated === true, 'H1 Gemini MAX_TOKENS → truncated');
  // 2: 循环自愈——截断 → maxTok ×2 重试本轮·斩断响应整体弃置·bump 后全程沿用·不计迭代
  var hq = 0, seenTok = [];
  var rH = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '大改动', {
    caller: function (conv, tools2, cOpts) {
      hq++; seenTok.push(cOpts && cOpts.maxTok);
      if (hq === 1) return Promise.resolve({ text: '写到一半被截', toolCalls: [], truncated: true });
      if (hq === 2) return Promise.resolve({ text: '又截', toolCalls: [{ id: 'h2', name: 'applyEdit', input: { path: 'name', value: '坏' } }], truncated: true, badToolJson: true });
      if (hq === 3) return Promise.resolve({ text: '', toolCalls: [{ id: 'h3', name: 'applyEdit', input: { path: 'name', value: '乙' } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'hf', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  ok(seenTok[1] === 6000 && seenTok[2] === 12000 && seenTok[3] === 12000, 'H1 截断 → 输出上限 6000→12000 且 bump 后全程沿用(实测 ' + seenTok.slice(1).join('/') + ')');
  ok(rH.finished && rH.draft.name === '乙', 'H1 斩断响应整体弃置(「坏」未落地)·重试后正常改动落地');
  ok(rH.iterations === 2, 'H1 截断重试不计迭代(实 2 轮:改动+finish)');
  // 3: bump 耗尽(2次)后不再无限重试·走正常 noToolCalls 路径收场
  var hx = 0;
  var rH2 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '永远截断', {
    caller: function () {
      hx++;
      if (hx <= 3) return Promise.resolve({ text: '截', toolCalls: [], truncated: true });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'hxf', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000, maxNoToolNudges: 1
  });
  ok(rH2.finished && hx === 4, 'H1 bump 耗尽后第3次截断按 noToolCalls 处理(nudge→finish)·不无限重试');

  // ───────── H3 · 会话线程持久化/恢复(CC session resume 对照) ─────────
  console.log('— H3 会话恢复 —');
  // 1: initialTodos 回灌——恢复的未完任务表接着管收尾(G7 闸认账)
  var rq2 = 0;
  var rR = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '继续上次的活', {
    initialTodos: [{ content: '上次没补完的势力', status: 'in_progress' }, { content: '坏项', status: '不合法' }, { content: '', status: 'pending' }],
    caller: function () {
      rq2++;
      if (rq2 === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'r1', name: 'finish', input: { summary: '想直接溜' } }] });
      if (rq2 === 2) return Promise.resolve({ text: '', toolCalls: [{ id: 'r2', name: 'todoWrite', input: { todos: [{ content: '上次没补完的势力', status: 'completed' }] } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'rf', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  var rTr = rR.conversation.filter(function (m) { return m.role === 'tool'; }).reduce(function (a, m) { return a.concat(m.toolResults || []); }, []);
  var rB = rTr.filter(function (t) { return t.content.indexOf('todos-pending') >= 0; });
  ok(rB.length === 1 && rB[0].content.indexOf('上次没补完的势力') >= 0, 'H3 恢复的任务表接着管收尾(finish 被 G7 闸按恢复项顶回)');
  ok(rR.finished && rR.todos.length === 0, 'H3 补完恢复项后正常收尾');
  ok(!JSON.stringify(rR.todos).match(/坏项/), 'H3 非法 status/空 content 的恢复项被滤掉');
  // 2: UI 源契约(存/取/清/回灌四处接线·jsdom 行为由真机验)
  var uiSrc3 = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/ui\.conversation = res\.conversation;[^\n]*\n\s*_saveSession\(res, request/.test(uiSrc3.replace(/\r/g, '')), 'H3 UI:跑完即落盘当前会话(_saveSession 紧随 conversation 赋值)');
  ok(/_maybeRestoreThread\(\); _autoWinMode\(\); \}/.test(uiSrc3) && /SESS_FRESH_MS = 48 \* 3600 \* 1000/.test(uiSrc3), 'H3 UI:开面板自动续接(48h 新鲜度守卫)+首开默认全屏窗');
  ok(/m\.fileKey === fk/.test(uiSrc3), 'H3 UI:按剧本 fileKey 找候选会话(跨剧本不串线程)');
  ok(/900000/.test(uiSrc3) && /_compactOldToolResults\(copy, 4\)/.test(uiSrc3), 'H3 UI:存前压缩副本+体量上限护 quota');
  var _clrN = (uiSrc3.match(/ui\._sessId = null; _sessPtrSet\(_fileKey\(\), null\);/g) || []).length;
  ok(_clrN >= 3, 'H3 UI:新对话/撤销/回退检查点三处脱离会话+指针置空(实 ' + _clrN + ' 处)');
  ok(/initialTodos: _rtd,/.test(uiSrc3) && /ui\._restoredTodos = null;/.test(uiSrc3), 'H3 UI:恢复的任务表一次性回灌 initialTodos');

  // ───────── H4 · API 连接·模型选择弹层(模型徽即入口·owner 定案) ─────────
  console.log('— H4 API连接·模型弹层 —');
  var uiSrc4 = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/id="tm-aa-modelpop"/.test(uiSrc4) && /id="tm-aa-api-url"/.test(uiSrc4) && /id="tm-aa-api-key"/.test(uiSrc4) && /id="tm-aa-api-detect"/.test(uiSrc4) && /id="tm-aa-api-model"/.test(uiSrc4) && /id="tm-aa-api-save"/.test(uiSrc4), 'H4 弹层五件套(地址/Key/检测/模型选/保存)在位');
  ok(/generativelanguage\\\.googleapis\\\.com/.test(uiSrc4) && /anthropic-dangerous-direct-browser-access/.test(uiSrc4) && /'Authorization': 'Bearer ' \+ \(key \|\| ''\)/.test(uiSrc4), 'H4 检测覆盖三家 provider(Gemini/Anthropic/OpenAI兼容含中转)');
  ok(/\['tm_P_lite', 'tm_P'\]\.forEach/.test(uiSrc4) && /localStorage\.setItem\('tm_api'/.test(uiSrc4), 'H4 保存写 tm_api+镜像游戏存档 P.ai(否则被存档优先级压掉)');
  ok(/_refreshModelChip/.test(uiSrc4) && /'配置 API'/.test(uiSrc4) && /classList\.toggle\('warn', !ok\)/.test(uiSrc4), 'H4 模型徽未配置显「配置 API」警示态');
  var wsSrc = require('fs').readFileSync(path.join(__dirname, '..', 'preview', 'scenario-editor-reset-style.css'), 'utf8') /* R1·工坊CSS已外提 */;
  ok(/\.je-aa-apicfg \{ display: none !important; \}|\.je-aa-stop, \.je-aa-apicfg \{ display: none !important; \}/.test(wsSrc), 'H4 工坊旧 API 抽屉已退役(功能移模型徽弹层)');

  // ───────── H5 · 权限模式(问策/共审/放行·CC permission modes 对照·owner 点名缺失件) ─────────
  console.log('— H5 权限模式 —');
  var uiSrc5 = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/id="tm-aa-perm"/.test(uiSrc5) && /id="tm-aa-permpop"/.test(uiSrc5) && /data-pm="plan"/.test(uiSrc5) && /data-pm="review"/.test(uiSrc5) && /data-pm="auto"/.test(uiSrc5), 'H5 权限 pill+弹层三模式(问策/共审/放行)在位');
  ok(/ui\.planMode = p\.mode === 'plan'/.test(uiSrc5) && /ui\.autonomy = p\.mode === 'auto' \? 'auto' : 'review'/.test(uiSrc5) && /ui\.allowDestructive = p\.allowDestructive !== false/.test(uiSrc5), 'H5 模式映射既有引擎旗标(planMode/autonomy/allowDestructive·非新权限系统)');
  ok(/localStorage\.setItem\(PERM_KEY/.test(uiSrc5) && /_applyPerm\(_loadPerm\(\)\)/.test(uiSrc5), 'H5 模式持久+启动即布防');
  ok(/id="tm-aa-perm-danger"/.test(uiSrc5), 'H5 危险操作开关(允许删除/改名联动)');
  var wsSrc5 = require('fs').readFileSync(path.join(__dirname, '..', 'preview', 'scenario-editor-reset-style.css'), 'utf8') /* R1·工坊CSS已外提 */;
  ok(/\.je-aa-planmode:not\(\.je-aa-fewshot\) \{ display: none !important; \}/.test(wsSrc5), 'H5 工坊旧计划模式勾选退役(升级为问策·少样例开关保留)');

  // ───────── H6 · 次要模型分工(杂活走便宜模型·owner"自动调用次要API的模型为它工作") ─────────
  console.log('— H6 次要模型分工 —');
  var m2q = 0, m2seen = [];
  var rM2 = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '压缩演练二', {
    macroCompactAt: 0.2, macroKeepTail: 0, cfg2: { model: 'cheap-x', url: 'u', key: 'k' },
    caller: function (conv, tools2, cOpts) {
      if (tools2 && tools2.length === 1 && tools2[0].name === 'submitSummary') {
        m2seen.push(cOpts && cOpts.cfg && cOpts.cfg.model);
        return Promise.resolve({ text: '', toolCalls: [{ id: 'sm2', name: 'submitSummary', input: { summary: '①压缩演练二 ②已写长注 ③无任务 ④完好 ⑤无错 ⑥收尾 ⑦finish。' + '摘'.repeat(200) } }] });
      }
      m2q++;
      m2seen.push(cOpts && cOpts.cfg && cOpts.cfg.model);
      if (m2q === 1) return Promise.resolve({ text: '', toolCalls: [{ id: 'n1', name: 'applyEdit', input: { path: 'name', value: '事'.repeat(30000) } }] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'nf', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 200000
  });
  ok(rM2.finished && rM2.macroCompactions === 1, 'H6 场景成立(宏压缩发生)');
  ok(m2seen.indexOf('cheap-x') >= 0 && m2seen.filter(function (m) { return m === 'cheap-x'; }).length === 1, 'H6 摘要杂活拿到次模 cfg(cheap-x)·主轮不受影响');
  var agSrc6 = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent.js'), 'utf8');
  ok(/model2: src\.model2 \|\| ''/.test(agSrc6) && /function _secondaryCfg\(\)/.test(agSrc6), 'H6 配置层 model2 透传+_secondaryCfg(未配返回 null 用主模)');
  ok(/var _c2 = opts\.cfg2 \|\| _secondaryCfg\(\);/.test(agSrc6) && /reviewFocus: 'history', cfg: _c2/.test(agSrc6), 'H6 三堂会审两官分工次模(源契约)');
  var uiSrc6 = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/id="tm-aa-api-model2"/.test(uiSrc6) && /_saveApiCfg\(u, k, m, m2\)/.test(uiSrc6) && /o\.ai\.model2 = model2 \|\| ''/.test(uiSrc6), 'H6 弹层次模下拉+保存/镜像链路');

  // ───────── H7 · 生图模型为国师工作(generateImage 工具·tm_api_image 同源) ─────────
  console.log('— H7 生图工具 —');
  global.localStorage = { _s: {}, getItem: function (k) { return Object.prototype.hasOwnProperty.call(this._s, k) ? this._s[k] : null; }, setItem: function (k, v) { this._s[k] = String(v); }, removeItem: function (k) { delete this._s[k]; } };
  var dG = AA.makeDraft({ name: '甲', characters: [{ name: '袁可立' }] });
  var rG0 = await Promise.resolve(AA.dispatchTool(dG, 'generateImage', { path: 'characters.0.portrait', prompt: '明代登莱巡抚半身像' }));
  ok(rG0.ok === false && rG0.errorCode === 'image-api-missing' && /生图 API 未配置/.test(rG0.reason), 'H7 未配生图 API → 明确报错+引导(不装死)');
  global.localStorage.setItem('tm_api_image', JSON.stringify({ url: 'https://img.example.com', key: 'ik', model: 'flux-1' }));
  var _imgReq = null;
  global.fetch = function (u, o) {
    _imgReq = { url: u, body: JSON.parse(o.body) };
    return Promise.resolve(jsonResponse({ data: [{ b64_json: 'aGVsbG8=' }] }));
  };
  var rG1 = await Promise.resolve(AA.dispatchTool(dG, 'generateImage', { path: 'characters.0.portrait', prompt: '明代登莱巡抚半身像·布面甲·沉稳' }));
  ok(rG1.ok === true && /images\/generations$/.test(_imgReq.url) && _imgReq.body.model === 'flux-1' && _imgReq.body.response_format === 'b64_json', 'H7 真调生图端点(模型/回参形制对)');
  ok(dG.characters[0].portrait === 'data:image/png;base64,aGVsbG8=', 'H7 图片以 data URL 写入指定字段(经 applyEdit 管线)');
  var agSrc7 = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent.js'), 'utf8');
  ok(/var _MUT_TOOLS = \{[^}]*renameRegion: 1[^}]*generateImage: 1[^}]*copyField: 1[^}]*\}/.test(agSrc7)
    && /var _WRITE_TOOLS = _MUT_TOOLS/.test(agSrc7)
    && /if \(!perms \|\| !_MUT_TOOLS\[name\]\) return null/.test(agSrc7)
    && /case 'generateImage': return \[_topOf\(input\.path\)\]/.test(agSrc7), 'H7 单一致变工具表同时驱动权限/指纹/写后回读(copyField 与生图同帐)');
  ok(/case 'copyField': return \[_topOf\(input\.to\)\]/.test(agSrc7), 'H7b copyField 危险闸按目标路径记账');
  delete global.fetch;

  // ───────── H7c · 全致变工具共用范围沙箱（曾可由批量/地图工具绕过） ─────────
  console.log('— H7c 单一权限注册表 —');
  var permDraft = AA.makeDraft({
    name: '权限沙箱',
    characters: [{ name: '甲', faction: '明', factionId: 'f1' }],
    factions: [{ id: 'f1', name: '明', power: 1 }, { id: 'f2', name: '清', power: 2 }],
    map: { regions: [{ id: 'r1', name: '京师', ownerKey: 'f1' }] }
  });
  var permRound = 0;
  var permResult = await AA.runAuthoringLoop(permDraft, '只能改人物，尝试越权工具', {
    toolPacks: ['bulk', 'map', 'media'], // 先授权工具，再验证原有 allowedCollections 边界。
    caller: function () {
      permRound++;
      if (permRound === 1) return Promise.resolve({ text: '', toolCalls: [
        { id: 'pb', name: 'bulkUpdate', input: { collection: 'factions', where: {}, field: 'power', op: 'set', value: 99 } },
        { id: 'pm', name: 'mapAssignOwner', input: { region: '京师', owner: 'f2' } },
        { id: 'pr', name: 'renameRegion', input: { region: '京师', newName: '北京' } },
        { id: 'pc', name: 'copyField', input: { from: 'name', to: 'factions.0.name' } }
      ] });
      return Promise.resolve({ text: '', toolCalls: [{ id: 'pf', name: 'finish', input: { summary: '权限校验完成' } }] });
    },
    noMemoryRecall: true, conventions: '', blockingChecks: [], qualityGate: false,
    allowedCollections: ['characters'], maxTokens: 5000000
  });
  var permDenied = permResult.transcript.filter(function(t) { return ['bulkUpdate', 'mapAssignOwner', 'renameRegion', 'copyField'].indexOf(t.name) >= 0; });
  ok(!permResult.finished && permResult.completion.status === 'blocked' && permDenied.length === 4 && permDenied.every(function(t) { return t.result && t.result.ok === false && /范围沙箱/.test(t.result.reason || ''); }), 'H7c 四种旁路被allowedCollections拦截，不能再虚报写入已完成');
  ok(permDraft.factions[0].name === '明' && permDraft.factions[0].power === 1 && permDraft.map.regions[0].name === '京师' && permDraft.map.regions[0].ownerKey === 'f1', 'H7c 越权调用未留下任何写入');

  // ───────── H7d · 并行会审停止覆盖全部在途 caller ─────────
  console.log('— H7d 并行中止 —');
  var abortReleases = [], abortEntered = 0;
  function heldCaller() {
    abortEntered++;
    return new Promise(function(resolve) { abortReleases.push(function() { resolve({ text: '已停止', toolCalls: [] }); }); });
  }
  var abortOpts = { caller: heldCaller, noMemoryRecall: true, conventions: '', blockingChecks: [], qualityGate: false, maxNoToolNudges: 0, maxTokens: 5000000 };
  var abortP1 = AA.runAuthoringLoop(AA.makeDraft({ name: '并行甲' }), '会审甲', abortOpts);
  var abortP2 = AA.runAuthoringLoop(AA.makeDraft({ name: '并行乙' }), '会审乙', abortOpts);
  for (var abortSpin = 0; abortSpin < 50 && abortEntered < 2; abortSpin++) await new Promise(function(resolve) { setTimeout(resolve, 0); });
  ok(abortEntered === 2 && AA.abort() === true, 'H7d 两个并行运行均注册后，停止命令命中活跃集合');
  abortReleases.forEach(function(release) { release(); });
  var abortResults = await Promise.all([abortP1, abortP2]);
  ok(abortResults.every(function(r) { return r.stopReason === 'aborted' && r.finished === false; }), 'H7d 两个并行 caller 返回后都以 aborted 收口，均未继续施改');

  // ───────── H8 · 附件与视觉(拖拽/粘贴截图/文件导入·Claude 桌面端对照) ─────────
  console.log('— H8 附件与视觉 —');
  var IMG = 'data:image/png;base64,iVBORw0KGgo=';
  var aq = 0, aSeen = null;
  var rA = await AA.runAuthoringLoop(AA.makeDraft({ name: '甲' }), '看这张截图照着改', {
    images: [IMG],
    caller: function (conv) {
      aq++;
      if (aq === 1) aSeen = conv[0].images;
      return Promise.resolve({ text: '', toolCalls: [{ id: 'af', name: 'finish', input: { summary: '完' } }] });
    }, conventions: '', blockingChecks: [], maxTokens: 5000000
  });
  ok(rA.finished && Array.isArray(aSeen) && aSeen[0] === IMG, 'H8 opts.images 挂上本轮 user 消息(引擎透传)');
  var conv8 = [{ role: 'user', text: '看图', images: [IMG] }, { role: 'assistant', text: '好', toolCalls: [] }];
  var oa = AA._toOpenAI(conv8, 'sys', [{ name: 't', parameters: {} }], 100, 'm', 0.5);
  ok(Array.isArray(oa.messages[1].content) && oa.messages[1].content[1].type === 'image_url' && oa.messages[1].content[1].image_url.url === IMG, 'H8 OpenAI 兼容多模态映射(text+image_url)');
  var an = AA._toAnthropic(conv8, 'sys', [{ name: 't', parameters: {} }], 100, 'm');
  ok(Array.isArray(an.messages[0].content) && an.messages[0].content[0].type === 'image' && an.messages[0].content[0].source.media_type === 'image/png' && an.messages[0].content[1].type === 'text', 'H8 Anthropic 多模态映射(base64 source)');
  var ge = AA._toGemini(conv8, 'sys', [{ name: 't', parameters: {} }], 100, 0.5);
  ok(ge.contents[0].parts.length === 2 && ge.contents[0].parts[1].inline_data && ge.contents[0].parts[1].inline_data.mime_type === 'image/png', 'H8 Gemini 多模态映射(inline_data)');
  var uiSrc8 = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/id="tm-aa-attach-btn"/.test(uiSrc8) && /addEventListener\('drop'/.test(uiSrc8) && /addEventListener\('paste'/.test(uiSrc8), 'H8 UI 三入口(曲别针/拖拽/粘贴截图)在位');
  ok(/【附件 · /.test(uiSrc8) && /request \+ _attTxt/.test(uiSrc8) && /images: _imgs,/.test(uiSrc8), 'H8 发送链路(文本内联+图片走视觉)');
  ok(/【曾附图 /.test(uiSrc8), 'H8 线程持久化剥像素(localStorage 体量)');

  // ───────── H9 · 会话体系(CC sessions 对照·会话绑剧本·切会话即切剧本) ─────────
  console.log('— H9 会话体系 —');
  var app9 = { state: { currentProjectId: 'p1', scenario: { name: '甲剧本' } }, applyImportedScenario: function () {},
    loadProjectSnapshot: function (id) { app9._loaded = id; if (id === 'p2') { app9.state.currentProjectId = 'p2'; app9.state.scenario = { name: '乙剧本' }; return Promise.resolve({ id: 'p2' }); } return Promise.resolve(null); } };
  var ad9 = AA.makeResetEditorAdapter({ TM_SCENARIO_EDITOR_RESET_APP: app9 });
  ok(ad9.getFileKey() === 'proj:p1' && ad9.getFileLabel() === '甲剧本', 'H9 工坊适配器 fileKey=proj:<案卷id>(改名不漂移)');
  var same9 = await ad9.openFile('proj:p1');
  ok(same9 === true && app9._loaded === undefined, 'H9 openFile 同键快路(不动案卷库)');
  var sw9 = await ad9.openFile('proj:p2');
  ok(sw9 === true && app9._loaded === 'p2' && ad9.getFileKey() === 'proj:p2' && ad9.getFileLabel() === '乙剧本', 'H9 openFile 跨案卷真载入(切会话即切剧本)');
  ok((await ad9.openFile('proj:nope')) === false, 'H9 案卷不存在→false(UI 降级只读回看不误绑)');
  app9.state.currentProjectId = null;
  ok(ad9.getFileKey() === 'name:乙剧本', 'H9 未入库剧本弱键 name:<剧本名>');
  var adL9 = AA.makeOldEditorAdapter({ TM: { legacyEditorDocument: { id: 'current-load' } }, scriptData: { name: '丙' }, saveScript: function () {} });
  ok(adL9.getFileKey() === 'legacy:current-load' && (await adL9.openFile(adL9.getFileKey())) === true && (await adL9.openFile('file:丙')) === false && (await adL9.openFile('legacy:other-load')) === false, 'H9 旧编辑器仅同加载键命中·同名旧弱键不证明身份');
  var uiSrc9 = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(uiSrc9.indexOf("'tm_aa_sessions'") >= 0 && uiSrc9.indexOf("'tm_aa_sessbody_'") >= 0 && uiSrc9.indexOf("'tm_aa_sess_active'") >= 0
    && 'tm_aa_sess_active'.indexOf('tm_aa_sessbody_') !== 0, 'H9 UI:索引/正文/指针三键分立(指针不带正文前缀·evict 不误清)');
  ok(/ui\.adapter\.openFile\(meta\.fileKey\)\.then/.test(uiSrc9) && /只读回看/.test(uiSrc9), 'H9 UI:切会话先切剧本·打不开降级只读回看');
  ok(/_renderConversation\(body\.conversation, (cand|meta)\)/.test(uiSrc9) && /function _rawReq/.test(uiSrc9), 'H9 UI:恢复/切换都回放正文(玩家原话提取)');
  ok(/_migrateLegacyThread/.test(uiSrc9) && /localStorage\.removeItem\(THREAD_KEY\)/.test(uiSrc9), 'H9 UI:旧单线程一次性迁移成会话');
  ok(/ptr\.fileKey === fk && !ptr\.sessId/.test(uiSrc9), 'H9 UI:「新对话」指针置空→开面板不拉回旧线程(CC --continue 语义)');
  ok(/SESS_BODY_KEEP = 10/.test(uiSrc9) && /_evictSessBodies/.test(uiSrc9), 'H9 UI:正文只保最新10条(quota·索引留档卡)');
  ok(/data-sess=/.test(uiSrc9) && /ri-del/.test(uiSrc9) && /ri-ren/.test(uiSrc9) && /ri-file/.test(uiSrc9) && /清空会话/.test(uiSrc9), 'H9 UI:侧栏会话列表(切换/删除/重命名/跨剧本徽记)');
  ok(/renameSession: renameSession/.test(uiSrc9) && /\(old && old\.title\) \|\|/.test(uiSrc9), 'H9 UI:玩家改名压过自动标题(CC custom-title 对照)');

  // ───────── H10 · / 命令面板(CC slash commands 对照) ─────────
  console.log('— H10 / 命令面板 —');
  var uiSrcA = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/id="tm-aa-cmdpop"/.test(uiSrcA) && /cmdpop: panel\.querySelector\('#tm-aa-cmdpop'\)/.test(uiSrcA), 'H10 命令面板 DOM+els 在位');
  var defs10 = (uiSrcA.match(/\{ k: '[^']+', t: '[^']+'/g) || []).length;
  ok(defs10 >= 14, 'H10 命令表≥14 条(实 ' + defs10 + ')');
  ok(/k: 'new', t: '新对话'/.test(uiSrcA) && /k: 'perm-plan', t: '权限·问策'/.test(uiSrcA) && /k: 'theme', t: '切换主题'/.test(uiSrcA), 'H10 新对话/权限/主题等命令齐');
  ok(/ui\.els\.req\.value = pq\.arg \|\| '';/.test(uiSrcA), 'H10 「/命令 参数」参数回填输入框(CC 带参命令)');
  ok(/!ui\._atActive && !ui\._cmdActive/.test(uiSrcA), 'H10 面板激活时 Enter 不误发送(执行命令)');
  ok(/\(ev\.ctrlKey \|\| ev\.metaKey\) && \(ev\.key === 'k'/.test(uiSrcA), 'H10 Ctrl/⌘+K 唤起(dock「⌘K 命令」提示成真)');
  ok(/requestAnimationFrame\(place\)/.test(uiSrcA) && /#tm-aa-atpop\.below,#tm-aa-cmdpop\.below/.test(uiSrcA), 'H10 浮层上下自适应(rAF 复测·@与/同治空态飞出屏外)');
  ok(/_plusAct\(act\);\n    \}\);/.test(uiSrcA.replace(/\r/g, '')) && /run: function \(\) \{ _plusAct\('review'\); \}/.test(uiSrcA), 'H10 ＋菜单与面板共用 _plusAct 派发(零新行为)');

  // ───────── H11 · 会话分叉+AI 自动标题(CC /branch + ai-title 对照) ─────────
  console.log('— H11 分叉与自动标题 —');
  var uiSrcB = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/function forkSession/.test(uiSrcB) && /'·分支'/.test(uiSrcB) && /switchSession\(nid\)/.test(uiSrcB), 'H11 分叉=正文快照复制新会话+切换过去');
  ok(/ri-fork/.test(uiSrcB) && /k: 'fork', t: '分叉会话'/.test(uiSrcB) && /forkSession: forkSession/.test(uiSrcB), 'H11 侧栏⎇按钮+/分叉会话命令+导出');
  ok(/无从分叉/.test(uiSrcB) && /分叉失败/.test(uiSrcB), 'H11 无正文/quota 满两条失败路都有话讲');
  ok(/function _autoTitle/.test(uiSrcB) && /name: 'setTitle'/.test(uiSrcB) && /if \(!old\) _autoTitle\(id, request, meta\.summary\);/.test(uiSrcB), 'H11 新会话首存后异步起题(结构化 setTitle 小调用)');
  ok(/cfg\.model2 && cfg\.model2 !== cfg\.model/.test(uiSrcB), 'H11 起题优先走次要模型(便宜活给便宜模型)');
  ok(/m\.titleKind !== 'custom'/.test(uiSrcB) && /m\.titleKind = 'custom'/.test(uiSrcB), 'H11 玩家改名 titleKind=custom·AI 标题绝不覆盖(CC custom-title 层级)');
  ok(/if \(!cfg\.key \|\| !cfg\.url\) return;/.test(uiSrcB), 'H11 未配 API 静默跳过(标题保持首句·零打扰)');

  // ───────── H12 · 约定分层(CC CLAUDE.md 层级对照：全局+本剧本) ─────────
  console.log('— H12 约定分层 —');
  var uiSrcC = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/tm_aa_conv_s::/.test(uiSrcC) && /_scenConvKey\(\) \{ return 'tm_aa_conv_s::' \+ _fileKey\(\); \}/.test(uiSrcC), 'H12 本剧本约定按 fileKey 分键(绍宋文风不灌天启)');
  ok(/【全局约定·所有剧本通用】/.test(uiSrcC) && /【本剧本约定·仅当前剧本】/.test(uiSrcC), 'H12 两层合并注入(带层级标头)');
  var convSites = (uiSrcC.match(/conventions: _convForRun\(\),/g) || []).length;
  ok(convSites >= 7, 'H12 全部 7 个运行入口注入两层约定(实 ' + convSites + ')');
  ok(/rememberConvention\(conv\)/.test(uiSrcC) && /已记住 ✓（本剧本）/.test(uiSrcC), 'H12 「记住」默认落本剧本层(CC 记进项目 CLAUDE.md 同款)');
  ok(/function showConventionsUI/.test(uiSrcC) && /k: 'conv', t: '创作约定'/.test(uiSrcC) && /tm-aa-conv-clear/.test(uiSrcC), 'H12 /创作约定 两层透视卡+清空本剧本(CC /memory 对照)');
  ok(/rememberConvention: rememberConvention/.test(uiSrcC), 'H12 rememberConvention 导出(e2e 可驱动)');

  // ───────── H13 · Codex 面吸收：/压缩前情·上下文余量·/初始化约定·完成通知 ─────────
  console.log('— H13 Codex 面吸收 —');
  var _sumTxt = '①用户请求：补两名文官并规范势力名。②已完成：新增袁可立、毕自严，东林→东林党。③任务表：无未完项。④关键事实：characters 需 faction 字段挂 id。⑤错误与修正：一次 id 漏挂已补。⑥进行中：无。⑦下一步：等用户新需求。' + new Array(40).join('摘要正文补足字符');
  var _oldFetch13 = global.fetch;
  global.fetch = function () { return Promise.resolve(jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: '', tool_calls: [{ id: 't1', function: { name: 'submitSummary', arguments: JSON.stringify({ summary: _sumTxt }) } }] } }] })); };
  var conv13 = [];
  for (var ci13 = 0; ci13 < 10; ci13++) conv13.push({ role: ci13 % 2 ? 'assistant' : 'user', text: '第' + ci13 + '条·' + new Array(60).join('内容'), toolCalls: [] });
  var rc13 = await AA.compactConversation(conv13, AA.makeDraft({ name: '甲' }), { cfg: { url: 'https://api.x.com', key: 'k', model: 'm' } });
  ok(rc13 && rc13.ok === true && rc13.after < rc13.before && /【前情摘要·上下文已压缩】/.test(rc13.conversation[0].text), 'H13 手动压缩：N 条→摘要头+近尾(真走 caller 管线)');
  global.fetch = function () { return Promise.resolve(jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: '太薄', tool_calls: [] } }] })); };
  var rc13b = await AA.compactConversation(conv13, AA.makeDraft({ name: '甲' }), { cfg: { url: 'https://api.x.com', key: 'k', model: 'm' } });
  ok(rc13b && rc13b.ok === false && rc13b.reason === 'thin', 'H13 摘要太薄按失败处理(原对话不动)');
  var rc13c = await AA.compactConversation([{ role: 'user', text: '短' }], AA.makeDraft({ name: '甲' }), {});
  ok(rc13c && rc13c.ok === false && rc13c.reason === 'too-small', 'H13 对话太短不压');
  global.fetch = _oldFetch13;
  var agSrcD = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent.js'), 'utf8');
  ok(/_macroSummaryAsk/.test(agSrcD) && /_macroHead/.test(agSrcD) && (agSrcD.match(/_macroSummaryAsk\(/g) || []).length >= 3, 'H13 循环内压缩与手动压缩共用同套文案构件(勿漂移)');
  ok(/budget: maxTokens/.test(agSrcD) && /recordConvention: 1, };?/.test(agSrcD.replace(/\};/g, '}, };')) || (/budget: maxTokens/.test(agSrcD) && /preflight: 1, recordConvention: 1 \}/.test(agSrcD)), 'H13 onStep 带预算+审阅工具集含 recordConvention');
  var uiSrcD = require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-icons.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8') + require('fs').readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui-render.js'), 'utf8');
  ok(/上下文余 /.test(uiSrcD) && /ui\._budget = step\.budget/.test(uiSrcD), 'H13 计量条显上下文余量%(Codex context-left 对照)');
  ok(/k: 'compact', t: '压缩前情'/.test(uiSrcD) && /AA\.compactConversation\(ui\.conversation/.test(uiSrcD), 'H13 /压缩前情 命令接手动压缩');
  ok(/k: 'initconv', t: '初始化约定'/.test(uiSrcD) && /_renderConvSuggest\(res\.suggestedConventions\)/.test(uiSrcD), 'H13 /初始化约定(Codex /init 对照)+审阅尾记住签');
  ok(/k: 'notify', t: '完成通知'/.test(uiSrcD) && /document\.hidden/.test(uiSrcD) && /dur < 12/.test(uiSrcD), 'H13 完成通知(切后台才弹·快跑不扰)');

  // ───────── H14 · 压缩保用户原话(Codex COMPACT_USER_MESSAGE 对照) ─────────
  console.log('— H14 压缩保用户原话 —');
  global.fetch = function () { return Promise.resolve(jsonResponse({ choices: [{ finish_reason: 'stop', message: { content: '', tool_calls: [{ id: 't1', function: { name: 'submitSummary', arguments: JSON.stringify({ summary: _sumTxt }) } }] } }] })); };
  var conv14 = [
    { role: 'user', text: '【用户需求】\n给东林补两个能干的文官\n\n【草稿现状】\n（很长的构建附文·不该进原话）\n\n开始：先按需 getField 查看。' },
    { role: 'assistant', text: '好', toolCalls: [] },
    { role: 'user', text: '【前情摘要·上下文已压缩】旧摘要头·非玩家原话' },
    { role: 'user', text: '【追加需求】\n毕自严补一段小传\n（在上面已改的草稿基础上继续；需要时可复查。）' },
    { role: 'assistant', text: '好', toolCalls: [] },
    { role: 'user', text: '（预算提示：已用约 72%·剩余有限。）' },
    { role: 'user', text: '再把势力名规范为全称' },
    { role: 'assistant', text: '好', toolCalls: [] },
    { role: 'assistant', text: '尾1', toolCalls: [] },
    { role: 'assistant', text: '尾2', toolCalls: [] }
  ];
  var rc14 = await AA.compactConversation(conv14, AA.makeDraft({ name: '甲' }), { cfg: { url: 'https://api.x.com', key: 'k', model: 'm' }, keepTail: 2 });
  var head14 = rc14 && rc14.ok ? rc14.conversation[0].text : '';
  ok(/【用户各轮原话·逐字保留/.test(head14), 'H14 压缩头带「用户各轮原话」段');
  ok(/给东林补两个能干的文官/.test(head14) && /毕自严补一段小传/.test(head14) && /再把势力名规范为全称/.test(head14), 'H14 三轮玩家原话逐字保留(时间序)');
  ok(head14.indexOf('很长的构建附文') < 0 && head14.indexOf('在上面已改的草稿基础上') < 0, 'H14 构建附文(草稿现状/续接指令)被剥·只留原话');
  ok(head14.indexOf('旧摘要头') < 0 && head14.indexOf('预算提示：已用约') < 0, 'H14 注入类 user 消息(旧摘要头/预算提示)不当原话');
  global.fetch = _oldFetch13;

  console.log('\nPASS · ' + pass + ' 断言');
})().catch(function (e) { console.error(e); process.exit(1); });
