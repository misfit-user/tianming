#!/usr/bin/env node
/* eslint-env node */
'use strict';
// smoke-guoshi-stream — 国师「实时显示」（2026-10-15 国师重做 S4）：
//   请求真流式、收流时旁听增量交给界面先显示；旁听只读、出错闭嘴，工具执不执行、执行什么仍以收齐后的完整解析为准。
//   中转不认流式（400 提到 stream / 事件流协议对不上）→ 关掉流式整段重取一次，不进文本兜底；loop 记着余下几轮不再开。
//   界面：设置·偏好可关；线路不认时记下；收尾说明在预览卡里成形，正式卡不重放打字机；三堂会审两官并行审时不实时显示。
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const web = path.join(__dirname, '..');
const sources = ['editor-authoring-agent-provider.js', 'editor-authoring-agent.js'].map(f => [f, fs.readFileSync(path.join(web, f), 'utf8')]);
const ui = fs.readFileSync(path.join(web, 'editor-authoring-agent-ui.js'), 'utf8');
const core = sources[1][1];
const cfgOA = { url: 'https://authoring.invalid/v1', key: 'isolated-regression-only', model: 'controlled', temp: 0.2 };
const cfgAN = { url: 'https://api.anthropic.com', key: 'isolated-regression-only', model: 'claude-controlled' };
const cfgGM = { url: 'https://generativelanguage.googleapis.com/v1beta', key: 'isolated-regression-only', model: 'gemini-controlled' };
const frame = d => 'data: ' + JSON.stringify(d) + '\n\n';
const ev = (type, data) => 'event: ' + type + '\n' + frame({ type, ...data });
function response(text, chunkSize = 7, init = {}) {
  const bytes = new TextEncoder().encode(text); let at = 0;
  return new Response(new ReadableStream({ pull(c) { if (at >= bytes.length) return c.close(); c.enqueue(bytes.slice(at, at + chunkSize)); at += chunkSize; } }), Object.assign({ headers: { 'Content-Type': 'text/event-stream' } }, init));
}
function fixture(fetcher) {
  const c = { console, Date, Math, JSON, Promise, Map, Set, WeakMap, AbortController, TextDecoder, TextEncoder, Uint8Array, Response, ReadableStream, Headers, setTimeout, clearTimeout, fetch: fetcher };
  c.window = c; vm.createContext(c); sources.forEach(([file, source]) => vm.runInContext(source, c, { filename: file }));
  const tools = [{ name: 'applyEdit', parameters: { type: 'object' } }, { name: 'finish', parameters: { type: 'object' } }];
  return { aa: c.TM.AuthoringAgent, call(cfg, options = {}) { return c.TM.AuthoringAgent.callWithTools('隔离测试', tools, { cfg, maxRetries: 0, retryBaseMs: 1, ...options }); } };
}
// 一段 OpenAI 事件流：想法 → 话 → 两个工具（参数交错分片）→ 收尾 → 用量 → DONE
const argA = JSON.stringify({ path: 'characters.3.officialTitle', value: '督师蓟辽😀' }), argB = JSON.stringify({ summary: '改了「袁崇焕」的官职。\n月份待核。' });
const OA = frame({ choices: [{ index: 0, delta: { role: 'assistant', reasoning_content: '先查' } }] })
  + frame({ choices: [{ index: 0, delta: { reasoning_content: '再改。' } }] })
  + frame({ choices: [{ index: 0, delta: { content: '袁崇焕' } }] })
  + 'event: message\ndata: {"choices":[{"index":0,\ndata: "delta":{"content":"的官职"}}]}\n\n'   // 多行 data
  + frame({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: 'a', type: 'function', function: { name: 'applyEdit', arguments: '' } }, { index: 1, id: 'b', type: 'function', function: { name: 'finish', arguments: '' } }] } }] })
  + frame({ choices: [{ index: 0, delta: { tool_calls: [{ index: 1, function: { arguments: argB.slice(0, 11) } }, { index: 0, function: { arguments: argA.slice(0, 15) } }] } }] })
  + frame({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: argA.slice(15) } }, { index: 1, function: { arguments: argB.slice(11) } }] } }] })
  + frame({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] })
  + frame({ choices: [], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } }) + 'data: [DONE]\n\n';
function collect() {
  const evs = [];
  const fn = e => evs.push(e);
  fn.evs = evs;
  fn.join = kind => evs.filter(e => e.kind === kind).map(e => e.text).join('');
  fn.args = idx => evs.filter(e => e.kind === 'args' && String(e.index) === String(idx)).map(e => e.text).join('');
  return fn;
}
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('  ✓ ' + name); } catch (e) { fail++; console.log('  ✗ FAIL: ' + name + '\n' + e.stack); } }
console.log('smoke-guoshi-stream');
(async () => {
  await test('OpenAI 兼容：opts.stream 才请求流式（带用量），不传则与原来一样', async () => {
    const bodies = [];
    const f = fixture(async (url, o) => { bodies.push(JSON.parse(o.body)); return response(OA); });
    await f.call(cfgOA, { stream: true });
    await f.call(cfgOA);
    assert.equal(bodies[0].stream, true); assert.deepEqual(bodies[0].stream_options, { include_usage: true });
    assert.equal(bodies[1].stream, undefined); assert.equal(bodies[1].stream_options, undefined);
  });
  await test('旁听：想法、话、工具名、参数按序到达，逐字节切开也拼得回原样', async () => {
    const on = collect();
    const r = await fixture(async () => response(OA, 1)).call(cfgOA, { stream: true, onDelta: on });
    assert.equal(on.evs[0].kind, 'reset');
    assert.equal(on.join('think'), '先查再改。'); assert.equal(on.join('text'), '袁崇焕的官职');
    assert.deepEqual(on.evs.filter(e => e.kind === 'tool').map(e => e.name), ['applyEdit', 'finish']);
    assert.equal(on.args(0), argA); assert.equal(on.args(1), argB);
    // 最终解析不受旁听影响
    assert.equal(r.text, '袁崇焕的官职'); assert.equal(r.toolCalls.length, 2);
    assert.equal(r.toolCalls[0].input.value, '督师蓟辽😀'); assert.equal(r.toolCalls[1].input.summary, '改了「袁崇焕」的官职。\n月份待核。');
    assert.equal(r.usage.totalTokens, 15); assert.equal(r.reasoningContent, '先查再改。');
  });
  await test('漏写事件间空行、CRLF 换行的中转也能实时旁听', async () => {
    const raw = OA.split('\n\n').filter(Boolean).filter(x => !/^event:/.test(x)).map(x => x + '\r\n').join('');
    const on = collect();
    const r = await fixture(async () => response(raw, 5)).call(cfgOA, { stream: true, onDelta: on });
    assert.equal(on.join('think'), '先查再改。'); assert.equal(on.args(1), argB); assert.equal(r.toolCalls.length, 2);
  });
  await test('界面回调抛错不影响结果', async () => {
    const r = await fixture(async () => response(OA, 3)).call(cfgOA, { stream: true, onDelta: () => { throw new Error('界面坏了'); } });
    assert.equal(r.toolCalls.length, 2); assert.equal(r.toolCalls[1].input.summary, '改了「袁崇焕」的官职。\n月份待核。');
  });
  await test('中转无视流式、回整段 JSON：不旁听，照常解析', async () => {
    const on = collect();
    const json = JSON.stringify({ choices: [{ message: { content: '整段', tool_calls: [{ id: 'x', type: 'function', function: { name: 'finish', arguments: argB } }] }, finish_reason: 'tool_calls' }] });
    const r = await fixture(async () => response(json, 4, { headers: { 'Content-Type': 'application/json' } })).call(cfgOA, { stream: true, onDelta: on });
    assert.deepEqual(on.evs.map(e => e.kind), ['reset']); assert.equal(r.text, '整段'); assert.equal(r.toolCalls[0].name, 'finish');
  });
  await test('Anthropic：请求流式；想法、话、工具参数都旁听得到', async () => {
    const bodies = [], on = collect();
    const raw = ev('message_start', { message: { usage: { input_tokens: 9 } } })
      + ev('content_block_start', { index: 0, content_block: { type: 'thinking', thinking: '' } })
      + ev('content_block_delta', { index: 0, delta: { type: 'thinking_delta', thinking: '想一想' } })
      + ev('content_block_delta', { index: 0, delta: { type: 'signature_delta', signature: 'sig' } })
      + ev('content_block_stop', { index: 0 })
      + ev('content_block_start', { index: 1, content_block: { type: 'text', text: '' } })
      + ev('content_block_delta', { index: 1, delta: { type: 'text_delta', text: '这就改' } })
      + ev('content_block_stop', { index: 1 })
      + ev('content_block_start', { index: 2, content_block: { type: 'tool_use', id: 't', name: 'finish', input: {} } })
      + ev('content_block_delta', { index: 2, delta: { type: 'input_json_delta', partial_json: argB.slice(0, 9) } })
      + ev('content_block_delta', { index: 2, delta: { type: 'input_json_delta', partial_json: argB.slice(9) } })
      + ev('content_block_stop', { index: 2 })
      + ev('message_delta', { delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 4 } })
      + ev('message_stop', {});
    const r = await fixture(async (url, o) => { bodies.push(JSON.parse(o.body)); return response(raw, 9); }).call(cfgAN, { stream: true, onDelta: on });
    assert.equal(bodies[0].stream, true); assert.equal(bodies[0].stream_options, undefined);
    assert.equal(on.join('think'), '想一想'); assert.equal(on.join('text'), '这就改');
    assert.deepEqual(on.evs.filter(e => e.kind === 'tool').map(e => e.name), ['finish']); assert.equal(on.args(2), argB);
    assert.equal(r.text, '这就改'); assert.equal(r.toolCalls[0].input.summary, '改了「袁崇焕」的官职。\n月份待核。');
  });
  await test('Gemini 原生不开流式（要换端点）', async () => {
    const bodies = [];
    const json = JSON.stringify({ candidates: [{ content: { parts: [{ functionCall: { name: 'finish', args: { summary: '好' } } }] }, finishReason: 'STOP' }] });
    await fixture(async (url, o) => { bodies.push(JSON.parse(o.body)); return response(json, 50, { headers: { 'Content-Type': 'application/json' } }); }).call(cfgGM, { stream: true });
    assert.equal(bodies[0].stream, undefined);
  });
  await test('中转 400 不认 stream：关掉流式整段重取一次，不进文本兜底，并告诉 loop', async () => {
    const bodies = [], on = collect();
    const json = JSON.stringify({ choices: [{ message: { content: '', tool_calls: [{ id: 'x', type: 'function', function: { name: 'finish', arguments: argB } }] }, finish_reason: 'tool_calls' }] });
    const f = fixture(async (url, o) => { const b = JSON.parse(o.body); bodies.push(b); return b.stream ? new Response('{"error":{"message":"Unrecognized request argument supplied: stream_options"}}', { status: 400 }) : response(json, 50, { headers: { 'Content-Type': 'application/json' } }); });
    const r = await f.call(cfgOA, { stream: true, onDelta: on });
    assert.equal(bodies.length, 2); assert.equal(bodies[1].stream, undefined); assert.equal(bodies[1].stream_options, undefined); assert(bodies[1].tools && bodies[1].tools.length, '仍带原生工具');
    assert.equal(r.streamOff, true); assert.notEqual(r.fallback, true); assert.equal(r.toolCalls[0].name, 'finish');
    assert(on.evs.some(e => e.kind === 'stream-off'));
  });
  await test('事件流协议对不上：同样退回整段返回', async () => {
    const bodies = [];
    const json = JSON.stringify({ choices: [{ message: { content: '整段', tool_calls: [] }, finish_reason: 'stop' }] });
    const f = fixture(async (url, o) => { const b = JSON.parse(o.body); bodies.push(b); return b.stream ? response(frame({ type: 'weird_event' }) + 'data: [DONE]\n\n') : response(json, 50); });
    const r = await f.call(cfgOA, { stream: true });
    assert.equal(bodies.length, 2); assert.equal(r.streamOff, true); assert.equal(r.text, '整段');
  });
  await test('正文传坏（不成 JSON）：仍只重取一次，不因流式再多花一次', async () => {
    let n = 0; const bodies = [];
    const f = fixture(async (url, o) => { n++; bodies.push(JSON.parse(o.body)); return response(frame({ choices: [{ delta: { content: '半' } }] }) + 'data: {invalid PRIVATE-RESPONSE}\n\ndata: [DONE]\n\n'); });
    await assert.rejects(f.call(cfgOA, { stream: true, onDelta: collect() }), e => { assert.doesNotMatch(String(e.message), /PRIVATE-RESPONSE/); return true; });
    assert.equal(n, 2, '原请求 + 一次重取'); assert.equal(bodies[1].stream, true, '重取时不改传输方式');
  });
  await test('界面：流式回复被传坏时，错误卡给一键关掉实时显示', async () => {
    assert.match(ui, /if \(_streamOn\(\) && \(\/\^authoring-response-\(invalid-json\|incomplete-stream\|invalid-event\)\$\/\.test\(ecode\)/);
    assert.match(ui, /ec-stream-off'\)\.addEventListener\('click', function \(\) \{ _setStreamPref\(false\);/);
  });
  await test('其它 400 照旧走文本兜底（不误判成流式问题）', async () => {
    let n = 0;
    const f = fixture(async () => ++n === 1 ? new Response('tools unsupported', { status: 400 }) : response(frame({ choices: [{ delta: { content: JSON.stringify({ tool_calls: [{ name: 'finish', input: { summary: '文本回退完成' } }] }) }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n'));
    const r = await f.call(cfgOA, { stream: true, onDelta: collect() });
    assert.equal(n, 2); assert(r.fallback); assert.notEqual(r.streamOff, true); assert.equal(r.toolCalls[0].input.summary, '文本回退完成');
  });
  await test('loop：主调用带 stream/onDelta，每问收完发 done；线路不认后余下几轮不再开', async () => {
    const f = fixture(async () => { throw new Error('unexpected transport'); });
    const seen = [], on = collect(); let n = 0;
    const seq = [{ text: '先看', toolCalls: [{ id: '1', name: 'getField', input: { path: 'name' } }], streamOff: true }, { text: '', toolCalls: [{ id: '2', name: 'applyEdit', input: { path: 'name', value: '新' } }] }, { text: '', toolCalls: [{ id: '3', name: 'finish', input: { summary: '完成' } }] }];
    const r = await f.aa.runAuthoringLoop(f.aa.makeDraft({ name: '原' }), '改名', { cfg: cfgOA, noMemoryRecall: true, conventions: '', maxIterations: 8, maxTokens: 1000000, stream: true, onDelta: on,
      caller: async (conv, tools, o) => { seen.push({ stream: o.stream, onDelta: typeof o.onDelta }); return seq[n++] || { text: '', toolCalls: [{ id: 'z', name: 'finish', input: { summary: '完成' } }] }; } });
    assert(r.finished, '跑完');
    assert.deepEqual(seen[0], { stream: true, onDelta: 'function' });
    assert.deepEqual(seen[1], { stream: false, onDelta: 'undefined' });
    assert.equal(on.evs.filter(e => e.kind === 'done').length, 1, '只有带 onDelta 的那一问发 done');
  });
  await test('三堂会审：史官、谏官并行审时不实时显示', async () => {
    assert.match(core, /var quiet = review \? \{ stream: false, onDelta: undefined \} : \{\};/);
    assert.match(core, /baseClean\(Object\.assign\(\{\}, extra \|\| \{\}, quiet, \{ resumeState/);
  });
  await test('抠半截参数里的字符串（转义还原，半个转义先不显示；核心一份，两个国师面板共用）', async () => {
    const fn = require(path.join(web, 'editor-authoring-agent.js')).partialJsonString;
    assert.match(ui, /function _partialJsonStr\(src, key\) \{ return AA\.partialJsonString\(src, key\); \}/);
    assert.deepEqual(fn('{"status":"completed","summary":"改了三处：\\n- **袁', 'summary'), { text: '改了三处：\n- **袁', done: false });
    assert.deepEqual(fn('{"summary":"他说\\"好\\"。"}', 'summary'), { text: '他说"好"。', done: true });
    assert.deepEqual(fn('{"answer":"\\u8881\\u5d07', 'answer'), { text: '袁崇', done: false });
    assert.deepEqual(fn('{"answer":"袁\\u5d0', 'answer'), { text: '袁', done: false });
    assert.deepEqual(fn('{"answer":"末尾\\', 'answer'), { text: '末尾', done: false });
    assert.equal(fn('{"path":"x"', 'summary'), null);
  });
  await test('界面接线：统一入口开流式、偏好可关、线路不认记下、正式卡不重放打字机', async () => {
    assert.match(ui, /if \(options\.stream == null && _streamOn\(\)\) \{/);
    assert.match(ui, /options\.stream = true; options\.onDelta = function \(ev\) \{ if \(current\(\)\) _onDelta\(ev\); \};/, '只管显示：案卷换了就不画');
    assert.match(ui, /\['onStep', 'onText', 'onSubtask', 'onCritique'\]\.forEach/, '实时显示不进「过期就中断」那组回调（中断时机留给步骤回调）');
    assert.match(ui, /function _showThinking\(\) \{ return _prefOn\('tm_aa_show_thinking', true\); \}/, '思考原文默认上屏（同志 10-16 定），偏好可关');
    assert.match(ui, /if \(s\.think\.trim\(\) && _showThinking\(\)\) \{/);
    assert.match(ui, /_swHtml\('thinking', _showThinking\(\), '显示思考原文'/);
    assert.match(ui, /function _streamOn\(\) \{ return _prefOn\('tm_aa_stream', true\) && !_streamOffMap\(\)\[_streamLineKey\(\)\]; \}/);
    assert.match(ui, /ev\.kind === 'stream-off'\) \{ _rememberStreamOff\(\);/);
    assert.match(ui, /if \(stream && ui\._liveSaid\) \{ stream = false; ui\._liveSaid = false; \}/);
    assert.match(ui, /_swHtml\('stream', _streamOn\(\), '实时显示'/);
    assert.match(ui, /else if \(id === 'stream'\) _setStreamPref\(on\);/);
    assert.match(ui, /k: 'stream', t: '实时显示'[\s\S]{0,120}_setStreamPref\(!_streamOn\(\)\)/, '命令面板也能开关');
    assert.match(ui, /function _setStreamPref\(on\) \{[\s\S]{0,200}delete m\[_streamLineKey\(\)\]/, '重开时清掉这条线路的「不支持」记号');
    assert.match(ui, /_LIVE_ANSWER_KEY = \{ finish: 'summary', submitAnswer: 'answer'/);
    assert.match(ui, /ui\._runOutcome = null; _lvClear\(true\); ui\._liveSaid = false;/);
  });
  console.log('\nsmoke-guoshi-stream ' + (fail === 0 ? 'PASS' : 'FAIL') + ' ' + pass + '/' + (pass + fail));
  process.exit(fail === 0 ? 0 : 1);
})();
