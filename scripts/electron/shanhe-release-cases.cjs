'use strict';
// Formal 2.5D contract first, followed by the unchanged original-SVG fallback suite.
const assert=require('node:assert/strict');
module.exports=async function({win,check}){
 const js=s=>win.webContents.executeJavaScript(s,true),wait=ms=>new Promise(r=>setTimeout(r,ms));
 await check('default C1 uses the current official map, not an offline fixture',async()=>{
  const d=await js(`(async()=>{const end=Date.now()+60000;while(Date.now()<end&&!TMShanheRuntime.active()){if(TMShanheRuntime.diagnostics().errors.length)break;await new Promise(r=>setTimeout(r,100));}return {diag:TMShanheRuntime.diagnostics(),regions:GM.mapData.regions.length};})()`);
  assert(d.diag.active&&d.diag.enabled,JSON.stringify(d.diag));assert.equal(d.diag.clarityVersion,'C1');assert.equal(d.diag.regions,d.regions);assert.equal(d.diag.stats.referenceOnly,false);
 });
 await js(`(async()=>{await new Promise(r=>setTimeout(r,650));TM_Changelog.markRead();TM_Changelog.close();for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();document.getElementById('map-tools-dock')?.classList.remove('open');})()`);
 // 地形与山河境可以先贴在兜底地图上显示，这时三层地图仍在后台准备，地图不接滚轮；要等三层真正换下兜底地图再测
 await js(`(async()=>{const end=Date.now()+60000;while(!(TMPhase8FormalBridge.map.preparationStatus()?.ready&&!document.querySelector('#ming-map-layer > .tmf-map-fallback'))){if(Date.now()>end)throw Error('prepared map layers did not replace the fallback map');await new Promise(r=>setTimeout(r,100));}})()`);
 const alignment=`(()=>{const stage=document.getElementById('ming-map-layer'),rect=stage.getBoundingClientRect();const a=[...stage.querySelectorAll('#tmf-map-labels [data-ax]')].filter(n=>getComputedStyle(n).display!=='none').map(n=>{const q=TMShanheRuntime.projectGame([+n.dataset.ax,+n.dataset.ay]),m=n.getScreenCTM();return {error:Math.hypot(m.e-rect.left-q[0],m.f-rect.top-q[1]),duration:getComputedStyle(n).transitionDuration};});return {count:a.length,max:Math.max(0,...a.map(x=>x.error)),animated:a.some(x=>x.duration!=='0s')};})()`;
 const state=await js(`JSON.parse(JSON.stringify(TMPhase8FormalBridge._state.mapView))`);
 await check('default C1 labels stay on the same terrain frame through real wheel input',async()=>{
  await js(`(()=>{const map=GM.mapData,n=[...document.querySelectorAll('#tmf-map-labels [data-ax]')].find(n=>getComputedStyle(n).display!=='none');if(!n)throw Error('no visible native label');TMPhase8FormalBridge._state._zoomLevelLinkOff=true;TMPhase8FormalBridge._state.mapView={scale:2,tx:map.width/2-Number(n.dataset.ax)*2,ty:map.height/2-Number(n.dataset.ay)*2};TMPhase8FormalBridge.map.renderFormalMap();})()`);
  const pt=await js(`(()=>{const r=document.getElementById('ming-map-layer').getBoundingClientRect();const x=Math.round(r.x+r.width*.55),y=Math.round(r.y+r.height*.55),hit=document.elementFromPoint(x,y);if(!hit?.closest('#ming-map-layer'))throw Error('wheel point obscured by '+(hit?.id||hit?.className));return {x,y};})()`);
  const before=await js('TMShanheRuntime.diagnostics().view.span');
  for(let i=0;i<4;i++){const span=await js('TMShanheRuntime.diagnostics().view.span');win.webContents.sendInputEvent({type:'mouseWheel',...pt,deltaY:i<2?-50:30,deltaX:0,canScroll:true});await js(`(async()=>{const end=Date.now()+5000;while(TMShanheRuntime.diagnostics().view.span===${span}){if(Date.now()>end)throw Error('actual wheel did not reach the camera');await new Promise(r=>requestAnimationFrame(r));}})()`);const a=await js(alignment);assert(a.count>0&&a.max<.5&&!a.animated,JSON.stringify(a));}
  assert.notEqual(await js('TMShanheRuntime.diagnostics().view.span'),before);
 });
 await check('default C1 native pick and selected dossier agree',async()=>{
  const t=await js(`(()=>{document.querySelector('.map-scale[data-map-scale="prefecture"]').click();const map=GM.mapData,r=map.regions.find(r=>/顺天|开封/.test(r.name))||map.regions[0];TMPhase8FormalBridge.map.focusRegion(r.id,false);return {id:r.id,anchor:TMPhase8FormalBridge.map.__labelAnchor(r)};})()`);await wait(200);
  const q=await js(`(()=>{const p=TMShanheRuntime.projectGame([${t.anchor.x},${t.anchor.y}]),b=document.getElementById('ming-map-layer').getBoundingClientRect();return {x:Math.round(b.left+p[0]),y:Math.round(b.top+p[1])};})()`);
  assert.equal(await js(`TMShanheRuntime.pick({clientX:${q.x},clientY:${q.y}})?.dataset.regionId`),t.id);
  await js(`TMPhase8FormalBridge.map.closeMapDossier();document.querySelectorAll('.tmf-region.selected').forEach(n=>n.classList.remove('selected'));void 0`);await wait(100);
  win.webContents.sendInputEvent({type:'mouseMove',...q});win.webContents.sendInputEvent({type:'mouseDown',...q,button:'left',clickCount:1});win.webContents.sendInputEvent({type:'mouseUp',...q,button:'left',clickCount:1});await wait(200);
  const hit=await js(`({id:document.getElementById('ppop')?.dataset.regionId,shown:document.getElementById('ppop')?.classList.contains('show'),selection:TMShanheRuntime.diagnostics().selection})`);assert(hit.shown);assert.equal(hit.id,t.id);assert.equal(hit.selection.selectedId,t.id);
 });
 await check('default C1 restores original map without retaining hidden label transforms',async()=>{
  await js(`TMPhase8FormalBridge.map.closeMapDossier();TMShanheRuntime.setEnabled(false);TMPhase8FormalBridge._state.mapView=${JSON.stringify(state)};document.querySelector('.map-scale[data-map-scale="realm"]').click();TMPhase8FormalBridge.map.renderFormalMap();void 0`);await wait(200);
  assert.equal(await js(`!TMShanheRuntime.active()&&!document.querySelector('.tmf-shanhe-active')&&getComputedStyle(document.querySelector('.ming-map-camera')).visibility!=='hidden'`),true);
 });
};
