#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const WEB=path.resolve(__dirname,'..');let checks=0;
function eq(a,b,m){checks++;assert.strictEqual(a,b,m)}
function near(a,b,m){checks++;assert.ok(Math.abs(a-b)<1e-8,m+': '+a+' vs '+b)}
function ok(v,m){checks++;assert.ok(v,m)}
function clone(x){return JSON.parse(JSON.stringify(x))}
function fixture(v2=true,{classBridge=false}={}){
 const math=Object.create(Math);math.random=()=>.5;
 const s={console:{log(){},warn(){},error(e){throw e}},Math:math,Date,JSON,RegExp,Error,Array,Object,String,Number,Boolean,parseInt,parseFloat,isNaN,isFinite,setTimeout(){return 1},clearTimeout(){},setInterval(){return 1},clearInterval(){},addEB(){}};
 s.window=s;s.global=s;s.globalThis=s;s.TM={errors:{capture(e){throw e},captureSilent(e){throw e}}};
 function leaf(id,m,mx,corr){return{id,name:id,populationDetail:{mouths:m,households:m/5,ding:m*.3,registeredMouths:m/2,registeredHouseholds:m/10,registeredDing:m*.15},minxin:mx,minxinLocal:mx,corruption:corr,corruptionLocal:corr};}
 const a=leaf('a',1000,40,30),b=leaf('b',3000,60,70),foreign=leaf('foreign',100000,99,99);
 const classes=[{id:'self',name:'自耕户',satisfaction:51},{id:'tenant',name:'佃户',satisfaction:37}];
 s.P={id:'declared',dynasty:'唐',classes,authorityConfig:{initial:{huangquan:42,huangquanSubDims:{central:62,provincial:42,military:28,imperial:24},huangwei:53,huangweiSubDims:{court:47,provincial:56,military:43,foreign:66}}},corruption:{trueIndex:58,perceivedIndex:40,subDepts:{central:{true:44,perceived:33},provincial:{true:54,perceived:39},military:{true:68,perceived:45},fiscal:{true:57,perceived:41},judicial:{true:50,perceived:38},imperial:{true:76,perceived:49}},supervision:{level:38},countermeasures:{rotation:.12}}};
 if(v2){s.P.authorityConfig.accounting={schema:'tm-authority-ledger/2'};s.P.corruption.accounting={schema:'tm-corruption-ledger/2',departmentWeights:{central:1,provincial:1,military:1,fiscal:1,judicial:1,imperial:1}};}
 s.GM={sid:'declared',turn:1,playerFactionId:'tang',classes:clone(classes),chars:[],armies:[],facs:[{id:'tang',name:'唐',isPlayer:true}],adminHierarchy:{player:{factionId:'tang',divisions:[a,b]},foreign:{factionId:'foreign',divisions:[foreign]}},regions:[{id:'a',name:'a'},{id:'b',name:'b'}],guoku:{},settings:{},population:{national:{mouths:4000,households:800,ding:1200}}};
 s.findScenarioById=()=>s.P;vm.createContext(s);
 for(const f of ['tm-corruption-engine.js','tm-authority-engines.js','tm-integration-bridge.js','tm-authority-complete.js'].concat(classBridge?['tm-class-minxin-bridge.js']:[]))vm.runInContext(fs.readFileSync(path.join(WEB,f),'utf8'),s,{filename:f});
 return{s,a,b,foreign};
}

{
 const {s,a,b,foreign}=fixture();const A=s.AuthorityEngines,C=s.CorruptionEngine,G=s.GM;
 C.initFromDynasty('唐','decline',s.P);A.init();s.AuthorityComplete.init();
 eq(G.huangquan.index,42,'authored authority initializes');eq(G.huangwei.index,53,'authored prestige initializes');
 eq(G.huangquan.subDims.military.value,28,'military command is distinct');eq(G.huangquan.subDims.imperial.value,24,'palace command is distinct');
 near(G.minxin.trueIndex,55,'initial minxin uses resident weights');eq(Object.keys(G.minxin.byClass).length,2,'declared classes replace generic twelve');eq(G.minxin.byClass.tenant.index,37,'specific class value consumed');
 near(G.corruption.subDepts.provincial.true,60,'province department uses player resident weights');near(G.corruption.trueIndex,(44+60+68+57+50+76)/6,'total derives from the same six departments');near(G.corruption.perceivedIndex,(33+45+45+41+38+49)/6,'authored reported values survive initialization');eq(G.corruption.supervision.level,38,'authored supervision survives');
 s.IntegrationBridge.init({strict:true});s.IntegrationBridge.aggregateRegionsToVariables({strict:true});
 near(G.minxin.trueIndex,55,'region mirror does not flatten authoritative minxin');eq(a.minxin,40,'low region retains own minxin');eq(b.minxin,60,'high region retains own minxin');
 eq(Object.keys(G.corruption.byDept).sort().join(','),'central,fiscal,imperial,judicial,military,provincial','one six-department taxonomy');eq(G.corruption.byDept.imperial,76,'inner court is visible in aggregate mirror');eq(foreign.corruption,99,'foreign jurisdiction excluded');
 G.corruption.subDepts.fiscal.true=63;C.syncIndexFromSubDepts('复核盐务账册');const evolved=clone(G.corruption.subDepts);
 C.initFromDynasty('唐','peak',s.P);C.ensureModel();s.IntegrationBridge.aggregateRegionsToVariables({strict:true});
 eq(G.corruption.subDepts.fiscal.true,63,'reinitialization never resets evolved account');eq(G.corruption.subDepts.fiscal.perceived,evolved.fiscal.perceived,'reinitialization keeps reported state');
 G.corruption.trend='rising';s.IntegrationBridge.aggregateRegionsToVariables({strict:true});eq(G.corruption.trend,'rising','derived refresh does not erase an existing trend');
 G.corruption.subDepts.provincial.true+=5;C.syncIndexFromSubDepts('州镇清查确认额外征取');
 eq(a.corruption,35,'legal province change reaches first leaf');eq(b.corruption,75,'legal province change preserves regional difference');near(G.corruption.subDepts.provincial.true,65,'province change reflected in national department');
 s.IntegrationBridge.aggregateRegionsToVariables({strict:true});eq(a.corruption,35,'repeated aggregate does not double apply province change');eq(b.corruption,75,'second region also remains single counted');
 a.corruption=20;a.corruptionLocal=20;s.IntegrationBridge.aggregateRegionsToVariables({strict:true});near(G.corruption.subDepts.provincial.true,61.25,'local investigation changes only its weighted share');eq(b.corruption,75,'local event never modifies other region');
 const change=A.adjustHuangquan('militaryCentral',5,'验符换将，近军受诏');ok(change.ok,'existing authority writer remains active');eq(G.huangquan.index,47,'overall authority changes through existing writer');eq(G.huangquan.subDims.military.value,33,'military source changes actual military dimension');eq(G.huangquan.subDims.central.value,62,'military change does not homogenize civil control');
 s.AuthorityComplete.refreshHuangquanDimensions();s.AuthorityComplete.init();A.init();eq(G.huangquan.subDims.military.value,33,'recompute and repeated init preserve military event');eq(G.huangquan.subDims.imperial.value,24,'palace is not inferred from total score');
 const local=A.adjustHuangquanDimension('imperial',-4,'传宣受阻，宫门未奉手诏',{source:'palace-event'});ok(local.ok,'explicit local authority writer works');eq(G.huangquan.subDims.imperial.value,20,'explicit palace change recorded');eq(G.huangquan.index,47,'dimension-only writer does not invent global change');
 ok(G._authorityLog.some(r=>r.path==='huangquan.subDims.imperial.value'),'local change enters reason ledger');
 s.AuthorityComplete.refreshHuangquanDimensions();eq(G.huangquan.subDims.imperial.value,20,'local change survives ordinary refresh');
 eq(A.adjustHuangquanDimension('unknown',4,'invalid').ok,false,'unknown dimension rejected');eq(A.adjustHuangquanDimension('imperial',4,'').ok,false,'reason required at writer');
 G.turn=8;s.P.corruption.subDepts.fiscal.true=1;C.initFromDynasty('唐','founding',s.P);eq(G.corruption.subDepts.fiscal.true,63,'saved campaign cannot be overwritten by revised scenario');
 G.corruption.accounting.departmentWeights={central:1,provincial:0,military:0,fiscal:0,judicial:0,imperial:0};C.syncIndexFromSubDepts('',{record:false});eq(G.corruption.trueIndex,44,'declared zero weights respected');eq(G.corruption.perceivedIndex,33,'reported and actual use identical weights');
 a.populationDetail.registeredMouths=0;b.populationDetail.registeredMouths=0;s.IntegrationBridge.aggregateRegionsToVariables({strict:true});near(G.minxin.trueIndex,55,'unregistered residents still count toward popular conditions');
}

{
 const {s}=fixture(true,{classBridge:true});s.AuthorityEngines.init();s.AuthorityComplete.init();eq(Object.keys(s.GM.minxin.byClass).length,2,'native class bridge consumes scenario classes during opening');eq(s.GM.minxin.byClass.tenant.satisfaction,37,'class bridge preserves authored class state');
}

{
 const {s}=fixture();s.findScenarioById=undefined;
 ok(s.CorruptionEngine.isDeclaredLedger(),'scenario/P config is detected without GM.fiscalConfig or GM.corruption.accounting');
 ok(s.AuthorityEngines.isIndependentAuthorityLedger(),'authority falls back to current P config');
 s.AuthorityEngines.init();s.IntegrationBridge.init({strict:true});eq(s.GM.corruption.subDepts.imperial.true,76,'bridge can prime declared corruption from current scenario/P');
 eq(s.GM.corruption.byDept.imperial,76,'fallback still publishes the same department account');
 s.GM.huangquan.index=0;eq(s.AuthorityEngines.getUnifiedHuangquanPhaseHandler().phase,'minister','zero authority is not replaced by 55');
 const text=fs.readFileSync(path.join(WEB,'tm-topbar-vars.js'),'utf8');
 for(const name of ['_renderHuangquan','_renderHuangquanFullPanel']){const re=new RegExp('function '+name+'\\(\\) \\{[\\s\\S]*?\\n\\}');const match=text.match(re);ok(match,'real '+name+' renderer found');vm.runInContext(match[0],s);}
 const before=JSON.stringify(s.GM);let view=s._renderHuangquan();eq(view.value,0,'topbar preserves zero');ok(!view.tip.phase.includes('最佳'),'declared view never labels constrained authority optimal');ok(s._renderHuangquanFullPanel().includes('0 / 100'),'full panel preserves zero');
 s.GM.huangquan.index=42;view=s._renderHuangquan();eq(view.tip.phase,'多方议行','constraint phase is described without value judgment');
 s.GM.huangquan.index=70;eq(s._renderHuangquan().tip.phase,'权柄集中','display threshold agrees with decree handler');
 s.GM.huangquan.index=0;eq(JSON.stringify(s.GM),before,'authority renderers do not write live state');
}

{
 const {s}=fixture();s.GM.turn=8;s.CorruptionEngine.ensureModel();s.GM.corruption.subDepts.fiscal.true=17;
 s.IntegrationBridge.init({strict:true});eq(s.GM.corruption.subDepts.fiscal.true,17,'schema adoption preserves an unmarked existing save');
}

{
 const {s}=fixture(false);s.CorruptionEngine.initFromDynasty('唐','decline',s.P);s.AuthorityEngines.init();s.AuthorityComplete.init();eq(s.GM.huangquan.index,42,'legacy authored overall still works');eq(s.GM.minxin.trueIndex,60,'legacy default remains unchanged');eq(Object.keys(s.GM.minxin.byClass).length,12,'legacy class initializer remains unchanged');s.AuthorityComplete.refreshHuangquanDimensions();near(s.GM.huangquan.subDims.central.value,37.8,'legacy dimension formula remains unchanged');eq(s.GM.huangquan.subDims.provincial.value,70,'legacy fallback remains unchanged');s.IntegrationBridge.init({strict:true});ok('county' in s.GM.corruption.byDept,'legacy corruption taxonomy remains unchanged');eq(s.CorruptionEngine.isDeclaredLedger(),false,'legacy is not silently opted in');
}

console.log('PASS authority declared ledger: '+checks+' assertions; initialization and authorized function calls only, no AI or game turns.');
