import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import http from 'node:http';
import crypto from 'node:crypto';
import {setTimeout as sleep} from 'node:timers/promises';
const dir=path.resolve('docs/endturn-final-closeout-20260919');
const source=fs.readFileSync('web/tm-endturn-response-recovery.js','utf8');
fs.writeFileSync(path.join(dir,'browser-response.js'),source);
fs.writeFileSync(path.join(dir,'browser-vault.js'),fs.readFileSync('web/tm-endturn-recovery-vault.js'));
const files={'/test.html':['browser-vault.html','text/html; charset=utf-8'],'/tm-endturn-response-recovery.js':['browser-response.js','text/javascript; charset=utf-8'],'/tm-endturn-recovery-vault.js':['browser-vault.js','text/javascript; charset=utf-8']};
const server=http.createServer((req,res)=>{const item=files[req.url];if(!item){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',item[1]);res.end(fs.readFileSync(path.join(dir,item[0])));});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const profile=path.join(dir,'.edge-realtime-'+Date.now());fs.mkdirSync(profile,{recursive:true});
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
  if(child.exitCode===null)child.kill();server.close();
  for(const p of waiting.values())p.reject(Error('Browser closed'));waiting.clear();
}
fs.writeFileSync(path.join(dir,'browser-realtime-stderr.log'),stderr);
const report={at:new Date().toISOString(),vaultSHA:crypto.createHash('sha256').update(fs.readFileSync('web/tm-endturn-recovery-vault.js')).digest('hex'),sourceSHA:crypto.createHash('sha256').update(source).digest('hex'),version,isolatedProfile:profile,outcome,error};
await sleep(800);
try { if (!fs.lstatSync(profile).isSymbolicLink() && path.dirname(profile) === dir) { fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});report.profileRemoved=true; } } catch (e) { report.profileRemoved=false;report.cleanupError=String(e.message); }
fs.writeFileSync(path.join(dir,'browser-realtime-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(!outcome?.ok)process.exitCode=1;
