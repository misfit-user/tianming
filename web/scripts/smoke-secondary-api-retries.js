'use strict';
// Offline requests only: count the actual transport sends, including primary fallback.
const assert = require('assert/strict');
const { transport, load } = require('./lib-turn-reliability');
const tests = [], test = (name, fn) => tests.push({ name, fn });
const bad = status => ({ ok: false, status, headers: { get() { return null; } }, text: async () => '{"error":"fixture"}' });
const good = () => ({ ok: true, status: 200, headers: { get() { return 'application/json'; } }, json: async () => ({ choices: [{ message: { content: '完整结果', tool_calls: [{ id: 'fixture', type: 'function', function: { name: 'read_world', arguments: '{}' } }] }, finish_reason: 'stop' }] }) });
const messages = [{ role: 'user', content: '完整测试请求' }];
const definitions = [{ name: 'read_world', parameters: { type: 'object', properties: {} } }];
function fixture(retries) {
  const f = transport(), c = f.c;
  load(c, 'tm-call-retry-policy.js'); load(c, 'tm-ai-request-options.js');
  c.P.ai.secondary = { key: 'fixture-secondary', url: 'https://secondary.invalid/v1', model: 'qwen3-fixture' };
  c._getAITier = tier => Object.assign({}, tier === 'secondary' && c.P.ai.secondary.key && c.P.conf.secondaryEnabled !== false ? c.P.ai.secondary : c.P.ai, { tier: tier === 'secondary' && c.P.ai.secondary.key && c.P.conf.secondaryEnabled !== false ? 'secondary' : 'primary' });
  c._buildAIUrlForTier = tier => c._getAITier(tier).url + '/chat/completions';
  c._buildAIUrl = () => c._buildAIUrlForTier('primary'); c._aiRetryDelay = () => 1;
  if (retries !== undefined) c.P.conf.aiSecondaryRetryCount = retries;
  const requests = []; f.requests = requests;
  f.respond = responder => { c.fetch = async (url, options) => { const row = { url, headers: options.headers, body: JSON.parse(options.body) }; requests.push(row); return responder(row, requests.length); }; };
  return f;
}
const routes = {
  json: (f, extra) => f.request(Object.assign({ tier: 'secondary', maxRetries: 0 }, extra)),
  prompt: (f, extra) => f.c.callAI('完整测试请求', 100, null, 'secondary', Object.assign({ maxRetries: 0 }, extra)),
  messages: (f, extra) => f.c.callAIMessages(messages, 100, null, 'secondary', Object.assign({ maxRetries: 0 }, extra)),
  stream: (f, extra) => f.c.callAIMessagesStream(messages, 100, Object.assign({ tier: 'secondary', maxRetries: 0 }, extra)),
  bodyStream: (f, extra) => f.c.callAIBodyStream({ model: 'qwen3-fixture', messages, max_tokens: 100 }, Object.assign({ tier: 'secondary', maxRetries: 0 }, extra)),
  tools: (f, extra) => f.c.callAIWithTools('完整测试请求', definitions, Object.assign({ tier: 'secondary', maxRetries: 0, maxTok: 100 }, extra)),
  emptyTools: (f, extra) => f.c.callAIWithTools('完整测试请求', [], Object.assign({ tier: 'secondary', maxRetries: 0, maxTok: 100 }, extra)),
  smart: (f, extra) => f.c.callAISmart('完整测试请求', 100, Object.assign({ tier: 'secondary', maxRetries: 8, fetchMaxRetries: 0 }, extra))
};
async function failed(run) { try { const result = await run(); assert(result && result.error, 'expected failed tool result'); } catch (e) { if (e.code === 'ERR_ASSERTION') throw e; } }
for (const [name, run] of Object.entries(routes)) {
  for (const count of [undefined, 0, 3, 20]) test(name + ' default or configured retry count ' + count, async () => {
    const f = fixture(count); try { f.respond(() => bad(503)); await failed(() => run(f)); assert.equal(f.requests.length, (count === undefined ? 1 : count) + 1); } finally { f.dispose(); }
  });
  test(name + ' succeeds on the last permitted request without another send', async () => {
    const f = fixture(2); try { f.respond((_row, n) => n < 3 ? bad(429) : good()); const result = await run(f); assert(!result.error); assert.equal(f.requests.length, 3); } finally { f.dispose(); }
  });
  test(name + ' permanent auth failure is never retried', async () => {
    const f = fixture(20); try { f.respond(() => bad(401)); await failed(() => run(f)); assert.equal(f.requests.length, 1); } finally { f.dispose(); }
  });
  test(name + ' unconfirmed native request is never repeated', async () => {
    const f = fixture(20); try { f.respond(() => { const e = new TypeError('fetch network failure'); e._tmNativeTransport = true; throw e; }); await failed(() => run(f)); assert.equal(f.requests.length, 1); } finally { f.dispose(); }
  });
}
test('priority is explicit ID/base, secondary count, turn wildcard, old primary callsite', () => {
  const f = fixture(2); try {
    const p = f.c.TM.CallRetryPolicy; f.c.P.conf.aiCallRetryOverrides = { '*': 9, sc25c: 4, 'sc25c:exact': 0 };
    assert.equal(p.options({ id: 'sc25c:exact', tier: 'secondary' }).maxRetries, 0);
    assert.equal(p.options({ id: 'sc25c:other', tier: 'secondary' }).maxRetries, 4);
    assert.equal(p.options({ id: 'sc19', tier: 'secondary' }).maxRetries, 2);
    assert.equal(p.options({ id: 'sc19', tier: 'primary' }).maxRetries, 9);
    assert.equal(p.options({ id: 'other', tier: 'primary', maxRetries: 6 }).maxRetries, 6);
    assert.equal(p.options({ tier: 'secondary', maxRetries: 0, _turnRetriesResolved: true }).maxRetries, 0);
  } finally { f.dispose(); }
});
for (const name of ['prompt', 'messages', 'stream']) {
  for (const count of [0, 1, 3]) test(name + ' network fallback consumes retry allowance ' + count, async () => {
    const f = fixture(count); try {
      f.respond(() => { throw new TypeError('fetch network unavailable'); });
      await failed(() => routes[name](f)); assert.equal(f.requests.length, count + 1);
      assert(f.requests[0].url.includes('secondary.invalid'));
      assert(f.requests.slice(1).every(row => row.url.includes('fixture.invalid')));
    } finally { f.dispose(); }
  });
  test(name + ' primary fallback rebuilds model, key and thinking protocol', async () => {
    const f = fixture(1); try {
      f.c.P.ai.model = 'gpt-5'; f.c.P.ai.thinking = true; f.c.P.ai.secondary.thinking = false;
      f.respond((_row, n) => { if (n === 1) throw new TypeError('fetch network unavailable'); return good(); });
      const result = await routes[name](f); assert.equal(result, '完整结果'); assert.equal(f.requests.length, 2);
      const [secondary, primary] = f.requests;
      assert.equal(secondary.body.enable_thinking, false); assert.equal(primary.body.enable_thinking, undefined);
      assert.equal(primary.body.model, 'gpt-5'); assert.equal(primary.body.reasoning_effort, 'high');
      assert.equal(primary.headers.Authorization, 'Bearer fixture-only'); assert.equal(secondary.headers.Authorization, 'Bearer fixture-secondary');
      assert.deepEqual(primary.body.messages, secondary.body.messages);
    } finally { f.dispose(); }
  });
}
test('HTTP errors spent before a network fallback do not replenish its retries', async () => {
  const f = fixture(2); try {
    f.respond((_row, n) => { if (n === 2) throw new TypeError('fetch network unavailable'); return bad(502); });
    await failed(() => routes.prompt(f)); assert.equal(f.requests.length, 3);
    assert(f.requests[0].url.includes('secondary.invalid')); assert(f.requests[1].url.includes('secondary.invalid')); assert(f.requests[2].url.includes('fixture.invalid'));
  } finally { f.dispose(); }
});
test('active retry count remains fixed when the setting changes', async () => {
  const f = fixture(1); try { f.respond(() => { f.c.P.conf.aiSecondaryRetryCount = 20; return bad(502); }); await failed(() => routes.prompt(f)); assert.equal(f.requests.length, 2); } finally { f.dispose(); }
});
for (const name of ['prompt', 'messages', 'tools', 'emptyTools', 'stream']) test(name + ' internal single attempt remains single after wrapper forwarding', async () => {
  const f = fixture(20); try { f.respond(() => bad(502)); await failed(() => routes[name](f, { maxRetries: 0, _turnRetriesResolved: true, _configuredRetries: false, _noSecFallback: true, _emergency: true })); assert.equal(f.requests.length, 1); } finally { f.dispose(); }
});
test('stream with partial output never falls back or duplicates output', async () => {
  const f = fixture(20), chunks = []; try {
    f.respond(() => { let read = 0; return { ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body: { getReader: () => ({ read: async () => { if (!read++) return { done: false, value: new TextEncoder().encode('data: {"choices":[{"delta":{"content":"已有正文"}}]}\n\n') }; throw new TypeError('fetch network interrupted'); }, cancel: async () => {}, releaseLock() {} }) } }; });
    await assert.rejects(routes.stream(f, { onChunk: chunk => chunks.push(chunk) })); assert.equal(f.requests.length, 1); assert.deepEqual(chunks, ['已有正文']);
  } finally { f.dispose(); }
});
test('cancel during backoff stops both retry and fallback', async () => {
  const f = fixture(20), controller = new AbortController(); try {
    f.c._aiRetryDelay = () => 10000; f.respond(() => { setTimeout(() => controller.abort(), 5); return bad(502); });
    await assert.rejects(f.c.callAI('完整请求', 100, controller.signal, 'secondary'), e => e.code === 'AI_ABORTED'); assert.equal(f.requests.length, 1);
  } finally { f.dispose(); }
});
test('configured secondary JSON first-response timeouts use the same allowance', async () => {
  const f = fixture(2); try { f.respond((_row, n) => n < 3 ? new Promise(() => {}) : good()); const result = await routes.prompt(f, { firstResponseTimeoutMs: 10 }); assert.equal(result, '完整结果'); assert.equal(f.requests.length, 3); } finally { f.dispose(); }
});
test('cancel during timeout backoff stops the next send and cleans external listeners', async () => {
  const f = fixture(2), controller = new AbortController(); let cancel;
  try {
    f.c._aiRetryDelay = () => 10000; f.respond(() => new Promise(() => {}));
    cancel = setTimeout(() => controller.abort(), 30);
    await assert.rejects(f.c.callAI('完整请求', 100, controller.signal, 'secondary', { firstResponseTimeoutMs: 10 }), e => e.code === 'AI_ABORTED');
    assert.equal(f.requests.length, 1); assert.equal(require('node:events').getEventListeners(controller.signal, 'abort').length, 0);
    assert.equal(f.c._aiWaitSnapshot().length, 0);
  } finally { clearTimeout(cancel); f.dispose(); }
});
test('invalid counts never reach the network', async () => {
  for (const value of [-1, 1.5, 21, Infinity, '5oops']) {
    const f = fixture(value); try { f.respond(good); await assert.rejects(routes.prompt(f), e => e.code === 'AI_RETRY_CONFIG'); assert.equal(f.requests.length, 0); } finally { f.dispose(); }
  }
});
test('secondary setting does not alter ordinary primary retries', async () => {
  const f = fixture(20); try { f.respond(() => bad(502)); await assert.rejects(f.c.callAI('primary', 100, null, 'primary', { maxRetries: 0 })); assert.equal(f.requests.length, 1); } finally { f.dispose(); }
});
for (const state of ['disabled', 'unconfigured']) for (const name of ['prompt', 'messages']) test(name + ' secondary ' + state + ' retains actual primary default', async () => {
  const f = fixture(20); try {
    if (state === 'disabled') f.c.P.conf.secondaryEnabled = false; else f.c.P.ai.secondary.key = '';
    f.respond(() => bad(502));
    const run = name === 'prompt' ? () => f.c.callAI('完整请求', 100, null, 'secondary') : () => f.c.callAIMessages(messages, 100, null, 'secondary');
    await failed(run); assert.equal(f.requests.length, 4); assert(f.requests.every(row => row.url.includes('fixture.invalid')));
  } finally { f.dispose(); }
});
test('world change on a failing secondary request cannot start a new primary fallback', async () => {
  const f = fixture(1); try {
    f.respond(() => { f.c.GM.turn++; throw new TypeError('fetch network unavailable'); });
    await assert.rejects(routes.prompt(f), e => e.code === 'AI_STALE_WORLD'); assert.equal(f.requests.length, 1);
  } finally { f.dispose(); }
});
test('finalized secondary stream never changes model or request bytes during retries', async () => {
  const f = fixture(2); try {
    f.respond(() => { throw new TypeError('fetch network unavailable'); });
    await assert.rejects(routes.bodyStream(f)); assert.equal(f.requests.length, 3);
    assert(f.requests.every(row => row.url.includes('secondary.invalid'))); assert(f.requests.every(row => JSON.stringify(row.body) === JSON.stringify(f.requests[0].body)));
  } finally { f.dispose(); }
});
(async () => { let pass = 0, fail = 0; for (const t of tests) { try { await t.fn(); pass++; console.log('PASS ' + t.name); } catch (e) { fail++; console.error('FAIL ' + t.name + '\n' + e.stack); } } console.log(JSON.stringify({ pass, fail, total: tests.length })); if (fail) process.exitCode = 1; })();
