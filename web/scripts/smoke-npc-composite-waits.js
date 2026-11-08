'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const { installCompositeWaits, installCompositeEconomyObservers, reconcileCompositeEconomy, waitForCompositeBackground } = require('../../scripts/electron/npc-composite-waits.cjs');
const { fixture: desktopFixture } = require('./lib-desktop-autosave-reliability');
const tests = [], test = (name, run) => tests.push({ name, run });
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const tick = async () => { await Promise.resolve(); await Promise.resolve(); };
function fixture(deadlineAt = 1800000, inspect = false) {
  let now = 0, serial = 0; const timers = new Map(), calls = [], heldRecords = [];
  const clock = { now: () => now, setTimeout: (fn, delay) => { const id = ++serial; timers.set(id, { fn, at: now + delay }); return id; }, clearTimeout: id => timers.delete(id) };
  const pending = { turn: deferred(), save: deferred(), load: deferred() };
  const root = { GM: { turn: 3, running: true, _campaignId: 'campaign', _timelineId: 'timeline', busy: false, _endTurnBusy: false, _endTurnCommitPending: false }, P: {}, _tmLoadGen: 7 };
  root.TM = { SimTime: { now: g => Number(g.day || 0) } };
  root._endTurnInternal = function() { calls.push({ kind: 'turn', receiver: this, args: [...arguments] }); root.GM.busy = root.GM._endTurnBusy = root.GM._endTurnCommitPending = true; return pending.turn.promise; };
  root.saveToSlot = function() { calls.push({ kind: 'save', receiver: this, args: [...arguments] }); return pending.save.promise; };
  root.SaveManager = { loadFromSlot: function() { calls.push({ kind: 'load', receiver: this, args: [...arguments] }); return pending.load.promise; } };
  root._tmCommitEndTurnTransaction = function(txn) { calls.push({ kind: 'commit', receiver: this, args: [...arguments] }); if (txn.rejectCommit) return false; txn.committed = true; root.GM._endTurnCommitPending = false; return true; };
  let install = installCompositeWaits;
  if (inspect) {
    // The actual serialized helper used by Electron, with a VM-only Map observer.
    // This inspects ownership without adding production/debug exports to the helper.
    class ObservedMap extends Map { set(key, value) { if (typeof key === 'number' && value.kind) heldRecords.push(value); return super.set(key, value); } }
    install = vm.runInNewContext('(' + installCompositeWaits.toString() + ')', { Map: ObservedMap, Promise, Number, String, Array, Error });
  }
  const waits = install(root, deadlineAt, clock);
  function txn(extra = {}) { return Object.assign({ gmRef: root.GM, pRef: root.P, loadGen: root._tmLoadGen, turn: 3, campaignId: 'campaign', timelineId: 'timeline', transactionId: 'turn-commit', committed: false,
    canonicalSaveReceipt: { state: 'committed', transactionId: 'turn-commit', slots: ['autosave', 'slot_0'].map(id => ({ id, campaignId: 'campaign', timelineId: 'timeline' })) } }, extra); }
  function idle() { root.GM.busy = root.GM._endTurnBusy = root.GM._endTurnCommitPending = false; }
  function advance(ms) { now += ms; for (const [id, task] of [...timers]) if (task.at <= now) { timers.delete(id); task.fn(); } }
  return { root, waits, pending, calls, heldRecords, timers, clock, txn, idle, advance };
}
test('real turn Promise stays pending after turn advancement and commit until final work settles', async () => {
  const f = fixture(), id = f.waits.arm('turn'), options = { postTurnCourt: false }, receiver = { caller: 'UI' };
  const returned = f.root._endTurnInternal.call(receiver, options); assert.equal(returned, f.pending.turn.promise);
  assert.equal(f.calls.length, 1); assert.equal(f.calls[0].receiver, receiver); assert.equal(f.calls[0].args[0], options);
  let settled = false; f.waits.wait(id).then(() => { settled = true; }); f.root.GM.turn++;
  for (let i = 0; i < 750; i++) { f.advance(100); f.waits.snapshot(); }
  await tick(); assert.equal(settled, false, 'more than the old 500 polls cannot manufacture completion');
  const transaction = f.txn(); assert.equal(f.root._tmCommitEndTurnTransaction(transaction), true); await tick(); assert.equal(settled, false);
  f.idle(); f.pending.turn.resolve(); const result = await f.waits.wait(id);
  assert.equal(result.status, 'completed'); assert.equal(result.invocations, 1); assert.equal(result.before.turn, 3); assert.equal(result.after.turn, 4);
  assert.equal(result.commit.transactionId, transaction.transactionId); assert.deepEqual(result.commit.slots, ['autosave', 'slot_0']);
});
test('global save producer waits through prompt, background jobs and UI refresh and requires true', async () => {
  const f = fixture(), id = f.waits.arm('save', 2), receiver = { ui: true }, extra = { unchanged: true };
  const returned = f.root.saveToSlot.call(receiver, 2, extra); assert.equal(returned, f.pending.save.promise);
  assert.equal(f.calls[0].receiver, receiver); assert.deepEqual(f.calls[0].args, [2, extra]);
  f.advance(120000); await tick(); assert.equal(f.waits.snapshot()[0].status, 'pending');
  f.pending.save.resolve(true); const result = await f.waits.wait(id); assert.equal(result.result, true); assert.equal(result.slot, 2); assert.equal(result.invocations, 1);
});
for (const value of [false, undefined, { ok: true }]) test('fulfilled save without strict true is rejected: ' + String(value), async () => {
  const f = fixture(), id = f.waits.arm('save', 1); f.root.saveToSlot(1); f.pending.save.resolve(value);
  await assert.rejects(f.waits.wait(id), /true commit receipt/);
});
for (const outcome of ['no-commit', 'false-commit', 'rollback', 'unconfirmed']) test('turn fulfillment cannot certify ' + outcome, async () => {
  const f = fixture(), id = f.waits.arm('turn'); f.root._endTurnInternal(); f.root.GM.turn++; f.idle();
  if (outcome === 'false-commit') assert.equal(f.root._tmCommitEndTurnTransaction(f.txn({ rejectCommit: true })), false);
  if (outcome === 'rollback') { f.root.GM.turn--; f.root.GM._lastEndTurnRollback = { turn: f.root.GM.turn }; }
  if (outcome === 'unconfirmed') { f.root.GM.busy = true; f.root.GM._endTurnCommitPending = true; }
  f.pending.turn.resolve(); await assert.rejects(f.waits.wait(id), /no genuine commit|before a confirmed idle commit/);
});
test('a nominal true commit with a foreign canonical receipt still fails', async () => {
  const f = fixture(), id = f.waits.arm('turn'); f.root._endTurnInternal(); f.root.GM.turn++;
  const transaction = f.txn(); transaction.canonicalSaveReceipt.transactionId = 'foreign'; f.root._tmCommitEndTurnTransaction(transaction);
  await assert.rejects(f.waits.wait(id), /invalid or repeated/); f.idle(); f.pending.turn.resolve();
});
test('rejected and synchronously throwing producers preserve failure and original behavior', async () => {
  const f = fixture(), id = f.waits.arm('save', 1), error = Error('actual save failure');
  assert.equal(f.root.saveToSlot(1), f.pending.save.promise); f.pending.save.reject(error); await assert.rejects(f.waits.wait(id), /actual save failure/);
  const g = fixture(), realThrow = Error('actual UI throw'); g.root.saveToSlot = function() { throw realThrow; };
  const waits = installCompositeWaits(g.root, 1800000, g.clock), ticket = waits.arm('save', 1);
  assert.throws(() => g.root.saveToSlot(1), e => e === realThrow); await assert.rejects(waits.wait(ticket), /actual UI throw/);
});
for (const change of ['GM', 'P', 'generation', 'timeline']) test('save completion rejects cross-world mutation: ' + change, async () => {
  const f = fixture(), id = f.waits.arm('save', 1); f.root.saveToSlot(1);
  if (change === 'GM') f.root.GM = { ...f.root.GM }; if (change === 'P') f.root.P = {};
  if (change === 'generation') f.root._tmLoadGen++; if (change === 'timeline') f.root.GM._timelineId = 'other';
  f.pending.save.resolve(true); await assert.rejects(f.waits.wait(id), /crossed its original world/);
});
test('duplicate and wrong-slot calls fail while every original invocation still executes exactly once', async () => {
  const f = fixture(), id = f.waits.arm('save', 1);
  assert.equal(f.root.saveToSlot(1), f.pending.save.promise); assert.equal(f.root.saveToSlot(1), f.pending.save.promise);
  assert.equal(f.calls.length, 2); await assert.rejects(f.waits.wait(id), /duplicate/); f.pending.save.resolve(true);
  const g = fixture(), ticket = g.waits.arm('save', 2); assert.equal(g.root.saveToSlot(1), g.pending.save.promise);
  assert.equal(g.calls.length, 1); await assert.rejects(g.waits.wait(ticket), /wrong slot/); g.pending.save.resolve(true);
});
test('a duplicate call after settlement cannot reuse the previous passing ticket', async () => {
  const f = fixture(), id = f.waits.arm('save', 1); f.root.saveToSlot(1); f.pending.save.resolve(true); await f.waits.wait(id);
  f.root.saveToSlot(1); await assert.rejects(f.waits.wait(id), /duplicate/); assert.throws(() => f.waits.arm('save', 1), /failed/);
});
test('load requires its real true receipt and an idle replacement world with an advancing generation', async () => {
  const f = fixture(), id = f.waits.arm('load', 2); assert.equal(f.root.SaveManager.loadFromSlot(2), f.pending.load.promise);
  assert.equal(f.calls[0].receiver, f.root.SaveManager); f.advance(120000);
  f.root.GM = { ...f.root.GM, _timelineId: 'loaded-fork' }; f.root.P = {}; f.root._tmLoadGen++;
  f.pending.load.resolve(true); const result = await f.waits.wait(id); assert.equal(result.slot, 2); assert.equal(result.result, true); assert(result.after.load > result.before.load);
  for (const bad of [false, true]) { const g = fixture(), ticket = g.waits.arm('load', 1); g.root.SaveManager.loadFromSlot(1); g.pending.load.resolve(bad); await assert.rejects(g.waits.wait(ticket), /expected recovered world/); }
});
test('one suite deadline covers all producers, including unstarted UI calls, and never resets', async () => {
  const f = fixture(1000), first = f.waits.arm('save', 1); f.root.saveToSlot(1); f.advance(600); f.pending.save.resolve(true); await f.waits.wait(first);
  const second = f.waits.arm('load', 1); assert.equal([...f.timers.values()][0].at, 1000);
  f.advance(399); assert.equal(f.waits.snapshot()[1].status, 'armed'); f.advance(1);
  await assert.rejects(f.waits.wait(second), /suite deadline/); await assert.rejects(f.waits.wait(first), /suite deadline/);
  assert.throws(() => f.waits.arm('turn'), /suite deadline/); assert(f.waits.snapshot().every(row => row.deadlineAt === 1000));
});
test('finished, failed and timed-out observers release world references and expose only primitive receipts', async () => {
  for (const outcome of ['saved', 'failed', 'deadline']) {
    const f = fixture(1000, true), id = f.waits.arm('save', 1); f.root.saveToSlot(1); assert.equal(f.heldRecords[0].world.gm, f.root.GM);
    if (outcome === 'deadline') f.advance(1000); else f.pending.save.resolve(outcome === 'saved');
    if (outcome === 'saved') await f.waits.wait(id); else await assert.rejects(f.waits.wait(id));
    assert.equal(f.heldRecords[0].world, null); assert.equal(f.heldRecords[0].resolve, null); assert.equal(f.heldRecords[0].reject, null);
    const json = JSON.stringify(f.waits.snapshot()); assert(!json.includes('gmRef')); assert(!json.includes('canonicalSaveReceipt'));
    if (outcome === 'deadline') f.pending.save.resolve(true);
  }
});
function economyEvidence() {
  const tickets = [], calls = { systems: [], provinceEconomy: [] };
  for (const [index, range] of [[30, 31.7], [31.7, 37], [37, 60]].entries()) {
    const before = { turn: index + 3, day: range[0], load: index + 7, campaignId: 'campaign', timelineId: 'load-' + index };
    const after = { ...before, turn: before.turn + 1, day: range[1] }, days = after.day - before.day;
    tickets.push({ id: index + 1, kind: 'turn', status: 'completed', result: true, invocations: 1, before, after, commit: { ...after } });
    calls.systems.push({ ...before, beforeDay: before.day, afterDay: after.day, afterWorld: { ...after }, days, status: 'completed', error: null });
    calls.provinceEconomy.push({ ...after, beforeDay: after.day, afterDay: after.day, afterWorld: { ...after }, days, status: 'completed', error: null,
      province: 'p1', before: { wealth: 1 }, after: { wealth: 2 } });
  }
  return { tickets, calls };
}
test('economy reconciles every genuine turn across load generations and fractional day boundaries', () => {
  const e = economyEvidence(), before = JSON.stringify(e), result = reconcileCompositeEconomy(e.tickets, e.calls);
  assert.equal(result.turns, 3); assert.equal(result.systems, 3); assert.equal(result.provinceEconomy, 3);
  assert.deepEqual(result.intervals.map(row => row.load), [7, 8, 9]);
  assert.deepEqual(result.intervals.map(row => row.days), e.tickets.map(row => row.after.day - row.before.day));
  assert.equal(JSON.stringify(e), before, 'reconciliation must not edit evidence or world state');
});
for (const [name, mutate, expected] of [
  ['both observations omit the same turn', e => { e.calls.systems.splice(1, 1); e.calls.provinceEconomy.splice(1, 1); }, /exactly one/],
  ['both observations duplicate one turn and omit another', e => { e.calls.systems[1] = e.calls.systems[0]; e.calls.provinceEconomy[1] = e.calls.provinceEconomy[0]; }, /missing or duplicate/],
  ['an extra systems call', e => e.calls.systems.push(e.calls.systems[0]), /exactly one/],
  ['an extra economy call', e => e.calls.provinceEconomy.push(e.calls.provinceEconomy[0]), /exactly one/],
  ['systems throws even if its caller later commits', e => { e.calls.systems[0].status = 'failed'; e.calls.systems[0].error = 'real systems throw'; }, /pending or failed/],
  ['economy throws even if its caller later commits', e => { e.calls.provinceEconomy[0].status = 'failed'; e.calls.provinceEconomy[0].error = 'real economy throw'; }, /pending or failed/],
  ['unsettled systems work', e => { e.calls.systems[0].status = 'pending'; }, /pending or failed/],
  ['entry belongs to another load', e => { e.calls.provinceEconomy[0].load++; }, /missing or duplicate/],
  ['entry belongs to another campaign', e => { e.calls.systems[0].campaignId = 'foreign'; }, /missing or duplicate/],
  ['entry belongs to another timeline', e => { e.calls.systems[0].timelineId = 'foreign'; }, /missing or duplicate/],
  ['settlement finishes after a load', e => { e.calls.systems[0].afterWorld.load++; }, /crossed its world/],
  ['settlement finishes in another campaign', e => { e.calls.provinceEconomy[0].afterWorld.campaignId = 'foreign'; }, /crossed its world/],
  ['days were configured instead of the actual fractional interval', e => { e.calls.provinceEconomy[0].days = 30; }, /days do not match/],
  ['zero days', e => { e.calls.systems[0].days = 0; }, /days do not match/],
  ['non-finite days', e => { e.calls.systems[0].days = NaN; }, /days do not match/],
  ['wrong start day', e => { e.calls.systems[0].beforeDay++; }, /start day/],
  ['wrong end day', e => { e.calls.provinceEconomy[0].afterDay++; }, /end day/],
  ['economy ran before time commit', e => { e.calls.provinceEconomy[0].day = 30; }, /after the actual time commit/],
  ['a nonpositive completed interval', e => { e.tickets[0].after.day = e.tickets[0].before.day; }, /positive elapsed days/],
  ['a failed top-level turn', e => { e.tickets[0].status = 'failed'; }, /genuine single completion/],
  ['a missing genuine commit', e => { e.tickets[0].commit = null; }, /genuine single completion/],
  ['commit belongs to another load', e => { e.tickets[0].commit.load++; }, /commit identity/],
  ['duplicate completed turn identity', e => { e.tickets[1] = e.tickets[0]; }, /duplicate completed/],
  ['missing source sample', e => { e.calls.provinceEconomy[0].after = null; }, /source samples/]
]) test('economy rejects ' + name, () => { const e = economyEvidence(); mutate(e); assert.throws(() => reconcileCompositeEconomy(e.tickets, e.calls), expected); });
function economyObserverFixture(systems, economy) {
  const calls = { systems: [], provinceEconomy: [] };
  const root = { GM: { turn: 3, day: 30, _campaignId: 'campaign', _timelineId: 'timeline', provinceStats: { p1: { wealth: 1 } } },
    _tmLoadGen: 7, TM: { SimTime: { now: g => g.day } }, _getDaysPerTurn: () => 1.7,
    _endTurn_updateSystems: systems, updateProvinceEconomy: economy };
  // Exercise the same standalone function text injected into the real renderer.
  vm.runInNewContext('(' + installCompositeEconomyObservers.toString() + ')')(root, calls);
  return { root, calls };
}
test('settlement entry is visible while pending and original Promise, receiver and arguments are preserved', async () => {
  const pending = deferred(), args = [{ actual: true }, 'text'], receiver = {}, seen = [];
  const f = economyObserverFixture(function() { seen.push({ receiver: this, args: [...arguments], status: f.calls.systems[0].status }); return pending.promise; }, () => 17);
  const result = f.root._endTurn_updateSystems.apply(receiver, args);
  assert.equal(result, pending.promise); assert.deepEqual(seen, [{ receiver, args, status: 'pending' }]);
  assert.equal(f.calls.systems[0].status, 'pending'); f.root.GM.turn++; f.root.GM.day = 31.7;
  pending.resolve('original result'); assert.equal(await result, 'original result'); await tick();
  assert.equal(f.calls.systems[0].status, 'completed'); assert.equal(f.calls.systems[0].afterWorld.turn, 4);
  assert.equal(f.calls.systems[0].afterWorld.load, 7); assert.equal(f.root.updateProvinceEconomy(), 17);
  assert.equal(f.calls.provinceEconomy[0].status, 'completed');
});
test('settlement throws and rejections remain original and leave failed observations, including falsy errors', async () => {
  for (const failure of [Error('real settlement failure'), null, undefined]) {
    const pending = deferred();
    const f = economyObserverFixture(() => pending.promise, function() { assert.equal(f.calls.provinceEconomy[0].status, 'pending'); throw failure; });
    let caught = false; try { f.root.updateProvinceEconomy(); } catch (error) { caught = true; assert.equal(error, failure); }
    assert(caught); assert.equal(f.calls.provinceEconomy[0].status, 'failed');
    const original = f.root._endTurn_updateSystems(); assert.equal(original, pending.promise); pending.reject(failure);
    caught = false; try { await original; } catch (error) { caught = true; assert.equal(error, failure); }
    assert(caught); await tick(); assert.equal(f.calls.systems[0].status, 'failed');
  }
});
test('settlement observations retain only primitive identity and numeric province samples across world replacement', async () => {
  const pending = deferred(), f = economyObserverFixture(() => pending.promise, () => true);
  f.root.GM.provinceStats.p1.wealth = { mustNotRetainWorld: f.root.GM };
  f.root.updateProvinceEconomy(); assert.equal(f.calls.provinceEconomy[0].before.wealth, null);
  const original = f.root._endTurn_updateSystems(); f.root.GM = { ...f.root.GM, _timelineId: 'replacement', provinceStats: {} }; f.root._tmLoadGen++;
  pending.resolve(); await original; await tick(); assert.equal(f.calls.systems[0].load, 7); assert.equal(f.calls.systems[0].afterWorld.load, 8);
  const json = JSON.stringify(f.calls); assert(!json.includes('mustNotRetainWorld')); assert(!json.includes('provinceStats'));
});
function backgroundFixture() {
  let now = 1000, serial = 0; const timers = new Map(), frames = new Map(), logs = [], forbidden = [];
  const clock = { now: () => now, setTimeout: (fn, ms) => { const id = ++serial; timers.set(id, { fn, at: now + ms }); return id; }, clearTimeout: id => timers.delete(id) };
  const root = { GM: { turn: 5, day: 60, running: true, _campaignId: 'campaign', _timelineId: 'timeline', _backgroundSaveFailures: [],
      shijiHistory: [{ turn: 4, agentReview: { status: 'verified', verified: true, calls: 2 } }] }, P: {}, _tmLoadGen: 2, _tmAutoSaveSessionToken: 'session',
    TM: { SimTime: { now: g => g.day }, RecoveryReview: { status: () => root.review } }, review: [], transactionActive: false,
    isWorldTransactionActive: () => root.transactionActive, __compositeCalls: { fixtureErrors: [] }, console: { info: line => logs.push(line) },
    _backgroundSavePending: null, _backgroundSaveInFlight: null, _backgroundSaveTimer: null, _autoSaveInFlight: false, _autoSaveInFlightPromise: null,
    _autoSaveFlushTimer: null, _autoSaveDeferred: false, _autoSaveNativePending: null, _autoSaveTransportEvents: [], _autoSaveCommittedRevision: 9, _autoSaveLastSavedRevision: 9,
    _autoSaveLastSavedTurn: 5, _autoSaveLastDoneMs: 900, lastCommittedSnapshot: { GM: {}, P: {} }, lastCommittedTurn: 5, lastCommittedTransactionId: 'background:final',
    _lastCommittedSnapshotIdentity: { campaignId: 'campaign', timelineId: 'timeline', sessionToken: 'session', loadGeneration: 2, turn: 5, transactionId: 'background:final' },
    requestAnimationFrame: fn => { const id = ++serial; frames.set(id, fn); return id; }, cancelAnimationFrame: id => frames.delete(id) };
  for (const key of ['requestBackgroundAutosave', '_tmDrainBackgroundAutosaves', '_tmAwaitBackgroundAutosaves', '_tmRunDesktopAutoSaveTick',
    '_awaitPostTurnJobsForSave', '_tmGetDesktopAutoSaveSessionToken']) root[key] = () => { forbidden.push(key); throw Error('observer invoked ' + key); };
  root.TM.RecoveryReview.cancel = root.requestBackgroundAutosave;
  // The actual standalone function is injected into Electron through this same serialization.
  const observe = vm.runInNewContext('(' + waitForCompositeBackground.toString() + ')');
  function start(deadline = 2000) { return observe(root, deadline, 500, clock); }
  async function frame() { for(let i=0;i<8;i++)await Promise.resolve(); const pending = [...frames.values()]; frames.clear(); pending.forEach(fn => fn()); for(let i=0;i<8;i++)await Promise.resolve(); }
  function advance(ms) { now += ms; for (const [id, task] of [...timers]) if (task.at <= now) { timers.delete(id); task.fn(); } }
  return { root, start, frame, advance, timers, frames, logs, forbidden };
}
test('final background waits for review, canonical save and actual desktop acknowledgement, then two equal reads', async () => {
  const f = backgroundFixture(), canonical = deferred(), desktop = deferred();
  f.root.review = [{ id: 'review-final', phase: 'investigating', calls: 2 }];
  f.root._backgroundSaveInFlight = canonical.promise;
  const waiting = f.start(); let finished = false; waiting.then(() => { finished = true; });
  await f.frame(); assert.equal(finished, false); assert.equal(f.root._backgroundSaveInFlight, canonical.promise);
  f.root.review = []; f.root._backgroundSaveInFlight = null; f.root._autoSaveCommittedRevision++;
  f.root._autoSaveInFlight = true; f.root._autoSaveInFlightPromise = desktop.promise; f.root._autoSaveNativePending = { timedOut: false };
  canonical.resolve({ ok: true }); await f.frame(); assert.equal(finished, false);
  f.root._autoSaveInFlight = false; f.root._autoSaveInFlightPromise = null; f.root._autoSaveNativePending = null;
  f.root._autoSaveLastSavedRevision++; f.root._autoSaveLastDoneMs = 1000; desktop.resolve({ ok: true });
  await f.frame(); assert.equal(finished, false); await f.frame();
  const result = await waiting; assert.equal(result.status, 'settled'); assert.equal(result.state.saved.revision, 10);
  assert.equal(result.state.lastReview.verified, true); assert.equal(result.deadlineAt, 2000);
  assert.deepEqual(f.forbidden, []); assert.equal(f.timers.size, 0); assert.equal(f.frames.size, 0);
});
for (const [name, change] of [
  ['native write still pending after outer flags clear', r => { r._autoSaveNativePending = { timedOut: true }; }],
  ['unwritten canonical revision', r => { r._autoSaveLastSavedRevision--; }],
  ['unwritten current turn', r => { r._autoSaveLastSavedTurn--; }],
  ['no acknowledged desktop write', r => { r._autoSaveLastDoneMs = 0; }],
  ['empty canonical world', r => { r.lastCommittedSnapshot = {}; }],
  ['mismatched canonical session', r => { r._lastCommittedSnapshotIdentity.sessionToken = 'old-session'; }],
  ['mismatched canonical load', r => { r._lastCommittedSnapshotIdentity.loadGeneration--; }],
  ['mismatched canonical transaction', r => { r._lastCommittedSnapshotIdentity.transactionId = 'old-transaction'; }],
  ['pending canonical request', r => { r._backgroundSavePending = {}; }],
  ['scheduled canonical timer', r => { r._backgroundSaveTimer = 8; }],
  ['scheduled desktop flush', r => { r._autoSaveFlushTimer = 9; }],
  ['deferred desktop flush', r => { r._autoSaveDeferred = true; }],
  ['active world transaction', r => { r.transactionActive = true; }]
]) test('final background cannot pass with ' + name, async () => {
  const f = backgroundFixture(); change(f.root); const waiting = f.start(); const rejected = assert.rejects(waiting, /suite deadline exceeded/);
  await f.frame(); await f.frame(); assert.equal(f.timers.size, 1); f.advance(1000); await rejected;
  assert.equal(f.frames.size, 0); assert.deepEqual(f.forbidden, []);
});
test('final background detects a microtask rearm between two apparently idle reads', async () => {
  const f = backgroundFixture(), waiting = f.start(); let finished = false; waiting.then(() => { finished = true; });
  await Promise.resolve().then(() => { f.root._backgroundSavePending = {}; f.root._autoSaveCommittedRevision++; });
  await f.frame(); assert.equal(finished, false);
  f.root._backgroundSavePending = null; await f.frame(); assert.equal(finished, false, 'empty queues cannot hide the unwritten revision');
  f.root._autoSaveLastSavedRevision++; await f.frame(); assert.equal(finished, false); await f.frame();
  assert.equal((await waiting).state.saved.revision, 10);
});
test('final background rejects a new canonical failure even when old saved and committed revisions match', async () => {
  for (const beforeStart of [false, true]) {
    const f = backgroundFixture(), failure = { turn: 5, at: 800, attempts: 2, reasons: ['turn-review-verified'], message: 'disk write failed' };
    if (beforeStart) f.root.GM._backgroundSaveFailures.push(failure);
    const waiting = f.start(), rejected = assert.rejects(waiting, /canonical save failed/);
    if (!beforeStart) { f.root.GM._backgroundSaveFailures.push(failure); await f.frame(); }
    await rejected; assert.equal(f.timers.size, 0);
  }
});
test('final background rejects a fixture error that arrives after the gameplay assertions', async () => {
  const f = backgroundFixture(), waiting = f.start(), rejected = assert.rejects(waiting, /late fixture protocol failure/);
  f.root.__compositeCalls.fixtureErrors.push({ error: 'late unsupported response' }); await f.frame(); await rejected;
});
for (const kind of ['canonical', 'desktop']) test('a failed ' + kind + ' producer cannot reuse an older matching saved revision', async () => {
  const f = backgroundFixture(), pending = deferred(), field = kind === 'canonical' ? '_backgroundSaveInFlight' : '_autoSaveInFlightPromise';
  f.root[field] = pending.promise; const waiting = f.start(), rejected = assert.rejects(waiting, /save producer did not confirm success/);
  f.root[field] = null; pending.resolve({ ok: false, error: Error('actual write failure') }); await rejected;
});
test('a naturally scheduled canonical retry must finish before the final desktop revision is accepted', async () => {
  const f = backgroundFixture(), first = deferred(), retry = deferred(); f.root._backgroundSaveInFlight = first.promise;
  const waiting = f.start(); f.root._backgroundSaveInFlight = null; f.root._backgroundSavePending = {};
  first.resolve({ ok: false, error: Error('transient write failure') }); await f.frame();
  f.root._backgroundSavePending = null; f.root._backgroundSaveInFlight = retry.promise; await f.frame();
  f.root._backgroundSaveInFlight = null; f.root._autoSaveCommittedRevision++; f.root._autoSaveLastSavedRevision++;
  retry.resolve({ ok: true }); await f.frame(); await f.frame();
  const result = await waiting; assert.deepEqual(Array.from(result.producerReceipts, row => row.ok), [false, true]); assert.deepEqual(f.forbidden, []);
});
test('a stale canonical no-write cannot substitute for the current durable revision', async () => {
  const f = backgroundFixture(), pending = deferred(); f.root._backgroundSaveInFlight = pending.promise; f.root._autoSaveCommittedRevision++;
  const waiting = f.start(); let finished = false; waiting.then(() => { finished = true; });
  f.root._backgroundSaveInFlight = null; pending.resolve({ ok: false, stale: true }); await f.frame(); await f.frame(); assert.equal(finished, false);
  f.root._autoSaveLastSavedRevision++; await f.frame(); await f.frame();
  const result = await waiting; assert.equal(result.producerReceipts[0].stale, true); assert.equal(result.producerReceipts[0].ok, false);
});
test('a superseded pre-dispatch desktop write waits for its queued newer revision and keeps the negative receipt', async () => {
  const production = desktopFixture(), operation = production.save(); production.adopt(); const negative = await operation;
  assert.equal(negative.ok, false); assert.equal(negative.error.code, 'DESKTOP_AUTOSAVE_STALE'); assert.equal(production.calls.length, 0);
  const event = production.status().events.slice(-1)[0]; assert.equal(event.phase, 'rejected');
  for (const historyLength of [0, 12]) {
  const f = backgroundFixture(), old = deferred(), current = deferred(); f.root._autoSaveInFlightPromise = old.promise;
  f.root._autoSaveTransportEvents = Array.from({length:historyLength},(_,index)=>({phase:'acknowledged',at:100+index}));
  const waiting = f.start(); let finished = false; waiting.then(() => { finished = true; });
  f.root._autoSaveCommittedRevision++; f.root._autoSaveDeferred = true; f.root._autoSaveInFlightPromise = null;
  f.root._autoSaveTransportEvents.push(event); if(f.root._autoSaveTransportEvents.length>12)f.root._autoSaveTransportEvents.shift(); old.resolve(negative);
  await f.frame(); assert.equal(finished, false);
  f.root._autoSaveDeferred = false; f.root._autoSaveInFlight = true; f.root._autoSaveInFlightPromise = current.promise; await f.frame();
  assert.equal(finished, false); f.root._autoSaveInFlight = false; f.root._autoSaveInFlightPromise = null; f.root._autoSaveLastSavedRevision++;
  current.resolve({ ok: true }); await f.frame(); await f.frame();
  const result = await waiting; assert.equal(result.state.saved.revision, 10); assert.equal(result.producerReceipts[0].ok, false);
  assert.equal(result.producerReceipts[0].superseded, true); assert.equal(result.producerReceipts[0].fromRevision, 9); assert.equal(result.producerReceipts[0].toRevision, 10);
  assert.equal(result.producerReceipts[0].transportEvidence.rejectedBeforeDispatch, true);
  assert.equal(result.producerReceipts[1].ok, true); assert.deepEqual(f.forbidden, []);
  }
});
for (const missing of ['revision', 'flush', 'code', 'world', 'identity']) test('a negative desktop receipt cannot be excused without valid supersession ' + missing, async () => {
  const f = backgroundFixture(), old = deferred(); f.root._autoSaveInFlightPromise = old.promise;
  const waiting = f.start(), rejected = assert.rejects(waiting, /save producer did not confirm success/);
  if (missing !== 'revision') f.root._autoSaveCommittedRevision++;
  if (missing !== 'flush') f.root._autoSaveDeferred = true;
  if (missing === 'world') f.root._tmLoadGen++;
  if (missing === 'identity') f.root._lastCommittedSnapshotIdentity.sessionToken = 'foreign';
  f.root._autoSaveInFlightPromise = null;
  f.root._autoSaveTransportEvents.push({phase:'rejected',at:1000});
  old.resolve({ ok: false, error: Object.assign(Error('自动存档写入期间已跨档失效'), { code: missing === 'code' ? 'EIO' : 'DESKTOP_AUTOSAVE_STALE' }) });
  await rejected;
});
test('a real foreign-success acknowledgement cannot be labelled pre-dispatch supersession', async () => {
  const production = desktopFixture();
  // Explicit malformed shell reply exercises the production renderer's later session check.
  production.c.tianming = {...production.api, autoSaveJson: async()=>({success:true,sessionToken:'foreign-session'})};
  const negative = await production.save(); assert.equal(negative.ok,false); assert.equal(negative.error.code,'DESKTOP_AUTOSAVE_STALE');
  const events = production.status().events; assert.equal(events[events.length-1].phase,'acknowledged');
  const f = backgroundFixture(), old = deferred(); f.root._autoSaveInFlightPromise = old.promise;
  const waiting = f.start(), rejected = assert.rejects(waiting,/save producer did not confirm success/);
  f.root._autoSaveCommittedRevision++; f.root._autoSaveDeferred=true; f.root._autoSaveInFlightPromise=null;
  f.root._autoSaveTransportEvents=events; old.resolve(negative); await rejected;
});
test('an uncorrelatable full transport ring cannot justify superseding a negative desktop receipt', async () => {
  for(const ambiguous of ['two-events','same-time','missing']){
    const f=backgroundFixture(),old=deferred();f.root._autoSaveInFlightPromise=old.promise;
    f.root._autoSaveTransportEvents=Array.from({length:12},(_,index)=>({phase:'rejected',at:1000+index}));
    const waiting=f.start(),rejected=assert.rejects(waiting,/save producer did not confirm success/);
    f.root._autoSaveCommittedRevision++;f.root._autoSaveDeferred=true;f.root._autoSaveInFlightPromise=null;
    if(ambiguous==='two-events')f.root._autoSaveTransportEvents=f.root._autoSaveTransportEvents.slice(2).concat([{phase:'acknowledged',at:1100},{phase:'rejected',at:1101}]);
    if(ambiguous==='same-time')f.root._autoSaveTransportEvents=f.root._autoSaveTransportEvents.slice(1).concat([{phase:'rejected',at:1011}]);
    if(ambiguous==='missing')delete f.root._autoSaveTransportEvents;
    old.resolve({ok:false,error:Object.assign(Error('stale'),{code:'DESKTOP_AUTOSAVE_STALE'})});await rejected;
  }
});
test('identical millisecond entries in a full ring cannot hide an acknowledgement before rejection', async () => {
  const f=backgroundFixture(),old=deferred();f.root._autoSaveInFlightPromise=old.promise;
  f.root._autoSaveTransportEvents=Array.from({length:12},()=>({phase:'acknowledged',at:1000}));
  const waiting=f.start(),rejected=assert.rejects(waiting,/save producer did not confirm success/);
  f.root._autoSaveCommittedRevision++;f.root._autoSaveDeferred=true;f.root._autoSaveInFlightPromise=null;
  f.root._autoSaveTransportEvents=f.root._autoSaveTransportEvents.slice(2).concat([{phase:'acknowledged',at:1000},{phase:'rejected',at:1001}]);
  old.resolve({ok:false,error:Object.assign(Error('stale'),{code:'DESKTOP_AUTOSAVE_STALE'})});await f.frame();
  f.root._autoSaveDeferred=false;f.root._autoSaveLastSavedRevision++;await f.frame();await f.frame();await rejected;
});
test('the real successful stale desktop shape still requires the newer revision to be durably saved', async () => {
  const f = backgroundFixture(), old = deferred(); f.root._autoSaveInFlightPromise = old.promise;
  const waiting = f.start(); let finished = false; waiting.then(() => { finished = true; });
  f.root._autoSaveCommittedRevision++; f.root._autoSaveInFlightPromise = null; old.resolve({ ok: true, stale: true, turn: 5 });
  await f.frame(); await f.frame(); assert.equal(finished, false);
  f.root._autoSaveLastSavedRevision++; await f.frame(); await f.frame();
  const result = await waiting; assert.equal(result.producerReceipts[0].ok, true); assert.equal(result.producerReceipts[0].stale, true);
  assert.equal(result.state.saved.revision, 10);
});
for (const key of ['_tmLoadGen', '_tmAutoSaveSessionToken', 'turn', '_campaignId', '_timelineId']) test('final background rejects cross-world change of ' + key, async () => {
  const f = backgroundFixture(), waiting = f.start(), rejected = assert.rejects(waiting, /world changed/);
  const owner = key.startsWith('_tm') ? f.root : f.root.GM; owner[key] = typeof owner[key] === 'number' ? owner[key] + 1 : owner[key] + '-new';
  await f.frame(); await rejected;
});
test('missing modules and undefined observation fields fail closed instead of looking idle', async () => {
  for (const key of ['_backgroundSavePending', '_autoSaveNativePending', '_autoSaveCommittedRevision', '_tmAutoSaveSessionToken']) {
    for (const missing of [true, false]) { const f = backgroundFixture(); if (missing) delete f.root[key]; else f.root[key] = undefined;
      await assert.rejects(f.start(), /missing observation field/); }
  }
  const f = backgroundFixture(); delete f.root.TM.RecoveryReview; await assert.rejects(f.start(), /observation modules unavailable/);
});
test('required jobs settle naturally; failed receipts and other background work remain explicit without retries', async () => {
  const f = backgroundFixture(), pending = deferred();
  const job = { id: 'sc25', status: 'running', attempts: 1, promise: pending.promise, lease: { turn: 4, loadGen: 2, gmRef: f.root.GM, pRef: f.root.P } };
  f.root.GM._postTurnDetachedJobs = [job, { id: 'other-task', status: 'running', promise: new Promise(() => {}) }];
  const waiting = f.start(); await f.frame(); assert.equal(f.root.GM._postTurnDetachedJobs[0].promise, pending.promise);
  job.status = 'failed'; pending.resolve({ ok: false }); await f.frame(); await f.frame();
  const result = await waiting; assert.equal(result.state.requiredJobs[0].status, 'failed'); assert.equal(result.state.requiredJobs[0].settled, true);
  assert.equal(result.state.otherJobs[0].settled, false); assert.equal(result.scope, 'final-review-and-save'); assert.deepEqual(f.forbidden, []);
  const json = JSON.stringify(result); assert(!json.includes('gmRef')); assert(!json.includes('pRef')); assert(!json.includes('shijiHistory'));
});
test('an unresolved existing producer remains bounded by the original deadline and cannot revive the observer later', async () => {
  const f = backgroundFixture(), pending = deferred(); f.root._backgroundSaveInFlight = pending.promise;
  const waiting = f.start(1100), rejected = assert.rejects(waiting, /suite deadline exceeded/);
  assert.equal([...f.timers.values()][0].at, 1100); f.advance(100); await rejected;
  pending.resolve({ ok: true }); await f.frame(); assert.equal(f.frames.size, 0); assert.equal(f.timers.size, 0);
  assert.equal(f.logs.filter(line => JSON.parse(line.slice('COMPOSITE_FINAL_BACKGROUND '.length)).phase === 'settled').length, 0);
});
test('old failure history and a pending persisted review are reported without claiming all reviews approved', async () => {
  const f = backgroundFixture(); f.root.GM._backgroundSaveFailures.push({ at: 100, turn: 2, attempts: 2, reasons: ['old'], message: 'historical' });
  f.root.GM.shijiHistory[0].agentReview = { status: 'pending', verified: false, calls: 2, pendingSources: [{ text: 'must not copy evidence text' }] };
  const waiting = f.start(); await f.frame(); const result = await waiting;
  assert.equal(result.state.lastReview.status, 'pending'); assert.equal(result.state.lastReview.verified, false); assert.equal(result.state.failures.length, 1);
  assert(!JSON.stringify(result).includes('must not copy evidence text'));
});
test('background evidence reconstructs exactly without exceeding the actual renderer log line cap', async () => {
  const f = backgroundFixture(); f.root.GM._postTurnDetachedJobs = Array.from({ length: 40 }, (_, index) => ({ id: 'other-' + index, status: 'done', attempts: 2 }));
  const waiting = f.start(); await f.frame(); const result = await waiting;
  assert(f.logs.every(line => line.length < 2500));
  const fragments = f.logs.map(line => JSON.parse(line.slice('COMPOSITE_FINAL_BACKGROUND '.length))).filter(row => row.phase === 'settled');
  assert(fragments.length > 1); assert.equal(fragments.length, fragments[0].parts);
  fragments.forEach((row, index) => { assert.equal(row.part, index); assert.equal(row.observation, fragments[0].observation); });
  assert.deepEqual(JSON.parse(fragments.map(row => row.payload).join('')).state, JSON.parse(JSON.stringify(result.state)));
});
test('the actual Electron suite, outer process and CI limits retain 1800 seconds, 1830 seconds and 45 minutes', () => {
  const root = path.resolve(__dirname, '../..'), bridge = fs.readFileSync(path.join(root, 'scripts/electron/bridge-main.cjs'), 'utf8');
  const expression = bridge.match(/^const bridgeTimeoutMs = (.+);$/m)[1];
  assert.equal(vm.runInNewContext(expression, { mode: 'npc-composite', multiScenarioAuthoring: false, visiblePerformance: false }), 1800000);
  assert(bridge.includes('const bridgeDeadlineAt = Date.now() + bridgeTimeoutMs;'));
  assert(bridge.includes("setTimeout(() => finish(new Error('electron-bridge-timeout')), bridgeTimeoutMs)"));
  assert(bridge.includes('deadlineAt: bridgeDeadlineAt'));
  assert.equal(Number(fs.readFileSync(path.join(root, 'scripts/verify-electron-bridge.js'), 'utf8').match(/timeout: mode === 'npc-composite' \? (\d+)/)[1]), 1830000);
  assert.match(fs.readFileSync(path.join(root, '.github/workflows/ci.yml'), 'utf8'), /timeout-minutes: \$\{\{ matrix\.group == 'npc-composite' && 45 \|\| 30 \}\}/);
});
(async () => { let pass = 0, fail = 0; for (const t of tests) { try { await t.run(); pass++; console.log('PASS ' + t.name); } catch (e) { fail++; console.error('FAIL ' + t.name + '\n' + e.stack); } } console.log(JSON.stringify({ pass, fail, total: tests.length })); if (fail) process.exitCode = 1; })();
