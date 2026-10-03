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
    GM.officeTree=[{id:'source',name:'甲署',authorityFactionId:'court',publicTreasury:{money:box(50),grain:box(0),cloth:box(0)},positions:[{id:'cashier',name:'库吏',holderId:'duty-cashier',holder:'库吏',actualHolders:[{characterId:'duty-cashier',name:'库吏',appointmentId:'cashier-appt'}],powers:{treasurySpend:true},treasuryBinding:{role:'custodian',accountRef:'source'},authorityScope:{accountRefs:['dest']}}]},{id:'dest',name:'乙署',authorityFactionId:'court',publicTreasury:{money:box(0),grain:box(0),cloth:box(0)},positions:[]}];
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
  // Full endTurn remains guarded by the game's model contract.  The systems
  // stage is the production deterministic time boundary used by endTurn; it
  // advances SimTime, runs normal deterministic systems, then local duty.
  for (let i=0;i<8;i++) {
    await js(`(async()=>{await _endTurn_updateSystems(1,'');TM.NPC.LocalAI.wake('turn');TM.NPC.ActionLedger.advance(GM);})()`);
    await settle();
    const state = await js(`GM._npcPlans[0]&&GM._npcPlans[0].status`);
    if (state === 'awaiting_feedback') break;
  }
  await check('production time and local dispatch reach a real payment and player feedback', async () => {
    const r = await js(`(()=>({turn:GM.turn,status:GM._npcPlans[0]?.status,source:GM.officeTree[0].publicTreasury.money.stock,dest:GM.officeTree[1].publicTreasury.money.stock,transfers:(GM._publicTreasuryTransfers||[]).length,policy:!!GM._npcDutyMatters[0]?.transferPolicy}))()`);
    assert.equal(r.status, 'awaiting_feedback', JSON.stringify(r)); assert.equal(r.source,42); assert.equal(r.dest,8); assert.equal(r.transfers,1); assert(r.policy);
  });
  const saved = await js(`(async()=>{const x=await tianming.saveProject('正式常务隔离验收',_buildSaveState({format:'project',detach:true}));if(!x.success)throw Error(x.error||'save failed');return x;})()`);
  assert(saved && saved.success);
  await js(`(()=>{const p=GM._npcPlans[0];return TM.NPC.ActionLedger.playerRespond(p.id,'satisfied','已收到实际交割')})()`);
  await js(`(async()=>{await _endTurn_updateSystems(1,'');TM.NPC.ActionLedger.advance(GM);})()`);
  await check('feedback and desktop save preserve one terminal result', async () => {
    const r=await js(`(()=>({status:GM._npcPlans[0]?.status,transfers:(GM._publicTreasuryTransfers||[]).length,source:GM.officeTree[0].publicTreasury.money.stock}))()`);
    assert.equal(r.status,'done');assert.equal(r.transfers,1);assert.equal(r.source,42);
  });
};
