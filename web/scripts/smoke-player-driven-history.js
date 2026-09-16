'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const W=process.argv[2]||path.resolve(__dirname,'../..'),web=path.join(W,'web');
const read=f=>fs.readFileSync(path.join(web,f),'utf8');
function functionSource(file,name){const s=read(file);let start=s.indexOf('function '+name+'(');assert(start>=0,name);if(s.slice(start-6,start)==='async ')start-=6;const end=s.indexOf('\n}',start);assert(end>start,name+' end');return s.slice(start,end+2);}
let checks=0;function check(value,note){assert(value,note);checks++;}
const scenarios={open:{id:'open',worldSettings:{historicalOutcomePolicy:'player-driven'}},legacy:{id:'legacy',worldSettings:{}}};
const ctx={console:{log(){},warn(){},error(){}},P:{conf:{gameMode:'yanyi'},time:{year:840},worldSettings:{historicalOutcomePolicy:'player-driven'},ai:{},keju:{}},GM:{sid:'open',year:840,chars:[],allCharacters:[]},findScenarioById:id=>scenarios[id],HISTORICAL_CHAR_PROFILES:{sushi:{name:'苏轼',birthYear:1037,deathYear:1101},du:{name:'杜牧',birthYear:803,deathYear:852}},Math:Object.create(Math)};
ctx.Math.random=()=>0;ctx.window=ctx;ctx.global=ctx;vm.createContext(ctx);
vm.runInContext(read('tm-prompt-composer.js'),ctx,{filename:'tm-prompt-composer.js'});
const H=ctx.TM.HistoricalAgency;
check(H.isPlayerDriven(),'active scenario policy read');ctx.GM.sid='legacy';check(!H.isPlayerDriven(),'stale P policy cannot override current scenario');check(H.isPlayerDriven(scenarios.open),'explicit selected scenario wins before new start');ctx.GM.sid='open';
check(!H.temporalEligibility({name:'苏轼',birthYear:800,deathYear:900}).ok,'known birth date rejects disguised future person');
check(!H.temporalEligibility({name:'未定年代'}).ok,'missing birth refused for new historical candidate');
check(!H.temporalEligibility({name:'未来人',birthYear:850,deathYear:910}).ok,'future birth refused');
check(!H.temporalEligibility({name:'已故者',birthYear:700,deathYear:800}).ok,'past dead refused');
check(H.temporalEligibility({name:'杜牧'},{minAge:18,maxAge:60}).age===37,'age derives from current year');
check(!H.temporalEligibility({name:'幼者',birthYear:830,deathYear:880},{minAge:18,maxAge:60}).ok,'recruitment age enforced');
ctx.GM.chars=[{name:'活在本局',alive:true,age:60}];check(H.temporalEligibility({name:'活在本局',birthYear:780,deathYear:830}).ok,'in-world survival overrides original death');
ctx.GM.chars[0].alive=false;check(!H.temporalEligibility({name:'活在本局',birthYear:780,deathYear:890}).ok,'in-world death blocks');ctx.GM.chars=[];
vm.runInContext(read('tm-ceming.js'),ctx,{filename:'tm-ceming.js'});
for(const mode of ['yanyi','light_hist','strict_hist']){ctx.P.conf.gameMode=mode;check(!ctx.TM.ceming.canSummon({name:'苏轼',birthYear:1037,deathYear:1101}).ok,'summon gate '+mode);}
ctx.GM.sid='legacy';ctx.P.conf.gameMode='yanyi';check(ctx.TM.ceming.canSummon({name:'苏轼',birthYear:1037,deathYear:1101}).ok,'legacy romance still permits cross-time');ctx.GM.sid='open';

const ep=read('tm-endturn-prompt.js'),modeStart=ep.indexOf("    var gameModeDesc = '';"),modeEnd=ep.indexOf('    var _promptComposer =',modeStart);
check(modeStart>=0&&modeEnd>modeStart,'real main prompt block found');
ctx.sc=scenarios.open;
for(const mode of ['yanyi','light_hist','strict_hist']){
 ctx._getModeParams=()=>({mode});vm.runInContext(ep.slice(modeStart,modeEnd),ctx);
 const text=ctx.TM.PromptComposer.buildBase({sc:ctx.sc,P:ctx.P,gameModeDesc:ctx.gameModeDesc,historicalCharLimit:ctx.historicalCharLimit});
 check(text.includes('后续历史不预定'),'main actual mode block '+mode);check(!/全部历史名臣都有概率出现|前后100年|前后200年|关键行为应发生/.test(text),'old conflicting main restrictions absent '+mode);
}
ctx.P.ai.prompt='自选文风';check(ctx.TM.PromptComposer.buildBase({sc:scenarios.open,P:ctx.P}).includes('本局历史与选择'),'custom prompt still receives policy');delete ctx.P.ai.prompt;
const core=read('tm-endturn-core.js'),fStart=core.indexOf("EndTurnHooks.registerFragment('game-mode',"),fEnd=core.indexOf("}, { position: 'prefix' });",fStart);ctx.EndTurnHooks={registerFragment:(id,fn)=>{ctx.modeFragment=fn;}};
vm.runInContext(core.slice(fStart,fEnd+"}, { position: 'prefix' });".length),ctx);
ctx.P.conf.gameMode='strict_hist';check(!ctx.modeFragment({}).includes('不得虚构人物或事件'),'strict prefix does not negate authored cast');ctx.GM.sid='legacy';check(ctx.modeFragment({}).includes('不得虚构人物或事件'),'legacy strict prefix unchanged');ctx.GM.sid='open';
vm.runInContext(read('tm-history-advisor.js'),ctx,{filename:'tm-history-advisor.js'});
const req=ctx.TM.HistoryAdvisor.buildRequest(ctx.GM,{mode:'strict_hist',era:'唐',role:'皇帝',edictText:'改元长宁，罢不合用者，与邻国修好',turn:1});check(req.system.includes('不同于原史的年号'),'advisor accepts chosen era');check(!req.system.includes('现实必然的反噬'),'advisor does not predetermine punishment');
vm.runInContext(read('tm-indices.js'),ctx,{filename:'tm-indices.js'});ctx.findScenarioById=id=>scenarios[id];
let refused=false;try{ctx.createRuntimeCharacter({name:'苏轼',isHistorical:false,age:30});}catch(e){refused=/史实不可现/.test(e.message);}check(refused&&ctx.GM.chars.length===0,'common ingress rejects a disguised future profile before insertion');
check(ctx.createRuntimeCharacter({name:'本地新书吏',isHistorical:false,age:30}).name==='本地新书吏','ordinary fictional characters still enter');ctx.GM.chars=[];
refused=false;try{ctx.createRuntimeCharacter({name:'未知史实名',isHistorical:true,age:30});}catch(e){refused=/史实不可现/.test(e.message);}check(refused&&ctx.GM.chars.length===0,'historical ingress needs birth date');

ctx.toChineseReignYear=n=>String(n);vm.runInContext(functionSource('tm-ai-infra.js','getEraDisplay'),ctx);
ctx.GM.eraNames=[{name:'开成',startYear:836,startMonth:1,startDay:1},{name:'长宁',startYear:840,startMonth:2,startDay:1}];
check(ctx.getEraDisplay(841,1,1).era==='长宁','player era persists into 841');check(ctx.getEraDisplay(845,1,1).era==='长宁','no automatic Huichang era switch');
const sc=JSON.parse(fs.readFileSync(path.join(W,'scenarios/晚唐·开成五年（官方）.json'),'utf8'));check(!sc.time.eraNames.some(e=>e.startYear>840),'scenario has no preset future era');check(H.isPlayerDriven(sc),'actual W scenario declares player-driven policy');

let fired=0;ctx.getCurrentYear=()=>841;ctx.getCurrentMonth=()=>1;ctx._rigidHistoryEventShouldFire=()=>true;ctx._applyRigidHistoryDeath=()=>{};ctx.showHistoryEventModal=()=>fired++;
vm.runInContext(functionSource('tm-history-events.js','checkHistoryEvents'),ctx);
ctx.GM.rigidHistoryEvents=[{id:'future',name:'预设改元',trigger:{year:841,month:1}}];ctx.checkHistoryEvents();check(fired===0,'policy blocks scheduled legacy outcome');ctx.GM.sid='legacy';ctx.checkHistoryEvents();check(fired===1,'legacy scheduled event behavior remains');ctx.GM.sid='open';

const cm=read('tm-class-mobility.js'),hStart=cm.indexOf('  function _checkHuichangDestructBuddhism(ctx) {'),hEnd=cm.indexOf('\n  // ═',hStart);vm.runInContext(cm.slice(hStart,hEnd),ctx);
ctx.GM.dynasty='唐';ctx.GM._recentEdictText='不得毁佛，保护寺院';ctx.GM.population={byCategory:{sengdao:{mouths:300000},bianhu:{mouths:1000}}};ctx.GM.guoku={money:0,grain:0};ctx._checkHuichangDestructBuddhism({});check(!ctx.GM._huichangDone&&ctx.GM.guoku.money===0,'negative edict cannot paste historical totals under policy');

ctx.P.keju={historicalFigurePolicy:{enableHistorical:true}};ctx.P.ai={key:'unit-test-stub'};ctx.P.dynasty='唐';ctx.P.conf.gameMode='yanyi';ctx.findCharByName=()=>null;ctx.extractJSON=JSON.parse;
let candidatePrompt='';ctx.callAISmart=async text=>{candidatePrompt=text;return JSON.stringify([{name:'苏轼',birthYear:800,deathYear:900,age:40,nativeEra:'唐',probability:1},{name:'杜牧',birthYear:803,deathYear:852,age:37,nativeEra:'唐',probability:1},{name:'未来未生',birthYear:880,deathYear:920,age:30,nativeEra:'唐',probability:1},{name:'缺生年',age:30,nativeEra:'唐',probability:1}]);};
vm.runInContext(functionSource('tm-keju.js','_kejuHistoricalWindow')+'\n'+functionSource('tm-keju.js','pickHistoricalCandidates'),ctx);
(async()=>{const candidates=await ctx.pickHistoricalCandidates({});check(candidates.length===1&&candidates[0].name==='杜牧','actual candidate filter rejects future and unknown dates');check(!candidatePrompt.includes('任意朝代历史名臣皆可'),'candidate prompt drops romance cross-era allowance');console.log(JSON.stringify({status:'PASS',checks,year:840,modePolicy:'player-driven',chosenEra:'长宁',networkCalls:0,scope:'actual pure builders and consumers with controlled fixtures; not an online AI campaign'}));})().catch(e=>{console.error(e);process.exitCode=1;});
