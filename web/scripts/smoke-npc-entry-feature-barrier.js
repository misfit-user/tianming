'use strict';
const assert = require('assert/strict');
const { dailyFixture } = require('./lib-npc-daily-fixture');

const FIXED_NOW = 1800000000000;
class FixedDate extends Date {
  constructor(...args) { super(...(args.length ? args : [FIXED_NOW])); }
  static now() { return FIXED_NOW; }
}
function setup() {
  const c = dailyFixture(), queue = [], hooks = {};
  c.Date = FixedDate;
  c.Math = Object.create(Math); c.Math.random = () => 0.5;
  c.setTimeout = (fn, delay) => { queue.push({ fn, delay }); return queue.length; };
  c.GameHooks = {
    on(name, fn) { (hooks[name] || (hooks[name] = [])).push(fn); },
    run(name) { (hooks[name] || []).forEach(fn => fn()); }
  };
  c.load('tm-npc-local-ai.js');
  c.add('a', '甲', { localGoals: [{ id: 'help-goal', kind: 'assistance', targetId: 'b',
    task: { kind: 'material_summary', materialRefs: [{ kind: 'character_public', characterId: 'a' }] } }] });
  c.add('b', '乙'); c.GM.affinityMap = { '乙|甲': 45 };
  c.renders = 0; c.TM.NPC.DailyUI = { render() { c.renders++; } };
  c.entry = () => c.GameHooks.run('enterGame:after');
  c.pendingTimers = () => queue.length;
  c.nextTimer = () => { assert(queue.length, 'expected a queued callback'); const task = queue.shift(); assert.equal(task.delay, 0); task.fn(); };
  c.drain = () => { let turns = 0; while (queue.length) { assert(++turns <= 30, 'bounded local continuation'); c.nextTimer(); } };
  return c;
}
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function loader(c, statuses, requests) {
  const calls = [];
  c.TM.Features = {
    status() { return statuses.slice(); },
    ensure(name) { calls.push(name); assert(requests[name], 'must not request an unrelated feature: ' + name); return requests[name].promise; }
  };
  return calls;
}
async function settle() { for (let i = 0; i < 8; i++) await Promise.resolve(); }
function snapshot(c) { return JSON.stringify({ world: c.GM, apiAttempts: c.apiAttempts, renders: c.renders }); }
function complete(c) {
  const plan = c.TM.NPC.DailyActivities.plans().find(p => p.actorId === 'a' && p.localActivity.kind === 'assistance');
  assert(plan, 'the original assistance work must still run');
  assert.equal(plan.status, 'done');
  assert.equal(plan.localActivity.documents.length, 1);
  assert.equal(plan.localActivity.documents[0].receivedBy, 'a');
  assert.equal(c.apiAttempts.length, 0);
}
const tests = [];
function test(name, run) { tests.push({ name, run }); }
let expected;

test('absent loader preserves queued entry and all ordinary NPC results', () => {
  const c = setup(); c.entry();
  assert.equal(c.GM._npcPlans.length, 0);
  assert.equal(c.pendingTimers(), 1);
  c.drain(); complete(c); expected = snapshot(c);
});

test('only callback-time loading features are awaited, then entry resumes in a new task', async () => {
  const c = setup(), labels = deferred(), desktop = deferred();
  const statuses = [{ feature: 'formalMapLabels', state: 'defined' }, { feature: 'desktopUpdate', state: 'defined' }];
  ['ready', 'failed', 'disposed', 'not-applicable', 'unknown'].forEach(state => statuses.push({ feature: 'unrequested-' + state, state }));
  const calls = loader(c, statuses, { formalMapLabels: labels, desktopUpdate: desktop });
  c.entry(); assert.deepEqual(calls, []);
  statuses[0].state = 'loading'; statuses[1].state = 'loading';
  c.nextTimer(); assert.deepEqual(calls, ['formalMapLabels', 'desktopUpdate']);
  const before = snapshot(c);
  assert.equal(c.pendingTimers(), 0);
  labels.resolve({ ok: true }); await settle();
  assert.equal(snapshot(c), before); assert.equal(c.pendingTimers(), 0, 'all existing requests must settle');
  statuses.push({ feature: 'requested-later', state: 'loading' });
  desktop.resolve({ ok: true }); await settle();
  assert.equal(snapshot(c), before, 'completion microtasks must not run synchronous NPC work');
  assert.equal(c.pendingTimers(), 1, 'entry resumes through a fresh macrotask');
  c.drain(); complete(c); assert.equal(snapshot(c), expected, 'all NPC state, receipts and work match the original path');
  assert.deepEqual(calls, ['formalMapLabels', 'desktopUpdate'], 'the callback snapshot must not poll or start later features');
});

test('feature rejection releases the same NPC work without retrying the feature', async () => {
  const c = setup(), labels = deferred();
  const calls = loader(c, [{ feature: 'formalMapLabels', state: 'loading' }], { formalMapLabels: labels });
  c.entry(); c.nextTimer(); const before = snapshot(c);
  labels.reject(new Error('feature-script-timeout')); await settle();
  assert.equal(snapshot(c), before); assert.equal(c.pendingTimers(), 1);
  c.drain(); complete(c); assert.equal(snapshot(c), expected);
  assert.deepEqual(calls, ['formalMapLabels']);
});

for (const when of ['while-loading', 'after-settlement']) test('world switch ' + when + ' prevents stale entry work', async () => {
  const c = setup(), labels = deferred();
  loader(c, [{ feature: 'formalMapLabels', state: 'loading' }], { formalMapLabels: labels });
  c.entry(); c.nextTimer();
  const oldWorld = c.GM, oldSnapshot = JSON.stringify(oldWorld);
  if (when === 'after-settlement') { labels.resolve({ ok: true }); await settle(); }
  c.GM = JSON.parse(oldSnapshot); c.GM.sid = 'replacement-world';
  const replacement = snapshot(c);
  if (when === 'while-loading') { labels.resolve({ ok: true }); await settle(); }
  c.drain();
  assert.equal(JSON.stringify(oldWorld), oldSnapshot, 'the abandoned world must remain untouched');
  assert.equal(snapshot(c), replacement, 'the replacement world must not inherit old entry work');
});

test('a loader with no active requests keeps the original callback path', () => {
  const c = setup();
  const calls = loader(c, [{ feature: 'formalMapLabels', state: 'defined' }, { feature: 'desktopUpdate', state: 'failed' }], {});
  c.entry(); c.nextTimer();
  assert(c.GM._npcPlans.length > 0, 'entry executes in the original callback without another scheduling turn');
  c.drain(); complete(c); assert.equal(snapshot(c), expected); assert.deepEqual(calls, []);
});

(async () => {
  for (const { name, run } of tests) { await run(); console.log('PASS ' + name); }
  console.log('PASS ' + tests.length + ' NPC entry feature barrier groups');
})().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
