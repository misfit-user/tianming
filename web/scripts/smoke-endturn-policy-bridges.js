#!/usr/bin/env node
// smoke-endturn-policy-bridges.js - Endturn settlement and decree bridge guard.
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let passed = 0;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
  passed += 1;
}

function fn() {}

function makeEndturnContext(overrides) {
  const calls = {
    huji: 0,
    hujiDeep: 0,
    currency: 0,
    paperAtomic: 0,
    grainAtomic: 0
  };
  const ctx = {
    console: console,
    window: null,
    globalThis: null,
    Date: Date,
    Math: Math,
    setTimeout: fn,
    showLoading: fn,
    _dbg: fn,
    _getDaysPerTurn: function() { return 30; },
    processBiannian: fn,
    processChangeQueue: fn,
    decayConflictLevels: fn,
    inheritBloodFeuds: fn,
    updateProvinceEconomy: fn,
    evaluateThresholdTriggers: fn,
    updatePositions: fn,
    GM: {
      turn: 7,
      month: 1,
      vars: {},
      culturalWorks: [],
      _energy: 10,
      _energyMax: 100
    },
    P: {
      npcEngine: { enabled: false },
      territoryProductionSystem: { enabled: false },
      centralizationSystem: { enabled: false },
      vacantPositionReminder: { enabled: false },
      naturalDeath: { enabled: false }
    },
    TM: {
      errors: {
        capture: function(e) { throw e; },
        captureSilent: fn
      },
      Endturn: { Timing: { mark: fn } },
      HujiGovernanceLoop: { tick: fn },
      HujiRuntimeBridge: { maintain: fn, enforceAfterFiscalTick: fn }
    },
    SubTickRunner: { run: fn },
    StateCouplingSystem: { processCouplings: fn },
    OffendGroupsSystem: { applyDecay: fn },
    AutoReboundSystem: { applyRebounds: fn, checkReforms: fn },
    ChangeQueue: {
      length: function() { return 0; },
      getStats: function() { return {}; },
      applyAll: function() { return { ok: true, appliedCount: 0, failedCount: 0 }; },
      clear: fn
    },
    HujiEngine: { tick: function() { calls.huji += 1; } },
    HujiDeepFill: { tick: function() { calls.hujiDeep += 1; } },
    CurrencyEngine: {
      tick: function() { calls.currency += 1; },
      _updatePaperStateAtomic: function() { calls.paperAtomic += 1; },
      _updateGrainPriceAtomic: function() { calls.grainAtomic += 1; }
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;

  [
    'CorruptionEngine', 'GuokuEngine', 'NeitangEngine', 'CharEconEngine',
    'EconomyLinkage', 'CentralLocalEngine', 'EconomyGapFill',
    'EnvCapacityEngine', 'EdictParser', 'EdictComplete', 'EnvRecoveryFill',
    'AuthorityEngines', 'AuthorityComplete', 'HistoricalPresets',
    'PhaseC', 'PhaseD', 'PhaseB', 'PhaseA', 'PhaseE',
    'PhaseF1', 'PhaseF2', 'PhaseF3', 'PhaseF4', 'PhaseF5', 'PhaseF6',
    'PhaseG1', 'PhaseG2', 'PhaseG3', 'PhaseG4',
    'FiscalEngine', 'FeudalCore', 'NpcMemorials', 'IntegrationBridge',
    'CharFullSchema', 'WorldHelper'
  ].forEach(function(name) {
    ctx[name] = { tick: fn };
  });
  ctx.StateCouplingSystem.updateSnapshot = fn;
  ctx.FiscalEngine._tickTransferOrders = fn;
  ctx.FeudalCore._tickFeudalHoldings = fn;
  ctx.EdictComplete._checkProjectCompletion = fn;
  ctx.EdictComplete._checkHuangceCycle = fn;
  ctx.EdictComplete._checkGaituEscalation = fn;
  ctx.CharFullSchema.ensureFullFields = fn;
  ctx.CharFullSchema.evolveTick = fn;
  ctx.WorldHelper.clearCache = fn;

  Object.assign(ctx, overrides || {});
  return { ctx: ctx, calls: calls };
}

async function runEndturn(ctx) {
  vm.createContext(ctx);
  const file = path.join(ROOT, 'tm-endturn-systems.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  assert(typeof ctx._endTurn_updateSystems === 'function',
    'tm-endturn-systems should expose _endTurn_updateSystems in the runtime context');
  await ctx._endTurn_updateSystems(1, '');
}

function makeEdictContext() {
  const calls = {
    banPrivateMint: 0,
    issuePaper: [],
    abolishPaper: [],
    debaseCoin: [],
    transferOrders: [],
    forceLevy: [],
    censors: [],
    allocations: [],
    envPolicies: []
  };
  const ctx = {
    console: console,
    window: null,
    globalThis: null,
    GM: {
      turn: 12,
      guoku: { balance: 200000 },
      fiscal: {
        regions: {
          jiangnan: {
            regionId: 'jiangnan',
            name: '江南',
            ledgers: { money: 120000, grain: 0, cloth: 0 },
            allocation: { mode: 'qiyun_cunliu', perTax: { land_grain: { qiyun: 0.6, cunliu: 0.4 } } },
            compliance: 0.8,
            autonomyLevel: 0.2,
            annualReport: { collected: 0, remitted: 0, skimmed: 0 }
          },
          shanxi: {
            regionId: 'shanxi',
            name: '山西',
            ledgers: { money: 90000, grain: 0, cloth: 0 },
            allocation: { mode: 'qiyun_cunliu', perTax: { land_grain: { qiyun: 0.5, cunliu: 0.5 } } },
            compliance: 0.72,
            autonomyLevel: 0.3,
            annualReport: { collected: 0, remitted: 0, skimmed: 0 }
          }
        },
        auditSystem: {
          ongoingInspections: [],
          lastAuditedByRegion: {},
          coverageRatio: 0
        }
      },
      regions: [
        { id: 'jiangnan', name: '江南' },
        { id: 'shanxi', name: '山西' }
      ],
      population: {
        meta: { lastRegistrationTurn: 88 },
        hiddenCount: 100,
        fugitives: 3000,
        byLegalStatus: {
          huangji: { households: 1000, mouths: 5000, ding: 1500 },
          taoohu: { households: 1200, mouths: 3000, ding: 900 }
        },
        byCategory: {},
        byRegion: {
          jingji: { households: 1234, mouths: 6200, ding: 1800 },
          jiangnan: { households: 2000, mouths: 9800, ding: 3100 }
        }
      },
      currency: {
        paper: {
          issuances: [
            { id: 'baochao', name: '大明宝钞', state: 'circulate' }
          ]
        }
      }
    },
    addEB: fn,
    HujiEngine: {},
    EconomyLinkage: {
      createTransferOrder: function(spec) {
        calls.transferOrders.push(spec);
        return { success: true, orderId: 'transfer_' + calls.transferOrders.length };
      }
    },
    EconomyGapFill: {
      forceLevy: function(regionId, amount, reason) {
        calls.forceLevy.push({ regionId: regionId, amount: amount, reason: reason });
        return { ok: true, actualAmount: amount, newCompliance: 0.5 };
      }
    },
    CentralLocalEngine: {
      dispatchCensor: function(spec) {
        calls.censors.push(spec);
        return { ok: true, censorId: 'censor_' + calls.censors.length };
      },
      setRegionAllocation: function(regionId, allocSpec) {
        calls.allocations.push({ regionId: regionId, allocSpec: allocSpec });
        ctx.GM.fiscal.regions[regionId].allocation = Object.assign({}, ctx.GM.fiscal.regions[regionId].allocation, allocSpec);
        return true;
      }
    },
    EnvCapacityEngine: {
      enactPolicy: function(policyId, regionId) {
        calls.envPolicies.push({ policyId: policyId, regionId: regionId });
        return { ok: true, policyId: policyId, regionId: regionId || 'all' };
      }
    },
    AuthorityComplete: { triggerHuangweiEvent: fn },
    CurrencyEngine: {
      REFORM_PRESETS: [],
      applyReform: function() { return { ok: false, reason: 'unexpected preset path' }; },
      banPrivateMint: function() { calls.banPrivateMint += 1; return { ok: true }; },
      issuePaper: function(spec) { calls.issuePaper.push(spec); return { id: spec.id || 'issued', name: spec.name }; },
      abolishPaper: function(id) { calls.abolishPaper.push(id); return { ok: true }; },
      debaseCoin: function(coin, level) { calls.debaseCoin.push({ coin: coin, level: level }); return { ok: true }; }
    }
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  return { ctx: ctx, calls: calls };
}

function loadEdictParser(ctx) {
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-number-parser.js'), 'utf8'), ctx, {filename:'tm-number-parser.js'});
  const file = path.join(ROOT, 'tm-edict-parser.js');
  vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  assert(ctx.EdictParser && typeof ctx.EdictParser.tryExecute === 'function',
    'tm-edict-parser should expose EdictParser.tryExecute');
}

function pushMemorial(ctx, spec) {
  ctx.GM._pendingMemorials = ctx.GM._pendingMemorials || [];
  const memo = Object.assign({
    id: 'memo_' + (ctx.GM._pendingMemorials.length + 1),
    status: 'drafted',
    typeName: spec.typeKey,
    drafter: 'smoke',
    turn: ctx.GM.turn || 0,
    draftParams: {}
  }, spec);
  ctx.GM._pendingMemorials.push(memo);
  return memo;
}

(async function main() {
  const first = makeEndturnContext();
  await runEndturn(first.ctx);
  assert(first.calls.huji === 1, 'HujiEngine should tick once when early tick is enabled');
  assert(first.calls.hujiDeep === 1, 'HujiDeepFill should tick once when early tick is enabled');
  assert(first.calls.currency === 1, 'CurrencyEngine.tick should run once per endturn');
  assert(first.calls.paperAtomic === 0,
    'legacy paper atomic update should not run after full CurrencyEngine.tick in the same endturn');
  assert(first.calls.grainAtomic === 0,
    'legacy grain atomic update should not run after full CurrencyEngine.tick in the same endturn');

  const legacy = makeEndturnContext({
    CurrencyEngine: {
      _updatePaperStateAtomic: function() { legacy.calls.paperAtomic += 1; },
      _updateGrainPriceAtomic: function() { legacy.calls.grainAtomic += 1; }
    }
  });
  await runEndturn(legacy.ctx);
  assert(legacy.calls.currency === 0, 'legacy currency context should not call missing CurrencyEngine.tick');
  assert(legacy.calls.paperAtomic === 1,
    'legacy paper atomic update should still run when full CurrencyEngine.tick is unavailable');
  assert(legacy.calls.grainAtomic === 1,
    'legacy grain atomic update should still run when full CurrencyEngine.tick is unavailable');

  const edict = makeEdictContext();
  loadEdictParser(edict.ctx);
  const ban = edict.ctx.EdictParser.tryExecute('诏令：严禁民间私铸，整饬钱法，搜检私钱作坊。', {}, {});
  assert(!!ban.ok, 'currency edict should execute private mint ban from text');
  assert(edict.calls.banPrivateMint === 1, 'private mint ban edict should call CurrencyEngine.banPrivateMint');

  const issue = edict.ctx.EdictParser.tryExecute('诏令：发交子1000000贯于蜀，准备金三成，以便商旅。', {}, {});
  assert(!!issue.ok, 'paper issue edict should execute from text');
  assert(edict.calls.issuePaper.length === 1, 'paper issue edict should call CurrencyEngine.issuePaper');
  assert(edict.calls.issuePaper[0].name.indexOf('交子') >= 0, 'paper issue should preserve the named paper currency');
  assert(edict.calls.issuePaper[0].originalAmount === 1000000, 'paper issue should parse Arabic issue amount');
  assert(Math.abs(edict.calls.issuePaper[0].reserveRatio - 0.3) < 0.001, 'paper issue should parse 三成 reserve ratio');

  const abolish = edict.ctx.EdictParser.tryExecute('诏令：废大明宝钞，改行白银。', {}, {});
  assert(!!abolish.ok, 'paper abolition edict should execute from text');
  assert(edict.calls.abolishPaper[0] === 'baochao', 'paper abolition should resolve active paper by name');

  const debase = edict.ctx.EdictParser.tryExecute('诏令：减铸铜钱一成，以纾军用。', {}, {});
  assert(!!debase.ok, 'coin debasement edict should execute from text');
  assert(edict.calls.debaseCoin.length === 1, 'coin debasement should call CurrencyEngine.debaseCoin');
  assert(edict.calls.debaseCoin[0].coin === 'copper', 'coin debasement should parse copper coin target');
  assert(Math.abs(edict.calls.debaseCoin[0].level - 0.1) < 0.001, 'coin debasement should parse 一成 as 0.1');

  const hiddenBefore = edict.ctx.GM.population.hiddenCount;
  const huangjiHouseholdsBefore = edict.ctx.GM.population.byLegalStatus.huangji.households;
  const purgeHidden = edict.ctx.EdictParser.tryExecute('诏令：清查隐户，重编入黄籍。', {}, {});
  assert(!!purgeHidden.ok, 'huji edict should execute hidden household audit from text');
  assert(edict.ctx.GM.population.hiddenCount === Math.round(hiddenBefore * 0.5),
    'hidden household audit should reduce hiddenCount by the existing engine rule');
  assert(edict.ctx.GM.population.byLegalStatus.huangji.households === huangjiHouseholdsBefore + Math.round(hiddenBefore * 0.5),
    'hidden household audit should move discovered households into huangji');

  const fugitivesBefore = edict.ctx.GM.population.fugitives;
  const taohuBefore = edict.ctx.GM.population.byLegalStatus.taoohu.mouths;
  const huangjiMouthsBefore = edict.ctx.GM.population.byLegalStatus.huangji.mouths;
  const resettle = edict.ctx.EdictParser.tryExecute('诏令：招抚逃户流民，令复业入籍。', {}, {});
  const resettled = Math.round(taohuBefore * 0.3);
  assert(!!resettle.ok, 'huji edict should execute fugitive/refugee resettlement from text');
  assert(edict.ctx.GM.population.fugitives === fugitivesBefore - resettled,
    'resettlement should reduce fugitives by the existing engine rule');
  assert(edict.ctx.GM.population.byLegalStatus.huangji.mouths === huangjiMouthsBefore + resettled,
    'resettlement should move mouths back into huangji');

  const baojia = edict.ctx.EdictParser.tryExecute('诏令：全国编设保甲，十户一牌。', {}, {});
  assert(!!baojia.ok, 'huji edict should execute baojia setup from text');
  assert(edict.ctx.GM.population.byRegion.jingji.baojiaUnits === Math.round(1234 / 10),
    'baojia setup should create ten-household baojia units');
  assert(edict.ctx.GM.population.byRegion.jiangnan.lijiaUnits === Math.round(2000 / 110),
    'baojia setup should also create lijia units by the existing engine rule');

  edict.ctx.GM.population.meta.lastRegistrationTurn = 88;
  const recount = edict.ctx.EdictParser.tryExecute('诏令：重造黄册，清厘天下户籍。', {}, {});
  assert(!!recount.ok, 'huji edict should execute yellow-register recount from text');
  assert(edict.ctx.GM.population.meta.lastRegistrationTurn === 0,
    'yellow-register recount should reset lastRegistrationTurn for the next registration cycle');

  const transfer = edict.ctx.EdictParser.tryExecute('诏令：下拨江南银50000两赈济水灾。', {}, {});
  assert(!!transfer.ok, 'central-local edict should execute regional transfer from text');
  assert(edict.calls.transferOrders.length === 1, 'regional transfer should call EconomyLinkage.createTransferOrder');
  assert(edict.calls.transferOrders[0].toRegion === 'jiangnan', 'regional transfer should resolve 江南 to region id');
  assert(edict.calls.transferOrders[0].amount === 50000, 'regional transfer should parse the transfer amount');

  const force = edict.ctx.EdictParser.tryExecute('诏令：强征山西地方留存30000两，以充军饷。', {}, {});
  assert(!!force.ok, 'central-local edict should execute force levy from text');
  assert(edict.calls.forceLevy.length === 1, 'force levy should call EconomyGapFill.forceLevy');
  assert(edict.calls.forceLevy[0].regionId === 'shanxi', 'force levy should resolve 山西 to region id');
  assert(edict.calls.forceLevy[0].amount === 30000, 'force levy should parse the levy amount');

  const censor = edict.ctx.EdictParser.tryExecute('诏令：派监察御史巡按江南，核其钱粮。', {}, {});
  assert(!!censor.ok, 'central-local edict should dispatch a censor from text');
  assert(edict.calls.censors.length === 1, 'censor edict should call CentralLocalEngine.dispatchCensor');
  assert(edict.calls.censors[0].targetRegion === 'jiangnan', 'censor edict should resolve target region');

  const allocation = edict.ctx.EdictParser.tryExecute('诏令：调整江南分成，起运七成，存留三成。', {}, {});
  assert(!!allocation.ok, 'central-local edict should adjust regional allocation from text');
  assert(edict.calls.allocations.length === 1, 'allocation edict should call CentralLocalEngine.setRegionAllocation');
  assert(edict.calls.allocations[0].regionId === 'jiangnan', 'allocation edict should resolve allocation target region');
  assert(edict.calls.allocations[0].allocSpec.mode === 'qiyun_cunliu', 'allocation edict should use qiyun/cunliu mode');
  assert(Math.abs(edict.calls.allocations[0].allocSpec.perTax.land_grain.qiyun - 0.7) < 0.001,
    'allocation edict should parse 起运七成');
  assert(Math.abs(edict.calls.allocations[0].allocSpec.perTax.land_grain.cunliu - 0.3) < 0.001,
    'allocation edict should parse 存留三成');

  const banLogging = edict.ctx.EdictParser.tryExecute('诏令：禁伐江南山林，严禁樵采。', {}, {});
  assert(!!banLogging.ok, 'environment edict should execute logging ban from text');
  assert(edict.calls.envPolicies[0].policyId === 'jin_hu_kui', 'logging ban should map to jin_hu_kui');
  assert(edict.calls.envPolicies[0].regionId === 'jiangnan', 'logging ban should resolve 江南 region');

  const dredge = edict.ctx.EdictParser.tryExecute('诏令：疏浚江南河道，兴修水利。', {}, {});
  assert(!!dredge.ok, 'environment edict should execute river dredging from text');
  assert(edict.calls.envPolicies[1].policyId === 'yi_he_shui', 'river dredging should map to yi_he_shui');
  assert(edict.calls.envPolicies[1].regionId === 'jiangnan', 'river dredging should resolve 江南 region');

  const reclaim = edict.ctx.EdictParser.tryExecute('诏令：赈灾复耕，屯田养地。', {}, {});
  assert(!!reclaim.ok, 'environment edict should execute disaster recovery farming from text');
  assert(edict.calls.envPolicies[2].policyId === 'tun_tian', 'disaster recovery farming should map to tun_tian');
  assert(edict.calls.envPolicies[2].regionId === undefined, 'national recovery farming should default to all regions');

  const fallow = edict.ctx.EdictParser.tryExecute('诏令：限垦休耕，以养地力。', {}, {});
  assert(!!fallow.ok, 'environment edict should execute fallow/limited cultivation from text');
  assert(edict.calls.envPolicies[3].policyId === 'fan_gu', 'limited cultivation should map to fan_gu');

  const openWaste = edict.ctx.EdictParser.tryExecute('诏令：开荒江南荒田，以增农亩。', {}, {});
  assert(!!openWaste.ok, 'environment edict should execute cautious reclamation from text');
  assert(edict.calls.envPolicies[4].policyId === 'ken_huang', 'cautious reclamation should map to ken_huang');
  assert(edict.calls.envPolicies[4].regionId === 'jiangnan', 'cautious reclamation should resolve 江南 region');

  const memoCentral = makeEdictContext();
  loadEdictParser(memoCentral.ctx);
  const transferMemo = pushMemorial(memoCentral.ctx, {
    typeKey: 'central_local_finance',
    typeName: '央地财政',
    draftText: '户部奏请下拨江南银50000两赈济水灾。',
    draftParams: {}
  });
  const transferAssent = memoCentral.ctx.EdictParser.processImperialAssent(transferMemo.id, 'approve');
  assert(!!transferAssent.ok, 'memorial approval should return ok for central-local policy');
  assert(memoCentral.calls.transferOrders.length === 1,
    'memorial approval should execute central-local policy from draftText');
  assert(memoCentral.calls.transferOrders[0].toRegion === 'jiangnan',
    'memorial approval should preserve the region parsed from draftText');

  const memoEnvironment = makeEdictContext();
  loadEdictParser(memoEnvironment.ctx);
  const envMemo = pushMemorial(memoEnvironment.ctx, {
    typeKey: 'environment_policy',
    typeName: '环境承载',
    draftText: '工部奏请禁伐江南山林，严禁樵采。',
    draftParams: {}
  });
  memoEnvironment.ctx.EdictParser.processImperialAssent(envMemo.id, 'approve');
  assert(memoEnvironment.calls.envPolicies.length === 1,
    'memorial approval should execute environment policy from draftText');
  assert(memoEnvironment.calls.envPolicies[0].policyId === 'jin_hu_kui',
    'memorial approval should infer environment policy from draftText');

  const memoHuji = makeEdictContext();
  loadEdictParser(memoHuji.ctx);
  const hiddenBeforeMemo = memoHuji.ctx.GM.population.hiddenCount;
  const hujiMemo = pushMemorial(memoHuji.ctx, {
    typeKey: 'huji_reform',
    typeName: '户籍制度',
    draftText: '户部奏请清查隐户，重编入黄籍。',
    draftParams: {}
  });
  memoHuji.ctx.EdictParser.processImperialAssent(hujiMemo.id, 'approve');
  assert(memoHuji.ctx.GM.population.hiddenCount === Math.round(hiddenBeforeMemo * 0.5),
    'memorial approval should execute huji policy from draftText');

  const memoCurrency = makeEdictContext();
  loadEdictParser(memoCurrency.ctx);
  const paperMemo = pushMemorial(memoCurrency.ctx, {
    typeKey: 'currency_reform',
    typeName: '货币改革',
    originalEdictText: '户部奏请发交子1000000贯于蜀，准备金三成。',
    draftParams: {}
  });
  memoCurrency.ctx.EdictParser.processImperialAssent(paperMemo.id, 'approve');
  assert(memoCurrency.calls.issuePaper.length === 1,
    'memorial approval should fall back to originalEdictText when draftText is absent');

  const memoTrial = makeEdictContext();
  loadEdictParser(memoTrial.ctx);
  const trialMemo = pushMemorial(memoTrial.ctx, {
    typeKey: 'environment_policy',
    typeName: '环境承载',
    draftText: '工部奏请禁伐江南山林，严禁樵采。',
    draftParams: {}
  });
  assert(memoTrial.ctx.EdictComplete && typeof memoTrial.ctx.EdictComplete.processImperialAssentExtended === 'function',
    'tm-edict-parser should expose extended assent through EdictComplete');
  const trialAssent = memoTrial.ctx.EdictComplete.processImperialAssentExtended(trialMemo.id, 'trial_region', {
    regionId: 'shanxi'
  });
  assert(!!trialAssent.ok && trialAssent.status === 'trial', 'trial-region assent should return trial status');
  assert(memoTrial.calls.envPolicies.length === 1,
    'trial-region assent should execute environment policy from draftText');
  assert(memoTrial.calls.envPolicies[0].regionId === 'shanxi',
    'trial-region assent should pass the selected trial region into the policy bridge');

  console.log('smoke-endturn-policy-bridges OK: ' + passed + ' assertions');
})().catch(function(err) {
  console.error(err && err.stack || err);
  process.exit(1);
});
