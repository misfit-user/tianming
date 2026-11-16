#!/usr/bin/env node
// smoke-party-class-tuning.js - party/class tuning table drives signals, decay, and actor thresholds.

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
load('tm-party-class-tuning.js');
load('tm-class-engine.js');
load('tm-party-goals.js');
load('tm-social-political-signals.js');
load('tm-party-class-actors.js');

const Tuning = sandbox.TM && sandbox.TM.PartyClassTuning;
const SPS = sandbox.TM && sandbox.TM.SocialPoliticalSignals;
const Actors = sandbox.TM && sandbox.TM.PartyClassActors;

assert(Tuning && typeof Tuning.get === 'function', 'PartyClassTuning.get should exist');
assert(typeof Tuning.read === 'function', 'PartyClassTuning.read should exist');
assert(typeof Tuning.defaults === 'function', 'PartyClassTuning.defaults should exist');
assert(Tuning.read(null, 'socialSignals.thresholds.taxPressure') === 0.7, 'default tax pressure threshold should be exposed');
assert(Tuning.read(null, 'actors.petitionSatisfaction') === 55, 'default actor petition threshold should be exposed');

const highThresholdRoot = {
  turn: 3,
  fiscal: { taxPressureIndex: 0.82 },
  partyClassTuning: {
    socialSignals: {
      thresholds: { taxPressure: 0.9 }
    }
  },
  classes: [{ name: 'Farmers', tags: ['tax', 'peasant'], satisfaction: 50, demands: 'lower tax' }],
  parties: []
};
const suppressed = SPS.scanRuntimePressures(highThresholdRoot, { source: 'smoke-tuning-high-threshold' });
assert(!suppressed.kinds.includes('tax-pressure'), 'custom high tax threshold should suppress tax pressure signal');

const lowThresholdRoot = {
  turn: 4,
  fiscal: { taxPressureIndex: 0.82 },
  partyClassTuning: {
    socialSignals: {
      thresholds: { taxPressure: 0.75 }
    }
  },
  classes: [{ name: 'Farmers', tags: ['tax', 'peasant'], satisfaction: 50, demands: 'lower tax' }],
  parties: []
};
const recorded = SPS.scanRuntimePressures(lowThresholdRoot, { source: 'smoke-tuning-low-threshold' });
assert(recorded.kinds.includes('tax-pressure'), 'custom lower tax threshold should allow tax pressure signal');

const actorRoot = {
  turn: 5,
  partyClassTuning: {
    actors: {
      petitionSatisfaction: 20,
      associationInfluence: 90,
      strikeSatisfaction: 20,
      strikeUnrest: 90,
      revoltSatisfaction: 15,
      revoltUnrest: 95
    }
  },
  classes: [
    {
      name: 'Farmers',
      satisfaction: 30,
      influence: 70,
      demands: 'reduce levy',
      unrestLevels: { strike: 62, revolt: 74 }
    }
  ],
  parties: []
};
Actors.run(actorRoot, { turn: 5, source: 'smoke-tuning-actor-suppressed' });
assert(!actorRoot.class_actions || actorRoot.class_actions.length === 0, 'custom actor thresholds should suppress default petition/strike/revolt actions');

actorRoot.partyClassTuning.actors.petitionSatisfaction = 35;
Actors.run(actorRoot, { turn: 6, source: 'smoke-tuning-actor-enabled' });
assert(actorRoot.class_actions.some(a => a && a.turn === 6 && a.actionType === 'petition'), 'custom actor petition threshold should enable petition action');

const decayRoot = {
  turn: 11,
  partyClassTuning: {
    socialSignals: {
      decayPerTurn: 0.2,
      confidenceDecayCap: 0.5,
      escalationAfter: 1,
      escalationIntensity: 0.7
    },
    actors: {
      memoryEscalationAge: 1,
      memoryConfidenceDecayPerTurn: 0.04,
      memoryConfidenceDecayCap: 0.2,
      strikeSatisfaction: 25,
      strikeUnrest: 65,
      revoltSatisfaction: 18,
      revoltUnrest: 90
    }
  },
  classes: [
    {
      name: 'Farmers',
      satisfaction: 29,
      influence: 55,
      demands: 'reduce levy',
      unrestLevels: { strike: 68, revolt: 72 }
    }
  ],
  parties: []
};
SPS.record(decayRoot, {
  turn: 9,
  sourceSystem: 'fiscal',
  kind: 'custom-levy-pressure',
  intensity: 0.72,
  confidence: 0.9,
  linkedIssue: 'issue-custom-levy',
  reason: 'custom levy pressure remains unresolved',
  affectedClasses: [{ name: 'Farmers', demand: 'reduce levy' }]
});
SPS.applyPending(decayRoot, { turn: 9, source: 'smoke-tuning-apply' });
const decay = SPS.decayAndResolve(decayRoot, { turn: 11, source: 'smoke-tuning-decay' });
const signal = decayRoot._socialPoliticalSignals.items[0];
assert(decay.escalated === 1, 'custom escalationAfter/escalationIntensity should escalate unresolved signal');
assert(signal.confidence <= 0.5, 'custom decayPerTurn should reduce signal confidence aggressively');
assert(decayRoot._partyClassActorMemory.items.some(m => m && m.source === 'social-political-signal-escalation'), 'custom signal escalation should still write actor memory');

const tick = Actors.tick(decayRoot, { turn: 11, source: 'smoke-tuning-tick' });
assert(tick.escalatedActions >= 1, 'custom memoryEscalationAge should turn escalation memory into action immediately');
assert(decayRoot.class_actions.some(a => a && a.turn === 11 && a.linkedIssue === 'issue-custom-levy' && (a.actionType === 'strike' || a.actionType === 'revolt_seed')), 'custom actor action thresholds should pick escalated strike/revolt action');

console.log('[smoke-party-class-tuning] PASS party/class tuning');
