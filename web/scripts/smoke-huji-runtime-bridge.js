#!/usr/bin/env node
// smoke-huji-runtime-bridge.js - hukou/corvee/military bridge keeps runtime state coherent.

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
  id: 'smoke-huji',
  name: '明末户口桥接烟测',
  dynasty: '明',
  populationConfig: {
    initial: {
      nationalHouseholds: 10000,
      nationalMouths: 50000,
      nationalDing: 15000,
      hiddenPopulation: 4000
    },
    categoryEnabled: ['bianhu', 'junhu', 'jianghu', 'daohu', 'tusi_custom'],
    categoryDescriptions: {
      bianhu: '编户齐民',
      junhu: '卫所军户',
      jianghu: '工匠匠户',
      daohu: '灶户盐场',
      tusi_custom: '土司属户'
    },
    gradeSystem: 'ming_10',
    corveeRules: { annualCorveeDays: 36, commutationRate: 0.6 },
    militaryRules: { maxExpansionRate: 0.12 }
  }
};

sandbox.findScenarioById = () => scenario;
sandbox.P = scenario;
sandbox.GM = {
  sid: 'smoke-huji',
  turn: 88,
  guoku: { money: 800000, grain: 500000, monthlyIncome: 32000, turnIncome: 32000 },
  fiscal: { expectedRevenue: 32000 },
  hukou: {},
  minxin: { trueIndex: 52, byRegion: {} },
  corruption: { trueIndex: 64, subDepts: { provincial: { true: 70 } } },
  military: { pendingRecruitment: 3200, draftQuota: 3200 },
  armies: [
    { id: 'army-1', name: '京营', soldiers: 5000, type: 'mubing', morale: 45, supply: 60 },
    { id: 'army-2', name: '卫所兵', soldiers: 4200, type: 'junhu', morale: 50, supply: 45 }
  ],
  adminHierarchy: {
    player: {
      divisions: [
        {
          id: 'capital',
          name: '京畿',
          regionType: 'capital',
          minxinLocal: 44,
          corruptionLocal: 68,
          taxLevel: 'heavy',
          bySettlement: { city: 0.52, rural: 0.48 },
          byEthnicity: { han: 0.96, other: 0.04 },
          byFaith: { confucian: 0.55, buddhist: 0.2, taoist: 0.1, folk: 0.15 },
          populationDetail: { households: 5200, mouths: 26000, ding: 7600, hiddenCount: 600, fugitives: 200 },
          fiscalDetail: { claimedRevenue: 36000, actualRevenue: 28000, remittedToCenter: 18000, skimmingRate: 0.16 }
        },
        {
          id: 'salt',
          name: '盐场',
          regionType: 'salt',
          minxinLocal: 58,
          corruptionLocal: 45,
          taxLevel: 'medium',
          populationDetail: { households: 2100, mouths: 10500, ding: 3300, hiddenCount: 90, fugitives: 40 },
          fiscalDetail: { claimedRevenue: 18000, actualRevenue: 15000, remittedToCenter: 9000, skimmingRate: 0.1 }
        },
        {
          id: 'tusi',
          name: '山地土司',
          regionType: 'tusi',
          minxinLocal: 62,
          corruptionLocal: 28,
          taxLevel: 'light',
          bySettlement: { mountain: 0.86, market: 0.14 },
          populationDetail: { households: 900, mouths: 4500, ding: 1600, hiddenCount: 40, fugitives: 25 },
          fiscalDetail: { claimedRevenue: 5000, actualRevenue: 3800, remittedToCenter: 900, skimmingRate: 0.08, autonomyLevel: 0.75 }
        }
      ]
    }
  }
};

vm.createContext(sandbox);
load('tm-perf.js', sandbox);
load('tm-social-political-signals.js', sandbox);
load('tm-player-action-signals.js', sandbox);
load('tm-minxin-ledger.js', sandbox);
load('tm-minxin-hard-links.js', sandbox);
load('tm-minxin-hard-link-consumers.js', sandbox);
load('tm-huji-engine.js', sandbox);
load('tm-huji-deep-fill.js', sandbox);
load('tm-huji-runtime-bridge.js', sandbox);

const Bridge = sandbox.TM.HujiRuntimeBridge;
assert(Bridge && typeof Bridge.maintain === 'function', 'TM.HujiRuntimeBridge.maintain should exist');
assert(typeof Bridge.recordPlayerOperation === 'function', 'bridge should record player operations');
assert(typeof Bridge.formatForPrompt === 'function', 'bridge should format prompt package');
assert(typeof Bridge.snapshot === 'function', 'bridge should expose snapshot');

sandbox.HujiEngine.init(scenario);
const maintained = Bridge.maintain(sandbox.GM, { scenario, turn: 88, source: 'smoke-maintain' });
assert(maintained && maintained.ok, 'maintain should return ok');
assert(sandbox.GM._hujiRuntimeBridge && sandbox.GM._hujiRuntimeBridge.snapshot, 'bridge store should keep snapshot');

assert(sandbox.GM.population.national.households === 8200, 'national households should follow admin leaf aggregate');
assert(sandbox.GM.population.national.mouths === 41000, 'national mouths should follow admin leaf aggregate');
assert(sandbox.GM.population.national.ding === 12500, 'national ding should follow admin leaf aggregate');
assert(sandbox.GM.population.hiddenCount >= 730, 'hidden count should preserve regional hidden records');
assert(sandbox.GM.population.fugitives >= 265, 'fugitives should preserve regional records');
assert(sandbox.GM.hukou.registeredHouseholds === 8200, 'GM.hukou should mirror registered households');
assert(sandbox.GM.hukou.registeredMouths === 41000, 'GM.hukou should mirror registered mouths');

assert(sandbox.GM.population.byCategory.daohu, 'custom daohu category should be materialized');
assert(sandbox.GM.population.byCategory.tusi_custom, 'scenario-specific tusi category should be materialized');
assert(/灶户|盐场/.test(sandbox.GM.population.byCategory.daohu.name + sandbox.GM.population.byCategory.daohu.description), 'custom category should preserve description');
assert(sandbox.GM.population.byRegion.capital && sandbox.GM.population.byRegion.capital.mouths === 26000, 'capital region should be indexed from adminHierarchy');
assert(sandbox.GM.population.byRegion.tusi.regionType === 'tusi', 'region type should be preserved');
assert(sandbox.GM.population.byRegion.capital === sandbox.GM.adminHierarchy.player.divisions[0].populationDetail,
  'byRegion rows should be the authoritative leaf populationDetail objects');
assert(sandbox.GM.population.byLeafRegion === sandbox.GM.population.byRegion,
  'byLeafRegion and legacy byRegion should expose the same leaf-granularity table');

assert(sandbox.GM.corvee && sandbox.GM.corvee.ledger, 'corvee ledger should be exposed');
assert(sandbox.GM.corvee.ledger.summary.totalDemandDays > 0, 'corvee ledger should calculate demand days');
assert(sandbox.GM.corvee.ledger.byRegion.length === 3, 'corvee ledger should include regions');
assert(sandbox.GM.population.corvee.runtimeLedger === sandbox.GM.corvee.ledger, 'population corvee should point at runtime ledger');

assert(sandbox.GM.military.servicePool, 'military service pool should be exposed');
assert(sandbox.GM.military.servicePool.availableRecruits > 0, 'military service pool should calculate available recruits');
assert(sandbox.GM.population.military.servicePool === sandbox.GM.military.servicePool, 'population military should mirror service pool');
assert(sandbox.GM.military.servicePool.activeSoldiers === 9200, 'service pool should read active GM.armies strength');

const op = Bridge.recordPlayerOperation(sandbox.GM, {
  channel: 'edict',
  text: '诏令大造黄册，清查隐户；议一条鞭折银，并募兵三千守边。',
  linkedIssue: 'hukou-census'
}, { turn: 88, source: 'smoke-player-op' });
assert(op && op.ok, 'player operation should be recorded');
assert(op.operation.tags.indexOf('hukou') >= 0, 'operation should be tagged hukou');
assert(op.operation.tags.indexOf('corvee') >= 0, 'operation should be tagged corvee');
assert(op.operation.tags.indexOf('military') >= 0, 'operation should be tagged military');
assert(sandbox.GM._hujiRuntimeBridge.operations.length >= 1, 'operation ledger should be kept');
assert(sandbox.GM._socialPoliticalSignals.items.some(s => s.sourceSystem === 'huji-runtime-bridge'), 'bridge should write social/political signal');

sandbox.TM.PlayerActionSignals.record(sandbox.GM, {
  source: 'right-rail',
  kind: 'edict',
  text: '命户部招抚流民，编设保甲，核实军户逃亡。',
  topic: '户口整顿'
});
Bridge.maintain(sandbox.GM, { scenario, turn: 88, source: 'smoke-player-scan', includePlayerSignals: true });
assert(sandbox.GM._hujiRuntimeBridge.operations.some(x => x.text.indexOf('招抚流民') >= 0), 'bridge should scan player action signals');

const firstHardLinkPass = Bridge.maintain(sandbox.GM, { scenario, turn: 88, source: 'smoke-before-hard-links' });
sandbox.TM.MinxinHardLinks.tick(sandbox.GM, { turn: 88, source: 'smoke-hard-links' });
const hardLinkConsumerResult = sandbox.TM.MinxinHardLinkConsumers.consume(sandbox.GM, { turn: 88, source: 'smoke-hard-link-consumer' });
Bridge.maintainAfterHardLinks(sandbox.GM, firstHardLinkPass, hardLinkConsumerResult, { scenario, turn: 88, source: 'smoke-after-hard-links' });
assert(sandbox.GM.hukou.minxinConsumer, 'bridge should coexist with minxin hard-link consumer');
assert(sandbox.GM.population.national.effectiveTaxHouseholds === sandbox.GM.hukou.effectiveTaxHouseholds, 'effective tax households should stay synchronized');

sandbox.TM.perf.reset();
const skippedSecondPass = Bridge.maintainAfterHardLinks(sandbox.GM, firstHardLinkPass, {
  dirtyDomains: {
    populationChanged: false,
    hukouChanged: false,
    corveeChanged: false,
    militaryPoolChanged: false,
    fiscalHardEffectChanged: false,
    dirtyRegionIds: [],
    globalPopulationChanged: false
  }
}, { scenario, turn: 88, source: 'smoke-after-hard-links-no-dirty' });
assert(skippedSecondPass && skippedSecondPass.skipped, 'second maintain should be skipped when hard-link consumers report no huji dirty domain');
assert(sandbox.TM.perf.workReport().counters['huji.secondPassSkipped'] === 1, 'skip should increment the deterministic work counter');
assert(!sandbox.TM.perf.workReport().counters['huji.fullMaintainCount'], 'skip should not visit the full huji ledger');

sandbox.TM.perf.reset();
const dirtyFallback = Bridge.maintainAfterHardLinks(sandbox.GM, firstHardLinkPass, {
  dirtyDomains: {
    populationChanged: false,
    hukouChanged: true,
    corveeChanged: false,
    militaryPoolChanged: false,
    fiscalHardEffectChanged: false,
    dirtyRegionIds: ['capital'],
    globalPopulationChanged: false
  }
}, { scenario, turn: 88, source: 'smoke-after-hard-links-dirty' });
assert(dirtyFallback && dirtyFallback.ok && !dirtyFallback.skipped, 'dirty huji inputs should conservatively run the second maintain');
assert(dirtyFallback.incrementalFallbackReason === 'full-maintain-required-for-cross-ledger-invariants', 'single-region dirty state should record the explicit safe full-maintain fallback reason');
assert(sandbox.TM.perf.workReport().counters['huji.fullMaintainCount'] === 1, 'dirty fallback should execute one full second pass');
assert(sandbox.TM.perf.workReport().counters['huji.leafVisits'] === 3, 'dirty fallback should report exact leaf visits');

const prompt = Bridge.formatForPrompt(sandbox.GM, { limit: 8 });
assert(/Huji Runtime Bridge/.test(prompt), 'prompt should identify bridge');
assert(/hukouLedger/.test(prompt), 'prompt should include hukou ledger');
assert(/corveeLedger/.test(prompt), 'prompt should include corvee ledger');
assert(/militaryServicePool/.test(prompt), 'prompt should include military pool');
assert(/playerHujiOperations/.test(prompt), 'prompt should include player operations');

const snap = Bridge.snapshot(sandbox.GM, { limit: 5 });
assert(snap.hukou && snap.corvee && snap.military && snap.operations.length >= 2, 'snapshot should expose all bridge sections');

let exactSmallBreakdowns = true;
for (let total = 0; total <= 100; total++) {
  sandbox.GM.adminHierarchy.player.divisions.forEach((region, index) => {
    region.populationDetail.mouths = index === 0 ? total : 0;
    region.populationDetail.households = index === 0 ? total : 0;
    region.populationDetail.ding = index === 0 ? total : 0;
    region.populationDetail.hiddenCount = 0;
    region.populationDetail.hidden = 0;
    region.populationDetail.fugitives = 0;
    region.populationDetail.byAge = {};
    region.populationDetail.byGender = {};
    region.populationDetail.byLegalStatus = {};
  });
  sandbox.GM.population.hiddenCount = 0;
  sandbox.GM.population.fugitives = 0;
  sandbox.GM.population._leafPopulationAuxAuthoritative = true;
  Bridge.maintain(sandbox.GM, { scenario, turn: 90 + total, source:'smoke-exact-small', applyHardEffects:false });
  ['households', 'mouths', 'ding'].forEach(field => {
    const categorySum = Object.values(sandbox.GM.population.byCategory || {})
      .reduce((sum, row) => sum + Number(row && row[field] || 0), 0);
    const legalSum = Object.values(sandbox.GM.population.byLegalStatus || {})
      .reduce((sum, row) => sum + Number(row && row[field] || 0), 0);
    exactSmallBreakdowns = exactSmallBreakdowns && categorySum === total && legalSum === total;
  });
}
assert(exactSmallBreakdowns, 'category and legal-status allocations should conserve mouths households and ding for totals 0 through 100');

const src = name => fs.readFileSync(path.join(ROOT, name), 'utf8');
const index = src('index.html');

console.log('[smoke-huji-runtime-bridge] PASS hukou runtime bridge');
