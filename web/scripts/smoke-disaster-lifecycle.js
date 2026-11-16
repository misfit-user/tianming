#!/usr/bin/env node
'use strict';
// smoke-disaster-lifecycle — 灾害生命周期 + 赈灾挂钩(真 bug:activeDisasters 永不消除→国库永久失血·开仓与灾害脱钩)
// vm 载入真 GuokuEngine·实跑 tickDisasters / Actions.openGranary
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, String, Number, Array, Object, RegExp, parseInt, parseFloat, isFinite, isNaN, Date: { now: () => 0 } };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
ctx.turnsForMonths = function (m) { return m; }; // 身份映射:灾种月数=回合数(便于断言)
ctx.addEB = function () {};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-minxin-ledger.js'), 'utf8'), ctx, { filename: 'tm-minxin-ledger.js' });   // 民心已收口走总闸(2026-07-04)·沙箱须与运行时同形态
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-guoku-engine.js'), 'utf8'), ctx, { filename: 'tm-guoku-engine.js' });
const GE = ctx.GuokuEngine;

console.log('smoke-disaster-lifecycle');
ok(GE && typeof GE.tickDisasters === 'function', '① GuokuEngine.tickDisasters 已导出');

// ─────────── tickDisasters 到期出队 ───────────
function setDis(list) { ctx.GM = { turn: 0, activeDisasters: list, guoku: { balance: 2000000 }, minxin: { trueIndex: 50 } }; }
setDis([
  { category: 'flood', region: '两淮', startedTurn: 0, duration: 2 },
  { category: 'drought', region: '陕西', startedTurn: 0, duration: 5 },
  { category: 'quake', region: '山西', startedTurn: 0, duration: 1 }
]);
ctx.GM.turn = 0; ok(GE.tickDisasters() === 0 && ctx.GM.activeDisasters.length === 3, '② 第0回:无到期(elapsed 0<dur)·3 灾仍在');
ctx.GM.turn = 1; ok(GE.tickDisasters() === 1 && ctx.GM.activeDisasters.length === 2 && !ctx.GM.activeDisasters.some(d => d.category === 'quake'), '③ 第1回:地震(dur1)平息·剩 2');
ctx.GM.turn = 2; ok(GE.tickDisasters() === 1 && !ctx.GM.activeDisasters.some(d => d.category === 'flood'), '④ 第2回:水灾(dur2)平息');
ctx.GM.turn = 5; GE.tickDisasters(); ok(ctx.GM.activeDisasters.length === 0, '⑤ 第5回:旱灾(dur5)平息·全清空');

// ★swap-test:旧码无 tickDisasters → 灾害恒驻(永久失血)·新 tick 到期出队
setDis([{ category: 'drought', region: '陕西', startedTurn: 0, duration: 5 }]);
// 不调 tick:模拟旧行为·灾害恒在(zhenzi 永久扣)
ctx.GM.turn = 99; ok(ctx.GM.activeDisasters.length === 1, '⑥ ★swap:不 tick(旧码)→灾害恒驻(第99回仍在·永久失血根因)');
GE.tickDisasters(); ok(ctx.GM.activeDisasters.length === 0, '⑥ ★swap:调 tick(新码)→早该平息的灾害出队(失血有界)');

// ─────────── 老存档兜底:无 duration 字段 → 按 category 推算 ───────────
setDis([{ category: 'plague', region: '江南', startedTurn: 0 }]); // 无 duration·plague→4回合
ctx.GM.turn = 3; GE.tickDisasters(); ok(ctx.GM.activeDisasters.length === 1, '⑦ 无 duration 老灾:第3回未到(plague 推算 4 回合)');
ctx.GM.turn = 4; GE.tickDisasters(); ok(ctx.GM.activeDisasters.length === 0, '⑦ 无 duration 老灾:第4回按 category 推算平息(兜底鲁棒)');

// ─────────── openGranary 赈灾真挂钩 ───────────
setDis([
  { category: 'drought', region: '陕西', startedTurn: 0, duration: 6 },
  { category: 'flood', region: '两淮', startedTurn: 0, duration: 4 }
]);
let r = GE.Actions.openGranary('national');
ok(r.success && r.relieved === 2, '⑧ 国赈(national)→标记全部 2 灾已赈');
ok(ctx.GM.activeDisasters.every(d => d._relieved === true), '⑧ 两灾 _relieved=true');
// 已赈→寿命减半:drought 6→ceil(3)=3·第3回平息
ctx.GM.turn = 3; GE.tickDisasters();
ok(!ctx.GM.activeDisasters.some(d => d.category === 'drought'), '⑨ ★已赈旱灾寿命减半(6→3)·第3回平息(赈灾真加速)');

// 区域匹配:只赈指定区
setDis([
  { category: 'drought', region: '陕西', startedTurn: 0, duration: 6 },
  { category: 'flood', region: '两淮', startedTurn: 0, duration: 4 }
]);
r = GE.Actions.openGranary('regional', '陕西');
ok(r.relieved === 1 && ctx.GM.activeDisasters[0]._relieved === true && !ctx.GM.activeDisasters[1]._relieved, '⑩ 指定区赈(陕西)→只陕西 _relieved·两淮不动');

// 民心:无灾空赈 → 增益减半(防刷)
setDis([]); ctx.GM.minxin.trueIndex = 50;
GE.Actions.openGranary('regional'); // regional 基础 +8·无灾减半 → +4
ok(ctx.GM.minxin.trueIndex === 54, '⑪ 无灾空赈·民心增益减半(+8→+4)·实=' + ctx.GM.minxin.trueIndex);
// 有灾实赈 → 全额
setDis([{ category: 'flood', region: '两淮', startedTurn: 0, duration: 4 }]); ctx.GM.minxin.trueIndex = 50;
GE.Actions.openGranary('regional', '两淮');
ok(ctx.GM.minxin.trueIndex === 58, '⑪ 有灾实赈·民心全额(+8)·实=' + ctx.GM.minxin.trueIndex);

// 帑廪不足 → 失败不扣不赈
setDis([{ category: 'flood', region: '两淮', startedTurn: 0, duration: 4 }]); ctx.GM.guoku.balance = 10000;
r = GE.Actions.openGranary('national');
ok(r.success === false && !ctx.GM.activeDisasters[0]._relieved, '⑫ 帑廪不足→失败·不标记已赈');

// 源契约

console.log('\n结果: ' + A + ' 通过 / 0 失败');
