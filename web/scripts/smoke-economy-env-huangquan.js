#!/usr/bin/env node
/* eslint-env node */

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const src = (fs.readFileSync(path.join(ROOT, 'tm-economy-engine-currency.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-economy-engine.js'), 'utf8'));
const hujiSource = fs.readFileSync(path.join(ROOT, 'tm-huji-engine.js'), 'utf8');

let assertions = 0;
function assert(cond, msg) {
  if (!cond) throw new Error('[smoke-economy-env-huangquan] ' + msg);
  assertions += 1;
}

const math = Object.create(Math);
math.random = () => 1;

function makeLeaf(id, name, mouths) {
  return {
    id,
    name,
    populationDetail: {
      mouths,
      households: Math.round(mouths / 5),
      ding: Math.round(mouths * 0.3),
      byAge: { child: Math.round(mouths * 0.2), adult: mouths - Math.round(mouths * 0.2) },
      byGender: { male: Math.floor(mouths / 2), female: mouths - Math.floor(mouths / 2) }
    }
  };
}

const countyA = makeLeaf('capital-east', '京东县', 600000);
const countyB = makeLeaf('capital-west', '京西县', 500000);

const authorityCalls = [];
const overloadSignals = [];
const ctx = {
  console,
  Date,
  JSON,
  Math: math,
  Object,
  Array,
  Number,
  String,
  Boolean,
  parseInt,
  parseFloat,
  isFinite,
  TM: {
    errors: { capture() {}, captureSilent() {} },
    MinxinLedger: {
      recordAndApply(root, raw, options) { overloadSignals.push({ raw, options }); return { applied: true }; },
      finalizeBatch() { return true; }
    }
  },
  GM: {
    sid: 'smoke',
    turn: 12,
    regions: [{ id: 'capital', unrest: 30, disasterLevel: 0 }],
    adminHierarchy: {
      player: {
        factionId: 'player-faction',
        divisions: [{ id: 'capital', name: '京畿省', children: [countyA, countyB] }]
      }
    },
    population: {
      byRegion: {
        'capital-east': countyA.populationDetail,
        'capital-west': countyB.populationDetail
      },
      national: { mouths: 1100000, households: 220000, ding: 330000 },
      dynamics: { yearlyLog: [] }
    },
    minxin: { trueIndex: 60 },
    huangquan: { index: 55 },
    environment: {
      _inited: true,
      techEra: 'ming',
      nationalLoad: 2.0,
      nationalCarrying: {},
      activePolicies: [],
      crisisHistory: [],
      byRegion: {
        capital: {
          carrying: {
            farmlandSupport: 425000,
            waterSupport: 1500000,
            fuelSupport: 750000,
            housingSupport: 1200000,
            sanitationSupport: 1000000
          },
          carryingMax: 425000,
          ecoScars: {
            deforestation: 0,
            soilErosion: 0,
            waterTableDrop: 0,
            riverSilting: 0,
            soilFertilityLoss: 0,
            salinization: 0,
            desertification: 0,
            biodiversityLoss: 0,
            urbanSewageOverload: 0
          },
          currentLoad: 2.0,
          overloadYears: 0,
          forestArea: 500000,
          coalReserve: 0,
          aquiferLevel: 1.0,
          riverFlow: 1.0,
          arableArea: 500000,
          soilFertility: 0.85,
          techLevel: {}
        }
      }
    }
  },
  P: { id: 'smoke', conf: {}, time: { daysPerTurn: 30 }, playerInfo: { factionName: 'player-faction' } },
  IntegrationBridge: {
    getTopLevelDivisions(hierarchy) { return hierarchy.player.divisions; }
  },
  _adjAuthority(key, delta, reason, meta) {
    authorityCalls.push({ key, delta, reason, meta });
    if (key === 'minxin') ctx.GM.minxin.trueIndex += delta;
    if (key === 'huangquan') ctx.GM.huangquan.index += delta;
    return { ok: true };
  },
  addEB() {},
  turnsForMonths(months) { return months; },
  findScenarioById() { return null; }
};
ctx.window = ctx;
ctx.global = ctx;
ctx.globalThis = ctx;

function runOverloadTierCase(load, soil) {
  soil = soil || {};
  const mouths = Math.round(load * 100000);
  const leaf = makeLeaf('tier-county', '分级县', mouths);
  const calls = [];
  const minxinSignals = [];
  let minxinFinalized = 0;
  const tierMath = Object.create(Math);
  tierMath.random = () => 1;
  const tierCtx = {
    console,
    Date,
    JSON,
    Math: tierMath,
    Object,
    Array,
    Number,
    String,
    Boolean,
    parseInt,
    parseFloat,
    isFinite,
    TM: {
      errors: { capture() {}, captureSilent() {} },
      MinxinLedger: {
        recordAndApply(root, raw, options) { minxinSignals.push({ raw, options }); return { applied: true }; },
        finalizeBatch() { minxinFinalized += 1; return true; }
      }
    },
    GM: {
      sid: 'overload-tier-' + String(load),
      turn: 12,
      regions: [{ id: 'tier-province', unrest: 30, disasterLevel: 0 }],
      adminHierarchy: {
        player: {
          factionId: 'player-faction',
          divisions: [{ id: 'tier-province', name: '分级省', children: [leaf] }]
        }
      },
      population: {
        byRegion: { 'tier-county': leaf.populationDetail },
        national: {
          mouths,
          households: leaf.populationDetail.households,
          ding: leaf.populationDetail.ding
        },
        dynamics: { yearlyLog: [] }
      },
      minxin: { trueIndex: 60 },
      environment: {
        _inited: true,
        techEra: '汉',
        nationalLoad: load,
        nationalCarrying: {},
        activePolicies: [],
        crisisHistory: [],
        byRegion: {
          'tier-province': {
            carrying: {},
            carryingMax: 100000,
            ecoScars: {
              deforestation: 0,
              soilErosion: 0,
              waterTableDrop: 0,
              riverSilting: 0,
              soilFertilityLoss: soil.loss != null ? soil.loss : 0,
              salinization: 0,
              desertification: 0,
              biodiversityLoss: 0,
              urbanSewageOverload: 0
            },
            currentLoad: load,
            forestArea: 100000,
            coalReserve: 0,
            aquiferLevel: 1,
            riverFlow: 1,
            arableArea: 100000,
            soilFertility: soil.fertility != null ? soil.fertility : 1,
            techLevel: {}
          }
        }
      }
    },
    P: {
      id: 'overload-tier-' + String(load),
      conf: {},
      time: { daysPerTurn: 30 },
      playerInfo: { factionName: 'player-faction' }
    },
    IntegrationBridge: {
      getTopLevelDivisions(hierarchy) { return hierarchy.player.divisions; }
    },
    _adjAuthority(key, delta) {
      calls.push({ key, delta });
      return { ok: true };
    },
    addEB() {},
    turnsForMonths(months) { return months; },
    findScenarioById() { return null; }
  };
  tierCtx.window = tierCtx;
  tierCtx.global = tierCtx;
  tierCtx.globalThis = tierCtx;
  vm.createContext(tierCtx);
  vm.runInContext(src, tierCtx, { filename: 'tm-economy-engine.js' });
  vm.runInContext(hujiSource, tierCtx, { filename: 'tm-huji-engine.js' });
  tierCtx.EnvCapacityEngine.tick({ monthRatio: 1, turn: tierCtx.GM.turn, strict: true });
  const region = tierCtx.GM.regions[0];
  return {
    unrest: region.unrest - 30,
    disaster: region.disasterLevel,
    // 过载只伤本省：每州吃到的民心增减记在民心账本那一笔的 targetRegions 上
    minxin: minxinSignals.reduce((sum, signal) => sum + Number(((signal.raw.targetRegions || [])[0] || {}).deltaTrue || 0), 0),
    targets: minxinSignals.map(signal => (signal.raw.targetRegions || []).map(row => row.region).join(',')).join('|'),
    national: calls.filter(call => call.key === 'minxin' && call.delta < 0)
      .reduce((sum, call) => sum + call.delta, 0),
    finalized: minxinFinalized,
    fertility: tierCtx.GM.environment.byRegion['tier-province'].soilFertility,
    fertilityLoss: tierCtx.GM.environment.byRegion['tier-province'].ecoScars.soilFertilityLoss
  };
}

// 省环境对象照官方剧本开局的样子：整合桥按剧本建，只有 carrying/ecoScars/currentLoad/arableLand/waterCapacity/carryingRegime，
// 没有本引擎自己的耕地面积等实数；承载上限在各州 carryingCapacity.historicalCap 上。
// 旧写法拿写死的常数当上限，四百万口的省被算成只养得活七十五万，负荷五倍多、按全国扣民心。
// provinceLoad：剧本给省的负荷（carryingCapacity.currentLoad）。给了就照它开局（同志 11-08 定）；不给则上限是各州之和。
function runCalibratedProvinceCase(provinceLoad) {
  const capped = makeLeaf('cal-capped', '有上限州', 3000000);
  capped.carryingCapacity = { arable: 4000000, water: 4000000, climate: 1, historicalCap: 4000000, currentLoad: 0.75, carryingRegime: 'strained' };
  const uncapped = makeLeaf('cal-uncapped', '无上限州', 1000000);
  const signals = [];
  const calMath = Object.create(Math);
  calMath.random = () => 1;
  const calCtx = {
    console, Date, JSON, Math: calMath, Object, Array, Number, String, Boolean, parseInt, parseFloat, isFinite,
    TM: {
      errors: { capture() {}, captureSilent() {} },
      MinxinLedger: {
        recordAndApply(root, raw, options) { signals.push({ raw, options }); return { applied: true }; },
        finalizeBatch() { return true; }
      }
    },
    GM: {
      sid: 'calibrated-province',
      turn: 3,
      regions: [],
      adminHierarchy: {
        player: {
          factionId: 'player-faction',
          divisions: [{
            id: 'cal-province', name: '标定路', children: [capped, uncapped],
            carryingCapacity: Object.assign({ arable: 4000000, water: 4000000, climate: 1, historicalCap: 4000000, carryingRegime: 'strained' },
              provinceLoad != null ? { currentLoad: provinceLoad } : {})
          }]
        }
      },
      population: {
        byRegion: { 'cal-capped': capped.populationDetail, 'cal-uncapped': uncapped.populationDetail },
        national: { mouths: 4000000, households: 800000, ding: 1200000 },
        dynamics: { yearlyLog: [] }
      },
      minxin: { trueIndex: 60 },
      environment: {
        _inited: true,
        techEra: '宋',
        techEraRule: 2,
        nationalLoad: 0.5,
        nationalCarrying: {},
        activePolicies: [],
        crisisHistory: [],
        byRegion: {
          'cal-province': {
            carrying: { farmland: 1, water: 1, fuel: 1, housing: 1, sanitation: 1 },
            ecoScars: {},
            currentLoad: 0.75,
            arableLand: 4000000,
            waterCapacity: 4000000,
            carryingRegime: 'strained'
          }
        }
      }
    },
    P: { id: 'calibrated-province', conf: {}, time: { daysPerTurn: 30 }, playerInfo: { factionName: 'player-faction' } },
    IntegrationBridge: { getTopLevelDivisions(hierarchy) { return hierarchy.player.divisions; } },
    _adjAuthority() { return { ok: true }; },
    addEB() {},
    turnsForMonths(months) { return months; },
    findScenarioById() { return null; }
  };
  calCtx.window = calCtx;
  calCtx.global = calCtx;
  calCtx.globalThis = calCtx;
  vm.createContext(calCtx);
  vm.runInContext(src, calCtx, { filename: 'tm-economy-engine.js' });
  vm.runInContext(hujiSource, calCtx, { filename: 'tm-huji-engine.js' });
  const region = calCtx.GM.environment.byRegion['cal-province'];
  calCtx.EnvCapacityEngine.tick({ monthRatio: 1, turn: calCtx.GM.turn, strict: true });
  const anchoredCap = Math.round(1000000 / 0.8);
  assert(region.carryingCalibration && region.carryingCalibration.rule === 'calibrated',
    'a province without the engine own farmland figures must calibrate on the scenario caps, not on fixed constants');
  assert(region.carryingCalibration.anchors['cal-uncapped'] === anchoredCap,
    'a leaf without a scenario cap should be anchored once at its population as roughly fed (load 0.8)');
  const expectedCap = provinceLoad != null ? 4000000 / provinceLoad : 4000000 + anchoredCap;
  assert(Math.abs(region.carryingMax - expectedCap) < 1e-6,
    provinceLoad != null
      ? 'a province the scenario gives its own load should open exactly at that load (cap = opening people / load): ' + region.carryingMax
      : 'province carrying should equal the sum of its leaf caps on the first calibration: ' + region.carryingMax);
  assert(Math.abs(region.currentLoad - (provinceLoad != null ? provinceLoad : 4000000 / expectedCap)) < 1e-9 && region.currentLoad < 1,
    'a province the scenario calls strained must not be computed as several times overloaded: ' + region.currentLoad);
  assert(region.overloadYears === 0, 'overload years should be a real number on a scenario-built province object');
  assert(signals.length === 0, 'a province under its calibrated cap should not touch minxin');
  assert(capped.populationDetail.mouths === 3000000 && uncapped.populationDetail.mouths === 1000000,
    'a province under its calibrated cap should suffer no overload deaths');

  capped.populationDetail.mouths = 9000000;
  capped.populationDetail.households = 1800000;
  capped.populationDetail.ding = 2700000;
  capped.populationDetail.byAge = { child: 1800000, adult: 7200000 };
  capped.populationDetail.byGender = { male: 4500000, female: 4500000 };
  calCtx.GM.population.national = { mouths: 10000000, households: 2000000, ding: 3000000 };
  calCtx.EnvCapacityEngine.tick({ monthRatio: 1, turn: calCtx.GM.turn + 1, strict: true });
  assert(region.carryingCalibration.anchors['cal-uncapped'] === anchoredCap,
    'the anchored cap stays fixed instead of following later population');
  assert(region.currentLoad > 1.5, 'tripling a leaf past its cap should overload the province');
  const overload = signals.filter(signal => signal.raw.sourceSystem === 'environment-overload');
  assert(overload.length === 1
    && overload[0].raw.targetRegions.map(row => row.region).sort().join(',') === 'cal-capped,cal-uncapped'
    && overload[0].raw.targetRegions.every(row => row.deltaTrue === -0.5),
  'collapse-tier overload should debit minxin in each leaf of the province only');
}

// 开局第一回合还没过，省环境对象还是整合桥按剧本建的样子（没有各项支撑数）时推环政：旧写法迁民规划直接报「承载力无效」。
function runScenarioShapedPolicyCase() {
  const north = makeLeaf('shape-north-county', '北州', 600000);
  north.carryingCapacity = { historicalCap: 1000000, currentLoad: 0.6 };
  const south = makeLeaf('shape-south-county', '南州', 400000);
  south.carryingCapacity = { historicalCap: 800000, currentLoad: 0.5 };
  const bridgeShaped = () => ({ carrying: { farmland: 1, water: 1, fuel: 1, housing: 1, sanitation: 1 }, ecoScars: {}, currentLoad: 0.6, arableLand: 0, waterCapacity: 0, carryingRegime: 'sustainable' });
  const policyCtx = {
    console, Date, JSON, Math, Object, Array, Number, String, Boolean, parseInt, parseFloat, isFinite,
    TM: { errors: { capture() {}, captureSilent() {} } },
    GM: {
      sid: 'scenario-shaped-policy',
      turn: 1,
      regions: [],
      guoku: { money: 1000000, grain: 500000, cloth: 0 },
      adminHierarchy: {
        player: {
          factionId: 'player-faction',
          divisions: [
            { id: 'shape-north', name: '北路', children: [north] },
            { id: 'shape-south', name: '南路', children: [south] }
          ]
        }
      },
      population: {
        byRegion: { 'shape-north-county': north.populationDetail, 'shape-south-county': south.populationDetail },
        national: { mouths: 1000000, households: 200000, ding: 300000 },
        dynamics: { yearlyLog: [] }
      },
      minxin: { trueIndex: 60 },
      environment: {
        _inited: true, techEra: '明', techEraRule: 2, nationalLoad: 0.5, nationalCarrying: {}, activePolicies: [], crisisHistory: [],
        byRegion: { 'shape-north': bridgeShaped(), 'shape-south': bridgeShaped() }
      }
    },
    P: { id: 'scenario-shaped-policy', conf: {}, time: { daysPerTurn: 30 }, playerInfo: { factionName: 'player-faction' } },
    IntegrationBridge: { getTopLevelDivisions(hierarchy) { return hierarchy.player.divisions; } },
    FiscalEngine: {
      spendFromGuoku(cost) {
        const deducted = {};
        ['money', 'grain', 'cloth'].forEach(kind => {
          const amount = Number(cost[kind]) || 0;
          policyCtx.GM.guoku[kind] -= amount;
          deducted[kind] = { deducted: amount, deficit: 0 };
        });
        return { ok: true, deducted };
      }
    },
    _adjAuthority() { return { ok: true }; },
    addEB() {},
    turnsForMonths(months) { return months; },
    findScenarioById() { return null; }
  };
  policyCtx.window = policyCtx;
  policyCtx.global = policyCtx;
  policyCtx.globalThis = policyCtx;
  vm.createContext(policyCtx);
  vm.runInContext(src, policyCtx, { filename: 'tm-economy-engine.js' });
  vm.runInContext(hujiSource, policyCtx, { filename: 'tm-huji-engine.js' });
  const result = policyCtx.EnvCapacityEngine.enactPolicy('migration_relief', 'all');
  assert(result && result.ok, 'an environment policy enacted before the first turn ends must not fail on scenario-built provinces: ' + (result && result.reason));
  const north2 = policyCtx.GM.environment.byRegion['shape-north'];
  assert(north2.carryingCalibration && north2.carryingCalibration.rule === 'calibrated'
    && isFinite(north2.carrying.farmlandSupport) && Math.abs(north2.carryingMax - 1000000) < 1e-6,
  'the policy should first calibrate a scenario-built province on its leaf caps');
}

function runTechEraCase() {
  const eraCtx = {
    console, Date, JSON, Math, Object, Array, Number, String, Boolean, parseInt, parseFloat, isFinite,
    TM: { errors: { capture() {}, captureSilent() {} } },
    GM: { sid: 'era', turn: 1, regions: [] },
    addEB() {}
  };
  eraCtx.window = eraCtx;
  eraCtx.global = eraCtx;
  eraCtx.globalThis = eraCtx;
  vm.createContext(eraCtx);
  vm.runInContext(src, eraCtx, { filename: 'tm-economy-engine.js' });
  eraCtx.EnvCapacityEngine.init({ name: '绍宋·建炎元年八月——亳州明道宫，九龙井醒', dynasty: '宋', era: '南宋·建炎初' });
  assert(eraCtx.GM.environment.techEra === '宋', 'a Song scenario whose name mentions 明道宫 must not be read as Ming');
  eraCtx.GM.environment = null;
  eraCtx.EnvCapacityEngine.init({ name: '天启七年·九月——君王初立，权阉当国', dynasty: '明', era: '明末·天启朝尾' });
  assert(eraCtx.GM.environment.techEra === '明', 'a Ming scenario without a dynasty word in its name must not fall back to Tang');
  eraCtx.GM.environment.techEra = '唐';
  delete eraCtx.GM.environment.techEraRule;
  eraCtx.EnvCapacityEngine.init({ name: '天启七年·九月——君王初立，权阉当国', dynasty: '明' });
  assert(eraCtx.GM.environment.techEra === '明' && eraCtx.GM.environment.techEraRule === 2,
    'an old save with an era guessed from the scenario name should be re-read once by the dynasty field');
}

function runZeroResourceCase() {
  const leaf = makeLeaf('barren-county', '荒县', 10000);
  const zeroMath = Object.create(Math);
  zeroMath.random = () => 1;
  const zeroCtx = {
    console,
    Date,
    JSON,
    Math: zeroMath,
    Object,
    Array,
    Number,
    String,
    Boolean,
    parseInt,
    parseFloat,
    isFinite,
    TM: { errors: { capture() {}, captureSilent() {} } },
    GM: {
      sid: 'zero-environment-resources',
      turn: 12,
      regions: [{ id: 'barren', unrest: 0, disasterLevel: 0 }],
      guoku: { money: 1000000, grain: 500000, cloth: 0 },
      adminHierarchy: {
        player: {
          factionId: 'player-faction',
          divisions: [{ id: 'barren', name: '荒芜省', children: [leaf] }]
        }
      },
      population: {
        byRegion: { 'barren-county': leaf.populationDetail },
        national: { mouths: 10000, households: 2000, ding: 3000 },
        dynamics: { yearlyLog: [] }
      },
      minxin: { trueIndex: 60 }
    },
    P: {
      id: 'zero-environment-resources',
      dynasty: '汉',
      conf: {},
      time: { daysPerTurn: 30 },
      playerInfo: { factionName: 'player-faction' },
      environmentConfig: {
        initialCarrying: {
          byRegion: {
            barren: {
              farmlandSupport: 0,
              waterSupport: 0,
              fuelSupport: 0,
              housingSupport: 0,
              sanitationSupport: 0,
              forestArea: 0,
              coalReserve: 0,
              aquiferLevel: 0,
              riverFlow: 0,
              arableArea: 0,
              soilFertility: 0
            }
          }
        }
      }
    },
    IntegrationBridge: {
      getTopLevelDivisions(hierarchy) { return hierarchy.player.divisions; }
    },
    FiscalEngine: {
      spendFromGuoku(cost) {
        const deducted = {};
        ['money', 'grain', 'cloth'].forEach(kind => {
          const amount = Number(cost[kind]) || 0;
          zeroCtx.GM.guoku[kind] -= amount;
          deducted[kind] = { deducted: amount, deficit: 0 };
        });
        return { ok: true, deducted };
      }
    },
    _adjAuthority() { return { ok: true }; },
    addEB() {},
    turnsForMonths(months) { return months; },
    findScenarioById() { return zeroCtx.P; }
  };
  zeroCtx.window = zeroCtx;
  zeroCtx.global = zeroCtx;
  zeroCtx.globalThis = zeroCtx;
  vm.createContext(zeroCtx);
  vm.runInContext(src, zeroCtx, { filename: 'tm-economy-engine.js' });
  zeroCtx.EnvCapacityEngine.init(zeroCtx.P);
  const row = zeroCtx.GM.environment.byRegion.barren;
  ['forestArea', 'coalReserve', 'aquiferLevel', 'riverFlow', 'arableArea', 'soilFertility'].forEach(field => {
    assert(row[field] === 0, 'explicit zero ' + field + ' should survive environment initialization');
  });
  zeroCtx.EnvCapacityEngine.tick({ monthRatio: 1, turn: zeroCtx.GM.turn, strict: true });
  assert(row.forestArea === 0 && row.aquiferLevel === 0 && row.riverFlow === 0
    && row.arableArea === 0 && row.soilFertility === 0,
  'environment recomputation and passive decay must not revive zero natural resources');
  const technology = zeroCtx.EnvCapacityEngine.enactPolicy('tech_investment', 'barren');
  assert(technology && technology.ok && row.arableArea === 0 && row.forestArea === 0,
    'percentage technology boosts must not conjure arable land or forest from zero');
  const recovery = zeroCtx.EnvCapacityEngine.enactPolicy('disaster_recovery', 'barren');
  assert(recovery && recovery.ok && row.arableArea === 0 && Math.abs(row.soilFertility - 0.05) < 1e-12,
    'disaster recovery should add only its explicit fertility boost to a zero-resource region');
}

vm.createContext(ctx);
vm.runInContext(src, ctx, { filename: 'tm-economy-engine.js' });
vm.runInContext(hujiSource, ctx, { filename: 'tm-huji-engine.js' });

const lightOverload = runOverloadTierCase(1.10);
const mediumOverload = runOverloadTierCase(1.30);
const severeOverload = runOverloadTierCase(1.60);
assert(lightOverload.unrest === 0 && lightOverload.disaster === 0 && lightOverload.minxin === 0 && lightOverload.targets === '',
  'level-one overload should not fall through to level-three collapse effects');
assert(mediumOverload.unrest === 3 && mediumOverload.disaster === 0 && mediumOverload.minxin === -0.2,
  'level-two overload should apply only the famine-tier social effects');
assert(severeOverload.unrest === 8 && severeOverload.disaster === 0.05 && severeOverload.minxin === -0.5,
  'level-three overload should apply the strongest collapse effects');
assert(mediumOverload.targets === 'tier-county' && severeOverload.targets === 'tier-county'
  && mediumOverload.finalized === 1 && severeOverload.finalized === 1,
  'overload minxin should be one ledger record per province aimed at exactly its own leaves, finalized as one batch');
assert([lightOverload, mediumOverload, severeOverload].every(row => row.national === 0),
  'overload minxin must never be deducted nationally through the legacy _adjAuthority path');
assert(lightOverload.unrest < mediumOverload.unrest && mediumOverload.unrest < severeOverload.unrest,
  'overload social penalties should increase monotonically across all three tiers');
// 地力（同志 11-08 定）：过载才衰退，负荷不到九成慢慢恢复到原有地力，其间不动。汉代按技术每年衰退 0.04、每月 1/12。
// 旧写法不论负荷每年无条件降，几十年后各地都闹饥荒危机。
const monthDecay = 0.04 / 12;
const calmSoil = runOverloadTierCase(0.70);
assert(calmSoil.fertility === 1 && calmSoil.fertilityLoss === 0,
  'soil should not decline when the province is not overloaded: ' + calmSoil.fertility + ' / ' + calmSoil.fertilityLoss);
const nearSoil = runOverloadTierCase(0.95, { fertility: 0.9, loss: 0.1 });
assert(nearSoil.fertility === 0.9 && nearSoil.fertilityLoss === 0.1,
  'between 0.9 and 1.0 load the soil should hold still: ' + nearSoil.fertility + ' / ' + nearSoil.fertilityLoss);
assert(Math.abs(mediumOverload.fertility - (1 - monthDecay)) < 1e-9 && Math.abs(mediumOverload.fertilityLoss - monthDecay) < 1e-9,
  'an overloaded province should lose one month of era fertility decay: ' + mediumOverload.fertility + ' / ' + mediumOverload.fertilityLoss);
const restSoil = runOverloadTierCase(0.50, { fertility: 0.8, loss: 0.2 });
assert(Math.abs(restSoil.fertility - (0.8 + monthDecay / 2)) < 1e-9 && Math.abs(restSoil.fertilityLoss - (0.2 - monthDecay / 2)) < 1e-9,
  'a lightly loaded province should recover at half the decay rate: ' + restSoil.fertility + ' / ' + restSoil.fertilityLoss);
const fullSoil = runOverloadTierCase(0.50, { fertility: 1, loss: 0 });
assert(fullSoil.fertility === 1 && fullSoil.fertilityLoss === 0, 'recovery should stop at the original fertility, never above it');
runCalibratedProvinceCase(0.75);   // 剧本给了省负荷：照它开局（天启陕西 1.32 那类）
runCalibratedProvinceCase(null);   // 剧本没给：上限是各州之和
runScenarioShapedPolicyCase();
runTechEraCase();
runZeroResourceCase();

const beforeHuangquan = ctx.GM.huangquan.index;
const beforePopulation = countyA.populationDetail.mouths + countyB.populationDetail.mouths;
ctx.EnvCapacityEngine.tick({ monthRatio: 1, turn: ctx.GM.turn, strict: true });
const afterPopulation = countyA.populationDetail.mouths + countyB.populationDetail.mouths;

assert(ctx.GM.environment.nationalLoad > 1.2, 'fixture should remain overloaded after recompute');
assert(Math.abs(ctx.GM.environment.byRegion.capital.currentLoad
  - beforePopulation / ctx.GM.environment.byRegion.capital.carryingMax) < 1e-9,
'province carrying load should use the real sum of child-leaf population');
assert(ctx.GM.environment.byRegion.capital.carrying.housingSupport === beforePopulation * 1.1,
  'province housing support should never fall back to a fictitious fixed population');
assert(afterPopulation < beforePopulation, 'province overload should debit authoritative child leaves');
assert(ctx.GM.population.mortalityLedger.some(row => /^environment-overload:/.test(row.cause)),
'environment overload should be recorded by the Huji mortality ledger');
[countyA, countyB].forEach(leaf => {
  const detail = leaf.populationDetail;
  const ageTotal = Object.values(detail.byAge || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const genderTotal = Object.values(detail.byGender || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  assert(ageTotal === detail.mouths && genderTotal === detail.mouths,
    'overload mortality should keep each leaf demographic bundle exact');
});
assert(overloadSignals.some(signal => signal.raw.sourceSystem === 'environment-overload'
  && (signal.raw.targetRegions || []).map(row => row.region).sort().join(',') === 'capital-east,capital-west'),
'overload should still affect minxin, but only in the overloaded province leaves');
assert(!authorityCalls.some(call => call.key === 'minxin' && call.delta < 0),
  'overload must not deduct national minxin through the legacy _adjAuthority path');
assert(!authorityCalls.some(call => call.key === 'huangquan'), 'environment capacity must not adjust huangquan');
assert(ctx.GM.huangquan.index === beforeHuangquan, 'huangquan index should remain unchanged by environment capacity');

const realLoss = ctx.HujiEngine.applyPopulationLoss;
let injectedCalls = 0;
ctx.HujiEngine.applyPopulationLoss = options => {
  injectedCalls += 1;
  if (injectedCalls === 2) throw new Error('environment-second-leaf-failure');
  return { ok: true, mouths: options.mouths };
};
let strictFailure = null;
try {
  ctx.EnvCapacityEngine.tick({ monthRatio: 1, turn: ctx.GM.turn, strict: true });
} catch (error) {
  strictFailure = error;
}
ctx.HujiEngine.applyPopulationLoss = realLoss;
assert(strictFailure && /environment-second-leaf-failure/.test(strictFailure.message) && injectedCalls === 2,
  'strict environment tick should propagate an internal partial-leaf failure');

function resetLeafPopulation(leaf, mouths) {
  const detail = leaf.populationDetail;
  detail.mouths = mouths;
  detail.households = Math.round(mouths / 5);
  detail.ding = Math.round(mouths * 0.3);
  detail.byAge = { child: Math.round(mouths * 0.2), adult: mouths - Math.round(mouths * 0.2) };
  detail.byGender = { male: Math.floor(mouths / 2), female: mouths - Math.floor(mouths / 2) };
}
resetLeafPopulation(countyA, 50000);
resetLeafPopulation(countyB, 50000);
ctx.GM.population.national = { mouths: 100000, households: 20000, ding: 30000 };
ctx.GM.environment.byRegion.capital.ecoScars.riverSilting = 0.6;
ctx.GM.environment.byRegion.capital._crisis_huaihe_flood = 0;
let crisisRolls = 0;
math.random = () => crisisRolls++ === 0 ? 0 : 1;
const crisisPopulationBefore = countyA.populationDetail.mouths + countyB.populationDetail.mouths;
const successfulHistoryBefore = ctx.GM.environment.crisisHistory.length;
ctx.EnvCapacityEngine.tick({ monthRatio: 1, turn: ctx.GM.turn, strict: true });
assert(countyA.populationDetail.mouths + countyB.populationDetail.mouths === crisisPopulationBefore - 8000
  && ctx.GM.environment.crisisHistory.length === successfulHistoryBefore + 1
  && ctx.GM.environment.crisisHistory[ctx.GM.environment.crisisHistory.length - 1].id === 'huaihe_flood',
'province crisis should debit child leaves before committing one matching history record');

countyA.populationDetail.mouths = 500;
countyB.populationDetail.mouths = 500;
ctx.GM.environment.byRegion.capital.ecoScars.riverSilting = 0.6;
ctx.GM.environment.byRegion.capital._crisis_huaihe_flood = 0;
const crisisHistoryBefore = ctx.GM.environment.crisisHistory.length;
crisisRolls = 0;
math.random = () => crisisRolls++ === 0 ? 0 : 1;
ctx.HujiEngine.applyPopulationLoss = () => ({ ok: false, reason: 'injected-crisis-ledger-failure', mouths: 0 });
let crisisFailure = null;
try {
  ctx.EnvCapacityEngine.tick({ monthRatio: 1, turn: ctx.GM.turn, strict: true });
} catch (error) {
  crisisFailure = error;
}
ctx.HujiEngine.applyPopulationLoss = realLoss;
assert(crisisFailure && /injected-crisis-ledger-failure/.test(crisisFailure.message)
  && ctx.GM.environment.crisisHistory.length === crisisHistoryBefore
  && !ctx.GM.environment.byRegion.capital._crisis_huaihe_flood,
'failed crisis mortality should propagate before crisis history or cooldown markers are committed');

const hierarchy = ctx.GM.adminHierarchy;
delete ctx.GM.adminHierarchy;
const scarBeforeUnresolvedMapping = ctx.GM.environment.byRegion.capital.ecoScars.deforestation;
let mappingFailure = null;
try {
  ctx.EnvCapacityEngine.tick({ monthRatio: 1, turn: ctx.GM.turn, strict: true });
} catch (error) {
  mappingFailure = error;
}
ctx.GM.adminHierarchy = hierarchy;
assert(mappingFailure && /无法解析人口层级/.test(mappingFailure.message)
  && ctx.GM.environment.byRegion.capital.ecoScars.deforestation === scarBeforeUnresolvedMapping,
'strict environment tick should fail before mutation when a province cannot resolve authoritative leaves');

console.log('[smoke-economy-env-huangquan] pass assertions=' + assertions);
