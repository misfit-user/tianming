'use strict';
const { transport, load, okay } = require('./lib-turn-reliability');

async function verifyGenericPriority(assert) {
  const fixture = transport(), queued = [];
  let fetches = 0;
  try {
    // Real helpers, option policies, recovery wrappers and queue; only HTTP is synthetic.
    ['tm-call-retry-policy.js', 'tm-endturn-response-recovery.js', 'tm-emergency-recovery-adapters.js']
      .forEach(file => load(fixture.c, file));
    fixture.c._buildAIUrl = () => 'https://fixture.invalid/v1/chat/completions';
    fixture.c.fetch = async () => {
      fetches++;
      return okay({ choices: [{ message: { content: 'offline priority fixture' }, finish_reason: 'stop' }] });
    };
    const enqueue = fixture.c._aiQueue.enqueue.bind(fixture.c._aiQueue);
    fixture.c._aiQueue.enqueue = (task, priority, options) => {
      queued.push(priority);
      return enqueue(task, priority, options);
    };
    const cases = [
      ['callAI', 'high', false], ['callAIMessages', 'critical', false],
      ['callAI', 'background', true], ['callAIMessages', 'low', true],
      ['callAI', undefined, false], ['callAIMessages', undefined, false]
    ];
    for (const [helper, priority, overload] of cases) {
      const opts = { maxRetries: 0, timeoutMs: 5000, priority };
      const args = helper === 'callAI'
        ? ['priority test prompt', 32, null]
        : [[{ role: 'user', content: 'priority test message' }], 32, null];
      if (overload) args.push({ ...opts, tier: 'primary' });
      else args.push('primary', opts);
      const before = queued.length;
      const response = await fixture.c[helper](...args);
      assert(response === 'offline priority fixture' && queued.length === before + 1
        && queued[before] === (priority || 'normal'),
      helper + ' forwards ' + (priority || 'default normal') + (overload ? ' via options overload' : '') + ' into the real request queue');
    }
    assert(fetches === cases.length, 'priority fixtures complete once each without retrying or using a real network');
  } finally {
    fixture.dispose();
  }
}

module.exports = { verifyGenericPriority };
