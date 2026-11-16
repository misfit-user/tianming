#!/usr/bin/env node
// smoke-party-class-ecology.js - scenario ecology lets party/class ties emerge without static pairing.

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
load('tm-party-class-tuning.js');
load('tm-party-class-ecology.js');
load('tm-social-political-signals.js');

const Ecology = sandbox.TM && sandbox.TM.PartyClassEcology;
const SPS = sandbox.TM && sandbox.TM.SocialPoliticalSignals;
const PG = sandbox.TM && sandbox.TM.PartyGoals;

assert(Ecology && typeof Ecology.build === 'function', 'PartyClassEcology.build should exist');
assert(typeof Ecology.scoreClass === 'function', 'PartyClassEcology.scoreClass should exist');
assert(typeof Ecology.scoreParty === 'function', 'PartyClassEcology.scoreParty should exist');
assert(typeof Ecology.enrichSignalRaw === 'function', 'PartyClassEcology.enrichSignalRaw should exist');

const root = {
  turn: 20,
  partyState: {},
  fiscal: { taxPressureIndex: 0.86 },
  classes: [
    {
      name: 'Canal Tenants',
      economicRole: 'tenant households carrying rent arrears for canal fields',
      demands: 'remit rent arrears and protect tenancy',
      satisfaction: 42,
      influence: 56,
      unrestLevels: { grievance: 40, petition: 48, strike: 68, revolt: 76 }
    },
    {
      name: 'Granary Guards',
      economicRole: 'granary patrol families waiting on wage arrears',
      demands: 'release garrison pay',
      satisfaction: 50,
      influence: 45,
      unrestLevels: { grievance: 55, petition: 65, strike: 72, revolt: 82 }
    }
  ],
  parties: [
    {
      name: 'Relief League',
      influence: 52,
      cohesion: 54,
      currentAgenda: 'remit rent arrears and protect tenants from extraction'
    },
    {
      name: 'Revenue Clique',
      influence: 66,
      cohesion: 68,
      currentAgenda: 'defend arrear collection and oppose rent exemptions',
      rivalParty: 'Relief League'
    }
  ]
};

let ecology = Ecology.build(root, { turn: 20, source: 'smoke-ecology-build' });
assert(ecology.classProfiles['Canal Tenants'].pressureProfile.tax >= 2, 'tenant rent pressure should map into tax pressure profile');
assert(ecology.partyProfiles['Relief League'].agendaProfile.tax > 0, 'relief party should map into tax agenda profile');
assert(ecology.partyProfiles['Revenue Clique'].stanceProfile.tax < 0, 'opposition wording should mark revenue party as hostile to relief');
assert(!PG.buildScenarioRelationIndex(root, { turn: 20 }).classParties['Canal Tenants'], 'scenario starts without static party/class pairing');

let scanned = SPS.scanRuntimePressures(root, { source: 'smoke-ecology-tax-20' });
assert(scanned.kinds.includes('tax-pressure'), 'ecology should let tax pressure record even when static token matching misses the class');
let taxSignal = root._socialPoliticalSignals.items.find(s => s && s.kind === 'tax-pressure');
assert(taxSignal.affectedClasses.some(x => x && x.name === 'Canal Tenants'), 'ecology should infer affected tenant class');
assert(taxSignal.affectedParties.some(x => x && x.name === 'Relief League'), 'ecology should infer supportive relief party');
assert(taxSignal.relationAdjustments.some(x => x && x.className === 'Canal Tenants' && x.party === 'Relief League' && x.affinityDelta > 0), 'ecology should add positive relation pressure for aligned party');
assert(taxSignal.relationAdjustments.some(x => x && x.className === 'Canal Tenants' && x.party === 'Revenue Clique' && x.affinityDelta < 0), 'ecology should add negative relation pressure for hostile party');

let applied = SPS.applyPending(root, { turn: 20, source: 'smoke-ecology-apply-20' });
assert(applied.classes >= 1 && applied.relations >= 2, 'ecology-enriched signal should apply class impact and relation adjustments');
let firstIndex = PG.buildScenarioRelationIndex(root, { turn: 20 });
assert(!firstIndex.classParties['Canal Tenants'] || firstIndex.classParties['Canal Tenants'].indexOf('Relief League') < 0, 'one emergent signal should leave support latent, not instant static pairing');

root.turn = 21;
root.fiscal.taxPressureIndex = 0.88;
scanned = SPS.scanRuntimePressures(root, { source: 'smoke-ecology-tax-21' });
assert(scanned.kinds.includes('tax-pressure'), 'second tax pressure should be recorded on a later turn');
applied = SPS.applyPending(root, { turn: 21, source: 'smoke-ecology-apply-21' });
assert(applied.relations >= 2, 'second ecology signal should keep moving dynamic relations');

const index = PG.buildScenarioRelationIndex(root, { turn: 21 });
assert(index.classParties['Canal Tenants'] && index.classParties['Canal Tenants'].indexOf('Relief League') >= 0, 'repeated aligned pressure should mature into runtime support');
assert(!index.classParties['Canal Tenants'] || index.classParties['Canal Tenants'].indexOf('Revenue Clique') < 0, 'hostile party should not become a supporter');

const reliefEdge = Object.values(root.partyClassRelations.edges).find(e => e && e.className === 'Canal Tenants' && e.partyName === 'Relief League');
const revenueEdge = Object.values(root.partyClassRelations.edges).find(e => e && e.className === 'Canal Tenants' && e.partyName === 'Revenue Clique');
assert(reliefEdge && reliefEdge.affinity >= 45 && reliefEdge.trust > reliefEdge.grievance, 'aligned ecology edge should become usable support');
assert(revenueEdge && revenueEdge.affinity < 28 && revenueEdge.grievance > revenueEdge.trust, 'hostile ecology edge should retain grievance');
assert(root._partyClassEcology.signalHistory.some(x => x && x.kind === 'tax-pressure' && x.turn === 21), 'ecology should keep signal history evidence');

const derived = PG.deriveFromClassDemands(root, { turn: 21, source: 'smoke-ecology-derived-goals' });
assert(derived.ok, 'mature ecology relation should let class demand derive party goals');
assert(PG.getActiveGoals(root, 'Relief League', { turn: 21 }).some(g => g && g.kind === 'classDemand' && g.sourceClass === 'Canal Tenants'), 'aligned party should receive derived class demand goal');
assert(PG.getActiveGoals(root, 'Revenue Clique', { turn: 21 }).some(g => g && g.kind === 'counterClassDemand'), 'rival hostile party should receive a counter goal once support exists');

console.log('[smoke-party-class-ecology] PASS scenario ecology emergence');
