#!/usr/bin/env node
'use strict';
// Actual transport + tier resolver + construction agent + UI handler. Only the
// HTTP service and DOM surface are controlled; never use a player's API/key.
const fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process'), assert = require('assert/strict');
const { functionSource } = require('./lib-perf-round1');
const args = process.argv.slice(2);
const root = path.resolve(args.includes('--repo') ? args[args.indexOf('--repo') + 1] : path.join(__dirname, '../..'));
const ref = args.includes('--ref') ? args[args.indexOf('--ref') + 1] : null;
const read = file => ref ? cp.execFileSync('git', ['show', ref + ':web/' + file], { cwd: root, encoding: 'utf8', maxBuffer: 4000000 }) : fs.readFileSync(path.join(root, 'web', file), 'utf8');
const tool = name => ({ name, description: 'controlled tool', parameters: { type: 'object', properties: { note: { type: 'string' } } } });
const appraisal = { feasibility: '合理', costActual: 50000, timeActual: 4, effectsStructured: { pct: { 'economyBase.commerceVolume': 0.9, invalidPath: 1 } }, judgedEffects: '藏书育才', reason: '据本地条件核定' };
const http = (status, message) => ({ ok: false, status, headers: { get() { return null; } }, async text() { return JSON.stringify({ error: { message, type: 'invalid_request_error' } }); } });
const response = (calls, text = '', finish = 'stop') => ({ ok: true, status: 200, headers: { get() { return 'application/json'; } }, async json() { return { choices: [{ finish_reason: finish, message: { content: text, tool_calls: (calls || []).map(([name, input]) => ({ function: { name, arguments: JSON.stringify(input) } })) } }] }; } });
const incompat = () => http(400, 'Thinking mode does not support this tool_choice');
function harness(options = {}) {
  const requests = [], logs = [], elements = {};
  for (const [id, value] of Object.entries({ _bmCustName: '崇文馆', _bmCustCat: 'cultural', _bmCustDesc: '召集学士修订典籍', _bmAppraiseResult: '', _bmAppraise: '' })) elements[id] = { value, innerHTML: '', style: {}, disabled: false };
  const c = { console: Object.fromEntries(['log', 'info', 'warn', 'error'].map(k => [k, (...a) => logs.push(a.map(String).join(' '))])),
    AbortController, TextDecoder, setTimeout(fn, ms) { return setTimeout(fn, ms === 1000 || ms === 2000 ? 0 : ms); }, clearTimeout,
    localStorage: { getItem() { return null; }, setItem() {} },
    document: { getElementById(id) { return elements[id] || null; } }, toast() {},
    P: { ai: { key: 'test-primary-only', url: 'https://primary.invalid/v1', model: 'gpt-4o', temp: 0.2,
      secondary: { key: 'test-secondary-only', url: 'https://api.deepseek.com/v1', model: 'deepseek-v4-flash' } }, conf: { customBuildAgentRounds: 3 } },
    GM: { turn: 2, campaignId: 'test-campaign', timelineId: 'test-timeline', guoku: { money: 100000 } } };
  c.window = c; c.globalThis = c;
  vm.createContext(c);
  for (const name of ['_getAITier', '_buildAIUrlForTier', '_buildAIUrl']) vm.runInContext(functionSource(read('tm-utils.js'), name), c);
  for (const file of ['tm-ai-infra-json.js', 'tm-ai-infra-retry.js', 'tm-ai-infra.js', 'tm-building-works.js', 'tm-custom-build-agent.js']) vm.runInContext(read(file), c, { filename: file });
  // UI now needs the real modal/world lease, not an unowned detached callback.
  vm.runInContext(['_tmCaptureWorldLease', '_tmWorldLeaseCurrent'].map(n => functionSource(read('tm-post-turn-jobs.js'), n)).join('\n'), c);
  const core = read('tm-player-core.js');
  vm.runInContext(core.slice(core.indexOf('var _DF_BUILD_CAT_CN'), core.indexOf('/** 非直辖区划')), c);
  elements._dfBuildModal = { isConnected: true, _dfBuildContext: { divName: '测试府', lease: c._tmCaptureWorldLease() } };
  c.escHtml = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  c._aiQueue.enqueue = fn => fn(); // no rate-limit wall-clock wait in deterministic HTTP tests
  c.fetch = async (url, init) => {
    const body = JSON.parse(init.body); requests.push({ url, body, key: init.headers.Authorization || init.headers['x-api-key'], signal: init.signal });
    return (options.serve || serveThinking)(body, requests.length, init, url);
  };
  return { c, requests, logs, elements, run: () => c.TM.CustomBuildAgent.appraise('测试府', { name: '崇文馆', category: 'cultural', description: '召集学士修订典籍' }, { P: c.P, GM: c.GM }) };
}
function serveThinking(body) {
  if (!body.tools) return response([], '普通问对已正常回答');
  if (Object.hasOwn(body, 'tool_choice')) return incompat();
  const names = body.tools.map(t => t.function.name);
  return names.includes('critique') ? response([['critique', { sound: true, effectScale: 1, minTimeActual: 0, note: '允当' }]]) : response([['submit_appraisal', appraisal]]);
}
let pass = 0, fail = 0;
async function check(name, fn) { try { await fn(); pass++; console.log('PASS', name); } catch (error) { fail++; console.error('FAIL', name, error.message); } }
async function main() {
  await check('ordinary call succeeds while the same thinking endpoint can appraise', async () => {
    const h = harness(); assert.equal(await h.c.callAI('普通问对', 100, null, 'secondary'), '普通问对已正常回答');
    const before = JSON.stringify(h.c.GM), result = await h.run();
    assert.equal(result.ok, true, 'thinking tool policy must not yield no-appraisal');
    assert.equal(result.appraisal.costActual, 50000); assert.equal(result.appraisal.timeActual, 4);
    assert.equal(JSON.stringify(h.c.GM), before, 'appraisal never spends or builds before approval');
    assert(result.appraisal.effectsStructured.pct['economyBase.commerceVolume'] < 0.9);
    assert(!Object.hasOwn(result.appraisal.effectsStructured.pct, 'invalidPath'));
    assert(h.requests.every(r => !Object.hasOwn(r.body, 'tool_choice')));
    assert(h.requests.every(r => r.url.startsWith('https://api.deepseek.com/') && r.key === 'Bearer test-secondary-only'));
    assert(h.requests.every(r => !Object.hasOwn(r.body, 'thinking')), 'do not disable reasoning');
    assert.equal(h.requests.length, 3, 'one plain call, one appraisal and one critique');
  });
  await check('forced DeepSeek call advertises only the requested tool without mutating definitions', async () => {
    const h = harness(); const tools = [tool('read'), tool('submit_appraisal')], before = JSON.stringify(tools);
    await h.c.callAIWithTools('提交核议', tools, { forceTool: 'submit_appraisal', tier: 'secondary', maxTok: 1234 });
    assert(!Object.hasOwn(h.requests[0].body, 'tool_choice'));
    assert.deepEqual(h.requests[0].body.tools.map(t => t.function.name), ['submit_appraisal']);
    assert.equal(h.requests[0].body.max_tokens, 1234); assert.equal(JSON.stringify(tools), before);
  });
  await check('other OpenAI-compatible providers keep named tool_choice', async () => {
    const h = harness({ serve: () => response([['submit_appraisal', appraisal]]) });
    await h.c.callAIWithTools('x', [tool('submit_appraisal')], { forceTool: 'submit_appraisal', tier: 'primary' });
    assert.deepEqual(h.requests[0].body.tool_choice, { type: 'function', function: { name: 'submit_appraisal' } });
    assert.equal(h.requests[0].key, 'Bearer test-primary-only');
  });
  await check('primary DeepSeek is not confused with a different secondary provider', async () => {
    const h = harness({ serve: () => response([['submit_appraisal', appraisal]]) });
    h.c.P.ai.url = 'https://api.deepseek.com/v1'; h.c.P.ai.model = 'deepseek-v4-pro';
    h.c.P.ai.secondary.url = 'https://secondary.invalid/v1'; h.c.P.ai.secondary.model = 'gpt-4o';
    await h.c.callAIWithTools('x', [tool('submit_appraisal')], { forceTool: 'submit_appraisal', tier: 'secondary' });
    assert.equal(h.requests[0].body.tool_choice.function.name, 'submit_appraisal');
  });
  await check('unknown proxy exact incompatibility retries once without tool_choice', async () => {
    const h = harness({ serve: body => Object.hasOwn(body, 'tool_choice') ? incompat() : response([['submit_appraisal', appraisal]]) });
    h.c.P.ai.secondary.url = 'https://proxy.invalid/v1';
    const r = await h.c.callAIWithTools('x', [tool('submit_appraisal')], { forceTool: 'submit_appraisal', tier: 'secondary' });
    assert.equal(h.requests.length, 2); assert(h.requests[0].body.tool_choice); assert(!Object.hasOwn(h.requests[1].body, 'tool_choice'));
    assert.equal(r.toolCalls[0].name, 'submit_appraisal'); assert(!r.fallback, 'second request is still native tool use');
  });
  await check('unrelated HTTP 400 retains bounded schema fallback rather than compatibility retry', async () => {
    const h = harness({ serve: body => body.tools ? http(400, 'tools unsupported') : response([], JSON.stringify({ tool_calls: [{ name: 'submit_appraisal', input: appraisal }] })) });
    h.c.P.ai.secondary.url = 'https://proxy.invalid/v1';
    const r = await h.c.callAIWithTools('x', [tool('submit_appraisal')], { forceTool: 'submit_appraisal', tier: 'secondary' });
    assert.equal(h.requests.length, 2); assert(h.requests[0].body.tools); assert(!h.requests[1].body.tools);
    assert.equal(r.fallback, true); assert.equal(r.toolCalls[0].input.costActual, 50000);
  });
  await check('failed fallback preserves HTTP status and does not repeat appraisal rounds', async () => {
    const h = harness({ serve: () => http(401, 'Unauthorized') }); const r = await h.run();
    assert.equal(r.ok, false); assert(r.error && r.error.status === 401, 'preserve failure status');
    assert.equal(h.requests.length, 2, 'one tool attempt plus one bounded fallback, not three whole rounds');
    assert(!JSON.stringify(r).includes('test-secondary-only'));
  });
  await check('UI shows actionable failed-request message, restores button and keeps proposal', async () => {
    const h = harness({ serve: () => http(401, 'Unauthorized') });
    await h.c._dfAppraiseCustomBuild(encodeURIComponent('测试府'));
    const html = h.elements._bmAppraiseResult.innerHTML;
    assert(html.includes('401') && /密钥|权限/.test(html)); assert(!html.includes('no-appraisal'));
    assert.equal(h.elements._bmAppraise.disabled, false); assert.equal(h.elements._bmCustName.value, '崇文馆');
    assert(!h.c._dfPendingAppraisal); assert(!html.includes('准 奏 开 工'));
  });
  await check('successful UI shows validated appraisal and explicit original-channel adoption', async () => {
    const h = harness(), before = JSON.stringify(h.c.GM);
    await h.c._dfAppraiseCustomBuild(encodeURIComponent('测试府'));
    assert(h.elements._bmAppraiseResult.innerHTML.includes('有司核议：合理'));
    assert(h.elements._bmAppraiseResult.innerHTML.includes('录 入 核 议 建 议'));
    assert(!h.elements._bmAppraiseResult.innerHTML.includes('准 奏 开 工'));
    assert.equal(h.c._dfPendingAppraisal.req.name, '崇文馆'); assert.equal(h.elements._bmAppraise.disabled, false);
    assert.equal(JSON.stringify(h.c.GM), before);
  });
  await check('no structured appraisal is explained instead of exposing no-appraisal', async () => {
    const h = harness({ serve: () => response([], '我还在考虑。') });
    await h.c._dfAppraiseCustomBuild(encodeURIComponent('测试府'));
    assert(/未.*提交|没有.*核议|未.*结构/.test(h.elements._bmAppraiseResult.innerHTML));
    assert(!h.elements._bmAppraiseResult.innerHTML.includes('no-appraisal')); assert(h.requests.length <= 3);
  });
  await check('truncated reasoning output is diagnosed without another identical round', async () => {
    const h = harness({ serve: () => response([], '', 'length') }); const r = await h.run();
    assert.equal(r.ok, false); assert.equal(r.reason, 'appraisal-truncated'); assert.equal(h.requests.length, 1);
  });
  await check('empty or malformed appraisal cannot become a zero-cost approval', async () => {
    for (const input of [{}, { ...appraisal, costActual: -1 }, { ...appraisal, timeActual: 'not-a-number' }]) {
      const h = harness({ serve: () => response([['submit_appraisal', input]]) }); const r = await h.run();
      assert.equal(r.ok, false); assert.equal(r.reason, 'appraisal-invalid'); assert.equal(h.requests.length, 1);
    }
  });
  await check('wrong forced function is rejected', async () => {
    const h = harness({ serve: () => response([['read', {}]]) });
    const r = await h.c.callAIWithTools('x', [tool('read'), tool('submit_appraisal')], { forceTool: 'submit_appraisal', tier: 'secondary' });
    assert.equal(r.toolCalls.length, 0);
  });
  await check('unparsable tool arguments never become a successful empty input', async () => {
    const h = harness({ serve: () => ({ ok: true, async json() { return { choices: [{ message: { tool_calls: [{ function: { name: 'submit_appraisal', arguments: '{broken' } }] } }] }; } }) });
    const r = await h.c.callAIWithTools('x', [tool('submit_appraisal')], { tier: 'secondary' });
    assert.equal(r.toolCalls.length, 0);
  });
  await check('already-aborted call sends no native or fallback HTTP request', async () => {
    const h = harness(), ctrl = new AbortController(); ctrl.abort();
    const r = await h.c.callAIWithTools('x', [tool('read')], { tier: 'secondary', signal: ctrl.signal });
    assert.equal(h.requests.length, 0); assert.equal(r.error && r.error.code, 'aborted');
  });
  await check('timeout cleans listeners and does not launch fallback after deadline', async () => {
    const h = harness({ serve: (_body, _n, init) => new Promise((_resolve, reject) => init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) });
    const ctrl = new AbortController(); let active = 0;
    const add = ctrl.signal.addEventListener.bind(ctrl.signal), remove = ctrl.signal.removeEventListener.bind(ctrl.signal);
    ctrl.signal.addEventListener = (...a) => { active++; return add(...a); }; ctrl.signal.removeEventListener = (...a) => { active--; return remove(...a); };
    const r = await h.c.callAIWithTools('x', [tool('read')], { tier: 'secondary', timeoutMs: 5, maxRetries: 0, signal: ctrl.signal });
    assert.equal(h.requests.length, 1); assert.equal(r.error && r.error.code, 'tool-timeout'); assert.equal(active, 0);
  });
  await check('native Anthropic format is unchanged', async () => {
    const h = harness({ serve: () => ({ ok: true, async json() { return { content: [{ type: 'tool_use', name: 'read', input: {} }] }; } }) });
    h.c.P.ai.secondary = { key: 'test-secondary-only', url: 'https://api.anthropic.com/v1/messages', model: 'claude-test' };
    const r = await h.c.callAIWithTools('x', [tool('read')], { tier: 'secondary', forceTool: 'read' });
    assert.deepEqual(h.requests[0].body.tool_choice, { type: 'tool', name: 'read' }); assert(h.requests[0].body.tools[0].input_schema);
    assert.equal(r.toolCalls[0].name, 'read');
  });
  await check('unconfigured secondary resolves to primary DeepSeek without request mismatch', async () => {
    const h = harness(); delete h.c.P.ai.secondary;
    h.c.P.ai.url = 'https://api.deepseek.com/v1'; h.c.P.ai.model = 'deepseek-v4-pro';
    const r = await h.run(); assert.equal(r.ok, true);
    assert(h.requests.every(x => x.key === 'Bearer test-primary-only' && !Object.hasOwn(x.body, 'tool_choice')));
  });
  await check('read tools still run before forced final appraisal and critique', async () => {
    const h = harness({ serve: (body, n) => {
      if (Object.hasOwn(body, 'tool_choice')) return incompat();
      if (n < 3) return response([['inspect_region', { divName: '测试府' }]]);
      return serveThinking(body);
    } });
    const r = await h.run(); assert.equal(r.ok, true); assert.equal(r.toolStats.rounds, 3); assert.equal(r.toolStats.reads, 2);
    assert.equal(h.requests.length, 4); assert.deepEqual(h.requests[2].body.tools.map(t => t.function.name), ['submit_appraisal']);
    assert(h.requests[2].body.messages[0].content.includes('你已查得')); assert(r.critique.sound);
  });
  await check('compatibility retry stops if user cancels while the error body is being read', async () => {
    const ctrl = new AbortController(); const h = harness({ serve: () => ({ ok: false, status: 400, async text() { ctrl.abort(); return 'Thinking mode does not support this tool_choice'; } }) });
    h.c.P.ai.secondary.url = 'https://proxy.invalid/v1';
    const r = await h.c.callAIWithTools('x', [tool('read')], { tier: 'secondary', signal: ctrl.signal });
    assert.equal(h.requests.length, 1); assert.equal(r.error.code, 'aborted');
  });
  await check('repeated incompatibility cannot create an unbounded native retry loop', async () => {
    const h = harness({ serve: () => incompat() }); h.c.P.ai.secondary.url = 'https://proxy.invalid/v1';
    const r = await h.c.callAIWithTools('x', [tool('read')], { tier: 'secondary', maxRetries: 0 });
    assert.equal(h.requests.length, 3); assert.equal(r.toolCalls.length, 0); assert.equal(r.error.status, 400);
  });
  await check('concurrent primary and secondary requests keep separate compatibility policy', async () => {
    const h = harness({ serve: body => response([['read', { note: body.model }]]) });
    const results = await Promise.all(['primary', 'secondary'].map(tier => h.c.callAIWithTools('x', [tool('read')], { tier, forceTool: 'read' })));
    assert.deepEqual(results.map(r => r.toolCalls[0].input.note), ['gpt-4o', 'deepseek-v4-flash']);
    const primary = h.requests.find(r => r.body.model === 'gpt-4o'), secondary = h.requests.find(r => r.body.model !== 'gpt-4o');
    assert.equal(primary.body.tool_choice.function.name, 'read'); assert(!Object.hasOwn(secondary.body, 'tool_choice'));
  });
  await check('native Gemini tool declaration and forced name are unchanged', async () => {
    const h = harness({ serve: () => ({ ok: true, async json() { return { candidates: [{ content: { parts: [{ functionCall: { name: 'read', args: { note: 'ok' } } }] } }] }; } }) });
    h.c.P.ai.secondary = { key: 'test-secondary-only', url: 'https://generativelanguage.googleapis.com/v1beta/models/gemini:generateContent', model: 'gemini-test' };
    const r = await h.c.callAIWithTools('x', [tool('read')], { tier: 'secondary', forceTool: 'read' });
    assert.deepEqual(h.requests[0].body.toolConfig.functionCallingConfig, { mode: 'ANY', allowedFunctionNames: ['read'] });
    assert(h.requests[0].body.tools[0].functionDeclarations); assert.equal(r.toolCalls[0].input.note, 'ok');
  });
  await check('success and error replies are revealed without scrolling a closed dialog', async () => {
    for (const failure of [false, true]) {
      const h = harness(failure ? { serve: () => http(401, 'Unauthorized') } : {}); let scrolls = 0;
      const box = h.elements._bmAppraiseResult; box.isConnected = true; box.scrollIntoView = opts => { assert.equal(opts.block, 'nearest'); scrolls++; };
      await h.c._dfAppraiseCustomBuild(encodeURIComponent('测试府')); assert.equal(scrolls, 1);
      box.isConnected = false; await h.c._dfAppraiseCustomBuild(encodeURIComponent('测试府')); assert.equal(scrolls, 1);
    }
  });
  console.log('[smoke-building-appraisal-compat]', JSON.stringify({ pass, fail, total: pass + fail, network: 'controlled fetch only' }));
  process.exitCode = fail ? 1 : 0;
}
main().catch(error => { console.error(error.stack); process.exitCode = 1; });
