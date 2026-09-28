'use strict';
const assert=require('assert/strict'),{fixture}=require('./lib-npc-action-fixture');
const tests=[];function test(name,fn){tests.push({name,fn});}
test('a missing handler result never becomes applied',()=>{
  const c=fixture(),a=c.actor('a','甲');c.NpcBehaviorRegistry.register('missing',()=>{});
  assert.equal(c.execute(a,'missing'),false);assert.equal((c.GM._npcActionLedger||[]).some(x=>/applied|completed/.test(x.status)),false);
  assert.equal(c.TM.NPC.ActionLedger.isHandled(a.name,c.GM),false);
});
test('personality is a tendency rather than an action prohibition',()=>{
  const c=fixture(),a=c.actor('a','甲',{traitIds:['greedy','kind','honorable']});
  for(const type of ['reward','punish','declare_war'])assert.equal(c._validatePersonalityConsistency(a,{behaviorType:type,target:'外邦'}),true);
});
test('a commoner with a goal can be scheduled',()=>{
  const c=fixture(),a=c.actor('a','甲',{personalGoal:'向乙求教'});assert.equal(c.selectImportantNpcs([a]).includes(a),true);
});
test('a supplied world never falls back to another world',()=>{
  const c=fixture();c.actor('other','同名');assert.equal(c.TM.NPC.ActionLedger.findChar('同名',{chars:[]}),null);
});
test('a funding request cannot award itself money',()=>{
  const c=fixture(),a=c.actor('a','甲',{resources:{publicPurse:{money:5},publicTreasury:{balance:5,deficit:2000,isReadOnly:true}}});
  const before=JSON.stringify(a.resources);c.execute(a,'request_funds');assert.equal(JSON.stringify(a.resources),before);assert.equal(c.GM.guoku.money,1000);
});
function step(c,actor,plan,phase,extra={}){const d={actorId:actor.id,name:actor.name,behaviorType:'private_correspondence',planId:plan.id,phase,intent:'继续办理',...extra};return c.TM.NPC.ActionLedger.ingest(d,'test');}
function tick(c){c.GM.turn++;const r=c.TM.NPC.ActionLedger.advance(c.GM);assert.equal(r.ok,true,r.reason);}
function pair(c){return [c.actor('a','甲'),c.actor('b','乙')];}
function request(c,a,b,extra={}){const d={actorId:a.id,name:a.name,targetId:b.id,target:b.name,behaviorType:'private_correspondence',intent:'请协助整理书目',task:{kind:'document'},...extra};const r=c.TM.NPC.ActionLedger.ingest(d,'main_ai:npc_actions');assert.equal(r.outcome,'submitted',r.reason);return c.GM._npcPlans.find(p=>p.id===r.planId);}
test('real handler returns, rollback and report failure preserve truth',()=>{
 const c=fixture(),a=c.actor('a','甲');
 c.NpcBehaviorRegistry.register('broken',(actor)=>{actor.loyalty=1;throw Error('injected');});
 assert.equal(c.execute(a,'broken'),false);assert.equal(c.GM.chars[0].loyalty,80);assert.equal(c.GM._npcActionLedger.length,0);
 c.NpcBehaviorRegistry.register('noresult',(actor)=>{actor.loyalty=2;});assert.equal(c.execute(c.GM.chars[0],'noresult'),false);assert.equal(c.GM.chars[0].loyalty,80);
 c.addEB=()=>{throw Error('render failed');};assert.equal(c.execute(c.GM.chars[0],'petition',{actionId:'pet-1'}),true);assert.equal(c.execute(c.GM.chars[0],'petition',{actionId:'pet-1'}),false);assert.equal(c.GM.memorials.length,1);
});
test('stable action identity, phase spoofing and independent similar transfers',()=>{
 const c=fixture(),a=c.actor('a','甲',{resources:{privateWealth:{money:100}}}),b=c.actor('b','乙',{resources:{privateWealth:{money:10}}});
 const d={actionId:'gift-1',actorId:a.id,name:a.name,targetId:b.id,target:b.name,behaviorType:'reward',amount:30,intent:'赠书资'};
 assert.equal(c.TM.NPC.ActionLedger.ingest(d,'main').outcome,'completed');
 const memories=c.GM._memoryArchiveFull.length;
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d,phase:'another'},'agent').duplicate,true);assert.equal(c.GM._memoryArchiveFull.length,memories);
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d,amount:31},'retry').outcome,'blocked');
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d,actionId:'gift-2'},'agent').outcome,'completed');
 assert.equal(a.resources.privateWealth.money,40);assert.equal(b.resources.privateWealth.money,70);
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d,actionId:'gift-3',amount:50},'main').outcome,'blocked');assert.equal(c.GM.chars[0].resources.privateWealth.money,40);
});
test('official appointments require explicit scoped current power and write the actual seat',()=>{
 const c=fixture(),[a,b]=pair(c);c.GM.officeTree=[{id:'dept',name:'院',positions:[{id:'head',name:'主官',holderId:a.id,holder:a.name,powers:{}},{id:'vacant',name:'属官',actualCount:0,establishedCount:1,actualHolders:[]}]}];
 let d={actorId:a.id,name:a.name,targetId:b.id,target:b.name,behaviorType:'appoint',positionId:'vacant',actingPositionId:'head',intent:'任命'};
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d},'main').outcome,'blocked');assert.equal(c.TM.OfficeHolderState.read(c.GM,c.GM.officeTree[0].positions[1]).actualCount,0);
 c.GM.officeTree[0].positions[0].powers.appointment=true;
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d},'main').outcome,'completed');assert.equal(c.TM.OfficeHolderState.read(c.GM,c.GM.officeTree[0].positions[1]).primary.id,b.id);
  assert(c.GM.chars.find(x=>x.id===b.id)._memory.some(m=>m.factStatus==='verified_operation'&&m.sourceRefs.some(r=>r.positionId==='vacant')));
 assert.equal(c.GM.chars.find(x=>x.id===b.id).officialTitle,'属官');
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d,behaviorType:'dismiss'},'main').outcome,'completed');assert.equal(c.TM.OfficeHolderState.read(c.GM,c.GM.officeTree[0].positions[1]).actualCount,0);
});
test('two commoners request, respond, deliver, feed back and retain separate knowledge',()=>{
 const c=fixture(),[a,b]=pair(c),p=request(c,a,b);
 assert.equal((b._memory||[]).length,0,'undelivered material is unknown');assert.equal(c.TM.NPC.ActionLedger.planView(p,b),null);
 tick(c);assert.equal(p.status,'awaiting_response');assert.equal(c.TM.NPC.ActionLedger.due(b,c.GM),true);
 assert.equal(step(c,b,p,'respond',{response:'accept',content:'可以，明日整理'}).outcome,'submitted');
 assert.equal(c.TM.NPC.ActionLedger.planView(p,a).stage,'awaiting_delivery','private response not yet known');
 tick(c);assert.equal(p.status,'ready');assert.equal(step(c,b,p,'perform',{content:'书目甲乙丙'}).outcome,'waiting');
 tick(c);assert.equal(step(c,b,p,'perform',{content:'书目甲乙丙'}).outcome,'submitted');
 tick(c);assert.equal(p.status,'awaiting_feedback');assert.equal(step(c,a,p,'feedback',{content:'已收到，书目有用',evaluation:'satisfied'}).outcome,'completed');
 tick(c);assert.equal(p.status,'done');assert.equal(p.steps.length,1);assert.equal(a._eventOpinions.length,1);assert.equal((b._eventOpinions||[]).length,0);
 assert(a._memory.some(m=>m.sourceRefs.some(s=>s.planId===p.id)));assert(b._memory.some(m=>m.sourceRefs.some(s=>s.planId===p.id)));
});
test('rejection, conditions, cancellation and unavailable delivery stay distinct',()=>{
 for(const response of ['reject','conditions','defer','partial']){
  const c=fixture(),[a,b]=pair(c),p=request(c,a,b);tick(c);assert.equal(step(c,b,p,'respond',{response,content:response,terms:'仅整理首卷',dueTurn:8}).outcome,'submitted');tick(c);
  if(response==='reject'){assert.equal(p.status,'rejected');assert.equal(p.progress,0);}
  else {assert.equal(p.status,'awaiting_agreement');assert.equal(step(c,a,p,'agree',{response:'accept'}).outcome,'submitted');tick(c);assert.equal(p.status,'ready');assert.equal(p.nextTurn,8);}
 }
 const c=fixture(),[a,b]=pair(c),p=request(c,a,b);b._missing=true;tick(c);assert.equal(p.messages[0].status,'in_transit');assert.equal((b._memory||[]).length,0);b._missing=false;tick(c);
 assert.equal(step(c,a,p,'cancel',{content:'计划有变'}).outcome,'submitted');tick(c);assert.equal(p.status,'cancelled');assert.equal(p.progress,0);
});
test('a player can receive a request but only an explicit response supplies consent',()=>{
 const c=fixture(),a=c.actor('a','甲'),b=c.actor('p','君主',{isPlayer:true}),other=c.actor('z','丙'),p=request(c,a,b);tick(c);
 assert(c.GM.letters.some(l=>l.npcPlanId===p.id));assert.equal(step(c,b,p,'respond',{response:'accept'}).outcome,'blocked');assert.equal(p.status,'awaiting_response');
 request(c,a,other);assert.equal(c.GM._npcPlans.length,2,'one request does not lock an actor');
 assert.equal(c.TM.NPC.ActionLedger.playerRespond(p.id,'conditions','待明日再议').outcome,'submitted');tick(c);assert.equal(p.status,'awaiting_agreement');
});
test('bounded rotation includes more commoners than the context budget',()=>{
 const c=fixture();for(let i=0;i<35;i++)c.actor('c'+i,'人物'+i,{personalGoal:'求教'});
 const seen=new Set();for(let t=0;t<4;t++){const chosen=c.selectImportantNpcs(c.GM.chars);assert(chosen.length<=10);chosen.forEach(x=>seen.add(x.id));c.GM.turn++;}assert.equal(seen.size,35);
});
test('the real name-keyed commitment ledger wakes its stable owner near the deadline',()=>{
 const c=fixture(),a=c.actor('a','书生'),b=c.actor('b','旁人');c.GM.turn=4;
 c.GM._npcCommitments={'书生':[{id:'due-order',actorId:a.id,task:'复核文书',assignedTurn:2,deadline:3,status:'executing'}],'旁人':[{id:'secret-order',actorId:b.id,task:'PRIVATE_COMMITMENT',assignedTurn:2,deadline:3,status:'pending'}]};
 assert(c.selectImportantNpcs([a]).includes(a));assert.equal(c.buildNpcBehaviorContext(a).commitments[0].id,'due-order');assert(!JSON.stringify(c.buildNpcBehaviorContext(a)).includes('PRIVATE_COMMITMENT'));
 c.GM._npcCommitments['书生'][0].status='completed';assert.equal(c.TM.NPC.ActionLedger.due(a,c.GM),false);
});
test('active plans exceed display limits and reload retains receipt idempotence',()=>{
 const c=fixture(),[a,b]=pair(c);let first;
 for(let i=0;i<165;i++){const p=request(c,a,b,{actionId:'many-'+i});if(!first)first=p.id;}
 assert.equal(c.GM._npcPlans.length,165);c.GM=JSON.parse(JSON.stringify(c.GM));c.TM.NPC.ActionLedger.migrate(c.GM);tick(c);
 assert.equal(c.GM._npcPlans.find(p=>p.id===first).status,'awaiting_response');assert.equal(c.GM._npcPlans.length,165);
 const replay=c.TM.NPC.ActionLedger.ingest({actionId:'many-0',actorId:'a',targetId:'b',target:'乙',behaviorType:'private_correspondence',intent:'请协助整理书目',task:{kind:'document'}},'retry');assert.equal(replay.duplicate,true);
});
test('invalid IDs, namesakes and renamed people never fall back by name',()=>{
 const c=fixture(),a=c.actor('a','同名'),b=c.actor('b','同名'),z=c.actor('z','乙');
 assert.equal(c.TM.NPC.ActionLedger.findChar('同名',c.GM),null);assert.equal(c.TM.NPC.ActionLedger.findChar({id:'invalid',name:'同名'},c.GM),null);
 assert.equal(c.TM.NPC.ActionLedger.ingest({actorId:'invalid',name:'同名',behaviorType:'petition',intent:'请求'},'main').outcome,'blocked');
 const p=request(c,a,z);a.name='改名';tick(c);assert.equal(c.TM.NPC.ActionLedger.planView(p,a).actorId,'a');assert.equal((b._memory||[]).length,0);
});
test('only current actor knowledge reaches the final model prompt',async()=>{
 const c=fixture(),[a,b]=pair(c);a.innerThought='SECRET_A';b.innerThought='SECRET_B';b.personalGoal='SECRET_GOAL';
 c.GM._npcInternalActionHistory=[{from:b.name,to:'旁人',intent:'SECRET_HIDDEN',visibility:'hidden',turn:2}];
 assert(!JSON.stringify(c.buildNpcBehaviorContext({...a,innerThought:'OLD_WORLD_PRIVATE'})).includes('OLD_WORLD_PRIVATE'));
 c.extractJSON=JSON.parse;let prompts=[];c.callAI=async p=>{prompts.push(p);return '[]';};
 await c.batchNpcDecisions([a,b],c.buildNpcBehaviorContext());assert(!prompts[0].includes('SECRET_'));
 await c.batchNpcDecisions([a],c.buildNpcBehaviorContext(a),{privateActorId:a.id});assert(prompts[1].includes('SECRET_A'));assert(!prompts[1].includes('SECRET_B'));assert(!prompts[1].includes('SECRET_HIDDEN'));
 const p=request(c,b,a,{content:'SECRET_TRANSMITTED'});await c.batchNpcDecisions([a],null,{privateActorId:a.id});assert(!prompts.at(-1).includes('SECRET_TRANSMITTED'));tick(c);await c.batchNpcDecisions([a],null,{privateActorId:a.id});assert(prompts.at(-1).includes('SECRET_TRANSMITTED'));
});
test('an AI response from another world cannot write back',async()=>{
 const c=fixture(),a=c.actor('a','甲',{personalGoal:'求教'});c.extractJSON=JSON.parse;let release;c.callAI=()=>new Promise(r=>release=r);
 const pending=c.executeNpcBehaviors();assert.equal(typeof release,'function');const fresh={sid:'new',turn:2,chars:[],facs:[],armies:[],vars:{},rels:{},officeTree:[]};c.GM=fresh;c._tmLoadGen=4;
 release(JSON.stringify([{actorId:a.id,name:a.name,behaviorType:'petition',intent:'过期'}]));const r=await pending;assert.equal(r.skipped,'expired');assert.equal(fresh.memorials,undefined);assert.equal(fresh._npcActionState,undefined);
});
test('background thinking cannot execute money or duty in real waiting time',()=>{
 const c=fixture(),a=c.actor('a','甲',{resources:{privateWealth:{money:100}}}),b=c.actor('b','乙',{resources:{privateWealth:{money:0}}});
 const d={actorId:a.id,name:a.name,targetId:b.id,target:b.name,actionId:'idle-transfer',behaviorType:'reward',amount:20};
 c._executeNormalizedNpcDecision(d,a,c.buildNpcBehaviorContext(a),{idle:true});assert.equal(a.resources.privateWealth.money,100);assert.equal(c.TM.NPC.ActionLedger.flushDeferred(),0);
 tick(c);assert.equal(c.TM.NPC.ActionLedger.flushDeferred(),1);assert.equal(a.resources.privateWealth.money,80);assert.equal(c.TM.NPC.ActionLedger.flushDeferred(),0);
});
function treasuryFixture(){
 const c=fixture(),a=c.actor('a','主管'),b=c.actor('b','经办');const box=n=>({stock:n,available:n,quota:100,used:0});
 c.GM.officeTree=[{id:'d',name:'度支',publicTreasury:{money:box(100),grain:box(0),cloth:box(0)},positions:[{id:'supervisor',name:'主管',holderId:a.id,holder:a.name,powers:{supervise:true}},{id:'cashier',name:'经办',holderId:b.id,holder:b.name,powers:{treasurySpend:true},treasuryBinding:{accountRef:'dept',role:'custodian'}}]}, {id:'receiver',name:'赈署',publicTreasury:{money:box(0),grain:box(0),cloth:box(0)},positions:[]}];
 c.GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:[{id:'dept',kind:'physical',factionId:'朝廷',source:{kind:'department',id:'d'}},{id:'relief',kind:'physical',factionId:'朝廷',source:{kind:'department',id:'receiver'}}]};return {c,a,b};
}
test('official request, response, authorized account operation and reform revalidation',()=>{
 const {c,a,b}=treasuryFixture(),p=request(c,a,b,{behaviorType:'office_duty',actingPositionId:'supervisor',intent:'请核实赈款并移交',task:{kind:'public_transfer',fromAccount:'dept',toAccount:'relief',amounts:{money:30}}});
 tick(c);assert.equal(step(c,b,p,'respond',{response:'accept',actingPositionId:'cashier',content:'已核材料，承办'}).outcome,'submitted');assert.equal(p.messages[1].data.materials.accounts[0].resources.money.stock,100);tick(c);tick(c);
 c.GM.officeTree[0].positions[1].powers.treasurySpend=false;
 assert.equal(step(c,b,p,'perform').outcome,'waiting');assert.equal(c.GM.officeTree[0].publicTreasury.money.stock,100);assert.equal(p.steps.length,0);assert(b._memory.length>0);
 c.GM.officeTree[0].positions[1].powers.treasurySpend=true;tick(c);
 const result=step(c,b,p,'perform',{actionId:'verified-transfer'});assert.equal(result.outcome,'completed',result.reason);
 assert.equal(c.GM.officeTree[0].publicTreasury.money.stock,70);assert.equal(c.GM.officeTree[1].publicTreasury.money.stock,30);
 tick(c);assert.equal(step(c,a,p,'feedback',{content:'移交核实'}).outcome,'completed');tick(c);assert.equal(p.status,'done');assert.equal(c.GM._publicTreasuryTransfers.length,1);
});
test('public transfer failure is atomic and custody is not spending permission',()=>{
 const {c,a,b}=treasuryFixture();const d={name:b.name,actorId:b.id,behaviorType:'office_duty',step:'transfer',actingPositionId:'cashier',fromAccount:'dept',toAccount:'relief',amounts:{money:101},purpose:'移交'};
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d},'main').outcome,'blocked');assert.equal(c.GM.officeTree[0].publicTreasury.money.stock,100);
 c.GM.officeTree[0].positions[1].treasuryBinding.role='oversight';assert.equal(c.TM.NPC.ActionLedger.ingest({...d,amounts:{money:10}},'main').outcome,'blocked');
 c.GM.officeTree[0].positions[1].treasuryBinding.role='custodian';const transfer=c.TM.PublicTreasury.transfer;c.TM.PublicTreasury.transfer=o=>transfer({...o,_faultInjector(){throw Error('injected debit failure');}});
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d,amounts:{money:10}},'main').outcome,'blocked');assert.equal(c.GM.officeTree[0].publicTreasury.money.stock,100);assert.equal(c.GM.officeTree[1].publicTreasury.money.stock,0);
});
test('narrowed account scope applies inside the same faction',()=>{
 const {c,b}=treasuryFixture();c.GM.officeTree[0].positions[1].authorityScope={accountRefs:['dept']};
 const r=c.TM.NPC.ActionLedger.ingest({actorId:b.id,behaviorType:'office_duty',step:'transfer',actingPositionId:'cashier',fromAccount:'dept',toAccount:'relief',amounts:{money:10},purpose:'移交'},'test');
 assert.equal(r.reason,'destination_scope_denied');assert.equal(c.GM.officeTree[0].publicTreasury.money.stock,100);assert.equal(c.GM.officeTree[1].publicTreasury.money.stock,0);
});
test('a made-up completion reference is rolled back',()=>{
 const c=fixture(),[a,b]=pair(c);c.NpcBehaviorRegistry.register('forged',(actor)=>{actor.loyalty=1;return {outcome:'completed',operationRefs:[{kind:'public_transfer',id:'invented'}]};});
 const d={actorId:a.id,behaviorType:'forged',receiptId:'invented'};assert.equal(c.TM.NPC.ActionLedger.ingest(d,'agent').outcome,'failed');assert.equal(c.GM.chars[0].loyalty,80);assert.equal(c.GM._npcActionLedger.length,0);
});
test('legacy completion records migrate without replay and active intentions can be replanned',()=>{
 const c=fixture(),[a,b]=pair(c);c.GM._npcActionLedger=[{id:'legacy',actor:a.name,status:'applied',behaviorType:'reward'}];c.GM._npcPlans=[{id:'legacy-plan',actor:a.name,target:b.name,type:'build_network',progress:8,status:'active',intent:'共同整理书目'}];
 c.TM.NPC.ActionLedger.migrate(c.GM);assert.equal(c.GM._npcActionLedger[0].status,'legacy_reported');assert.equal(Object.keys(c.GM._npcActionState.receipts).length,0);assert.equal(a.resources,undefined);
 assert.equal(c.buildNpcBehaviorContext(a).plans[0].nextPhase,'replan');
 const r=step(c,a,c.GM._npcPlans[0],'replan',{targetId:b.id,target:b.name});assert.equal(r.outcome,'submitted');assert.equal(c.GM._npcPlans.length,1);assert.equal(c.GM._npcPlans[0].progress,0);assert.equal(c.GM._npcPlans[0].legacyEvidence.progress,8);
});
test('pending duty transfers to the actual new holder through a new request',()=>{
 const {c,a,b}=treasuryFixture(),newHolder=c.actor('new','新库吏'),p=request(c,a,b,{task:{kind:'public_transfer',fromAccount:'dept',toAccount:'relief',amounts:{money:10}}});
 tick(c);step(c,b,p,'respond',{response:'accept',actingPositionId:'cashier'});tick(c);const seat=c.GM.officeTree[0].positions[1],money=c.GM.officeTree[0].publicTreasury.money.stock;
 c._offVacatePersonSlot(seat,b,'transfer',c.GM);c._offAppointCharacter(seat,newHolder,{world:c.GM});
 assert.equal(step(c,a,p,'handoff').outcome,'submitted');assert.equal(p.targetId,newHolder.id);assert.equal(p.status,'in_transit');assert.equal(c.GM.officeTree[0].publicTreasury.money.stock,money);assert(b._memory.length>0);tick(c);assert.equal(p.status,'awaiting_response');assert.equal(p.nextActorId,newHolder.id);
});
test('concurrent roles and expired appointments cannot supply implied authority',()=>{
 const {c,a,b}=treasuryFixture();c.GM.officeTree[0].positions.push({id:'extra',name:'兼任',holderId:b.id,holder:b.name,powers:{supervise:true}});
 const d={actorId:b.id,behaviorType:'office_duty',step:'transfer',fromAccount:'dept',toAccount:'relief',amounts:{money:5},purpose:'交割'};
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d},'test').outcome,'blocked');
 c.GM.officeTree[0].positions[1].expiresTurn=c.GM.turn;assert.equal(c.TM.NPC.ActionLedger.ingest({...d,actingPositionId:'cashier'},'test').outcome,'blocked');assert.equal(c.GM.officeTree[0].publicTreasury.money.stock,100);
});
test('quota and accepted partial terms cap the actual transfer',()=>{
 const {c,a,b}=treasuryFixture(),p=request(c,a,b,{task:{kind:'public_transfer',fromAccount:'dept',toAccount:'relief',amounts:{money:30}}});
 tick(c);step(c,b,p,'respond',{response:'partial',actingPositionId:'cashier',task:{kind:'public_transfer',fromAccount:'dept',toAccount:'relief',amounts:{money:10}},terms:'只能交割十贯'});tick(c);step(c,a,p,'agree',{response:'accept'});tick(c);
 assert.equal(step(c,b,p,'perform',{actingPositionId:'cashier'}).outcome,'completed');assert.equal(c.GM.officeTree[1].publicTreasury.money.stock,10);
 c.GM.officeTree[0].publicTreasury.money.quota=15;
 const r=c.TM.NPC.ActionLedger.ingest({actorId:b.id,behaviorType:'office_duty',step:'transfer',actingPositionId:'cashier',fromAccount:'dept',toAccount:'relief',amounts:{money:10},purpose:'再次交割'},'test');assert.equal(r.outcome,'blocked');assert.equal(c.GM.officeTree[1].publicTreasury.money.stock,10);
});
test('death, role and resource changes during generation are checked at commit',async()=>{
 for(const change of ['death','resource','role']){
  const {c,a,b}=treasuryFixture();b.personalGoal='办理移交';c.extractJSON=JSON.parse;let release;c.callAI=()=>new Promise(r=>release=r);
  const pending=c.executeNpcBehaviors();assert.equal(typeof release,'function');
  if(change==='death')b.alive=false;
  if(change==='resource'){c.GM.officeTree[0].publicTreasury.money.stock=0;c.GM.officeTree[0].publicTreasury.money.available=0;}
  if(change==='role')c.GM.officeTree[0].positions[1].powers.treasurySpend=false;
  // Only the first private call is held; later public work is empty.
  c.callAI=async()=> '[]';release(JSON.stringify([{actorId:b.id,name:b.name,behaviorType:'office_duty',step:'transfer',actingPositionId:'cashier',fromAccount:'dept',toAccount:'relief',amounts:{money:10},purpose:'移交'}]));await pending;
  assert.equal(c.GM.officeTree[1].publicTreasury.money.stock,0);assert.equal((c.GM._publicTreasuryTransfers||[]).length,0);
 }
});
test('an exception after delivery rolls back money, memory and receipts together',()=>{
 const c=fixture(),a=c.actor('a','甲',{resources:{privateWealth:{money:100}}}),b=c.actor('b','乙',{resources:{privateWealth:{money:0}}});
 c.NpcBehaviorRegistry.register('fault',(actor,target,d)=>{c._npcReward(actor,target,d);throw Error('after-delivery');});
 assert.equal(c.TM.NPC.ActionLedger.ingest({actorId:a.id,targetId:b.id,behaviorType:'fault',amount:20},'test').outcome,'failed');assert.equal(c.GM.chars[0].resources.privateWealth.money,100);assert.equal(c.GM.chars[1].resources.privateWealth.money,0);assert.equal((c.GM._memoryArchiveFull||[]).length,0);assert.equal(c.GM._npcActionLedger.length,0);
});
test('bounded plan retrieval rotates without dropping unselected obligations',async()=>{
 const c=fixture(),[a,b]=pair(c);for(let i=0;i<25;i++)request(c,a,b,{actionId:'rotate-'+i});tick(c);c.extractJSON=JSON.parse;const seen=new Set();c.callAI=async text=>{for(const p of c.buildNpcBehaviorContext(b).plans)seen.add(p.id);return '[]';};
 // Capture the actual packet, before exposure moves the retrieval cursor.
 c.callAI=async text=>{for(const id of text.match(/plan:rotate-\d+/g)||[])seen.add(id);return '[]';};
 for(let i=0;i<4;i++){await c.batchNpcDecisions([b],null,{privateActorId:b.id});c.GM.turn++;}
 assert.equal(seen.size,25);assert.equal(c.GM._npcPlans.length,25);assert(c.buildNpcBehaviorContext(b).plans.length<=8);
});
test('a player can deliberately deliver a promised document without automatic choice',()=>{
 const c=fixture(),a=c.actor('a','甲'),b=c.actor('p','君主',{isPlayer:true}),p=request(c,a,b);tick(c);c.TM.NPC.ActionLedger.playerRespond(p.id,'accept','容我整理');tick(c);tick(c);
 assert.equal(p.steps.length,0);assert.equal(c.TM.NPC.ActionLedger.playerRespond(p.id,'deliver','亲拟文书').outcome,'submitted');tick(c);assert.equal(p.status,'awaiting_feedback');assert.equal(p.steps.length,1);
});
test('gift delivery requires contact and a living recipient',()=>{
 const c=fixture(),a=c.actor('a','甲',{resources:{privateWealth:{money:100}}}),b=c.actor('b','乙',{location:'远方',resources:{privateWealth:{money:0}}});
 const d={actorId:a.id,targetId:b.id,behaviorType:'reward',amount:10};
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d},'test').reason,'physical_handover_requires_contact');
 c.GM.chars[1].location='京师';c.GM.chars[1].dead=true;
 assert.equal(c.TM.NPC.ActionLedger.ingest({...d},'test').outcome,'blocked');assert.equal(c.GM.chars[0].resources.privateWealth.money,100);assert.equal(c.GM.chars[1].resources.privateWealth.money,0);
});
test('untrusted action identifiers cannot reach letter button identifiers',()=>{
 const c=fixture(),[a,b]=pair(c);
 assert.equal(c.TM.NPC.ActionLedger.ingest({actionId:"bad');alert(1)//",actorId:a.id,targetId:b.id,behaviorType:'private_correspondence',intent:'来信'},'test').reason,'invalid_action_id');
 assert.equal(c.GM._npcPlans.length,0);
 const p=request(c,a,b);assert.match(p.messages[0].id,/^npcmsg:\d+$/);
});
(async()=>{let failed=0;for(const t of tests){try{await t.fn();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+': '+e.message);}}
console.log(JSON.stringify({tests:tests.length,failed}));if(failed)process.exitCode=1;})();
