// Offline, isolated battle page; the player's campaign and settings are not used.
import {app,BrowserWindow} from 'electron';
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const work=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(work,'../..');
const tag=process.env.TM_BATTLE_PROBE_TAG;if(!/^[a-z0-9-]+$/.test(tag||''))throw Error('Explicit tag required');
const dir=path.join(work,tag);fs.mkdirSync(dir,{recursive:true});
for(const key of ['userData','sessionData']){const p=path.join(dir,key);fs.mkdirSync(p,{recursive:true});app.setPath(key,p);}
let win,done=false;const report={tag,started:new Date().toISOString(),complete:false,errors:[]};
function finish(code,error){if(done)return;done=true;clearTimeout(timer);report.code=code;if(error)report.error=String(error);try{fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));}finally{if(win&&!win.isDestroyed())win.destroy();app.exit(code);}}
const timer=setTimeout(()=>finish(1,'deadline'),120000);
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1440,height:900,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,cb)=>cb({cancel:true}));
 win.webContents.on('console-message',(_,level,text)=>{if(level>=3&&report.errors.length<20)report.errors.push(String(text));});
 win.webContents.on('render-process-gone',(_,detail)=>finish(1,JSON.stringify(detail)));
 const js=s=>win.webContents.executeJavaScript(s,true);
 try{
  await win.loadFile(path.join(root,'web/battle/index.html'));
  report.ready=await js('({phase:state.phase,units:units.length,software:_cpuHUD})');
  report.measure=await js(`(()=>{state.paused=true;state.phase='battle';state.reinf=[{side:'ming',t:65,done:false}];state.time=3;MAP._objs=[{name:'测试要地',x:WORLD.w/2,y:WORLD.h/2,r:80}];state.obj={ming:1,jin:0,owner:'ming'};updateHUD();const world=JSON.stringify(units),observer=new MutationObserver(()=>{});observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});const times=[];for(let i=0;i<60;i++){const t=performance.now();updateHUD();times.push(performance.now()-t);}const changes=observer.takeRecords();observer.disconnect();const texts=['clock','pausebadge','mlMing','mlJin','reinf','objbar'].map(id=>[id,document.getElementById(id).textContent]);const unchanged=world===JSON.stringify(units);state.time=15;updateHUD();const updated=document.getElementById('reinf').textContent;document.getElementById('clock').textContent='stale';updateHUD();return{times,changes:changes.length,childChanges:changes.filter(r=>r.type==='childList').length,unchanged,texts,updated,repaired:document.getElementById('clock').textContent==='暂停'};})()`);
  if(!report.measure.unchanged||!report.measure.repaired||!report.measure.updated.includes('0:50'))throw Error('HUD state/content check failed');
  report.primitiveValues=await js(`(()=>{for(const value of [null,undefined,0,false,'<b>文字</b>']){const a=document.createElement('div'),b=document.createElement('div');a.textContent=value;battleWriteText(b,value);if(a.textContent!==b.textContent)return false;a.innerHTML=value;battleWriteHTML(b,value);if(a.innerHTML!==b.innerHTML)return false;}return true;})()`);
  if(!report.primitiveValues)throw Error('Native DOM value conversion mismatch');
  report.gpu=app.getGPUFeatureStatus();report.complete=true;finish(0);
 }catch(error){finish(1,error.stack||error);}
}).catch(error=>finish(1,error.stack||error));
