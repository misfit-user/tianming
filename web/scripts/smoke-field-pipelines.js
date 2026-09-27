#!/usr/bin/env node
/* eslint-env node */
// smoke-field-pipelines.js — S6 字段活化五管线 + S7 近账 实跑断言（2026-06-12）
// 验：政令执行率（官缺/主官/驿路）→ 逃隐户税基折减（cascade 实跑）→ 募兵硬上限（越限扣民心）
//     → 重税缓跌 tick（地板 25）→ _fieldLedger 环账 → 五处接线源码契约。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const WEB = path.join(__dirname, '..');
const FP = require(path.join(WEB, 'tm-field-pipelines.js'));

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}

// ── 1. policyExecRate ──
const rFull = FP.policyExecRate({ localExecutionRate: 0.8, governor: '孙承宗', economyBase: { postRelays: 20, roadQuality: 60 } });
ok(rFull.rate === 0.8, '硬链底数 0.8·无扣项 → 0.8');
const rVac = FP.policyExecRate({ localExecutionRate: 0.8, officeVacancy: 2, governor: '有人', economyBase: { postRelays: 20, roadQuality: 60 } });
ok(rVac.rate === 0.64, '官缺 2 员 −16% → 0.64');
const rNoGov = FP.policyExecRate({ localExecutionRate: 0.8, governor: '', economyBase: { postRelays: 20, roadQuality: 60 } });
ok(rNoGov.rate === 0.75, '主官出缺 −5% → 0.75');
const rLag = FP.policyExecRate({ localExecutionRate: 0.8, governor: '有人', economyBase: { postRelays: 2, roadQuality: 20 } });
ok(rLag.rate === 0.7, '驿路阻滞（驿站<5 且道路<30）−10% → 0.7');
ok(rLag.parts.some(p => p.indexOf('驿路') >= 0), '驿路扣项进牵动 parts（postRelays 活账）');
const rFloor = FP.policyExecRate({ localExecutionRate: 0.35, officeVacancy: 5, governor: '', economyBase: { postRelays: 0, roadQuality: 5 } });
ok(rFloor.rate === 0.3, '执行率夹地板 0.3（政不行亦不至于零）');
ok(FP.policyExecRate({}).rate === 0.85, '无数据回退底数 0.85');

// ── 2. fleeTaxPenalty ──
ok(FP.fleeTaxPenalty({ populationDetail: { mouths: 1000000 } }) === 0, '无逃隐数据 → 0（零数据零行为变更）');
ok(FP.fleeTaxPenalty({ populationDetail: { mouths: 1000000, fugitives: 100000, hiddenCount: 50000 } }) === 0.13, '逃 10 万+隐 5 万×0.6 / 口 100 万 → 0.13');
ok(FP.fleeTaxPenalty({ populationDetail: { mouths: 100000, fugitives: 90000 } }) === 0.35, '折减封顶 35%');

// ── 3. taxBurdenFactor（镜像硬链 taxFactor）──
ok(FP.taxBurdenFactor({ taxLevel: '重' }) === 1.18, '税则「重」→ 1.18');
ok(FP.taxBurdenFactor({ taxLevel: 'light' }) === 0.84, '税则 light → 0.84');
ok(FP.taxBurdenFactor({ taxRate: 1.2 }) === 1.2, '数值税率 1.2 直读');
ok(FP.taxBurdenFactor({}) === 1, '无数据 → 1（不动）');

// ── 4. capRecruitDelta 募兵硬上限 ──
const recDiv = { name: '陕西', minxin: 60, militaryDetail: { availableRecruits: 3000 }, populationDetail: { ding: 100000 } };
const recP = { adminHierarchy: { player: { divisions: [recDiv] } } };
const recGM = { turn: 9 };
const cap1 = FP.capRecruitDelta(recGM, recP, '陕西', 5000);
ok(cap1.approved === 3000 && cap1.overdraft === 2000, '募 5000 超池 3000 → 实募 3000');
ok(recDiv.minxin === 59, '强征越限 → 民心叶 60→59');
ok(recDiv.militaryDetail.availableRecruits === 0, '兵源池扣减至 0（同回合多笔共享）');
const cap2 = FP.capRecruitDelta(recGM, recP, '陕西', 1000);
ok(cap2.approved === 0, '池已空 → 再募实募 0');
ok(FP.capRecruitDelta(recGM, recP, '无此地', 1000) === null, '驻地不可归因 → null 不拦');
const dingDiv = { name: '山东', populationDetail: { ding: 10000 } };
recP.adminHierarchy.player.divisions.push(dingDiv);
ok(FP.recruitCap(dingDiv) === 840, '无池回退：丁 10000×12%×0.7 = 840');
ok(Array.isArray(recDiv._fieldLedger.minxin) && recDiv._fieldLedger.minxin[0].why.indexOf('强征') >= 0, 'S7 近账：强征扣民心入环账');
ok(Array.isArray(recDiv._fieldLedger.recruits), 'S7 近账：募兵扣池入环账');

// ── 5. tick 重税缓跌（地板 25）──
const heavyDiv = { name: '河南', taxLevel: '重', minxin: 60 };
const harshDiv = { name: '北直隶', taxRate: 1.35, minxin: 60 };
const floorDiv = { name: '山西', taxLevel: '苛', minxin: 25 };
const calmDiv = { name: '南直隶', minxin: 60 };
const tickP = { adminHierarchy: { player: { divisions: [heavyDiv, harshDiv, floorDiv, calmDiv] } } };
const st = FP.tick({ turn: 12 }, tickP);
ok(heavyDiv.minxin === 59.5, '重税（1.18）→ 民心 60→59.5 缓跌');
ok(harshDiv.minxin === 59, '苛敛（≥1.3）→ 民心 60→59');
ok(floorDiv.minxin === 25, '地板 25 不再跌（防确定性死亡螺旋）');
ok(calmDiv.minxin === 60, '常税之地不动');
ok(st.taxedRegions === 2, 'tick 统计：重税地 2');
ok(Array.isArray(heavyDiv._fieldLedger.minxin) && heavyDiv._fieldLedger.minxin[0].why.indexOf('重税') >= 0, 'S7 近账：重税苛敛入环账');

// ── 6. 环账上限 8 条 ──
const ringDiv = {};
for (let i = 0; i < 12; i++) FP.ledgerPush(ringDiv, 'minxin', -1, '第' + i + '笔', { turn: i });
ok(ringDiv._fieldLedger.minxin.length === 8 && ringDiv._fieldLedger.minxin[7].why === '第11笔', '环账封顶 8 条·留最新');

// ── 7. cascade 实跑：computeTaxAmount 含逃隐折减（vm 抽函数）──
const fiscalSrc = fs.readFileSync(path.join(WEB, 'tm-fiscal-engine.js'), 'utf8').replace(/\r\n/g, '\n');
const i0 = fiscalSrc.indexOf('function taxBase(div, tax)');
const i1 = fiscalSrc.indexOf('function splitCascadeAmount');
ok(i0 > 0 && i1 > i0, 'cascade 源码段可抽出');
const ctx = {
  safeNumber: function (v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); },
  _ensureEconomyBase: function (div) { return (div && div.economyBase) || {}; },
  TM: { FieldPipes: FP },
  window: undefined,
  console: console
};
ctx.global = ctx; // Preserve the real fiscal IIFE closure while testing the extracted function.
vm.createContext(ctx);
vm.runInContext(fiscalSrc.slice(i0, i1) + '\nthis.__cta = computeTaxAmount;', ctx);
const landTax = { base: 'land', rate: 0.1 };
const cleanDiv = { economyBase: { farmland: 100000 } };
ok(ctx.__cta(cleanDiv, landTax, {}) === 10000, '无逃隐：田 10 万×10% = 10000（行为不变）');
const fledDiv = { economyBase: { farmland: 100000 }, populationDetail: { mouths: 1000000, fugitives: 100000, hiddenCount: 50000 } };
ok(ctx.__cta(fledDiv, landTax, {}) === 8700, '逃隐折减 13% → 8700（cascade 权威税路活账）');
const noFpCtx = { safeNumber: ctx.safeNumber, _ensureEconomyBase: ctx._ensureEconomyBase, TM: undefined, window: undefined, console: console };
noFpCtx.global = noFpCtx; // Preserve the real fiscal IIFE closure while testing the extracted function.
vm.createContext(noFpCtx);
vm.runInContext(fiscalSrc.slice(i0, i1) + '\nthis.__cta = computeTaxAmount;', noFpCtx);
ok(noFpCtx.__cta(fledDiv, landTax, {}) === 10000, 'FieldPipes 缺位 → 折减 0（零依赖安全）');

// ── 8. 接线源码契约（防回退死字段死函数）──
function srcHas(file, re, msg) {
  const s = fs.readFileSync(path.join(WEB, file), 'utf8');
  ok(re.test(s), msg);
}
srcHas('tm-endturn-apply.js', /_s6Scale\(ac\.prosperity_delta\)/, 'apply：prosperity_delta 走执行率打折');
srcHas('tm-endturn-apply.js', /policyExecRate/, 'apply：读 FieldPipes.policyExecRate');
srcHas('tm-ai-change-army.js', /capRecruitDelta/, 'army：募兵硬上限接线');
srcHas('tm-endturn-core.js', /TM\.FieldPipes\.tick/, 'endturn-core：FieldPipes.tick 挂载（aggregate 前）');
srcHas('index.html', /tm-field-pipelines\.js/, 'index.html：模块已挂载');
srcHas('tm-building-works.js', /ledgerPush/, 'building-works：完工写近账');
srcHas('phase8-formal-map-dossier.js', /bkCauseLedgerHtml/, '因果签：近账渲染接线（第二十五拆迁至 dossier sibling）');
srcHas('phase8-formal-bridge-styles.js', /cp-led-row/, '因果签：近账样式注入'); // 第二十七拆·CSS迁出至 -styles 片

console.log('\n[smoke-field-pipelines] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
