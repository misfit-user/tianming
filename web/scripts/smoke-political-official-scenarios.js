'use strict';
const assert=require('assert/strict'),{official,agreement}=require('./lib-political-official-fixture');
for(const spec of [
 ['天启','fac_mp9rsc3f4r9co','fac_mp9rsc3fex7fo','nonaggression'],
 ['绍宋','fac_jin','fac_xixia','nonaggression'],
 ['晚唐','唐·魏博镇','唐·成德镇','nonaggression']
]){
 const c=official(spec[0]),start=performance.now(),{p}=agreement(c,...spec.slice(1));
 assert.equal(c.GM.treaties.length,1);assert.equal(p.id,c.GM.treaties[0].proposalId);
 assert.equal(c.TreatySystem.hasTreaty(c.GM.treaties[0].from,c.GM.treaties[0].to,'nonaggression'),true);
 if(spec[0]==='绍宋'){
   assert.equal(c.GM.treaties[0].signatures.find(s=>s.organizationId==='fac_jin').collective.participants.length,3);
   const seat=c.TM.OfficeHolderState.positions(c.GM,{organizationId:'fac_jin'}).find(r=>r.pos.name.startsWith('国论忽鲁'));
   const r=c.TM.FactionActionEngine.applyDecision(c.TM.PoliticalActions.resolve('organization',{id:'fac_jin'}),{actions:[{type:'office_change',targetId:'char_jianyan1_60',positionId:seat.pos.id}]},{actorId:'char_jianyan1_53',actingPositionId:'political-office:fac_jin:council:0',sourceId:'official-appointment'});
   assert.equal(r.actions,1,JSON.stringify(r));assert.equal(c.TM.OfficeHolderState.position(c.GM,{organizationId:'fac_jin',positionId:seat.pos.id}).pos.holderId,'char_jianyan1_60');
 }
 if(spec[0]==='晚唐'){
   const source=require('../../scenarios/'+c.scenarioName);
   for(const id of ['唐·魏博镇','唐·成德镇'])assert.deepEqual(source.officeRegistryByFaction[id][0].positions[0],source.factions.find(f=>f.id===id).officeTree[0].positions[0],'native start and faction runtime declare the same scoped seat');
   const from=c.TM.PublicTreasury.getAccountView({game:c.GM,ref:'region:魏州'}),to=c.TM.PublicTreasury.getAccountView({game:c.GM,ref:'region:博州'});
   const r=c.TM.FactionActionEngine.applyDecision(c.TM.PoliticalActions.resolve('organization',{id:'唐·魏博镇'}),{actions:[{type:'fiscal_policy',fromAccount:from.id,toAccount:to.id,amounts:{money:1},purpose:'本镇仓司周转'}]},{actorId:'char-eee274437a62',actingPositionId:'office-4fbc37fa0e19',sourceId:'official-transfer'});
   assert.equal(r.actions,1,JSON.stringify({r,from,to}));
   const after=c.TM.PublicTreasury.getAccountView({game:c.GM,ref:from.id});assert.equal(after.resources.money.stock,from.resources.money.stock-1);
 }
 console.log('PASS '+c.scenarioName+' legacy; actual treaty='+p.id+'; saveBytes='+Buffer.byteLength(JSON.stringify(c.GM))+'; modelCalls=0; settleMs='+Math.round(performance.now()-start));
}
