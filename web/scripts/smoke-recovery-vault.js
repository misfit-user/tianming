'use strict';
const assert=require('assert/strict');
const {fixture,copy}=require('./lib-turn-response-recovery');
const {database,load}=require('./lib-recovery-vault-fixture');
const tests=[];const test=(name,run)=>tests.push({name,run});
async function retained(db){const f=fixture(),v=load(f.c,db);f.c.fetch=async()=>f.okay(f.response('完整恢复响应，不能缩短。😀'.repeat(200)));const txn=await f.begin();const first=await f.request();const error=Object.assign(Error('synthetic timeout'),{code:'AI_TIMEOUT'});f.rollback(txn,error,false);await f.R.finish(txn,'failed',error);return {f,v,txn,first};}
test('confirmed rollback checkpoints survive a new page context and replay exact full content',async()=>{
 const db=database(),x=await retained(db),next=fixture();try{
  assert.equal(db.disk.size,1);next.c.GM=copy(x.txn.gm.data);next.c.P=copy(x.txn.p.data);load(next.c,db);let calls=0;next.c.fetch=async()=>{calls++;return next.okay(next.response('must not run'));};
  await next.begin();const response=await next.request();assert.equal(JSON.stringify(response.choices),JSON.stringify(x.first.choices));assert.equal(calls,0);assert.equal(next.R.status().hits,1);
  assert(!JSON.stringify([...db.disk]).includes('fixture-only'));assert(!JSON.stringify([...db.disk]).includes('Full world reasoning'));
 }finally{x.f.dispose();next.dispose();}
});
test('corrupted stored response is rejected rather than replayed',async()=>{
 const db=database(),x=await retained(db);try{const row=db.disk.get('latest');row.records[0][1]='"tampered"';assert.equal(await x.v.load(row.fingerprint,row.world),null);}finally{x.f.dispose();}
});
test('foreign worlds, changed baselines and expired responses are not adopted',async()=>{
 const db=database(),x=await retained(db);try{const row=db.disk.get('latest');assert.equal(await x.v.load(row.fingerprint,'other-world'),null);assert.equal(await x.v.load('f'.repeat(64),row.world),null);row.at-=31*60000;assert.equal(await x.v.load(row.fingerprint,row.world),null);}finally{x.f.dispose();}
});
test('successful final commit removes only its matching recovery checkpoint',async()=>{
 const db=database(),x=await retained(db);try{const row=db.disk.get('latest');await x.v.clear('f'.repeat(64));assert.equal(db.disk.size,1);await x.v.clear(row.fingerprint);assert.equal(db.disk.size,0);}finally{x.f.dispose();}
});
test('the local persistence switch clears candidates and does not affect ordinary generation',async()=>{
 const db=database(),x=await retained(db);try{x.v.setEnabled(false);await x.v.clear();assert.equal(db.disk.size,0);assert.equal(x.v.enabled(),false);const row={version:1,fingerprint:'a'.repeat(64),world:'w',at:Date.now(),records:[]};assert.equal(await x.v.save(row),false);}finally{x.f.dispose();}
});
test('invalid or oversized checkpoint rows never create a persistent entry',async()=>{
 const db=database(),f=fixture(),v=load(f.c,db);try{
  const row={version:1,fingerprint:'a'.repeat(64),world:'w',at:Date.now(),records:[['json:'+ 'b'.repeat(64)+':1','x'.repeat(1000001)]]};assert.equal(await v.save(row),false);assert.equal(db.disk.size,0);
  row.records=[['invalid-key','{}']];assert.equal(await v.save(row),false);
 }finally{f.dispose();}
});
test('disabled or unavailable persistent storage preserves complete uncached requests',async()=>{
 const f=fixture(),v=load(f.c,{api:{open(){throw Error('no database');}}});let calls=0;try{
  f.c.fetch=async()=>{calls++;return f.okay(f.response());};await f.begin();const response=await f.request();assert.equal(response.choices[0].message.content,'完整叙事与有效状态提案。');assert.equal(calls,1);assert.equal(v.status().state,'unavailable');
 }finally{f.dispose();}
});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
