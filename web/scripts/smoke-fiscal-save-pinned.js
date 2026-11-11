#!/usr/bin/env node
'use strict';
// smoke-fiscal-save-pinned — 旧档不从新剧本拾口径开关（11-11）
//   新开局时剧本财政配置整份存进 GM.fiscalConfig（带 productionTaxVersion）。此后剧本才加的口径开关
//   （折损取最重 collectionLoss、路损 logisticsLoss），存档那份里没有，就照开局时的口径算，不从新剧本层拾。
//   原先照拾：甲之前开局的天启旧档一读，太仓起运年额由四百八十余万跳到九百一十余万。
//   开局在整份配置之前的旧档：collectionLoss 不拾；剧本在 legacyTaxConfig 里写明的旧档口径（固定支出、内帑规则、路损）照写明的算。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.env.TM_WEB_ROOT || path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

console.log('smoke-fiscal-save-pinned');
const ctx = { console: { log() {}, warn() {}, error() {} }, Date, JSON, Math, GM: null, P: {} };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['tm-patches-start.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
});
const CT = ctx.CascadeTax, FX = ctx.FixedExpense;
ok(CT && typeof CT.collect === 'function' && FX && typeof FX.preview === 'function', '级联征税、固定支出就绪');

const clone = (x) => JSON.parse(JSON.stringify(x));
const taxes = {
  taxList: [{ id: 'land', name: '田赋', base: 'arableLand', baseFactor: 1, rate: 0.01, storeAs: 'money', sourceTag: 'tianfu', annual: true }],
  customTaxes: [{ id: 'liao', name: '辽饷', formulaType: 'perMu', nominalRate: 0.009, occupationRate: 0 }],
  centralLocalRules: { perTax: { land: { qiyun: 0.5, cunliu: 0.5 }, liao: { qiyun: 1, cunliu: 0 } } }
};
// 现行剧本：整份配置，带取最重的折损口径、路损记零；旧档口径写在 legacyTaxConfig
const scenarioFc = Object.assign(clone(taxes), {
  productionTaxVersion: 1,
  collectionLoss: { mode: 'heaviest' },
  logisticsLoss: 0,
  fixedExpense: { armyMonthlyPay: { money: 1, grain: 0, cloth: 0 } },
  legacyTaxConfig: Object.assign(clone(taxes), { logisticsLoss: 0.15, fixedExpense: { armyAnnualOverride: { money: 1200, grain: 0, cloth: 0 } } })
});

function world(gfc, opts) {
  opts = opts || {};
  const leaf = {
    id: 'd1', name: '测试州', population: 100000,
    populationDetail: { households: 20000, mouths: 100000, ding: 40000 },
    corruption: 60,
    fiscalDetail: { compliance: 0.8, autonomyLevel: 0.5, skimmingRate: 0.1 },
    economyBase: { farmland: 1000000 }
  };
  ctx.findScenarioById = opts.noScenario ? undefined : (id) => (id === 'tq' ? { id: 'tq', fiscalConfig: scenarioFc } : null);
  ctx.GM = { sid: 'tq', turn: 3, _isFreshNewGame: false, adminHierarchy: { player: { divisions: [leaf] } }, fiscalConfig: gfc, armies: [] };
  return ctx.GM;
}
function central(gfc, opts) {
  world(gfc, opts);
  const r = CT.collect({ faction: 'player', turnDays: 365, force: true });
  ok(r && r.ok !== false, '征收成功');
  return Math.round(r.totals.central.money);
}
// 参照：不经剧本层，直接写明口径
const refHeaviest = central(Object.assign(clone(taxes), { collectionLoss: { mode: 'heaviest' }, logisticsLoss: 0 }), { noScenario: true });
const refChain = central(clone(taxes), { noScenario: true }); // 连乘、默认路损一成五
ok(refHeaviest !== refChain, '两种口径太仓所得不同（取最重 ' + refHeaviest + '，连乘 ' + refChain + '）');

// 1. 新开局：存档那份是剧本整份克隆，带开关——照新口径
ok(central(clone(scenarioFc)) === refHeaviest, '新开局：照存档里写明的取最重口径、路损零');

// 2. 甲之前开局的存档：整份配置里没有这两项——照开局时的连乘、默认路损，不从新剧本层拾
{
  const old = clone(scenarioFc); delete old.collectionLoss; delete old.logisticsLoss;
  ok(central(old) === refChain, '旧档（整份配置无开关）：照开局时口径连乘、路损一成五，不拾新剧本的取最重与路损零');
  world(clone(old));
  const pv = CT.previewRevenue({ turnDays: 365, settleProduction: false });
  CT.collect({ faction: 'player', turnDays: 365, force: true });
  const pv2 = CT.previewRevenue({ turnDays: 365, settleProduction: false });
  ok(pv && pv2 && Math.abs(Math.round(pv2.totals.central.money) - refChain) <= 1, '旧档预估与实征同一口径');
}

// 3. 存档那份自己写了开关的，照存档写的（哪怕与剧本不同）
{
  const own = clone(scenarioFc); own.collectionLoss = { mode: 'chain' }; own.logisticsLoss = 0.15;
  ok(central(own) === refChain, '存档写明连乘与一成五：照存档');
}

// 4. 开局在整份配置之前的旧档：税表等照 legacyTaxConfig，取最重口径不拾，路损、固定支出照 legacyTaxConfig 写明的
{
  ok(central({ taxes: {} }) === refChain, '整份配置之前的旧档：连乘、路损照 legacyTaxConfig 的一成五');
  world({ taxes: {} });
  const fx = FX.preview({ turnDays: 365 });
  ok(Math.round(fx.army.money) === 1200, '整份配置之前的旧档：军饷照 legacyTaxConfig 写明的年额（得 ' + Math.round(fx.army.money) + '）');
  world(clone(scenarioFc));
  const fxNew = FX.preview({ turnDays: 365 });
  ok(Math.round(fxNew.army.money) === 0, '新开局：没有军就没有军饷，不拾旧档年额');
}

console.log('\n结果: ' + A + ' 通过 / 0 失败');
