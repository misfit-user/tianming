const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'tm-memory-trace.js'), 'utf8');
const renderSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-render.js'), 'utf8');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;
vm.runInNewContext(src, sandbox.window, { filename: 'tm-memory-trace.js' });

const MT = sandbox.window.TM && sandbox.window.TM.MemoryTrace;
assert(MT, 'TM.MemoryTrace should be exported');
assert.strictEqual(typeof MT.finalizeTurnTrace, 'function', 'MemoryTrace should expose finalizeTurnTrace');
assert.strictEqual(typeof MT.summarize, 'function', 'MemoryTrace should expose summarize');

const GM = { turn: 22, _turnAiResults: {} };
MT.ensureTurnTrace(GM, { source: 'persist-smoke' });
MT.recordSubcall(GM, {
  id: 'sc0',
  label: 'thinking',
  prompt: 'SECRET_PROMPT_FOR_PERSIST'.repeat(20),
  response: 'SECRET_RESPONSE_FOR_PERSIST'.repeat(10),
  usage: { prompt_tokens: 30, completion_tokens: 12, total_tokens: 42 },
  latencyMs: 150,
  ok: true,
});
MT.recordRetrieval(GM, {
  id: 'SC_RECALL',
  status: 'hit',
  sources: { shiji: 1 },
  hits: [{ id: 'h1', source: 'shiji', text: 'SECRET_RETRIEVAL_TEXT'.repeat(20), _score: 0.8 }],
});
MT.recordInjection(GM, {
  lane: 'L6_retrieved_evidence',
  stage: 'sc05',
  text: 'SECRET_INJECTION_TEXT'.repeat(20),
  tokenEstimate: 60,
});

const finalized = MT.finalizeTurnTrace(GM);
assert(finalized.completedAt, 'finalized trace should have completedAt');
assert(finalized.summary, 'finalized trace should have summary');
assert.strictEqual(finalized.summary.subcalls, 1, 'summary should count subcalls');
assert.strictEqual(finalized.summary.retrievals, 1, 'summary should count retrievals');
assert.strictEqual(finalized.summary.injections, 1, 'summary should count injections');
assert.strictEqual(finalized.summary.totalTokens, 42, 'summary should total model usage tokens');
assert.strictEqual(finalized.summary.injectedTokensEstimate, 60, 'summary should total injected token estimate');
assert.strictEqual(finalized.summary.sources.shiji, 1, 'summary should keep retrieval source counts');

const persistedJson = JSON.stringify({ aiResults: GM._turnAiResults });
assert(persistedJson.includes('"memoryTrace"'), 'persisted aiResults should include memoryTrace');
assert(!persistedJson.includes('SECRET_PROMPT_FOR_PERSIST'), 'persisted trace must not include raw prompts');
assert(!persistedJson.includes('SECRET_RESPONSE_FOR_PERSIST'), 'persisted trace must not include raw responses');
assert(!persistedJson.includes('SECRET_RETRIEVAL_TEXTSECRET_RETRIEVAL_TEXTSECRET_RETRIEVAL_TEXT'), 'persisted trace must bound retrieval text');
assert(!persistedJson.includes('SECRET_INJECTION_TEXTSECRET_INJECTION_TEXTSECRET_INJECTION_TEXT'), 'persisted trace must bound injection text');

const finalizeIdx = renderSrc.indexOf('TM.MemoryTrace.finalizeTurnTrace');
const aiResultsIdx = renderSrc.indexOf('var aiResults=GM._turnAiResults||{};');
assert(finalizeIdx >= 0, 'record finalization should finalize MemoryTrace before staging desktop turn data');
assert(aiResultsIdx >= 0, 'render should still write aiResults from GM._turnAiResults');
assert(finalizeIdx < aiResultsIdx, 'MemoryTrace should be finalized before aiResults is captured for staged turn data');

console.log('smoke-memory-trace-persist ok');
