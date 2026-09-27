#!/usr/bin/env node
'use strict';
// smoke-inflation-tax — 货币通胀接权威税收(#27·接通批)
//   真跑 computeTaxAmount(CurrencyEngine 桩):① money 税购买力<1→折减 ② 夹≤35% ③ 通缩不奖励
//   ④ 粮/布实物税不折 ⑤ CurrencyEngine 缺位=旧行为(零数据零变更)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-inflation-tax');

const fiscal = fs.readFileSync(path.join(ROOT,'tm-fiscal-engine.js'),'utf8');
const fnSrc = sliceFn(fiscal, 'function computeTaxAmount(');
ok(!!fnSrc, 'computeTaxAmount 抽取成功');
ok(/inflationPenalty/.test(fnSrc) && /tax\.storeAs \|\| 'money'\) === 'money'/.test(fnSrc), '源契约:仅 money storeAs 折减');
ok(/Math\.min\(0\.35, 1 - _pp\)/.test(fnSrc), '源契约:夹 ≤35%');
ok(/\* \(1 - inflationPenalty\) \*/.test(fnSrc), '源契约:接入权威乘子链');

function run(storeAs, pp, baseAmt){
  const ctx = { Math: Math, isFinite: isFinite, Object: Object, Array: Array };
  ctx.taxBase = function(){ return baseAmt; };
  ctx.safeNumber = function(v,d){ var n = Number(v); return isFinite(n) ? n : d; };
  ctx.getGame = function(){ return {}; };
  ctx.window = (pp === null) ? {} : { CurrencyEngine: { getPurchasingPower: function(){ return pp; } } };
  ctx.P = {};
  ctx.global = ctx; // Preserve the real fiscal IIFE closure while testing the extracted function.
vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.calc = computeTaxAmount;', ctx);
  return ctx.calc({ corruption:0 }, { storeAs: storeAs, base:'farmland', baseFactor:1, rate:0.1, annual:false }, {});
}

ok(run('money', 1.0, 100000) === 10000, '① money·pp=1.0 → 无折(10000·基准)');
ok(run('money', 0.7, 100000) === 7000, '① ★money·pp=0.7 → 折30%(7000·通胀蚀税·国库不再一文不少)');
ok(run('money', 0.5, 100000) === 6500, '② money·pp=0.5 → 夹35%(6500·不无限折)');
ok(run('money', 1.5, 100000) === 10000, '③ money·pp=1.5(通缩)→ 不奖励(10000·只罚通胀)');
ok(run('grain', 0.5, 100000) === 10000, '④ 粮(实物)·pp=0.5 → 不折(10000·粮布不受通胀蚀)');
ok(run('cloth', 0.5, 100000) === 10000, '④ 布(实物)·pp=0.5 → 不折(10000)');
ok(run('money', null, 100000) === 10000, '⑤ CurrencyEngine 缺位 → 不折(10000·旧行为·零数据零变更)');

console.log('\n结果: '+A+' 通过 / 0 失败');
