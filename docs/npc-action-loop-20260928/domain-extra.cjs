'use strict';
const assert=require('assert/strict'),{fixture}=require('../../web/scripts/lib-npc-action-fixture');
let checks=0;const eq=(a,b,m)=>{assert.equal(a,b,m);checks++;};
{
 const c=fixture(),a=c.actor('a','守信君',{traitIds:['honorable'],loyalty:90}),b=c.actor('b','外邦君');
 c.GM.facs=[{id:'ours',name:'本邦',leaderId:a.id,leader:a.name},{id:'theirs',name:'外邦',leaderId:b.id,leader:b.name}];c.load('tm-feudal-warfare.js');
 const r=c.TM.NPC.ActionLedger.ingest({actionId:'war1',actorId:a.id,behaviorType:'declare_war',targetId:'theirs',target:'外邦',intent:'对外宣战'},'test');
 eq(r.outcome,'started','loyal honorable actor is not mistaken for rebellion against a liege');eq(c.GM.activeWars.length,1,'real war domain registered the war');
 eq(c.TM.NPC.ActionLedger.ingest({actionId:'war2',actorId:a.id,behaviorType:'declare_war',targetId:'theirs',target:'外邦'},'test').outcome,'blocked','actual existing-war condition still blocks another war');
}
{
 const c=fixture(),a=c.actor('a','仁官',{traitIds:['kind']}),b=c.actor('b','属官');
 c.GM.officeTree=[{id:'dept',name:'署',positions:[{id:'judge',name:'司法官',holderId:a.id,holder:a.name,powers:{judicial:true,reform:true}},{id:'subject',name:'属官',holderId:b.id,holder:b.name}]}];c.load('tm-office-reform.js');
 eq(c.TM.NPC.ActionLedger.ingest({actorId:a.id,targetId:b.id,behaviorType:'punish',targetPositionId:'subject',actingPositionId:'judge',intent:'请核违纪'},'test').outcome,'submitted','benevolent official can lodge a real disciplinary request');
 eq(c.GM.memorials.length,1,'judicial submission has a document');eq(b.loyalty,80,'a request is not a punishment');
 const reform=c.TM.NPC.ActionLedger.ingest({actorId:a.id,behaviorType:'reform',actingPositionId:'judge',reform:{dept:'署',position:'属官',reformDetail:'明确监督权',powers:{supervise:true}}},'test');
 eq(reform.outcome,'submitted','reform enters the actual pending-reform domain');eq(c.GM._pendingReforms.length,1,'actual reform record exists');eq(c.GM.officeTree[0].positions[1].powers,undefined,'pending reform has not changed authority');
}
{
 const c=fixture(),a=c.actor('a','甲'),b=c.actor('p','君主',{isPlayer:true});c.load('tm-hongyan-office.js');
 const elements={};function el(tag){return {tag,style:{},children:[],value:'',setAttribute(){},appendChild(x){this.children.push(x);},insertBefore(x){elements[x.id]=x;},focus(){}};}
 c.document.createElement=el;elements['letter-textarea']=el('textarea');elements['letter-textarea'].parentNode=el('div');c._$=id=>elements[id]||null;c.renderLetterPanel=()=>{};c.toast=()=>{};
 const r=c.TM.NPC.ActionLedger.ingest({actorId:a.id,targetId:b.id,behaviorType:'private_correspondence',intent:'请赐一篇文书'},'test');c.GM.turn++;c.TM.NPC.ActionLedger.advance();const p=c.GM._npcPlans[0],letter=c.GM.letters[0];
 c._ltReplyToNpc(letter.id);elements['letter-textarea'].value='我愿整理';c.sendLetter();eq(p.messages.length,1,'typing alone cannot imply acceptance');
 elements['npc-plan-reply-choice'].value='accept';c.sendLetter();eq(p.messages.length,2,'explicit UI response joins the same plan');eq(letter._playerReplied,true,'original letter view reflects the response');
 c.GM.turn++;c.TM.NPC.ActionLedger.advance();c.GM.turn++;c.TM.NPC.ActionLedger.advance();eq(p.steps.length,0,'accepted promise remains unperformed');
 c._ltReplyToNpc(letter.id);elements['npc-plan-reply-choice'].value='deliver';elements['letter-textarea'].value='亲拟：修学以明理。';c.sendLetter();eq(p.steps.length,1,'actual send button deliberately submits the promised document');eq(c.GM._npcPlans.length,1,'UI does not fork an independent executable matter');
}
{
 const c=fixture(),a=c.actor('a','甲'),b=c.actor('b','乙');
 const relation={actionId:'shared-source',actor:a.name,actorId:a.id,target:b.name,targetId:b.id,type:'private_visit',description:'讨论书目'};
 eq(c.applyAITurnChanges({relations:[relation]}).ok,true,'formal applier accepts a relation report');eq(c.GM._npcPlans.length,0,'a report is not replayed as an invitation');
 eq(c.TM.NPC.ActionLedger.ingest({...relation,behaviorType:relation.type,intent:'讨论书目',executionMode:'intent'},'main_ai:npc_actions').outcome,'submitted','a separate explicit intention uses the same source ID');
 eq(c.GM._npcPlans.length,1,'only the actual request creates an obligation');eq(c.GM._npcActionLedger.filter(r=>r.actionId==='shared-source').length,1,'report and receipt share one ledger row');
 eq(c.GM._npcActionLedger.find(r=>r.actionId==='shared-source').status,'submitted','verified stage supersedes the reported view');
}
console.log('PASS additional domain/UI checks: '+checks);
