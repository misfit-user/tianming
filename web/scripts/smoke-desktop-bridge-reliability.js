'use strict';
const assert=require('assert/strict');
const {fixture,watch,tick,clone,loadFunctions}=require('./lib-desktop-bridge-reliability');
const tests=[];const test=(name,run)=>tests.push({name,run});
test('normal desktop save keeps all turn-data bytes and commits both full slots',async()=>{
  const f=fixture(),before=JSON.stringify(f.ctx.meta.turnPresentation.turnData);assert.equal(await f.save(),true);
  assert.equal(f.disk.size,2);assert.equal(JSON.stringify(f.calls[0].payload.data),before);assert.equal(f.calls[0].method,'stageTurnData');
  assert.equal(f.timers.size,0);assert.equal(f.api.bridgeDiagnostics().pending,0);
});
test('a never-returning auxiliary stage preserves complete output in both canonical saves',async()=>{
  const f=fixture();let finish;f.c.tianming.stageTurnData=()=>new Promise(resolve=>{finish=resolve;});
  const p=watch(f.save());await tick();assert.equal(f.fire(),1);assert.equal((await p).value,true);assert.equal(f.disk.size,2);
  for(const state of f.disk.values())assert.equal(JSON.stringify(state.GM._deferredTurnData[0].data),JSON.stringify(f.ctx.meta.turnPresentation.turnData));
  assert.equal(f.ctx.meta.turnSaveWarnings[0].code,'TURN_BRIDGE_TIMEOUT');
  assert(!f.events.includes('delete-receipt'));assert(!f.ctx.meta.stagedTurnData);finish({success:true});await tick();assert(!f.ctx.meta.stagedTurnData);
  assert.equal(f.api.bridgeDiagnostics().pending,0);
});
test('unanswered publish retains the durable receipt and cannot be blindly resent',async()=>{
  const f=fixture(),marker=f.marker();f.ctx.meta.stagedTurnData=marker;f.receipts.push(marker);let finish,sent=0;
  f.c.tianming.publishTurnData=()=>{sent++;return new Promise(resolve=>{finish=resolve;});};
  const p=watch(f.c._endTurn_publishStagedTurnData(f.ctx));await tick();f.fire();assert.equal((await p).error.code,'TURN_BRIDGE_TIMEOUT');
  assert.equal(f.receipts.length,1);assert.equal(f.ctx.meta.stagedTurnData,marker);
  const duplicate=await watch(f.c._endTurn_publishStagedTurnData(f.ctx));assert.equal(duplicate.error.code,'TURN_BRIDGE_PENDING');assert.equal(sent,1);
  finish({success:true});await tick();assert.equal(f.receipts.length,1);assert.equal(f.ctx.meta.stagedTurnData,marker);assert.equal(f.timers.size,0);
});
test('timeout does not permit discard to overtake an in-flight stage of the same transaction',async()=>{
  const f=fixture(),marker=f.marker();f.c.tianming.stageTurnData=()=>new Promise(()=>{});let discarded=0;f.c.tianming.discardTurnData=async()=>{discarded++;return {success:true};};
  const p=watch(f.api.callTurnBridge('stageTurnData',{...marker,data:{}}));await tick();f.fire();await p;
  const result=await watch(f.api.callTurnBridge('discardTurnData',marker));assert.equal(result.error.code,'TURN_BRIDGE_PENDING');assert.equal(discarded,0);
});
test('discard rejection preserves staged marker and receipt instead of deleting in finally',async()=>{
  const f=fixture(),marker=f.marker();f.ctx.meta.stagedTurnData=marker;f.receipts.push(marker);f.c.tianming.discardTurnData=async()=>{throw Error('disk unavailable');};
  assert.match((await watch(f.c._endTurn_discardStagedTurnData(f.ctx))).error.message,/disk unavailable/);
  assert.equal(f.receipts.length,1);assert.equal(f.ctx.meta.stagedTurnData,marker);
});
test('confirmed discard clears only its receipt after the desktop acknowledgement',async()=>{
  const f=fixture(),marker=f.marker();f.ctx.meta.stagedTurnData=marker;f.receipts.push(marker);
  assert.equal(await f.c._endTurn_discardStagedTurnData(f.ctx),true);assert.equal(f.calls[0].method,'discardTurnData');assert.equal(f.receipts.length,0);assert.equal(f.ctx.meta.stagedTurnData,null);
});
test('a committed world receipt forbids discarding its pending bundle',async()=>{
  const f=fixture();f.ctx.meta.stagedTurnData=f.marker();f.ctx.meta.canonicalSaveReceipt={state:'committed'};
  assert.match((await watch(f.c._endTurn_discardStagedTurnData(f.ctx))).error.message,/禁止/);assert.equal(f.calls.length,0);
});
test('stage validates the world on both sides of the asynchronous checksum boundary',async()=>{
  const f=fixture();f.c._endTurn_stateChecksum=async()=>{f.c.GM={...f.c.GM,turn:20};return 'fixture';};
  const result=await watch(f.c._endTurn_stageTurnData(f.ctx,{}));assert(result.error);assert.equal(f.calls.length,0);
});
test('late successful publication after a load cannot clear a receipt for the old world',async()=>{
  const f=fixture(),marker=f.marker();f.ctx.meta.stagedTurnData=marker;f.receipts.push(marker);let finish;
  f.c.tianming.publishTurnData=()=>new Promise(resolve=>{finish=resolve;});const p=watch(f.c._endTurn_publishStagedTurnData(f.ctx));await tick();
  f.c.GM={...f.c.GM};f.c._tmLoadGen++;finish({success:true});assert.equal((await p).error.code,'TURN_BRIDGE_STALE');assert.equal(f.receipts.length,1);
});
test('load-time recovery failure remains blocking and retains the full receipt',async()=>{
  const f=fixture(),marker=f.marker();f.receipts.push(marker);f.c.tianming.recoverTurnData=()=>new Promise(()=>{});
  const p=f.c._recoverPendingTurnDataPublish();await tick();f.fire();const result=await p;assert.equal(result.ok,false);assert.equal(result.error.code,'TURN_BRIDGE_TIMEOUT');assert.equal(f.receipts.length,1);
});
test('normal and legacy recovery clear receipts only after confirmed publication',async()=>{
  const f=fixture(),marker=f.marker();f.c.GM._pendingTurnDataPublish=clone(marker);f.receipts.push({...marker,transactionId:'txn-second'});
  const result=await f.c._recoverPendingTurnDataPublish();assert.equal(result.ok,true);assert(!f.c.GM._pendingTurnDataPublish);assert.equal(f.receipts.length,0);assert.equal(f.calls.length,2);
});
test('foreign campaign and future receipts are not sent during current-world recovery',async()=>{
  const f=fixture(),marker=f.marker();f.receipts.push({...marker,campaignId:'foreign'}, {...marker,turn:99});
  assert.equal((await f.c._recoverPendingTurnDataPublish()).ok,true);assert.equal(f.calls.length,0);assert.equal(f.receipts.length,2);
});
test('unanswered timeline reference lookup conservatively retains auxiliary data',async()=>{
  const f=fixture();f.c.tianming.listSaveTimelineRefs=()=>new Promise(()=>{});
  const p=f.c._desktopTimelineMayBeReferenced(f.c.GM._campaignId,f.c.GM._timelineId);await tick();f.fire();assert.equal(await p,true);assert(!f.events.includes('delete-receipt'));
});
test('a late rejection is observed but cannot reject the already settled caller again',async()=>{
  const f=fixture();let reject;f.c.tianming.publishTurnData=()=>new Promise((_r,r)=>{reject=r;});
  const p=watch(f.api.callTurnBridge('publishTurnData',f.marker()));await tick();f.fire();assert.equal((await p).error.code,'TURN_BRIDGE_TIMEOUT');
  reject(Error('late failure'));await tick();assert.equal(f.api.bridgeDiagnostics().pending,0);assert.equal(f.api.bridgeDiagnostics().events.at(-1).state,'late-rejection');
});
test('cancellation before sending does not start disk work',async()=>{
  const f=fixture(),controller=new AbortController();controller.abort();
  const out=await watch(f.api.callTurnBridge('stageTurnData',f.marker(),{signal:controller.signal}));assert.equal(out.error.code,'TURN_BRIDGE_ABORTED');assert.equal(f.calls.length,0);assert.equal(f.timers.size,0);
});
test('changing bridge instance invalidates even a successful outstanding result',async()=>{
  const f=fixture();let finish;f.c.tianming.recoverTurnData=()=>new Promise(resolve=>{finish=resolve;});
  const p=watch(f.api.callTurnBridge('recoverTurnData',f.marker()));await tick();f.c.tianming={...f.c.tianming};finish({success:true});assert.equal((await p).error.code,'TURN_BRIDGE_STALE');assert.equal(f.timers.size,0);
});
test('the actual finalizer keeps complete presentation when post-commit publish times out',async()=>{
  const f=fixture();assert.equal(await f.save(),true);f.receipts.push(f.ctx.meta.stagedTurnData);f.ctx.meta.endTurnSavePromise=Promise.resolve(true);
  f.c.tianming.publishTurnData=()=>new Promise(()=>{});let committed=0,rendered;
  f.c._tmCommitEndTurnTransaction=()=>{committed++;return true;};f.c._tmAdoptCommittedWorldSnapshot=()=>true;
  f.c._endTurn_render=value=>{rendered=value;};f.c._endTurn_clearCommittedInputs=()=>{};
  loadFunctions(f.c,'tm-endturn-core.js',['_tmFinalizeEndTurnTransaction']);
  const p=f.c._tmFinalizeEndTurnTransaction(f.ctx,f.txn);await tick();f.fire();assert.equal(await p,true);assert.equal(committed,1);
  assert.equal(rendered,f.ctx.meta.turnPresentation);assert.equal(f.disk.size,2);assert.equal(f.receipts.length,1);assert.equal(f.ctx.results.turnDataPublishError.code,'TURN_BRIDGE_TIMEOUT');
});
test('unknown bridge operations are refused and outstanding work has a fixed cap',async()=>{
  const f=fixture();assert.equal((await watch(f.api.callTurnBridge('deleteSave',{}))).error.code,'TURN_BRIDGE_UNAVAILABLE');
  f.c.tianming.stageTurnData=()=>new Promise(()=>{});const jobs=[];
  for(let i=0;i<32;i++)jobs.push(watch(f.api.callTurnBridge('stageTurnData',{...f.marker(),transactionId:'pending-'+i})));
  assert.equal((await watch(f.api.callTurnBridge('stageTurnData',{...f.marker(),transactionId:'overflow'}))).error.code,'TURN_BRIDGE_BUSY');
  f.fire();await Promise.all(jobs);assert.equal(f.api.bridgeDiagnostics().pending,32);assert.equal(f.timers.size,0);
});
test('diagnostics stay bounded and contain no save names, payloads or transaction identifiers',async()=>{
  const f=fixture();for(let i=0;i<20;i++)await f.api.callTurnBridge('publishTurnData',f.marker());
  const out=f.api.bridgeDiagnostics();assert.equal(out.events.length,12);const json=JSON.stringify(out);
  assert(!json.includes('合成测试档'));assert(!json.includes('txn-fixture'));assert(!json.includes('完整上下文'));
  out.events[0].state='tampered';assert.notEqual(f.api.bridgeDiagnostics().events[0].state,'tampered');
});
test('a foreign success receipt cannot release pending publication evidence',async()=>{
  const f=fixture(),marker=f.marker();f.ctx.meta.stagedTurnData=marker;f.receipts.push(marker);
  f.c.tianming.publishTurnData=async()=>({success:true,transactionId:'wrong-transaction'});
  const out=await watch(f.c._endTurn_publishStagedTurnData(f.ctx));assert.equal(out.error.code,'TURN_BRIDGE_IDENTITY');assert.equal(f.receipts.length,1);
});
test('a live cancellation ends waiting but keeps the conflicting operation locked',async()=>{
  const f=fixture(),ctrl=new AbortController();let finish;f.c.tianming.publishTurnData=()=>new Promise(resolve=>{finish=resolve;});
  const p=watch(f.api.callTurnBridge('publishTurnData',f.marker(),{signal:ctrl.signal}));await tick();ctrl.abort();assert.equal((await p).error.code,'TURN_BRIDGE_ABORTED');
  assert.equal((await watch(f.api.callTurnBridge('recoverTurnData',f.marker()))).error.code,'TURN_BRIDGE_PENDING');assert.equal(f.timers.size,0);finish({success:true});await tick();assert.equal(f.api.bridgeDiagnostics().pending,0);
});
test('explicit auxiliary rejection is reported while full original output survives canonical commit',async()=>{
  const f=fixture();f.c.tianming.stageTurnData=async()=>({success:false,error:'disk unavailable'});
  assert.equal(await f.save(),true);assert.equal(f.disk.size,2);assert.equal(f.api.bridgeDiagnostics().pending,0);
  assert.equal(f.ctx.meta.stagedTurnData,null);assert.equal(f.ctx.meta.turnSaveWarnings[0].stage,'turn-data');
  for(const state of f.disk.values())assert.equal(JSON.stringify(state.GM._deferredTurnData[0].data),JSON.stringify(f.ctx.meta.turnPresentation.turnData));
});
test('protocol changes and a replaced bridge during checksum never send stale stage data',async()=>{
  const f=fixture();f.c.tianming.turnDataProtocolVersion=1;
  assert.equal((await watch(f.api.callTurnBridge('stageTurnData',f.marker()))).error.code,'TURN_BRIDGE_PROTOCOL');assert.equal(f.calls.length,0);
  f.c.tianming.turnDataProtocolVersion=2;f.c._endTurn_stateChecksum=async()=>{f.c.tianming={...f.c.tianming};return 'fixture';};
  assert((await watch(f.c._endTurn_stageTurnData(f.ctx,{}))).error);assert.equal(f.calls.length,0);
});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
