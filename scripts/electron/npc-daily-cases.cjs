'use strict';
// The actual production browser and page, with an explicitly initialized private-person fixture.
// Only initial people/relationships/goals are supplied. Every response and delivery uses real UI controls.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({win,check,results}){
 const dir=path.dirname(process.env.TM_BRIDGE_TEST_REPORT),traffic=[];
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(details,callback)=>{
   const u=new URL(details.url);traffic.push({host:u.host,path:u.pathname,blocked:true});callback({cancel:true});
 });
 const js=async code=>{const r=await win.webContents.executeJavaScript(`(async()=>{try{return{ok:true,value:await(${code})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`,true);if(!r.ok)throw Error(r.error);return r.value;};
 const settle=()=>js(`new Promise(r=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(r)),120))`);
 const panel='#tm-action-letter-overlay [data-npc-daily-panel="formal"]';
 async function click(selector){
   const geometry=await js(`(async()=>{const b=document.querySelector(${JSON.stringify(selector)});if(!b)return{missing:true};b.scrollIntoView({block:'center',inline:'nearest'});await new Promise(r=>requestAnimationFrame(r));const box=b.getBoundingClientRect(),hit=document.elementFromPoint(box.x+box.width/2,box.y+box.height/2);return{width:box.width,height:box.height,x:box.x,y:box.y,hit:hit===b||b.contains(hit),top:hit&&hit.outerHTML.slice(0,500)};})()`);
   if(!geometry.hit)await screenshot('click-obstruction');
   assert(geometry.hit&&geometry.width>0&&geometry.height>0,JSON.stringify({selector,geometry}));
   await js(`document.querySelector(${JSON.stringify(selector)}).click()`);await settle();
 }
 async function screenshot(name){fs.writeFileSync(path.join(dir,name+'.png'),(await win.webContents.capturePage()).toPNG());}
 await check('ordinary activity modules are actually in the production loading path',async()=>{
   assert.equal(await js(`!!(TM.NPC.DailyActivities&&TM.NPC.LocalAI&&TM.NPC.DailyUI&&TM.OfficeTenure&&NpcBehaviorRegistry._behaviors.ordinary_interaction)`),true);
 });
 await js(`(async()=>{
   await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,650));TM_Changelog.markRead();TM_Changelog.close();
   window.__dailyBrowser={apiAttempts:[],errors:[],initialPlans:0};
   for(const name of ['callAI','callAIMessages','callAIWithTools','callAISmart','callAIStream','callAIStreamMessages']){
     if(typeof window[name]==='function')window[name]=function(){__dailyBrowser.apiAttempts.push(name);throw Error('daily-browser-model-attempt:'+name);};
   }
   addEventListener('error',e=>__dailyBrowser.errors.push(e.message));
   const common={alive:true,age:35,health:90,location:'城内',publicIdentity:true,officialTitle:'',faction:'',factionId:'',isRuler:false,intelligence:65,administration:60,loyalty:80,ambition:20};
   const people=[Object.assign({},common,{id:'local-a',name:'沈同文',localGoals:[{id:'first-introduction',kind:'introduction',targetId:'local-b',thirdPartyId:'local-player'}]}),
     Object.assign({},common,{id:'local-b',name:'周季平',innerThought:'SECRET_MEDIATOR_NOT_FOR_PLAYER'}),Object.assign({},common,{id:'local-player',name:'来客',isPlayer:true})];
   P.ai={key:'',url:'',model:''};P.time={year:1627,startMonth:9,startDay:1,daysPerTurn:1};P.playerInfo={characterId:'local-player',characterName:'来客',factionId:'',factionName:'',location:'城内'};P.characters=[];
   GM=Object.assign({},GM,{sid:'local-daily-browser',_campaignId:'local-daily-browser',_timelineId:'local-daily-browser',turn:1,running:true,busy:false,_endTurnBusy:false,
     chars:people,facs:[],armies:[],officeTree:[],playerInfo:P.playerInfo,vars:{},rels:{},letters:[],memorials:[],edicts:[],evtLog:[],_npcPlans:[],_npcActionLedger:[],_npcExecutionResults:[],
     _npcDecisionDiagnostics:[],_capital:'城内',affinityMap:{'周季平|沈同文':45},_pendingAudiences:[],_turnContext:{npcActionsThisTurn:[]},
     mapData:{locationBindingContract:{schema:'source-text-location-v2'},regions:[{id:'same-city',name:'城内'}]}});
   delete GM._npcActionState;delete GM.nativeWorld;delete GM.startContext;
   if(typeof buildIndices==='function')buildIndices();
   document.body.classList.add('tm-phase8-formal');
   if(document.getElementById('L'))document.getElementById('L').style.display='none';
   if(document.getElementById('G'))document.getElementById('G').style.display='block';
   GameHooks.run('enterGame:after');
   await new Promise(r=>setTimeout(r,150));
   openCharRenwuPage('沈同文');await document.fonts.ready;
 })()`);
 if(await js(`!!document.querySelector('#tm-firstturn-guide button')`))await click('#tm-firstturn-guide button:last-child');
 if(await js(`!!document.querySelector('#tm-nokey-banner button')`))await click('#tm-nokey-banner button:last-child');
 await check('a local NPC initiates, the intermediary chooses, and the player has not consented',async()=>{
   const r=await js(`(()=>{const p=TM.NPC.DailyActivities.plans().find(p=>p.localActivity.kind==='introduction');return{plan:p&&p.id,status:p&&p.status,actorId:p&&p.actorId,targetId:p&&p.targetId,third:p&&p.localActivity.thirdPartyId,
     contact:p&&p.localActivity.contact,player:GM.chars.find(c=>c.id==='local-player'),messages:p&&p.messages.map(m=>({kind:m.kind,from:m.fromId,to:m.toId,status:m.status})),offices:GM.officeTree.length,factions:GM.facs.length,api:__dailyBrowser.apiAttempts};})()`);
   assert(r.plan&&r.status==='awaiting_third',JSON.stringify(r));assert.equal(r.actorId,'local-a');assert.equal(r.targetId,'local-b');assert.equal(r.third,'local-player');assert(!r.contact);assert(!r.player._lastNpcExecution);assert(!r.player.isRuler);assert.equal(r.offices,0);assert.equal(r.factions,0);assert.deepEqual(r.api,[]);
   results.push({name:'observed-independent-local-introduction',status:'PASS',value:r.messages});
 });
 await click('#tm-zhi-folio [data-zhi-action="letter"]');
 await click(panel+' > details > summary');
 await screenshot('01-player-response-pending');
 await check('desktop save/load preserves the unanswered introduction and revokes old controls',async()=>{
   const before=await js(`JSON.stringify({plans:GM._npcPlans,budgets:GM._npcActionState.localDaily.actors})`);
   const token=await js(`document.querySelector(${JSON.stringify(panel+' [data-daily-response]')}).dataset.dailyResponse`);
   await js(`(async()=>{const saved=await tianming.saveProject('引见待答隔离验收',_buildSaveState({format:'project',detach:true}));if(!saved.success)throw Error(saved.error);const list=await tianming.listSaves(),row=list.files.find(x=>x.storageKey===saved.storageKey),loaded=await tianming.loadProject(row);if(!loaded.success)throw Error(loaded.error);await fullLoadGame(loaded.data,{source:'daily-pending-browser',preserveTimeline:true});})()`);
   assert.equal(await js(`JSON.stringify({plans:GM._npcPlans,budgets:GM._npcActionState.localDaily.actors})`),before);
   assert.equal(await js(`TM.NPC.DailyActivities.submitHuman(${JSON.stringify(token)},{response:'accept'}).outcome`),'expired');
   await js(`openCharRenwuPage('沈同文')`);await settle();
   await click('#tm-zhi-folio [data-zhi-action="letter"]');
 });
 await check('the actual Hongyan controls require explicit current player acceptance',async()=>{
   assert.equal(await js(`document.querySelector(${JSON.stringify(panel)}).textContent.includes('SECRET_MEDIATOR_NOT_FOR_PLAYER')`),false);
   await click(panel+' [data-daily-plan] [data-daily-answer="accept"]');
   const r=await js(`(()=>{const p=TM.NPC.DailyActivities.plans().find(p=>p.localActivity.kind==='introduction');return{status:p.status,contact:p.localActivity.contact,view:TM.NPC.DailyActivities.view(p,GM.chars.find(c=>c.id==='local-player')),turn:GM.turn,api:__dailyBrowser.apiAttempts};})()`);
   assert.equal(r.status,'done',JSON.stringify(r));assert.deepEqual(r.contact.participants,['local-a','local-player']);assert.equal(r.contact.mode,'correspondence');assert(r.view.contact,'player must receive the actual completion receipt');assert.equal(r.turn,1);assert.deepEqual(r.api,[]);
   await screenshot('02-introduction-contact-received');
 });
 await check('a player requests actual sourced assistance from the same formal page',async()=>{
   await js(`(()=>{const s=document.querySelector(${JSON.stringify(panel+' #daily-target')});s.value='local-b';s.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await click(panel+' [data-daily-compose] details > summary');
   const materialIndex=await js(`Array.from(document.querySelectorAll(${JSON.stringify(panel+' input[data-daily-material="new"]')})).find(el=>el.parentElement.textContent.trim()==='人物公开身份：姓名：来客').value`);
   await click(panel+' input[data-daily-material="new"][value="'+materialIndex+'"]');
   await click(panel+' [data-daily-new="assistance"]');
   const r=await js(`(()=>{const p=TM.NPC.DailyActivities.plans().find(p=>p.localActivity.kind==='assistance');return{status:p&&p.status,docs:p&&p.localActivity.documents,readable:document.querySelector(${JSON.stringify(panel)}).textContent,turn:GM.turn,api:__dailyBrowser.apiAttempts};})()`);
   assert.equal(r.status,'awaiting_feedback',JSON.stringify(r));assert.equal(r.docs.length,1);assert.equal(r.docs[0].receivedBy,'local-player');assert(r.docs[0].content.includes('姓名：来客'));assert(r.readable.includes('查看材料来源'));assert(r.readable.includes('姓名：来客'));assert.equal(r.turn,1);assert.deepEqual(r.api,[]);
   await click(panel+' [data-daily-document] details > summary');
   await screenshot('03-assistance-document-and-source');
   await click(panel+' [data-daily-answer="satisfied"]');
   assert.equal(await js(`TM.NPC.DailyActivities.plans().find(p=>p.localActivity.kind==='assistance').status`),'done');
 });
 await check('same-date redraw, closing and desktop save/load do not replay effects',async()=>{
   const before=await js(`JSON.stringify({plans:GM._npcPlans,state:GM._npcActionState,opinions:GM.chars.map(c=>c._eventOpinions),turn:GM.turn})`);
   const beforePlans=await js(`TM.NPC.DailyActivities.plans().map(p=>({id:p.id,status:p.status,messages:p.messages.length}))`);
   await js(`(()=>{TM.NPC.DailyUI.render();TM.NPC.DailyUI.render();})()`);
   assert.equal(await js(`JSON.stringify({plans:GM._npcPlans,state:GM._npcActionState,opinions:GM.chars.map(c=>c._eventOpinions),turn:GM.turn})`),before);
   const r=await js(`(async()=>{const save=_buildSaveState({format:'project',detach:true}),saved=await tianming.saveProject('日常往来隔离验收',save);if(!saved.success)throw Error(saved.error);const listing=await tianming.listSaves(),row=listing.files.find(x=>x.storageKey===saved.storageKey),loaded=await tianming.loadProject(row);if(!loaded.success)throw Error(loaded.error);await fullLoadGame(loaded.data,{source:'daily-local-browser',preserveTimeline:true});return{plans:TM.NPC.DailyActivities.plans().map(p=>({id:p.id,status:p.status,messages:p.messages.length})),turn:GM.turn,api:__dailyBrowser.apiAttempts};})()`);
   assert.deepEqual(r.plans,beforePlans,'save/load must preserve every original matter, phase and message count');assert(r.plans.every(p=>p.status==='done'));assert.equal(r.turn,1);assert.deepEqual(r.api,[]);
 });
 await check('formal daily page creates a sourced consultation without hand-written localGoals',async()=>{
   // Release the first-turn activity budget through the cumulative clock fixture.
   // The complete production endTurn transaction is covered by the office-duty bridge gate.
   await js(`(()=>{const interval=TM.SimTime.prepare(GM);TM.SimTime.commit(GM,interval);GM.turn=2;})()`);
   // Open an ordinary NPC's人物志 as the formal recipient entry.  The player
   // dossier intentionally has no outbound letter button; the daily panel
   // still uses the current player as its actor after this target entry.
   await js(`(()=>{openCharRenwuPage('周季平');})()`);await settle();await click('#tm-zhi-folio [data-zhi-action="letter"]');
   await js(`(()=>{const panel=document.querySelector(${JSON.stringify(panel)}),target=panel.querySelector('#daily-target');target.value='local-a';target.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await click(panel+' [data-daily-compose] details > summary');
   const extraMaterial=await js(`Array.from(document.querySelectorAll(${JSON.stringify(panel+' input[data-daily-material="new"]')})).find(el=>el.parentElement.textContent.trim()==='人物公开身份：姓名：来客').value`);
   await click(panel+' input[data-daily-material="new"][value="'+extraMaterial+'"]');
   await click(panel+' [data-daily-new="assistance"]');
   const extraPlan=await js(`(()=>{const p=TM.NPC.DailyActivities.plans().filter(p=>p.localActivity.kind==='assistance').slice(-1)[0];return{id:p&&p.id,status:p&&p.status};})()`);
   assert(extraPlan&&extraPlan.status==='awaiting_feedback',JSON.stringify(extraPlan));
   await click(panel+' [data-daily-plan="'+extraPlan.id+'"] [data-daily-answer="satisfied"]');
   await js(`(()=>{const panel=document.querySelector(${JSON.stringify(panel)}),target=panel.querySelector('#daily-target'),topic=panel.querySelector('#daily-consultation-topic');target.value='local-b';target.dispatchEvent(new Event('change',{bubbles:true}));topic.value='reading_understanding';topic.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await click(panel+' [data-daily-new="consultation"]');
   const r=await js(`(()=>{const p=TM.NPC.DailyActivities.plans().filter(p=>p.localActivity.kind==='consultation').slice(-1)[0];return{status:p&&p.status,source:p&&p.localActivity.sourceOpportunity,topic:p&&p.localActivity.topicId,plans:TM.NPC.DailyActivities.plans().length,api:__dailyBrowser.apiAttempts};})()`);
   assert(r.source&&r.source.kind==='document'&&r.topic==='reading_understanding',JSON.stringify(r));assert.deepEqual(r.api,[]);
   const saved=await js(`(async()=>{const x=await tianming.saveProject('请益切磋阶段隔离验收',_buildSaveState({format:'project',detach:true}));if(!x.success)throw Error(x.error);const list=await tianming.listSaves(),row=list.files.find(v=>v.storageKey===x.storageKey),loaded=await tianming.loadProject(row);if(!loaded.success)throw Error(loaded.error);await fullLoadGame(loaded.data,{source:'npc-life-consultation-reload',preserveTimeline:true});return{status:GM._npcPlans.filter(p=>p.localActivity&&p.localActivity.kind==='consultation').slice(-1)[0].status,source:GM._npcPlans.filter(p=>p.localActivity&&p.localActivity.kind==='consultation').slice(-1)[0].localActivity.sourceOpportunity};})()`);
   assert(saved.source&&saved.status!=='done',JSON.stringify(saved));
 });
 await check('formal consultation completes one question and one bounded follow-up through top-level turns',async()=>{
   // This fixture replaces only the external narrative inference boundary.
   // The real end-turn preparation, SimTime commit, systems, NPC dispatch,
   // save boundary and renderer controls remain active.
   await js(`(()=>{
     P.ai={key:'npc-life-fixture',url:'https://npc-life-fixture.invalid/v1',model:'fixture'};
     window._endTurn_aiInfer=async function(){return{timeRatio:1,shizhengji:'按已知事项推进。',zhengwen:'按既定材料结算。',turnSummary:'日常往来',playerStatus:'办理中',playerInner:'继续处理当前事项。',shiluText:'本回合按已知事项推进。',szjTitle:'日常往来',szjSummary:'按既定材料推进。',hourenXishuo:'',personnelChanges:[],events:[{type:'npc-life-fixture',title:'日常往来',text:'按已知事项推进。'}],char_updates:[],office_assignments:[],fiscal_adjustments:[],changes:[],npc_actions:[],edictActions:{appointments:[],dismissals:[],deaths:[],armyBuilds:[],rewards:[],payArrears:[]}};};
     if(TM.Endturn&&TM.Endturn.AI&&TM.Endturn.AI.subcalls&&typeof TM.Endturn.AI.subcalls.setupInfra==='function'){
       const original=TM.Endturn.AI.subcalls.setupInfra;
       TM.Endturn.AI.subcalls.setupInfra=function(ctx){const configured=original(ctx);ctx.subcalls=ctx.subcalls||{};ctx.subcalls._callEndturnAI=async function(){const parsed={turn_summary:'日常往来',shizhengji_basis:'既有事项材料',shilu_text:'本回合按已知事项推进。',szj_title:'日常往来',shizhengji:'按既定材料推进。',szj_summary:'按既定材料推进。',zhengwen:'按既定材料结算。',events:[{type:'npc-life-fixture',title:'日常往来',text:'按已知事项推进。'}],edict_feedback:[],office_assignments:[],personnel_changes:[],changes:[],resource_changes:{}};const raw=JSON.stringify(parsed),data={choices:[{message:{content:raw},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};return{data,raw,parse:{parsed,raw,repaired:false,truncated:false}};};return configured;};
     }
     window.scThreeSystemsAI=undefined;window.aiDigestLongTermActions=undefined;
   })()`);
   async function formalTurn(){
     await js(`(()=>{if(TM.UI&&TM.UI.turnResult&&typeof TM.UI.turnResult.closeTurnResult==='function')TM.UI.turnResult.closeTurnResult();})()`);await settle();
     await click('#gs-turn-big');
     await js(`(async()=>{for(let i=0;i<200&&!document.getElementById('cet-ok');i++)await new Promise(r=>setTimeout(r,50));const ok=document.getElementById('cet-ok');if(!ok)throw Error('missing formal end-turn confirmation');ok.click();})()`);
     await js(`(async()=>{for(let i=0;i<40&&!document.getElementById('post-turn-court-prompt');i++)await new Promise(r=>setTimeout(r,50));if(document.getElementById('post-turn-court-prompt')&&typeof _postTurnCourtChoose==='function')_postTurnCourtChoose(false);})()`);
     await js(`new Promise((resolve,reject)=>{const t=Date.now();(function poll(){if(!GM.busy&&!GM._endTurnBusy){resolve(true);return;}if(Date.now()-t>90000){reject(new Error('formal npc-life endTurn timeout'));return;}setTimeout(poll,100);})()})`);
     await settle();
     await js(`(async()=>{if(typeof _awaitPostTurnJobsById==='function')await _awaitPostTurnJobsById(['npc_behavior']);})()`);
   }
   async function lifeStatus(){return js(`(()=>{const p=GM._npcPlans.filter(x=>x.localActivity&&x.localActivity.kind==='consultation').slice(-1)[0];return p&&{id:p.id,status:p.status,next:p.nextActorId,messages:p.messages.map(m=>({kind:m.kind,status:m.status,from:m.fromId,to:m.toId})),follow:p.localActivity.followUp||null,result:p.localActivity.result||null};})()`);}
   for(let i=0;i<8;i++){const s=await lifeStatus();if(!s||s.status==='awaiting_feedback'||s.status==='done')break;await formalTurn();}
   let state=await lifeStatus();
   assert(state&&state.status==='awaiting_feedback',JSON.stringify(state));
   await js(`openCharRenwuPage('周季平')`);await settle();await click('#tm-zhi-folio [data-zhi-action="letter"]');
   await click(panel+' [data-daily-answer="ask"]');
   state=await lifeStatus();assert(state.status!=='done'&&state.follow&&state.follow.question,JSON.stringify(state));
   const savedFollow=await js(`(async()=>{const x=await tianming.saveProject('请益追问正式恢复验收',_buildSaveState({format:'project',detach:true}));if(!x.success)throw Error(x.error);const list=await tianming.listSaves(),row=list.files.find(v=>v.storageKey===x.storageKey),loaded=await tianming.loadProject(row);if(!loaded.success)throw Error(loaded.error);const before=window._tmLoadGen||0;await fullLoadGame(loaded.data,{source:'npc-life-followup-reload',preserveTimeline:true});return{save:x.storageKey,before,after:window._tmLoadGen||0,status:GM._npcPlans.filter(p=>p.localActivity&&p.localActivity.kind==='consultation').slice(-1)[0].status};})()`);
   assert(savedFollow.after>savedFollow.before&&savedFollow.status!=='done',JSON.stringify(savedFollow));
   for(let i=0;i<8;i++){state=await lifeStatus();if(state.status==='awaiting_followup_response'||state.status==='awaiting_feedback'||state.status==='done')break;await formalTurn();}
   state=await lifeStatus();
   for(let i=0;i<8&&state.status!=='awaiting_feedback'&&state.status!=='done';i++){await formalTurn();state=await lifeStatus();}
   assert(state.status==='awaiting_feedback'||state.status==='done',JSON.stringify(state));
   if(state.status==='awaiting_feedback'){
     await js(`openCharRenwuPage('周季平')`);await settle();await click('#tm-zhi-folio [data-zhi-action="letter"]');await click(panel+' [data-daily-answer="reflect"]');
     for(let i=0;i<4;i++){state=await lifeStatus();if(state.status==='done')break;await formalTurn();}
   }
   state=await lifeStatus();assert(state.status==='done'&&state.result&&state.result.followUp&&state.result.followUp.response,JSON.stringify(state));
   results.push({name:'formal-consultation-followup-timeline',status:'PASS',value:{turn:await js('GM.turn'),state,savedFollow}});
 });
 await check('formal composite meeting carries a sourced onsite consultation through save, return and result',async()=>{
   // The player dossier is read-only for outbound letters; enter through the
   // ordinary recipient dossier while the daily panel keeps the player as actor.
   await js(`openCharRenwuPage('周季平')`);await settle();await click('#tm-zhi-folio [data-zhi-action="letter"]');
   await js(`(()=>{const p=document.querySelector(${JSON.stringify(panel)}),target=p.querySelector('#daily-target'),topic=p.querySelector('#daily-consultation-topic');target.value='local-a';target.dispatchEvent(new Event('change',{bubbles:true}));topic.value='reading_understanding';topic.dispatchEvent(new Event('change',{bubbles:true}));})()`);
   await click(panel+' [data-daily-new="meeting"]');
   let state=await js(`(()=>{const p=GM._npcPlans.filter(x=>x.localActivity&&x.localActivity.kind==='meeting').slice(-1)[0];return p&&{id:p.id,status:p.status,discussion:p.localActivity.meeting&&p.localActivity.meeting.discussion,messages:p.messages.length};})()`);
   assert(state&&state.discussion&&state.discussion.topicId==='reading_understanding',JSON.stringify(state));
   let saved=null;
   async function compositeTurn(){
     await js(`(()=>{if(TM.UI&&TM.UI.turnResult&&typeof TM.UI.turnResult.closeTurnResult==='function')TM.UI.turnResult.closeTurnResult();})()`);await settle();await click('#gs-turn-big');
     await js(`(async()=>{for(let i=0;i<200&&!document.getElementById('cet-ok');i++)await new Promise(r=>setTimeout(r,50));const ok=document.getElementById('cet-ok');if(!ok)throw Error('missing composite end-turn confirmation');ok.click();})()`);
     await js(`(async()=>{for(let i=0;i<40&&!document.getElementById('post-turn-court-prompt');i++)await new Promise(r=>setTimeout(r,50));if(document.getElementById('post-turn-court-prompt')&&typeof _postTurnCourtChoose==='function')_postTurnCourtChoose(false);})()`);
     await js(`new Promise((resolve,reject)=>{const t=Date.now();(function poll(){if(!GM.busy&&!GM._endTurnBusy){resolve(true);return;}if(Date.now()-t>90000){reject(new Error('formal composite endTurn timeout'));return;}setTimeout(poll,100);})()})`);await settle();
     await js(`(async()=>{if(typeof _awaitPostTurnJobsById==='function')await _awaitPostTurnJobsById(['npc_behavior']);})()`);
   }
   for(let i=0;i<12;i++){
     state=await js(`(()=>{const p=GM._npcPlans.find(x=>x.id||'')&&GM._npcPlans.filter(x=>x.localActivity&&x.localActivity.kind==='meeting').slice(-1)[0];return p&&{id:p.id,status:p.status,discussion:p.localActivity.meeting&&p.localActivity.meeting.discussion,meeting:p.localActivity.meeting,messages:p.messages.length};})()`);
     if(!state)break;
     if(!saved&&/^(traveling|response_in_transit|scheduled|waiting_departure)$/.test(state.status)){
       saved=await js(`(async()=>{const x=await tianming.saveProject('组合约见出发恢复验收',_buildSaveState({format:'project',detach:true}));if(!x.success)throw Error(x.error);const list=await tianming.listSaves(),row=list.files.find(v=>v.storageKey===x.storageKey),loaded=await tianming.loadProject(row);if(!loaded.success)throw Error(loaded.error);const before=window._tmLoadGen||0;await fullLoadGame(loaded.data,{source:'npc-composite-meeting-reload',preserveTimeline:true});return{storageKey:x.storageKey,before,after:window._tmLoadGen||0,status:GM._npcPlans.filter(p=>p.localActivity&&p.localActivity.kind==='meeting').slice(-1)[0].status};})()`);
     }
     if(state.status==='in_meeting')break;
     await compositeTurn();
   }
   state=await js(`(()=>{const p=GM._npcPlans.filter(x=>x.localActivity&&x.localActivity.kind==='meeting').slice(-1)[0];return p&&{id:p.id,status:p.status,discussion:p.localActivity.meeting&&p.localActivity.meeting.discussion,meeting:p.localActivity.meeting};})()`);
   assert(state&&state.status==='in_meeting',JSON.stringify(state));
   await js(`openCharRenwuPage('来客')`);await settle();await click('#tm-zhi-folio [data-zhi-action="letter"]');await click(panel+' [data-daily-exchange="question"]');
   for(let i=0;i<10;i++){state=await js(`(()=>{const p=GM._npcPlans.filter(x=>x.localActivity&&x.localActivity.kind==='meeting').slice(-1)[0];return p&&{status:p.status,discussion:p.localActivity.meeting&&p.localActivity.meeting.discussion,participation:p.localActivity.meeting&&p.localActivity.meeting.participation};})()`);if(state.status==='done')break;await compositeTurn();}
   state=await js(`(()=>{const p=GM._npcPlans.filter(x=>x.localActivity&&x.localActivity.kind==='meeting').slice(-1)[0];return p&&{status:p.status,discussion:p.localActivity.meeting&&p.localActivity.meeting.discussion,participation:p.localActivity.meeting&&p.localActivity.meeting.participation};})()`);
   assert(state.status==='done'&&state.discussion&&state.discussion.result&&state.participation&&state.participation.discussion&&saved&&saved.after>saved.before,JSON.stringify({state,saved}));
   results.push({name:'formal-composite-meeting-timeline',status:'PASS',value:{turn:await js('GM.turn'),state,saved}});
 });
 const observation=await js(`({apiAttempts:__dailyBrowser.apiAttempts,errors:__dailyBrowser.errors,turn:GM.turn,plans:TM.NPC.DailyActivities.plans().map(p=>({id:p.id,status:p.status,kind:p.localActivity.kind,steps:p.steps.length,messages:p.messages.length}))})`);
 assert.deepEqual(observation.apiAttempts,[],'even swallowed model calls fail this gate');
 assert.deepEqual(traffic,[],'even blocked external attempts fail the zero API workflow');
 assert.deepEqual(observation.errors,[],'ordinary UI flow must not hide renderer errors');
 fs.writeFileSync(path.join(dir,'daily-browser-evidence.json'),JSON.stringify({observation,externalTraffic:traffic,networkPolicy:'all HTTP/HTTPS/WS/WSS requests denied',inputMethod:'real Chromium DOM controls with hit testing; initial fixture only'},null,2));
 results.push({name:'zero-model-attempts-and-external-network-denial',status:'PASS',value:{modelAttempts:observation.apiAttempts.length,blockedExternalRequests:traffic.length}});
};
