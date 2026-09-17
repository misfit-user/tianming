'use strict';
// Real runtime writers and main writeBack; synthetic worlds, no network or player saves.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {functionSource}=require('./lib-perf-round1');
const root=path.resolve(__dirname,'..');
const factory=functionSource(fs.readFileSync(path.join(__dirname,'smoke-territory-ownership-sync.js'),'utf8'),'fixture');
const fixture=vm.runInNewContext('('+factory+')',{fs,path,vm,root,console});
const read=f=>fs.readFileSync(path.join(root,f),'utf8');
const tests=[];const test=(name,fn)=>tests.push({name,fn});
const packet=rows=>({map_changes:{ownership_changes:rows}});
const transfer=(id,owner)=>({region_id:id,new_owner:owner,reason:'受控测试易主'});
function mainFixture(){
  const f=fixture(),c=f.ctx;c.P.conf={};c.addEB=()=>{};c._enforceFormulas=()=>{};c.applyCharacterDeaths=()=>{};
  vm.runInContext(read('map-integration.js'),c);
  vm.runInContext(read('tm-endturn-apply.js'),c);
  c.TM.Endturn.AI.apply.stages={_applyCore_reconcile:async()=>{},_applyPostValidateAssemble:ctx=>{f.finalized=true;return ctx;}};
  f.apply=p1=>c.TM.Endturn.AI.apply.writeBack({results:{sc1:p1}});return f;
}
test('actual main writeBack applies map-only world without P.map',async()=>{
  const f=mainFixture();assert.equal(f.ctx.P.map,undefined);
  await f.apply(packet([transfer('r1','fb')]));assert.equal(f.map.regions[0].owner,'fb');assert(f.finalized);
});
test('actual main writeBack propagates failed map application',async()=>{
  const f=mainFixture();f.ctx.P.map=f.map;const error=Error('injected map write failure');
  f.ctx.applyAIMapChanges=()=>{throw error;};await assert.rejects(f.apply(packet([transfer('r1','fb')])),e=>e===error);
  assert(!f.finalized);
});
test('same response can establish a faction before transferring its territory',async()=>{
  const f=mainFixture();f.ctx.P.map=f.map;const p=packet([transfer('r1','丙国')]);p.faction_create=[{name:'丙国'}];
  await f.apply(p);const fac=f.G.facs.find(x=>x.name==='丙国');assert(fac);assert.equal(f.map.regions[0].owner,fac.id);
});
for(const [name,last] of [
 ['unknown region',transfer('missing','fa')],['unknown faction',transfer('r2','missing')],
 ['missing new owner',{region_id:'r2'}],['object owner',transfer('r2',{})],
 ['conflicting duplicate',transfer('r1','fa')]
])test(name+' rejects whole ownership batch without side effects',()=>{
  const f=fixture(),before=JSON.stringify(f.G);
  assert.throws(()=>f.ctx.TMMapRuntime.applyAIMapChanges(packet([transfer('r1','fb'),last])));
  assert.equal(JSON.stringify(f.G),before);assert.equal(f.events.length,0);assert.equal(f.refreshes.length,0);
});
test('later write failure rolls back earlier territory and emits no premature event',()=>{
  const f=fixture();Object.freeze(f.d2);const before=JSON.stringify(f.G);
  assert.throws(()=>f.ctx.TMMapRuntime.applyAIMapChanges(packet([transfer('r1','fb'),transfer('r2','fa')])));
  assert.equal(JSON.stringify(f.G),before);assert.equal(f.events.length,0);assert.equal(f.derived.length,0);
});
test('invalid numeric patch cannot leave a valid preceding transfer applied',()=>{
  const f=fixture(),before=JSON.stringify(f.G),p=packet([transfer('r1','fb')]);p.map_changes.troop_changes=[{region_id:'r2',delta:'not-a-number'}];
  assert.throws(()=>f.ctx.TMMapRuntime.applyAIMapChanges(p));assert.equal(JSON.stringify(f.G),before);
});
test('stable ID is authoritative and never silently falls back to a different name',()=>{
  const f=fixture(),before=JSON.stringify(f.G);
  assert.throws(()=>f.ctx.TMMapRuntime.applyAIMapChanges(packet([{region_id:'missing',region_name:'东州',new_owner:'fb'}])));
  assert.equal(JSON.stringify(f.G),before);
});
test('repeated identical rows create one history and one formal refresh',()=>{
  const f=fixture();f.ctx.TMMapRuntime.applyAIMapChanges(packet([transfer('r1','fb'),transfer('r1','fb')]));
  assert.equal(f.map.regions[0].ownerHistory.length,1);assert.equal(f.refreshes.filter(x=>x==='formal').length,1);
  assert.equal(f.derived.length,1);
});
test('same-turn batch recalculates countries and redraws once for many territories',()=>{
  const f=fixture(),rows=[];for(let i=0;i<40;i++){
    const r=JSON.parse(JSON.stringify(f.map.regions[0]));r.id='extra'+i;r.name='试州'+i;r.adminBinding='div'+i;
    f.map.regions.push(r);f.G._provinceToFaction[r.name]='甲国';rows.push(transfer(r.id,'fb'));
  }
  f.ctx.TMMapRuntime.applyAIMapChanges(packet(rows));assert(rows.every(x=>f.map.regions.find(r=>r.id===x.region_id).owner==='fb'));
  assert.equal(f.derived.length,1);assert.equal(f.refreshes.filter(x=>x==='formal').length,1);
});
test('derived statistics failure rolls back ownership and emits no success',()=>{
  const f=fixture(),before=JSON.stringify(f.G);f.ctx.TM.FactionDerivedEconomy.compute=()=>{f.b.derivedEconomy={broken:true};throw Error('derived-failure');};
  assert.throws(()=>f.ctx.TMMapRuntime.setRegionOwner('r1','fb'),/derived-failure/);
  assert.equal(JSON.stringify(f.G),before);assert.equal(f.events.length,0);
});
test('failed legacy repaint does not suppress formal-map invalidation',()=>{
  const f=fixture();f.ctx.updateMapColors=()=>{throw Error('legacy repaint failed');};
  f.ctx.TMMapRuntime.setRegionOwner('r1','fb');assert.equal(f.map.regions[0].owner,'fb');assert(f.refreshes.includes('formal'));
});
test('object administrative binding resolves the exact live node',()=>{
  const f=fixture();f.map.regions[0].adminBinding={id:'d1'};delete f.d1.mappedRegions;f.d1.name='行政名';
  f.ctx.TMMapRuntime.setRegionOwner('r1','fb');assert.equal(f.d1.factionId,'fb');
});
test('explicit region ID does not rewrite another same-name region or statistics',()=>{
  const f=fixture();f.map.regions[1].name='东州';f.G._provinceToFaction.r2='乙国';
  f.G.provinceStats.r2={id:'d2',owner:'乙国',factionId:'fb'};
  f.ctx.TMMapRuntime.setRegionOwner('r1','');
  assert.equal(f.ctx.TMPhase8FormalBridge.map.ownerName(f.map.regions[1]),'乙国');
  assert.equal(f.G.provinceStats.r2.owner,'乙国');assert.equal(f.G._provinceToFaction.r1,'');
});
test('explicit unowned survives ownership-index rebuild despite stale legacy hints',()=>{
  const f=fixture();f.ctx.TMMapRuntime.setRegionOwner('r1','');
  f.G.provinceStats['东州'].owner='甲国';f.a.territories.push('东州');f.a.provinceIds.push('r1');
  f.ctx.TM.FactionMembership.migrateProvinceOwnership();
  assert.equal(f.G._provinceToFaction.r1,'');assert.equal(f.G._provinceToFaction['东州'],'');
  assert.equal(f.ctx.TMPhase8FormalBridge.map.ownerName(f.map.regions[0]),'');
  assert.equal(f.ctx.TM.FactionMembership.getProvinces('甲国').length,0);
});
test('generic field patch cannot bypass the ownership transaction',()=>{
  const f=fixture(),before=JSON.stringify(f.G);
  assert.throws(()=>f.ctx.TMMapRuntime.updateRegion('r1',{factionId:'fb'}));assert.equal(JSON.stringify(f.G),before);
});
test('empty map changes on a world without a map are a no-op',()=>{
  const f=fixture();delete f.ctx.GM.mapData;const before=JSON.stringify(f.ctx.GM);
  f.ctx.TMMapRuntime.applyAIMapChanges({map_changes:{ownership_changes:[]}});assert.equal(JSON.stringify(f.ctx.GM),before);
});
test('structured ownership failure cannot be bypassed by narrative mirror fallback',()=>{
  const f=fixture();vm.runInContext(read('tm-ai-change-narrative.js'),f.ctx);const before=JSON.stringify(f.G);
  const api=f.ctx.TM && f.ctx.TM.AIChange && f.ctx.TM.AIChange.Narrative;assert(api,'narrative module export');
  Object.freeze(f.d1);
  assert.throws(()=>api.setRegionOwnerMirrors(f.G,{id:'r1',name:'东州',mapRegion:f.map.regions[0],adminDiv:f.d1},f.b,'test'));
  assert.equal(JSON.stringify(f.G),before);
});
test('replaying unchanged ownership preserves list order and performs no extra refresh',()=>{
  const f=fixture();f.ctx.TMMapRuntime.setRegionOwner('r1','fb');f.ctx.TMMapRuntime.setRegionOwner('r2','fb');
  const before=JSON.stringify(f.G),refreshes=f.refreshes.length,derived=f.derived.length;
  f.ctx.TMMapRuntime.setRegionOwner('r1','fb');assert.equal(JSON.stringify(f.G),before);
  assert.equal(f.refreshes.length,refreshes);assert.equal(f.derived.length,derived);
});
test('failed first binding restores a mapless world and preserves its template',()=>{
  const f=fixture();f.ctx.P.map=JSON.parse(JSON.stringify(f.map));delete f.G.mapData;Object.freeze(f.d2);
  const before=JSON.stringify([f.G,f.ctx.P]);
  assert.throws(()=>f.ctx.TMMapRuntime.applyAIMapChanges(packet([transfer('r1','fb'),transfer('r2','fa')])));
  assert.equal(JSON.stringify([f.G,f.ctx.P]),before);assert(!Object.prototype.hasOwnProperty.call(f.G,'mapData'));
});
test('success events observe every region after the batch completes',()=>{
  const f=fixture(),seen=[];f.ctx.GameEventBus.emit=(kind)=>{if(kind==='faction:provinceTransferred')seen.push(f.map.regions.map(r=>r.owner).join(','));};
  f.ctx.TMMapRuntime.applyAIMapChanges(packet([transfer('r1','fb'),transfer('r2','fa')]));
  assert.deepEqual(seen,['fb,fa','fb,fa']);
});
test('invalid explicit ID is rejected even when another region has that display name',()=>{
  const f=fixture();f.map.regions[1].name='missing';const before=JSON.stringify(f.G);
  assert.throws(()=>f.ctx.TMMapRuntime.applyAIMapChanges(packet([transfer('missing','fa')])));
  assert.equal(JSON.stringify(f.G),before);
});
test('same-turn replay after JSON reload creates no new ownership history',()=>{
  const f=fixture();f.ctx.TMMapRuntime.setRegionOwner('r1','fb');f.ctx.GM=JSON.parse(JSON.stringify(f.G));
  const before=JSON.stringify(f.ctx.GM);f.ctx.TMMapRuntime.setRegionOwner('r1','fb');assert.equal(JSON.stringify(f.ctx.GM),before);
});

test('legacy bulk API counts ID/name aliases once and redraws once',()=>{
  const f=fixture();const count=f.ctx.TM.FactionMembership.bulkReassignProvinces((name,owner)=>owner==='甲国','fb');
  assert.equal(count,1);assert.equal(f.map.regions[0].owner,'fb');assert.equal(f.derived.length,1);
  assert.equal(f.refreshes.filter(x=>x==='formal').length,1);
});
test('legacy bulk API rolls back the entire selection on later failure',()=>{
  const f=fixture();Object.freeze(f.d2);const before=JSON.stringify(f.G);
  assert.throws(()=>f.ctx.TM.FactionMembership.bulkReassignProvinces(()=>true,''));
  assert.equal(JSON.stringify(f.G),before);assert.equal(f.events.length,0);assert.equal(f.refreshes.length,0);
});
(async()=>{let failed=0;for(const t of tests){try{await t.fn();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}
 console.log(JSON.stringify({suite:'territory-hardening',total:tests.length,passed:tests.length-failed,failed}));process.exitCode=failed?1:0;
})().catch(e=>{console.error(e);process.exitCode=1;});
