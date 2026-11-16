#!/usr/bin/env node
'use strict';
// smoke-memorial-court-debate — 奏疏发廷议死路径修(Tier1·簇6#3)
//   旧版写错 DOM id cy-topic-input + 裸调 startChaoyiSession 不带议题→议题丢失、弹空白朝议。
//   修:复用 _pendingTinyiTopics 队列(与 phase8-formal-drafts 同源)。验:真入队 + 幂等 + 不再调 startChaoyiSession。
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-memorial-court-debate');
const src = fs.readFileSync(path.join(ROOT,'tm-memorials.js'),'utf8');
const fnSrc = sliceFn(src, 'function _courtDebateMemorial(');
ok(!!fnSrc, '_courtDebateMemorial 抽取成功');
var code = fnSrc.replace(/\/\/[^\n]*/g, ''); // 剔行注释(修复注释里会提及旧 API 名)
ok(code.indexOf('startChaoyiSession') < 0, '★不再裸调 startChaoyiSession(剔注释后)');
ok(code.indexOf('cy-topic-input') < 0, '★不再写错误 DOM id cy-topic-input(剔注释后)');

function run(GM, idx){
  const ctx = { GM:GM, Array:Array, String:String, Number:Number, isNaN:isNaN, console:console };
  ctx._$ = function(){ return { value:'' }; };
  ctx.toast = function(){};
  ctx.renderMemorials = function(){};
  ctx.staged = [];
  ctx._stageMemorialDecision = function(m,d,r){ ctx.staged.push({m:m,d:d,r:r}); };
  // _courtDebateMemorial 现依赖共享 helper _memResolve(@tm-memorials.js)·照其真实签名补桩(按 id 解析·回退数字下标)
  ctx._memResolve = function(ref){
    var list = GM.memorials || [];
    if (ref == null) return null;
    for (var i = 0; i < list.length; i++) { if (list[i] && list[i].id === ref) return list[i]; }
    var n = Number(ref);
    if (!isNaN(n) && n >= 0 && list[n]) return list[n];
    return null;
  };
  vm.createContext(ctx);
  vm.runInContext(fnSrc + '\nthis.go=_courtDebateMemorial;', ctx);
  ctx.go(idx);
  return ctx;
}
const GM = { turn:3, memorials:[{ from:'张维贤', content:'请蠲免江南三府赋税', id:'m9' }], _pendingTinyiTopics:[] };
const c = run(GM, 0);
ok(GM._pendingTinyiTopics.length === 1, '★奏疏真入廷议待议队列(1 条)');
const t = GM._pendingTinyiTopics[0];
ok(t.sourceType === 'memorial', 'sourceType=memorial');
ok(t.topic.indexOf('张维贤') >= 0 && t.topic.indexOf('请蠲免江南') >= 0, '★议题含上奏者+奏疏内容(不丢失)');
ok(t.from === '奏疏发廷议', 'from 标记来源');
ok(c.staged.length === 1 && c.staged[0].d === 'court_debate', '仍 stage court_debate 决定');

// 幂等:再点不重复入队
run(GM, 0);
ok(GM._pendingTinyiTopics.length === 1, '★同回合再发廷议幂等(仍 1 条·_memTinyiId 去重)');

console.log('\n结果: '+A+' 通过 / 0 失败');
