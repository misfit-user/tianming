'use strict';
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
module.exports = async function ({ win, check, results }) {
  const dir = path.dirname(process.env.TM_BRIDGE_TEST_REPORT), traffic = [];
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (details, callback) => { traffic.push(details.url); callback({ cancel: true }); });
  const js = async code => {
    let r;
    try { r = await win.webContents.executeJavaScript(`(async()=>{try{return{ok:true,value:await(${code})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`, true); }
    catch (e) { throw Error('executeJavaScript rejected: ' + String(e && (e.stack || e)) + '\\ncode=' + String(code).slice(0, 500)); }
    if (!r.ok) throw Error(r.error); return r.value;
  };
  const settle = () => js(`new Promise(r=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(r)),120))`);
  const panel = '#tm-action-letter-overlay [data-npc-daily-panel="formal"]';
  async function click(selector) {
    const g = await js(`(()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)return{missing:true};b.scrollIntoView({block:'center'});const r=b.getBoundingClientRect(),h=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return{hit:h===b||b.contains(h),width:r.width,height:r.height,top:h&&h.outerHTML&&h.outerHTML.slice(0,400)}})()`);
    if (!g.hit) await screenshot('click-obstruction');
    assert(g.hit && g.width > 0 && g.height > 0, JSON.stringify({ selector, g }));
    await js(`document.querySelector(${JSON.stringify(selector)}).click()`); await settle();
  }
  async function screenshot(name) { fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG()); }
  await check('travel modules and strict route are in the production page', async () => {
    assert.equal(await js(`!!(TM.NPC.Meetings&&TM.MapRouteDays&&TM.SimTime&&TM.NPC.DailyUI)`), true);
  });
  await js(`(async()=>{
    if (window.TM_Changelog) { await TM_Changelog.getUnreadCount(); await new Promise(r=>setTimeout(r,650)); TM_Changelog.markRead(); TM_Changelog.close(); }
    window.__travelBrowser={apiAttempts:[],errors:[]};
    for(const name of ['callAI','callAIMessages','callAIWithTools','callAISmart','callAIStream','callAIStreamMessages'])if(typeof window[name]==='function')window[name]=function(){__travelBrowser.apiAttempts.push(name);throw Error('travel-browser-model-attempt:'+name)};
    addEventListener('error',e=>__travelBrowser.errors.push(e.message));
    const common={alive:true,age:35,health:90,publicIdentity:true,officialTitle:'',faction:'',factionId:'',isRuler:false,intelligence:65,administration:60,loyalty:80,ambition:20};
    const people=[Object.assign({},common,{id:'travel-a',name:'沈行之',location:'东城',localGoals:[{id:'meeting-goal',kind:'meeting',targetId:'travel-player',meeting:{locationId:'west',purpose:'探望故友',windowDays:10,returnMode:'return'}}]}),Object.assign({},common,{id:'travel-player',name:'来客',location:'西城',isPlayer:true})];
    P.ai={key:'',url:'',model:''};P.time={year:1627,startMonth:9,startDay:1,daysPerTurn:1};P.playerInfo={characterId:'travel-player',characterName:'来客',factionId:'',factionName:''};
    GM=Object.assign({},GM,{sid:'local-travel-browser',_campaignId:'local-travel-browser',_timelineId:'local-travel-browser',turn:1,running:true,busy:false,_endTurnBusy:false,chars:people,facs:[],armies:[],officeTree:[],playerInfo:P.playerInfo,letters:[],memorials:[],evtLog:[],_npcPlans:[],_npcActionLedger:[],_npcExecutionResults:[],_npcDecisionDiagnostics:[],_turnContext:{npcActionsThisTurn:[],},affinityMap:{},mapData:{locationBindingContract:{schema:'source-text-location-v2'},regions:[{id:'east',name:'东城',geographicCenter:[116,40],neighbors:['west']},{id:'west',name:'西城',geographicCenter:[117,40],neighbors:['east']}]}});
    delete GM._npcActionState;delete GM._tmTime;buildIndices&&buildIndices();document.body.classList.add('tm-phase8-formal');if(document.getElementById('L'))document.getElementById('L').style.display='none';if(document.getElementById('G'))document.getElementById('G').style.display='block';
    GameHooks.run('enterGame:after');await new Promise(r=>setTimeout(r,180));openCharRenwuPage('沈行之');
  })()`); await settle();
  if (await js(`!!document.querySelector('#tm-firstturn-guide button')`)) await click('#tm-firstturn-guide button:last-child');
  if (await js(`!!document.querySelector('#tm-nokey-banner button')`)) await click('#tm-nokey-banner button:last-child');
  assert.equal(await js(`TM.MapRouteDays.planRoute(GM.mapData,'east','west',{mode:'walking'}).status`), 'reachable');
  await check('NPC invitation is real and remains in transit before date advances', async () => {
    const v = await js(`(()=>{const p=TM.NPC.DailyActivities.plans().find(p=>p.localActivity.kind==='meeting');return{status:p&&p.status,kind:p&&p.localActivity.kind,travel:p&&p.localActivity.meeting,statuses:p&&p.messages.map(m=>m.status),day:TM.SimTime.now(GM)}})()`);
    assert.equal(v.kind, 'meeting', JSON.stringify(v)); assert.equal(v.status, 'in_transit', JSON.stringify(v)); assert(v.statuses.includes('in_transit'), JSON.stringify(v)); assert(v.day === 0); assert.deepEqual(await js(`__travelBrowser.apiAttempts`), []);
  });
  // Use the same production folio route as the existing formal NPC daily flow.
  // Calling the internal drafts bucket directly can race its late-bound sibling
  // during a fresh production page load; the folio action is the supported UI.
  await click('#tm-zhi-folio [data-zhi-action="letter"]');
  await settle();
  const panelInfo = await js(`(()=>{const p=document.querySelector(${JSON.stringify(panel)});return{exists:!!p,details:p&&p.querySelectorAll('details').length||0}})()`);
  if (panelInfo.exists && panelInfo.details) await js(`document.querySelector(${JSON.stringify(panel+' details')}).open=true`);
  await settle();
  await js(`TM.NPC.Meetings.advanceLocalDays(5)`); await js(`TM.NPC.DailyUI.render()`); await settle();
  await check('player receives the invitation only after the route delivery boundary', async () => {
    const v = await js(`(()=>{const p=TM.NPC.DailyActivities.plans().find(p=>p.localActivity.kind==='meeting');return{status:p.status,day:TM.SimTime.now(GM),stage:TM.NPC.DailyActivities.view(p,GM.chars.find(c=>c.id==='travel-player')).stage}})()`);
    assert.equal(v.status, 'awaiting_response', JSON.stringify(v)); assert(v.day >= 5); assert.equal(v.stage, 'delivered');
  });
  await click(panel + ' [data-daily-answer="accept"]');
  await check('player acceptance starts a real journey without moving location immediately', async () => {
    const v = await js(`(()=>{const p=TM.NPC.DailyActivities.plans().find(p=>p.localActivity.kind==='meeting');const a=GM.chars.find(c=>c.id==='travel-a');return{status:p.status,travelTo:a._travelTo,location:a.location,route:p.localActivity.meeting.actorJourney&&p.localActivity.meeting.actorJourney.route}})()`);
    assert.equal(v.status, 'traveling', JSON.stringify(v)); assert.equal(v.location, '东城'); assert.equal(v.travelTo, '西城'); assert(v.route && v.route.km > 0); await screenshot('01-meeting-in-transit');
  });
  await js(`TM.NPC.Meetings.advanceLocalDays(5)`); await js(`TM.NPC.DailyUI.render()`); await settle();
  const participated = await js(`(()=>{const p=TM.NPC.DailyActivities.plans().find(p=>p.localActivity.kind==='meeting');return{status:p.status,meeting:p.localActivity.meeting,location:GM.chars.map(c=>({id:c.id,location:c.location,travel:c._travelTo||''})),api:__travelBrowser.apiAttempts}})()`);
  assert.equal(participated.meeting.status, 'returning', JSON.stringify(participated)); assert(participated.meeting.participation); await screenshot('02-meeting-participated');
  await js(`TM.NPC.Meetings.advanceLocalDays(5)`); await js(`TM.NPC.DailyUI.render()`); await settle();
  const done = await js(`(()=>{const p=TM.NPC.DailyActivities.plans().find(p=>p.localActivity.kind==='meeting');return{status:p.status,meeting:p.localActivity.meeting,locations:GM.chars.map(c=>({id:c.id,location:c.location,travel:c._travelTo||''})),day:TM.SimTime.now(GM),api:__travelBrowser.apiAttempts}})()`);
  await check('meeting returns and save/load does not replay the participation', async () => {
    assert.equal(done.status, 'done', JSON.stringify(done)); assert.equal(done.meeting.status, 'returned'); assert.equal(done.locations.find(c=>c.id==='travel-a').location, '东城'); assert.equal(done.meeting.participation.participants.length, 2); assert.deepEqual(done.api, []);
    const before=await js(`JSON.stringify({plans:GM._npcPlans,chars:GM.chars.map(c=>({id:c.id,location:c.location,travel:c._travelTo||''})),day:TM.SimTime.now(GM)})`);
    const saved=await js(`(async()=>{const s=await tianming.saveProject('约见旅行验收',_buildSaveState({format:'project',detach:true}));if(!s.success)throw Error(s.error);const l=await tianming.listSaves(),row=l.files.find(x=>x.storageKey===s.storageKey),loaded=await tianming.loadProject(row);if(!loaded.success)throw Error(loaded.error);await fullLoadGame(loaded.data,{source:'travel-browser',preserveTimeline:true});return true})()`);assert.equal(saved,true);assert.equal(await js(`JSON.stringify({plans:GM._npcPlans,chars:GM.chars.map(c=>({id:c.id,location:c.location,travel:c._travelTo||''})),day:TM.SimTime.now(GM)})`),before);
  });
  const evidence=await js(`({apiAttempts:__travelBrowser.apiAttempts,errors:__travelBrowser.errors,day:TM.SimTime.now(GM),plans:TM.NPC.DailyActivities.plans().map(p=>({id:p.id,status:p.status,kind:p.localActivity.kind,meeting:p.localActivity.meeting&&p.localActivity.meeting.status}))})`);
  assert.deepEqual(evidence.apiAttempts, []); assert.deepEqual(evidence.errors, []); assert.deepEqual(traffic, []);
  fs.writeFileSync(path.join(dir,'travel-browser-evidence.json'),JSON.stringify({evidence,externalTraffic:traffic,networkPolicy:'all HTTP/HTTPS/WS/WSS requests denied',inputMethod:'real Electron Chromium controls plus production local travel boundary'},null,2));
  results.push({name:'zero-model-meeting-travel-and-return',status:'PASS',value:{modelAttempts:evidence.apiAttempts.length,blockedExternalRequests:traffic.length,day:evidence.day}});
};
