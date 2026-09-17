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
ok(/\/精锐\|精兵\|百战\|劲旅\/\.test\(_qmStr\)/.test(mil), '★quality 关键词归一(精锐/精兵/百战/劲旅→1.3)');
ok(/\/新兵\|新募\|老弱\|疲\|羸\|乌合\/\.test\(_qmStr\)/.test(mil), '弱兵关键词(新兵/新募/老弱/疲/羸/乌合→0.7)');
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
const prompt = read('tm-endturn-prompt.js');
ok(prompt.indexOf('training_delta') >= 0, '★army_changes prompt 点名 training_delta(apply 早支持·AI 原不知字段名)');

// ── region_status 读回 ──
const ctxF = read('tm-endturn-ai-context.js');
ok(ctxF.indexOf('【现行地块状态】') >= 0, '★region_status 读回块在位');
ok(/region_status_changes remove/.test(ctxF), '指示 AI 灾异消弭须 remove');

// ── 常朝回流 ──
const chao = (read('tm-chaoyi-changchao-adapter.js') + read('tm-chaoyi-changchao.js') + read('tm-chaoyi-changchao-flows.js'));
ok(/recordPlayerResponse\(GM, \{ channel: 'chaoyi', decision: action, linkedIssue: _miLink/.test(chao), '★常朝处置回喂 MinxinPressureActions(民心矩阵认账·不再重复 spawn)');
ok(/changchao-minxin-pressure-response/.test(chao), '回流标记 source');

console.log('\n结果: '+A+' 通过 / 0 失败');
