'use strict';
const assert = require('assert/strict');
const { transport, okay, pause } = require('./lib-turn-reliability');
const tests = []; const test = (name, run) => tests.push({ name, run });
function setup() {
  const f = transport(); f.c._buildAIUrl = () => 'https://fixture.invalid/v1/chat/completions';
  f.c._aiEffectiveTierIsSecondary = () => false;
  return f;
}
function body() { return { model: 'fixture', messages: [{ role: 'user', content: 'exact audited input' }], max_tokens: 32, temperature: 0, response_format: { type: 'json_object' } }; }
test('finalized-body streaming preserves audited request bytes except stream flag', async () => {
  const f = setup(); let actual; try {
    f.c.fetch = async (_url, opts) => { actual = JSON.parse(opts.body); return { ...okay({ choices: [{ message: { content: '{"complete":true}' } }] }), headers: { get: () => 'application/json' } }; };
    const original = body(), before = JSON.stringify(original);
    const result = await f.c.callAIBodyStream(original, { timeoutMs: 200 }); assert.equal(result, '{"complete":true}');
    assert.deepEqual(actual, { ...original, stream: true }); assert.equal(JSON.stringify(original), before); assert.equal(f.timers.size, 0);
  } finally { f.dispose(); }
});
test('an uncooperative SSE reader cannot hold the queue after deadline', async () => {
  const f = setup(); let cancelled = 0, complete = 0; try {
    f.c.fetch = async () => ({ ok: true, status: 200, headers: { get: () => 'text/event-stream' }, body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: async () => { cancelled++; }, releaseLock() {} }) } });
    await assert.rejects(f.c.callAIBodyStream(body(), { timeoutMs: 15, totalResponseTimeoutMs: 15, onDone() { complete++; } }), e => e.code === 'AI_REQUEST_DEADLINE' || e.code === 'AI_TIMEOUT');
    await pause(5); assert.equal(f.c._aiQueue.stats().inflight, 0); assert.equal(complete, 0); assert.equal(cancelled, 1); assert.equal(f.timers.size, 0);
  } finally { f.dispose(); }
});
test('queued stream cancellation never sends a second inference request', async () => {
  const f = setup(), ctrl = new AbortController(); let release, sent = 0;
  try {
    f.c.fetch = async () => { sent++; return new Promise(resolve => { release = () => resolve({ ...okay({ choices: [{ message: { content: 'done' } }] }), headers: { get: () => 'application/json' } }); }); };
    const first = f.c.callAIBodyStream(body(), { timeoutMs: 200 }); await pause(3);
    const next = f.c.callAIBodyStream(body(), { timeoutMs: 200, signal: ctrl.signal }); ctrl.abort();
    await assert.rejects(next, e => e.code === 'AI_ABORTED'); release(); await first; assert.equal(sent, 1);
  } finally { f.dispose(); }
});
test('late stream completion after a world switch cannot publish onDone', async () => {
  const f = setup(); let complete = 0; try {
    f.c.fetch = async () => { f.c.GM = { turn: 2 }; return { ...okay({ choices: [{ message: { content: 'late' } }] }), headers: { get: () => 'application/json' } }; };
    await assert.rejects(f.c.callAIBodyStream(body(), { timeoutMs: 200, onDone() { complete++; } }), e => e.code === 'AI_STALE_WORLD'); assert.equal(complete, 0);
  } finally { f.dispose(); }
});
test('legacy message streams also receive queued cancellation and exact successful content', async () => {
  const f = setup(); try {
    f.c.fetch = async () => ({ ...okay({ choices: [{ message: { content: '完整正文' } }] }), headers: { get: () => 'application/json' } });
    assert.equal(await f.c.callAIMessagesStream([{ role: 'user', content: 'test' }], 32, { timeoutMs: 200 }), '完整正文');
    const ctrl = new AbortController(); ctrl.abort(); await assert.rejects(f.c.callAIMessagesStream([], 32, { signal: ctrl.signal }), e => e.code === 'AI_ABORTED');
  } finally { f.dispose(); }
});
const toolDefs = [{ name: 'inspect', description: 'fixture only', parameters: { type: 'object', properties: {} } }];
test('native tool requests preserve successful tool-call payloads', async () => {
  const f = setup(); try {
    f.c.fetch = async () => okay({ choices: [{ message: { tool_calls: [{ function: { name: 'inspect', arguments: '{}' } }] } }] });
    const result = await f.c.callAIWithTools('test', toolDefs, { timeoutMs: 200 }); assert.equal(result.toolCalls[0].name, 'inspect'); assert.equal(f.timers.size, 0);
  } finally { f.dispose(); }
});
test('native tools reject an uncooperative body and release the shared queue', async () => {
  const f = setup(); try {
    f.c.fetch = async () => ({ ...okay({}), json: () => new Promise(() => {}) });
    const result = await f.c.callAIWithTools('test', toolDefs, { timeoutMs: 15, totalResponseTimeoutMs: 15 }); assert(result.error); assert.equal(result.toolCalls.length, 0);
    await pause(5); assert.equal(f.c._aiQueue.stats().inflight, 0); assert.equal(f.timers.size, 0);
  } finally { f.dispose(); }
});
test('authentication failure does not launch a second JSON-fallback request', async () => {
  const f = setup(); let sent = 0; try {
    f.c.fetch = async () => { sent++; return { ok: false, status: 401, text: async () => 'fixture auth failure' }; };
    const result = await f.c.callAIWithTools('test', toolDefs, { timeoutMs: 200 }); assert.equal(sent, 1); assert.equal(result.error.status, 401);
  } finally { f.dispose(); }
});
test('Agent tool requests cancel while queued, without another POST', async () => {
  const f = setup(), ctrl = new AbortController(); let sent = 0, release;
  try {
    f.c.fetch = async () => { sent++; return new Promise(resolve => { release = () => resolve(okay({ choices: [{ message: { tool_calls: [{ function: { name: 'inspect', arguments: '{}' } }] } }] })); }); };
    const first = f.c.callAIWithTools('test', toolDefs, { timeoutMs: 200 }); await pause(3);
    const second = f.c.callAIWithTools('test', toolDefs, { timeoutMs: 200, signal: ctrl.signal }); ctrl.abort();
    const result = await second; assert.equal(result.error.code, 'aborted'); assert.equal(sent, 1); release(); await first;
  } finally { f.dispose(); }
});
test('native compatibility fallback consumes the same attempt allowance', async () => {
  const f = setup(); let sent = 0; try {
    f.c.fetch = async () => { sent++; return { ok: false, status: 400, text: async () => 'tool interface not supported' }; };
    const retryBudget = f.c._aiCreateRetryBudget({ maxAttempts: 1, totalTimeoutMs: 200 });
    const result = await f.c.callAIWithTools('test', toolDefs, { timeoutMs: 200, maxRetries: 0, retryBudget });
    assert(result.error); assert.equal(sent, 1); assert.equal(retryBudget.attempts, 1);
  } finally { f.dispose(); }
});
test('a transient native tool server failure retries within the original request budget', async () => {
  const f = setup(); let sent = 0; try {
    f.c._aiRetryDelay = () => 1;
    f.c.fetch = async () => ++sent === 1 ? { ok: false, status: 503, headers: { get: () => null }, text: async () => 'temporary fixture error' } : okay({ choices: [{ message: { tool_calls: [{ function: { name: 'inspect', arguments: '{}' } }] } }] });
    const retryBudget = f.c._aiCreateRetryBudget({ maxAttempts: 2, totalTimeoutMs: 200 });
    const result = await f.c.callAIWithTools('test', toolDefs, { timeoutMs: 200, maxRetries: 1, retryBudget });
    assert.equal(result.toolCalls[0].name, 'inspect'); assert.equal(sent, 2); assert.equal(retryBudget.attempts, 2);
  } finally { f.dispose(); }
});
(async () => { let pass = 0, fail = 0; for (const t of tests) { try { await t.run(); pass++; console.log('PASS ' + t.name); } catch (e) { fail++; console.error('FAIL ' + t.name + '\n' + e.stack); } } console.log(JSON.stringify({ pass, fail, total: tests.length })); if (fail) process.exitCode = 1; })();
