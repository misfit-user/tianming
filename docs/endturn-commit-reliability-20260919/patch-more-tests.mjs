import { edit } from './patch-utils.mjs';
edit('web/scripts/smoke-save-commit-boundary.js',(s,r)=>r(s,'(async()=>{',`test('failure of instrumentation after commit does not erase the observed commit',async()=>{
  const f=storageFixture();let notified=0;f.c._perfWithSpan=async(_name,fn)=>{const result=await fn();throw Error('instrumentation failure after '+result);};
  const p=f.save({onCommitted:()=>{notified++;}});await tick();f.transactions[0].complete();assert.equal(await p,true);assert.equal(notified,1);assert.equal(f.disk.size,4);
});
test('an async observer rejection is handled without rejecting the successful write',async()=>{
  const f=storageFixture();const p=f.save({onCommitted:async()=>{throw Error('async observer failed');}});await tick();f.transactions[0].complete();assert.equal(await p,true);await tick();assert(f.events.includes('warning'));
});
test('synchronous put failure aborts the transaction before any partial slot commit',async()=>{
  const f=storageFixture();let aborted=0;f.c._db={transaction:()=>({objectStore:()=>({put(){throw Error('clone failure');}}),abort(){aborted++;}})};
  await assert.rejects(f.save(),/clone failure/);assert.equal(aborted,1);assert.equal(f.disk.size,0);
});
test('mandatory post-turn work failure still prevents every save and snapshot',async()=>{
  const f=renderFixture();f.c._awaitPostTurnJobsForSave=async()=>{throw Error('required memory missing');};
  assert.equal(await f.save(),false);assert(!f.events.includes('commit'));assert(!f.events.includes('snapshot'));assert(!f.events.includes('capture'));
});
test('an empty auxiliary result is a reported warning, not silent success of that task',async()=>{
  const f=renderFixture();f.c.StateSnapshot.save=async()=>null;assert.equal(await f.save(),true);assert.equal(f.ctx.meta.turnSaveWarnings[0].stage,'time-snapshot');
});
(async()=>{`));
edit('web/scripts/smoke-save-commit-boundary.js',(s,r)=>r(s,'(async()=>{',`test('actual finalizer keeps committed world and full presentation when auxiliary snapshot fails',async()=>{
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
(async()=>{`));
