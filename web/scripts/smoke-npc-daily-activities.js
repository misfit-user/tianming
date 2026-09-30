'use strict';
const assert=require('assert/strict'),{dailyFixture}=require('./lib-npc-daily-fixture');
let passed=0;
function test(name,run){run();passed++;console.log('PASS '+name);}
test('ordinary people exchange a greeting on the formal current date without any model attempt',()=>{
 const c=dailyFixture(),a=c.add('a','甲'),b=c.add('b','乙'),D=c.TM.NPC.DailyActivities;
 const r=D.submitNPC(a,{actionId:'hello',activityKind:'greeting',targetId:b.id});assert.equal(r.outcome,'submitted',JSON.stringify(r));
 let p=D.get(r.planId);assert(!D.view(p,b));c.deliver();p=D.get(p.id);assert.equal(D.view(p,b).nextPhase,'respond');
 assert.equal(c.step(b,p,'respond','warm').outcome,'submitted');c.deliver();p=D.get(p.id);assert.equal(p.status,'done');
 assert.equal(c.GM.turn,1);assert.equal(c.GM.guoku,undefined);assert.equal(c.GM.facs.length,0);assert.equal(a._eventOpinions,undefined);assert.equal(c.apiAttempts.length,0);
 [a,b].forEach(ch=>ch._memory.filter(m=>m.taskId===p.id).forEach(m=>assert(m.sourceRefs.every(ref=>ref.kind==='npc_message'&&ref.planId===p.id&&p.messages.some(message=>message.id===ref.id)),'memory points to a real source message')));
});
test('assistance forms a readable document from actual shared sources and rewards only received feedback once',()=>{
 const c=dailyFixture(),a=c.add('a','甲'),b=c.add('b','乙'),D=c.TM.NPC.DailyActivities;
 const r=D.submitNPC(a,{actionId:'help',activityKind:'assistance',targetId:b.id,task:{kind:'material_summary',title:'汇整已知身份',materialRefs:[{kind:'character_public',characterId:a.id}]}});
 assert.equal(r.outcome,'submitted',JSON.stringify(r));c.deliver();let p=D.get(r.planId);
 assert.equal(c.step(b,p,'respond','accept').outcome,'submitted');c.deliver();p=D.get(p.id);
 assert.equal(c.step(b,p,'perform',undefined).outcome,'submitted');assert.equal(D.view(p,a).documents.length,0);c.deliver();p=D.get(p.id);
 const doc=D.view(p,a).documents[0];assert(doc.content.includes('姓名：甲'));assert.equal(doc.sources[0].ref.characterId,'a');assert.equal(doc.receivedBy,'a');
 const decision={actionId:'feedback',planId:p.id,phase:'feedback',response:'satisfied',expectedRevision:p.localActivity.revision,termsVersion:p.localActivity.termsVersion};
 assert.equal(D.submitNPC(a,decision).outcome,'completed');assert.equal(D.submitNPC(a,decision).duplicate,true);c.deliver();
 assert.equal(D.get(p.id).status,'done');assert.equal(a._eventOpinions.length,1);assert.equal(b._eventOpinions,undefined);assert.equal(c.apiAttempts.length,0);
});
test('the intermediary cannot accept for a third person; current explicit player consent creates only contact',()=>{
 const c=dailyFixture(),a=c.add('a','甲'),b=c.add('b','乙'),player=c.add('p','来客',{isPlayer:true}),D=c.TM.NPC.DailyActivities;c.GM.playerInfo={characterId:player.id};
 const r=D.submitNPC(a,{actionId:'introduce',activityKind:'introduction',targetId:b.id,thirdPartyId:player.id});assert.equal(r.outcome,'submitted');c.deliver();let p=D.get(r.planId);
 assert.equal(c.step(b,p,'respond','accept').outcome,'submitted');c.deliver();p=D.get(p.id);assert(!p.localActivity.contact);
 assert.equal(c.step(b,p,'forward').outcome,'submitted');c.deliver();p=D.get(p.id);assert.equal(D.view(p,player).nextPhase,'respond');assert(!p.localActivity.contact);
 assert.equal(c.step(player,p,'respond','accept').outcome,'blocked');
 const button=D.ticket(player,{planId:p.id,phase:'respond'}),human=D.submitHuman(button,{response:'accept'});assert.equal(human.outcome,'submitted');assert.equal(human.source,'daily-human');assert.equal(D.submitHuman(button,{response:'accept'}).outcome,'expired');
 c.deliver();p=D.get(p.id);assert.equal(c.step(b,p,'report').outcome,'submitted');c.deliver();p=D.get(p.id);
 assert.equal(p.status,'done');assert.deepEqual(Array.from(p.localActivity.contact.participants),['a','p']);assert.equal(p.localActivity.contact.mode,'correspondence');
 assert.equal(c.GM.treaties,undefined);assert.equal(a._eventOpinions,undefined);assert.equal(player._eventOpinions,undefined);assert.equal(c.apiAttempts.length,0);
});
console.log('PASS '+passed+' daily activity groups');
