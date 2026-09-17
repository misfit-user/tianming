#!/usr/bin/env node
'use strict';
// smoke-army-supply-strength — 补给入战力(Tier1·簇3#1)
//   字段分裂:战力读 supplyRatio(0-1·几乎没人填)·而维护/UI/AI 用 supply(0-100)→断粮军与满补给军战力相同(补给摆设)。
//   修:无 supplyRatio 时按 supply 折算同曲线。验:supply 影响战力 + swap-test 旧逻辑忽略 supply。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-army-supply-strength');
const mil = fs.readFileSync(path.join(ROOT,'tm-military.js'),'utf8');
const strengthSource = fs.readFileSync(path.join(ROOT,'tm-battle-contract.js'),'utf8');
const fnSrc = sliceFn(strengthSource, 'function calculateArmyStrength(');
ok(!!fnSrc, 'calculateArmyStrength 抽取成功');
ok(/else if \(army\.supply != null\)/.test(fnSrc), '★含 army.supply(0-100) 兜底分支');
ok(/Math\.max\(0, Math\.min\(100, Number\(army\.supply\)/.test(fnSrc), 'supply 夹 0-100 后折算');

function strength(army){
  const ctx = { Math:Math, Number:Number, console:console, P:{}, findCharByName:function(){return null;}, _armyMorale:function(a){return (a&&a.morale!=null)?a.morale:60;} };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.go=calculateArmyStrength;', ctx);
  return ctx.go(army, {});
}
const sFull = strength({ soldiers:1000, supply:100 });
const sLow  = strength({ soldiers:1000, supply:20 });
const sNone = strength({ soldiers:1000 }); // 无 supply 无 supplyRatio
ok(sLow < sNone, '★断粮(supply20) 战力 < 无补给字段(默认满)');
ok(sNone < sFull, '满补给(supply100) 战力 > 默认');
ok(Math.abs(sFull/sLow - 1.2/0.64) < 0.01, 'supplyMod 比值符合 1.2 : 0.64');
// supplyRatio 仍优先(补给系统启用路径不破坏)
const sRatio = strength({ soldiers:1000, supplyRatio:1.0, supply:0 });
ok(sRatio > sNone, 'supplyRatio 仍优先于 supply(向后兼容)');

// swap-test:旧逻辑只有 supplyRatio 分支 → supply 被忽略 → 满/断同战力
function oldStrength(army){
  const old = fnSrc.replace(/} else if \(army\.supply != null\) \{[\s\S]*?\n  \}/, '}');
  const ctx = { Math:Math, Number:Number, console:console, P:{}, findCharByName:function(){return null;}, _armyMorale:function(a){return (a&&a.morale!=null)?a.morale:60;} };
  vm.createContext(ctx);
  vm.runInContext(old + '\nthis.go=calculateArmyStrength;', ctx);
  return ctx.go(army, {});
}
ok(oldStrength({soldiers:1000,supply:100}) === oldStrength({soldiers:1000,supply:20}), '★swap-test:旧逻辑 supply 不影响战力(复现摆设 bug)');

console.log('\n结果: '+A+' 通过 / 0 失败');
