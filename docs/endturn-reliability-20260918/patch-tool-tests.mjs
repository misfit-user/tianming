import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-turn-stream-reliability.js', (s, r) => r(s, '(async () => {', `const toolDefs = [{ name: 'inspect', description: 'fixture only', parameters: { type: 'object', properties: {} } }];
test('native tool requests preserve successful tool-call payloads', async () => {
  const f = setup(); try {
    f.c.fetch = async () => okay({ choices: [{ message: { tool_calls: [{ function: { name: 'inspect', arguments: '{}' } }] } }] });
    const result = await f.c.callAIWithTools('test', toolDefs, { timeoutMs: 200 }); assert.equal(result.toolCalls[0].name, 'inspect'); assert.equal(f.timers.size, 0);
  } finally { f.dispose(); }
});
test('native tools reject an uncooperative body and release the shared queue', async () => {
  const f = setup(); try {
    f.c.fetch = async () => ({ ...okay({}), json: () => new Promise(() => {}) });
    const result = await f.c.callAIWithTools('test', toolDefs, { timeoutMs: 15 }); assert(result.error); assert.equal(result.toolCalls.length, 0);
    await pause(5); assert.equal(f.c._aiQueue.stats().inflight, 0); assert.equal(f.timers.size, 0);
  } finally { f.dispose(); }
});
test('authentication failure does not launch a second JSON-fallback request', async () => {
  const f = setup(); let sent = 0; try {
    f.c.fetch = async () => { sent++; return { ok: false, status: 401, text: async () => 'fixture auth failure' }; };
    const result = await f.c.callAIWithTools('test', toolDefs, { timeoutMs: 200 }); assert.equal(sent, 1); assert.equal(result.error.status, 401);
  } finally { f.dispose(); }
});
(async () => {`));
edit('web/scripts/smoke-turn-stream-reliability.js', (s, r) => r(s, '(async () => {', `test('Agent tool requests cancel while queued, without another POST', async () => {
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
(async () => {`));
