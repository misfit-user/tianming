#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const hujiSource = fs.readFileSync(path.join(ROOT, 'tm-huji-engine.js'), 'utf8');
const deepSource = fs.readFileSync(path.join(ROOT, 'tm-huji-deep-fill.js'), 'utf8');
const runtimeBridgeSource = fs.readFileSync(path.join(ROOT, 'tm-huji-runtime-bridge.js'), 'utf8');
const integrationBridgeSource = fs.readFileSync(path.join(ROOT, 'tm-integration-bridge.js'), 'utf8');
const historicalSource = fs.readFileSync(path.join(ROOT, 'tm-historical-presets.js'), 'utf8');

let pass = 0;
let fail = 0;
function ok(condition, message) {
  if (condition) { pass++; console.log('  PASS - ' + message); }
  else { fail++; console.error('  FAIL - ' + message); }
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function makeLeaf(id, name, mouths, capital) {
  return {
    id, name, regionType: capital ? 'capital' : 'prefecture', minxin: 50, prosperity: 50,
    population: { mouths, households: Math.round(mouths / 5), ding: Math.round(mouths * 0.3) },
    populationDetail: { mouths, households: Math.round(mouths / 5), ding: Math.round(mouths * 0.3) },
    environment: { carrying: mouths * 2, currentLoad: 0.5 }
  };
}
function totals(leaves) {
  return leaves.reduce((out, leaf) => {
    out.mouths += leaf.populationDetail.mouths;
    out.households += leaf.populationDetail.households;
    out.ding += leaf.populationDetail.ding;
    return out;
  }, { mouths: 0, households: 0, ding: 0 });
}
function sumBuckets(buckets) {
  return Object.values(buckets || {}).reduce((sum, value) => sum + Number(value || 0), 0);
}
function demographicTotals(leaves) {
  return leaves.reduce((out, leaf) => {
    const detail = leaf.populationDetail || {};
    out.mouths += Number(detail.mouths || 0);
    out.households += Number(detail.households || 0);
    out.ding += Number(detail.ding || 0);
    Object.keys(detail.byAge || {}).forEach(key => { out.byAge[key] = (out.byAge[key] || 0) + Number(detail.byAge[key] || 0); });
    Object.keys(detail.byGender || {}).forEach(key => { out.byGender[key] = (out.byGender[key] || 0) + Number(detail.byGender[key] || 0); });
    return out;
  }, { mouths:0, households:0,ding:0, byAge:{}, byGender:{} });
}

function makeRuntime(options = {}) {
  const math = Object.create(Math);
  math.random = options.random || (() => 0.9);
  const playerLeaves = [makeLeaf('player-capital', '京城', 600000, true), makeLeaf('player-south', '江南', 400000, false)];
  const npcLeaves = [makeLeaf('npc-capital', '沈阳', 3000000, true), makeLeaf('npc-north', '辽北', 2000000, false)];
  const context = {
    console, Math: math, Date, JSON, RegExp, Error,
    Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, isFinite,
    setTimeout() { return 1; }, clearTimeout() {}, addEB() {}, toast() {},
    P: {
      id: 'faction-ledger', dynasty: '明', time: { year: options.year || 1627 },
      conf: { populationBottomUpEnabled: false },
      populationConfig: {
        initial: { nationalHouseholds: 200000, nationalMouths: 1000000, nationalDing: 300000 },
        corveeRules: { annualCorveeDays: 30 }
      },
      playerInfo: { factionName: '玩家朝廷', capital: '京城' }
    },
    GM: {
      sid: 'faction-ledger', turn: options.turn || 1, year: options.year || 1627,
      _campaignId: options.campaignId || 'campaign-a', _capital: '京城',
      vars: { disasterLevel: 0 }, activeWars: [], chars: [],
      guoku: { money: 100000000, grain: 100000000 },
      minxin: { trueIndex: 50 }, huangquan: { index: 50 }, corruption: { trueIndex: 20 },
      environment: { nationalLoad: 0.5, byRegion: {}, climatePhase: options.climate || 'normal' },
      facs: [
        { id: 'fac-player', name: '玩家朝廷', isPlayer: true, capital: '京城' },
        { id: 'fac-npc', name: '后金', capital: '沈阳' }
      ],
      adminHierarchy: {
        player: { factionId: 'fac-player', factionName: '玩家朝廷', divisions: playerLeaves },
        npc: { factionId: 'fac-npc', factionName: '后金', divisions: npcLeaves }
      }
    },
    turnsForMonths(months) {
      const days = options.daysPerTurn || 30;
      return Math.ceil(months * 30 / days);
    },
    _getDaysPerTurn() { return options.daysPerTurn || 30; },
    calcDateFromTurn(turn) {
      if (typeof options.dateForTurn === 'function') return options.dateForTurn(turn);
      return { adYear: context.GM.year, year: context.GM.year };
    },
    FiscalEngine: { spendFromGuoku() { return true; }, addToGuoku() { return true; } },
    TM: { errors: { capture() {}, captureSilent() {} } }
  };
  context.window = context;
  context.global = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(hujiSource, context, { filename: 'tm-huji-engine.js' });
  vm.runInContext(deepSource, context, { filename: 'tm-huji-deep-fill.js' });
  vm.runInContext(runtimeBridgeSource, context, { filename: 'tm-huji-runtime-bridge.js' });
  vm.runInContext(integrationBridgeSource, context, { filename: 'tm-integration-bridge.js' });
  vm.runInContext(historicalSource, context, { filename: 'tm-historical-presets.js' });
  context.HujiEngine.init(context.P);
  context.GM.population.corvee.enabled = false;
  context.GM.population.military.enabled = false;
  context.GM.population.meta.registrationCycle = 1000;
  context.HujiDeepFill.init();
  context.HistoricalPresets.init();
  return { context, playerLeaves, npcLeaves };
}

console.log('[smoke-population-faction-ledger]');

{
  const { context, playerLeaves, npcLeaves } = makeRuntime();
  const playerBefore = totals(playerLeaves).mouths;
  const npcBefore = totals(npcLeaves).mouths;
  const expectedPlayerBirths = playerLeaves.reduce((sum, leaf) => sum + Math.round(leaf.populationDetail.mouths * 0.035 / 12), 0);
  const expectedNpcBirths = npcLeaves.reduce((sum, leaf) => sum + Math.round(leaf.populationDetail.mouths * 0.035 / 12), 0);
  const npcSourceBefore = npcLeaves[1].populationDetail.mouths;
  const npcCapitalBefore = npcLeaves[0].populationDetail.mouths;
  const npcSourceWithoutMigration = npcSourceBefore
    + Math.round(npcSourceBefore * 0.035 / 12)
    - Math.round(npcSourceBefore * 0.025 / 12);
  const npcCapitalWithoutMigration = npcCapitalBefore
    + Math.round(npcCapitalBefore * 0.035 / 12)
    - Math.round(npcCapitalBefore * 0.025 / 12);
  context.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  const playerAfter = totals(playerLeaves).mouths;
  const npcAfter = totals(npcLeaves).mouths;
  ok(context.GM.population.national.mouths === playerAfter, 'player national contains only player faction leaves');
  ok(context.GM.population.dynamics._yearlyAccumBirths === expectedPlayerBirths,
    'player birth ledger excludes NPC births');
  ok(context.GM.worldPopulationSummary.byFaction['fac-npc'].dynamics._yearlyAccumBirths === expectedNpcBirths,
    'NPC births are retained in a separate faction ledger');
  ok(context.GM.worldPopulationSummary.byFaction['fac-npc'].national.mouths === npcAfter
    && context.GM.worldPopulationSummary.national.mouths === playerAfter + npcAfter,
    'world summary is separate from player national while preserving every faction');
  ok(npcLeaves[1].populationDetail.mouths < npcSourceWithoutMigration
    && npcLeaves[0].populationDetail.mouths > npcCapitalWithoutMigration,
    'NPC capital pull stays inside the NPC faction');
  ok(playerAfter - playerBefore < npcAfter - npcBefore,
    'larger NPC population growth does not leak into the player national total');
}

{
  const { context, playerLeaves, npcLeaves } = makeRuntime();
  const npcBefore = totals(npcLeaves).mouths;
  const playerBefore = totals(playerLeaves).mouths;
  const result = context.HujiEngine.applyPopulationLoss({ cause: 'smoke-corvee', mouths: 8000, ding: 8000 });
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario: context.P, turn: 1 });
  ok(result.ok && result.mouths === 8000, 'mortality ledger applies the requested player loss');
  ok(totals(playerLeaves).mouths === playerBefore - 8000
    && context.GM.population.national.mouths === playerBefore - 8000,
    'leaf mortality survives RuntimeBridge national aggregation');
  ok(totals(npcLeaves).mouths === npcBefore, 'player mortality never changes NPC leaves');
}

{
  const { context, playerLeaves, npcLeaves } = makeRuntime();
  const playerBefore = totals(playerLeaves).mouths;
  const npcCapitalBefore = npcLeaves[0].populationDetail.mouths;
  const npcRegionBefore = npcLeaves[1].populationDetail.mouths;
  const playerDeathBefore = context.GM.population.dynamics._yearlyAccumDeaths || 0;
  const result = context.HujiEngine.applyPopulationLoss({ cause:'smoke-npc-region', regionId:'npc-north', mouths:7000 });
  ok(result.ok && result.factionId === 'fac-npc'
    && npcLeaves[1].populationDetail.mouths === npcRegionBefore - 7000
    && npcLeaves[0].populationDetail.mouths === npcCapitalBefore,
  'region-targeted mortality changes only the matching faction leaf');
  ok(totals(playerLeaves).mouths === playerBefore
    && (context.GM.population.dynamics._yearlyAccumDeaths || 0) === playerDeathBefore,
  'NPC mortality never enters the player national or death accumulator');
  ok(context.GM.worldPopulationSummary.byFaction['fac-npc'].mortalityLedger.some(row => row.cause === 'smoke-npc-region'),
    'NPC mortality is retained in the NPC faction ledger');
}

{
  const { context, playerLeaves, npcLeaves } = makeRuntime();
  const playerBefore = totals(playerLeaves);
  const npcBefore = totals(npcLeaves);
  const result = context.HujiEngine.applyPopulationLoss({
    factionId: 'missing-faction', cause: 'smoke-unresolved-faction', mouths: 10000
  });
  ok(result.ok === false && result.reason === 'faction-not-found'
    && JSON.stringify(totals(playerLeaves)) === JSON.stringify(playerBefore)
    && JSON.stringify(totals(npcLeaves)) === JSON.stringify(npcBefore),
  'an unresolved explicit faction fails closed without harming the player');
}

{
  const baseline = makeRuntime();
  baseline.context.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  const baselinePlayerDeaths = baseline.context.GM.population.dynamics._yearlyAccumDeaths;
  const baselineNpcDeaths = baseline.context.GM.worldPopulationSummary.byFaction['fac-npc'].dynamics._yearlyAccumDeaths;

  const npcWar = makeRuntime();
  npcWar.context.GM.activeWars = [{ id:'npc-war', attacker:'fac-npc', defender:'fac-other' }];
  npcWar.context.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  ok(npcWar.context.GM.population.dynamics._yearlyAccumDeaths === baselinePlayerDeaths
    && npcWar.context.GM.worldPopulationSummary.byFaction['fac-npc'].dynamics._yearlyAccumDeaths > baselineNpcDeaths,
  'an NPC-only war raises mortality only for the participating NPC faction');

  const playerWar = makeRuntime();
  playerWar.context.GM.activeWars = [{ id:'player-war', attackerId:'fac-player', defenderId:'fac-npc' }];
  playerWar.context.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  ok(playerWar.context.GM.population.dynamics._yearlyAccumDeaths > baselinePlayerDeaths
    && playerWar.context.GM.worldPopulationSummary.byFaction['fac-npc'].dynamics._yearlyAccumDeaths > baselineNpcDeaths,
  'a player war raises mortality for both actual participants');
}

{
  const { context, npcLeaves } = makeRuntime();
  context.GM.adminHierarchy.player.divisions = [];
  context.GM.population.national = { mouths:10000000, households:2000000, ding:3000000 };
  context.GM.population.byAge = { age_21_30:10000000 };
  context.GM.population.byGender = { male:5200000, female:4800000 };
  context.GM.regions = [makeLeaf('stale-player-region', '旧玩家地区', 10000000, true)];
  context.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:1 });
  ok(context.GM.population.national.mouths === 0
    && context.GM.population.national.households === 0
    && context.GM.population.national.ding === 0
    && sumBuckets(context.GM.population.byAge) === 0
    && sumBuckets(context.GM.population.byGender) === 0
    && context.GM.hukou.registeredMouths === 0
    && context.GM.worldPopulationSummary.byFaction['fac-npc'].isPlayer === false
    && context.GM.worldPopulationSummary.byFaction['fac-npc'].national.mouths === totals(npcLeaves).mouths,
  'territorial extinction clears stale player population and never revives scenario or root-region fallbacks');
}

{
  const { context, npcLeaves } = makeRuntime();
  delete context.GM.adminHierarchy.player;
  context.GM.population.national = { mouths:10000000, households:2000000, ding:3000000 };
  context.GM.regions = [makeLeaf('stale-player-region', '旧玩家地区', 10000000, true)];
  context.HujiEngine.tick({ turn:1, monthRatio:1, strict:true });
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:1 });
  ok(context.GM.population.national.mouths === 0
    && context.GM.population.national.households === 0
    && context.GM.population.national.ding === 0
    && context.GM.worldPopulationSummary.byFaction['fac-npc'].isPlayer === false
    && context.GM.worldPopulationSummary.byFaction['fac-npc'].national.mouths === totals(npcLeaves).mouths,
  'deleting the player branch never turns the sole NPC branch into the player');
}

{
  const { context } = makeRuntime();
  context.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  const entry = context.GM.worldPopulationSummary.byFaction['fac-npc'];
  const births = entry.dynamics._yearlyAccumBirths;
  context.GM.adminHierarchy.renamedNpcBranch = context.GM.adminHierarchy.npc;
  delete context.GM.adminHierarchy.npc;
  context.HujiEngine.tick({ turn: 2, monthRatio: 1, strict: true });
  ok(context.GM.worldPopulationSummary.byFaction['fac-npc'] === entry
    && entry.dynamics._yearlyAccumBirths > births
    && !context.GM.worldPopulationSummary.byFaction.renamedNpcBranch,
  'world population history is keyed by stable factionId across branch renames');
}

{
  const { context, playerLeaves } = makeRuntime({ climate: 'little_ice_age' });
  const before = totals(playerLeaves).mouths;
  context.HujiDeepFill.tick({ turn: 2, monthRatio: 1, strict: true });
  const afterDeep = totals(playerLeaves).mouths;
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario: context.P, turn: 2 });
  ok(afterDeep < before && context.GM.population.national.mouths === afterDeep,
    'little-ice-age mortality is written to leaves and survives aggregation');
  const originalLoss = context.HujiEngine.applyPopulationLoss;
  context.HujiEngine.applyPopulationLoss = () => { throw new Error('injected mortality-ledger failure'); };
  let strictFailure = null;
  try { context.HujiDeepFill.tick({ turn: 3, monthRatio: 1, strict: true }); }
  catch (error) { strictFailure = error; }
  context.HujiEngine.applyPopulationLoss = originalLoss;
  ok(strictFailure && /mortality-ledger failure/.test(strictFailure.message),
    'strict HujiDeepFill propagates mortality failures to the turn transaction');
}

{
  const { context, playerLeaves } = makeRuntime({
    year: 1200,
    random: () => 0,
    dateForTurn(turn) { return { adYear: turn >= 2 ? 1200 : 1199 }; }
  });
  const before = totals(playerLeaves).mouths;
  const capitalBefore = playerLeaves[0].populationDetail.mouths;
  const southBefore = playerLeaves[1].populationDetail.mouths;
  context.HujiDeepFill.tick({ turn: 2, monthRatio: 1, strict: true });
  const after = totals(playerLeaves).mouths;
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario: context.P, turn: 2 });
  const plagueLoss = context.GM.population.mortalityLedger
    .filter(row => row.cause === 'plague')
    .reduce((sum, row) => sum + row.mouths, 0);
  ok(plagueLoss > 0 && after === before - plagueLoss
    && context.GM.population.national.mouths === after
    && playerLeaves[0].populationDetail.mouths === capitalBefore
    && playerLeaves[1].populationDetail.mouths === southBefore - plagueLoss
    && context.GM.population.plagueEvents.every(event => event.regionId === 'player-south'),
  'regional plague deaths hit the matched leaf only and survive national aggregation');
}

{
  const { context, playerLeaves } = makeRuntime();
  const before = totals(playerLeaves).mouths;
  const mortality = context.HujiEngine.applyPopulationLoss({
    factionId:'fac-player', regionId:'player-south', cause:'smoke-demographic-loss', mortalityRate:0.30
  });
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:2 });
  const region = context.GM.population.byRegion['player-south'];
  const sum = object => Object.values(object || {}).reduce((total, value) => total + Number(value || 0), 0);
  ok(mortality.ok && mortality.mouths === Math.round(400000 * 0.30)
    && sum(region.byAge) === region.mouths
    && sum(region.byGender) === region.mouths
    && context.GM.population.national.ding === totals(playerLeaves).ding
    && totals(playerLeaves).mouths === before - mortality.mouths,
  'leaf mortality keeps age, gender, mouths and ding on one authoritative ledger');
}

{
  const { context, playerLeaves } = makeRuntime({ year:1127 });
  context.GM.unrest = 80;
  playerLeaves[0].name = '京东路';
  context.GM._capital = '京东路';
  context.GM.facs[0].capital = '京东路';
  const before = totals(playerLeaves).mouths;
  context.HujiDeepFill.tick({ turn:2, monthRatio:1, strict:true });
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:2 });
  const leaves = context.GM.adminHierarchy.player.divisions;
  const qiaozhi = leaves.filter(leaf => leaf && leaf.isQiaozhi && leaf.parentHistoric === 'jingkang_qiao');
  const qiaozhiMouths = totals(qiaozhi).mouths;
  const materialized = qiaozhi.length === 3 && qiaozhiMouths > 0
    && totals(leaves).mouths === before
    && context.GM.population.national.mouths === before
    && context.GM.population.byLegalStatus.qiaozhi.mouths === qiaozhiMouths
    && context.GM.population._qiaozhi_triggered.jingkang_qiao === 2;
  context.HujiEngine.tick({ turn:3, monthRatio:1, strict:true });
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:3 });
  const qiaozhiAfterGrowth = totals(qiaozhi).mouths;
  ok(materialized && context.GM.population.byLegalStatus.qiaozhi.mouths === qiaozhiAfterGrowth,
  'qiaozhi creates authoritative leaves, transfers population, and survives RuntimeBridge');
}

{
  const { context, playerLeaves } = makeRuntime();
  const capital = playerLeaves[0];
  const source = playerLeaves[1];
  capital.populationDetail.households = 60000;
  capital.populationDetail.ding = 120000;
  capital.populationDetail.byAge = { age_71_plus:capital.populationDetail.mouths };
  capital.populationDetail.byGender = { male:120000, female:480000 };
  source.populationDetail.households = 160000;
  source.populationDetail.ding = 240000;
  source.populationDetail.byAge = { age_21_30:source.populationDetail.mouths };
  source.populationDetail.byGender = { male:320000, female:80000 };
  context.HujiEngine.syncDemographicViews();
  const before = demographicTotals(playerLeaves);
  const sourceBefore = clone(source.populationDetail);
  const capitalBefore = clone(capital.populationDetail);
  const moved = context.HujiEngine.transferPopulation({
    factionId:'fac-player', sourceRegionIds:['player-south'], targetRegionId:'player-capital', mouths:10000, cause:'smoke-capital-transfer'
  });
  const after = demographicTotals(playerLeaves);
  ok(moved.ok
    && JSON.stringify(after) === JSON.stringify(before)
    && sourceBefore.mouths - source.populationDetail.mouths === moved.mouths
    && sourceBefore.households - source.populationDetail.households === moved.households
    && sourceBefore.ding - source.populationDetail.ding === moved.ding
    && capital.populationDetail.mouths - capitalBefore.mouths === moved.mouths
    && capital.populationDetail.households - capitalBefore.households === moved.households
    && capital.populationDetail.ding - capitalBefore.ding === moved.ding,
  'ordinary migration transfers one exact mouths-households-ding-age-gender bundle');
}

{
  const { context, playerLeaves } = makeRuntime({ year:1101 });
  playerLeaves[0].name = '中原京城';
  playerLeaves[1].name = '江南路';
  context.GM._capital = '中原京城';
  context.GM.facs[0].capital = '中原京城';
  context.GM.population.dynamics.birthRateBase = 0;
  context.GM.population.dynamics.deathRateBase = 0;
  playerLeaves[0].populationDetail.byAge = { age_71_plus:playerLeaves[0].populationDetail.mouths };
  playerLeaves[0].populationDetail.byGender = { male:100000, female:500000 };
  playerLeaves[1].populationDetail.byAge = { age_21_30:playerLeaves[1].populationDetail.mouths };
  playerLeaves[1].populationDetail.byGender = { male:300000, female:100000 };
  context.HujiEngine.syncDemographicViews();
  const before = demographicTotals(playerLeaves);
  context.HujiEngine.tick({ turn:1, monthRatio:1e-9, strict:true });
  const after = demographicTotals(playerLeaves);
  ok(JSON.stringify(after) === JSON.stringify(before)
    && context.GM.population.migrationEvents.some(row => row.id === 'jingkang_nandu'),
  'historical migration conserves every demographic field, not only mouths');
}

{
  const { context } = makeRuntime({ year:1101 });
  context.GM.adminHierarchy = {};
  context.GM._capital = '不存在的首都';
  context.GM.population.byRegion = {
    中原: { mouths:100000, households:20000, ding:40000, byAge:{ age_21_30:100000 }, byGender:{ male:80000, female:20000 } },
    江南: { mouths:100000, households:10000, ding:20000, byAge:{ age_71_plus:100000 }, byGender:{ male:20000, female:80000 } }
  };
  context.GM.population.national = { mouths:200000, households:30000, ding:60000 };
  context.GM.population.dynamics.birthRateBase = 0;
  context.GM.population.dynamics.deathRateBase = 0;
  const before = clone(context.GM.population.byRegion);
  const beforeTotals = {
    mouths:before.中原.mouths + before.江南.mouths,
    households:before.中原.households + before.江南.households,
    ding:before.中原.ding + before.江南.ding,
    age21:before.中原.byAge.age_21_30,
    age71:before.江南.byAge.age_71_plus,
    male:before.中原.byGender.male + before.江南.byGender.male,
    female:before.中原.byGender.female + before.江南.byGender.female
  };
  context.HujiEngine.tick({ turn:1, monthRatio:1e-9, strict:true });
  const rows = context.GM.population.byRegion;
  ok(rows.中原.mouths + rows.江南.mouths === beforeTotals.mouths
    && rows.中原.households + rows.江南.households === beforeTotals.households
    && rows.中原.ding + rows.江南.ding === beforeTotals.ding
    && (rows.中原.byAge.age_21_30 || 0) + (rows.江南.byAge.age_21_30 || 0) === beforeTotals.age21
    && (rows.中原.byAge.age_71_plus || 0) + (rows.江南.byAge.age_71_plus || 0) === beforeTotals.age71
    && rows.中原.byGender.male + rows.江南.byGender.male === beforeTotals.male
    && rows.中原.byGender.female + rows.江南.byGender.female === beforeTotals.female,
  'legacy byRegion migration transfers households ding age and gender with mouths');
}

{
  const { context, playerLeaves } = makeRuntime();
  let exact = true;
  for (let mouths = 0; mouths <= 100; mouths++) {
    playerLeaves[0].populationDetail.mouths = mouths;
    playerLeaves[0].populationDetail.households = Math.round(mouths / 5);
    playerLeaves[0].populationDetail.ding = Math.round(mouths * 0.3);
    playerLeaves[0].populationDetail.byAge = {};
    playerLeaves[0].populationDetail.byGender = {};
    playerLeaves[0].byAge = {};
    playerLeaves[0].byGender = {};
    playerLeaves[1].populationDetail.mouths = 0;
    playerLeaves[1].populationDetail.households = 0;
    playerLeaves[1].populationDetail.ding = 0;
    playerLeaves[1].populationDetail.byAge = {};
    playerLeaves[1].populationDetail.byGender = {};
    playerLeaves[1].byAge = {};
    playerLeaves[1].byGender = {};
    context.HujiEngine.syncDemographicViews();
    exact = exact
      && sumBuckets(playerLeaves[0].populationDetail.byAge) === mouths
      && sumBuckets(playerLeaves[0].populationDetail.byGender) === mouths;
  }
  ok(exact, 'largest-remainder allocation keeps age and gender buckets exact for populations 0 through 100');
}

{
  const { context } = makeRuntime();
  const branch = context.GM.adminHierarchy.player.divisions;
  ['侨京西', '侨京东', '侨河北'].forEach((name, index) => branch.push(makeLeaf('ordinary-same-name-' + index, name, 1000, false)));
  const first = context.HujiEngine.materializeQiaozhiResettlement({
    eventId:'jingkang_qiao', mouths:100000, sourceCandidates:['京城'], targetNames:['侨京西', '侨京东', '侨河北']
  });
  const eventOwned = branch.filter(leaf => leaf.parentHistoric === 'jingkang_qiao');
  const second = context.HujiEngine.materializeQiaozhiResettlement({
    eventId:'jingkang_qiao', mouths:100000, sourceCandidates:['京城'], targetNames:['侨京西', '侨京东', '侨河北']
  });
  branch.splice(branch.indexOf(eventOwned[0]), 1);
  const partial = context.HujiEngine.materializeQiaozhiResettlement({
    eventId:'jingkang_qiao', mouths:100000, sourceCandidates:['京城'], targetNames:['侨京西', '侨京东', '侨河北']
  });
  ok(first.ok && !first.alreadyMaterialized && eventOwned.length === 3
    && second.ok && second.alreadyMaterialized
    && partial.ok === false && partial.reason === 'qiaozhi-target-conflict',
  'qiaozhi idempotence uses complete event-owned stable IDs, never unrelated display names');
}

{
  const { context, playerLeaves, npcLeaves } = makeRuntime();
  const playerBefore = totals(playerLeaves).mouths;
  const npcBefore = totals(npcLeaves).mouths;
  const unresolved = context.HistoricalPresets.recordWarCasualty(50000, '北境会战', 'enemy');
  const applied = context.HistoricalPresets.recordWarCasualty({
    mouths:50000, warName:'北境会战', factionId:'fac-npc', regionId:'npc-north'
  });
  ok(unresolved.ok === false && unresolved.reason === 'faction-target-required'
    && totals(playerLeaves).mouths === playerBefore
    && applied.ok && applied.factionId === 'fac-npc'
    && totals(npcLeaves).mouths === npcBefore - 50000,
  'war casualties require a stable side target and never default enemy losses to the player');
}

{
  const { context } = makeRuntime();
  const originalSync = context.HujiEngine.syncDemographicViews;
  context.HujiEngine.syncDemographicViews = () => { throw new Error('injected historical demographic failure'); };
  let strictFailure = null;
  try { context.HistoricalPresets.tick({ turn:2, monthRatio:1, strict:true }); }
  catch (error) { strictFailure = error; }
  context.HujiEngine.syncDemographicViews = originalSync;
  ok(strictFailure && /historical demographic failure/.test(strictFailure.message),
    'strict historical demographic failures propagate to the end-turn transaction');
}

{
  const runtime = makeRuntime({ year: 1101, campaignId: 'campaign-a' });
  const { context, playerLeaves } = runtime;
  playerLeaves[0].name = '中原京城';
  playerLeaves[1].name = '江南路';
  context.GM._capital = '中原京城';
  context.GM.facs[0].capital = '中原京城';
  context.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  const countAfterFirst = context.GM.population.migrationEvents.filter(row => row.id === 'jingkang_nandu').length;
  const saved = clone(context.GM);
  context.GM = saved;
  context.HujiEngine.tick({ turn: 2, monthRatio: 1, strict: true });
  const countAfterReload = context.GM.population.migrationEvents.filter(row => row.id === 'jingkang_nandu').length;
  const other = makeRuntime({ year: 1101, campaignId: 'campaign-b' });
  other.playerLeaves[0].name = '中原京城';
  other.playerLeaves[1].name = '江南路';
  other.context.GM._capital = '中原京城';
  other.context.GM.facs[0].capital = '中原京城';
  other.context.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  const otherCount = other.context.GM.population.migrationEvents.filter(row => row.id === 'jingkang_nandu').length;
  ok(countAfterFirst === 1 && countAfterReload === 1, 'persisted migration event state prevents restart duplication');
  ok(otherCount === 1, 'a different campaign can independently trigger the same historical migration');
  ok(!Object.prototype.hasOwnProperty.call(context.HujiEngine.MIGRATION_EVENTS[0], '_triggered'),
    'immutable migration presets never carry campaign trigger state');
}

{
  const { context } = makeRuntime();
  context.GM.adminHierarchy = {};
  context.GM.population.national = { mouths: 20000, households: 4000, ding: 6000 };
  context.GM.population.dynamics.birthRateBase = 0;
  context.GM.population.dynamics.deathRateBase = 0.12;
  context.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  ok(context.GM.population.national.mouths > 0 && context.GM.population.national.mouths < 100000,
    'a legitimate 20,000-person polity is never raised to a hard-coded 100,000 floor');
}

{
  const daysPerTurnCases = [1, 10, 30, 90];
  const triggerResults = daysPerTurnCases.map(daysPerTurn => {
    const { context } = makeRuntime({ daysPerTurn });
    const cycleTurns = context.turnsForMonths(12);
    context.GM.population.meta.registrationCycle = 1;
    context.GM.population.meta.lastRegistrationTurn = 0;
    context.HujiEngine.tick({ turn: cycleTurns - 1, monthRatio: daysPerTurn / 30, strict: true });
    const premature = context.GM.population.meta.lastRegistrationTurn;
    context.HujiEngine.tick({ turn: cycleTurns, monthRatio: daysPerTurn / 30, strict: true });
    return { cycleTurns, premature, triggered: context.GM.population.meta.lastRegistrationTurn };
  });
  ok(triggerResults.every(result => result.premature === 0 && result.triggered === result.cycleTurns),
    'registration cycles use canonical elapsed months for every daysPerTurn scale');
}

{
  const { context, playerLeaves } = makeRuntime();
  context.GM.turn = 12;
  context.GM.population.meta.registrationCycle = 1;
  context.GM.population.meta.lastRegistrationTurn = 0;
  playerLeaves[0].populationDetail.hiddenCount = 300000;
  playerLeaves[1].populationDetail.hiddenCount = 200000;
  context.GM.population.hiddenCount = 500000;
  context.HujiEngine.tick({ turn:12, monthRatio:1, strict:true });
  const leafHiddenAfter = playerLeaves.reduce((sum, leaf) => sum + Number(leaf.populationDetail.hiddenCount || 0), 0);
  const leafHuangji = playerLeaves.reduce((sum, leaf) => sum + Number(leaf.populationDetail.byLegalStatus.huangji.households || 0), 0);
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:12, applyHardEffects:false });
  ok(leafHiddenAfter === 350000
    && context.GM.population.hiddenCount === 350000
    && context.GM.hukou.estimatedHidden === 350000,
  'census registration removes discovered mouths from authoritative leaves and RuntimeBridge cannot restore them');
  ok(leafHuangji === 30000
    && context.GM.population.meta.registrationLedger.slice(-1)[0].mouths === 150000
    && context.GM.population.meta.registrationLedger.slice(-1)[0].households === 30000,
  '150,000 discovered hidden mouths become about 30,000 registered households, never 150,000 households');
}

{
  const { context, playerLeaves } = makeRuntime();
  context.GM.turn = 12;
  context.GM.population.meta.registrationCycle = 1;
  context.GM.population.meta.lastRegistrationTurn = 0;
  playerLeaves[0].populationDetail.hiddenCount = 300000;
  playerLeaves[1].populationDetail.hiddenCount = 200000;
  context.GM.population.hiddenCount = 500000;
  const hiddenBefore = playerLeaves.map(leaf => leaf.populationDetail.hiddenCount);
  const legalBefore = playerLeaves.map(leaf => clone(leaf.populationDetail.byLegalStatus || {}));
  context.FiscalEngine.spendFromGuoku = () => { throw new Error('injected census payment failure'); };
  let failure = null;
  try { context.HujiEngine.tick({ turn:12, monthRatio:1, strict:true }); }
  catch (error) { failure = error; }
  ok(failure && /census payment failure/.test(failure.message)
    && context.GM.population.meta.lastRegistrationTurn === 0
    && JSON.stringify(playerLeaves.map(leaf => leaf.populationDetail.hiddenCount)) === JSON.stringify(hiddenBefore)
    && JSON.stringify(playerLeaves.map(leaf => leaf.populationDetail.byLegalStatus || {})) === JSON.stringify(legalBefore),
  'failed census payment propagates before registration metadata or leaf ledgers change');
}

{
  const { context } = makeRuntime();
  const countyA = makeLeaf('county-a', '甲县', 600000, true);
  const countyB = makeLeaf('county-b', '乙县', 400000, false);
  countyA.populationDetail.hiddenCount = 10000;
  countyB.populationDetail.hiddenCount = 5000;
  context.GM.adminHierarchy.player.divisions = [{
    id:'province-a', name:'甲省', children:[{
      id:'prefecture-a', name:'甲府', children:[countyA, countyB]
    }]
  }];
  context.GM.population.hiddenCount = 15000;
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:1, applyHardEffects:false });
  context.IntegrationBridge.tick({ strict:true });
  context.GM.population.byRegion['county-a'].baojiaUnits = 100000;
  const hiddenBefore = countyA.populationDetail.hiddenCount;
  context.GM.population.dynamics.birthRateBase = 0;
  context.GM.population.dynamics.deathRateBase = 0;
  context.HujiEngine.tick({ turn:1, monthRatio:12, strict:true });
  const reduced = countyA.populationDetail.hiddenCount;
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:1, applyHardEffects:false });
  context.IntegrationBridge.tick({ strict:true });
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:1, applyHardEffects:false });
  const keys = Object.keys(context.GM.population.byRegion).sort();
  ok(reduced < hiddenBefore
    && countyA.populationDetail.hiddenCount === reduced
    && context.GM.population.byRegion['county-a'] === countyA.populationDetail,
  'multi-level baojia changes remain on the authoritative leaf after both runtime bridges');
  ok(JSON.stringify(keys) === JSON.stringify(['county-a', 'county-b'])
    && !context.GM.population.byRegion['province-a']
    && context.GM.population.byProvince['province-a'],
  'population.byRegion keeps stable leaf IDs while province proxies use population.byProvince');

  [countyA, countyB].forEach((county, index) => {
    county.populationDetail.mouths = 0;
    county.populationDetail.households = 0;
    county.populationDetail.ding = 0;
    county.populationDetail.hiddenCount = 0;
    county.populationDetail.fugitives = 0;
    county.population = { mouths: 900000 + index, households: 180000, ding: 270000 };
  });
  context.GM.population.national = { mouths: 1000000, households: 200000, ding: 300000 };
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:2, applyHardEffects:false });
  context.IntegrationBridge.tick({ strict:true });
  ok(context.GM.population.national.mouths === 0
    && context.GM.population.national.households === 0
    && context.GM.population.national.ding === 0
    && context.GM.population.byRegion['county-a'].mouths === 0
    && context.GM.population.byProvince['province-a'].mouths === 0,
  'authoritative zero leaf population survives both bridges despite stale nonzero legacy mirrors');
}

{
  const { context, playerLeaves } = makeRuntime();
  playerLeaves.forEach((leaf, index) => {
    leaf.populationDetail.mouths = 0;
    leaf.populationDetail.households = 0;
    leaf.populationDetail.ding = 0;
    leaf.populationDetail.hiddenCount = 0;
    leaf.populationDetail.fugitives = 0;
    leaf.mouths = 700000 + index;
    leaf.hiddenCount = 5000;
    leaf.fugitives = 3000;
  });
  context.GM.population.national = { mouths:1000000, households:200000, ding:300000 };
  context.GM.population.hiddenCount = 10000;
  context.GM.population.fugitives = 6000;
  delete context.GM.population._leafPopulationAuxAuthoritative;
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario:context.P, turn:1, applyHardEffects:false });
  context.IntegrationBridge.tick({ strict:true });
  ok(context.GM.population.national.mouths === 0
    && context.GM.population.hiddenCount === 0
    && context.GM.population.fugitives === 0
    && playerLeaves.every(leaf => leaf.populationDetail.mouths === 0
      && leaf.populationDetail.hiddenCount === 0
      && leaf.populationDetail.fugitives === 0),
  'first bridge pass preserves explicit zero mouths hidden population and fugitives over stale legacy values');
}

{
  const { context, playerLeaves } = makeRuntime();
  const source = playerLeaves[0];
  source.populationDetail.mouths = 10;
  source.populationDetail.households = 5;
  source.populationDetail.ding = 5;
  source.populationDetail.byAge = { age_21_30:10 };
  source.populationDetail.byGender = { male:5, female:5 };
  const result = context.HujiEngine.materializeQiaozhiResettlement({
    eventId:'tiny-four-way-qiaozhi', mouths:3, sourceCandidates:['京城'],
    targetNames:['侨甲', '侨乙', '侨丙', '侨丁']
  });
  const created = context.GM.adminHierarchy.player.divisions.filter(leaf => leaf.parentHistoric === 'tiny-four-way-qiaozhi');
  ok(result.ok && result.households === 2 && result.ding === 2
    && created.reduce((sum, leaf) => sum + leaf.populationDetail.households, 0) === 2
    && created.reduce((sum, leaf) => sum + leaf.populationDetail.ding, 0) === 2,
  'four-way qiaozhi distributes two households and two ding exactly without rounding inflation');
}

{
  const { context, playerLeaves } = makeRuntime({
    dateForTurn(turn) { return { adYear: turn >= 13 ? 2 : 1 }; }
  });
  const corvee = context.GM.population.corvee;
  corvee.enabled = true;
  corvee.currentYear = 1;
  Object.keys(corvee.byType).forEach(key => {
    corvee.byType[key].totalDays = 100000000;
    corvee.byType[key].currentYearDays = 100000000;
  });
  const before = totals(playerLeaves).mouths;
  context.HujiEngine.tick({ turn: 13, monthRatio: 1, strict: true });
  const junyi = corvee.byType.junyi;
  const after = totals(playerLeaves).mouths;
  ok(corvee.currentYear === 2 && junyi.currentYearDays > 0
    && junyi.currentYearDays < junyi.totalDays / 10,
  'new calendar year resets corvee pressure while preserving lifetime statistics');
  ok(corvee.currentYearBurden < 0.1,
    'fugitive pressure is derived from the current-year window, not lifetime service days');
  ok(after < before
    && context.GM.population.mortalityLedger.some(row => /^corvee:/.test(row.cause)),
  'ordinary corvee mortality reaches the leaf population ledger');
}

{
  const { context, playerLeaves } = makeRuntime();
  const before = totals(playerLeaves).mouths;
  const expectedWithoutMortality = before + playerLeaves.reduce((sum, leaf) => {
    const mouths = leaf.populationDetail.mouths;
    return sum + Math.round(mouths * 0.035 / 12) - Math.round(mouths * 0.025 / 12);
  }, 0);
  const started = context.HujiEngine.startLargeCorvee('ming_zijincheng');
  context.HujiEngine.tick({ turn: 2, monthRatio: 1, strict: true });
  context.TM.HujiRuntimeBridge.maintain(context.GM, { scenario: context.P, turn: 2 });
  const after = totals(playerLeaves).mouths;
  ok(started.ok && after < expectedWithoutMortality
    && context.GM.population.mortalityLedger.some(row => row.cause === 'large-corvee:ming_zijincheng')
    && context.GM.population.national.mouths === after,
  'large-corvee mortality survives the complete leaf-to-national bridge');
}

console.log('\n[smoke-population-faction-ledger] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
