'use strict';
const assert=require('assert/strict');
const {fixture,tick}=require('./lib-storage-read-deadlines');
const tests=[];const test=(name,run)=>tests.push({name,run});
const watch=p=>p.then(value=>({value}),error=>({error}));
function native(){const f=fixture();Object.assign(f.c,{AbortController,CompressionStream,DecompressionStream});f.c.SaveCompression.supported=true;f.c.SaveCompression.decompressionSupported=true;return f;}
test('native gzip roundtrip preserves full Chinese, emoji and long state data',async()=>{
  const f=native(),text=JSON.stringify({history:'完整中文与🙂叙事\n'.repeat(5000),zero:0,arr:[1,null,false]});
  const compressed=await f.c.SaveCompression.compress(text);assert(compressed instanceof Blob);assert(compressed.size<text.length);
  assert.equal(await f.c.SaveCompression.decompress(compressed),text);assert.equal(f.timers.size,0);
});
test('compression timeout cancels its stream and returns the entire original JSON',async()=>{
  const f=native();let cancel=0;const text='完整世界内容'.repeat(1000);
  class StuckBlob {stream(){return {pipeThrough:()=>({getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancel++;},releaseLock(){}})})};}}
  f.c.Blob=StuckBlob;const p=watch(f.c.SaveCompression.compress(text));await tick();f.fire(60000);
  assert.equal((await p).value,text);assert.equal(cancel,1);assert.equal(f.timers.size,0);
});
test('decompression timeout rejects and never returns a shortened save',async()=>{
  const f=native();let cancel=0;
  class StuckGzip {slice(){return {arrayBuffer:async()=>Uint8Array.from([31,139]).buffer};}stream(){return {pipeThrough:()=>({getReader:()=>({read:()=>new Promise(()=>{}),cancel:async()=>{cancel++;},releaseLock(){}})})};}}
  f.c.Blob=StuckGzip;const p=watch(f.c.SaveCompression.decompress(new StuckGzip()));await tick();f.fire(60000);
  assert.equal((await p).error.code,'SAVE_DECOMPRESS_TIMEOUT');assert.equal(cancel,1);assert.equal(f.timers.size,0);
});
test('checksum timeout prevents opening a write transaction',async()=>{
  const f=fixture();await f.api.open();const state=f.seed();f.c.crypto={subtle:{digest:()=>new Promise(()=>{})}};
  const p=watch(f.api.save('manual',state,{}));await tick();f.fire(60000);
  assert.equal((await p).error.code,'SAVE_CHECKSUM_TIMEOUT');assert.equal(f.transactions.filter(t=>t.mode==='readwrite').length,0);assert.equal(f.timers.size,0);
});
test('plain and old UTF-8 saves remain readable without compression support',async()=>{
  const f=fixture(),text='完整旧档与🙂内容';assert.equal(await f.c.SaveCompression.compress(text),text);
  assert.equal(await f.c.SaveCompression.decompress(text),text);assert.equal(await f.c.SaveCompression.decompress(new Blob([text])),text);assert.equal(f.timers.size,0);
});
test('gzip with unsupported decompressor remains a visible failure',async()=>{
  const f=native(),z=await f.c.SaveCompression.compress('完整数据');f.c.SaveCompression.decompressionSupported=false;
  await assert.rejects(f.c.SaveCompression.decompress(z),/不支持 gzip/);assert.equal(f.timers.size,0);
});
test('late completion cannot convert a timed-out codec operation into success',async()=>{
  const f=fixture();let release;const operation=new Promise(resolve=>{release=resolve;});const p=watch(f.c.SaveCompression.awaitResult(operation,'decompress'));
  f.fire(60000);const result=await p;release('迟到正文');await tick();assert.equal(result.error.code,'SAVE_DECOMPRESS_TIMEOUT');assert.equal(f.timers.size,0);
});
test('ordinary codec rejection clears the deadline and preserves failure',async()=>{
  const f=fixture();await assert.rejects(f.c.SaveCompression.awaitResult(Promise.reject(Error('fixture codec error')),'decompress'),/fixture codec/);assert.equal(f.timers.size,0);
});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
