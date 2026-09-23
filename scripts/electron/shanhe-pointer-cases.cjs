'use strict';
const assert = require('node:assert/strict');

module.exports = async function ({win, check}) {
  const js = s => win.webContents.executeJavaScript(s, true);
  const settle = () => js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
  // Exercise the player's real fixed-resolution setting, in the gate's isolated profile.
  await js("localStorage.setItem('tm.fitResolution','1920x1080');void 0");
  await new Promise(resolve => {win.webContents.once('did-finish-load', resolve);win.webContents.reload();});
  await js(`(async()=>{
    await TM_Changelog.getUnreadCount();TM_Changelog.markRead();TM_Changelog.close();
    await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure('sc-tianqi7-1627');
    P.ai={key:'',url:'',model:''};P.conf.officeActivationEnabled=false;
    doActualStart('sc-tianqi7-1627');await TM.Features.ensure('formalMapLabels');
    TMPhase8FormalBridge.refresh();await document.fonts.ready;
    for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();
    document.getElementById('map-tools-dock')?.classList.remove('open');
    const end=Date.now()+45000;while(!TMShanheRuntime.active()){if(Date.now()>end)throw Error('2.5D startup timeout');await new Promise(r=>setTimeout(r,50));}
    document.querySelector('.map-scale[data-map-scale="prefecture"]').click();
    TMPhase8FormalBridge._state._zoomLevelLinkOff=true;
  })()`);
  for (const [width, height] of [[1280,800],[1920,1080],[2400,1350],[900,700]]) {
    win.setContentSize(width,height);await settle();
    await js('TM.fixedFit.refit();TMPhase8FormalBridge.map.renderFormalMap();void 0');await settle();
    for (const name of ['荆州府','吉安府']) {
      const target = await js(`(()=>{
        TMPhase8FormalBridge.map.closeMapDossier();
        const map=GM.mapData,r=map.regions.find(r=>r.name===${JSON.stringify(name)}),a=TMPhase8FormalBridge.map.__labelAnchor(r);
        TMPhase8FormalBridge._state.mapView={scale:4,tx:map.width/2-a.x*4,ty:map.height/2-a.y*4};
        TMPhase8FormalBridge.map.renderFormalMap();return {id:r.id,point:[a.x,a.y]};
      })()`);await settle();
      const point = await js(`(()=>{
        const canvas=document.querySelector('.tmf-shanhe-canvas'),b=canvas.getBoundingClientRect(),p=TMShanheRuntime.projectGame(${JSON.stringify(target.point)});
        return {x:Math.round(b.left+p[0]*b.width/parseFloat(canvas.style.width)),y:Math.round(b.top+p[1]*b.height/parseFloat(canvas.style.height)),scale:b.width/parseFloat(canvas.style.width)};
      })()`);
      await check(`${name} pick matches rendered land at ${width}x${height}`, async()=>{
        assert.equal(await js(`TMShanheRuntime.pick({clientX:${point.x},clientY:${point.y}})?.dataset.regionId`),target.id,JSON.stringify(point));
      });
      // A hidden gate dispatches DOM input through the production stage listeners.
      await js(`document.getElementById('ming-map-layer').dispatchEvent(new MouseEvent('mousemove',{clientX:${point.x},clientY:${point.y},bubbles:true}));void 0`);await settle();
      await check(`${name} hover and tooltip follow pointer at ${width}x${height}`,async()=>{
        const hit=await js(`(()=>{const t=document.getElementById('tmf-map-tip'),b=t.getBoundingClientRect();return {shown:t.classList.contains('show'),name:t.querySelector('b')?.textContent,hover:TMShanheRuntime.diagnostics().selection.hoveredId,left:b.left,top:b.top,right:b.right,bottom:b.bottom,width:innerWidth,height:innerHeight};})()`);
        assert(hit.shown,JSON.stringify(hit));assert.equal(hit.name,name);assert.equal(hit.hover,target.id);
        assert(Math.min(Math.abs(hit.left-point.x),Math.abs(hit.right-point.x))<=24,JSON.stringify({point,hit}));
        assert(hit.left>=0&&hit.top>=0&&hit.right<=hit.width+.5&&hit.bottom<=hit.height+.5,JSON.stringify(hit));
      });
      await js(`document.getElementById('ming-map-layer').dispatchEvent(new MouseEvent('click',{clientX:${point.x},clientY:${point.y},bubbles:true}));void 0`);await settle();
      await check(`${name} click opens the same dossier at ${width}x${height}`,async()=>{
        const hit=await js(`({id:document.getElementById('ppop')?.dataset.regionId,shown:document.getElementById('ppop')?.classList.contains('show'),selected:TMShanheRuntime.diagnostics().selection.selectedId})`);
        assert(hit.shown,JSON.stringify(hit));assert.equal(hit.id,target.id);assert.equal(hit.selected,target.id);
      });
      await js('TMPhase8FormalBridge.map.closeMapDossier();void 0');
      const span=await js('TMShanheRuntime.diagnostics().view.span');
      await js(`document.getElementById('ming-map-layer').dispatchEvent(new WheelEvent('wheel',{clientX:${point.x},clientY:${point.y},deltaY:-40,bubbles:true,cancelable:true}));void 0`);
      await js(`(async()=>{const end=Date.now()+4000;while(TMShanheRuntime.diagnostics().view.span===${span}){if(Date.now()>end)throw Error('wheel did not reach map');await new Promise(r=>requestAnimationFrame(r));}})()`);
      await check(`${name} wheel retains the land under the cursor at ${width}x${height}`,async()=>{
        assert.equal(await js(`TMShanheRuntime.pick({clientX:${point.x},clientY:${point.y}})?.dataset.regionId`),target.id);
      });
    }
  }
  await check('invisible canvas cannot return a stale region',async()=>{
    assert.equal(await js(`(()=>{const c=document.querySelector('.tmf-shanhe-canvas');c.style.display='none';const hit=TMShanheRuntime.pick({clientX:400,clientY:300});c.style.display='';return hit?.dataset.regionId||null;})()`),null);
  });
};
