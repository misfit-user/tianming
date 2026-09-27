import {edit} from './patch-utils.mjs';
edit('web/scripts/verify-all.js',(s,r)=>{
 const names=['recovery-vault','final-save-reconcile','memory-scoring-equivalence','final-recovery-races'];
 const additions=names.filter(n=>!s.includes("file: 'smoke-"+n+".js'")).map(n=>"  { name: '"+n+"', file: 'smoke-"+n+".js', estSec: 3, expectExit: 0 },").join('\n');
 const anchor="  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }";
 return additions?r(s,anchor,additions+'\n'+anchor):s;
});
edit('web/scripts/smoke-final-save-reconcile.js',(s,r)=>r(s,'(async()=>{',`test('a temporarily failed completion callback remains retryable after real outcome acknowledgement',async()=>{
 const x=await prepare(),accept=x.f.ctx.meta.acceptReconciledCommit;let attempts=0;
 x.f.ctx.meta.acceptReconciledCommit=async()=>{if(++attempts===1)throw Error('synthetic completion failure');return accept();};
 x.manager.watch(x.f.ctx,x.f.txn,x.error);x.tx.complete();await tick();await tick();assert.equal(x.manager.status().state,'verification-required');assert.equal(x.f.txn.committed,false);
 await x.manager.check();assert.equal(x.f.txn.committed,true);assert.equal(attempts,2);assert.equal(x.f.shown,x.c.GM.fullNarrative);
});
test('same-object timeline changes still reject an old terminal result',async()=>{
 const x=await prepare();x.manager.watch(x.f.ctx,x.f.txn,x.error);x.c.GM._timelineId='new-branch';x.tx.complete();await tick();assert.equal(x.manager.status().state,'stale');assert.equal(x.f.txn.committed,false);assert.equal(x.db.api.writeStatus().blocked,true);
});
test('post-commit display error never causes replay of a confirmed transaction',async()=>{
 const x=await prepare(),finish=x.c._tmFinalizeEndTurnTransaction;let calls=0;
 x.c._tmFinalizeEndTurnTransaction=async(...args)=>{calls++;await finish(...args);throw Error('after complete display');};
 x.manager.watch(x.f.ctx,x.f.txn,x.error);x.tx.complete();await tick();await tick();assert.equal(x.f.txn.committed,true);assert.equal(x.manager.status().state,'committed-display-pending');await x.manager.check();assert.equal(calls,1);
});
(async()=>{`));
