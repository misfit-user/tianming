#!/usr/bin/env node
// smoke-hidden-moves-hygiene.js — 悬账小修批（深挖第六轮⑥）
// 验：①executionConstraints 死代码已删且不复活 ②_npcHiddenMoves 封顶40(此前只增不裁)
//     ③slander 与 obstruct 双落账对齐(此前 slander 只进 cap80 的 InternalActionHistory·
//       高活跃局4回合窗内可被挤出→同人反复攻讦的 recency 惩罚与密探暗流计数漏 slander)。
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
let N = 0;
function assert(cond, msg) { N++; if (!cond) { console.error('ASSERT FAIL [' + N + ']:', msg); process.exit(1); } }
function load(ctx, rel) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, rel), 'utf8'), ctx, { filename: rel });
}

// ── ① executionConstraints 死代码已删（防复活守卫）──
const runtimeFiles = fs.readdirSync(ROOT).filter(function (f) { return /\.js$/.test(f); });
let defHits = 0, writeHits = 0;
runtimeFiles.forEach(function (f) {
  const src = fs.readFileSync(path.join(ROOT, f), 'utf8');
  if (src.indexOf('function createExecutionConstraint') >= 0) defHits++;
  if (src.indexOf('GM.executionConstraints') >= 0) writeHits++;
});
assert(defHits === 0, '① createExecutionConstraint 定义已删·全运行时零复活');
assert(writeHits === 0, '② GM.executionConstraints 读写全清·子树死绝');


// The views now describe intentions. They are not independent executable actions or automatic grievances.
const ctx=require('./lib-npc-action-fixture').fixture(),a=ctx.actor('a','张三'),b=ctx.actor('b','李四');
function act(type,id){return ctx.TM.NPC.ActionLedger.ingest({actionId:id,actorId:a.id,targetId:b.id,behaviorType:type,intent:'待拟具体办法'},'hygiene');}
assert(act('obstruct','ob-1').outcome==='submitted','obstruct keeps a pending plan');
assert(act('slander','sl-1').outcome==='submitted','slander keeps a pending plan');
assert(ctx.GM._npcHiddenMoves.length===2,'both hidden-move views retain their sources');
assert(ctx.GM._npcHiddenMoves.every(m=>m.planId&&m.status==='intended'),'views never assert unverified execution');
assert(ctx.GM._npcPlans.length===2&&ctx.GM._npcPlans.every(p=>p.progress===0),'registration gives no progress');
assert(b.loyalty===80&&(b._memory||[]).length===0,'a secret intention cannot psychically affect its subject');
assert(act('slander','sl-1').duplicate===true&&ctx.GM._npcHiddenMoves.length===2,'replay cannot make another view or plan');
for(let i=0;i<50;i++)act('obstruct','ob-'+(i+2));
assert(ctx.GM._npcHiddenMoves.length===40,'display history retains its bounded length');
assert(ctx.GM._npcPlans.length===52,'view trimming cannot destroy active obligations');
assert(typeof ctx.createExecutionConstraint==='undefined','retired driver remains absent');
console.log('smoke-hidden-moves-hygiene OK — '+N+' assertions');
