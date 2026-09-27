'use strict';
const assert=require('assert/strict');
const {fixture,load,response,isEmergency,agentReply,run}=require('./lib-emergency-recovery');
const {baseGM}=require('./lib-player-error-regression');
const tests=[];const test=(name,fn)=>tests.push({name,fn});
function writer(retries=1){const f=fixture(),c=f.c;c.GM=baseGM({_campaignId:'c',_timelineId:'t',chars:[{id:'a',name:'甲',alive:true,loyalty:40},{id:'b',name:'乙',alive:true,loyalty:40}]});c.P.conf.aiCallRetryOverrides={sc1:retries};['tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js','tm-ai-result-contract.js','tm-endturn-apply-stages.js'].forEach(file=>load(c,file));return f;}
for(const retries of [0,2])test('identity repair starts after '+retries+' ordinary repairs, then real writer applies once',async()=>{
 const f=writer(retries),c=f.c,sequence=[];try{
  const candidate={repairs:[{field:'char_updates',index:0,item:{characterId:'a',name:'甲',updates:{loyalty:60}}}],semanticUnchanged:true,narrativePatch:''};
  c.callAI=async prompt=>{if(prompt.startsWith('【AI 主写回定向修复】')){sequence.push('normal');return '{"repairs":[],"semanticUnchanged":true,"narrativePatch":""}';}sequence.push('agent');return agentReply(prompt,candidate);};
  const payload={char_updates:[{characterId:'broken',name:'甲',updates:{loyalty:60}}]},before=JSON.stringify(c.GM);
  const result=await c.TM.Endturn.AI.apply._validateAndRepairMainWriteback(payload,{id:'sc1'});assert(result.ok);assert.equal(sequence.indexOf('agent'),retries);assert.equal(JSON.stringify(c.GM),before);assert.equal(payload.char_updates[0].characterId,'broken');
  const applied=c.applyAITurnChanges(result.output);assert(applied.ok,JSON.stringify(applied));assert.equal(c.GM.chars[0].loyalty,60);assert.equal(c.GM.chars[1].loyalty,40);
 }finally{f.dispose();}
});
test('autonomous repair still cannot change the original person or amount',async()=>{
 const f=writer(0),c=f.c;try{const before=JSON.stringify(c.GM);c.callAI=async prompt=>agentReply(prompt,{repairs:[{field:'char_updates',index:0,item:{characterId:'b',name:'乙',updates:{loyalty:99}}}],semanticUnchanged:true,narrativePatch:''});
 await assert.rejects(c.TM.Endturn.AI.apply._validateAndRepairMainWriteback({char_updates:[{characterId:'bad',name:'甲',updates:{loyalty:60}}]},{id:'sc1'}));assert.equal(JSON.stringify(c.GM),before);
 }finally{f.dispose();}
});
test('Agent malformed arguments exhaust ordinary requests before verified repair, never execute partial tools',async()=>{
 const f=fixture(),c=f.c,order=[];try{c.P.conf.aiCallRetryOverrides={agent_turn:2};const raw='{"path", "guoku"}',at=raw.indexOf(','),plan={repairs:[{index:1,edits:[{start:at,end:at+1,expected:',',replacement:':'}]}]};
 c.fetch=async(_u,o)=>{const body=JSON.parse(o.body);if(isEmergency(body)){order.push('agent');return response(agentReply(body.messages[0].content,plan));}order.push('normal');return {ok:true,status:200,headers:{get:()=> 'application/json'},json:async()=>({choices:[{finish_reason:'stop',message:{content:'',tool_calls:[{function:{name:'read_world',arguments:'{"path":"population"}'}},{function:{name:'read_world',arguments:raw}}]}}]})};};
 const definitions=[{name:'read_world',description:'只读',parameters:{type:'object',properties:{path:{type:'string'}},required:['path'],additionalProperties:false}}];
 const before=JSON.stringify(c.GM),r=await c.callAIWithTools('读取必要状态',definitions,{id:'agent_turn:r1',maxTok:100,maxRetries:0});assert(!r.error,JSON.stringify(r));assert.equal(order.indexOf('agent'),3);assert.equal(r.toolCalls.length,2);assert.equal(r.toolCalls[0].input.path,'population');assert.equal(r.toolCalls[1].input.path,'guoku');assert.equal(JSON.stringify(c.GM),before);assert.equal(r.emergencyReceipt.applied,false);
 }finally{f.dispose();}
});
test('SC1 emergency entry waits for normal parse and existing rescue boundary',async()=>{
 const f=fixture(),c=f.c,sequence=[];try{c.P.conf.aiCallRetryOverrides={sc1:1};const raw='{"turn_summary", "所有事实保留","events":[]}',at=raw.indexOf(','),plan={edits:[{start:at,end:at+1,expected:',',replacement:':'}]};
 c.fetch=async(_u,o)=>{const b=JSON.parse(o.body);if(isEmergency(b)){sequence.push('agent');return response(agentReply(b.messages[0].content,plan));}sequence.push('normal');return response(raw);};
 const body={model:'fixture',messages:[{role:'user',content:'完整主推演请求'}]},data=await c._aiFetchWithRetry('https://fixture.invalid/v1',body,null,{id:'sc1',maxRetries:0});
 const r=await c.TM.RecoveryRuntime.parse(raw,data,'主推演',{id:'sc1',url:'https://fixture.invalid/v1',body,key:'fixture-only',repair:false},async text=>({raw:text,parsed:null,failed:true}));assert(r.failed);assert.equal(sequence.filter(v=>v==='agent').length,0);
 const recovered=await c.TM.RecoveryRuntime.finalSC1({raw,data,body,validate:p=>Array.isArray(p.events)&&p.turn_summary==='所有事实保留'});assert(recovered.ok);assert.equal(sequence.indexOf('agent'),2);
 }finally{f.dispose();}
});
function moneyFixture(){const f=fixture(),c=f.c;c.GM={turn:4,_campaignId:'c',_timelineId:'t',_endTurnCommitPending:true,currency:{coins:{silver:{stock:100,enabled:true}},foreignFlow:{cumulativeNet:0},paper:{issuances:[],activeIssuances:[]},events:[]}};['tm-number-parser.js','tm-economy-engine-currency.js','tm-edict-parser.js'].forEach(file=>load(c,file));return f;}
test('an unrecognized but provable edict amount is recovered and applied by the real currency owner exactly once',async()=>{
 const f=moneyFixture(),c=f.c;try{const text='此次宝钞增发额度，定为十万贯。',start=text.indexOf('十万'),plan={role:'issue_paper',amount:{start,end:start+2,literal:'十万'}};
 const failed=c.EdictParser.tryExecute(text,{},{});assert(failed.amountError,JSON.stringify(failed));assert.equal(c.GM.currency.paper.issuances.length,0);assert(c.TM.RecoveryEdict.register(text,failed));
 c.callAI=async prompt=>agentReply(prompt,plan);const receipts=await c.TM.RecoveryEdict.flush({});assert.equal(receipts.length,1);assert(receipts[0].applied);assert.equal(receipts[0].persisted,false);assert.equal(c.GM.currency.paper.issuances[0].originalAmount,100000);
 c.TM.RecoveryEdict.register(text,failed);await c.TM.RecoveryEdict.flush({});assert.equal(c.GM.currency.paper.issuances.length,1);
 }finally{f.dispose();}
});
for(const text of ['增发宝钞十万或二十万贯。','不增发宝钞十万贯。','增发宝钞，准备金十万两。','增发宝钞十万贯，或者二十万贯。','若有银荒，则增发宝钞十万贯。'])test('uncertain or non-executable edict never gets a fabricated amount: '+text,()=>{
 const f=moneyFixture();try{const at=text.indexOf('十万');assert.throws(()=>f.c.TM.RecoveryEdict.certified(text,{role:'issue_paper',amount:{start:at,end:at+2,literal:'十万'}}));assert.equal(f.c.GM.currency.paper.issuances.length,0);}finally{f.dispose();}
});
test('a reserve cannot replace the actual inflow and the source quote must match exactly',()=>{
 const f=moneyFixture();try{const text='海外白银流入额度，定为二十万两，另备银三万两作为准备金。',start=text.indexOf('二十万'),c=f.c;
 assert.equal(c.TM.RecoveryEdict.certified(text,{role:'overseas_silver_flow',amount:{start,end:start+3,literal:'二十万'}}).amount,200000);
 const other=text.indexOf('三万');assert.throws(()=>c.TM.RecoveryEdict.certified(text,{role:'overseas_silver_flow',amount:{start:other,end:other+2,literal:'三万'}}));
 assert.throws(()=>c.TM.RecoveryEdict.certified(text,{role:'overseas_silver_flow',amount:{start,end:start+3,literal:'三十万'}}));
 }finally{f.dispose();}
});
test('same-entity business changes invalidate a delayed recovery proposal',async()=>{
 const f=writer(0),c=f.c;try{c.callAI=async prompt=>{c.GM.chars[0].loyalty=75;return agentReply(prompt,{repairs:[{field:'char_updates',index:0,item:{characterId:'a',name:'甲',updates:{loyalty:60}}}],semanticUnchanged:true,narrativePatch:''});};
 await assert.rejects(c.TM.Endturn.AI.apply._validateAndRepairMainWriteback({char_updates:[{characterId:'broken',name:'甲',updates:{loyalty:60}}]},{id:'sc1'}),e=>e.code==='AI_STALE_WORLD');assert.equal(c.GM.chars[0].loyalty,75);
 }finally{f.dispose();}
});
test('ordinary identity repair receives the real parent cancellation signal',async()=>{
 const f=writer(1),c=f.c,controller=new AbortController();try{c.callAI=async(prompt,n,signal)=>{assert.equal(signal,controller.signal);controller.abort();throw Object.assign(Error('cancelled'),{code:'AI_ABORTED'});};
 await assert.rejects(c.TM.Endturn.AI.apply._validateAndRepairMainWriteback({char_updates:[{characterId:'broken',name:'甲',updates:{loyalty:60}}]},{id:'sc1',signal:controller.signal}),e=>e.code==='AI_ABORTED');assert.equal(c.GM.chars[0].loyalty,40);
 }finally{f.dispose();}
});
for(const unit of ['张','文','缗'])test('unknown paper-unit conversion is not silently inferred: '+unit,()=>{
 const f=moneyFixture();try{const text='此次宝钞增发额度，定为十万'+unit+'。',start=text.indexOf('十万'),before=JSON.stringify(f.c.GM);
 assert.throws(()=>f.c.TM.RecoveryEdict.certified(text,{role:'issue_paper',amount:{start,end:start+2,literal:'十万'}}),e=>e.code==='RECOVERY_UNIT_UNCONFIRMED');assert.equal(JSON.stringify(f.c.GM),before);
 }finally{f.dispose();}
});
run(tests);
