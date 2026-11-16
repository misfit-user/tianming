const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-memory-retrieval.js'), 'utf8');
const traceSrc = fs.readFileSync(path.join(ROOT, 'tm-memory-trace.js'), 'utf8');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;
vm.runInNewContext(src, sandbox.window, { filename: 'tm-memory-retrieval.js' });
vm.runInNewContext(traceSrc, sandbox.window, { filename: 'tm-memory-trace.js' });

const MR = sandbox.window.TM && sandbox.window.TM.MemoryRetrieval;
const MT = sandbox.window.TM && sandbox.window.TM.MemoryTrace;
assert(MR, 'TM.MemoryRetrieval should be exported');
assert.strictEqual(typeof MR.packForInjection, 'function', 'MemoryRetrieval should expose packForInjection');

const recallResults = [
  {
    query: { purpose: 'budget smoke' },
    hits: [
      { id: 'edict-live', source: 'activeEdict', text: 'active edict must stay '.repeat(4), _score: 0.95, turn: 40, importance: 9 },
      { id: 'vector-long-a', source: 'vector', text: 'long vector candidate A '.repeat(30), _score: 0.65, turn: 39, sim: 0.9 },
      { id: 'commit-live', source: 'commitment', text: 'live commitment must stay '.repeat(4), _score: 0.85, turn: 41, importance: 8 },
      { id: 'vector-long-b', source: 'vector', text: 'long vector candidate B '.repeat(30), _score: 0.6, turn: 38, sim: 0.8 },
    ],
  },
];

const packed = MR.packForInjection(recallResults, {
  maxTokens: 90,
  perHitMaxChars: 96,
});

const keptIds = packed.recallResults.flatMap((r) => r.hits.map((h) => h.id));
assert(keptIds.includes('edict-live'), 'active edict should be kept under budget');
assert(keptIds.includes('commit-live'), 'live commitment should be kept under budget');
assert(!keptIds.includes('vector-long-a') || !keptIds.includes('vector-long-b'), 'at least one low-priority vector should be dropped by budget');
assert(packed.tokenEstimate <= 90, 'packed token estimate should stay within maxTokens');
assert(packed.suppressed.some((s) => s.reason === 'budget_exceeded' && String(s.id).startsWith('vector-long')), 'budget drops should be reported');

const GM = { turn: 42, _turnAiResults: {} };
const trace = MT.recordRetrieval(GM, {
  id: 'SC_RECALL',
  status: 'hit',
  hits: packed.recallResults.flatMap((r) => r.hits),
  suppressed: packed.suppressed,
  budget: { maxTokens: packed.maxTokens, tokenEstimate: packed.tokenEstimate },
});
assert(trace.suppressed.some((s) => s.reason === 'budget_exceeded'), 'budget drops should persist into MemoryTrace');
assert.strictEqual(trace.budget.maxTokens, 90, 'MemoryTrace should persist recall budget cap');
assert(trace.budget.tokenEstimate <= 90, 'MemoryTrace should persist recall budget estimate');

console.log('smoke-memory-retrieval-budget ok');
