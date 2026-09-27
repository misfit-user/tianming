import {app,BrowserWindow} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
const root=process.env.SHAOSONG_REPO,work=process.env.SHAOSONG_STAGE;
if(!root||!work)throw Error('Explicit local project and isolated test paths required.');
const dir=path.join(work,'native-ui');fs.mkdirSync(dir,{recursive:true});
app.setPath('userData',path.join(dir,'isolated-user-data'));
app.setPath('sessionData',path.join(dir,'isolated-session-data'));
app.commandLine.appendSwitch('disable-features','AutofillServerCommunication');
let win;const report={started:new Date().toISOString(),complete:false,checks:[],errors:[]};
const timeout=setTimeout(()=>{report.error='Native UI test timed out';finish(1);},120000);
function finish(code){clearTimeout(timeout);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));if(win&&!win.isDestroyed())win.destroy();app.exit(code);}
const delay=n=>new Promise(r=>setTimeout(r,n));
app.whenReady().then(async()=>{
win=new BrowserWindow({width:1600,height:1000,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(d,cb)=>cb({cancel:true}));
win.webContents.on('console-message',(ev,level,message)=>{if(level>=3&&report.errors.length<40)report.errors.push(message.slice(0,400));});
const js=code=>win.webContents.executeJavaScript(code,true);
try{
 await win.loadFile(path.join(root,'web/index.html'));
 await delay(3500);
 report.initial=await js(`({p:!!window.P,start:typeof window.doActualStart,loader:!!window.TMOfficialScenarioLoader,scenarios:window.P?.scenarios?.map(s=>({id:s.id,regions:s.map?.regions?.length}))})`);
 await js(`(async()=>{if(window.TM_Changelog){TM_Changelog.markRead();TM_Changelog.close();}P.ai={key:'',url:'',model:''};P.conf=P.conf||{};P.conf.officeActivationEnabled=false;if(window.TMOfficialScenarioLoader){await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure('sc-jianyan1-1127-shaosong');}})()`);
 await delay(1000);
 report.loaded=await js(`(()=>{const s=P.scenarios.find(s=>s.id==='sc-jianyan1-1127-shaosong');return {id:s?.id,regions:s?.map?.regions?.length,circuits:s?.map?.circuitRegistry?.length};})()`);
 if(report.loaded.regions!==566)throw Error('Official loader did not provide 566-cell map');
 await js(`doActualStart('sc-jianyan1-1127-shaosong')`);
 await delay(1800);
 await js(`(async()=>{if(window.TM?.Features)await TM.Features.ensure('formalMapLabels');TMPhase8FormalBridge.refresh();await document.fonts.ready;for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();})()`);
 report.world=await js(`({running:GM.running,sid:GM.sid,regions:GM.mapData?.regions?.length,player:GM.playerInfo?.factionName,characters:GM.chars?.length,armies:GM.armies?.length})`);
 if(!report.world.running||report.world.regions!==566)throw Error('Native world initialization failed');
 await js(`(()=>{const b=document.createElement('div');b.textContent='绍宋地图接入验收 · 隔离 Electron 数据 · 无联网AI';b.style.cssText='position:fixed;top:0;left:0;z-index:2147483647;background:#222;color:white;padding:5px;font:14px sans-serif;pointer-events:none';document.body.appendChild(b);})()`);
 for(const tier of ['realm','region','prefecture']){
  await js(`(()=>{const b=document.querySelector('.map-scale[data-map-scale="${tier}"]');if(!b)throw Error('Missing map tier button');b.click();})()`);
  await delay(1000);
  const info=await js(`(()=>{const svg=document.getElementById('tmf-formal-map');return {tier:'${tier}',regions:TMPhase8FormalBridge.map.getMapData().regions.length,paths:svg?.querySelectorAll('.tmf-region').length,boundary:svg?.querySelector('.tmf-tier-boundaries')?.dataset.tier};})()`);
  if(info.regions!==566||info.paths!==566)throw Error('Map tier count mismatch '+JSON.stringify(info));
  report.checks.push({...info,passed:true});
  fs.writeFileSync(path.join(dir,'map-'+tier+'.png'),(await win.webContents.capturePage()).toPNG());
 }
 report.complete=true;finish(0);
}catch(error){report.error=String(error.stack||error);if(win&&!win.isDestroyed())fs.writeFileSync(path.join(dir,'failure.png'),(await win.webContents.capturePage()).toPNG());finish(1);}

}).catch(e=>{report.error=String(e.stack||e);finish(1);});
