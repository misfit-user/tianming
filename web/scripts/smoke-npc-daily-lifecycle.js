'use strict';
const assert=require('assert/strict'),{dailyFixture}=require('./lib-npc-daily-fixture');
const tests=[];function test(name,fn){tests.push({name,fn});}
function world(){const c=dailyFixture();c.a=c.add('a','甲');c.b=c.add('b','乙');c.d=c.add('c','丙');c.D=c.TM.NPC.DailyActivities;return c;}
function start(c,kind='assistance',extra={}){const r=c.D.submitNPC(c.a,{actionId:'initial',activityKind:kind,targetId:'b',task:{kind:'material_summary',materialRefs:[{kind:'character_public',characterId:'a'}]},...extra});assert.equal(r.outcome,'submitted',JSON.stringify(r));return r.planId;}
function step(c,id,who,phase,response,extra={}){const r=c.step(who,c.D.get(id),phase,response,extra);assert(/^(completed|submitted)$/.test(r.outcome),JSON.stringify(r));return r;}
function local(c){const queue=[];c.setTimeout=fn=>queue.push(fn);c.load('tm-npc-local-ai.js');c.drain=()=>{let n=0;while(queue.length){assert(++n<=8,'bounded continuation');queue.shift()();}};return c.TM.NPC.LocalAI;}
// The real formal system stage owns the clock increment. Unrelated world engines are fixture no-ops.
async function calendar(c){
 const noop=()=>{};Object.assign(c,{showLoading:noop,processBiannian:noop,processChangeQueue:noop,decayConflictLevels:noop,inheritBloodFeuds:noop,updateProvinceEconomy:noop,updatePositions:noop,
 SubTickRunner:{run:noop},StateCouplingSystem:{processCouplings:noop,updateSnapshot:noop},OffendGroupsSystem:{applyDecay:noop},AutoReboundSystem:{applyRebounds:noop,checkReforms:noop}});
 c.load('tm-endturn-systems.js');await c._endTurn_updateSystems(1,'');
}
test('an unreceived request can be withdrawn without inventing a reply',()=>{
 const c=world(),id=start(c,'greeting');step(c,id,c.a,'cancel');c.deliver();const p=c.D.get(id);assert.equal(p.status,'cancelled');assert.equal(c.D.view(p,c.b),null);assert.equal(p.messages[0].status,'withdrawn');assert(!c.b._memory);
});
test('cancellation overtaking an already formed delivery preserves the received document without completion reward',()=>{
 const c=world(),id=start(c);c.deliver();step(c,id,c.b,'respond','accept');c.deliver();
 step(c,id,c.a,'cancel');assert.equal(c.D.view(c.D.get(id),c.b).nextPhase,'perform','recipient has not received cancellation');
 step(c,id,c.b,'perform');c.deliver();const p=c.D.get(id);assert.equal(p.status,'cancelled');assert.equal(c.D.view(p,c.a).documents.length,1);assert.equal(p.localActivity.documents[0].status,'received');assert(!c.a._eventOpinions);
 const before=JSON.stringify(c.GM);c.deliver();assert.equal(JSON.stringify(c.GM),before);
});
test('failed cancellation notices end the local request without claiming the absent participant knows',()=>{
 const c=world(),id=start(c);c.deliver();c.b._travelTo='别处';step(c,id,c.a,'cancel');c.deliver();assert.equal(c.D.get(id).status,'cancelled');assert.equal(c.D.view(c.D.get(id),c.a).stage,'cancel_not_delivered');assert.notEqual(c.D.view(c.D.get(id),c.b).stage,'cancelled');
});
test('partial work and a requested supplement require fresh choices and keep both sourced deliveries',()=>{
 const c=world(),id=start(c,'assistance',{task:{kind:'material_summary',materialRefs:[{kind:'character_public',characterId:'a'},{kind:'character_public',characterId:'c'}]}});c.deliver();
 step(c,id,c.b,'respond','partial');c.deliver();step(c,id,c.a,'agree','accept');c.deliver();step(c,id,c.b,'perform');c.deliver();assert.equal(c.D.get(id).localActivity.documents[0].sources.length,1);
 const invalid=c.step(c.a,c.D.get(id),'feedback','supplement',{task:{materialRefs:[{kind:'memory',ownerId:'b',id:'forged'}]}});assert.equal(invalid.outcome,'blocked');assert.equal(c.D.get(id).status,'awaiting_feedback');
 step(c,id,c.a,'feedback','supplement',{task:{materialRefs:[{kind:'character_public',characterId:'c'}]}});c.deliver();assert.equal(c.D.get(id).status,'awaiting_response');
 step(c,id,c.b,'respond','accept');c.deliver();step(c,id,c.b,'perform');c.deliver();step(c,id,c.a,'feedback','satisfied');c.deliver();
 assert.equal(c.D.get(id).status,'done');assert.equal(c.D.get(id).localActivity.documents.length,2);assert.equal(c.D.person('a')._eventOpinions.filter(x=>x.sourceId===id+':delivery-evaluation').length,1);
});
test('multi-day work uses the formal clock stage and changing turn length does not complete it in the same turn',async()=>{
 const c=world(),id=start(c,'assistance',{task:{materialRefs:['a','b','c'].map(characterId=>({kind:'character_public',characterId}))}});c.deliver();step(c,id,c.b,'respond','accept');c.deliver();
 const ready=c.D.get(id).localActivity.readyDay,budget=JSON.stringify(c.D.budget(c.a));assert(ready>0);c.P.time.daysPerTurn=90;
 assert.equal(c.step(c.b,c.D.get(id),'perform').reason,'work_date_not_reached');assert.equal(c.D.get(id).localActivity.readyDay,ready);assert.equal(JSON.stringify(c.D.budget(c.a)),budget);
 c.P.time.daysPerTurn=30;await calendar(c);c.deliver();assert.equal(c.D.get(id).status,'working','a coarse month turn must process accepted work, not expire it before its due step');step(c,id,c.b,'perform');c.deliver();assert.equal(c.D.view(c.D.get(id),c.a).documents.length,1);assert.equal(c.GM.turn,2);assert.equal(c.D.get(id).status,'awaiting_feedback');step(c,id,c.a,'feedback','ack');c.deliver();assert.equal(c.D.get(id).status,'done');assert.equal(c.D.get(id).localActivity.readyDay,ready);
});
test('a received introduction opens later correspondence without friendship or automatic further consent',async()=>{
 const c=world(),L=local(c);c.a.localGoals=[{id:'intro',kind:'introduction',targetId:'b',thirdPartyId:'c'}];L.wake('turn');c.drain();const intro=c.D.plans()[0];assert.equal(intro.status,'done');assert(c.D.contactFor(c.a,c.d));assert(!c.a._eventOpinions);assert(!c.GM.affinityMap);
 for(let n=0;n<c.D.config.contactCooldownDays;n++)await calendar(c);
 L.wake('turn');c.drain();const followup=c.D.plans().find(p=>p.localActivity.kind==='greeting');assert(followup,'consented introduction becomes a real subsequent contact candidate');assert.equal(followup.localActivity.sourceContact.planId,intro.id);assert(followup.messages[0].content.includes('承此前引见'));assert.equal(followup.status,'done');assert.equal(c.apiAttempts.length,0);
});
test('deferral resumes only after formal time and an unanswered player request has a fixed expiry',async()=>{
 const c=world(),id=start(c,'greeting');c.deliver();const originalDeadline=c.D.view(c.D.get(id),c.a).expiresDay;step(c,id,c.b,'respond','defer');assert.equal(c.D.view(c.D.get(id),c.a).expiresDay,originalDeadline,'unreceived postponement cannot change the initiator known deadline');c.deliver();assert(c.D.view(c.D.get(id),c.a).expiresDay>originalDeadline);const pending=JSON.stringify(c.D.get(id));c.deliver();assert.equal(JSON.stringify(c.D.get(id)),pending);
 c.P.time.daysPerTurn=30;await calendar(c);c.deliver();assert.equal(c.D.get(id).nextActorId,'b');step(c,id,c.b,'respond','defer');c.deliver();await calendar(c);c.deliver();
 const over=c.step(c.b,c.D.get(id),'respond','defer');assert.equal(over.reason,'deferral_limit_reached');assert.equal(c.D.get(id).status,'awaiting_response','an invalid postponement must never become consent or refusal');step(c,id,c.b,'respond','brief');c.deliver();assert.equal(c.D.get(id).status,'done');
 const x=world();x.b.isPlayer=true;x.GM.playerInfo={characterId:'b'};const waiting=start(x,'greeting');x.deliver();local(x).wake('enter');x.drain();assert.equal(x.D.get(waiting).status,'awaiting_response');
 x.P.time.daysPerTurn=30;await calendar(x);x.deliver();assert.equal(x.D.get(waiting).status,'expired');assert(!x.b._lastNpcExecution);assert.equal(x.apiAttempts.length,0);
});
test('stale human controls, wrong IDs, duplicate identities and renamed people never resolve by arbitrary name',()=>{
 const c=world();c.a.isPlayer=true;c.GM.playerInfo={characterId:'a'};
 const token=c.D.ticket(c.a,{activityKind:'greeting',targetId:'b'});c.GM={...c.GM,sid:'another-save',chars:c.GM.chars.map(x=>({...x}))};assert.equal(c.D.submitHuman(token).outcome,'expired');assert.equal(c.D.plans().length,0);
 const current=c.GM.chars[0];c.GM.chars[1].name='改名';const invalid=c.D.submitHuman(c.D.ticket(current,{activityKind:'greeting',targetId:'does-not-exist',target:'改名'}));assert.equal(invalid.outcome,'blocked');
 assert.equal(c.D.ticket(current,{activityKind:'greeting',targetId:'b'}),'','rolled-back object references are stale');
 const good=c.D.submitHuman(c.D.ticket(c.GM.chars[0],{activityKind:'greeting',targetId:'b'}));assert.equal(good.outcome,'submitted');assert.equal(c.D.get(good.planId).target,'改名');
 const dup=world();dup.add('b','重名');assert.equal(dup.D.submitNPC(dup.a,{actionId:'duplicate',activityKind:'greeting',targetId:'b'}).outcome,'blocked');
});
test('human local choices cannot mutate a busy world and remain retryable at its safe boundary',()=>{
 const c=world();c.a.isPlayer=true;c.GM.playerInfo={characterId:'a'};const token=c.D.ticket(c.a,{activityKind:'greeting',targetId:'b'});c.GM.busy=true;
 const refused=c.D.submitHuman(token);assert.equal(refused.outcome,'blocked');assert.equal(refused.reason,'world_busy');assert.equal(c.D.plans().length,0);assert.equal(c.D.budget(c.D.person('a')).steps,0);
 c.GM.busy=false;const receipt=c.D.submitHuman(token);assert.equal(receipt.outcome,'submitted');c.deliver();assert.equal(c.D.plans().length,1);assert.equal(c.D.view(c.D.get(receipt.planId),c.D.person('b')).nextPhase,'respond');
});
test('permitted material fingerprints are rechecked, old copies remain attributed snapshots, duplicate sources fail closed',()=>{
 const c=world(),ref={kind:'character_public',characterId:'a'},m=c.D.material(c.a,ref);c.a.name='后来名字';
 assert.equal(c.D.submitNPC(c.a,{actionId:'stale-material',activityKind:'assistance',targetId:'b',task:{materialRefs:[ref],expectedFingerprints:[m.fingerprint]}}).outcome,'blocked');
 const id=start(c);c.deliver();step(c,id,c.b,'respond','accept');c.deliver();c.a.name='再次改名';step(c,id,c.b,'perform');c.deliver();assert(c.D.get(id).localActivity.documents[0].content.includes('后来名字'));assert(!c.D.get(id).localActivity.documents[0].content.includes('再次改名'));
 const docMessage=c.D.get(id).messages.find(m=>m.kind==='delivery'),docRef={kind:'npc_message',planId:id,id:docMessage.id};assert(c.D.material(c.a,docRef));assert.deepEqual(JSON.parse(JSON.stringify(c.D.materialOptions(c.a)[0].ref)),docRef);
 c.D.get(id).messages.push({...docMessage});assert.equal(c.D.material(c.a,docRef),null);
});
test('delivery or memory failure rolls back the entire stage, then a retry delivers exactly once',()=>{
 const c=world(),id=start(c),before=JSON.stringify(c.GM),remember=c.NpcMemorySystem.remember;c.NpcMemorySystem.remember=()=>{throw Error('injected-memory-failure');};
 assert.equal(c.TM.NPC.ActionLedger.advance(c.GM).ok,false);assert.equal(JSON.stringify(c.GM),before);c.NpcMemorySystem.remember=remember;c.deliver();const snapshot=JSON.stringify(c.GM);c.deliver();assert.equal(JSON.stringify(c.GM),snapshot);assert.equal(c.D.get(id).messages.filter(m=>m.status==='delivered').length,1);
});
test('local same-place send and delivery share the existing transaction and still require recipient choice',()=>{
 const c=world(),d={actionId:'same-place',activityKind:'greeting',targetId:'b'},original=c.NpcMemorySystem.remember;
 c.NpcMemorySystem.remember=function(name,...args){if(name==='乙')throw Error('fail recipient write');return original.call(this,name,...args);};
 const failed=c.D.submitNPC(c.a,d,{inlineDelivery:true});assert.equal(failed.outcome,'failed');assert.equal(c.D.plans().length,0);assert.equal(c.D.budget(c.D.person('a')).steps,0);c.NpcMemorySystem.remember=original;
 const r=c.D.submitNPC(c.D.person('a'),d,{inlineDelivery:true});assert.equal(r.outcome,'submitted');assert.equal(r.deliveryRefs.length,1);assert.equal(c.D.get(r.planId).status,'awaiting_response');const before=JSON.stringify(c.GM);assert(c.D.submitNPC(c.D.person('a'),d,{inlineDelivery:true}).duplicate);assert.equal(JSON.stringify(c.GM),before);
});
test('versioned migration preserves legacy matters, rejects future definitions atomically and does not replay',()=>{
 const c=world();c.GM._npcPlans.push({id:'legacy',version:2,status:'waiting_response',messages:[],steps:[]});const id=start(c,'greeting');c.deliver();const before=JSON.stringify(c.GM);assert(c.D.migrate().ok);assert.equal(JSON.stringify(c.GM),before);
 c.D.get(id).localActivity.definitionVersion=99;const future=JSON.stringify(c.GM);assert.equal(c.D.migrate().ok,false);assert.equal(JSON.stringify(c.GM),future);assert(c.GM._npcPlans.some(p=>p.id==='legacy'));
});
test('ordinary people beyond a batch rotate into the budget without UI refresh or real time renewing it',async()=>{
 const c=dailyFixture(),D=c.TM.NPC.DailyActivities,L=local(c);c.add('player','玩家',{isPlayer:true});c.GM.playerInfo={characterId:'player'};
 for(let n=0;n<60;n++)c.add('ordinary-'+String(n).padStart(2,'0'),'寻常人'+n,{localGoals:[{id:'greeting-goal',kind:'greeting',targetId:'player'}]});
 L.wake('enter');c.drain();assert.equal(D.plans().length,L.config.initialDecisions);const before=JSON.stringify(c.GM);for(let n=0;n<3;n++){L.wake('enter');c.drain();}assert.equal(JSON.stringify(c.GM),before);
 await calendar(c);L.wake('turn');c.drain();assert(D.plans().length>12&&D.plans().length<=L.config.initialDecisions+L.config.decisionsPerEvent);
 await calendar(c);L.wake('turn');c.drain();assert.equal(new Set(D.plans().map(p=>p.actorId)).size,60);assert(D.plans().every(p=>p.status==='awaiting_response'));assert.equal(c.apiAttempts.length,0);
});
test('API-on local-only entry neither flushes political pending nor attempts a model, and secret changes cannot affect private choices',async()=>{
 const c=world(),L=local(c);c.a.localGoals=[{id:'greet',kind:'greeting',targetId:'b'}];c.P.ai.key='fixture-only-not-a-real-key';
 const original=c.TM.NPC.ActionLedger.flushDeferred;c.TM.NPC.ActionLedger.flushDeferred=()=>{throw Error('political flush forbidden');};
 const options=JSON.stringify(L.candidates(c.a,[]));c.b.innerThought='SECRET_OTHER_GOAL';c.b._privateWealth=9999;assert.equal(JSON.stringify(L.candidates(c.a,[])),options);
 const r=await c.executeNpcBehaviors({localOnly:true});c.drain();assert.equal(r.modelCalls,0);assert.equal(c.apiAttempts.length,0);assert(!JSON.stringify(c.D.view(c.D.plans()[0],c.a)).includes('SECRET_OTHER_GOAL'));c.TM.NPC.ActionLedger.flushDeferred=original;
});
test('a queued batch from another save neither writes there nor consumes the new world continuation',()=>{
 const c=dailyFixture(),D=c.TM.NPC.DailyActivities,L=local(c);c.add('p','玩家',{isPlayer:true});c.GM.playerInfo={characterId:'p'};
 for(let n=0;n<25;n++)c.add('n'+String(n).padStart(2,'0'),'普通人'+n,{localGoals:[{id:'goal',kind:'greeting',targetId:'p'}]});
 const newWorld=JSON.parse(JSON.stringify(c.GM));L.wake('turn');assert.equal(D.plans().length,12);const oldWorld=c.GM,before=JSON.stringify(oldWorld);c.GM=newWorld;L.wake('turn');c.drain();
 assert.equal(JSON.stringify(oldWorld),before);assert.equal(D.plans().length,25);assert.equal(c.apiAttempts.length,0);
});
test('existing arc planning keeps valid planning but discards stale idle dispatch and late results',async()=>{
 const c=world(),queue=[],hooks={};c.a.importance=90;c.P.ai.key='fixture-only';c.setTimeout=fn=>queue.push(fn);c.GameHooks={on:(k,fn)=>(hooks[k]||(hooks[k]=[])).push(fn)};c.AbortController=AbortController;c.load('tm-char-arcs.js');
 (hooks['enterGame:after']||[]).forEach(fn=>fn());c.GM={...c.GM};queue.splice(0).forEach(fn=>fn());assert.equal(c.apiAttempts.length,0,'old-world idle work must not call the model');
 let resolve;c.callAISmart=()=>new Promise(r=>{resolve=r;});const stale=c.CharArcs.advance();c.GM={...c.GM,turn:2,chars:c.GM.chars.map(x=>({...x}))};resolve(JSON.stringify({'甲':{arcStage:'stale',innerChange:'不可写入新世界的内容'}}));await stale;assert(!c.GM._charArcs);assert(!c.GM.chars[0].innerThought);
 c.callAISmart=async()=>JSON.stringify({'甲':{arcStage:'current'}});await c.CharArcs.advance();assert.equal(c.GM._charArcs['甲'].arcStage,'current','valid current-world major planning remains available');
 c.GM.turn=5;let abortedSignal;c.callAISmart=(prompt,tokens,opts)=>{abortedSignal=opts.signal;return new Promise(r=>{resolve=r;});};const cancelled=c.CharArcs.advance();c.CharArcs.abort();assert(abortedSignal.aborted);resolve(JSON.stringify({'甲':{arcStage:'cancelled'}}));await cancelled;assert.equal(c.GM._charArcs['甲'].arcStage,'current');
});
(async()=>{let passed=0,failed=0;for(const t of tests){try{await t.fn();passed++;console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;})();
