'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const {fixture,tick}=require('./lib-storage-read-deadlines');
const {renderFixture,loadFunctions,ROOT}=require('./lib-save-commit-boundary');
const tests=[];const test=(name,run)=>tests.push({name,run});
async function prepare(){
 const db=fixture({holdWrites:true,abortThrows:true});await db.api.open();db.seed('autosave',3);db.seed('slot_0',3);
 const f=renderFixture(),c=f.c;c.TM_SaveDB=db.api;c.setTimeout=setTimeout;c.clearTimeout=clearTimeout;
 c.GM.fullNarrative='必须完整保留的正文😀'.repeat(100);f.ctx.meta.turnPresentation={zhengwen:c.GM.fullNarrative};
 c._tmMaybeStageTurnResult=()=>true;c._tmEndTurnTransactionCurrent=t=>!t.rolledBack&&!t.committed&&!t.saveWriteUnconfirmed;
 c._tmRequestEndTurnDesktopAutoSaveFlush=()=>{};c._tmReportEndTurnBoundaryError=()=>{};c._endTurn_render=p=>{f.shown=p.zhengwen;};
 c._endTurn_publishStagedTurnData=async()=>true;c._endTurn_clearCommittedInputs=()=>{};
 loadFunctions(c,'tm-endturn-core.js',['_tmCommitEndTurnTransaction','_tmFinalizeEndTurnTransaction']);
 vm.runInContext(fs.readFileSync(path.join(ROOT,'tm-endturn-save-reconcile.js'),'utf8'),c);
 const saving=f.save().then(value=>({value}),error=>({error}));await tick();db.fire(60000);db.fire(5000);const result=await saving;
 assert.equal(result.error.code,'SAVE_WRITE_UNCONFIRMED');const tx=db.transactions.find(t=>t.mode==='readwrite');
 return {db,f,c,tx,error:result.error,manager:c.TM.Endturn.SaveReconcile};
}
test('unknown outcome remains blocked; an arbitrary acknowledgement cannot release it',async()=>{
 const x=await prepare();assert.equal(x.db.api.acknowledgeWriteOutcome(x.error.storageOperationId),false);
 x.manager.watch(x.f.ctx,x.f.txn,x.error);await x.manager.check();assert.equal(x.f.txn.committed,false);assert.equal(x.db.api.writeStatus().blocked,true);
});
test('genuine late commit verifies both complete slots and finalizes the original result once',async()=>{
 const x=await prepare();x.manager.watch(x.f.ctx,x.f.txn,x.error);x.tx.complete();await tick();await tick();
 assert.equal(x.f.txn.committed,true);assert.equal(x.f.shown,x.c.GM.fullNarrative);assert.equal(x.manager.status().state,'committed');assert.equal(x.db.api.writeStatus().blocked,false);
 const writes=x.db.transactions.filter(t=>t.mode==='readwrite').length;await x.manager.check();assert.equal(x.db.transactions.filter(t=>t.mode==='readwrite').length,writes);
});
test('mismatched full data keeps the safety latch instead of adopting a partial save',async()=>{
 const x=await prepare();x.tx.complete();x.db.rows('saves').get('slot_0').gameState='{"GM":{"turn":4},"P":{}}';
 x.manager.watch(x.f.ctx,x.f.txn,x.error);await tick();await x.manager.check();
 assert.equal(x.f.txn.committed,false);assert.equal(x.db.api.writeStatus().blocked,true);assert.equal(x.manager.status().state,'verification-required');
});
test('confirmed late abort calls the existing rollback owner and never publishes a new result',async()=>{
 const x=await prepare();let restored=0;x.c._tmRollbackEndTurnTransaction=(t)=>{assert.equal(t.saveWriteUnconfirmed,false);restored++;t.rolledBack=true;return true;};
 x.manager.watch(x.f.ctx,x.f.txn,x.error);x.db.options.abortThrows=false;x.tx.abort();await tick();
 assert.equal(restored,1);assert.equal(x.f.txn.committed,false);assert.equal(x.manager.status().state,'aborted');assert.equal(x.db.api.writeStatus().blocked,false);
});
test('world switches cannot accept late disk results or clear the old safety latch',async()=>{
 const x=await prepare();x.manager.watch(x.f.ctx,x.f.txn,x.error);x.c.GM={turn:99};x.tx.complete();await tick();
 assert.equal(x.f.txn.committed,false);assert.equal(x.manager.status().state,'stale');assert.equal(x.db.api.writeStatus().blocked,true);
});
test('contradictory duplicate terminal callbacks cannot turn a confirmed commit into abort',async()=>{
 const x=await prepare();x.tx.complete();x.tx.onabort({target:{error:Error('synthetic late duplicate')}});
 assert.equal(x.db.api.writeOutcome(x.error.storageOperationId).outcome,'committed');
 const copy=x.db.api.writeOutcome(x.error.storageOperationId);copy.outcome='aborted';assert.equal(x.db.api.writeOutcome(copy.id).outcome,'committed');
});
test('failed readback does not unlock writes or replace the completed narrative',async()=>{
 const x=await prepare();x.tx.complete();x.db.api.load=async()=>{throw Error('readback error');};x.manager.watch(x.f.ctx,x.f.txn,x.error);await tick();
 assert.equal(x.f.txn.committed,false);assert.equal(x.f.shown,undefined);assert.equal(x.db.api.writeStatus().blocked,true);
});
test('a temporarily failed completion callback remains retryable after real outcome acknowledgement',async()=>{
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
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
