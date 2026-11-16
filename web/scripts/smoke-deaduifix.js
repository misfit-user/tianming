#!/usr/bin/env node
'use strict';
// smoke-deaduifix — 时政「御前召对群臣」/科举「咨询」死UI修复:错id cy-topic-input → 推待议队列+开_ty2_openSetup+预填ty2-topic
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function read(f){ return fs.readFileSync(path.join(ROOT,f),'utf8'); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-deaduifix');

// ══ A. 时政 _shizhengConvene(行为级) ══
const szSrc = read('tm-shizheng-panel.js');
const fnSz = sliceFn(szSrc, 'function _shizhengConvene(');
ok(fnSz && fnSz.indexOf('_pendingTinyiTopics') >= 0, '★时政:议题推入 _pendingTinyiTopics 队列');

function runShizheng(clicks){
  const ty2input = { value:'' };
  const calls = { ty2:0, chaoyi:0, toast:0 };
  const ctx = { Array:Array, String:String, Object:Object, console:console,
    window: {},
    document: { getElementById: function(id){ return id==='ty2-topic' ? ty2input : null; } },
    _ty2_openSetup: function(){ calls.ty2++; },
    openChaoyi: function(){ calls.chaoyi++; },
    toast: function(){ calls.toast++; },
    setTimeout: function(fn){ try{ fn(); }catch(e){} } };
  ctx.window.GM = { turn:5, currentIssues:[{ id:'iss1', title:'河患急议', description:'黄河决口待赈' }] };
  vm.createContext(ctx);
  vm.runInContext(fnSz + '\nthis.go=_shizhengConvene;', ctx);
  for (let k=0;k<clicks;k++) ctx.go('iss1');
  return { GM: ctx.window.GM, calls, ty2input };
}
const r1 = runShizheng(1);
ok(Array.isArray(r1.GM._pendingTinyiTopics) && r1.GM._pendingTinyiTopics.length === 1, '★点击后议题真入待议队列(1条)');
ok(r1.GM._pendingTinyiTopics[0].topic.indexOf('河患急议') >= 0, '队列议题含原议题标题(不丢失)');
ok(r1.GM._pendingTinyiTopics[0].sourceType === 'shizheng', '队列项标记 sourceType=shizheng');
ok(r1.calls.ty2 === 1 && r1.calls.chaoyi === 0, '★直开廷议筹备面板(_ty2_openSetup)·不绕模式选择器');
ok(r1.ty2input.value.indexOf('河患急议') >= 0, '★真输入框 ty2-topic 被预填议题(死id已修)');
const r2 = runShizheng(2);
ok(r2.GM._pendingTinyiTopics.length === 1, '★连点两次幂等去重·队列仍1条(不重复积压)');

// ══ B. 科举 kejuConsultCourtier / kejuConsultGuanGe(行为级·兜底分支) ══
const kjSrc = read('tm-keju.js');
ok(kjSrc.indexOf("cy-topic-input") < 0, '★科举:死id cy-topic-input 已彻底清除');
function runKeju(fnName, withWendui){
  const fnK = sliceFn(kjSrc, 'function ' + fnName + '(');
  const ty2input = { value:'' };
  const calls = { wendui:0, ty2:0, chaoyi:0, toast:0 };
  const ctx = { String:String, Array:Array, console:console,
    P: { keju:{ currentExam:{ huishiTopic:'会试策问·农政', playerQuestion:'殿试亲策', chiefExaminer:'张瑞图' } } },
    GM: { chars:[] },
    _ty2_openSetup: function(){ calls.ty2++; },
    openChaoyi: function(){ calls.chaoyi++; },
    _$: function(id){ return id==='ty2-topic' ? ty2input : null; },
    toast: function(){ calls.toast++; },
    setTimeout: function(fn){ try{ fn(); }catch(e){} } };
  if (withWendui) ctx.openWenduiPanel = function(){ calls.wendui++; };
  vm.createContext(ctx);
  vm.runInContext(fnK + '\nthis.go=' + fnName + ';', ctx);
  ctx.go();
  return { calls, ty2input };
}
// 兜底分支(openWenduiPanel 未定义)
const kc = runKeju('kejuConsultCourtier', false);
ok(kc.calls.ty2 === 1 && kc.calls.chaoyi === 0, '★科举·会试咨询兜底:开 _ty2_openSetup(非死的 openChaoyi+错id)');
ok(kc.ty2input.value !== '' && kc.ty2input.value.indexOf('咨询') >= 0, '会试咨询:真输入框 ty2-topic 被预填');
const kg = runKeju('kejuConsultGuanGe', false);
ok(kg.calls.ty2 === 1 && kg.ty2input.value !== '', '★科举·殿试咨询兜底:同样开 _ty2_openSetup + 预填 ty2-topic');
// 主路(openWenduiPanel 已定义)不受影响
const kp = runKeju('kejuConsultCourtier', true);
ok(kp.calls.wendui === 1 && kp.calls.ty2 === 0, '主路 openWenduiPanel 在时·走问对面板·不触发兜底(未破坏)');

console.log('\n结果: ' + A + ' 通过 / 0 失败');
