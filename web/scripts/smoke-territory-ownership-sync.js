'use strict';
// Runs production ownership writers and formal-map readers on synthetic worlds only.
(async function () {
  const fs = await import('node:fs'), path = await import('node:path');
  const vm = await import('node:vm'), assert = (await import('node:assert/strict')).default;
  const root = path.resolve(__dirname, '..');
  function fixture() {
    const events = [], refreshes = [], derived = [];
    const a = { id:'fa', name:'甲国', color:'#bb4422', territories:['东州'], provinceIds:['r1'] };
    const b = { id:'fb', name:'乙国', color:'#2244bb', territories:['西州'], provinceIds:['r2'] };
    const d1 = {id:'d1', name:'东州', mappedRegions:['r1'], factionId:'fa', owner:'甲国', population:{mouths:1000}};
    const d2 = {id:'d2', name:'西州', mappedRegions:['r2'], factionId:'fb', owner:'乙国', population:{mouths:2000}};
    const map = {id:'test-map', width:200, height:100, mapSchemaVersion:1, items:[], factionColors:{}, factions:{
      fa:{scenarioFactionId:'fa',label:'甲国',color:a.color}, fb:{scenarioFactionId:'fb',label:'乙国',color:b.color}}, regions:[
      {id:'r1',name:'东州',adminBinding:'d1',owner:'fa',currentOwner:'fa',ownerKey:'fa',controller:'fa',factionId:'fa',factionName:'甲国',ownerName:'甲国',color:a.color,points:[[0,0],[100,0],[100,100],[0,100]],data:{groupKey:'fa'}},
      {id:'r2',name:'西州',adminBinding:'d2',owner:'fb',currentOwner:'fb',ownerKey:'fb',controller:'fb',factionId:'fb',factionName:'乙国',ownerName:'乙国',color:b.color,points:[[100,0],[200,0],[200,100],[100,100]],data:{groupKey:'fb'}}]};
    const G = {turn:7,facs:[a,b],chars:[],armies:[],mapData:map,_provinceToFaction:{'东州':'甲国',r1:'甲国','西州':'乙国'},
      provinceStats:{'东州':{owner:'甲国',currentOwner:'甲国',factionId:'fa'},'西州':{owner:'乙国'}},
      adminHierarchy:{fa:{factionId:'fa',divisions:[d1]},fb:{factionId:'fb',divisions:[d2]}}};
    const ctx = {console,GM:G,P:{conf:{},factions:[a,b]},setTimeout(){},clearTimeout(){},_dbg(){},toast(){},
      document:{getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];},addEventListener(){}},
      addEventListener(){},GameEventBus:{emit:(name,payload)=>events.push({name,payload})},
      refreshMapDisplay:()=>refreshes.push('legacy'),TM:{FactionDerivedEconomy:{compute(){derived.push({map:map.regions[0].owner,division:d1.factionId});}}}};
    ctx.window=ctx; ctx.globalThis=ctx;
    ctx.TMPhase8FormalBridge={_state:{mapMode:'owner',mapScale:'realm'},_esc:String,_attr:String,
      _getActiveScenario:()=>null,_activeScenarioId:()=>'',_hasRegionMap:m=>!!(m&&m.regions&&m.regions.length),
      _getScenarioMapData:()=>null,_mapIdentity:m=>m&&m.id};
    vm.createContext(ctx);
    for (const f of ['tm-map-system.js','tm-faction-membership.js','phase8-formal-map.js']) vm.runInContext(fs.readFileSync(path.join(root,f),'utf8'),ctx,{filename:f});
    ctx.refreshMapDisplay=()=>refreshes.push('legacy');
    ctx.TMPhase8FormalBridge.map.invalidateFormalMap=()=>refreshes.push('invalidate');
    ctx.TMPhase8FormalBridge.map.refreshMapFromRuntime=()=>refreshes.push('formal');
    return {ctx,G,a,b,map,d1,d2,events,refreshes,derived};
  }
  const tests=[]; function test(name,run){tests.push({name,run});}
  function assertTransferred(f) {
    assert.equal(f.G._provinceToFaction['东州'],'乙国','canonical ownership');
    assert.equal(f.G._provinceToFaction.r1,'乙国','existing ID alias must not remain stale');
    assert.equal(f.G.provinceStats['东州'].currentOwner,'乙国','higher-priority stats alias');
    assert.equal(f.d1.factionId,'fb','administrative owner');
    assert.equal(f.map.regions[0].owner,'fb','map owner');
    assert.equal(f.ctx.TMMapRuntime.toAIContext().regions[0].factionName,'乙国','AI context');
    assert.equal(f.ctx.TMPhase8FormalBridge.map.ownerName(f.map.regions[0]),'乙国','formal realm owner');
    assert(!f.a.territories.includes('东州')&&!f.a.provinceIds.includes('r1'),'remove from old country');
    assert(f.b.territories.includes('东州'),'add to new country');
    assert(f.refreshes.includes('formal'),'request formal SVG refresh, not just legacy canvas');
    assert(f.derived.some(x=>x.map==='fb'&&x.division==='fb'),'derived calculation after all ownership mirrors');
  }
  test('map API transfers canonical owner, country, administration, AI and formal map together',()=>{
    const f=fixture(); f.ctx.TMMapRuntime.setRegionOwner('r1','乙国'); assertTransferred(f);
  });
  test('membership API updates the map and AI in the same turn',()=>{
    const f=fixture(); f.ctx.TM.FactionMembership.assignProvince('东州','乙国'); assertTransferred(f);
  });
  test('stable faction ID resolves to current country name',()=>{
    const f=fixture(); f.ctx.TMMapRuntime.setRegionOwner('r1','fb'); assertTransferred(f);
  });
  test('same owner is idempotent and does not duplicate history',()=>{
    const f=fixture(); f.ctx.TMMapRuntime.setRegionOwner('r1','乙国'); const n=f.map.regions[0].ownerHistory.length;
    f.ctx.TMMapRuntime.setRegionOwner('r1','乙国'); assert.equal(f.map.regions[0].ownerHistory.length,n);
  });
  test('unowned is explicit and cannot fall back to old scenario owner',()=>{
    const f=fixture(); f.ctx.TMMapRuntime.setRegionOwner('r1','');
    assert.equal(f.map.regions[0].owner,''); assert.equal(f.d1.factionId,'');
    assert.equal(f.ctx.TMPhase8FormalBridge.map.ownerKey(f.map.regions[0]),'');
    assert(!f.a.territories.includes('东州')); assert.equal(f.map.regions[0].color,'#cccccc');
  });
  test('AI ownership_changes uses the same synchronized write path',()=>{
    const f=fixture(); f.ctx.TMMapRuntime.applyAIMapChanges({map_changes:{ownership_changes:[{region_id:'r1',new_owner:'fb',reason:'测试易主'}]}});
    assertTransferred(f);
  });
  test('reloading and rollback read current world rather than cached former owner',()=>{
    const f=fixture(),before=JSON.stringify(f.G); f.ctx.TMPhase8FormalBridge.map.ownerName(f.map.regions[0]);
    f.ctx.TMMapRuntime.setRegionOwner('r1','fb'); const after=JSON.parse(JSON.stringify(f.G));
    f.ctx.GM=after; assert.equal(f.ctx.TMMapRuntime.toAIContext().regions[0].owner,'fb');
    assert.equal(f.ctx.TMPhase8FormalBridge.map.ownerName(after.mapData.regions[0]),'乙国');
    f.ctx.GM=JSON.parse(before); assert.equal(f.ctx.TMPhase8FormalBridge.map.ownerName(f.ctx.GM.mapData.regions[0]),'甲国');
  });
  test('unrelated region and country cash are not transferred',()=>{
    const f=fixture(); f.a.treasury=100; f.b.treasury=200; const west=JSON.stringify(f.d2);
    f.ctx.TMMapRuntime.setRegionOwner('r1','fb'); assert.equal(JSON.stringify(f.d2),west);
    assert.equal(f.a.treasury,100); assert.equal(f.b.treasury,200);
  });
  let failed=0; for(const t of tests){try{await t.run();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}
  console.log(JSON.stringify({suite:'territory-ownership-sync',total:tests.length,passed:tests.length-failed,failed}));
  if(failed)process.exitCode=1;
})().catch(e=>{console.error(e);process.exitCode=1;});
