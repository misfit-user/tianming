'use strict';
// Real official startup and formal controls. No player saves or external models are used.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path');
const { installCompositeWaits, installCompositeEconomyObservers, reconcileCompositeEconomy, waitForCompositeBackground } = require('./npc-composite-waits.cjs');
const { installCompositeAllocationStages } = require('./npc-composite-diagnostics.cjs');
module.exports = async function ({ win, root, check, results, deadlineAt }) {
  assert(Number.isFinite(deadlineAt), 'the original Electron suite deadline must be supplied');
  const dir = path.dirname(process.env.TM_BRIDGE_TEST_REPORT), timeline = [], traffic = [];
  const identity={head:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),platform:process.platform,versions:process.versions,runtime:{}};
  for(const f of ['tm-npc-travel.js','tm-npc-local-ai.js','tm-npc-daily-activities.js','tm-npc-daily-ui.js','tm-npc-action-ledger.js','tm-office-tenure.js','tm-sim-time.js','tm-endturn-core.js'])identity.runtime[f]=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,'web',f))).digest('hex');
  identity.native={};for(const f of ['main-impl.js','preload-impl.js'])identity.native[f]=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
  identity.diagnostics={preciseMemory:process.env.TM_BRIDGE_MEMORY_DIAGNOSTICS==='1',heapSampling:process.env.TM_BRIDGE_HEAP_SAMPLING==='1',protocolForcesGC:process.env.TM_BRIDGE_HEAP_SAMPLING==='1',cpuProfile:process.env.TM_BRIDGE_CPU_PROFILE==='1'};
  identity.harness={};for(const f of ['scripts/electron/npc-composite-cases.cjs','scripts/electron/npc-composite-model-fixture.cjs','web/tm-start-runtime-manifest.json'])identity.harness[f]=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,f))).digest('hex');
  const waitHelperPath='scripts/electron/npc-composite-waits.cjs';identity.harness[waitHelperPath]=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,waitHelperPath))).digest('hex');
  const diagnosticHelperPath='scripts/electron/npc-composite-diagnostics.cjs';identity.harness[diagnosticHelperPath]=require('crypto').createHash('sha256').update(fs.readFileSync(path.join(root,diagnosticHelperPath))).digest('hex');
  win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']}, (details, callback) => {
    const url = new URL(details.url); traffic.push({host:url.host,path:url.pathname}); callback({cancel:true});
  });
  const js = async code => { fs.appendFileSync(path.join(dir,'progress.log'),new Date().toISOString()+' '+code.slice(0,160)+'\n'); const r = await win.webContents.executeJavaScript(`(async()=>{try{return{ok:true,value:await(${code}),heap:${process.env.TM_BRIDGE_MEMORY_DIAGNOSTICS==='1' ? '(performance.memory ? {limit:performance.memory.jsHeapSizeLimit,used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize}:null)' : 'null'}};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`, true); if (r.heap) fs.appendFileSync(path.join(dir,'renderer-heap.jsonl'),JSON.stringify({at:new Date().toISOString(),operation:code.slice(0,100),heap:r.heap})+'\n'); if (!r.ok) throw Error(r.error); return r.value; };
  const settle = () => js(`new Promise(r=>setTimeout(r,80))`);
  const panel = '#tm-action-letter-overlay [data-npc-daily-panel="formal"]';
  async function screenshot(name) { fs.writeFileSync(path.join(dir, name + '.png'), (await win.webContents.capturePage()).toPNG()); }
  async function wait(code, label, timeout=15000) {
    return js(`new Promise((resolve,reject)=>{const end=Date.now()+${timeout};(function poll(){let result=(${code});if(result)return resolve(true);if(Date.now()>end)return reject(Error(${JSON.stringify(label)}));setTimeout(poll,40);})()})`);
  }
  async function click(selector) {
    try{await wait(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return false;e.scrollIntoView({block:'center',inline:'nearest'});const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&r.height>0&&!!top&&(top===e||e.contains(top));})()`, 'control did not become clickable: '+selector, 10000);}catch(e){await screenshot('blocked-control');fs.writeFileSync(path.join(dir,'blocked-control.json'),JSON.stringify(await js(`({selector:${JSON.stringify(selector)},body:document.body.innerText.slice(-16000),target:document.querySelector(${JSON.stringify(selector)})?.outerHTML})`),null,2));throw e;}
    const p = await js(`(async()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return{missing:true};e.scrollIntoView({block:'center',inline:'nearest'});await new Promise(r=>setTimeout(r,40));const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,top=document.elementFromPoint(x,y);return{x:Math.round(x),y:Math.round(y),hit:!!top&&(top===e||e.contains(top)),width:r.width,height:r.height,display:getComputedStyle(e).display,top:top&&top.outerHTML.slice(0,800)};})()`);
    if (!p.hit || !p.width || !p.height) { await screenshot('blocked-control'); throw Error(JSON.stringify({selector,geometry:p})); }
    win.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,x:p.x,y:p.y});
    win.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,x:p.x,y:p.y}); await settle();
  }
  async function record(stage) {
    const state=await js(`(()=>({day:TM.SimTime.now(GM),turn:GM.turn,player:GM.playerCharacterId,load:window._tmLoadGen,people:GM.chars.length,plans:(GM._npcPlans||[]).filter(p=>p.localActivity).map(p=>({id:p.id,kind:p.localActivity.kind,status:p.status,next:p.nextActorId,messages:p.messages,steps:p.steps,meeting:p.localActivity.meeting||null})),money:GM.guoku&&GM.guoku.money}))()`);
    state.producerWaits=await js(`window.__compositeWaits?window.__compositeWaits.snapshot():[]`);
    if(stage==='completed-evidence')assert(state.producerWaits.every(row=>row.status==='completed'&&row.invocations===1),'all actual UI producers must finish once without late duplicate calls');
    const planning=await js(`(()=>{const s=GM._npcActionState&&GM._npcActionState.planning;if(!s)return null;return {requests:(s.pending||[]).map(q=>({id:q.id,actorId:q.actorId,kind:q.kind,sourceKey:q.sourceKey,planId:q.planId||'',messageId:q.messageId||'',revision:q.revision,termsVersion:q.termsVersion,sourceVersion:q.sourceVersion,goalFingerprint:q.goalFingerprint,knownDay:q.knownDay,createdDay:q.createdDay,status:q.status,attempts:q.attempts,lastError:q.lastError,directionId:q.directionId||'',expiresDay:q.expiresDay,knownSource:s.actors&&s.actors[q.actorId]&&s.actors[q.actorId].knownMessages&&s.actors[q.actorId].knownMessages[q.sourceKey]||null})),directions:Object.values(s.directions||{}).map(d=>({id:d.id,actorId:d.actorId,sourceKey:d.sourceKey,sourceKind:d.sourceKind,status:d.status,createdDay:d.createdDay,reviewDay:d.reviewDay,steps:(d.steps||[]).map(s=>({id:s.id,goalId:s.goalId,goalSource:s.goalSource,kind:s.kind,status:s.status,dependsOn:s.dependsOn,targetId:s.targetId,activityId:s.activityId||'',lastOutcome:s.lastOutcome,lastReason:s.lastReason}))}))};})()`);
    const calls=await js(`(()=>{if(!window.__compositeCalls)return null;return Object.assign({},__compositeCalls,{planningStats:GM._npcActionState&&GM._npcActionState.planning?{logicalRequests:GM._npcActionState.planning.logicalRequests,compatibilityRequests:GM._npcActionState.planning.compatibilityRequests,modelAttempts:GM._npcActionState.planning.modelAttempts}:null});})()`);if(stage==='completed-evidence')calls.economyReconciliation=reconcileCompositeEconomy(state.producerWaits,calls);timeline.push({stage,...state,planning}); fs.writeFileSync(path.join(dir,'composite-timeline.json'),JSON.stringify({identity,timeline,traffic,calls},null,2)); return state;
  }
  async function closeLetters() { if(await js(`!!document.querySelector('#tm-action-letter-overlay button[data-close-bridge]')`))await click('#tm-action-letter-overlay button[data-close-bridge]'); }
  async function dismissNotice() {
    for(let i=0;i<30;i++){
      const notice=await js(`(()=>{const b=Array.from(document.querySelectorAll('button')).find(b=>{const label=b.textContent.trim(),host=b.closest('.generic-modal-overlay'),history=host&&host.querySelector('.generic-modal-header h3')?.textContent.trim()==='历史事件';const cancelHistory=history&&(label==='取消'||(label==='✕'&&b.closest('.generic-modal-header')&&b.getAttribute('onclick')==='closeGenericModal()'))&&Array.from(host.querySelectorAll('[onclick]')).some(e=>String(e.getAttribute('onclick')).startsWith('applyEventBranch('));const readTurn=b.matches('#turn-modal.show button[aria-label="关闭回合结果"]');if(label!=='关闭提示'&&!(label==='确认'&&history&&host.textContent.includes('此事件无可选分支'))&&!cancelHistory&&!readTurn&&!b.matches('#tm-recovery-progress [data-recovery-collapse=\"true\"]'))return false;const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&!!hit&&(hit===b||b.contains(hit));});if(!b)return null;let e=b,parts=[];while(e&&e!==document.body){parts.unshift(e.tagName.toLowerCase()+':nth-of-type('+(Array.from(e.parentElement.children).filter(c=>c.tagName===e.tagName).indexOf(e)+1)+')');e=e.parentElement;}return{selector:'body > '+parts.join(' > '),collapseReview:b.matches('#tm-recovery-progress [data-recovery-collapse=\"true\"]'),deferredHistory:['取消','✕'].includes(b.textContent.trim()),text:(b.closest('.generic-modal-overlay')||b.closest('#turn-modal')||b.parentElement).textContent};})()`);
      if(!notice)return;
      const before=notice.deferredHistory?await js(`JSON.stringify({events:GM.triggeredHistoryEvents||{},choices:(GM.biannianItems||[]).filter(x=>x.type==='history_event')})`):null;
      const reviewBefore=notice.collapseReview?await js(`({active:TM.RecoveryReview.status(),cancels:__compositeCalls.reviewCancels.length})`):null;
      timeline.push({stage:notice.deferredHistory?'history-choice-not-submitted':notice.collapseReview?'review-progress-collapsed':'ordinary-notice',...notice,reviewBefore});await click(notice.selector);
      if(notice.collapseReview)assert.equal(await js(`__compositeCalls.reviewCancels.length`),reviewBefore.cancels,'collapsing progress must not cancel the actual background review');
      if(notice.deferredHistory)assert.equal(await js(`JSON.stringify({events:GM.triggeredHistoryEvents||{},choices:(GM.biannianItems||[]).filter(x=>x.type==='history_event')})`),before,'normal Cancel must not choose a historical branch or apply its outcome');
    }
    throw Error('too many ordinary notices');
  }
  async function openLetters() { await dismissNotice(); await click('#zhao-btn-3'); await wait(`!!document.querySelector(${JSON.stringify(panel)})`,'formal daily panel missing'); if(!await js(`document.querySelector(${JSON.stringify(panel+' > details')}).open`))await click(panel+' > details > summary'); }
  async function select(selector,value) { await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing select');e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('change',{bubbles:true}));})()`); await settle(); }
  async function formalTurn() {
    await closeLetters(); await dismissNotice();
    const before=await js(`({turn:GM.turn,day:TM.SimTime.now(GM)})`);
    const ticket=await js(`__compositeWaits.arm('turn')`);
    if(process.env.TM_BRIDGE_CPU_PROFILE==='1'&&!win.__compositeProfiled){
      win.__compositeProfiled=true;win.webContents.debugger.attach('1.3');await win.webContents.debugger.sendCommand('Profiler.enable');await win.webContents.debugger.sendCommand('Profiler.start');
      setTimeout(async()=>{try{const p=await win.webContents.debugger.sendCommand('Profiler.stop');fs.writeFileSync(path.join(dir,'first-turn.cpuprofile'),JSON.stringify(p.profile));win.webContents.debugger.detach();}catch(e){fs.writeFileSync(path.join(dir,'profile-error.txt'),String(e));}},30000);
    }
    await click('#endturn .et-big');
    await wait(`document.querySelector('#cet-ok')`,'formal endTurn confirmation missing'); await click('#cet-ok');
    await wait(`!!document.querySelector('#post-turn-court-prompt button[onclick="_postTurnCourtChoose(false)"]')`,'formal court choice missing');
    await click('#post-turn-court-prompt button[onclick="_postTurnCourtChoose(false)"]');
    const completed=await js(`__compositeWaits.wait(${ticket})`);
    const state=await js(`({busy:!!(GM.busy||GM._endTurnBusy),pending:!!GM._endTurnCommitPending,turn:GM.turn,day:TM.SimTime.now(GM)})`);
    assert.equal(completed.status,'completed');assert.equal(completed.invocations,1);assert(completed.commit,'actual top-level commit witness missing');
    assert.equal(state.busy,false);assert.equal(state.pending,false);assert(state.turn>before.turn,'top-level producer returned without advancing the committed turn');
    timeline.push({stage:'top-level-producer-complete',completed});
    // The formal page is usable after the top-level transaction commits.
    // Required activity states are asserted below; the real save entry itself
    // waits for required background jobs, exactly as it does for the player.
    // The result sheet has its own normal close control; record it on the first run.
    const sheets=await js(`Array.from(document.querySelectorAll('button')).filter(b=>/关闭|继续|返回|收起/.test(b.textContent)&&b.getBoundingClientRect().width).map(b=>({text:b.textContent,html:b.outerHTML.slice(0,500)}))`);
    fs.writeFileSync(path.join(dir,'turn-result-controls.json'),JSON.stringify(sheets,null,2));
    await dismissNotice();
    if(await js(`(()=>{const b=document.querySelector('#turn-modal button[onclick*="closeTurnResult"]');if(!b)return false;const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return r.width>0&&!!hit&&(hit===b||b.contains(hit));})()`))await click('#turn-modal button[onclick*="closeTurnResult"]');
    await record('formal-turn');
  }
  async function saveAndReload(slot,name,expected) {
    await record('before-save-'+name);await js(`void(window.__compositeOldButton=document.querySelector(${JSON.stringify(card+' [data-daily-cancel]')}))`); assert.equal(await js(`!!window.__compositeOldButton`),true,'the unfinished meeting must expose a real old cancel control for the stale-world test'); await closeLetters();
    await click('#tm-pause-fab'); await click('#pause-bg button[onclick="closePause();openSaveManager()"]');
    await wait(`!!document.querySelector('#save-manager-overlay button[onclick="saveToSlot(${slot})"]')`,'save slot control missing');
    const saveTicket=await js(`__compositeWaits.arm('save',${slot})`);
    await click('#save-manager-overlay button[onclick="saveToSlot('+slot+')"]');
    await js(`(()=>{const e=document.querySelector('body > div:last-child input');if(!e)throw Error('save naming prompt missing');e.value=${JSON.stringify(name)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
    await click('body > div:last-child button.bt.bp');
    const saved=await js(`__compositeWaits.wait(${saveTicket})`);assert.equal(saved.result,true,'formal save must return a true commit receipt');assert.equal(saved.slot,slot);assert.equal(saved.invocations,1);
    timeline.push({stage:'slot-producer-complete',operation:'save',completed:saved});
    await wait(`!!document.querySelector('#save-manager-overlay button[onclick="loadSaveSlot(${slot})"]')`,'committed saved slot did not render');
    const before=await js(`(()=>{window.__compositeOldWorld=GM;return{load:window._tmLoadGen||0,day:TM.SimTime.now(GM),player:GM.playerCharacterId,plans:JSON.stringify((GM._npcPlans||[]).filter(p=>p.localActivity&&p.localActivity.kind==='meeting')),locations:GM.chars.filter(c=>['char_jianyan1_01','char_jianyan1_16'].includes(c.id)).map(c=>({id:c.id,controlled:TM.NPC.DailyActivities.controlled(c),region:TM.NPC.DailyActivities.exactLocation(c,GM),travel:c._localTravelRef||null,life:JSON.stringify(c._lifeExp||[]),learning:JSON.stringify(c._growth||null),memory:JSON.stringify(c._memory||[]),archive:JSON.stringify(c._memArchive||[])})),activityBytes:JSON.stringify(GM._npcPlans||[]).length};})()`);
    const loadTicket=await js(`__compositeWaits.arm('load',${slot})`);
    await click('#save-manager-overlay button[onclick="loadSaveSlot('+slot+')"]');await click('.rice-paper-confirm #_rpc_ok');
    const loaded=await js(`__compositeWaits.wait(${loadTicket})`);assert.equal(loaded.result,true,'formal load must return a true success receipt');assert.equal(loaded.slot,slot);assert.equal(loaded.invocations,1);
    timeline.push({stage:'slot-producer-complete',operation:'load',completed:loaded});
    await wait(`GM!==window.__compositeOldWorld&&GM.running&&!document.querySelector('#save-manager-overlay')`,'formal slot reload did not replace world',45000);
    await js(`_tmAwaitLoadBarrier()`);
    const after=await js(`({load:window._tmLoadGen||0,day:TM.SimTime.now(GM),player:GM.playerCharacterId,plans:JSON.stringify((GM._npcPlans||[]).filter(p=>p.localActivity&&p.localActivity.kind==='meeting')),locations:GM.chars.filter(c=>['char_jianyan1_01','char_jianyan1_16'].includes(c.id)).map(c=>({id:c.id,controlled:TM.NPC.DailyActivities.controlled(c),region:TM.NPC.DailyActivities.exactLocation(c,GM),travel:c._localTravelRef||null,life:JSON.stringify(c._lifeExp||[]),learning:JSON.stringify(c._growth||null),memory:JSON.stringify(c._memory||[]),archive:JSON.stringify(c._memArchive||[])}))})`);
    assert.equal(await js(`P.ai.url==='https://composite-fixture.invalid/v1'&&P.ai.key==='composite-fixture'`),true,'formal load restores the declared machine API fixture config');
    assert(after.load>before.load,'load generation must change');assert.equal(after.day,before.day);assert.equal(after.player,before.player);assert.equal(after.plans,before.plans,'load must preserve current meeting and messages');assert.deepEqual(after.locations,before.locations,'load must preserve actual controllers and current physical travel');
    assert.equal(await js(`!!window.__compositeOldButton`),true,'the saved detached control must remain available for the negative test'); await js(`window.__compositeOldButton.click()`);assert.equal(await js(`JSON.stringify((GM._npcPlans||[]).filter(p=>p.localActivity&&p.localActivity.kind==='meeting'))`),after.plans,'detached stale control cannot write to recovered world');
    await js(`(()=>{delete window.__compositeOldWorld;delete window.__compositeOldButton;return true;})()`);
    timeline.push({stage:'real-slot-reload',name,slot,before:{...before,plans:undefined},after:{...after,plans:undefined},expected});
    await record('after-reload-'+name);
  }
  await js(`(async()=>{await new Promise(r=>setTimeout(r,650));const b=document.querySelector('#tm-changelog-ov .tm-cl-close');if(b)b.click();await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure('sc-jianyan1-1127-shaosong');P.ai={key:'',url:'',model:''};await startGame('sc-jianyan1-1127-shaosong');})()`);
  await wait(`document.getElementById('tm-op-enter')`, 'official start ceremony missing');
  await click('#tm-op-enter');
  await wait(`GM.running&&GM.sid==='sc-jianyan1-1127-shaosong'`, 'official startup did not finish',35000);
  await js(`_tmAwaitLoadBarrier()`); await settle();
  await js(`void(window.__compositeWaits=(${installCompositeWaits.toString()})(window,${deadlineAt}))`);
  if(await js(`!!document.querySelector('#tm-firstturn-guide button')`))await click('#tm-firstturn-guide button:last-child');
  if(await js(`!!document.querySelector('#tm-nokey-banner button')`))await click('#tm-nokey-banner button:last-child');
  await check('official Shaosong population, current player, map and real formal entry are preserved',async()=>{
    const s=await record('official-start'); assert(s.people>=500,JSON.stringify(s)); assert(s.player);
    const ui=await js(`({body:document.body.className,turn:document.querySelector('#endturn .et-big')?.outerHTML,save:document.querySelector('#save-btn')?.outerHTML,buttons:Array.from(document.querySelectorAll('button')).filter(b=>{const r=b.getBoundingClientRect();return r.width&&r.height;}).map(b=>({text:b.textContent.slice(0,45),id:b.id,action:b.getAttribute('onclick')})).slice(-40),locations:['赵构','韩世忠','张俊'].map(n=>{const c=GM.chars.find(x=>x.name===n);return{n,id:c?.id,loc:TM.NPC.DailyActivities.exactLocation(c,GM),controlled:TM.NPC.DailyActivities.controlled(c),known:TM.NPC.DailyActivities.knownIds(c).size,knownPeople:Array.from(TM.NPC.DailyActivities.knownIds(c)).map(id=>{const x=GM.chars.find(v=>v.id===id);return{id,name:x?.name,location:TM.NPC.DailyActivities.exactLocation(x,GM),publicIdentity:x?.publicIdentity||false};}),materials:TM.NPC.DailyActivities.materialOptions(c).map(m=>({ref:m.ref,label:m.label}))};})})`);
    fs.writeFileSync(path.join(dir,'official-ui.json'),JSON.stringify(ui,null,2)); assert(ui.turn,'formal endTurn entry missing'); const playerRow=ui.locations.find(r=>r.n==='赵构'),han=playerRow.knownPeople.find(r=>r.id==='char_jianyan1_16');assert(han,'official received relationship must expose the actual known contact');assert.equal(han.publicIdentity,false,'test must not mark the contact public');await screenshot('01-official-start');
  });
  if (process.env.TM_BRIDGE_MEMORY_DIAGNOSTICS === '1') await js(`(()=>{
    const trace=(phase,event)=>console.info('COMPOSITE_STAGE '+JSON.stringify({phase,event,turn:GM.turn,day:TM.SimTime.now(GM),load:window._tmLoadGen||0,at:Date.now()}));
    const observe=(owner,key,label)=>{const real=owner&&owner[key];if(typeof real!=='function')throw Error('diagnostic boundary missing: '+label);owner[key]=function(){trace(label,'start');let result;try{result=real.apply(this,arguments);}catch(e){trace(label,'throw');throw e;}if(result&&typeof result.then==='function')result.then(()=>trace(label,'end'),()=>trace(label,'reject'));else trace(label,'end');return result;};};
    observe(window,'_runPreSubmitPartyClassCalibration','calibration');
    observe(window,'_tmCaptureEndTurnTransaction','rollback-capture');
    observe(window,'_tmCapturePreEndTurnCommittedState','pre-save-capture');
    observe(window,'_tmPrepareEndTurnBoundary','pre-save-commit');
    observe(TM.Endturn.ResponseRecovery,'begin','response-recovery');
    const finalize=window._tmFinalizeEndTurnTransaction;
    window._tmFinalizeEndTurnTransaction=function(ctx,txn){
      trace('finalize','start');const result=finalize.apply(this,arguments);
      result.then(()=>{const flags={committed:!!(txn&&txn.committed),committedCaptureReleased:!!(ctx&&ctx.meta&&ctx.meta.committedCaptureReleased),captureSessionReleased:!!(txn&&txn.captureSession&&txn.captureSession.released)};ctx=null;txn=null;console.info('COMPOSITE_COMMIT_RELEASE '+JSON.stringify({turn:GM.turn,day:TM.SimTime.now(GM),at:Date.now(),...flags}));trace('finalize','end');},()=>{ctx=null;txn=null;trace('finalize','reject');});
      return result;
    };

    return true;
  })()`);
  if(process.env.TM_BRIDGE_HEAP_SAMPLING==='1')await js(`(${installCompositeAllocationStages.toString()})(window)`);
  // Declared initial test visibility: one existing nearby public venue.
  // People and their official scenario relationships remain unmodified; no
  // completed contact, localGoal, permission or activity is supplied.
  const {responseFor}=require('./npc-composite-model-fixture.cjs');
  await js('(()=>{window.__compositeResponseFor=('+responseFor.toString()+');return true;})()');
  await js(String.raw`(()=>{
    const venue=GM.mapData.regions.find(r=>r.id==='ssr-0007');venue.public=true;
    P.time.daysPerTurn=30;if(GM.time)GM.time.daysPerTurn=30;
    window.__compositeCalls={transport:[],fixtureErrors:[],provinceEconomy:[],systems:[],reviewCancels:[]};
    const realReviewCancel=TM.RecoveryReview.cancel;TM.RecoveryReview.cancel=function(id){__compositeCalls.reviewCancels.push({id:typeof id==='string'?id:'context',day:TM.SimTime.now(GM)});return realReviewCancel.apply(this,arguments);};
    P.ai={key:'composite-fixture',url:'https://composite-fixture.invalid/v1',model:'fixture'};
    localStorage.setItem('tm_api',JSON.stringify(P.ai)); // Declared fake machine configuration in this disposable profile.
    const original=TM.Endturn.AI.subcalls.setupInfra;
    TM.Endturn.AI.subcalls.setupInfra=function(ctx){const result=original(ctx),send=ctx.subcalls._callEndturnAI;ctx.subcalls._callEndturnAI=function(body,options){return send(Object.assign({},body,{__compositeFixtureKind:String(options&&options.id||'')}),options);};return result;};
    const realTransport=window.fetch;window.fetch=async function(resource,options){
      if(!String(resource).startsWith('https://composite-fixture.invalid/'))return realTransport.apply(this,arguments);
      const body=JSON.parse(options?.body||'{}'),messages=body.messages||[],prompt=messages.map(m=>typeof m.content==='string'?m.content:'').join('\n'),label=prompt.slice(0,140);
      __compositeCalls.transport.push({day:TM.SimTime.now(GM),path:new URL(resource).pathname,kind:String(body.__compositeFixtureKind||''),label,stream:!!body.stream});
      let parsed;try{parsed=window.__compositeResponseFor(String(body.__compositeFixtureKind||''),prompt);}catch(error){__compositeCalls.fixtureErrors.push({kind:body.__compositeFixtureKind||'',label,day:TM.SimTime.now(GM),error:String(error.message||error).slice(0,200)});console.error('COMPOSITE_FIXTURE_UNSUPPORTED '+JSON.stringify({kind:body.__compositeFixtureKind||'',label,tail:prompt.slice(-1500)}));throw error;}
      const content=typeof parsed==='string'?parsed:JSON.stringify(parsed);
      __compositeCalls.transport[__compositeCalls.transport.length-1].responseKind=String(body.__compositeFixtureKind||'direct-producer');
      __compositeCalls.transport[__compositeCalls.transport.length-1].responseKeys=typeof parsed==='string'?[]:Object.keys(parsed);
      const message={choices:[{index:0,message:{role:'assistant',content},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};
      if(body.stream)return new Response('data: '+JSON.stringify({choices:[{index:0,delta:{content},finish_reason:null}]})+'\n\ndata: [DONE]\n\n',{headers:{'Content-Type':'text/event-stream'}});
      return new Response(JSON.stringify(message),{headers:{'Content-Type':'application/json'}});
    };
  })()`);
  await js(`void((${installCompositeEconomyObservers.toString()})(window,__compositeCalls))`);
  await openLetters();
  await select(panel+' #daily-target','char_jianyan1_16');
  await click(panel+' [data-daily-compose] details > summary');
  await click(panel+' input[data-daily-material="new"][value="0"]');
  await click(panel+' [data-daily-new="assistance"]');
  await check('formal assistance creates the source, NPC independently receives and responds',async()=>{
    let s=await record('source-request');const p=s.plans.find(p=>p.kind==='assistance');assert(p,'UI did not submit assistance: '+await js(`document.querySelector(${JSON.stringify(panel)}).textContent`));
    if(p.status!=='awaiting_feedback') { await formalTurn(); await openLetters(); }
    s=await record('source-received');assert.equal(s.plans.find(p=>p.kind==='assistance').status,'awaiting_feedback',JSON.stringify(s));
    await click(panel+' [data-daily-answer="satisfied"]');await record('source-confirmed');
  });
  await formalTurn(); await openLetters();
  await select(panel+' #daily-target','char_jianyan1_16');await select(panel+' #daily-consultation-topic','reading_understanding');await select(panel+' #daily-meeting-location','ssr-0007');
  await click(panel+' [data-daily-new="meeting"]');
  await record('meeting-request');await screenshot('02-meeting-request');
  const meeting=await js(`(()=>{const p=GM._npcPlans.filter(p=>p.localActivity?.kind==='meeting').slice(-1)[0];return p&&{id:p.id,status:p.status};})()`);assert(meeting,'formal meeting request missing');
  const card=panel+' [data-daily-plan="'+meeting.id+'"]';
  for(let i=0;i<8;i++){
    if(await js(`!!document.querySelector(${JSON.stringify(card+' [data-daily-answer="depart"]')})`))break;
    await formalTurn();await openLetters();
  }
  await click(card+' [data-daily-answer="depart"]');
  await check('formal departure has a real route, and the travel save actually loads a new world',async()=>{
    const s=await record('departed'),p=s.plans.find(p=>p.id===meeting.id);assert.equal(p.meeting.actorJourney.status,'in_transit',JSON.stringify(p));
    await saveAndReload(1,'赴约途中','in_transit');
  });
  await openLetters();
  for(let i=0;i<12;i++){
    if(await js(`!!document.querySelector(${JSON.stringify(card+' [data-daily-exchange="question"]')})`))break;
    await formalTurn();await openLetters();
  }
  await check('onsite player question uses a current UI ticket and awaits an independent answer',async()=>{
    await click(card+' [data-daily-exchange="question"]');
    const s=await record('onsite-question'),p=s.plans.find(p=>p.id===meeting.id);assert.equal(p.meeting.discussion.status,'awaiting_target',JSON.stringify(p));assert(p.meeting.discussion.actorContent);assert(!p.meeting.discussion.targetContent);
    await screenshot('03-onsite-question');await saveAndReload(2,'现场问题待答','awaiting_target');
  });
  for(let i=0;i<12;i++){
    const p=(await record('continuing')).plans.find(p=>p.id===meeting.id);if(p.status==='done')break;
    await formalTurn();
  }
  await check('NPC answers the real question, both return, and the official population continues through 30 days',async()=>{
    let s=await record('returned'),p=s.plans.find(p=>p.id===meeting.id);assert.equal(p.status,'done',JSON.stringify(p));assert.equal(p.meeting.discussion.status,'completed');assert(p.meeting.discussion.result.targetContent);assert.equal(p.meeting.actorReturnJourney.status,'returned');assert.equal(p.meeting.targetDecision.response,'accept','the NPC independently accepted the current meeting');assert.equal(p.meeting.targetReturnMode,'return');assert.equal(p.meeting.targetReturnJourney.status,'returned');const physical=await js(`['char_jianyan1_01','char_jianyan1_16'].map(id=>({id,location:TM.NPC.DailyActivities.exactLocation(GM.chars.find(c=>c.id===id),GM)}))`);assert.equal(physical[0].location,p.meeting.actorJourney.fromRegionId,'actor really returns to their own departure location');assert.equal(physical[1].location,p.meeting.targetJourney.fromRegionId,'target really returns to their own departure location');timeline.push({stage:'physical-return',planId:p.id,physical,actorOrigin:p.meeting.actorJourney.fromRegionId,targetOrigin:p.meeting.targetJourney.fromRegionId});assert.equal(p.meeting.discussion.result.id,'meeting-discussion:'+p.id+':1');assert.equal(p.meeting.discussion.effectsApplied,true);assert.equal(p.steps.filter(s=>s.phase==='discuss').length,1);assert.equal(p.steps.filter(s=>s.phase==='discuss_response').length,1);const life=await js(`GM.chars.find(c=>c.id==='char_jianyan1_01')._lifeExp||[]`);assert.equal(life.filter(e=>e.domain==='现场请益·'+p.meeting.discussion.result.topicId&&e.desc===p.meeting.discussion.result.targetContent).length,1,'only one actual learning experience for the performed discussion');const memories=await js(`GM.chars.filter(c=>['char_jianyan1_01','char_jianyan1_16'].includes(c.id)).map(c=>({id:c.id,entries:(c._memory||[]).concat(c._memArchive||[]).filter(m=>String(m.sourceId||'').startsWith(${JSON.stringify(p.meeting.discussion.result.id)}))}))`);for(const row of memories)assert.equal(row.entries.length,1,'each real participant receives exactly one discussion memory');timeline.push({stage:'personal-result',planId:p.id,resultId:p.meeting.discussion.result.id,life,memories});
    for(let i=0;s.day<30&&i<15;i++){await formalTurn();s=await record('continuous-run');}
    assert(s.day>=30);assert(s.people>=500);
    const finalTurn=(await js(`__compositeWaits.snapshot()`)).filter(row=>row.kind==='turn').slice(-1)[0];
    assert(finalTurn&&finalTurn.status==='completed'&&Number.isFinite(finalTurn.startedAt),'the final genuine turn must identify its background work');
    await record('before-final-background-settlement');
    const background=await js(`(${waitForCompositeBackground.toString()})(window,${deadlineAt},${finalTurn.startedAt})`);
    assert.equal(background.status,'settled');timeline.push({stage:'final-review-and-save-settled',...background});
    // Background world rendering may legitimately close a prior letter panel.
    // Reopen through the same real controls after it settles, and prove the
    // actual result paragraph is visible rather than reading hidden DOM text.
    await closeLetters();await openLetters();
    const resultSelector=await js(`(()=>{const card=document.querySelector(${JSON.stringify(card)});if(!card)throw Error('completed meeting card missing');const details=Array.from(card.querySelectorAll(':scope > details'));const index=details.findIndex(d=>d.querySelector('summary')?.textContent.trim()==='现场讨论结果');if(index<0)throw Error('onsite result section missing');return ${JSON.stringify(card)}+' > details:nth-of-type('+(index+1)+')';})()`);
    if(!await js(`document.querySelector(${JSON.stringify(resultSelector)}).open`))await click(resultSelector+' > summary');
    const visibleResult=`(()=>{const e=document.querySelector(${JSON.stringify(resultSelector+' > p')});if(!e)return null;e.scrollIntoView({block:'center',inline:'nearest'});for(let n=e;n;n=n.parentElement){const style=getComputedStyle(n);if(style.display==='none'||style.visibility!=='visible'||Number(style.opacity)===0)return null;}const r=e.getBoundingClientRect(),x=r.x+r.width/2,y=r.y+r.height/2,hit=document.elementFromPoint(x,y);return r.width>0&&r.height>0&&x>=0&&x<innerWidth&&y>=0&&y<innerHeight&&hit&&(hit===e||e.contains(hit))&&e.textContent===${JSON.stringify(p.meeting.discussion.result.targetContent)}?{text:e.textContent,rect:{x:r.x,y:r.y,width:r.width,height:r.height},hit:true,day:TM.SimTime.now(GM),load:window._tmLoadGen}:null;})()`;
    await wait(visibleResult,'actual onsite result must be visible on the formal page');
    const shownResult=await js(visibleResult);assert(shownResult,'result was hidden before capture');
    await screenshot('04-completed-return');assert(await js(visibleResult),'result was hidden during capture');
    timeline.push({stage:'visible-formal-result',planId:p.id,resultId:p.meeting.discussion.result.id,...shownResult});
    const calls=await js(`__compositeCalls`);assert.equal(calls.fixtureErrors.length,0,'no unknown or invalid external protocol may be hidden by a production catch');assert(calls.systems.length>0);assert(calls.provinceEconomy.every(r=>r.days>0&&r.before&&r.after),'real province samples must be recorded around every settlement');assert(calls.provinceEconomy.some(r=>JSON.stringify(r.before)!==JSON.stringify(r.after)),'the real economy must change its source fields during the run');assert.equal(calls.provinceEconomy.length,calls.systems.length,'real provincial economy runs once per actual top-level interval');assert.equal(new Set(calls.provinceEconomy.map(r=>r.turn)).size,calls.provinceEconomy.length,'meeting substeps must not repeat provincial settlement');calls.economyReconciliation=reconcileCompositeEconomy(await js(`__compositeWaits.snapshot()`),calls);results.push({name:'official-composite-model-boundary',status:'PASS',value:calls});
  });
  await record('completed-evidence');
};
