#!/usr/bin/env node
// smoke-ledger-consistency.js — 两本账一致性不变量网（2026-07-04·写口收口三刀的永久回归网）
//
// 背景：gm:minxin/gm:guoku 收口后，所有民心/国库变动应走 MinxinLedger/FiscalEngine。
// 本 smoke 在【带叶子地图】的 GM 上（此前多数 engine smoke 无叶子·恰恰漏掉聚合路径）
// 连续施加两类账目操作，并在每步后断言三条不变量：
//   INV1 财政三位一体：GM.guoku.balance === GM.guoku.money === ledgers.money.stock
//   INV2 民心缓存一致：mx.trueIndex === aggregateTrue(叶子人口加权) 重算值
//   INV3 民心效果落地：走闸的 delta 落在叶子上·再次聚合【不蒸发】（收口前的病灶）
// 另验：探测缓存持久化收口不破坏无 saveP 沙箱（_persistProbeConf 静默跳过）。

'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed++; console.log('  PASS', msg); }
  else { failed++; console.error('  FAIL', msg); }
}
function near(a, b, eps, msg) { ok(Math.abs(a - b) <= (eps || 0.02), msg + '（' + a + ' ≈ ' + b + '）'); }

const ctx = { console: { log(){}, warn(){}, error(){}, info(){} }, Date, JSON, Math, Object, Array, Number, String, Boolean, RegExp, isFinite, isNaN, parseInt, parseFloat, setTimeout: (f)=>{f();return 0;}, clearTimeout(){}, Error };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['tm-minxin-ledger.js', 'tm-fiscal-engine.js'].forEach(f =>
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f }));

// ── 带叶子的 GM：三省叶子·人口加权·minxin 各异 ──
const GM = {
  turn: 10, running: true,
  guoku: { balance: 100000, money: 100000, grain: 50000, cloth: 1000 },
  minxin: {},
  adminHierarchy: {
    '大明': { divisions: [
      { id: 'p1', name: '北直隶', level: 'province', minxin: 60, population: 8000000, divisions: [] },
      { id: 'p2', name: '山东',   level: 'province', minxin: 40, population: 6000000, divisions: [] },
      { id: 'p3', name: '河南',   level: 'province', minxin: 50, population: 6000000, divisions: [] }
    ] }
  }
};
ctx.GM = GM; ctx.P = { conf: {} }; ctx.scriptData = GM;

const ML = ctx.TM.MinxinLedger;
const FE = ctx.FiscalEngine;

function assertFiscalTrinity(tag) {
  const g = GM.guoku;
  const stock = g.ledgers && g.ledgers.money ? g.ledgers.money.stock : NaN;
  ok(g.balance === g.money && g.money === stock, 'INV1 财政三位一体·' + tag + '（balance=' + g.balance + ' money=' + g.money + ' stock=' + stock + '）');
}
function assertMinxinCoherent(tag) {
  const before = GM.minxin.trueIndex;
  const recomputed = ML.aggregateTrue(GM);
  near(before, recomputed, 0.02, 'INV2 民心缓存≡叶子聚合·' + tag);
}

// ── ① 财政收支连环：入账→扣账→亏空扣账 ──
FE.addToGuoku({ money: 20000, grain: 3000 }, '测试入账');
assertFiscalTrinity('入账后');
FE.spendFromGuoku({ money: 50000 }, '测试支出');
assertFiscalTrinity('支出后');
ok(GM.guoku.balance === 70000, '① 账目算数正确（100000+20000-50000=70000·实=' + GM.guoku.balance + '）');
FE.spendFromGuoku({ money: 999999 }, '超额支出');
assertFiscalTrinity('亏空扣账后');
ok(GM.guoku.balance === 0, '① 亏空不打负余额·落0（实=' + GM.guoku.balance + '）');
ok(GM.guoku.ledgers.money.deficit > 0, '① 亏空入 deficit 账（=' + GM.guoku.ledgers.money.deficit + '·破产链可读）');
ok(GM.guoku.ledgers.money.sinks['超额支出_欠'] > 0, '① 欠账按 sink 记名（超额支出_欠）');

// ── ② 民心走闸：效果落叶·聚合不蒸发 ──
const t0 = ML.aggregateTrue(GM);
ML.recordAndApply(GM, { sourceSystem: 'consistency-test', kind: 'testKindA', delta: -6, reason: '测试负项' });
const t1 = GM.minxin.trueIndex;
ok(t1 < t0, '② 走闸负项生效（' + t0 + ' → ' + t1 + '）');
assertMinxinCoherent('负项后');
// 再聚合三次模拟回合流·效果不得蒸发（收口前直写 trueIndex 就是在这里被冲掉的）
ML.aggregateTrue(GM); ML.aggregateTrue(GM); ML.aggregateTrue(GM);
near(GM.minxin.trueIndex, t1, 0.02, '② 三次重聚合后效果仍在·不蒸发');
// 叶子确实动了
ok(GM.adminHierarchy['大明'].divisions.every(d => d.minxin < ({p1:60,p2:40,p3:50})[d.id]), '② delta 真落在三省叶子上');

// ── ③ 按源封顶：同源灌注锁在 _default 区间 ──
for (let i = 0; i < 10; i++) ML.recordAndApply(GM, { sourceSystem: 'consistency-test', kind: 'testKindA', delta: -6, reason: '连续灌注' });
ok(Math.abs(GM.minxin.sources.testKindA) <= 20.01, '③ 同源累计封顶于 _default ±20（实=' + GM.minxin.sources.testKindA + '）');
assertMinxinCoherent('灌注封顶后');
const floorT = GM.minxin.trueIndex;
ML.recordAndApply(GM, { sourceSystem: 'consistency-test', kind: 'testKindB', delta: 5, reason: '另源正项' });
ok(GM.minxin.trueIndex > floorT, '③ 另源不受此源封顶牵连·仍可推动');

// ── ④ 收口后的直写确实是死路（反证·防有人回退范式） ──
GM.minxin.trueIndex = 99; // 模拟绕闸直写
ML.aggregateTrue(GM);
ok(GM.minxin.trueIndex < 99, '④ 直写缓存被聚合冲掉=死路实证（守卫红线的机理背书）');

// ── ⑤ 探测持久化收口的沙箱安全：无 saveP 环境静默跳过 ──
const infraSrc = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
ok(/function _persistProbeConf\(\)/.test(infraSrc) && /typeof saveP === 'function'/.test(infraSrc), '⑤ 探测持久化存在且 guarded（无 saveP 沙箱安全）');

console.log('\n[smoke-ledger-consistency] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
