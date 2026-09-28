'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const context={console,setTimeout,clearTimeout,AbortController,TextEncoder,TextDecoder,URL,crypto:require('node:crypto').webcrypto,
  requestAnimationFrame:()=>1,localStorage:{getItem:()=>null,setItem:()=>{}},fetch:()=>{throw Error('Offline test must not access a provider');}};
context.window=context;vm.createContext(context);
['map-editor-dynasty.js','map-editor-undo.js','map-editor-core.js','map-editor-topology.js','tm-authoring-extensions.js',
  'tm-agent-kernel.js','map-editor-agent-tools.js','editor-authoring-agent-provider.js','editor-authoring-agent.js','map-editor-agent.js']
  .forEach(f=>vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8'),context,{filename:f}));
const ME=context.TM.MapEditor,A=ME.agentTools,json=v=>JSON.parse(JSON.stringify(v));
function fixture(){
  ME.EDITOR.undo=ME.undo.create();
  ME.EDITOR.map={title:'地图测试',dynasty:'ming',era:'测试',custom:{keep:['原数据']},terrainMap:{dataB64:'preserved-raster'},
    factions:[{id:'song',name:'宋'},{id:'jin',name:'金'}],roads:[{id:'r',points:[[0,0],[20,20]]}],
    divisions:[ME.createDivision({id:'a',name:'甲',polygon:[[0,0],[10,0],[10,10],[0,10]]}),
      ME.createDivision({id:'b',name:'乙',polygon:[[10,0],[20,0],[20,10],[10,10]]})]};
  ME.EDITOR.map.divisions.forEach(ME.recomputeDerived);ME.EDITOR.selectedIds=['a'];ME.EDITOR.dirty=false;
  return ME.EDITOR.map;
}
let count=0;
function ok(name,fn){fn();count++;console.log('PASS '+name);}
function tool(name,input,draft,ctx){return A.dispatch(name,input,draft,ctx || A.capture({}));}
const finish={name:'finish',input:{summary:'已完成测试要求'}};
function caller(sequence,inspect){let i=0;return async function(conv,tools,opts){if(inspect)inspect(conv,tools,opts,i);return {toolCalls:sequence[i++] || [finish]};};}
async function main(){
  fixture();let draft={nativeMap:json(ME.EDITOR.map)};
  ok('overview paginates and reports stable IDs',()=>{let r=tool('mapEditorOverview',{limit:1},draft);assert.equal(r.nextOffset,1);assert.equal(r.divisions[0].id,'a');});
  ok('read returns indexed vertices without raster payload',()=>{let r=tool('mapEditorRead',{id:'a',offset:1,limit:2},draft);assert.equal(r.vertices[0].index,1);assert(!JSON.stringify(r).includes('preserved-raster'));});
  ok('batch rejects unknown factions without partial writes',()=>{let before=JSON.stringify(draft);assert(!tool('mapEditorEdit',{edits:[{id:'a',patch:{name:'临安'}},{id:'b',patch:{factionId:'missing'}}]},draft).ok);assert.equal(JSON.stringify(draft),before);});
  ok('cannot change IDs, geometry blobs or prototype keys with metadata tool',()=>{
    for(const patch of [{id:'c'},{polygon:[]},JSON.parse('{"__proto__":{"polluted":true}}')])assert(!tool('mapEditorEdit',{edits:[{id:'a',patch}]},draft).ok);
    assert.equal({}.polluted,undefined);
  });
  ok('read-only capture blocks native draft writes',()=>{assert(!tool('mapEditorEdit',{edits:[{id:'a',patch:{name:'临安'}}]},draft,A.capture({readOnly:true})).ok);});
  ok('shared coordinates move together without altering live map',()=>{
    const r=tool('mapEditorMoveVertex',{id:'a',index:1,x:11,y:0},draft);assert(r.ok,r.reason);assert.equal(r.affected.length,2);
    assert.equal(draft.nativeMap.divisions[1].polygon[0][0],11);assert.equal(ME.EDITOR.map.divisions[0].polygon[1][0],10);
  });
  ok('self crossing vertex edit rolls back',()=>{let before=JSON.stringify(draft);const r=tool('mapEditorMoveVertex',{id:'a',index:1,x:-5,y:5},draft);assert(!r.ok);assert.equal(JSON.stringify(draft),before);});
  fixture();ME.topology.migrateToTopology(.01);draft={nativeMap:json(ME.EDITOR.map)};
  ok('topology vertex IDs propagate to both divisions in candidate',()=>{
    const r=tool('mapEditorMoveVertex',{id:'a',index:1,x:11,y:0},draft);assert(r.ok,r.reason);assert.equal(r.affected.length,2);assert.equal(draft.nativeMap.divisions[1].polygon[0][0],11);
  });
  fixture();draft={nativeMap:json(ME.EDITOR.map)};ME.EDITOR.canvas={getBoundingClientRect:()=>({width:800,height:600})};
  ok('focus uses the native camera coordinate fields',()=>{assert(tool('mapEditorFocus',{id:'a'},draft).ok);assert.equal(ME.EDITOR.camera.x,395);assert.equal(ME.EDITOR.camera.y,295);});ME.EDITOR.canvas=null;
  const original=json(fixture()),depth=ME.EDITOR.undo.undoStack.length;let mutationCount=0;
  const unsub=ME.on('mutation',()=>mutationCount++);
  let r=await ME.agent.run('将甲改名为临安并划给宋',{caller:caller([
    [{name:'mapEditorOverview',input:{}}],
    [{name:'mapEditorEdit',input:{edits:[{id:'a',patch:{name:'临安',factionId:'song'}}]}}],
    [finish]
  ],(conv,tools)=>{assert(tools.some(t=>t.name==='mapEditorEdit'));assert(!tools.some(t=>t.name==='applyEdit'));})});
  ok('existing Guoshi loop commits the real native map once',()=>{assert(r.ok,JSON.stringify(r.result));assert(r.applied);assert.equal(ME.EDITOR.map.divisions[0].name,'临安');assert.equal(ME.EDITOR.undo.undoStack.length,depth+1);assert.equal(mutationCount,1);});
  ok('opaque map assets and neighboring geometry survive the commit',()=>{assert.deepEqual(json(ME.EDITOR.map.terrainMap),original.terrainMap);assert.deepEqual(json(ME.EDITOR.map.roads),original.roads);assert.deepEqual(json(ME.EDITOR.map.custom),original.custom);assert.deepEqual(json(ME.EDITOR.map.divisions[1]),original.divisions[1]);});
  ok('one undo restores the complete pre-agent map',()=>{assert(ME.agent.undo().ok);assert.deepEqual(json(ME.EDITOR.map),original);});unsub();
  fixture();let noOpDepth=ME.EDITOR.undo.undoStack.length;
  r=await ME.agent.run('只查看地图',{readOnly:true,caller:caller([[{name:'mapEditorOverview',input:{}}],[finish]],(conv,tools)=>assert(!tools.some(t=>t.effect==='draft-write')))});
  ok('read-only/no-op does not create history or dirty state',()=>{assert(r.ok);assert(!r.applied);assert.equal(ME.EDITOR.undo.undoStack.length,noOpDepth);assert(!ME.EDITOR.dirty);});
  fixture();let resolveLate;const waiting=ME.agent.run('改名',{caller:()=>new Promise(resolve=>{resolveLate=resolve;})});
  while(!resolveLate)await new Promise(resolve=>setTimeout(resolve,1));
  ME.updateDivision('a',{name:'手工编辑'},'manual');resolveLate({toolCalls:[{name:'mapEditorEdit',input:{edits:[{id:'a',patch:{name:'自动覆盖'}}]}},finish]});
  r=await waiting;
  ok('manual changes during generation cannot be overwritten',()=>{assert(!r.ok);assert.equal(ME.EDITOR.map.divisions[0].name,'手工编辑');assert.equal(ME.EDITOR.undo.undoStack.length,1);});
  fixture();resolveLate=null;const stopped=ME.agent.run('改名',{caller:()=>new Promise(resolve=>{resolveLate=resolve;})});
  while(!resolveLate)await new Promise(resolve=>setTimeout(resolve,1));
  ME.agent.stop();resolveLate({toolCalls:[{name:'mapEditorEdit',input:{edits:[{id:'a',patch:{name:'晚到回复'}}]}},finish]});
  r=await stopped;
  ok('stopping rejects late model writes',()=>{assert(!r.applied);assert.equal(ME.EDITOR.map.divisions[0].name,'甲');assert.equal(ME.EDITOR.undo.undoStack.length,0);});
  fixture();let ctx=A.capture({}),old={nativeMap:json(ME.EDITOR.map)};fixture();
  ok('switching documents invalidates old tool context',()=>assert(!tool('mapEditorFocus',{id:'a'},old,ctx).ok));
  fixture();r=await ME.agent.run('改名',{caller:caller([[{name:'mapEditorEdit',input:{edits:[{id:'a',patch:{name:'临安'}}]}},finish]])});assert(r.ok);
  ME.updateDivision('b',{name:'手工修改'},'manual');
  ok('agent undo never removes a later manual edit',()=>{assert(!ME.agent.undo().ok);assert.equal(ME.EDITOR.map.divisions[1].name,'手工修改');});
  fixture();await ME.agent.run('将甲改为临安',{caller:caller([[{name:'mapEditorEdit',input:{edits:[{id:'a',patch:{name:'临安'}}]}},finish]])});
  let remembered=false;
  await ME.agent.run('它现在叫什么',{caller:caller([[finish]],conv=>{remembered=conv.some(m=>(m.toolCalls || []).some(t=>t.name==='mapEditorEdit'));})});
  ok('follow-up receives the previous successful tool conversation',()=>assert(remembered));
  ME.updateDivision('a',{name:'手工新名'},'manual');let stale=false;
  await ME.agent.run('查看当前地图',{caller:caller([[finish]],conv=>{stale=conv.some(m=>(m.toolCalls || []).some(t=>t.name==='mapEditorEdit'));})});
  ok('manual edits invalidate stale conversation results',()=>assert(!stale));
  fixture();let turns=0;
  const unlimited=await ME.agent.run('逐项读取并完成',{caller:async()=>({toolCalls:turns++<30?[{name:'mapEditorOverview',input:{offset:turns,limit:1}}]:[finish]})});
  ok('task can continue past the previous 24-round limit',()=>{assert(unlimited.ok);assert(unlimited.result.iterations>24);});
  fixture();const large='x'.repeat(420000);ME.EDITOR.map.divisions[0].description=large;let largeRound=0,received=false;
  const largeResult=await ME.agent.run('读取完整说明',{readOnly:true,caller:async conv=>{
    for(const message of conv)for(const tr of message.toolResults || [])if(tr.name==='mapEditorRead'){const r=JSON.parse(tr.content);assert.equal(r.division.description,large);received=true;}
    return {toolCalls:largeRound++===0?[{name:'mapEditorRead',input:{id:'a',limit:1}}]:[finish]};
  }});
  ok('complete large tool result is not cut or stopped by the old 80000-token budget',()=>{assert(largeResult.ok);assert(received);assert(largeResult.result.tokensUsed>80000);});
  fixture();const beforeFailure=JSON.stringify(ME.EDITOR.map),undoBefore=ME.EDITOR.undo.undoStack.length;
  const detach=ME.on('mutation',event=>{if(event.label.startsWith('国师：'))ME.EDITOR.map.unexpectedWrite=true;});
  await assert.rejects(ME.agent.run('改名',{caller:caller([[{name:'mapEditorEdit',input:{edits:[{id:'a',patch:{name:'错误回写'}}]}},finish]])}));detach();
  ok('failed writeback restores both original data and history',()=>{assert.equal(JSON.stringify(ME.EDITOR.map),beforeFailure);assert.equal(ME.EDITOR.undo.undoStack.length,undoBefore);});
  console.log('smoke-map-editor-agent: '+count+' PASS / 0 FAIL');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
