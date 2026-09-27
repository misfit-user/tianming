'use strict';
const assert=require('assert/strict');
const {storageFixture,renderFixture,loadFunctions,tick,clone}=require('./lib-save-commit-boundary');
const tests=[];const test=(name,run)=>tests.push({name,run});
test('commit receipt is delivered once, only after both slots commit',async()=>{
  const f=storageFixture();let receipt,calls=0;const p=f.save({onCommitted:r=>{receipt=r;calls++;}});
  await tick();assert.equal(calls,0);assert.equal(f.disk.size,0);f.transactions[0].complete();assert.equal(await p,true);
  assert.equal(calls,1);assert.equal(receipt.state,'committed');assert.equal(receipt.slots.length,2);assert.equal(f.disk.size,4);assert(Object.isFrozen(receipt));assert(Object.isFrozen(receipt.slots));
});
test('commit observation precedes cleanup but save still waits for cleanup completion',async()=>{
  const f=storageFixture();let release,notified=false,finished=false;f.c._gcReplacedSaveTimelines=()=>new Promise(r=>{release=r;});
  const p=f.save({onCommitted:()=>{notified=true;}}).then(v=>{finished=true;return v;});await tick();f.transactions[0].complete();await tick();
  assert(notified);assert.equal(finished,false);release(true);assert.equal(await p,true);
});
test('cleanup errors cannot change a confirmed commit into failure',async()=>{
  for(const asyncFailure of [false,true]){const f=storageFixture();f.c._gcReplacedSaveTimelines=()=>{if(asyncFailure)return Promise.reject(Error('cleanup failed'));throw Error('cleanup failed');};
    const p=f.save();await tick();f.transactions[0].complete();assert.equal(await p,true);assert.equal(f.disk.size,4);
  }
});
test('observer exceptions do not undo or reject committed data',async()=>{
  const f=storageFixture();const p=f.save({onCommitted:()=>{throw Error('observer failed');}});await tick();f.transactions[0].complete();assert.equal(await p,true);assert.equal(f.disk.size,4);
});
test('aborted writes never notify success or create committed slots',async()=>{
  const f=storageFixture();let calls=0;const p=f.save({onCommitted:()=>{calls++;}});await tick();f.transactions[0].abort();await assert.rejects(p,/injected abort/);assert.equal(calls,0);assert.equal(f.disk.size,0);
});
test('local committed journal cleanup failure preserves new slots and a committed marker',async()=>{
  const f=storageFixture();f.c._available=false;let notified=0;const remove=f.c.localStorage.removeItem;
  f.c.localStorage.removeItem=k=>{if(k==='batch-journal')throw Error('cleanup unavailable');return remove(k);};
  assert.equal(await f.save({onCommitted:()=>{notified++;}}),true);assert.equal(notified,1);
  assert.equal(JSON.parse(f.local.get('batch-journal')).phase,'committed');assert.equal(JSON.parse(f.local.get('tm_idb_saves_autosave')).turn,4);
  f.c.localStorage.removeItem=remove;f.c._recoverLocalSaveBatchJournal();assert(!f.local.has('batch-journal'));assert.equal(JSON.parse(f.local.get('tm_idb_saves_autosave')).turn,4);
});
test('partial local write failure restores the original slots without a commit receipt',async()=>{
  const f=storageFixture();f.c._available=false;f.local.set('tm_idb_saves_autosave','old-a');f.local.set('tm_idb_saves_slot_0','old-b');let notified=0;
  const set=f.c.localStorage.setItem;f.c.localStorage.setItem=(k,v)=>{if(k==='tm_idb_saves_slot_0')throw Error('injected write failure');return set(k,v);};
  await assert.rejects(f.save({onCommitted:()=>{notified++;}}),/injected write failure/);assert.equal(notified,0);assert.equal(f.local.get('tm_idb_saves_autosave'),'old-a');assert.equal(f.local.get('tm_idb_saves_slot_0'),'old-b');
});
test('auxiliary snapshot rejection does not roll back a committed full world',async()=>{
  const f=renderFixture();f.c.GM.fullNarrative='完整因果和人物描写。'.repeat(500);f.c.StateSnapshot.save=async()=>{throw Error('snapshot rejected');};
  assert.equal(await f.save(),true);assert.equal(f.disk.get('autosave').GM.fullNarrative,f.c.GM.fullNarrative);
  assert(f.ctx.meta.turnSaveWarnings.some(x=>x.stage==='time-snapshot'));assert.equal(f.txn.canonicalSaveReceipt.state,'committed');assert.equal(f.ctx.meta.canonicalWorldSnapshot.GM.turn,4);assert(!f.events.includes('discard'));
});
test('auxiliary false result is reported without changing the durable world result',async()=>{
  const f=renderFixture();f.c.StateSnapshot.save=async()=>({ok:false,error:Error('snapshot false')});assert.equal(await f.save(),true);assert.equal(f.ctx.meta.turnSaveWarnings[0].stage,'time-snapshot');
});
test('failed primary write never starts the auxiliary snapshot',async()=>{
  const f=renderFixture();f.c.TM_SaveDB.saveManyAtomic=async()=>false;assert.equal(await f.save(),false);assert(!f.events.includes('snapshot'));assert(!f.events.includes('clear-marker'));assert.equal(f.txn.canonicalSaveReceipt,undefined);
});
test('snapshot and cleanup overlap only after durable commit and are both awaited',async()=>{
  const f=renderFixture();let releaseCleanup,releaseSnapshot,done=false;
  const save=f.c.TM_SaveDB.saveManyAtomic;f.c.TM_SaveDB.saveManyAtomic=async(e,o)=>{await save(e,o);return new Promise(r=>{releaseCleanup=r;});};
  f.c.StateSnapshot.save=()=>{f.events.push('snapshot');assert(f.events.includes('commit'));return new Promise(r=>{releaseSnapshot=r;});};
  const p=f.save().then(v=>{done=true;return v;});await tick();assert(releaseCleanup&&releaseSnapshot);assert.equal(done,false);
  releaseCleanup(true);await tick();assert.equal(done,false);releaseSnapshot({ok:true});assert.equal(await p,true);
});
test('a world switch during snapshot cannot publish old-world save markers',async()=>{
  const f=renderFixture();const next={turn:99};f.c.StateSnapshot.save=async()=>{f.c.GM=next;f.c.P={};f.c._tmLoadGen++;return {ok:true};};
  assert.equal(await f.save(),false);assert.equal(f.c.GM,next);assert(!f.events.includes('clear-marker'));assert(!f.events.includes('index'));assert.equal(f.markers.size,0);assert(f.txn.canonicalSaveReceipt);
});
test('legacy boolean SaveDB success retains the full snapshot path',async()=>{
  const f=renderFixture();f.c.TM_SaveDB.saveManyAtomic=async()=>true;assert.equal(await f.save(),true);assert(f.events.includes('snapshot'));assert.equal(f.ctx.meta.canonicalWorldSnapshot.GM.turn,4);
});
test('mismatched callback receipt cannot start snapshot or bypass a failed primary save',async()=>{
  const f=renderFixture();f.c.TM_SaveDB.saveManyAtomic=async(e,o)=>{o.onCommitted({state:'committed',transactionId:'foreign',slots:[]});return false;};assert.equal(await f.save(),false);assert(!f.events.includes('snapshot'));
});
test('a staged display failure cannot interrupt retirement of the world transaction',()=>{
  const f=renderFixture();f.c._tmEndTurnTransactionCurrent=()=>true;f.c.GM._pendingCommittedTurnResult={html:'完整正文',idx:4};f.c.showTurnResult=()=>{throw Error('display failed');};f.c._tmReportEndTurnBoundaryError=()=>{};
  loadFunctions(f.c,'tm-endturn-core.js',['_tmCommitEndTurnTransaction']);assert.equal(f.c._tmCommitEndTurnTransaction(f.txn),true);assert.equal(f.txn.committed,true);assert(f.txn.presentationError);assert.equal(f.c.GM._endTurnCommitPending,false);
});
test('failure of instrumentation after commit does not erase the observed commit',async()=>{
  const f=storageFixture();let notified=0;f.c._perfWithSpan=async(_name,fn)=>{const result=await fn();throw Error('instrumentation failure after '+result);};
  const p=f.save({onCommitted:()=>{notified++;}});await tick();f.transactions[0].complete();assert.equal(await p,true);assert.equal(notified,1);assert.equal(f.disk.size,4);
});
test('an async observer rejection is handled without rejecting the successful write',async()=>{
  const f=storageFixture();const p=f.save({onCommitted:async()=>{throw Error('async observer failed');}});await tick();f.transactions[0].complete();assert.equal(await p,true);await tick();assert(f.events.includes('warning'));
});
test('synchronous put failure aborts the transaction before any partial slot commit',async()=>{
  const f=storageFixture();let aborted=0;f.c._db={transaction:()=>({objectStore:()=>({put(){throw Error('clone failure');}}),abort(){aborted++;if(this.onabort)this.onabort({target:this});}})};
  await assert.rejects(f.save(),/clone failure/);assert.equal(aborted,1);assert.equal(f.disk.size,0);
});
test('failed supplementary memory does not prevent canonical save or snapshot',async()=>{
  for(const sync of [false,true]){const f=renderFixture();f.c._awaitPostTurnJobsForSave=sync?()=>{throw Error('memory missing');}:async()=>{throw Error('memory missing');};
  assert.equal(await f.save(),true);assert(f.events.includes('commit'));assert(f.events.includes('snapshot'));assert(f.events.includes('capture'));}
});
test('unresolved memory never blocks the turn and late success schedules a same-world save',async()=>{
 const f=renderFixture();let release,saves=0;f.c._awaitPostTurnJobsForSave=()=>new Promise(r=>{release=r;});f.c.requestBackgroundAutosave=async()=>{saves++;return {ok:true};};
 assert.equal(await f.save(),true);assert.equal(saves,0);release();await tick();assert.equal(saves,1);
});
test('a failed auxiliary turn-data file preserves its payload in the successful main save',async()=>{
 const f=renderFixture();f.ctx.meta.turnPresentation={turnData:{chronicle:'完整本期正文'}};f.c._endTurn_stageTurnData=async()=>{throw Error('sidecar failed');};
 assert.equal(await f.save(),true);assert.equal(f.disk.get('autosave').GM._deferredTurnData[0].data.chronicle,'完整本期正文');assert(f.ctx.meta.turnSaveWarnings.some(w=>w.stage==='turn-data'));
});
test('an empty auxiliary result is a reported warning, not silent success of that task',async()=>{
  const f=renderFixture();f.c.StateSnapshot.save=async()=>null;assert.equal(await f.save(),true);assert.equal(f.ctx.meta.turnSaveWarnings[0].stage,'time-snapshot');
});
test('actual finalizer keeps committed world and full presentation when auxiliary snapshot fails',async()=>{
  const f=renderFixture();let adopted,shown,toasts=0;const c=f.c;
  c._tmEndTurnTransactionCurrent=t=>!t.committed&&!t.rolledBack&&c.GM===t.gmRef&&c.P===t.pRef;
  c._tmReportEndTurnBoundaryError=()=>{};c._tmAdoptCommittedWorldSnapshot=s=>{adopted=s;return true;};c._endTurn_render=p=>{shown=p;};c.toast=()=>{toasts++;};
  c.StateSnapshot.save=async()=>{throw Error('snapshot failed');};f.ctx.meta.turnPresentation={zhengwen:'完整正文，全部事件保留。',shizhengji:'完整时政记。'};
  loadFunctions(c,'tm-endturn-core.js',['_tmCommitEndTurnTransaction','_tmFinalizeEndTurnTransaction']);
  assert.equal(await c._tmFinalizeEndTurnTransaction(f.ctx,f.txn),true);assert.equal(f.txn.committed,true);assert.equal(f.txn.rolledBack,false);
  assert.equal(JSON.stringify(adopted),JSON.stringify(f.disk.get('autosave')));assert.equal(shown.zhengwen,'完整正文，全部事件保留。');assert(toasts>0);
});
test('a matching durable receipt blocks rollback but a foreign receipt does not',async()=>{
  const f=renderFixture();await f.save();let restores=0;const c=f.c;
  c._tmEndTurnTransactionCurrent=()=>true;c._tmRestoreEndTurnObject=()=>{restores++;};c._tmRestoreCommittedBaselineAfterRollback=()=>true;c._tmRequestEndTurnDesktopAutoSaveFlush=()=>{};
  loadFunctions(c,'tm-endturn-core.js',['_tmRollbackEndTurnTransaction']);
  assert.equal(c._tmRollbackEndTurnTransaction(f.txn,Error('late error')),false);assert.equal(restores,0);
  f.txn.canonicalSaveReceipt={...f.txn.canonicalSaveReceipt,transactionId:'other'};
  assert.equal(c._tmRollbackEndTurnTransaction(f.txn,Error('not committed')),true);assert.equal(restores,2);
});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
