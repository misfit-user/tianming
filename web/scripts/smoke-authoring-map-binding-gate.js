'use strict';
const assert=require('assert/strict'),path=require('path');
// Offline regression: node web/scripts/smoke-authoring-map-binding-gate.js [web-root]
const root=path.resolve(process.argv[2] || path.join(__dirname,'..'));
const AA=require(path.join(root,'editor-authoring-agent.js'));
const opts={noMemoryRecall:true,conventions:'',toolPacks:false,maxIterations:6,maxTokens:1000000};
const node=(id,name,pop)=>({id,name,population:pop,children:[{id:id+'-child',name:name+'子级',population:pop*2}]});
const base=()=>({name:'反馈夹具',factions:[{id:'chu',name:'楚'},{id:'jp',name:'日本'},{id:'mg',name:'蒙古'}],characters:[],adminHierarchy:{楚:{divisions:[{id:'gui',name:'桂州',population:200}]},日本:{divisions:[node('ezo','蝦夷诸村',65000),node('watari','渡嶋',45000)]},蒙古:{divisions:[node('mg1','蒙古人口项',165245),node('mg2','室韦河诸部',109491)]}},mapData:{regions:[{id:'r-gui',name:'桂州',adminBinding:'gui'}]}});
const call=(name,input)=>({name,id:name,input});
async function run(draft,edits){let turn=0;return AA.runAuthoringLoop(draft,'调整楚的上级，保留原有末级区划及地块。',{...opts,caller:()=>Promise.resolve({toolCalls:turn++===0?edits:[call('finish',{summary:'完成'})]})});}
(async()=>{
 const d=base(),before=JSON.stringify(d.adminHierarchy);
 assert.equal(AA.validateDraft(d,'admin-population').violations.length,4);
 const r=await run(d,[call('applyEdit',{path:'name',value:'调整名称'})]);
 assert(r.finished,'unchanged legacy population defects must not block unrelated edits');
 assert.equal(JSON.stringify(d.adminHierarchy),before,'fix must not fabricate population changes');
 assert.equal(r.finalValidation.results['admin-population'].violations.length,4,'real legacy defects remain visible');
 console.log('PASS legacy Japan/Mongolia population defects stay visible and unchanged without blocking unrelated edits');
 const n=base(),r2=await run(n,[call('applyEdit',{path:'adminHierarchy.日本.divisions.0.population',value:1})]);
 assert(!r2.finished,'worsening existing population deficit must be blocked');
 console.log('PASS worsening a legacy population deficit remains blocked');
 const z=base(),r3=await run(z,[call('applyEdit',{path:'adminHierarchy.楚.divisions',value:[{id:'dao',name:'广南道',population:200,children:[{id:'gui',name:'桂州',population:200,parentId:'dao'}]}]})]);
 assert(r3.finished);assert(AA.validateDraft(z,'region-coverage').ok);assert.equal(z.mapData.regions.length,1);
 console.log('PASS adding an upper administrative layer preserves leaf ID and map binding');
 const x=base(),r4=await run(x,[call('applyEdit',{path:'adminHierarchy.楚.divisions',value:[{id:'dao',name:'广南道',population:200,children:[]}]})]);
 assert(!r4.finished);assert(!AA.validateDraft(x,'region-coverage').ok);
 assert(r4.resumeState,'new broken bindings keep a recoverable draft');
 console.log('PASS replacing away a bound leaf is blocked and the draft remains recoverable');
 const existing=base();existing.mapData.regions[0].adminBinding='already-missing';
 const r5=await run(existing,[call('applyEdit',{path:'name',value:'无关改名'})]);
 assert(r5.finished);assert(!AA.validateDraft(existing,'region-coverage').ok);
 console.log('PASS existing broken map binding remains visible without blocking unrelated work');
 const swapped=base();swapped.mapData.regions[0].adminBinding='already-missing';
 const r6=await run(swapped,[call('applyEdit',{path:'mapData.regions.0.adminBinding',value:'new-missing'})]);
 assert(!r6.finished,'same issue count with a different broken binding is a regression');
 console.log('PASS replacing one broken binding with another cannot pass by equal counts');
 const legacy=base();delete legacy.mapData.regions[0].adminBinding;
 const r7=await run(legacy,[call('applyPush',{path:'adminHierarchy.楚.divisions',value:{id:'nomap',name:'无地图节点'}})]);
 assert(r7.finished);assert(!AA.validateDraft(legacy,'region-coverage').ok);
 console.log('PASS new legacy name-only orphan keeps the existing warning-only behavior');
 const resumed=base();let error,calls=0;
 try{await AA.runAuthoringLoop(resumed,'保留所有绑定',{...opts,caller:()=>++calls===1?Promise.resolve({toolCalls:[call('applyEdit',{path:'adminHierarchy.楚.divisions',value:[]})]}):Promise.reject(Error('controlled stop'))});}catch(e){error=e;}
 assert(error&&error.partial&&error.partial.resumeState);
 const r8=await AA.runAuthoringLoop(resumed,'继续',{...opts,resumeState:error.partial.resumeState,caller:()=>Promise.resolve({toolCalls:[call('finish',{summary:'结束'})]})});
 assert(!r8.finished,'resume must retain an existing empty baseline and block newly broken bindings');
 console.log('PASS resume retains an empty pre-change binding baseline instead of accepting broken draft');
 console.log('PASS feedback cases 8/8 (synthetic data; no player save or real API)');
})().catch(e=>{console.error(e.stack||e);process.exitCode=1;});
