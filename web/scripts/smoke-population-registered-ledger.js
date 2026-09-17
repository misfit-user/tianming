#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const ROOT=path.resolve(__dirname,'..');
let checks=0;
function eq(a,b,msg){checks++;assert.strictEqual(a,b,msg);}
function ok(v,msg){checks++;assert.ok(v,msg);}
function fixture(v2=true){
 const s={console,Math,Date,JSON,RegExp,Error,Array,Object,String,Number,Boolean,parseInt,parseFloat,isNaN,isFinite,setTimeout(){return 1;},clearTimeout(){},addEB(){}};
 s.window=s;s.global=s;s.globalThis=s;s.TM={errors:{capture(){},captureSilent(){}}};
 s.P={id:'ledger',dynasty:'唐',populationConfig:{accounting:v2?{schema:'tm-population-ledger/2',displayBasis:'registered'}:undefined,initial:{nationalMouths:3000,nationalHouseholds:600,nationalDing:900},categoryEnabled:['bianhu'],corveeRules:{annualCorveeDays:20,commutationRate:.35}},fiscalConfig:{accounting:{schema:'tm-fiscal-ledger/2'},taxes:[{base:'taxableHouseholds'}]}};
 function leaf(id,m,h,d,rm,rh,rd,tm,th,hidden,fled){const pd={mouths:m,households:h,ding:d,registeredMouths:rm,registeredHouseholds:rh,registeredDing:rd,taxableMouths:tm,taxableHouseholds:th,hiddenCount:hidden,hidden:hidden,fugitives:fled,hiddenDing:Math.round(hidden*d/m),fledDing:Math.round(fled*d/m),baselineExemptDing:20};return {id,name:id,populationDetail:pd,population:JSON.parse(JSON.stringify(pd)),minxin:60,prosperity:60};}
 const a=leaf('a',1000,200,300,600,120,180,500,100,100,50),b=leaf('b',2000,400,600,1000,200,300,800,160,200,100),j=leaf('j',5000,1000,1500,3000,600,900,2500,500,400,100);
 s.GM={sid:'ledger',turn:1,playerFactionId:'tang',facs:[{id:'tang',name:'唐',isPlayer:true},{id:'jp',name:'日本'}],adminHierarchy:{player:{factionId:'tang',divisions:[a,b]},jp:{factionId:'jp',divisions:[j]}},guoku:{money:100000,turnIncome:1000,monthlyIncome:3000},fiscal:{expectedRevenue:1000},military:{},armies:[],minxin:{trueIndex:60},corruption:{trueIndex:20}};
 s.findScenarioById=()=>s.P;
 vm.createContext(s);
 for(const f of ['tm-huji-engine.js','tm-huji-runtime-bridge.js','tm-minxin-hard-link-consumers.js','tm-huji-governance-loop.js'])vm.runInContext(fs.readFileSync(path.join(ROOT,f),'utf8'),s,{filename:f});
 s.HujiEngine.init(s.P);s.HujiRuntimeBridge.maintain(s.GM,{scenario:s.P,applyHardEffects:false});
 return {s,a,b,j,pd:a.populationDetail};
}

// Public totals and faction/region readers preserve the exact declared basis.
{
 const {s,a,j}=fixture();const H=s.HujiEngine,G=s.GM;
 const before=JSON.stringify(G);let v=H.getPopulationView({root:G});
 eq(v.displayBasis,'registered','v2 visible basis');eq(v.mouths,1600,'public registration');eq(v.households,320,'registered households');eq(v.ding,480,'registered ding');eq(v.actualMouths,3000,'economic residents');eq(v.taxableMouths,1300,'taxable mouths');eq(v.taxableHouseholds,260,'tax base is already net');ok(v.complete,'all explicit inputs exist');
 eq(H.getPopulationView({root:G,region:'a'}).mouths,600,'region ID');eq(H.getPopulationView({root:G,region:{data:a}}).mouths,600,'map data wrapper');eq(H.getPopulationView({root:G,factionId:'jp'}).mouths,3000,'NPC registration');eq(H.getPopulationView({root:G,factionId:'日本'}).actualMouths,5000,'NPC aliases');eq(H.getPopulationView({root:G,region:{children:[a,j]}}).mouths,3600,'explicit ancestor sums its children');eq(JSON.stringify(G),before,'all public readers are pure');
 eq(G.population.national.mouths,3000,'bridge never rewrites actual with public count');eq(G.population.national.registeredMouths,1600,'national registered mirror');eq(G.hukou.registeredMouths,1600,'hukou public mirror');eq(G.hukou.effectiveTaxHouseholds,260,'bridge does not subtract hidden again');
 eq(H.getPopulationView({root:G,region:'missing'}).known,false,'missing region not national fallback');
 a.populationDetail.registeredMouths=0;a.populationDetail.registeredHouseholds=0;a.populationDetail.registeredDing=0;
 eq(H.getPopulationView({root:G,region:a}).mouths,0,'explicit zero stays zero');
 delete a.populationDetail.taxableMouths;eq(H.getPopulationView({root:G,region:a}).complete,false,'missing v2 field visible to validation');
}

// Discovering hidden residents increases registration without creating residents.
{
 const {s,a}=fixture();const H=s.HujiEngine,pd=a.populationDetail;
 let r=H.applyRegistrationStatusChange({root:s.GM,region:a,detail:pd,status:'hidden',deltaMouths:-20});
 ok(r.ok,'registered write accepted');eq(r.appliedMouths,-20,'mouth delta');eq(pd.mouths,1000,'census does not create people');eq(pd.ding,300,'census does not create adults');eq(pd.registeredMouths,620,'newly visible mouths');eq(pd.taxableMouths,520,'newly collectible mouths');eq(pd.hiddenCount,80,'discovered hidden balance');eq(pd.hiddenDing,24,'mouth/ding units are separate');eq(a.population.registeredMouths,620,'leaf mirror follows same write');
 r=H.applyRegistrationStatusChange({root:s.GM,detail:pd,status:'fled',deltaDing:5});
 eq(pd.fledDing,20,'fled ding increment');eq(pd.fugitives,67,'fled mouth conversion');eq(pd.registeredMouths,620,'fleeing still present in register');eq(pd.taxableMouths,503,'fleeing reduces current collectability');
 H.applyRegistrationStatusChange({root:s.GM,detail:pd,status:'fled',deltaDing:-5});eq(pd.taxableMouths,520,'return restores collectible once');eq(pd.registeredMouths,620,'return never double-registers');
 const old=H.getPopulationView({root:s.GM});const registered=H.registerHiddenPopulation({mouths:80,cause:'smoke-census'});ok(registered.ok,'existing census uses explicit ledger');
 const now=H.getPopulationView({root:s.GM});eq(now.actualMouths,old.actualMouths,'national actual conserved during census');eq(now.registeredMouths-old.registeredMouths,80,'actual discover count enters registration');eq(now.taxableMouths-old.taxableMouths,80,'actual discover count enters tax base');eq(s.GM.population.national.registeredMouths,now.registeredMouths,'national census mirror');
 s.TM.MinxinHardLinkConsumers.consume(s.GM,{snapshot:{summary:{hukou:{hiddenHouseholds:9999,refugees:9999}},regionImpacts:[]}});
 eq(s.GM.population.national.mouths,3000,'minxin mirror must not overwrite residents');eq(s.GM.hukou.effectiveTaxHouseholds,now.taxableHouseholds,'minxin must not re-deduct hidden');
}

// Loss and transfer change all explicit counts coherently at their existing writers.
{
 const {s,a,b}=fixture(),H=s.HujiEngine;
 const before=H.getPopulationView({root:s.GM});
 const moved=H.transferPopulation({sourceRegionId:'a',targetRegionId:'b',mouths:100});ok(moved.ok,'transfer succeeds');
 let v=H.getPopulationView({root:s.GM});
 for(const key of ['actualMouths','registeredMouths','registeredHouseholds','registeredDing','taxableMouths','taxableHouseholds'])eq(v[key],before[key],key+' conserved across transfer');
 eq(a.populationDetail.actualMouths,900,'source resident alias');eq(b.populationDetail.actualMouths,2100,'target resident alias');
 const lost=H.applyPopulationLoss({regionId:'a',mouths:90,cause:'smoke-loss'});ok(lost.ok,'loss uses existing writer');eq(a.populationDetail.mouths,810,'actual mortality');eq(a.populationDetail.registeredMouths,486,'registered mortality proportional');eq(a.populationDetail.taxableMouths,405,'taxable mortality proportional');
 v=H.getPopulationView({root:s.GM});eq(s.GM.population.national.registeredMouths,v.registeredMouths,'loss mirrored to registered aggregate');eq(s.GM.worldPopulationSummary.byFaction.jp.national.registeredMouths,3000,'world NPC registered view stays scoped');
 const qbefore=H.getPopulationView({root:s.GM});
 const q=H.materializeQiaozhiResettlement({eventId:'smoke-move',sourceCandidates:['b'],targetNames:['c','d'],mouths:200});ok(q.ok,'new settlement population transfer');
 const qafter=H.getPopulationView({root:s.GM});
 for(const key of ['actualMouths','registeredMouths','taxableMouths','registeredDing'])eq(qafter[key],qbefore[key],key+' conserved by settlement');
}

// Declared fiscal tax bases are net; legacy hard reductions remain opt-in to old behaviour.
{
 const {s}=fixture();const G=s.GM,H=s.HujiEngine;
 const before=H.getPopulationView({root:G});
 const c=s.HujiGovernanceLoop.createCommitment(G,{kind:'edict',source:'formal-desk',text:'Order a hukou census, inspect hidden households and resettle refugees.',intensity:.9});
 ok(c.created>0,'native governance commitment created');
 s.HujiGovernanceLoop.tick(G,{turn:1,monthRatio:1,source:'smoke-governance'});
 const after=H.getPopulationView({root:G});
 ok(after.hiddenCount<before.hiddenCount,'governance discoveries use status writer');
 eq(after.registeredMouths-before.registeredMouths,before.hiddenCount-after.hiddenCount,'governance discovered mouths enter registered ledger');
 eq(after.actualMouths,before.actualMouths,'governance creates no residents');
 eq(G.hukou.effectiveTaxHouseholds,after.taxableHouseholds,'governance refreshes net tax cache');
}
{
 const {s}=fixture();
 const source=fs.readFileSync(path.join(ROOT,'tm-topbar-vars.js'),'utf8');
 const start=source.indexOf('function _renderHukou()');
 const end=source.indexOf('\nfunction ',start+20);
 s._barReported=(key,value)=>({shown:value,distorted:false});s._barFmtNum=String;
 s.GM.scenarioMetadata={initialPopulation:10000};
 vm.runInContext(source.slice(start,end),s);
 const card=s._renderHukou();eq(card.value,'1600','real HUD renderer uses registered mouths');eq(card.phase,'','different accounting scope is not a population collapse');
 const drawers=fs.readFileSync(path.join(ROOT,'tm-var-drawers.js'),'utf8');
 const a=drawers.indexOf('  function renderHukouPanel()'),b=drawers.indexOf('  // ═════',a+40);
 const body={innerHTML:''},subtitle={textContent:''};
 s.document={getElementById:id=>id==='hukou-body'?body:subtitle};s._fmt=String;s._sec=()=>'';s._tabJump=()=>'';
 vm.runInContext(drawers.slice(a,b),s);s.renderHukouPanel();
 ok(subtitle.textContent.includes('口 1600'),'real drawer subtitle uses registered mouths');ok(body.innerHTML.includes('>1600<'),'real drawer population row uses registered mouths');ok(!body.innerHTML.includes('>3000<'),'resident total not mislabelled as registered');
}
{
 const {s}=fixture();const r=s.HujiRuntimeBridge.maintain(s.GM,{scenario:s.P,applyHardEffects:true});
 eq(r.snapshot.hardEffects.fiscal.collectionMultiplier,1,'explicit fiscal base is not reduced twice');eq(s.GM.guoku.turnIncome,1000,'receipt not reduced twice');
}
{
 const {s,a}=fixture(false);s.GM.population.national.mouths=4321;
 eq(s.HujiEngine.getPopulationView({root:s.GM}).mouths,4321,'legacy public getter preserves existing national view');
 eq(s.HujiEngine.applyRegistrationStatusChange({root:s.GM,detail:a.populationDetail,status:'hidden',deltaDing:1}).ok,false,'legacy writer remains unchanged');
 eq(s.GM.hukou.registeredMouths,3000,'legacy bridge preserves historical public convention');
}
console.log('PASS population registered ledger: '+checks+' assertions');
