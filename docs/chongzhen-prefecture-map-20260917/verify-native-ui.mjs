// Real installed game page, isolated user/session data; no network and no user saves.
import {app,BrowserWindow} from 'electron';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=process.env.CHONGZHEN_REPO,work=process.env.CHONGZHEN_WORK,tag=process.env.CHONGZHEN_UI_TAG||'native-ui';if(!root||!work)throw Error('Explicit test locations required');
const dir=path.join(work,tag);fs.mkdirSync(dir,{recursive:true});for(const n of ['user-data','session-data'])fs.mkdirSync(path.join(dir,n),{recursive:true});
app.disableHardwareAcceleration();app.setPath('userData',path.join(dir,'user-data'));app.setPath('sessionData',path.join(dir,'session-data'));
const report={started:new Date().toISOString(),complete:false,checks:[],steps:[],errors:[]},started=Date.now();let win,done=false;
const source=path.join(root,'scenarios/天启七年·九月（官方）.json'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');report.sourceSha256=hash(fs.readFileSync(source));
function mark(name,data){report.steps.push({name,elapsedMs:Date.now()-started,...data});fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify(report,null,2));console.log(name);}
const timer=setTimeout(()=>finish(1,'timeout'),180000);function finish(code,error){if(done)return;done=true;clearTimeout(timer);report.exitCode=code;if(error)report.error=String(error);report.elapsedMs=Date.now()-started;fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));if(win&&!win.isDestroyed())win.destroy();app.exit(code);}
function check(name,passed,detail){report.checks.push({name,passed,detail});if(!passed)throw Error(name+': '+JSON.stringify(detail));}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{win=new BrowserWindow({width:2400,height:1500,show:false,webPreferences:{contextIsolation:true,nodeIntegration:false,sandbox:true,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,cb)=>cb({cancel:true}));
 win.webContents.on('render-process-gone',(_,d)=>finish(1,JSON.stringify(d)));win.webContents.on('console-message',(_,level,message)=>{if(level>=3&&report.errors.length<20)report.errors.push(String(message).slice(0,350));});
 const js=s=>win.webContents.executeJavaScript(s,true);
 try{
 await win.loadFile(path.join(root,'web/index.html'));mark('game-page-loaded');
 await js(`(async()=>{P.ai={key:'',url:'',model:''};P.conf=P.conf||{};P.conf.officeActivationEnabled=false;await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure('sc-tianqi7-1627');})()`);
 const load=await js(`(()=>{const s=P.scenarios.find(s=>s.id==='sc-tianqi7-1627');return {id:s.id,regions:s.map?.regions?.length,provinces:s.map?.circuitRegistry?.length,characters:s.characters?.length,armies:s.military?.initialTroops?.length};})()`);
 check('official-loader-current-candidate',load.regions===284&&load.provinces===43&&load.characters===203&&load.armies===48,load);mark('official-loaded',load);
 await js(`doActualStart('sc-tianqi7-1627')`);mark('native-start-returned');
 await js(`(async()=>{if(window.TM?.Features)await TM.Features.ensure('formalMapLabels');TMPhase8FormalBridge.refresh();for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();})()`);
 const world=await js(`({running:GM.running,regions:GM.mapData?.regions?.length,player:GM.playerInfo?.characterName,characters:GM.chars?.length,armies:GM.armies?.length})`);check('native-world-running',world.running&&world.regions===284,world);report.world=world;
 async function waitMap(){const start=Date.now();let info;do{info=await js(`(()=>{const svg=document.getElementById('tmf-formal-map');return {paths:svg?.querySelectorAll('.tmf-region').length||0,scale:document.getElementById('mapwrap')?.dataset.mapScale,message:document.getElementById('ming-map-layer')?.innerText?.slice(0,120)};})()`);if(info.paths===284)return info;if(Date.now()-start>90000)throw Error('map preparation timed out '+JSON.stringify(info));await sleep(900);}while(!done);}
 await waitMap();mark('map-ready');
 await js(`(()=>{for(const b of document.querySelectorAll('button'))if(b.textContent.includes('已阅')&&b.textContent.includes('闭卷'))b.click();if(window.TM_Changelog){TM_Changelog.markRead();TM_Changelog.close();}const banner=document.createElement('div');banner.id='chongzhen-map-proof';banner.textContent='崇祯开局·本地官方三级地图验收｜隔离数据｜无联网AI';banner.style.cssText='position:fixed;top:0;left:0;z-index:2147483647;background:#222;color:#fff;padding:5px;font:14px sans-serif;pointer-events:none';document.body.appendChild(banner);})()`);
 report.membership=await js(`(()=>{const rs=GM.mapData.regions;return GM.facs.map(f=>({name:f.name,id:f.id,ownedCells:rs.filter(r=>(r.currentOwner||r.owner||r.factionId)===f.id).length,listed:TM.FactionMembership.getProvinces(f.id)}));})()`);
 report.location=await js(`(()=>{const p=GM.chars.find(c=>c.name==='朱由检');return {text:p?.location,regionId:p?.regionId,regionName:GM.mapData.regions.find(r=>r.id===p?.regionId)?.name,contract:GM.mapData.locationBindingContract?.schema};})()`);
 check('palace-location-uses-prefecture',report.location.regionName==='顺天府',report.location);
 await js(`(()=>{const state=TMPhase8FormalBridge.__p8MapParts.state;if(!state)throw Error('Native camera state unavailable');state._zoomLevelLinkOff=true;const dock=document.getElementById('map-tools-dock');if(dock?.classList.contains('open'))document.querySelector('[data-map-tools-toggle]').click();})()`);
 for(const tier of ['realm','region','prefecture']){
  await js(`document.querySelector('.map-scale[data-map-scale="${tier}"]').click();document.querySelector('[data-map-reset]').click()`);await sleep(1600);const info=await waitMap();check('tier-'+tier,info.scale===tier&&info.paths===284,info);
  const viewport=await js(`(()=>{const box=document.getElementById('ming-map-layer').getBoundingClientRect();const paths=[...document.querySelectorAll('#tmf-formal-map .tmf-region')];const clipped=paths.filter(p=>{const b=p.getBoundingClientRect();return b.left<box.left-.75||b.top<box.top-.75||b.right>box.right+.75||b.bottom>box.bottom+.75;}).map(p=>p.dataset.regionId);return {camera:TMPhase8FormalBridge.__p8MapParts.state.mapView,paths:paths.length,clipped};})()`);
  check('panorama-'+tier,viewport.paths===284&&viewport.clipped.length===0,viewport);
  await js(`(()=>{const b=document.querySelector('body > div[style*="2147483647"]');if(b)b.textContent='崇祯开局·本地官方三级地图验收｜当前层级：'+({realm:'天下',region:'省道',prefecture:'府州'})['${tier}']+'｜隔离数据·无联网AI';})()`);
  // Hidden Electron windows may return the previous compositor frame on first capture.
  await win.webContents.capturePage();await sleep(750);
  await win.webContents.capturePage();await sleep(750);
  await js(`(()=>{document.getElementById('chongzhen-map-proof').textContent='崇祯开局 · '+({realm:'天下',region:'省道',prefecture:'府州'})['${tier}']+'全景｜本地原生游戏｜固定取景｜隔离数据';return new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))));})()`);
  await sleep(1200);await win.webContents.capturePage();await sleep(400);
  const png=(await win.webContents.capturePage()).toPNG();fs.writeFileSync(path.join(dir,'map-'+tier+'.png'),png);report.checks.push({name:'screenshot-'+tier,passed:png.length>10000,bytes:png.length,sha256:hash(png)});
 }
 report.liveTransfers=await js(fs.readFileSync(path.join(root,'docs/chongzhen-prefecture-map-20260917/verify-live-transfers.js'),'utf8'));
 check('native-live-transfer-and-location-sequence',report.liveTransfers.failed===0,report.liveTransfers);
 check('source-unchanged-by-running-game',hash(fs.readFileSync(source))===report.sourceSha256);
 report.complete=true;finish(0);
 }catch(e){try{report.diagnostics=await js(`({publicService:!!window.TM?.PublicTreasury,publicConfiguration:GM.publicTreasuryConfig?.schema||null,initializerResult:window.FiscalEngine?.initializePublicTreasuries?FiscalEngine.initializePublicTreasuries({game:GM,scenario:P.scenarios.find(s=>s.id==='sc-tianqi7-1627')}):null,publicScripts:[...document.scripts].map(s=>s.src).filter(s=>s.includes('public-treasury')),sid:GM.sid})`);}catch(d){report.diagnosticError=String(d);}mark('failed',{error:String(e.stack||e)});finish(1,e.stack||e);}
}).catch(e=>finish(1,e.stack||e));
