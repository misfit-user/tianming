#!/usr/bin/env node
'use strict';
// smoke-tier3-supplement — Tier3补(干净非平衡):quality死字段/training prompt点名/region_status读回/常朝回流
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8'); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-tier3-supplement');

// ── quality 死字段复活 ──
const militaryCore = read('tm-military.js');
const mil = read('tm-battle-contract.js');
const cas = sliceFn(mil, 'function calculateArmyStrength(');
function strength(q){
  const c = { Math:Math, Number:Number, String:String, console:console, P:{}, findCharByName:function(){return null;}, _armyMorale:function(){return 60;} };
  vm.createContext(c);
  vm.runInContext(cas + '\nthis.go=calculateArmyStrength;', c);
  return c.go({ soldiers:1000, quality:q }, {});
}
const sElite = strength('精兵');   // 新关键词(旧版只认"精锐")
const sNormal = strength('普通');
const sWeak = strength('老弱');     // 新关键词(旧版只认"新兵")
ok(sElite > sNormal, '★"精兵"(新关键词)→战力高于普通(旧版认不出=1.0)');
ok(sWeak < sNormal, '★"老弱"(新关键词)→战力低于普通');
ok(Math.abs(sElite/sNormal - 1.3) < 0.01 && Math.abs(sWeak/sNormal - 0.7) < 0.01, '量级 1.3/0.7 不变(只扩关键词不改强度)');

// ── training prompt 点名字段 ──

// ── region_status 读回 ──

// ── 常朝回流 ──

console.log('\n结果: '+A+' 通过 / 0 失败');
