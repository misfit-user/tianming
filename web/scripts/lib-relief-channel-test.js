'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),acorn=require('acorn'),cp=require('child_process');
const root=path.resolve(__dirname,'../..');
function source(file){return process.argv.includes('--baseline') ? cp.execFileSync('git',['show','a2666590:web/'+file],{cwd:root,encoding:'utf8',maxBuffer:8e6}) : fs.readFileSync(path.join(root,'web',file),'utf8');}
function load(c,file){vm.runInContext(source(file),c,{filename:file});}
// Exact AST-selected production declarations: no success stubs for policy/fiscal functions.
function functions(c,file,names){const s=source(file),ast=acorn.parse(s,{ecmaVersion:'latest'}),found=new Map();
  function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id&&names.includes(n.id.name))found.set(n.id.name,s.slice(n.start,n.end));Object.values(n).forEach(v=>{if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);});}walk(ast);
  for(const name of names){if(!found.has(name))throw Error('missing production function '+name);vm.runInContext(found.get(name),c,{filename:file+':'+name});}}
function context(){let seq=0;const elements={};const c={console,Promise,setTimeout:()=>0,clearTimeout(){},setInterval:()=>0,clearInterval(){},
  P:{conf:{},ai:{key:'isolated-test-key'},playerInfo:{factionName:'朝廷'}},_tmLoadGen:1,TM:{},
  GM:{turn:2,_campaignId:'campaign',_timelineId:'timeline',vars:{},memorials:[],facs:[],currentIssues:[],letters:[],_edictTracker:[],transferOrders:[],
    guoku:{money:100000,balance:100000},neitang:{money:30000,balance:30000},
    chars:[{id:'c1',name:'王明',alive:true,loyalty:70,stress:5}],regions:[{id:'r1',name:'河东'}],fiscal:{regions:{r1:{regionId:'r1',name:'河东',ledgers:{money:50000,grain:0,cloth:0}}}}},
  uid:()=> 'test-'+(++seq),_$:id=>elements[id]||null,recordPlayerDecision(){},resetTurnChanges(){},generateChancellorSuggestions:()=>[],
  getTSText:t=>'T'+t,_isSameLocation:(a,b)=>a===b,addEB(){},toast(){},renderMemorials(){},addCYBubble(){},
  CurrencyEngine:{REFORM_PRESETS:[]},HujiEngine:{},AuthorityComplete:{triggerHuangweiEvent(){}},
  document:{getElementById:id=>elements[id]||null,querySelectorAll:()=>[]},elements};
  c.window=c;c.globalThis=c;c.global=c;c.findCharByName=n=>c.GM.chars.find(x=>x.name===n)||null;
  vm.createContext(c);
  load(c,'tm-fiscal-engine.js');load(c,'tm-economy-engine.js');load(c,'tm-edict-parser.js');load(c,'tm-relief-governance.js');load(c,'tm-edict-oversight.js');
  return c;}
function prep(c){functions(c,'tm-endturn-edict.js',['extractEdictActions','extractCustomPolicies']);functions(c,'tm-endturn-prep.js',['_endTurn_collectInput']);}
function memorial(c){functions(c,'tm-memorials.js',['_stageMemorialDecision','_approveMemorial','_rejectMemorial','_annotateMemorial','_commitMemorialDecisions']);
  c._memResolve=i=>c.GM.memorials[i];c._memMarkIllegalPresenter=()=>false; // fixture has one legal current-court presenter; no policy stub.
}
function hongyan(c){functions(c,'tm-hongyan-office.js',['_ltUpdateEdictTrackerForLetter','_ltApplyFormalPolicyOnDelivery']);}
function court(c){functions(c,'tm-chaoyi-changchao.js',['_cc3_courtPolicyText','_cc3_applyCourtPolicyBridge','_cc3_writeActionToGM']);}
function tinyi(c){functions(c,'tm-chaoyi-tinyi.js',['_ty2_decide']);c._ty2_countStances=()=>({support:2,oppose:0});c._ty2_groupByStance=()=>({support:[],oppose:[]});c._cy_jishiAdd=()=>{};c.CY={_ty2:{topic:'赈济河东灾民',topicType:'relief',attendees:[]}};}
function entries(c){return c.TM.ReliefGovernance.list(c.GM).entries;}
module.exports={context,load,functions,prep,memorial,hongyan,court,tinyi,entries};
