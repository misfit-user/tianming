#!/usr/bin/env node
// smoke-party-class-actors.js - parties/classes act as memory-bearing political actors.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  window: {},
  scriptData: {},
  P: {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

load('tm-engine-constants.js');
load('tm-class-engine.js');
load('tm-party-goals.js');
load('tm-social-political-signals.js');
load('tm-party-class-actors.js');
load('tm-party-class-llm-calibrator.js');

const Actors = sandbox.TM && sandbox.TM.PartyClassActors;
const PG = sandbox.TM && sandbox.TM.PartyGoals;
const Cal = sandbox.TM && sandbox.TM.PartyClassLlmCalibrator;

assert(Actors && typeof Actors.run === 'function', 'PartyClassActors.run should exist');
assert(typeof Actors.remember === 'function', 'PartyClassActors.remember should exist');
assert(typeof Actors.snapshot === 'function', 'PartyClassActors.snapshot should exist');
assert(typeof Actors.getActionTypes === 'function', 'PartyClassActors.getActionTypes should exist');

const actionTypes = Actors.getActionTypes();
['memorial', 'association', 'petition', 'obstruction', 'propaganda', 'funding', 'alliance', 'split', 'strike', 'revolt_seed']
  .forEach(type => assert(actionTypes.includes(type), 'actor action type should include ' + type));

const root = {
  turn: 11,
  partyState: {},
  currentIssues: [{ id: 'issue-levy', title: 'Emergency levy', category: 'finance', status: 'pending' }],
  classes: [
    {
      name: 'Farmers',
      tags: ['peasant', 'tax'],
      satisfaction: 23,
      influence: 76,
      demands: 'cancel emergency levy',
      unrestLevels: { grievance: 22, petition: 35, strike: 68, revolt: 82 },
      supportingParties: [{ class: 'Relief Party', affinity: 0.8 }]
    },
    {
      name: 'Artisans',
      tags: ['guild', 'craft'],
      satisfaction: 48,
      influence: 54,
      demands: 'repair workshops'
    }
  ],
  parties: [
    {
      name: 'Relief Party',
      influence: 68,
      cohesion: 61,
      currentAgenda: 'cancel emergency levy',
      shortGoal: 'carry levy relief through court',
      socialBase: [{ class: 'Farmers', affinity: 0.8 }],
      rivalParty: 'Tax Clique'
    },
    {
      name: 'Tax Clique',
      influence: 64,
      cohesion: 42,
      currentAgenda: 'defend emergency levy',
      shortGoal: 'block relief memorials',
      rivalParty: 'Relief Party'
    }
  ]
};

PG.setGoal(root, root.parties[0], {
  kind: 'courtIssue',
  text: 'carry levy relief through court',
  sourceClass: 'Farmers',
  demandText: 'cancel emergency levy',
  linkedIssue: 'issue-levy',
  priority: 88
}, { turn: 11, source: 'smoke-actor-goal', expiresTurn: 15 });

const result = Actors.run(root, { turn: 11, source: 'smoke-party-class-actors' });
assert(result && result.actions >= 4, 'actor run should produce several party/class actions');
assert(Array.isArray(root.party_actions) && root.party_actions.length >= 2, 'party actions ledger should be written');
assert(Array.isArray(root.class_actions) && root.class_actions.length >= 2, 'class actions ledger should be written');
assert(root.party_actions.some(a => a.actorId === 'Relief Party' && a.actionType === 'memorial'), 'party goal should produce memorial action');
assert(root.party_actions.some(a => a.actorId === 'Tax Clique' && (a.actionType === 'obstruction' || a.actionType === 'propaganda')), 'rival party should produce obstruction/propaganda action');
assert(root.class_actions.some(a => a.actorId === 'Farmers' && a.actionType === 'petition'), 'unhappy class should petition');
assert(root.class_actions.some(a => a.actorId === 'Farmers' && (a.actionType === 'strike' || a.actionType === 'revolt_seed')), 'high unrest class should escalate toward strike/revolt seed');

assert(Array.isArray(root.parties[0].party_actions) && root.parties[0].party_actions.length >= 1, 'party row should keep its own action history');
assert(Array.isArray(root.classes[0].class_actions) && root.classes[0].class_actions.length >= 1, 'class row should keep its own action history');

const memory = root._partyClassActorMemory;
assert(memory && Array.isArray(memory.items) && memory.items.length >= result.actions, 'actor memory ledger should be written');
const sample = memory.items.find(m => m.actorType === 'class' && m.actorId === 'Farmers');
assert(sample, 'memory ledger should include class memory');
['actorType', 'actorId', 'agenda', 'grievance', 'belief', 'source', 'confidence', 'expiry', 'linkedIssue']
  .forEach(field => assert(Object.prototype.hasOwnProperty.call(sample, field), 'memory entry should include ' + field));
assert(sample.linkedIssue === 'issue-levy', 'memory should preserve linked court issue');

Actors.remember(root, {
  actorType: 'party',
  actorId: 'Relief Party',
  agenda: 'protect rural support',
  grievance: 'tax clique blocks relief',
  belief: 'court can be moved through petitions',
  source: 'manual-smoke',
  confidence: 0.7,
  expiry: 18,
  linkedIssue: 'issue-levy'
});
const snap = Actors.snapshot(root, { limit: 20 });
assert(snap.memories.some(m => m.source === 'manual-smoke'), 'snapshot should include explicit actor memory');
assert(snap.partyActions.length === root.party_actions.length, 'snapshot should expose party actions');
assert(snap.classActions.length === root.class_actions.length, 'snapshot should expose class actions');

const calSnap = Cal.buildSnapshot(root, { source: 'smoke-actor-snapshot', phase: 'player-action' });
assert(calSnap.partyClassActorMemory && calSnap.partyClassActorMemory.memories.length >= snap.memories.length, 'LLM calibration snapshot should include actor memory ledger');
assert(calSnap.partyActions && calSnap.partyActions.length === root.party_actions.length, 'LLM calibration snapshot should include party actions');
assert(calSnap.classActions && calSnap.classActions.length === root.class_actions.length, 'LLM calibration snapshot should include class actions');

console.log('[smoke-party-class-actors] PASS party/class actors and memory ledger');
