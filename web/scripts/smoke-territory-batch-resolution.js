'use strict';
// Batch work must scale with the world once, while every transfer stays atomic.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('node:assert/strict');
const {functionSource}=require('./lib-perf-round1');
const root=path.resolve(__dirname,'..');
const source=functionSource(fs.readFileSync(path.join(__dirname,'smoke-territory-ownership-sync.js'),'utf8'),'fixture');
const fixture=vm.runInNewContext('('+source+')',{fs,path,vm,root,console});
const tests=[];function test(name,run){tests.push({name,run});}
function apply(f,rows,options){return f.ctx.TM.FactionMembership.applyProvinceTransfers(rows,options);}
function row(regionRef,newOwner){return {regionRef,newOwner,reason:'batch regression'};}

test('large batch walks the hierarchy and snapshots the world once without omitting transfers',()=>{
  const f=fixture(),rows=[];
  for(let i=0;i<40;i++){
    const id='batch-'+i,division={id:'division-'+i,name:'试州'+i,owner:'甲国',factionId:'fa'};
    f.G.adminHierarchy.fa.divisions.push(division);
    f.map.regions.push({id,name:division.name,adminBinding:division.id,owner:'fa',currentOwner:'fa',data:{}});
    f.G._provinceToFaction[id]='甲国';rows.push(row(id,'fb'));
  }
  let treeReads=0,worldSnapshots=0,tableSnapshots=0;
  const divisions=f.G.adminHierarchy.fa.divisions;
  Object.defineProperty(f.G.adminHierarchy.fa,'divisions',{enumerable:true,configurable:true,get(){treeReads++;return divisions;}});
  f.G._provinceToFaction=new Proxy(f.G._provinceToFaction,{ownKeys(target){tableSnapshots++;return Reflect.ownKeys(target);}});
  f.ctx.GM=new Proxy(f.G,{ownKeys(target){worldSnapshots++;return Reflect.ownKeys(target);}});
  let batchWork;
  const result=apply(f,rows,{mutate(){batchWork={treeReads,worldSnapshots,tableSnapshots};return false;}});
  assert.equal(result.applied,40);
  assert.equal(batchWork.treeReads,2,'read the one hierarchy traversal, not one traversal per region');
  assert.equal(batchWork.worldSnapshots,1,'one world rollback snapshot for the whole batch');
  assert.equal(batchWork.tableSnapshots,1,'one ownership-table rollback snapshot for the whole batch');
  assert(rows.every(r=>f.map.regions.find(x=>x.id===r.regionRef).owner==='fb'));
  assert.equal(f.events.filter(e=>e.name==='faction:provinceTransferred').length,40);
  assert.equal(f.derived.length,1);
});

test('resolution is rebuilt after an in-place hierarchy replacement and a world reload',()=>{
  const f=fixture();apply(f,[row('r1','fb')]);
  const replacement=JSON.parse(JSON.stringify(f.d1));
  f.G.adminHierarchy.fa.divisions[0]=replacement;
  apply(f,[row('r1','fa')]);
  assert.equal(replacement.factionId,'fa');assert.equal(f.d1.factionId,'fb','detached old node stays detached');
  const loaded=JSON.parse(JSON.stringify(f.G));f.ctx.GM=loaded;
  apply(f,[row('r1','fb')]);
  assert.equal(loaded.adminHierarchy.fa.divisions[0].factionId,'fb');
  assert.equal(replacement.factionId,'fa','loaded world does not reuse an old object');
});

test('stable region IDs outrank display aliases, while ambiguous aliases still reject the whole batch',()=>{
  const f=fixture();f.map.regions[1].name='r1';
  apply(f,[row('r1','fb')]);assert.equal(f.map.regions[0].owner,'fb');assert.equal(f.d2.factionId,'fb');
  f.map.regions[0].adminBinding='shared';f.map.regions[1].mapRegionId='shared';
  const before=JSON.stringify(f.G);
  assert.throws(()=>apply(f,[row('r1','fa'),row('shared','fa')]),/不唯一/);
  assert.equal(JSON.stringify(f.G),before);
});

function partitionFixture(){
  const f=fixture();
  f.map.sourceBudgetModel='source-partition-v1';
  f.map.provinceMigration=[{id:'source1',adminId:'parent1',memberRegionIds:['r1']},{id:'source2',adminId:'parent2',memberRegionIds:['r2']}];
  f.map.regions[0].sourceProvinceId='source1';f.map.regions[1].sourceProvinceId='source2';
  f.d1.mapAccounting={schema:'source-partition-v1'};f.d2.mapAccounting={schema:'source-partition-v1'};
  f.d1.children=[{id:'account1',name:'原始账户',owner:'甲国',factionId:'fa'}];
  f.G.adminHierarchy.fa.divisions=[{id:'parent1',name:'源省',children:[f.d1]}];
  f.G.adminHierarchy.fb.divisions=[{id:'parent2',name:'目标省',children:[f.d2]}];
  return f;
}
for(const target of ['fb',''])test('later failure restores moved accounts, retired containers and '+(target?'existing':'new')+' destination',()=>{
  const f=partitionFixture();Object.freeze(f.d2);
  const before=JSON.stringify(f.G),parent=f.G.adminHierarchy.fa.divisions[0],children=parent.children;
  assert.throws(()=>apply(f,[row('r1',target),row('r2','fa')]));
  assert.equal(JSON.stringify(f.G),before);
  assert.equal(f.G.adminHierarchy.fa.divisions[0],parent);assert.equal(parent.children,children);
  assert.equal(children[0],f.d1);assert.equal(f.d1.children[0].factionId,'fa');
  assert.equal(f.events.length,0);assert.equal(f.derived.length,0);assert.equal(f.refreshes.length,0);
  assert(!Object.prototype.hasOwnProperty.call(f.G,'_mapRetiredProvinceContainers'));
  assert(!Object.prototype.hasOwnProperty.call(f.G.adminHierarchy,'__unassigned_map_accounts'));
  apply(f,[row('r1',target)]);
  assert.equal(f.map.regions[0].owner,target,'a failed batch cannot poison the next lookup or journal');
});

test('late mutation failure restores shared records and arrays after every transfer has run',()=>{
  const f=partitionFixture(),extra={value:'before'};
  f.G.turnChanges={map:[{existing:true}]};
  const before=JSON.stringify(f.G),mapChanges=f.G.turnChanges.map;
  assert.throws(()=>apply(f,[row('r1','fb'),row('r2','fa')],{records:[extra],mutate(){
    extra.value='after';f.G.turnChanges.map.push({late:true});throw Error('late failure');
  }}),/late failure/);
  assert.equal(JSON.stringify(f.G),before);assert.equal(f.G.turnChanges.map,mapChanges);assert.equal(mapChanges.length,1);
  assert.equal(extra.value,'before');assert.equal(f.events.length,0);assert.equal(f.refreshes.length,0);
});

let failed=0;
for(const t of tests){try{t.run();console.log('PASS '+t.name);}catch(error){failed++;console.error('FAIL '+t.name+'\n'+error.stack);}}
console.log(JSON.stringify({suite:'territory-batch-resolution',total:tests.length,passed:tests.length-failed,failed}));
process.exitCode=failed?1:0;
