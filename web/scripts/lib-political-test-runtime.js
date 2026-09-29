'use strict';
// Full production boundary for older focused smoke sandboxes. No domain function is reimplemented.
const fs=require('fs'),path=require('path'),vm=require('vm');
const files=['tm-office-holder-state.js','tm-office-system.js','tm-public-treasury.js','tm-npc-engine.js','tm-npc-action-ledger.js','tm-npc-decision.js','tm-npc-decision-ai-driven.js','tm-help-social.js','tm-relations.js','tm-mechanics-memory.js','tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js','tm-political-actions.js','tm-feudal-warfare.js','tm-faction-action-engine.js','tm-faction-diplomacy.js'];
function install(c){
 const element=()=>({style:{},classList:{add(){},remove(){}},addEventListener(){},appendChild(){},remove(){},querySelector(){return null;},querySelectorAll(){return [];}});
 Object.assign(c,{Map,WeakMap,WeakSet,Set,Promise,Symbol});
 const defaults={setTimeout,clearTimeout,setInterval(){},clearInterval(){},_dbg(){},uid:()=> 'smoke-'+Math.random().toString(36).slice(2),random:()=>0.5,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),document:{getElementById(){return null;},querySelectorAll(){return [];},createElement:element,addEventListener(){},body:element()},SettlementPipeline:{register(){}},getTSText:t=>'T'+t,_getDaysPerTurn:()=>30,getCompressionParams:()=>({scale:1}),escHtml:String,addEventListener(){},addEB(){}};
 for(const [k,v] of Object.entries(defaults))if(c[k]==null)c[k]=v;
 for(const f of files)vm.runInContext(fs.readFileSync(path.resolve(__dirname,'..',f),'utf8'),c,{filename:f});
 return c;
}
// Explicit synthetic offices for scheduling tests that used to have only faction labels.
function schedulingWorld(c){
 c.GM.chars=[];c.GM.officeTree=[];c.GM.memorials=[];c.GM.rels={};c.GM._npcPlans=[];c.GM.running=true;c.GM.sid='scheduling-fixture';
 c.GM.facs.forEach((f,i)=>{f.id='schedule-faction-'+i;const ch={id:'schedule-character-'+i,name:f.name+'-ruler',alive:true,faction:f.name,factionId:f.id,location:'test-capital',isPlayer:f.name==='PLAYER'};c.GM.chars.push(ch);f.officeTree=[{id:'test-dept-'+i,positions:[{id:'test-role-'+i,name:'Test representative',holderId:ch.id,powers:{diplomacy:true,treatySign:true}}]}];});
}
function bindNamedTestCallers(c){
 let sequence=0;
 function binding(ref,opts={}){
  const B=c.TM.PoliticalActions,g=c.GM;if(!g)return null;
  g.chars=g.chars||[];g.officeTree=g.officeTree||[];g._npcPlans=g._npcPlans||[];g.memorials=g.memorials||[];g.rels=g.rels||{};
  for(const f of g.facs||[]){
   if(!f.id)f.id='test-faction:'+f.name;
   if(!g.chars.some(ch=>ch.id==='test-rep:'+f.id))g.chars.push({id:'test-rep:'+f.id,name:'Test representative '+f.id,alive:true,faction:f.name,factionId:f.id,location:'test-meeting'});
   if(!f.officeTree)f.officeTree=[{id:'test-office:'+f.id,positions:[{id:'test-seat:'+f.id,name:'Test seat',holderId:'test-rep:'+f.id,powers:{declareWar:true,diplomacy:true,treatySign:true}}]}];
  }
  const f=B.resolve('organization',ref);return f&&B.bind(f,'test-rep:'+f.id,{actingPositionId:'test-seat:'+f.id,sourceId:opts.sourceId||'test-command:'+ ++sequence});
 }
 const engine=c.TM.FactionActionEngine,apply=engine.applyDecision;engine.applyDecision=(f,d,o={})=>apply(f,d,{...o,binding:binding(f,o)});
 const D=c.TM.FactionDiplomacy,record=D.recordProposals,respond=D.applyResponses;
 D.recordProposals=(f,rows,turn,o={})=>{const r=record(f,rows,turn,{...o,binding:binding(f,o)});D.advance();return r;};
 D.applyResponses=(f,rows,turn,o={})=>respond(f,rows.map(r=>({...r,proposalVersion:r.proposalVersion??D.get(r.proposalId||r.id)?.version})),turn,{...o,binding:binding(f,o)});
}
module.exports={install,schedulingWorld,bindNamedTestCallers};
