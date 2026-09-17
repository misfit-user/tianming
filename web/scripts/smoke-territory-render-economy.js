'use strict';
(async function(){
  const fs=await import('node:fs'),path=await import('node:path'),vm=await import('node:vm');
  const assert=(await import('node:assert/strict')).default;
  const {functionSource,mapRenderer}=await import('./lib-perf-round1.js');
  const root=path.resolve(__dirname,'..'),repo=path.dirname(root);
  const factorySource=functionSource(fs.readFileSync(path.join(__dirname,'smoke-territory-ownership-sync.js'),'utf8'),'fixture');
  const fixture=vm.runInNewContext('('+factorySource+')',{fs,path,vm,root,console});
  const layout=(await import('../tm-map-realm-layout.js')).default;
  const formal=fs.readFileSync(path.join(root,'phase8-formal-map.js'),'utf8');
  const tests=[];function test(name,run){tests.push({name,run});}
  test('production realm SVG recolors changed land and removes the old internal border',()=>{
    const f=fixture(),h=mapRenderer(repo,f.map.regions);
    h.c.map=f.map;h.c.state.mapMode='owner';h.c.state.mapScale='realm';
    h.c.ownerKey=f.ctx.TMPhase8FormalBridge.map.ownerKey;
    h.c.ownerName=f.ctx.TMPhase8FormalBridge.map.ownerName;
    h.c.findFaction=f.ctx.TMPhase8FormalBridge.map.findFaction;
    vm.runInContext(['canonicalOwnerKey','regionColor'].map(n=>functionSource(formal,n)).join('\n'),h.c);
    h.c.TMMapRealmLayout=layout;h.c.administrativeLabelLayer=()=>'';
    const draw=()=>h.c.buildMapSurface(f.map,200,100,'','realm');
    const before=draw();
    assert.match(before,/<path class="tmf-region ming-region"[^>]*data-id="r1"[^>]*fill="#bb4422"/);
    const sig=h.c.formalMapSignature(f.map,'realm');
    f.ctx.TMMapRuntime.setRegionOwner('r1','fb');
    const after=draw();assert.notEqual(h.c.formalMapSignature(f.map,'realm'),sig);
    assert.match(after,/<path class="tmf-region ming-region"[^>]*data-id="r1"[^>]*fill="#2244bb"/);
    const count=s=>Number(s.match(/data-major-edges="(\d+)"/)[1]);assert(count(after)<count(before),'conquered neighbors no longer have a national border');
    f.ctx.TMMapRuntime.setRegionOwner('r1','');assert.match(draw(),/<path class="tmf-region ming-region"[^>]*data-id="r1"[^>]*fill="#cccccc"/);
  });
  test('real faction index and fiscal-profile population recalculate before returning',()=>{
    const f=fixture();
    f.ctx.getFactionProvinces=f.ctx.TM.FactionMembership.getProvinces;
    for(const file of ['tm-faction-index.js','tm-faction-derived-economy.js'])vm.runInContext(fs.readFileSync(path.join(root,file),'utf8'),f.ctx,{filename:file});
    for(const fac of [f.a,f.b])fac.fiscalProfile={schema:'tm-fiscal-profile/1',ratesPerPersonYear:{money:2,grain:3,cloth:0},civilExpenseShare:0};
    f.ctx.TM.FactionIndex.rebuild();f.ctx.TM.FactionDerivedEconomy.compute();
    assert.equal(f.a.derivedEconomy._source.modeledPopulation,1000);
    assert.equal(f.b.derivedEconomy._source.modeledPopulation,2000);
    assert.equal(f.G._facIndex['甲国'].provinces.length,1,'ID/name aliases count once');
    f.ctx.TMMapRuntime.setRegionOwner('r1','fb');
    assert.equal(f.a.derivedEconomy._source.modeledPopulation,0);
    assert.equal(f.b.derivedEconomy._source.modeledPopulation,3000);
    assert.equal(f.a.derivedEconomy.annualTaxIncome,0);
    assert.equal(f.b.derivedEconomy.annualTaxIncome,5400);
    assert.equal(f.G._facIndex['甲国'].provinces.length,0);
    assert.equal(f.G._facIndex['乙国'].provinces.length,2);
  });
  test('write failure rolls back all prior aliases without emitting a transfer',()=>{
    const f=fixture();Object.freeze(f.d1);const before=JSON.stringify(f.G);
    assert.throws(()=>f.ctx.TMMapRuntime.setRegionOwner('r1','fb'));
    assert.equal(JSON.stringify(f.G),before);assert.equal(f.events.length,0);assert.equal(f.derived.length,0);
  });
  test('ambiguous display name is rejected while explicit region ID remains usable',()=>{
    const f=fixture();f.map.regions[1].name='东州';
    assert.throws(()=>f.ctx.TM.FactionMembership.assignProvince('东州','fb'),/不唯一/);
    f.ctx.TM.FactionMembership.assignProvince('r1','fb');assert.equal(f.map.regions[0].owner,'fb');
  });
  let failed=0;for(const t of tests){try{await t.run();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}
  console.log(JSON.stringify({suite:'territory-render-economy',total:tests.length,passed:tests.length-failed,failed}));if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
