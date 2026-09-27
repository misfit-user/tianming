import {edit} from './patch-utils.mjs';
edit('web/scripts/verify-all.js',(s,r)=>r(s,
  "  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }",
  "  { name: 'desktop-bridge-reliability', file: 'smoke-desktop-bridge-reliability.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"));
edit('web/scripts/smoke-desktop-bridge-reliability.js',(s,r)=>r(s,'(async()=>{',`test('a foreign success receipt cannot release pending publication evidence',async()=>{
  const f=fixture(),marker=f.marker();f.ctx.meta.stagedTurnData=marker;f.receipts.push(marker);
  f.c.tianming.publishTurnData=async()=>({success:true,transactionId:'wrong-transaction'});
  const out=await watch(f.c._endTurn_publishStagedTurnData(f.ctx));assert.equal(out.error.code,'TURN_BRIDGE_IDENTITY');assert.equal(f.receipts.length,1);
});
test('a live cancellation ends waiting but keeps the conflicting operation locked',async()=>{
  const f=fixture(),ctrl=new AbortController();let finish;f.c.tianming.publishTurnData=()=>new Promise(resolve=>{finish=resolve;});
  const p=watch(f.api.callTurnBridge('publishTurnData',f.marker(),{signal:ctrl.signal}));await tick();ctrl.abort();assert.equal((await p).error.code,'TURN_BRIDGE_ABORTED');
  assert.equal((await watch(f.api.callTurnBridge('recoverTurnData',f.marker()))).error.code,'TURN_BRIDGE_PENDING');assert.equal(f.timers.size,0);finish({success:true});await tick();assert.equal(f.api.bridgeDiagnostics().pending,0);
});
test('explicit desktop rejection never masquerades as a successful stage',async()=>{
  const f=fixture();f.c.tianming.stageTurnData=async()=>({success:false,error:'disk unavailable'});
  assert.equal(await f.save(),false);assert.equal(f.disk.size,0);assert.equal(f.api.bridgeDiagnostics().pending,0);
});
(async()=>{`));
