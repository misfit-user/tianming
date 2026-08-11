#!/usr/bin/env node
// smoke-neitang-inner-treasury-compat.js — neitang initFromDynasty · guoku_advanced.innerTreasury 兼容兜底
// 2026-08 玩家剧本事故：国师把内帑写进 guoku_advanced.innerTreasury.{money,存银}·此前零读者 → 内帑恒为 国库×ratio

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
function assert(cond, msg) { if (!cond) throw new Error('[smoke-neitang-inner-treasury-compat] ' + msg); }

load('tm-neitang-engine.js');

const NeitangEngine = ctx.NeitangEngine;
let assertions = 0;

function reset() {
  ctx.GM.guoku = { balance: 480000, monthlyIncome: 80000 };
  ctx.GM.neitang = undefined;
}

// ── case 1·innerTreasury.money 兜底生效 ──
reset();
NeitangEngine.initFromDynasty('明', 'peak', { guoku_advanced: { innerTreasury: { money: 800000 } } });
assertions += 1; assert(ctx.GM.neitang.balance === 800000, 'innerTreasury.money should override balance to 800000');
assertions += 1; assert(ctx.GM.neitang.ledgers.money.stock === 800000, 'innerTreasury.money should also set ledgers.money.stock');

// ── case 2·innerTreasury.存银 兜底生效 ──
reset();
NeitangEngine.initFromDynasty('明', 'peak', { guoku_advanced: { innerTreasury: { '存银': 600000 } } });
assertions += 1; assert(ctx.GM.neitang.balance === 600000, 'innerTreasury.存银 should override balance to 600000');

// ── case 3·显式 neitang.initialMoney 优先于兼容键 ──
reset();
NeitangEngine.initFromDynasty('明', 'peak', { neitang: { initialMoney: 999999 }, guoku_advanced: { innerTreasury: { money: 800000 } } });
assertions += 1; assert(ctx.GM.neitang.balance === 999999, 'explicit neitang.initialMoney should win over innerTreasury');

// ── case 4·无兼容键零变更（未知朝代 fallback ratio 0.12）──
reset();
NeitangEngine.initFromDynasty('楚', 'peak', {});
assertions += 1; assert(ctx.GM.neitang.balance === Math.round(480000 * 0.12), 'no compat key should keep 国库×0.12 fallback');

// ── case 5·空主别名不得遮蔽后续有效中文别名 ──
reset();
NeitangEngine.initFromDynasty('明', 'peak', { guoku_advanced: { innerTreasury: { money: null, '存银': 600000 } } });
assertions += 1; assert(ctx.GM.neitang.balance === 600000, 'null innerTreasury.money must not shadow valid 存银');

console.log('[smoke-neitang-inner-treasury-compat] pass assertions=' + assertions);
