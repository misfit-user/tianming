#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const WEB=path.resolve(__dirname,'..'),s=JSON.parse(fs.readFileSync(path.join(WEB,'../scenarios/晚唐·开成五年（官方）.json'),'utf8'));
let checks=0;const ok=(v,m)=>{assert(v,m);checks++;},eq=(a,b,m)=>ok(a===b,m+': '+a+' / '+b);
const clone=v=>JSON.parse(JSON.stringify(v));
function slim(d){const ret={};for(const k of ['id','name','level','regionType','population','populationDetail','fiscalDetail','minxin','corruption'])if(d[k]!==undefined)ret[k]=clone(d[k]);if(d.children)ret.children=d.children.map(slim);return ret;}
function world(){
 const G={sid:s.id,turn:1,playerInfo:clone(s.playerInfo),adminHierarchy:{player:{factionId:'唐朝廷',divisions:s.adminHierarchy.player.divisions.map(slim)}},chars:[],facs:s.factions.map(f=>({id:f.id,name:f.name})),vars:{},population:{national:{mouths:41800000}},fiscal:{}};
 const c={GM:G,P:{playerInfo:clone(s.playerInfo),fiscalConfig:clone(s.fiscalConfig),authorityConfig:clone(s.authorityConfig)},console:{log(){},warn(){},error(){}},Date,Math,JSON,setTimeout(){},setInterval(){},clearInterval(){},clearTimeout(){},findScenarioById:()=>s};
 c.window=c;c.globalThis=c;vm.createContext(c);for(const f of ['tm-integration-bridge.js','tm-authority-engines.js','tm-central-local-engine.js'])vm.runInContext(fs.readFileSync(path.join(WEB,f),'utf8'),c,{filename:f});
 return c;
}
ok(s._version>=28,'new authority calibration installed');eq(s.authorityConfig.initial.huangquan,26,'declared imperial control');eq(s.authorityConfig.initial.huangwei,34,'declared prestige');
const c=world();c.IntegrationBridge.init();c.AuthorityEngines.init();c.CentralLocalEngine.init(s);
eq(c.AuthorityEngines.getHuangquanValue(),26,'real authority owner initializes declared control');eq(c.AuthorityEngines.getHuangweiValue(),34,'real authority owner initializes declared prestige');
for(const kind of ['huangquan','huangwei'])for(const [key,value] of Object.entries(s.authorityConfig.initial[kind+'SubDims']))eq(c.GM[kind].subDims[key].value,value,'independent authority dimension '+kind+'/'+key);
eq(Object.keys(c.GM.fiscal.regions).length,44,'44 circuits in actual central-local view');
for(const d of s.adminHierarchy.player.divisions){const live=c.GM.fiscal.regions[d.id];eq(live.autonomyLevel,d.fiscalDetail.autonomyLevel,'circuit seed reaches actual fiscal view '+d.name);ok(live.autonomyLevel>=.24&&live.autonomyLevel<=.85,'circuit range '+d.name);}
const byName=Object.fromEntries(s.adminHierarchy.player.divisions.map(d=>[d.name,d]));
ok(byName['武宁'].fiscalDetail.autonomyLevel>byName['忠武'].fiscalDetail.autonomyLevel,'restive Wuning differs from loyalist Zhongwu');
ok(byName['义武'].fiscalDetail.autonomyLevel>byName['义昌'].fiscalDetail.autonomyLevel,'recent mutinous Yiwu differs from Yichang');
ok(byName['淮南'].fiscalDetail.autonomyLevel<byName['河东'].fiscalDetail.autonomyLevel,'fiscal heartland differs from military frontier');
ok(byName['京畿'].fiscalDetail.autonomyLevel<byName['浙西'].fiscalDetail.autonomyLevel,'capital jurisdiction remains relatively direct');
for(const d of s.adminHierarchy.player.divisions)for(const leaf of d.children){eq(leaf.fiscalDetail.autonomyLevel,s.map.regions.find(r=>r.id===leaf.id).data.fiscalDetail.autonomyLevel,'map and administrative seed agree '+leaf.id);}
for(const key of ['map','mapData'])if(s[key]?.adminHierarchy?.player)for(const d of s[key].adminHierarchy.player.divisions)eq(d.fiscalDetail.autonomyLevel,byName[d.name].fiscalDetail.autonomyLevel,'embedded hierarchy seed '+key+'/'+d.name);
const report=c.CentralLocalEngine.getComplianceReport();eq(report.length,44,'common compliance report retains all circuits');const context=c.CentralLocalEngine.getAIContext();ok(context.includes('/自治'),'AI receives autonomy as well as compliance');ok(!context.includes('undefined')&&!context.includes('NaN'),'AI central-local context remains valid: '+context);
eq(c.GM.fiscal._currentPreset,'tang_liushi','opening central-local preset follows declared late-Tang system');
// Game state evolves independently of the opening seed; reading or reinitializing cannot reset it.
const chosen=byName['武宁'].id;c.GM.fiscal.regions[chosen].autonomyLevel=.43;c.IntegrationBridge.init();eq(c.GM.fiscal.regions[chosen].autonomyLevel,.43,'existing live autonomy survives initialization');
for(const [value,expected] of [[0,0],[1,1],[-1,0],[2,1]]){const d={id:'edge',fiscalDetail:{autonomyLevel:value}};c.IntegrationBridge.ensureDivisionData(d);eq(d.fiscal.autonomyLevel,expected,'explicit autonomy bounded '+value);}
const old={id:'legacy'};c.IntegrationBridge.ensureDivisionData(old);eq(old.fiscal.autonomyLevel,.3,'unconfigured older scenarios retain default');
const evolved={id:'evolved',fiscal:{autonomyLevel:0},fiscalDetail:{autonomyLevel:.8}};c.IntegrationBridge.ensureDivisionData(evolved);eq(evolved.fiscal.autonomyLevel,0,'live zero not replaced by opening autonomy');
console.log('[smoke-tang840-authority-autonomy] PASS '+checks+' assertions');
