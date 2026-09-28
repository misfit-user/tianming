'use strict';
// Complete official startup, player-input collector, real SC1 writeback and actual save loader.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict'),{createRequire}=require('module');
const root=path.resolve(__dirname,'../..'),file=path.join(__dirname,'smoke-start-game-data-integrity.js');
const source=fs.readFileSync(file,'utf8').replace(/^#![^\n]*\n/,''),end=source.indexOf('(async function main()');assert(end>0);
const helper=new Function('require','process','__dirname','__filename','module','exports',source.slice(0,end)+'\nreturn {loadGame,dispose:()=>disposeGame()};')(createRequire(file),process,__dirname,file,{exports:{}},{});
let count=0;function ok(value,message){assert(value,message);count++;}
(async()=>{
 const c=helper.loadGame(null);c.__source=JSON.parse(fs.readFileSync(path.join(root,'scenarios/天启七年·九月（官方）.json'),'utf8'));
 vm.runInContext("P.scenarios=P.scenarios.filter(s=>s.id!==__source.id);P.scenarios.push(__source);P.ai.key='';P.ai.url='';P.ai.model='';doActualStart(__source.id);",c,{timeout:60000});await new Promise(r=>setTimeout(r,250));
 const G=c.GM,original=c.P.officeTree&&JSON.stringify(c.P.officeTree),ch=G.chars.find(x=>x.name==='崔呈秀');ok(ch&&ch.id,'official character is loaded with a stable ID');
 const text='将崔呈秀革职抄家，拘押候勘。';G.edicts=[{id:'dismiss-official',turn:G.turn,text,status:'promulgated'}];
 for(const id of ['edict-pol','edict-mil','edict-dip','edict-eco','edict-oth']){const el=c.document.getElementById(id);if(el)el.value='';}
 if(c.TMPhase8FormalBridge?.clearEdictDrafts)c.TMPhase8FormalBridge.clearEdictDrafts();
 const input=c._endTurn_collectInput();ok(input.edicts.decree===text,'actual collector supplies the full decree');
 const pc={name:'崔呈秀',former:'兵部尚书·总督京营戎政',change:'革职抄家·拘押候勘',reason:'奉玩家诏令查办',edictId:'dismiss-official'};
 const p1={turn_summary:'崔呈秀革职抄家，拘押候勘。',shizhengji:'【人事】有司奉旨将崔呈秀革职抄家，拘押候勘。',shilu_text:'革崔呈秀职，拘押候勘。',personnel_changes:[pc],edict_feedback:[{edictId:'dismiss-official',status:'completed',assignee:'有司',feedback:'崔呈秀已革职，拘押候勘。',effectRefs:['personnel_changes[0]']}]};
 const ctx={input,prompt:{sc:c.__source},results:{sc1:p1},record:{},apply:{},meta:{warnings:[],requireMainWriteback:true,requireTurnReview:false}};
 await c.TM.Endturn.AI.apply.writeBack(ctx);
 function check(label){const who=c.GM.chars.find(x=>x.id===ch.id);ok(!who.officialTitle&&!who.title&&!who.position,label+' character has no old office');ok(who._imprisoned===true,label+' custody applies');const seats=[];c._offWalkOfficeTree(c.GM.officeTree,n=>{for(const p of n.positions||[])seats.push(p);});ok(!seats.some(p=>p.holderId===ch.id||p.holder==='崔呈秀'||(p.actualHolders||[]).some(h=>h.characterId===ch.id||h.name==='崔呈秀')),label+' no seat retains the dismissed person');ok(!c._offFormatCharTitles(who),label+' portrait title source is empty');}
 check('after writeback');c._offSyncHoldersFromChars({force:true,importSeats:true});check('after tree refresh');
 const receipts=c.TM.EdictOutcomes.forTurn(c.GM,G.turn),receipt=receipts.find(r=>r.edictId==='dismiss-official');ok(receipt&&receipt.effects.some(e=>e.path.endsWith('.officialTitle')&&!e.after&&e.before),'edict receipt records actual title removal');
 const html=c._composeShijiHtml({turn:G.turn,personnelChanges:ctx.record.personnelChanges,edictReports:receipts,shiluText:p1.shilu_text,shizhengji:p1.shizhengji,oldVars:input.oldVars});ok(html.includes('崔呈秀')&&html.includes('革职抄家'),'actual chronicle contains the executed personnel result');
 c._prepareGMForSave(c.GM,c.P,{});const saved=JSON.parse(JSON.stringify({gameState:{GM:c.GM,P:c.P}}));await c._fullLoadGameImpl(saved,{nativeStart:true});check('after real load');
 if(original)ok(JSON.stringify(c.P.officeTree)===original,'source office template is unchanged');
 console.log('[smoke-personnel-dismissal-official] PASS '+count+' assertions');helper.dispose();
})().catch(e=>{console.error(e.stack);helper.dispose();process.exitCode=1;});
