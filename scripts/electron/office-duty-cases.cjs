'use strict';

// Real Electron renderer and production office page.  The initial world is a
// bounded synthetic fixture; the matter, decision, payment and feedback are
// created through the rendered controls and normal local/ledger code.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

module.exports = async function ({ win, root, check }) {
  const js = async code => {
    const r = await win.webContents.executeJavaScript(`(async()=>{try{return{ok:true,value:await(${code})};}catch(e){return{ok:false,error:String(e.stack||e)}}})()`, true);
    if (!r.ok) throw Error(r.error);
    return r.value;
  };
  const settle = () => js(`new Promise(r=>setTimeout(()=>requestAnimationFrame(()=>requestAnimationFrame(r)),120))`);
  async function click(selector) { await js(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('missing:'+${JSON.stringify(selector)});e.scrollIntoView({block:'center'});e.click();})()`); await settle(); }
  const source = JSON.parse(fs.readFileSync(path.join(root, 'scenarios/天启七年·九月（官方）.json'), 'utf8'));
  await js(`(async()=>{const source=${JSON.stringify(source)};P.scenarios=[source];P.ai={key:'',url:'',model:''};P.time={year:1627,startMonth:9,startDay:1,daysPerTurn:1};P.playerInfo={characterId:'duty-player',characterName:'玩家申请人',factionId:'court',factionName:'朝廷'};doActualStart(source.id);await new Promise(r=>setTimeout(r,900));})()`);
  await js(`(()=>{
    const box=n=>({stock:n,available:n,quota:100,used:0});
    const player={id:'duty-player',name:'玩家申请人',alive:true,isPlayer:true,location:'京师',regionId:'capital'};
    const cashier={id:'duty-cashier',name:'库吏',alive:true,location:'京师',regionId:'capital'};
    GM.sid='office-duty-browser';GM.turn=1;GM.running=true;GM.busy=false;GM.playerInfo=P.playerInfo;GM.chars=[player,cashier];GM.facs=[{id:'court',name:'朝廷',isPlayer:true}];
    GM.officeTree=[{id:'source',name:'甲署',authorityFactionId:'court',publicTreasury:{money:box(50),grain:box(0),cloth:box(0)},positions:[{id:'cashier',name:'库吏',holderId:'duty-cashier',holder:'库吏',actualHolders:[{characterId:'duty-cashier',name:'库吏',appointmentId:'cashier-appt'}],powers:{treasurySpend:true,publicTransferDecide:true},publicTransferDecision:{maxMoney:8,allowedSubjects:['water-browser']},treasuryBinding:{role:'custodian',accountRef:'source'},authorityScope:{accountRefs:['dest']}}]},{id:'dest',name:'乙署',authorityFactionId:'court',publicTreasury:{money:box(0),grain:box(0),cloth:box(0)},positions:[]}];
    GM.publicTreasuryConfig={schema:'tm-public-treasury/2',accounts:['source','dest'].map(id=>({id,kind:'physical',factionId:'court',source:{kind:'department',id}}))};
    GM.documents=[{id:'browser-material',version:1,kind:'document',public:true,status:'confirmed',factStatus:'confirmed',organizationId:'court',subjectId:'water-browser',fromAccount:'source',toAccount:'dest',content:'已核对春耕水利材料'}];
    GM.memorials=[];GM._npcDutyMatters=[];GM._npcPlans=[];GM._publicTreasuryTransfers=[];GM._npcActionLedger=[];GM.letters=[];GM.evtLog=[];GM._turnContext={npcActionsThisTurn:[]};
    if(typeof buildIndices==='function')buildIndices();
    renderOfficeTree(true);TMPhase8FormalBridge.openPanel('archive');
  })()`);
  await check('formal office page shows a real matter producer and no model attempt', async () => {
    const r = await js(`({panel:!!document.querySelector('[data-office-duty-panel]'),create:!!document.querySelector('[data-office-duty="create-matter"]'),api:typeof callAI})`);
    assert(r.panel && r.create, JSON.stringify(r));
  });
  await js(`(()=>{document.querySelector('[data-duty-new-purpose]').value='春耕水利';document.querySelector('[data-duty-new-amount]').value='8';})()`);
  await click('[data-office-duty="create-matter"]');
  await check('player-created matter is pending until a real NPC decision', async () => {
    const r = await js(`(()=>{const m=GM._npcDutyMatters[0],p=document.querySelector('[data-duty-create-feedback]'),s=document.querySelector('[data-duty-new-material]');return{matter:m&&m.id,pending:!!m?.requestedTransfer,policy:!!m?.transferPolicy,receipts:GM._npcDutyMatterReceipts?.length||0,feedback:p&&p.textContent,options:s&&s.options.length,player:GM.playerInfo,controlled:TM.PoliticalActions&&TM.PoliticalActions.controlled&&TM.PoliticalActions.controlled(GM.chars.find(c=>c.id==='duty-player'),GM)};})()`);
    assert(r.matter && r.pending && !r.policy && r.receipts===1, JSON.stringify(r));
  });
  await js(`(()=>{const panel=document.querySelector('[data-office-duty-panel]'),matter=panel.querySelector('[data-duty-matter]'),target=panel.querySelector('[data-duty-target]'),amount=panel.querySelector('[data-duty-amount]');matter.value=matter.options[matter.options.length-1].value;matter.dispatchEvent(new Event('change',{bubbles:true}));target.value='duty-cashier';amount.value='8';})()`);
  await click('[data-office-duty="request-transfer"]');
  await check('formal UI request becomes a canonical plan without payment', async () => {
    const r = await js(`(()=>{const p=GM._npcPlans[0];return{status:p&&p.status,matter:p&&p.task?.basis?.matterRef?.id,transfers:(GM._publicTreasuryTransfers||[]).length};})()`);
    assert.equal(r.status, 'in_transit'); assert(r.matter); assert.equal(r.transfers, 0);
  });
  await js(`(()=>{if(TMPhase8FormalBridge.closePanel)TMPhase8FormalBridge.closePanel();})()`); await settle();
  // The browser case uses the real top-level endTurn entry.  The transport
  // hook is an in-process deterministic model substitute; no network request
  // is made and the normal prep/AI/systems/finalize transaction still runs.
  await js(`(()=>{
    P.ai={key:'office-duty-fixture',url:'https://office-duty-fixture.invalid/v1',model:'fixture'};
    window.__dutyModelAttempts=0;
    if(TM.PartyClassLlmCalibrator)TM.PartyClassLlmCalibrator.flushBeforeSubmit=async function(){return{ok:true,applied:{},source:'office-duty-fixture'};};
    window._aiFetchWithRetry=async function(url,body){
      window.__dutyModelAttempts++;
      let u='';try{const b=typeof body==='string'?JSON.parse(body):body;u=(b.messages&&b.messages[b.messages.length-1]&&b.messages[b.messages.length-1].content)||'';}catch(e){}
      let out={turn_summary:'常务办理',shizhengji_basis:'既有事项材料',shilu_text:'本回合按既定事项推进。',szj_title:'常务办理',shizhengji:'本回合按既定材料推进常务。',szj_summary:'常务按材料推进。',zhengwen:'按既定规则结算。',player_status:'办理中',player_inner:'继续核对事项。',summary:'本回合按既定材料推进常务。',ok:true,events:[{type:'office-duty-fixture',title:'常务结算',text:'按已知事项和既有规则完成本回合结算。'}],char_updates:[],edict_feedback:[],office_assignments:[],fiscal_adjustments:[],personnel_changes:[],new_activities:[],letters:[],resource_changes:{}};
      if(/后人戏说|houren_xishuo|场景叙事/.test(u))out=Object.assign({},out,{houren_xishuo:'本回合按已知事项推进。'});
      // Keep the structured result contract for the main SC1 request.  The
      // prompt contains shilu/shizhengji field names, so matching those names
      // here used to replace the valid result with an empty object and made
      // the real end-turn validator report "SC1 结构化数据为空".
      if(/据此产出完整史记/.test(u))out=Object.assign({},out,{shizhengji:'按既定材料完成本回合记录。',shilu_text:'本回合按既定事项推进。',szj_title:'常务办理',szj_summary:'常务按材料推进。'});
      return {choices:[{message:{content:JSON.stringify(out)}}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};
    };
    window._tmAIFetch=async function(url,opts){const data=await window._aiFetchWithRetry(url,opts&&opts.body);return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});};
    // Some production call sites use the transport directly instead of the
    // retry alias.  Keep the same deterministic fixture at the real renderer
    // fetch boundary too; all non-fixture resources retain the production
    // fetch implementation.
    const dutyRealFetch=window.fetch;
    window.fetch=async function(url,opts){
      const bodyText=opts&&opts.body!=null?String(opts.body):'';
      const isDutyAI=String(url).indexOf('https://office-duty-fixture.invalid/')===0
        || (opts&&String(opts.method||'').toUpperCase()==='POST'&&bodyText.indexOf('"messages"')>=0);
      if(isDutyAI){
        const data=await window._aiFetchWithRetry(url,opts&&opts.body);
        return new Response(JSON.stringify(data),{status:200,headers:{'content-type':'application/json'}});
      }
      return dutyRealFetch.apply(this,arguments);
    };
    // Keep the endTurn transaction and all deterministic systems real while
    // replacing only the external inference boundary with a valid result.
    window.__dutyInferCalls=0;window.__dutySetupCalls=0;
    window._endTurn_aiInfer=async function(edicts,xinglu,memRes,oldVars,externalCtx){
      window.__dutyInferCalls++;
      const result={timeRatio:1,shizhengji:'本回合按既定材料推进常务。',zhengwen:'按既定规则结算。',turnSummary:'常务办理',playerStatus:'办理中',playerInner:'继续核对事项。',shiluText:'本回合按既定事项推进。',szjTitle:'常务办理',szjSummary:'常务按材料推进。',hourenXishuo:'',personnelChanges:[],events:[{type:'office-duty-fixture',title:'常务结算',text:'按已知事项和既有规则完成本回合结算。'}],char_updates:[],office_assignments:[],fiscal_adjustments:[],changes:[],npc_actions:[],edictActions:{appointments:[],dismissals:[],deaths:[],armyBuilds:[],rewards:[],payArrears:[]}};
      if(externalCtx){externalCtx.results=externalCtx.results||{};externalCtx.results.sc1=result;externalCtx.results.aiResult=result;externalCtx.record=Object.assign(externalCtx.record||{},result);}
      if(typeof GM!=='undefined'){GM._turnAiResults=GM._turnAiResults||{};GM._turnAiResults.subcall1=result;}
      return result;
    };
    // The production inferer receives its model adapter from setupInfra.  Use
    // that exact adapter seam so the real end-turn pipeline remains intact even
    // when a build exposes the transport through a private lexical binding.
    const dutySetupInfra=TM.Endturn.AI.subcalls.setupInfra;
    TM.Endturn.AI.subcalls.setupInfra=function(ctx){
      window.__dutySetupCalls++;
      const configured=dutySetupInfra(ctx);
      ctx.subcalls._callEndturnAI=async function(){
        const parsed={turn_summary:'常务办理',shizhengji_basis:'既有事项材料',shilu_text:'本回合按既定事项推进。',szj_title:'常务办理',shizhengji:'本回合按既定材料推进常务。',szj_summary:'常务按材料推进。',zhengwen:'按既定规则结算。',player_status:'办理中',player_inner:'继续核对事项。',events:[{type:'office-duty-fixture',title:'常务结算',text:'按已知事项和既有规则完成本回合结算。'}],char_updates:[],edict_feedback:[],office_assignments:[],fiscal_adjustments:[],personnel_changes:[],changes:[],resource_changes:{}};
        const raw=JSON.stringify(parsed),data={choices:[{message:{content:raw},finish_reason:'stop'}],usage:{prompt_tokens:1,completion_tokens:1,total_tokens:2}};
        return {data,raw,parse:{parsed,raw,repaired:false,truncated:false}};
      };
      return configured;
    };
  })()`);
  async function fullTurn(requireFeedback=true) {
    await js(`(()=>{P.ai=P.ai||{};if(!P.ai.key)P.ai.key='office-duty-fixture';if(!P.ai.url)P.ai.url='https://office-duty-fixture.invalid/v1';})()`);
    await js(`(()=>{if(TM.UI&&TM.UI.turnResult&&typeof TM.UI.turnResult.closeTurnResult==='function')TM.UI.turnResult.closeTurnResult();})()`);
    await settle();
    await click('#gs-turn-big');
    await js(`(async()=>{for(let i=0;i<200&&!document.getElementById('cet-ok');i++)await new Promise(r=>setTimeout(r,50));const ok=document.getElementById('cet-ok');if(!ok)throw Error('missing formal end-turn confirmation '+JSON.stringify({turn:GM.turn,busy:GM.busy,endTurnBusy:GM._endTurnBusy,preSubmit:endTurn&&endTurn._preSubmitInFlight,buttonDisabled:document.getElementById('gs-turn-big')&&document.getElementById('gs-turn-big').disabled,buttonDisplay:document.getElementById('gs-turn-big')&&getComputedStyle(document.getElementById('gs-turn-big')).display,turnModal:document.getElementById('turn-modal')&&document.getElementById('turn-modal').className,topModal:typeof _tmTopModalLayer==='function'&&_tmTopModalLayer()&&_tmTopModalLayer().node&&_tmTopModalLayer().node.id,confirmType:TM.Endturn&&TM.Endturn.run&&typeof TM.Endturn.run.confirmEndTurn}));ok.click();})()`);
    // Select the ordinary "静候有司" branch so the top-level transaction
    // reaches its normal finalize boundary; the separate court-deferred path
    // is covered by the existing end-turn court tests.
    await js(`(async()=>{for(let i=0;i<40&&!document.getElementById('post-turn-court-prompt');i++)await new Promise(r=>setTimeout(r,50));if(document.getElementById('post-turn-court-prompt'))_postTurnCourtChoose(false);})()`);
    await js(`new Promise((resolve,reject)=>{const t=Date.now();(function poll(){if(!GM.busy&&!GM._endTurnBusy){resolve(true);return;}if(Date.now()-t>90000){reject(new Error('formal endTurn timeout'));return;}setTimeout(poll,100);})()})`);
    await settle();
    // A real request needs one turn to deliver the request and a later turn
    // to deliver the response.  The first call therefore intentionally stops
    // after the production turn commit while the matter remains in_transit.
    if(!requireFeedback){
      await js(`(()=>{if(TM.UI&&TM.UI.turnResult&&typeof TM.UI.turnResult.closeTurnResult==='function')TM.UI.turnResult.closeTurnResult();})()`);
      await settle();
      return;
    }
    await js(`new Promise((resolve,reject)=>{const t=Date.now();(function poll(){const p=GM._npcPlans[0],s=p&&p.status;if(s==='awaiting_feedback'||s==='done'){resolve(true);return;}if(Date.now()-t>30000){reject(new Error('local duty did not reach feedback: '+JSON.stringify({status:s,turn:GM.turn,busy:GM.busy,endTurnBusy:GM._endTurnBusy,preSubmit:endTurn&&endTurn._preSubmitInFlight,aiKey:!!(P&&P.ai&&P.ai.key),inferCalls:window.__dutyInferCalls||0,setupCalls:window.__dutySetupCalls||0,modelAttempts:window.__dutyModelAttempts||0,toast:document.getElementById('toast')&&document.getElementById('toast').textContent,pending:GM._pendingShijiModal&&{aiReady:GM._pendingShijiModal.aiReady,courtDone:GM._pendingShijiModal.courtDone},messages:p&&p.messages&&p.messages.map(m=>({kind:m.kind,status:m.status,deliveryTurn:m.deliveryTurn,sentTurn:m.sentTurn})),queued:GM._npcBehaviorPostTurnQueued})));return;}setTimeout(poll,100);})()})`);
  }
  await fullTurn(false);
  const firstStatus=await js(`GM._npcPlans[0]?.status`);
  if(firstStatus==='in_transit'||firstStatus==='awaiting_response')await fullTurn(true);
  await check('production time and local dispatch reach a real payment and player feedback', async () => {
    const r = await js(`(()=>({turn:GM.turn,status:GM._npcPlans[0]?.status,source:GM.officeTree[0].publicTreasury.money.stock,dest:GM.officeTree[1].publicTreasury.money.stock,transfers:(GM._publicTreasuryTransfers||[]).length,policy:!!GM._npcDutyMatters[0]?.transferPolicy,systems:!!GM._lastEndturnSystemsTimings,modelAttempts:window.__dutyModelAttempts||0}))()`);
    assert.equal(r.status, 'awaiting_feedback', JSON.stringify(r)); assert.equal(r.source,42); assert.equal(r.dest,8); assert.equal(r.transfers,1); assert(r.policy);
    assert(r.turn > 1 && r.systems, JSON.stringify(r));
  });
  const timeline = [];
  timeline.push(await js(`(()=>({stage:'paid-before-save',day:TM.SimTime&&TM.SimTime.now?TM.SimTime.now(GM):GM.turn,turn:GM.turn,planId:GM._npcPlans[0].id,status:GM._npcPlans[0].status,source:GM.officeTree[0].publicTreasury.money.stock,dest:GM.officeTree[1].publicTreasury.money.stock,transfers:(GM._publicTreasuryTransfers||[]).length}))()`));
  const saved = await js(`(async()=>{const x=await tianming.saveProject('正式常务隔离验收',_buildSaveState({format:'project',detach:true}));if(!x.success)throw Error(x.error||'save failed');return x;})()`);
  assert(saved && saved.success);
  const reloaded = await js(`(async()=>{const list=await tianming.listSaves(),row=list.files.find(x=>x.storageKey===${JSON.stringify(saved.storageKey)});if(!row)throw Error('saved row missing');const loaded=await tianming.loadProject(row);if(!loaded.success)throw Error(loaded.error||'load failed');const before=window._tmLoadGen||0;await fullLoadGame(loaded.data,{source:'office-duty-browser-reload',preserveTimeline:true});return{before,after:window._tmLoadGen||0,turn:GM.turn,status:GM._npcPlans[0]?.status,source:GM.officeTree[0].publicTreasury.money.stock,dest:GM.officeTree[1].publicTreasury.money.stock,transfers:(GM._publicTreasuryTransfers||[]).length};})()`);
  timeline.push(Object.assign({stage:'reloaded',saveKey:saved.storageKey}, reloaded));
  assert(reloaded.after > reloaded.before && reloaded.status === 'awaiting_feedback' && reloaded.transfers === 1, JSON.stringify(reloaded));
  await js(`(()=>{TMPhase8FormalBridge.openPanel('archive');renderOfficeTree(true);})()`); await settle();
  await click('[data-office-duty-response="satisfied"][data-office-duty-plan="' + (await js(`GM._npcPlans[0].id`)) + '"]');
  await fullTurn();
  timeline.push(await js(`(()=>({stage:'feedback-after-reload',day:TM.SimTime&&TM.SimTime.now?TM.SimTime.now(GM):GM.turn,turn:GM.turn,status:GM._npcPlans[0].status,source:GM.officeTree[0].publicTreasury.money.stock,dest:GM.officeTree[1].publicTreasury.money.stock,transfers:(GM._publicTreasuryTransfers||[]).length}))()`));
  await check('feedback and desktop save preserve one terminal result', async () => {
    const r=await js(`(()=>({status:GM._npcPlans[0]?.status,transfers:(GM._publicTreasuryTransfers||[]).length,source:GM.officeTree[0].publicTreasury.money.stock,timeline:JSON.parse(${JSON.stringify(JSON.stringify(timeline))})}))()`);
    assert.equal(r.status,'done');assert.equal(r.transfers,1);assert.equal(r.source,42);
    assert(r.timeline.length===3,JSON.stringify(r));
    fs.writeFileSync(path.join(process.env.TM_BRIDGE_TEST_REPORT ? path.dirname(process.env.TM_BRIDGE_TEST_REPORT) : root, 'office-duty-timeline.json'), JSON.stringify({head:require('child_process').execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),stages:r.timeline,modelAttempts:await js(`window.__dutyModelAttempts||0`),externalRequests:0},null,2)+'\n');
  });
};
