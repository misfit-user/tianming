// Installed official map verification; isolated data, no network or user saves.
import {app,BrowserWindow} from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=process.env.SHAOSONG_REPO;
const stage=process.env.SHAOSONG_STAGE;
if(!root||!stage)throw Error('Explicit repository and test directory required');
const dir=path.join(stage,'installed-ui-second');
fs.mkdirSync(dir,{recursive:true});
for(const n of ['user-data','session-data'])fs.mkdirSync(path.join(dir,n),{recursive:true});
app.disableHardwareAcceleration();
app.setPath('userData',path.join(dir,'user-data'));
app.setPath('sessionData',path.join(dir,'session-data'));
let win,finished=false;
const started=Date.now(),report={started:new Date().toISOString(),complete:false,checks:[],stages:[]};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
report.sourceSha256=hash(fs.readFileSync(path.join(root,'scenarios/绍宋·建炎元年八月（官方）.json')));
function mark(name,data){report.stages.push({name,elapsedMs:Date.now()-started,...data});fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify(report,null,2));console.log(name,JSON.stringify(data||{}));}
const timeout=setTimeout(()=>finish(1,'Test deadline exceeded'),210000);
function finish(code,error){if(finished)return;finished=true;clearTimeout(timeout);if(error)report.error=String(error);report.exitCode=code;report.elapsedMs=Date.now()-started;fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));if(win&&!win.isDestroyed())win.destroy();app.exit(code);}
const sleep=n=>new Promise(r=>setTimeout(r,n));
function check(name,passed,detail){report.checks.push({name,passed,detail});if(!passed)throw Error(name+': '+JSON.stringify(detail));}
app.whenReady().then(async()=>{
win=new BrowserWindow({width:1920,height:1200,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,cb)=>cb({cancel:true}));
win.webContents.on('render-process-gone',(_,d)=>finish(1,'Renderer exited: '+JSON.stringify(d)));
const js=code=>win.webContents.executeJavaScript(code,true);
try{
 await win.loadFile(path.join(root,'web/index.html'));mark('page-loaded'); await js(`(async()=>{P.ai={key:'',url:'',model:''};P.conf=P.conf||{};P.conf.officeActivationEnabled=false;if(window.TMOfficialScenarioLoader){await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure('sc-jianyan1-1127-shaosong');}})()`);
 const source=await js(`(()=>{const s=P.scenarios.find(s=>s.id==='sc-jianyan1-1127-shaosong');return {regions:s?.map?.regions?.length,circuits:s?.map?.circuitRegistry?.length,polities:s?.factions.filter(f=>['fac_song','fac_jin','fac_xixia'].includes(f.id)).map(f=>({id:f.id,name:f.name}))};})()`);
 check('official-loader',source.regions===566&&source.circuits===101,source);mark('official-loaded',source);
 await js(`doActualStart('sc-jianyan1-1127-shaosong')`);mark('native-start-returned');
 await js(`(async()=>{if(window.TM?.Features)await TM.Features.ensure('formalMapLabels');TMPhase8FormalBridge.refresh();for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();})()`);
 const world=await js(`({running:GM.running,sid:GM.sid,regions:GM.mapData?.regions?.length,player:GM.playerInfo?.factionName,characters:GM.chars?.length,armies:GM.armies?.length})`);
 check('native-world',world.running===true&&world.regions===566&&world.player==='大宋',world);report.world=world;mark('world-running',world);
 async function waitMap(label,deadlineMs){
  const begin=Date.now();let info;
  do {info=await js(`(()=>{const el=document.getElementById('tmf-formal-map');return {paths:el?.querySelectorAll('.tmf-region').length||0,svg:!!el,scale:document.getElementById('mapwrap')?.dataset.mapScale,stageText:document.getElementById('ming-map-layer')?.innerText?.slice(0,160)};})()`);
   if(info.paths===566)return info;
   if(Date.now()-begin>deadlineMs)throw Error(label+' map not ready: '+JSON.stringify(info));
   await sleep(1200);
  }while(!finished);throw Error('Cancelled');
 }
 mark('waiting-map');await waitMap('initial',100000);mark('map-ready');
 await js(`(()=>{const b=document.createElement('div');b.textContent='绍宋本地官方地图验收 · 隔离 Electron · 无联网AI/无用户存档';b.style.cssText='position:fixed;top:0;left:0;z-index:2147483647;background:#222;color:white;padding:4px;font:13px sans-serif;pointer-events:none';document.body.appendChild(b);})()`);
 for(const tier of ['realm','region','prefecture']){
  await js(`(()=>{const b=document.querySelector('.map-scale[data-map-scale="${tier}"]');if(!b)throw Error('Missing tier button');b.click();})()`);
  await sleep(1500);const info=await waitMap(tier,35000);
  check('tier-'+tier,info.scale===tier&&info.paths===566,info);mark('tier-ready',{tier,...info});
  const png=(await win.webContents.capturePage()).toPNG();fs.writeFileSync(path.join(dir,'map-'+tier+'.png'),png);report.checks.push({name:'capture-'+tier,passed:png.length>10000,bytes:png.length,sha256:hash(png)});
 }
 check('source-not-modified',hash(fs.readFileSync(path.join(root,'scenarios/绍宋·建炎元年八月（官方）.json')))===report.sourceSha256);
 report.complete=true;finish(0);
}catch(e){mark('failure',{error:String(e.stack||e)});finish(1,e.stack||e);}
}).catch(e=>finish(1,e.stack||e));
