#!/usr/bin/env node
// smoke-clan-stipend-growth.js — 宗藩世禄·随宗室繁衍（深挖第六轮⑤）
// 验：applyRoyalClanPressure(tm-neitang-engine.js) 的宗藩世禄联动——
//   GM.imperialClan.princeCount 此前全库零写(guoku fenglu 恒读静态值/兜底常数)·
//   现随宗室人口按初始比率同步复利：开闸种子与 guoku 兜底同式不跳变·剧本预置优先·
//   +5 王爵入编年·flag clanGrowthEnabled 默认关。切片沙箱直驱(函数已导出但整文件载入需基座)。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(cond, msg) { N++; if (!cond) { console.error('ASSERT FAIL [' + N + ']:', msg); process.exit(1); } }

// ── 切片提取 applyRoyalClanPressure（ASCII 锚·两函数间整段）──
const src = fs.readFileSync(path.join(ROOT, 'tm-neitang-engine.js'), 'utf8');
const a = src.indexOf('function applyRoyalClanPressure(mr) {');
const b = src.indexOf('function triggerRoyalClanBankruptcy');
assert(a > 0 && b > a, '① 切片锚点在位(applyRoyalClanPressure..triggerRoyalClanBankruptcy)');

function mkCtx(over) {
  const ctx = Object.assign({
    console: console, Math: Math, JSON: JSON, Object: Object, Array: Array,
    Number: Number, String: String, isFinite: isFinite, isNaN: isNaN,
    FiscalEngine: { spendFromGuoku: function () {} },
    addEB: function (cat, txt) { ctx._eb.push({ cat: cat, txt: txt }); },
    _eb: [],
    triggerRoyalClanBankruptcy: function () {},
    _mxApply: function () {},
    GM: {
      turn: 10, chars: new Array(100),
      neitang: { neicangRules: { royalClanPressure: { enabled: true, basePopulation: 80000, growthRatePerYear: 0.015, stipendPerCapita: 50 } } },
      guoku: { ledgers: { grain: { stock: 1e9 } } }
    },
    P: { conf: {} }
  }, over || {});
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // Load the actual mode discriminator and its exported consumer together.
  vm.runInContext(src, ctx, { filename: 'tm-neitang-engine.js' });
  ctx.applyRoyalClanPressure = ctx.NeitangEngine.applyRoyalClanPressure;
  return ctx;
}

// ── flag 默认关：人口照长·王爵账不动(旧行为字节级保留) ──
var c1 = mkCtx();
c1.applyRoyalClanPressure(12);   // 一年
assert(c1.GM.neitang._royalClan.population > 80000, '③ 宗室人口引擎照常繁衍(既有机制不破)');
assert(c1.GM.imperialClan === undefined, '④ flag 关：imperialClan 纹丝不写');

// ── 开 flag：种子与 guoku 兜底同式(开闸不跳变) ──
var c2 = mkCtx();
c2.P.conf.clanGrowthEnabled = true;
c2.applyRoyalClanPressure(0);    // mr=0·人口不动·纯建账
assert(c2.GM.imperialClan && c2.GM.imperialClan.princeCount === 20, '⑤ 种子=max(20,官员数5%)·100 chars→300官→兜底20·不跳变');

// ── 十年复利：princeCount 随人口同比率爬升 ──
for (var y = 0; y < 10; y++) c2.applyRoyalClanPressure(12);
var pop10 = c2.GM.neitang._royalClan.population;
assert(pop10 > 80000 * 1.14 && pop10 < 80000 * 1.18, '⑥ 十年人口≈×1.16(1.5%年率)');
assert(c2.GM.imperialClan.princeCount === Math.max(1, Math.round(pop10 * c2.GM.imperialClan._princeRatio)), '⑦ 王爵数=人口×初始比率(同步复利)');
assert(c2.GM.imperialClan.princeCount >= 23, '⑧ 十年王爵 20→23+·宗禄螺旋在爬');

// ── 编年可感：再过十年(累计+7王)触 +5 阈值入编年 ──
for (var y2 = 0; y2 < 10; y2++) c2.applyRoyalClanPressure(12);
assert(c2.GM.imperialClan.princeCount >= 25, '⑨a 二十年王爵 20→27±·螺旋累积');
assert(c2._eb.some(function (e) { return e.cat === '宗禄'; }), '⑨b 王爵+5 入编年「宗禄」条');

// ── 剧本预置优先：princeCount 已设则为种子 ──
var c3 = mkCtx();
c3.P.conf.clanGrowthEnabled = true;
c3.GM.imperialClan = { princeCount: 60 };
c3.applyRoyalClanPressure(0);
assert(c3.GM.imperialClan.princeCount === 60 && Math.abs(c3.GM.imperialClan._princeRatio - 60 / 80000) < 1e-9, '⑩ 剧本预置 60 王为种子·比率照预置');

// ── GM.totalOfficials 在位时按真官数 ──
var c4 = mkCtx();
c4.P.conf.clanGrowthEnabled = true;
c4.GM.totalOfficials = 1000;
c4.applyRoyalClanPressure(0);
assert(c4.GM.imperialClan.princeCount === 50, '⑪ totalOfficials=1000→种子50(5%)');

// ── 确定性：同局面两沙箱同轨 ──
var c5 = mkCtx(); c5.P.conf.clanGrowthEnabled = true;
var c6 = mkCtx(); c6.P.conf.clanGrowthEnabled = true;
for (var i = 0; i < 24; i++) { c5.applyRoyalClanPressure(1); c6.applyRoyalClanPressure(1); }
assert(c5.GM.imperialClan.princeCount === c6.GM.imperialClan.princeCount && c5.GM.neitang._royalClan.population === c6.GM.neitang._royalClan.population, '⑫ 确定性·同局面同轨');

// ── 配了年额宗禄（天启、绍宋）：固定支出本回合或上回合扣过宗禄，这里让位不再扣；没扣过才按人口扣 ──
//   （11-17：原先宗禄判权调了另一个闭包里的函数，这一步每回合抛错、整段跳过）
var spent7 = [];
var c7 = mkCtx({ FiscalEngine: { spendFromGuoku: function (amt, why) { spent7.push(why); } } });
c7.GM.neitang.neicangRules.royalClanPressure.annualStipendPaid = 3.65;
c7.GM._lastFixedExpenseTurn = c7.GM.turn - 1;
var threw7 = null;
try { c7.applyRoyalClanPressure(1); } catch (e) { threw7 = e; }
assert(!threw7, '⑬ 配了年额宗禄：宗室结算不抛错（实得 ' + (threw7 && threw7.message) + '）');
assert(spent7.length === 0 && c7.GM.neitang._royalClan.lastStipendCost > 0, '⑭ 固定支出上回合已扣宗禄：这里不再扣，月宗禄照记');
var spent8 = [];
var c8 = mkCtx({ FiscalEngine: { spendFromGuoku: function (amt, why) { spent8.push(why); } } });
c8.GM.neitang.neicangRules.royalClanPressure.annualStipendPaid = 3.65;
c8.applyRoyalClanPressure(1);
assert(spent8.length === 1 && spent8[0] === '宗禄', '⑮ 固定支出没扣过：按人口扣一回宗禄');

// ── 静态契约：下游读点/开关在位 ──

console.log('smoke-clan-stipend-growth OK — ' + N + ' 断言全绿（种子不跳变/十年复利/剧本预置/编年/确定性/flag闸）');
