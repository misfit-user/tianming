'use strict';
const assert=require('assert/strict'),{politicalFixture}=require('./lib-political-action-fixture');
const c=politicalFixture(),D=c.TM.FactionDiplomacy,B=c.TM.PoliticalActions;let sequence=0;
c.GM.facs.push({id:'fc',name:'丙国'});
function propose(from,to,type,terms){const actor=from.id==='fa'?'a':from.id==='fb'?'b':'same-rep';const r=D.recordProposals(from,[{toFactionId:to.id,type,terms}],c.GM.turn,{binding:B.bind(from,actor,{sourceId:'origin:'+ ++sequence})});assert.equal(r.recorded,1);D.advance();return D.get(r.results[0].proposalId);}
function reply(org,p,decision){const actor=org.id==='fa'?'a':org.id==='fb'?'b':'same-rep';return D.applyResponses(org,[{proposalId:p.id,proposalVersion:p.version,decision}],c.GM.turn,{binding:B.bind(org,actor,{sourceId:'reply:'+ ++sequence})});}
function seed(){c.fa.aiStrategy={grudges:['乙国','丙国'],grudgeIds:['fb','fc']};c.fb.aiStrategy={grudges:['甲国','丙国'],grudgeIds:['fa','fc']};}
seed();let p=propose(c.fa,c.fb,'alliance','需要对方选择');reply(c.fb,p,'reject');
assert.deepEqual(Array.from(c.fa.aiStrategy.grudgeIds),['fb','fc'],'rejection does not manufacture new automatic hostility');assert.equal(c.GM.treaties,undefined);
for(const type of ['alliance','nonaggression','joint_action','deal']){
 seed();p=propose(c.fa,c.fb,type,'完整约文 '+type);assert.equal(reply(c.fb,p,'accept').resolved,1);
 assert.deepEqual(Array.from(c.fa.aiStrategy.grudgeIds),['fb','fc'],'signing is not a forced personal reconciliation');
 assert.deepEqual(Array.from(c.fb.aiStrategy.grudgeIds),['fa','fc']);assert(c.GM.treaties.some(t=>t.proposalId===p.id));
}
seed();const war=c.CasusBelliSystem.declareWar('甲国','乙国');assert.equal(war.success,true);p=propose(c.fa,c.fb,'peace','双方停战');assert.equal(reply(c.fb,p,'accept').resolved,1);
assert(!c.GM.activeWars.some(w=>w.id===war.war.id),'formal peace consumes actual war domain');assert.deepEqual(Array.from(c.fa.aiStrategy.grudgeIds),['fb','fc']);
// Legacy one-sided grudge storage remains usable and unchanged.
c.fa.aiStrategy={grudges:['乙国','丙国'],grudgeIds:[]};c.fb.aiStrategy={grudges:[],grudgeIds:['fa','fc']};p=propose(c.fa,c.fb,'alliance','复议');reply(c.fb,p,'accept');
assert.deepEqual(Array.from(c.fa.aiStrategy.grudges),['乙国','丙国']);assert.deepEqual(Array.from(c.fb.aiStrategy.grudgeIds),['fa','fc']);
const same1={id:'same1',name:'同名',officeTree:[{id:'same-office',positions:[{id:'same-role',holderId:'same-rep',powers:{diplomacy:true,treatySign:true}}]}]},same2={id:'same2',name:'同名'};c.GM.facs.push(same1,same2);c.actor('same-rep','同名使者',{factionId:'same1',faction:'同名'});
c.fa.aiStrategy={grudges:['同名'],grudgeIds:['same1','same2']};p=propose(c.fa,same1,'nonaggression','凭 ID 协议');assert.equal(reply(same1,p,'accept').resolved,1);assert.deepEqual(Array.from(c.fa.aiStrategy.grudgeIds),['same1','same2']);
assert(c.GM.treaties.find(t=>t.proposalId===p.id).parties.some(x=>x.id==='same1'));assert.equal(same2._incomingProposals,undefined);
assert.equal(D.recordProposals(c.fa,[{toFaction:'同名',type:'alliance',terms:'歧义'}],c.GM.turn,{binding:B.bind(c.fa,'a',{sourceId:'ambiguous'})}).recorded,0);
assert.equal(D.recordProposals(c.GM.facs[0],[{toFactionId:'missing',toFaction:'乙国',type:'alliance',terms:'错误 ID'}],c.GM.turn,{binding:B.bind(c.GM.facs[0],'a',{sourceId:'invalid-id'})}).recorded,0);
console.log('[smoke-faction-diplomacy-grudge-identities] PASS real bilateral choices, peace, preserved directional histories and stable identities');
