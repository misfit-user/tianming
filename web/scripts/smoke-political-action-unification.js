'use strict';
const assert=require('assert/strict'),{politicalFixture}=require('./lib-political-action-fixture');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
test('an unbound faction candidate cannot mint treasury money',()=>{
  const c=politicalFixture();c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'fiscal_policy',treasuryDelta:500,source:'system'}]});
  assert.equal(c.fa.treasury.money,100);
});
test('one sided diplomacy cannot create a bilateral treaty',()=>{
  const c=politicalFixture();c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'diplomacy',targetFaction:'乙国',treaty:'同盟',relationType:'alliance'}]});
  assert.equal((c.GM.treaties||[]).length,0);
});
test('current office identity can be resolved in another NPC government',()=>{
  const c=politicalFixture();const seat=c._npcPosition('vb',{organizationId:'fb'},c.GM);
  assert(seat);assert.equal(seat.pos,c.fb.officeTree[0].positions[1]);
});
test('an old war cannot act as the receipt for a new decision',()=>{
  const c=politicalFixture();c.GM.activeWars=[{id:'old-war',attacker:'甲国',defender:'乙国'}];
  const r=c.TM.NPC.ActionLedger.execute(c.a,{actionId:'fake-new-war',actorId:'a',behaviorType:'declare_war',targetId:'fb'},null,()=>c.TM.NPC.ActionLedger.result('started','pretended',[{kind:'war',id:'old-war'}]));
  assert.equal(r.outcome,'failed');
});
test('normal legacy fiscal settlement has one owner per simulation period',()=>{
  const c=politicalFixture();c.fa.derivedEconomy={annualTaxIncome:12000,annualMilitaryCost:1200};
  c.TM.FactionNpcGuoku.generate();const once=c.fa.treasury.money;c.TM.FactionNpcGuoku.generate();
  assert.equal(c.fa.treasury.money,once);assert.equal(once,1000);
});
test('an authorized person appoints inside the other government through the faction entry',()=>{
  const c=politicalFixture(),opts={actorId:'b',actingPositionId:'pb',sourceId:'origin:office:1'};
  const decision={actions:[{type:'office_change',kind:'appoint',targetId:'s',target:'候选者',positionId:'vb'}]};
  const first=c.TM.FactionActionEngine.applyDecision(c.fb,decision,opts);
  assert.equal(first.actions,1,JSON.stringify(first));assert.equal(c.fb.officeTree[0].positions[1].holderId,'s');assert.equal(c.GM.officeTree.length,0);
  const second=c.TM.FactionActionEngine.applyDecision(c.fb,decision,opts);assert.equal(second.mergedActions,1);assert.equal(c.subject._memory.length,1);
  const receipt=first.results[0],reportedId=c.fb._npcLlmActionLedger[c.fb._npcLlmActionLedger.length-1].actionId;assert.equal(reportedId,receipt.actionId,'faction report projects the canonical operation ID');const asPerson=c.NpcBehaviorRegistry.execute(c.b,{actionId:reportedId,actorId:'b',organizationId:'fb',actingPositionId:'pb',behaviorType:'appoint',targetId:'s',target:'候选者',positionId:'vb',targetType:'character'});
  assert.equal(asPerson.duplicate,true,JSON.stringify({asPerson,receipt:c.TM.NPC.ActionLedger.state(c.GM).receipts[JSON.stringify([receipt.actionId,'execute'])]}));assert.equal(c.subject._memory.length,1);
});
test('two faction and personal candidates compete for one real public account',()=>{
  const c=politicalFixture(),box=n=>({stock:n,available:n,quota:n,used:0});
  c.fa.treasury.ledgers={money:box(100),grain:box(80),cloth:box(20)};c.fb.treasury.ledgers={money:box(70),grain:box(40),cloth:box(10)};
  c.GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:[{id:'qa',kind:'physical',factionId:'fa',source:{kind:'faction',id:'fa'}},{id:'qb',kind:'physical',factionId:'fb',source:{kind:'faction',id:'fb'}}]};
  Object.assign(c.fa.officeTree[0].positions[0],{treasuryBinding:{accountRef:'qa',role:'custodian'},authorityScope:{accountRefs:['qb']}});
  const raw={type:'fiscal_policy',fromAccount:'qa',toAccount:'qb',amounts:{money:60},purpose:'约定周转',actingPositionId:'pa'};
  const r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[raw]},{actorId:'a',sourceId:'origin:funds:1'});
  assert.equal(r.actions,1,JSON.stringify(r));assert.equal(c.fa.treasury.money,40);assert.equal(c.fb.treasury.money,130);
  const other=c.NpcBehaviorRegistry.execute(c.a,{actionId:'independent-transfer',actorId:'a',organizationId:'fa',behaviorType:'office_duty',step:'transfer',...raw});
  assert.equal(other.outcome,'blocked');assert.equal(c.fa.treasury.money+c.fb.treasury.money,170);
  assert.equal(c.GM._publicTreasuryTransfers.length,1);
});
test('a liaison, two actual representatives and a counteroffer produce one effective alliance',()=>{
  const c=politicalFixture(),D=c.TM.FactionDiplomacy,B=c.TM.PoliticalActions;
  const binding=(f,a,id)=>B.bind(f,a,{sourceId:id});
  const proposed=D.recordProposals(c.fa,[{toFactionId:'fb',type:'alliance',terms:'完整条款：双方受到进攻时共同防御。'.repeat(12)}],c.GM.turn,{binding:binding(c.fa,'l','liaison:1')});
  assert.equal(proposed.recorded,1,JSON.stringify(proposed));const p=D.get(proposed.results[0].proposalId);
  assert.equal(p.status,'draft');assert.equal(p.decisions.length,0);assert.equal((c.GM.treaties||[]).length,0);
  D.advance();assert.equal(p.knowledge.a,1);assert.equal(p.knowledge.b,undefined);
  let r=D.applyResponses(c.fa,[{proposalId:p.id,proposalVersion:1,decision:'approve',actingPositionId:'pa'}],c.GM.turn,{binding:binding(c.fa,'a','rep-a:1')});
  assert.equal(r.submitted,1,JSON.stringify(r));D.advance();assert.equal(p.knowledge.b,1);
  r=D.applyResponses(c.fb,[{proposalId:p.id,proposalVersion:1,decision:'counter',actingPositionId:'pb',counterTerms:'仅限外部侵略时共同防御；各守本国公库。',durationTurns:8}],c.GM.turn,{binding:binding(c.fb,'b','rep-b:1')});
  assert.equal(r.submitted,1,JSON.stringify(r));assert.equal(p.version,2);D.advance();
  r=D.applyResponses(c.fa,[{proposalId:p.id,proposalVersion:1,decision:'accept',actingPositionId:'pa'}],c.GM.turn,{binding:binding(c.fa,'a','stale:1')});assert.equal(r.results[0].reason,'proposal_version_mismatch');
  r=D.applyResponses(c.fa,[{proposalId:p.id,proposalVersion:2,decision:'accept',actingPositionId:'pa'}],c.GM.turn,{binding:binding(c.fa,'a','rep-a:2')});
  assert.equal(r.resolved,1,JSON.stringify(r));assert.equal(c.GM.treaties.length,1);assert.equal(c.TreatySystem.hasTreaty('甲国','乙国','alliance'),true);
  const treaty=c.GM.treaties[0];assert.equal(treaty.proposalVersion,2);assert.equal(treaty.effectiveTurn,c.GM.turn);assert.equal(treaty.terms.text,p.terms);assert(p.versions[0].terms.text.length>60);
  c.GM.facs.push({id:'fc',name:'丙国'});const war=c.CasusBelliSystem.declareWar('丙国','甲国');assert.equal(war.success,true);assert(c.GM.activeWars.some(w=>w.defender==='乙国'&&w._alliedWar));
});
test('the existing envoy approval button consumes the canonical decision once',()=>{
  const c=politicalFixture(),D=c.TM.FactionDiplomacy;c.load('tm-negotiation.js');c.load('tm-wendui.js');
  c.b.isPlayer=true;c.fb.isPlayer=true;c.GM.playerInfo={characterId:'b',factionId:'fb'};c.b.location='异地';c.P.conf.negotiationEnabled=true;
  let oldEffects=0;c.setFactionRelation=()=>oldEffects++;c.toast=()=>{};c.closeWenduiModal=()=>{};c.setTimeout=()=>0;c._$=()=>null;
  const r=D.recordProposals(c.fa,[{toFactionId:'fb',type:'alliance',terms:'相约共同防御'}],c.GM.turn,{binding:c.TM.PoliticalActions.bind(c.fa,'a',{actingPositionId:'pa',sourceId:'to-player'})});
  const p=D.get(r.results[0].proposalId);D.advance();assert.equal(p.knowledge.b,undefined);assert.equal((c.GM._pendingAudiences||[]).length,0);
  c.GM.turn++;D.advance();assert.equal(p.knowledge.b,1);assert.equal(c.GM.treaties,undefined);
  const q=c.GM._pendingAudiences[0],envoy=c.actor('envoy','甲国使节',{...q,_envoy:true,faction:'甲国'});c.GM.wenduiTarget=envoy.name;
  c._wdEnvoyDecision('accept');assert.equal(c.GM.treaties.length,1);assert.equal(oldEffects,0);
  c._wdEnvoyDecision('accept');assert.equal(c.GM.treaties.length,1);assert.equal(oldEffects,0);
});
test('a valid signed document survives its issuer but new signatures require current office',()=>{
  const c=politicalFixture(),D=c.TM.FactionDiplomacy,B=c.TM.PoliticalActions;
  const r=D.recordProposals(c.fa,[{toFactionId:'fb',type:'alliance',terms:'共同防御'}],c.GM.turn,{binding:B.bind(c.fa,'a',{actingPositionId:'pa',sourceId:'in-flight'})});
  const p=D.get(r.results[0].proposalId);c.a.alive=false;D.advance();
  const binding=B.bind(c.fb,'b',{actingPositionId:'pb',sourceId:'signature-b'});c.fb.officeTree[0].positions[0].powers.treatySign=false;
  let reply=D.applyResponses(c.fb,[{proposalId:p.id,proposalVersion:1,decision:'accept'}],c.GM.turn,{binding});assert.equal(reply.results[0].outcome,'blocked');assert.equal(c.GM.treaties,undefined);
  c.GM.facs.find(f=>f.id==='fb').officeTree[0].positions[0].powers.treatySign=true;
  reply=D.applyResponses(c.fb,[{proposalId:p.id,proposalVersion:1,decision:'accept'}],c.GM.turn,{binding});assert.equal(reply.resolved,1);assert.equal(c.GM.treaties[0].active,true);
});
test('negotiating authority permits talks and directs ratification to a signer',()=>{
  const c=politicalFixture(),D=c.TM.FactionDiplomacy,B=c.TM.PoliticalActions;
  c.fa.officeTree[0].positions[0].powers.treatySign=false;
  const signer=c.actor('z','甲国签署者',{factionId:'fa',faction:'甲国',officialTitle:'签署官'});c.fa.officeTree[0].positions.push({id:'ps',name:'签署官',holderId:signer.id,powers:{treatySign:true}});
  const r=D.recordProposals(c.fa,[{toFactionId:'fb',type:'alliance',terms:'约定共同防御'}],c.GM.turn,{binding:B.bind(c.fa,'a',{actingPositionId:'pa',sourceId:'talks'})}),p=D.get(r.results[0].proposalId);
  assert.equal(p.decisions.length,0);D.advance();
  let reply=D.applyResponses(c.fb,[{proposalId:p.id,proposalVersion:1,decision:'accept'}],c.GM.turn,{binding:B.bind(c.fb,'b',{actingPositionId:'pb',sourceId:'b-sign'})});
  assert.equal(reply.resolved,0);assert.equal(p.recipientId,'z');assert.equal(c.GM.treaties,undefined);D.advance();
  reply=D.applyResponses(c.fa,[{proposalId:p.id,proposalVersion:1,decision:'accept'}],c.GM.turn,{binding:B.bind(c.fa,'z',{actingPositionId:'ps',sourceId:'ratify'})});assert.equal(reply.resolved,1);
});
test('a real custodian executes a scoped command without generating soldiers',()=>{
  const c=politicalFixture();c.load('tm-command-authority.js');c.fa.officeTree[0].positions[0].powers.militaryCommand=true;
  c.GM.armies=[{id:'army-a',name:'甲军',faction:'甲国',commanderId:'a',commander:'甲代表',soldiers:100,location:'京师',commandChain:{mode:'receipt',custodians:[{characterId:'a'}]}}];
  let r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'military_order',armyId:'army-a',commanderId:'l'}]},{actorId:'a',actingPositionId:'pa',sourceId:'mil:1'});
  assert.equal(r.actions,1,JSON.stringify(r));assert.equal(c.GM.armies[0].commanderId,'l');assert.equal(c.GM.armies[0].soldiers,100);
  r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'military_order',armyId:'army-a',soldiersDelta:500}]},{actorId:'a',actingPositionId:'pa',sourceId:'mil:2'});
  assert.equal(r.actions,0);assert.equal(c.GM.armies[0].soldiers,100);
});
test('orders wait for the actual custodian and then enter the real march process',()=>{
  const c=politicalFixture();c.load('tm-command-authority.js');c.load('tm-military.js');c.fa.officeTree[0].positions[0].powers.militaryCommand=true;
  c.GM.provinces=[{id:'capital',name:'京师'},{id:'border',name:'边关'}];
  c.GM.armies=[{id:'army-a',name:'甲军',faction:'甲国',commanderId:'l',commander:'联络人',soldiers:100,location:'京师',state:'garrison',commandChain:{mode:'receipt',custodians:[{characterId:'l'}],dispatchDays:0}}];
  let r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'military_order',armyId:'army-a',destinationId:'border'}]},{actorId:'a',actingPositionId:'pa',sourceId:'march:request'});
  assert.equal(r.results[0].outcome,'waiting',JSON.stringify(r));assert.equal(c.GM.armies[0].location,'京师');const order=c.GM.commandOrders[0];
  r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'military_order',armyId:'army-a',destinationId:'border',commandReceipt:{orderId:order.id,decision:'accepted',by:['l'],report:'本军掌兵者确认道路与队伍，依令开拔。'}}]},{actorId:'l',sourceId:'march:reply'});
  assert.equal(r.results[0].outcome,'started',JSON.stringify(r));assert.equal(c.GM.marchOrders.length,1);assert.equal(c.GM.armies[0].location,'京师');assert.equal(c.GM.armies[0].soldiers,100);
});
test('native authoritative offices support both NPC organizations without borrowing the player tree',()=>{
  const c=politicalFixture();c.load('tm-start-contracts.js');c.load('tm-start-world.js');
  c.GM.startContext={schemaVersion:'tm-start-context/1',playerFactionId:'player-faction',playerCharacterId:'player'};
  c.GM.nativeWorld={offices:{fa:c.fa.officeTree,fb:c.fb.officeTree},accounts:[],authorities:[{id:'auth-a',characterId:'a',status:'active',grants:['appoint'],jurisdiction:{factionIds:['fa'],regionIds:[]}},{id:'auth-b',characterId:'b',status:'active',grants:['appoint'],jurisdiction:{factionIds:['fb'],regionIds:[]}}]};
  for(const f of c.GM.facs){f.officeTree[0].authorityFactionId=f.id;for(const p of f.officeTree[0].positions)p.salaryPayments=[];}
  let r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'office_change',targetId:'l',positionId:'va',kind:'appoint'}]},{actorId:'a',actingPositionId:'pa',sourceId:'native-a'});assert.equal(r.actions,1,JSON.stringify(r));
  r=c.TM.FactionActionEngine.applyDecision(c.fb,{actions:[{type:'office_change',targetId:'s',positionId:'vb',kind:'appoint'}]},{actorId:'b',actingPositionId:'pb',sourceId:'native-b'});assert.equal(r.actions,1,JSON.stringify(r));
  assert.equal(c.GM.officeTree.length,0);assert.equal(c.GM.nativeWorld.offices.fa[0].positions[1].holderId,'l');assert.equal(c.GM.nativeWorld.offices.fb[0].positions[1].holderId,'s');
});
test('migration preserves old facts, labels missing provenance and replans the original item',()=>{
  const c=politicalFixture(),B=c.TM.PoliticalActions,D=c.TM.FactionDiplomacy;
  delete c.GM._npcActionState;c.GM._npcActionLedger=[{id:'old-self-report',status:'completed',actor:'甲代表'}];
  c.GM.treaties=[{id:'old-treaty',from:'甲国',to:'乙国',type:'alliance',status:'active',extra:{preserved:true}}];
  c.fb._incomingProposals=[{id:'old-proposal',from:'甲国',fromId:'fa',to:'乙国',toId:'fb',type:'alliance',terms:'旧存档简述',status:'pending',turn:1,extra:'保留'}];
  const cash=c.fa.treasury.money+c.fb.treasury.money;assert.equal(B.migrate().ok,true);assert.equal(c.GM._npcActionLedger[0].status,'legacy_reported');assert.equal(c.GM.treaties.length,1);assert.equal(c.GM.treaties[0].active,true);assert.equal(c.GM.treaties[0].sourceStatus,'legacy_unattributed');assert.equal(c.GM.treaties[0].extra.preserved,true);
  const once=JSON.stringify(c.GM);assert.equal(B.migrate().ok,true);assert.equal(JSON.stringify(c.GM),once);
  const r=D.applyResponses(c.fa,[{proposalId:'old-proposal',decision:'replan',terms:'当前明确的新条款'}],c.GM.turn,{binding:B.bind(c.fa,'a',{actingPositionId:'pa',sourceId:'replan-original'})});
  assert.equal(r.submitted,1,JSON.stringify(r));assert.equal(c.fb._incomingProposals.length,1);assert.equal(D.get('old-proposal').legacy.extra,'保留');assert.equal(c.GM.treaties.length,1);assert.equal(c.fa.treasury.money+c.fb.treasury.money,cash);
});
test('migration failure rolls back and closed-module faction input never restores a direct grant',()=>{
  const c=politicalFixture(),before=JSON.stringify(c.GM);
  assert.equal(c.TM.PoliticalActions.migrate(c.GM,{fault:()=>{throw Error('injected migration failure');}}).ok,false);assert.equal(JSON.stringify(c.GM),before);
  delete c.TM.PoliticalActions;const cash=c.GM.facs[0].treasury.money;
  const r=c.TM.FactionActionEngine.applyDecision(c.GM.facs[0],{actions:[{type:'fiscal_policy',treasuryDelta:100000,source:'system'}]});assert.equal(r.actions,0);assert.equal(c.GM.facs[0].treasury.money,cash);
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
