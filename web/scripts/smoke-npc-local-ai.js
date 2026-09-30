'use strict';
const assert=require('assert/strict'),{dailyFixture}=require('./lib-npc-daily-fixture');
function setup(){const c=dailyFixture(),queue=[],hooks={};c.setTimeout=fn=>{queue.push(fn);return queue.length;};c.GameHooks={on(k,fn){(hooks[k]||(hooks[k]=[])).push(fn);},run(k){(hooks[k]||[]).forEach(fn=>fn());}};c.load('tm-npc-local-ai.js');c.drain=()=>{let n=0;while(queue.length){if(++n>30)throw Error('unbounded local continuation');queue.shift()();}};return c;}
let passed=0;function test(name,fn){fn();console.log('PASS '+name);passed++;}
test('a real game entry event lets ordinary NPCs autonomously greet and complete sourced assistance',()=>{
 const c=setup(),a=c.add('a','甲',{localGoals:[{id:'help-goal',kind:'assistance',targetId:'b',task:{kind:'material_summary',materialRefs:[{kind:'character_public',characterId:'a'}]}}]}),b=c.add('b','乙');
 c.GM.affinityMap={'乙|甲':45};c.GameHooks.run('enterGame:after');assert.equal(c.GM._npcPlans.length,0,'initial entry queues bounded computation after initialization returns');c.drain();
 const p=c.TM.NPC.DailyActivities.plans().find(p=>p.actorId==='a'&&p.localActivity.kind==='assistance');assert(p);assert.equal(p.status,'done',JSON.stringify(p));assert.equal(p.localActivity.documents.length,1);assert.equal(p.localActivity.documents[0].receivedBy,'a');assert.equal(c.apiAttempts.length,0);assert.equal(c.GM.facs.length,0);
 const before=JSON.stringify(c.GM);c.GameHooks.run('enterGame:after');c.drain();assert.equal(JSON.stringify(c.GM),before);
 const loading=setup();loading.add('a','甲',{localGoals:[{id:'after-load',kind:'assistance',targetId:'b',task:{materialRefs:[{kind:'character_public',characterId:'a'}]}}]});loading.add('b','乙');loading.GM.busy=true;loading.GM._loadHydrationPending=true;
 loading.GameHooks.run('enterGame:after');loading.drain();assert.equal(loading.GM._npcPlans.length,0);assert(!loading.TM.NPC.DailyActivities.readState());
 loading.GM.busy=false;loading.GM._loadHydrationPending=false;loading.TM.NPC.LocalAI.scheduleEntry();loading.drain();assert.equal(loading.TM.NPC.DailyActivities.plans()[0].status,'done','native load commit must reawaken deferred initialization');
});
test('NPC introduction reaches the player through two independent local choices and waits for a real response',()=>{
 const c=setup(),a=c.add('a','甲',{localGoals:[{id:'intro',kind:'introduction',targetId:'b',thirdPartyId:'p'}]}),b=c.add('b','乙'),p=c.add('p','玩家',{isPlayer:true});c.GM.playerInfo={characterId:'p'};c.GM.affinityMap={'乙|甲':40};
 c.GameHooks.run('enterGame:after');c.drain();const D=c.TM.NPC.DailyActivities,plan=D.plans().find(x=>x.actorId==='a'&&x.localActivity.kind==='introduction');
 assert.equal(D.view(plan,p).nextPhase,'respond',JSON.stringify(plan));assert(!plan.localActivity.contact);assert(!p._lastNpcExecution);
 const ticket=D.ticket(p,{planId:plan.id,phase:'respond'}),r=D.submitHuman(ticket,{response:'accept'});assert.equal(r.outcome,'submitted');
 c.TM.NPC.LocalAI.wake('response',r);c.drain();assert.equal(D.get(plan.id).status,'done');assert(D.get(plan.id).localActivity.contact);assert.equal(c.apiAttempts.length,0);
 assert.equal(D.plans().length,1,'a just-completed exchange must not immediately generate an empty follow-up greeting');
});
test('known relations and current personal burden yield different responses without a trait ban',()=>{
 const c=setup(),a=c.add('a','甲'),b=c.add('b','乙'),L=c.TM.NPC.LocalAI;
 c.GM.affinityMap={'乙|甲':60};const friendly=L.inclination(b,a,'assistance');b.stress=95;c.GM.affinityMap={'乙|甲':-70};const reluctant=L.inclination(b,a,'assistance');assert(friendly.score>40);assert(reluctant.score<0);
 c.GameHooks.run('enterGame:after');c.drain();assert.equal(c.TM.NPC.DailyActivities.plans().length,0);assert.equal(c.apiAttempts.length,0);
 const D=c.TM.NPC.DailyActivities,r=D.submitNPC(a,{actionId:'personal-question',activityKind:'greeting',targetId:'b'});assert.equal(r.outcome,'submitted');c.deliver();const p=D.get(r.planId);
 assert.equal(L.candidates(b,[p])[0].action.response,'reject');c.GM.affinityMap={'乙|甲':60};b.stress=0;assert.equal(L.candidates(b,[p])[0].action.response,'warm');
 b.stress=80;assert.equal(L.candidates(b,[p])[0].action.response,'defer');
});
test('entry starts one unsolicited exchange while preserving the complete independent reply',()=>{
 const c=setup();['甲','乙','丙','丁'].forEach((name,i)=>c.add(String(i),name));c.GM.affinityMap={};for(const pair of [['甲','乙'],['丙','丁']])c.GM.affinityMap[pair.sort().join('|')]=60;
 c.GameHooks.run('enterGame:after');c.drain();assert.equal(c.TM.NPC.DailyActivities.plans().length,1);assert.equal(c.TM.NPC.DailyActivities.plans()[0].status,'done');assert.equal(c.GM._npcActionState.localDaily.event.newContacts,1);assert.equal(c.apiAttempts.length,0);
});
console.log('PASS '+passed+' local AI groups');
