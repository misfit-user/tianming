'use strict';
const assert = require('assert/strict');
const { context, fact, semantic } = require('./lib-memory-upgrade-r2');
const tests = [];
function test(name, run) { tests.push({ name, run }); }
test('long-term evidence is chunked and indexed once', async () => {
  const c = context(), db = semantic(c); c.GM._memoryAccepted = [fact('old', 'Long term canal evidence. '.repeat(40))];
  const first = await c.SemanticRecall.buildIndex(); assert(first.added >= 2); const embeds = db.stats().embeds;
  const again = await c.SemanticRecall.buildIndex(); assert.equal(again.added, 0); assert.equal(db.stats().embeds, embeds);
  assert(c.__semanticState.index.some(row => row.memoryId === 'old'));
});
test('large archive indexing is bounded and resumes without losing deferred rows', async () => {
  const c = context(); semantic(c); c.GM._memoryAccepted = Array.from({ length: 70 }, (_, i) => fact('batch-' + i, 'Distinct accepted evidence ' + i));
  c.TM.MemoryLongTerm.capture(c.GM, c.GM._memoryAccepted);
  const first = await c.SemanticRecall.buildIndex({ memoryBatchLimit: 32 }); assert.equal(first.added, 32); assert.equal(first.memoryPending, 38);
  const second = await c.SemanticRecall.buildIndex({ memoryBatchLimit: 32 }); assert.equal(second.added, 32);
  const third = await c.SemanticRecall.buildIndex({ memoryBatchLimit: 32 }); assert.equal(third.added, 6); assert.equal(third.memoryPending, 0);
});
test('editing a stable memory replaces old vectors instead of accumulating versions', async () => {
  const c = context(), db = semantic(c); c.GM._memoryAccepted = [fact('same-id', 'The old canal destination.')];
  await c.SemanticRecall.buildIndex(); const before = c.__semanticState.index.length;
  c.GM._memoryAccepted[0].body = c.GM._memoryAccepted[0].safeBody = 'The corrected canal destination.';
  await c.SemanticRecall.buildIndex(); assert.equal(c.__semanticState.index.length, before); assert(db.stats().deletes > 0);
  assert(c.__semanticState.index.every(row => !row.text.includes('old canal')));
});
test('failed replacement transaction preserves the last complete index', async () => {
  const c = context(), db = semantic(c); c.GM._memoryAccepted = [fact('atomic', 'Original archive evidence.')];
  await c.SemanticRecall.buildIndex(); const before = JSON.stringify(c.__semanticState.index), persisted = JSON.stringify(Array.from(db.rows));
  c.GM._memoryAccepted[0].body = c.GM._memoryAccepted[0].safeBody = 'Changed archive evidence.'; db.failWrite();
  await assert.rejects(c.SemanticRecall.buildIndex(), /injected atomic index failure/);
  assert.equal(JSON.stringify(c.__semanticState.index), before); assert.equal(JSON.stringify(Array.from(db.rows)), persisted);
  assert.equal((await c.SemanticRecall.search('archive', { threshold: -1 })).length, 0, 'stale text is suppressed even before rebuild succeeds');
});
test('permission filtering happens before vector top-K selection', async () => {
  const c = context(); semantic(c);
  c.GM._memoryAccepted = [fact('private', 'A private canal agreement.', { visibility: 'npc_private', readScope: 'npc:alice', audience: ['alice'] }), fact('public', 'A public canal agreement.')];
  await c.SemanticRecall.buildIndex(); const result = await c.SemanticRecall.search('canal', { topK: 1, threshold: -1, audience: 'player' });
  assert.equal(result.length, 1); assert.equal(result[0].id, 'public'); assert(result[0].sourceRefs.length); assert.equal(result[0].authority, 'event_log');
});
test('deleted and altered evidence are invalidated before another indexing pass', async () => {
  const c = context(); semantic(c); c.GM._memoryAccepted = [fact('live', 'A live memory record.')]; await c.SemanticRecall.buildIndex();
  c.GM._memoryControls = { live: { markedFalse: true } }; assert.equal((await c.SemanticRecall.search('memory', { threshold: -1 })).length, 0);
  delete c.GM._memoryControls; c.__semanticState.index[0].vec[0] = NaN; assert.equal((await c.SemanticRecall.search('memory', { threshold: -1 })).length, 0);
});
test('repeated queries reuse bounded embeddings within the same world', async () => {
  const c = context(), db = semantic(c); c.GM._memoryAccepted = [fact('record', 'Canal evidence.')]; await c.SemanticRecall.buildIndex();
  const before = db.stats().embeds; await c.SemanticRecall.search('same query', { threshold: -1 }); await c.SemanticRecall.search('same query', { threshold: -1 });
  assert.equal(db.stats().embeds - before, 1);
});
test('model initialization cannot silently switch the requested world', async () => {
  const c = context(); semantic(c); const gm = c.GM;
  c.__testEnsureModel = async () => { c.GM = { ...gm, _timelineId: 'tml_another_branch_12345678' }; return true; };
  const result = await c.SemanticRecall.buildIndex(); assert.equal(result.ok, false); assert.equal(result.reason, 'semantic_world_changed');
});
test('explicit detached world queries cannot search the global world index', async () => {
  const c = context(); semantic(c); c.GM._memoryAccepted = [fact('record', 'Canal evidence.')]; await c.SemanticRecall.buildIndex();
  assert.equal((await c.SemanticRecall.search('canal', { GM: { ...c.GM }, threshold: -1 })).length, 0);
});
(async () => { let passed = 0, failed = 0; for (const item of tests) { try { await item.run(); passed++; console.log('PASS ' + item.name); } catch (error) { failed++; console.error('FAIL ' + item.name + '\n' + error.stack); } } console.log(JSON.stringify({ passed, failed, tests: tests.length })); if (failed) process.exitCode = 1; })();
