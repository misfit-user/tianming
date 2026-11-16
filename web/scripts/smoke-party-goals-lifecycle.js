#!/usr/bin/env node
// smoke-party-goals-lifecycle.js - normalized party goal lifecycle guard.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const PARTY_GOALS = path.join(ROOT, 'tm-party-goals.js');

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

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

assert(fs.existsSync(PARTY_GOALS), 'tm-party-goals.js should exist');

const sandbox = {
  console, setTimeout, clearTimeout, setInterval, clearInterval,
  Math, Date, JSON, RegExp, Error, Promise,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  document: {
    getElementById: () => fakeEl(),
    querySelector: () => fakeEl(),
    querySelectorAll: () => [],
    addEventListener(){},
    createElement: () => fakeEl(),
    body: fakeEl(),
    head: fakeEl(),
    readyState: 'complete'
  },
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
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

load('tm-party-goals.js');
load('tm-tinyi-v3-persona.js'); load('tm-tinyi-v3.js'); load('tm-tinyi-v3-edict-personnel.js'); load('tm-tinyi-v3-parties.js');

sandbox.GM = {
  running: true,
  turn: 40,
  vars: {},
  evtLog: [],
  qijuHistory: [],
  recentChaoyi: [],
  _chronicle: [],
  _ccHeldItems: [],
  _pendingTinyiTopics: [],
  _chronicleTracks: [],
  tinyi: { followUpQueue: [] },
  partyState: {},
  parties: [
    {
      name: 'Reformers',
      leader: 'Minister A',
      influence: 72,
      cohesion: 66,
      currentAgenda: 'salt reform',
      shortGoal: 'canal audit',
      socialBase: [{ class: 'Merchants', affinity: 0.8 }],
      policyStance: [],
      focal_disputes: [],
      agenda_history: []
    }
  ],
  classes: [
    { name: 'Merchants', satisfaction: 58, influence: 62, supportingParties: ['Reformers'] }
  ],
  chars: [
    { name: 'Minister A', party: 'Reformers', officialTitle: 'Minister', prestige: 80, alive: true }
  ]
};
sandbox.P = { scenario: { dynastyType: 'ming' } };
sandbox.CY = { _ty3: null, _ty2: null };
sandbox.findCharByName = name => (sandbox.GM.chars || []).find(c => c && c.name === name) || null;

const PG = sandbox.TM && sandbox.TM.PartyGoals;
assert(PG, 'TM.PartyGoals should be exposed');
['normalizeParty', 'getActiveGoals', 'setGoal', 'resolveGoal', 'expireGoals'].forEach(name => {
  assert(typeof PG[name] === 'function', 'TM.PartyGoals.' + name + ' should exist');
});

const party = sandbox.GM.parties[0];
const normalized = PG.normalizeParty(sandbox.GM, party, { turn: 40 });
assert(Array.isArray(normalized) && normalized.length >= 2, 'legacy agenda fields should normalize into party.goals');
assert(Array.isArray(party.goals), 'party.goals should be the normalized goal store');

const current = party.goals.find(g => g && g.kind === 'currentAgenda' && g.text === 'salt reform');
assert(current, 'currentAgenda should become a goal object');
assert(current.id && current.status === 'active', 'normalized currentAgenda should have id and active status');
assert(current.priority >= 70, 'currentAgenda should receive high default priority');
assert(Array.isArray(current.linkedClasses) && current.linkedClasses.indexOf('Merchants') >= 0, 'goal should inherit linked supporting classes');
assert(Array.isArray(current.outcomeHistory), 'goal should own outcomeHistory');

const setGoal = PG.setGoal(sandbox.GM, 'Reformers', {
  kind: 'currentAgenda',
  text: 'salt reform',
  priority: 93,
  linkedClasses: ['Merchants']
}, { turn: 40, source: 'smoke-set' });
assert(setGoal.id === current.id, 'setGoal should update matching kind/text instead of duplicating');
assert(setGoal.priority === 93, 'setGoal should update priority');
assert(party.goals.filter(g => g && g.kind === 'currentAgenda' && g.text === 'salt reform').length === 1, 'setGoal should keep goals deduped');

const activeBefore = PG.getActiveGoals(sandbox.GM, 'Reformers', { turn: 40 });
assert(activeBefore.some(g => g && g.id === current.id), 'active goal lookup should include the current agenda before resolution');

const resolved = PG.resolveGoal(sandbox.GM, 'Reformers', current.id, {
  source: 'tinyi-party-goal',
  sealStatus: 'issued',
  grade: 'B',
  topic: '党议·Reformers·salt reform·请付廷议',
  chaoyiTrackId: 'ct-party-goal-1'
}, { turn: 40 });
assert(resolved && resolved.goal && resolved.goal.status === 'advanced', 'issued tinyi result should advance the goal');
assert(resolved.goal.outcomeHistory.some(h => h && h.sealStatus === 'issued' && h.source === 'tinyi-party-goal'), 'goal should record tinyi outcome history');
assert(Array.isArray(party.agenda_history) && party.agenda_history.some(h => h && h.goalId === current.id && h.sealStatus === 'issued'), 'party agenda_history should reference the goal id');
assert(party.lastTinyiGoalOutcome && party.lastTinyiGoalOutcome.goalId === current.id, 'party should retain last goal outcome snapshot');

const activeAfter = PG.getActiveGoals(sandbox.GM, 'Reformers', { turn: 41 });
assert(!activeAfter.some(g => g && g.id === current.id), 'advanced goals should not remain active');

party.shortGoal = '';
sandbox.GM._pendingTinyiTopics = [];
sandbox._ty3_phase15_scanAndSpawnTopics();
assert(!sandbox.GM._pendingTinyiTopics.some(t => t && t.sourceType === 'party_goal' && t.goalText === 'salt reform'), 'advanced legacy agenda should not respawn as pending tinyi topic');

const expiring = PG.setGoal(sandbox.GM, 'Reformers', {
  kind: 'shortGoal',
  text: 'temporary caucus',
  expiresTurn: 42
}, { turn: 41, source: 'smoke-expire' });
sandbox.GM.turn = 43;
const expired = PG.expireGoals(sandbox.GM, 'Reformers', { turn: 43, source: 'smoke-expire' });
assert(expired.some(g => g && g.id === expiring.id), 'expireGoals should expire overdue active goals');
assert(expiring.status === 'expired', 'expired goal should update status');

console.log('[smoke-party-goals-lifecycle] PASS normalized party goal lifecycle');
