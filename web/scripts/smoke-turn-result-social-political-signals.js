#!/usr/bin/env node
// smoke-turn-result-social-political-signals.js - AI turn results should enter the social/political signal ledger.

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
load('tm-party-class-ecology.js');
load('tm-social-political-signals.js');

const SPS = sandbox.TM && sandbox.TM.SocialPoliticalSignals;
assert(SPS && typeof SPS.recordTurnResult === 'function', 'SocialPoliticalSignals.recordTurnResult should exist');

const root = {
  turn: 31,
  partyState: {},
  classes: [
    {
      name: 'Canal Tenants',
      tags: ['tenant', 'tax', 'land', 'peasant'],
      satisfaction: 52,
      influence: 48,
      demands: 'reduce levy arrears',
      unrestLevels: { grievance: 55, petition: 46 }
    },
    {
      name: 'Border Soldiers',
      tags: ['soldier', 'military', 'wage', 'arrears'],
      satisfaction: 57,
      influence: 50,
      demands: 'pay wage arrears',
      unrestLevels: { grievance: 58, revolt: 48 }
    },
    {
      name: 'Exam Scholars',
      tags: ['scholar', 'keju', 'exam', 'office'],
      satisfaction: 61,
      influence: 54,
      demands: 'fair exam access',
      unrestLevels: { grievance: 42, petition: 53 }
    }
  ],
  parties: [
    {
      name: 'Relief League',
      tags: ['relief', 'tax', 'land'],
      currentAgenda: 'carry tenant levy relief',
      socialBase: ['Canal Tenants'],
      influence: 50,
      cohesion: 50
    },
    {
      name: 'Border Pay Bloc',
      tags: ['military', 'wage'],
      currentAgenda: 'pay border wage arrears',
      socialBase: ['Border Soldiers'],
      influence: 46,
      cohesion: 52
    },
    {
      name: 'Clean Exam Party',
      tags: ['keju', 'exam', 'office'],
      currentAgenda: 'restore fair exam access',
      socialBase: ['Exam Scholars'],
      influence: 48,
      cohesion: 55
    }
  ],
  turnChanges: {
    classes: [
      {
        name: 'Canal Tenants',
        changes: [
          { field: 'mood', oldValue: 'quiet', newValue: 'angry', reason: 'AI result: emergency levy arrears tightened' }
        ]
      }
    ],
    parties: [
      {
        name: 'Relief League',
        changes: [
          { field: 'currentAgenda', oldValue: 'watch tax court', newValue: 'attack emergency levy', reason: 'AI result: tenant pressure rose' }
        ]
      }
    ]
  }
};
sandbox.GM = root;

const result = SPS.recordTurnResult(root, {
  turnSummary: 'Emergency levy collection caused tenant unrest along the canal.',
  shizhengji: 'Border wage arrears spread through the garrisons; Keju admission fraud angered Exam Scholars.',
  zhengwen: 'Local officials pressed arrears and new levy quotas while soldiers complained of unpaid wages.',
  shiluText: 'The Clean Exam Party demanded a review of exam admissions.'
}, {
  source: 'smoke-turn-result',
  turn: 31
});

assert(result && result.recorded >= 3, 'turn-result adapter should record tax, military, and keju signals');
assert(result.kinds.includes('turn-result-tax-pressure'), 'turn result should emit tax pressure');
assert(result.kinds.includes('turn-result-military-arrears'), 'turn result should emit military arrears');
assert(result.kinds.includes('turn-result-keju-pressure'), 'turn result should emit keju pressure');
assert(result.kinds.includes('turn-result-class-evidence'), 'turnChanges class evidence should be mirrored into the ledger without direct deltas');
assert(result.kinds.includes('turn-result-party-evidence'), 'turnChanges party evidence should be mirrored into the ledger without direct deltas');

let snap = SPS.snapshot(root, { limit: 10 });
assert(snap.bySystem['turn-result'] >= 3, 'snapshot should aggregate turn-result source');
assert(snap.pending === result.recorded, 'new turn-result signals should be pending before bridge apply');
assert(snap.recent.some(s => s && s.kind === 'turn-result-class-evidence' && s.affectedClasses.some(c => c.name === 'Canal Tenants' && c.satisfactionDelta == null)), 'turnChanges class evidence should not double-apply numeric deltas');

const beforeTenant = root.classes[0].satisfaction;
const beforeSoldier = root.classes[1].satisfaction;
const beforeScholar = root.classes[2].satisfaction;
const applied = SPS.applyPending(root, { turn: 31, source: 'smoke-turn-result-apply' });
assert(applied.signals === result.recorded, 'turn-result signals should be consumable through the standard bridge');
assert(root.classes[0].satisfaction < beforeTenant, 'tax pressure from turn result should lower matched tenant satisfaction');
assert(root.classes[1].satisfaction < beforeSoldier, 'military arrears from turn result should lower matched soldier satisfaction');
assert(root.classes[2].satisfaction < beforeScholar, 'keju pressure from turn result should lower matched scholar satisfaction');
assert(root.partyClassRelations && Object.keys(root.partyClassRelations.edges || {}).length > 0, 'turn-result signals should also feed dynamic party/class relations');

const duplicate = SPS.recordTurnResult(root, {
  turnSummary: 'Emergency levy collection caused tenant unrest along the canal.',
  shizhengji: 'Border wage arrears spread through the garrisons; Keju admission fraud angered Exam Scholars.'
}, {
  source: 'smoke-turn-result',
  turn: 31
});
assert(duplicate.recorded === 0, 'turn-result adapter should avoid duplicate records for the same source and turn');

snap = SPS.snapshot(root, { limit: 10 });
const prompt = SPS.formatForPrompt(root, { limit: 10 });
assert(/turn-result/.test(prompt), 'turn-result signals should enter the endturn prompt evidence formatter');

console.log('[smoke-turn-result-social-political-signals] PASS turn-result social political signals');
