'use strict';
// Execute the actual SC1 injection/retry statements and real final-budget reducer.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),acorn=require('acorn');
const {functionSource}=require('./lib-perf-round1');
const web=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(web,f),'utf8'),source=read('tm-endturn-ai.js');
const ast=acorn.parse(source,{ecmaVersion:'latest'}),statements=[];
function visit(n){if(!n||typeof n!=='object')return;if(n.type==='IfStatement'){const t=source.slice(n.start,n.end);if(t.startsWith('if (TM.BuildingOrders) tp1 +=')||t.startsWith('if (p1 && TM.BuildingOrders && TM.BuildingOrders.missing'))statements.push(t);}Object.values(n).forEach(v=>Array.isArray(v)?v.forEach(visit):visit(v));}visit(ast);
assert.equal(statements.length,2,'both actual SC1 wiring statements required');
const injection=statements.find(s=>s.includes('tp1 +=')),repair=statements.find(s=>s.includes('_buildingFilled'));
const retry=functionSource(source,'_runIncrementalSc1Retry');
const infer=functionSource(read('tm-endturn-ai-infer.js'),'_endTurn_aiInfer');
function fixture(){
  const c={console,Date,Math,Set,Map,crypto:require('crypto').webcrypto,TM:{Endturn:{AI:{}}},P:{conf:{},ai:{model:'controlled'}},GM:{turn:2,_campaignId:'c',_timelineId:'t',_turnAiResults:{}},_dbg(){},_tok:n=>n,_modelFamily:'openai',_sc1ExtraPassUsed:false,p1:{events:[]},tp1:'历史材料'.repeat(18000)+'\n\n=== 输出格式强约束 (FINAL RULE·不可违反) ===\n'};c.window=c;vm.createContext(c);
  vm.runInContext(read('tm-building-orders.js'),c);vm.runInContext(read('tm-endturn-ai-sc1-budget.js'),c);
  c.P.adminHierarchy={a:{divisions:[{id:'r',name:'府',buildings:[]}]}};
  const pr=c.TM.BuildingOrders.propose(c.GM,c.P,'府',{name:'书院'},{costActual:5000,timeActual:3},'兴造书院');
  c.ctx={input:{buildingOrders:c.TM.BuildingOrders.collect(c.GM,c.P,{economic:pr.content})}};vm.runInContext(retry,c);
  return {c,pr,async run(){await vm.runInContext('(async()=>{'+repair+'})()',c);}};
}
let pass=0,fail=0;async function test(name,fn){try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+' '+e.stack);}}
(async()=>{
  await test('actual final-rule injection survives hard context trimming and includes stable request metadata',()=>{
    const f=fixture(),c=f.c;vm.runInContext(injection,c);const body={model:'controlled',messages:[{role:'system',content:'世界真值'},{role:'user',content:c.tp1}],max_tokens:1200};
    const r=c.TM.Endturn.AI.subcalls.finalizeSc1RequestBody(body,{contextTokens:8192,completionTokens:1200});assert(r.body.messages[1].content.includes(f.pr.id));assert(r.body.messages[1].content.includes('building_decisions'));assert(r.body.messages[1].content.length<c.tp1.length);assert(Number.isFinite(r.diagnostics.finalTotalTokens)&&r.diagnostics.finalTotalTokens<=8192);
  });
  await test('no registered orders add no new prompt or request',async()=>{
    const f=fixture();f.c.ctx.input.buildingOrders.ids=[];const before=f.c.tp1;vm.runInContext(injection,f.c);assert.equal(f.c.tp1,before);let calls=0;f.c._callEndturnAI=async()=>{calls++;};await f.run();assert.equal(calls,0);
  });
  await test('ordinary missing decision runs one actual bounded incremental retry with original order context',async()=>{
    const f=fixture();let calls=0;
    f.c._callEndturnAI=async(body,opts)=>{calls++;assert.equal(opts.maxRetries,0);assert.equal(opts.id,'sc1_inc_retry');assert(body.messages[1].content.includes(f.pr.id));assert(body.messages[1].content.includes('building_decisions":[]'));return{parse:{parsed:{building_decisions:[{requestId:f.pr.id,decision:'approve'}]}}};};
    await f.run();await f.run();assert.equal(calls,1);assert.equal(f.c.p1.building_decisions[0].requestId,f.pr.id);assert.equal(f.c._sc1ExtraPassUsed,true);
  });
  await test('previous SC1 repair/rescue use prevents an extra building retry',async()=>{
    const f=fixture();f.c._sc1ExtraPassUsed=true;let calls=0;f.c._callEndturnAI=async()=>{calls++;};await f.run();assert.equal(calls,0);assert(!f.c.p1.building_decisions);
  });
  await test('failed or empty retry does not loop or invent an approval',async()=>{
    for(const kind of ['throw','empty']){const f=fixture();let calls=0;f.c._callEndturnAI=async()=>{calls++;if(kind==='throw')throw Error('controlled');return{parse:{parsed:{}}};};await f.run();await f.run();assert.equal(calls,1);assert(!f.c.p1.building_decisions);}
  });
  await test('retry response from a stale world does not merge into the current result',async()=>{
    const f=fixture();f.c._callEndturnAI=async()=>{f.c.GM={...f.c.GM,_timelineId:'new'};return{parse:{parsed:{building_decisions:[{requestId:f.pr.id,decision:'approve'}]}}};};await f.run();assert(!f.c.p1.building_decisions);
  });
  await test('oversized mandatory order context still fails closed instead of bypassing model budget',()=>{
    const f=fixture(),c=f.c;vm.runInContext(injection,c);assert.throws(()=>c.TM.Endturn.AI.subcalls.finalizeSc1RequestBody({messages:[{role:'system',content:'x'},{role:'user',content:c.tp1}],max_tokens:1500},{contextTokens:1600,completionTokens:1500}),e=>e.code==='mandatory_context_overflow');
  });
  for(const external of [true,false])await test('real AI-infer initialization retains the construction batch ('+(external?'pipeline':'legacy caller')+')',async()=>{
    const f=fixture(),c=f.c,stop=new Error('stop-at-real-prompt-boundary');let captured;
    c.P.ai.key='controlled';c.getTimeRatio=()=>1;c.showLoading=()=>{};c.TM.Endturn.AI.prompt={build:async ctx=>{captured=ctx;throw stop;}};vm.runInContext(infer,c);
    await assert.rejects(()=>c._endTurn_aiInfer({economic:f.pr.content},'',[],{},external?f.c.ctx:null),e=>e===stop);
    assert(c.TM.BuildingOrders.current(c.GM,c.P,captured.input.buildingOrders,false));assert.equal(captured.input.buildingOrders.ids[0],f.pr.id);
    if(external)assert.equal(captured.input.buildingOrders,f.c.ctx.input.buildingOrders);
  });
  console.log(JSON.stringify({pass,fail,skip:0,waived:0}));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
