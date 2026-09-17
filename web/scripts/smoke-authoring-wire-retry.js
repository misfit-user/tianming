#!/usr/bin/env node
'use strict';
// Actual provider + execution loop. Synthetic HTTP bodies; no player data or relay credentials.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.resolve(__dirname, '../..'), at = process.argv.indexOf('--source-ref'), ref = at < 0 ? null : process.argv[at + 1];
const sources = ['tm-agent-kernel.js', 'editor-authoring-agent-provider.js', 'editor-authoring-agent.js'].map(f => [f,
  ref ? cp.execFileSync('git', ['show', ref + ':web/' + f], { cwd: root, encoding: 'utf8', maxBuffer: 8e6 }) : fs.readFileSync(path.join(root, 'web', f), 'utf8')]);
const cfg = { url: 'https://wire.invalid/v1', key: 'synthetic-only', model: 'controlled-thinking', temp: .2 };
const thought = 'PRIVATE_SYNTHETIC_REASONING';
const tool = (name, input, index = 0) => ({ index, id: 'call-' + index, type: 'function', function: { name, arguments: JSON.stringify(input) } });
const push = tool('applyPush', { path: 'labels', value: { name: 'once😀' } });
const done = tool('finish', { summary: '完整核验完成' });
const packet = calls => ({ choices: [{ message: { content: '', reasoning_content: thought, tool_calls: calls }, finish_reason: 'tool_calls' }] });
const frame = d => 'data: ' + JSON.stringify(d) + '\n\n';
const incomplete = frame({ choices: [{ index: 0, delta: { tool_calls: [push] } }] });
const stream = calls => frame({ choices: [{ index: 0, delta: { tool_calls: calls }, finish_reason: 'tool_calls' }] }) + 'data: [DONE]\n\n';
function response(text, size = 11) {
  const bytes = new TextEncoder().encode(text); let offset = 0;
  return new Response(new ReadableStream({ pull(c) { if (offset >= bytes.length) return c.close(); c.enqueue(bytes.slice(offset, offset + size)); offset += size; } }));
}
function fixture(fetcher) {
  const logs = [], context = { Date, Math, JSON, Promise, Map, Set, WeakMap, AbortController, TextDecoder, TextEncoder, Uint8Array, Response, ReadableStream, Headers,
    console: { log: (...a) => logs.push(a), warn: (...a) => logs.push(a), error: (...a) => logs.push(a) },
    setTimeout: (fn, ms) => setTimeout(fn, ms <= 30000 ? 0 : ms), clearTimeout, fetch: fetcher };
  context.window = context; vm.createContext(context); sources.forEach(([f, s]) => vm.runInContext(s, context, { filename: f }));
  return { aa: context.TM.AuthoringAgent, logs, call(options = {}) { return context.TM.AuthoringAgent.callWithTools('核验', [{ name: 'finish', parameters: { type: 'object' } }], { cfg, maxRetries: 0, retryBaseMs: 1, ...options }); } };
}
const runOpts = { cfg, noMemoryRecall: true, conventions: '', maxIterations: 10, maxTokens: 1000000 };
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
(async () => {
  await test('malformed JSON is re-requested once with identical tools, input, reasoning and output budget', async () => {
    const sent = [], events = [], f = fixture(async (_, init) => { sent.push(init.body); return response(sent.length === 1 ? '{"PRIVATE":"broken' : JSON.stringify(packet([done]))); });
    const r = await f.call({ maxTok: 24000, onTelemetry: e => events.push(e) });
    assert.equal(r.toolCalls[0].name, 'finish'); assert.equal(sent.length, 2); assert.equal(sent[0], sent[1]);
    assert.equal(JSON.parse(sent[1]).max_tokens, 24000); assert(JSON.parse(sent[1]).tools);
    assert.equal(events.filter(e => e.type === 'request' && e.retry).length, 1);
    assert.equal(events.filter(e => e.type === 'response-retry').length, 1); assert(!JSON.stringify(events).includes('PRIVATE'));
  });
  await test('EOF without completion never executes its complete prefix; recovered round appends only once', async () => {
    let n = 0, d; const packets = [], texts = [], f = fixture(async (_, init) => {
      packets.push(init.body); n++;
      if (n === 1) return response(incomplete);
      if (n === 2) { assert.equal(d.labels.length, 0); return response(stream([push])); }
      return response(JSON.stringify(packet([done])));
    });
    d = f.aa.makeDraft({ name: '隔离', labels: [] });
    const r = await f.aa.runAuthoringLoop(d, '添加并核验', { ...runOpts, onText: t => texts.push(t) });
    assert(r.finished); assert.equal(n, 3); assert.equal(d.labels.length, 1); assert.equal(packets[0], packets[1]);
    assert.equal(r.metrics.httpRequests, 3); assert.equal(r.metrics.retries, 1); assert(texts.some(t => /本轮未执行.*重试/.test(t)));
  });
  await test('persistent malformed later round retains earlier draft, paired history and a resumable checkpoint', async () => {
    let n = 0, phase = 0; const sent = [], f = fixture(async (_, init) => {
      sent.push(init.body); n++;
      return response(n === 1 ? JSON.stringify(packet([push])) : phase ? JSON.stringify(packet([done])) : incomplete + 'data: {PRIVATE-broken}\n\n');
    });
    const d = f.aa.makeDraft({ name: '隔离', labels: [] }); let error;
    try { await f.aa.runAuthoringLoop(d, '添加并核验', runOpts); } catch (e) { error = e; }
    assert(error && error.partial); assert.equal(n, 3); assert(error.retriesExhausted); assert.equal(error.attempts, 2);
    assert.equal(d.labels.length, 1); assert.equal(sent[1], sent[2]); assert.equal(error.partial.metrics.retries, 1);
    assert.equal(error.partial.conversation.filter(m => m.role === 'assistant').length, 1);
    assert(!error.message.includes('PRIVATE')); assert(!JSON.stringify(f.logs).includes(thought));
    phase = 1; const r = await f.aa.runAuthoringLoop(d, '继续核验', { ...runOpts, resumeState: error.partial.resumeState });
    assert(r.finished); assert.equal(n, 4); assert.equal(d.labels.length, 1);
    assert.equal(JSON.parse(sent[3]).messages.find(m => m.tool_calls).reasoning_content, thought);
  });
  await test('one response repair does not multiply the existing HTTP retry budget', async () => {
    let n = 0; const f = fixture(async () => { n++; return n === 1 || n === 3 ? new Response('busy', { status: 503 }) : response(n === 2 ? '{broken' : JSON.stringify(packet([done]))); });
    const r = await f.call({ maxRetries: 2 }); assert.equal(n, 4); assert.equal(r.toolCalls[0].name, 'finish');
    n = 0; const bad = fixture(async () => { n++; return response('{broken'); });
    await assert.rejects(() => bad.call({ maxRetries: 20 }), e => e.code === 'authoring-response-invalid-json' && e.retriesExhausted && e.attempts === 2);
    assert.equal(n, 2);
  });
  await test('cancel during response-retry backoff sends no further request', async () => {
    let n = 0; const ctrl = new AbortController(), f = fixture(async () => { n++; return response(incomplete); });
    await assert.rejects(() => f.call({ signal: ctrl.signal, onTelemetry: e => { if (e.type === 'response-retry') ctrl.abort('player-stop'); } }), e => e.aborted);
    assert.equal(n, 1);
  });
  await test('native-to-text negotiation cannot regain a spent response repair and reports all requests', async () => {
    let n = 0; const events = [], f = fixture(async () => ++n === 2 ? new Response('tools unsupported', { status: 400 }) : response('{broken'));
    await assert.rejects(() => f.call({ onTelemetry: e => events.push(e) }), e => e.code === 'authoring-response-invalid-json' && e.retriesExhausted && e.attempts === 3);
    assert.equal(n, 3); assert.equal(events.filter(e => e.type === 'response-retry').length, 1);
    assert.equal(events.filter(e => e.type === 'request' && e.retry).length, 2);
  });
  await test('concurrent logical calls have independent format-recovery quotas', async () => {
    let n = 0; const f = fixture(async () => response(++n <= 2 ? '{broken' : JSON.stringify(packet([done]))));
    const results = await Promise.all([f.call(), f.call()]); assert.equal(n, 4); assert(results.every(r => r.toolCalls[0].name === 'finish'));
  });
  await test('relay data lines without blank separators are compatible only when every line is a whole event', async () => {
    let n = 0; const f = fixture(async () => { n++; return response(stream([done]).replace(/\n\n/g, '\n'), 1); });
    const r = await f.call(); assert.equal(r.toolCalls[0].input.summary, '完整核验完成'); assert.equal(n, 1);
    const multiline = 'data: {"choices":\ndata: [{"index":0,"delta":{"content":"标准多行😀"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n';
    assert.equal((await fixture(async () => response(multiline, 1)).call()).text, '标准多行😀');
    await assert.rejects(() => fixture(async () => response('data: '+JSON.stringify(packet([push]))+'\ndata: {broken}\ndata: [DONE]\n')).call(), e => e.code === 'authoring-response-invalid-json');
  });
  await test('final message snapshots replace compatible deltas instead of duplicating tool names and JSON', async () => {
    const partial = { ...push, function: { name: 'apply', arguments: push.function.arguments.slice(0, 12) } };
    const raw = frame({ choices: [{ index: 0, delta: { content: '核', tool_calls: [partial] } }] })
      + frame({ choices: [{ index: 0, message: { content: '核验', tool_calls: [push] }, finish_reason: 'tool_calls' }] }) + 'data: [DONE]\n\n';
    let n = 0; const r = await fixture(async () => { n++; return response(raw, 1); }).call();
    assert.equal(r.text, '核验'); assert.equal(r.toolCalls.length, 1); assert.equal(r.toolCalls[0].name, 'applyPush'); assert.equal(r.toolCalls[0].input.value.name, 'once😀'); assert.equal(n, 1);
  });
  await test('conflicting snapshots and changed tool identity are not guessed or retried', async () => {
    for (const final of [{ ...push, id: 'different' }, { ...push, function: { ...push.function, arguments: '{"path":"other"}' } }]) {
      let n = 0; const raw = incomplete + frame({ choices: [{ index: 0, message: { tool_calls: [final] }, finish_reason: 'tool_calls' }] }) + 'data: [DONE]\n\n';
      await assert.rejects(() => fixture(async () => { n++; return response(raw); }).call(), e => /changed-tool-id|conflicting-snapshot/.test(e.code || ''));
      assert.equal(n, 1);
    }
  });
  await test('truncated tool JSON is never patched by adding braces or executing an earlier tool', async () => {
    let n = 0, d; const bad = { ...tool('finish', {}, 1), function: { name: 'finish', arguments: '{"summary":"broken' } };
    const f = fixture(async () => { n++; return response(stream([push, bad])); });
    d = f.aa.makeDraft({ name: '隔离', labels: [] });
    await assert.rejects(() => f.aa.runAuthoringLoop(d, '核验', runOpts), e => e.code === 'authoring-response-invalid-json');
    assert.equal(n, 2); assert.equal(d.labels.length, 0);
  });
  await test('Anthropic missing terminal event gets one complete re-request, not a fabricated stop', async () => {
    const event = (type, fields = {}) => frame({ type, ...fields });
    const raw = event('message_start', { message: { content: [] } })
      + event('content_block_start', { index: 0, content_block: { type: 'tool_use', id: 'tu-1', name: 'finish', input: { summary: '核验' } } })
      + event('content_block_stop', { index: 0 }) + event('message_delta', { delta: { stop_reason: 'tool_use' } });
    let n = 0; const r = await fixture(async () => response(++n === 1 ? raw : raw + event('message_stop'))).call({ cfg: { ...cfg, url: 'https://api.anthropic.com/v1/messages' } });
    assert.equal(n, 2); assert.equal(r.toolCalls[0].input.summary, '核验');
  });
  await test('explicit provider errors, mixed protocols and authentication failures do not trigger format retries', async () => {
    for (const body of [frame({ error: { message: 'PRIVATE_PROVIDER_ERROR' } }), incomplete + frame({ candidates: [] })]) {
      let n = 0; await assert.rejects(() => fixture(async () => { n++; return response(body); }).call(), e => /provider-error|mixed-stream/.test(e.code || '') && !e.message.includes('PRIVATE'));
      assert.equal(n, 1);
    }
    let n = 0; await assert.rejects(() => fixture(async () => { n++; return new Response('unauthorized', { status: 401 }); }).call(), e => e.status === 401); assert.equal(n, 1);
  });
  console.log(`authoring wire retry: ${pass} PASS, ${fail} FAIL`); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
