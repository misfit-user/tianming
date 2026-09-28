'use strict';
const assert=require('assert/strict'),{fixture}=require('./lib-npc-action-fixture');
let checks=0;const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
function formal(c){['tm-ai-apply-deaths.js','tm-endturn-apply.js','tm-endturn-apply-stages.js'].forEach(c.load);return async output=>{
 const context={results:{sc1:output},record:{},prompt:{sc:''},input:{},meta:{timing:{}},apply:{applied:{}}};
 await c.TM.Endturn.AI.apply.writeBack(context);return context;
};}
function output(actor,target,phase,plan,extra={}){return {actorId:actor.id,name:actor.name,behaviorType:'private_correspondence',targetId:target.id,target:target.name,action:'办理书目事项',intent:'办理书目事项',phase,planId:plan&&plan.id,...extra};}
async function social(){
 const c=fixture(),a=c.actor('a','甲'),b=c.actor('b','乙'),apply=formal(c);
 const first=output(a,b,'execute',null,{actionId:'formal-social'}),initial=await apply({npc_actions:[first]});
 let plan=c.GM._npcPlans[0];eq(plan.status,'in_transit','formal SC1 creates one real request');eq(initial.results.sc1.npc_actions[0].status,'submitted','UI result comes from actual receipt');
 await apply({npc_actions:[{...first}],npc_correspondence:[{...first,from:a.name,to:b.name}]});eq(c.GM._npcPlans.length,1,'main actions and correspondence share the same action');
 c.GM.turn++;await apply({npc_interactions:[{...output(b,a,'respond',plan,{response:'accept'}),actor:b.name,type:'private_correspondence'}]});eq(plan.status,'in_transit','formal interaction returns a response');
 c.GM.turn++;await apply({});c.GM.turn++;
 await apply({npc_actions:[output(b,a,'perform',plan,{content:'目录：礼、史、文'})]});eq(plan.steps.length,1,'actual document submitted');
 c.GM.turn++;await apply({npc_actions:[output(a,b,'feedback',plan,{content:'目录已核收',evaluation:'satisfied'})]});c.GM.turn++;await apply({});eq(plan.status,'done','formal social loop closes');
 eq(c.GM._npcActionLedger.filter(e=>e.actionId==='formal-social').length,1,'one originating action ledger entry');
 eq(c.NpcEngine,undefined,'retired engine remains absent');
 // Agent's existing relation entry resolves the same action ID; it cannot replay the request.
 eq(c.applyNpcInteraction(a.name,b.name,'private_correspondence',{actionId:'formal-social',actorId:a.id,targetId:b.id,description:'办理书目事项',_agent:true}),true,'Agent entry reads the original receipt');
 eq(c.GM._npcPlans.length,1,'Agent replay does not fork another obligation');
 return c;
}
async function office(){
 const c=fixture(),a=c.actor('a','主簿',{officialTitle:'主簿'}),b=c.actor('b','库吏',{officialTitle:'库吏'}),apply=formal(c),box=n=>({stock:n,available:n,quota:60,used:0});
 c.GM.officeTree=[{id:'source',name:'甲署',publicTreasury:{money:box(100),grain:box(0),cloth:box(0)},positions:[{id:'supervise',name:'主簿',holder:a.name,holderId:a.id,powers:{supervise:true}},{id:'cashier',name:'库吏',holder:b.name,holderId:b.id,powers:{treasurySpend:true},treasuryBinding:{role:'custodian',accountRef:'source'}}]},{id:'dest',name:'乙署',publicTreasury:{money:box(0),grain:box(0),cloth:box(0)},positions:[]}];
 c.GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:['source','dest'].map(id=>({id,kind:'physical',factionId:'朝廷',source:{kind:'department',id}}))};
 await apply({npc_actions:[output(a,b,'execute',null,{behaviorType:'office_duty',actingPositionId:'supervise',actionId:'formal-duty',task:{kind:'public_transfer',fromAccount:'source',toAccount:'dest',amounts:{money:40}},intent:'核对并移交四十贯'})]});
 const p=c.GM._npcPlans[0];c.GM.turn++;await apply({npc_actions:[output(b,a,'respond',p,{response:'accept',actingPositionId:'cashier',content:'已核材料'})]});c.GM.turn++;await apply({});c.GM.turn++;
 c.GM.officeTree[0].positions[1].powers.treasurySpend=false;
 await apply({npc_actions:[output(b,a,'perform',p)]});eq(c.GM.officeTree[0].publicTreasury.money.stock,100,'reformed power prevents pending expense');eq(p.status,'needs_replan','obligation survives reform');
 c.GM.officeTree[0].positions[1].powers.treasurySpend=true;c.GM.turn++;await apply({npc_actions:[output(b,a,'perform',p,{actionId:'formal-duty-transfer'})]});
 if(c.GM.officeTree[0].publicTreasury.money.stock!==60)console.error(JSON.stringify({plan:p,diagnostics:c.GM._npcDecisionDiagnostics.slice(-3),office:c.GM.officeTree[0]}));eq(c.GM.officeTree[0].publicTreasury.money.stock,60,'real source debit');eq(c.GM.officeTree[1].publicTreasury.money.stock,40,'real destination credit');eq(c.GM.officeTree[0].publicTreasury.money.used,40,'separate spending quota consumed');
 c.GM.turn++;await apply({npc_actions:[output(a,b,'feedback',p,{content:'交割已核'})]});c.GM.turn++;await apply({});eq(p.status,'done','formal duty loop closes');
 eq(c.GM._publicTreasuryTransfers.length,1,'one financial operation');return c;
}
function saveRoundtrip(c){
 c.setTimeout=()=>0;c.clearTimeout=()=>{};c.localStorage={getItem:()=>null,setItem(){},removeItem(){}};c.generateMemorials=()=>{};
 ['tm-utils.js','tm-save-world-validation.js','tm-save-lifecycle.js'].forEach(c.load);
 const snapshot=c._buildSaveState({format:'idb',prepare:false,detach:true}),money=c.GM.guoku.money,count=c.GM._npcPlans.length,receipts=Object.keys(c.GM._npcActionState.receipts).length;
 c.GM=JSON.parse(JSON.stringify(snapshot.GM));c._restoreSavedFields({});
 eq(c.GM._npcPlans.length,count,'actual save builder and restore preserve plans');eq(Object.keys(c.GM._npcActionState.receipts).length,receipts,'actual save builder preserves durable operation index');eq(c.GM.guoku.money,money,'load has no inferred monetary effects');
 const before=JSON.stringify(c.GM._npcActionState);c.TM.NPC.ActionLedger.migrate(c.GM);eq(JSON.stringify(c.GM._npcActionState),before,'migration is repeatable');
}
(async()=>{saveRoundtrip(await social());saveRoundtrip(await office());console.log('[smoke-npc-action-entrypoints] PASS '+checks+' assertions');})().catch(e=>{console.error(e.stack);process.exitCode=1;});
