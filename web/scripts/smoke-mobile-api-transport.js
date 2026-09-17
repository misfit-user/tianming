'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm');
const assert = require('node:assert/strict');
const web = path.resolve(__dirname, '..');
const tests = []; const test = (name, run) => tests.push({ name, run });
function fixture(options = {}) {
  const sent = [], browser = [], timers = new Set();
  const c = { console, URL, Headers, Response, Request, AbortController, AbortSignal,
    P: { ai: { key:'synthetic-test-only', model:'test-model' }, conf:{} },
    location: { href:'https://localhost/index.html' },
    setTimeout(fn, ms) { const t = setTimeout(() => { timers.delete(t); fn(); }, ms); timers.add(t); return t; },
    clearTimeout(t) { timers.delete(t); clearTimeout(t); },
    fetch: async (...a) => { browser.push(a); if (options.native !== false) throw new TypeError('Failed to fetch'); return new Response('browser'); }
  };
  c.Capacitor = { isNativePlatform: () => options.native !== false, Plugins: { CapacitorHttp: {
    request: async o => { sent.push(o); return options.reply ? options.reply(o) : { status:200, headers:{'CONTENT-TYPE':'application/json'}, data:{choices:[{message:{content:'OK'}}]} }; }
  } } };
  c.window = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(web, 'tm-ai-infra-retry.js'), 'utf8'), c);
  c.apiFetch = c._tmAIFetch || c.fetch;
  return { c, sent, browser, timers };
}
const url = 'https://provider.example/v1/chat/completions';
const init = { method:'POST', headers:{Authorization:'Bearer synthetic-test-only','Content-Type':'application/json'}, body:JSON.stringify({messages:[{role:'user',content:'测试原样保留'}],max_tokens:1234}) };
test('native POST bypasses WebView fetch and preserves full JSON request', async () => {
  const f=fixture(), r=await f.c.apiFetch(url,init); assert.equal((await r.json()).choices[0].message.content,'OK');
  assert.equal(f.browser.length,0); assert.equal(f.sent.length,1); assert.equal(f.sent[0].data,init.body);
  assert.equal(f.sent[0].headers.authorization,init.headers.Authorization); assert.equal(f.sent[0].disableRedirects,true);
});
test('GET models also uses native HTTP, without an inference request', async () => {
  const f=fixture({reply:async()=>({status:200,headers:{'content-type':'application/json'},data:{data:[{id:'m'}]}})});
  vm.runInContext(fs.readFileSync(path.join(web,'tm-api-models.js'),'utf8'),f.c);
  const result=await f.c.TM.APIModels.list({url:'https://provider.example/v1',key:'synthetic-test-only'});
  assert.equal(result.models[0].id,'m'); assert.equal(f.sent[0].method,'GET'); assert.equal(f.sent[0].data,undefined);
});
for (const [label,headers,data] of [['uppercase',{'CONTENT-TYPE':'application/json'},{ok:true}],['vendor JSON',{'Content-Type':'application/problem+json'},{ok:true}],['raw JSON',{'content-type':'application/json'},'{"ok":true}']]) {
  test('normalizes native response: '+label,async()=>{
    const f=fixture({reply:async()=>({status:200,headers,data})}); const r=await f.c.apiFetch(url,init);
    assert.equal((await r.json()).ok,true); assert.equal(f.timers.size,0);
  });
}
test('HTTP errors retain status and Retry-After without pretending success',async()=>{
  const f=fixture({reply:async()=>({status:429,headers:{'Retry-After':'4'},data:{error:{message:'rate limit'}}})});
  const r=await f.c.apiFetch(url,init);assert.equal(r.ok,false);assert.equal(r.status,429);assert.equal(r.headers.get('retry-after'),'4');
});
test('explicit timeout bounds a hanging native request and removes timer',async()=>{
  const f=fixture({reply:()=>new Promise(()=>{})}); const t=Date.now();
  await assert.rejects(f.c.apiFetch(url,{...init,timeoutMs:20}),e=>e.code==='AI_TIMEOUT');
  assert(Date.now()-t<1000);assert.equal(f.timers.size,0);assert.equal(f.sent[0].readTimeout,20);
});
test('abort returns promptly, late reply cannot become success',async()=>{
  let done;const f=fixture({reply:()=>new Promise(r=>{done=r;})}),ctrl=new AbortController();
  const p=f.c.apiFetch(url,{...init,signal:ctrl.signal});await new Promise(r=>setTimeout(r,5));ctrl.abort();
  await assert.rejects(p,e=>e.code==='AI_ABORTED');if(done)done({status:200,data:'late',headers:{}});
  assert.equal(f.timers.size,0);assert.equal(f.browser.length,0);
});
test('already-aborted requests never cross native bridge',async()=>{
  const f=fixture(),ctrl=new AbortController();ctrl.abort();await assert.rejects(f.c.apiFetch(url,{...init,signal:ctrl.signal}),e=>e.code==='AI_ABORTED');assert.equal(f.sent.length,0);
});
test('native exception does not leak credentials or fall back to another POST',async()=>{
  const f=fixture({reply:async()=>{throw Error('TLS certificate synthetic-test-only '+url);}});
  await assert.rejects(f.c.apiFetch(url,init),e=>!e.message.includes('synthetic-test-only')&&/证书/.test(e.message));assert.equal(f.browser.length,0);assert.equal(f.sent.length,1);
});
test('redirect and insecure endpoint fail closed',async()=>{
  const f=fixture({reply:async()=>({status:302,headers:{Location:'https://another.example'},data:''})});
  await assert.rejects(f.c.apiFetch(url,init),e=>e.code==='AI_MOBILE_REDIRECT');
  await assert.rejects(f.c.apiFetch('http://provider.example/v1',init),e=>e.code==='AI_MOBILE_INSECURE');assert.equal(f.sent.length,1);
});
test('native core bridge works without pre-registered Plugins proxy',async()=>{
  const f=fixture();delete f.c.Capacitor.Plugins;let invoked;
  f.c.Capacitor.nativePromise=async(...a)=>{invoked=a;return {status:200,headers:{},data:'OK'};};
  assert.equal(await (await f.c.apiFetch(url,init)).text(),'OK');assert.deepEqual(invoked.slice(0,2),['CapacitorHttp','request']);
});
test('browser and Electron keep original fetch semantics and streaming',async()=>{
  const f=fixture({native:false});delete f.c.Capacitor;const r=await f.c.apiFetch(url,init);
  assert.equal(await r.text(),'browser');assert.equal(f.browser[0][1],init);assert.equal(f.sent.length,0);
});
test('empty native responses are legal HTTP responses',async()=>{
  const f=fixture({reply:async()=>({status:204,headers:{},data:''})});assert.equal(await (await f.c.apiFetch(url,init)).text(),'');
});
async function main(){let failed=0;for(const t of tests){try{await t.run();console.log('PASS '+t.name);}catch(e){failed++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({suite:'mobile-api-transport',total:tests.length,passed:tests.length-failed,failed}));if(failed)process.exitCode=1;}
if(require.main===module)main().catch(e=>{console.error(e);process.exitCode=1;});
module.exports={fixture};
