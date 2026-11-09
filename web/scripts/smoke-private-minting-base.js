#!/usr/bin/env node
'use strict';
// smoke-private-minting-base — 铜钱私铸只随真变化涨落（11-10 同志定）
//   开局份额按剧本（币种 privateMintShare；铜钱另认 currencyRules.privateCoinage.prevalence；都没写算零），
//   之后看官钱降成色、囤钱、控铸比开局松紧、民贫比开局深浅；官府控铸不再每月自减；私铸一成以内不折，过一成的部分连续折。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }
function sliceFn(src, marker) { const a = src.indexOf(marker); if (a < 0) return null; let i = src.indexOf('{', a), d = 0, j = i; for (; j < src.length; j++) { const c = src[j]; if (c === '{') d++; else if (c === '}') { d--; if (d === 0) { j++; break; } } } return src.slice(a, j); }

console.log('smoke-private-minting-base');
const cur = fs.readFileSync(path.join(ROOT, 'tm-economy-engine-currency.js'), 'utf8');
const parts = ['function _declaredPrivateMintShare(', 'function _seedPrivateMintBase(', 'function _updatePrivateMinting(', 'function getMonetaryPurchasingPower('].map((m) => sliceFn(cur, m));
ok(parts.every(Boolean), '四段函数抽取成功');
ok(!/mintingControl\s*=\s*Math\.max\(0,\s*C\.mintingControl\s*-/.test(cur), '官府控铸不再每月自减');

function load(GM) {
  const ctx = { Math, Number, String, Array, Object, isFinite, NaN };
  ctx.global = { GM };
  vm.createContext(ctx);
  vm.runInContext(parts.join('\n') + '\nthis.seed = _seedPrivateMintBase; this.mint = _updatePrivateMinting; this.mpp = getMonetaryPurchasingPower;', ctx);
  return ctx;
}
function coin(o) { return Object.assign({ enabled: true, purity: 1, debasementLevel: 0, hoardingPressure: 0, purchasingPowerFactor: 1, privateMintShare: 0 }, o || {}); }
const near = (a, b) => Math.abs(a - b) < 1e-9;

// 晚唐式：铜钱本位，作者没写私铸——开局为零，两年不动、钱税不折，控铸不掉
{
  const GM = { vars: { poverty: 0.28 }, currency: { currentStandard: 'copper_cloth', mintingControl: 0.6, coins: { copper: coin({ hoardingPressure: 0.16 }), silver: coin() } } };
  const c = load(GM);
  c.seed(GM.currency, { initialCoins: { copper: { stock: 1, purity: 1, hoardingPressure: 0.16 } } }, true);
  for (let i = 0; i < 24; i++) c.mint(1);
  const cu = GM.currency.coins.copper;
  ok(cu.privateMintBase === 0 && cu.privateMintShare === 0 && cu.purchasingPowerFactor === 1, '没写私铸：份额零，两年不涨，购买力 1');
  ok(GM.currency.mintingControl === 0.6, '控铸两年后仍是开局的 0.6');
  ok(c.mpp() === 1, '铜钱本位的钱税不折（原先开局即折 8%）');
}
// 天启式：作者写 privateCoinage.prevalence 0.55——铜钱私铸五成五，购买力按过一成的部分折；银税不折
{
  const GM = { vars: { poverty: 0.5 }, currency: { currentStandard: 'silver_copper_paper', mintingControl: 0.6, coins: { copper: coin(), silver: coin() } } };
  const c = load(GM);
  c.seed(GM.currency, { privateCoinage: { prevalence: 0.55 } }, true);
  c.mint(1);
  const cu = GM.currency.coins.copper;
  ok(near(cu.privateMintShare, 0.55) && near(cu.purchasingPowerFactor, 1 - 0.45 * 0.4), '作者写的私铸 0.55 读进来了：铜钱购买力 ' + cu.purchasingPowerFactor.toFixed(3));
  ok(GM.currency.coins.silver.privateMintShare === 0 && c.mpp() === 1, '白银不算私铸，银本位钱税不折');
  // 禁私铸（控铸 +0.2）：份额往下
  GM.currency.mintingControl = 0.8;
  c.mint(1);
  ok(near(cu.privateMintShare, 0.55 - 0.06), '禁私铸收紧控铸 0.2：私铸降到 ' + cu.privateMintShare.toFixed(2));
}
// 币种上写的份额优先于 privateCoinage
{
  const GM = { currency: { coins: { copper: coin() } } };
  const c = load(GM);
  c.seed(GM.currency, { initialCoins: { copper: { privateMintShare: 0.3 } }, privateCoinage: { prevalence: 0.55 } }, true);
  ok(GM.currency.coins.copper.privateMintBase === 0.3, '币种上写的 privateMintShare 优先');
}
// 降成色：份额随之涨、购买力随之降
{
  const GM = { vars: { poverty: 0.3 }, currency: { currentStandard: 'copper', mintingControl: 0.6, coins: { copper: coin() } } };
  const c = load(GM);
  c.seed(GM.currency, {}, true);
  GM.currency.coins.copper.debasementLevel = 0.5;
  c.mint(1);
  const cu = GM.currency.coins.copper;
  ok(near(cu.privateMintShare, 0.15) && near(cu.purchasingPowerFactor, 0.85 * (1 - 0.05 * 0.4)), '官钱降成色 0.5：私铸涨到一成五，购买力 ' + cu.purchasingPowerFactor.toFixed(3));
  // 民贫加深也涨
  GM.vars.poverty = 0.8;
  c.mint(1);
  ok(near(cu.privateMintShare, 0.2), '民贫比开局深 0.5：私铸再涨 0.05');
}
// 一成处不再断崖
{
  const ppAt = (base) => { const GM = { vars: { poverty: 0.3 }, currency: { mintingControl: 0.6, coins: { copper: coin({ privateMintBase: base }) } } }; const c = load(GM); c.seed(GM.currency, {}, false); c.mint(1); return GM.currency.coins.copper.purchasingPowerFactor; };
  ok(ppAt(0.1) === 1 && ppAt(0.101) > 0.999, '私铸一成 → 1；一成零一 → ' + ppAt(0.101).toFixed(5) + '（原先陡降到 0.9596）');
}
// 旧档：没有底——份额按剧本（这里没写，算零），控铸、民贫取当下，不追溯旧的自减
{
  const GM = { vars: { poverty: 0.4 }, currency: { currentStandard: 'copper_paper', mintingControl: 0.2, coins: { copper: coin({ privateMintShare: 0.25, purchasingPowerFactor: 0.9 }) } } };
  const c = load(GM);
  c.seed(GM.currency, {}, false);
  ok(GM.currency.mintingControlBase === 0.2 && GM.currency.povertyBase === 0.4, '旧档的控铸、民贫底取当下');
  c.mint(1);
  ok(GM.currency.coins.copper.privateMintShare === 0 && GM.currency.coins.copper.purchasingPowerFactor === 1, '旧档原先按定式算出的两成五不当底：下月归零，购买力回到 1');
}

console.log('\n结果: ' + A + ' 通过 / 0 失败');
