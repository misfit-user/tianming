#!/usr/bin/env node
'use strict';
// smoke-guoku-annual-expense-sync — 帑廪月结按真账同步年支（11-14）
//   本回合征过税（cascade 跑过、钱账有进项）时，月结从钱账反算月入、月支、年入；年支原先没跟着同步，
//   停在固定支出（俸禄、军饷、宗禄）那一段，截川纲、赈济、工程等每回合另走的不在内——推演给 AI 的国用摘要月支、年支对不上。
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = process.env.TM_WEB_ROOT || path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

console.log('smoke-guoku-annual-expense-sync');
const ctx = {
  console: { log() {}, warn() {}, error() {} }, Math, Date, JSON, Array, Object, Number, String, RegExp, parseFloat, parseInt, isFinite,
  setTimeout() {}, clearTimeout() {}, document: { readyState: 'complete', addEventListener() {} }, addEventListener() {},
  addEB() {}, toast() {}, renderTopBarVars() {}, getTSText: (t) => 'T' + t, _getDaysPerTurn: () => 30
};
ctx.window = ctx; ctx.globalThis = ctx;
ctx.TM = { errors: { capture() {}, captureSilent() {} } };
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-guoku-engine.js'), 'utf8'), ctx, { filename: 'tm-guoku-engine.js' });

ctx.GM = {
  turn: 5, hukou: { registeredTotal: 10000000, households: 2000000, ding: 2500000 }, minxin: { trueIndex: 65 },
  huangquan: { index: 70 }, huangwei: { index: 70 }, corruption: { subDepts: {}, sources: {} },
  chars: [], facs: [], parties: [], classes: [], armies: [], _turnReport: [], turnChanges: { variables: [], characters: [] }
};
const G = ctx.GM;
ctx.GuokuEngine.ensureModel();
G.guoku.balance = G.guoku.money = G.guoku.ledgers.money.stock = 4000000;
// 本回合已征税（cascade 跑过）：钱账进 784000、出 780000，其中固定支出（军饷、宗禄）只有 562000
G._lastCascadeTurn = G.turn;
G.guoku.ledgers.money.thisTurnIn = 784000;
G.guoku.ledgers.money.thisTurnOut = 780000;
G.guoku.annualExpense = 6839000;   // fixedCollect 只按固定支出写的年额
ctx.GuokuEngine.monthlySettle(1);
const out = G.guoku.ledgers.money.thisTurnOut;
ok(G.guoku.monthlyExpense === Math.round(out), '月支按钱账本回合实出：' + G.guoku.monthlyExpense);
ok(G.guoku.annualExpense === Math.round(G.guoku.monthlyExpense * 12), '年支＝月支×12，与年入同口径：' + G.guoku.annualExpense);
ok(G.guoku.annualExpense !== 6839000, '不再停在只算固定支出的年额');
ok(G.guoku.annualIncome === Math.round(G.guoku.monthlyIncome * 12), '年入照旧＝月入×12');
ok(Math.abs((G.guoku.annualIncome - G.guoku.annualExpense) - 12 * (G.guoku.monthlyIncome - G.guoku.monthlyExpense)) < 1, '年入年支之差＝月入月支之差×12（不再凭空差出两百余万）');

// 本回合没征过税（cascade 没跑）：照旧不按钱账改写
ctx.GM = Object.assign({}, G, { turn: 9, _lastCascadeTurn: 3 });
const H = ctx.GM;
H.guoku = JSON.parse(JSON.stringify(G.guoku));
H.guoku.ledgers.money.thisTurnIn = 0; H.guoku.ledgers.money.thisTurnOut = 0;
H.guoku.annualExpense = 1234;
ctx.GuokuEngine.monthlySettle(1);
ok(H.guoku.annualExpense === 1234, '没征过税的回合不按钱账改写年支');

console.log('PASS guoku-annual-expense-sync ' + A + ' assertions');
