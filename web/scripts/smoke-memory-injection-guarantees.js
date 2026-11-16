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

function ids(packed) {
  return packed.recallResults.flatMap((r) => r.hits.map((h) => h.id));
}

const guaranteed = MR.packForInjection([
  {
    query: { purpose: 'edict crowd' },
    hits: [
      { id: 'edict-a', source: 'activeEdict', text: 'edict river works active', _score: 0.99, importance: 9 },
      { id: 'edict-b', source: 'activeEdict', text: 'edict grain levy active', _score: 0.98, importance: 9 },
      { id: 'edict-c', source: 'activeEdict', text: 'edict border patrol active', _score: 0.97, importance: 9 },
    ],
  },
  {
    query: { purpose: 'life state' },
    hits: [
      { id: 'hard-wei', source: 'hard_state', text: 'Wei Zhongxian alive Beijing', _score: 0.2, importance: 10 },
    ],
  },
  {
    query: { purpose: 'promise' },
    hits: [
      { id: 'commit-sun', source: 'commitment', text: 'Sun Chengzong promised memorial', _score: 0.4, importance: 8 },
    ],
  },
], {
  maxTokens: 75,
  perHitMaxChars: 48,
});

const guaranteedIds = ids(guaranteed);
assert(guaranteedIds.includes('hard-wei'), 'hard state should be protected even with a low score');
assert(guaranteedIds.includes('commit-sun'), 'live commitment should be protected even with a low score');
assert(guaranteedIds.includes('edict-a'), 'top active edict should be protected');
assert(!guaranteedIds.includes('edict-b') || !guaranteedIds.includes('edict-c'), 'extra edicts should give way before hard-state/commitment guarantees');
assert(guaranteed.tokenEstimate <= 75, 'guaranteed pack should stay within maxTokens');
assert(guaranteed.diagnostics, 'packForInjection should return budget diagnostics');
assert(guaranteed.diagnostics.kept.some((k) => k.id === 'hard-wei' && k.stage === 'guarantee:hard_state'), 'diagnostics should explain hard-state guarantee');
assert(guaranteed.diagnostics.kept.some((k) => k.id === 'commit-sun' && k.stage === 'guarantee:commitment'), 'diagnostics should explain commitment guarantee');
assert(guaranteed.suppressed.some((s) => s.reason === 'budget_exceeded' && s.budgetStage), 'suppressed budget drops should include budget stage');

const fair = MR.packForInjection([
  {
    query: { purpose: 'crowded query' },
    hits: [
      { id: 'edict-main', source: 'activeEdict', text: 'edict main active', _score: 0.8, importance: 9 },
      { id: 'vector-crowd-a', source: 'vector', text: 'crowded vector A', _score: 0.99, sim: 0.99 },
      { id: 'vector-crowd-b', source: 'vector', text: 'crowded vector B', _score: 0.98, sim: 0.98 },
    ],
  },
  {
    query: { purpose: 'quiet query' },
    hits: [
      { id: 'vector-quiet', source: 'vector', text: 'quiet query top hit', _score: 0.5, sim: 0.5 },
    ],
  },
], {
  maxTokens: 75,
  perHitMaxChars: 48,
});

const fairIds = ids(fair);
assert(fairIds.includes('edict-main'), 'essential hit should remain before fair fill');
assert(fairIds.includes('vector-crowd-a'), 'crowded query should keep its best ordinary hit');
assert(fairIds.includes('vector-quiet'), 'quiet query should keep one fair representative hit');
assert(!fairIds.includes('vector-crowd-b'), 'second crowded vector should be dropped before starving another query');
assert(fair.diagnostics.kept.some((k) => k.id === 'vector-quiet' && k.stage === 'fair_query'), 'diagnostics should explain fair-query keep');

const GM = { turn: 80, _turnAiResults: {} };
const trace = MT.recordRetrieval(GM, {
  id: 'SC_RECALL',
  status: 'hit',
  hits: guaranteed.recallResults.flatMap((r) => r.hits),
  suppressed: guaranteed.suppressed,
  budget: {
    maxTokens: guaranteed.maxTokens,
    tokenEstimate: guaranteed.tokenEstimate,
    diagnostics: guaranteed.diagnostics,
  },
});
assert(trace.budget.kept.some((k) => k.id === 'hard-wei' && k.stage === 'guarantee:hard_state'), 'MemoryTrace should persist kept budget diagnostics');
assert(trace.suppressed.some((s) => s.reason === 'budget_exceeded' && s.budgetStage), 'MemoryTrace should persist budget stage for dropped hits');

console.log('smoke-memory-injection-guarantees ok');
