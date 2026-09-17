#!/usr/bin/env node
'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const refAt = process.argv.indexOf('--source-ref'), sourceRef = refAt < 0 ? null : process.argv[refAt + 1];
const files = ['web/editor-authoring-agent-provider.js', 'web/editor-authoring-agent.js'];
const sources = files.map(f => [f, sourceRef ? cp.execFileSync('git', ['show', sourceRef + ':' + f], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, f), 'utf8')]);
const cfg = { url: 'https://authoring.invalid/v1', key: 'isolated-regression-only', model: 'controlled', temp: 0.2 };
const tool = (name, input, index = 0) => ({ index, id: 'call-' + index, type: 'function', function: { name, arguments: JSON.stringify(input) } });
const json = (name = 'finish', input = { summary: '完成' }) => ({ choices: [{ message: { content: '核对完毕', tool_calls: [tool(name, input)] }, finish_reason: 'tool_calls' }] });
const frame = d => 'data: ' + JSON.stringify(d) + '\n\n';
const event = (type, data) => 'event: ' + type + '\n' + frame({ type, ...data });
const oa = (name = 'finish', input = { summary: '完成' }, extra = '') => frame({ id: 'chatcmpl-test', choices: [{ index: 0, delta: { tool_calls: [tool(name, input)] }, finish_reason: null }] }) + extra + frame({ choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }] }) + 'data: [DONE]\n\n';
function response(text, contentType = 'text/event-stream', chunkSize = 13) {
  const bytes = new TextEncoder().encode(text); let at = 0;
  return new Response(new ReadableStream({ pull(c) { if (at >= bytes.length) return c.close(); c.enqueue(bytes.slice(at, at + chunkSize)); at += chunkSize; } }), { headers: { 'Content-Type': contentType } });
}
function fixture(fetcher) {
  const c = { console, Date, Math, JSON, Promise, Map, Set, WeakMap, AbortController, TextDecoder, TextEncoder, Uint8Array, Response, ReadableStream, Headers, setTimeout, clearTimeout, fetch: fetcher };
  c.window = c; vm.createContext(c); sources.forEach(([file, source]) => vm.runInContext(source, c, { filename: file }));
  return { c, aa: c.TM.AuthoringAgent, provider: c.TM.__aaParts, call(options = {}) { return c.TM.AuthoringAgent.callWithTools('隔离测试', [{ name: 'finish', parameters: { type: 'object' } }], { cfg, maxRetries: 0, retryBaseMs: 1, ...options }); } };
}
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
(async () => {
  await test('normal JSON tool and final summary remain unchanged', async () => {
    const f = fixture(async () => response(JSON.stringify(json()), 'application/json')), r = await f.call();
    assert.equal(r.toolCalls[0].name, 'finish'); assert.equal(r.toolCalls[0].input.summary, '完成');
  });
  await test('OpenAI SSE final tool reaches the existing parser', async () => {
    const r = await fixture(async () => response(oa())).call(); assert.equal(r.toolCalls[0].name, 'finish'); assert.equal(r.toolCalls[0].input.summary, '完成');
  });
  await test('JSON and SSE are recognized by actual body, not mislabeled content type', async () => {
    for (const header of ['application/json', 'text/plain', '']) { const r = await fixture(async () => response(oa(), header)).call(); assert.equal(r.toolCalls.length, 1); }
    const r = await fixture(async () => response(JSON.stringify(json()))).call(); assert.equal(r.toolCalls[0].name, 'finish');
  });
  await test('fragmented and interleaved tool arguments keep indices and Chinese Unicode intact', async () => {
    const a = JSON.stringify({ path: 'name', value: '新剧本😀e\u0301' }), b = JSON.stringify({ summary: '改名完成' });
    const raw = '\uFEFF: keepalive\r\nevent: message\r\n' + frame({ choices: [{ index: 0, delta: { content: '核办', tool_calls: [tool('applyEdit', {}, 0), tool('finish', {}, 1)].map(t => ({ ...t, function: { ...t.function, arguments: '' } })) } }] }).replace(/\n/g, '\r\n')
      + frame({ choices: [{ index: 0, delta: { tool_calls: [{ index: 1, function: { arguments: b.slice(0, 9) } }, { index: 0, function: { arguments: a.slice(0, 12) } }] } }] })
      + frame({ choices: [{ index: 0, delta: { tool_calls: [{ index: 0, function: { arguments: a.slice(12) } }, { index: 1, function: { arguments: b.slice(9) } }] }, finish_reason: 'tool_calls' }] })
      + frame({ choices: [], usage: { total_tokens: 15 } }) + 'data: [DONE]';
    const r = await fixture(async () => response(raw, 'text/event-stream', 1)).call();
    assert.equal(r.text, '核办'); assert.equal(r.toolCalls.length, 2); assert.equal(r.toolCalls[0].input.value, '新剧本😀e\u0301'); assert.equal(r.toolCalls[1].input.summary, '改名完成');
  });
  await test('SSE multiline data fields are assembled as one event', async () => {
    const raw = 'event: message\ndata: {"choices":\ndata: [{"index":0,"delta":{"content":"已核对"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
    const r = await fixture(async () => response(raw)).call(); assert.equal(r.text, '已核对'); assert.equal(r.toolCalls.length, 0);
  });
  await test('complete SSE stops a keep-alive body without waiting for the request timeout', async () => {
    let cancelled = 0;
    const f = fixture(async () => new Response(new ReadableStream({ start(c) { c.enqueue(new TextEncoder().encode(oa())); const timer = setTimeout(() => c.close(), 90); this.stop = () => clearTimeout(timer); }, cancel() { cancelled++; this.stop(); } })));
    const r = await f.call({ timeoutMs: 40 }); assert.equal(r.toolCalls[0].name, 'finish'); assert.equal(cancelled, 1);
  });
  await test('400 text-tool fallback also accepts SSE and preserves tool arguments', async () => {
    let n = 0;
    const f = fixture(async () => ++n === 1 ? new Response('tools unsupported', { status: 400 }) : response(frame({ choices: [{ delta: { content: JSON.stringify({ tool_calls: [{ name: 'finish', input: { summary: '文本回退完成' } }] }) }, finish_reason: 'stop' }] }) + 'data: [DONE]\n\n'));
    const r = await f.call(); assert.equal(n, 2); assert(r.fallback); assert.equal(r.toolCalls[0].input.summary, '文本回退完成');
  });
  await test('Anthropic JSON and fragmented SSE preserve text/tool/finish semantics', async () => {
    const body = { content: [{ type: 'tool_use', id: 'tu-1', name: 'finish', input: { summary: '完成' } }], stop_reason: 'tool_use' };
    const raw = event('message_start', { message: { id: 'm-1', content: [] } }) + event('content_block_start', { index: 0, content_block: { type: 'tool_use', id: 'tu-1', name: 'finish', input: {} } })
      + event('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: '{"summary":' } }) + event('content_block_delta', { index: 0, delta: { type: 'input_json_delta', partial_json: '"完成"}' } })
      + event('content_block_stop', { index: 0 }) + event('message_delta', { delta: { stop_reason: 'tool_use' } }) + event('message_stop', {});
    for (const text of [JSON.stringify(body), raw]) { const r = await fixture(async () => response(text)).call({ cfg: { ...cfg, url: 'https://api.anthropic.com/v1/messages' } }); assert.equal(r.toolCalls[0].input.summary, '完成'); }
  });
  await test('Gemini JSON and SSE preserve complete function calls', async () => {
    const body = { candidates: [{ content: { parts: [{ text: '核办完成' }, { functionCall: { name: 'finish', args: { summary: '完成' } } }] }, finishReason: 'STOP' }] };
    for (const text of [JSON.stringify(body), frame(body)]) { const r = await fixture(async () => response(text)).call({ cfg: { ...cfg, url: 'https://generativelanguage.googleapis.com/v1beta' } }); assert.equal(r.toolCalls[0].input.summary, '完成'); }
  });
  await test('truncated response preserves retry metadata and cannot execute an apparently complete prefix', async () => {
    for (const raw of [frame({ choices: [{ delta: { tool_calls: [tool('applyEdit', { path: 'name', value: '不得执行' })] }, finish_reason: 'length' }] }) + 'data: [DONE]\n\n', JSON.stringify({ ...json('applyEdit', { path: 'name', value: '不得执行' }), choices: [{ message: { tool_calls: [tool('applyEdit', { path: 'name', value: '不得执行' })] }, finish_reason: 'length' }] })]) {
      const r = await fixture(async () => response(raw)).call(); assert(r.truncated); assert.equal(r.toolCalls.length, 0);
    }
  });
  await test('truncated text fallback retains its flags instead of inventing a finish', async () => {
    let n = 0; const f = fixture(async () => ++n === 1 ? new Response('tools unsupported', { status: 400 }) : response(frame({ choices: [{ delta: { content: '{"tool_calls":[' }, finish_reason: 'length' }] }) + 'data: [DONE]\n\n'));
    const r = await f.call(); assert(r.truncated); assert.equal(r.toolCalls.length, 0); assert.equal(n, 2);
  });
  for (const [name, raw] of [
    ['missing completion', frame({ choices: [{ delta: { tool_calls: [tool('applyEdit', { path: 'name', value: '不得执行' })] } }] })],
    ['malformed later event', oa().replace('data: [DONE]', 'data: { broken }\n\ndata: [DONE]')],
    ['malformed tool arguments', frame({ choices: [{ delta: { tool_calls: [tool('applyEdit', { path: 'name', value: '不得执行' }), { ...tool('finish', {}, 1), function: { name: 'finish', arguments: '{bad' } }] }, finish_reason: 'tool_calls' }] }) + 'data: [DONE]\n\n'],
    ['provider error event', frame({ error: { message: 'PRIVATE-CONTENT-MUST-NOT-LEAK', type: 'invalid_request_error' } }) + 'data: [DONE]\n\n'],
    ['empty stream', ': keepalive\n\ndata: [DONE]\n\n']
  ]) await test(name + ' fails closed with an explicit response error, not a raw payload', async () => {
    let count = 0; const f = fixture(async () => { count++; return response(raw); });
    await assert.rejects(() => f.call({ maxRetries: 2, retryBaseMs: 1 }), e => /^authoring-response-/.test(e.code || '') && !e.message.includes('PRIVATE-CONTENT') && !e.message.includes('{bad'));
    assert.equal(count, name === 'provider error event' ? 1 : 2, 'one bounded full-response recovery only; never multiply network retries or execute a prefix');
  });
  await test('cancellation after headers cancels body reading and returns no executable tools', async () => {
    const ctrl = new AbortController(); let cancelled = 0;
    const f = fixture(async () => new Response(new ReadableStream({ start(c) { const t = setTimeout(() => { c.enqueue(new TextEncoder().encode(oa())); c.close(); }, 60); this.stop = () => clearTimeout(t); }, cancel() { cancelled++; this.stop(); } })));
    const p = f.call({ signal: ctrl.signal }); setTimeout(() => ctrl.abort('player-stop'), 8);
    await assert.rejects(() => p, e => e.aborted === true); assert.equal(cancelled, 1);
  });
  await test('request deadline covers the response body, not only response headers', async () => {
    let cancelled = 0;
    const f = fixture(async () => new Response(new ReadableStream({ start(c) { const t = setTimeout(() => { c.enqueue(new TextEncoder().encode(oa())); c.close(); }, 65); this.stop = () => clearTimeout(t); }, cancel() { cancelled++; this.stop(); } })));
    await assert.rejects(() => f.call({ timeoutMs: 8, maxRetries: 0 }), e => e.transient === true); assert.equal(cancelled, 1);
  });
  await test('concurrent responses do not share tool fragments or final summaries', async () => {
    let n = 0; const f = fixture(async () => response(oa('finish', { summary: '结果-' + (++n) }), 'text/event-stream', 3));
    const rs = await Promise.all([f.call(), f.call()]); assert.deepEqual(rs.map(r => r.toolCalls[0].input.summary).sort(), ['结果-1', '结果-2']);
  });
  await test('existing HTTP retry cap and non-retryable authentication behavior remain enforced', async () => {
    let n = 0; const f = fixture(async () => ++n < 3 ? new Response('temporary', { status: n === 1 ? 429 : 503 }) : response(oa()));
    const r = await f.call({ maxRetries: 2 }); assert.equal(n, 3); assert.equal(r.toolCalls[0].name, 'finish');
    n = 0; f.c.fetch = async () => { n++; return new Response('unauthorized', { status: 401 }); };
    await assert.rejects(() => f.call({ maxRetries: 3 }), e => e.status === 401); assert.equal(n, 1);
  });
  await test('39-round real provider/agent loop reaches finish, retains edit and preserves original scenario', async () => {
    let n = 0;
    const f = fixture(async () => { n++; return response(n === 39 ? oa('finish', { summary: '财政与地区设定已修改' }) : JSON.stringify(n === 38 ? json('applyEdit', { path: 'name', value: '新剧本名' }) : json('getField', { path: 'auditFields.f'+n })), n === 39 ? 'text/event-stream' : 'application/json'); });
    // 39轮协议回归模拟37项不同核查；重复同参空转另由效率专项拦截，不能为本测试关闭该保护。
    const original = { name: '原剧本名', factions: [], characters: [], auditFields:Object.fromEntries(Array.from({length:37},(_,i)=>['f'+(i+1),i])) }, draft = f.aa.makeDraft(original);
    const r = await f.aa.runAuthoringLoop(draft, '改名', { cfg, maxIterations: 40, maxTokens: 1000000, noMemoryRecall: true, conventions: '', caller: (c, t, o) => f.aa.callWithTools(c, t, { ...o, maxRetries: 0 }) });
    assert(r.finished); assert.equal(r.stopReason, 'finish'); assert.equal(r.summary, '财政与地区设定已修改'); assert.equal(draft.name, '新剧本名'); assert.equal(original.name, '原剧本名'); assert.equal(n, 39);
    const diffs = f.aa.computeDiff(original, draft), committed = f.aa.applySelectedDiffs(original, draft, diffs); assert.equal(committed.name, '新剧本名'); assert.equal(original.name, '原剧本名');
  });
  console.log(JSON.stringify({ sourceRef, pass, fail, skip: 0, waived: 0 })); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
