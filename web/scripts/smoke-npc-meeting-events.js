'use strict';
// Production modules with controlled canonical intervals. The Electron case
// separately exercises the top-level endTurn, UI and disk save/load.
const assert = require('node:assert/strict');
const { dailyFixture } = require('./lib-npc-daily-fixture');
function advance(c, days) {
  c.P.time.daysPerTurn = days;
  const interval = c.TM.SimTime.prepare(c.GM);
  c.GM.turn++;
  assert.equal(c.TM.SimTime.commit(c.GM, interval).ok, true);
  c.GM.busy = true; c.GM._endTurnBusy = true;
  const out = c.TM.NPC.ActionLedger.advance(c.GM);
  c.GM.busy = false; c.GM._endTurnBusy = false;
  assert.equal(out.ok, true, out.reason);
  return interval;
}
function fixture(player) {
  const c = dailyFixture(), D = c.TM.NPC.DailyActivities;
  c.GM.mapData.regions[0].geographicCenter=[116,40];
  c.GM.mapData.regions[1].geographicCenter=[117,40];
  c.TM.SimTime.ensure(c.GM);
  const a = c.add('event:actor', '甲'), b = c.add('event:target', '乙');
  if (player) { a.isPlayer = true; c.GM.playerCharacterId = a.id; }
  const submit = command => player ? D.submitHuman(D.ticket(a, command), command) : D.submitNPC(a, command);
  c.GM.affinityMap = { [ ['甲','乙'].sort().join('|') ]: 70 };
  const source = submit({actionId:'event:source', activityKind:'assistance', targetId:b.id,
    task:{kind:'material_summary',title:'阅读已有身份资料',materialRefs:[{kind:'character_public',characterId:a.id}]}});
  assert.equal(source.outcome, 'submitted', source.reason);
  let p = D.get(source.planId);
  advance(c,1); assert.equal(c.step(b,p,'respond','accept').outcome,'submitted');
  advance(c,1); assert.equal(c.step(b,p,'perform').outcome,'submitted');
  advance(c,1); assert.equal(submit({actionId:'event:source-feedback',planId:p.id,phase:'feedback',response:'satisfied',expectedRevision:p.localActivity.revision,termsVersion:p.localActivity.termsVersion}).outcome,'completed');
  advance(c,1);
  const opportunity = D.consultationOpportunities(a).find(v=>v.action.targetId===b.id);
  assert(opportunity, 'actual received assistance is the source');
  c.load('tm-npc-local-ai.js');
  const start = D.day()+4;
  const created = submit({actionId:'event:meeting',activityKind:'meeting',targetId:b.id,
    meeting:{locationId:'place-a', requestedStartDay:start,durationDays:2,windowDays:3,
      discussion:{topicId:opportunity.action.consultation.topicId,sourceOpportunity:opportunity.action.consultation.sourceOpportunity,preferredExchange:'question'}}});
  assert.equal(created.outcome,'submitted',created.reason);
  p = D.get(created.planId);
  return { c, D, a, b, id:p.id, start };
}
let passed=0;
function test(name,run){run(); console.log('PASS '+name); passed++;}
test('NPC long interval performs independent discussion before meeting ends',()=>{
  const {c,D,id,start} = fixture(); advance(c,15);
  const p=D.get(id), m=p.localActivity.meeting;
  assert.equal(p.status,'done');
  assert.equal(m.discussion.actorChoice,'question');
  assert.equal(m.discussion.targetChoice,'answer');
  assert.equal(p.steps.filter(s=>s.phase==='discuss').length,1);
  assert.equal(p.steps.filter(s=>s.phase==='discuss_response').length,1);
  assert.equal(p.steps.find(s=>s.phase==='discuss').day,start);
  assert(p.steps.find(s=>s.phase==='discuss_response').day>start);
  assert(m.discussion.result.targetContent.includes('陈述'));
  assert.equal(m.participation.durationDays,2);
  assert.equal(c.apiAttempts.length,0);
});
test('long and split intervals have the same actual discussion and return',()=>{
  function run(split){const {c,D,id}=fixture(); if(split)for(let i=0;i<15;i++)advance(c,1);else advance(c,15);
    const p=D.get(id),m=p.localActivity.meeting;return {status:p.status,start:m.startedDay,end:m.endDay,
      result:JSON.parse(JSON.stringify(m.discussion.result)),steps:p.steps.filter(s=>/^discuss/.test(s.phase)).map(s=>[s.phase,s.day]),
      returnStatus:m.status,effects:m.discussion.effectsApplied};}
  assert.deepEqual(JSON.parse(JSON.stringify(run(false))),JSON.parse(JSON.stringify(run(true))));
});
test('player interval stops at the real choice; question can be saved before answer',()=>{
  const {c,D,a,id,start}=fixture(true);
  for(let i=0;i<8 && !c.TM.NPC.Meetings.pendingPlayerChoice();i++) {
    advance(c,30); const p=D.get(id),v=D.view(p,a);
    if(v.nextPhase==='depart')assert.equal(D.submitHuman(D.ticket(a,{planId:id,phase:'depart',expectedRevision:v.revision,termsVersion:v.termsVersion}),{}).outcome,'started');
  }
  assert.equal(D.day(),start);
  assert.equal(c.TM.NPC.Meetings.pendingPlayerChoice().phase,'discuss');
  assert.equal(D.get(id).localActivity.meeting.discussion.actorContent,'');
  const view=D.view(D.get(id),a), token=D.ticket(a,{planId:id,phase:'discuss',expectedRevision:view.revision,termsVersion:view.termsVersion});
  assert.equal(D.submitHuman(token,{exchangeChoice:'question'}).outcome,'submitted');
  assert.equal(D.get(id).localActivity.meeting.discussion.status,'awaiting_target');
  const before=JSON.stringify(c.GM); c.GM=JSON.parse(before); // low-level persistence only
  advance(c,30);
  assert.equal(D.get(id).localActivity.meeting.discussion.status,'completed');
  const completed=D.get(id).localActivity.meeting;
  assert.equal(completed.discussion.result.day,start+0.5,'the NPC still answers at the exact event day');
  assert.equal(completed.participation.endDay,start+2,'the agreed meeting duration is unchanged');
  assert.equal(completed.actorReturnJourney.status,'returned');assert.equal(completed.targetReturnJourney.status,'returned');
  assert.equal(D.get(id).steps.filter(s=>s.phase==='discuss').length,1,'the player question is never resubmitted by replay');
  assert.equal(D.get(id).steps.filter(s=>s.phase==='discuss_response').length,1);
  assert.equal(D.get(id).status,'done');
  const effects=JSON.stringify(D.get(id).localActivity.meeting.discussion.result);
  c.TM.NPC.ActionLedger.advance(c.GM);
  assert.equal(JSON.stringify(D.get(id).localActivity.meeting.discussion.result),effects);
});
test('an unavailable participant ends the actual partial exchange without a fictitious answer or return',()=>{
  const {c,D,a,b,id}=fixture(true);
  for(let i=0;i<8&&!c.TM.NPC.Meetings.pendingPlayerChoice();i++){
    advance(c,30);const v=D.view(D.get(id),a);
    if(v.nextPhase==='depart')D.submitHuman(D.ticket(a,{planId:id,phase:'depart'}),{});
  }
  const v=D.view(D.get(id),a);
  assert.equal(v.nextPhase,'discuss');
  assert.equal(D.submitHuman(D.ticket(a,{planId:id,phase:'discuss'}),{exchangeChoice:'question'}).outcome,'submitted');
  // Low-level external-world boundary: no business consent/result is injected.
  D.person(b.id).alive=false;
  advance(c,1);
  const p=D.get(id),m=p.localActivity.meeting;
  assert.equal(p.status,'ended');assert.equal(m.discussion.outcome,'partial');
  assert.equal(m.discussion.result,null);assert.equal(m.targetReturnJourney.status,'unavailable');
  assert.equal(p.steps.filter(s=>s.phase==='discuss_response').length,0);
});
test('unchanged player waiting does not snapshot the world or consume another action',()=>{
  const {c,D,a,id}=fixture(true);
  for(let i=0;i<8&&!c.TM.NPC.Meetings.pendingPlayerChoice();i++){
    advance(c,30);const v=D.view(D.get(id),a);
    if(v.nextPhase==='depart')D.submitHuman(D.ticket(a,{planId:id,phase:'depart'}),{});
  }
  const before=JSON.stringify(c.GM),realClone=c.deepClone;
  let snapshots=0;c.deepClone=function(value){snapshots++;return realClone?realClone(value):JSON.parse(JSON.stringify(value));};
  for(let i=0;i<5;i++){D.view(D.get(id),a);assert.equal(c.TM.NPC.ActionLedger.advance(c.GM,{localOnly:true}).ok,true);}
  assert.equal(snapshots,0);assert.equal(JSON.stringify(c.GM),before);
});
test('a shared participant cannot overlap meetings and can use the remaining agreed window',()=>{
  const c=dailyFixture(),D=c.TM.NPC.DailyActivities;c.GM.mapData.regions[0].geographicCenter=[116,40];c.TM.SimTime.ensure(c.GM);c.load('tm-npc-local-ai.js');
  const a=c.add('overlap:a','甲'),b=c.add('overlap:b','乙'),other=c.add('overlap:c','丙');
  function invite(target,key){const r=D.submitNPC(a,{actionId:key,activityKind:'meeting',targetId:target.id,meeting:{locationId:'place-a',requestedStartDay:8,durationDays:1,windowDays:3}});assert.equal(r.outcome,'submitted',r.reason);return r.planId;}
  const first=invite(b,'overlap:first');advance(c,1);const second=invite(other,'overlap:second');advance(c,15);
  assert.equal(D.get(first).status,'done');assert.equal(D.get(second).status,'done');
  const one=D.get(first).localActivity.meeting.participation,two=D.get(second).localActivity.meeting.participation;
  assert.equal(one.startDay,8);assert.equal(one.endDay,9);assert.equal(two.startDay,9);assert.equal(two.endDay,10);
});
console.log('PASS npc-meeting-events '+passed+' groups');
