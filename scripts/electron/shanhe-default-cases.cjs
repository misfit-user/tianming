'use strict';
// Independent formal 2.5D test; the strategic-map suite separately protects original SVG fallback.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=async function({win,root,check}){
 const js=s=>win.webContents.executeJavaScript(s,true),sid=process.env.TM_RELIEF_SCENARIO||'sc-tianqi7-1627';
 const item=JSON.parse(fs.readFileSync(path.join(root,'web/bundled-scenarios/manifest.json'),'utf8')).entries.find(e=>e.id===sid);
 assert(item,'official fixture must be registered');const file=path.join(root,item.source),before=crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
 win.show();win.focus();
 await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,650));TM_Changelog.markRead();TM_Changelog.close();await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure(${JSON.stringify(sid)});P.ai={key:'',url:'',model:''};P.conf.officeActivationEnabled=false;doActualStart(${JSON.stringify(sid)});await TM.Features.ensure('formalMapLabels');TMPhase8FormalBridge.refresh();await document.fonts.ready;for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();})()`);
 await require('./shanhe-release-cases.cjs')({win,check});
 await check('C1 test uses the current official source and does not mutate it',async()=>{
  const d=await js('({sid:GM.sid,regions:GM.mapData.regions.length})');assert.equal(d.sid,sid);assert.equal(d.regions,item.counts.regions);assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before);
 });
};
