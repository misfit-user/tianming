#!/usr/bin/env node
// smoke-party-class-decay-escalation.js - signal/memory decay, resolved issue cooling, unresolved pressure escalation.

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

const SPS = sandbox.TM && sandbox.TM.SocialPoliticalSignals;
const Actors = sandbox.TM && sandbox.TM.PartyClassActors;

assert(SPS && typeof SPS.decayAndResolve === 'function', 'SocialPoliticalSignals.decayAndResolve should exist');
assert(Actors && typeof Actors.tick === 'function', 'PartyClassActors.tick should exist');

const root = {
  turn: 20,
  partyState: {},
  classes: [
    {
      name: 'Farmers',
      tags: ['peasant', 'tax'],
      satisfaction: 31,
      influence: 68,
      demands: 'reduce emergency grain levy',
      unrestLevels: { grievance: 38, petition: 44, strike: 62, revolt: 70 }
    }
  ],
  parties: [
    {
      name: 'Relief Party',
      influence: 55,
      cohesion: 50,
      currentAgenda: 'reduce emergency grain levy'
    }
  ],
  _courtRecords: [
    {
      turn: 19,
      issueId: 'issue-grain',
      chaoyiTrackId: 'issue-grain',
      topic: 'Old grain levy',
      status: 'issued',
      sealStatus: 'issued',
      sourceParty: 'Relief Party',
      sourceClass: 'Farmers',
      grade: 'B'
    }
  ],
  _partyClassActorMemory: {
    turn: 20,
    seq: 2,
    items: [
      {
        id: 'old-memory',
        turn: 11,
        actorType: 'class',
        actorId: 'Farmers',
        agenda: 'complain about old levy',
        grievance: 'old unresolved levy',
        belief: 'petition may work',
        source: 'manual-old',
        confidence: 0.82,
        expiry: 15,
        linkedIssue: 'issue-old'
      },
      {
        id: 'resolved-memory',
        turn: 16,
        actorType: 'class',
        actorId: 'Farmers',
        agenda: 'old grain levy',
        grievance: 'grain levy was too high',
        belief: 'court can cool this',
        source: 'manual-resolved',
        confidence: 0.76,
        expiry: 24,
        linkedIssue: 'issue-grain'
      }
    ]
  },
  class_actions: [
    {
      id: 'old-action',
      turn: 12,
      actorType: 'class',
      actorId: 'Farmers',
      actionType: 'petition',
      agenda: 'old levy petition',
      grievance: 'stale',
      belief: 'stale action',
      source: 'manual-old',
      confidence: 0.7,
      expiry: 14,
      linkedIssue: 'issue-old',
      status: 'planned'
    }
  ],
  party_actions: []
};

SPS.record(root, {
  turn: 14,
  sourceSystem: 'fiscal',
  kind: 'old-grain-levy-pressure',
  tags: ['tax', 'grain'],
  intensity: 0.82,
  confidence: 0.9,
  linkedIssue: 'issue-grain',
  reason: 'Old grain levy already received a court ruling.',
  affectedClasses: [{ name: 'Farmers', satisfactionDelta: -3, demand: 'old grain levy relief' }]
});
SPS.record(root, {
  turn: 14,
  sourceSystem: 'fiscal',
  kind: 'unresolved-emergency-levy-pressure',
  tags: ['tax', 'levy'],
  intensity: 0.88,
  confidence: 0.86,
  linkedIssue: 'issue-levy',
  reason: 'Emergency grain levy remains unresolved for farmers.',
  affectedClasses: [{ name: 'Farmers', satisfactionDelta: -5, demand: 'reduce emergency grain levy' }],
  affectedParties: [{ name: 'Relief Party', shortGoal: 'carry farmer relief' }]
});
SPS.applyPending(root, { turn: 14, source: 'smoke-decay-setup' });

const spsResult = SPS.decayAndResolve(root, { turn: 20, source: 'smoke-decay' });
assert(spsResult.resolved >= 1, 'resolved court record should cool at least one linked signal');
assert(spsResult.escalated >= 1, 'unresolved high-pressure signal should escalate after several turns');

const signals = root._socialPoliticalSignals.items;
const resolvedSignal = signals.find(s => s && s.linkedIssue === 'issue-grain');
const unresolvedSignal = signals.find(s => s && s.linkedIssue === 'issue-levy');
assert(resolvedSignal && resolvedSignal.resolved === true && resolvedSignal.resolvedTurn === 20, 'resolved signal should be marked resolved with turn');
assert(resolvedSignal.intensity < 0.5 && resolvedSignal.confidence < 0.9, 'resolved signal should reduce pressure intensity and confidence');
assert(unresolvedSignal && unresolvedSignal.escalated === true && unresolvedSignal.escalatedTurn === 20, 'unresolved pressure should be marked escalated');
assert(Array.isArray(root._socialPoliticalSignalEscalations) && root._socialPoliticalSignalEscalations.some(e => e && e.linkedIssue === 'issue-levy'), 'unresolved escalation ledger should record linked issue');
assert(root._partyClassActorMemory.items.some(m => m && m.source === 'social-political-signal-escalation' && m.actorId === 'Farmers' && m.linkedIssue === 'issue-levy'), 'signal escalation should become actor memory');

const tick = Actors.tick(root, { turn: 20, source: 'smoke-actor-memory-tick' });
assert(tick.expiredMemories >= 1, 'actor tick should expire old memories');
assert(tick.resolvedMemories >= 1, 'actor tick should resolve memories attached to court records');
assert(tick.expiredActions >= 1, 'actor tick should mark expired actions');
assert(tick.escalatedActions >= 1, 'actor tick should turn unresolved memory into fresh class action');

const oldMemory = root._partyClassActorMemory.items.find(m => m && m.id === 'old-memory');
const resolvedMemory = root._partyClassActorMemory.items.find(m => m && m.id === 'resolved-memory');
assert(oldMemory && oldMemory.status === 'expired' && oldMemory.active === false && oldMemory.confidence < 0.82, 'expired memory should be inactive and faded');
assert(resolvedMemory && resolvedMemory.resolved === true && resolvedMemory.status === 'resolved' && resolvedMemory.confidence < 0.76, 'resolved memory should be cooled by court result');
assert(root.class_actions.find(a => a && a.id === 'old-action').status === 'expired', 'expired action should be marked expired');
assert(root.class_actions.some(a => a && a.turn === 20 && a.actorType === 'class' && a.actorId === 'Farmers' && a.linkedIssue === 'issue-levy' && (a.actionType === 'strike' || a.actionType === 'revolt_seed' || a.actionType === 'petition')), 'unresolved pressure should create a fresh intervention-relevant class action');

const snap = Actors.snapshot(root, { turn: 20, limit: 20 });
assert(!snap.memories.some(m => m && m.id === 'old-memory'), 'snapshot should hide expired inactive memories');
assert(snap.memories.some(m => m && m.linkedIssue === 'issue-levy'), 'snapshot should keep unresolved escalated memory visible');

console.log('[smoke-party-class-decay-escalation] PASS party/class decay and escalation');
