#!/usr/bin/env node
'use strict';
// smoke-seigniorage-ledger — 铸币息入库写错账本(真bug·数据损坏止血)
//   swap-test 复现旧损坏(对象 += 数字 → 字符串) + 真跑 fixed _mintCycle 证:
//   账本仍是对象·stock 数字增正确·balance/money 同步·gk.sources 记铸币息
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-seigniorage-ledger');

const eco = (fs.readFileSync(path.join(ROOT, 'tm-economy-engine-currency.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-economy-engine.js'), 'utf8'));
const mintSrc = sliceFn(eco, 'function _mintCycle(');
const accountingSrc = sliceFn(eco, 'function CURRENCY_LEDGER_V2(');
ok(!!mintSrc, '_mintCycle 抽取成功');
ok(!!accountingSrc, '装载真实的记账模式判定，保持旧剧本铸钱回归');
ok(/typeof gk\.ledgers\.money === 'object'/.test(mintSrc) && /_ml\.stock =/.test(mintSrc), '源契约:入库走 money ledger.stock(对象守卫)');
ok(mintSrc.indexOf('gk.ledgers.money += ') < 0, '源契约:旧 gk.ledgers.money += number 已清');

// ── swap-test:旧写法复现损坏 ──
{
  var gkBad = { ledgers: { money: { stock: 1000 } } };
  gkBad.ledgers.money += 80;
  ok(typeof gkBad.ledgers.money === 'string', 'swap-test:旧写法对象账本 += 数字 → 字符串(复现原损坏)');
  ok(gkBad.ledgers.money.stock === undefined, 'swap-test:旧写法 .stock 全丢(国库读 balance=undefined 显示错乱)');
}

// ── 真跑 fixed _mintCycle ──
const ctx = { Math: Math };
ctx.global = { GM: {
  turn: 5,
  currency: {
    mintAgencies: [{ enabled:true, coinType:'copper', capacity:1000, costPerUnit:0.5, staffing:80, seignioragePerUnit:0.1, purityStandard:0.9, id:'mint1' }],
    coins: { copper: { enabled:true, rawReserve:1000, stock:0, mintQuantity:0, mintHistory:[], debasementLevel:0, purityStandard:0.9 } }
  },
  guoku: { ledgers: { money: { stock:1000, thisTurnIn:0, sources:{}, sinks:{} } }, balance:1000, money:1000, sources:{} }
}};
vm.createContext(ctx);
vm.runInContext(accountingSrc + '\n' + mintSrc + '\nthis.run = function(){ _mintCycle({turn:5}, 1); };', ctx);
ctx.run();
const g = ctx.global.GM.guoku;
ok(typeof g.ledgers.money === 'object', '★ 账本仍是对象(未被字符串覆写)');
ok(typeof g.ledgers.money.stock === 'number', '★ stock 仍是数字(数据未损坏)');
ok(g.ledgers.money.stock === 1080, 'stock 1000→1080(+80 铸币息·铜钱局产出 800×0.1)');
ok(g.balance === 1080, 'balance 同步 1080');
ok(g.money === 1080, 'money 同步 1080');
ok(g.sources.mintSeigniorage === 80, 'gk.sources.mintSeigniorage 记 80(铸币成真财源)');

console.log('\n结果: '+A+' 通过 / 0 失败');
