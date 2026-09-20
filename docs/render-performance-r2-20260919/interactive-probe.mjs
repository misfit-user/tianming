// Offline test browser with isolated storage. Commands arrive only on this test process's stdin.
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs'; import path from 'node:path'; import readline from 'node:readline';
import { fileURLToPath } from 'node:url';
const work=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(work,'../..');
for(const key of ['userData','sessionData']) { const p=path.join(work,'interactive',key); fs.mkdirSync(p,{recursive:true});app.setPath(key,p); }
let win,chain=Promise.resolve(); const deadline=setTimeout(()=>app.exit(2),1200000);
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1600,height:1000,show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,cb)=>cb({cancel:true}));
 win.webContents.on('console-message',(_,level,message)=>{if(level>=3)console.log('PAGE_ERROR '+String(message).slice(0,600));});
 const js=s=>win.webContents.executeJavaScript(s,true);
 const input=readline.createInterface({input:process.stdin});
 input.on('line',line=>{chain=chain.then(async()=>{let id;try{const c=JSON.parse(line);id=c.id;let result;
  if(c.action==='load'){await win.loadFile(path.join(root,'web',c.file||'index.html'));result='loaded';}
  else if(c.action==='eval')result=await js(c.source);
  else if(c.action==='gpu')result=app.getGPUFeatureStatus();
  else if(c.action==='profile-start'){win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Profiler.enable');await win.webContents.debugger.sendCommand('Profiler.start');result=true;}
  else if(c.action==='profile-stop'){const p=await win.webContents.debugger.sendCommand('Profiler.stop');fs.writeFileSync(path.join(work,'interactive',String(c.name||'profile').replace(/[^a-z0-9-]/g,'')+'.cpuprofile'),JSON.stringify(p.profile));win.webContents.debugger.detach();result=true;}
  else if(c.action==='quit'){clearTimeout(deadline);win.destroy();app.exit(0);return;}
  else throw Error('Unknown test action');
  console.log('PROBE_RESULT '+JSON.stringify({id,result}));
 }catch(e){console.log('PROBE_RESULT '+JSON.stringify({id,error:String(e.stack||e)}));}});});
 console.log('PROBE_READY');
}).catch(e=>{console.error(e);app.exit(1);});
