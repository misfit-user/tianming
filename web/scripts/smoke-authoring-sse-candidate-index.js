#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),at=process.argv.indexOf('--source-ref'),ref=at<0?null:process.argv[at+1];
const files=['web/editor-authoring-agent-provider.js','web/editor-authoring-agent.js'];
const sources=files.map(f=>[f,ref?cp.execFileSync('git',['show',ref+':'+f],{cwd:root,encoding:'utf8',maxBuffer:8e6}):fs.readFileSync(path.join(root,f),'utf8')]);
const secret='PRIVATE_SYNTHETIC_WIRE_DO_NOT_LOG',cfg={url:'https://wire.invalid/v1',key:'synthetic-only',model:'controlled'};
const frame=x=>'data: '+JSON.stringify(x)+'\n\n',tool=(name,input,index=0)=>({index,id:'call-'+index,type:'function',function:{name,arguments:JSON.stringify(input)}});
const finish=tool('finish',{summary:'完成'}),end='data: [DONE]\n\n';
function fixture(raw){const logs=[],c={console,Date,Math,JSON,Promise,Map,Set,WeakMap,AbortController,TextDecoder,TextEncoder,Uint8Array,Response,ReadableStream,Headers,setTimeout,clearTimeout,
  tianming:{debugLog:async e=>logs.push(e)},fetch:async(_,init)=>new Response(typeof raw==='function'?await raw(JSON.parse(init.body)):raw)};c.window=c;vm.createContext(c);for(const[f,s]of sources)vm.runInContext(s,c,{filename:f});return{aa:c.TM.AuthoringAgent,logs};}
let pass=0,fail=0;async function test(n,f){try{await f();pass++;console.log('PASS '+n);}catch(e){fail++;console.error('FAIL '+n+'\n'+e.stack);}}
(async()=>{
  for(const i of [0,'0'])await test('native SSE candidate '+typeof i+' zero executes the complete real edit and finish',async()=>{
    const raw=frame({choices:[{index:i,delta:{reasoning_content:secret,tool_calls:[tool('applyEdit',{path:'name',value:'刘备阶段'}),{...finish,index:1,id:'done'}]},finish_reason:'tool_calls'}]})+end;
    const f=fixture(raw),live={name:'原'},d=f.aa.makeDraft(live),r=await f.aa.runAuthoringLoop(d,'改名',{cfg,noMemoryRecall:true,conventions:'',maxNoToolNudges:0});
    assert(r.finished);assert.equal(d.name,'刘备阶段');assert.equal(live.name,'原');assert(!JSON.stringify(r.apiDiagnostics).includes(secret));
  });
  await test('mixed numeric/string zero fragments preserve Unicode, reasoning and separate tool indices',async()=>{
    const arg=JSON.stringify({summary:'汉·刘备😀e\u0301'}),raw=frame({choices:[{index:'0',delta:{reasoning_content:secret,tool_calls:[{...finish,function:{name:'finish',arguments:arg.slice(0,10)}}]}}]})
      +frame({choices:[{index:0,delta:{tool_calls:[{index:0,function:{arguments:arg.slice(10)}}]},finish_reason:'tool_calls'}]})+end;
    const r=await fixture(raw).aa.callWithTools('核验',[{name:'finish'}],{cfg,maxRetries:0});assert.equal(r.toolCalls[0].input.summary,'汉·刘备😀e\u0301');assert.equal(r.reasoningContent,secret);
  });
  await test('other valid candidates are not merged or executed',async()=>{
    const raw=frame({choices:[{index:1,delta:{tool_calls:[tool('applyEdit',{path:'name',value:'不得执行'})]},finish_reason:'tool_calls'},{index:'0',delta:{tool_calls:[finish]},finish_reason:'tool_calls'}]})+end;
    const f=fixture(raw),d=f.aa.makeDraft({name:'原'}),r=await f.aa.runAuthoringLoop(d,'核验',{cfg,noMemoryRecall:true,conventions:''});assert(r.finished);assert.equal(d.name,'原');assert.equal(r.transcript.filter(t=>t.name==='applyEdit').length,0);
  });
  await test('usage-only or non-primary-only streams fail closed instead of synthesizing an empty assistant',async()=>{
    for(const raw of [frame({choices:[],usage:{total_tokens:1}})+end,frame({choices:[{index:1,delta:{tool_calls:[finish]},finish_reason:'tool_calls'}]})+end]){
      await assert.rejects(fixture(raw).aa.callWithTools('核验',[{name:'finish'}],{cfg,maxRetries:0}),e=>e.code==='authoring-response-missing-candidate');
    }
  });
  await test('invalid index types and coercible strings never authorize tools',async()=>{
    for(const index of ['00',' 0','+0','0e0','0x0','-0',false,{},[],1.2,-1,1024]){
      const raw=frame({choices:[{index,delta:{tool_calls:[finish]},finish_reason:'tool_calls'}]})+end;
      await assert.rejects(fixture(raw).aa.callWithTools('核验',[{name:'finish'}],{cfg,maxRetries:0}),e=>e.code==='authoring-response-invalid-choice-index');
    }
  });
  await test('duplicate primary candidate in one event is ambiguous and cannot apply a prefix',async()=>{
    const raw=frame({choices:[{index:0,delta:{tool_calls:[tool('applyEdit',{path:'name',value:'不得执行'})]}},{index:'0',delta:{tool_calls:[finish]},finish_reason:'tool_calls'}]})+end;
    const f=fixture(raw),d=f.aa.makeDraft({name:'原'});await assert.rejects(f.aa.runAuthoringLoop(d,'核验',{cfg,noMemoryRecall:true,conventions:''}),e=>e.code==='authoring-response-duplicate-candidate');assert.equal(d.name,'原');
  });
  await test('missing indices in a single-candidate proxy and numeric indices retain previous behavior',async()=>{
    for(const index of [undefined,0]){const raw=frame({choices:[{index,delta:{tool_calls:[finish]},finish_reason:'tool_calls'}]})+end;const r=await fixture(raw).aa.callWithTools('核验',[{name:'finish'}],{cfg,maxRetries:0});assert.equal(r.toolCalls[0].name,'finish');}
  });
  await test('raw protocol-shaped data cannot forge diagnostic wire fields or leak private values',async()=>{
    const raw=JSON.stringify({_wireShapes:secret,wire:{content:secret},usage:{prompt_tokens:4,completion_tokens:secret,total_tokens:-1,secret},choices:[{index:0,message:{role:'assistant',content:''},finish_reason:null}]});
    const f=fixture(raw),r=await f.aa.callWithTools('核验',[{name:'finish'}],{cfg,maxRetries:0});assert(r.responseInfo.wire,'new wire diagnostics unavailable on old baseline');assert.equal(r.responseInfo.wire.format,'json');assert.equal(r.responseInfo.wire.message,1);assert(!JSON.stringify([r.responseInfo,f.logs]).includes(secret));
  });
  await test('observed usage-only relay negotiates explicit streaming once with identical tools/input/budget',async()=>{
    const packets=[]; // fetch is the only controlled boundary.
    const c={console,Date,Math,JSON,Promise,Map,Set,WeakMap,AbortController,TextDecoder,TextEncoder,Uint8Array,Response,setTimeout,clearTimeout,
      fetch:async(_,init)=>{const b=JSON.parse(init.body);packets.push(b);return new Response(!b.stream?frame({choices:[],usage:{total_tokens:3}})+end:frame({choices:[{index:0,delta:{tool_calls:[finish]},finish_reason:'tool_calls'}]})+end);}};
    c.window=c;vm.createContext(c);for(const[f,s]of sources)vm.runInContext(s,c,{filename:f});
    const r=await c.TM.AuthoringAgent.callWithTools('真实需求',[{name:'finish'}],{cfg,maxTok:6000,maxRetries:0});assert.equal(r.toolCalls[0].name,'finish');assert.equal(packets.length,2);
    const first={...packets[0],stream:true};assert.deepEqual(packets[1],first);assert.equal(packets[1].max_tokens,6000);
  });
  await test('proven explicit streaming survives a checkpoint and does not repeat empty negotiation on resume',async()=>{
    const packets=[];let written=false;const f=fixture(b=>{packets.push(b);if(!b.stream)return frame({choices:[]})+end;const next=written?finish:tool('applyPush',{path:'labels',value:{name:'once'}});written=true;return frame({choices:[{index:'0',delta:{tool_calls:[next]},finish_reason:'tool_calls'}]})+end;});
    const live={name:'原',labels:[]},d=f.aa.makeDraft(live),opts={cfg,noMemoryRecall:true,conventions:''};const first=await f.aa.runAuthoringLoop(d,'新增后核验',{...opts,maxIterations:1});assert(!first.finished);assert(first.resumeState);assert.equal(d.labels.length,1);
    const next=await f.aa.runAuthoringLoop(d,'继续核验',{...opts,resumeState:first.resumeState});assert(next.finished);assert.equal(packets.length,3);assert.deepEqual(packets.map(p=>p.stream),[undefined,true,true]);assert.equal(d.labels.length,1);assert.equal(live.labels.length,0);
  });
  await test('an already negotiated empty stream fails without resending the identical request',async()=>{
    let n=0;const f=fixture(()=>{n++;return frame({choices:[]})+end;});await assert.rejects(f.aa.callWithTools('核验',[{name:'finish'}],{cfg,explicitStream:true,maxRetries:0}),e=>e.code==='authoring-response-missing-candidate');assert.equal(n,1);
  });
  console.log(JSON.stringify({pass,fail,skip:0,waived:0,sourceRef:ref||'worktree'}));process.exitCode=fail?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
