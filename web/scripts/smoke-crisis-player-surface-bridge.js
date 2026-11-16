#!/usr/bin/env node
// smoke-crisis-player-surface-bridge.js - player-facing surfaces must bridge crisis responses into AuthorityComplete.
'use strict';

const fs = require('fs');
const path = require('path');
const { createHarness, makeBaseGM, makeBaseP } = require('./smoke-corruption-harness');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function assertOk(result, msg) {
  assert(result && result.ok, msg + ' should return ok, got ' + JSON.stringify(result));
}

function source(file) {
  return fs.readFileSync(path.join(ROOT, file), 'utf8');
}

function surfaceHook(file, channel) {
  const src = source(file);
  return src.includes('handleCrisisSurfaceResponse') && src.includes("channel: '" + channel + "'");
}

const gm = makeBaseGM({
  turn: 36,
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
    drains: { memorialObjection: 6, lostVirtueRumor: 4, heavenlySign: 0, selfBlame: 0 },
    subDims: { court: { value: 95 }, provincial: { value: 85 }, military: { value: 82 }, foreign: { value: 80 } },
    tyrantSyndrome: {
      active: true,
      activatedTurn: 12,
      flatteryMemorialRatio: 0.72,
      overExecutionLog: [{ id: 'memo-over', turn: 35, overScale: 1.3 }],
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
    revolts: [{ id: 'rv-shaanxi', region: 'shaanxi', turn: 1, status: 'ongoing', level: 3, scale: 30000 }]
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

assert(AC && typeof AC.handleCrisisAction === 'function', 'AuthorityComplete.handleCrisisAction should load');
assert(typeof AC.handleCrisisSurfaceResponse === 'function', 'AuthorityComplete.handleCrisisSurfaceResponse should be public');

assert(surfaceHook('phase8-formal-drafts.js', 'edict'), 'edict publish surface should call crisis bridge');
assert(surfaceHook('phase8-formal-drafts.js', 'memorial'), 'memorial decision surface should call crisis bridge');
assert(surfaceHook('phase8-formal-drafts.js', 'hongyan'), 'hongyan letter surface should call crisis bridge');
assert(surfaceHook('phase8-formal-drafts.js', 'player_action'), 'player action surface should call crisis bridge');
assert(surfaceHook('phase8-formal-rightrail.js', 'wendui'), 'wendui surface should call crisis bridge');
assert(surfaceHook('phase8-formal-rightrail.js', 'chaoyi'), 'chaoyi record surface should call crisis bridge');
// 2026-07-04 立项拆分二切：tinyi 表态出口(§9/§10)随代码迁入 tm-tinyi-v3-edict-personnel.js
assert(surfaceHook('tm-tinyi-v3-edict-personnel.js', 'tinyi'), 'tinyi outcome surface should call crisis bridge');

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

assertOk(AC.handleCrisisSurfaceResponse({
  channel: 'edict',
  memoId: 'memo-intercepted',
  text: '\u8bcf\u4e66\uff1a\u91cd\u53d1\u5bc6\u65e8\uff0c\u7ed5\u8fc7\u622a\u8bcf\u4e4b\u6743\u81e3\u3002'
}), 'edict publish reissues intercepted edict');
assert(gm._pendingMemorials[0].intercepted === false, 'edict crisis bridge should clear intercepted edict');

assertOk(AC.handleCrisisSurfaceResponse({
  channel: 'wendui',
  targetName: '\u9b4f\u5fe0\u8d24',
  text: '\u5fa1\u524d\u95ee\u5bf9\uff1a\u62ff\u95ee\u6743\u81e3\u9b4f\u5fe0\u8d24\uff0c\u6e05\u5176\u515a\u7fbd\u3002'
}), 'wendui response purges power minister');
assert(!gm.huangquan.powerMinister, 'wendui crisis bridge should clear power minister');

assertOk(AC.handleCrisisSurfaceResponse({
  channel: 'player_action',
  text: '\u4e3b\u89d2\u884c\u6b62\uff1a\u4e0b\u7f6a\u5df1\u8bcf\uff0c\u7981\u8fc7\u5ea6\u5949\u627f\uff0c\u505c\u6ee5\u5211\u3002'
}), 'player action mitigates tyrant syndrome');
assert(gm.huangwei.tyrantSyndrome.active === false, 'player action crisis bridge should deactivate tyrant syndrome');

gm.huangwei.index = 22;
gm.huangwei.phase = 'lost';
gm.huangwei.lostAuthorityCrisis = { active: true, activatedTurn: 30, objectionFrequency: 4, provincialWatching: true, foreignEmboldened: 0.65 };
assertOk(AC.handleCrisisSurfaceResponse({
  channel: 'tinyi',
  text: '\u5ef7\u8bae\u88c1\u51b3\uff1a\u5fa1\u95e8\u542c\u653f\uff0c\u5927\u671d\u4f1a\u8bcf\u8bf8\u53f8\u9762\u8bae\uff0c\u4ee5\u590d\u671d\u5a01\u3002'
}), 'tinyi outcome restores lost authority');
assert(gm.huangwei.lostAuthorityCrisis.active === false, 'tinyi crisis bridge should clear lost authority crisis');

// \u6c11\u53d8\u4e0d\u518d\u4ece\u5371\u673a\u56de\u590d\u7684\u5b57\u773c\u91cc\u8ba4\uff08\u540c\u5fd7 11-15\u300c\u6c11\u53d8\u662f\u6cbb\u7406\u7684\u4e00\u90e8\u5206\u300d\uff1a\u527f\u3001\u629a\u3001\u8d48\u8d70\u8bcf\u4ee4\uff0c\u7531\u63a8\u6f14\u5224\uff09
const hy = AC.handleCrisisSurfaceResponse({
  channel: 'hongyan',
  revoltId: 'rv-shaanxi',
  troops: 90000,
  text: '\u9e3f\u96c1\u5bc6\u4ee4\uff1a\u53d1\u5175\u9655\u897f\u5e73\u4e71\uff0c\u52ff\u4f7f\u6c11\u53d8\u8513\u5ef6\u3002'
});
assert(hy && hy.skipped && gm.minxin.revolts[0].status === 'ongoing', 'hongyan text about revolt no longer suppresses it, got ' + JSON.stringify(hy));

assertOk(AC.handleCrisisSurfaceResponse({
  channel: 'memorial',
  caseId: 'case-fiscal-crisis',
  optionId: 'strict',
  text: '\u6731\u6279\uff1a\u4e25\u529e\u8ffd\u8d43\u6237\u90e8\u8d2a\u58a8\u6848\uff0c\u4ee5\u6b63\u519b\u9977\u3002'
}), 'memorial reply handles corruption case');
assert(gm.corruption.history.exposedCases.some(c => c.id === 'case-fiscal-crisis'), 'corruption case should move to exposed history');

assert(gm._crisisPlayerActions.filter(a => a.ok).length >= 5, 'surface crisis actions should be audited');   // 民变一类 11-15 撤了，少一条
assert(gm._crisisSurfaceResponses && gm._crisisSurfaceResponses.length >= 5, 'surface bridge should retain response ledger');

console.log('[smoke-crisis-player-surface-bridge] PASS crisis player surface bridge');
