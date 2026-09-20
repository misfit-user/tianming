'use strict';
const assert = require('assert/strict');
const { fixture, tick, clone } = require('./lib-storage-read-deadlines');
const tests = []; const test = (name, run) => tests.push({ name, run });
test('normal reads retain the entire world and metadata without leftover timers', async () => {
  const f=fixture(), expected=f.seed();
  const record=await f.api.load('autosave');
  assert.deepEqual(record.gameState,expected); assert.equal((await f.api.list())[0].id,'autosave');
  assert.equal(f.timers.size,0); assert(f.transactions.every(tx=>tx.mode==='readonly'));
});
test('concurrent database open callers share one pending operation', async () => {
  const f=fixture({holdOpen:true});const a=f.api.open(),b=f.api.open();
  assert.equal(a,b);assert.equal(f.opens.length,1);f.opens[0].succeed();await a;assert.equal(f.timers.size,0);
});
test('opening timeout is an error, not an empty or alternative-backend save', async () => {
  const f=fixture({holdOpen:true}), state=f.seed();
  const save=f.api.save('autosave',state,{turn:4});await tick();assert.equal(f.fire(15000),1);
  await assert.rejects(save,e=>e.code==='SAVE_OPEN_TIMEOUT');assert.equal(f.local.size,0);assert.equal(f.transactions.length,0);
  f.opens[0].succeed();assert.equal(f.opens[0].database.closes,1);assert.equal(f.api.isAvailable(),false);
});
test('a new attempt can recover after synchronous opening failure', async () => {
  const f=fixture({throwOpen:true});await assert.rejects(f.api.open(),/Fixture open failure/);
  f.options.throwOpen=false;await f.api.open();assert.equal(f.api.isAvailable(),true);assert.equal(f.timers.size,0);
});
test('blocked opening rejects and closes its late success without replacing the next connection', async () => {
  const f=fixture({holdOpen:true});const first=f.api.open(),old=f.opens[0];old.block();await assert.rejects(first,e=>e.code==='SAVE_OPEN_BLOCKED');
  const next=f.api.open(),current=f.opens[1];current.succeed();await next;
  old.succeed();old.fail();assert.equal(old.database.closes,1);assert.equal(f.api.isAvailable(),true);
  assert.equal(await f.api.open(),current.database);
});
test('a failed opening cannot perform a late schema upgrade', async () => {
  const f=fixture({holdOpen:true});const result=f.api.open();f.fire(15000);await assert.rejects(result);
  const tx=f.opens[0].upgrade();assert.equal(tx.abortCalls,1);assert(!f.events.includes('upgrade-created-store'));
});
test('version-change and close events from an old connection cannot evict a new one', async () => {
  const f=fixture();const first=await f.api.open();first.onversionchange();
  const second=await f.api.open();first.onversionchange();first.onclose();
  assert.equal(await f.api.open(),second);assert.equal(f.api.isAvailable(),true);
});
test('record timeout ignores a late successful read and does not change stored data', async () => {
  const f=fixture({holdReads:true}),expected=f.seed();const read=f.api.load('autosave');await tick();
  const req=f.requests[0];assert.equal(f.fire(30000),1);await assert.rejects(read,e=>e.code==='SAVE_READ_TIMEOUT');
  req.succeed();assert.equal(req.tx.abortCalls,1);assert.equal(req.tx.aborted,true);assert.equal(f.rows('saves').get('autosave').gameState,JSON.stringify(expected));
  assert.equal(f.timers.size,0);
});
test('metadata timeout prevents primary writes rather than pretending metadata is absent', async () => {
  const f=fixture({holdReads:(kind,store)=>store==='saveMetadata'}),state=f.seed();let commits=0;
  const save=f.api.saveManyAtomic(['autosave','slot_0'].map(id=>({id,gameState:state,meta:{turn:4}})),{onCommitted(){commits++;}});
  await tick();f.fire(30000);await assert.rejects(save,e=>e.code==='SAVE_READ_TIMEOUT');
  assert.equal(commits,0);assert(f.transactions.every(tx=>tx.mode==='readonly'));assert.equal(f.rows('saves').has('slot_0'),false);
});
test('store and index timeouts are failures, never empty success or an automatic full scan', async () => {
  for(const index of [false,true]){
    const f=fixture({holdReads:true});f.seed();
    const read=index?f.api.listTurnPublishReceipts('tmc_fixture','tml_fixture_branch_1234','world-committed'):f.api.list();
    await tick();f.fire(30000);await assert.rejects(read,e=>e.code==='SAVE_READ_TIMEOUT');
    assert.equal(f.requests.length,1);assert.equal(f.requests[0].kind,index?'index':'getAll');
  }
});
test('missing legacy index still uses one bounded compatibility read', async () => {
  const f=fixture({missingIndex:true});
  f.rows('turnPublishReceipts').set('receipt',{id:'receipt',campaignId:'tmc_fixture',timelineId:'tml_fixture_branch_1234',status:'world-committed',transactionId:'txn'});
  const records=await f.api.listTurnPublishReceipts('tmc_fixture','tml_fixture_branch_1234','world-committed');
  assert.equal(records.length,1);assert.equal(records[0].transactionId,'txn');assert.equal(f.requests.length,1);assert.equal(f.timers.size,0);
});
test('timing out a read does not abort an unrelated canonical write', async () => {
  const f=fixture({holdWrites:true,holdReads:(kind,store)=>store==='saves'}),state=f.seed();
  const write=f.api.save('manual-safe',state,{turn:4});await tick();const tx=f.transactions.find(t=>t.mode==='readwrite');assert(tx);
  const read=f.api.load('autosave');await tick();f.fire(30000);await assert.rejects(read,e=>e.code==='SAVE_READ_TIMEOUT');
  assert.equal(tx.abortCalls,0);tx.complete();assert.equal(await write,true);assert(f.rows('saves').has('manual-safe'));
});
test('legacy no-IndexedDB environments still save and read full local data', async () => {
  const f=fixture({noIndexedDB:true}),state=f.seed();
  assert.equal(await f.api.save('local-save',state,{turn:4}),true);assert.deepEqual((await f.api.load('local-save')).gameState,state);
  assert.equal(f.api.isAvailable(),false);assert.equal(f.timers.size,0);
});
test('an old failed open catch cannot erase a newer ready connection', async () => {
  const f=fixture({holdOpen:true});f.seed();const read=f.api.load('autosave');await tick();f.opens[0].block();
  const newer=f.api.open();f.opens[1].succeed();await newer;const result=await read;
  assert.equal(result.gameState.GM.turn,4);assert.equal(f.api.isAvailable(),true);assert.equal(f.local.size,0);
});
test('failed prepared-journal recovery never falls through to another save', async () => {
  const f=fixture({localFailure:true}),state=f.seed();
  f.local.set('tm_save_batch_journal_v1',JSON.stringify({version:1,phase:'prepared',items:[{key:'old-record',previous:'old-content'}]}));
  await assert.rejects(f.api.save('new-save',state,{turn:4}),e=>e.code==='SAVE_LOCAL_RECOVERY_FAILED');
  assert.equal(f.opens.length,0);assert.equal(f.rows('saves').has('new-save'),false);assert(f.local.has('tm_save_batch_journal_v1'));
});
test('post-commit cleanup read failure does not erase a confirmed complete save', async () => {
  const f=fixture({holdReads:(kind,store)=>kind==='getAll'&&store==='saveMetadata'}),state=f.seed();
  state.GM._timelineId='tml_new_branch_1234';let commits=0;
  const save=f.api.saveManyAtomic([{id:'autosave',gameState:state,meta:{turn:4}}],{transactionId:'new-txn',onCommitted(){commits++;}});
  await tick();assert.equal(commits,1);assert.equal(f.rows('saves').get('autosave').timelineId,state.GM._timelineId);
  f.fire(30000);assert.equal(await save,true);assert(f.api.diagnostics().some(row=>row.code==='SAVE_READ_TIMEOUT'));
});
test('failed readonly abort is diagnosed without touching any stored record', async () => {
  const f=fixture({holdReads:true,abortThrows:true});f.seed();const before=JSON.stringify([...f.rows('saves')]);
  const read=f.api.load('autosave');await tick();f.fire(30000);await assert.rejects(read,e=>e.code==='SAVE_READ_TIMEOUT');
  assert.equal(JSON.stringify([...f.rows('saves')]),before);assert.equal(f.api.diagnostics().at(-1).abortState,'unconfirmed');
});
test('a slow but completed read keeps all content and disables its deadline', async () => {
  const f=fixture({holdReads:true}),state=f.seed();const read=f.api.load('autosave');await tick();f.requests[0].succeed();
  assert.deepEqual((await read).gameState,state);assert.equal(f.fire(30000),0);assert.equal(f.transactions[0].abortCalls,0);
});
test('read setup errors and rejected requests clean their timers', async () => {
  const f=fixture({holdReads:true});f.seed();const read=f.api.load('autosave');await tick();f.requests[0].fail(Error('fixture read error'));
  await assert.rejects(read,/fixture read error/);assert.equal(f.timers.size,0);
  f.options.throwTransaction=true;await assert.rejects(f.api.load('autosave'),/Fixture transaction failure/);assert.equal(f.timers.size,0);
});
test('diagnostics remain bounded and do not expose or mutate save data', async () => {
  const f=fixture({holdReads:true});f.seed('private-save-name');
  for(let i=0;i<14;i++){const result=f.api.load('private-save-name');await tick();f.fire(30000);await assert.rejects(result);}
  const out=f.api.diagnostics();assert.equal(out.length,12);assert(!JSON.stringify(out).includes('private-save-name'));assert(!JSON.stringify(out).includes('完整世界'));
  out[0].stage='changed';assert.notEqual(f.api.diagnostics()[0].stage,'changed');assert.equal(f.timers.size,0);
});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
