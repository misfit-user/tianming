#!/usr/bin/env node
'use strict';
// smoke-tier3-connects — Tier3 接通(本轮做的低风险批):战争注入AI/主帅阵亡/fortification消费方/sides真bug
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8'); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-tier3-connects');

// ── 簇5#3 战争状态注入 AI ──
const ctxSrc = read('tm-endturn-ai-context.js');
const fnSrc = sliceFn(ctxSrc, 'function appendPromptPolicyContext(');
function runCtx(GM){
  const ctx = { Math:Math, Number:Number, String:String, Array:Array, isFinite:isFinite, console:console, Object:Object, global:{}, window:{}, TM:{} };
  vm.createContext(ctx);
  vm.runInContext('function _capture(){};function _slice(v,n){return String(v==null?"":v).slice(0,n||120);}\n'+fnSrc+'\nthis.go=appendPromptPolicyContext;', ctx);
  return ctx.go('', { GM: GM });
}
const out = runCtx({ turn:10, activeWars:[{ attacker:'本朝', defender:'后金', warScore:-40, reason:'辽东', startTurn:5 }] });
ok(out.indexOf('【当前战事】') >= 0, '★运行:含【当前战事】');
ok(out.indexOf('本朝 攻 后金') >= 0, '★交战双方注入');
ok(/战势=-40/.test(out), '战势数值注入');
ok(/已历5回合/.test(out), '战争时长注入');
ok(runCtx({turn:1, activeWars:[]}).indexOf('【当前战事】') < 0, '无战事不注入(条件守卫)');

// ── 簇3#6 主帅阵亡 morale + fortification 消费方 ──
const strengthSource = read('tm-battle-contract.js');
// fortification 行为验证
const cas = sliceFn(strengthSource, 'function calculateArmyStrength(');
function strength(army, ctxArg){
  const c = { Math:Math, Number:Number, console:console, P:{}, findCharByName:function(){return null;}, _armyMorale:function(a){return 60;} };
  vm.createContext(c);
  vm.runInContext(cas + '\nthis.go=calculateArmyStrength;', c);
  return c.go(army, ctxArg||{});
}
const sFortDef = strength({soldiers:1000, fortification:100}, {isDefender:true});
const sNoFortDef = strength({soldiers:1000}, {isDefender:true});
ok(sFortDef > sNoFortDef, '★守城+满加固 战力 > 守城无加固');
const sFortAtk = strength({soldiers:1000, fortification:100}, {isDefender:false});
const sNoFortAtk = strength({soldiers:1000}, {isDefender:false});
ok(Math.abs(sFortAtk - sNoFortAtk) < 1e-6, '加固只在守城生效(攻方不吃加成)');

// ── 簇4#7 sides 检测真bug ──

console.log('\n结果: '+A+' 通过 / 0 失败');
