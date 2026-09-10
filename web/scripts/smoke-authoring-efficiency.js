#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),arg=process.argv.indexOf('--source-ref'),ref=arg<0?null:process.argv[arg+1];
function fixture(){const c={console,JSON,Math,Date,Promise,Map,Set,WeakMap,AbortController,TextEncoder,TextDecoder,Response,setTimeout,clearTimeout,crypto:require('crypto').webcrypto};c.window=c;vm.createContext(c);for(const f of ['tm-agent-kernel.js','editor-authoring-agent-provider.js','editor-authoring-agent.js']){const p='web/'+f;vm.runInContext(ref?cp.execFileSync('git',['show',ref+':'+p],{cwd:root,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(root,p),'utf8'),c,{filename:p});}return{aa:c.TM.AuthoringAgent,c};}
const opts={noMemoryRecall:true,conventions:'',toolPacks:false,maxTokens:1000000},call=(name,input={})=>({id:name,name,input}),reply=(...toolCalls)=>Promise.resolve({toolCalls}),finish=call('finish',{summary:'已核对'});
let pass=0,fail=0;async function test(name,fn){try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+'\n'+e.stack);}}
(async()=>{
 await test('same read stops before ordinary budget; no-op writes and note/todo churn do not buy progress',async()=>{
  for(const action of [call('getField',{path:'name'}),call('applyEdit',{path:'name',value:'原'}),call('note',{text:'继续思考'}),call('todoWrite',{todos:[{content:'核对',status:'pending'}]})]){const{aa}=fixture();let n=0;const r=await aa.runAuthoringLoop({name:'原'},'核对',{...opts,caller:()=>{n++;return reply(action);}});assert(n<20);assert.equal(r.stopReason,'noProgress');assert.equal(r.finished,false);assert(r.resumeState);assert(r.progress.stalledRounds>0);}
 });
 await test('read-only exploration with new observations can finish; repeated failed writes stop honestly',async()=>{
  const{aa}=fixture();let n=0;const d={};for(let i=0;i<15;i++)d['f'+i]=i;
  const r=await aa.runAuthoringLoop(d,'逐项核对',{...opts,qaOnly:true,caller:()=>++n<=15?reply(call('getField',{path:'f'+(n-1)})):reply(call('submitAnswer',{answer:'各项已核对'}))});assert(r.finished);assert.equal(n,16);
  n=0;const b=await aa.runAuthoringLoop({labels:[]},'修改',{...opts,caller:()=>{n++;return reply(call('applyEdit',{path:'labels.missing.text',value:'x'}));}});assert(n<20);assert.equal(b.stopReason,'noProgress');assert.equal(b.completion.unresolved.length,1);
 });
 await test('changed write resets progress budget and recovery permits a corrected approach',async()=>{
  const{aa}=fixture(),d={name:'原'};const r=await aa.runAuthoringLoop(d,'修改',{...opts,caller:()=>reply(call('getField',{path:'name'}))});
  const next=await aa.runAuthoringLoop(d,'直接改成新名',{...opts,resumeState:r.resumeState,caller:()=>reply(call('applyEdit',{path:'name',value:'新'}),finish)});assert(next.finished);assert.equal(d.name,'新');
 });
 await test('long raw instructions survive two compressions including embedded headings and tail constraints',async()=>{
  const{aa,c}=fixture(),raw='详细说明'.repeat(500)+'\n【额外要求】\n不要删除原人物。TAIL_CONSTRAINT_987';
  c.fetch=async()=>new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'s',function:{name:'submitSummary',arguments:JSON.stringify({summary:'仅保留摘要，但不能取代完整指令。'.repeat(25)})}}]},finish_reason:'tool_calls'}]}));
  let conv=[{role:'user',text:'【用户需求】\n'+raw+'\n\n【草稿现状】\n原数据',userInstruction:raw},...Array.from({length:10},(_,i)=>({role:'assistant',text:'进度'+i,toolCalls:[]}))];
  const before=JSON.stringify(conv);for(let i=0;i<2;i++){const r=await aa.compactConversation(conv,{name:'原'},{cfg:{url:'https://controlled.invalid/v1',key:'test-only',model:'m'},keepTail:2});assert(r.ok);assert(r.conversation[0].text.includes(raw));conv=r.conversation.concat(Array.from({length:5},()=>({role:'assistant',text:'后续',toolCalls:[]})));}assert(before.includes(raw.replace(/\n/g,'\\n')));
 });
 await test('instruction retention overflow refuses compression without sending or dropping original instructions',async()=>{
  const{aa,c}=fixture();let calls=0;c.fetch=async()=>{calls++;throw Error('must not call');};
  const conv=[{role:'user',text:'x'.repeat(8000),userInstruction:'x'.repeat(8000)},...Array.from({length:7},()=>({role:'assistant',text:'进度',toolCalls:[]}))],before=JSON.stringify(conv);
  const r=await aa.compactConversation(conv,{name:'原'},{userKeep:6000,cfg:{url:'https://controlled.invalid',key:'test-only',model:'m'}});assert.equal(r.ok,false);assert.equal(r.reason,'instruction-retention-limit');assert.equal(calls,0);assert.equal(JSON.stringify(conv),before);
 });
 await test('staged tools reduce first request and explicitly expand without executing same-response unoffered calls',async()=>{
  const{aa}=fixture(),d={name:'原',labels:[]};let n=0,initial;
  const r=await aa.runAuthoringLoop(d,'修改名称',{noMemoryRecall:true,conventions:'',maxTokens:1000000,caller:(c,t)=>{n++;if(n===1){initial=t.map(x=>x.name);return reply(call('requestTools',{names:['multiEdit']}),call('multiEdit',{edits:[{path:'name',value:'越过本轮'}]}));}if(n===2){assert(t.some(x=>x.name==='multiEdit'));assert.equal(d.name,'原');return reply(call('multiEdit',{edits:[{path:'name',value:'新'}]}));}return reply(finish);}});
  assert(initial.length<24);assert(!initial.includes('multiEdit'));assert(r.transcript.some(t=>t.name==='multiEdit'&&t.result.errorCode==='tool-not-authorized'));assert(r.finished);assert.equal(d.name,'新');
  const ro=await aa.runAuthoringLoop(d,'只读',{...opts,planOnly:true,caller:()=>reply(call('requestTools',{names:['applyEdit']}),call('proposePlan',{steps:['请玩家批准']}))});assert.equal(d.name,'新');assert(ro.transcript[0].result.ok===false);
 });
 await test('real provider usage separates known counts, unknown usage, fallback attempts and retries',async()=>{
  const{aa,c}=fixture();let n=0;c.fetch=async()=>{n++;if(n===1)return new Response('retry',{status:500});return new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'f',function:{name:'finish',arguments:'{}'}}]},finish_reason:'tool_calls'}],usage:{prompt_tokens:123,completion_tokens:17,total_tokens:140}}));};
  const r=await aa.runAuthoringLoop({name:'原'},'核对',{...opts,cfg:{url:'https://controlled.invalid',key:'test-only',model:'m'},caller:(c,t,o)=>aa.callWithTools(c,t,{...o,maxRetries:1,retryBaseMs:1})});
  assert.equal(r.metrics.logicalRequests,1);assert.equal(r.metrics.httpRequests,2);assert.equal(r.metrics.retries,1);assert.equal(r.metrics.inputTokens,123);assert.equal(r.metrics.outputTokens,17);assert.equal(r.metrics.totalTokens,140);assert.equal(r.metrics.incompleteUsage,false);
  c.fetch=async()=>new Response(JSON.stringify({choices:[{message:{tool_calls:[{id:'f',function:{name:'finish',arguments:'{}'}}]},finish_reason:'tool_calls'}]}));const u=await aa.runAuthoringLoop({name:'原'},'核对',{...opts,cfg:{url:'https://controlled.invalid',key:'test-only',model:'m'}});assert.equal(u.metrics.usageResponses,0);assert.equal(u.metrics.incompleteUsage,true);assert(!JSON.stringify(r.metrics).includes('test-only'));
 });
 await test('Anthropic SSE merges start/delta usage; Gemini normalizes reported counts',async()=>{
  const{aa,c}=fixture(),tool=[{name:'finish',parameters:{type:'object',properties:{}}}];
  const event=d=>'data: '+JSON.stringify(d)+'\n\n';
  c.fetch=async()=>new Response(event({type:'message_start',message:{usage:{input_tokens:29}}})+event({type:'content_block_start',index:0,content_block:{type:'tool_use',id:'f',name:'finish',input:{}}})+event({type:'content_block_stop',index:0})+event({type:'message_delta',delta:{stop_reason:'tool_use'},usage:{output_tokens:7}})+event({type:'message_stop'}));
  const a=await aa.callWithTools('核对',tool,{cfg:{url:'https://api.anthropic.com',key:'test-only',model:'m'}});assert.equal(a.usage.inputTokens,29);assert.equal(a.usage.outputTokens,7);assert.equal(a.usage.totalTokens,null);
  c.fetch=async()=>new Response(JSON.stringify({candidates:[{content:{parts:[{functionCall:{name:'finish',args:{}}}]},finishReason:'STOP'}],usageMetadata:{promptTokenCount:11,candidatesTokenCount:5,totalTokenCount:16}}));const g=await aa.callWithTools('核对',tool,{cfg:{url:'https://generativelanguage.googleapis.com/v1beta',key:'test-only',model:'m'}});assert.equal(g.usage.totalTokens,16);
 });
 await test('leaf receipts avoid encoding unrelated siblings but external-modification protection remains',async()=>{
  const{aa}=fixture(),d={characters:[{name:'A',bio:'x'.repeat(50000),loyalty:50},{name:'B',bio:'y'.repeat(50000)}]};let n=0;
  const r=await aa.runAuthoringLoop(d,'只改忠诚',{...opts,blockingChecks:[],qualityGate:false,caller:()=>++n===1?reply(call('applyEdit',{path:'characters.A.loyalty',value:60})):reply(finish)});
  const rec=r.toolReceipts.find(x=>x.tool==='applyEdit');assert(Number(rec.beforeHash.split(':')[1])<500);assert(rec.changed);assert.equal(d.characters[1].bio.length,50000);
  n=0;const b=await aa.runAuthoringLoop(d,'改忠诚',{...opts,caller:()=>{if(++n===1){d.characters[1].bio='手工编辑';return reply(call('applyEdit',{path:'characters.A.loyalty',value:70}));}return reply(call('finish',{status:'blocked',summary:'并行编辑需确认'}));}});assert.equal(d.characters[0].loyalty,60);assert(b.transcript.some(t=>t.result.errorCode==='external-modified'));
 });
 await test('malformed multiEdit remains a structured failure, not a lost-recovery exception',async()=>{const{aa}=fixture(),d={name:'原'};const r=await aa.runAuthoringLoop(d,'改名',{...opts,caller:()=>reply(call('multiEdit',{edits:'bad'}),call('finish',{status:'blocked',summary:'参数错误'}))});assert.equal(r.finished,false);assert.equal(r.transcript[0].result.ok,false);assert.equal(d.name,'原');assert(r.resumeState);});
 await test('fresh reread after external change is not answered with a stale cached placeholder',async()=>{const{aa}=fixture(),d={name:'原'};let n=0;const r=await aa.runAuthoringLoop(d,'核对后修改',{...opts,caller:()=>{n++;if(n===1)return reply(call('getField',{path:'name'}));if(n===2){d.name='手改';return reply(call('getField',{path:'name'}));}return reply(call('applyEdit',{path:'name',value:'核实后的新值'}),finish);}});assert(r.finished);assert.equal(r.transcript[1].result.value,'手改');assert.equal(d.name,'核实后的新值');});
 await test('office field contract exposes faction override paths, not just the ignored fallback tree',async()=>{const{aa}=fixture(),d={officeTree:[{name:'fallback'}],factions:[{id:'s',name:'宋',officeTree:[{name:'active'}]}]};const r=aa.dispatchTool(d,'fieldContract',{field:'officeTree'},[{field:'officeTree',title:'官制'}]);assert(r.runtimeSources);assert(r.runtimeSources.some(x=>x.path==='factions[0].officeTree'&&x.faction==='宋'));assert(r.runtimeSources.some(x=>x.path==='officeTree'));});
 console.log(JSON.stringify({pass,fail,skip:0,waived:0,sourceRef:ref||'worktree'}));process.exitCode=fail?1:0;
})();
