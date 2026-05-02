#!/usr/bin/env node
// smoke-tinyi-reissued.js - e2e guard for blocked -> reissued -> seal/final flow.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function fakeEl() {
  return {
    classList: { add(){}, remove(){}, toggle(){}, contains(){ return false; } },
    style: { cssText: '' },
    appendChild(c){ return c; },
    removeChild(c){ return c; },
    insertBefore(c){ return c; },
    setAttribute(){},
    getAttribute(){ return null; },
    addEventListener(){},
    removeEventListener(){},
    querySelector(){ return fakeEl(); },
    querySelectorAll(){ return []; },
    children: [],
    childNodes: [],
    firstChild: null,
    parentNode: null,
    innerHTML: '',
    textContent: '',
    value: '',
    dataset: {},
    remove(){}
  };
}

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  document: { getElementById: () => fakeEl(), querySelector: () => fakeEl(), querySelectorAll: () => [], addEventListener(){}, createElement: () => fakeEl(), body: fakeEl(), head: fakeEl(), readyState: 'complete' },
  window: {},
  localStorage: { getItem: () => null, setItem(){}, removeItem(){} },
  navigator: { userAgent: 'node' },
  performance: { now: () => Date.now() },
  fetch: () => Promise.reject(new Error('no fetch')),
  alert(){}, confirm: () => true, prompt: () => null,
  HTMLElement: function(){}, Event: function(){}, requestAnimationFrame: cb => setTimeout(cb, 16),
  _ty2_enterDecide(){},
  escHtml: v => String(v == null ? '' : v),
  addCYBubble(){}, addEB(){}, toast(){}, closeChaoyi(){}, showLoading(){}, hideLoading(){}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function assertEq(actual, expected, msg) {
  assert(actual === expected, msg + ' expected=' + expected + ' actual=' + actual);
}

load('tm-engine-constants.js');
load('tm-ai-schema.js');
load('tm-ai-output-validator.js');
load('tm-tinyi-v3.js');

const sourceParty = 'source-party';
const blockerParty = 'blocker-party';

function reset(topic) {
  sandbox.GM = {
    running: true,
    turn: 20,
    vars: {},
    rels: {},
    evtLog: [],
    officeChanges: [],
    qijuHistory: [],
    recentChaoyi: [{}],
    _chronicle: [],
    _ccHeldItems: [],
    _ccFinalBlockedItems: [],
    _pendingTinyiTopics: [],
    _chronicleTracks: [],
    tinyi: { followUpQueue: [] },
    parties: [
      { name: sourceParty, influence: 64, cohesion: 70, enemies: [blockerParty], officePositions: [] },
      { name: blockerParty, influence: 82, cohesion: 78, enemies: [sourceParty], officePositions: ['seal-office'] }
    ],
    partyState: {
      [sourceParty]: { name: sourceParty, influence: 64, cohesion: 70 },
      [blockerParty]: { name: blockerParty, influence: 82, cohesion: 78 }
    },
    chars: [
      { name: 'drafter', party: sourceParty, prestige: 80, favor: 70, alive: true }
    ]
  };
  sandbox.CY = {
    _ty3: { topic, meta: {}, proposerParty: sourceParty },
    _ty2: { topic, decision: { mode: 'majority' }, attendees: ['drafter'], stances: {}, _publicMeta: { proposerParty: sourceParty } }
  };
  sandbox.P = { scenario: { dynastyType: 'ming', startYear: 1628 } };
  sandbox.scriptData = { engineConstants: sandbox.EngineConstants.getTemplate('generic') };
  sandbox.findCharByName = name => (sandbox.GM.chars || []).find(c => c && c.name === name) || null;
}

function blockCurrent(topic, count) {
  return sandbox._ty3_phase6_resolveSeal(false, {
    decision: { mode: 'majority' },
    grade: 'A',
    opts: { topic, proposerParty: sourceParty, opposingParties: [blockerParty], isReissue: count > 0, reissuedCount: count },
    hostile: { partyName: blockerParty, officePos: 'seal-office', holdProb: 1 },
    roll: 0,
    isReissue: count > 0,
    reissuedCount: count
  });
}

reset('policy-reissue-success');
sandbox.CY._ty3.chaoyiTrackId = 'chaoyi-lineage-policy-reissue-success';
sandbox.CY._ty2.chaoyiTrackId = 'chaoyi-lineage-policy-reissue-success';
const firstBlocked = blockCurrent('policy-reissue-success', 0);
assertEq(firstBlocked.sealStatus, 'blocked', 'initial hostile seal should block');
assertEq(sandbox.GM._ccHeldItems.length, 1, 'initial blocked topic should enter held book');
assertEq(sandbox.GM._ccHeldItems[0].reissuedCount, 0, 'initial held item should start at count 0');
assertEq(sandbox.GM._ccHeldItems[0].chaoyiTrackId, 'chaoyi-lineage-policy-reissue-success', 'held item should preserve chaoyi track id');
sandbox.GM.turn = 21;
assert(sandbox._ty3_reissueTopic('policy-reissue-success'), 'manual reissue should reopen held item');
assertEq(sandbox.CY._ty3.isReissue, true, 'reissue should mark CY._ty3.isReissue');
assertEq(sandbox.CY._ty3.reissuedCount, 1, 'first reissue should count as 1');
assertEq(sandbox.CY._ty3.chaoyiTrackId, 'chaoyi-lineage-policy-reissue-success', 'reissue should reuse original chaoyi track id across turns');
const beforeQueue = sandbox.GM.tinyi.followUpQueue.length;
const reissuedSeal = sandbox._ty3_phase6_resolveSeal(false, {
  decision: { mode: 'reissue' },
  grade: 'B',
  opts: { topic: 'policy-reissue-success', proposerParty: sourceParty, opposingParties: [blockerParty], isReissue: true, reissuedCount: 1 },
  hostile: null,
  isReissue: true,
  reissuedCount: 1
});
assertEq(reissuedSeal.sealStatus, 'reissued', 'successful reissue should seal as reissued');
assert(sandbox.GM.tinyi.followUpQueue.length === beforeQueue + 1, 'successful reissue should enqueue follow-up');
assertEq(reissuedSeal.followUp.topicId, 'chaoyi-lineage-policy-reissue-success', 'reissued follow-up should reuse original chaoyi track id');

reset('policy-reissue-loop');
blockCurrent('policy-reissue-loop', 0);
for (let count = 1; count <= 3; count += 1) {
  assert(sandbox._ty3_reissueTopic('policy-reissue-loop'), 'reissue #' + count + ' should open from held book');
  assertEq(sandbox.CY._ty3.reissuedCount, count, 'reissue count should match #' + count);
  const seal = blockCurrent('policy-reissue-loop', count);
  assertEq(seal.sealStatus, 'blocked', 'reissue #' + count + ' should be blockable');
  if (count < 3) {
    assertEq(sandbox.GM._ccHeldItems.length, 1, 'blocked reissue #' + count + ' should return to held book');
    assertEq(sandbox.GM._ccHeldItems[0].reissuedCount, count, 'held item should preserve count #' + count);
  } else {
    assertEq(seal.finalBlocked, true, 'third blocked reissue should become final blocked');
    assertEq(sandbox.GM._ccHeldItems.length, 0, 'final blocked item should not return to held book');
    assert(sandbox.GM._ccFinalBlockedItems.length >= 1, 'final blocked archive should receive item');
  }
}

assert(sandbox.TM_AI_SCHEMA.toKnownFields('turn-full').reissue_topics === 'array', 'schema should know reissue_topics');
const validation = sandbox.TM.validateAIOutput({ reissue_topics: [{ topic: 'policy-reissue-loop', reason: 'situation changed' }] }, 'smoke-reissue');
assert(validation && validation.ok === true, 'validator should accept reissue_topics');

console.log('[smoke-tinyi-reissued] PASS blocked/reissued/final flow');
