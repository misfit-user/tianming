'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const G=require('../map-editor-scenario-geometry.js');
const rect=(x,y,w,h)=>({type:'Polygon',coordinates:[[[x,y],[x+w,y],[x+w,y+h],[x,y+h],[x,y]]]});
const json=v=>JSON.parse(JSON.stringify(v)),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function source(){return {id:'sample',name:'示例剧本',dynasty:'宋',era:'测试',map:{id:'sample-map',width:60,height:40,
  factions:{a:{name:'甲国',color:'#aa7755'},b:{name:'乙国',color:'#5577aa'}},
  circuitRegistry:[{id:'c1',name:'第一道',memberRegionIds:['r1','r2','r3']},{id:'c2',name:'第二道',memberRegionIds:['r4']}],
  regions:[{id:'r1',name:'甲府',ownerKey:'a',circuitId:'c1',geometry:rect(0,0,10,10),neighbors:['r2']},
    {id:'r2',name:'乙府',ownerKey:'a',circuitId:'c1',geometry:rect(10,0,10,10),neighbors:['r1','r3']},
    {id:'r3',name:'丙州',ownerKey:'b',circuitId:'c1',geometry:rect(20,0,10,10),neighbors:['r2']},
    {id:'r4',name:'岛府',ownerKey:'a',circuitId:'c2',geometry:{type:'MultiPolygon',coordinates:[rect(0,20,10,10).coordinates,[rect(20,20,10,10).coordinates[0],rect(22,22,2,2).coordinates[0]]]}}]}};}
let n=0;function test(name,fn){fn();n++;console.log('PASS '+name);}
async function main(){
  test('generated library matches current official sources and compiler',()=>{require('node:child_process').execFileSync(process.execPath,[path.join(__dirname,'../../scripts/build-map-editor-scenario-library.cjs'),'--check'],{stdio:'pipe',windowsHide:true});});
  const raw=source(),before=JSON.stringify(raw),bundle=G.compile(raw,{path:'scenarios/示例（官方）.json',sha256:'a'.repeat(64)});
  test('catalog compilation preserves its scenario source',()=>assert.equal(JSON.stringify(raw),before));
  test('province aggregates dissolve shared edges and partition by actual owner',()=>{
    assert.equal(bundle.layers.region.length,3);const a=bundle.layers.region.find(r=>r.sourceCircuitId==='c1'&&r.factionId==='a');
    assert.equal(a.polygon.length,4);assert.equal(a.sourceRegionIds.length,2);assert.deepEqual(a.neighbors,[bundle.layers.region.find(r=>r.factionId==='b').id]);
  });
  test('multipart holes survive aggregation',()=>{const island=bundle.layers.region.find(r=>r.sourceCircuitId==='c2');assert.equal(island.extraPolygonHoles[0].length,1);});
  test('all tiers have valid stable parent references',()=>{const m=G.materialize(bundle,'all','song'),ids=new Set(m.divisions.map(d=>d.id));assert.equal(ids.size,9);m.divisions.forEach(d=>{if(d.parentId)assert(ids.has(d.parentId));});});
  test('single-layer extraction contains only requested layer and retains provenance',()=>{for(const tier of ['region','realm','prefecture']){const m=G.materialize(bundle,tier,'song');assert(m.divisions.every(d=>d.level===G.levels[tier]&&!d.parentId));assert(m.divisions.every(d=>d.sourceRegionIds.length));assert.equal(m.meta.scenarioMap.source.id,'sample');}});
  test('unknown layer and invented province membership are rejected',()=>{assert.throws(()=>G.materialize(bundle,'county','song'));const wrong=source();wrong.map.regions[0].circuitId='invented';assert.throws(()=>G.compile(wrong));});
  const bytes=Buffer.from(JSON.stringify(bundle)),entry={id:'sample',name:'示例剧本',mapName:'示例地图',dynasty:'宋',levels:['all','realm','region','prefecture'],counts:{realm:2,region:3,prefecture:4},source:bundle.source,filename:'sample.json',bytes:bytes.length,sha256:sha(bytes)};
  const index=Buffer.from(JSON.stringify({schemaVersion:'tm-map-editor-library-index/1',entries:[entry]}));let requests=[];
  const ctx={console,setTimeout,clearTimeout,AbortController,TextEncoder,TextDecoder,URL,crypto:crypto.webcrypto,location:{href:'http://fixture/map-editor.html'},requestAnimationFrame:()=>1,localStorage:{getItem:()=>null,setItem:()=>{}},
    fetch:async(url)=>{requests.push(url);const data=url.endsWith('index.json')?index:bytes;return {ok:true,arrayBuffer:async()=>data.buffer.slice(data.byteOffset,data.byteOffset+data.byteLength)};}};
  ctx.window=ctx;vm.createContext(ctx);
  ['map-editor-dynasty.js','map-editor-undo.js','map-editor-core.js','map-editor-topology.js','map-editor-to-game.js','tm-authoring-extensions.js','tm-agent-kernel.js','libs/polygon-clipping-0.15.7.min.js','map-editor-scenario-geometry.js','map-editor-scenario-library.js','map-editor-agent-tools.js','editor-authoring-agent-provider.js','editor-authoring-agent.js','map-editor-agent.js'].forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),ctx,{filename:f}));
  const ME=ctx.TM.MapEditor;ME.EDITOR.undo=ME.undo.create();
  test('new map initializes after an imported map and resets the active layer cache',()=>{
    ME.EDITOR.map=G.materialize(bundle,'all','song');ME.EDITOR.mapLayer='province';ME.EDITOR._visibleCache=[{stale:true}];ME.newMap('ming');
    assert.equal(ME.EDITOR.map.divisions.length,0);assert.equal(ME.EDITOR.mapLayer,null);assert.equal(ME.EDITOR._visibleCache,null);
  });
  ME.EDITOR.map={title:'原图',dynasty:'ming',divisions:[],factions:[]};
  let draft={nativeMap:json(ME.EDITOR.map)},context=ME.agentTools.capture({});
  let list=await ME.agentTools.dispatch('listScenarioMaps',{query:'示例'},draft,context);
  test('model sees a bounded catalog with stable source IDs',()=>{assert(list.ok);assert.equal(list.maps[0].id,'sample');assert(!JSON.stringify(list).includes('coordinates'));});
  let loaded=await ME.agentTools.dispatch('loadScenarioMap',{scenarioId:'sample',tier:'all'},draft,context);
  test('load tool stages all tiers without replacing the current map',()=>{assert(loaded.ok,loaded.reason);assert.equal(draft.nativeMap.divisions.length,9);assert.equal(ME.EDITOR.map.title,'原图');});
  const readOnly=await ME.agentTools.dispatch('loadScenarioMap',{scenarioId:'sample',tier:'region'},draft,ME.agentTools.capture({readOnly:true}));
  test('read-only context cannot load a replacement map',()=>assert(!readOnly.ok));
  const controller=new AbortController();controller.abort();
  await assert.rejects(ME.scenarioLibrary.load('sample','all',controller.signal));
  test('aborted loads never produce a candidate',()=>assert.equal(ME.EDITOR.map.title,'原图'));
  let round=0;
  let completeResults=0;
  const response=await ME.agent.run('使用示例三级地图，把甲府改为临安',{caller:async(conversation)=>{
    conversation.filter(m=>m.role==='tool').forEach(m=>(m.toolResults || []).forEach(t=>{JSON.parse(t.content);completeResults++;}));
    return {toolCalls:[
    {name:'listScenarioMaps',input:{query:'示例'}},{name:'loadScenarioMap',input:{scenarioId:'sample',tier:'all'}},
    {name:'mapEditorEdit',input:{edits:[{id:'r1',patch:{name:'临安'}}]}},{name:'mapEditorFocus',input:{id:'r1'}},
    {name:'finish',input:{summary:'已载入并改名'}}
  ].slice(round,++round)};}});
  test('map results delivered to the model are complete JSON',()=>assert(completeResults>0));
  test('existing Guoshi loop loads and renames in one undoable transaction',()=>{assert(response.ok,JSON.stringify(response.result));assert.equal(ME.EDITOR.map.divisions.find(d=>d.id==='r1').name,'临安');assert.equal(ME.EDITOR.undo.undoStack.length,1);});
  const serialized=JSON.stringify(ME.EDITOR.map),native=json(ME.EDITOR.map),game=ctx.convertMapEditorToGame(native);
  test('game handoff contains leaf geometry and the renamed hierarchy without duplicated aggregates',()=>{assert.equal(game.regions.length,4);assert.equal(game.circuitRegistry.length,3);assert.equal(game.regions[0].name,'临安');assert(game.regions.every(r=>r.logicalRegionId===r.id));});
  test('one undo restores the map before scenario import',()=>{assert(ME.agent.undo().ok);assert.equal(ME.EDITOR.map.title,'原图');assert.equal(ME.EDITOR.map.divisions.length,0);});
  ME.loadMap(JSON.parse(serialized));
  test('native export/import keeps parent IDs, source IDs and extra-component holes',()=>{const d=ME.EDITOR.map.divisions.find(r=>r.id==='r4');assert(d.parentId);assert.equal(d.logicalRegionId,'r4');assert.equal(d.extraPolygonHoles[0].length,1);assert(!ME.pointInDivision(d,23,23));assert(ME.pointInDivision(d,21,21));});
  test('changing visible layer changes picking instead of showing overlapping tiers',()=>{ME.scenarioLibrary.showLayer('province');const hit=ME.findDivisionAt(5,5);assert(hit);assert.equal(hit.level,'province');ME.scenarioLibrary.showLayer('prefecture');assert.equal(ME.findDivisionAt(5,5).id,'r1');});
  draft={nativeMap:json(ME.EDITOR.map)};
  const modified=ME.agentTools.dispatch('mapEditorEdit',{edits:[{id:'r3',patch:{factionId:'a'}}]},draft,ME.agentTools.capture({}));
  test('ownership changes rebuild actual province and realm aggregates',()=>{assert(modified.ok,modified.reason);assert.equal(draft.nativeMap.meta.scenarioMap.counts.region,2);assert.equal(draft.nativeMap.meta.scenarioMap.counts.realm,1);assert.equal(ME.EDITOR.map.divisions.find(d=>d.id==='r3').factionId,'b');});
  draft={nativeMap:json(ME.EDITOR.map)};
  const moved=ME.agentTools.dispatch('mapEditorMoveVertex',{id:'r1',index:1,x:11,y:0},draft,ME.agentTools.capture({}));
  test('leaf boundary edits refresh derived tiers',()=>{assert(moved.ok,moved.reason);assert.equal(moved.affected.length,2);const parent=draft.nativeMap.divisions.find(d=>d.id===draft.nativeMap.divisions.find(d=>d.id==='r1').parentId);assert(parent.polygon.length>=4);});
  const root=path.join(__dirname,'..'),catalog=JSON.parse(fs.readFileSync(path.join(root,'data/maps/scenario-library/index.json'),'utf8'));
  for(const row of catalog.entries){
    const data=fs.readFileSync(path.join(root,'data/maps/scenario-library',row.filename)),b=JSON.parse(data.toString());
    test('real '+row.id+' asset bytes and layer membership match catalog',()=>{assert.equal(data.length,row.bytes);assert.equal(sha(data),row.sha256);assert.equal(b.layers.prefecture.length,row.counts.prefecture);const ids=new Set(b.layers.prefecture.map(d=>d.id));assert.equal(ids.size,row.counts.prefecture);const members=b.layers.region.flatMap(d=>d.sourceRegionIds);assert.equal(members.length,ids.size);assert.equal(new Set(members).size,ids.size);assert(!row.source.path.includes('\\'));});
    for(const tier of ['all','region','prefecture']){const m=G.materialize(b,tier,row.dynasty);test('real '+row.id+' '+tier+' import keeps complete geometry',()=>{assert(m.divisions.length);assert(m.divisions.every(d=>d.polygon.length>=3));assert(m.divisions.every(d=>d.logicalRegionId===d.id));});}
  }
  console.log('smoke-map-editor-scenario-library: '+n+' PASS / 0 FAIL');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
