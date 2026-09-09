#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const {fresh,create,view,act,tick}=require('./smoke-relief-governance');
let passed=0;
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function setup(){const c=fresh();for(const f of ['tm-edict-oversight.js','tm-minxin-commitment-tracker.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),c,{filename:f});return c;}
function reply(c,extra={}){const a=c.TM.EdictOversight.activeEdicts(c.GM)[0];return JSON.stringify({reports:[{oid:a.oid,executionLevel:100,status:'done',relief:Object.assign({caseId:a.relief.issueId,revision:a.relief.revision,action:'wait',amount:0,minxinDelta:0,reason:'承办人要求核清灾户，尚不具备发放条件。'},extra)}]});}
(async()=>{
await test('existing oversight batch includes true cash/officer context and no extra per-case call',async()=>{
  const c=setup(),id=create(c);act(c,id,'fund',{amount:20000});tick(c);let calls=0;
  c.callAIMessages=async(messages,maxTokens,signal,tier,opts)=>{calls++;assert(messages[1].content.includes('"funded":20000'));assert(messages[1].content.includes('"id":"c1"'));assert(messages[1].content.includes('不是固定随机成功率'));assert.equal(opts.maxRetries,1);return reply(c);};
  assert.equal(c.TM.EdictOversight.shouldHandle(c.GM),true);
  assert.equal((await c.TM.EdictOversight.run(c.GM)).ok,true);assert.equal(calls,1);assert.equal(view(c,id).disbursed,0);
  assert.notEqual(view(c,id).status,'completed'); // generic 100%/done cannot bypass the case owner
});
await test('different structured AI decisions really change execution, not only prose',async()=>{
  const a=setup(),b=setup(),ia=create(a),ib=create(b);
  for(const[c,id]of[[a,ia],[b,ib]]){act(c,id,'fund',{amount:20000});tick(c);}
  a.callAIMessages=async()=>reply(a,{action:'blocked',reason:'承办呈报与既有拨付记录未能对应，需核对。'});
  b.callAIMessages=async()=>reply(b,{action:'disburse',amount:5000,reason:'承办人先行救济已核实灾户，其余待核。'});
  await a.TM.EdictOversight.run(a.GM);await b.TM.EdictOversight.run(b.GM);
  assert.equal(view(a,ia).status,'blocked');assert.equal(view(b,ib).disbursed,5000);
  assert.equal(a.GM.guoku.money,b.GM.guoku.money);
});
await test('concurrent oversight calls share the actual request and commit once',async()=>{
  const c=setup(),id=create(c);act(c,id,'fund',{amount:20000});tick(c);let release,calls=0;
  const response=reply(c,{action:'complete',amount:20000,minxinDelta:2});
  c.callAIMessages=()=>{calls++;return new Promise(r=>release=r);};
  const a=c.TM.EdictOversight.run(c.GM),b=c.TM.EdictOversight.run(c.GM);assert.equal(a,b);release(response);await a;
  assert.equal(calls,1);assert.equal(view(c,id).disbursed,20000);assert.equal(c.GM._minxinLedger.items.length,1);
});
await test('same-turn world switch and load generation invalidate delayed results and errors',async()=>{
  for(const change of ['gm','p','generation','timeline']){
    const c=setup(),id=create(c);act(c,id,'fund',{amount:20000});tick(c);let release;
    const response=reply(c,{action:'complete',amount:20000,minxinDelta:2}),old=c.GM;
    c.callAIMessages=()=>new Promise(r=>release=r);const p=c.TM.EdictOversight.run(old);
    if(change==='gm')c.GM=structuredClone(old);if(change==='p')c.P=structuredClone(c.P);if(change==='generation')c._tmLoadGen++;if(change==='timeline')c.GM._timelineId='fork';
    release(response);assert.equal((await p).stale,true);assert.equal(c.TM.ReliefGovernance.view(old,id).disbursed,0);assert.equal(c.GM._minxinLedger,undefined);
  }
});
await test('in-flight personnel change cannot be overwritten by old assessment',async()=>{
  const c=setup(),id=create(c);act(c,id,'fund',{amount:20000});tick(c);let release;
  const response=reply(c,{action:'complete',amount:20000,minxinDelta:2});c.callAIMessages=()=>new Promise(r=>release=r);
  const p=c.TM.EdictOversight.run(c.GM);act(c,id,'reassign',{assigneeId:'c2'});release(response);await p;
  assert.equal(view(c,id).disbursed,0);assert.equal(view(c,id).assigneeId,'c2');assert.equal(c.GM._minxinLedger,undefined);
});
await test('transport/parse/schema failures remain technical and recover on a later run',async()=>{
  for(const kind of ['transport','parse','identity','amount']){
    const c=setup(),id=create(c);act(c,id,'fund',{amount:20000});tick(c);
    c.callAIMessages=async()=>{if(kind==='transport')throw Error('isolated network failure');if(kind==='parse')return '{}';return reply(c,kind==='identity'?{caseId:'another-case'}:{action:'disburse',amount:20001});};
    await c.TM.EdictOversight.run(c.GM);assert.equal(view(c,id).disbursed,0);assert.equal(view(c,id).status,'executing');assert(view(c,id).lastTechnicalError);
    c.callAIMessages=async()=>reply(c,{action:'complete',amount:20000,minxinDelta:1});await c.TM.EdictOversight.run(c.GM);
    assert.equal(view(c,id).status,'completed');assert.equal(view(c,id).lastTechnicalError,'');
  }
});
await test('AI cannot settle for an alive:false officer; reassignment permits later execution',async()=>{
  const c=setup(),id=create(c);act(c,id,'fund',{amount:20000});tick(c);c.GM.chars[0].alive=false;
  c.callAIMessages=async()=>reply(c,{action:'complete',amount:20000,minxinDelta:1});await c.TM.EdictOversight.run(c.GM);
  assert.equal(view(c,id).disbursed,0);act(c,id,'reassign',{assigneeId:'c2'});await c.TM.EdictOversight.run(c.GM);assert.equal(view(c,id).status,'completed');
});
await test('explicitly linked commitment mirrors final outcome without another minxin signal',async()=>{
  const c=setup(),id=create(c);c.GM._minxinCommitments={items:[{id:'promise-1',linkedIssue:id,status:'active',turn:1,createdTurn:1,history:[],measures:['relief']}],settlements:[],stats:{}};
  act(c,id,'fund',{amount:20000});tick(c);c.TM.MinxinCommitmentTracker.tick(c.GM,{turn:c.GM.turn});assert.equal(c.GM._minxinLedger,undefined);
  c.callAIMessages=async()=>reply(c,{action:'complete',amount:20000,minxinDelta:2});await c.TM.EdictOversight.run(c.GM);tick(c);
  c.TM.MinxinCommitmentTracker.tick(c.GM,{turn:c.GM.turn});assert.equal(c.GM._minxinLedger.items.length,1);assert.equal(c.GM._minxinCommitments.items[0].status,'resolved');
});
await test('shrinking an unfunded remainder preserves receipts and allows honest completion',async()=>{
  const c=setup(),id=create(c,{source:'neitang',amount:40000});act(c,id,'fund',{amount:30000});
  assert.equal(act(c,id,'resize',{amount:20000}).ok,false);assert.equal(act(c,id,'resize',{amount:30000}).ok,true);tick(c);
  c.callAIMessages=async()=>reply(c,{action:'complete',amount:30000,minxinDelta:1});await c.TM.EdictOversight.run(c.GM);assert.equal(view(c,id).disbursed,30000);
});
await test('AI may adjudicate overdue loss of trust, but never automatic or unbounded punishment',async()=>{
  const c=setup(),id=create(c);tick(c,90);
  assert.equal(c.GM._minxinLedger,undefined); // passage of time alone does not pick a political result
  c.callAIMessages=async()=>reply(c,{action:'blocked',minxinDelta:-3,reason:'已过承诺期限而未筹款，灾民对朝廷承诺失去信任。'});
  await c.TM.EdictOversight.run(c.GM);assert.equal(c.GM.adminHierarchy.realm.divisions[0].minxin,47);
  tick(c);await c.TM.EdictOversight.run(c.GM);assert.equal(c.GM.adminHierarchy.realm.divisions[0].minxin,47); // exceeds remaining per-case penalty allowance
  c.callAIMessages=async()=>reply(c,{action:'wait',minxinDelta:0,reason:'等待玩家重新安排，不能反复记同一失信损失。'});
  await c.TM.EdictOversight.run(c.GM);assert.equal(c.GM._minxinLedger.items.length,1);
});
await test('milestone rewards require actual disbursement and share one per-case allowance',async()=>{
  const c=setup(),id=create(c);act(c,id,'fund',{amount:20000});tick(c);
  c.callAIMessages=async()=>reply(c,{action:'disburse',amount:10000,minxinDelta:2,reason:'首批赈银发放得到灾户认可。'});
  await c.TM.EdictOversight.run(c.GM);assert.equal(view(c,id).disbursed,10000);
  tick(c);c.callAIMessages=async()=>reply(c,{action:'complete',amount:10000,minxinDelta:4,reason:'全部发放。'});
  await c.TM.EdictOversight.run(c.GM);assert.equal(view(c,id).disbursed,10000); // 2 + 4 exceeds 5 total
  c.callAIMessages=async()=>reply(c,{action:'complete',amount:10000,minxinDelta:3,reason:'剩余灾户得到赈济，结案。'});
  await c.TM.EdictOversight.run(c.GM);assert.equal(view(c,id).status,'completed');assert.equal(view(c,id).rewardApplied,5);
  assert.equal(new Set(c.GM._minxinLedger.items.map(x=>x.id)).size,2);
});
await test('player edits and background adjudication cannot enter an active world transaction',async()=>{
  const c=setup(),id=create(c);act(c,id,'fund',{amount:20000});tick(c);const before=JSON.stringify(c.GM);
  c.isWorldTransactionActive=()=>true;
  assert.equal(act(c,id,'cancel').ok,false);assert.equal(c.TM.ReliefGovernance.setEnabled(c.GM,false).ok,false);
  const snapshot=c.TM.ReliefGovernance.capture(c.GM,id);
  assert.equal(c.TM.ReliefGovernance.applyAssessment(c.GM,snapshot,{action:'complete',amount:20000,minxinDelta:1,reason:'执行完毕'}).ok,false);
  assert.equal(JSON.stringify(c.GM),before);
});
console.log('relief-adjudication: '+passed+' PASS / 0 FAIL');
})().catch(e=>{console.error(e);process.exitCode=1;});
