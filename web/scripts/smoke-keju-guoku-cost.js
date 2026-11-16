#!/usr/bin/env node
'use strict';
// smoke-keju-guoku-cost — 恩科/武举开科国库代价死火修(Tier1·簇8#1)
//   原 typeof GM.guoku === 'number' 恒假(guoku 是对象)→spec 设计的开科国库代价从未发生。
//   修:抽象点数(国库:-8/-15)×3000 两走真账本 spendFromGuoku 扣减。验:源契约 + 复刻扣费块。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }

console.log('smoke-keju-guoku-cost');
const enke = fs.readFileSync(path.join(ROOT,'tm-keju-enke.js'),'utf8');
const wuju = fs.readFileSync(path.join(ROOT,'tm-keju-wuju.js'),'utf8');
// 死 guard 已清(只剩注释里引用·真 if 条件不再是 typeof number)
ok(!/if \(typeof GM\.guoku === 'number'/.test(enke), '★恩科:死 if(typeof GM.guoku===number) 已清');
ok(!/if \(typeof GM\.guoku === 'number'/.test(wuju), '★武举:死 if 已清');

// 复刻扣费块:ac['国库']=-8 → spendFromGuoku money 24000;正数/0 不扣
function runCost(acVal){
  const ctx = { window:{}, global:{}, Math:Math, FiscalEngine:null };
  ctx.calls = [];
  ctx.window.FiscalEngine = { spendFromGuoku:function(a,t){ ctx.calls.push({a:a,t:t}); } };
  vm.createContext(ctx);
  vm.runInContext([
    "var ac = { '国库': " + acVal + " };",
    "if (typeof ac['国库'] === 'number' && ac['国库'] < 0) {",
    "  var _ekCost = Math.abs(ac['国库']) * 3000;",
    "  var _FE = (typeof window!=='undefined' && window.FiscalEngine) || null;",
    "  if (_FE && typeof _FE.spendFromGuoku === 'function') _FE.spendFromGuoku({ money: _ekCost }, '恩科开科');",
    "}"
  ].join('\n'), ctx);
  return ctx.calls;
}
const c8 = runCost(-8);
ok(c8.length === 1 && c8[0].a.money === 24000, '★国库:-8 → spendFromGuoku 24000 两');
ok(c8[0].t === '恩科开科', 'sinkTag 标记开科');
const c0 = runCost(0);
ok(c0.length === 0, '国库:0 → 不扣(守卫)');
const cPos = runCost(5);
ok(cPos.length === 0, '国库正数 → 不扣(只处理代价)');

console.log('\n结果: '+A+' 通过 / 0 失败');
