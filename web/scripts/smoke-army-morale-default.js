#!/usr/bin/env node
'use strict';
// smoke-army-morale-default — 军心缺省值单一真相源(原散落 50/60/70)
//   ① _armyMorale 实跑:有值透传·缺省/undefined/null→60·★morale=0 读作 0(修 || 误兜)
//   ② tm-military(authority) 全走 helper·无 .morale||70 / ===undefined?50/70 散乱默认
//   ③ keystone extendArmyFields=60 + AI 三处基线=60
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }

console.log('smoke-army-morale-default');

const mil = fs.readFileSync(path.join(ROOT,'tm-military.js'),'utf8');
const cSrc = mil.match(/var MILITARY_DEFAULT_MORALE = \d+;/);
const fSrc = mil.match(/function _armyMorale\(a\)\{[^}]*\}/);
ok(!!cSrc && /= 60;/.test(cSrc[0]), '① 常量 MILITARY_DEFAULT_MORALE=60');
ok(!!fSrc, '① _armyMorale 抽取成功');
{
  const ctx = {}; vm.createContext(ctx);
  vm.runInContext(cSrc[0]+'\n'+fSrc[0]+'\nthis.F=_armyMorale;', ctx);
  ok(ctx.F({morale:85})===85, '① 有值透传(85)');
  ok(ctx.F({})===60, '① 缺省→60');
  ok(ctx.F({morale:undefined})===60, '① undefined→60');
  ok(ctx.F({morale:null})===60, '① null→60');
  ok(ctx.F({morale:0})===0, '① ★morale=0 读作 0(原 ||70 误兜回·溃散/哗变军不再虚高战力)');
  ok(ctx.F(null)===60, '① 空军对象→60(不抛)');
}
// ② authority file 收口
ok(!/\.morale \|\| 70/.test(mil), '② tm-military 无 .morale || 70 残留');
ok(!/\.morale \|\| 50/.test(mil), '② tm-military 无 .morale || 50 残留');
ok(!/morale === undefined \? (50|70)/.test(mil), '② tm-military 无 ===undefined?50/70 散乱默认');
const c2 = (mil.match(/_armyMorale\(/g)||[]).length;
ok(c2 >= 15, '② _armyMorale 接入 ' + c2 + ' 处(≥15 读取点)');
// ③ keystone + AI

console.log('\n结果: '+A+' 通过 / 0 失败');
