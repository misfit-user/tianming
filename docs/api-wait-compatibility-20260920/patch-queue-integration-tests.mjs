import {edit} from './patch-utils.mjs';
edit('web/scripts/smoke-api-wait-compatibility.js',(s,r)=>r(s,'(async()=>{',`test('queued work gets its first-response allowance only after actual sending',async()=>{
 const f=transport(),t=clock(f.c);let sent=0;try{
  f.c.fetch=async()=>{sent++;return {...okay({}),json:()=>sent===1?t.wait(170000,completed):Promise.resolve(completed)};};
  const first=f.request({timeoutMs:150000}),second=f.request({timeoutMs:150000});await t.advance(150000);assert.equal(sent,1);await t.advance(20001);
  assert.equal((await first).choices[0].message.content,completed.choices[0].message.content);assert.equal((await second).choices[0].message.content,completed.choices[0].message.content);assert.equal(sent,2);assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('an already-received auth error with stalled error text cannot trigger repeat POSTs',async()=>{
 const f=transport(),t=clock(f.c);let sent=0;try{
  f.c.fetch=async()=>{sent++;return {ok:false,status:401,text:()=>new Promise(()=>{})};};const p=f.request({timeoutMs:100,maxRetries:3}),check=assert.rejects(p,e=>e.status===401);await t.advance(100);await check;assert.equal(sent,1);
 }finally{f.dispose();}
});
test('explicit shared tool deadline remains an actual limit on a slow response',async()=>{
 const f=transport(),t=clock(f.c);try{
  toolsSetup(f.c);f.c.fetch=async()=>({...okay({}),json:()=>new Promise(()=>{})});const budget=f.c._aiCreateRetryBudget({maxAttempts:2,totalTimeoutMs:100});
  const p=f.c.callAIWithTools('test',[{name:'inspect',parameters:{type:'object'}}],{timeoutMs:300,retryBudget:budget});await t.advance(100);const r=await p;assert(r.error);assert.equal(r.toolCalls.length,0);assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
(async()=>{`));
