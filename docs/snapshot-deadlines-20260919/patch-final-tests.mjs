import { edit } from './patch-utils.mjs';
edit('web/scripts/verify-all.js',(s,r)=>r(s,"  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }","  { name: 'snapshot-deadlines', file: 'smoke-snapshot-deadlines.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"));
edit('web/scripts/smoke-snapshot-deadlines.js',(s,r)=>r(s,'(async()=>{',`test('a slow write still requires its real commit event and preserves all data',async()=>{
  const f=fixture({holdWrites:true});let resolved=false;const task=f.save().then(r=>{resolved=true;return r;});await tick();
  assert.equal(resolved,false);assert.equal(f.rows('snapshots_v2').size,0);f.txs[0].complete();
  const result=await task;assert.equal(result.ok,true);assert.equal(result.record.state.GM.history,f.c.GM.history);assert.equal(f.timers.size,0);
});
test('time travel cannot restore a target when saving the full return point times out',async()=>{
  const f=fixture({holdWrites:true});f.seed(3);const original=JSON.stringify(f.c.GM);let restored=0;
  f.c.fullLoadGame=()=>{restored++;};const task=f.c.StateSnapshot.timeTravel(1);await tick();f.fire(30000);
  const result=await task;assert.equal(result.ok,false);assert.equal(restored,0);assert.equal(JSON.stringify(f.c.GM),original);assert.equal(f.c._tmActiveTimeTravelTransaction,null);
});
(async()=>{`));
