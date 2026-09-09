#!/usr/bin/env node
'use strict';
// Supersedes the withdrawn standalone-command tests with actual channel/read-only contracts.
const assert=require('assert/strict');
const {context,prep,memorial,hongyan,court,tinyi,entries}=require('./lib-relief-channel-test');
let passed=0;async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
function unchanged(c,fn){const before=JSON.stringify(c.GM);const r=fn();assert.equal(JSON.stringify(c.GM),before);return r;}
(async()=>{
await test('no standalone creation, payment, reassignment or adjudication API remains',()=>{
  const c=context();for(const k of ['create','act','applyAssessment','setEnabled','tick'])assert.equal(c.TM.ReliefGovernance[k],undefined);
  assert.equal(c.FiscalEngine.commitReliefPayment,undefined);assert.equal(c.FiscalEngine.reliefBalance,undefined);
});
await test('draft text cannot create a case, edict, payment or minxin change by viewing',()=>{
  const c=context();c.GM.edicts=[{text:'赈济河东',status:'draft'}];c.elements['edict-eco']={value:'下拨河东银5000两赈济'};
  assert.equal(unchanged(c,()=>entries(c)).length,0);assert.equal(c.GM.currentIssues.length,0);
});
await test('actual turn input collection records normal edicts once; list does not execute them',()=>{
  const c=context();prep(c);c.elements['edict-eco']={value:'下拨河东银5000两赈济灾民'};
  c._endTurn_collectInput();c._endTurn_collectInput();
  assert.equal(c.GM._edictTracker.length,1);const list=unchanged(c,()=>entries(c));
  assert.equal(list.length,1);assert.equal(list[0].channel,'edict');assert.equal(c.GM.guoku.money,100000);assert.equal(c.GM.transferOrders.length,0);
});
await test('promulgated full edicts are visible, drafts remain out of issued records',()=>{
  const c=context();c.GM.edicts=[{id:'d1',text:'赈济河东灾民',status:'draft'},{id:'d2',text:'赈济河东灾民',status:'promulgated',turn:2}];
  const e=unchanged(c,()=>entries(c));assert.equal(e.length,1);assert.equal(e[0].sourceId,'d2');assert(e[0].text.includes('赈济'));
});
await test('actual memorial approve/commit and later reject preserve original player timing',()=>{
  const c=context();memorial(c);c.GM.memorials=[{id:'m1',from:'王明',content:'请赈济河东灾民',turn:2,status:'pending'}];
  c.elements['mem-reply-0']={value:'准奏，核清灾户'};c._approveMemorial(0);
  assert(entries(c)[0].status.includes('待过回合提交'));assert.equal(c.GM.guoku.money,100000);
  c._commitMemorialDecisions();assert(entries(c)[0].status.includes('已提交，非已办成'));
  const stress=c.GM.chars[0].stress;c._commitMemorialDecisions();assert.equal(c.GM.chars[0].stress,stress);
  c._rejectMemorial(0);assert(entries(c)[0].status.includes('驳回'));assert.equal(c.GM.memorials[0]._commitApplied,false);
});
await test('actual annotated memorial keeps the player reply; no forced approval or second command',()=>{
  const c=context();memorial(c);c.GM.memorials=[{id:'m1',from:'王明',content:'赈济河东',turn:2,status:'pending'}];
  c.elements['mem-reply-0']={value:'暂缓拨银，先查灾户，再奏。'};c._annotateMemorial(0);
  const e=unchanged(c,()=>entries(c))[0];assert.equal(e.reply,'暂缓拨银，先查灾户，再奏。');assert(e.status.includes('朱批'));assert.equal(c.GM._edictTracker.length,0);
});
await test('Hongyan traveling/blocked/missing identity cannot become completed by list or oversight',()=>{
  const c=context();c.GM.letters=[{id:'l1',status:'traveling'}];c.GM._edictTracker=[{letterId:'l1',source:'letter',content:'赈济河东',status:'pending'}];
  assert.equal(entries(c)[0].status,'驿传在途');assert.equal(c.TM.EdictOversight.activeEdicts(c.GM).length,0);
  c.GM.letters[0].status='blocked';assert.equal(entries(c)[0].status,'流转受阻');assert.equal(c.TM.EdictOversight.activeEdicts(c.GM).length,0);
  c.GM.letters.push({id:'l1',status:'delivered'});assert(entries(c)[0].status.includes('歧义'));assert.equal(c.TM.EdictOversight.activeEdicts(c.GM).length,0);
});
await test('actual formal-letter delivery pays only through original parser and canonical fiscal ledger',()=>{
  const c=context();hongyan(c);const letter={id:'l1',to:'王明',content:'诏令：下拨河东银5000两赈济水灾。',letterType:'formal_edict',status:'delivered'};
  c.GM.letters.push(letter);c.GM._edictTracker.push({letterId:'l1',source:'letter',content:letter.content,status:'pending',turn:2});
  const r=c._ltApplyFormalPolicyOnDelivery(letter);assert.equal(r.ok,true,JSON.stringify(r));
  assert.equal(c.GM.guoku.money,95000);assert.equal(c.GM.guoku.balance,95000);assert.equal(c.GM.guoku.ledgers.money.stock,95000);
  c._ltApplyFormalPolicyOnDelivery(letter);assert.equal(c.GM.transferOrders.length,1);assert.equal(c.GM.guoku.money,95000);
  const e=unchanged(c,()=>entries(c))[0];assert.equal(e.channel,'letter');assert.equal(e.transfer.amount,5000);assert.equal(e.transfer.delivered,0);
});
await test('ordinary private letters do not acquire a financial execution route',()=>{
  const c=context();hongyan(c);const l={id:'private',content:'下拨河东银5000两赈济',letterType:'personal',status:'delivered'};
  assert.equal(c._ltApplyFormalPolicyOnDelivery(l),null);assert.equal(c.GM.transferOrders.length,0);assert.equal(c.GM.guoku.money,100000);
});
await test('actual court adoption uses the old policy bridge; reading never adds another debit',()=>{
  const c=context();court(c);const item={title:'赈济河东',content:'下拨河东银5000两赈济水灾。',presenter:'王明',dept:'有司'};
  c._cc3_writeActionToGM('approve',item,null,'准奏');
  assert.equal(c.GM._edictTracker.length,1);assert.equal(c.GM.guoku.money,95000);assert.equal(c.GM.transferOrders.length,1);
  const e=unchanged(c,()=>entries(c))[0];assert.equal(e.channel,'court');assert(e.execution.ok);
  c._cc3_applyCourtPolicyBridge(c.GM._edictTracker[0],'approve',item,null,'准奏');assert.equal(c.GM.guoku.money,95000);
});
await test('court hold/refer/reject do not turn advice into a new funded decree',()=>{
  for(const action of ['hold','refer','reject']){const c=context();court(c);c._cc3_writeActionToGM(action,{title:'赈济河东',content:'下拨河东银5000两赈济',dept:'有司'},null,action);
    assert.equal(c.GM._edictTracker.length,0);assert.equal(c.GM.transferOrders.length,0);assert.equal(c.GM.guoku.money,100000);}
});
await test('actual Tinyi deferral produces only deliberation records; adoption uses its original tracker',async()=>{
  for(const mode of ['defer','majority']){const c=context();tinyi(c);await c._ty2_decide(mode);
    assert.equal(c.GM._edictTracker.length,mode==='defer'?0:1);assert.equal(c.GM.guoku.money,100000);
    const e=unchanged(c,()=>entries(c));assert(e.some(x=>x.channel==='court'));
    if(mode==='defer')assert(e[0].status.includes('未颁行'));}
});
await test('same-name different IDs stay separate; missing numeric evidence is not invented',()=>{
  const c=context();c.GM._edictTracker=[{id:'a',content:'赈济河东',progressPercent:NaN},{id:'b',content:'赈济河东',progressPercent:0}];
  const e=unchanged(c,()=>entries(c));assert.equal(e.length,2);assert.equal(e[0].progress,null);assert.equal(e[1].progress,0);assert(!e[0].transfer);
  assert.notEqual(e[0].key,e[1].key);
});
await test('record replacement and changes cannot resolve to a different same-ID document',()=>{
  const c=context();c.GM._edictTracker=[{id:'a',content:'赈济河东',status:'pending'}];const e=entries(c)[0];
  c.GM._edictTracker[0]={id:'a',content:'赈济河东',status:'pending'};assert.equal(c.TM.ReliefGovernance.resolve(c.GM,e).ok,false);
  const e2=entries(c)[0];c.GM._edictTracker[0].content='停发赈银';assert.equal(c.TM.ReliefGovernance.resolve(c.GM,e2).ok,false);
});
await test('same-turn GM/P replacement, load generation and timeline fork invalidate open rows',()=>{
  for(const key of ['GM','P','gen','timeline']){const c=context();c.GM._edictTracker=[{content:'赈济河东',status:'pending'}];const e=entries(c)[0];
    if(key==='GM')c.GM=structuredClone(c.GM);else if(key==='P')c.P=structuredClone(c.P);else if(key==='gen')c._tmLoadGen++;else c.GM._timelineId='fork';
    assert.equal(c.TM.ReliefGovernance.resolve(c.GM,e).ok,false);assert.equal(entries(c).length,1);}
});
await test('old standalone trial receipts are retained with a warning, never guessed into real edicts',()=>{
  const c=context();c.GM.currentIssues=[{id:'old',relief:{version:1,budget:50}}];c.GM.transferOrders=[{id:'p',protocol:'relief-cash-v1',amount:50,deliveredAmount:10,refundedAmount:0,status:'relief-held'}];
  c.GM._edictTracker=[{id:'old-e',content:'赈济河东',_reliefCaseId:'old',status:'executing'}];
  const out=unchanged(c,()=>c.TM.ReliefGovernance.list(c.GM));assert.equal(out.entries.length,0);assert.equal(out.warnings.length,1);assert.equal(c.TM.EdictOversight.activeEdicts(c.GM).length,0);
});
await test('pagination is bounded; repeat views and save roundtrip preserve all source bytes',()=>{
  const c=context();c.GM._edictTracker=Array.from({length:65},(_,i)=>({id:'e'+i,content:'赈济灾民'+i,turn:i,status:'pending'}));
  const a=unchanged(c,()=>c.TM.ReliefGovernance.list(c.GM,{limit:1000}));assert.equal(a.entries.length,50);assert.equal(a.total,65);
  const b=unchanged(c,()=>c.TM.ReliefGovernance.list(c.GM,{offset:50,limit:50}));assert.equal(b.entries.length,15);
  c.GM=JSON.parse(JSON.stringify(c.GM));assert.equal(c.TM.ReliefGovernance.list(c.GM).total,65);
});
console.log('relief-governance: '+passed+' PASS / 0 FAIL');
})().catch(e=>{console.error(e);process.exitCode=1;});
