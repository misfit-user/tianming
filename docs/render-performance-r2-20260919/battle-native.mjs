import {app,BrowserWindow} from 'electron';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const work=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(work,'../..'),tag=process.env.TM_BATTLE_PROBE_TAG||'battle-before';
if(!/^[a-z0-9-]+$/.test(tag))throw Error('Invalid test tag');
const dir=path.join(work,tag);fs.mkdirSync(dir,{recursive:true});for(const key of ['userData','sessionData']){const p=path.join(dir,key);fs.mkdirSync(p,{recursive:true});app.setPath(key,p);}
const file=path.join(root,'web/battle/index.html'),report={complete:false,errors:[],sourceSha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')};let win;
const deadline=setTimeout(()=>app.exit(2),120000);
app.whenReady().then(async()=>{
 try{
  win=new BrowserWindow({width:1200,height:800,show:false,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,backgroundThrottling:false}});
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,cb)=>cb({cancel:true}));
  win.webContents.on('console-message',(_,level,message)=>{if(level>=3&&report.errors.length<12)report.errors.push(message);});
  const js=s=>win.webContents.executeJavaScript(s,true);await win.loadFile(file);
  await js("window.__battleCount={draw:0,step:0};const oldDraw=draw,oldStep=step;draw=function(){__battleCount.draw++;return oldDraw.apply(this,arguments);};step=function(){__battleCount.step++;return oldStep.apply(this,arguments);};true;");
  async function sample(){return js("new Promise(resolve=>{__battleCount.draw=0;__battleCount.step=0;const t=performance.now();setTimeout(()=>resolve({counts:{...__battleCount},ms:performance.now()-t,phase:state.phase,paused:state.paused,title:document.getElementById('title').style.display,renderer:R3D.ready}),1200);})");}
  report.menu=await sample();
  await js("document.getElementById('title').style.display='none';composeConfirm();");report.visibleBattle=await sample();
  win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Profiler.enable');await win.webContents.debugger.sendCommand('Profiler.start');
  report.manualDraw=await js("(()=>{const times=[];for(let i=0;i<6;i++){const t=performance.now();draw();times.push(performance.now()-t);}return {times,units:units.length};})()");
  const cpu=await win.webContents.debugger.sendCommand('Profiler.stop');fs.writeFileSync(path.join(dir,'battle-draw.cpuprofile'),JSON.stringify(cpu.profile));win.webContents.debugger.detach();
  await js("start();_showTitle();");report.returnedMenu=await sample();

  await js("window.__savedHUD={updateHUD,paintRoster,updateCmdVisibility};true;");
  async function hudMeasure(){return js("(()=>{updateHUD();paintRoster();const observer=new MutationObserver(()=>{});observer.observe(document.body,{subtree:true,childList:true,attributes:true,characterData:true});const t=performance.now();for(let i=0;i<60;i++){updateHUD();paintRoster();}const ms=performance.now()-t,records=observer.takeRecords();observer.disconnect();return{ms,mutations:records.length,children:records.filter(r=>r.type==='childList').length,ui:['mfMing','mfJin','mlMing','mlJin','clock','pausebadge','clkL','selcards'].map(id=>document.getElementById(id)?.outerHTML||'').join('')};})()");}
  await js(fs.readFileSync(path.join(work,'hud-original-functions.js'),'utf8')+';true;');report.hudBefore=await hudMeasure();
  await js("updateHUD=__savedHUD.updateHUD;paintRoster=__savedHUD.paintRoster;updateCmdVisibility=__savedHUD.updateCmdVisibility;true;");report.hudAfter=await hudMeasure();
  report.hudIdentical=report.hudBefore.ui===report.hudAfter.ui;delete report.hudBefore.ui;delete report.hudAfter.ui;
  report.gpu=app.getGPUFeatureStatus();report.complete=true;
 }catch(e){report.error=String(e.stack||e);}
 finally{clearTimeout(deadline);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));if(win&&!win.isDestroyed())win.destroy();app.exit(report.complete?0:1);}
});
