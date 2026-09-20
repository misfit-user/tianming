'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const { memory, transport, load, ROOT, pause } = require('./lib-turn-reliability');
const { fact, profile } = require('./lib-memory-upgrade-r2');
const tests = []; const test = (name, run) => tests.push({ name, run });
test('independent Agent exposes shared memory tools without enabling the LLM pipeline', async () => {
  const c = memory(); load(c, 'tm-agent-flags.js'); c.P.conf.agentModeEnabled = true;
  assert.equal(c.agentFlagOn('memoryStewardEnabled'), false);
  const rt = c.TM.Endturn.AgentReadTools; assert(rt.isToolName('read_memory')); assert(rt.isToolName('recall_related'));
  c.GM._memoryAccepted = [fact('old-promise', 'Canal repairs were promised in an earlier turn.')];
  const result = await rt.handle('recall_history', { query: 'canal' }, { GM: c.GM });
  assert(result.ok); assert(result.text.includes('old-promise')); assert(result.text.includes('sourceRefs')); assert(result.text.includes('eventLog'));
});
test('Agent evidence output exceeds the old 500-character cap and remains budgeted JSON', async () => {
  const c = memory(); profile(c); c.GM._memoryAccepted = Array.from({ length: 12 }, (_, i) => fact('canal-' + i, 'Canal archive record ' + i + ': ' + 'Historical explanation. '.repeat(20)));
  const result = await c.TM.Endturn.AgentReadTools.handle('recall_history', { query: 'canal' }, { GM: c.GM });
  assert(result.text.length > 500); const parsed = JSON.parse(result.text); assert(parsed.memoryEvidence.length > 1);
  assert(c.TM.ContextZones.estimateTokens(result.text) <= c.TM.MemoryModeBridge.budget(c.TM.MemoryModeBridge.profile()));
});
test('zero budget and false evidence also apply through the independent Agent wrapper', async () => {
  const c = memory(); c.GM._memoryAccepted = [fact('false-old', 'Canal record must be excluded.')]; c.GM._memoryControls = { 'false-old': { markedFalse: true } };
  const rt = c.TM.Endturn.AgentReadTools; assert.equal((await rt.handle('recall_history', { query: 'canal' }, { GM: c.GM })).hits.length, 0);
  c.GM._memoryControls = {}; c.P.conf.memoryRecallTokenBudget = 0;
  assert.equal((await rt.handle('read_memory', { ids: ['false-old'] }, { GM: c.GM })).hits.length, 0);
});
test('memory budgets do not replace the independent Agent turn-round budget', () => {
  const c = memory(); c.P.conf.agentModeMaxRounds = 12; profile(c); assert.equal(c.TM.MemoryModeBridge.memoryDepth(), 10);
  c.P.conf.agentMemoryDepth = 17; assert.equal(c.TM.MemoryModeBridge.memoryDepth(), 17); assert.equal(c.P.conf.agentModeMaxRounds, 12);
});
test('Agent consolidation proposes reviewed candidates and does not write the live world early', async () => {
  const c = memory(), gm = c.GM; gm._turnReport = [{ type: 'change', text: 'Canal repair was completed.', turn: gm.turn }];
  gm._memoryAccepted = [fact('source-1', 'Canal repair was completed after the flood.')];
  c.callAIMessages = async () => JSON.stringify({ memory: 'Canal repair was completed after the flood.', state_board: { recent_summary: 'Canal repaired.' }, long_term_memory_updates: [{ kind: 'decision_rationale', memory: 'Canal repair was completed after the flood.', confidence: 0.9, source_refs: ['source-1'] }] });
  const before = JSON.stringify(gm), ip = c.TM.Endturn.AgentIntentPlan;
  const proposed = await ip.proposeSpecialist('recall_consolidate', {}, { GM: gm }, c.TM.Endturn.AgentDepthTools.handle);
  assert(proposed.ok, proposed.reason || proposed.text); assert.equal(JSON.stringify(gm), before);
  assert(ip.commitSpecialistProposal(gm, proposed).ok); assert.equal(gm._memoryDraftInbox.length, 1);
  assert.equal(gm._memoryDraftInbox[0].status, 'draft'); assert(gm._aiMemory[0].sourceRefs.length);
});
test('Agent archive reaches the same long-term projection without duplicate turn bundles', () => {
  const c = memory(), bridge = c.TM.MemoryModeBridge;
  const result = { turnSummary: 'The canal project was completed.', shizhengji: 'The court recorded completion of the canal project.' };
  bridge.archive(c.GM, result, {}); bridge.archive(c.GM, result, {});
  assert.equal(c.GM._turnMemoryArchive.length, 1); assert.equal(c.GM._turnMemoryArchive[0].sourceId, 'AGENT');
  assert(c.TM.MemoryLongTerm.stats(c.GM).records > 0); assert(bridge.dossier(c.GM).includes('canal'));
});
test('a concurrent write cannot be laundered into an old proposal baseline', async () => {
  const c = memory(), gm = c.GM, ip = c.TM.Endturn.AgentIntentPlan; gm._economyDeepening = { version: 'original' }; let release;
  const flight = ip.proposeSpecialist('deepen_economy', {}, { GM: gm }, async (_tool, _input, ctx) => { await new Promise(resolve => { release = resolve; }); ctx.GM._economyDeepening = { version: 'old-proposal' }; return { ok: true }; });
  gm._economyDeepening = { version: 'concurrent-update' }; release(); const result = ip.commitSpecialistProposal(gm, await flight);
  assert.equal(result.ok, false); assert(result.reason.includes('stale-proposal')); assert.equal(gm._economyDeepening.version, 'concurrent-update');
});
test('root-bound specialist does not restore an old global after an independent load', async () => {
  const c = memory(), gm = c.GM; let release; const other = { turn: 99 };
  const flight = c.TM.Endturn.AgentIntentPlan.proposeSpecialist('deepen_npcs', {}, { GM: gm }, async () => { await new Promise(resolve => { release = resolve; }); return { ok: true }; });
  c.GM = other; c._tmLoadGen = 2; release(); const proposed = await flight;
  assert.equal(proposed.ok, false); assert.equal(c.GM, other);
});
test('cold-start entry loads each shared reliability provider once in dependency order', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const files = [...html.matchAll(/<script\b[^>]*\bsrc="([^"]+)"/g)].map(m => m[1].split('?')[0]);
  for (const name of ['tm-ai-infra-retry.js','tm-save-world-validation.js','tm-battle-contract.js','tm-memory-mode-bridge.js','tm-endturn-reliability.js']) assert.equal(files.filter(f => f === name).length, 1, name);
  assert.equal(files.indexOf('tm-ai-infra-retry.js') + 1, files.indexOf('tm-ai-infra.js'));
  assert.equal(files.indexOf('tm-save-world-validation.js') + 1, files.indexOf('tm-save-lifecycle.js'));
  assert(files.indexOf('tm-memory-mode-bridge.js') < files.indexOf('tm-endturn-agent-mode.js'));
  assert(files.indexOf('tm-endturn-reliability.js') < files.indexOf('tm-endturn-core.js'));
});
test('actual turn entry fails before snapshot side effects when a required provider is absent', async () => {
  const f = transport(); try {
    const c = f.c, vm = require('vm'), acorn = require('acorn'); let captured = 0, sent = 0;
    c._$ = () => null; c.toast = () => {}; c.hideLoading = () => {}; c._tmRequestEndTurnDesktopAutoSaveFlush = () => {};
    c._tmCaptureEndTurnTransaction = () => { captured++; throw Error('must not reach'); }; c.fetch = async () => { sent++; throw Error('must not send'); };
    delete c._aiComputeTimeout;
    const source = fs.readFileSync(path.join(ROOT, 'tm-endturn-core.js'), 'utf8');
    const node = acorn.parse(source, { ecmaVersion: 'latest' }).body.find(n => n.type === 'FunctionDeclaration' && n.id.name === '_endTurnCore');
    vm.runInContext(source.slice(node.start, node.end), c); await c._endTurnCore({});
    assert.equal(captured, 0); assert.equal(sent, 0); assert.equal(c.GM.turn, 1);
    assert.equal(c.TM.Endturn.Reliability.snapshot()[0].failure.category, 'dependency');
  } finally { f.dispose(); }
});
(async () => { let pass = 0, fail = 0; for (const t of tests) { try { await t.run(); pass++; console.log('PASS ' + t.name); } catch (e) { fail++; console.error('FAIL ' + t.name + '\n' + e.stack); } } console.log(JSON.stringify({ pass, fail, total: tests.length })); if (fail) process.exitCode = 1; })();
