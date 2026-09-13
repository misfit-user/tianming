'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
const ctx={console,URL,AbortController,setTimeout,clearTimeout};ctx.window=ctx;vm.createContext(ctx);
for(const file of ['tm-ai-request-options.js','tm-api-models.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',file),'utf8'),ctx,{filename:file});
const A=ctx.TM.AIOptions,M=ctx.TM.APIModels,plain=x=>JSON.parse(JSON.stringify(x));
let passed=0;const test=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
const body={model:'deepseek-chat',messages:[{role:'assistant',content:'',reasoning_content:'opaque',tool_calls:[{id:'abc'}]}],max_tokens:8000,tools:[{type:'function',function:{name:'update'}}],temperature:.8,response_format:{type:'json_object'}};
const cfg={model:body.model,url:'https://relay.example/custom/v1',key:'fixture-only'};
const response=data=>({ok:true,status:200,json:async()=>data});
(async()=>{
 await test('unset preferences preserve exact original object and default request bytes',()=>assert.equal(A.apply(body,cfg),body));
 await test('DeepSeek on/off at top level, same prompt/tools/reasoning/output and no mutation',()=>{
  const old=JSON.stringify(body);for(const on of [true,false]){const b=A.apply(body,{...cfg,thinking:on});assert.equal(b.thinking.type,on?'enabled':'disabled');assert.equal(b.max_tokens,8000);assert.equal(b.messages,body.messages);assert.equal(b.tools,body.tools);assert.equal(b.response_format,body.response_format);}assert.equal(JSON.stringify(body),old);
 });
 await test('Qwen switch uses enable_thinking; dedicated reasoner cannot pretend to turn off',()=>{
  assert.equal(A.apply({...body,model:'qwen3-235b-a22b'},{...cfg,thinking:false}).enable_thinking,false);
  assert.throws(()=>A.apply({...body,model:'qwen3-235b-thinking'},{...cfg,model:'qwen3-235b-thinking',thinking:false}),/不能关闭/);
 });
 await test('OpenRouter has a real enabled flag, not exclude-only reasoning hiding',()=>{
  const b=A.apply(body,{...cfg,url:'https://openrouter.ai/api/v1',thinking:false});assert.deepEqual(plain(b.reasoning),{enabled:false});
 });
 await test('OpenAI optional reasoning uses none/high and identical total completion allowance',()=>{
  const c={...cfg,model:'gpt-5.2',thinking:true},b=A.apply({...body,model:c.model},c);
  assert.equal(b.reasoning_effort,'high');assert.equal(b.max_completion_tokens,8000);assert(!('max_tokens' in b));assert(!('temperature' in b));assert.equal(A.apply({...body,model:c.model},{...c,thinking:false}).reasoning_effort,'none');
 });
 await test('known always-thinking and nonreasoning models give an explicit configuration error',()=>{
  for(const [model,on]of [['o3',false],['gpt-6-astra',false],['gpt-4o',true]])assert.throws(()=>A.apply({...body,model},{...cfg,model,thinking:on}),e=>e.code==='AI_THINKING_CONFIG'&&e.status===400);
 });
 await test('opaque relay model aliases require a protocol instead of silently ignoring the checkbox',()=>{
  const c={...cfg,model:'ep-secret-alias',thinking:false};assert.throws(()=>A.apply({...body,model:c.model},c),/协议/);
  assert.equal(A.apply({...body,model:c.model},{...c,thinkingProtocol:'deepseek'}).thinking.type,'disabled');
 });
 await test('Gemini native and compatible config use the respective real wire shape',()=>{
  const c={...cfg,model:'gemini-2.5-flash',thinking:false},b={contents:[{parts:[{text:'test'}]}],generationConfig:{maxOutputTokens:8000}};
  assert.equal(A.apply(b,c,'gemini').generationConfig.thinkingConfig.thinkingBudget,0);assert.equal(b.generationConfig.thinkingConfig,undefined);
  assert.equal(A.apply({...body,model:c.model},c).extra_body.google.thinking_config.thinking_budget,0);
  assert.throws(()=>A.apply(b,{...c,model:'gemini-3.1-pro'},'gemini'),/不支持完全关闭/);
 });
 await test('Claude adaptive and disabled use native protocol; forced tools are not silently relaxed',()=>{
  const c={...cfg,model:'claude-opus-4-6',thinking:true},b={...body,model:c.model,tool_choice:{type:'auto'}};
  assert.equal(A.apply(b,c,'anthropic').thinking.type,'adaptive');assert.equal(A.apply(b,{...c,thinking:false},'anthropic').thinking.type,'disabled');
  assert.throws(()=>A.apply({...b,tool_choice:{type:'tool',name:'update'}},c,'anthropic'),/强制工具/);
 });
 await test('model URL keeps custom prefixes and strips only the complete inference suffix',()=>{
  for(const suffix of ['/chat/completions','/responses','/models',''])assert.equal(M.endpoint({url:cfg.url+suffix}).url.href,cfg.url+'/models');
  assert.equal(M.endpoint({url:'https://api.anthropic.com/v1/messages'}).url.href,'https://api.anthropic.com/v1/models');
  assert.equal(M.endpoint({url:'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'}).url.href,'https://generativelanguage.googleapis.com/v1beta/models');
 });
 await test('format repair inherits the original thinking snapshot without changing its own output budget',()=>{
  const source=A.apply({...body,model:'gpt-5.2'},{...cfg,model:'gpt-5.2',thinking:true});
  const repair=A.inheritForRepair({model:'gpt-5.2',messages:[],temperature:0,max_tokens:6000},source);
  assert.equal(repair.max_completion_tokens,6000);assert.equal(repair.max_tokens,undefined);assert.equal(repair.reasoning_effort,'high');assert.equal(repair.temperature,undefined);
 });
 await test('credential-bearing/invalid model list URLs are rejected without fetch',()=>{
  for(const url of ['file:///secret','https://user:password@example.test/v1','https://x.test/v1?key=secret','/relative'])assert.throws(()=>M.endpoint({url}));
 });
 await test('model list uses entered key, no inference, no cookies, no redirect or cache leakage',async()=>{
  const calls=[],ids=['z',`\"><img src=x onerror=evil()>`,'z','a'];const r=await M.list(cfg,{fetch:async(url,opts)=>{calls.push({url,opts});return response({data:ids.map(id=>({id}))});}});
  assert.equal(calls.length,1);assert.equal(calls[0].url,cfg.url+'/models');assert.equal(calls[0].opts.headers.Authorization,'Bearer fixture-only');assert.equal(calls[0].opts.method,'GET');assert.equal(calls[0].opts.redirect,'error');assert.equal(calls[0].opts.cache,'no-store');assert.equal(calls[0].opts.credentials,'omit');assert.equal(r.models.length,3);assert(r.models.some(x=>x.id===ids[1]));
 });
 await test('empty list remains honestly empty; HTTP, HTML and malformed envelopes invent no models',async()=>{
  assert.equal((await M.list(cfg,{fetch:async()=>response({data:[]})})).models.length,0);
  for(const resp of [{ok:false,status:401},{ok:true,json:async()=>{throw Error('raw-key-must-not-leak');}},response({error:'bad'})])await assert.rejects(M.list(cfg,{fetch:async()=>resp}),e=>!e.message.includes('raw-key'));
 });
 await test('native Gemini pagination filters non-chat models and uses header auth',async()=>{
  const calls=[];const r=await M.list({...cfg,url:'https://generativelanguage.googleapis.com/v1beta'},{fetch:async(url,opts)=>{calls.push({url,opts});return response(calls.length===1?{models:[{name:'models/gemini-2.5-flash',supportedGenerationMethods:['generateContent']},{name:'models/embedding',supportedGenerationMethods:['embedContent']}],nextPageToken:'page2'}:{models:[{name:'models/gemini-3-flash'}]});}});
  assert.equal(r.models.length,2);assert.equal(calls[0].opts.headers['x-goog-api-key'],cfg.key);assert.equal(calls[0].opts.headers.Authorization,undefined);assert(new URL(calls[1].url).searchParams.has('pageToken'));
 });
 await test('native Claude pagination uses after_id and the native auth header',async()=>{
  const calls=[];const r=await M.list({...cfg,url:'https://api.anthropic.com/v1'},{fetch:async(url,opts)=>{calls.push({url,opts});return response({data:[{id:'claude-'+calls.length}],has_more:calls.length===1,last_id:'first'});}});
  assert.equal(r.models.length,2);assert.equal(calls[0].opts.headers['x-api-key'],cfg.key);assert.equal(calls[0].opts.headers.Authorization,undefined);assert(new URL(calls[1].url).searchParams.has('after_id'));
 });
 await test('cyclic pagination fails explicitly rather than looping or claiming a complete list',async()=>{
  await assert.rejects(M.list({...cfg,url:'https://api.anthropic.com/v1'},{fetch:async()=>response({data:[],has_more:true,last_id:'same'})}),/分页异常/);
 });
 await test('deadline covers response body even if the reader ignores AbortSignal',async()=>{
  await assert.rejects(M.list(cfg,{timeoutMs:20,fetch:async()=>({ok:true,json:()=>new Promise(()=>{})})}),/超时/);
 });
 await test('abort before sending and abort during response body both settle without model results',async()=>{
  const c=new AbortController();c.abort();let calls=0;await assert.rejects(M.list(cfg,{signal:c.signal,fetch:async()=>{calls++;return response({data:[]});}}));assert.equal(calls,0);
  const d=new AbortController();const p=M.list(cfg,{signal:d.signal,fetch:async()=>({ok:true,json:()=>new Promise(()=>{})})});d.abort();await assert.rejects(p,/取消/);
 });
 console.log(passed+' PASS, 0 FAIL');
})().catch(e=>{console.error(e);process.exitCode=1;});
