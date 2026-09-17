'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const cfg={key:'fixture-only',url:'https://relay.invalid/v1',model:'deepseek-chat',thinking:true,thinkingProtocol:'auto'};
const response=data=>new Response(JSON.stringify(data),{headers:{'Content-Type':'application/json'}});
const finish=()=>response({choices:[{message:{content:'完成',tool_calls:[{id:'finish1',type:'function',function:{name:'finish',arguments:'{"summary":"已完成"}'}}]},finish_reason:'tool_calls'}]});
function fixture(fetcher){
 const c={console,URL,Date,Math,JSON,Promise,Map,Set,WeakMap,AbortController,TextEncoder,TextDecoder,Uint8Array,Response,ReadableStream,Headers,setTimeout,clearTimeout,fetch:fetcher,localStorage:{getItem:k=>k==='tm_api'?JSON.stringify(cfg):null}};c.window=c;vm.createContext(c);
 for(const file of ['tm-ai-request-options.js','editor-authoring-agent-provider.js','editor-authoring-agent.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),c,{filename:file});
 return{c,run:opts=>c.TM.AuthoringAgent.callWithTools([{role:'user',text:'保留完整修改指令'}],[{name:'finish',parameters:{type:'object',properties:{summary:{type:'string'}}}}],{maxTok:4000,maxRetries:0,retryBaseMs:1,...opts})};
}
(async()=>{
 let n=0;const test=async(name,fn)=>{await fn();console.log('PASS '+name);n++;};
 await test('Guoshi default API loading carries the saved game thinking preference to the actual provider',async()=>{
  const sent=[],f=fixture(async(url,o)=>{sent.push(JSON.parse(o.body));return finish();});const r=await f.run();assert.equal(sent.length,1);assert.equal(sent[0].thinking.type,'enabled');assert.equal(sent[0].max_tokens,4000);assert.equal(r.toolCalls[0].name,'finish');
 });
 await test('whole-response format recovery keeps thinking and the same complete tool request',async()=>{
  const sent=[],f=fixture(async(url,o)=>{sent.push(JSON.parse(o.body));return sent.length===1?new Response('not JSON',{headers:{'Content-Type':'application/json'}}):finish();});const r=await f.run();assert.equal(sent.length,2);assert.deepEqual(sent[0],sent[1]);assert.equal(r.toolCalls[0].name,'finish');
 });
 await test('JSON compatibility branch retains thinking and never removes the user instruction',async()=>{
  const sent=[],f=fixture(async(url,o)=>{sent.push(JSON.parse(o.body));return response({choices:[{message:{content:'{"tool_calls":[{"name":"finish","input":{"summary":"完成"}}]}'},finish_reason:'stop'}]});});const r=await f.run({textToolFallback:true});assert.equal(sent[0].thinking.type,'enabled');assert(!sent[0].tools);assert.match(JSON.stringify(sent[0].messages),/保留完整修改指令/);assert.equal(r.toolCalls[0].name,'finish');
 });
 await test('unsupported explicit thinking returns a rejected promise before sending any tools',async()=>{
  let calls=0;const f=fixture(async()=>{calls++;return finish();});await assert.rejects(f.run({cfg:{...cfg,model:'gpt-4o',thinking:true}}),e=>e.code==='AI_THINKING_CONFIG');assert.equal(calls,0);
 });
 console.log(n+' PASS, 0 FAIL');
})().catch(e=>{console.error(e);process.exitCode=1;});
