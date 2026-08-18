#!/usr/bin/env node
'use strict';
// smoke-save-saved-clone — 自动存档 _saved* 镜像双克隆消除(纯安全提速·序列化输出不变)
//   实跑 _autoSaveSnapshotGM(deepClone 桩计数):① _saved* 引用零二次克隆 ② SKIP 优先排除 ③ APPEND_ONLY 引用
//   ④ 普通 mutable 仍深拷 ⑤ 输出完整(_saved* 在·primitive 透传·函数排除) ⑥ desktopDoSave 复用快照(源契约)
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }

console.log('smoke-save-saved-clone');

const save = fs.readFileSync(path.join(ROOT,'tm-save-lifecycle.js'),'utf8');
const snapSrc = sliceFn(save, 'function _autoSaveSnapshotGM(');
ok(!!snapSrc && /_saved/.test(snapSrc), '快照函数抽取成功');

const ctx = { cloneCount: 0 };
ctx.deepClone = function(v){ ctx.cloneCount++; return JSON.parse(JSON.stringify(v)); };
ctx.GM = {
  turn: 5,                       // primitive → 透传
  affinityMap: { a: 1 },         // 普通 mutable → 深拷(唯一应克隆者)
  _savedAffinityMap: { a: 1 },   // _saved 镜像 → 引用
  _savedHarem: { h: 2 },         // _saved 镜像 → 引用
  qijuHistory: [1, 2],           // APPEND_ONLY → 引用
  _facIndex: { x: 1 },           // SKIP → 排除
  _savedMapData: { m: 1 },       // SKIP(且 _saved)→ SKIP 优先·排除
  _aiTelemetry: { t: 1 },        // SKIP → 排除
  fn: function(){}               // 函数 → 排除
};
vm.createContext(ctx);
vm.runInContext(snapSrc + '\nthis.OUT = _autoSaveSnapshotGM();', ctx);
const out = ctx.OUT;

ok(out._savedAffinityMap === ctx.GM._savedAffinityMap, '① _savedAffinityMap 引用(同一对象·未二次克隆)');
ok(out._savedHarem === ctx.GM._savedHarem, '① _savedHarem 引用(同一对象)');
ok(out.qijuHistory === ctx.GM.qijuHistory, '③ APPEND_ONLY qijuHistory 引用');
ok(out.affinityMap && out.affinityMap !== ctx.GM.affinityMap, '④ 普通 mutable affinityMap 深拷(新对象)');
ok(!('_facIndex' in out), '② SKIP _facIndex 排除');
ok(!('_savedMapData' in out), '② SKIP 优先于 _saved(_savedMapData 排除·不被引用进档)');
ok(!('_aiTelemetry' in out), '② SKIP _aiTelemetry 排除');
ok(!('fn' in out), '⑤ 函数排除');
ok(out.turn === 5, '⑤ primitive 透传');
ok(ctx.cloneCount === 1, '★ 只深拷 1 次(普通 mutable)·_saved* 镜像零二次克隆(原会多拷 2 个)');

// ⑥ desktopDoSave 复用统一纯 builder(源契约·准备只作用于 detached snapshot)
ok(/function _buildSaveState\(/.test(save), '⑥ 统一 _buildSaveState 构造器存在');
ok(/var saveData=_buildSaveState\(\{format:'project'\}\)/.test(save), '⑥ desktopDoSave 复用 _buildSaveState(project)');
ok(/var gmSnapshot = _autoSaveSnapshotGM\(sourceGM\);[\s\S]*?var pWorking = deepClone\(sourceP \|\| \{\}\);[\s\S]*?_prepareGMForSave\(gmSnapshot, pWorking\)/.test(save),
  '⑥ builder 先脱离 live GM/P，再执行存档准备');
ok(save.indexOf('saveData.gameState=deepClone(GM);') < 0, '⑥ 手动档裸 deepClone(GM) 已清(saveData 路径)');

console.log('\n结果: '+A+' 通过 / 0 失败');
