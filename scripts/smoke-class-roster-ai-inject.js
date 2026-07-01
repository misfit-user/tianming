#!/usr/bin/env node
'use strict';
// smoke-class-roster-ai-inject — 阶层正册回归修(Tier1·簇5#1)
//   Phase-3 抽取重构把【阶层正册】漏迁出活路径 appendPromptPolicyContext → 主推演对阶层全盲(历史大bug复发)。
//   验:活路径函数含阶层块+运行真注入；无阶层时不注入(条件正确)。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-class-roster-ai-inject');
const src = fs.readFileSync(path.join(ROOT,'tm-endturn-ai-context.js'),'utf8');
const fnSrc = sliceFn(src, 'function appendPromptPolicyContext(');
ok(!!fnSrc, 'appendPromptPolicyContext 抽取成功');
ok(fnSrc.indexOf('【阶层正册】') >= 0, '★活路径函数含【阶层正册】块(回归修复)');
ok(fnSrc.indexOf('class_changes 须以正册为准') >= 0, '含 class_changes 正册指令');

function run(GM){
  const ctx = { Math:Math, Number:Number, String:String, Array:Array, isFinite:isFinite, console:console, Object:Object, global:{}, window:{}, TM:{} };
  vm.createContext(ctx);
  vm.runInContext('function _capture(){};function _slice(v,n){return String(v==null?"":v).slice(0,n||120);}\n'+fnSrc+'\nthis.go=appendPromptPolicyContext;', ctx);
  return ctx.go('', { GM: GM });
}
const GM = { turn:5, classes:[
  { name:'士绅', satisfaction:62, influence:40, _structBaseline:55, currentDemand:'减赋', _satLedger:[{t:5,d:-3}] },
  { name:'农户', satisfaction:28, influence:15, demands:['赈灾','减役'], _radicalFrac:0.5 }
]};
const out = run(GM);
ok(out.indexOf('【阶层正册】') >= 0, '★运行输出含【阶层正册】');
ok(out.indexOf('士绅') >= 0 && out.indexOf('农户') >= 0, '两阶层名都注入');
ok(/满意62/.test(out), '士绅满意度数值注入');
ok(/满意28/.test(out), '农户满意度数值注入');
ok(/求:减赋/.test(out), '诉求注入(currentDemand)');
ok(/乱民5成\(汹汹\)/.test(out), '★乱民比例(B)注入正册·农户0.5→乱民5成(汹汹)');
ok((out.match(/乱民\d成/g) || []).length === 1, '安康阶层(士绅·无_radicalFrac)不显乱民token(阈值守卫·只农户1处)');

// 条件正确性:无阶层 → 不注入(防空块)
const out0 = run({ turn:5, classes:[] });
ok(out0.indexOf('【阶层正册】') < 0, '无阶层时不注入正册块(条件守卫)');

console.log('\n结果: '+A+' 通过 / 0 失败');
