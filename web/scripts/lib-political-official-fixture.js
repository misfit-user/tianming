'use strict';
const fs=require('fs'),path=require('path'),{fixture}=require('./lib-npc-action-fixture');
function official(prefix){
 const dir=path.resolve(__dirname,'../../scenarios'),file=fs.readdirSync(dir).find(f=>f.startsWith(prefix)&&f.endsWith('（官方）.json')),s=JSON.parse(fs.readFileSync(path.join(dir,file),'utf8')),c=fixture();
 c.GM={sid:s.id,turn:1,running:true,chars:s.characters,facs:s.factions,armies:s.military&&s.military.initialTroops||[],officeTree:s.officeTree||[],adminHierarchy:s.adminHierarchy||{},playerInfo:s.playerInfo,publicTreasuryConfig:s.publicTreasuryConfig,fiscalConfig:s.fiscalConfig,memorials:[],letters:[],evtLog:[],rels:{},vars:{},_npcPlans:[],_turnContext:{npcActionsThisTurn:[]}};
 c.P={...c.P,playerInfo:s.playerInfo,conf:{npcAiPrecision:true},time:s.time,fiscalConfig:s.fiscalConfig};
 ['tm-faction-index.js','tm-faction-membership.js','tm-political-actions.js','tm-feudal-warfare.js','tm-faction-action-engine.js','tm-faction-diplomacy.js','tm-faction-npc-guoku.js','tm-faction-npc-memorial.js','tm-faction-npc-edict.js','tm-faction-npc-chaoyi.js','tm-faction-npc-office.js'].forEach(c.load);
 c.TM.FactionMembership.migrateCharsAddFactionId();c.TM.FactionIndex.rebuild();
 const player=c.GM.facs.find(f=>f.id===s.playerInfo.factionId||f.name===s.playerInfo.factionName);if(player)c.GM.guoku=player.treasury;c.GM.neitang=s.neitang;
 c.GM._isFreshNewGame=true;
 const accounts=c.TM.PublicTreasury.initialize({game:c.GM});if(!accounts.ok)throw Error(JSON.stringify(accounts.missing));
 const migration=c.TM.PoliticalActions.migrate();if(!migration.ok)throw Error(migration.reason);
 c.scenarioName=file;return c;
}
function agreement(c,fromId,toId,type){
 const B=c.TM.PoliticalActions,D=c.TM.FactionDiplomacy,from=B.resolve('organization',{id:fromId}),to=B.resolve('organization',{id:toId}),lead=B.principals(from,'diplomacy')[0];
 if(!lead)throw Error('No actual diplomatic actor '+fromId);
 const r=D.recordProposals(from,[{type,toFactionId:to.id,terms:'两方议定互不侵犯，遇事先递文书交涉。',durationTurns:12}],c.GM.turn,{binding:B.bind(from,lead.actor.id,{actingPositionId:lead.assignment.pos.id,sourceId:'official-proposal'})});
 if(r.recorded!==1)throw Error(JSON.stringify(r));const id=r.results[0].proposalId;
 // Save and restore actual production state while the original document is in flight.
 const money=c.GM.facs.map(f=>f.treasury&&f.treasury.money);c.GM=JSON.parse(JSON.stringify(c.GM));B.migrate();
 for(let i=0;i<10;i++){
   c.GM.turn++;D.advance();const p=D.get(id);if(p.status==='accepted')return {p,initialMoney:money};
   const org=B.resolve('organization',{id:p.recipientOrganizationId}),actor=B.resolve('character',{id:p.recipientId});if(!actor)throw Error('No actual recipient');
   const roles=c.TM.OfficeHolderState.assignments(c.GM,actor,{organizationId:org.id}),role=roles.find(r=>r.pos.powers&&(r.pos.powers.diplomacy||r.pos.powers.treatySign))||roles[0];
   const response=D.applyResponses(org,[{proposalId:id,proposalVersion:p.version,decision:'accept'}],c.GM.turn,{binding:B.bind(org,actor.id,{actingPositionId:role.pos.id,sourceId:'official-response-'+i})});
   if(!response.resolved&&!response.submitted)throw Error(JSON.stringify(response));
 }
 throw Error('Agreement did not progress within bounded responses');
}
function documentLoop(c,kind){
 const B=c.TM.PoliticalActions,L=c.TM.NPC.ActionLedger;B.localCandidates(kind);
 const candidate=c.GM._npcPlans.find(p=>p.kind==='political_candidate'&&p.organizationId==='fac_mp9rsc3f4r9co'&&p.operation.type===kind);
 if(!candidate)throw Error('Official candidate missing');const actor=B.resolve('character',{id:candidate.actorId}),org=B.resolve('organization',{id:candidate.organizationId});
 const target=c.GM.chars.find(ch=>ch.id!==actor.id&&ch.factionId===org.id&&ch.alive!==false&&!ch.isPlayer);if(!target)throw Error('Official recipient missing');
 const summary=c.TM.FactionActionEngine.applyDecision(org,{actions:[{type:kind,sourcePlanId:candidate.id,targetId:target.id,content:'请校核来往文书中的册籍，复明具体缺项。'}]},{actorId:actor.id,sourceId:'official-document:'+kind});
 const receipt=summary.results[0];if(receipt.outcome!=='submitted')throw Error(JSON.stringify(summary));const plan=c.GM._npcPlans.find(p=>p.id===receipt.planId);
 const tick=()=>{c.GM.turn++;L.advance();B.flush();};
 function step(ch,phase,extra){const r=c.NpcBehaviorRegistry.execute(ch,{actorId:ch.id,behaviorType:'private_correspondence',planId:plan.id,actionId:'official-'+kind+'-'+phase,phase,...extra});if(!/^(submitted|completed)$/.test(r.outcome))throw Error(JSON.stringify(r));return r;}
 tick();step(target,'respond',{response:'accept',content:'愿核册籍，须待文书齐备。'});tick();tick();step(target,'perform',{content:'已核册籍：甲项齐备，乙项待补。'});tick();step(actor,'feedback',{content:'已收核查文书，缺项另续办理',evaluation:'satisfied'});tick();
 return {actor,target,org,plan,candidate,receipt};
}
module.exports={official,agreement,documentLoop};
