'use strict';
const assert=require('assert/strict'),{politicalFixture}=require('./lib-political-action-fixture');
function setup(){const c=politicalFixture();c.load('tm-faction-npc-settings.js');c.load('tm-faction-npc-llm-decision.js');c.P.ai={key:'offline'};c.P.conf.npcAiPrecisionRetryAttempts=1;return c;}
async function main(){
 const c=setup();c.GM._playerDirectives=[{id:'d',content:'SECRET-PLAYER-DIRECTIVE 点名甲国'}];c.fb.aiStrategy={privateGoal:'SECRET-OPPONENT-MIND'};c.GM.activeWars=[{id:'public-war',attacker:'甲国',defender:'乙国'},{id:'private-war',attacker:'SECRET-HIDDEN-WAR',hidden:true}];
 let input='',calls=0;c.callAI=async p=>{calls++;input=p;return 'not JSON';};let r=await c.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'a',actingPositionId:'pa',maxAttempts:1});assert(r.failed&&!r.applied);assert.equal(calls,1);assert(!input.includes('SECRET-'));assert.equal(c.fa.treasury.money,100);assert.equal(c.GM._npcExecutionResults,undefined);assert.equal(c.GM._npcFactionLlmLedger.runs.fa.failure.kind,'parse');assert.equal(c.TM.FactionNpcLlmDecision.getGlobalNpcLlmStatus().turnAggregate.parseFail,1);
 const publicView=c.TM.PoliticalActions.strategicPrompt().user;assert(publicView.includes('public-war'));assert(!publicView.includes('SECRET-'));assert(!publicView.includes('casualties'));
 // Unknown and human-controlled people never produce a substitute decision.
 const blocked=await c.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'missing'});assert(blocked.skipped);assert.equal(calls,1);
 c.GM.turn++;c.callAI=async p=>{input=p;calls++;return JSON.stringify({actions:[{type:'office_change',targetId:'s',positionId:'va'}]});};r=await c.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'a',actingPositionId:'pa'});assert(r.generated&&!r.applied);assert.equal(c.fa.officeTree[0].positions[1].holderId,undefined);c.GM.turn++;c.TM.PoliticalActions.flush();assert.equal(c.fa.officeTree[0].positions[1].holderId,'s');
 // The actual retry policy is unchanged: malformed response followed by a valid response stays one logical packet.
 const retry=setup();let attempts=0;retry.callAI=async()=>++attempts===1?'broken':JSON.stringify({actions:[]});r=await retry.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'a',actingPositionId:'pa',maxAttempts:2});assert(r.generated);assert.equal(attempts,2);assert.equal(retry.GM._npcActionState.politicalPending.length,1);
 // Repeated failures retain work and do not fabricate a default edict or loyalty.
 const failed=setup();failed.TM.PoliticalActions.localCandidates('office_change');const count=failed.GM._npcPlans.length;failed.callAI=async()=>'{"rationale":"'+'cut-off '.repeat(180);
 for(let i=0;i<2;i++){failed.GM.turn++;r=await failed.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'a',actingPositionId:'pa',maxAttempts:1});assert(r.failed);assert.equal(failed.GM._npcPlans.length,count);assert.equal(failed.fa.npcEdicts,undefined);assert.equal(failed.a.loyalty,80);}
 assert(failed.GM._npcFactionLlmLedger.runs.fa.failure.possibleTruncation);
 // A substring is not evidence of knowledge. Only a delivered source adds the text to the recipient input.
 const known=setup(),B=known.TM.PoliticalActions;known.GM._playerDirectives=[{content:'黎明私下命令·SECRET-DAWN'}];assert(!B.prompt(known.fa,B.bind(known.fa,'a',{actingPositionId:'pa'})).user.includes('SECRET-DAWN'));
 const msg=known.NpcBehaviorRegistry.execute(known.liaison,{actionId:'reported-order',actorId:'l',targetId:'a',behaviorType:'private_correspondence',intent:'现递交报告：SECRET-DAWN',task:{kind:'notice'}});assert.equal(msg.outcome,'submitted');assert(!B.prompt(known.fa,B.bind(known.fa,'a',{actingPositionId:'pa'})).user.includes('SECRET-DAWN'));
 known.GM.turn++;known.TM.NPC.ActionLedger.advance();assert(B.prompt(known.fa,B.bind(known.fa,'a',{actingPositionId:'pa'})).user.includes('SECRET-DAWN'));
 console.log('[smoke-faction-llm-wave1] PASS public facts/private knowledge, explicit source delivery, parse diagnostics, bounded retries and real recovery');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
