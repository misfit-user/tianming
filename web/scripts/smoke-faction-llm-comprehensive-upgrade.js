'use strict';
const assert=require('assert/strict'),{politicalFixture}=require('./lib-political-action-fixture');
function setup(){const c=politicalFixture();c.load('tm-faction-npc-settings.js');c.load('tm-faction-npc-llm-decision.js');c.load('tm-faction-npc-in-turn-driver.js');c.P.ai={key:'offline'};Object.assign(c.P.conf,{npcAiPrecisionRetryAttempts:1,npcAiPrecisionMaxPerTurn:1,npcInTurnMaxPerTurn:2});return c;}
async function main(){
 const c=setup(),B=c.TM.PoliticalActions,E=c.TM.FactionActionEngine;
 const contract=E.getActionContract();for(const k of ['fromAccount','toAccount','amounts','purpose'])assert(contract.fiscal_policy.required.includes(k));assert(!contract.fiscal_policy.optional.includes('incomeDelta'));assert(contract.office_change.required.includes('positionId'));assert(contract.diplomacy.optional.includes('proposalVersion'));assert(!contract.military_order.optional.includes('soldiersDelta'));
 // A shared strategic suggestion cannot override person scheduling or force its opinion on the actor.
 c.fa.derivedStrength={value:999999};c.fa.aiStrategy={secretPlan:'SECRET-RANK'};c.GM._sc16FactionDirectives={turn:c.GM.turn,priorityQueue:[{faction:'甲国',priority:999,reason:'SECRET-ORDER'}],byFaction:{'甲国':{priorityRank:1,must_follow:'SECRET-MUST'}}};
 const plan=B.offer(c.fb,c.b,{type:'office_change',positionId:'vb',intent:'本署空缺需处理'},'actual-delivered-work');c.GM._npcFactionAiSchedule={};
 // The safe candidate score uses actual pending knowledge and waiting, not the hidden strength or must_follow.
 const rows=E.rankFactionCandidates(c.GM.facs,{turn:c.GM.turn});assert(rows.length===2);assert(rows.every(r=>!(r.reasons||[]).includes('sc16-hard-priority')));
 let calls=0,inputs=[];c.callAI=async text=>{calls++;inputs.push(text);return JSON.stringify({actions:[]});};const batch=await c.TM.FactionNpcLlmDecision.decideAll();assert.equal(batch.attempted,1);assert.equal(batch.generated,1);assert.equal(batch.applied,0);assert.equal(calls,1);assert(inputs.every(s=>!s.includes('SECRET-')));
 // The second scheduler uses the same total budget and leaves generated effects at a safe boundary.
 let r=await c.TM.FactionNpcInTurnDriver._runOneInTurn(c.GM.turn,'second');assert(r.generated);r=await c.TM.FactionNpcInTurnDriver._runOneInTurn(c.GM.turn,'exhausted');assert(r.skipped);assert.equal(calls,2);assert.equal(c.GM._npcExecutionResults,undefined);
 // Planned money/military/alliances have no side effects; a specific office action has a real one.
 const d=setup(),before=d.fa.treasury.money;
 r=d.TM.FactionActionEngine.applyDecision(d.fa,{actions:[{type:'fiscal_policy',treasuryDelta:1000,incomeDelta:500},{type:'military_order',armyId:'missing',soldiersDelta:200},{type:'diplomacy',toFactionId:'fb',proposalType:'alliance',terms:'请求结盟'}]},{actorId:'a',actingPositionId:'pa',sourceId:'mixed'});
 assert.equal(r.actions,0);assert.equal(r.submittedActions,1);assert.equal(d.GM.facs[0].treasury.money,before);assert.equal(d.GM.treaties,undefined);
 r=d.TM.FactionActionEngine.applyDecision(d.GM.facs[1],{actions:[{type:'office_change',targetId:'s',positionId:'vb'}]},{actorId:'b',actingPositionId:'pb',sourceId:'actual-office'});assert.equal(r.actions,1);assert.equal(d.GM.facs[1].officeTree[0].positions[1].holderId,'s');
 // Truncation diagnosis remains observable without claiming a template did the work.
 const bad=setup();bad.callAI=async()=>'{"rationale":"'+'unfinished '.repeat(160);r=await bad.TM.FactionNpcLlmDecision.decideFor('甲国',{actorId:'a',actingPositionId:'pa',maxAttempts:1});assert(r.failed);const row=bad.GM._npcFactionLlmLedger.runs.fa;assert(row.failure.rawLength>1000&&row.failure.possibleTruncation);assert.equal(bad.TM.FactionNpcLlmDecision.getGlobalNpcLlmStatus().turnAggregate.applied,0);assert.equal(bad.GM._npcExecutionResults,undefined);
 console.log('[smoke-faction-llm-comprehensive-upgrade] PASS contracts, advisory SC16, shared budget, concrete execution and diagnostic failure');
}
main().catch(e=>{console.error(e.stack);process.exitCode=1;});
