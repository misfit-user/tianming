'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const hujiSource = fs.readFileSync(path.join(ROOT, 'tm-huji-engine.js'), 'utf8');
const bridgeSource = fs.readFileSync(path.join(ROOT, 'tm-integration-bridge.js'), 'utf8');

let pass = 0;
let fail = 0;
function ok(condition, message) {
  if (condition) {
    pass++;
    console.log('  PASS - ' + message);
  } else {
    fail++;
    console.error('  FAIL - ' + message);
  }
}

function makeLeaf(id, mouths, minxin) {
  return {
    id,
    name: id,
    minxin,
    prosperity: 50,
    population: { mouths, households: Math.round(mouths / 5), ding: Math.round(mouths * 0.3) },
    populationDetail: { mouths, households: Math.round(mouths / 5), ding: Math.round(mouths * 0.3) },
    minxinDetails: { true: minxin, shown: minxin },
    fiscal: { treasury: 0, revenue: 0, expenditure: 0 },
    environment: { carrying: mouths * 2, currentLoad: 0.5 }
  };
}

function makeWorld(bottomUp) {
  const a = makeLeaf('a', 30000000, 75);
  const b = makeLeaf('b', 20000000, 25);
  return {
    P: { conf: { populationBottomUpEnabled: !!bottomUp }, time: { year: 1627 } },
    GM: {
      turn: 1,
      year: 1627,
      vars: { disasterLevel: 0 },
      activeWars: [],
      chars: [],
      adminHierarchy: { player: { divisions: [a, b] } },
      population: {
        national: { mouths: 50000000, households: 10000000, ding: 15000000 },
        byRegion: {
          a: { mouths: 30000000, households: 6000000, ding: 9000000 },
          b: { mouths: 20000000, households: 4000000, ding: 6000000 },
          ghost: { mouths: 99, households: 20, ding: 30 }
        },
        dynamics: {
          birthRateBase: 0.030,
          deathRateBase: 0.022,
          prosperityBonus: 0,
          agingPenalty: 0,
          diseaseBoost: 0,
          yearlyLog: []
        }
      },
      minxin: { trueIndex: 60, byRegion: { ghost: { true: 1 } } },
      fiscal: { regions: { ghost: { treasury: 1 } } },
      environment: { nationalLoad: 0.5, byRegion: { ghost: { currentLoad: 1 } } },
      corruption: { byDept: { central: 31, provincial: 32, county: 33, military: 34, palace: 35, technical: 36 } },
      regionMap: { ghost: { id: 'ghost' } }
    },
    leaves: [a, b]
  };
}

function createRuntime(world, bridge) {
  const context = {
    console,
    Math,
    Number,
    Object,
    Array,
    String,
    Date,
    JSON,
    isFinite,
    setTimeout,
    clearTimeout,
    GM: world.GM,
    P: world.P,
    TM: {},
    turnsForMonths: months => months,
    _getDaysPerTurn: () => 30,
    calcDateFromTurn: () => ({ adYear: 1627 })
  };
  context.window = context;
  context.global = context;
  vm.createContext(context);
  if (bridge) vm.runInContext(bridgeSource, context, { filename: 'tm-integration-bridge.js' });
  vm.runInContext(hujiSource, context, { filename: 'tm-huji-engine.js' });
  return context;
}

function runMonths(monthRatio, steps) {
  const world = makeWorld(false);
  const ctx = createRuntime(world, true);
  ctx.IntegrationBridge.migrateAndRebind({ strict: true });
  for (let i = 0; i < steps; i++) {
    ctx.GM.turn = i + 1;
    ctx.HujiEngine.tick({ turn: i + 1, monthRatio, strict: true });
    ctx.IntegrationBridge.tick({ strict: true });
  }
  return Number(ctx.GM.population.national.mouths);
}

console.log('[smoke-population-single-authority]');

{
  const world = makeWorld(true);
  world.leaves[1].populationDetail.households = 5000000;
  world.leaves[1].populationDetail.ding = 4000000;
  world.leaves[1].population.households = 5000000;
  world.leaves[1].population.ding = 4000000;
  const ctx = createRuntime(world, true);
  ctx.IntegrationBridge.migrateAndRebind({ strict: true });
  const leafHouseholdRatio = world.leaves[1].populationDetail.households / world.leaves[1].populationDetail.mouths;
  const leafDingRatio = world.leaves[1].populationDetail.ding / world.leaves[1].populationDetail.mouths;
  ctx.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  const afterHuji = world.leaves.map(leaf => leaf.populationDetail.mouths);
  const corruptionAfterHuji = JSON.stringify(ctx.GM.corruption.byDept);
  ctx.IntegrationBridge.tick({ turn: 1, monthRatio: 1, strict: true });
  const afterBridge = world.leaves.map(leaf => leaf.populationDetail.mouths);
  ok(JSON.stringify(afterBridge) === JSON.stringify(afterHuji), 'IntegrationBridge does not advance leaf population after Huji');
  ok(JSON.stringify(ctx.GM.corruption.byDept) === corruptionAfterHuji, 'IntegrationBridge does not apply a second corruption tick');
  const sumBuckets = buckets => Object.values(buckets || {}).reduce((sum, value) => sum + Number(value || 0), 0);
  const leafDing = world.leaves.reduce((sum, leaf) => sum + leaf.populationDetail.ding, 0);
  ok(Math.abs(world.leaves[1].populationDetail.households / world.leaves[1].populationDetail.mouths - leafHouseholdRatio) < 0.000001
    && Math.abs(world.leaves[1].populationDetail.ding / world.leaves[1].populationDetail.mouths - leafDingRatio) > 0
    && ctx.GM.population.national.ding === leafDing
    && world.leaves.every(leaf => sumBuckets(leaf.populationDetail.byAge) === leaf.populationDetail.mouths
      && sumBuckets(leaf.populationDetail.byGender) === leaf.populationDetail.mouths),
  'leaf household ratios stay local while age transitions update leaf-authoritative ding and demographics');
  ok(!Object.prototype.hasOwnProperty.call(ctx.GM.population.byRegion, 'ghost')
    && !Object.prototype.hasOwnProperty.call(ctx.GM.minxin.byRegion, 'ghost')
    && !Object.prototype.hasOwnProperty.call(ctx.GM.fiscal.regions, 'ghost')
    && !Object.prototype.hasOwnProperty.call(ctx.GM.environment.byRegion, 'ghost')
    && !Object.prototype.hasOwnProperty.call(ctx.GM.regionMap, 'ghost'),
  'legacy region proxies are rebuilt without ghost keys');
}

{
  const daily = runMonths(1 / 30, 360);
  const monthly = runMonths(1 / 3, 36);
  const thirtyDay = runMonths(1, 12);
  const quarterly = runMonths(3, 4);
  const results = [daily, monthly, thirtyDay, quarterly];
  const relativeDifference = (Math.max.apply(Math, results) - Math.min.apply(Math, results)) / Math.max.apply(Math, results);
  ok(relativeDifference < 0.0002, 'equal simulated time stays consistent across 1-day, 10-day, 30-day and 90-day turns');
}

{
  const world = makeWorld(false);
  world.GM.adminHierarchy = {};
  const ctx = createRuntime(world, false);
  ctx.IntegrationBridge = { getLeafDivisions: () => [] };
  const oldMouths = ctx.GM.population.national.mouths;
  const oldHouseholds = ctx.GM.population.national.households;
  const oldDing = ctx.GM.population.national.ding;
  ctx.HujiEngine.tick({ turn: 1, monthRatio: 3, strict: true });
  const next = ctx.GM.population.national;
  ok(next.households !== oldHouseholds && Math.abs(next.households / next.mouths - oldHouseholds / oldMouths) < 0.000001,
    'legacy household count follows the pre-growth population ratio');
  ok(next.ding !== oldDing && Math.abs(next.ding / next.mouths - oldDing / oldMouths) < 0.000001,
    'legacy ding count follows the pre-growth population ratio');
  const net = next.mouths - oldMouths;
  ok(ctx.GM.population.dynamics.lastYearNet === net * 4, 'lastYearNet annualizes by monthRatio');
}

{
  const world = makeWorld(false);
  let firstMouths = world.leaves[0].populationDetail.mouths;
  Object.defineProperty(world.leaves[1].populationDetail, 'mouths', {
    configurable: true,
    get() { throw new Error('injected second-region failure'); }
  });
  const ctx = createRuntime(world, false);
  ctx.IntegrationBridge = { getLeafDivisions: () => world.leaves };
  let thrown = null;
  try {
    ctx.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  } catch (error) {
    thrown = error;
  }
  ok(!!thrown && /injected second-region failure/.test(thrown.message), 'strict Huji propagates a population substep failure');
  ok(world.leaves[0].populationDetail.mouths !== firstMouths, 'failure injection occurred after an earlier region was mutated');
}

// 州负荷照剧本开局（与省一级同，同志 11-08 定）：剧本另给了州负荷的，开局 init 记下「口数 ÷ 上限」与它之比，过月后负荷仍从剧本的数起、
// 随口数涨落；没给的就是口数 ÷ 上限。天启开封府口数 ÷ 上限 0.74、剧本写 1.08，旧写法过第一回合就改回 0.74。
// 第一回合以后才见到的（旧档）比记作 1，旧档算法不动。剧本开局的州没有 environment，上限在 carryingCapacity.historicalCap。
function authoredLoadWorld(turn) {
  const world = makeWorld(true);
  world.GM.turn = turn;
  world.GM.population._inited = true;
  const [dry, plain] = world.leaves;
  delete dry.environment;
  delete plain.environment;
  dry.carryingCapacity = { historicalCap: Math.round(30000000 / 0.74), currentLoad: 1.08 };
  plain.carryingCapacity = { historicalCap: 40000000 };
  return world;
}

{
  const world = authoredLoadWorld(1);
  const [dry, plain] = world.leaves;
  const ctx = createRuntime(world, true);
  ctx.HujiEngine.init({});
  ok(Math.abs(dry.carryingCapacity.authoredScale - 30000000 / dry.carryingCapacity.historicalCap / 1.08) < 1e-12
    && plain.carryingCapacity.authoredScale === 1,
  'opening init records the authored leaf load against people over cap, and 1 where the scenario gave none');
  ctx.IntegrationBridge.migrateAndRebind({ strict: true });
  const dryBefore = dry.populationDetail.mouths;
  ctx.HujiEngine.tick({ turn: 1, monthRatio: 1, strict: true });
  const dryAfter = dry.populationDetail.mouths;
  const plainAfter = plain.populationDetail.mouths;
  ok(dryAfter !== dryBefore && Math.abs(dry.carryingCapacity.currentLoad - 1.08 * dryAfter / dryBefore) < 1e-9,
    'a month later the authored leaf load still starts from the scenario figure and follows its people: ' + dry.carryingCapacity.currentLoad);
  ok(!dry.environment || Math.abs(dry.environment.currentLoad - dry.carryingCapacity.currentLoad) < 1e-12,
    'the bridge environment mirror carries the same leaf load');
  ok(Math.abs(plain.carryingCapacity.currentLoad - plainAfter / 40000000) < 1e-12,
    'a leaf without an authored load stays people over cap');
}

{
  const world = authoredLoadWorld(5);
  const [dry] = world.leaves;
  const ctx = createRuntime(world, true);
  ctx.HujiEngine.init({});
  ctx.IntegrationBridge.migrateAndRebind({ strict: true });
  ctx.HujiEngine.tick({ turn: 5, monthRatio: 1, strict: true });
  ok(dry.carryingCapacity.authoredScale === 1
    && Math.abs(dry.carryingCapacity.currentLoad - dry.populationDetail.mouths / dry.carryingCapacity.historicalCap) < 1e-12,
  'an old save past the opening turn keeps the old people-over-cap load');
}

console.log('\n[smoke-population-single-authority] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
