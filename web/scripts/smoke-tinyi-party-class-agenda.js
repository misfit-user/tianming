#!/usr/bin/env node
// smoke-tinyi-party-class-agenda.js - party/class agenda -> tinyi queue guard.

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
sandbox.addEventListener = () => {};
sandbox.removeEventListener = () => {};
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

load('tm-tinyi-v3-persona.js'); load('tm-tinyi-v3.js'); load('tm-tinyi-v3-edict-personnel.js'); load('tm-tinyi-v3-parties.js');

sandbox.GM = {
  running: true,
  turn: 32,
  vars: {},
  evtLog: [],
  qijuHistory: [],
  recentChaoyi: [],
  _chronicle: [],
  _ccHeldItems: [],
  _pendingTinyiTopics: [],
  _chronicleTracks: [],
  tinyi: { followUpQueue: [] },
  parties: [
    {
      name: 'Reformers',
      leader: 'Minister A',
      influence: 72,
      cohesion: 66,
      currentAgenda: 'salt reform',
      shortGoal: 'open canal audit',
      longGoal: 'restore fiscal order',
      socialBase: [{ class: 'Merchants', affinity: 0.8 }],
      policyStance: [],
      focal_disputes: []
    },
    {
      name: 'Old Guard',
      leader: 'Minister B',
      influence: 58,
      cohesion: 70,
      currentAgenda: '',
      shortGoal: '',
      enemies: ['Reformers']
    }
  ],
  classes: [
    {
      name: 'Merchants',
      satisfaction: 34,
      influence: 62,
      demands: 'lower salt tax',
      supportingParties: ['Reformers'],
      unrestLevels: { grievance: 25, petition: 32, strike: 70, revolt: 80 },
      representativeNpcs: ['Merchant Voice']
    }
  ],
  chars: [
    { name: 'Minister A', party: 'Reformers', officialTitle: 'Minister', prestige: 80, alive: true },
    { name: 'Minister B', party: 'Old Guard', officialTitle: 'Minister', prestige: 70, alive: true },
    { name: 'Merchant Voice', party: 'Reformers', officialTitle: 'Petitioner', prestige: 65, alive: true }
  ],
  partyState: {}
};
sandbox.P = { scenario: { dynastyType: 'ming' } };
sandbox.CY = { _ty3: null, _ty2: null };
sandbox.findCharByName = name => (sandbox.GM.chars || []).find(c => c && c.name === name) || null;

const spawned = sandbox._ty3_phase15_scanAndSpawnTopics();
assert(Array.isArray(spawned), 'phase15 should return spawned topic titles');

const partyGoal = sandbox.GM._pendingTinyiTopics.find(t => t && t.sourceType === 'party_goal' && t.party === 'Reformers');
assert(partyGoal, 'party currentAgenda/shortGoal should spawn a tinyi topic');
assert(partyGoal.goalText === 'salt reform', 'party topic should prefer currentAgenda');
assert(partyGoal.proposer === 'Minister A', 'party topic should attach party leader as proposer');
assert(Array.isArray(partyGoal.supportingClasses) && partyGoal.supportingClasses.indexOf('Merchants') >= 0, 'party topic should carry supporting classes');
assert(partyGoal.origin && partyGoal.origin.sourceType === 'party_goal' && partyGoal.origin.sourceName === 'Reformers', 'party topic should carry origin metadata');
assert(Array.isArray(partyGoal.relationEvidence) && partyGoal.relationEvidence.some(e => e && e.className === 'Merchants' && e.partyName === 'Reformers'), 'party topic should retain class-party binding evidence');
assert(sandbox._ty3_partyStanceOnTopic('Reformers', partyGoal.topic) === 'support', 'party goal should count as a supportive stance');

const classPressure = sandbox.GM._pendingTinyiTopics.find(t => t && t.sourceType === 'class_pressure' && t.className === 'Merchants');
assert(classPressure, 'low-satisfaction class demand should spawn a tinyi topic');
assert(classPressure.demandText === 'lower salt tax', 'class topic should carry demand text');
assert(Array.isArray(classPressure.supportingParties) && classPressure.supportingParties.indexOf('Reformers') >= 0, 'class topic should carry supporting parties');
assert(classPressure.sourceClass === 'Merchants', 'class pressure topic should expose sourceClass');
assert(classPressure.origin && classPressure.origin.sourceType === 'class_pressure' && classPressure.origin.sourceName === 'Merchants', 'class pressure topic should carry origin metadata');

const savedPhase2Run = sandbox._ty3_phase2_run;
sandbox._ty3_phase2_run = function(){};
sandbox.CY = {
  _ty3: {
    topic: partyGoal.topic,
    meta: partyGoal,
    proposer: 'Minister A',
    proposerParty: 'Reformers',
    attendees: ['Minister A', 'Minister B'],
    bench: { left: ['Minister A'], center: [], right: ['Minister B'] }
  },
  _ty2: null
};
sandbox._ty3_phase1_startDebate();
assert(sandbox.CY._ty2 && sandbox.CY._ty2._publicMeta && sandbox.CY._ty2._publicMeta.sourceType === 'party_goal', 'v3->v2 debate bridge should keep full topic sourceType metadata');
assert(sandbox.CY._ty2._publicMeta.goalId === partyGoal.goalId, 'v3->v2 debate bridge should keep party goal id metadata');
sandbox._ty3_phase2_run = savedPhase2Run;

const beforeSecondScan = sandbox.GM._pendingTinyiTopics.length;
sandbox._ty3_phase15_scanAndSpawnTopics();
assert(sandbox.GM._pendingTinyiTopics.length === beforeSecondScan, 'agenda scan should not duplicate existing pending topics');

sandbox.CY = {
  _ty3: { topic: classPressure.topic, meta: classPressure, proposerParty: 'Reformers' },
  _ty2: { topic: classPressure.topic, attendees: ['Merchant Voice'], stances: {} }
};
const classSeal = sandbox._ty3_phase6_recordSeal('issued', {
  grade: 'B',
  decision: { mode: 'majority' },
  opts: { topic: classPressure.topic, proposerParty: 'Reformers', opposingParties: [] }
}, {});
assert(classSeal && classSeal.sourceType === 'class_pressure', 'class pressure seal should keep sourceType metadata');
assert(classSeal.sourceClass === 'Merchants' && classSeal.demandText === 'lower salt tax', 'class pressure seal should keep class demand metadata');

sandbox.CY = {
  _ty3: { topic: partyGoal.topic, meta: partyGoal, proposerParty: 'Reformers' },
  _ty2: { topic: partyGoal.topic, attendees: ['Minister A'], stances: {} }
};
const seal = sandbox._ty3_phase6_recordSeal('issued', {
  grade: 'B',
  decision: { mode: 'majority' },
  opts: { topic: partyGoal.topic, proposerParty: 'Reformers', opposingParties: ['Old Guard'] }
}, {});
assert(seal && seal.sealStatus === 'issued', 'issued seal should complete normally');

const reformers = sandbox.GM.parties[0];
assert(Array.isArray(reformers.agenda_history), 'party goal result should write agenda_history');
assert(reformers.agenda_history.some(h => h && h.source === 'tinyi-party-goal' && h.goalText === 'salt reform' && h.sealStatus === 'issued'), 'agenda_history should record tinyi party-goal outcome');
assert(reformers.lastTinyiGoalOutcome && reformers.lastTinyiGoalOutcome.sealStatus === 'issued', 'party should keep last tinyi goal outcome snapshot');

console.log('[smoke-tinyi-party-class-agenda] PASS party/class agenda tinyi loop');
