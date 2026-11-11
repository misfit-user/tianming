#!/usr/bin/env node
'use strict';
// smoke-collection-loss-once — 旧账路「一笔钱只折一次」（剧本自选 fiscalConfig.collectionLoss.mode='heaviest'，11-11）
//   连乘时：腐败先折、作者侵占率乘进税率、「自主」再折、上解率再折——天启辽饷名义五百零八万只到一百八十五万。
//   选了的剧本：起运按当地腐败、该税侵占率、上解率三者中最重的一项折；存留按腐败与侵占率中较重的折；不乘「自主」。
//   没选的（绍宋，作者照连乘校准、太仓年入约九百五十万贯合李心传「渡江之初东南岁入不满千万」）一文不变。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.env.TM_WEB_ROOT || path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function near(a, b, m) { ok(Math.abs(a - b) <= 1, m + '（得 ' + a + '，应 ' + b + '）'); }

console.log('smoke-collection-loss-once');
const ctx = { console: { log() {}, warn() {}, error() {} }, Date, JSON, Math, GM: null, P: {} };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['tm-patches-start.js', 'tm-fiscal-statements.js', 'tm-fiscal-engine.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
});
const CT = ctx.CascadeTax;
ok(CT && typeof CT.collect === 'function', '级联征税就绪');

// 一个州：田一百万亩、口十万；腐败六十（折两成四）、上解率八成、自主五成
function game(mode, autonomy) {
  const leaf = {
    id: 'd1', name: '测试州', population: 100000,
    populationDetail: { households: 20000, mouths: 100000, ding: 40000 },
    corruption: 60,
    fiscalDetail: { compliance: 0.8, autonomyLevel: autonomy, skimmingRate: 0.1 },
    economyBase: { farmland: 1000000 }
  };
  const fc = {
    taxList: [{ id: 'land', name: '田赋', base: 'arableLand', baseFactor: 1, rate: 0.01, storeAs: 'money', sourceTag: 'tianfu', annual: true }],
    customTaxes: [
      { id: 'liao', name: '辽饷', formulaType: 'perMu', nominalRate: 0.009, occupationRate: 0 },
      { id: 'cg', name: '钞关', formulaType: 'flat', amount: 100000, occupationRate: 0.6 }
    ],
    centralLocalRules: { perTax: { land: { qiyun: 0.5, cunliu: 0.5 }, liao: { qiyun: 1, cunliu: 0 }, cg: { qiyun: 1, cunliu: 0 } } },
    logisticsLoss: 0
  };
  if (mode) fc.collectionLoss = { mode };
  return { turn: 0, adminHierarchy: { player: { divisions: [leaf] } }, fiscalConfig: fc };
}
function run(mode, autonomy) {
  ctx.GM = game(mode, autonomy);
  const r = CT.collect({ faction: 'player', turnDays: 365, force: true });
  ok(r && r.ok !== false, (mode || '连乘') + '：征收成功');
  const leaf = ctx.GM.adminHierarchy.player.divisions[0];
  const c = r.totals.contribByCategory;
  const pick = (k) => Math.round(Object.values(c[k] || {}).reduce((s, v) => s + v, 0));
  return { land: pick('tianfu'), liao: pick('liao'), cg: pick('cg'), central: Math.round(r.totals.central.money), local: Math.round(r.totals.localRetain.money), leaf };
}

// 1. 选了「取最重一项」：名义田赋一万、辽饷九千、钞关二百（按口数摊到这一州）
{
  const r = run('heaviest', 0.5);
  const F = r.leaf.economyBase.farmland; // 征税前先结一回田亩流转，田数略有出入
  near(r.land, Math.round(F * 0.01 * 0.5 * 0.76), '田赋起运：一半 × min(1−0.24, 上解0.8)，约三千八');
  near(r.local, Math.round(F * 0.01 * 0.5 * 0.76), '田赋存留：一半 × (1−0.24)，约三千八');
  near(r.liao, Math.round(F * 0.009 * 0.76), '辽饷全起运：× 0.76，约六千八百四十');
  near(r.cg, 80, '钞关侵占六成最重：二百 × 0.4 = 八十（不再先乘侵占、再乘腐败与上解）');
  const r2 = run('heaviest', 0.9);
  ok(r2.central === r.central, '选了的不乘「自主」：自主五成与九成太仓所得相同');
  // 预估与实征同一口径（征过一回后田数已定，预估不再结田亩流转）
  const r3 = run('heaviest', 0.5);
  const pv = CT.previewRevenue({ turnDays: 365, settleProduction: false });
  near(Math.round(pv.totals.central.money), r3.central, '预估起运与实征一致');
}

// 2. 没选：连乘照旧（绍宋口径）
{
  const r = run(null, 0.5);
  const F = r.leaf.economyBase.farmland;
  // 田赋：一万 × (1−0.24) × (1−0.5×0.8) = 四千五百六十；起运一半 × 上解0.8 = 一千八百二十四
  near(r.land, Math.round(Math.round(F * 0.01 * 0.76 * 0.6) * 0.5 * 0.8), '没选：田赋起运照旧连乘（约一千八百二十四）');
  near(r.liao, Math.round(Math.round(F * 0.009 * 0.76 * 0.6) * 0.8), '没选：辽饷照旧连乘（约三千二百八十三）');
  near(r.cg, 29, '没选：钞关侵占先乘进税率、再连乘（二十九）');
  const r2 = run(null, 0.9);
  ok(r2.central < r.central, '没选：「自主」照旧折（自主九成比五成少收）');
}

console.log('\n结果: ' + A + ' 通过 / 0 失败');
