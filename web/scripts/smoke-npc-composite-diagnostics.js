'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), { EventEmitter } = require('node:events');
const { compactAllocationProfile, startCompositeAllocationSampling, installCompositeAllocationStages } = require('../../scripts/electron/npc-composite-diagnostics.cjs');
const tests = [], test = (name, run) => tests.push({ name, run });
const node = (id, size, name, children = []) => ({ id, selfSize: size, callFrame: { functionName: name, url: 'file:///game/module.js', lineNumber: 4, columnNumber: 8 }, children });
const profile = () => ({ head: node(1, 0, '(root)', [node(2, 1024, 'capture', [node(3, 2048, 'clone')])]), samples: [{ size: 2048, nodeId: 3, ordinal: 1 }] });
const tick = async () => { for (let i = 0; i < 6; i++) await Promise.resolve(); };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function samplerFixture() {
  const dbg = new EventEmitter(), commands = [], writes = [], failures = [], timers = new Map(); let attached = false, serial = 0, at = 100;
  dbg.attach = version => { commands.push(['attach', version]); attached = true; };
  dbg.isAttached = () => attached;
  dbg.detach = () => { commands.push(['detach']); attached = false; dbg.emit('detach', {}, 'closed'); };
  dbg.sendCommand = (command, params) => { commands.push([command, params]); return command === 'HeapProfiler.startSampling' ? Promise.resolve({}) : Promise.resolve({ profile: profile() }); };
  const clock = { now: () => at++, setInterval: (fn, ms) => { timers.set(++serial, { fn, ms }); return serial; }, clearInterval: id => timers.delete(id) };
  const options = { debugger: dbg, directory: '.', clock, write: (file, text) => writes.push({ file, value: JSON.parse(text) }), onFailure: error => failures.push(error) };
  return { dbg, commands, writes, failures, timers, options };
}
test('profiles preserve complete ancestry without heap objects or collected allocation history', () => {
  const p = profile(), result = compactAllocationProfile(p);
  assert.equal(result.nodes.length, 3); assert.equal(result.sampledLiveBytes, 3072);
  assert.deepEqual(result.topStacks[0].frames.map(f => f.functionName), ['(root)', 'capture', 'clone']);
  assert.equal(result.nodes[2].parentId, 2); assert.equal(result.nodes[2].lineNumber, 4);
  assert(!('samples' in result)); assert(!JSON.stringify(result).includes('ordinal')); assert.equal(p.head.children[0].children[0].selfSize, 2048);
  assert.throws(() => compactAllocationProfile({}), /head missing/);
});
test('requested sampling uses existing CDP, one MiB interval and ten second polls without an explicit GC command or altered limits', async () => {
  const f = samplerFixture(), sampler = await startCompositeAllocationSampling(f.options);
  assert.deepEqual(f.commands, [['attach', '1.3'], ['HeapProfiler.startSampling', { samplingInterval: 1048576 }], ['HeapProfiler.getSamplingProfile', undefined]]);
  assert.equal([...f.timers.values()][0].ms, 10000); assert.equal(f.writes.length, 2);
  assert.equal(f.writes[1].value.reason, 'initial'); assert.equal(f.writes[1].value.includeCollectedObjects, false); assert.equal(f.writes[1].value.protocolForcesGC, true);
  assert.equal(f.writes[1].value.nodes.length, 3); sampler.dispose(); assert.equal(f.timers.size, 0); assert.equal(f.failures.length, 0);
});
test('overlapping interval and stage requests send only one command and persist it once', async () => {
  const f = samplerFixture(), sampler = await startCompositeAllocationSampling(f.options), d = deferred(); let requests = 0;
  f.dbg.sendCommand = command => { assert.equal(command, 'HeapProfiler.getSamplingProfile'); requests++; return d.promise; };
  const a = sampler.sample('stage:save-start'), b = sampler.sample('interval'); await tick();
  assert.equal(requests, 1); d.resolve({ profile: profile() }); assert.deepEqual(await a, await b);
  assert.equal(f.writes.filter(row => row.file.startsWith('allocation-profile-')).length, 2); sampler.dispose();
});
test('dispose stops timers, detaches once and late samples cannot write or fail the closed run', async () => {
  const f = samplerFixture(), sampler = await startCompositeAllocationSampling(f.options), d = deferred();
  f.dbg.sendCommand = () => d.promise; const p = sampler.sample('stage:pending'); await tick(); sampler.dispose(); sampler.dispose();
  d.resolve({ profile: profile() }); assert.equal(await p, null); assert.equal(await sampler.sample('late'), null);
  assert.equal(f.writes.length, 2); assert.equal(f.commands.filter(c => c[0] === 'detach').length, 1); assert.equal(f.failures.length, 0);
});
test('a failed diagnostic records an error and fails explicitly without changing domain outcomes', async () => {
  const f = samplerFixture(), sampler = await startCompositeAllocationSampling(f.options);
  f.dbg.sendCommand = () => Promise.reject(Error('protocol unavailable'));
  await assert.rejects(sampler.sample('stage'), /protocol unavailable/);
  assert.equal(f.failures.length, 1); assert.equal(f.writes.at(-1).value.event, 'error'); assert.equal(f.timers.size, 0);
});
test('actual bridge diagnostic handler preserves a later renderer OOM instead of ending the run early', async () => {
  const bridge = fs.readFileSync(path.join(__dirname, '../../scripts/electron/bridge-main.cjs'), 'utf8');
  const source = bridge.match(/function recordCompositeDiagnosticFailure\(error\) \{[\s\S]*?\n\}/);
  assert(source, 'real bridge must expose the nonterminal diagnostic callback');
  assert(bridge.includes('onFailure:recordCompositeDiagnosticFailure}'));
  const failures = [], logs = []; let finished = false, result;
  function finish(error) { if (finished) return; finished = true; failures.push(String(error.message || error)); result = { ok: failures.length === 0, failures: failures.slice() }; }
  const handler = vm.runInNewContext(source[0] + ';recordCompositeDiagnosticFailure;', { failures, console: { error: text => logs.push(text) }, finish });
  const f = samplerFixture(); f.options.onFailure = handler;
  const sampler = await startCompositeAllocationSampling(f.options);
  f.dbg.sendCommand = () => Promise.reject(Error('CDP target closed'));
  await assert.rejects(sampler.sample('before-renderer-event'), /CDP target closed/);
  assert.equal(finished, false); assert.equal(f.timers.size, 0); assert.equal(failures.length, 1);
  finish(Error('render-process-gone: {"reason":"oom","exitCode":-536870904}'));
  assert.equal(result.ok, false); assert.equal(result.failures.length, 2);
  assert(result.failures[0].includes('CDP target closed')); assert(result.failures[1].includes('"reason":"oom"')); assert.equal(logs.length, 1);
});
test('an existing debugger attachment is not stolen or detached', async () => {
  const f = samplerFixture(); f.dbg.attach('existing');
  await assert.rejects(startCompositeAllocationSampling(f.options), /own debugger attachment/);
  assert(f.dbg.isAttached()); assert.deepEqual(f.commands, [['attach', 'existing']]); assert.equal(f.writes.length, 0);
});
function stageFixture() {
  const calls = [], logs = [], pending = deferred();
  const root = { GM: { turn: 3, day: 17 }, P: { secret: 'must-not-appear' }, _tmLoadGen: 2, _autoSaveCommittedRevision: 6,
    _autoSaveInFlight: false, _backgroundSaveInFlight: null, console: { info: text => logs.push(text) },
    performance: { memory: { jsHeapSizeLimit: 42, usedJSHeapSize: 21, totalJSHeapSize: 28 } },
    TM: { SimTime: { now: g => g.day }, RecoveryReview: { status: () => [{ id: 'review' }] } }, TM_SaveDB: {} };
  root._tmCommitBackgroundWorld = function(...args) { calls.push({ name: 'background', receiver: this, args }); return pending.promise; };
  root._buildSaveState = function(...args) { calls.push({ name: 'build', receiver: this, args }); return args[0]; };
  root.TM_SaveDB.createCanonicalPayload = function(...args) { calls.push({ name: 'payload', receiver: this, args }); return pending.promise; };
  root._tmRunDesktopAutoSaveTick = function(...args) { calls.push({ name: 'desktop', receiver: this, args }); throw args[0]; };
  return { root, calls, logs, pending };
}
test('stage observers preserve original this, argument identities, return values and Promise identity', async () => {
  const f = stageFixture(); assert.equal(installCompositeAllocationStages(f.root), true);
  const value = { large: 'not-logged' }, receiver = {};
  assert.equal(f.root._buildSaveState.call(receiver, value), value);
  assert.equal(f.root._tmCommitBackgroundWorld(value), f.pending.promise);
  assert.equal(f.root.TM_SaveDB.createCanonicalPayload(value), f.pending.promise);
  assert.equal(f.calls[0].receiver, receiver); assert.equal(f.calls[1].args[0], value); assert.equal(f.calls[2].receiver, f.root.TM_SaveDB);
  f.pending.resolve(value); await tick(); assert.equal(f.calls.length, 3);
  const rows = f.logs.map(line => JSON.parse(line.slice('COMPOSITE_ALLOCATION_STAGE '.length)));
  assert.equal(rows.length, 6); assert(rows.every(row => row.turn === 3 && row.day === 17 && row.load === 2 && row.heap.used === 21));
  assert(!f.logs.join('').includes('not-logged')); assert(!f.logs.join('').includes('must-not-appear'));
});
test('stage observers propagate exact synchronous errors and record Promise rejections once', async () => {
  const f = stageFixture(); installCompositeAllocationStages(f.root); const error = Error('original failure');
  assert.throws(() => f.root._tmRunDesktopAutoSaveTick(error), e => e === error);
  const p = f.root._tmCommitBackgroundWorld(); assert.equal(p, f.pending.promise);
  f.pending.reject(error); await assert.rejects(p, e => e === error); await tick();
  assert.equal(f.logs.filter(s => s.includes('"event":"throw"')).length, 1);
  assert.equal(f.logs.filter(s => s.includes('"event":"reject"')).length, 1); assert.equal(f.calls.length, 2);
});
test('allocation diagnostics are opt-in, disabled in ordinary CI and retain original gate deadlines', () => {
  const base = path.resolve(__dirname, '../..'), bridge = fs.readFileSync(path.join(base, 'scripts/electron/bridge-main.cjs'), 'utf8');
  const cases = fs.readFileSync(path.join(base, 'scripts/electron/npc-composite-cases.cjs'), 'utf8'), ci = fs.readFileSync(path.join(base, '.github/workflows/ci.yml'), 'utf8');
  assert(bridge.includes("mode==='npc-composite'&&process.env.TM_BRIDGE_HEAP_SAMPLING==='1'"));
  assert(cases.includes("if(process.env.TM_BRIDGE_HEAP_SAMPLING==='1')")); assert(ci.includes("TM_BRIDGE_HEAP_SAMPLING: '0'"));
  assert(bridge.includes("mode === 'npc-composite' ? 1800000")); assert(bridge.includes('process.getSystemMemoryInfo()'));
  const helper = fs.readFileSync(path.join(base, 'scripts/electron/npc-composite-diagnostics.cjs'), 'utf8');
  assert(!helper.includes('takeHeapSnapshot')); assert(!helper.includes("sendCommand('HeapProfiler.collectGarbage'")); assert(!helper.includes('max-old-space-size'));
});
test('visible result evidence follows actual background settlement and normal UI reopening', () => {
  const text = fs.readFileSync(path.join(__dirname, '../../scripts/electron/npc-composite-cases.cjs'), 'utf8');
  const settled = text.indexOf("timeline.push({stage:'final-review-and-save-settled'"), visible = text.indexOf("timeline.push({stage:'visible-formal-result'");
  assert(settled >= 0 && visible > settled); assert(text.indexOf("await screenshot('04-completed-return')") > settled);
  const scope = text.slice(settled, visible); assert(scope.includes('await closeLetters();await openLetters();'));
  assert(scope.includes('document.elementFromPoint')); assert(scope.includes('getComputedStyle')); assert(scope.includes("result was hidden during capture"));
});
(async () => { let pass = 0, fail = 0; for (const t of tests) { try { await t.run(); pass++; console.log('PASS ' + t.name); } catch (error) { fail++; console.error('FAIL ' + t.name + '\n' + error.stack); } } console.log(JSON.stringify({ pass, fail, total: tests.length })); if (fail) process.exitCode = 1; })();
