'use strict';
const assert=require('assert/strict'),{politicalFixture}=require('./lib-political-action-fixture');
let passed=0,failed=0;
function test(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.stack);}}
function propose(c,extra={}){const D=c.TM.FactionDiplomacy,B=c.TM.PoliticalActions;const r=D.recordProposals(c.fa,[{toFactionId:'fb',type:'alliance',terms:'双方外敌入侵时共同防御',...extra}],c.GM.turn,{binding:B.bind(c.fa,'a',{actingPositionId:'pa',sourceId:'proposal-one'})});assert.equal(r.recorded,1,JSON.stringify(r));D.advance();return D.get(r.results[0].proposalId);}
function respond(c,p,actor,organization,position,source,extra={}){return c.TM.FactionDiplomacy.applyResponses(organization,[{proposalId:p.id,proposalVersion:p.version,decision:'accept',...extra}],c.GM.turn,{binding:c.TM.PoliticalActions.bind(organization,actor,{actingPositionId:position,sourceId:source})});}
test('a current collective rule uses separate informed votes, not an invented ruler',()=>{
 const c=politicalFixture();c.fa.officeTree[0].positions[0].powers.treatySign=false;
 c.fa.officeTree[0].positions.push({id:'pc',name:'议事席',holderId:'l'});
 c.fa.politicalRules=[{id:'council',kind:'treaty_council',status:'active',version:1,source:'fixture-declared-charter',positionIds:['pa','pc'],quorum:2}];
 const p=propose(c);assert.equal(p.decisions.length,0);assert.equal(p.collectiveVotes.length,1);
 respond(c,p,'b',c.fb,'pb','b-vote');assert.equal(c.GM.treaties,undefined);c.TM.FactionDiplomacy.advance();
 respond(c,p,'a',c.fa,'pa','forward-council');assert.equal(p.knowledge.l,undefined);c.TM.FactionDiplomacy.advance();assert.equal(p.knowledge.l,1);
 const r=respond(c,p,'l',c.fa,'pc','l-vote');assert.equal(r.resolved,1,JSON.stringify(r));
 const signature=c.GM.treaties[0].signatures.find(s=>s.organizationId==='fa');assert.equal(signature.collective.participants.length,2);assert.equal(signature.collective.ruleId,'council');
 c.a.alive=false;assert.equal(c.TreatySystem.hasTreaty('甲国','乙国','alliance'),true);
});
test('approved acting holders exercise only the delegated current seat',()=>{
 const c=politicalFixture(),p=c.fa.officeTree[0].positions[0];p.leave={approved:true,startTurn:1,endTurn:5,delegateId:'l'};
 const r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'office_change',targetId:'s',positionId:'va'}]},{actorId:'l',actingPositionId:'pa',sourceId:'delegated-appointment'});
 assert.equal(r.actions,1,JSON.stringify(r));assert.equal(c.fa.officeTree[0].positions[1].holderId,'s');
 c.GM.turn=5;assert.equal(c.TM.PoliticalActions.authority(c.liaison,{organizationId:'fa',actingPositionId:'pa'},'appointment'),null);
});
test('a legitimate unilateral withdrawal terminates only its actual treaty',()=>{
 const c=politicalFixture(),p=propose(c);respond(c,p,'b',c.fb,'pb','sign-b');c.TM.FactionDiplomacy.advance();
 const id=c.GM.treaties[0].id,r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'diplomacy',diplomacyAction:'withdraw_treaty',treatyId:id}]},{actorId:'a',actingPositionId:'pa',sourceId:'withdraw-one'});
 assert.equal(r.actions,1,JSON.stringify(r));assert.equal(c.GM.treaties[0].active,false);assert.equal(c.TreatySystem.hasTreaty('甲国','乙国','alliance'),false);
 assert.equal(c.GM.treaties.length,1);assert.equal(c.GM.treaties[0].signatures.length,2);
});
test('failed treaty commit rolls back signatures; failed notification cannot duplicate a treaty',()=>{
 const c=politicalFixture(),p=propose(c),create=c.TreatySystem.createTreaty;
 c.TreatySystem.createTreaty=(...args)=>{create(...args);throw Error('after-treaty-write');};
 let r=respond(c,p,'b',c.fb,'pb','sign-b');assert.equal(r.results[0].outcome,'failed');assert.equal((c.GM.treaties||[]).length,0);assert.equal(c.TM.FactionDiplomacy.get(p.id).decisions.length,1);
 c.TreatySystem.createTreaty=create;c.addEB=()=>{throw Error('notification-unavailable');};
 r=respond(c,c.TM.FactionDiplomacy.get(p.id),'b',c.GM.facs[1],'pb','sign-b');assert.equal(r.resolved,1,JSON.stringify(r));assert.equal(c.GM.treaties.length,1);
 respond(c,c.TM.FactionDiplomacy.get(p.id),'b',c.GM.facs[1],'pb','sign-b');assert.equal(c.GM.treaties.length,1);
});
test('world and typed identity never fall back to a namesake or other organization',()=>{
 const c=politicalFixture(),B=c.TM.PoliticalActions;c.GM.facs.push({id:'fc',name:'甲国'});c.actor('namesake','甲代表');
 assert.equal(B.resolve('character','甲代表'),null);assert.equal(B.resolve('organization','甲国'),null);assert.equal(B.resolve('character',{id:'missing',name:'甲代表'}),null);
 assert.equal(B.resolve('character',{id:'a'},{chars:[],facs:[]}),null);assert.equal(c._npcPosition('pa',{organizationId:'fb'},c.GM),null);
 c.fa.leader='不存在';c.GM.chars=[];assert.equal(B.choose(c.fa),null);
});
test('bound war decisions retain formal war conditions, receipts and once-only execution',()=>{
 const c=politicalFixture();c.fa.officeTree[0].positions[0].powers.declareWar=true;
 const d={actions:[{type:'declare_war',targetOrganizationId:'fb',casusBelliId:'border'}]},opts={actorId:'a',actingPositionId:'pa',sourceId:'war-one'};
 let r=c.TM.FactionActionEngine.applyDecision(c.fa,d,opts);assert.equal(r.actions,1,JSON.stringify(r));assert.equal(c.GM.activeWars.length,1);assert.equal(c.GM.activeWars[0].decisionActorId,'a');
 r=c.TM.FactionActionEngine.applyDecision(c.fa,d,opts);assert.equal(r.mergedActions,1);assert.equal(c.GM.activeWars.length,1);
 assert.equal(c.TM.FactionActionEngine._applyDeclareWar(c.fa,{payload:{targetFaction:'乙国'}}).ok,false);
 c.GM.facs.push({id:'fc',name:'丙国'});r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'join_war',targetOrganizationId:'fc',warId:'no-such-war'}]},{...opts,sourceId:'invalid-join'});assert.equal(r.actions,0);assert.equal(c.GM.activeWars.length,1);
});
test('candidates can be adopted, refused or deferred without a per-turn pile of duplicate work',()=>{
 const c=politicalFixture(),B=c.TM.PoliticalActions;B.localCandidates('office_change');const p=c.GM._npcPlans.find(p=>p.actorId==='a');assert(p);
 let r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{...p.operation,sourcePlanId:p.id,targetId:'s'}]},{actorId:'a',actingPositionId:'pa',sourceId:'adopt'});
 assert.equal(r.actions,1,JSON.stringify(r));assert.equal(p.status,'done');
 for(let t=0;t<25;t++){c.GM.turn++;B.localCandidates('memorial');}assert.equal(c.GM._npcPlans.filter(p=>p.kind==='political_candidate'&&p.operation.type==='memorial').length,2);
 const q=c.GM._npcPlans.find(p=>p.organizationId==='fa'&&p.operation.type==='memorial');
 r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'memorial',sourcePlanId:q.id,decision:'reject',reason:'目前没有需要具奏的事项'}]},{actorId:q.actorId,sourceId:'review'});
 assert.equal(r.results[0].outcome,'submitted',JSON.stringify(r));assert.equal(q.status,'cancelled');assert.equal(c.GM.memorials.length,0);
});
test('private unreceived counter terms and secret offices do not enter another actor prompt',()=>{
 const c=politicalFixture(),D=c.TM.FactionDiplomacy,B=c.TM.PoliticalActions,p=propose(c);c.a.location='远方';
 respond(c,p,'b',c.fb,'pb','counter-secret',{decision:'counter',counterTerms:'SECRET-COUNTER-ONLY-B'});
 c.fa.officeTree[0].positions.push({id:'hidden-office',name:'SECRET-PRIVATE-OFFICE',visibility:'private',holderId:'l'});
 const ctx=B.bind(c.fa,'a',{actingPositionId:'pa',sourceId:'read'});assert(!B.prompt(c.fa,ctx).user.includes('SECRET-'));assert(!B.tools(c.fa,ctx).formatters.officeQuery('').includes('SECRET-'));
 c.GM.turn++;D.advance();assert(B.prompt(c.fa,B.bind(c.fa,'a',{actingPositionId:'pa',sourceId:'after-delivery'})).user.includes('SECRET-COUNTER-ONLY-B'));
});
test('the explicit human proposal channel uses the same treaty matter without an NPC consenting for the player',()=>{
 const c=politicalFixture(),D=c.TM.FactionDiplomacy;c.a.isPlayer=true;c.GM.playerInfo={characterId:'a',factionId:'fa'};
 const r=D.recordPlayerProposal(c.fa,{toFactionId:'fb',type:'alliance',terms:'由玩家明确提出，仍待对方决定',actingPositionId:'pa'},'scenario-event:choice');assert.equal(r.outcome,'submitted');assert.equal(c.GM.treaties,undefined);
 const again=D.recordPlayerProposal(c.fa,{toFactionId:'fb',type:'alliance',terms:'由玩家明确提出，仍待对方决定',actingPositionId:'pa'},'scenario-event:choice');assert(again.duplicate);assert.equal(c.fb._incomingProposals.length,1);
 D.advance();assert.equal(respond(c,D.get(r.proposalId),'b',c.fb,'pb','independent-npc-reply').resolved,1);assert.equal(c.GM.treaties.length,1);
});
test('a stable commander ID cannot be redirected to a different namesake',()=>{
 const c=politicalFixture();c.load('tm-command-authority.js');c.fa.officeTree[0].positions[0].powers.militaryCommand=true;c.subject.name='联络人';
 c.GM.armies=[{id:'army-a',name:'甲军',faction:'甲国',commanderId:'a',commander:'甲代表',soldiers:100,location:'京师',commandChain:{mode:'receipt',custodians:[{characterId:'a'}]}}];
 const r=c.TM.FactionActionEngine.applyDecision(c.fa,{actions:[{type:'military_order',armyId:'army-a',commanderId:'s'}]},{actorId:'a',actingPositionId:'pa',sourceId:'namesake-commander'});
 assert.equal(r.actions,1,JSON.stringify(r));assert.equal(c.GM.armies[0].commanderId,'s');assert.equal(c.TM.AIChange.Army.resolveLivingCommanderName(c.GM,'联络人').ok,false);
});
test('active treaty history survives display limits and expiry remains a domain condition',()=>{
 const c=politicalFixture();for(let i=0;i<75;i++)c.TreatySystem.createTreaty('nonaggression',{id:'fa',name:'甲国'},{id:'fb',name:'乙国'},{text:'独立签订记录 '+i,durationTurns:36});
 assert.equal(c.GM.treaties.length,75);assert(c.TreatySystem.hasTreaty('甲国','乙国','nonaggression'));c.GM.treaties.forEach(t=>t.expiryTurn=c.GM.turn);assert.equal(c.TreatySystem.hasTreaty('甲国','乙国','nonaggression'),false);assert.equal(c.GM.treaties.length,75);
});
test('accepted material terms need a known obligation and the actual payer decision before delivery',()=>{
 const c=politicalFixture(),D=c.TM.FactionDiplomacy,B=c.TM.PoliticalActions,box=n=>({stock:n,available:n,quota:n,used:0});c.a.isPlayer=true;c.GM.playerInfo={characterId:'a',factionId:'fa'};
 c.fa.treasury=c.GM.guoku;for(const f of c.GM.facs)f.treasury.ledgers={money:box(f.treasury.money),grain:box(f.treasury.grain),cloth:box(f.treasury.cloth)};
 c.GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:[{id:'qa',kind:'physical',factionId:'fa',source:{kind:'faction',id:'fa'}},{id:'qb',kind:'physical',factionId:'fb',source:{kind:'faction',id:'fb'}}]};
 Object.assign(c.fb.officeTree[0].positions[0],{treasuryBinding:{accountRef:'qb',role:'custodian'},authorityScope:{accountRefs:['qa']}});
 const proposal=D.recordPlayerProposal(c.fa,{toFactionId:'fb',type:'deal',terms:'乙方同意另行核拨十贯，收到文书后办理。',obligations:[{kind:'public_transfer',fromAccount:'qb',toAccount:'qa',amounts:{money:10}}]},'material-terms');assert.equal(proposal.outcome,'submitted');D.advance();const p=D.get(proposal.proposalId);assert.equal(respond(c,p,'b',c.fb,'pb','accept-material').resolved,1);
 const obligation=p.obligations[0],before=c.GM.guoku.money;assert.equal(obligation.status,'unfulfilled');assert.equal(c.fb.treasury.money,70);
 let r=c.TM.FactionNpcGuoku.transferToPlayer({factionId:'fb',proposalId:p.id,amounts:{money:10},transferId:'fake'});assert.equal(r.ok,false);assert.equal(c.fb.treasury.money,70);
 const spec={factionId:'fb',proposalId:p.id,obligationId:obligation.id,amounts:{money:10},binding:B.bind(c.fb,'b',{actingPositionId:'pb',sourceId:'pay-known-obligation'})};
 r=c.TM.FactionNpcGuoku.transferToPlayer(spec);assert.equal(r.ok,true,JSON.stringify(r));assert.equal(c.GM.facs[1].treasury.money,60);assert.equal(c.GM.guoku.money,before+10);assert.equal(D.get(p.id).obligations[0].status,'fulfilled');
 assert.equal(c.TM.FactionNpcGuoku.transferToPlayer(spec).duplicate,true);assert.equal(c.GM._publicTreasuryTransfers.length,1);
  assert.equal(c.TM.FactionNpcGuoku.transferToPlayer({...spec,factionId:'fa'}).ok,false,'another party cannot reuse this delivery receipt');
});
test('more than eight active political matters rotate through the actual character input',()=>{
 const c=politicalFixture(),B=c.TM.PoliticalActions;for(let i=0;i<31;i++)B.offer(c.fa,c.a,{type:'office_change',positionId:'seat-'+i,intent:'具体事项 '+i},'rotation:'+i);
 const seen=new Set();for(let t=0;t<4;t++){const v=B.view(c.fa,B.bind(c.fa,'a',{actingPositionId:'pa',sourceId:'view-'+t}));assert(v.candidates.length<=8);v.candidates.forEach(x=>seen.add(x.id));c.GM.turn++;}assert.equal(seen.size,31);assert.equal(c.GM._npcPlans.length,31);
});
test('an invalid explicit authority ID cannot fall back to another valid office basis',()=>{
 const c=politicalFixture(),B=c.TM.PoliticalActions;let r=c.TM.FactionActionEngine.applyDecision(c.fb,{actions:[{type:'office_change',targetId:'s',positionId:'vb',authorityRef:'nonexistent-grant'}]},{actorId:'b',actingPositionId:'pb',sourceId:'invalid-grant'});
 assert.equal(r.actions,0);assert.equal(c.GM.facs[1].officeTree[0].positions[1].holderId,undefined);
 c.GM.nativeWorld={authorities:[{id:'native-grant',characterId:'b',status:'active',grants:['appoint'],jurisdiction:{factionIds:['fb']}}]};
 assert.equal(B.authority(c.GM.chars.find(ch=>ch.id==='b'),{organizationId:'fb',authorityRef:'native-grant'},'appointment'),null,'inactive native data is not a grant source');
 c.GM.startContext={schemaVersion:'tm-start-context/1',playerFactionId:'player-faction',playerCharacterId:'player'};
 r=c.TM.FactionActionEngine.applyDecision(c.GM.facs[1],{actions:[{type:'office_change',targetId:'s',positionId:'vb',authorityRef:'native-grant'}]},{actorId:'b',actingPositionId:'pb',sourceId:'valid-grant'});
 assert.equal(r.actions,1,JSON.stringify(r));assert.equal(c.GM.facs[1].officeTree[0].positions[1].holderId,'s');
});
test('later delivery cannot retroactively authorize a candidate that never received the terms',()=>{
 const c=politicalFixture(),B=c.TM.PoliticalActions,D=c.TM.FactionDiplomacy;c.b.location='远方';
 const proposed=D.recordProposals(c.fa,[{toFactionId:'fb',type:'alliance',terms:'须在实际收悉后独立选择'}],c.GM.turn,{binding:B.bind(c.fa,'a',{actingPositionId:'pa',sourceId:'future-terms'})});const id=proposed.results[0].proposalId;
 B.defer(B.bind(c.fb,'b',{actingPositionId:'pb',sourceId:'guessed-response'}),{proposalResponses:[{proposalId:id,proposalVersion:1,decision:'accept'}]});
 c.GM=JSON.parse(JSON.stringify(c.GM));c.GM.turn++;D.advance();B.flush();assert.equal(D.get(id).knowledge.b,1);assert.equal((c.GM.treaties||[]).length,0);
 const old=c.GM._npcActionState.politicalPending.find(p=>p.sourceId==='guessed-response');assert.equal(old.result.responses.results[0].reason,'proposal_not_in_decision_input');
 const current=c.GM.facs.find(f=>f.id==='fb');B.defer(B.bind(current,'b',{actingPositionId:'pb',sourceId:'informed-response'}),{proposalResponses:[{proposalId:id,proposalVersion:1,decision:'accept'}]});c.GM.turn++;B.flush();assert.equal(c.GM.treaties.length,1);
});
test('expiry and reform apply immediately while completed authority evidence stays historical',()=>{
 const c=politicalFixture(),B=c.TM.PoliticalActions;c.fb.officeTree[0].positions[0].authorityScope={positionIds:['vb']};
 const r=c.TM.FactionActionEngine.applyDecision(c.fb,{actions:[{type:'office_change',targetId:'s',positionId:'vb'}]},{actorId:'b',actingPositionId:'pb',sourceId:'basis-history'});assert.equal(r.actions,1);
 const basis=JSON.stringify(r.results[0].authorityBasis);c.fb.officeTree[0].positions[0].authorityScope.positionIds.length=0;assert.equal(JSON.stringify(r.results[0].authorityBasis),basis);
 const context=B.bind(c.fb,'b',{actingPositionId:'pb',sourceId:'before-expiry'});c.fb.officeTree[0].positions[0].expiresTurn=c.GM.turn;
 assert.equal(B.valid(context),false);assert.equal(B.bind(c.fb,'b',{actingPositionId:'pb'}),null);assert(!B.principals(c.fb).some(r=>r.actor.id==='b'));assert(B.principals(c.fb).some(r=>r.actor.id==='s'));assert.equal(c.GM.facs[1].officeTree[0].positions[1].holderId,'s');
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
