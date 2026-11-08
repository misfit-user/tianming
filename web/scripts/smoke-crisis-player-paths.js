#!/usr/bin/env node
// smoke-crisis-player-paths.js - crisis engines must be reachable through real player responses.
'use strict';

const { createHarness, makeBaseGM, makeBaseP } = require('./smoke-corruption-harness');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function assertOk(result, msg) {
  assert(result && result.ok, msg + ' should return ok, got ' + JSON.stringify(result));
}

const gm = makeBaseGM({
  turn: 24,
  month: 1,
  chars: [
    { id: 'pm', name: '\u9b4f\u5fe0\u8d24', alive: true, officialTitle: '\u9996\u8f85', ambition: 90, integrity: 18, _tenureMonths: 48 },
    { id: 'censor', name: '\u5de6\u5149\u6597', alive: true, officialTitle: '\u5fa1\u53f2', integrity: 92 }
  ],
  huangquan: {
    index: 25,
    powerMinister: { name: '\u9b4f\u5fe0\u8d24', activatedTurn: 8, controlLevel: 0.86, faction: [], interceptions: 2, counterEdicts: 1 }
  },
  huangwei: {
    index: 96,
    phase: 'tyrant',
    sources: {},
    drains: { memorialObjection: 6, lostVirtueRumor: 4, heavenlySign: 0, selfBlame: 0 },
    subDims: { court: { value: 95 }, provincial: { value: 85 }, military: { value: 82 }, foreign: { value: 80 } },
    tyrantSyndrome: {
      active: true,
      activatedTurn: 12,
      flatteryMemorialRatio: 0.72,
      overExecutionLog: [{ id: 'memo-over', turn: 23, overScale: 1.3 }],
      hiddenDamage: { unreportedMinxinDrop: 18, concealedCorruption: 8 }
    },
    lostAuthorityCrisis: { active: false, activatedTurn: null, objectionFrequency: 1, provincialWatching: false, foreignEmboldened: 0 },
    history: { tyrantPeriods: [], crisisPeriods: [], pastHumiliations: [] }
  },
  minxin: {
    trueIndex: 16,
    perceivedIndex: 48,
    byRegion: { shaanxi: { index: 8, trend: 'falling', factors: {} } },
    byClass: {},
    revolts: [{ id: 'rv-shaanxi', region: 'shaanxi', turn: 1, status: 'ongoing', level: 2, scale: 5000 }]
  },
  fiscal: {
    regions: {
      shaanxi: { compliance: 0.38, autonomyLevel: 0.25 },
      jiangnan: { compliance: 0.42, autonomyLevel: 0.3 }
    }
  },
  population: { national: { mouths: 9000000, households: 1800000 }, military: {} },
  _pendingMemorials: [
    { id: 'memo-intercepted', status: 'drafted', subject: '\u6574\u996c\u5382\u536b', intercepted: true, interceptedBy: '\u9b4f\u5fe0\u8d24' }
  ],
  _turnReport: []
});

const harness = createHarness({
  GM: gm,
  P: makeBaseP(),
  random: function() { return 0; },
  TM: { errors: { capture(e) { throw e; }, captureSilent() {} } }
});

harness.load('tm-authority-engines.js');
harness.load('tm-authority-complete.js');
harness.load('tm-corruption-engine.js');
harness.load('tm-corruption-cases.js');
harness.load('tm-corruption-extras.js');

const AC = harness.context.AuthorityComplete;
const CE = harness.context.CorruptionEngine;

assert(AC && typeof AC.tick === 'function', 'AuthorityComplete.tick should load');
assert(typeof AC.handleCrisisAction === 'function', 'AuthorityComplete.handleCrisisAction should be public');

CE.ensureModel();
gm.corruption.activeCases = [{
  id: 'case-fiscal-crisis',
  name: '\u6237\u90e8\u4fb5\u8680\u519b\u9977\u6848',
  dept: 'fiscal',
  options: [{ id: 'strict', label: '\u4e25\u529e\u8ffd\u8d43', cost: {}, benefit: { corruption: -8 } }]
}];
gm.corruption.subDepts.fiscal.true = 72;
gm.corruption.trueIndex = 70;
gm.corruption.overall = 70;

assertOk(AC.handleCrisisAction({ type: 'edict_interception', action: 'reissue', memoId: 'memo-intercepted', mode: 'secretariat' }), 'intercepted edict reissue');
assert(gm._pendingMemorials[0].intercepted === false && gm._pendingMemorials[0].reissuedTurn === gm.turn, 'reissue should clear intercepted memorial and mark reissue turn');
assert(gm._crisisPlayerActions.some(a => a.type === 'edict_interception' && a.action === 'reissue'), 'reissue should be audited as crisis player action');

assertOk(AC.handleCrisisAction({ type: 'power_minister', action: 'purge', targetName: '\u9b4f\u5fe0\u8d24' }), 'power minister purge');
assert(!gm.huangquan.powerMinister, 'power minister purge should clear powerMinister');
assert(gm.chars.find(c => c.name === '\u9b4f\u5fe0\u8d24').alive === false, 'power minister purge should remove target from court');

const tyrantBefore = gm.huangwei.index;
assertOk(AC.handleCrisisAction({ type: 'tyrant_syndrome', action: 'self_blame_reform', text: '\u7f6a\u5df1\u8bcf\uff0c\u7981\u8fc7\u5ea6\u5949\u627f' }), 'tyrant self-blame mitigation');
assert(gm.huangwei.index < tyrantBefore, 'tyrant mitigation should lower tyrant pressure');
assert(gm.huangwei.tyrantSyndrome.active === false, 'tyrant mitigation should deactivate syndrome after cooling below threshold');
assert(gm.minxin.trueIndex > 16, 'tyrant mitigation should give minxin a visible recovery');

gm.huangwei.index = 22;
gm.huangwei.phase = 'lost';
gm.huangwei.lostAuthorityCrisis = { active: true, activatedTurn: 18, objectionFrequency: 4, provincialWatching: true, foreignEmboldened: 0.65 };
const lostBefore = gm.huangwei.index;
assertOk(AC.handleCrisisAction({ type: 'lost_authority', action: 'grand_audience_restore', text: '\u5fa1\u95e8\u542c\u653f\uff0c\u53ec\u8bf8\u53f8\u9762\u8baE' }), 'lost authority restoration');
assert(gm.huangwei.index > lostBefore, 'lost authority restoration should recover huangwei');
assert(gm.huangwei.lostAuthorityCrisis.active === false, 'lost authority restoration should clear active crisis when above threshold');
assert(gm.fiscal.regions.jiangnan.compliance > 0.42, 'lost authority restoration should calm provincial watching');

const levelBefore = gm.minxin.revolts[0].level;
AC.tick({ turn: 24, monthRatio: 1 });
// 五级梯冻住（同志 11-08 定，民变重做前止血）：掷骰必中、民心再低也不往上爬；玩家镇压照样要能落账。
assert(gm.minxin.revolts[0].level === levelBefore, 'frozen ladder: a low-minxin revolt stays at its level until the revolt redesign');
const troops = gm.minxin.revolts[0].scale * 3;
assertOk(AC.handleCrisisAction({ type: 'revolt', action: 'suppress', revoltId: 'rv-shaanxi', troops: troops }), 'revolt suppression order');
AC.tick({ turn: 25, monthRatio: 1 });
assert(gm.minxin.revolts[0].status === 'suppressed', 'revolt suppression should resolve upgraded revolt through tick');

const corrBefore = gm.corruption.trueIndex;
assertOk(AC.handleCrisisAction({ type: 'corruption_case', action: 'handle_case', caseId: 'case-fiscal-crisis', optionId: 'strict' }), 'corruption case handling');
assert(gm.corruption.trueIndex < corrBefore, 'corruption case handling should reduce true corruption');
assert(gm.corruption.history.exposedCases.some(c => c.id === 'case-fiscal-crisis' && c.resolvedAction === 'strict'), 'corruption case should move to resolved history');
assert(gm._crisisPlayerActions.filter(a => a.ok).length >= 6, 'all crisis responses should be retained in crisis action audit');

console.log('[smoke-crisis-player-paths] PASS crisis player paths');
