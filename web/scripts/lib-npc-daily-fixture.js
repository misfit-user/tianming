'use strict';
const {fixture}=require('./lib-npc-action-fixture');
function dailyFixture(){
  const c=fixture();c.P.ai={};c.P.time={daysPerTurn:1};c.GM.turn=1;c.GM.facs=[];c.GM.officeTree=[];delete c.GM.guoku;
  c._getDaysPerTurn=()=>c.P.time.daysPerTurn;c.getCurrentGameDay=()=>Math.max(0,c.GM.turn-1)*c._getDaysPerTurn();
  c.GM.mapData={locationBindingContract:{schema:'source-text-location-v2'},regions:[{id:'place-a',name:'城内'},{id:'place-b',name:'别处'}]};
  c.apiAttempts=[];
  for(const name of ['callAI','callAIMessages','callAIWithTools','callAISmart','callAIStream','callAIStreamMessages','fetch'])c[name]=()=>{c.apiAttempts.push(name);throw Error('API attempt forbidden: '+name);};
  ['tm-sim-time.js','tm-political-actions.js','tm-map-locations.js','tm-map-route-days.js','tm-npc-daily-activities.js','tm-npc-travel.js'].forEach(c.load);
  c.add=(id,name,extra={})=>c.actor(id,name,{location:'城内',publicIdentity:true,faction:'',...extra});
  c.step=(actor,plan,phase,response,extra={})=>c.TM.NPC.DailyActivities.submitNPC(actor,{actionId:'test-step-'+(++c.testSequence),planId:plan.id,phase,response,expectedRevision:plan.localActivity.revision,termsVersion:plan.localActivity.termsVersion,...extra});
  c.testSequence=0;c.deliver=()=>{const r=c.TM.NPC.ActionLedger.advance(c.GM);if(!r.ok)throw Error(r.reason);};
  return c;
}
module.exports={dailyFixture};
