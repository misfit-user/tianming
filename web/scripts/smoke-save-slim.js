#!/usr/bin/env node
'use strict';
// smoke-save-slim — 存档瘦身 P1 两案守卫
//   案一(缩进剥离)：导出存档写口紧凑·compact 与 pretty 反解析深等价。
//   案二(_saved* 镜像去重)：_autoSaveSnapshotGM 跳过冗余 GM 镜像·活字段仍在档·
//     子系统/DOM/聚合/P层/切片类 _saved* 仍序列化(白名单法)·老档(含镜像)与新档(仅活字段)
//     经 _restoreSavedFields 恢复结果逐字段等价。
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function ok(c, m){ if(!c) throw new Error('FAIL: '+m); A++; console.log('  ✓ '+m); }
function sliceFn(src, marker){ const a=src.indexOf(marker); if(a<0) return null; let i=src.indexOf('{',a),d=0,j=i; for(;j<src.length;j++){const c=src[j]; if(c==='{')d++; else if(c==='}'){d--; if(d===0){j++;break;}}} return src.slice(a,j); }
function deepEq(a,b){ return JSON.stringify(a)===JSON.stringify(b); }

console.log('smoke-save-slim');

const save = fs.readFileSync(path.join(ROOT,'tm-save-lifecycle.js'),'utf8');
const mgr  = fs.readFileSync(path.join(ROOT,'tm-save-manager.js'),'utf8');

// ─────────────────────────────────────────────────────────
// 案一·导出写口紧凑(静态)
// ─────────────────────────────────────────────────────────
ok(save.indexOf('JSON.stringify(saveData2,null,2)') < 0, '案一·浏览器导出去缩进(saveData2 无 ,null,2)');
ok(save.indexOf('JSON.stringify(saveData2)') >= 0, '案一·浏览器导出改紧凑');
ok(mgr.indexOf('JSON.stringify(exportRec, null, 2)') < 0, '案一·exportSave 去缩进(exportRec 无 ,null,2)');
ok(mgr.indexOf('JSON.stringify(exportRec)') >= 0, '案一·exportSave 改紧凑');
// 反解析等价(compact ↔ pretty 读端双向兼容)
const sampleRec = { id:'slot_0', gameState:{ GM:{turn:7, chars:[{name:'甲',hp:3}], _convArchive:[{t:'x'}] }, P:{conf:{}} }, _format:'tianming-save-v1' };
ok(deepEq(JSON.parse(JSON.stringify(sampleRec)), JSON.parse(JSON.stringify(sampleRec,null,2))), '案一·compact 与 pretty 反解析深等价');

// ─────────────────────────────────────────────────────────
// 案二·SKIP 白名单/黑名单静态守卫
// ─────────────────────────────────────────────────────────
const DEDUP = ['_savedConvArchive','_savedMemoryArchiveFull','_savedLetters','_savedEdictTracker',
  '_savedEdictSuggestions','_savedNpcActionLedger','_savedChronicle','_savedCulturalWorks',
  '_savedProvinceStats','_savedHistoryIndex','_savedFactionRelationsMap','_savedNpcCommitments',
  '_savedCharacterArcs','_savedEdictLifecycle','_savedCourtRecords','_savedNpcFactionAiTurnLedger',
  '_savedFamilies','_savedCausalGraph','_savedMemoryLayers','_savedBattleHistory','_savedFactionArcs'];
const snapSrc = sliceFn(save, 'function _autoSaveSnapshotGM(');
ok(!!snapSrc, '案二·快照函数抽取成功');
// SKIP 对象文本(取 var SKIP = { ... };)
const skipBlock = (snapSrc.match(/var SKIP = \{[\s\S]*?\};/) || [''])[0];
DEDUP.forEach(function(k){ ok(skipBlock.indexOf(k+':1')>=0, '案二·SKIP 含去重镜像 '+k); });
// 刻意排除者绝不能进 SKIP(否则丢数据)
const MUST_KEEP = ['_savedEventOpinions','_savedEventBus','_savedEdictDrafts','_savedCharMemExt',
  '_savedCharOfficeFields','_savedVassalSystem','_savedGovernment','_savedNpcDecisionDiagnostics','_savedRenli'];
MUST_KEEP.forEach(function(k){ ok(skipBlock.indexOf(k)<0, '案二·SKIP 不含须保留者 '+k); });

// 每个去重镜像的 restore 都是条件式(缺席时活字段原样生效)
const restoreSrc = sliceFn(save, 'function _restoreSavedFields(');
const hasOwnSrc = sliceFn(save, 'function _tmHasOwn(');
ok(!!restoreSrc, '案二·恢复函数抽取成功');
ok(!!hasOwnSrc, '案二·安全自有字段判定函数抽取成功');
DEDUP.forEach(function(k){ ok(new RegExp('if\\s*\\(\\s*GM\\.'+k+'\\b').test(restoreSrc), '案二·'+k+' 恢复为条件式'); });

// ─────────────────────────────────────────────────────────
// 案二·运行时·快照跳过去重镜像·活字段仍在·保留镜像仍在
// ─────────────────────────────────────────────────────────
const ctx = { cloneCount:0 };
ctx.deepClone = function(v){ ctx.cloneCount++; return JSON.parse(JSON.stringify(v)); };
ctx.GM = {
  turn: 9,
  _convArchive: [{c:1}],            _savedConvArchive: [{c:1}],       // 活字段(APPEND_ONLY)+去重镜像
  letters: [{l:1}],                 _savedLetters: [{l:1}],           // 活字段(普通)+去重镜像
  _memoryArchiveFull: [{m:1}],      _savedMemoryArchiveFull: [{m:1}],
  culturalWorks: [{w:1}],           _savedCulturalWorks: [{w:1}],
  _savedEventBus: {bus:1},          // 保留镜像(子系统态·无活字段孪生)→ 仍须在档
  _savedCharMemExt: {甲:{arcs:[1]}} // 保留镜像(逐角色聚合)→ 仍须在档
};
vm.createContext(ctx);
vm.runInContext(snapSrc + '\nthis.OUT = _autoSaveSnapshotGM();', ctx);
const out = ctx.OUT;
ok(!('_savedConvArchive' in out), '案二·快照剔除 _savedConvArchive');
ok(!('_savedLetters' in out), '案二·快照剔除 _savedLetters');
ok(!('_savedMemoryArchiveFull' in out), '案二·快照剔除 _savedMemoryArchiveFull');
ok(!('_savedCulturalWorks' in out), '案二·快照剔除 _savedCulturalWorks');
ok(deepEq(out._convArchive, ctx.GM._convArchive), '案二·活字段 _convArchive 仍在档(去重不丢数据)');
ok(deepEq(out.letters, ctx.GM.letters), '案二·活字段 letters 仍在档');
ok(deepEq(out._memoryArchiveFull, ctx.GM._memoryArchiveFull), '案二·活字段 _memoryArchiveFull 仍在档');
ok(deepEq(out.culturalWorks, ctx.GM.culturalWorks), '案二·活字段 culturalWorks 仍在档');
ok('_savedEventBus' in out && deepEq(out._savedEventBus, ctx.GM._savedEventBus), '案二·保留镜像 _savedEventBus 仍在档');
ok('_savedCharMemExt' in out && deepEq(out._savedCharMemExt, ctx.GM._savedCharMemExt), '案二·保留镜像 _savedCharMemExt 仍在档');

// ─────────────────────────────────────────────────────────
// 案二·读端等价·老档(含镜像) vs 新档(仅活字段) 经 _restoreSavedFields 结果一致
// ─────────────────────────────────────────────────────────
function restoreOn(gm){
  const c = { GM: JSON.parse(JSON.stringify(gm)), P: {}, setTimeout:function(){}, clearTimeout:function(){} };
  c.window = c; c.global = c;
  vm.createContext(c);
  vm.runInContext(hasOwnSrc + '\n' + restoreSrc + '\n_restoreSavedFields();\nthis.RES = GM;', c);
  return c.RES;
}
const liveVal = { _convArchive:[{c:1},{c:2}], letters:[{l:9}], _courtRecords:[{r:1}] };
const oldSave = Object.assign({ turn:9 }, liveVal, {
  _savedConvArchive: JSON.parse(JSON.stringify(liveVal._convArchive)),
  _savedLetters: JSON.parse(JSON.stringify(liveVal.letters)),
  _savedCourtRecords: JSON.parse(JSON.stringify(liveVal._courtRecords))
});
const newSave = Object.assign({ turn:9 }, liveVal); // 去重后：只有活字段·无 _saved* 镜像
const rOld = restoreOn(oldSave);
const rNew = restoreOn(newSave);
ok(deepEq(rOld._convArchive, rNew._convArchive), '案二·恢复后 _convArchive 老档==新档');
ok(deepEq(rOld.letters, rNew.letters), '案二·恢复后 letters 老档==新档');
ok(deepEq(rOld._courtRecords, rNew._courtRecords), '案二·恢复后 _courtRecords 老档==新档');
ok(deepEq(rOld._convArchive, liveVal._convArchive), '案二·恢复值==存档活字段值(无损)');
// 恢复后 _saved* 镜像均被清(老档路径)·新档本就无
['_savedConvArchive','_savedLetters','_savedCourtRecords'].forEach(function(k){
  ok(!(k in rOld), '案二·老档恢复后清除镜像 '+k);
});

console.log('\n结果: '+A+' 通过 / 0 失败');
