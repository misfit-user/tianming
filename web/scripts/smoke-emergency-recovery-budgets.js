'use strict';
const assert=require('assert/strict');
const {fixture,agentReply,rawParse,pause,run}=require('./lib-emergency-recovery');
const tests=[],test=(name,fn)=>tests.push({name,fn});
function spec(){return {id:'sc25c',kind:'test',raw:'原文证据',normalExhausted:true,safeBoundary:true,error:{code:'AI_PARSE_INVALID'},adapter:{preview:p=>({ok:true,value:p})}};}
test('user budgets above every former ceiling remain unchanged',()=>{
 const f=fixture({maxCalls:100,maxRepairs:100,maxSteps:1000,maxTokens:2000000,timeoutMs:90000000});try{const c=f.c.TM.EmergencyRecovery.config();for(const [k,v]of Object.entries({maxCalls:100,maxRepairs:100,maxSteps:1000,maxTokens:2000000,timeoutMs:90000000}))assert.equal(c[k],v);}finally{f.dispose();}
});

test('fixed review has an independent unlimited default while an explicit finite budget is preserved',()=>{
 const f=fixture({maxTokens:48000});try{const R=f.c.TM.EmergencyRecovery;assert.equal(R.config().reviewMaxTokens,0);assert.equal(R.config({reviewMaxTokens:250000}).reviewMaxTokens,250000);assert.equal(R.config().maxTokens,48000);
 for(const value of ['',-1,1.5,Infinity,true,null,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>R.config({reviewMaxTokens:value}),e=>e.code==='RECOVERY_CONFIG'&&e.field==='reviewMaxTokens');
 }finally{f.dispose();}
});
test('configured 25 calls run past the old 20-call ceiling and stop exactly at 25',async()=>{
 const f=fixture({maxCalls:25,maxTokens:2000000});try{let n=0;f.c.callAI=async()=>{n++;return '{}';};const r=await f.c.TM.EmergencyRecovery.recover(spec());assert.equal(r.reason,'RECOVERY_BUDGET');assert.equal(n,25);assert.equal(f.events.at(-1).calls,25);}finally{f.dispose();}
});
test('malformed budgets identify the editable field and never spend model calls',async()=>{
 for(const value of ['',0,-1,1.5,Infinity,NaN,true,null,Number.MAX_SAFE_INTEGER+1]){const f=fixture({maxCalls:value});try{let n=0;f.c.callAI=async()=>n++;const r=await f.c.TM.EmergencyRecovery.recover(spec());assert.equal(r.reason,'RECOVERY_CONFIG');assert.equal(r.error.field,'maxCalls');assert.match(r.error.message,/正整数/);assert.equal(n,0);}finally{f.dispose();}}
});
test('invalid saved recovery config cannot prevent ordinary successful parsing',async()=>{
 const f=fixture({maxCalls:'bad'});try{let normal=0;f.c.callAI=async()=>{throw Error('unexpected extra call')};const r=await f.c.TM.RecoveryRuntime.parse('{"events":[]}',{},'正常',{id:'sc25c'},async raw=>{normal++;return rawParse(raw)});assert(r.parsed);assert.equal(normal,1);assert.equal(f.c.TM.EmergencyRecovery.draftConfig().maxCalls,'bad');}finally{f.dispose();}
});
test('recovery uses the shared token estimator and exposes the cost and budget',async()=>{
 const f=fixture({maxTokens:10000});try{let estimates=0;f.c.estimateTokens=()=>{estimates++;return 17};f.c.callAI=async p=>agentReply(p,{});const r=await f.c.TM.EmergencyRecovery.recover(spec());assert(r.ok);assert.equal(estimates,3);const last=f.events.at(-1);assert.equal(last.estimatedTokens,3*(3072+17));assert.equal(last.budget.maxTokens,10000);}finally{f.dispose();}
});
test('token exhaustion names the requested limit and sends no partial prompt',async()=>{
 const f=fixture({maxTokens:5000});try{let calls=0;f.c.estimateTokens=()=>3000;f.c.callAI=async()=>calls++;const r=await f.c.TM.EmergencyRecovery.recover(spec());assert.equal(r.reason,'RECOVERY_BUDGET');assert.match(r.error.message,/5000/);assert.match(r.error.message,/6072/);assert.equal(calls,0);}finally{f.dispose();}
});
test('a wait above the JavaScript timer range is not converted into a 1ms timeout',async()=>{
 const f=fixture({timeoutMs:3000000000});try{f.c.callAI=async p=>{await pause(4);return agentReply(p,{})};const r=await f.c.TM.EmergencyRecovery.recover(spec());assert(r.ok,r.reason);}finally{f.dispose();}
});
run(tests);
