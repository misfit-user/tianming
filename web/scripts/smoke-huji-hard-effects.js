#!/usr/bin/env node
// smoke-huji-hard-effects.js - hukou/corvee/military bridge must affect live simulation.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
}

function load(name, sandbox) {
  const file = path.join(ROOT, name);
  assert(fs.existsSync(file), name + ' should exist');
  vm.runInContext(fs.readFileSync(file, 'utf8'), sandbox, { filename: name });
}

const sandbox = {
  console,
  Math, Date, JSON, RegExp, Error,
  Array, Object, String, Number, Boolean,
  parseInt, parseFloat, isNaN, isFinite,
  setTimeout: fn => { if (typeof fn === 'function') fn(); return 1; },
  clearTimeout() {},
  addEB() {},
  toast() {}
};
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.globalThis = sandbox;
sandbox.TM = { errors: { capture() {}, captureSilent() {} } };
sandbox.IntegrationBridge = {
  getLeafDivisions(adminHierarchy) {
    const out = [];
    function walk(nodes) {
      (Array.isArray(nodes) ? nodes : []).forEach(node => {
        if (!node || typeof node !== 'object') return;
        const kids = node.children || node.divisions || node.subs || [];
        if (kids.length) walk(kids);
        else out.push(node);
      });
    }
    Object.keys(adminHierarchy || {}).forEach(k => walk((adminHierarchy[k] || {}).divisions || []));
    return out;
  }
};

const scenario = {
  id: 'smoke-huji-hard-effects',
  name: 'Huji hard effects smoke',
  populationConfig: {
    initial: {
      nationalHouseholds: 9000,
      nationalMouths: 45000,
      nationalDing: 13500,
      hiddenPopulation: 12000
    },
    categoryEnabled: ['bianhu', 'junhu', 'jianghu'],
    corveeRules: { annualCorveeDays: 52, commutationRate: 0.12 },
    militaryRules: { maxExpansionRate: 0.04 }
  }
};

sandbox.findScenarioById = () => scenario;
sandbox.P = scenario;
sandbox.GM = {
  sid: 'smoke-huji-hard-effects',
  turn: 96,
  guoku: {
    balance: 500000,
    money: 500000,
    monthlyIncome: 120000,
    turnIncome: 120000,
    monthlyExpense: 70000,
    annualIncome: 1440000,
    actualTaxRate: 1
  },
  fiscal: { expectedRevenue: 120000 },
  hukou: {},
  minxin: { trueIndex: 62, perceivedIndex: 68, byRegion: {}, byClass: {}, sources: {} },
  huangquan: { index: 72, executionRate: 0.82 },
  corruption: { trueIndex: 58, subDepts: { fiscal: { true: 50 }, provincial: { true: 66 } } },
  military: { pendingRecruitment: 5000, draftQuota: 5000 },
  armies: [
    { id: 'a1', name: 'Capital Guard', soldiers: 6000, type: 'mubing', morale: 70, supply: 62 },
    { id: 'a2', name: 'Frontier Guard', soldiers: 4500, type: 'junhu', morale: 68, supply: 55 }
  ],
  classes: [
    { id: 'farmers', name: 'Farmers', satisfaction: 44, influence: 74, size: '70%' },
    { id: 'soldier_households', name: 'Soldier Households', satisfaction: 42, influence: 38, size: '8%' }
  ],
  adminHierarchy: {
    player: {
      divisions: [
        {
          id: 'canal',
          name: 'Canal Prefecture',
          regionType: 'canal',
          minxin: 38,
          minxinLocal: 38,
          corruptionLocal: 70,
          populationDetail: { households: 4200, mouths: 21000, ding: 6100, hiddenCount: 4200, fugitives: 900 },
          fiscalDetail: { claimedRevenue: 70000, actualRevenue: 36000, remittedToCenter: 24000, skimmingRate: 0.2 },
          taxLevel: 'heavy'
        },
        {
          id: 'frontier',
          name: 'Frontier Commandery',
          regionType: 'frontier',
          minxin: 41,
          minxinLocal: 41,
          corruptionLocal: 62,
          populationDetail: { households: 3100, mouths: 15500, ding: 4500, hiddenCount: 900, fugitives: 500 },
          fiscalDetail: { claimedRevenue: 43000, actualRevenue: 26000, remittedToCenter: 14000, skimmingRate: 0.18 },
          taxLevel: 'medium'
        }
      ]
    }
  }
};

vm.createContext(sandbox);
load('tm-social-political-signals.js', sandbox);
load('tm-player-action-signals.js', sandbox);
load('tm-minxin-ledger.js', sandbox);
load('tm-huji-engine.js', sandbox);
load('tm-huji-deep-fill.js', sandbox);
load('tm-huji-runtime-bridge.js', sandbox);
load('tm-guoku-engine.js', sandbox);

const Bridge = sandbox.TM.HujiRuntimeBridge;
assert(Bridge && typeof Bridge.maintain === 'function', 'TM.HujiRuntimeBridge.maintain should exist');
assert(typeof Bridge.applyHardEffects === 'function', 'bridge should expose hard-effect application');
assert(typeof Bridge.enforceAfterFiscalTick === 'function', 'bridge should expose post-fiscal hard-effect enforcement');

sandbox.HujiEngine.init(scenario);
const beforeIncome = sandbox.GM.guoku.monthlyIncome;
const beforeMinxin = sandbox.GM.minxin.trueIndex;
const beforeMorale = sandbox.GM.armies.map(a => a.morale);

const maintained = Bridge.maintain(sandbox.GM, {
  scenario,
  turn: 96,
  source: 'smoke-huji-hard-effects',
  includePlayerSignals: true,
  applyHardEffects: true
});
assert(maintained && maintained.ok, 'maintain should return ok');
assert(maintained.snapshot && maintained.snapshot.hardEffects, 'snapshot should expose hardEffects');

const hard = sandbox.GM._hujiHardEffects;
assert(hard && hard.fiscal && hard.military && hard.corvee && hard.tinyi, 'GM should store hard-effect summary');
assert(Array.isArray(hard.ledger) && hard.ledger.some(e => e && e.stage === 'pre-fiscal'), 'hard effects should keep pre-fiscal ledger entries');
assert(hard.fiscal.collectionMultiplier < 1, 'hidden and fugitive households should reduce fiscal collection multiplier');
assert(sandbox.GM.guoku.monthlyIncome < beforeIncome, 'huji hard effects should reduce guoku monthly income before turn settlement');
assert(sandbox.GM.guoku.turnIncome === sandbox.GM.fiscal.effectiveRevenue, 'fiscal effective revenue should mirror constrained turn income');
assert(sandbox.GM.guoku.actualTaxRate <= hard.fiscal.collectionMultiplier, 'guoku actualTaxRate should be capped by hukou collection multiplier');

assert(hard.military.shortfall > 0, 'service pool should create recruitment shortfall');
assert(sandbox.GM.military.approvedRecruitment < sandbox.GM.military.pendingRecruitment, 'approved recruitment should be capped by service pool');
assert(sandbox.GM.armies.some((a, i) => a.morale < beforeMorale[i]), 'recruitment shortfall should lower army morale once this turn');

assert(hard.corvee.minxinDelta < 0, 'corvee gap should produce negative minxin delta');
assert(sandbox.GM.minxin.trueIndex < beforeMinxin, 'corvee hard effect should apply to minxin truth');
assert(sandbox.GM._minxinLedger.items.some(s => s.sourceSystem === 'huji-hard-effects'), 'corvee hard effect should enter minxin ledger');
assert(sandbox.GM._socialPoliticalSignals.items.some(s => s.sourceSystem === 'huji-hard-effects'), 'hard effects should enter social/political signal ledger');

assert(Array.isArray(sandbox.GM._pendingTinyiTopics), 'hard effects should ensure pending tinyi queue');
assert(sandbox.GM._pendingTinyiTopics.some(t => t && t.from === 'huji-hard-effects' && t.effectType === 'hukou'), 'hukou pressure should spawn a court topic');
assert(sandbox.GM._pendingTinyiTopics.some(t => t && t.from === 'huji-hard-effects' && t.effectType === 'corvee'), 'corvee pressure should spawn a court topic');
assert(sandbox.GM._pendingTinyiTopics.some(t => t && t.from === 'huji-hard-effects' && t.effectType === 'military'), 'military shortfall should spawn a court topic');

sandbox.GuokuEngine.ensureModel();
sandbox.GuokuEngine.tick({ _monthRatio: 1, turn: 96 });
const postFiscal = Bridge.enforceAfterFiscalTick(sandbox.GM, { turn: 96, source: 'smoke-post-fiscal' });
assert(postFiscal && postFiscal.ok, 'post-fiscal enforcement should return ok');
assert(sandbox.GM.guoku.turnIncome < beforeIncome, 'guoku tick should keep huji-constrained turn income');
assert(sandbox.GM.guoku.actualTaxRate <= hard.fiscal.collectionMultiplier, 'post-fiscal enforcement should restore hukou tax-rate cap after guoku tick');
assert(sandbox.GM.guoku.hujiHardEffects && sandbox.GM.guoku.hujiHardEffects.revenueLoss > 0, 'guoku should keep revenue loss diagnostics');
assert(sandbox.GM._hujiHardEffects.ledger.some(e => e && e.stage === 'post-fiscal' && e.kind === 'fiscal'), 'hard effects should record post-fiscal enforcement');

const prompt = Bridge.formatForPrompt(sandbox.GM, { limit: 8 });
assert(/hujiHardEffects/.test(prompt), 'prompt should include hard effects');
assert(/fiscalHardEffect/.test(prompt) && /militaryHardEffect/.test(prompt) && /corveeHardEffect/.test(prompt), 'prompt should include fiscal/military/corvee hard-effect lines');
assert(/hujiHardEffectLedger/.test(prompt), 'prompt should include hard-effect ledger');

const snap = Bridge.snapshot(sandbox.GM, { limit: 5 });
assert(snap.hardEffects && snap.hardEffects.tinyi.created >= 3, 'snapshot should expose hard-effect tinyi creation');

const src = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
assert(/HujiRuntimeBridge\.maintain\(GM/.test(src('tm-endturn-systems.js')), 'turn systems should call bridge maintain');
assert(/HujiRuntimeBridge\.enforceAfterFiscalTick/.test(src('tm-endturn-systems.js')), 'turn systems should enforce bridge after guoku tick');
assert(/hujiHardEffects/.test((src('phase8-formal-rightrail.js') + src('phase8-formal-rightrail-social.js'))), 'right rail should expose hard-effect diagnostics');
assert(/hujiHardEffects/.test(src('tm-topbar-vars.js')), 'topbar should expose hard-effect diagnostics');

// ── 11-08 徭役：缺口不扣民心、扣到役负最重的州（精确认州）、结算前那遍不落账、折银算兑现 ──
function corveeRoot(minxin) {
  return {
    sid: 'smoke-corvee-1108', turn: 5,
    guoku: { balance: 100000, money: 100000, monthlyIncome: 10000, turnIncome: 10000 },
    fiscal: {}, hukou: {}, military: {}, corvee: {},
    minxin: { trueIndex: minxin, perceivedIndex: minxin, byRegion: {}, byClass: {}, sources: {} },
    armies: [{ id: 'g1', name: 'Guard', soldiers: 1000, morale: 70, supply: 60 }],
    adminHierarchy: { player: { divisions: [
      { id: 'east_1', name: 'East One', minxin: minxin, minxinLocal: minxin, populationDetail: { mouths: 1000, ding: 300 } },
      { id: 'east_12', name: 'East Twelve', minxin: minxin, minxinLocal: minxin, populationDetail: { mouths: 1000, ding: 300 } },
      { id: 'west', name: 'West', minxin: minxin, minxinLocal: minxin, populationDetail: { mouths: 2000, ding: 600 } }
    ] } }
  };
}
const leafMx = (root) => Object.fromEntries(root.adminHierarchy.player.divisions.map(d => [d.id, d.minxin]));

// ① 民心低、缺口大、役负不重：不扣（旧写法按缺口比 0.85 每回合扣 −4.25）
const lowRoot = corveeRoot(30);
const lowEff = Bridge.applyHardEffects(lowRoot, { hukou: {}, military: {}, corvee: { summary: { totalDemandDays: 1000, gapDays: 850, burden: 5.2 }, byRegion: [] } }, { turn: 5, source: 'smoke-corvee-low' });
assert(lowEff.corvee.minxinDelta === 0, 'a corvee gap alone must not cost minxin (gap ratio 0.85, burden 5.2 under the 8-day custom): ' + lowEff.corvee.minxinDelta);
assert(Object.values(leafMx(lowRoot)).every(v => v === 30), 'no prefecture minxin should move when only the gap is large: ' + JSON.stringify(leafMx(lowRoot)));

// ② 役负重：扣到役负超过常例的州，按「超出日数 × 口数」分；east_12 役负不重，编号里含 east_1 也不该挨扣
const heavyLedger = { summary: { totalDemandDays: 52000, gapDays: 0, burden: 16 }, byRegion: [
  { id: 'east_1', name: 'East One', demandDays: 20000, gapDays: 0, burden: 20 },
  { id: 'east_12', name: 'East Twelve', demandDays: 6000, gapDays: 0, burden: 6 },
  { id: 'west', name: 'West', demandDays: 24000, gapDays: 0, burden: 12 }
] };
const heavyRoot = corveeRoot(50);
const heavyEff = Bridge.applyHardEffects(heavyRoot, { hukou: {}, military: {}, corvee: heavyLedger }, { turn: 5, source: 'smoke-corvee-heavy' });
const hm = leafMx(heavyRoot);
assert(heavyEff.corvee.minxinDelta === -1.5, 'burden 16 against the 8-day custom should cost 1.5: ' + heavyEff.corvee.minxinDelta);
assert(hm.east_12 === 50, 'east_12 bears no excess corvee and must not be hit because its id contains east_1: ' + JSON.stringify(hm));
assert(Math.abs((50 - hm.east_1) - 0.9) < 0.02 && Math.abs((50 - hm.west) - 0.6) < 0.02, 'shares should follow excess days x mouths (12x1000 : 4x2000): ' + JSON.stringify(hm));

// ③ 结算前那一遍（pre-submit）只预算不落账：民心、士气都不动；回合数加一后那遍才落，且只落一次
const preRoot = corveeRoot(50);
const preArgs = () => ({ hukou: {}, military: { requestedRecruits: 1000, availableRecruits: 100 }, corvee: heavyLedger });
const preEff = Bridge.applyHardEffects(preRoot, preArgs(), { turn: 5, source: 'pre-submit-huji-runtime-bridge' });
assert(preEff.corvee.minxinDelta < 0 && preEff.corvee.appliedToMinxin === false, 'the pre-submit pass should compute but not apply corvee minxin: ' + JSON.stringify(preEff.corvee));
assert(Object.values(leafMx(preRoot)).every(v => v === 50), 'the pre-submit pass must not move prefecture minxin: ' + JSON.stringify(leafMx(preRoot)));
assert(preRoot.armies[0].morale === 70, 'the pre-submit pass must not cut army morale: ' + preRoot.armies[0].morale);
const postEff = Bridge.applyHardEffects(preRoot, preArgs(), { turn: 6, source: 'endturn-huji-runtime-bridge' });
assert(postEff.corvee.appliedToMinxin === true && leafMx(preRoot).east_1 < 50, 'the settlement pass after the turn advance should apply corvee minxin');
assert(preRoot.armies[0].morale === 62, 'the settlement pass should cut morale once by the shortfall penalty (8): ' + preRoot.armies[0].morale);

// ④ 折银的役日算兑现，实役按本州役法执行率：执行率 0.8、折银 0.12 → 兑现约 82.4%（旧写法按全国执行率 × 民心/100，缺口七成）
sandbox.GM.adminHierarchy.player.divisions.forEach(d => { d.corveeDetail = { executionEfficiency: 0.8 }; });
Bridge.maintain(sandbox.GM, { scenario, turn: 97, source: 'smoke-corvee-commute', applyHardEffects: false });
const cs = sandbox.GM.corvee.ledger.summary;
const fr = cs.fulfilledDays / cs.totalDemandDays;
assert(Math.abs(fr - (0.12 + 0.88 * 0.8)) < 0.01, 'commuted days count as fulfilled and labour days follow the prefecture corvee efficiency: ' + fr.toFixed(3));

console.log('[smoke-huji-hard-effects] PASS huji hard effects');
