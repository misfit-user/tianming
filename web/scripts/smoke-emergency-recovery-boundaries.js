'use strict';
const assert=require('assert/strict');
const {fixture,response,isEmergency,agentReply,rawParse,run}=require('./lib-emergency-recovery');
const tests=[],test=(name,fn)=>tests.push({name,fn});
const raw='{"turn_summary", "完整原意","events":[]}',at=raw.indexOf(','),plan={edits:[{start:at,end:at+1,expected:',',replacement:':'}]};
const body={model:'fixture',messages:[{role:'user',content:'完整输入，不得删减'}]},url='https://fixture.invalid/v1/chat/completions';
test('complete SC1 JSON retains legacy table edits without spending retries or falling into rescue',async()=>{
 const f=fixture(),c=f.c;try{
 const ledger={turn_summary:'发帑赈济',fiscal_adjustments:[{target:'neitang',kind:'expense',resource:'money',amount:100000,recurring:false}]};
 const sidecar='<tableEdit>\n<!-- updateRow(0, 0, {"3":"2","4":"保留括号 (原文) 与 }"}) -->\n<!-- insertRow(9, {"1":"发帑十万"}) -->\ndeleteRow(1, 2);\n</tableEdit>';
 const original=JSON.stringify(ledger)+'\n'+sidecar;let sent=0;c.fetch=async()=>{sent++;return response(original);};
 const data=await c._aiFetchWithRetry(url,body,null,{id:'sc1',maxRetries:2});
 const out=await c.TM.RecoveryRuntime.parse(original,data,'主账本',{id:'sc1',body,url,key:'fixture',expectedKeys:['fiscal_adjustments'],repair:false},async text=>({parsed:JSON.parse(text.slice(0,text.indexOf('<tableEdit>'))),raw:text,repaired:false,truncated:false}));
 assert.equal(sent,1);assert.equal(out.raw,original);assert.equal(out.parsed.fiscal_adjustments[0].amount,100000);assert.equal(out.repaired,false);assert.equal(c.TM.RecoveryAdapters.sourcePreserved(original,{...out,truncated:true}),false);
 const fenced='```json\n'+JSON.stringify(ledger)+'\n```\n'+sidecar;
 assert.equal(c.TM.RecoveryAdapters.sourcePreserved(fenced,{parsed:ledger,raw:fenced,repaired:false}),true);
 }finally{f.dispose();}
});
test('legacy sidecar compatibility still rejects lost values, ambiguous JSON and malformed table operations',()=>{
 const f=fixture();try{
 const A=f.c.TM.RecoveryAdapters,head='{"events":[],"turn_summary":"保留原意"}';
 const invalid=[head+' {"events":[1]}',head+'<tableEdit>insertRow(1, {"a":"b"})',head+'<tableEdit>unknownAction(1, {})</tableEdit>',head+'<tableEdit>insertRow(1, {"a":"b"})</tableEdit> {"extra":1}',head+'<tableEdit>updateRow(1, "bad", {})</tableEdit>',head+'<tableEdit>insertRow(1, {"a":1,"a":2})</tableEdit>','{"events":[],"events":[1]}<tableEdit></tableEdit>'];
 invalid.forEach(text=>assert.equal(A.sourcePreserved(text,{parsed:{events:[]},raw:text,repaired:false}),false,text));
 const good=head+'<tableEdit>insertRow(1, {"a":"b"})</tableEdit>';
 assert.equal(A.sourcePreserved(good,{parsed:{events:[]},raw:head,repaired:false}),false);
 assert.equal(A.sourcePreserved(good,{parsed:{events:[]},raw:head,repaired:true}),false);
 }finally{f.dispose();}
});
for(const errorAt of [2,3])test('JSON and transient HTTP failures share the entire configured allowance: '+errorAt,async()=>{
 const f=fixture(),c=f.c,order=[];try{c.P.conf.aiCallRetryOverrides={sc25c:2};let sent=0;
 c.fetch=async(_u,o)=>{const b=JSON.parse(o.body);if(isEmergency(b)){order.push('agent');return response(agentReply(b.messages[0].content,plan));}order.push('normal');if(++sent===errorAt)return {ok:false,status:502,headers:{get:()=>null},text:async()=> 'temporary upstream failure'};return response(raw);};
 const data=await c._aiFetchWithRetry(url,body,null,{id:'sc25c',maxRetries:0});
 const r=await c.TM.RecoveryRuntime.parse(raw,data,'记忆',{id:'sc25c',body,url,key:'fixture',expectedKeys:['events'],repair:false},async text=>rawParse(text));
 assert(r.parsed,JSON.stringify(r));assert.equal(sent,3);assert.equal(order.indexOf('agent'),3);assert.equal(r.parsed.turn_summary,'完整原意');
 }finally{f.dispose();}
});
for(const mutation of ['world','timeline','model'])test('stale successful response is rejected before recovery begins: '+mutation,async()=>{
 const f=fixture(),c=f.c;try{c.P.conf.aiCallRetryOverrides={sc25c:0};let requests=0;c.fetch=async()=>{requests++;return response(raw);};const data=await c._aiFetchWithRetry(url,body,null,{id:'sc25c'});
 if(mutation==='world')c.GM={...c.GM};if(mutation==='timeline')c.GM._timelineId='changed';if(mutation==='model')c.P.ai.model='changed';
 await assert.rejects(c.TM.RecoveryRuntime.parse(raw,data,'记忆',{id:'sc25c',body,url,key:'fixture',repair:false},async text=>rawParse(text)),e=>e.code==='AI_STALE_WORLD');assert.equal(requests,1);
 }finally{f.dispose();}
});
test('same recovery tier follows the actual secondary response, not the primary default',async()=>{
 const f=fixture(),c=f.c,tiers=[];try{c.P.ai.secondary={key:'fixture-second',url:'https://second.invalid/v1',model:'second'};c.P.conf.aiCallRetryOverrides={sc25c:0};c.fetch=async()=>response(raw);
 const data=await c._aiFetchWithRetry(url,body,null,{id:'sc25c',tier:'secondary'});
 c.callAI=async(prompt,n,signal,tier)=>{tiers.push(tier);return agentReply(prompt,plan);};
 const result=await c.TM.RecoveryRuntime.parse(raw,data,'记忆',{id:'sc25c',body,url,key:'fixture',repair:false},async text=>rawParse(text));assert(result.parsed);assert(tiers.length>0);assert(tiers.every(t=>t==='secondary'));
 }finally{f.dispose();}
});
test('completion cannot certify a candidate using schema keywords it does not enforce',()=>{
 const f=fixture();try{const valid=f.c.TM.RecoveryAdapters.schemaOK;
 assert.equal(valid(3,{type:'integer',multipleOf:2}),false);
 assert.equal(valid([1,1],{type:'array',uniqueItems:true}),false);
 assert.equal(valid('🙂',{type:'string',minLength:2}),false);
 assert.equal(valid({x:1},{type:'object',dependentRequired:{x:['y']}}),false);
 assert.equal(valid(12,{$ref:'#/$defs/n',maximum:10,$defs:{n:{type:'integer'}}}),false);
 assert.equal(valid([1,2],{type:'array',items:[{type:'integer'}],additionalItems:false}),false);
 assert.equal(valid({x:4},{type:'object',patternProperties:{'^x$':{type:'string'}},additionalProperties:false}),false);
 }finally{f.dispose();}
});
test('JSON syntax repair cannot accept arbitrary extra patch operations',()=>{
 const f=fixture();try{const A=f.c.TM.RecoveryAdapters;assert.throws(()=>A.strict('{"events":[],"events":[1]}'));assert.throws(()=>A.edited(raw,[{start:at,end:at+1,expected:',',replacement:':','code':'eval()'},{start:0,end:raw.length,expected:raw,replacement:''}]));}finally{f.dispose();}
});
test('ordinary format repair cannot remove a middle fact before the emergency boundary',async()=>{
 const f=fixture(),c=f.c;try{c.P.conf.aiCallRetryOverrides={sc25c:0};const original='{"turn_summary", "不可改写","important_action":"中段的唯一指令","events":[]}',at=original.indexOf(',');
 const edit={edits:[{start:at,end:at+1,expected:',',replacement:':'}]};c.fetch=async()=>response(original);const data=await c._aiFetchWithRetry(url,body,null,{id:'sc25c'});
 c.callAI=async prompt=>agentReply(prompt,edit);
 const out=await c.TM.RecoveryRuntime.parse(original,data,'记忆',{id:'sc25c',url,body,repair:false},async()=>({parsed:{events:[]},raw:'{"events":[]}',repaired:true,truncated:false}));
 assert(out.emergencyReceipt&&out.emergencyReceipt.verified);assert.equal(out.parsed.important_action,'中段的唯一指令');assert.equal(out.parsed.turn_summary,'不可改写');
 }finally{f.dispose();}
});
test('a normal parser cannot silently select one of two top-level objects',async()=>{
 const f=fixture(),c=f.c;try{c.P.conf.aiCallRetryOverrides={sc25c:0};const text='{"events":[]} {"amount":900}';c.fetch=async()=>response(text);const data=await c._aiFetchWithRetry(url,body,null,{id:'sc25c'});
 c.callAI=async()=>JSON.stringify({tools:[{name:'finish',input:{needsPlayer:true,reason:'两个结果存在冲突'}}]});
 const out=await c.TM.RecoveryRuntime.parse(text,data,'记忆',{id:'sc25c',url,body,repair:false},async()=>({parsed:{events:[]},raw:text,truncated:false}));assert(out.failed);assert.equal(out.parsed,null);assert.equal(out.raw,text);assert(!out.emergencyReceipt);assert.equal(out.emergencyFailure,'RECOVERY_NEEDS_PLAYER');
 }finally{f.dispose();}
});
test('a world change during ordinary asynchronous parsing rejects even a valid result',async()=>{
 const f=fixture(),c=f.c;try{c.fetch=async()=>response('{"events":[]}');const data=await c._aiFetchWithRetry(url,body,null,{id:'sc25c'});
 await assert.rejects(c.TM.RecoveryRuntime.parse('{"events":[]}',data,'记忆',{id:'sc25c',body,url},async text=>{await Promise.resolve();c.GM={...c.GM};return rawParse(text);}),e=>e.code==='AI_STALE_WORLD');
 }finally{f.dispose();}
});
test('a rejected ordinary SC1 repair never leaks its parsed object into main writeback',async()=>{
 const f=fixture(),c=f.c;try{c.P.conf.aiCallRetryOverrides={sc1:0};c.fetch=async()=>response(raw);const data=await c._aiFetchWithRetry(url,body,null,{id:'sc1'});
 const result=await c.TM.RecoveryRuntime.parse(raw,data,'主推演',{id:'sc1',body,url},async()=>({parsed:{events:[]},raw:'{"events":[]}',repaired:true,truncated:false}));
 assert.equal(result.parsed,null);assert(result.failed);assert.equal(result.raw,raw);assert.equal(f.events.length,0);
 }finally{f.dispose();}
});
run(tests);
