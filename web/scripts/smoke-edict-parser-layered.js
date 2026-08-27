#!/usr/bin/env node
// smoke-edict-parser-layered.js — edict-parser LAYERED 链 · v1 + phase-c v2 行为快照
// R12a (Phase post·R12)·覆盖 phase-c-patches OVERRIDE (EdictParser.processImperialAssent + EdictParser.tick) + APPEND (QUERY_QUICK_OPTIONS·POLICY_KEYWORDS·dynamicInstitutions)
// R12b merge 前 baseline·锁 v1+v2 行为·R12b 合并后必须仍 PASS

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let ASSERTS = 0;
function assert(cond, msg) {
  ASSERTS++;
  if (!cond) throw new Error('[assert] ' + msg);
}
function eq(actual, expected, msg) {
  ASSERTS++;
  if (actual !== expected) throw new Error('[assert] ' + msg + ' expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual));
}

const ROOT = path.resolve(__dirname, '..');

const ctx = {
  console,
  Date,
  JSON,
  Math,
  setTimeout: () => {},
  clearTimeout: () => {},
  GM: {
    turn: 12,
    month: 1,
    huangquan: { index: 60 },
    huangwei: { index: 60 },
    minxin: { trueIndex: 55 },
    guoku: { money: 5000000 },
    chars: [],
    corruption: { overall: 30 },
    _pendingMemorials: [],
    _pendingClarifications: [],
  },
  P: {},
  addEB: () => {},
  toast: () => {},
  callAI: async () => null,
};
ctx.window = ctx;
ctx.globalThis = ctx;
vm.createContext(ctx);

function load(file) {
  const src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(src, ctx, { filename: file });
}

// R12b 后·tm-phase-c-patches.js 已 inline 入 tm-edict-parser.js；机构拨款走 production FiscalEngine。
load('tm-fiscal-engine.js');
load('tm-edict-parser.js');

// PhaseC.init() 现在是 no-op (OVERRIDEs 已 inline 入 v1)·调用兼容性保持
ctx.PhaseC.init();

// ══════════════════════════════════════════════════════════════
// Test 1 · namespace + APPEND
// ══════════════════════════════════════════════════════════════
assert(ctx.PhaseC, 'PhaseC namespace exists');
assert(ctx.EdictComplete, 'EdictComplete namespace exists');
assert(ctx.EdictComplete.QUERY_QUICK_OPTIONS, 'QUERY_QUICK_OPTIONS exposed via EdictComplete');
eq(ctx.EdictComplete.QUERY_QUICK_OPTIONS.length, 7, 'QUERY_QUICK_OPTIONS 7 items');
const expectedRoutes = ['integrity', 'welfare', 'tax_reform', 'military', 'public_works', 'military_reform', 'legal'];
const actualRoutes = ctx.EdictComplete.QUERY_QUICK_OPTIONS.map(o => o.route);
expectedRoutes.forEach(r => assert(actualRoutes.indexOf(r) >= 0, `QUERY_QUICK_OPTIONS contains route=${r}`));
ctx.EdictComplete.QUERY_QUICK_OPTIONS.forEach((o, i) => {
  assert(o.id && o.label && o.route && o.fill, `QUERY_QUICK_OPTIONS[${i}] has 4 fields {id, label, route, fill}`);
});

// ══════════════════════════════════════════════════════════════
// Test 2 · R12b 后·OVERRIDE 已 inline 入 v1·EdictParser.VERSION 升 2 标识
// ══════════════════════════════════════════════════════════════
eq(ctx.EdictParser.VERSION, 2, 'EdictParser.VERSION=2 after R12b inline merge');
eq(ctx.PhaseC.VERSION, 2, 'PhaseC.VERSION=2 after R12b inline merge');
assert(typeof ctx.EdictParser.registerDynamicInstitution === 'function', 'EdictParser.registerDynamicInstitution exposed (was PhaseC-only pre-R12b)');

// ══════════════════════════════════════════════════════════════
// Test 3 · processImperialAssent('approve') tax_reform → no institution registered
// ══════════════════════════════════════════════════════════════
ctx.GM._pendingMemorials = [{
  id: 'm1',
  typeKey: 'tax_reform',
  typeName: '税种设立',
  status: 'drafted',
  draftParams: { taxType: 'shangshui', taxName: '商税', rate: 0.03, base: 'commerce' }
}];
ctx.GM.dynamicInstitutions = [];
const r1 = ctx.EdictParser.processImperialAssent('m1', 'approve');
assert(r1.ok, 'tax_reform approve returns ok');
eq(r1.status, 'approved', 'tax_reform approve status=approved');
eq(ctx.GM.dynamicInstitutions.length, 0, 'tax_reform approve does NOT register institution (typeKey filter)');

// ══════════════════════════════════════════════════════════════
// Test 4 · processImperialAssent('approve') office_reform with officeName → institution registered
// ══════════════════════════════════════════════════════════════
ctx.GM._pendingMemorials = [{
  id: 'm2',
  typeKey: 'office_reform',
  typeName: '官制设立',
  status: 'drafted',
  draftParams: { officeName: '都察院', rank: 3, duties: '弹劾百官' }
}];
ctx.GM.dynamicInstitutions = [];
ctx.GM.guoku.money = 5000000;
const r2 = ctx.EdictParser.processImperialAssent('m2', 'approve');
assert(r2.ok, 'office_reform approve returns ok');
eq(ctx.GM.dynamicInstitutions.length, 1, 'office_reform approve registers institution (OVERRIDE side-effect)');
eq(ctx.GM.dynamicInstitutions[0].name, '都察院', 'institution name from draftParams.officeName');
eq(ctx.GM.dynamicInstitutions[0].rank, 3, 'institution rank from draftParams.rank');
assert(ctx.GM.dynamicInstitutions[0].id.indexOf('inst_') === 0, 'institution id prefixed inst_');

// ══════════════════════════════════════════════════════════════
// Test 5 · processImperialAssent('reject') office_reform → no institution
// ══════════════════════════════════════════════════════════════
ctx.GM._pendingMemorials = [{
  id: 'm3',
  typeKey: 'office_reform',
  typeName: '官制设立',
  status: 'drafted',
  draftParams: { officeName: '钦天监', rank: 5 }
}];
ctx.GM.dynamicInstitutions = [];
const r3 = ctx.EdictParser.processImperialAssent('m3', 'reject');
assert(r3.ok, 'office_reform reject returns ok');
eq(r3.status, 'rejected', 'reject status=rejected');
eq(ctx.GM.dynamicInstitutions.length, 0, 'reject does NOT register institution (decision filter)');

// ══════════════════════════════════════════════════════════════
// Test 6 · EdictParser.tick OVERRIDE — enhance office_reform pending_draft past expectedReturnTurn
// ══════════════════════════════════════════════════════════════
ctx.GM._pendingMemorials = [{
  id: 'm4',
  typeKey: 'office_reform',
  status: 'pending_draft',
  expectedReturnTurn: 5,
  turn: 5, // 防 _tickPendingMemorials filter (turn < 30 turns ago) 把它清掉
  draftParams: { officeName: '内阁' }
}];
ctx.GM.turn = 6;
ctx.EdictParser.tick({ turn: 6 });
assert(ctx.GM._pendingMemorials.length === 1, 'memo retained in _pendingMemorials after tick (turn diff < 30)');
assert(ctx.GM._pendingMemorials[0]._enhanced === true, 'tick OVERRIDE enhances office_reform pending_draft past expectedReturnTurn');
assert(ctx.GM._pendingMemorials[0].draftParams.details, 'enhance fills draftParams.details');

// ══════════════════════════════════════════════════════════════
// Test 7 · PhaseC.registerDynamicInstitution structure
// ══════════════════════════════════════════════════════════════
ctx.GM.dynamicInstitutions = [];
ctx.GM.guoku.money = 5000000;
ctx.GM.turn = 12; // reset (Test 6 set 到 6)
const inst = ctx.PhaseC.registerDynamicInstitution({
  name: '军机处',
  rank: 1,
  duties: '辅政',
  region: 'central',
  staffSize: 6,
  annualBudget: 30000
});
assert(inst, 'registerDynamicInstitution returns inst');
eq(inst.name, '军机处', 'inst.name');
eq(inst.rank, 1, 'inst.rank');
eq(inst.staffSize, 6, 'inst.staffSize');
eq(inst.stage, 'proposal', 'inst.stage=proposal initial');
assert(typeof inst.effectiveness === 'number', 'inst.effectiveness is number');
assert(typeof inst.corruption === 'number', 'inst.corruption is number');

// ══════════════════════════════════════════════════════════════
// Test 8 · PhaseC.abolishInstitution
// ══════════════════════════════════════════════════════════════
const aboRet = ctx.PhaseC.abolishInstitution(inst.id);
assert(aboRet, 'abolish returns inst');
const found = ctx.GM.dynamicInstitutions.find(i => i.id === inst.id);
assert(found, 'abolished inst still present (deferred filter)');
eq(found.stage, 'abolished', 'inst.stage=abolished');
eq(found.abolishedTurn, 12, 'inst.abolishedTurn set to current turn');

// ══════════════════════════════════════════════════════════════
// Test 9 · PhaseC.tick → _tickDynamicInstitutions corruption growth
// ══════════════════════════════════════════════════════════════
ctx.GM.dynamicInstitutions = [{
  id: 'i1',
  name: 'test',
  stage: 'running',
  effectiveness: 0.8,
  corruption: 30,
  annualBudget: 10000,
  createdTurn: 5
}];
ctx.GM.turn = 13;
ctx.GM.month = 6; // not fiscal year
ctx.GM.guoku.money = 100000;
const beforeCorr = ctx.GM.dynamicInstitutions[0].corruption;
ctx.PhaseC.tick({ turn: 13, monthRatio: 1 });
assert(ctx.GM.dynamicInstitutions[0].corruption > beforeCorr, 'PhaseC.tick grows institution corruption');

// ══════════════════════════════════════════════════════════════
// Test 10 · POLICY_KEYWORDS regex matching (env policy detection)
// ══════════════════════════════════════════════════════════════
// (Test 10 已删·POLICY_KEYWORDS env-policy 死代码 2026-05-29 移除)

console.log('[smoke-edict-parser-layered] pass assertions=' + ASSERTS);
