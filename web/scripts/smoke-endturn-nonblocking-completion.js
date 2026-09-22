'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {loadFunctions}=require('./lib-save-commit-boundary');
const ROOT=path.resolve(__dirname,'..'),story='主推演已经完成：遵诏赈济灾民，并记录本期朝政与地方实情。';
function fixture(){
 const c={console:{log(){},warn(){},error(){}},Date,Promise,Number,Error,Object,Array,JSON,performance,setTimeout,clearTimeout,
 GM:{turn:4,shijiHistory:[],_campaignId:'a',_timelineId:'b'},P:{ai:{key:'fixture'},conf:{}},TM:{},_tmLoadGen:0};
 c.window=c;c.globalThis=c;vm.createContext(c);
 for(const file of ['tm-endturn-validity.js','tm-endturn-pipeline-executor.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,file),'utf8'),c,{filename:file});
 const ctx={input:{edicts:{text:'诏令全文'},_aiInferRan:true},results:{sc1:{shizhengji:story},aiResult:{shizhengji:story,zhengwen:''}},record:{shizhengji:story},meta:{turn:4,requireTurnReview:true,requireMainWriteback:true,mainWriteback:{ok:false}},deferredSteps:[]};
 return {c,ctx,V:c.TM.Endturn.Validity};
}
let checks=0;function check(value,label){assert.ok(value,label);checks++;}
(async()=>{
 {
  const {c,ctx,V}=fixture();c.GM._turnAiResults={_applyFailures:[{reason:'invalid optional reference'}]};
  check(V.validateBeforeCommit(ctx).ok,'real main text survives missing review, missing supplementary prose and failed optional changes');
  check(V.validateBeforeCommit(ctx).warnings.length>=3,'uncompleted work remains visible');
  for(const output of [null,{}, {_g2Fallback:true,shizhengji:story},{_emergencyFallback:true,shizhengji:story}]){ctx.results.sc1=output;check(!V.mainResult(ctx),'no fabricated/partial main result');}
  ctx.results.sc1={shizhengji:''};ctx.results.aiResult.shizhengji='';ctx.record.shizhengji='';check(!V.validateBeforeCommit(ctx).ok,'no real main generation still refuses an empty turn');
 }
 {
  const {c,ctx,V}=fixture();let rendered=false,barrier=false;
  c.TM.Endturn.PipelineSteps={list:[{name:'post-ai-edict',onError:'abort',fn:async()=>{throw Error('auxiliary audit failed');}},
   {name:'systems',onError:'abort',fn:async()=>{throw Error('derived index failed before tick');}},
   {name:'render-and-finalize',fn:async()=>{rendered=true;}},{name:'prepare-commit-barrier',fn:async()=>{barrier=true;}}]};
  await c.TM.Endturn.Pipeline.run(ctx);
  check(c.GM.turn===5&&rendered&&barrier,'auxiliary failures advance once and reach the canonical save barrier');
  check(ctx.meta.deferredIssues.length===2,'each failed stage is recorded');
  check(V.validateBeforeCommit(ctx).ok,'completed main remains eligible');
 }
 {
  const {c,ctx}=fixture();c.TM.Endturn.PipelineSteps={list:[{name:'systems',onError:'abort',fn:async()=>{c.GM.turn++;throw Error('failure after normal tick');}}]};
  await c.TM.Endturn.Pipeline.run(ctx);check(c.GM.turn===5,'a late failure does not double-increment');
 }
 for(const code of ['AI_ABORTED','AI_STALE_WORLD','SAVE_DATABASE_UNAVAILABLE','SAVE_WRITE_UNCONFIRMED']){
  const {c,ctx}=fixture();c.TM.Endturn.PipelineSteps={list:[{name:'systems',onError:'abort',fn:async()=>{throw Object.assign(Error(code),{code});}}]};
  await assert.rejects(c.TM.Endturn.Pipeline.run(ctx),e=>e.code===code);checks++;
 }
 {
  const {c,ctx,V}=fixture();ctx.meta.transaction={gmRef:c.GM,pRef:c.P,loadGen:0};
  check(V.canDefer(ctx,Object.assign(Error('old auxiliary job cancelled'),{code:'AI_ABORTED',name:'AbortError'})),'an expired auxiliary request cannot veto the owned completed main');
  ctx.signal={aborted:true};check(!V.canDefer(ctx,Error('cancelled')),'explicit cancellation of the main owner remains respected');
 }
 {
  const {ctx,V}=fixture();delete ctx.results.sc1;ctx.input._agentModeRan=true;
  check(V.mainResult(ctx)&&V.validateBeforeCommit(ctx).ok,'a successful full Agent main has the same non-blocking completion rule');
 }
 {
  const {c,ctx,V}=fixture();let saved=false,committed=false;const txn={committed:false,turn:4};c.GM.turn=5;
  c._endTurn_finalizeRecords=()=>{throw Error('optional report builder failed');};
  c._endTurn_saveSnapshot=async()=>{saved=true;check(c.GM.shijiHistory[0].shizhengji===story,'fallback preserves the exact generated narrative');return true;};
  c._tmCommitEndTurnTransaction=()=>{check(saved,'commit follows successful durable save');committed=true;return true;};
  loadFunctions(c,'tm-endturn-core.js',['_tmFinalizeEndTurnTransaction']);
  await c._tmFinalizeEndTurnTransaction(ctx,txn);check(committed,'a report failure does not roll back the successful main');
  check(c.GM.shijiHistory.length===1&&c.GM.shijiHistory[0].deferredIssues.length===1,'one turn record and durable warning');
  check(V.validateBeforeCommit(ctx).ok,'fallback does not fabricate main generation');
 }
 {
  const {c,ctx}=fixture();c.GM.turn=5;c._endTurn_finalizeRecords=()=>({shijiIndex:0});c._endTurn_saveSnapshot=async()=>{throw Error('disk failed');};let commits=0;c._tmCommitEndTurnTransaction=()=>{commits++;return true;};
  loadFunctions(c,'tm-endturn-core.js',['_tmFinalizeEndTurnTransaction']);
  await assert.rejects(c._tmFinalizeEndTurnTransaction(ctx,{turn:4}),/disk failed/);check(commits===0,'disk failure is never reported as a saved turn');
 }
 {
  const {c,ctx,V}=fixture();ctx.results.aiResult={shizhengji:story};ctx.record={};const e=Object.assign(Error('optional writeback failed'),{mainWriteback:true});
  check(V.recoverMain(ctx,e,'writeback'),'completed main can be recovered after auxiliary writeback error');
  check(ctx.record.shizhengji===story&&ctx.record.zhengwen===story,'fallback uses actual generated words');
  check(ctx.meta.deferredMainOutput===ctx.results.sc1,'unapplied structured data remains available for repair');
 }
 console.log('[smoke-endturn-nonblocking-completion] PASS '+checks+' assertions');
})().catch(error=>{console.error(error);process.exitCode=1;});
