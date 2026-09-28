#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const web=path.resolve(__dirname,'..'),repo=path.resolve(web,'..');
const c={console,Math,JSON,Date,RegExp,Error,Array,Object,String,Number,Boolean,parseInt,parseFloat,isFinite,isNaN};
c.window=c;c.globalThis=c;vm.createContext(c);
for(const file of ['tm-engine-constants.js','tm-class-engine.js','tm-party-class-ecology.js','tm-social-political-signals.js','tm-class-minxin-bridge.js']) {
  vm.runInContext(fs.readFileSync(path.join(web,file),'utf8'),c,{filename:file});
}
const copy=x=>JSON.parse(JSON.stringify(x));
const sc=JSON.parse(fs.readFileSync(path.join(repo,'scenarios/天启七年·九月（官方）.json'),'utf8'));
function scan(g){c.GM=g;return c.TM.SocialPoliticalSignals.scanRuntimePressures(g,{source:'scope-smoke',turn:g.turn});}
function names(s){return Array.from(s.affectedClasses,x=>x.name).sort();}
const military={turn:1,playerFactionId:'home',classes:copy(sc.classes),parties:[],military:{arrearsRatio:0.6}};
military.classes.push({name:'Frontier Cohort',tags:['military'],satisfaction:60},
  {name:'Granary Guards',economicRole:'garrison patrol families',satisfaction:60},
  {name:'Retired military nobility',status:'retired',economicRole:'estate rent and military heritage',satisfaction:60},
  {name:'Foreign Soldiers',tags:['military'],factionId:'foreign',satisfaction:60},
  {name:'Home Soldiers',tags:['military'],factionId:'home',satisfaction:60},
  {name:'Temple Guild',economicRole:'religious',description:'military arrears and local rebellion concern the temple',demands:'pay military wages',satisfaction:60});
const first=scan(military).signals.find(x=>x.kind==='military-wage-arrears');
assert.deepStrictEqual(names(first),['Frontier Cohort','Granary Guards','Home Soldiers','军户'].sort(),'retired/foreign identities and background/demand/topic overlap must not become military pay recipients');
const initial=military.classes.map(x=>({name:x.name,satisfaction:x.satisfaction}));
for(let t=1;t<=3;t++){
  military.turn=t;if(t!==1)scan(military);
  c.TM.SocialPoliticalSignals.applyPending(military,{turn:t,source:'scope-smoke'});
}
for(const before of initial){
  const after=military.classes.find(x=>x.name===before.name);
  assert.strictEqual(after.satisfaction,before.satisfaction-(names(first).includes(before.name)?15:0),'persistent actual arrears must harm only military recipients over multiple turns: '+before.name);
}
military.turn=4;military.military.arrearsRatio=0;
assert(!scan(military).kinds.includes('military-wage-arrears'),'cleared arrears must stop the persistent pressure');

{
  const g={turn:1,classes:copy(sc.classes),parties:[],corruption:{trueIndex:92}};
  const signal=scan(g).signals.find(x=>x.kind==='corruption-high');
  assert.deepStrictEqual(names(signal),['士大夫','缙绅','商人','工匠'].sort(),'religious background mentioning scholars must not give clergy full corruption pressure');
  const relief=c.TM.SocialPoliticalSignals.recordTurnResult(g,{turnSummary:'肃贪问责，惩贪清查腐败'},{source:'scope-turn-result',turn:1}).signals.find(x=>x.kind==='turn-result-corruption-pressure');
  assert.deepStrictEqual(names(relief),names(signal),'corruption relief must use the same identity scope');
  assert(relief.affectedClasses.every(x=>x.satisfactionDelta>0),'corruption relief remains positive');
}

for(const [text,delta] of [['军队仍然欠饷',-5],['军队已经发饷',3]]){
  const g={turn:1,classes:copy(sc.classes),parties:[]};c.GM=g;
  const result=c.TM.SocialPoliticalSignals.recordTurnResult(g,{turnSummary:text},{source:'scope-turn-result',turn:1});
  const signal=result.signals.find(x=>x.kind==='turn-result-military-arrears');
  assert(signal,'synthetic AI result must produce military attribution');
  assert.deepStrictEqual(names(signal),['军户'],'AI military relief and hardship must share the same recipient scope');
  assert.strictEqual(signal.affectedClasses[0].satisfactionDelta,delta,'military relief keeps its positive effect and arrears keep their negative effect');
}
{
  const g={turn:1,classes:copy(sc.classes),parties:[],local:{revoltRisk:0.8}};c.GM=g;
  const result=c.TM.SocialPoliticalSignals.recordTurnResult(g,{turnSummary:'地方发生民变，流民迁徙'},{source:'scope-turn-result',turn:1});
  const signal=result.signals.find(x=>x.kind==='turn-result-local-unrest');
  assert(signal && signal.affectedClasses.length,'synthetic AI unrest still produces civilian pressure');
  for(const name of ['宗室','士大夫','缙绅','僧道·外籍','军户'])assert(!names(signal).includes(name),'AI unrest must not expand numerical harm through unrelated topic categories: '+name);
}

const local={turn:1,playerFactionId:'home',parties:[],classes:[
  {name:'Farmers',tags:['peasant'],satisfaction:60},
  {name:'East Farmers',tags:['peasant'],satisfaction:60,regionalVariants:[{regionId:'east'}]},
  {name:'West Farmers',tags:['peasant'],satisfaction:60,regionalVariants:[{regionId:'west'}]},
  {name:'Court Nobles',economicRole:'governing',satisfaction:60,description:'local land rebellion'},
  {name:'Temple Clergy',economicRole:'religious',satisfaction:60,demands:'relieve local tax arrears'},
  {name:'Foreign Farmers',tags:['peasants'],factionId:'foreign',satisfaction:60},
  {name:'Novel Residents',descriptor:{stratum:'下'},satisfaction:60}
],adminHierarchy:{player:{divisions:[
  {id:'east',name:'East',minxin:10,populationDetail:{mouths:100}},
  {id:'west',name:'West',minxin:70,populationDetail:{mouths:900}}
]},foreign:{divisions:[{id:'foreign',name:'Foreign',minxin:0,populationDetail:{mouths:1000000}}]}}};
const pressure=scan(local).signals.find(x=>x.kind==='local-revolt-risk');
assert(pressure,'local hardship must remain active');
assert.deepStrictEqual(names(pressure),['Farmers','East Farmers','Novel Residents'].sort(),'known safe regional classes and unrelated court/religious roles must stay outside the local numerical impact');
const all=pressure.affectedClasses.find(x=>x.name==='Farmers'),east=pressure.affectedClasses.find(x=>x.name==='East Farmers');
assert(all.satisfactionDelta<0 && Math.abs(all.satisfactionDelta)<=1,'ten percent of local population must not impose the worst district penalty nationwide');
assert.strictEqual(all.satisfactionDelta,Math.round(east.satisfactionDelta*0.1*100)/100,'local national-class penalty follows population coverage');
const localResult=c.TM.SocialPoliticalSignals.recordTurnResult(local,{turnSummary:'地方发生民变'},{source:'scope-turn-result',turn:1}).signals.find(x=>x.kind==='turn-result-local-unrest');
assert.deepStrictEqual(names(localResult),names(pressure),'AI local result must use the same known regional exposure');
assert.strictEqual(localResult.affectedClasses.find(x=>x.name==='Farmers').satisfactionDelta,-0.5,'AI local result must scale the ten-percent coverage');
local.turn=2;local.adminHierarchy.player.divisions[0].minxin=70;
assert(!scan(local).kinds.includes('local-revolt-risk'),'foreign low mood must not keep player pressure active after player regions recover');
assert(!c.TM.SocialPoliticalSignals.recordTurnResult(local,{turnSummary:'Foreign rebellion and famine continue'},{source:'scope-turn-result',turn:2}).kinds.includes('turn-result-local-unrest'),'foreign/unlocated narrative alone must not invent a domestic numerical penalty');
console.log('[smoke-class-pressure-scope] PASS official/custom military identity, synthetic AI relief/hardship/local scope, three-turn attribution, local population coverage and foreign scope');
