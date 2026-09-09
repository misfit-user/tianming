#!/usr/bin/env node
'use strict';
const assert=require('assert/strict');const {context,load,entries}=require('./lib-relief-channel-test');
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function setup(){const c=context();c.GM._edictTracker=[{id:'e1',content:'下拨河东银5000两赈济灾民，责成王明核实呈报。',status:'executing',turn:1,assignee:'王明',progressPercent:0}];return c;}
function response(c,extra={}){return JSON.stringify({reports:[Object.assign({oid:'e0',executionLevel:25,status:'partial',reason:'承办已核实首批灾户，其余待核。',chainEffect:'核实首批灾户',nextAdvice:'请循诏书催办。'},extra)]});}
function money(c){return JSON.stringify({guoku:c.GM.guoku,neitang:c.GM.neitang,orders:c.GM.transferOrders,minxin:c.GM.minxin});}
(async()=>{
await test('opening read-only relief records does not turn on any AI flag or add a request',()=>{
  const c=setup();const before=JSON.stringify(c.GM);entries(c);assert.equal(JSON.stringify(c.GM),before);
  assert.equal(c.TM.EdictOversight.shouldHandle(c.GM),false);
});
await test('existing oversight uses original command/officer context and a single capped request',async()=>{
  const c=setup();let calls=0;c.callAIMessages=async(ms,t,s,tier,o)=>{calls++;assert(ms[1].content.includes('责成王明'));assert(ms[1].content.includes('承办:王明'));assert.equal(o.maxRetries,1);assert.equal(o.id,'edict_oversight');return response(c);};
  const before=money(c);await c.TM.EdictOversight.run(c.GM);assert.equal(calls,1);assert.equal(money(c),before);
  assert.equal(entries(c)[0].progress,25);assert.equal(entries(c)[0].advice,'请循诏书催办。');
});
await test('different actual AI decisions update the existing tracker, not a second case model',async()=>{
  for(const [st,p] of [['stalled',5],['partial',35]]){const c=setup();const before=money(c);c.callAIMessages=async()=>response(c,{status:st,executionLevel:p});
    await c.TM.EdictOversight.run(c.GM);assert.equal(c.GM._edictTracker[0].status,st);assert.equal(entries(c)[0].progress,p);
    assert.equal(c.GM.currentIssues.length,0);assert.equal(money(c),before);}
});
await test('concurrent runs share one actual request and one history update',async()=>{
  const c=setup();let release,calls=0;c.callAIMessages=()=>{calls++;return new Promise(r=>release=r);};
  const a=c.TM.EdictOversight.run(c.GM),b=c.TM.EdictOversight.run(c.GM);assert.equal(a,b);release(response(c));await a;
  assert.equal(calls,1);assert.equal(c.GM._edictTracker[0]._chainEffects.length,1);assert.equal(c.GM._edictEfficacyHistory.length,1);
});
await test('same-turn world or identity changes reject delayed successful responses',async()=>{
  for(const change of ['GM','P','generation','timeline']){const c=setup();let release;c.callAIMessages=()=>new Promise(r=>release=r);const old=c.GM,p=c.TM.EdictOversight.run(old);
    if(change==='GM')c.GM=structuredClone(old);if(change==='P')c.P=structuredClone(c.P);if(change==='generation')c._tmLoadGen++;if(change==='timeline')c.GM._timelineId='fork';
    const bytes=JSON.stringify(old);release(response(c));assert.equal((await p).stale,true);assert.equal(JSON.stringify(old),bytes);}
});
await test('an old rejected network request cannot write failure state into another world',async()=>{
  const c=setup();let reject;c.callAIMessages=()=>new Promise((r,j)=>reject=j);const old=c.GM,p=c.TM.EdictOversight.run(old);c.GM=structuredClone(old);
  const bytes=JSON.stringify(old);reject(Error('isolated rejection'));assert.equal((await p).stale,true);assert.equal(JSON.stringify(old),bytes);
});
await test('source edit, reassignment or reorder cannot redirect an in-flight report',async()=>{
  for(const change of ['content','assignee','replace']){const c=setup();let release;c.callAIMessages=()=>new Promise(r=>release=r);const p=c.TM.EdictOversight.run(c.GM);
    if(change==='replace')c.GM._edictTracker[0]={id:'e1',content:'另外一道赈务诏令',status:'pending',progressPercent:0};else c.GM._edictTracker[0][change]='新的旨意或承办人';
    const before=JSON.stringify(c.GM._edictTracker);release(response(c));const result=await p;assert.equal(result.updated,0);assert.equal(JSON.stringify(c.GM._edictTracker),before);}
});
await test('unknown and repeated response slots do not add arbitrary or repeated effects',async()=>{
  const c=setup();c.callAIMessages=async()=>JSON.stringify({reports:[{oid:'wrong',executionLevel:100},{oid:'e0',status:'partial',executionLevel:20,chainEffect:'首批核户'}, {oid:'e0',status:'done',executionLevel:100,chainEffect:'重复'}]});
  await c.TM.EdictOversight.run(c.GM);assert.equal(c.GM._edictTracker[0].progressPercent,20);assert.equal(c.GM._edictTracker[0]._chainEffects.length,1);
});
await test('network/parse failures preserve source commands and recover using the existing retry path',async()=>{
  for(const bad of ['network','parse']){const c=setup();const before=JSON.stringify(c.GM._edictTracker),funds=money(c);
    c.callAIMessages=async()=>{if(bad==='network')throw Error('test network');return '{}';};
    assert.equal((await c.TM.EdictOversight.run(c.GM)).failed,true);assert.equal(JSON.stringify(c.GM._edictTracker),before);assert.equal(money(c),funds);
    c.callAIMessages=async()=>response(c);assert.equal((await c.TM.EdictOversight.run(c.GM)).ok,true);assert.equal(entries(c)[0].progress,25);}
});
await test('cancelled work never commits its late response',async()=>{
  const c=setup(),ac=new AbortController();let release;c.callAIMessages=()=>new Promise(r=>release=r);
  const p=c.TM.EdictOversight.run(c.GM,{signal:ac.signal});ac.abort();const before=JSON.stringify(c.GM);release(response(c));assert.equal((await p).stale,true);assert.equal(JSON.stringify(c.GM),before);
});
await test('linked remote edicts require every actual letter to arrive, including recheck at commit',async()=>{
  const c=setup();c.GM._edictTracker[0]._letterIds=['a','b'];c.GM._edictTracker[0].status='pending_delivery';
  c.GM.letters=[{id:'a',status:'delivered'},{id:'b',status:'traveling'}];assert.equal(c.TM.EdictOversight.activeEdicts(c.GM).length,0);
  c.GM.letters[1].status='delivered';assert.equal(c.TM.EdictOversight.activeEdicts(c.GM).length,1);
  let release;c.callAIMessages=()=>new Promise(r=>release=r);const p=c.TM.EdictOversight.run(c.GM);c.GM.letters[1].status='blocked';release(response(c));
  assert.equal((await p).updated,0);assert.equal(c.GM._edictTracker[0].progressPercent,0);
});
await test('retired standalone commitments cannot create automatic legacy rewards',()=>{
  const c=setup();load(c,'tm-minxin-commitment-tracker.js');
  c.GM.currentIssues=[{id:'old-case',relief:{version:1,status:'completed'}}];
  c.GM._minxinCommitments={items:[{id:'old-promise',linkedIssue:'old-case',status:'active',turn:1,createdTurn:1,history:[],measures:['relief']}],settlements:[],stats:{}};
  c.GM.turn=10;c.TM.MinxinCommitmentTracker.tick(c.GM,{turn:10});assert.equal(c.GM._minxinLedger,undefined);assert.equal(c.GM._minxinCommitments.items[0].status,'active');
});
await test('the existing 15-item cap remains; no unbounded per-relief AI request loop',()=>{
  const c=setup();c.GM._edictTracker=Array.from({length:70},(_,i)=>({id:'e'+i,content:'赈济灾民',status:'pending',turn:1}));
  assert.equal(c.TM.EdictOversight.activeEdicts(c.GM).length,15);
});
console.log('relief-adjudication: '+passed+' PASS / 0 FAIL');
})().catch(e=>{console.error(e);process.exitCode=1;});
