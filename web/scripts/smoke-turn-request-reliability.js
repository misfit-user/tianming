'use strict';
const assert = require('assert/strict');
const { transport, okay, pause, load } = require('./lib-turn-reliability');
const tests = []; const test = (name, run) => tests.push({ name, run });
test('queued cancellation rejects before another HTTP request is sent', async () => {
  const f = transport(), ctrl = new AbortController(); let sent = 0, release;
  try {
    f.c.fetch = async () => { sent++; return new Promise(resolve => { release = () => resolve(okay({ done: true })); }); };
    const first = f.request(); await pause(5); const next = f.request({}, ctrl.signal); ctrl.abort();
    await assert.rejects(next, e => e.code === 'AI_ABORTED'); assert.equal(sent, 1); assert.equal(f.c._aiQueue.stats().queued, 0);
    release(); await first;
  } finally { f.dispose(); }
});
test('queue deadline removes expired work without issuing a late request', async () => {
  const f = transport(); let sent = 0, release;
  try {
    f.c.fetch = async () => { sent++; return new Promise(resolve => { release = () => resolve(okay({ done: true })); }); };
    const first = f.request(); await pause(3);
    await assert.rejects(f.request({ timeoutMs: 200, queueTimeoutMs: 12 }), e => e.code === 'AI_QUEUE_TIMEOUT'); assert.equal(sent, 1);
    release(); await first; await pause(5); assert.equal(sent, 1);
  } finally { f.dispose(); }
});
test('expired shared request budget bounds an uncooperative response', async () => {
  const f = transport(); try {
    f.c.fetch = async () => ({ ...okay({}), json: () => new Promise(() => {}) });
    const budget = f.c._aiCreateRetryBudget({ maxAttempts: 3, totalTimeoutMs: 20 });
    await assert.rejects(f.request({ timeoutMs: 200, retryBudget: budget }), e => e.code === 'AI_REQUEST_DEADLINE');
    assert.equal(budget.attempts, 1); assert.equal(f.timers.size, 0);
  } finally { f.dispose(); }
});
test('primary and repair requests consume one shared attempt budget', async () => {
  const f = transport(); let sent = 0;
  try {
    f.c.fetch = async () => { sent++; return okay({ answer: 'complete' }); };
    const retryBudget = f.c._aiCreateRetryBudget({ maxAttempts: 2, totalTimeoutMs: 200 });
    await f.request({ retryBudget }); await f.request({ retryBudget });
    await assert.rejects(f.request({ retryBudget }), e => e.code === 'AI_RETRY_BUDGET'); assert.equal(sent, 2);
  } finally { f.dispose(); }
});
test('one smaller context retry is possible even with generic retries disabled', async () => {
  const f = transport(); let sent = 0; try {
    f.c.fetch = async () => ++sent === 1 ? { ok: false, status: 400, headers: { get() { return null; } }, text: async () => 'context_length_exceeded' } : okay({ answer: 'valid' });
    const result = await f.request({ contextOverflowReducer: () => ({ messages: [], max_tokens: 8 }) });
    assert.equal(result.answer, 'valid'); assert.equal(sent, 2);
  } finally { f.dispose(); }
});
test('a rejected smaller context is not retried indefinitely', async () => {
  const f = transport(); let sent = 0; try {
    f.c.fetch = async () => { sent++; return { ok: false, status: 400, headers: { get() { return null; } }, text: async () => 'maximum context exceeded' }; };
    await assert.rejects(f.request({ contextOverflowReducer: () => ({ messages: [] }) }), e => e.code === 'context_length_exceeded'); assert.equal(sent, 2);
  } finally { f.dispose(); }
});
test('Retry-After supports seconds and HTTP dates without premature retry', () => {
  const f = transport(); try {
    assert.equal(f.c._aiRetryDelay({ headers: { get: () => '2' } }, 0), 2000);
    const when = new Date(Date.now() + 5000).toUTCString(), delay = f.c._aiRetryDelay({ headers: { get: () => when } }, 0);
    assert(delay > 3500 && delay <= 5000);
    assert(f.c._aiRetryDelay(null, 2) <= 4000);
  } finally { f.dispose(); }
});
test('a different world cannot receive a late successful response', async () => {
  const f = transport(); try {
    f.c.fetch = async () => { f.c.GM = { turn: 1 }; return okay({ late: true }); };
    await assert.rejects(f.request(), e => e.code === 'AI_STALE_WORLD');
  } finally { f.dispose(); }
});
test('changing provider configuration invalidates an in-flight result', async () => {
  const f = transport(); try {
    f.c.fetch = async () => { f.c.P.ai.model = 'different-model'; return okay({ stale: true }); };
    await assert.rejects(f.request(), e => e.code === 'AI_STALE_WORLD');
  } finally { f.dispose(); }
});
test('transport exhaustion does not restart the entire smart wrapper', async () => {
  const f = transport(); let sent = 0; try {
    f.c.fetch = async () => { sent++; throw Error('synthetic network failure'); };
    f.c.callAI = async () => f.request({ maxRetries: 0 });
    await assert.rejects(f.c.callAISmart('test', 100, { maxRetries: 3 })); assert.equal(sent, 1);
  } finally { f.dispose(); }
});
test('failed-turn diagnostics survive rollback without storing prompt or credentials', async () => {
  const f = transport(); try {
    const r = f.c.TM.Endturn.Reliability, scope = r.begin(); f.c.fetch = async () => okay({ secretBody: 'NOT_FOR_DIAGNOSTICS' });
    await f.request(); f.c.GM = { turn: 1 }; r.finish(scope, 'failed', Object.assign(Error('private text'), { code: 'AI_TIMEOUT' }));
    const history = r.snapshot(), text = JSON.stringify(history); assert.equal(history.length, 1); assert.equal(history[0].requests[0].attempts, 1);
    assert(!text.includes('fixture-only')); assert(!text.includes('fixture prompt')); assert(!text.includes('NOT_FOR_DIAGNOSTICS')); assert(!text.includes('private text'));
  } finally { f.dispose(); }
});
test('a failed turn cancels its remaining in-flight and queued requests', async () => {
  const f = transport(); try {
    const diag = f.c.TM.Endturn.Reliability, scope = diag.begin();
    f.c.fetch = async () => ({ ...okay({}), json: () => new Promise(() => {}) });
    const first = f.request(), second = f.request();
    const settled = Promise.allSettled([first, second]); await pause(3);
    diag.finish(scope, 'failed', Object.assign(Error('fixture failure'), { code: 'WORLD_VALIDATION' }));
    const results = await settled; assert(results.every(result => result.status === 'rejected' && result.reason.code === 'AI_ABORTED'));
    await pause(2); assert.equal(f.c._aiQueue.stats().inflight, 0); assert.equal(f.c._aiQueue.stats().queued, 0); assert.equal(f.timers.size, 0);
  } finally { f.dispose(); }
});
test('Agent wall-clock expiry aborts work and disposal clears its timer', async () => {
  const f = transport(); try {
    load(f.c, 'tm-agent-kernel.js'); const run = f.c.TM.AgentKernel.createRun({ enforceDeadline: true, budget: { deadlineMs: 12, maxCalls: 10 } });
    await pause(25); assert.equal(run.signal.aborted, true); assert.equal(run.signal.reason.code, 'AI_REQUEST_DEADLINE'); run.dispose(); assert.equal(f.timers.size, 0);
    const completed = f.c.TM.AgentKernel.createRun({ enforceDeadline: true, budget: { deadlineMs: 30 } }); completed.dispose(); await pause(40); assert.equal(completed.signal.aborted, false);
  } finally { f.dispose(); }
});
(async () => { let pass = 0, fail = 0; for (const t of tests) { try { await t.run(); pass++; console.log('PASS ' + t.name); } catch (e) { fail++; console.error('FAIL ' + t.name + '\n' + e.stack); } } console.log(JSON.stringify({ pass, fail, total: tests.length })); if (fail) process.exitCode = 1; })();
