// Smoke test for end-turn AI call scheduling policy.
// Run with: node scripts/smoke-endturn-ai-policy.js
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const code = fs.readFileSync(path.join(root, 'tm-endturn-ai.js'), 'utf8');

const sandbox = {
  console,
  TM: {},
  P: { ai: {}, conf: {} },
  GM: {},
};
sandbox.global = sandbox;

vm.runInNewContext(code, sandbox, { filename: 'tm-endturn-ai.js' });

const policy = sandbox.TM
  && sandbox.TM.Endturn
  && sandbox.TM.Endturn.AI
  && sandbox.TM.Endturn.AI.subcalls
  && sandbox.TM.Endturn.AI.subcalls.getCallPolicy;

if (typeof policy !== 'function') {
  throw new Error('TM.Endturn.AI.subcalls.getCallPolicy must be exported');
}

function assertPolicy(id, expected) {
  const got = policy(id);
  for (const [key, value] of Object.entries(expected)) {
    if (got[key] !== value) {
      throw new Error(`${id}.${key} expected ${value}, got ${got[key]}`);
    }
  }
}

assertPolicy('sc1', { priority: 'critical', timeoutMs: 150000, maxRetries: 1 });
assertPolicy('sc1b', { priority: 'high', timeoutMs: 90000, maxRetries: 1 });
assertPolicy('sc1c', { priority: 'high', timeoutMs: 90000, maxRetries: 1 });
assertPolicy('sc1d', { priority: 'high', timeoutMs: 90000, maxRetries: 1 });
assertPolicy('sc15', { priority: 'normal', timeoutMs: 90000, maxRetries: 1 });
assertPolicy('sc27', { priority: 'high', timeoutMs: 60000, maxRetries: 1 });
assertPolicy('sc28', { priority: 'low', timeoutMs: 45000, maxRetries: 1 });
assertPolicy('sc_consolidate', { priority: 'low', timeoutMs: 45000, maxRetries: 1 });

const unknown = policy('unknown');
if (unknown.timeoutMs !== 90000 || unknown.maxRetries !== 1 || unknown.priority !== 'normal') {
  throw new Error('unknown subcall should get safe normal defaults');
}

console.log('smoke-endturn-ai-policy: ok');
