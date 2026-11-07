#!/usr/bin/env node
// smoke-authority-variable-linkage-effects.js - First physicalized variable-linkage gap batch.

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let assertions = 0;

function assert(cond, msg) {
  assertions++;
  if (!cond) throw new Error(msg);
}

function createContext() {
  const context = {
    console,
    Date,
    JSON,
    Math: Object.create(Math),
    RegExp,
    Error,
    Array,
    Object,
    String,
    Number,
    Boolean,
    parseInt,
    parseFloat,
    isFinite,
    isNaN,
    setTimeout() {},
    clearTimeout() {},
    document: {
      getElementById: () => null,
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener() {},
      createElement: () => ({ style: {}, classList: { add() {}, remove() {} } }),
      body: {},
      head: {},
      readyState: 'complete'
    },
    localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
    navigator: { userAgent: 'node' },
    GM: {},
    P: {},
    scriptData: {},
    escHtml: v => String(v == null ? '' : v),
    toast() {},
    addEB() {},
    findScenarioById() { return null; },
    EventBus: { emit() {} },
    SettlementPipeline: { register() {} },
    EndTurnHooks: { register() {} },
    TM: { errors: { capture() {}, captureSilent() {} } }
  };
  context.Math.random = () => 0.99;
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

function load(context, file) {
  const code = fs.readFileSync(path.join(ROOT, file), 'utf8');
  vm.runInContext(code, context, { filename: file });
}

function baseGM(overrides) {
  const o = overrides || {};
  const mouths = o.mouths == null ? 1000000 : o.mouths;
  const ding = o.ding == null ? 350000 : o.ding;
  const fugitives = o.fugitives == null ? 1000 : o.fugitives;
  const hiddenCount = o.hiddenCount == null ? 500 : o.hiddenCount;
  const corr = o.corruption == null ? 40 : o.corruption;
  const hq = o.huangquan == null ? 55 : o.huangquan;
  const mx = o.minxin == null ? 60 : o.minxin;
  return {
    turn: 1,
    settings: {},
    chars: [],
    // 皇权征收效率乘在本期实征正税上（CascadeTax 记 turnTaxMoney）
    guoku: { money: o.guokuMoney == null ? 1000000 : o.guokuMoney, turnTaxMoney: o.turnTax == null ? 100000 : o.turnTax },
    neitang: { money: o.neitangMoney == null ? 100000 : o.neitangMoney },
    corruption: { overall: corr, trueIndex: corr, perceivedIndex: corr },
    population: {
      fugitives,
      hiddenCount,
      national: { mouths, ding, fugitives, hiddenCount }
    },
    minxin: {
      trueIndex: mx,
      perceivedIndex: mx,
      phase: 'stable',
      sources: {},
      drains: {},
      subDims: {
        urban: { value: mx },
        rural: { value: mx },
        elite: { value: mx },
        military: { value: mx }
      },
      revolts: []
    },
    huangquan: {
      index: hq,
      phase: 'moderate',
      trend: 'stable',
      subDims: {
        central: { value: hq },
        provincial: { value: hq },
        military: { value: hq },
        imperial: { value: hq }
      },
      sources: {},
      drains: {},
      ministers: {},
      history: { purges: [], reforms: [] }
    },
    huangwei: {
      index: o.huangwei == null ? 60 : o.huangwei,
      phase: 'normal',
      trend: 'stable',
      subDims: {
        court: { value: 60 },
        provincial: { value: 60 },
        military: { value: 60 },
        foreign: { value: 60 }
      },
      perceivedIndex: 60,
      sources: {},
      drains: {},
      tyrantSyndrome: { active: false },
      lostAuthorityCrisis: { active: false },
      history: { tyrantPeriods: [], crisisPeriods: [], pastHumiliations: [], lastActionTurn: 1 }
    }
  };
}

function setup(overrides) {
  const context = createContext();
  load(context, 'tm-authority-engines.js');
  context.GM = baseGM(overrides);
  context.AuthorityEngines.init();
  return context;
}

function tick(context) {
  context.AuthorityEngines.tick({ turn: context.GM.turn, monthRatio: 1 });
}

function corr(context) {
  return context.GM.corruption.overall;
}

function linkById(context, id) {
  return context.AuthorityEngines.getVariableLinkageMatrix().find(link => link.id === id);
}

function testCorruptionIncreasesPopulationFlight() {
  const context = setup({ corruption: 85, fugitives: 1000, hiddenCount: 500 });
  const beforeFugitives = context.GM.population.fugitives;
  const beforeHidden = context.GM.population.hiddenCount;
  tick(context);
  assert(context.GM.population.fugitives > beforeFugitives, 'corruption->population should increase root fugitives');
  assert(context.GM.population.national.fugitives === context.GM.population.fugitives, 'corruption->population should sync national fugitives');
  assert(context.GM.population.hiddenCount > beforeHidden, 'corruption->population should increase hidden households/count');
  assert(linkById(context, 'corruption_to_population').status === 'implemented_default', 'matrix should mark corruption->population as default implemented');
}

function testPopulationDisorderIncreasesCorruption() {
  const context = setup({ corruption: 40, fugitives: 150000, hiddenCount: 100000, mouths: 1000000 });
  const before = corr(context);
  tick(context);
  assert(corr(context) > before, 'population->corruption should raise corruption when fugitive/hidden ratio is high');
  assert(linkById(context, 'population_to_corruption').status === 'implemented_default', 'matrix should mark population->corruption as default implemented');
}

function testMinxinRegulatesCorruptionBothWays() {
  const low = setup({ corruption: 45, minxin: 24, fugitives: 1000, hiddenCount: 500 });
  const lowBefore = corr(low);
  tick(low);
  assert(corr(low) > lowBefore, 'low minxin should increase corruption');

  const high = setup({ corruption: 45, minxin: 86, fugitives: 1000, hiddenCount: 500 });
  const highBefore = corr(high);
  tick(high);
  assert(corr(high) < highBefore, 'high minxin should suppress corruption');
  assert(linkById(high, 'minxin_to_corruption').status === 'implemented_default', 'matrix should mark minxin->corruption as default implemented');
}

function testHuangquanImprovesGuokuAndHouseholds() {
  const strong = setup({ huangquan: 82, guokuMoney: 1000000, fugitives: 90000, hiddenCount: 60000, mouths: 1000000 });
  const strongMoneyBefore = strong.GM.guoku.money;
  const strongFugBefore = strong.GM.population.fugitives;
  tick(strong);
  assert(strong.GM.guoku.money > strongMoneyBefore, 'strong huangquan should improve guoku collection');
  assert(strong.GM._authorityTaxEfficiencyMult > 1, 'strong huangquan should expose a collection multiplier');
  assert(strong.GM.population.fugitives < strongFugBefore, 'strong huangquan should reduce fugitives through registration order');

  const weak = setup({ huangquan: 24, guokuMoney: 1000000, fugitives: 1000, hiddenCount: 500, mouths: 1000000 });
  const weakMoneyBefore = weak.GM.guoku.money;
  const weakFugBefore = weak.GM.population.fugitives;
  tick(weak);
  assert(weak.GM.guoku.money < weakMoneyBefore, 'weak huangquan should reduce guoku collection');
  assert(weak.GM._authorityTaxEfficiencyMult < 1, 'weak huangquan should expose a reduced collection multiplier');
  assert(weak.GM.population.fugitives > weakFugBefore, 'weak huangquan should increase household flight');
  assert(linkById(weak, 'huangquan_to_guoku').status === 'implemented_default', 'matrix should mark huangquan->guoku as default implemented');
  assert(linkById(weak, 'huangquan_to_population').status === 'implemented_default', 'matrix should mark huangquan->population as default implemented');
}

function main() {
  testCorruptionIncreasesPopulationFlight();
  testPopulationDisorderIncreasesCorruption();
  testMinxinRegulatesCorruptionBothWays();
  testHuangquanImprovesGuokuAndHouseholds();
  console.log(`[smoke-authority-variable-linkage-effects] PASS assertions=${assertions}`);
}

main();
