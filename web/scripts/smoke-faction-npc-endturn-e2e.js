'use strict';
const assert=require('assert/strict'),{politicalFixture}=require('./lib-political-action-fixture');
async function main(){
 const c=politicalFixture();['tm-ai-apply-deaths.js','tm-endturn-apply.js','tm-endturn-apply-stages.js','tm-faction-npc-settings.js'].forEach(c.load);
 async function apply(sc1={}){const context={results:{sc1},record:{},prompt:{sc:''},input:{},meta:{timing:{}},apply:{applied:{}}};await c.TM.Endturn.AI.apply.writeBack(context);return context;}
 const B=c.TM.PoliticalActions,L=c.TM.NPC.ActionLedger,context=B.bind(c.fb,'b',{actingPositionId:'pb',sourceId:'formal-cross-entry'});
 B.defer(context,{actions:[{type:'office_change',kind:'appoint',targetId:'s',positionId:'vb'}]});await apply();assert.equal(c.fb.officeTree[0].positions[1].holderId,undefined);
 c.GM.turn++;await apply();assert.equal(c.fb.officeTree[0].positions[1].holderId,'s');const receipt=c.GM._npcExecutionResults[0];
 const repeated=await apply({npc_actions:[{actionId:receipt.actionId,actorId:'b',name:'乙代表',organizationId:'fb',actingPositionId:'pb',behaviorType:'appoint',targetId:'s',positionId:'vb',targetType:'character'}]});
 assert.equal(c.subject._memory.length,1);assert.equal(c.GM._npcExecutionResults.length,1);assert.equal(c.GM._npcActionState.politicalPending[0].status,'completed');
 // The former local templates are proposals. A chosen request uses the exact same official main writeback as NPC conversations.
 const requested=await apply({npc_actions:[{actionId:'formal-request',actorId:'a',name:'甲代表',targetId:'l',target:'联络人',action:'请核来往册籍',behaviorType:'private_correspondence',intent:'请核来往册籍',task:{kind:'document'}}]});
 const p=c.GM._npcPlans.find(p=>p.id==='plan:formal-request');assert.equal(p.status,'in_transit');c.GM.turn++;await apply({npc_interactions:[{actionId:'formal-response',actorId:'l',name:'联络人',actor:'联络人',targetId:'a',target:'甲代表',action:'答复办理',behaviorType:'private_correspondence',type:'private_correspondence',planId:p.id,phase:'respond',response:'accept',content:'愿办理'}]});
 c.GM.turn++;await apply();c.GM.turn++;await apply({npc_actions:[{actionId:'formal-document',actorId:'l',name:'联络人',targetId:'a',target:'甲代表',action:'交付册籍',behaviorType:'private_correspondence',planId:p.id,phase:'perform',content:'甲册已核，乙册仍待补件'}]});
 c.GM.turn++;await apply({npc_actions:[{actionId:'formal-feedback',actorId:'a',name:'甲代表',targetId:'l',target:'联络人',action:'收讫反馈',behaviorType:'private_correspondence',planId:p.id,phase:'feedback',content:'收讫，另续缺件',evaluation:'satisfied'}]});c.GM.turn++;await apply();assert.equal(p.status,'done');assert.equal(p.steps.length,1);
 c.fa.isPlayer=true;c.GM.playerInfo={characterId:'l',factionId:'fa'};c.liaison.isPlayer=true;c.fb.derivedEconomy={annualTaxIncome:12000,annualMilitaryCost:1200};const playerCash=c.fa.treasury.money;
 c.TM.FactionNpcGuoku.generate();const after=c.fb.treasury.money;c.TM.FactionNpcGuoku.generate();assert.equal(c.fb.treasury.money,after);assert.equal(c.fa.treasury.money,playerCash);assert(after>70);assert(B.principals(c.fa).some(r=>r.actor.id==='a'));assert(!B.principals(c.fa).some(r=>r.actor.id==='l'));
 delete c.P.ai;assert.equal(c.TM.FactionNpcSettings.getStatus().effectivelyOn,false);c.P.ai={key:'offline-fixture'};assert.equal(c.TM.FactionNpcSettings.getStatus().effectivelyOn,true);
 assert.equal(c.NpcEngine,undefined);assert.equal(c.InteractionSystem,undefined);console.log('[smoke-faction-npc-endturn-e2e] PASS formal writeback, social response, fiscal ownership, player control and retired drivers');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
