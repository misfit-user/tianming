'use strict';
const assert=require('assert/strict');
const {context,load,extracted,read,vm,run}=require('./lib-player-error-regression');
const tests=[];const test=(name,fn)=>tests.push({name,fn});
function textContext(){const c=context({TM:{}});load(c,'tm-ai-result-contract.js');return c;}
test('full text and supported wrappers are retained without truncation',()=>{
 const c=textContext(),text='完整因果与人物心理🙂\n'.repeat(2500),N=c.TM.AIResultContract;
 assert.equal(N.text(text),text);assert.equal(N.text({content:text,summary:'仅元数据'}),text);assert.equal(N.text({paragraphs:[{text:'甲'},'乙']}),'甲\n乙');
 assert.equal(N.text({content:'',text:'完整正文'}),'完整正文');
});
test('ambiguous or unknown objects fail rather than turning into placeholder text',()=>{
 const N=textContext().TM.AIResultContract;for(const value of [{unknown:'不能猜正文'},{content:'甲',text:'乙'},42,true])assert.throws(()=>N.text(value,'shizhengji'),e=>e.code==='ai-narrative-shape');
 const cycle={};cycle.content=cycle;assert.throws(()=>N.text(cycle));
});
test('all narrative fields are validated before replacing any',()=>{
 const c=textContext(),record={shizhengji:{content:'保留'},zhengwen:{wrong:'bad'}};assert.throws(()=>c.TM.AIResultContract.normalizeRecord(record));assert.equal(typeof record.shizhengji,'object');
});
function inferFixture(value){
 const c=textContext();Object.assign(c,{getTimeRatio:()=>1,showLoading(){},getTSText:()=> '本月',P:{ai:{key:'fixture-only'},conf:{}},GM:{turn:10,vars:{}}});
 // This fixture isolates narrative normalization; real review commits are covered by recovery-review smokes.
 c.TM.RecoveryReview={launchRoutine(ctx){c.reviewNarrative=ctx.record.shizhengji;},handoff(){c.reviewJoined=true;},cancel(){}};
 c.TM.Endturn={AI:{prompt:{build:async()=>{}},subcalls:{setupInfra(){},runMain:async(ctx,after)=>{ctx.results.sc1={shizhengji:value};ctx.record.shizhengji=value;ctx.record.zhengwen='完整评论';await after();}},apply:{writeBack:async()=>{}},followup:{run:async()=>{}},record:{finalize:ctx=>ctx.record}}};load(c,'tm-endturn-ai-infer.js');return c;
}
test('actual inference extracts complete narrative for downstream consumers',async()=>{
 const text='完整有效正文，不应变成对象占位符。'.repeat(60),c=inferFixture({content:text,summary:'另有提要'});const r=await c._endTurn_aiInfer({},[],null,{});assert.equal(r.shizhengji,text);assert.equal(c.GM._turnContext.shizhengji,text.substring(0,300));assert.equal(typeof r.shizhengji.substring(0,500),'string');assert.equal(c.reviewNarrative,text);assert.equal(c.reviewJoined,true);
});
test('actual inference rejects unknown objects before finalization',async()=>{
 const c=inferFixture({unknown:'不应丢弃后装作无事'});let finalized=false;c.TM.Endturn.AI.record.finalize=()=>{finalized=true;};await assert.rejects(c._endTurn_aiInfer({},[],null,{}),e=>e.code==='ai-narrative-shape');assert(!finalized);
});
test('a successful main is not regenerated when its writeback or a follow-up task fails',async()=>{
 for(const where of ['writeback','followup']){
  const story='主推演原文已生成：本月按诏办理诸事。',c=inferFixture(story);load(c,'tm-endturn-validity.js');let callbacks=0;
  const original=c.TM.Endturn.AI.subcalls.runMain;c.TM.Endturn.AI.subcalls.runMain=async(x,after)=>original(x,async()=>{callbacks++;try{await after();}catch(e){callbacks++;throw e;}});
  c.TM.RecoveryReview.prepareFailedOutput=()=>{};
  const fail=async()=>{throw Object.assign(Error('minor optional failure'),where==='writeback'?{mainWriteback:true}:{});};
  if(where==='writeback')c.TM.Endturn.AI.apply.writeBack=fail;else c.TM.Endturn.AI.followup.run=fail;
  const outer={meta:{}};const r=await c._endTurn_aiInfer({},[],null,{},outer);assert.equal(r.shizhengji,story);assert.equal(callbacks,1);assert(outer.meta.aiInferMeta.deferredIssues.length);
 }
});
test('old narrative and object policy stances remain inspectable without mutating saves',()=>{
 const c=textContext(),N=c.TM.AIResultContract,obj={economic:'轻徭薄赋',military:['屯田','守边']},before=JSON.stringify(obj);
 assert.equal(N.historyText({content:'旧正文'}),'旧正文');assert(N.historyText({summary:'原有提要'}).includes('原有提要'));
 assert(N.policyTags(obj).join('；').includes('轻徭薄赋'));assert(N.policyTags(obj).join('；').includes('守边'));assert.equal(JSON.stringify(obj),before);
});
function jobs(){const c=textContext();Object.assign(c,{GM:{turn:3,_campaignId:'a',_timelineId:'b'},P:{ai:{key:'fixture-only'},conf:{}},_dbg(){}});load(c,'tm-post-turn-jobs.js');return c;}
test('a known 502 fails promptly even if another critical memory task never finishes',async()=>{
 const c=jobs();let release;c._enqueuePostTurnJob('sc25',()=>new Promise(r=>{release=r;}));c._enqueuePostTurnJob('sc25c',async()=>{const e=Error('HTTP 502');e.status=502;throw e;});
 await assert.rejects(c._awaitPostTurnJobsForSave(),e=>e.status===502&&e.postTurnFailures[0].id==='sc25c');
 assert.equal(c.GM._postTurnJobs.pending[0].status,'running');assert.equal(c.GM._postTurnJobs.pending[1].failureObserved,true);release({complete:true});
});
test('failed memory can be explicitly retried without discarding completed siblings',async()=>{
 const c=jobs();let good=0,bad=0;c._enqueuePostTurnJob('sc25',async()=>{good++;return {complete:true};});c._enqueuePostTurnJob('sc25c',async()=>{if(++bad===1){const e=Error('temporary');e.status=502;throw e;}return {complete:true};});
 await assert.rejects(c._awaitPostTurnJobsForSave());await c._awaitPostTurnJobsForSave();assert.equal(good,1);assert.equal(bad,2);assert(c.GM._postTurnJobs.pending.every(j=>j.status==='done'));
});
test('an explicit failed result is not marked done',async()=>{
 const c=jobs();c._enqueuePostTurnJob('sc25c',async()=>({ok:false,error:Error('failed result')}));await assert.rejects(c._awaitPostTurnJobsForSave());assert.notEqual(c.GM._postTurnJobs.pending[0].status,'done');
});
test('ambiguous multiple top-level JSON remains rejected rather than arbitrarily chosen',()=>{
 const c=textContext();c._dbg=()=>{};extracted(c,'tm-utils.js',['robustParseJSON']);assert.equal(c.robustParseJSON('{"shizhengji":"one"} {"shizhengji":"two"}'),null);
});
run(tests);
