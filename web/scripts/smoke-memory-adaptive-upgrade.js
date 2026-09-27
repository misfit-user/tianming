'use strict';
const assert = require('assert/strict');
const { context, fact, profile } = require('./lib-memory-upgrade-r2');
const tests = [];
function test(name, run) { tests.push({ name, run }); }
function ids(hits) { return Array.from(hits, hit => hit.id); }
test('unverified capacity does not enable autonomous tool calls', () => {
  const c = context(), p = c.TM.MemoryAdaptive.plan(); assert.equal(p.mode, 'balanced'); assert.equal(p.maxToolCalls, 0);
  c.P.conf.contextSizeK = 4; assert.equal(c.TM.MemoryAdaptive.plan().mode, 'compact');
});
test('verified memory skills enable bounded deep mechanisms', () => {
  const c = context(); profile(c); const p = c.TM.MemoryAdaptive.plan();
  assert.equal(p.mode, 'deep'); assert.equal(p.maxRounds, 2); assert.equal(p.maxToolCalls, 6);
  c.P.conf.contextSizeK = 4; const compact = c.TM.MemoryAdaptive.plan(); assert.equal(compact.mode, 'compact'); assert(compact.memoryTokens <= 4096 * 0.12);
});
test('model, endpoint, tier and expiry own their evidence', () => {
  const c = context(); profile(c); assert.equal(c.TM.MemoryAdaptive.plan().verified, true);
  c.P.ai.url = 'https://other.invalid/v1'; assert.equal(c.TM.MemoryAdaptive.plan().verified, false);
  c.P.ai.url = 'https://relay.invalid/v1'; c.P.ai.model = 'other'; assert.equal(c.TM.MemoryAdaptive.plan().verified, false);
  c.P.ai.model = 'test-model'; assert.equal(c.TM.MemoryAdaptive.plan({ tier: 'secondary' }).verified, false);
  assert.equal(c.TM.MemoryAdaptive.plan({ now: Date.now() + 8 * 86400000 }).verified, false);
});
test('stale probes cannot update a new configuration or newer probe', () => {
  const c = context(), a = c.TM.MemoryAdaptive, report = { checks: [] };
  const first = a.beginProbe(); a.beginProbe(); assert.equal(a.commitEvidence(report, first), false);
  const keyLease = a.beginProbe(); c.P.ai.key = 'changed-synthetic-key'; assert.equal(a.commitEvidence({}, keyLease), false);
  assert.equal(c.P.conf._memoryCapabilityProfiles, undefined);
});
test('transport failures remain unknown rather than failed skill', () => {
  const c = context(); profile(c, [], 'primary', ['memory_recall']);
  assert.equal(c.TM.MemoryAdaptive.plan().capabilities.recall, 'unknown'); assert.equal(c.TM.MemoryAdaptive.plan().mode, 'balanced');
  profile(c, ['memory_recall']); assert.equal(c.TM.MemoryAdaptive.plan().mode, 'compact');
});
test('capability records never persist API credentials or URL query secrets', () => {
  const c = context(); c.P.ai.url = 'https://user:secret@relay.invalid/v1?token=private'; profile(c);
  const data = JSON.stringify(c.P.conf._memoryCapabilityProfiles); assert(!data.includes('synthetic-test-key')); assert(!data.includes('secret')); assert(!data.includes('private'));
});
test('manual zero budgets are preserved and invalid budgets are bounded', () => {
  const c = context(); c.P.conf.memoryRecallTokenBudget = 0; assert.equal(c.TM.MemoryAdaptive.budget('memoryRecallTokenBudget', 1200), 0);
  c.P.conf.memoryRecallTokenBudget = Infinity; assert.equal(c.TM.MemoryAdaptive.budget('memoryRecallTokenBudget', 1200), 1200);
});
test('strict parsing and actual native tool calls are independently checked', () => {
  const c = context(), a = c.TM.MemoryAdaptive; assert.equal(a.strictJSON('```json\n{"x":1}\n```'), null);
  const cases = a.probeCases({ contextChars: 2000 }); assert.equal(cases.length, 3);
  assert(!cases[0].validate({ text: '{"subject":"guess","destination":"guess","depot":"guess","source_refs":["r2","r4"]}' }));
  assert(!cases[2].validate({ text: 'I called recall_by_entity', data: { choices: [{ message: { content: 'recall_by_entity' } }] } }));
  assert.notEqual(a.probeCases({ contextChars: 2000 })[0].prompt, cases[0].prompt);
});
test('accepted memories survive beyond the eighty-item hot set', () => {
  const c = context(), WG = c.TM.MemoryWriteGate;
  c.GM._memoryAccepted = Array.from({ length: 150 }, (_, i) => fact('accepted-' + i, 'Distinct accepted archive fact number ' + i));
  WG.pruneQueues(c.GM, {}); assert(c.GM._memoryAccepted.length <= 80); assert.equal(c.TM.MemoryLongTerm.stats(c.GM).records, 150);
  const result = c.TM.MemoryContextCompiler.compileFromGM(c.GM, { maxTokens: 4000 }); assert(ids(result.hits).includes('accepted-0'));
});
test('twelve durable memory kinds preserve evidence and survive JSON round trips', () => {
  const c = context(), LT = c.TM.MemoryLongTerm, kinds = Object.keys(LT.types); assert.equal(kinds.length, 12);
  LT.capture(c.GM, kinds.map((kind, i) => fact('kind-' + i, 'Typed long-term memory for ' + kind, { type: kind, memoryKind: kind })));
  c.GM = JSON.parse(JSON.stringify(c.GM)); assert.equal(LT.stats(c.GM).records, 12);
  assert.equal(Object.keys(LT.stats(c.GM).kinds).length, 12); assert(LT.project(c.GM).every(env => env.sourceRefs.length));
});
test('archive budgets are model-independent, bounded and preserve pinned records', () => {
  const c = context(), LT = c.TM.MemoryLongTerm;
  c.GM._memoryControls = { ancient: { pinned: true } };
  const rows = [fact('ancient', 'Pinned ancient historical agreement.', { turn: 0 })].concat(Array.from({ length: 2100 }, (_, i) => fact('bulk-' + i, 'Archive content number ' + i)));
  LT.capture(c.GM, rows); const stats = LT.stats(c.GM); assert(stats.records <= stats.maxRecords); assert(stats.chars <= stats.maxChars); assert(stats.dropped > 0);
  assert(c.GM._memoryLongTerm.records.some(r => r.id === 'ancient')); c.P.conf.contextSizeK = 4; assert.equal(LT.stats(c.GM).records, stats.records);
});
test('drafts and quarantined records never enter the durable accepted archive', () => {
  const c = context(); c.TM.MemoryLongTerm.capture(c.GM, [fact('draft', 'Do not archive this draft.', { status: 'draft' }), fact('quarantine', 'Do not archive quarantine.', { status: 'quarantined' })]);
  assert.equal(c.TM.MemoryLongTerm.stats(c.GM).records, 0);
});
test('long-term candidates require real sources and retain review boundaries', () => {
  const c = context(); c.GM._memoryAccepted = [fact('source', 'The canal repair was completed after the flood.')];
  const updates = [{ kind: 'decision_rationale', memory: 'The canal repair was completed after the flood.', confidence: 0.9, source_refs: ['source'] }, { kind: 'economic_pattern', memory: 'Invented guaranteed economic miracle.', confidence: 0.99, source_refs: ['fabricated'] }];
  const candidates = c.TM.MemoryLongTerm.candidates(c.GM, { long_term_memory_updates: updates }); assert.equal(candidates.length, 2);
  assert.equal(candidates[0].extra.literalEvidence, true); assert.equal(candidates[1].status, 'quarantined');
  const queued = c.TM.MemoryTurnInference.enqueuePostTurnCandidates(c.GM, { long_term_memory_updates: updates }); assert(queued.quarantined >= 1); assert.equal(queued.autoAccepted, 0);
});
test('Chinese lexical retrieval reaches old durable evidence without vectors', async () => {
  const c = context(); c.TM.MemoryLongTerm.capture(c.GM, [fact('old-river', '三年前黄河决口，朝廷曾命修筑河堤并减免灾区田赋。', { turn: 1 }), fact('other', 'Border troops inspected the horses.')]);
  const result = await c.TM.MemoryHybrid.search(c.GM, '黄河河堤田赋', { vector: false }); assert(ids(result.hits).includes('old-river'));
  assert(result.hits[0].sourceRefs.length); assert(result.hits[0]._hybrid.channels.includes('lexical'));
});
test('private and revoked memories stay out of player recall and source expansion', async () => {
  const c = context(); c.GM._memoryAccepted = [fact('private', 'Secret canal plan.', { visibility: 'npc_private', readScope: 'npc:alice', audience: ['alice'] }), fact('false', 'Canal cancellation.')];
  c.GM._memoryControls = { false: { markedFalse: true } };
  const result = await c.TM.MemoryHybrid.search(c.GM, 'canal', { vector: false, audience: 'player' }); assert.equal(result.hits.length, 0);
  assert.equal(c.TM.MemoryHybrid.read(c.GM, ['private'], { audience: 'player' }).length, 0);
});
test('recall tools retain identifiers, authority and evidence lineage', async () => {
  const c = context(); c.GM._memoryAccepted = [fact('canal', 'A canal repair ruling remains available.')];
  const result = await c.TM.MemoryAgentTools.exec('recall_by_term', { terms: ['canal'] }, c.GM);
  assert.equal(result.hits[0].id, 'canal'); assert(result.hits[0].sourceRefs.length); assert.equal(result.hits[0].readScope, 'public'); assert.equal(result.hits[0].authority, 'event_log');
  const expanded = await c.TM.MemoryAgentTools.exec('read_memory', { ids: ['canal'] }, c.GM); assert.equal(expanded.hits[0].id, 'canal');
});
test('related recall follows one verified graph hop', () => {
  const c = context(); c.GM._memoryAccepted = [fact('flood', 'The river flooded.'), fact('repair', 'The river embankment was repaired.'), fact('third', 'A later unrelated event.')];
  c.GM._memEdges = [{ src: 'flood', dst: 'repair', type: 'causes', turn: 4 }, { src: 'repair', dst: 'third', type: 'continues', turn: 5 }];
  const related = c.TM.MemoryHybrid.related(c.GM, ['flood']); assert(ids(related).includes('repair')); assert(!ids(related).includes('third'));
});
test('query fusion deduplicates the same evidence across channels', () => {
  const c = context(), a = fact('a', 'Canal repair.'), b = fact('b', 'Tax relief.');
  const fused = c.TM.MemoryHybrid.fuse([{ hit: a, score: 1 }, { hit: b, score: 0.5 }], [a], 10); assert.equal(fused.length, 2); assert.equal(fused[0].id, 'a');
});
test('unverified models use local recall without paid planner calls', async () => {
  const c = context(); let calls = 0; c.callAIWithTools = async () => { calls++; return {}; };
  c.GM._memoryAccepted = [fact('canal', 'Canal repair history is available.')];
  const result = await c.TM.MemoryAgentTools.runRecall(c.GM, { baseQueries: [{ keywords: ['canal'] }] }); assert.equal(calls, 0); assert(result.totalHits > 0);
});
test('verified autonomous recall can read fuller evidence in a second bounded round', async () => {
  const c = context(); profile(c); let calls = 0;
  c.GM._memoryAccepted = [fact('canal', 'Canal repair. ' + 'Historical evidence details. '.repeat(40))];
  c.callAIWithTools = async () => ({ toolCalls: ++calls === 1 ? [{ name: 'recall_by_term', input: { terms: ['canal'] } }] : [{ name: 'read_memory', input: { ids: ['canal'] } }] });
  const result = await c.TM.MemoryAgentTools.runRecall(c.GM, { baseQueries: [{ keywords: ['canal'] }] });
  assert.equal(calls, 2); assert.equal(result.rounds, 2); assert.equal(result.toolCallCount, 2); assert.equal(result.totalHits, 1); assert(result.results[0].hits[0].text.length > 420);
});
test('stale autonomous recall discards results after a load', async () => {
  const c = context(); profile(c); const gm = c.GM;
  c.callAIWithTools = async () => { c._tmLoadGen = 1; return { toolCalls: [{ name: 'recall_by_term', input: { terms: ['canal'] } }] }; };
  const result = await c.TM.MemoryAgentTools.runRecall(gm, { baseQueries: ['canal'] }); assert.equal(result.stale, true); assert.equal(result.totalHits, 0);
});
test('JSON-only models can plan retrieval without native tool support', async () => {
  const c = context(); profile(c, ['memory_tools']); let calls = 0; c.GM._memoryAccepted = [fact('json-record', 'Canal repair evidence is available.')];
  c.callAIWithTools = async () => { throw Error('native tool path must not run'); };
  c.callAIMessages = async () => { calls++; return JSON.stringify({ calls: [{ name: 'recall_by_term', input: { terms: ['canal'] } }] }); };
  assert.equal(c.TM.MemoryAdaptive.plan().plannerMode, 'json');
  const result = await c.TM.MemoryAgentTools.runRecall(c.GM, { baseQueries: ['canal'] }); assert(result.totalHits > 0); assert(calls <= 2); assert(result.toolCallCount <= 6);
});
test('durable correction survives short-term control pruning and explicit undo works', () => {
  const c = context(); c.GM._memoryAccepted = [fact('ancient', 'An obsolete canal claim.')]; c.TM.MemoryLongTerm.capture(c.GM, c.GM._memoryAccepted);
  c.TM.MemoryControls.markFalse(c.GM, 'ancient');
  for (let i = 0; i < 85; i++) c.TM.MemoryControls.markFalse(c.GM, 'other-' + i);
  assert.equal(c.GM._memoryControls.ancient, undefined);
  assert(!c.TM.MemoryHybrid.collect(c.GM).some(h => h.id === 'ancient'));
  c.TM.MemoryControls.clearControl(c.GM, 'ancient'); assert(c.TM.MemoryHybrid.collect(c.GM).some(h => h.id === 'ancient'));
});
test('canonical IDB and project snapshot constructors retain detached long-term archives', () => {
  const fs = require('fs'), path = require('path'), vm = require('vm'), acorn = require('acorn');
  const { ROOT } = require('./lib-memory-upgrade-r2');
  const c = context(); c.TM.MemoryLongTerm.capture(c.GM, [fact('saved', 'Long-term evidence survives both save wrappers.')]);
  c.deepClone = value => JSON.parse(JSON.stringify(value)); c._tmStripAiKeyInPlace = value => value;
  const source = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
  const tree = acorn.parse(source, { ecmaVersion: 'latest', allowReturnOutsideFunction: true });
  for (const name of ['_tmSaveSnapshotSkipKeys', '_autoSaveSnapshotGM', '_buildSaveState']) {
    const node = tree.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name); assert(node, name);
    vm.runInContext(source.slice(node.start, node.end), c);
  }
  const idb = c._buildSaveState({ format: 'idb', prepare: false, detach: true });
  const project = c._buildSaveState({ format: 'project', prepare: false, detach: true });
  assert.equal(idb.GM._memoryLongTerm.records[0].id, 'saved'); assert.equal(project.gameState._memoryLongTerm.records[0].id, 'saved');
  c.GM._memoryLongTerm.records[0].body = 'Live change after snapshot';
  assert.notEqual(idb.GM._memoryLongTerm.records[0].body, c.GM._memoryLongTerm.records[0].body);
  assert.equal(JSON.parse(JSON.stringify(project)).gameState._memoryLongTerm.records[0].id, 'saved');
});
function stewardFixture() {
  const c = context(); c.GM._aiMemory = Array.from({ length: 50 }, (_, i) => ({ turn: i % 5, content: 'Old narrative memory number ' + i })); return c;
}
test('consolidation rejects incomplete multi-layer output without dropping originals', async () => {
  const c = stewardFixture(); c.GM._foreshadows = Array.from({ length: 40 }, (_, i) => ({ turn: 1, content: 'Unresolved clue ' + i }));
  const before = JSON.stringify([c.GM._aiMemory, c.GM._foreshadows]); c.callAIMessages = async () => '{"aiMemory_summary":"Only one layer returned."}';
  const result = await c.TM.MemorySteward.run(c.GM); assert.equal(result.failed, true); assert.equal(JSON.stringify([c.GM._aiMemory, c.GM._foreshadows]), before);
});
test('same-world consolidation is single-flight and keeps concurrent appends', async () => {
  const c = stewardFixture(); let release, calls = 0;
  c.callAIMessages = () => { calls++; return new Promise(resolve => { release = resolve; }); };
  const first = c.TM.MemorySteward.run(c.GM), second = c.TM.MemorySteward.run(c.GM); assert.equal(first, second);
  await new Promise(resolve => setTimeout(resolve, 0)); assert.equal(calls, 1);
  c.GM._aiMemory.push({ turn: 10, content: 'Concurrent new memory must survive.' });
  release('{"aiMemory_summary":"Earlier accepted narrative records summarized with their evidence."}');
  const result = await first; assert.equal(result.ok, true); assert(c.GM._aiMemory.some(r => r.content === 'Concurrent new memory must survive.'));
});
test('changed evidence or a new turn invalidates a pending consolidation', async () => {
  for (const mutation of [c => { c.GM.turn++; }, c => { c.GM._aiMemory[0].content = 'Edited while waiting.'; }]) {
    const c = stewardFixture(); let release; c.callAIMessages = () => new Promise(resolve => { release = resolve; });
    const promise = c.TM.MemorySteward.run(c.GM); await new Promise(resolve => setTimeout(resolve, 0)); mutation(c);
    const before = JSON.stringify(c.GM._aiMemory); release('{"aiMemory_summary":"Must not replace changed records."}');
    const result = await promise; assert(result.skipped); assert.equal(JSON.stringify(c.GM._aiMemory), before);
  }
});
test('consolidation requests use capability-sized output instead of fixed eight thousand', async () => {
  const c = stewardFixture(); c.P.conf.contextSizeK = 16; let budget = 0;
  c.callAIMessages = async (_messages, maxTokens) => { budget = maxTokens; return '{"aiMemory_summary":"A concise safe consolidation of the old evidence."}'; };
  const result = await c.TM.MemorySteward.run(c.GM); assert(result.ok || result.skipped === 'context_budget'); assert(budget <= 3000);
});
(async () => {
  let passed = 0, failed = 0;
  for (const item of tests) { try { await item.run(); passed++; console.log('PASS ' + item.name); } catch (error) { failed++; console.error('FAIL ' + item.name + '\n' + error.stack); } }
  console.log(JSON.stringify({ passed, failed, tests: tests.length })); if (failed) process.exitCode = 1;
})();
