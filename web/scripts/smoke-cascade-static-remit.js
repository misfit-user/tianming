#!/usr/bin/env node
// smoke-cascade-static-remit.js — 刀3·cascade 静态上供兜底（2026-08 玩家剧本事故根治）
// 剧本未 authored 任何税制（无 taxList/taxes/customTaxes → DEFAULT_TAXES 兜底）时：
//   DEFAULT_TAXES×economyBase 对架空/压缩尺度数据算出≈0 伪收入并抹掉作者 fiscalDetail 静态账（国库月入全灭）。
//   修复后：各区以作者 fiscalDetail.remittedToCenter(年额)折回合为中央钱入·静态账不覆写（case1）；
//   authored 税制剧本走旧计算路径·零变更（case2）。
// 写法参照 smoke-guoku-init-from-dynasty.js（vm.createContext + load）。
// 引擎 collect 全路径只读 global.GM/window（getGame 读 global.GM），无需额外 stub。

'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const ctx = { console, Date, JSON, Math, GM: null, P: {} };
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), ctx, { filename: file });
}
function assert(cond, msg) { if (!cond) throw new Error('[smoke-cascade-static-remit] ' + msg); }

load('tm-patches-start.js'); // 提供生产同源 _tmResolvePlayerAdminKey
load('tm-fiscal-engine.js');

const CascadeTax = ctx.CascadeTax;
let assertions = 0;

// 引擎 turnFracOfYear = turnDays/365（非 360 天年）：30 天回合静态入账 = Math.round(1200000*30/365) = 98630，
// monthlyIncome 按 30/turnDays 归一（30 天回合即回合额本身）。任务书「月入 100000」系按 /12 估算，以引擎实际为准。
const STATIC_REMIT_ANNUAL = 1200000;
const EXPECT_TURN_REMIT = Math.round(STATIC_REMIT_ANNUAL * 30 / 365); // 98630

function makeLeaf() {
  return {
    id: 'd1',
    name: '测试州',
    population: 100000,
    populationDetail: { households: 20000, mouths: 100000, ding: 40000 },
    fiscalDetail: { claimedRevenue: 200000, actualRevenue: 180000, remittedToCenter: STATIC_REMIT_ANNUAL },
    economyBase: {}
  };
}

// ── case 1·无 authored 税制 → 静态上供兜底 ──
ctx.GM = { turn: 0, adminHierarchy: { player: { divisions: [makeLeaf()] } } };
const res1 = CascadeTax.collect({ faction: 'player', turnDays: 30, force: true });
const div1 = ctx.GM.adminHierarchy.player.divisions[0];
assertions += 1; assert(res1 && res1.ok !== false, 'case1 collect should return ok!==false, got ' + JSON.stringify(res1));
assertions += 1; assert(ctx.GM.guoku.monthlyIncome === EXPECT_TURN_REMIT, 'case1 monthlyIncome should be 1200000*30/365=' + EXPECT_TURN_REMIT + ', got ' + ctx.GM.guoku.monthlyIncome);
assertions += 1; assert(div1.fiscalDetail.remittedToCenter === STATIC_REMIT_ANNUAL, 'case1 fiscalDetail.remittedToCenter 静态账不得被覆写, got ' + div1.fiscalDetail.remittedToCenter);
assertions += 1; assert(div1.fiscal.remittedToCenter === STATIC_REMIT_ANNUAL, 'case1 fiscal.remittedToCenter 不得被计算值覆写, got ' + div1.fiscal.remittedToCenter);
// 补足制（2026-08-11 改版）：staticRemit 只补「作者口径 − 计算上供」的差额（计算路径健康时一分不补），
// 故 sources.qita ∈ (0, 作者口径] 且本例计算上供极小 → qita 接近但小于 98630。
assertions += 1; assert(ctx.GM.guoku.sources && ctx.GM.guoku.sources.qita > 0 && ctx.GM.guoku.sources.qita < EXPECT_TURN_REMIT, 'case1 staticRemit 补差额经 tagToLegacy 归入 sources.qita(其它), got ' + JSON.stringify(ctx.GM.guoku.sources));

// ── case 2·authored 税制（fiscalConfig.taxes 数组非空）= 旧行为零变更 ──
const leaf2 = makeLeaf();
leaf2.economyBase = { farmland: 1000000 };
ctx.GM = {
  turn: 0,
  adminHierarchy: { player: { divisions: [leaf2] } },
  fiscalConfig: { taxes: [{ id: 't1', name: '田赋', base: 'arableLand', baseFactor: 1, rate: 0.01, storeAs: 'money', sourceTag: 'tianfu', annual: true }] }
};
const res2 = CascadeTax.collect({ faction: 'player', turnDays: 30, force: true });
assertions += 1; assert(res2 && res2.ok !== false, 'case2 collect should return ok!==false, got ' + JSON.stringify(res2));
assertions += 1; assert(leaf2.fiscal.claimedRevenue > 0 && leaf2.fiscal.claimedRevenue !== 200000, 'case2 authored 税制应走计算路径覆写 claimedRevenue(≠静态 200000), got ' + leaf2.fiscal.claimedRevenue);
assertions += 1; assert(ctx.GM.guoku.monthlyIncome !== EXPECT_TURN_REMIT, 'case2 monthlyIncome 不应等于静态兜底值 ' + EXPECT_TURN_REMIT + ', got ' + ctx.GM.guoku.monthlyIncome);

// ── case 3·多势力无 literal player：按 P.playerInfo 选 own，绝不取第一键 enemy ──
ctx.P = { playerInfo: { factionName: 'own' } };
const enemyLeaf = makeLeaf(); enemyLeaf.name = '敌州'; enemyLeaf.fiscalDetail.remittedToCenter = 12000000;
const ownLeaf = makeLeaf(); ownLeaf.name = '我州';
ctx.GM = { turn: 0, adminHierarchy: { enemy: { divisions: [enemyLeaf] }, own: { divisions: [ownLeaf] } } };
const res3 = CascadeTax.collect({ faction: 'player', turnDays: 30, force: true });
assertions += 1; assert(res3 && res3.ok !== false, 'case3 collect should succeed with resolved player faction');
assertions += 1; assert(ctx.GM.guoku.monthlyIncome === EXPECT_TURN_REMIT, 'case3 should collect own 1200000 annual remit, not enemy first key');
assertions += 1; assert(!enemyLeaf.fiscal || !enemyLeaf.fiscal._thisTurnRemitMoney, 'case3 enemy division must not be settled as player');

// ── case 4·空 fiscalDetail 主值不得遮蔽 fiscal 有效兜底 ──
ctx.P = {};
const nullPrimary = makeLeaf();
nullPrimary.fiscalDetail.remittedToCenter = null;
nullPrimary.fiscal = { remittedToCenter: STATIC_REMIT_ANNUAL };
ctx.GM = { turn: 0, adminHierarchy: { player: { divisions: [nullPrimary] } } };
const res4 = CascadeTax.collect({ faction: 'player', turnDays: 30, force: true });
assertions += 1; assert(res4 && res4.ok !== false, 'case4 collect should succeed with fallback remit');
assertions += 1; assert(ctx.GM.guoku.monthlyIncome === EXPECT_TURN_REMIT, 'case4 null fiscalDetail must fall through to fiscal.remittedToCenter');

console.log('[smoke-cascade-static-remit] pass assertions=' + assertions);
