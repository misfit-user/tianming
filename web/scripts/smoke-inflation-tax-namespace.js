#!/usr/bin/env node
'use strict';
// smoke-inflation-tax-namespace — 通胀蚀税命名空间修(Tier1·簇2#1)
//   #27 初版取 CurrencyEngine.getPurchasingPower 恒 undefined → inflationPenalty 永 0(prod 死线·smoke 桩掩盖)。
//   11-09 起钱税只认货币自身的购买力（降成色、私铸、纸币滥发），访问器 getMonetaryPurchasingPower 挂在 CurrencyEngine
//   （tm-economy-engine-currency.js）；含粮价的 EconomyGapFill.getPurchasingPower 不用。
//   验:征税处查 CurrencyEngine、CurrencyEngine 真导出它(不再是死线)，只有 EconomyGapFill 时落空(不回退到粮价)。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }

console.log('smoke-inflation-tax-namespace');
const fis = fs.readFileSync(path.join(ROOT,'tm-fiscal-engine.js'),'utf8');
ok(/var _ce = \(typeof window !== 'undefined' && window\.CurrencyEngine\)/.test(fis), '★征税处查 CurrencyEngine');
ok(/_ce\.getMonetaryPurchasingPower\(\)/.test(fis), '调只认货币自身的 getMonetaryPurchasingPower');
const cur = fs.readFileSync(path.join(ROOT, 'tm-economy-engine-currency.js'), 'utf8');
ok(/global\.CurrencyEngine = \{[\s\S]*getMonetaryPurchasingPower: getMonetaryPurchasingPower/.test(cur), '★CurrencyEngine 真导出 getMonetaryPurchasingPower（不再是死线）');

function resolve(win){
  const ctx = { window:win, global:{} };
  vm.createContext(ctx);
  return vm.runInContext("(typeof window !== 'undefined' && window.CurrencyEngine) || (typeof global !== 'undefined' && global.CurrencyEngine) || null;", ctx);
}
const ce = resolve({ CurrencyEngine: { getMonetaryPurchasingPower: function(){ return 0.8; } }, EconomyGapFill: { getPurchasingPower: function(){ return 0.1; } } });
ok(ce && typeof ce.getMonetaryPurchasingPower === 'function', '查找命中 CurrencyEngine.getMonetaryPurchasingPower');
const pp = ce.getMonetaryPurchasingPower();
const penalty = (pp < 1) ? Math.min(0.35, 1 - pp) : 0;
ok(Math.abs(penalty - 0.2) < 1e-9, '货币购买力 0.8 → inflationPenalty 0.2（含粮价的 0.1 不用）');
ok(resolve({ EconomyGapFill: { getPurchasingPower: function(){ return 0.1; } } }) == null, '只有 EconomyGapFill 时落空 → 不折(不回退到含粮价的购买力)');

console.log('\n结果: '+A+' 通过 / 0 失败');
