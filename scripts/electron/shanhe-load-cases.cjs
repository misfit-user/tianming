'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
module.exports = async function ({win, root, check}) {
  const js = s => win.webContents.executeJavaScript(s, true);
  const sid = process.env.TM_RELIEF_SCENARIO || 'sc-tang840-840';
  const entry = JSON.parse(fs.readFileSync(path.join(root, 'web/bundled-scenarios/manifest.json'), 'utf8')).entries.find(e => e.id === sid);
  assert(entry, 'official scenario required');
  const hash = () => crypto.createHash('sha256').update(fs.readFileSync(path.join(root, entry.source))).digest('hex');
  const before = hash();
  const active = () => js(`(async()=>{const end=Date.now()+60000;while(!TMShanheRuntime.active()&&Date.now()<end)await new Promise(r=>setTimeout(r,50));const d=TMShanheRuntime.diagnostics();return {active:d.active,loading:d.loading,errors:d.errors,regions:d.regions,canvas:!!document.querySelector('.tmf-shanhe-canvas'),button:document.getElementById('tm-shanhe-toggle')?.textContent};})()`);
  await js(`(async()=>{
    await TM_Changelog.getUnreadCount();TM_Changelog.markRead();TM_Changelog.close();
    await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure(${JSON.stringify(sid)});
    const original=TM.Features.ensureRecoverable.bind(TM.Features);
    const held=new Promise(resolve=>window.__releaseMapLabels=resolve);
    TM.Features.ensureRecoverable=(name,options)=>name==='formalMapLabels'?held.then(()=>original(name,options)):original(name,options);
    P.ai={key:'',url:'',model:''};P.conf.officeActivationEnabled=false;
    doActualStart(${JSON.stringify(sid)});TMPhase8FormalBridge.refresh();
  })()`);
  // 不上兜底地图（owner 09-24 定）：地名模块未到时只显示「舆图准备中」，山河境随三层地图一起上屏
  await check(sid+' map shows only the preparing notice while optional label geometry is still pending', async()=>{
    const d=await js(`(async()=>{const end=Date.now()+60000;const notice=()=>/舆图准备中/.test(document.querySelector('#ming-map-layer .tmf-map-loading')?.textContent||'');while(!notice()&&Date.now()<end)await new Promise(r=>setTimeout(r,50));await new Promise(r=>setTimeout(r,1500));const stage=document.getElementById('ming-map-layer');return {labels:typeof TMMapRealmLayout,notice:notice(),map:!!stage?.querySelector('#tmf-formal-map'),terrain:TMShanheRuntime.active()};})()`);
    assert.deepEqual(d,{labels:'undefined',notice:true,map:false,terrain:false});
  });
  await check('late label preparation replaces the fallback surface without losing terrain', async()=>{
    await js(`(()=>{const map=TMPhase8FormalBridge.map,ready=map.onMapLabelFeatureReady;map.onMapLabelFeatureReady=function(){const prepare=TMMapRealmLayout.prepare;TMMapRealmLayout.prepare=function(jobs,meshes,progress){window.__terrainPrepareJobs=jobs.length;return prepare(jobs,meshes,value=>{window.__terrainPrepareProgress=value;if(progress)progress(value);});};return ready();};__releaseMapLabels();})()`);
    const d=await js(`(async()=>{const end=Date.now()+120000;let logAt=0;while(Date.now()<end){const p=TMPhase8FormalBridge.map.preparationStatus();if(Date.now()>logAt){logAt=Date.now()+10000;console.log("STRATEGIC_SHANHE_PREP "+JSON.stringify({p,progress:window.__terrainPrepareProgress,jobs:window.__terrainPrepareJobs}));}if(p?.ready&&p.layers===3&&TMShanheRuntime.active())return {active:true,layers:p.layers};await new Promise(r=>setTimeout(r,50));}return {active:TMShanheRuntime.active(),preparation:TMPhase8FormalBridge.map.preparationStatus()};})()`);
    assert.deepEqual(d,{active:true,layers:3});
    assert.equal((await active()).regions,entry.counts.regions);
  });
  await check('real WebGL loss shows fallback and recovery returns one active terrain canvas',async()=>{
    await js(`(()=>{window.__terrainCanvas=document.querySelector('.tmf-shanhe-canvas');window.__loseTerrain=__terrainCanvas.getContext('webgl2').getExtension('WEBGL_lose_context');if(!__loseTerrain)throw Error('WEBGL_lose_context unavailable');__loseTerrain.loseContext();})()`);
    const d=await js(`(async()=>{const end=Date.now()+3000;while(TMShanheRuntime.active()&&Date.now()<end)await new Promise(r=>setTimeout(r,25));return {active:TMShanheRuntime.active(),visible:getComputedStyle(document.querySelector('.ming-map-camera')).visibility,button:document.getElementById('tm-shanhe-toggle').textContent};})()`);
    assert.equal(d.active,false);assert.notEqual(d.visible,'hidden');assert.match(d.button,/恢复/);
    await js('__loseTerrain.restoreContext();void 0');assert((await active()).active);
    assert.equal(await js("document.querySelectorAll('.tmf-shanhe-canvas').length===1 && TMShanheRuntime.diagnostics().mode==='webgl2-heightfield'"),true);
  });
  await check('a context that never restores is rebuilt automatically',async()=>{
    await js("__terrainCanvas=document.querySelector('.tmf-shanhe-canvas');__loseTerrain=__terrainCanvas.getContext('webgl2').getExtension('WEBGL_lose_context');__loseTerrain.loseContext();void 0");
    const d=await js(`(async()=>{const end=Date.now()+60000;while(Date.now()<end){if(TMShanheRuntime.active()&&document.querySelector('.tmf-shanhe-canvas')!==__terrainCanvas)return true;await new Promise(r=>setTimeout(r,50));}return TMShanheRuntime.diagnostics();})()`);
    assert.equal(d,true,JSON.stringify(d));
  });
  await check('manual original-map selection stays off; re-enabling restores terrain',async()=>{
    await js('TMShanheRuntime.setEnabled(false);TMPhase8FormalBridge.map.renderFormalMap();void 0');
    assert.equal(await js('TMShanheRuntime.active()'),false);
    assert.equal(await js("document.getElementById('tm-shanhe-toggle').textContent"),'底图：原版');
    await js('TMShanheRuntime.setEnabled(true);void 0');assert((await active()).active);
  });
  await check('official map source remains unchanged',()=>assert.equal(hash(),before));
};
