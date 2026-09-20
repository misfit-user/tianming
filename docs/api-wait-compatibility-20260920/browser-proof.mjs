import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import http from 'node:http';
import crypto from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
const dir=path.resolve('docs/api-wait-compatibility-20260920');
const names=['tm-ai-infra-json.js','tm-ai-infra-retry.js','tm-ai-infra.js','tm-ai-request-options.js','tm-api-settings.js'];
const requests=[],timers=new Set();
const server=http.createServer((req,res)=>{
 if(req.method==='POST'&&['/chat','/tools'].includes(req.url)){
  let data='';req.on('data',c=>{data+=c;});req.on('end',()=>{const b=JSON.parse(data);requests.push({path:req.url,maxTokens:b.max_tokens,stream:b.stream,tool:!!b.tools});
   res.writeHead(200,{'Content-Type':'application/json'});res.flushHeaders();
   const out=b.tools?{choices:[{message:{tool_calls:[{function:{name:'inspect',arguments:'{"deep":true}'}}]},finish_reason:'tool_calls'}]}:{choices:[{message:{content:b.stream?'完整工具或流式正文':'完整正文，不能删减。'.repeat(500)},finish_reason:'stop'}]};
   const timer=setTimeout(()=>{timers.delete(timer);if(!res.destroyed)res.end(JSON.stringify(out));},800);timers.add(timer);res.on('close',()=>{clearTimeout(timer);timers.delete(timer);});
  });return;
 }
 if(req.url==='/test.html'){res.setHeader('Content-Type','text/html; charset=utf-8');res.end(fs.readFileSync(path.join(dir,'browser-test.html')));return;}
 const name=req.url.slice(1);if(names.includes(name)){res.setHeader('Content-Type','text/javascript; charset=utf-8');res.end(fs.readFileSync(path.join('web',name)));return;}res.writeHead(404);res.end();
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const profileRoot='D:/tianming-task-artifacts-20260919';const profile=path.join(profileRoot,'.edge-api-wait-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const args=['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--disable-component-update','--disable-sync','--remote-debugging-port=0','--remote-debugging-address=127.0.0.1','--user-data-dir='+profile,'about:blank'];
const child=cp.spawn('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args,{stdio:['ignore','ignore','pipe']});let stderr='';child.stderr.on('data',b=>{stderr+=b.toString();});
let socket,sequence=0;const waiting=new Map();
function rpc(method,params={},sessionId){return new Promise((resolve,reject)=>{const id=++sequence;const timer=setTimeout(()=>{waiting.delete(id);reject(Error('CDP timeout '+method));},10000);waiting.set(id,{resolve:v=>{clearTimeout(timer);resolve(v);},reject:e=>{clearTimeout(timer);reject(e);}});socket.send(JSON.stringify({id,method,params,sessionId}));});}
let outcome=null,version=null,error=null;
try{
  const portFile=path.join(profile,'DevToolsActivePort');let connection;
  for(let i=0;i<100;i++){if(fs.existsSync(portFile)){connection=fs.readFileSync(portFile,'utf8').trim().split(/\r?\n/);break;}await sleep(100);}
  if(!connection)throw Error('No isolated debug endpoint');
  socket=new WebSocket('ws://127.0.0.1:'+connection[0]+connection[1]);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
  socket.addEventListener('message',event=>{const data=JSON.parse(event.data),pending=waiting.get(data.id);if(!pending)return;waiting.delete(data.id);data.error?pending.reject(Error(data.error.message)):pending.resolve(data.result);});
  version=await rpc('Browser.getVersion');
  const {targetId}=await rpc('Target.createTarget',{url:'http://127.0.0.1:'+server.address().port+'/test.html'});
  const {sessionId}=await rpc('Target.attachToTarget',{targetId,flatten:true});
  for(let i=0;i<400;i++){
    const value=await rpc('Runtime.evaluate',{expression:'document.getElementById("result")?.textContent',returnByValue:true},sessionId);
    if(value.result?.value&&value.result.value!=='pending'){outcome=JSON.parse(value.result.value);break;}await sleep(100);
  }
  if(!outcome)throw Error('Browser test did not finish');
}catch(e){error=String(e.stack||e);}
finally{
  if(socket?.readyState===WebSocket.OPEN){try{await rpc('Browser.close');}catch(_){}socket.close();}
  if(child.exitCode===null)child.kill();for(const timer of timers)clearTimeout(timer);server.closeAllConnections();server.close();
  for(const p of waiting.values())p.reject(Error('Browser closed'));waiting.clear();
}
fs.writeFileSync(path.join(dir,'browser-realtime-stderr.log'),stderr);
const report={at:new Date().toISOString(),sources:Object.fromEntries(names.map(n=>[n,crypto.createHash('sha256').update(fs.readFileSync('web/'+n)).digest('hex')])),version,isolatedProfile:profile,requests,outcome,error};
if(requests.length!==5){report.error='Expected five single requests; got '+requests.length;if(outcome)outcome.ok=false;}
await sleep(800);
try { if (!fs.lstatSync(profile).isSymbolicLink() && path.dirname(profile) === path.resolve(profileRoot)) { fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});report.profileRemoved=true; } } catch (e) { report.profileRemoved=false;report.cleanupError=String(e.message); }
fs.writeFileSync(path.join(dir,'browser-realtime-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!outcome?.ok)process.exitCode=1;
