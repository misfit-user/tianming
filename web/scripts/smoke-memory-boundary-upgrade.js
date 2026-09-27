'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const FILES = ['tm-memory-envelope.js', 'tm-memory-governance.js', 'tm-memory-retrieval.js', 'tm-memory-trace.js', 'tm-context-zones.js', 'tm-memory-context-compiler.js'];
function load(files = FILES, extra = {}) {
  const ctx = Object.assign({ console, Date, Math, JSON, Number }, extra);
  ctx.window = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  for (const file of files) vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
  return ctx.TM;
}
let passed = 0, failed = 0;
function check(name, fn) {
  try { fn(); passed++; console.log('PASS ' + name); }
  catch (error) { failed++; console.error('FAIL ' + name + '\n' + error.stack); }
}
function ids(hits) { return Array.from(hits || [], hit => hit.id); }
function balanced(text) {
  const stack = [];
  for (const tag of text.matchAll(/<(\/?)([a-z][\w-]*)(?:\s[^<>]*)?>/g)) {
    if (tag[1]) assert.strictEqual(stack.pop(), tag[2], 'complete nested memory markup');
    else stack.push(tag[2]);
  }
  assert.strictEqual(stack.length, 0, 'all memory tags closed');
}
const TM = load(), M = TM.MemoryContextCompiler, R = TM.MemoryRetrieval, E = TM.MemoryEnvelope;
const base = { id: 'court-1', source: 'court_record', authority: 'rule_validated', text: 'Court resolved canal repair.', turn: 10 };
check('zero budget disables compiler and recall pack', () => {
  for (const zero of [0, '0']) {
    const compiled = M.compileHits([base], { maxTokens: zero });
    assert.strictEqual(compiled.text, ''); assert.strictEqual(compiled.tokenEstimate, 0);
    assert.strictEqual(compiled.injectedHits.length, 0);
    assert.strictEqual(R.packForInjection([{ hits: [base] }], { maxTokens: zero }).recallResults.length, 0);
  }
});
check('drafts, quarantine and deleted records cannot compile', () => {
  for (const status of ['draft', 'pending_review', 'rejected', 'quarantined', 'deleted_tombstone']) {
    assert.strictEqual(M.compileHits([{ ...base, status }], { maxTokens: 1000 }).text, '');
  }
  assert.strictEqual(M.compileHits([{ ...base, reviewStatus: 'pending_review' }], { maxTokens: 1000 }).text, '');
});
check('safe body clearing never resurrects original text', () => {
  const hit = { ...base, safeBody: '', text: 'MUST_NOT_RESURRECT' };
  assert.strictEqual(M.compileHits([hit], { maxTokens: 1000 }).text, '');
  assert.strictEqual(E.makeEnvelope({ body: 'MUST_NOT_RESURRECT', safeBody: '' }).safeBody, '');
  assert.strictEqual(R.hitFromEnvelope({ body: 'MUST_NOT_RESURRECT', safeBody: '' }).text, '');
});
check('draft projection preserves review lifecycle', () => {
  const env = E.makeEnvelope({ body: 'unreviewed claim', status: 'draft' });
  assert.strictEqual(env.status, 'draft');
  assert(TM.MemoryGovernance.evaluateEnvelope(env, { turn: 10, intent: 'historical_evidence' }).wouldReject);
});
check('NPC scope object and private visibility are enforced', () => {
  const privateHit = { ...base, readScope: 'npc:alice', visibility: 'npc_private', audience: ['alice'] };
  assert.strictEqual(M.compileHits([privateHit], { actorScope: { kind: 'npc', npcId: 'bob' }, maxTokens: 1000 }).text, '');
  assert(M.compileHits([privateHit], { actorScope: { kind: 'npc', npcId: 'alice' }, maxTokens: 1000 }).text.includes(base.text));
});
check('different world, save and timeline are isolated', () => {
  for (const field of ['worldId', 'saveId', 'campaignId', 'timelineId']) {
    const compiled = M.compileHits([{ ...base, [field]: 'old' }], { GM: { [field]: 'new' }, turn: 10, maxTokens: 1000 });
    assert.strictEqual(compiled.text, '');
    assert(compiled.suppressed.some(hit => hit.reason === 'world_scope'));
  }
});
check('legacy records without world IDs remain usable', () => {
  assert(M.compileHits([base], { GM: { worldId: 'new' }, turn: 10, maxTokens: 1000 }).text.includes(base.text));
});
check('future observations do not leak through historical intent', () => {
  for (const hit of [{ ...base, turn: 50, validFromTurn: 50 }, { ...base, learnedAtTurn: 50 }]) {
    assert.strictEqual(M.compileHits([hit], { turn: 10, intent: 'historical_evidence', maxTokens: 1000 }).text, '');
  }
  assert.strictEqual(R.rankHitsDetailed([{ ...base, turn: 1 }], { turn: 0 }).ranked.length, 0);
});
check('expired history is labelled instead of becoming current law', () => {
  const oldLaw = { ...base, validToTurn: 5 };
  assert.strictEqual(M.compileHits([oldLaw], { turn: 10, intent: 'current_fact', maxTokens: 1000 }).text, '');
  const historical = M.compileHits([oldLaw], { turn: 10, intent: 'historical_evidence', maxTokens: 1000 });
  assert(historical.text.includes('temporal-use="historical_only"'));
  assert(historical.text.includes('valid-to="5"'));
});
check('null time bounds remain unknown rather than turn zero', () => {
  const env = E.makeEnvelope({ body: 'timeless fact', validToTurn: null, validTo: null, expiredAtTurn: null, expiredAt: null });
  assert.strictEqual(env.validToTurn, null); assert.strictEqual(env.expiredAtTurn, null);
});
check('prototype-like IDs are not mistaken for duplicates', () => {
  assert.strictEqual(M.compileHits([{ ...base, id: '__proto__' }, { ...base, id: 'constructor', text: 'different fact' }], { maxTokens: 1000 }).injectedHits.length, 2);
});
check('every tight budget emits whole XML or an explicit failure', () => {
  const hit = { ...base, source: 'hard_state', lane: 'L1_world_truth', text: 'world fact '.repeat(80) };
  for (let budget = 1; budget <= 320; budget++) {
    const compiled = M.compileHits([hit], { maxTokens: budget });
    assert(compiled.tokenEstimate <= budget); balanced(compiled.text);
    if (!compiled.ok) { assert.strictEqual(compiled.text, ''); assert.throws(() => M.requireCompiled(compiled)); }
    else assert.strictEqual((compiled.text.match(/<memory id=/g) || []).length, compiled.injectedHits.length);
  }
});
check('custom token estimator is honored by complete-record packing', () => {
  const custom = load(FILES, { estimateTokens: text => Math.ceil(String(text || '').length / 2) });
  const hits = Array.from({ length: 9 }, (_, i) => ({ ...base, id: 'custom-' + i, text: 'evidence ' + i + ' '.repeat(i) }));
  for (const budget of [100, 160, 300, 650]) {
    const compiled = custom.MemoryContextCompiler.compileHits(hits, { maxTokens: budget });
    balanced(compiled.text); assert(Math.ceil(compiled.text.length / 2) <= budget);
  }
});
check('missing budget service never silently ignores a ceiling', () => {
  const isolated = load(['tm-memory-context-compiler.js']).MemoryContextCompiler;
  const compiled = isolated.compileHits([base], { maxTokens: 20 });
  assert.strictEqual(compiled.ok, false); assert.strictEqual(compiled.text, '');
});
check('invalid budgets have bounded fallbacks', () => {
  for (const bad of [NaN, Infinity, -1, 'invalid']) {
    const compiled = M.compileHits([base], { maxTokens: bad });
    assert(Number.isFinite(compiled.maxTokens)); assert(compiled.tokenEstimate <= compiled.maxTokens);
    const packed = R.packForInjection([{ hits: [base] }], { maxTokens: bad });
    assert(Number.isFinite(packed.maxTokens)); assert(packed.tokenEstimate <= packed.maxTokens);
  }
});
check('cross-query duplicates do not crowd out another fact', () => {
  const groups = [{ hits: [base] }, { hits: [base] }, { hits: [{ ...base, id: 'other', text: 'Another relevant fact.' }] }];
  const before = JSON.stringify(groups);
  const packed = R.packForInjection(groups, { maxTokens: 70 });
  assert.deepStrictEqual(ids(packed.recallResults.flatMap(group => group.hits)), ['court-1', 'other']);
  assert.strictEqual(packed.diagnostics.duplicates, 1); assert.strictEqual(JSON.stringify(groups), before);
});
check('same first eighty characters do not erase different conclusions', () => {
  const prefix = 'shared introduction '.repeat(6);
  const hits = [{ ...base, id: 'a', text: prefix + 'APPROVED' }, { ...base, id: 'b', text: prefix + 'REJECTED' }];
  assert.strictEqual(R.dedupeHits(hits).length, 2);
  assert.strictEqual(M.compileHits(hits, { maxTokens: 1000 }).injectedHits.length, 2);
});
check('dense character rosters leave room for orders, promises and court evidence', () => {
  const hits = Array.from({ length: 200 }, (_, i) => ({ id: 'char-' + i, source: 'hard_state', lane: 'L1_world_truth', authority: 'engine_state', text: 'Minister ' + i + ' is alive in the capital.', turn: 10 }));
  hits.push({ ...base, id: 'live-order', source: 'activeEdict', lane: 'L2_active_law_commitment', authority: 'player_pin', text: 'Repair the canal.' });
  hits.push({ ...base, id: 'promise', source: 'commitment', lane: 'L2_active_law_commitment', text: 'Minister promised grain delivery.' });
  hits.push(base);
  const compiled = M.compileHits(hits, { turn: 10, maxTokens: 1800 });
  for (const id of ['live-order', 'promise', 'court-1']) assert(ids(compiled.injectedHits).includes(id), id + ' remains represented');
  assert(compiled.tokenEstimate <= 1800); balanced(compiled.text);
});
check('trace counts actual emitted records rather than all candidates', () => {
  const hits = Array.from({ length: 18 }, (_, i) => ({ ...base, id: 'trace-' + i, text: 'Evidence number ' + i }));
  const compiled = M.compileHits(hits, { maxTokens: 180 });
  assert(compiled.injectedHits.length < compiled.hits.length);
  const trace = TM.MemoryTrace.recordCompiledContext({ turn: 10, _turnAiResults: {} }, { compiled });
  assert.strictEqual(trace.items.length, compiled.injectedHits.length);
  assert.strictEqual(trace.sectionCounts.courtRecords, compiled.injectedSections.courtRecords.length);
});
check('accepted projections preserve time windows and timeline identity', () => {
  const gm = { turn: 10, worldId: 'world-a', saveId: 'save-a', timelineId: 'now', _memoryAccepted: [{ id: 'accepted-old', type: 'semantic_fact', body: 'Old tax exemption.', status: 'active', reviewStatus: 'accepted', turn: 0, validToTurn: 5, timelineId: 'then' }] };
  const env = E.collect(gm).find(item => item.id === 'accepted-old');
  assert(env); assert.strictEqual(env.turn, 0); assert.strictEqual(env.validToTurn, 5);
  assert.strictEqual(env.timelineId, 'then'); assert.strictEqual(env.worldId, 'world-a');
  assert(!M.compileFromGM(gm, { intent: 'current_fact', maxTokens: 1000 }).text.includes('Old tax exemption.'));
});
check('compiler preserves input objects and source evidence', () => {
  const hits = [{ ...base, sourceRefs: [{ type: 'courtRecords', id: 'ruling-1' }] }];
  const before = JSON.stringify(hits);
  const compiled = M.compileHits(hits, { maxTokens: 1000 });
  assert.strictEqual(JSON.stringify(hits), before);
  assert(compiled.text.includes('courtRecords:ruling-1'));
});
check('production recall does not revive intentionally empty output', () => {
  const source = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai.js'), 'utf8');
  assert(source.includes('} else if (!_compiledRecall) {'));
  assert(source.includes('_compiledRecall.injectedHits || _compiledRecall.hits'));
  assert(source.includes('_sc1CompiledContext.injectedHits || _sc1CompiledContext.hits'));
  assert(source.includes("GM: GM, audience: 'system', intent: 'historical_evidence'"));
});
check('loaded branches inherit only pre-fork parent evidence', () => {
  const gm = { turn: 20, _timelineId: 'child', _parentTimelineId: 'parent', _forkTurn: 6 };
  const parent = { ...base, turn: 4, timelineId: 'parent' };
  assert(M.compileHits([parent], { GM: gm, turn: 20, maxTokens: 1000 }).text.includes(base.text));
  assert.strictEqual(M.compileHits([parent], { GM: gm, timelineId: 'unrelated', turn: 20, maxTokens: 1000 }).text, '');
  for (const invalid of [{ ...parent, turn: 7 }, { ...parent, learnedAtTurn: 7 }, { ...parent, timelineId: 'sibling' }]) {
    assert.strictEqual(M.compileHits([invalid], { GM: gm, turn: 20, maxTokens: 1000 }).text, '');
  }
});
check('trace rejection entries are not duplicated', () => {
  const compiled = M.compileHits(Array.from({ length: 15 }, (_, i) => ({ ...base, id: 'drop-' + i, text: 'Different evidence ' + i })), { maxTokens: 180 });
  const trace = TM.MemoryTrace.recordCompiledContext({ turn: 10, _turnAiResults: {} }, { compiled });
  const keys = Array.from(trace.suppressed, hit => [hit.id, hit.source, hit.reason].join('|'));
  assert.strictEqual(new Set(keys).size, keys.length);
});
check('missing retrieval policy rejects identity-bound evidence', () => {
  const isolated = load(['tm-context-zones.js', 'tm-memory-context-compiler.js']).MemoryContextCompiler;
  assert.strictEqual(isolated.compileHits([{ ...base, worldId: 'foreign' }], { GM: { worldId: 'current' }, maxTokens: 1000 }).text, '');
});
check('valid 128-character campaign IDs do not reject their own projections', () => {
  const gm = { turn: 10, _campaignId: 'tmc_' + 'x'.repeat(124), chars: [{ id: 'minister-a', name: 'Minister A', alive: true }] };
  assert(M.compileFromGM(gm, { maxTokens: 1000 }).text.includes('Minister A'));
});
console.log('smoke-memory-boundary-upgrade: ' + passed + ' passed, ' + failed + ' failed; tight-budget matrix 1..320');
if (failed) process.exitCode = 1;
