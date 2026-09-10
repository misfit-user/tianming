#!/usr/bin/env node
'use strict';
// Real provider + loop. Validate subsequent HTTP packets, not a successful caller stub.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.resolve(__dirname, '../..'), at = process.argv.indexOf('--source-ref'), ref = at < 0 ? null : process.argv[at + 1];
const read = f => ref ? cp.execFileSync('git', ['show', ref + ':' + f], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }) : fs.readFileSync(path.join(root, f), 'utf8');
const sources = ['tm-agent-kernel.js', 'editor-authoring-agent-provider.js', 'editor-authoring-agent.js'].map(f => [f, read('web/' + f)]);
const cfg = { url: 'https://reasoning.invalid/v1', key: 'isolated-regression-only', model: 'thinking-fixture', temp: .2 };
const opts = { cfg, noMemoryRecall: true, conventions: '', maxIterations: 18, maxTokens: 1000000 };
const secret = 'SYNTHETIC_PRIVATE_REASONING_不得出现在说明或日志';
const tc = (name, input, id = name) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(input) } });
const finish = tc('finish', { summary: '已完成核验' });
const response = (message, finish_reason = 'stop') => new Response(JSON.stringify({ choices: [{ message, finish_reason }] }), { headers: { 'Content-Type': 'application/json' } });
function stream(message) {
  const frames = [];
  if (typeof message.reasoning_content === 'string') {
    for (const part of [message.reasoning_content.slice(0, 10), message.reasoning_content.slice(10)]) frames.push({ choices: [{ index: 0, delta: { reasoning_content: part } }] });
  }
  frames.push({ choices: [{ index: 0, delta: { content: message.content || '', tool_calls: (message.tool_calls || []).map((c, index) => ({ ...c, index })) }, finish_reason: 'tool_calls' }] });
  return new Response(frames.map(f => 'data: ' + JSON.stringify(f) + '\n\n').join('') + 'data: [DONE]\n\n', { headers: { 'Content-Type': 'text/event-stream' } });
}
function fixture(fetcher) {
  const logs = [];
  const c = { console: { log: (...x) => logs.push(x), warn: (...x) => logs.push(x), error: (...x) => logs.push(x) }, Date, Math, JSON, Promise, Map, Set, WeakMap, AbortController, TextDecoder, TextEncoder, Uint8Array, Response, ReadableStream, Headers,
    setTimeout: (fn, ms) => setTimeout(fn, ms <= 30000 ? 0 : ms), clearTimeout, fetch: fetcher };
  c.window = c; vm.createContext(c); for (const [f, source] of sources) vm.runInContext(source, c, { filename: f });
  return { aa: c.TM.AuthoringAgent, parts: c.TM.__aaParts, logs };
}
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
(async () => {
  for (const transport of ['JSON', 'SSE']) await test(transport + ' thinking edit then another edit and finish retains every assistant reasoning field', async () => {
    const packets = [], delivered = new Map(), texts = [], steps = []; let n = 0;
    const f = fixture(async (_url, init) => {
      const body = JSON.parse(init.body); packets.push(body); n++;
      if (!body.tools) return response({ content: '无法接续缺失的工具上下文。' });
      for (const m of body.messages.filter(m => m.role === 'assistant')) {
        const id = m.tool_calls && m.tool_calls[0].id;
        if (!delivered.has(id) || m.reasoning_content !== delivered.get(id)) return new Response('Missing reasoning_content in assistant message', { status: 400 });
      }
      const call = n === 1 ? tc('applyPush', { path: 'labels', value: { name: 'once' } }, 'first') : n === 2 ? tc('applyEdit', { path: 'labels.once.text', value: '补齐' }, 'second') : finish;
      const reasoning = secret + n + '😀'; delivered.set(call.id, reasoning);
      const message = { reasoning_content: reasoning, content: '', tool_calls: [call] };
      return transport === 'SSE' ? stream(message) : response(message, 'tool_calls');
    });
    const live = { name: '合成案卷', labels: [] }, d = f.aa.makeDraft(live);
    const r = await f.aa.runAuthoringLoop(d, '添加并补充 once 条目', { ...opts, onText: t => texts.push(t), onStep: s => steps.push(s) });
    assert(r.finished, 'first write must not strand later steps'); assert.equal(n, 3); assert(packets.every(p => p.tools && p.tool_choice === 'auto'));
    assert.deepEqual(JSON.parse(JSON.stringify(d.labels)), [{ name: 'once', text: '补齐' }]); assert.equal(live.labels.length, 0);
    assert(!JSON.stringify([texts, steps, r.transcript, r.metrics, f.logs]).includes(secret), 'opaque model state never becomes a visible thought or diagnostic');
  });
  await test('empty reasoning string remains present, normal non-thinking responses stay unchanged', async () => {
    const f = fixture(async () => response({ reasoning_content: '', content: '', tool_calls: [finish] }));
    const r = await f.aa.callWithTools('核对', [{ name: 'finish' }], { cfg });
    const b = f.parts._toOpenAI([{ role: 'assistant', text: r.text, toolCalls: r.toolCalls, reasoningContent: r.reasoningContent }], '', [{ name: 'finish' }], 3000, cfg.model, .2);
    assert.equal(b.messages[0].reasoning_content, '');
    const plain = f.parts._parseOpenAI({ choices: [{ message: { content: '正文' }, finish_reason: 'stop' }] });
    assert.equal(plain.text, '正文'); assert.equal(plain.reasoningContent, undefined);
  });
  await test('private checkpoint and prior-conversation copies retain reasoning without replaying a committed edit', async () => {
    for (const kind of ['checkpoint', 'prior']) {
      let n = 0; const f = fixture(async (_url, init) => {
        const b = JSON.parse(init.body); n++;
        if (n === 1) return response({ reasoning_content: secret, tool_calls: [tc('applyPush', { path: 'labels', value: { name: 'once' } })] });
        const previous = b.messages.find(m => m.role === 'assistant'); assert(previous); assert.equal(previous.reasoning_content, secret);
        return response({ reasoning_content: secret + '-end', tool_calls: [finish] });
      });
      const d = f.aa.makeDraft({ name: '案卷', labels: [] });
      const first = await f.aa.runAuthoringLoop(d, '添加', { ...opts, maxIterations: 1 }); assert(!first.finished); assert(first.resumeState);
      const result = await f.aa.runAuthoringLoop(d, '继续收尾', { ...opts, ...(kind === 'checkpoint' ? { resumeState: first.resumeState } : { priorConversation: first.conversation }) });
      assert(result.finished); assert.equal(d.labels.length, 1); assert.equal(n, 2);
    }
  });
  await test('compaction preserves reasoning on retained turns and excludes it from summary/text fallback', async () => {
    const f = fixture(async (_url, init) => { assert(!init.body.includes(secret)); return response({ content: JSON.stringify({ tool_calls: [{ name: 'finish', input: { summary: '完成' } }] }) }); });
    const conversation = [{ role: 'user', text: '核对' }];
    for (let i = 0; i < 8; i++) conversation.push({ role: 'assistant', text: '公开说明', reasoningContent: secret + i, toolCalls: [{ id: '' + i, name: 'getField', input: { path: 'a'.repeat(300) } }] }, { role: 'tool', toolResults: [{ id: '' + i, name: 'getField', content: 'b'.repeat(500) }] });
    f.aa._compactOldToolResults(conversation, 2); assert.equal(conversation[1].reasoningContent, secret + 0);
    const tail = f.aa._compactTailSlice(conversation, 3); assert.equal(tail[0].reasoningContent, secret + 6);
    assert(!f.aa._flattenForSummary(conversation, .5).includes(secret));
    await f.aa.callWithTools(conversation, [{ name: 'finish' }], { cfg, textToolFallback: true });
  });
  await test('non-tool assistant reasoning survives a full serialized conversation round-trip', async () => {
    const f = fixture(async () => response({ reasoning_content: secret, content: '继续核对。' }));
    const d = f.aa.makeDraft({ name: '案卷' }), r = await f.aa.runAuthoringLoop(d, '核对', { ...opts, maxNoToolNudges: 0 });
    const copy = JSON.parse(JSON.stringify(r.conversation)), b = f.parts._toOpenAI(copy, '', [{ name: 'getField' }], 3000, cfg.model, .2);
    assert.equal(b.messages.find(m => m.role === 'assistant').reasoning_content, secret);
    assert(!r.summary.includes(secret));
  });
  await test('reasoning-only tool-shaped text is never executed and gets a truthful sanitized diagnosis', async () => {
    const f = fixture(async () => response({ content: null, reasoning_content: secret + JSON.stringify({ tool_calls: [{ name: 'applyEdit', input: { path: 'name', value: '不可执行' } }] }) }));
    const d = f.aa.makeDraft({ name: '原' }), r = await f.aa.runAuthoringLoop(d, '改名', { ...opts, maxNoToolNudges: 0 });
    assert.equal(d.name, '原'); assert(!r.finished); assert.match(r.summary, /思考/); assert(!r.summary.includes(secret));
    assert.equal(r.apiDiagnostics.at(-1).kind, 'reasoning-only'); assert.equal(r.apiDiagnostics.at(-1).textChars, 0);
    assert(!JSON.stringify(r.apiDiagnostics).includes(secret)); assert(!JSON.stringify(r.transcript).includes(secret));
  });
  await test('empty, refusal, malformed arguments and plain prose are not collapsed into one diagnosis', async () => {
    for (const [kind, message] of [['empty', { content: '' }], ['refusal', { content: '', refusal: 'PRIVATE refusal' }], ['invalid-tool-arguments', { tool_calls: [tc('applyEdit', { path: 'name', value: '不可执行' }), { function: { name: 'finish', arguments: '{' } }] }], ['text-only', { content: 'PRIVATE prose' }]]) {
      const f = fixture(async () => response(message)), d = f.aa.makeDraft({ name: '原' });
      const r = await f.aa.runAuthoringLoop(d, '修改', { ...opts, maxNoToolNudges: 0 });
      assert(!r.finished); assert.equal(d.name, '原'); assert.equal(r.apiDiagnostics.at(-1).kind, kind); assert(!JSON.stringify(r.apiDiagnostics).includes('PRIVATE'));
    }
  });
  await test('truncated thinking never executes a prefix; existing output and retry limits remain bounded', async () => {
    let n = 0; const f = fixture(async () => { n++; return response({ content: '', reasoning_content: secret, tool_calls: [tc('applyEdit', { path: 'name', value: '不可执行' })] }, 'length'); });
    const d = f.aa.makeDraft({ name: '原' }), r = await f.aa.runAuthoringLoop(d, '修改', opts);
    assert(!r.finished); assert.equal(d.name, '原'); assert(n <= 5); assert.match(r.summary, /截断|输出上限/); assert(!r.summary.includes(secret));
    assert.equal(r.apiDiagnostics.at(-1).kind, 'truncated');
  });
  await test('valid JSON compatibility calls retain safe format diagnostics, never reasoning commands', async () => {
    const f = fixture(async () => response({ reasoning_content: secret, content: JSON.stringify({ tool_calls: [{ name: 'finish', input: { summary: '完成' } }] }) }));
    const r = await f.aa.runAuthoringLoop(f.aa.makeDraft({ name: '原' }), '核对', opts);
    assert(r.finished); assert.equal(r.apiDiagnostics.at(-1).kind, 'text-json'); assert(!JSON.stringify(r.apiDiagnostics).includes(secret));
  });
  await test('unrecognized payload and a non-array native tool list have explicit safe diagnoses', async () => {
    for (const [kind, data] of [['unsupported-response', { output: [{ content: 'PRIVATE unknown protocol' }] }], ['invalid-tool-arguments', { choices: [{ message: { tool_calls: { function: { name: 'applyEdit' } } }, finish_reason: 'PRIVATE finish' }] }]]) {
      const f = fixture(async () => new Response(JSON.stringify(data))), d = f.aa.makeDraft({ name: '原' });
      const r = await f.aa.runAuthoringLoop(d, '修改', { ...opts, maxNoToolNudges: 0 });
      assert(!r.finished); assert.equal(d.name, '原'); assert.equal(r.apiDiagnostics.at(-1).kind, kind); assert(!JSON.stringify(r.apiDiagnostics).includes('PRIVATE'));
    }
  });
  await test('OpenAI continuation state is not leaked into other providers or no-tools requests', async () => {
    const f = fixture(async () => response({})), conv = [{ role: 'assistant', text: '正文', reasoningContent: secret, toolCalls: [] }];
    const bodies = [f.parts._toOpenAI(conv, '', [], 3000, cfg.model, .2), f.parts._toAnthropic(conv, '', [{ name: 'finish' }], 3000, 'other'), f.parts._toGemini(conv, '', [{ name: 'finish' }], 3000, .2)];
    assert(!JSON.stringify(bodies).includes(secret));
  });
  await test('cancellation after thinking response preserves live data and does not replay tools', async () => {
    let n = 0, aa; const f = fixture(async () => { n++; aa.abort(); return response({ reasoning_content: secret, tool_calls: [tc('applyEdit', { path: 'name', value: '不可执行' })] }); }); aa = f.aa;
    const d = aa.makeDraft({ name: '原' }), r = await aa.runAuthoringLoop(d, '修改', opts);
    assert.equal(r.stopReason, 'aborted'); assert.equal(d.name, '原'); assert.equal(n, 1);
  });
  console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0, sourceRef: ref || 'worktree' })); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
