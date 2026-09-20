'use strict';
const assert=require('assert/strict');
const {writer,baseGM,load,extracted,run}=require('./lib-player-error-regression');
const tests=[];const test=(name,fn)=>tests.push({name,fn});
function fixture(native){
 const c=writer();c.GM=baseGM({custom:{value:10},memoryArchive:[{content:'完整长期记忆\n'.repeat(1200)}]});
 c.deepClone=v=>{if(native)try{return structuredClone(v);}catch(_){}return JSON.parse(JSON.stringify(v));};
 load(c,'tm-post-turn-jobs.js');const q=c._ensurePostTurnJobQueue();let complete;
 const job=c._enqueuePostTurnJob('sc25',()=>new Promise(r=>{complete=r;}));
 const live=q.pending[0];assert(live.lease.gmRef===c.GM);assert.throws(()=>JSON.stringify(c.GM),/circular/);
 extracted(c,'tm-endturn-core.js',['_tmCaptureEndTurnObject','_tmRestoreEndTurnObject']);
 return{c,q,job:live,finish:()=>complete&&complete({ok:true})};
}
for(const native of [false,true]){
 test('main apply succeeds with real cyclic memory queue; native='+native,async()=>{
  const f=fixture(native),c=f.c,content=c.GM.memoryArchive[0].content;
  const out=c.applyAITurnChanges({_strictValidation:true,changes:[{path:'custom.value',delta:7}]});
  assert(out.ok,JSON.stringify(out.applied?.failed));assert.equal(c.GM.custom.value,17);assert.equal(c.GM.memoryArchive[0].content,content);assert.equal(c.GM._postTurnJobs,f.q);assert.equal(f.job.lease.gmRef,c.GM);await Promise.resolve();f.finish();
 });
 test('main failed apply restores business state and retains queue identity; native='+native,async()=>{
  const f=fixture(native),c=f.c;const out=c.applyAITurnChanges({_strictValidation:true,shizhengji:'甲与乙成婚。',changes:[{path:'custom.value',delta:7}]});
  assert(!out.ok&&out.rolledBack);assert.equal(c.GM.custom.value,10);assert.equal(c.GM._postTurnJobs,f.q);assert.equal(f.q.pending[0],f.job);await Promise.resolve();f.finish();
 });
 test('turn snapshot never detaches live queue, even non-configurable; native='+native,async()=>{
  const f=fixture(native),c=f.c;Object.defineProperty(c.GM,'_postTurnJobs',{value:f.q,enumerable:true,configurable:false,writable:false});
  const clone=c.deepClone;c.deepClone=value=>{assert.equal(c.GM._postTurnJobs,f.q);return clone(value);};
  const before=c._tmCaptureEndTurnObject(c.GM,['_postTurnJobs','_postTurnDetachedJobs','_indices']);
  assert(!('_postTurnJobs'in before.data));assert.equal(before.descriptors._postTurnJobs.value,f.q);assert.doesNotThrow(()=>JSON.stringify(before.data));
  c.GM.custom.value=0;c._tmRestoreEndTurnObject(c.GM,before);assert.equal(c.GM.custom.value,10);assert.equal(c.GM._postTurnJobs,f.q);await Promise.resolve();f.finish();
 });
}
test('NPC atomic update succeeds then correctly rolls back without consuming memory jobs',async()=>{
 const f=fixture(false),c=f.c;extracted(c,'tm-endturn-followup.js',['_cloneNpcApplyState','_restoreNpcApplyState','_applyNpcDeepResultAtomic']);
 const yes=c._applyNpcDeepResultAtomic(()=>{c.GM.custom.value=30;},{});assert(yes.ok);assert.equal(c.GM._postTurnJobs,f.q);
 const no=c._applyNpcDeepResultAtomic(()=>{c.GM.custom.value=90;throw Error('rejected downstream');},{});assert(!no.ok);assert.equal(c.GM.custom.value,30);assert.equal(c.GM._postTurnJobs,f.q);assert.equal(f.job.lease.gmRef,c.GM);await Promise.resolve();f.finish();
});
test('transaction metadata getters are never evaluated by snapshot capture',()=>{
 const f=fixture(false),c=f.c;Object.defineProperty(c.GM,'liveHandle',{get(){throw Error('must not execute');},enumerable:true,configurable:true});
 const snap=c._tmCaptureEndTurnObject(c.GM,['_postTurnJobs']);assert(snap.descriptors.liveHandle.get);assert.equal(snap.data.custom.value,10);
});
test('a true cycle in persistent game data is not silently dropped as if it were a task',()=>{
 const f=fixture(false),c=f.c;c.GM.custom.self=c.GM.custom;const out=c.applyAITurnChanges({_strictValidation:true,changes:[{path:'guoku.money',delta:7}]});
 assert(!out.ok);assert.equal(c.GM.guoku.money,1000);assert.equal(c.GM.custom.self,c.GM.custom);assert.equal(c.GM._postTurnJobs,f.q);
});
test('root duplicate references in ordinary data survive as complete values',()=>{
 const f=fixture(false),c=f.c,shared={content:'不得省略'};c.GM.sharedA=shared;c.GM.sharedB=shared;
 const snap=c._tmCaptureEndTurnObject(c.GM,['_postTurnJobs']);assert.equal(snap.data.sharedA.content,'不得省略');assert.equal(snap.data.sharedB.content,'不得省略');assert.equal(c.GM.sharedA,c.GM.sharedB);
});
run(tests);
