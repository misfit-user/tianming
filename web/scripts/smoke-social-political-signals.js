#!/usr/bin/env node
// smoke-social-political-signals.js - standardized social/political signals feed class and party dynamics.

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

const SPS = sandbox.TM && sandbox.TM.SocialPoliticalSignals;
const PG = sandbox.TM && sandbox.TM.PartyGoals;
assert(SPS && typeof SPS.record === 'function', 'SocialPoliticalSignals.record should exist');
assert(typeof SPS.applyPending === 'function', 'SocialPoliticalSignals.applyPending should exist');
assert(typeof SPS.snapshot === 'function', 'SocialPoliticalSignals.snapshot should exist');
assert(sandbox.TM.PartyClassSignalBridge && typeof sandbox.TM.PartyClassSignalBridge.applyPending === 'function', 'PartyClassSignalBridge.applyPending should exist as the rule consumer');
assert(PG && typeof PG.getActiveGoals === 'function', 'PartyGoals should be available');

const root = {
  turn: 4,
  partyState: {},
  classes: [
    {
      name: 'Farmers',
      satisfaction: 55,
      influence: 44,
      demands: 'stable corvee burden',
      unrestLevels: { grievance: 60, petition: 70, strike: 82, revolt: 92 },
      supportingParties: [{ class: 'Relief Party', affinity: 0.8 }]
    },
    {
      name: 'Merchants',
      satisfaction: 58,
      influence: 62,
      demands: 'predictable market fees',
      unrestLevels: { grievance: 64, petition: 74, strike: 86, revolt: 94 }
    }
  ],
  parties: [
    { name: 'Relief Party', influence: 46, cohesion: 52, socialBase: [{ class: 'Farmers', affinity: 0.5 }] },
    { name: 'Tax Clique', influence: 66, cohesion: 68, rivalParty: 'Relief Party' }
  ],
  currentIssues: [
    { id: 'issue-tax-levy', title: 'Emergency grain levy', status: 'pending', category: 'finance' }
  ]
};

const signal = SPS.record(root, {
  sourceSystem: 'fiscal',
  kind: 'tax-pressure',
  tags: ['tax', 'corvee'],
  intensity: 0.8,
  confidence: 0.9,
  linkedIssue: 'issue-tax-levy',
  reason: 'Emergency grain levy and forced transport burden rural households.',
  affectedClasses: [
    {
      name: 'Farmers',
      satisfactionDelta: -12,
      influenceDelta: 2,
      unrestDelta: { grievance: -5, petition: -4 },
      demand: 'reduce emergency grain levy'
    }
  ],
  affectedParties: [
    {
      name: 'Tax Clique',
      influenceDelta: 2,
      cohesionDelta: 1,
      shortGoal: 'defend emergency grain levy'
    }
  ],
  relationAdjustments: [
    {
      className: 'Farmers',
      party: 'Relief Party',
      affinityDelta: 14,
      trustDelta: 5,
      grievanceDelta: -4,
      reason: 'Relief Party promised to carry rural grievance into court.'
    }
  ]
});

assert(signal && signal.id && signal.applied !== true, 'record should create an unapplied signal');
assert(root._socialPoliticalSignals.items.length === 1, 'signal ledger should store the raw signal');

const applied = SPS.applyPending(root, { turn: 4, source: 'smoke-social-signal' });
assert(applied && applied.signals === 1, 'applyPending should apply one signal');
assert(applied.classes === 1, 'applyPending should update one class');
assert(applied.parties === 1, 'applyPending should update one party');
assert(applied.relations === 1, 'applyPending should update one party-class relation');
assert(applied.goals >= 1, 'applyPending should derive at least one party goal from class pressure');

assert(root.classes[0].satisfaction === 43, 'class satisfaction should reflect deterministic signal delta');
assert(root.classes[0].influence === 46, 'class influence should reflect deterministic signal delta');
assert(root.classes[0].currentDemand === 'reduce emergency grain levy', 'class current demand should update from signal');
assert(root.classes[0].unrestLevels.grievance === 55, 'class unrest threshold should shift from signal');
assert(root.parties[1].influence === 68, 'party influence should reflect deterministic signal delta');
assert(root.parties[1].cohesion === 69, 'party cohesion should reflect deterministic signal delta');
assert(root.parties[1].shortGoal === 'defend emergency grain levy', 'party short goal should update from signal');
assert(root.partyState['Relief Party'] && root.partyState['Relief Party'].cohesion < 52, 'class update should still couple to supporting party state');

const edge = Object.values(root.partyClassRelations.edges).find(e => e && e.className === 'Farmers' && e.partyName === 'Relief Party');
assert(edge && edge.affinity > 62 && edge.trust > 50, 'relation adjustment should strengthen runtime class-party edge');
assert(edge.evidence.some(e => e && e.source === 'smoke-social-signal'), 'relation edge should keep signal evidence');
assert(root._socialPoliticalSignalApplications.length === 1, 'application ledger should keep apply summary');
assert(root._socialPoliticalSignals.items[0].applied === true, 'applied signal should be marked applied');
assert(PG.getActiveGoals(root, 'Relief Party', { turn: 4 }).some(g => g && g.sourceClass === 'Farmers'), 'class pressure should derive a party goal after signal application');

const fresh = SPS.applyPending(root, { turn: 4, source: 'smoke-social-signal-repeat' });
assert(fresh.signals === 0, 'applyPending should not reapply already applied signals');

const bridgeRoot = {
  turn: 5,
  partyState: {},
  classes: [{ name: 'Boatmen', tags: ['transport', 'tax'], satisfaction: 52, influence: 42, demands: 'lower ferry tax' }],
  parties: [{ name: 'Canal Party', tags: ['transport'], influence: 50, cohesion: 50, socialBase: [{ class: 'Boatmen', affinity: 0.5 }] }]
};
SPS.record(bridgeRoot, {
  sourceSystem: 'fiscal',
  kind: 'transport-tax-pressure',
  tags: ['tax', 'transport'],
  intensity: 0.6,
  confidence: 0.85,
  reason: 'ferry tax pressure',
  affectedClasses: [{ name: 'Boatmen', satisfactionDelta: -4, demand: 'lower ferry tax' }],
  relationAdjustments: [{ className: 'Boatmen', party: 'Canal Party', affinityDelta: 8, trustDelta: 3, reason: 'party carried ferry tax complaint' }]
});
const bridged = sandbox.TM.PartyClassSignalBridge.applyPending(bridgeRoot, { turn: 5, source: 'smoke-party-class-signal-bridge' });
assert(bridged.signals === 1 && bridged.classes === 1 && bridged.relations === 1, 'PartyClassSignalBridge should consume standard signals into class and party-goal systems');
assert(bridgeRoot.classes[0].satisfaction === 48, 'PartyClassSignalBridge should apply deterministic class delta');
assert(bridgeRoot.partyClassRelations && Object.keys(bridgeRoot.partyClassRelations.edges).length === 1, 'PartyClassSignalBridge should write dynamic relation evidence');

const snap = SPS.snapshot(root, { limit: 5 });
assert(snap.count === 1 && snap.pending === 0, 'snapshot should summarize signal count and pending count');
assert(snap.bySystem.fiscal === 1, 'snapshot should aggregate by source system');
assert(snap.recent[0].linkedIssue === 'issue-tax-levy', 'snapshot should keep linked issue evidence');

const scanRoot = {
  turn: 8,
  partyState: {},
  fiscal: { _peasantBurdenAvg: 0.84, taxPressureIndex: 0.82, forcedLevyIndex: 0.78 },
  landAnnexation: { concentration: 0.74 },
  corruption: { trueIndex: 72, subDepts: { central: { true: 76 }, fiscal: { true: 71 } } },
  keju: { fairnessIndex: 34, admissionRate: 0.22 },
  office: { donationIntensity: 0.82, purgeIntensity: 0.78, samePartyAppointmentRatio: 0.8, dominantParty: 'Tax Clique' },
  military: { wageArrearsMonths: 4, forcedConscriptionIndex: 0.77 },
  local: { revoltRisk: 0.82 },
  classes: [
    { name: 'Rural Households', tags: ['peasant', 'tax', 'corvee'], satisfaction: 56, influence: 48, demands: 'lighter levy', supportingParties: [{ class: 'Relief Party', affinity: 0.7 }] },
    { name: 'Exam Scholars', tags: ['scholar', 'keju', 'exam'], satisfaction: 60, influence: 58, demands: 'fair exam access' },
    { name: 'Merchant Guilds', tags: ['merchant', 'corruption'], satisfaction: 59, influence: 63, demands: 'clean salt licenses' },
    { name: 'Soldier Households', tags: ['soldier', 'military', 'wage', 'arrears', 'conscription'], satisfaction: 54, influence: 52, demands: 'pay border wages' },
    { name: 'Office Seekers', tags: ['gentry', 'office', 'donation', 'appointment', 'purge'], satisfaction: 61, influence: 57, demands: 'fair appointments' },
    { name: 'Local Commoners', tags: ['local', 'rebellion', 'uprising', 'corvee'], satisfaction: 50, influence: 45, demands: 'stop local exactions' }
  ],
  parties: [
    { name: 'Relief Party', influence: 50, cohesion: 55, socialBase: [{ class: 'Rural Households', affinity: 0.7 }] },
    { name: 'Tax Clique', influence: 66, cohesion: 68, tags: ['office', 'purge', 'appointment'], currentAgenda: 'control offices' }
  ]
};
const scanned = SPS.scanRuntimePressures(scanRoot, { source: 'smoke-runtime-scan' });
assert(scanned.recorded >= 12, 'runtime scan should record all phase-one named pressure signals');
assert(scanned.kinds.includes('fiscal-peasant-burden'), 'runtime scan should detect peasant burden');
assert(scanned.kinds.includes('tax-pressure'), 'runtime scan should detect tax pressure');
assert(scanned.kinds.includes('forced-conscription'), 'runtime scan should detect forced conscription');
assert(scanned.kinds.includes('land-annexation'), 'runtime scan should detect land annexation');
assert(scanned.kinds.includes('corruption-high'), 'runtime scan should detect corruption pressure');
assert(scanned.kinds.includes('keju-access-tension'), 'runtime scan should detect keju access pressure');
assert(scanned.kinds.includes('keju-admission-shock'), 'runtime scan should detect keju admission pressure');
assert(scanned.kinds.includes('office-donation'), 'runtime scan should detect donation-for-office pressure');
assert(scanned.kinds.includes('party-purge'), 'runtime scan should detect purge pressure');
assert(scanned.kinds.includes('same-party-appointments'), 'runtime scan should detect same-party appointments');
assert(scanned.kinds.includes('military-wage-arrears'), 'runtime scan should detect unpaid military wages');
assert(scanned.kinds.includes('local-revolt-risk'), 'runtime scan should detect local revolt risk');
assert(SPS.snapshot(scanRoot).pending === scanned.recorded, 'runtime scan should leave newly recorded signals pending');
const scannedAgain = SPS.scanRuntimePressures(scanRoot, { source: 'smoke-runtime-scan' });
assert(scannedAgain.recorded === 0, 'runtime scan should not duplicate the same source/kind in one turn');
const appliedScan = SPS.applyPending(scanRoot, { turn: 8, source: 'smoke-runtime-scan-apply' });
assert(appliedScan.signals === scanned.recorded, 'runtime scan signals should be applicable through the bridge');
assert(scanRoot.classes[0].satisfaction < 56, 'fiscal/land pressure should affect dynamically matched rural class');
assert(scanRoot.classes[1].satisfaction < 60, 'keju pressure should affect dynamically matched scholar class');
assert(scanRoot.classes[2].satisfaction < 59, 'corruption pressure should affect dynamically matched merchant class');
assert(scanRoot.classes[3].satisfaction < 54, 'military arrears/forced conscription should affect soldier households');
assert(scanRoot.classes[4].satisfaction < 61, 'donation/purge/appointment pressure should affect office seekers');
assert(scanRoot.classes[5].satisfaction < 50, 'local revolt pressure should affect local commoners');
assert(scanRoot.parties[1].influence > 66 || scanRoot.parties[1].cohesion < 68, 'office/purge pressure should touch implicated party rows');
assert(PG.getActiveGoals(scanRoot, 'Relief Party', { turn: 8 }).some(g => g && g.sourceClass === 'Rural Households'), 'runtime pressure should still derive party goals through dynamic relations');

const fakeBus = {
  listeners: {},
  on(name, fn) {
    if (!this.listeners[name]) this.listeners[name] = [];
    this.listeners[name].push(fn);
  },
  emit(name, payload) {
    (this.listeners[name] || []).forEach(fn => fn(payload));
  }
};
SPS.installEventBridge(null, fakeBus);
const eventRoot = { turn: 9, classes: [{ name: 'Porters', tags: ['corvee'], satisfaction: 50 }] };
sandbox.GM = eventRoot;
fakeBus.emit('peasantBurden.critical', {
  turn: 9,
  socialPoliticalSignal: {
    sourceSystem: 'event-test',
    affectedClasses: [{ name: 'Porters', satisfactionDelta: -3 }],
    reason: 'event bridge payload'
  }
});
assert(eventRoot._socialPoliticalSignals && eventRoot._socialPoliticalSignals.items.length === 1, 'event bridge should record to current GM at emit time');
assert(eventRoot._socialPoliticalSignals.items[0].kind === 'peasantBurden.critical', 'event bridge should preserve event name as signal kind');

load('tm-player-action-signals.js');
const actionRoot = {
  turn: 10,
  classes: [{ name: 'Farmers', tags: ['tax', 'peasant'], satisfaction: 48, demands: 'lower levy' }],
  parties: [{ name: 'Relief Party', tags: ['relief', 'tax'], currentAgenda: 'lower levy' }]
};
const playerAction = sandbox.TM.PlayerActionSignals.record(actionRoot, {
  source: 'smoke-player-action-standard-signal',
  action: 'court',
  topic: 'Emergency levy',
  linkedIssue: 'issue-tax-levy',
  text: 'Put Farmers levy relief before court and ask Relief Party to support it.'
});
assert(playerAction && playerAction.candidateClasses.some(x => x.name === 'Farmers'), 'player action should infer affected candidate class');
assert(actionRoot._socialPoliticalSignals && actionRoot._socialPoliticalSignals.items.length === 1, 'player action should also mirror into the standard social/political ledger');
assert(actionRoot._socialPoliticalSignals.items[0].sourceSystem === 'player-action', 'mirrored player action should use sourceSystem=player-action');
assert(actionRoot._socialPoliticalSignals.items[0].linkedIssue === 'issue-tax-levy', 'mirrored player action should preserve linked issue');
assert(actionRoot._socialPoliticalSignals.items[0].affectedClasses.some(x => x.name === 'Farmers'), 'mirrored player action should list affected classes');
assert(actionRoot._socialPoliticalSignals.items[0].affectedParties.some(x => x.name === 'Relief Party'), 'mirrored player action should list affected parties');

load('tm-party-class-llm-calibrator.js');
const Cal = sandbox.TM && sandbox.TM.PartyClassLlmCalibrator;
const calSnap = Cal.buildSnapshot(scanRoot, { source: 'smoke-social-snapshot', phase: 'pre-submit' });
assert(calSnap.socialPoliticalSignals && calSnap.socialPoliticalSignals.count >= scanned.recorded, 'calibrator snapshot should include social-political signals');
const messages = Cal.buildMessages(calSnap);
assert(messages.some(m => /socialPoliticalSignals/.test(String(m.content || ''))), 'calibrator prompt should serialize social-political signal evidence');

console.log('[smoke-social-political-signals] PASS social political signals');
