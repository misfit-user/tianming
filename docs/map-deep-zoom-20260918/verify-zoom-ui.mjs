// Real official game startup in an isolated Electron profile; never uses user API credentials/saves.
import {app,BrowserWindow} from 'electron';import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=process.env.ZOOM_REPO,work=process.env.ZOOM_WORK,mode=process.env.ZOOM_MODE||'after';
if(!root||!work)throw Error('Explicit test scope required');
const sid=process.env.ZOOM_SID||'sc-tianqi7-1627',tag=mode+'-'+sid,dir=path.join(work,tag);
fs.mkdirSync(dir,{recursive:true});for(const key of ['user','session'])fs.mkdirSync(path.join(dir,key),{recursive:true});
app.disableHardwareAcceleration();app.setPath('userData',path.join(dir,'user'));app.setPath('sessionData',path.join(dir,'session'));
const started=Date.now(),report={mode,sid,time:new Date().toISOString(),complete:false,checks:[],steps:[]};let win,done=false;
function mark(name,detail){report.steps.push({name,ms:Date.now()-started,detail});fs.writeFileSync(path.join(dir,'progress.json'),JSON.stringify(report,null,2));console.log(name);}
function check(name,passed,detail){report.checks.push({name,passed,detail});if(!passed)throw Error(name+': '+JSON.stringify(detail));}
const timer=setTimeout(()=>finish(1,'test timeout'),200000),sleep=ms=>new Promise(r=>setTimeout(r,ms));
function finish(code,error){if(done)return;done=true;clearTimeout(timer);report.exitCode=code;report.ms=Date.now()-started;if(error)report.error=String(error);fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));if(win&&!win.isDestroyed())win.destroy();app.exit(code);}
app.whenReady().then(async()=>{
 win=new BrowserWindow({width:1920,height:1200,show:false,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,cb)=>cb({cancel:true}));
 win.webContents.on('render-process-gone',(_,d)=>finish(1,'renderer exited '+JSON.stringify(d)));
 const js=code=>win.webContents.executeJavaScript(code,true);
 async function shot(name){await js(`new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))`);await sleep(250);await win.webContents.capturePage();await sleep(300);const png=(await win.webContents.capturePage()).toPNG();fs.writeFileSync(path.join(dir,name+'.png'),png);return {file:name+'.png',bytes:png.length,sha256:crypto.createHash('sha256').update(png).digest('hex')};}
 const state=()=>js(`JSON.parse(JSON.stringify(TMPhase8FormalBridge.__p8MapParts.state.mapView))`);
 async function waitView(predicate,label){const start=Date.now();let v;do{v=await state();if(predicate(v))return v;if(Date.now()-start>12000)throw Error(label+' native-input timeout '+JSON.stringify(v));await sleep(120);}while(!done);throw Error('Test cancelled');}
 try{
 await win.loadFile(path.join(root,'web/index.html'));mark('page-loaded');
 await js(`(async()=>{P.ai={key:'',url:'',model:''};P.conf=P.conf||{};P.conf.officeActivationEnabled=false;await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure('${sid}');})()`);
 const source=await js(`(()=>{const s=P.scenarios.find(s=>s.id==='${sid}');return {id:s.id,regions:s.map.regions.length,circuits:s.map.circuitRegistry?.length};})()`);
 check('official-scenario-loaded',source.id===sid&&source.regions>300,source);report.source=source;
 await js(`doActualStart('${sid}')`);mark('native-start');
 await js(`(async()=>{if(window.TM?.Features)await TM.Features.ensure('formalMapLabels');TMPhase8FormalBridge.refresh();for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();})()`);
 for(let n=0;n<90;n++){const ready=await js(`document.querySelectorAll('#tmf-formal-map .tmf-region').length`);if(ready===source.regions)break;if(n===89)throw Error('map failed to render');await sleep(700);}
 mark('map-ready');
 await js(`(()=>{for(const b of document.querySelectorAll('button'))if(b.textContent.includes('已阅')&&b.textContent.includes('闭卷'))b.click();if(window.TM_Changelog){TM_Changelog.markRead();TM_Changelog.close();}const banner=document.createElement('div');banner.id='zoom-proof';banner.textContent='地图缩放验收 · ${mode} · 本地原生游戏 · 隔离数据';banner.style.cssText='position:fixed;top:0;left:0;z-index:2147483647;background:#222;color:white;padding:4px;font:13px sans-serif;pointer-events:none';document.body.appendChild(banner);const dock=document.getElementById('map-tools-dock');if(dock?.classList.contains('open'))document.querySelector('[data-map-tools-toggle]').click();})()`);
 const targetId=await js(`(()=>{const rows=GM.mapData.regions;return (rows.find(r=>r.name==='皮岛')||rows.find(r=>r.name==='壹岐国')||rows.find(r=>r.name==='壹岐岛')||rows[0]).id;})()`);
 report.targetId=targetId;
 const focus=async()=>{await js(`TMPhase8FormalBridge.map.focusRegion('${targetId}',false)`);await sleep(600);};
 const box=()=>js(`(()=>{const p=document.querySelector('#tmf-formal-map .tmf-region[data-region-id="${targetId}"]');const b=p.getBoundingClientRect(),q=document.getElementById('ming-map-layer').getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height,inside:b.left>=q.left&&b.top>=q.top&&b.right<=q.right&&b.bottom<=q.bottom,scale:TMPhase8FormalBridge.__p8MapParts.state.mapView.scale,mode:document.getElementById('tmf-formal-map').dataset.zoomRendering};})()`);
 await focus();
 if(mode==='before'){
  await js(`for(let i=0;i<32;i++)document.querySelector('[data-map-zoom="1.22"]').click()`);await sleep(600);await focus();
  report.maximum=await box();report.screenshot=await shot('old-maximum');report.complete=true;finish(0);return;
 }
 const initial=await box();check('small-target-autofocus',initial.scale>4.2,initial);report.autofocus=initial;report.focusScreenshot=await shot('small-target-autofocus');
 await js(`for(let i=0;i<40;i++)document.querySelector('[data-map-zoom="1.22"]').click()`);await sleep(650);await focus();
 report.projection=await js(`(()=>{const svg=document.getElementById('tmf-formal-map'),world=document.getElementById('tmf-map-world'),camera=svg.parentElement,stage=document.getElementById('ming-map-layer'),label=document.getElementById('tmf-label-world'),r=GM.mapData.regions.find(r=>r.id==='${targetId}'),path=document.querySelector('#tmf-formal-map .tmf-region[data-region-id="${targetId}"]');const info=n=>({tag:n.tagName,id:n.id,cls:n.className?.baseVal||n.className,rect:n.getBoundingClientRect().toJSON(),transform:n.getAttribute('transform'),style:n.getAttribute('style'),computed:{transform:getComputedStyle(n).transform,origin:getComputedStyle(n).transformOrigin,box:getComputedStyle(n).transformBox},ctm:n.getScreenCTM?.()?.toString()});return {map:{width:GM.mapData.width,height:GM.mapData.height},state:TMPhase8FormalBridge.__p8MapParts.state.mapView,viewBox:svg.getAttribute('viewBox'),preserve:svg.getAttribute('preserveAspectRatio'),nodes:[path,world,svg,camera,stage,label].filter(Boolean).map(info),target:{center:r.center}};})()`);mark('projection-probe',report.projection);
 const atMax=await box();check('button-maximum-128',atMax.scale===128,atMax);check('deep-zoom-remains-vector',atMax.mode==='vector',atMax);check('island-is-visible',atMax.width>40&&atMax.height>25&&atMax.inside,atMax);report.maximum=atMax;
 await js(`document.getElementById('zoom-proof').textContent='地图放大 128× · 本地原生游戏 · 矢量地块 · 隔离数据'`);report.maximumScreenshot=await shot('new-maximum-128');
 const point=await js(`(()=>{const r=GM.mapData.regions.find(r=>r.id==='${targetId}'),p=document.querySelector('#tmf-formal-map .tmf-region[data-region-id="${targetId}"]'),c=new DOMPoint(r.center[0],r.center[1]).matrixTransform(p.getScreenCTM());return {x:Math.round(c.x),y:Math.round(c.y),name:r.name};})()`);
 win.webContents.sendInputEvent({type:'mouseMove',x:point.x,y:point.y});win.webContents.sendInputEvent({type:'mouseDown',x:point.x,y:point.y,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',x:point.x,y:point.y,button:'left',clickCount:1});await sleep(750);
 const panel=await js(`({id:document.getElementById('ppop')?.dataset.regionId,text:document.getElementById('ppop')?.innerText?.slice(0,160)})`);
 check('real-click-selects-small-target',panel.id===targetId&&panel.text.includes(point.name),panel);report.clickScreenshot=await shot('small-target-clicked');
 await js(`TMPhase8FormalBridge.map.closeMapDossier();window.__zoomWheelLog=[];document.getElementById('ming-map-layer').addEventListener('wheel',e=>window.__zoomWheelLog.push({deltaY:e.deltaY,trusted:e.isTrusted}),{passive:true})`);await sleep(300);
 // Real wheel input at the target must preserve its screen anchor while reducing deep zoom.
 const v1=await state();win.webContents.sendInputEvent({type:'mouseWheel',x:point.x,y:point.y,deltaY:-40,deltaX:0,canScroll:true});const v2=await waitView(v=>v.scale<128,'wheel down');
 check('wheel-from-128-does-not-snap-to-old-cap',v2.scale<128&&v2.scale>100,{before:v1,after:v2});
 await js(`document.querySelector('[data-map-reset]').click()`);await sleep(450);
 for(let i=0;i<40;i++){const prior=await state();if(prior.scale===128)break;win.webContents.sendInputEvent({type:'mouseWheel',x:point.x,y:point.y,deltaY:100,deltaX:0,canScroll:true});await waitView(v=>v.scale>prior.scale,'wheel up');}await sleep(250);
 report.wheelInput=await js(`window.__zoomWheelLog`);const vw=await state();check('real-wheel-reaches-same-cap',vw.scale===128,vw);mark('wheel-and-click-tested');
 await js(`document.querySelector('[data-map-reset]').click()`);await sleep(350);
 win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled',{enabled:true,maxTouchPoints:2});
 const touchAt=(distance)=>[{x:point.x-distance/2,y:point.y,id:1,radiusX:1,radiusY:1,force:1},{x:point.x+distance/2,y:point.y,id:2,radiusX:1,radiusY:1,force:1}];
 for(let i=0;i<12;i++){
  const prior=await state();if(prior.scale===128)break;
  await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touchAt(100)});await sleep(20);
  await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:touchAt(160)});await waitView(v=>v.scale>prior.scale,'two-finger pinch');
  await win.webContents.debugger.sendCommand('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await sleep(25);
 }
 await sleep(550);const vp=await state();check('emulated-two-finger-pinch-reaches-128',vp.scale===128,vp);report.touch={emulated:true,deviceHardwareTested:false,view:vp};
 await win.webContents.debugger.sendCommand('Emulation.setTouchEmulationEnabled',{enabled:false});win.webContents.debugger.detach();
 await focus();const beforeDrag=await state();
 win.webContents.sendInputEvent({type:'mouseMove',x:point.x,y:point.y});win.webContents.sendInputEvent({type:'mouseDown',x:point.x,y:point.y,button:'left',clickCount:1});
 win.webContents.sendInputEvent({type:'mouseMove',x:point.x+90,y:point.y+45,button:'left'});win.webContents.sendInputEvent({type:'mouseUp',x:point.x+90,y:point.y+45,button:'left',clickCount:1});const afterDrag=await waitView(v=>v.tx!==beforeDrag.tx,'drag');check('deep-pan-stays-finite-and-moves',afterDrag.scale===128&&Number.isFinite(afterDrag.tx)&&Number.isFinite(afterDrag.ty)&&afterDrag.tx!==beforeDrag.tx,{before:beforeDrag,after:afterDrag});
 await js(`for(let i=0;i<70;i++)document.querySelector('[data-map-zoom="0.82"]').click()`);await sleep(600);const minimum=await state();check('zoom-out-reaches-shared-minimum',minimum.scale===.72,minimum);
 await js(`document.querySelector('[data-map-reset]').click()`);await sleep(700);
 const reset=await js(`({view:TMPhase8FormalBridge.__p8MapParts.state.mapView,rendering:document.getElementById('tmf-formal-map').dataset.zoomRendering,paths:document.querySelectorAll('#tmf-formal-map .tmf-region').length})`);
 check('reset-restores-whole-map-and-renderer',reset.view.scale===1&&reset.view.tx===0&&reset.view.ty===0&&reset.paths===source.regions&&reset.rendering==='compositor',reset);
 report.resetScreenshot=await shot('whole-map-after-deep-zoom');
 report.complete=true;finish(0);
 }catch(e){mark('failure',String(e.stack||e));try{report.failureScreenshot=await shot('failure');report.finalView=await state();report.wheelInput=await js(`window.__zoomWheelLog`);}catch(_){}finish(1,e.stack||e);}
}).catch(e=>finish(1,e.stack||e));
