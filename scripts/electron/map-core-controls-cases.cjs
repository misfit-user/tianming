'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=async function({win,root,check}){
 const js=s=>win.webContents.executeJavaScript(s,true);
 const sid=process.env.TM_RELIEF_SCENARIO||'sc-tianqi7-1627';
 const entries=JSON.parse(fs.readFileSync(path.join(root,'web/bundled-scenarios/manifest.json'),'utf8')).entries.filter(e=>e.id===sid);
 assert.equal(entries.length,1,'registered official scenario required');
 const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
 const before=entries.map(e=>hash(e.source));
 await js(`(async()=>{await TM_Changelog.getUnreadCount();TM_Changelog.markRead();TM_Changelog.close();await TMOfficialScenarioLoader.ready();})()`);
 for(const entry of entries){
  await js(`(async()=>{
   await TMOfficialScenarioLoader.ensure(${JSON.stringify(entry.id)});
   P.ai={key:'',url:'',model:''};P.conf.officeActivationEnabled=false;
   doActualStart(${JSON.stringify(entry.id)});await TM.Features.ensure('formalMapLabels');TMPhase8FormalBridge.refresh();
   const end=Date.now()+45000;
   while(GM.sid!==${JSON.stringify(entry.id)}||!document.querySelector('#tmf-formal-map')){if(Date.now()>end)throw Error('official map not ready');await new Promise(r=>setTimeout(r,50));}
   for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();
  })()`);
  await check(entry.id+' displays all five core map controls',async()=>{
   const row=await js(`(()=>{const strip=document.querySelector('.map-scale-strip');return [...strip.querySelectorAll('button')].map(b=>({text:b.textContent,visible:getComputedStyle(b).display!=='none'&&b.getClientRects().length>0,disabled:b.disabled}));})()`);
   assert.deepEqual(row.map(b=>b.text),['天下','省道','府州','缩放联动','全图']);assert(row.every(b=>b.visible&&!b.disabled),JSON.stringify(row));
  });
  await check(entry.id+' layer lock works through actual toolbar clicks',async()=>{
   const row=await js(`(()=>{
    document.querySelector('[data-map-scale="prefecture"].map-scale').click();
    document.querySelector('[data-map-tier-lock]').click();
    TMPhase8FormalBridge._state.mapView={scale:.8,tx:0,ty:0};TMPhase8FormalBridge.map.renderFormalMap();
    const b=document.querySelector('[data-map-tier-lock]');return {layer:TMPhase8FormalBridge._state.mapScale,locked:TMPhase8FormalBridge._state._zoomLevelLinkOff,text:b.textContent,pressed:b.getAttribute('aria-pressed')};
   })()`);
   assert.deepEqual(row,{layer:'prefecture',locked:true,text:'层级已锁',pressed:'true'});
  });
  await check(entry.id+' full map retains the selected layer',async()=>{
   const row=await js(`(()=>{document.querySelector('[data-map-fit-all]').click();const s=TMPhase8FormalBridge._state;return {layer:s.mapScale,locked:s._zoomLevelLinkOff,view:s.mapView};})()`);
   assert.equal(row.layer,'prefecture');assert.equal(row.locked,true);assert.deepEqual(row.view,{scale:1,tx:0,ty:0});
  });
  await check(entry.id+' unlock restores zoom-linked layers',async()=>{
   const row=await js(`(()=>{document.querySelector('[data-map-tier-lock]').click();const s=TMPhase8FormalBridge._state;return {layer:s.mapScale,locked:s._zoomLevelLinkOff,text:document.querySelector('[data-map-tier-lock]').textContent};})()`);
   assert.deepEqual(row,{layer:'realm',locked:false,text:'缩放联动'});
  });
 }
 await check('core controls require no edits to official scenario data',()=>assert.deepEqual(entries.map(e=>hash(e.source)),before));
};
