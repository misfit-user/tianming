'use strict';
const assert=require('assert/strict'),{fixture}=require('./lib-turn-response-recovery'),{database,load}=require('./lib-recovery-vault-fixture');
const tick=()=>new Promise(r=>setImmediate(r)),tests=[];const test=(name,run)=>tests.push({name,run});
const row=(tag)=>({version:1,fingerprint:tag.repeat(64),world:'campaign|timeline',at:Date.now(),records:[['json:'+tag.repeat(64)+':1',JSON.stringify({text:'完整正文 '+tag})]]});
test('older delayed digest cannot overwrite a newer persistent checkpoint',async()=>{
 const f=fixture(),db=database(),v=load(f.c,db);try{
  const actual=f.c.crypto.subtle;let release,entered=false,n=0;f.c.crypto={subtle:{digest:async(...args)=>{if(++n===1){entered=true;await new Promise(r=>{release=r;});}return actual.digest(...args);}}};
  const old=v.save(row('a'));while(!entered)await tick();assert.equal(await v.save(row('b')),true);release();assert.equal(await old,false);assert.equal(db.disk.get('latest').fingerprint,'b'.repeat(64));
 }finally{f.dispose();}
});
test('clear during verification prevents adoption of an already-read row',async()=>{
 const f=fixture(),db=database(),v=load(f.c,db);try{
  const r=row('a');await v.save(r);const actual=f.c.crypto.subtle;let release,entered=false;
  f.c.crypto={subtle:{digest:async(...args)=>{entered=true;await new Promise(r=>{release=r;});return actual.digest(...args);}}};
  const reading=v.load(r.fingerprint,r.world);while(!entered)await tick();await v.clear();release();assert.equal(await reading,null);assert.equal(db.disk.size,0);
 }finally{f.dispose();}
});
test('disabled persistence rejects a late in-flight read',async()=>{
 const f=fixture(),db=database(),v=load(f.c,db);try{
  const r=row('a');await v.save(r);const actual=f.c.crypto.subtle;let release,entered=false;
  f.c.crypto={subtle:{digest:async(...args)=>{entered=true;await new Promise(r=>{release=r;});return actual.digest(...args);}}};
  const reading=v.load(r.fingerprint,r.world);while(!entered)await tick();v.setEnabled(false);release();assert.equal(await reading,null);
 }finally{f.dispose();}
});
test('clearing while a save is hashing prevents resurrection',async()=>{
 const f=fixture(),db=database(),v=load(f.c,db);try{
  const actual=f.c.crypto.subtle;let release,entered=false;f.c.crypto={subtle:{digest:async(...args)=>{entered=true;await new Promise(r=>{release=r;});return actual.digest(...args);}}};
  const writing=v.save(row('a'));while(!entered)await tick();await v.clear();release();assert.equal(await writing,false);assert.equal(db.disk.size,0);
 }finally{f.dispose();}
});
test('a stalled fingerprint digest cannot block ordinary full generation forever',async()=>{
 const f=fixture(),timers=new Map();try{
  f.c.crypto={subtle:{digest:()=>new Promise(()=>{})}};f.c.setTimeout=(fn,ms)=>{const id={fn,ms};timers.set(id,id);return id;};f.c.clearTimeout=id=>timers.delete(id);
  const txn=f.capture(),start=f.R.begin(txn);await tick();const t=[...timers.values()].find(t=>t.ms===3000);assert(t);t.fn();assert.equal(await start,false);
  f.c.fetch=async()=>f.okay(f.response('仍须完整推演'));const result=await f.request();assert.equal(result.choices[0].message.content,'仍须完整推演');
 }finally{f.dispose();}
});
test('oversized identity metadata is rejected without changing the original response',async()=>{
 const f=fixture(),v=load(f.c,database());try{const r=row('a');r.world='w'.repeat(401);assert.equal(await v.save(r),false);}finally{f.dispose();}
});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
