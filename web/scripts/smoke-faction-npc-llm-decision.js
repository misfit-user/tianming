'use strict';
// Production generation, validation and submission, with offline model responses only.
const assert=require('assert/strict'),{politicalFixture}=require('./lib-political-action-fixture');
const fs=require('fs'),path=require('path');let checks=0;
function make(){const c=politicalFixture();['tm-faction-npc-settings.js','tm-faction-npc-llm-decision.js','tm-faction-npc-memorial.js','tm-faction-npc-edict.js','tm-faction-npc-chaoyi.js','tm-faction-npc-office.js'].forEach(c.load);c.P.ai={key:'offline-fixture'};c.P.conf={npcAiPrecision:true,npcAiPrecisionRetryAttempts:1,npcAiPrecisionMaxPerTurn:2,npcInTurnMaxPerTurn:4};return c;}
function run(c,fac,actions,id='origin'){return c.TM.FactionNpcLlmDecision._applyDecision(fac,{actions},{actorId:fac.id==='fa'?'a':'b',actingPositionId:fac.id==='fa'?'pa':'pb',sourceId:id});}
function test(name,fn){return Promise.resolve().then(fn).then(()=>{checks++;console.log('PASS '+name);});}
async function main(){
 await test('schema normalization retains legacy intent without authorizing its claimed effects',()=>{
  const c=make(),F=c.TM.FactionNpcLlmDecision;
  const d=F._validateDecision({memorials:[{from:'联络人',type:'人事',content:'请选贤',rulerDecision:'approved'}],edict:{type:'赏赐',content:'自称赏银',treasuryDelta:1000},chaoyi:{type:'cooperate',summary:'商议'},office:[{kind:'promote',target:'候选者',newPosition:'不存在'}]});
  assert.equal(d.memorials.length,1);assert(d.edict&&d.chaoyi);assert.equal(d.office.length,1);assert.equal(F._normalizeDecisionActions(c.fa,d).map(a=>a.type).join('|'),'memorial|edict|court_alignment|office_change');
  const invalid=F._validateDecision({memorials:[{type:'INVALID',content:'x'}],edict:{type:'INVALID'},office:[{kind:'INVALID'}]});assert.equal(invalid.memorials.length,0);assert.equal(invalid.edict,null);assert.equal(invalid.office.length,0);
  const before=c.fa.treasury.money,r=F._applyDecision(c.fa,d);assert.equal(r.actions,0);assert.equal(c.GM.facs[0].treasury.money,before);assert.equal(c.subject.officialTitle,undefined);
 });
 await test('office actions use the true other-government seat and preserve display titles',()=>{
  const c=make(),r=run(c,c.fb,[{type:'office_change',kind:'appoint',targetId:'s',positionId:'vb'}]);assert.equal(r.actions,1);assert.equal(c.fb.officeTree[0].positions[1].holderId,'s');assert(c.subject.officialTitle.includes('乙缺'));assert.equal(c.GM.officeTree.length,0);
  assert.equal(run(c,c.fb,[{type:'office_change',kind:'appoint',targetId:'s',positionId:'vb'}]).mergedActions,1);assert.equal(c.subject._memory.length,1);
 });
 await test('native fiscal intent consumes a real scoped public account, with no long-term delta mint',()=>{
  const c=make(),box=n=>({stock:n,available:n,quota:n,used:0});for(const f of c.GM.facs)f.treasury.ledgers={money:box(f.treasury.money),grain:box(f.treasury.grain),cloth:box(f.treasury.cloth)};
  c.GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:[{id:'qa',kind:'physical',factionId:'fa',source:{kind:'faction',id:'fa'}},{id:'qb',kind:'physical',factionId:'fb',source:{kind:'faction',id:'fb'}}]};
  Object.assign(c.fa.officeTree[0].positions[0],{treasuryBinding:{accountRef:'qa',role:'custodian'},authorityScope:{accountRefs:['qb']}});
  const r=run(c,c.fa,[{type:'fiscal_policy',fromAccount:'qa',toAccount:'qb',amounts:{money:25},purpose:'履约周转'}]);assert.equal(r.actions,1);assert.equal(c.fa.treasury.money,75);assert.equal(c.fb.treasury.money,95);
  const mint=run(c,c.fa,[{type:'fiscal_policy',treasuryDelta:500,incomeDelta:99}],'mint');assert.equal(mint.actions,0);assert.equal(c.GM.facs[0].treasury.money,75);assert.equal(c.GM.facs[0].fiscalPolicy,undefined);
 });
 await test('typed military and treaty suggestions cannot preempt custodians or counterpart choice',()=>{
  const c=make();c.GM.armies=[{id:'ar',name:'军',faction:'甲国',soldiers:100,location:'京师'}];
  const r=run(c,c.fa,[{type:'military_order',armyId:'ar',soldiersDelta:900},{type:'diplomacy',toFactionId:'fb',proposalType:'alliance',terms:'愿共同防御'}]);assert.equal(r.actions,0);assert.equal(r.submittedActions,1);assert.equal(c.GM.armies[0].soldiers,100);assert.equal(c.GM.treaties,undefined);assert.equal(c.GM.facs[1]._incomingProposals.length,1);
 });
 await test('preflight rejects invalid IDs before any office, relationship or report of completion',()=>{
  const c=make(),r=run(c,c.fa,[{type:'office_change',targetId:'missing',target:'联络人',positionId:'va'}]);assert.equal(r.actions,0);assert.equal(c.GM.facs[0].officeTree[0].positions[1].holderId,undefined);assert.equal(c.GM._npcExecutionResults,undefined);
  assert.equal(c.GM.facs[0]._npcLlmActionLedger[0].status,'blocked');
 });
 await test('diagnostic state distinguishes generated packets from actual submitted and completed operations',async()=>{
  const c=make();c.callAI=async()=>JSON.stringify({actions:[{type:'office_change',targetId:'s',positionId:'va'}]});const r=await c.TM.FactionNpcLlmDecision.decideFor({id:'fa'},{actorId:'a',actingPositionId:'pa',source:'manual'});assert(r.generated&&!r.applied);assert.equal(c.fa.officeTree[0].positions[1].holderId,undefined);
  const status=c.TM.FactionNpcLlmDecision.getGlobalNpcLlmStatus();assert.equal(status.turnAggregate.applied,0);assert.equal(c.GM._npcFactionLlmLedger.runs.fa.status,'generated');c.GM.turn++;c.TM.PoliticalActions.flush();assert.equal(c.fa.officeTree[0].positions[1].holderId,'s');
 });
 await test('parse failure retains diagnosis and recovers through a later actual person decision',async()=>{
  const c=make();c.TM.PoliticalActions.localCandidates('office_change');const p=c.GM._npcPlans.find(p=>p.actorId==='a');let calls=0;
  c.callAI=async()=>{calls++;return 'not valid JSON';};let r=await c.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'a',actingPositionId:'pa',maxAttempts:1});assert(r.failed&&!r.applied);assert.equal(calls,1);assert.equal(c.GM._npcFactionLlmLedger.runs.fa.status,'failed');assert(c.GM._npcFactionLlmLedger.runs.fa.failure.kind);assert.equal(p.status,'active');assert.equal(c.GM._npcExecutionResults,undefined);
  c.GM.turn++;c.callAI=async()=>JSON.stringify({actions:[{...p.operation,targetId:'s',sourcePlanId:p.id}]});r=await c.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'a',actingPositionId:'pa'});assert(r.generated);c.GM.turn++;c.TM.PoliticalActions.flush();assert.equal(p.status,'done');assert.equal(c.fa.officeTree[0].positions[1].holderId,'s');
 });
 await test('concurrent faction inference uses bounded calls, separate identities and no shared secrets',async()=>{
  const c=make();c.P.conf.npcAiPrecisionConcurrency=1;let active=0,max=0,calls=0;c.a._privateThought='SECRET-A';c.b._privateThought='SECRET-B';const inputs=[];
  c.callAI=async(input)=>{calls++;active++;max=Math.max(max,active);inputs.push(input);await Promise.resolve();active--;return JSON.stringify({actions:[]});};const r=await c.TM.FactionNpcLlmDecision.decideAll();assert.equal(r.attempted,2);assert.equal(r.generated,2);assert.equal(r.applied,0);assert.equal(calls,2);assert.equal(max,1);assert(inputs.every(x=>!x.includes('SECRET-A')&&!x.includes('SECRET-B')));
 });
 await test('local templates create selectable candidates and actual document requests, without unilateral rulings',()=>{
  const c=make();c.TM.FactionNpcMemorial.generate();c.TM.FactionNpcEdict.generate();c.TM.FactionNpcChaoyi.generate();
  assert.equal(c.GM._npcExecutionResults,undefined);const p=c.GM._npcPlans.find(p=>p.actorId==='a'&&p.operation.type==='edict');const r=run(c,c.fa,[{type:'edict',targetId:'l',content:'请核查册籍后复命',sourcePlanId:p.id}]);assert.equal(r.results[0].outcome,'submitted');assert.equal(c.fa.npcEdicts[0].planId,r.results[0].planId);assert.equal(c.fa.npcEdicts[0].applied,false);assert.equal(c.fa.treasury.money,100);assert.equal(c.liaison.loyalty,80);
 });
 await test('player marking protects the person while same-country officials retain decisions',async()=>{
  const c=make();c.fa.isPlayer=true;c.liaison.isPlayer=true;c.GM.playerInfo={characterId:'l',factionId:'fa'};c.callAI=async()=>JSON.stringify({actions:[]});assert((await c.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'a',actingPositionId:'pa'})).generated);assert((await c.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'l'})).skipped);assert.equal(c.GM._npcActionState.politicalPending[0].actorId,'a');assert.equal(c.liaison._lastNpcExecution,undefined);
 });
 await test('a formal mocked response shares canonical action IDs across faction and NPC entries',()=>{
  const c=make(),decision={type:'office_change',targetId:'s',positionId:'vb'},r=run(c,c.fb,[decision]);assert.equal(r.actions,1);
  const again=c.NpcBehaviorRegistry.execute(c.b,{actionId:r.results[0].actionId,actorId:'b',organizationId:'fb',actingPositionId:'pb',behaviorType:'appoint',targetId:'s',positionId:'vb',targetType:'character'});assert(again.duplicate);assert.equal(c.subject._memory.length,1);
 });
 await test('the final prompt is limited to the bound character, delivered proposals and usable current offices',async()=>{
  const c=make();c.fb.aiStrategy={secret:'SECRET-OTHER-STRATEGY'};c.fb.treasury.hiddenResource='SECRET-STOCK';c.GM._playerDirectives=[{content:'SECRET-PLAYER-EDICT'}];c.b._memory=[{text:'SECRET-OTHER-MEMORY',visibility:'private'}];
  let input='';c.callAI=async(text)=>{input=text;return '{}';};await c.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'a',actingPositionId:'pa'});assert(!input.includes('SECRET-'));assert(input.includes('pa')&&input.includes('a'));assert(input.includes('proposalVersion')&&input.includes('sourcePlanId'));
 });
 await test('SC16 reads public world facts and creates optional person candidates rather than relations',()=>{
  const c=make();c.fa.aiStrategy={secret:'SECRET'};c.GM.activeWars=[{id:'w',attacker:'甲国',defender:'乙国'},{id:'hidden',attacker:'SECRET-WAR',hidden:true}];const B=c.TM.PoliticalActions;assert(!B.strategicPrompt().user.includes('SECRET'));
  const before=JSON.stringify(c.GM.rels);const ids=B.strategicCandidates({diplomatic_shifts:[{fromId:'fa',toId:'fb',new_relation:'alliance'}]},'sc16-source');assert.equal(ids.length,1);assert.equal(c.GM._npcPlans.find(p=>p.id===ids[0]).sourceKind,'proposal');assert.equal(JSON.stringify(c.GM.rels),before);assert.equal(c.GM.treaties,undefined);
 });
 console.log('[smoke-faction-npc-llm-decision] PASS '+checks+' production behavior groups');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
