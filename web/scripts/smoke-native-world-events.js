'use strict';
const assert = require('assert/strict'),
  fs = require('fs'),
  path = require('path'),
  vm = require('vm'),
  acorn = require('acorn');
const root = path.resolve(__dirname, '..'),
  read = (f) => fs.readFileSync(path.join(root, f), 'utf8');
const helpers = read('tm-endturn-helpers.js'),
  ast = acorn.parse(helpers, { ecmaVersion: 'latest' });
function world() {
  return {
    turn: 2,
    vars: { score: { value: 0, min: 0, max: 100 }, second: { value: 0 } },
    chars: [{ id: 'cb', name: '君主', alive: true }],
    facs: [{ id: 'fb', name: '乙国' }],
    startContext: {
      schemaVersion: 'tm-start-context/1',
      currentPlayerCharacterId: 'cb',
      playerCharacterId: 'cb',
      playerFactionId: 'fb',
    },
    nativeWorld: {
      scope: { openingEventIds: [] },
      events: [],
      authority: {
        characterId: 'cb',
        status: 'active',
        grants: ['govern'],
        jurisdiction: { factionIds: ['fb'], regionIds: ['rb'] },
      },
    },
  };
}
function harness() {
  const timers = [],
    notices = [],
    modals = [],
    applied = [];
  const c = {
    console: { log() {}, warn() {}, error: console.error },
    GM: world(),
    P: { conf: { gameMode: 'strict_hist' }, time: { year: 1000 } },
    _tmLoadGen: 1,
    document: {
      querySelector() {
        return null;
      },
    },
    setTimeout(fn) {
      timers.push(fn);
    },
    clearTimeout() {},
    _dbg() {},
    addEB(...x) {
      notices.push(x);
    },
    toast() {},
    closeModal() {},
    createMemoryAnchor() {},
    recordPlayerDecision() {},
    recordCharacterArc() {},
    openQuarterlyAgenda() {
      c.opened++;
    },
    opened: 0,
  };
  c.window = c;
  c.globalThis = c;
  vm.createContext(c);
  vm.runInContext(read('tm-start-contracts.js'), c, { filename: 'tm-start-contracts.js' });
  vm.runInContext(read('tm-start-world.js'), c, { filename: 'tm-start-world.js' });
  vm.runInContext(read('tm-history-events.js'), c, { filename: 'tm-history-events.js' });
  for (const name of [
    '_tmNormIssueChoices',
    '_eventAdjudicationOn',
    '_issueCoreStateSnapshot',
    '_chooseIssueOption',
    '_adjudicateIssueOutcomeViaAI',
  ]) {
    const n = ast.body.find((n) => n.type === 'FunctionDeclaration' && n.id.name === name);
    assert(n, name);
    vm.runInContext(helpers.slice(n.start, n.end), c, { filename: 'tm-endturn-helpers.js:' + name });
  }
  c.getCurrentYear = () => 1000;
  c.getCurrentMonth = () => 1;
  c.showHistoryEventModal = (e) => modals.push(e.id);
  c.applyAITurnChanges = (out) => {
    applied.push(out);
    c.GM.vars.score.value += out.changes.reduce((n, x) => n + x.delta, 0);
  };
  return { c, timers, notices, modals, applied };
}
function event(id = 'evt-world', more = {}) {
  return {
    id,
    name: '世界事件',
    scope: 'world',
    triggerTurn: 2,
    branches: [
      { name: '第一策', impact: { score: 5 } },
      { name: '第二策', impact: { score: 20 } },
    ],
    ...more,
  };
}
let passed = 0;
async function test(name, fn) {
  await fn();
  passed++;
  console.log('PASS ' + name);
}
(async () => {
  await test('one real history dispatch executes once while foreign notifications remain outside player view', () => {
    const h = harness(),
      { c } = h;
    c.GM.rigidHistoryEvents = [event(), event('evt-foreign', { scope: 'faction', factionId: 'fa' })];
    c.checkHistoryEvents();
    c.checkHistoryEvents();
    assert.deepEqual(h.modals, ['evt-world']);
    assert.equal(Object.keys(c.GM.triggeredHistoryEvents).length, 2);
    assert.equal(c.GM.rigidHistoryEvents.length, 2);
  });
  await test('native history choice cannot be executed twice, even through another option', () => {
    const { c } = harness();
    c.GM.rigidHistoryEvents = [event()];
    c.checkHistoryEvents();
    c.applyEventBranch('evt-world', 0);
    assert.equal(c.GM.vars.score.value, 5);
    assert.equal(c.applyEventBranch('evt-world', 1).noChange, true);
    assert.equal(c.GM.vars.score.value, 5);
    assert.equal(c.GM.triggeredHistoryEvents['evt-world'].branchApplied.index, 0);
  });
  await test('foreign observers may read an event but cannot exercise its decision authority', () => {
    const h = harness(),
      { c } = h,
      foreign = event('foreign', { scope: 'faction', factionId: 'fa', observerFactionIds: ['fb'] });
    c.GM.rigidHistoryEvents = [foreign];
    c.checkHistoryEvents();
    assert.equal(h.modals.length, 0);
    assert.equal(h.notices.length, 1);
    assert.equal(c.applyEventBranch('foreign', 0).code, 'native-event-choice-denied');
    assert.equal(c.GM.vars.score.value, 0);
  });
  await test('same-name event lookup is scoped and explicit IDs keep foreign world events reachable', () => {
    const { c } = harness();
    const a = { id: 'ea', name: '同名事件', factionId: 'fa' },
      b = { id: 'eb', name: '同名事件', factionId: 'fb' };
    c.GM.nativeWorld.events = [a, b];
    assert.equal(c.TM.NativeWorld.resolveEvent(c.GM, { name: '同名事件' }).id, 'eb');
    assert.strictEqual(c.TM.NativeWorld.resolveEvent(c.GM, { eventId: 'ea' }), a);
    c.GM.nativeWorld.events.push({ ...b, id: 'ec' });
    assert.equal(c.TM.NativeWorld.resolveEvent(c.GM, { name: '同名事件' }), null);
  });
  await test('invalid native impact or embedded code is rejected before effects and releases the claim', () => {
    const { c } = harness(),
      e = event();
    c.GM.rigidHistoryEvents = [e];
    c.checkHistoryEvents();
    e.branches[0].impact = { score: 5, second: NaN };
    assert.throws(() => c.applyEventBranch(e.id, 0), /无效/);
    assert.equal(c.GM.vars.score.value, 0);
    e.branches[0].impact = { score: 5 };
    e.branches[0].effect = () => {};
    assert.throws(() => c.applyEventBranch(e.id, 0), /不执行嵌入脚本/);
    delete e.branches[0].effect;
    c.applyEventBranch(e.id, 0);
    assert.equal(c.GM.vars.score.value, 5);
  });
  await test('agenda AI and direct history UI share one decision claim and one durable result', async () => {
    const h = harness(),
      { c } = h,
      e = event();
    c.GM.rigidHistoryEvents = [e];
    c.checkHistoryEvents();
    c.GM.currentIssues = [c._historyEventToIssue(e)];
    c.P.conf.eventUnificationEnabled = true;
    let reply;
    c.callAIWithTools = () => new Promise((r) => (reply = r));
    const pending = c._chooseIssueOption('hist_' + e.id, 0);
    assert(reply);
    assert.equal(c.applyEventBranch(e.id, 1).code, 'native-event-choice-busy');
    reply({ toolCalls: [{ input: { narrative: '受控裁定', changes: [{ delta: 7 }] } }] });
    await pending;
    assert.equal(h.applied.length, 1);
    assert.equal(c.GM.vars.score.value, 7);
    assert.equal(c.GM.currentIssues[0].status, 'resolved');
    assert.equal(c.applyEventBranch(e.id, 1).noChange, true);
    assert.equal(c.GM.vars.score.value, 7);
    c.GM = world();
    h.timers.forEach((f) => f());
    assert.equal(c.opened, 0);
  });
  await test('an old AI result and its fixed fallback cannot write into a newly loaded world', async () => {
    const h = harness(),
      { c } = h,
      old = c.GM;
    c.P.conf.eventUnificationEnabled = true;
    old.currentIssues = [
      { id: 'issue', title: '旧局要务', status: 'pending', choices: [{ text: '同意', effect: { score: 9 } }] },
    ];
    let reply;
    c.callAIWithTools = () => new Promise((r) => (reply = r));
    const pending = c._chooseIssueOption('issue', 0);
    c.GM = world();
    c.GM.vars.score.value = 11;
    c._tmLoadGen++;
    reply({ toolCalls: [{ input: { narrative: '旧局返回', changes: [{ delta: 99 }] } }] });
    const result = await pending;
    assert.equal(result.code, 'issue-world-changed');
    assert.equal(c.GM.vars.score.value, 11);
    assert.equal(h.applied.length, 0);
    assert.equal(old.currentIssues[0].status, 'pending');
    assert(!old.currentIssues[0]._resolving);
  });
  console.log(passed + ' PASS / 0 FAIL (controlled transport, no real API requests)');
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
