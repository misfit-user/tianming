#!/usr/bin/env node
// smoke-guoku-legacy-fiscal-compat.js — guoku initFromDynasty 案卷/国师旧财政键兼容兜底
// 2026-08 玩家剧本事故：fiscalConfig.{treasury,monthlyIncome,monthlyExpense} 与
// guoku.{money,grain,库存折贯,常平仓石} 此前零读者 → 作者国库/月入设定全灭。此处钉死兼容契约。

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Date, JSON, Math, GM: { turn: 0 }, P: {} };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}
function assert(cond, msg) { if (!cond) throw new Error('[smoke-guoku-legacy-fiscal-compat] ' + msg); }

load('tm-guoku-engine.js');

const GuokuEngine = ctx.GuokuEngine;
let assertions = 0;

// ── case 1·fiscalConfig.{treasury,monthlyIncome,monthlyExpense} 全兜底 ──
ctx.GM.guoku = undefined;
GuokuEngine.initFromDynasty('明', 'peak', { fiscalConfig: { treasury: 3000000, monthlyIncome: 400000, monthlyExpense: 120000 } });
assertions += 1; assert(ctx.GM.guoku.balance === 3000000, 'fiscalConfig.treasury should fallback to balance');
assertions += 1; assert(ctx.GM.guoku.ledgers.money.stock === 3000000, 'fiscalConfig.treasury should fallback to ledgers.money.stock');
assertions += 1; assert(ctx.GM.guoku.monthlyIncome === 400000, 'fiscalConfig.monthlyIncome should fallback to monthlyIncome');
assertions += 1; assert(ctx.GM.guoku.monthlyExpense === 120000, 'fiscalConfig.monthlyExpense should fallback to monthlyExpense');

// ── case 2·guoku.{money,grain} 兜底 ──
ctx.GM.guoku = undefined;
GuokuEngine.initFromDynasty('明', 'peak', { guoku: { money: 2000000, grain: 900000 } });
assertions += 1; assert(ctx.GM.guoku.balance === 2000000, 'guoku.money should fallback to balance');
assertions += 1; assert(ctx.GM.guoku.ledgers.grain.stock === 900000, 'guoku.grain should fallback to ledgers.grain.stock');

// ── case 3·guoku.{库存折贯,常平仓石} 中文键兜底 ──
ctx.GM.guoku = undefined;
GuokuEngine.initFromDynasty('明', 'peak', { guoku: { '库存折贯': 2500000, '常平仓石': 800000 } });
assertions += 1; assert(ctx.GM.guoku.balance === 2500000, 'guoku.库存折贯 should fallback to balance');
assertions += 1; assert(ctx.GM.guoku.ledgers.grain.stock === 800000, 'guoku.常平仓石 should fallback to ledgers.grain.stock');
assertions += 1; assert(ctx.GM.guoku.grain === 800000, 'guoku.常平仓石 should also mirror GM.guoku.grain');

// ── case 4·显式 initialMoney 优先于 fiscalConfig.treasury ──
ctx.GM.guoku = undefined;
GuokuEngine.initFromDynasty('明', 'peak', { guoku: { initialMoney: 500000 }, fiscalConfig: { treasury: 3000000 } });
assertions += 1; assert(ctx.GM.guoku.balance === 500000, 'explicit initialMoney should win over fiscalConfig.treasury');

// ── case 5·无兼容键零变更（朝代默认不被动） ──
ctx.GM.guoku = undefined;
GuokuEngine.initFromDynasty('明', 'peak');
assertions += 1; assert(ctx.GM.guoku.monthlyIncome === Math.round(80000 * 1.8), 'no compat keys·monthlyIncome should stay dynasty default');
assertions += 1; assert(ctx.GM.guoku.balance === Math.round(80000 * 1.8 * 6), 'no compat keys·balance should stay dynasty default');

// ── case 6·空主别名不得遮蔽后续有效中文别名 ──
ctx.GM.guoku = undefined;
GuokuEngine.initFromDynasty('明', 'peak', { guoku: { money: null, '库存折贯': 2500000 } });
assertions += 1; assert(ctx.GM.guoku.balance === 2500000, 'null guoku.money must not shadow valid 库存折贯');

console.log('[smoke-guoku-legacy-fiscal-compat] pass assertions=' + assertions);
