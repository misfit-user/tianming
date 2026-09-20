'use strict';
const assert=require('assert/strict');
const {fixture,tick,clone}=require('./lib-storage-read-deadlines');
const {renderFixture,loadFunctions}=require('./lib-save-commit-boundary');
const tests=[];const test=(name,run)=>tests.push({name,run});
async function ready(options={}){const f=fixture(options);await f.api.open();const state=f.seed();state.GM.fullNarrative+='完整新回合';f.entries=['autosave','slot_0'].map(id=>({id,gameState:state,meta:{turn:4}}));f.save=opts=>f.api.saveManyAtomic(f.entries,{transactionId:'txn-fixture',...opts});return f;}
const watched=p=>p.then(value=>({value}),error=>({error}));
test('normal canonical commit preserves complete content and notifies only after commit',async()=>{
  const f=await ready({holdWrites:true});let commits=0;const p=watched(f.save({onCommitted(){commits++;}}));await tick();assert.equal(commits,0);
  f.transactions.find(t=>t.mode==='readwrite').complete();assert.equal((await p).value,true);assert.equal(commits,1);assert.equal(f.timers.size,0);
  assert.equal(JSON.stringify((await f.api.load('slot_0')).gameState),JSON.stringify(f.entries[0].gameState));
});
test('write deadline requests abort and waits for its confirmation rather than firing success',async()=>{
  const f=await ready({holdWrites:true});let commits=0;const before=JSON.stringify([...f.rows('saves')]);const p=watched(f.save({onCommitted(){commits++;}}));await tick();
  f.fire(60000);const result=await p;assert.equal(result.error.code,'SAVE_WRITE_TIMEOUT');assert.equal(result.error.storageOutcome,'aborted');
  assert.equal(commits,0);assert.equal(JSON.stringify([...f.rows('saves')]),before);assert.equal(f.api.writeStatus().blocked,false);assert.equal(f.timers.size,0);
});
test('request error alone cannot trigger retry before the transaction abort event',async()=>{
  const f=await ready({holdWrites:true});const p=watched(f.save());await tick();const tx=f.transactions.find(t=>t.mode==='readwrite');
  tx.abort=()=>{tx.abortCalls++;};const quota=Object.assign(Error('quota'),{name:'QuotaExceededError'});tx.onerror({target:{error:quota}});await tick();
  assert.equal(f.transactions.filter(t=>t.mode==='readwrite').length,1);assert.equal(f.timers.size,1);
  tx.onabort({target:{error:quota}});assert.equal((await p).value,false);assert.equal(f.timers.size,0);
});
test('unknown outcome prevents another write and ignores a late completion',async()=>{
  const f=await ready({holdWrites:true,abortThrows:true});let commits=0;
  const p=watched(f.save({onCommitted(){commits++;}}));await tick();
  f.fire(60000);await tick();assert.equal(commits,0);f.fire(5000);
  assert.equal((await p).error.code,'SAVE_WRITE_UNCONFIRMED');
  assert.equal(f.api.writeStatus().blocked,true);
  const writes=f.transactions.filter(t=>t.mode==='readwrite').length;
  await assert.rejects(f.save(),e=>e.code==='SAVE_WRITE_UNCONFIRMED');
  assert.equal(f.transactions.filter(t=>t.mode==='readwrite').length,writes);
  f.transactions.find(t=>t.mode==='readwrite').complete();await tick();
  assert.equal(commits,0);assert.equal(f.api.writeStatus().blocked,true);assert.equal(f.timers.size,0);
});
test('genuine completion within abort grace is accepted once',async()=>{
  const f=await ready({holdWrites:true,abortThrows:true});let commits=0;
  const p=watched(f.save({onCommitted(){commits++;}}));await tick();
  f.fire(60000);f.transactions.find(t=>t.mode==='readwrite').complete();
  assert.equal((await p).value,true);assert.equal(commits,1);assert.equal(f.timers.size,0);
  assert.equal(f.api.writeStatus().blocked,false);
});
test('confirmed abort permits a clean retry without partially advancing slots',async()=>{
  const f=await ready({holdWrites:true});const p=watched(f.save());await tick();f.fire(60000);
  assert.equal((await p).error.storageOutcome,'aborted');f.options.holdWrites=false;
  assert.equal(await f.save(),true);assert.equal(f.rows('saves').get('autosave').gameState,f.rows('saves').get('slot_0').gameState);
});
test('second put exception aborts the entire transaction',async()=>{
  const f=await ready({holdWrites:true});const db=f.opens[0].database,orig=db.transaction;
  db.transaction=(...args)=>{const tx=orig(...args),store=tx.objectStore;tx.objectStore=name=>{const result=store(name);if(name==='saveMetadata')result.put=()=>{throw Error('second put fails');};return result;};return tx;};
  const before=JSON.stringify([...f.rows('saves')]);await assert.rejects(f.save(),/second put fails/);
  assert.equal(JSON.stringify([...f.rows('saves')]),before);assert.equal(f.timers.size,0);
});
test('delete timeout does not remove an existing save',async()=>{
  const f=await ready({holdWrites:true});f.seed('manual-fixture');const p=watched(f.api.delete('manual-fixture'));await tick();
  f.fire(60000);assert.equal((await p).error.code,'SAVE_WRITE_TIMEOUT');assert(f.rows('saves').has('manual-fixture'));assert.equal(f.timers.size,0);
});
test('single manual and project writes have the same confirmed-abort boundary',async()=>{
  for(const kind of ['manual','project']){const f=await ready({holdWrites:true});
    const p=watched(kind==='manual'?f.api.save('manual',f.entries[0].gameState,{}):f.api.saveProject({full:'完整剧本内容'}));await tick();f.fire(60000);
    assert.equal((await p).error.storageOutcome,'aborted');assert.equal(f.timers.size,0);
  }
});
test('unconfirmed canonical write keeps staged data and rejects instead of reporting rollback',async()=>{
  const f=renderFixture();let discarded=0;f.c._endTurn_discardStagedTurnData=async()=>{discarded++;};
  f.c.TM_SaveDB.saveManyAtomic=async()=>{throw Object.assign(Error('未确认'),{code:'SAVE_WRITE_UNCONFIRMED'});};
  await assert.rejects(f.save(),e=>e.code==='SAVE_WRITE_UNCONFIRMED');assert.equal(discarded,0);assert.equal(f.txn.saveWriteUnconfirmed,true);
});
test('ordinary confirmed save failure still keeps the original failure policy',async()=>{
  const f=renderFixture();f.c.TM_SaveDB.saveManyAtomic=async()=>{throw Object.assign(Error('已中止'),{code:'SAVE_WRITE_TIMEOUT',storageOutcome:'aborted'});};
  assert.equal(await f.save(),false);assert(f.events.includes('discard'));assert.notEqual(f.txn.saveWriteUnconfirmed,true);
});
test('core refuses to roll back an unconfirmed transaction',()=>{
  const f=renderFixture();let restored=0;
  f.c._tmEndTurnTransactionCurrent=()=>true;f.c._tmRestoreEndTurnObject=()=>{restored++;};
  loadFunctions(f.c,'tm-endturn-core.js',['_tmRollbackEndTurnTransaction']);f.txn.saveWriteUnconfirmed=true;
  assert.equal(f.c._tmRollbackEndTurnTransaction(f.txn,Error('late')),false);assert.equal(restored,0);
});
test('diagnostics expose bounded status, not stored content or mutable safety state',async()=>{
  const f=await ready({holdWrites:true,abortThrows:true});const p=watched(f.save());await tick();f.fire(60000);f.fire(5000);await p;
  const status=f.api.writeStatus();status.blocked=false;assert.equal(f.api.writeStatus().blocked,true);
  assert(!JSON.stringify(f.api.diagnostics()).includes('完整世界正文'));assert(f.api.diagnostics().length<=12);
});
test('actual turn entry pauses an unconfirmed save without rollback or desktop flush',async()=>{
  const f=renderFixture(),c=f.c;let restored=0,flushed=0,notice='';
  c.console.error=()=>{};c._$=()=>null;c.showLoading=()=>{};c.hideLoading=()=>{};c.toast=text=>{notice=text;};
  c._tmCaptureEndTurnTransaction=()=>f.txn;c._tmCapturePreEndTurnCommittedState=()=>({});
  c._tmPrepareEndTurnBoundary=async()=>{throw Object.assign(Error('存档待核对'),{code:'SAVE_WRITE_UNCONFIRMED'});};
  c._tmRollbackEndTurnTransaction=()=>{restored++;};c._tmRequestEndTurnDesktopAutoSaveFlush=()=>{flushed++;};
  loadFunctions(c,'tm-endturn-core.js',['_endTurnCore']);await c._endTurnCore({});
  assert.equal(restored,0);assert.equal(flushed,0);assert.equal(f.txn.saveWriteUnconfirmed,true);assert.equal(c.GM.busy,true);assert.equal(notice,'存档待核对');
});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
