'use strict';
const assert=require('assert/strict'),{dailyFixture}=require('./lib-npc-daily-fixture');
let passed=0,failed=0;
function test(name,run){try{run();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+'\n'+e.stack);}}
function world(){const c=dailyFixture();c.a=c.add('a','甲');c.b=c.add('b','乙');c.d=c.add('c','丙');c.D=c.TM.NPC.DailyActivities;return c;}
function step(c,id,who,phase,response,extra){const r=c.step(who,c.D.get(id),phase,response,extra);assert(/^(submitted|completed)$/.test(r.outcome),JSON.stringify(r));return r;}
function start(c,kind,extra={}){const r=c.D.submitNPC(c.a,{actionId:'request-'+kind,activityKind:kind,targetId:'b',thirdPartyId:kind==='introduction'?'c':'',...extra});assert.equal(r.outcome,'submitted',JSON.stringify(r));c.deliver();return r.planId;}
function toThird(c){const id=start(c,'introduction');step(c,id,c.b,'respond','accept');c.deliver();step(c,id,c.b,'forward');c.deliver();return id;}
test('third-party refusal returns through actual messages without a contact or relationship award',()=>{
 const c=world(),id=toThird(c);step(c,id,c.d,'respond','reject');c.deliver();assert.equal(c.D.get(id).status,'ready_report');assert(!c.D.view(c.D.get(id),c.a).messages.some(m=>m.fromId==='c'));
 step(c,id,c.b,'report');c.deliver();assert.equal(c.D.get(id).status,'rejected');assert(!c.D.get(id).localActivity.contact);assert(c.GM.chars.every(ch=>!ch._eventOpinions));assert.equal(c.apiAttempts.length,0);
});
test('new introduction conditions reject old acceptance and need the current requester agreement',()=>{
 const c=world(),id=toThird(c);const oldTerms=c.D.get(id).localActivity.termsVersion;step(c,id,c.d,'respond','conditions');c.deliver();step(c,id,c.b,'report');c.deliver();let p=c.D.get(id);
 const stale=c.step(c.a,p,'agree','accept',{termsVersion:oldTerms});assert.equal(stale.outcome,'expired');assert(!c.D.get(id).localActivity.contact);
 step(c,id,c.a,'agree','accept');c.deliver();step(c,id,c.d,'confirm');c.deliver();c.deliver();p=c.D.get(id);assert.equal(p.status,'done');assert(c.D.view(p,c.d).contact);assert.equal(p.localActivity.termsVersion,2);assert.equal(c.apiAttempts.length,0);
});
test('adding requested missing materials asks the helper for a fresh decision before work begins',()=>{
 const c=world(),id=start(c,'assistance',{task:{kind:'material_summary',title:'整理现有材料'}});
 assert.equal(c.step(c.b,c.D.get(id),'respond','accept').reason,'materials_missing');step(c,id,c.b,'respond','conditions');c.deliver();
 step(c,id,c.a,'agree','accept',{task:{kind:'material_summary',title:'整理已补材料',materialRefs:[{kind:'character_public',characterId:'a'}]}});c.deliver();
 assert.equal(c.D.get(id).status,'awaiting_response');assert.equal(c.D.get(id).nextActorId,'b');assert(!c.D.get(id).localActivity.documents);
 step(c,id,c.b,'respond','accept');c.deliver();step(c,id,c.b,'perform');c.deliver();assert.equal(c.D.view(c.D.get(id),c.a).documents.length,1);
});
test('unknown and broad locations do not become instant local delivery or reveal private whereabouts',()=>{
 const c=world();c.b.location='SECRET_REMOTE_AREA';c.b.regionId=undefined;const r=c.D.submitNPC(c.a,{actionId:'unknown-place',activityKind:'greeting',targetId:'b'});assert.equal(r.outcome,'submitted');c.deliver();
 const p=c.D.get(r.planId);assert.equal(p.status,'waiting_contact');assert.equal(c.D.view(p,c.b),null);assert(!JSON.stringify(c.D.view(p,c.a)).includes('SECRET_REMOTE_AREA'));assert(!c.b._memory);
});
test('private materials do not enter a requester view without actual sharing',()=>{
 const c=world();c.NpcMemorySystem.remember(c.b.name,'SECRET_HELPER_PRIVATE','平',5,'',{characterId:'b',sourceId:'secret',_noMirror:true,relationshipHandled:true});
 const id=start(c,'assistance',{task:{kind:'material_summary',materialRefs:[{kind:'character_public',characterId:'a'}]}});step(c,id,c.b,'respond','accept');c.deliver();step(c,id,c.b,'perform');c.deliver();
 assert(!JSON.stringify(c.D.view(c.D.get(id),c.a)).includes('SECRET_HELPER_PRIVATE'));
 const r=c.D.submitNPC(c.a,{actionId:'steal-material',activityKind:'assistance',targetId:'c',task:{kind:'material_summary',materialRefs:[{kind:'memory',ownerId:'b',id:c.b._memory[0].id}]}});assert.equal(r.outcome,'blocked');
});
test('a third party may defer, and a failed onward contact can be cancelled without assuming consent',()=>{
 const c=world(),id=toThird(c);step(c,id,c.d,'respond','defer');c.deliver();step(c,id,c.b,'report');c.deliver();assert.equal(c.D.get(id).status,'deferred');assert(!c.D.get(id).localActivity.contact);assert(c.D.view(c.D.get(id),c.a).messages.some(m=>m.content.includes('还未同意')));
 const x=world(),other=start(x,'introduction');step(x,other,x.b,'respond','accept');x.deliver();x.d._travelTo='未知去处';step(x,other,x.b,'forward');x.deliver();assert.equal(x.D.get(other).status,'waiting_contact');assert.equal(x.D.view(x.D.get(other),x.d),null);step(x,other,x.b,'cancel');x.deliver();assert.equal(x.D.get(other).status,'cancelled');assert(!x.D.get(other).localActivity.contact);
});
test('death between dispatch and receipt produces a neutral transport result, never a reply from the dead',()=>{
 const c=world(),r=c.D.submitNPC(c.a,{actionId:'before-death',activityKind:'greeting',targetId:'b'});c.b.alive=false;c.deliver();const p=c.D.get(r.planId);assert.equal(p.status,'waiting_contact');assert(!c.b._memory);assert(!JSON.stringify(c.D.view(p,c.a)).includes('死亡'));assert(!p.messages.some(m=>m.kind==='response'));step(c,p.id,c.a,'cancel');c.deliver();assert.equal(c.D.get(p.id).status,'cancelled');
});
test('a forged source, an old step or a legacy-model entry cannot impersonate the local chooser',()=>{
 const c=world(),id=start(c,'greeting'),p=c.D.get(id);const d={actionId:'forged',actorId:'b',planId:id,phase:'respond',response:'warm',expectedRevision:p.localActivity.revision,termsVersion:1,behaviorType:'ordinary_interaction',source:'player',player:true};
 assert.equal(c.NpcBehaviorRegistry.execute(c.b,d).outcome,'blocked');assert.equal(c.TM.NPC.ActionLedger.execute(c.b,{...d,actionId:'fake-proof'},null,()=>c.TM.NPC.ActionLedger.result('completed','fake',[{kind:'daily_step',id:p.steps[0].id,planId:id}])).outcome,'failed');
 const legacy=c.NpcBehaviorRegistry.execute(c.b,{...d,actionId:'legacy-replay',behaviorType:'private_correspondence'});assert.equal(legacy.outcome,'blocked');assert.equal(c.D.get(id).status,'awaiting_response');
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
