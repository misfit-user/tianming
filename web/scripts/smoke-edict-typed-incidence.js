#!/usr/bin/env node
/* eslint-env node */
// smoke-edict-typed-incidence.js — F·改革杠杆 typed-incidence（2026-06-16）实跑断言
//   eval 真 tm-edict-lifecycle.js → 调 window.applyEdictTypedIncidence（真 classifyEdict + EDICT_TYPES + 真 gate 仿桩）。
//   验：标签路由命中真 GM.classes（含跨键聚合取最大绝对值防叠加）· 非阶层键跳过 · 盲 fallback 不施 ·
//       gateSatisfaction ±14 预算夹（双计上界）· source 记账 · 邸报向背。
'use strict';

const fs = require('fs'), path = require('path'), vm = require('vm');
const WEB = path.join(__dirname, '..');
const src = fs.readFileSync(path.join(WEB, 'tm-edict-lifecycle.js'), 'utf8');

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }
function r2(n) { return Math.round(Number(n) * 100) / 100; }

// 真 gate 仿桩（±14/回合/阶层预算·记 _satLedger·同 tm-class-engine.gateSatisfaction 语义）
function makeGate() {
  return { gateSatisfaction: function (root, cls, raw, info) {
    var budget = 14;
    if (!cls._satBudget || cls._satBudget.turn !== info.turn) cls._satBudget = { turn: info.turn, used: 0 };
    var room = Math.max(0, budget - cls._satBudget.used);
    var approved = Math.max(-room, Math.min(room, raw));
    var before = Number(cls.satisfaction); if (!isFinite(before)) before = 50;
    cls.satisfaction = Math.max(0, Math.min(100, before + approved));
    cls._satBudget.used += Math.abs(approved);
    (cls._satLedger = cls._satLedger || []).push({ source: info.source, reason: info.reason, approved: approved });
    return { approved: approved, before: before, after: cls.satisfaction, capped: approved !== raw };
  } };
}
let ebLog = [];
const ctx = { window: {}, TM: { ClassEngine: makeGate() }, addEB: function (c, m) { ebLog.push(c + '·' + m); },
  console: console, Math: Math, Number: Number, Object: Object, Array: Array, isFinite: isFinite, String: String };
vm.createContext(ctx);
vm.runInContext(src, ctx);
const applyF = ctx.window.applyEdictTypedIncidence;

function mkGM() {
  return { turn: 5, classes: [
    { name: '自耕农', economicRole: '生产', satisfaction: 50 },
    { name: '商人', economicRole: '商贸', satisfaction: 50 },
    { name: '缙绅', economicRole: '治理', satisfaction: 50 },
    { name: '军户', economicRole: '军事', satisfaction: 50 }
  ] };
}
function byName(g, n) { return g.classes.filter(function (c) { return c.name === n; })[0]; }

console.log('smoke-edict-typed-incidence — F 改革杠杆 typed-incidence');
ok(typeof applyF === 'function', 'window.applyEdictTypedIncidence 导出');

// 1. 减税：农民/商贾 受惠（标签路由）· 国库键跳过 · 无关阶层不动
ebLog = [];
const g1 = mkGM();
const r1 = applyF(g1, '蠲免钱粮，减赋税', { turn: 5 });
ok(r1 && r1.type === 'tax_reduction', '分类→tax_reduction (got ' + (r1 && r1.type) + ')');
ok(r2(byName(g1, '自耕农').satisfaction) === 57.5, '减税·自耕农(农民键)+15×0.5=+7.5 (got ' + byName(g1, '自耕农').satisfaction + ')');
ok(r2(byName(g1, '商人').satisfaction) === 54, '减税·商人(商贾键)+8×0.5=+4 (got ' + byName(g1, '商人').satisfaction + ')');
ok(byName(g1, '缙绅').satisfaction === 50 && byName(g1, '军户').satisfaction === 50, '减税·无关阶层(缙绅/军户)不动·国库键跳过');
ok(ebLog.some(function (e) { return /阶层向背/.test(e) && /利/.test(e); }), '邸报·阶层向背(利农民/商贾)');

// 2. 经改：士绅+豪强双键同砸缙绅→取最大绝对值(−25)防人为叠加
const g2 = mkGM();
applyF(g2, '清丈田亩，行一条鞭', { turn: 5 });
ok(r2(byName(g2, '缙绅').satisfaction) === 37.5, '经改·缙绅(士绅∪豪强键·取max|Δ|=−25×0.5=−12.5·非−45) (got ' + byName(g2, '缙绅').satisfaction + ')');
ok(byName(g2, '自耕农').satisfaction === 50 && byName(g2, '商人').satisfaction === 50, '经改·非士绅类不动(国库键跳过)');

// 3. 盲 fallback：无任何关键词→classifyEdict 默认 amnesty·但不施（防误砸）
const g3 = mkGM();
const r3 = applyF(g3, '朕心甚慰，尔其勉之', { turn: 5 });
ok(r3 === null, '★盲 fallback(无关键词)→不施(防默认 amnesty 误砸)');
ok(g3.classes.every(function (c) { return c.satisfaction === 50; }), '盲 fallback·全阶层不动');

// 4. gateSatisfaction ±14 预算夹（双计上界）：同回合连下两道加派
const g4 = mkGM();
applyF(g4, '加派辽饷', { turn: 5 });   // 农民−20×0.5=−10
const zg = byName(g4, '自耕农');
ok(r2(zg.satisfaction) === 40, '加派一道·自耕农−10 (got ' + zg.satisfaction + ')');
applyF(g4, '加派辽饷', { turn: 5 });   // 再−10·但预算仅余4→夹至−4
ok(r2(zg.satisfaction) === 36 && r2(zg._satBudget.used) === 14, '★同回合双计被 ±14 闸夹(自耕农止于−14·used14) (got ' + zg.satisfaction + '/' + zg._satBudget.used + ')');

// 5. 非阶层键跳过 + 0 值键跳过：大赦(农民+8/囚犯+30/官僚0)只施农民
const g5 = mkGM();
const r5 = applyF(g5, '大赦天下，赦免', { turn: 5 });
ok(r5 && r5.type === 'amnesty' && r5.applied.length === 1 && r5.applied[0].name === '自耕农', '大赦·只施农民键(囚犯非阶层跳过·官僚0值跳过) (' + (r5 ? r5.applied.map(function (a) { return a.name; }).join(',') : '') + ')');

// 6. source 记账（_satLedger 标 edict-typed-incidence:type）
ok((byName(g1, '自耕农')._satLedger || []).some(function (l) { return /^edict-typed-incidence:tax_reduction/.test(l.source); }), 'source 记账·_satLedger 标 edict-typed-incidence:type');

// 7. 源契约：仅玩家路径(processEdictEffects)挂钩·不在 AI 路径

console.log('\n[smoke-edict-typed-incidence] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
