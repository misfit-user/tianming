'use strict';
// Read-only production audit: load runtime modules in a fresh VM; never call a model.
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const ROOT=path.resolve(__dirname,'../../..'),WEB=path.join(ROOT,'web');
const source=JSON.parse(fs.readFileSync(path.join(ROOT,'scenarios/天启七年·九月（官方）.json'),'utf8'));
const clone=x=>JSON.parse(JSON.stringify(x));
function fixture(options={}){
 const c={console:{log(){},warn(){},error(){}},Math,Date,JSON,Number,String,Object,Array,RegExp,Error,Promise,isFinite,parseInt,parseFloat,setTimeout(){},clearTimeout(){},P:{conf:{partyClassLlmEnabled:false},ai:{}},scriptData:{},GM:{turn:1,classes:clone(source.classes),parties:clone(source.parties),partyState:{},facs:[],chars:[],vars:{},engineConstants:{}},GameHooks:{on(){}}};
 c.window=c;c.global=c;c.globalThis=c;vm.createContext(c);
 for(const file of ['tm-engine-constants.js','tm-class-engine.js','tm-social-foundation.js','tm-social-political-signals.js','tm-party-class-llm-calibrator.js']){
  let text=fs.readFileSync(path.join(WEB,file),'utf8');
  if(options.counterfactual&&file==='tm-class-engine.js')text=text.replace('var oldC = parseTurnNumber(ps.cohesion);','var oldC = Number(ps.cohesion);');
  vm.runInContext(text,c,{filename:file});
 }
 return c;
}
const out={scope:'VM runtime entrypoints with exact Tianqi authored parties/classes; no network, no save, no production edits',cases:[]};
function row(c,name){const p=c.GM.parties.find(p=>p.name===name);return {name:p.name,cohesion:p.cohesion,influence:p.influence,satisfaction:p.satisfaction};}
{
 const series=[];
 for(const delta of [-1,1]){
  const c=fixture(),name='东林党',before=row(c,name),cls=c.GM.classes.find(x=>x.name==='士大夫'),points=[];
  for(let i=0;i<2;i++){
   const receipt=c.TM.ClassEngine.applyClassPartyCoupling(c.GM,cls,delta,{turn:1,reason:'audit fractional coupling'});
   points.push({party:row(c,name),receipt:receipt.applied.find(x=>x.partyName===name)});
  }
  series.push({classDeltaPerCall:delta,before,expectedCohesion:before.cohesion+delta,points});
 }
 assert.equal(series[0].points[1].party.cohesion,80.5);
 assert.equal(series[1].points[1].party.cohesion,82.5);
 out.cases.push({name:'coupling truncates prior fractional cohesion on every call',series});
}
{
 const series=[];
 for(const delta of [-1,1]){
  const c=fixture({counterfactual:true}),name='东林党',before=row(c,name),cls=c.GM.classes.find(x=>x.name==='士大夫');
  for(let i=0;i<2;i++)c.TM.ClassEngine.applyClassPartyCoupling(c.GM,cls,delta,{turn:1,reason:'audit VM-only counterfactual'});
  assert.equal(row(c,name).cohesion,before.cohesion+delta);
  series.push({classDeltaPerCall:delta,before,after:row(c,name)});
 }
 out.cases.push({name:'VM-only Number conversion preserves both positive and negative fractions; production files untouched',series});
}
{
 const c=fixture(),name='阉党',before=row(c,name);
 c.TM.PartyClassLlmCalibrator.applyResult(c.GM,{party_updates:[{party:name,cohesion:0,reason:'audit synthetic response'}]},{turn:1,source:'audit-absolute'});
 const after=row(c,name);assert.equal(after.cohesion,0);assert.equal(before.cohesion,65);
 out.cases.push({name:'absolute cohesion bypasses delta clamp',before,after,history:c.GM.parties[0]._partyClassLlmHistory});
}
{
 const c=fixture(),name='阉党',before=row(c,name);
 c.TM.PartyClassLlmCalibrator.applyResult(c.GM,{party_updates:Array.from({length:5},()=>({party:name,cohesionDelta:-15,reason:'audit duplicate target'}))},{turn:1,source:'audit-duplicate'});
 const after=row(c,name);assert.equal(after.cohesion,0);
 out.cases.push({name:'five same-target party update rows stack in one result',before,after,history:c.GM.parties[0]._partyClassLlmHistory});
}
{
 const c=fixture(),name='东林党',before=row(c,name),cls=c.GM.classes.find(x=>x.name==='士大夫');
 const changes=[];
 for(let turn=1;turn<=6;turn++){
  c.GM.turn=turn;
  c.TM.SocialPoliticalSignals.record(c.GM,{turn,sourceSystem:'audit-controlled-pressure',kind:'audit-pressure',reason:'Audit isolated legitimate -14 class pressure',affectedClasses:[{name:cls.name,satisfactionDelta:-14}]});
  c.TM.SocialPoliticalSignals.applyPending(c.GM,{turn,source:'audit-controlled-pressure'});
  c.TM.SocialFoundation.syncPartyTruth(c.GM);
  changes.push({turn,classSatisfaction:cls.satisfaction,party:row(c,name)});
 }
 out.cases.push({name:'exact authored support edge couples approved class loss only',before,changes,log:c.GM._classPartyCouplingLog});
}
{
 const c=fixture(),name='东林党',before=row(c,name),cls=c.GM.classes.find(x=>x.name==='士大夫');
 // Controlled high initial mood demonstrates party-level stacking independently of floor.
 cls.satisfaction=90;c.GM.classes.find(x=>x.name==='缙绅').satisfaction=90;
 c.TM.SocialPoliticalSignals.record(c.GM,{turn:1,sourceSystem:'audit-two-classes',kind:'audit-pressure',reason:'Audit controlled -14 in two authored supporter classes',affectedClasses:[{name:'士大夫',satisfactionDelta:-14},{name:'缙绅',satisfactionDelta:-14}]});
 c.TM.SocialPoliticalSignals.applyPending(c.GM,{turn:1,source:'audit-two-classes'});
 out.cases.push({name:'two supporting classes each lose 14, one party loses 14 at default affinity .5',before,after:row(c,name),log:c.GM._classPartyCouplingLog});
}
fs.writeFileSync(path.join(__dirname,'probe-results.json'),JSON.stringify(out,null,2));
console.log(JSON.stringify(out,null,2));
