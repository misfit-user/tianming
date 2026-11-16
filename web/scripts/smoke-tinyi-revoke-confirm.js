#!/usr/bin/env node
'use strict';
// smoke-tinyi-revoke-confirm — 廷议惩处二次确认(误操作防护·#24)
//   实跑 _ty3_promptAction:① 革职/削籍/仗下 confirm=false→不执行 ② confirm=true→执行 ③ 摘除(轻)不弹确认
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-tinyi-revoke-confirm');

const src = (fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3-persona.js'), 'utf8') + '\n' + (fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3-edict-personnel.js'), 'utf8')) + '\n' + fs.readFileSync(path.join(ROOT, 'tm-tinyi-v3-parties.js'), 'utf8'));
const fnSrc = sliceFn(src, 'function _ty3_promptAction(');
ok(!!fnSrc, '_ty3_promptAction 抽取成功');

function run(actionType, confirmResult){
  const calls = [];
  const ctx = {};
  ctx.CY = { _ty3: { topic: 'x' } };
  ctx.prompt = function(){ return '张三'; };
  ctx.findCharByName = function(n){ return { name: n }; };
  ctx.toast = function(){};
  ctx.confirm = function(){ calls.push('confirm'); return confirmResult; };
  ['Flogging','Strip','Dismiss','Revoke','Reopen','ToPart'].forEach(function(a){ ctx['_ty3_action'+a] = function(){ calls.push(a); }; });
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.go = function(t){ _ty3_promptAction(t); };', ctx);
  ctx.go(actionType);
  return calls;
}

// ① 革职 confirm=false → 不执行
var r0 = run('revoke', false);
ok(r0.indexOf('confirm') >= 0, '① 革职先弹 confirm');
ok(r0.indexOf('Revoke') < 0, '① ★confirm=false → 革职不执行(打错名可中止)');

// ② 革职 confirm=true → 执行
var r1 = run('revoke', true);
ok(r1.indexOf('Revoke') >= 0, '② confirm=true → 革职执行');

// 削籍/仗下 同样受闸
ok(run('strip', false).indexOf('Strip') < 0, '① 削籍 confirm=false → 不执行');
ok(run('flogging', false).indexOf('Flogging') < 0, '① 仗下 confirm=false → 不执行');
ok(run('strip', true).indexOf('Strip') >= 0, '② 削籍 confirm=true → 执行');

// ③ 摘除(轻·favor-3)不弹确认·直接执行
var d = run('dismiss', false);
ok(d.indexOf('confirm') < 0, '③ 摘除(轻)不弹确认(仅革职/削籍/仗下设防)');
ok(d.indexOf('Dismiss') >= 0, '③ 摘除直接执行(confirm=false 也不挡)');

console.log('\n结果: '+A+' 通过 / 0 失败');
