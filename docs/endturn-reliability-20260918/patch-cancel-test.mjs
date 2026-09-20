import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-turn-request-reliability.js', (s, r) => r(s,
  "test('Agent wall-clock expiry",
  `test('a failed turn cancels its remaining in-flight and queued requests', async () => {
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
test('Agent wall-clock expiry`));
