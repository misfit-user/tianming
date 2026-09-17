#!/usr/bin/env node
'use strict';
// Actual provider/core; only transport and wait duration are controlled. No live API.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.resolve(__dirname, '../..'), at = process.argv.indexOf('--source-ref'), ref = at < 0 ? null : process.argv[at + 1];
const read = file => ref ? cp.execFileSync('git', ['show', ref + ':' + file], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 }) : fs.readFileSync(path.join(root, file), 'utf8');
const sources = ['tm-agent-kernel.js', 'editor-authoring-agent-provider.js', 'editor-authoring-agent.js'].map(f => [f, read('web/' + f)]);
const cfg = { url: 'https://relay.invalid/v1', key: 'isolated-regression-only', model: 'controlled', temp: 0.2 };
const options = { cfg, noMemoryRecall: true, conventions: '', maxIterations: 18, maxTokens: 1000000 };
const call = (name, input = {}) => ({ id: name, name, input });
const finish = call('finish', { summary: '完成核验' });
const response = message => new Response(JSON.stringify({ choices: [{ message, finish_reason: 'stop' }] }), { headers: { 'Content-Type': 'application/json' } });
const native = (...calls) => response({ tool_calls: calls.map(c => ({ id: c.id, type: 'function', function: { name: c.name, arguments: JSON.stringify(c.input) } })) });
const plain = text => response({ content: text });
function fixture(fetcher = () => { throw Error('unexpected transport'); }) {
  const c = { console, Date, Math, JSON, Promise, Map, Set, WeakMap, AbortController, TextDecoder, TextEncoder, Uint8Array, Response, ReadableStream, Headers,
    setTimeout: (fn, ms) => setTimeout(fn, ms <= 30000 ? 0 : ms), clearTimeout, fetch: fetcher };
  c.window = c; vm.createContext(c); for (const [file, source] of sources) vm.runInContext(source, c, { filename: file });
  return { aa: c.TM.AuthoringAgent, c };
}
let pass = 0, fail = 0;
async function test(name, fn) { try { await fn(); pass++; console.log('PASS ' + name); } catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); } }
(async () => {
  await test('relay nested textual tool envelope edits the actual detached draft and finishes', async () => {
    let n = 0;
    const f = fixture(async () => ++n === 1 ? plain(JSON.stringify({ tool_calls: [{ function: { name: 'applyEdit', arguments: JSON.stringify({ path: 'name', value: '新名😀' }) } }] })) : native(finish));
    const original = { name: '原名' }, draft = f.aa.makeDraft(original), r = await f.aa.runAuthoringLoop(draft, '改名', options);
    assert(r.finished); assert.equal(draft.name, '新名😀'); assert.equal(original.name, '原名'); assert.equal(n, 2);
  });
  await test('legacy native function_call and textual arguments both use actual object inputs', async () => {
    for (const message of [{ function_call: { name: 'finish', arguments: '{"summary":"已核对"}' } }, { content: JSON.stringify({ tool_calls: [{ name: 'finish', arguments: '{"summary":"已核对"}' }] }) }]) {
      const { aa } = fixture(async () => response(message));
      const r = await aa.callWithTools('核对', [{ name: 'finish' }], { cfg, maxRetries: 0 });
      assert.equal(r.toolCalls.length, 1); assert.equal(r.toolCalls[0].input.summary, '已核对');
    }
  });
  await test('malformed argument anywhere prevents execution of the entire textual batch', async () => {
    for (const argumentsValue of ['{"path":', 'null', '[]', '42']) {
      const { aa } = fixture(async () => plain(JSON.stringify({ tool_calls: [{ name: 'applyEdit', input: { path: 'name', value: '不得执行' } }, { name: 'finish', arguments: argumentsValue }] })));
      const draft = aa.makeDraft({ name: '原名' }), r = await aa.runAuthoringLoop(draft, '修改', { ...options, maxNoToolNudges: 0 });
      assert.equal(draft.name, '原名'); assert.equal(r.finished, false); assert.equal(r.stopReason, 'noToolCalls');
    }
  });
  await test('plain success claims and quoted examples never become successful tool execution', async () => {
    for (const text of ['全部修改成功了。', '例如可以这样调用：\n```json\n{"tool_calls":[{"name":"applyEdit","input":{"path":"name","value":"例子"}}]}\n```']) {
      const { aa } = fixture(async () => plain(text)), d = aa.makeDraft({ name: '原名' });
      const r = await aa.runAuthoringLoop(d, '修改', { ...options, maxNoToolNudges: 0 });
      assert.equal(d.name, '原名'); assert.equal(r.finished, false);
    }
  });
  await test('HTTP 200 without tools switches the next bounded round to JSON compatibility and retains partial work', async () => {
    const requests = []; let n = 0;
    const { aa } = fixture(async (_url, opts) => {
      const body = JSON.parse(opts.body); requests.push(body); n++;
      if (n === 1) return native(call('applyPush', { path: 'labels', value: { name: 'once' } }));
      if (body.tools) return plain('接下来继续补充说明。');
      const prompt = JSON.stringify(body.messages);
      assert.match(prompt, /once/); assert.match(prompt, /applyEdit/); assert.match(prompt, /parameters/);
      return plain(JSON.stringify({ tool_calls: [call('applyEdit', { path: 'labels.once.text', value: '完成' }), finish] }));
    });
    const original = { name: '合成剧本', labels: [] }, draft = aa.makeDraft(original), r = await aa.runAuthoringLoop(draft, '添加并补充条目', options);
    assert(r.finished); assert.equal(n, 3); assert.equal(draft.labels.length, 1); assert.equal(draft.labels[0].text, '完成'); assert.equal(original.labels.length, 0);
    assert.equal(r.metrics.httpRequests, 3); assert.equal(r.metrics.logicalRequests, 3);
  });
  await test('no-tool allowance resets only after verified progress, not repeated empty replies', async () => {
    const { aa } = fixture(); let n = 0;
    const seq = [[], [call('getField', { path: 'name' })], [], [call('applyEdit', { path: 'name', value: '新' })], [], [finish]];
    const r = await aa.runAuthoringLoop(aa.makeDraft({ name: '原' }), '核对后改名', { ...options, caller: async () => ({ text: '核办', toolCalls: seq[n++] || [] }) });
    assert(r.finished); assert.equal(n, 6);
    let empty = 0; const stalled = await aa.runAuthoringLoop(aa.makeDraft({ name: '原' }), '修改', { ...options, caller: async () => { empty++; return { text: '我会继续', toolCalls: [] }; } });
    assert.equal(stalled.finished, false); assert.equal(stalled.stopReason, 'noToolCalls'); assert.equal(empty, 3); assert.match(stalled.summary, /工具|中转/); assert(stalled.resumeState);
  });
  await test('read-only no-tool recovery asks for its own terminal tool and never authorizes writes', async () => {
    for (const [flag, terminal, input] of [['planOnly', 'proposePlan', { steps: ['核对名称'] }], ['qaOnly', 'submitAnswer', { answer: '原名' }], ['reviewOnly', 'submitReview', { findings: [], summary: '核对' }], ['explainOnly', 'submitExplanation', { summary: '说明', points: [] }]]) {
      const { aa } = fixture(); let n = 0;
      const r = await aa.runAuthoringLoop(aa.makeDraft({ name: '原' }), '只读', { ...options, [flag]: true, caller: async (conv, tools) => {
        if (++n === 1) return { text: '核办', toolCalls: [] };
        const prompt = conv[conv.length - 1].text; assert.match(prompt, new RegExp(terminal)); assert.doesNotMatch(prompt, /applyEdit|applyPush|multiEdit/);
        assert(!tools.some(t => t.name === 'applyEdit')); return { toolCalls: [call(terminal, input)] };
      } });
      assert(r.finished); assert.equal(n, 2);
    }
  });
  await test('closed relay connection has one retry owner, explicit failure and a usable partial checkpoint', async () => {
    let n = 0; const messages = [], { aa } = fixture(async () => { n++; if (n === 1) return native(call('applyEdit', { path: 'name', value: '已做部分' })); throw new TypeError('Failed to fetch'); });
    const d = aa.makeDraft({ name: '原' }); let error;
    try { await aa.runAuthoringLoop(d, '修改', { ...options, onText: text => messages.push(text) }); } catch (e) { error = e; }
    assert(error && error.partial && error.partial.resumeState); assert.equal(n, 5, 'one successful edit plus initial network attempt and three transport retries');
    assert.equal(error.attempts, 4); assert.equal(error.retriesExhausted, true); assert.equal(d.name, '已做部分'); assert(!messages.some(s => /未检测到工具/.test(s)));
    const r = await aa.runAuthoringLoop(d, '继续', { ...options, resumeState: error.partial.resumeState, caller: async () => ({ toolCalls: [finish] }) });
    assert(r.finished); assert.equal(d.name, '已做部分');
  });
  await test('connection self-test cannot advertise native tools when it only received prose', async () => {
    const { aa } = fixture(async () => plain('可以连接')); const r = await aa.testConnection({ cfg });
    assert.equal(r.ok, false); assert.match(r.detail, /工具|ping/);
  });
  await test('native unsupported-tools fallback also has bounded network retries and preserves the error category', async () => {
    let n = 0; const { aa } = fixture(async () => { if (++n === 1) return new Response('tools unsupported', { status: 400 }); throw new TypeError('Failed to fetch'); });
    await assert.rejects(aa.runAuthoringLoop(aa.makeDraft({ name: '原' }), '修改', options), e => e.retriesExhausted === true && e.attempts === 5 && e.attempts === n && /完整 API 响应/.test(e.message)); // 包括最初的原生协议拒绝；实际请求上限仍是 5。
    assert.equal(n, 5);
    let denied = 0; const f = fixture(async () => { denied++; return new Response('unauthorized', { status: 401 }); });
    await assert.rejects(f.aa.runAuthoringLoop(f.aa.makeDraft({ name: '原' }), '修改', options), e => e.status === 401); assert.equal(denied, 1);
  });
  await test('JSON compatibility retains each user image, full schemas and separate system instructions for all providers', async () => {
    const images = Array.from({ length: 8 }, (_, i) => 'data:image/png;base64,' + Buffer.from('synthetic-' + i).toString('base64'));
    const conversation = [{ role: 'user', text: '第一组', images: images.slice(0, 4) }, { role: 'user', text: '第二组', images: images.slice(4) }];
    for (const url of [cfg.url, 'https://api.anthropic.invalid', 'https://generativelanguage.googleapis.com/v1beta']) {
      let request;
      const { aa } = fixture(async (_url, opts) => { request = JSON.parse(opts.body); const text = JSON.stringify({ tool_calls: [finish] }); return new Response(JSON.stringify(url.includes('googleapis') ? { candidates: [{ content: { parts: [{ text }] }, finishReason: 'STOP' }] } : url.includes('anthropic') ? { content: [{ type: 'text', text }], stop_reason: 'end_turn' } : { choices: [{ message: { content: text }, finish_reason: 'stop' }] }), { headers: { 'Content-Type': 'application/json' } }); });
      const r = await aa.callWithTools(conversation, [{ name: 'finish', parameters: { type: 'object', properties: { summary: { type: 'string' } }, required: ['summary'] } }], { cfg: { ...cfg, url }, maxRetries: 0, system: '系统边界', textToolFallback: true });
      assert.equal(r.toolCalls[0].name, 'finish'); assert.equal(request.tools, undefined); assert.equal(request.tool_choice, undefined); assert.equal(request.toolConfig, undefined);
      const body = JSON.stringify(request); for (const img of images) assert(body.includes(img.split(',')[1])); assert.match(body, /系统边界/); assert.match(body, /required/);
    }
  });
  await test('textual calls cannot escape issued tools or read-only permissions', async () => {
    const { aa } = fixture(async () => plain(JSON.stringify({ tool_calls: [call('applyEdit', { path: 'name', value: '越权' })] })));
    const d = aa.makeDraft({ name: '原' }), r = await aa.runAuthoringLoop(d, '只查询', { ...options, qaOnly: true, noProgressLimit: 3 });
    assert.equal(d.name, '原'); assert.equal(r.finished, false); assert(r.transcript.some(t => t.name === 'applyEdit' && t.result.ok === false)); assert.equal(r.stopReason, 'noProgress');
  });
  await test('normal ping still passes and abort never becomes a compatibility retry', async () => {
    const { aa } = fixture(async () => native(call('ping', { ok: true }))); assert.equal((await aa.testConnection({ cfg })).ok, true);
    let n = 0; const ctrl = new AbortController(), f = fixture(async () => { n++; ctrl.abort(); throw new TypeError('Failed to fetch'); });
    await assert.rejects(f.aa.callWithTools('测试', [{ name: 'ping' }], { cfg, signal: ctrl.signal }), e => e.name === 'AbortError'); assert.equal(n, 1);
  });
  await test('empty or invalid admin hierarchy renders an honest empty state without changing source data', async () => {
    const source = read('web/preview/scenario-editor-reset-app.js');
    const fn = source.slice(source.indexOf('  function renderAdminFolio()'), source.indexOf('  function renderCharacterFolio()'));
    for (const adminHierarchy of [{}, { bad: null }, []]) {
      const state = { scenario: { adminHierarchy }, _adminFaction: 'gone', _adminView: 'tree' }, before = JSON.stringify(state.scenario);
      const ctx = { state, genFolioCss: () => '', escapeHtml: s => String(s).replace(/</g, '&lt;'),
        adminMapBindIndex: () => ({}), orgChartState: () => ({}), renderOrgChart: () => '', ADT_CSS: '', OC_CSS: '' };
      vm.createContext(ctx); vm.runInContext(fn, ctx); const html = ctx.renderAdminFolio();
      assert.match(html, /暂无|没有|无可用|无效/); assert.equal(JSON.stringify(state.scenario), before);
    }
  });
  console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0, sourceRef: ref || 'worktree' })); process.exitCode = fail ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 1; });
