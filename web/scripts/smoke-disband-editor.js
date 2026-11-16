#!/usr/bin/env node
'use strict';
// smoke-disband-editor — 编辑器裁撤部队命名 handler(#29·按 owner 设计纠偏)
//   编辑器(authoring)裁撤走命名 handler+反馈(非裸内联 splice·非 gameplay UI confirm)·gameplay 裁军走诏书/朝议制度通道
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-disband-editor');

const mil = fs.readFileSync(path.join(ROOT,'tm-military-ui.js'),'utf8');
const fnSrc = sliceFn(mil, 'function disbandArmyInEditor(');
ok(!!fnSrc, 'disbandArmyInEditor 抽取成功');

function run(armies, i){
  const ctx = { Array: Array };
  ctx.P = { military: { armies: armies } };
  ctx.toasts = []; ctx.renders = 0;
  ctx.toast = function(t){ ctx.toasts.push(t); };
  ctx.renderEdTab = function(){ ctx.renders++; };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.go = disbandArmyInEditor;', ctx);
  ctx.go(i);
  return ctx;
}

var c = run([{name:'京营'},{name:'辽东军'},{name:'宣大军'}], 1);
ok(c.P.military.armies.length === 2, '裁撤 index 1 → 3→2');
ok(c.P.military.armies.map(function(a){return a.name;}).indexOf('辽东军') < 0, '辽东军已移除');
ok(c.toasts[0] === '已解散 辽东军', '★反馈 toast「已解散 辽东军」(原裸 splice 无反馈)');
ok(c.renders === 1, '重渲染编辑器');

var c2 = run([{name:'A'}], 5);
ok(c2.P.military.armies.length === 1, '越界 index → no-op(不误删)');
var c3 = run([{name:'A'}], -1);
ok(c3.P.military.armies.length === 1, '负 index → no-op');

// 源契约
ok(mil.indexOf('armies.splice("+i+",1);renderEdTab') < 0, '裸内联 splice 已清');

console.log('\n结果: '+A+' 通过 / 0 失败');
