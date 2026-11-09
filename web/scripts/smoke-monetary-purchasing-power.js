#!/usr/bin/env node
'use strict';
// smoke-monetary-purchasing-power — 钱税折减只认货币自身的事（11-09 同志定「丙」）
//   getMonetaryPurchasingPower：银本位恒 1（银两按分量成色收，粮价、季节、年景、战事都不改）；
//   铜钱本位看铜钱降成色、私铸；兼行纸币的本位再按纸币滥发折。
//   _updatePrivateMinting：白银不是官铸的钱，没有私铸可言，购买力不再随「控铸」逐月自减而贬。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function sliceFn(src, marker) { const a = src.indexOf(marker); if (a < 0) return null; let i = src.indexOf('{', a), d = 0, j = i; for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return src.slice(a, j); }

console.log('smoke-monetary-purchasing-power');
const eco = fs.readFileSync(path.join(ROOT, 'tm-economy-engine.js'), 'utf8');
const cur = fs.readFileSync(path.join(ROOT, 'tm-economy-engine-currency.js'), 'utf8');
const mppSrc = sliceFn(cur, 'function getMonetaryPurchasingPower(');
const ppSrc = sliceFn(eco, 'function getPurchasingPower(');
const mintSrc = sliceFn(cur, 'function _updatePrivateMinting(');
ok(!!mppSrc && !!ppSrc && !!mintSrc, '三段函数抽取成功');

function load(GM) {
  const ctx = { Math, Number, String, Array, Object, isFinite };
  ctx.global = { GM };
  vm.createContext(ctx);
  vm.runInContext(mppSrc + '\n' + ppSrc + '\n' + mintSrc + '\nthis.mpp = getMonetaryPurchasingPower; this.pp = getPurchasingPower; this.mint = _updatePrivateMinting;', ctx);
  return ctx;
}
function coin(o) { return Object.assign({ enabled: true, purity: 1, debasementLevel: 0, hoardingPressure: 0, purchasingPowerFactor: 1, privateMintShare: 0 }, o || {}); }

// 明：银本位，粮价「通胀」三成、铜钱私铸、宝钞滥发——银税都不折
{
  const GM = { currency: { currentStandard: 'silver_copper_paper', mintingControl: 0.6, market: { inflation: 0.3 },
    coins: { silver: coin({ purchasingPowerFactor: 0.85 }), copper: coin({ purchasingPowerFactor: 0.7 }) },
    paper: { issuances: [{ state: 'overissue', inflationCarried: 5 }] } } };
  const c = load(GM);
  ok(c.mpp() === 1, '明·银本位：货币购买力 1（粮价通胀 0.3、铜钱 0.7、宝钞滥发都不碰银税）');
  ok(c.pp() < 0.7, '对照：含粮价的旧购买力会把银税折掉（' + c.pp().toFixed(3) + '）');
}
// 唐：铜钱本位，粮价通胀五成——只看铜钱成色
{
  const GM = { currency: { currentStandard: 'copper', market: { inflation: 0.5 }, coins: { copper: coin({ purchasingPowerFactor: 0.85 }) }, paper: { issuances: [] } } };
  ok(load(GM).mpp() === 0.85, '唐·铜钱本位：只按铜钱成色 0.85，粮价通胀不算');
}
// 宋：铜钱兼纸币，纸币滥发
{
  const GM = { currency: { currentStandard: 'copper_paper', market: { inflation: 0.2 }, coins: { copper: coin({ purchasingPowerFactor: 0.9 }) },
    paper: { issuances: [{ state: 'overissue', inflationCarried: 2 }, { state: 'abolish', inflationCarried: 9 }] } } };
  ok(Math.abs(load(GM).mpp() - 0.75) < 1e-9, '宋·铜钱兼纸币：铜钱 0.9 ÷（1＋滥发 0.2）＝0.75，已废的纸币不算');
}
ok(load({}).mpp() === 1, '没有货币模块：1（不折）');

// 私铸：白银不算，铜钱照算
{
  const GM = { vars: { poverty: 0.9 }, currency: { currentStandard: 'silver_copper_paper', mintingControl: 0,
    coins: { silver: coin({ purchasingPowerFactor: 0.92, privateMintShare: 0.2 }), copper: coin(), paper: coin() } } };
  const c = load(GM);
  for (let i = 0; i < 24; i++) c.mint(1);
  ok(GM.currency.coins.silver.purchasingPowerFactor === 1 && GM.currency.coins.silver.privateMintShare === 0, '白银两年里不算私铸，购买力回到并保持 1');
  ok(GM.currency.coins.copper.purchasingPowerFactor < 1 && GM.currency.coins.copper.privateMintShare > 0.1, '铜钱私铸照算（购买力 ' + GM.currency.coins.copper.purchasingPowerFactor.toFixed(3) + '）');
}

console.log('\n结果: ' + A + ' 通过 / 0 失败');
