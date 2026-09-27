#!/usr/bin/env node
'use strict';
// smoke-disaster-taxbase — 活跃天灾削受灾区税基 + 复活死字段 _disasterEconomyReduce
// 真 bug:① computeTaxAmount disasterPenalty 只读静态历史·不读 GM.activeDisasters ② _disasterEconomyReduce 全库无写=死
// 治:单一生产者 applyDisasterEconomyReduction 每回合按 region 写·两消费方(cascade computeTaxAmount + sumEconomyBase)各取
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

const ctx = { console: { log() {}, warn() {}, error() {} }, Math, JSON, String, Number, Array, Object, RegExp, parseInt, parseFloat, isFinite, isNaN, Date: { now: () => 0 } };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-fiscal-engine.js'), 'utf8'), ctx, { filename: 'tm-fiscal-engine.js' });
const CT = ctx.CascadeTax;

console.log('smoke-disaster-taxbase');
ok(CT && typeof CT.applyDisasterEconomyReduction === 'function', '① CascadeTax.applyDisasterEconomyReduction 已导出');

function mkGM() {
  ctx.GM = { turn: 5, adminHierarchy: { player: { name: '大明', divisions: [
    { name: '陕西布政司', economyBase: { farmland: 100000, commerceVolume: 50000 } },
    { name: '江南', economyBase: { farmland: 200000, commerceVolume: 300000 } }
  ] } }, activeDisasters: [] };
}
const shaanxi = () => ctx.GM.adminHierarchy.player.divisions[0];
const jiangnan = () => ctx.GM.adminHierarchy.player.divisions[1];

// ── 基线:无灾 → 全额税基 ──
mkGM();
CT.applyDisasterEconomyReduction(ctx.GM);
ok(CT.sumEconomyBase('farmland') === 300000, '② 无灾基线:farmland 总额 300000');

// ── 旱灾@陕西(moderate→farmland 0.2)·子串匹配「陕西」↔「陕西布政司」 ──
ctx.GM.activeDisasters = [{ category: 'drought', region: '陕西', severity: 'moderate' }];
let affected = CT.applyDisasterEconomyReduction(ctx.GM);
ok(affected === 1, '③ 旱灾@陕西:仅 1 区受灾(子串匹配陕西布政司)');
ok(shaanxi()._disasterEconomyReduce && shaanxi()._disasterEconomyReduce.farmland === 0.2, '③ 陕西 _disasterEconomyReduce.farmland=0.2(死字段复活)');
ok(!jiangnan()._disasterEconomyReduce, '③ 江南未受灾·不设折减');
// ★swap-test:受灾后 sumEconomyBase 下降(100000*0.2=20000)
ok(CT.sumEconomyBase('farmland') === 280000, '③ ★swap:受灾区税基真折减·farmland 300000→280000(消费方 sumEconomyBase 生效)');

// ── severity 分级:severe→0.35 ──
ctx.GM.activeDisasters = [{ category: 'drought', region: '陕西', severity: 'severe' }];
CT.applyDisasterEconomyReduction(ctx.GM);
ok(shaanxi()._disasterEconomyReduce.farmland === 0.35, '④ severe 旱灾 → farmland 折减 0.35');

// ── flood→farmland+commerce·且切区后旧区清(防陈旧泄漏) ──
ctx.GM.activeDisasters = [{ category: 'flood', region: '江南', severity: 'moderate' }];
CT.applyDisasterEconomyReduction(ctx.GM);
ok(jiangnan()._disasterEconomyReduce.farmland === 0.2 && Math.abs(jiangnan()._disasterEconomyReduce.commerceVolume - 0.1) < 1e-9, '⑤ 水灾@江南:farmland 0.2 + commerce 0.1');
ok(!shaanxi()._disasterEconomyReduce, '⑤ ★陕西此回合无灾 → 折减已清(无陈旧泄漏)');

// ── 灾退 → 全清·税基恢复(治本死字段不残留) ──
ctx.GM.activeDisasters = [];
CT.applyDisasterEconomyReduction(ctx.GM);
ok(!shaanxi()._disasterEconomyReduce && !jiangnan()._disasterEconomyReduce, '⑥ 无灾 → 全部清空');
ok(CT.sumEconomyBase('farmland') === 300000, '⑥ 税基恢复全额(灾退不残留折减)');

// ── 子串守卫:单字 region 不误配多区 ──
ctx.GM.activeDisasters = [{ category: 'drought', region: '陕' }]; // 1 字
CT.applyDisasterEconomyReduction(ctx.GM);
ok(!shaanxi()._disasterEconomyReduce, '⑦ 单字 region「陕」不子串误配(≥2 字守卫)');
// 精确名匹配
ctx.GM.activeDisasters = [{ category: 'drought', region: '江南' }];
CT.applyDisasterEconomyReduction(ctx.GM);
ok(!!jiangnan()._disasterEconomyReduce, '⑦ 精确名「江南」匹配命中');

// ── 源契约:权威路径(computeTaxAmount)+ collect 接生产者 ──
const src = fs.readFileSync(path.join(ROOT, 'tm-fiscal-engine.js'), 'utf8');
ok(/div\._disasterEconomyReduce\)\s*\{[\s\S]{0,160}disasterPenalty \+=/.test(src), '⑧ computeTaxAmount 权威路径加读 _disasterEconomyReduce(灾真削征税)');
ok(/applyDisasterEconomyReduction\(G\);[^\n]*per-division 征税前|applyDisasterEconomyReduction\(G\);/.test(src), '⑧ cascadeCollect 开头调 applyDisasterEconomyReduction');
ok(/applyDisasterEconomyReduction: applyDisasterEconomyReduction/.test(src), '⑧ 已导出');

// ── 全国产量只汇总叶子；父级可持同一份合计，灾减和筛选仍在叶子执行 ──
const leafA = { name: '甲府', tags: { mineralRegion: true }, economyBase: { farmland: 100000, mineralProduction: 3000 }, _disasterEconomyReduce: { farmland: 0.2 } };
const leafB = { name: '乙府', children: [], economyBase: { farmland: 200000, mineralProduction: 1000 } };
const parent = { name: '合计省', tags: { mineralRegion: true }, economyBase: { farmland: 300000, mineralProduction: 4000 }, children: [leafA, leafB] };
ctx.GM = { adminHierarchy: {
  player: { divisions: [parent, { name: '单层省', economyBase: { farmland: 50000, mineralProduction: 0 } }] },
  neighbor: { divisions: [{ name: '邻省', economyBase: { farmland: 90000, mineralProduction: 7000 } }] }
} };
ok(CT.sumEconomyBase('farmland') === 420000, '⑨ 全国叶子田亩只计一次，保留无下级省份与其他势力范围');
ok(CT.sumEconomyBase('farmland', { faction: 'player' }) === 330000, '⑨ 指定玩家分支仍过滤邻国，且叶子灾减仍生效');
ok(CT.sumEconomyBase('mineralProduction', { faction: 'player', requireTag: 'mineralRegion' }) === 3000, '⑨ requireTag 在叶子判定，不能把父级合计重新带入');
ok(CT.sumEconomyBase('farmland', { faction: 'missing' }) === 0, '⑨ 不存在的势力不回退为全国');
parent.economyBase.farmland = 9999999;
ok(CT.sumEconomyBase('farmland', { faction: 'player' }) === 330000, '⑨ 旧存档父级合计陈旧也不影响实际产量');
delete leafA._disasterEconomyReduce;
ok(CT.sumEconomyBase('farmland', { faction: 'player' }) === 350000, '⑨ 灾退恢复叶子全额，不恢复父级重复量');
parent.divisions = parent.children; delete parent.children;
ok(CT.sumEconomyBase('farmland', { faction: 'player' }) === 350000, '⑨ 兼容旧树以 divisions 存下级');

console.log('\n结果: ' + A + ' 通过 / 0 失败');
