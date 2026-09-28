'use strict';
// Load shipped modules. Only browser/network infrastructure is simulated.
const fs=require('fs'),path=require('path'),vm=require('vm');
const web=path.resolve(__dirname,'..');
function fixture(options={}){
  let seq=0;
  const element=()=>({style:{},classList:{add(){},remove(){}},addEventListener(){},appendChild(){},remove(){},querySelector(){return null;},querySelectorAll(){return [];}});
  const c={console,Date,Math,JSON,Object,Array,Number,String,Boolean,RegExp,Map,Set,WeakMap,Promise,Symbol,isFinite,isNaN,parseInt,parseFloat,
    setTimeout,clearTimeout,setInterval(){},clearInterval(){},_dbg(){},uid:()=> 'fixture-'+(++seq),random:()=>0.5,clamp:(x,a,b)=>Math.max(a,Math.min(b,x)),
    document:{getElementById(){return null;},querySelectorAll(){return [];},createElement:element,addEventListener(){},body:element()},
    SettlementPipeline:{register(){}},getTSText:t=>'T'+t,_getDaysPerTurn:()=>30,getCompressionParams:()=>({scale:1}),escHtml:String,
    P:{ai:{key:'fixture-only'},playerInfo:{characterName:'君主',factionName:'朝廷'},traitDefinitions:[{id:'greedy',dims:{greed:0.8}},{id:'kind',dims:{compassion:0.8}},{id:'honorable',dims:{honor:0.8}}]},
    GM:{sid:'npc-fixture',turn:2,running:true,chars:[],facs:[],armies:[],vars:{},rels:{},officeTree:[],memorials:[],letters:[],evtLog:[],_capital:'京师',_turnContext:{npcActionsThisTurn:[]},_npcPlans:[],guoku:{money:1000,balance:1000,grain:100,cloth:50,ledgers:{money:{stock:1000},grain:{stock:100},cloth:{stock:50}}}}};
  c.window=c;c.globalThis=c;c.addEventListener=()=>{};c.findCharByName=n=>c.GM.chars.find(x=>x.name===n)||null;c.findFacByName=n=>c.GM.facs.find(x=>x.name===n||x.id===n)||null;
  c.addEB=(type,text)=>c.GM.evtLog.push({type,text});c.callAI=async()=>{throw Error('real model forbidden in fixture');};
  vm.createContext(c);
  c.load=f=>vm.runInContext(options.source?options.source(f):fs.readFileSync(path.join(web,f),'utf8'),c,{filename:f});
  ['tm-office-holder-state.js','tm-office-system.js','tm-public-treasury.js','tm-npc-engine.js','tm-npc-action-ledger.js','tm-npc-decision.js','tm-npc-decision-ai-driven.js','tm-help-social.js','tm-relations.js','tm-mechanics-memory.js','tm-ai-change-pathutils.js','tm-ai-change-army.js','tm-ai-change-narrative.js','generated/tm-ai-change-applier.bundle.js','tm-post-turn-jobs.js'].forEach(c.load);
  c.actor=(id,name,extra={})=>{const ch={id,name,alive:true,loyalty:80,ambition:30,intelligence:50,location:'京师',faction:'朝廷',...extra};c.GM.chars.push(ch);return ch;};
  c.execute=(npc,type,extra={})=>c._executeNormalizedNpcDecision({name:npc.name,actorId:npc.id,behaviorType:type,shouldExecute:true,intent:type,...extra},npc,c.buildNpcBehaviorContext());
  return c;
}
module.exports={fixture,web};
