#!/usr/bin/env node
'use strict';
// smoke-pay-arrears-flow — 欠饷扣军心，每欠一个月扣一次（11-11）
//   原先 applyPayArrearsPressure 每回合按积欠总月数整笔重扣：欠五个月的军每回合扣五十士气。
//   天启开局三个月内关宁军八万剩两万四、东江三万剩九千、「全国卫所军·总览」一百三十万剩三十九万，都是「欠饷哗变」。
//   改为：只扣新欠的那几个月；补饷降下来按降后的数记；开局所欠是剧本底子，开局记作已扣。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = process.env.TM_WEB_ROOT || path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

console.log('smoke-pay-arrears-flow');
const ctx = {
  console: { log() {}, warn() {}, error() {} }, Date, JSON, Math, RegExp, Error, Array, Object, String, Number, Boolean, Map, Set, parseInt, parseFloat, isFinite, isNaN, setTimeout() {}, clearTimeout() {},
  TM: {}, GM: { turn: 1, chars: [], armies: [], facs: [] }, P: {}, scriptData: {},
  SettlementPipeline: { register() {} }, EndTurnHooks: { register() {} },
  getTimeRatio: () => 1 / 12, _dbg() {}, addEB() {}, toast() {}
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
['tm-engine-constants.js', 'tm-faction-membership.js', 'tm-military.js'].forEach((f) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, f), 'utf8'), ctx, { filename: f });
});
const MS = ctx.MilitarySystems;
ok(MS && typeof MS.applyPayArrearsPressure === 'function' && typeof MS.initializeArmyArrears === 'function', '军务写口就绪');

function game(armies) { return { turn: 1, engineConstants: ctx.TM.EngineConstants.getTemplate('generic'), armies, _militaryPayArrearsLog: [] }; }
function tick(G, n) { for (let i = 0; i < n; i++) { G.turn++; G.armies.forEach((a) => MS.applyPayArrearsPressure(a, { source: 'smoke' }, G)); } }

// 1. 开局欠五个月、士气五十五：开局记作已扣，此后三回合欠数不涨，士气不动、不溃
{
  const dongjiang = { name: '东江镇军', soldiers: 30000, payArrearsMonths: 5, morale: 55, loyalty: 50 };
  const weisuo = { name: '全国卫所军·总览', soldiers: 1300000, payArrearsMonths: 4, morale: 32, loyalty: 60 };
  const G = game([dongjiang, weisuo]);
  MS.initializeArmyArrears({ game: G });
  tick(G, 3);
  ok(dongjiang.morale === 55 && !dongjiang.routed, '开局欠五个月：三回合后士气仍五十五、未溃（旧码第一回合扣到五）');
  ok(weisuo.morale === 32 && !weisuo.routed, '卫所总览开局欠四个月：士气仍三十二');
  ok(G._militaryPayArrearsLog.length === 0, '开局底子不记扣饷');
}

// 2. 欠数涨一个月扣一次十点，再一回合欠数不变不再扣
{
  const a = { name: '宣府镇军', soldiers: 28000, payArrearsMonths: 2, morale: 55, loyalty: 65 };
  const G = game([a]);
  MS.initializeArmyArrears({ game: G });
  a.payArrearsMonths = 3; tick(G, 1);
  ok(a.morale === 45 && a.loyalty === 60, '欠数二涨到三：士气扣十、忠诚扣五（55→45，65→60）');
  tick(G, 2);
  ok(a.morale === 45, '欠数停在三：此后两回合不再扣');
  ok(G._militaryPayArrearsLog.length === 1 && G._militaryPayArrearsLog[0].newMonths === 1, '只记一笔、写明新欠一个月');
}

// 3. 补饷降到一个月，日后再欠到二：只扣一次
{
  const a = { name: '大同镇军', soldiers: 35000, payArrearsMonths: 4, morale: 60, loyalty: 65 };
  const G = game([a]);
  MS.initializeArmyArrears({ game: G });
  a.payArrearsMonths = 1; tick(G, 1);
  ok(a.morale === 60, '补饷降到一个月：不扣');
  a.payArrearsMonths = 2; tick(G, 1);
  ok(a.morale === 50, '从一个月再欠到两个月：扣十（不是按四个月前的旧账）');
}

// 4. 局中新欠的军（没记过）：欠三个月扣三十一次，之后不再重扣
{
  const a = { name: '新募营', soldiers: 5000, payArrearsMonths: 3, morale: 50, loyalty: 60 };
  const G = game([a]);
  tick(G, 1);
  ok(a.morale === 20 && a.loyalty === 45, '没记过的军欠三个月：扣三十（50→20）');
  tick(G, 2);
  ok(a.morale === 20 && !a.routed, '此后两回合欠数不涨：不再重扣、不溃（旧码第二回合即扣到零、溃散）');
}

console.log('\n结果: ' + A + ' 通过 / 0 失败');
