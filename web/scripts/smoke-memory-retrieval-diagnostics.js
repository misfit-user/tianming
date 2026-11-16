const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const retrievalSrc = fs.readFileSync(path.join(ROOT, 'tm-memory-retrieval.js'), 'utf8');
const traceSrc = fs.readFileSync(path.join(ROOT, 'tm-memory-trace.js'), 'utf8');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;
vm.runInNewContext(retrievalSrc, sandbox.window, { filename: 'tm-memory-retrieval.js' });
vm.runInNewContext(traceSrc, sandbox.window, { filename: 'tm-memory-trace.js' });

const MR = sandbox.window.TM && sandbox.window.TM.MemoryRetrieval;
const MT = sandbox.window.TM && sandbox.window.TM.MemoryTrace;
assert(MR, 'TM.MemoryRetrieval should be exported');
assert(MT, 'TM.MemoryTrace should be exported');
assert.strictEqual(typeof MR.rankHitsDetailed, 'function', 'MemoryRetrieval should expose rankHitsDetailed');

const GM = {
  turn: 50,
  _turnAiResults: {},
  _edictRelations: [{ from: 'new-policy', to: 'old-policy', type: 'supersedes', reason: 'new wins' }],
  _memEdges: [{ src: 'hard-alive', dst: 'vector-dead', type: 'contradicts', reason: 'hard state says alive' }],
};

const detailed = MR.rankHitsDetailed([
  { id: 'keep', source: 'shiji', text: 'valid evidence', turn: 49, importance: 5 },
  { id: 'hidden', source: 'vector', text: 'hidden evidence', visibility: 'hidden', turn: 49, sim: 0.9 },
  { id: 'expired', source: 'vector', text: 'expired evidence', expiresTurn: 48, turn: 47, sim: 0.9 },
  { id: 'closed', source: 'commitment', text: 'closed task', status: 'completed', turn: 45, importance: 9 },
  { id: 'old-policy', source: 'imperialEdict', text: 'old policy text', status: 'active', turn: 10, importance: 10 },
  { id: 'new-policy', source: 'imperialEdict', text: 'new policy text', status: 'active', turn: 49, importance: 10 },
  { id: 'hard-alive', source: 'hard_state', text: 'hard state: alive', turn: 50, importance: 10 },
  { id: 'vector-dead', source: 'vector', text: 'vector rumor: dead', turn: 20, sim: 0.99 },
], { turn: 50, GM });

assert.strictEqual(detailed.ranked.length, 3, 'detailed rank should keep valid, superseding, and hard-state hits');
assert(detailed.ranked.some((h) => h.id === 'keep'), 'valid hit should remain');
assert(detailed.ranked.some((h) => h.id === 'new-policy'), 'superseding hit should remain');
assert(detailed.ranked.some((h) => h.id === 'hard-alive'), 'hard state should remain');
assert.strictEqual(detailed.suppressed.length, 5, 'detailed rank should report all suppressed hits');
assert(detailed.suppressed.some((s) => s.id === 'hidden' && s.reason === 'hidden'), 'hidden suppression should be reported');
assert(detailed.suppressed.some((s) => s.id === 'expired' && s.reason === 'expired'), 'expired suppression should be reported');
assert(detailed.suppressed.some((s) => s.id === 'closed' && s.reason === 'closed_status'), 'closed status suppression should be reported');
assert(detailed.suppressed.some((s) => s.id === 'old-policy' && s.reason === 'superseded'), 'superseded suppression should be reported');
assert(detailed.suppressed.some((s) => s.id === 'vector-dead' && s.reason === 'contradicted'), 'contradicted suppression should be reported');

const retrieval = MT.recordRetrieval(GM, {
  id: 'SC_RECALL',
  status: 'hit',
  hits: detailed.ranked,
  suppressed: detailed.suppressed,
});
assert.strictEqual(retrieval.suppressed.length, 5, 'MemoryTrace should persist bounded suppressed diagnostics');
assert(retrieval.suppressed.some((s) => s.reason === 'contradicted'), 'MemoryTrace should persist contradicted suppression reason');
assert(!JSON.stringify(retrieval).includes('hidden evidencehidden evidence'), 'suppressed diagnostics should not store long raw text');

console.log('smoke-memory-retrieval-diagnostics ok');
