'use strict';
// Read-only diagnosis: execute current production modules in a synthetic VM world.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'../..');
const {context}=require(path.join(root,'web/scripts/lib-memory-upgrade-r2.js'));
const {functionSource}=require(path.join(root,'web/scripts/lib-perf-round1.js'));
const result={scope:'synthetic current-code probes; no paid model calls, no player save access',cases:[]};
const add=(name,data)=>result.cases.push({name,...data});
function compile(c,maxTokens=1800,perHitMaxChars=180){return c.TM.MemoryContextCompiler.compileFromGM(c.GM,{turn:c.GM.turn,audience:'system',actorScope:'system',intent:'turn_inference',maxTokens,perHitMaxChars});}
function policy(i){return {id:'policy-'+String(i).padStart(2,'0'),name:'持续政策'+i,content:'第'+i+'项政策：新开荒土地免征田赋三年，由地方每年登记核查。旧田和旧欠仍依原制，严禁把此次优惠扩大到旧田。',status:'active',startedTurn:1};}
{
  const c=context();c.GM.activeEdicts=[policy(1)];const turns=[];
  for(let t=1;t<=50;t++){c.GM.turn=t;const r=compile(c);turns.push({turn:t,injected:r.injectedHits.some(h=>h.id==='policy-01')});}
  add('single-standing-policy-50-turn-control',{kept:turns.filter(t=>t.injected).length,total:turns.length,turns});
}
{
  const c=context();c.GM.turn=50;
  c.GM.chars=Array.from({length:100},(_,i)=>({id:'char-'+i,name:'官员'+i,alive:true,position:'地方官',faction:'朝廷',loyalty:60}));
  c.GM.activeEdicts=Array.from({length:24},(_,i)=>policy(i+1));
  const profile=c.TM.MemoryAdaptive.plan();
  const adaptive=compile(c,profile.memoryTokens,profile.perHitChars);
  add('actual-adaptive-policy-coverage',{mode:profile.mode,budget:profile.memoryTokens,perHitChars:profile.perHitChars,activePolicies:24,policiesIncluded:adaptive.injectedHits.filter(h=>h.source==='activeEdict').map(h=>h.id)});
  add('standing-policy-budget-competition',{characters:100,activePolicies:24,budgets:[600,1200,1800,3000,6000,12000].map(budget=>{
    const r=compile(c,budget);return {budget,ok:r.ok,tokenEstimate:r.tokenEstimate,policiesIncluded:r.injectedHits.filter(h=>h.source==='activeEdict').map(h=>h.id),charactersIncluded:r.injectedHits.filter(h=>h.source==='hard_state').length,suppressedReasons:[...new Set(r.suppressed.map(h=>h.reason))]};
  })});
}
{
  const c=context();c.GM.turn=20;const body='即日起免征新开荒土地田赋。'+('各地须逐户登记田亩并按季呈报查核结果。'.repeat(13))+'例外条款：旧田仍照原额纳税，优惠限三年，禁止追征免税期间税款。';
  c.GM.activeEdicts=[{id:'policy-conditions',name:'开荒免赋令',content:body,status:'active',startedTurn:1}];
  add('policy-exceptions-cut-before-budget',{sourceChars:body.length,tests:[140,180,240,420,800].map(perHit=>{const r=compile(c,12000,perHit);return{perHitChars:perHit,ok:r.ok,policyIncluded:r.injectedHits.some(h=>h.id==='policy-conditions'),exceptionIncluded:r.text.includes('旧田仍照原额纳税'),durationIncluded:r.text.includes('优惠限三年'),tokens:r.tokenEstimate};})});
}
{
  const c=context();c.GM.turn=20;const order={id:'issued-policy',content:'自今以后常设义仓，每年按地方实收粮税的百分之五留储。',turn:1,status:'executing'};c.GM._edictTracker=[order];
  const active=compile(c).text.includes('常设义仓');order.status='completed';const completed=compile(c).text.includes('常设义仓');
  const harvested=c.TM.MemoryLongTerm.harvest(c.GM);c.GM.activeEdicts=[{...order,id:'standing-granary',status:'active'}];const separateStandingState=compile(c).text.includes('常设义仓');
  add('completed-order-without-standing-policy-state',{executingIncluded:active,completedTrackerIncluded:completed,longTermRecordsAfterHarvest:harvested.total||0,standingPolicyIncluded:separateStandingState,note:'Conditional entry-state reproduction; does not claim every production policy is registered only in the tracker.'});
}
{
  const source=fs.readFileSync(path.join(root,'web/tm-ai-infra-model-detect.js'),'utf8'),c=vm.createContext({getModelContextSizeK:()=>32,Math});
  vm.runInContext(functionSource(source,'getCompressionParams'),c);
  add('actual-history-and-compression-windows',{models:[8,16,32,64,128,256].map(k=>{const p=c.getCompressionParams(k);return{contextK:k,fullReadTurns:p.fullReadTurns,briefReadTurns:p.briefReadTurns,memInjectCount:p.memInjectCount,compressAt:p.memCompressThreshold,keepRecent:p.memKeepRecent};})});
}
{
  const c=context();const txt='从本年起持续实行军屯轮休。'+'地方办理细则。'.repeat(40)+'不可遗漏条件：每三年轮休一次，并保留驻防最低兵额。';
  const work={turn:20,tasks:[{layer:'aiMemory',old:[{turn:1,content:txt}],targetLen:'400-600'}]};
  const request=c.TM.MemorySteward.buildConsolidationRequest(work,{turn:20});
  add('steward-input-evidence-cut',{sourceChars:txt.length,sourceContainsCondition:txt.includes('每三年轮休一次'),compressorReceivesCondition:request.user.includes('每三年轮休一次'),note:'Actual production request builder, no synthetic model response needed.'});
}
{
  const c=context();c.GM.turn=20;c.GM._aiMemory=[{turn:1,type:'turn',priority:'high',content:'永久政策：常设义仓，每年留储地方实收粮税的百分之五，不得挪用军费。'}];
  const old=c.GM._aiMemory.slice(),work={turn:20,tasks:[{layer:'aiMemory',old,targetLen:'400-600'}]};
  const applied=c.TM.MemorySteward.applyConsolidation(c.GM,work,{aiMemory_summary:'朝廷渐趋安定，官民各安其业。'});
  add('well-formed-summary-with-missing-policy-is-accepted',{applied:applied.applied,summaryKeepsPolicy:(c.GM._aiMemory||[]).some(m=>(m.content||'').includes('百分之五')),originalInLongTerm:((c.GM._memoryLongTerm||{}).records||[]).some(m=>(m.safeBody||'').includes('百分之五')),note:'Synthetic omission response tests coverage validation, not actual model behavior.'});
}
{
  const c=context();c.GM.turn=20;vm.runInContext(fs.readFileSync(path.join(root,'web/tm-memory-tables.js'),'utf8'),c);
  c.MemTables.ensureInit();const write=c.MemTables.editorWrite('imperialEdict','insert',{values:{0:'9',1:'常设义仓，每年按地方实收粮税的百分之五留储。',2:'永久生效',3:'1',4:''}});
  const rows=c.MemTables.getSheet('imperialEdict').rows,envs=c.TM.MemoryEnvelope.collect(c.GM).filter(e=>e.reason==='projection:imperial_edict_table');
  add('actual-imperial-table-row-shape-mismatch',{writeOk:write.ok,rowIsArray:Array.isArray(rows[0]),rowCount:rows.length,projectedBodies:envs.map(e=>e.body),compiledIncludesPolicy:compile(c,12000,420).text.includes('常设义仓'),legacyTableInjectionIncludesPolicy:c.MemTables.buildTablesInjection().includes('常设义仓'),note:'This proves the two input routes differ, not that every final request lacks the legacy table route.'});
}
result.sources=['tm-memory-tables.js','tm-memory-adaptive.js','tm-memory-context-compiler.js','tm-memory-envelope.js','tm-memory-long-term.js','tm-memory-steward.js','tm-ai-infra-model-detect.js','tm-endturn-ai.js','tm-endturn-followup.js','tm-memory-mode-bridge.js'].map(file=>({file:'web/'+file,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'web',file))).digest('hex')}));
fs.writeFileSync(path.join(__dirname,'probe-results.json'),JSON.stringify(result,null,2));
for(const row of result.cases){const copy={...row};delete copy.turns;console.log(JSON.stringify(copy));}
