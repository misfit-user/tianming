#!/usr/bin/env node
'use strict';
// smoke-fuyi-income-wire — 验证「年度赋役税率调整真入征收」(#6 收尾·2026-06-15)
// 抽真 computeTaxAmount 在 vm 沙箱实跑：玩家赋役滑块设的 taxRateAdjust 经权威 cascade 税额路径真影响田赋
//   · 无政令 → 不变（乘 1·防回归）
//   · +0.2 → 田赋 ×1.2；-0.2（蠲免）→ ×0.8
//   · 极端值夹 ±50%
//   · 仅对年度农赋（tax.annual）生效·非年度税不动（赋役之所指）

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const fiscalSrc = fs.readFileSync(path.join(ROOT, 'tm-fiscal-engine.js'), 'utf8');

let passed = 0;
function assert(c, m){ if(!c) throw new Error('[assert] ' + m); passed++; }

const i0 = fiscalSrc.indexOf('function taxBase(div, tax)');
const i1 = fiscalSrc.indexOf('function splitCascadeAmount');
assert(i0 > 0 && i1 > i0, 'computeTaxAmount 源码段可抽出');

function cta(fuyiAdjust, tax) {
  var GM = { fiscalConfig: (fuyiAdjust == null ? {} : { annualFuyi: { taxRateAdjust: fuyiAdjust } }) };
  const ctx = {
    safeNumber: function (v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); },
    _ensureEconomyBase: function (div) { return (div && div.economyBase) || {}; },
    getGame: function () { return GM; },
    TM: undefined, window: undefined, console: console,
    Math: Math, Number: Number, Object: Object, Array: Array, isFinite: isFinite
  };
  ctx.global = ctx; // Preserve the real fiscal IIFE closure while testing the extracted function.
vm.createContext(ctx);
  vm.runInContext(fiscalSrc.slice(i0, i1) + '\nthis.__cta = computeTaxAmount;', ctx);
  return ctx.__cta({ economyBase: { farmland: 100000 } }, tax, {});
}

var annual = { base: 'land', rate: 0.1, annual: true };
var nonAnnual = { base: 'land', rate: 0.1 }; // 无 annual 标记

// 基线：无政令 → 田 10万×10% = 10000（不变）
assert(cta(null, annual) === 10000, '无赋役政令：田赋 10000 不变（防回归）');
// 加征 +20% → 12000
assert(cta(0.2, annual) === 12000, '赋役 +0.2：田赋 10000→12000（玩家旋钮真生效）');
// 蠲免 -20% → 8000
assert(cta(-0.2, annual) === 8000, '赋役 -0.2（蠲免）：田赋 10000→8000（减负真减收）');
// 极端夹顶 +50%
assert(cta(5, annual) === 15000, '极端 +5 夹到 +0.5：田赋 ×1.5=15000');
// 极端夹底 -50%
assert(cta(-5, annual) === 5000, '极端 -5 夹到 -0.5：田赋 ×0.5=5000');
// 非年度税不受赋役影响（赋役只指农赋）
assert(cta(0.2, nonAnnual) === 10000, '非年度税：赋役不动它（仍 10000）');

// 源契约
assert(/fuyiMult/.test(fiscalSrc), 'computeTaxAmount 含 fuyiMult 接线');
assert(/annualFuyi\b[\s\S]{0,40}taxRateAdjust/.test(fiscalSrc), '真读 fiscalConfig.annualFuyi.taxRateAdjust');

console.log('PASS smoke-fuyi-income-wire · ' + passed + ' 断言');
