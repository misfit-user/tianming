'use strict';
const assert=require('assert/strict');const {fixture,tick,clone}=require('./lib-desktop-autosave-reliability');
const tests=[];const test=(name,run)=>tests.push({name,run});
test('full committed world is saved once with no data loss and no remaining timeout',async()=>{
  const f=fixture(),before=JSON.stringify({GM:f.c.GM,P:f.c.P});assert.equal((await f.save()).ok,true);
  assert.equal(f.calls.length,1);assert.equal(JSON.stringify(f.calls[0].payload.data.gameState),JSON.stringify(f.c.GM));
  assert.equal(JSON.stringify({GM:f.c.GM,P:f.c.P}),before);assert.equal(f.timers.size,0);assert.equal(f.status().pending,false);
});
test('never-returning native write has a bounded local wait without a false success',async()=>{
  const f=fixture();f.setReply(()=>new Promise(()=>{}));const p=f.save();await tick();assert.equal(f.fire(60000),1);
  const out=await p;assert.equal(out.ok,false);assert.equal(out.error.code,'DESKTOP_AUTOSAVE_UNCONFIRMED');
  assert.equal(f.c._autoSaveLastDoneMs,0);assert.equal(f.c._autoSaveLastSavedTurn,-1);assert.equal(f.c._autoSaveInFlightPromise,null);
  assert.equal(f.c._autoSaveInFlight,false);assert.equal(f.status().pending,true);assert.equal(f.timers.size,0);
});
test('repeated and replacement-world writes cannot overtake an unconfirmed native request',async()=>{
  const f=fixture();f.setReply(()=>new Promise(()=>{}));const p=f.save();await tick();f.fire(60000);await p;
  for(let i=0;i<3;i++)assert.equal((await f.save()).reason,'native-write-unconfirmed');
  f.c.GM={...f.c.GM,_timelineId:'replacement'};f.c._tmLoadGen++;f.api.rotateAutoSaveSession('new-fixture-session-0002');f.adopt();
  assert.equal((await f.save()).ok,false);assert.equal(f.calls.length,1);
});
test('close flush waits only to the bounded deadline and never calls unknown work drained',async()=>{
  const f=fixture();f.setReply(()=>new Promise(()=>{}));const p=f.save();await tick();const closing=f.c._tmAwaitDesktopAutoSaveForClose();
  f.fire(60000);await p;assert.equal((await closing).ok,false);f.c._autoSaveDeferred=false;
  assert.equal((await f.c._tmAwaitDesktopAutoSaveForClose()).code,'desktop-autosave-unconfirmed');assert.equal(f.calls.length,1);
});
test('late success releases the native lock but cannot advance the saved clock or lite mirror',async()=>{
  const f=fixture();let release;f.setReply(()=>new Promise(r=>release=r));const p=f.save();await tick();f.fire(60000);await p;
  release({success:true,sessionToken:'autosave-session-fixture-0001'});await tick();assert.equal(f.status().pending,false);
  assert.equal(f.c._autoSaveLastDoneMs,0);assert.equal(f.c._autoSaveLiteTick,0);assert(!f.events.includes('lite-write'));
  f.setReply((_c,payload)=>({success:true,sessionToken:payload.sessionToken}));assert.equal((await f.save()).ok,true);assert.equal(f.calls.length,2);
});
test('late rejection is handled once and permits a later explicit retry',async()=>{
  const f=fixture();let reject;f.setReply(()=>new Promise((_r,j)=>reject=j));const p=f.save();await tick();f.fire(60000);await p;
  reject(Error('delayed rejection'));await tick();assert.equal(f.status().pending,false);assert.equal(f.status().events.at(-1).phase,'late-rejection');
  f.setReply(()=>({success:true}));assert.equal((await f.save()).ok,true);
});
test('world changed before dispatch never sends the earlier snapshot with a new session',async()=>{
  const f=fixture();const p=f.save();f.c.GM={...f.c.GM,_timelineId:'later'};f.c._tmLoadGen++;f.api.rotateAutoSaveSession('new-fixture-session-0002');
  assert.equal((await p).ok,false);assert.equal(f.calls.length,0);assert.equal(f.status().pending,false);
});
test('a turn starting before dispatch defers the old idle write rather than serializing live state',async()=>{
  const f=fixture();const p=f.save();f.c.GM.busy=true;assert.equal((await p).ok,false);assert.equal(f.calls.length,0);
  f.c.GM.busy=false;assert.equal((await f.save()).ok,true);
});
test('a changed bridge instance cannot publish a successful old response into idle bookkeeping',async()=>{
  const f=fixture();let release;f.setReply(()=>new Promise(r=>release=r));const p=f.save();await tick();f.c.tianming={...f.api};
  release({success:true});assert.equal((await p).stale,true);assert.equal(f.c._autoSaveLastDoneMs,0);
});
test('old success and stale failure cannot replace the current preload session',async()=>{
  for(const success of [true,false]){const f=fixture();let release;f.setReply(()=>new Promise(r=>release=r));
    const p=f.api.autoSaveJson('{}');f.api.rotateAutoSaveSession('new-fixture-session-0002');
    release({success,stale:!success,sessionToken:'autosave-session-fixture-0001'});await p;
    assert.equal(f.api.getAutoSaveSessionToken(),'new-fixture-session-0002');
  }
});
test('session rotation back to the original value cannot authorize a late token adoption',async()=>{
  const f=fixture();let release;f.setReply(()=>new Promise(r=>release=r));const p=f.api.autoSave({});
  f.api.rotateAutoSaveSession('new-fixture-session-0002');f.api.rotateAutoSaveSession('autosave-session-fixture-0001');
  release({success:true,sessionToken:'foreign-session-0003'});await p;assert.equal(f.api.getAutoSaveSessionToken(),'autosave-session-fixture-0001');
});
test('foreign success receipt is rejected and cannot change success time or session',async()=>{
  const f=fixture();f.setReply(()=>({success:true,sessionToken:'foreign-session-0003'}));assert.equal((await f.save()).ok,false);
  assert.equal(f.api.getAutoSaveSessionToken(),'autosave-session-fixture-0001');assert.equal(f.c._autoSaveLastDoneMs,0);
});
test('same-turn new committed memory is saved even without new input; unchanged snapshots stay skipped',async()=>{
  const f=fixture();await f.save();assert.equal((await f.c._tmRunDesktopAutoSaveTick()).reason,'idle-unchanged');assert.equal(f.calls.length,1);
  f.c.GM.fullNarrative+='后台已提交的完整记忆';f.adopt();assert.equal((await f.c._tmRunDesktopAutoSaveTick()).ok,true);
  assert.equal(f.calls.length,2);assert(f.calls[1].payload.data.gameState.fullNarrative.endsWith('后台已提交的完整记忆'));
});
test('ordinary rejection does not poison later retries or fall back to a second transport',async()=>{
  const f=fixture();f.setReply(()=>Promise.reject(Error('ordinary native rejection')));assert.equal((await f.save()).ok,false);
  assert.equal(f.calls.length,1);assert.equal(f.status().pending,false);f.setReply(()=>({success:true}));assert.equal((await f.save()).ok,true);
});
test('old shells keep the object path and are subject to the same wait and locking rules',async()=>{
  const f=fixture();delete f.api.autoSaveJson;f.setReply(()=>new Promise(()=>{}));const p=f.save();await tick();
  assert.equal(f.calls[0].payload.data.gameState.fullNarrative,f.c.GM.fullNarrative);f.fire(60000);assert.equal((await p).ok,false);
  assert.equal((await f.save()).ok,false);assert.equal(f.calls.length,1);
});
test('serialization failure sends nothing and does not leave a false native lock',async()=>{
  const f=fixture();f.c.lastCommittedSnapshot.GM.invalid=1n;assert.equal((await f.save()).ok,false);assert.equal(f.calls.length,0);
  assert.equal(f.status().pending,false);assert.equal(f.timers.size,0);delete f.c.lastCommittedSnapshot.GM.invalid;assert.equal((await f.save()).ok,true);
});
test('a late stale success cannot satisfy the current world close flush',async()=>{
  const f=fixture();let release;f.setReply(()=>new Promise(r=>release=r));const p=f.save();await tick();const close=f.c._tmAwaitDesktopAutoSaveForClose();
  f.c.GM={...f.c.GM,_timelineId:'different-world'};f.c._tmLoadGen++;release({success:true});await p;
  assert.equal((await close).ok,false);assert.equal(f.c._autoSaveLastDoneMs,0);
});
test('status is bounded and cannot leak or mutate payloads and session tokens',async()=>{
  const f=fixture();for(let i=0;i<15;i++)await f.save();const status=f.status();assert.equal(status.events.length,12);
  status.events[0].phase='tampered';assert.notEqual(f.status().events[0].phase,'tampered');
  const text=JSON.stringify(status);assert(!text.includes('中文存档'));assert(!text.includes('完整正文'));assert(!text.includes('autosave-session'));
});
test('world change during JSON encoding prevents the native call',async()=>{
  const f=fixture();Object.defineProperty(f.c.lastCommittedSnapshot.GM,'lateField',{enumerable:true,get(){f.c._tmLoadGen++;return 'fixture';}});
  assert.equal((await f.save()).ok,false);assert.equal(f.calls.length,0);assert.equal(f.status().pending,false);
});
test('the complete close coordinator refuses an unconfirmed native write',async()=>{
  const f=fixture();f.setReply(()=>new Promise(()=>{}));const p=f.save();await tick();f.fire(60000);await p;f.c._autoSaveDeferred=false;
  const out=await f.c._tmFlushBackgroundAutosavesForClose();assert.equal(out.ok,false);assert.equal(out.code,'desktop-autosave-unconfirmed');assert.equal(f.calls.length,1);
});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
