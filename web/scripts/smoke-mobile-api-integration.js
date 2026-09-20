'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {fixture}=require('./smoke-mobile-api-transport');
const {functionSource}=require('./lib-perf-round1');
const web=path.resolve(__dirname,'..'),read=f=>fs.readFileSync(path.join(web,f),'utf8');
const [retry,infra,detect]=['tm-ai-infra-retry.js','tm-ai-infra.js','tm-ai-infra-model-detect.js'].map(read);
const tests=[];const test=(name,run)=>tests.push({name,run});
function loadMain(f){vm.runInContext(retry,f.c);vm.runInContext(functionSource(infra,'_aiFetchWithRetryInner'),f.c);}
function mainRequest(f,options={}){return f.c._aiFetchWithRetryInner('https://provider.example/v1/chat/completions',{model:'test-model',messages:[{role:'user',content:'完整的游戏上下文'}],max_tokens:800},undefined,{apiKey:'synthetic-test-only',maxRetries:2,timeoutMs:100,...options});}
test('real nonstream inference uses native HTTP and parses its object response',async()=>{
 const f=fixture();loadMain(f);const data=await mainRequest(f);
 assert.equal(data.choices[0].message.content,'OK');assert.equal(f.sent.length,1);assert.equal(f.browser.length,0);
 assert.equal(JSON.parse(f.sent[0].data).messages[0].content,'完整的游戏上下文');assert.equal(f.sent[0].readTimeout,0);assert(f.sent[0].connectTimeout>0);
});
test('real inference does not send duplicate native POST after timeout',async()=>{
 const f=fixture({reply:()=>new Promise(()=>{})});loadMain(f);
 await assert.rejects(mainRequest(f,{timeoutMs:15,totalResponseTimeoutMs:15,maxRetries:3}),e=>e.code==='AI_TIMEOUT'||e.code==='AI_REQUEST_DEADLINE');assert.equal(f.sent.length,1);assert.equal(f.timers.size,0);
});
test('real inference does not retry native certificate failures',async()=>{
 const f=fixture({reply:async()=>{throw Error('SSLHandshakeException');}});loadMain(f);
 await assert.rejects(mainRequest(f,{maxRetries:3}),e=>/证书/.test(e.message));assert.equal(f.sent.length,1);
});
test('real native connection check performs text/JSON checks without fake SSE probe',async()=>{
 const f=fixture({reply:async o=>{const b=JSON.parse(o.data);const strict=b.messages[0].content.includes('strict JSON');return {status:200,headers:{'CONTENT-TYPE':'application/json'},data:{model:'test-model',usage:{total_tokens:10},choices:[{message:{content:strict?'{"probe":"tm-quick-v1","sum":407,"tags":["shi","nong","gong","shang"],"ok":true}':'OK'}}]}};}});
 f.c._getAITier=()=>f.c.P.ai;f.c._buildAIUrlForTier=()=> 'https://provider.example/v1/chat/completions';
 vm.runInContext(['_tmProbeJsonParse','probeModelQuickCheck'].map(n=>functionSource(detect,n)).join('\n'),f.c);
 const r=await f.c.probeModelQuickCheck({tier:'primary'});assert.equal(r.json.ok,true);assert.equal(r.stream.buffered,true);
 assert.equal(f.sent.length,2);assert(f.sent.every(o=>JSON.parse(o.data).stream===false));assert.equal(r.echo,'match');
});
test('missing native plugin is an explicit diagnostic, not a WebView retry',async()=>{
 const f=fixture();delete f.c.Capacitor.Plugins;
 await assert.rejects(f.c.apiFetch('https://provider.example/v1',{method:'GET'}),e=>e.code==='AI_MOBILE_BRIDGE');assert.equal(f.browser.length,0);
});
test('native availability is checked at request time rather than cached on script load',async()=>{
 const f=fixture({native:false});f.c.Capacitor.isNativePlatform=()=>true;
 const r=await f.c.apiFetch('https://provider.example/v1',{method:'GET'});assert.equal(r.status,200);assert.equal(f.sent.length,1);
});
test('settings report describes buffered native transfer without red streaming failure',()=>{
 const f=fixture(),s=read('tm-patches.js');f.c._settingsEsc=s=>String(s);
 vm.runInContext(['_sConnVerdict','_sRenderConnReport'].map(n=>functionSource(s,n)).join('\n'),f.c);
 const html=f.c._sRenderConnReport({latencyMs:10,stream:{ok:false,buffered:true,detail:'原生整包'},json:{ok:true},usageSeen:true,warnings:[]},64,'fixture',8192,'fixture','primary');
 assert.match(html,/原生整包/);assert(!html.includes('✕'));assert.match(html,/堪任/);
});
test('runtime loads transport before API callers and package has native HTTP enabled',()=>{
 const html=read('index.html');assert(html.indexOf('tm-ai-infra-retry.js')<html.indexOf('tm-ai-infra-model-detect.js'));
 const cfg=JSON.parse(fs.readFileSync(path.resolve(web,'../mobile/capacitor.config.json'),'utf8'));assert.equal(cfg.plugins.CapacitorHttp.enabled,true);assert.equal(cfg.android.allowMixedContent,false);
});
async function main(){let failed=0;for(const t of tests){try{await t.run();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({suite:'mobile-api-integration',total:tests.length,passed:tests.length-failed,failed}));if(failed)process.exitCode=1;}
main().catch(e=>{console.error(e);process.exitCode=1;});
