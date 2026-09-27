'use strict';
const assert=require('assert/strict');
const {fixture,tick,clone}=require('./lib-snapshot-deadlines');
const {renderFixture}=require('./lib-save-commit-boundary');
const tests=[];const test=(name,run)=>tests.push({name,run});
test('normal snapshot retains full world and clears every timer',async()=>{
  const f=fixture();const expected={GM:clone(f.c.GM),P:clone(f.c.P)};
  const result=await f.save();assert.equal(result.ok,true);
  assert.equal(JSON.stringify(result.record.state),JSON.stringify(expected));
  assert.equal(JSON.stringify(f.rows('snapshots_v2').get(result.record.id).state),JSON.stringify(expected));
  assert.equal(f.timers.size,0);assert.equal(f.c.StateSnapshot.diagnostics().issues.length,0);
});
test('never-completing open rejects on deadline and closes a late connection',async()=>{
  const f=fixture({holdOpen:true});const task=f.save();await tick();assert.equal(f.fire(15000),1);
  const result=await task;assert.equal(result.ok,false);assert.equal(result.error.code,'SNAPSHOT_TIMEOUT');assert.equal(result.error.stage,'open');
  f.opens[0].succeed();await tick();assert.equal(f.opens[0].database.closes,1);assert.equal(f.txs.length,0);assert.equal(f.timers.size,0);
});
test('late errors and version changes from an old connection cannot evict the new owner',async()=>{
  const f=fixture({holdOpen:true});const old=f.save();await tick();f.fire(15000);await old;
  f.options.holdOpen=false;assert.equal((await f.save()).ok,true);assert.equal(f.opens.length,2);
  f.opens[0].onerror({target:{error:Error('late')}});f.opens[0].succeed();
  assert.equal((await f.save()).ok,true);assert.equal(f.opens.length,2);
  const previous=f.opens[1].database;previous.onversionchange();assert.equal((await f.save()).ok,true);assert.equal(f.opens.length,3);
  previous.onclose();assert.equal((await f.save()).ok,true);assert.equal(f.opens.length,3);
});
test('blocked open rejects, aborts a late upgrade, and never migrates data afterward',async()=>{
  const f=fixture({holdOpen:true});const task=f.save();await tick();const req=f.opens[0];req.onblocked();
  assert.equal((await task).error.code,'SNAPSHOT_BLOCKED');let aborted=0;
  req.onupgradeneeded({oldVersion:0,target:{result:req.database,transaction:{abort(){aborted++;}}}});
  req.succeed();assert.equal(aborted,1);assert.equal(req.database.closes,1);assert.equal(f.stores.size,0);assert.equal(f.timers.size,0);
});
test('synchronous opening failure does not poison the next attempt',async()=>{
  const f=fixture({throwOpen:true});assert.equal((await f.save()).ok,false);assert.equal(f.timers.size,0);
  f.options.throwOpen=false;assert.equal((await f.save()).ok,true);
  f.opens[0].database.onversionchange();const idb=f.c.indexedDB;delete f.c.indexedDB;
  assert.equal((await f.save()).ok,false);f.c.indexedDB=idb;assert.equal((await f.save()).ok,true);
});
test('a stuck write is aborted and cannot start cleanup via a late completion',async()=>{
  const f=fixture({holdWrites:true});const task=f.save();await tick();const tx=f.txs[0];assert.equal(f.fire(30000),1);
  const result=await task;assert.equal(result.ok,false);assert.equal(result.error.stage,'write');assert.equal(tx.aborted,true);
  tx.complete();if(tx.oncomplete)tx.oncomplete();await tick();assert.equal(f.rows('snapshots_v2').size,0);assert.equal(f.txs.length,1);assert.equal(f.timers.size,0);
});
test('a synchronous second-store put failure aborts the first staged write',async()=>{
  const f=fixture({failLineagePut:true});f.seed(4);const before=JSON.stringify([...f.rows('snapshots_v2')]);
  const result=await f.save();await tick();assert.equal(result.ok,false);assert.equal(f.txs[0].aborted,true);
  assert.equal(JSON.stringify([...f.rows('snapshots_v2')]),before);assert.equal(f.timers.size,0);
});
test('key scan timeout leaves the committed full snapshot intact',async()=>{
  const f=fixture({holdKeys:true});const task=f.save();await tick();assert.equal(f.rows('snapshots_v2').size,1);
  f.fire(30000);const result=await task;assert.equal(result.ok,true);assert.equal(f.c.StateSnapshot.diagnostics().issues[0].stage,'keys');
  assert.equal(f.rows('snapshots_v2').size,1);assert.equal(f.timers.size,0);
});
test('cleanup timeout does not delete old records; a later successful cleanup retains the original limit',async()=>{
  const f=fixture({holdCleanup:true});f.seed(203);f.c.GM.turn=203;const task=f.save();await tick();assert.equal(f.rows('snapshots_v2').size,204);
  f.fire(30000);assert.equal((await task).ok,true);assert.equal(f.rows('snapshots_v2').size,204);
  assert(f.txs.some(tx=>tx.aborted&&tx.mode==='readwrite'));f.options.holdCleanup=false;
  assert.equal((await f.save()).ok,true);assert.equal(f.rows('snapshots_v2').size,200);assert.equal(f.timers.size,0);
});
test('late cursor callbacks do not continue a timed-out key scan',async()=>{
  const f=fixture({cursorOnly:true});const task=f.save();await tick();f.fire(30000);await task;
  f.options.cursorRequest.onsuccess();assert(!f.events.includes('cursor-continued'));assert.equal(f.timers.size,0);
});
test('read, list, and lineage writes have bounded failure paths',async()=>{
  for(const action of ['load','list','recordTimeline']){
    const f=fixture({holdReads:true,holdWrites:action==='recordTimeline'});
    const task=action==='load'?f.c.StateSnapshot.load(1):action==='list'?f.c.StateSnapshot.list():f.c.StateSnapshot.recordTimeline();
    const settled=task.then(()=>null,e=>e);await tick();f.fire(30000);const err=await settled;
    assert.equal(err.code,'SNAPSHOT_TIMEOUT');assert.equal(f.timers.size,0);
  }
});
test('timed-out deletion preserves the existing snapshot',async()=>{
  const f=fixture({holdCleanup:true});f.seed(1);const task=f.c.StateSnapshot.delete(0).then(()=>null,e=>e);await tick();f.fire(30000);
  assert.equal((await task).code,'SNAPSHOT_TIMEOUT');assert.equal(f.rows('snapshots_v2').size,1);assert.equal(f.timers.size,0);
});
test('failed abort is reported as an unconfirmed outcome, never success',async()=>{
  const f=fixture({holdWrites:true,abortThrows:true});const task=f.save();await tick();f.fire(30000);const result=await task;
  assert.equal(result.ok,false);assert.equal(result.error.abortRequested,false);
  assert.equal(f.c.StateSnapshot.diagnostics().issues[0].outcome,'unconfirmed');
  f.txs[0].complete();await tick();assert.equal(f.txs.length,1);assert.equal(f.timers.size,0);
});
test('time-travel read timeout leaves the active world and releases its operation lock',async()=>{
  const f=fixture({holdReads:true});const gm=f.c.GM,body=JSON.stringify(gm);f.seed(3);
  const task=f.c.StateSnapshot.timeTravel(1);await tick();f.fire(30000);const result=await task;
  assert.equal(result.ok,false);assert.equal(f.c.GM,gm);assert.equal(JSON.stringify(gm),body);assert.equal(f.c._tmActiveTimeTravelTransaction,null);
});
test('actual canonical save finishes with a warning when snapshot open stops responding',async()=>{
  const f=fixture({holdOpen:true}),r=renderFixture();r.c.StateSnapshot=f.c.StateSnapshot;
  const task=r.save();await tick();assert.equal(r.disk.size,2);f.fire(15000);
  assert.equal(await task,true);assert.equal(r.ctx.meta.turnSaveWarnings[0].code,'SNAPSHOT_TIMEOUT');
  assert.equal(r.disk.get('autosave').GM.turn,4);assert.equal(r.disk.get('slot_0').GM.turn,4);assert(r.markers.has('tm_autosave_mark'));
});
test('a late snapshot failure after a world switch cannot publish old save markers',async()=>{
  const f=fixture({holdOpen:true}),r=renderFixture();r.c.StateSnapshot=f.c.StateSnapshot;
  const task=r.save();await tick();r.c.GM={turn:99};r.c._tmLoadGen=1;f.fire(15000);
  assert.equal(await task,false);assert.equal(r.c.GM.turn,99);assert.equal(r.markers.size,0);assert.equal(r.disk.size,2);
});
test('diagnostics are bounded and cannot be used to mutate internal records',async()=>{
  const f=fixture({holdOpen:true});
  for(let i=0;i<15;i++){const task=f.save();await tick();f.opens.at(-1).onblocked();await task;}
  const report=f.c.StateSnapshot.diagnostics();assert.equal(report.issues.length,12);
  assert(!JSON.stringify(report).includes('完整记忆'));report.issues[0].code='changed';
  assert.equal(f.c.StateSnapshot.diagnostics().issues[0].code,'SNAPSHOT_BLOCKED');assert.equal(f.timers.size,0);
});
test('a slow write still requires its real commit event and preserves all data',async()=>{
  const f=fixture({holdWrites:true});let resolved=false;const task=f.save().then(r=>{resolved=true;return r;});await tick();
  assert.equal(resolved,false);assert.equal(f.rows('snapshots_v2').size,0);f.txs[0].complete();
  const result=await task;assert.equal(result.ok,true);assert.equal(result.record.state.GM.history,f.c.GM.history);assert.equal(f.timers.size,0);
});
test('time travel cannot restore a target when saving the full return point times out',async()=>{
  const f=fixture({holdWrites:true});f.seed(3);const original=JSON.stringify(f.c.GM);let restored=0;
  f.c.fullLoadGame=()=>{restored++;};const task=f.c.StateSnapshot.timeTravel(1);await tick();f.fire(30000);
  const result=await task;assert.equal(result.ok,false);assert.equal(restored,0);assert.equal(JSON.stringify(f.c.GM),original);assert.equal(f.c._tmActiveTimeTravelTransaction,null);
});
(async()=>{
  let pass=0,fail=0;
  for(const t of tests){let timer;
    try{await Promise.race([t.run(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Test did not settle')),2000);})]);pass++;console.log('PASS '+t.name);}
    catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}finally{clearTimeout(timer);}
  }
  console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;
})();
