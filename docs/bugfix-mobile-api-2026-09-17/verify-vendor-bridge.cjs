'use strict';
// Evidence-only comparison with the installed Capacitor 6 fetch shim; no network or secrets.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const vendorFile=path.join(root,'mobile/node_modules/@capacitor/android/capacitor/src/main/assets/native-bridge.js');
const source=fs.readFileSync(vendorFile,'utf8');
const start=source.indexOf('window.fetch = async (resource, options) => {');
const end=source.indexOf('window.XMLHttpRequest = function ()',start);
assert(start>=0&&end>start,'installed vendor fetch assignment exists');
const assignment=source.slice(start,end).trim();
const vendorVersion=JSON.parse(fs.readFileSync(path.join(root,'mobile/node_modules/@capacitor/android/package.json'),'utf8')).version;
function fixture(reply){
 const sent=[];const c={Headers,Request,Response,FormData,URL,AbortController,AbortSignal,setTimeout,clearTimeout,console:{time(){},timeEnd(){}},
  location:{href:'https://localhost/index.html'},
  convertBody:async data=>({data,type:'json',headers:{}}),createProxyUrl:s=>s};
 c.cap={getServerUrl:()=> 'https://localhost',isNativePlatform:()=>true,nativePromise:async(_plugin,_method,o)=>{sent.push(o);return reply(o);}};
 c.Capacitor=c.cap;c.window=c;c.CapacitorWebFetch=()=>{throw Error('unexpected web call');};vm.createContext(c);
 vm.runInContext(assignment,c,{filename:vendorFile+':actual-fetch-assignment'});
 c.originalFetch=c.fetch;
 vm.runInContext(fs.readFileSync(path.join(root,'web/tm-ai-infra-retry.js'),'utf8'),c);
 return {c,sent};
}
const url='https://provider.example/v1/chat/completions',opts={method:'POST',headers:{'Content-Type':'application/json'},body:'{"test":"synthetic-only"}'};
async function main(){
 const cases=[];
 for(const [name,headers] of [['uppercase header',{'CONTENT-TYPE':'application/json'}],['vendor JSON',{'Content-Type':'application/problem+json'}]]){
  const f=fixture(async()=>({status:200,headers,data:{ok:true},url}));
  const broken=await f.c.originalFetch(url,opts);assert.equal(await broken.text(),'[object Object]');
  const fixed=await f.c._tmAIFetch(url,opts);assert.equal((await fixed.json()).ok,true);cases.push({name,old:'invalid object string',fixed:'valid JSON'});
 }
 let release;const f=fixture(()=>new Promise(r=>{release=r;})),ctrl=new AbortController();
 const pending=f.c.originalFetch(url,{...opts,signal:ctrl.signal});
 await new Promise(r=>setTimeout(r,5));ctrl.abort();
 const state=await Promise.race([pending.then(()=> 'resolved',()=> 'rejected'),new Promise(r=>setTimeout(()=>r('still-pending'),25))]);
 assert.equal(state,'still-pending');release({status:200,headers:{},data:'late',url});await pending;
 assert.equal(f.sent[0].connectTimeout,undefined);assert.equal(f.sent[0].readTimeout,undefined);
 const next=new AbortController();const safer=f.c._tmAIFetch(url,{...opts,signal:next.signal,timeoutMs:50});
 const rejected=assert.rejects(safer,e=>e.code==='AI_ABORTED');await new Promise(r=>setTimeout(r,5));next.abort();await rejected;
 release({status:200,headers:{},data:'late',url});
 assert.equal(f.sent[1].readTimeout,50);cases.push({name:'abort/deadline',old:'abort ignored; no native timeouts',fixed:'local cancellation; bounded native timeouts'});
 const result={device:require('node:os').hostname(),vendorVersion,vendorSource:path.relative(root,vendorFile),cases,realPhone:false,networkRequests:0};
 fs.writeFileSync(path.join(__dirname,'vendor-comparison.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}
main().catch(e=>{console.error(e);process.exitCode=1;});
