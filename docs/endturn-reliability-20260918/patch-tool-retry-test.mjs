import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-turn-stream-reliability.js', (s, r) => r(s, '(async () => {', `test('a transient native tool server failure retries within the original request budget', async () => {
  const f = setup(); let sent = 0; try {
    f.c._aiRetryDelay = () => 1;
    f.c.fetch = async () => ++sent === 1 ? { ok: false, status: 503, headers: { get: () => null }, text: async () => 'temporary fixture error' } : okay({ choices: [{ message: { tool_calls: [{ function: { name: 'inspect', arguments: '{}' } }] } }] });
    const retryBudget = f.c._aiCreateRetryBudget({ maxAttempts: 2, totalTimeoutMs: 200 });
    const result = await f.c.callAIWithTools('test', toolDefs, { timeoutMs: 200, maxRetries: 1, retryBudget });
    assert.equal(result.toolCalls[0].name, 'inspect'); assert.equal(sent, 2); assert.equal(retryBudget.attempts, 2);
  } finally { f.dispose(); }
});
(async () => {`));
