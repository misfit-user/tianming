'use strict';
const assert=require('assert/strict'),{transport,okay,load,pause}=require('./lib-turn-reliability');
const watchdog=setTimeout(()=>{console.error("Unsettled simulated request; test failed");process.exit(1);},15000);
const tests=[],test=(name,run)=>tests.push({name,run});
function clock(c){let now=1000000,seq=0;const timers=new Map();c.Date={now:()=>now};c.setTimeout=(fn,ms)=>{const id=++seq;timers.set(id,{fn,at:now+Number(ms)});return id;};c.clearTimeout=id=>timers.delete(id);
 const flush=async()=>{for(let i=0;i<30;i++)await Promise.resolve();};
 async function advance(ms){await flush();const end=now+ms;let loops=0;while(true){const next=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;if(++loops>10000)throw Error('Timer loop');now=next[1].at;timers.delete(next[0]);next[1].fn();await flush();}now=end;await flush();}
 return {advance,flush,timers,wait:(ms,value)=>new Promise(r=>c.setTimeout(()=>r(value),ms))};}
function toolsSetup(c){c._buildAIUrl=()=> 'https://fixture.invalid/v1/chat/completions';c._aiEffectiveTierIsSecondary=()=>false;}
const completed={choices:[{message:{content:'完整正文、全部状态提案与人物因果。'},finish_reason:'stop'}]};
test('10s headers + 170s full JSON succeeds once despite the old 150s deadline',async()=>{
 const f=transport(),t=clock(f.c);let sent=0,settled=false;try{
  f.c.fetch=async()=>{sent++;return t.wait(10000,{...okay({}),json:()=>t.wait(160000,completed)});};
  const p=f.request({timeoutMs:150000}).then(x=>{settled=true;return x;});await t.advance(150000);assert.equal(settled,false);assert.equal(f.c._aiWaitSnapshot()[0].phase,'body');
  await t.advance(20000);assert.equal((await p).choices[0].message.content,completed.choices[0].message.content);assert.equal(sent,1);assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('an explicit total deadline still stops body reading',async()=>{
 const f=transport(),t=clock(f.c);try{
  f.c.fetch=async()=>({...okay({}),json:()=>new Promise(()=>{})});const p=f.request({timeoutMs:150000,totalResponseTimeoutMs:150000});const check=assert.rejects(p,e=>e.code==='AI_REQUEST_DEADLINE');
  await t.advance(150000);await check;assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('first-response timeout remains active before successful headers',async()=>{
 const f=transport(),t=clock(f.c);let sent=0;try{
  f.c.fetch=()=>{sent++;return new Promise(()=>{});};const p=f.request({timeoutMs:150000});const check=assert.rejects(p,e=>e.code==='AI_TIMEOUT'&&e.phase==='headers');await t.advance(150000);await check;assert.equal(sent,1);
 }finally{f.dispose();}
});
test('default shared retry budget does not expire during valid model generation',()=>{
 const f=transport();try{const b=f.c._aiCreateRetryBudget({maxAttempts:2});assert.equal(b.deadlineAt,Infinity);f.c._aiClaimRetryAttempt(b);f.c._aiClaimRetryAttempt(b);assert.throws(()=>f.c._aiClaimRetryAttempt(b),e=>e.code==='AI_RETRY_BUDGET');}finally{f.dispose();}
});
test('cancellation after successful headers interrupts wait without replaying',async()=>{
 const f=transport(),t=clock(f.c),ctrl=new AbortController();let sent=0;try{
  f.c.fetch=async()=>{sent++;return {...okay({}),json:()=>new Promise(()=>{})};};const p=f.request({maxRetries:3},ctrl.signal),check=assert.rejects(p,e=>e.code==='AI_ABORTED');await t.flush();ctrl.abort();await check;assert.equal(sent,1);assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('manual diagnostic cancel also never launches an automatic retry',async()=>{
 const f=transport(),t=clock(f.c);let sent=0;try{
  f.c.fetch=async()=>{sent++;return {...okay({}),json:()=>new Promise(()=>{})};};const p=f.request({maxRetries:3}),check=assert.rejects(p,e=>e.code==='AI_ABORTED');await t.flush();f.c._aiCancelPendingWaits();await check;assert.equal(sent,1);assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('changing a loaded world terminates indefinite body waiting before it can publish',async()=>{
 const f=transport(),t=clock(f.c);try{
  f.c.fetch=async()=>({...okay({}),json:()=>new Promise(()=>{})});const p=f.request(),check=assert.rejects(p,e=>e.code==='AI_STALE_WORLD');await t.flush();f.c.GM={turn:2};await t.advance(1000);await check;assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('finalized automatic-output streaming succeeds with the exact request body',async()=>{
 const f=transport(),t=clock(f.c);let wire,sent=0;try{
  toolsSetup(f.c);f.c.fetch=async(_u,o)=>{sent++;wire=JSON.parse(o.body);return {...okay({}),headers:{get:()=> 'application/json'},json:()=>t.wait(170000,completed)};};
  const body={model:'fixture',messages:[{role:'user',content:'全部推演和完整正文'}]},before=JSON.stringify(body);const p=f.c.callAIBodyStream(body,{timeoutMs:150000});await t.advance(170000);assert.equal(await p,completed.choices[0].message.content);assert.equal(sent,1);delete wire.stream;assert.equal(JSON.stringify(wire),before);assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('stream with a silent 170-second interval is not aborted by the old outer deadline',async()=>{
 const f=transport(),t=clock(f.c);let index=0;try{
  toolsSetup(f.c);f.c.fetch=async()=>({ok:true,status:200,headers:{get:()=> 'text/event-stream'},body:{getReader:()=>({read:()=>index++===0?t.wait(170000,{done:false,value:new TextEncoder().encode('data: {"choices":[{"delta":{"content":"完整长正文"},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n')}):Promise.resolve({done:true}),cancel:async()=>{},releaseLock(){}})}});
  const p=f.c.callAIBodyStream({model:'fixture',messages:[],max_tokens:16000},{timeoutMs:150000});await t.advance(170000);assert.equal(await p,'完整长正文');assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('native Agent tool response may exceed the first-response interval without changing arguments',async()=>{
 const f=transport(),t=clock(f.c);let sent=0;try{
  toolsSetup(f.c);f.c.fetch=async()=>{sent++;return {...okay({}),json:()=>t.wait(170000,{choices:[{message:{tool_calls:[{function:{name:'inspect',arguments:'{"deep":true}'}}]},finish_reason:'tool_calls'}]})};};
  const p=f.c.callAIWithTools('完整推演',[{name:'inspect',parameters:{type:'object'}}],{timeoutMs:150000});await t.advance(170000);const r=await p;assert.equal(r.toolCalls[0].input.deep,true);assert.equal(sent,1);assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('Android buffered transport uses an unbounded read only for inference, retaining connection checks',async()=>{
 const f=transport(),t=clock(f.c);let options,sent=0;try{
  f.c.Capacitor={isNativePlatform:()=>true,Plugins:{CapacitorHttp:{request:o=>{sent++;options=o;return t.wait(170000,{status:200,headers:{'content-type':'application/json'},data:completed});}}}};
  const p=f.request({timeoutMs:150000});await t.advance(170000);assert.equal((await p).choices[0].message.content,completed.choices[0].message.content);assert.equal(options.readTimeout,0);assert(options.connectTimeout>0);assert.equal(sent,1);assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('Android explicit maximum still aborts locally, with no duplicate POST',async()=>{
 const f=transport(),t=clock(f.c);let sent=0,options;try{
  f.c.Capacitor={isNativePlatform:()=>true,Plugins:{CapacitorHttp:{request:o=>{sent++;options=o;return new Promise(()=>{});}}}};
  const p=f.request({timeoutMs:100000,totalResponseTimeoutMs:150000,maxRetries:3}),check=assert.rejects(p,e=>e.code==='AI_REQUEST_DEADLINE'||e.code==='AI_TIMEOUT');await t.advance(150000);await check;assert.equal(sent,1);assert.equal(options.readTimeout,150000);assert.equal(t.timers.size,0);
 }finally{f.dispose();}
});
test('secondary API waiting preferences remain separate from primary preferences',async()=>{
 const f=transport(),t=clock(f.c);try{
  f.c.P.ai.totalResponseTimeoutMs=10;f.c.P.ai.secondary={key:'fixture-secondary',totalResponseTimeoutMs:0};f.c.fetch=async()=>({...okay({}),json:()=>t.wait(170000,completed)});
  const p=f.request({tier:'secondary',timeoutMs:150000});await t.advance(170000);assert.equal((await p).choices[0].message.content,completed.choices[0].message.content);
 }finally{f.dispose();}
});
test('invalid explicit limits fail before sending and never silently choose a short deadline',async()=>{
 for(const n of [-1,Infinity,'bad']){const f=transport();let sent=0;try{f.c.fetch=async()=>{sent++;return okay(completed);};await assert.rejects(f.request({totalResponseTimeoutMs:n}),e=>e.code==='AI_WAIT_CONFIG');assert.equal(sent,0);}finally{f.dispose();}}
});
test('real error responses are not treated as successful-header indefinite waiting',async()=>{
 const f=transport(),t=clock(f.c);try{f.c.fetch=async()=>({ok:false,status:401,text:()=>new Promise(()=>{})});const p=f.request({timeoutMs:150000}),check=assert.rejects(p);await t.advance(150000);await check;assert.equal(t.timers.size,0);}finally{f.dispose();}
});
test('queued work gets its first-response allowance only after actual sending',async()=>{
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
(async()=>{let pass=0,fail=0;for(const x of tests){try{await x.run();pass++;console.log('PASS '+x.name);}catch(e){fail++;console.error('FAIL '+x.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));clearTimeout(watchdog);if(fail)process.exitCode=1;})();
