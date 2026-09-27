#!/usr/bin/env node
// smoke-policy-detail-player-paths.js - player edicts must drive detailed policy paths end to end.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;

function assert(cond, msg) {
  if (!cond) throw new Error('[assert] ' + msg);
  passed += 1;
}

function assertOk(result, label) {
  assert(result && result.ok, label + ' should execute, got ' + JSON.stringify(result));
}

function buildContext() {
  const calls = {
    currencyReforms: [],
    corvee: [],
    envPolicies: [],
    allocations: []
  };
  const ctx = {
    console: console,
    window: null,
    globalThis: null,
    Math: Math,
    Date: Date,
    addEB: function() {},
    GM: {
      turn: 73,
      month: 1,
      vars: {},
      guoku: { money: 800000, balance: 800000 },
      regions: [
        { id: 'jiangnan', name: '江南' },
        { id: 'shaanxi', name: '陕西' },
        { id: 'jingji', name: '京畿' },
        { id: 'fujian', name: '福建' }
      ],
      fiscal: {
        regions: {
          jiangnan: {
            regionId: 'jiangnan',
            name: '江南',
            compliance: 0.58,
            autonomyLevel: 0.32,
            ledgers: { money: 120000, grain: 0, cloth: 0 },
            allocation: { mode: 'qiyun_cunliu', perTax: { land_grain: { qiyun: 0.6, cunliu: 0.4 } } },
            annualReport: { collected: 80000, remitted: 45000, skimmed: 6000 },
            history: []
          }
        }
      },
      currency: {
        currentStandard: 'copper',
        reforms: [],
        events: [],
        coins: {
          silver: { stock: 1000000, enabled: true },
          copper: { stock: 3000000, enabled: true }
        },
        foreignFlow: { tradeMode: 'restrictive', cumulativeNet: 0 },
        paper: {
          issuances: [
            { id: 'baochao', name: '大明宝钞', state: 'circulate', acceptanceByRegion: { jiangnan: 0.2 } }
          ]
        }
      },
      population: {
        meta: { lastRegistrationTurn: 20 },
        hiddenCount: 300,
        fugitives: 7000,
        corvee: { fullyCommuted: false, commutationRate: 0.1 },
        byLegalStatus: {
          huangji: { households: 1000, mouths: 5000, ding: 1500 },
          taoohu: { households: 1200, mouths: 3000, ding: 900 }
        },
        byCategory: {},
        byRegion: {
          shaanxi: { households: 3000, mouths: 15000, ding: 4800 },
          jingji: { households: 2000, mouths: 10000, ding: 3200 },
          jiangnan: { households: 4000, mouths: 20000, ding: 6500 }
        },
        military: {
          totalPool: 4000,
          eligibleDing: 9000,
          types: {
            mubing: { enabled: false, soldiers: 1000, strength: 1000 },
            weisuo: { enabled: true, soldiers: 5000, strength: 5000 }
          }
        }
      },
      _turnReport: []
    },
    AuthorityComplete: {
      triggerHuangweiEvent: function() {},
      triggerHuangquanEvent: function() {}
    },
    CurrencyEngine: {
      REFORM_PRESETS: [
        { id: 'wanli_yitiaobian', name: '一条鞭法', effects: { standardChange: 'silver' } },
        { id: 'ming_open_silver_1567', name: '隆庆开海', effects: { tradeMode: 'liberal' } }
      ],
      applyReform: function(id, opts) {
        calls.currencyReforms.push({ id: id, opts: opts || {} });
        ctx.GM.currency.reforms.push({ id: id, turn: ctx.GM.turn });
        if (id === 'wanli_yitiaobian') ctx.GM.currency.currentStandard = 'silver';
        if (id === 'ming_open_silver_1567') ctx.GM.currency.foreignFlow.tradeMode = 'liberal';
        return { ok: true, success: true, reformId: id };
      },
      banPrivateMint: function() { return { ok: true }; },
      issuePaper: function(spec) { return { ok: true, id: spec.id, name: spec.name }; },
      abolishPaper: function(id) { return { ok: true, id: id }; },
      debaseCoin: function(coin, level) { return { ok: true, coin: coin, level: level }; }
    },
    HujiEngine: {
      LARGE_CORVEE_PRESETS: [{ id: 'river_repair', name: '修河大役' }],
      startLargeCorvee: function(presetId, opts) {
        calls.corvee.push({ presetId: presetId, opts: opts || {} });
        ctx.GM.population.largeCorveeActive = { presetId: presetId, opts: opts || {}, turn: ctx.GM.turn };
        return { ok: true, presetId: presetId };
      }
    },
    EnvCapacityEngine: {
      enactPolicy: function(policyId, regionId) {
        calls.envPolicies.push({ policyId: policyId, regionId: regionId || 'all' });
        return { ok: true, policyId: policyId, regionId: regionId || 'all' };
      }
    },
    CentralLocalEngine: {
      setRegionAllocation: function(regionId, allocSpec) {
        calls.allocations.push({ regionId: regionId, allocSpec: allocSpec });
        ctx.GM.fiscal.regions[regionId].allocation = allocSpec;
        return { ok: true };
      }
    },
    EconomyLinkage: {},
    EconomyGapFill: {}
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  return { ctx, calls };
}

function loadEdictParser(ctx) {
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-number-parser.js'), 'utf8'), ctx, {filename:'tm-number-parser.js'});
  const file = path.join(ROOT, 'tm-edict-parser.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  assert(ctx.EdictParser && typeof ctx.EdictParser.tryExecute === 'function', 'EdictParser.tryExecute should load');
}

function execute(ctx, text, params) {
  return ctx.EdictParser.tryExecute(text, params || {}, { source: 'smoke-player-edict' });
}

(function main() {
  const { ctx, calls } = buildContext();
  loadEdictParser(ctx);

  assertOk(execute(ctx, '诏令：推行完整币制改革，改用银本位，赋役折银，天下统一钱法。', { presetId: 'wanli_yitiaobian' }), 'full currency reform');
  assert(ctx.GM.currency.currentStandard === 'silver', 'full currency reform should switch standard to silver');
  assert(calls.currencyReforms.some(r => r.id === 'wanli_yitiaobian'), 'full currency reform should call CurrencyEngine.applyReform');

  const acceptanceBefore = ctx.GM.currency.paper.issuances[0].acceptanceByRegion.jiangnan;
  assertOk(execute(ctx, '诏令：江南先行接受宝钞，官府收纳，商税可用纸钞折纳。', { regionId: 'jiangnan', paperId: 'baochao' }), 'regional paper acceptance');
  assert(ctx.GM.currency.paper.issuances[0].acceptanceByRegion.jiangnan > acceptanceBefore, 'regional paper acceptance should increase paper acceptance in 江南');
  assert(ctx.GM._currencyPolicyActions.some(a => a.action === 'regional_acceptance'), 'regional paper acceptance should retain a currency policy ledger');

  const silverBefore = ctx.GM.currency.coins.silver.stock;
  assertOk(execute(ctx, '诏令：福建开海通商，引海外银流入月港，准海商纳银入库。', { regionId: 'fujian', amount: 500000 }), 'overseas silver flow');
  assert(ctx.GM.currency.foreignFlow.tradeMode === 'liberal', 'overseas silver flow should liberalize trade mode');
  assert(ctx.GM.currency.coins.silver.stock > silverBefore, 'overseas silver flow should increase silver stock');
  assert(ctx.GM._currencyPolicyActions.some(a => a.action === 'overseas_silver_flow'), 'overseas silver flow should retain a currency policy ledger');

  assertOk(execute(ctx, '诏令：征发大徭役修河，调丁十万，限三年完工。', { presetId: 'river_repair', amount: 100000 }), 'large corvee');
  assert(calls.corvee.length === 1 || ctx.GM.population.largeCorveeActive, 'large corvee should start through HujiEngine or fallback population state');

  const soldiersBefore = ctx.GM.population.military.types.mubing.soldiers;
  assertOk(execute(ctx, '诏令：陕西征兵二万，募兵入营，补边镇军伍。', { regionId: 'shaanxi', amount: 20000 }), 'conscription');
  assert(ctx.GM.population.military.types.mubing.soldiers > soldiersBefore, 'conscription should increase mubing soldiers');

  const shaanxiBefore = ctx.GM.population.byRegion.shaanxi.mouths;
  const jingjiBefore = ctx.GM.population.byRegion.jingji.mouths;
  assertOk(execute(ctx, '诏令：迁徙安置陕西流民一万口入京畿屯田，给牛种。', { sourceRegionId: 'shaanxi', targetRegionId: 'jingji', amount: 10000 }), 'migration settlement');
  assert(ctx.GM.population.byRegion.shaanxi.mouths < shaanxiBefore, 'migration settlement should reduce source population');
  assert(ctx.GM.population.byRegion.jingji.mouths > jingjiBefore, 'migration settlement should increase target population');

  assertOk(execute(ctx, '诏令：江南迁民出山，退耕还林，减轻环境承载。', { regionId: 'jiangnan' }), 'environment migration relief');
  assert(calls.envPolicies.some(p => p.policyId === 'migration_relief'), 'environment migration relief should enact migration_relief policy');
  assert(ctx.GM._envPolicyActions.some(a => a.policyId === 'migration_relief'), 'environment migration relief should retain an env policy ledger');

  assertOk(execute(ctx, '诏令：江南投入水利技术，修渠试新法，推广省水农具。', { regionId: 'jiangnan' }), 'environment tech investment');
  assert(calls.envPolicies.some(p => p.policyId === 'tech_investment'), 'environment tech investment should enact tech_investment policy');

  assertOk(execute(ctx, '诏令：江南灾后恢复水毁田土，赈灾复耕三年。', { regionId: 'jiangnan' }), 'environment disaster recovery');
  assert(calls.envPolicies.some(p => p.policyId === 'disaster_recovery'), 'environment disaster recovery should enact disaster_recovery policy');

  const complianceBefore = ctx.GM.fiscal.regions.jiangnan.compliance;
  assertOk(execute(ctx, '诏令：与江南议地方财政博弈，准其暂留三成，换取足额起运。', { regionId: 'jiangnan', retainedShare: 0.3 }), 'central-local fiscal bargain');
  assert(ctx.GM.fiscal.regions.jiangnan.compliance > complianceBefore, 'central-local fiscal bargain should improve compliance after negotiated retention');
  assert(ctx.GM._centralLocalPolicyActions.some(a => a.action === 'fiscal_bargain'), 'central-local fiscal bargain should retain a policy ledger');

  assertOk(execute(ctx, '诏令：建立江南长期财政追踪，岁终核验起运、存留、贪墨。', { regionId: 'jiangnan' }), 'central-local long-term tracking');
  assert(ctx.GM._centralLocalTracking && ctx.GM._centralLocalTracking.jiangnan && ctx.GM._centralLocalTracking.jiangnan.enabled, 'central-local tracking should keep a persistent tracking state');

  console.log('[smoke-policy-detail-player-paths] PASS ' + passed + ' assertions');
})();
