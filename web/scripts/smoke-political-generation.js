'use strict';
const assert=require('assert/strict'),{politicalFixture}=require('./lib-political-action-fixture');
const tests=[];function test(name,fn){tests.push({name,fn});}
function setup(){const c=politicalFixture();c.load('tm-faction-npc-settings.js');c.load('tm-faction-npc-llm-decision.js');return c;}
const decision=JSON.stringify({actions:[{type:'office_change',kind:'appoint',targetId:'s',target:'候选者',positionId:'vb',actingPositionId:'pb'}]});
test('formal faction generation is bound before inference and commits only at a simulation boundary',async()=>{
  const c=setup();let calls=0,input='';c.a.innerThought='SECRET_OTHER_PERSON_01';c.fa.aiStrategy={privatePlan:'SECRET_STRATEGY_02'};
  c.callAI=async p=>{input=p;calls++;return decision;};
  const r=await c.TM.FactionNpcLlmDecision.decideFor({id:'fb'},{actorId:'b',actingPositionId:'pb',source:'manual'});
  assert.equal(r.generated,true,JSON.stringify(r));assert.equal(r.applied,false);assert.equal(c.fb.officeTree[0].positions[1].holderId,undefined);
  assert(!input.includes('SECRET_OTHER_PERSON_01'));assert(!input.includes('SECRET_STRATEGY_02'));assert(input.includes('"actorId":"b"'));
  await Promise.resolve();c.TM.PoliticalActions.flush();assert.equal(c.fb.officeTree[0].positions[1].holderId,undefined);
  const again=await c.TM.FactionNpcLlmDecision.decideFor({id:'fb'},{actorId:'b',actingPositionId:'pb',source:'idle'});assert.equal(again.skipped,true);assert.equal(calls,1);
  c.GM.turn++;c.TM.PoliticalActions.flush();assert.equal(c.GM.facs.find(f=>f.id==='fb').officeTree[0].positions[1].holderId,'s');
});
test('a same-turn load cannot receive an old generation result or completion counters',async()=>{
  const c=setup();let finish;c.callAI=()=>new Promise(r=>finish=r);
  const pending=c.TM.FactionNpcLlmDecision.decideFor({id:'fb'},{actorId:'b',actingPositionId:'pb',source:'eager'});
  const replacement=JSON.parse(JSON.stringify(c.GM));delete replacement._npcFactionLlmLedger;delete replacement._npcFactionAiTurnLedger;delete replacement._npcActionState;c.GM=replacement;
  finish(decision);const r=await pending;assert.equal(r.expired,true);assert.equal(c.GM._npcFactionLlmLedger,undefined);assert.equal(c.GM._npcActionState,undefined);
});
test('death and removal during the model request invalidate its binding',async()=>{
  for(const change of ['death','office']){const c=setup();let finish;c.callAI=()=>new Promise(r=>finish=r);
    const pending=c.TM.FactionNpcLlmDecision.decideFor({id:'fb'},{actorId:'b',actingPositionId:'pb',source:'manual'});
    if(change==='death')c.b.alive=false;else{c.fb.officeTree[0].positions[0].holderId='s';c.fb.officeTree[0].positions[0].holder='候选者';}
    finish(decision);const r=await pending;assert.equal(r.expired,true,JSON.stringify(r));assert.equal((c.TM.NPC.ActionLedger.state(c.GM).politicalPending||[]).length,0);
  }
});
test('an ordinary player in the same country does not freeze its other officials',async()=>{
  const c=setup();c.fb.isPlayer=true;c.actor('player','玩家',{isPlayer:true,factionId:'fb',faction:'乙国'});c.GM.playerInfo={characterId:'player',factionId:'fb'};
  c.callAI=async()=>decision;const r=await c.TM.FactionNpcLlmDecision.decideFor({id:'fb'},{source:'in-turn'});assert.equal(r.generated,true,JSON.stringify(r));
  assert.equal(c.TM.FactionNpcLlmDecision._isPlayerFaction(c.fb,['乙国']),false);
  c.GM.turn++;c.TM.PoliticalActions.flush();assert.equal(c.GM.facs.find(f=>f.id==='fb').officeTree[0].positions[1].holderId,'s');
  assert(!c.GM.chars.find(x=>x.id==='player')._lastNpcExecution);
});
(async()=>{let passed=0,failed=0;for(const t of tests){try{await t.fn();passed++;console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+': '+e.stack);}}console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;})();
