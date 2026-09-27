#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert/strict');
const WEB=path.resolve(__dirname,'..');let count=0;
function test(name,fn){fn();count++;console.log('PASS '+name);}
function fixture(){
 const c={console:{log(){},warn(){},error(){}},Date,Math,JSON,Number,String,Object,Array,isFinite,parseInt,parseFloat,setTimeout(){},clearTimeout(){},P:{conf:{partyClassLlmEnabled:false},ai:{}},GM:{turn:1,parties:[{id:'party-a',name:'甲党',cohesion:82,influence:30}],partyState:{'甲党':{cohesion:82,influence:30,_synced_cohesion:82,historyLog:[]}},classes:[{name:'甲阶层',satisfaction:50,supportingParties:[{party:'甲党',affinity:.5}]}]}};
 c.window=c;c.global=c;c.globalThis=c;vm.createContext(c);
 for(const file of ['tm-engine-constants.js','tm-class-engine.js','tm-social-foundation.js','tm-native-scope.js','tm-party-class-llm-calibrator.js'])vm.runInContext(fs.readFileSync(path.join(WEB,file),'utf8'),c,{filename:file});
 return c;
}
function gate(c,delta){return c.TM.ClassEngine.gateSatisfaction(c.GM,c.GM.classes[0],delta,{turn:c.GM.turn,source:'regression'});}
function couple(c,delta){return c.TM.ClassEngine.applyClassPartyCoupling(c.GM,c.GM.classes[0],delta,{turn:c.GM.turn,reason:'fractional regression'});}
function calibrate(c,updates){return c.TM.PartyClassLlmCalibrator.applyResult(c.GM,{party_updates:updates},{turn:c.GM.turn,source:'offline-regression'});}

for(const sign of [-1,1])test('fractional party coupling preserves both steps '+sign,()=>{
 const c=fixture();couple(c,sign);const receipt=couple(c,sign);
 assert.equal(c.GM.parties[0].cohesion,82+sign);
 assert.equal(receipt.applied[0].oldCohesion,82+sign*.5);
 assert.equal(receipt.applied[0].delta,sign*.5);
 assert.equal(c.GM.partyState['甲党'].historyLog.reduce((n,x)=>n+x.cohesionDelta,0),sign);
 c.TM.SocialFoundation.syncPartyTruth(c.GM);assert.equal(c.GM.parties[0].cohesion,82+sign);
});
test('coupling seeds explicit zero and records actual boundary movement',()=>{
 const c=fixture();c.GM.parties[0].cohesion=0;c.GM.partyState={};assert.equal(couple(c,-1).applied.length,0);assert.equal(c.GM.partyState['甲党'].cohesion,0);
 couple(c,1);assert.equal(c.GM.parties[0].cohesion,.5);const r=couple(c,-2);assert.equal(r.applied[0].delta,-.5);assert.equal(c.GM._classPartyCouplingLog.at(-1).cohesionDelta,-.5);assert.equal(c.GM.partyState['甲党'].lastShift.cohesionDelta,-.5);
});
test('native-world coupling preserves decimals and exact actual delta',()=>{
 const c=fixture(),p=c.GM.parties[0],cls=c.GM.classes[0];p.factionId=cls.factionId='faction-a';cls.supportingParties=[{partyId:p.id,affinity:.5}];c.GM.nativeWorld={parties:[p]};c.TM.NativeWorld={enabled:g=>!!g.nativeWorld};
 couple(c,-1);couple(c,-1);assert.equal(p.cohesion,81);assert.equal(c.GM.partyState['甲党'].cohesion,81);
 p.cohesion=.25;const r=couple(c,-1);assert.equal(p.cohesion,0);assert.equal(r.applied[0].delta,-.25);assert.equal(c.GM._classPartyCouplingLog.at(-1).delta,-.25);
});
test('same-direction event pressure stays capped at fourteen',()=>{
 const c=fixture();for(let i=0;i<20;i++)gate(c,-6);assert.equal(c.GM.classes[0].satisfaction,36);assert.equal(c.GM.classes[0]._satBudget.net,-14);assert.equal(c.GM.classes[0]._satBudget.used,14);
});
test('relief after full pressure remains effective and balanced ordering agrees',()=>{
 const a=fixture(),b=fixture();gate(a,-14);assert.equal(gate(a,10).approved,10);gate(b,10);gate(b,-14);
 assert.equal(a.GM.classes[0].satisfaction,46);assert.equal(b.GM.classes[0].satisfaction,46);assert.equal(a.GM.classes[0]._satBudget.net,-4);
 assert.equal(gate(a,100).approved,18);assert.equal(a.GM.classes[0]._satBudget.net,14);assert.equal(gate(a,1).approved,0);
});
test('zero satisfaction can recover after applied pressure and saves keep net budget',()=>{
 const c=fixture();c.GM.classes[0].satisfaction=4;assert.equal(gate(c,-14).approved,-4);assert.equal(gate(c,10).approved,10);
 c.GM=JSON.parse(JSON.stringify(c.GM));assert.equal(gate(c,-100).approved,-10);assert.equal(c.GM.classes[0].satisfaction,0);assert.equal(c.GM.classes[0]._satBudget.net,-4);
 c.GM=JSON.parse(JSON.stringify(c.GM));assert.equal(gate(c,6).approved,6);assert.equal(c.GM.classes[0]._satBudget.net,2);
});
test('complete legacy budget recovers signed sum once and excludes structural drift',()=>{
 const c=fixture(),cls=c.GM.classes[0];cls.satisfaction=36.9;cls._satBudget={turn:1,used:14};cls._satLedger=[{t:1,d:-8,src:'fiscal'},{t:1,d:-6,src:'military'},{t:1,d:.9,src:'struct-drift'}];
 assert.equal(gate(c,10).approved,10);assert.equal(cls._satBudget.net,-4);assert.equal(cls._satBudget.uncertainty,0);
 c.GM=JSON.parse(JSON.stringify(c.GM));assert.equal(gate(c,-100).approved,-10);assert.equal(c.GM.classes[0]._satBudget.net,-14);assert.equal(gate(c,-1).approved,0);
});
test('truncated legacy budget retains unknown exposure instead of granting fresh budget',()=>{
 const c=fixture(),cls=c.GM.classes[0];cls._satBudget={turn:1,used:14};cls._satLedger=[{t:1,d:-8,src:'fiscal'}];
 assert.equal(gate(c,-1).approved,0);assert.equal(cls._satBudget.uncertainty,6);assert.equal(gate(c,10).approved,10);assert.equal(cls._satBudget.net,2);assert.equal(gate(c,100).approved,6);
});
test('legacy budget without evidence waits for next turn without replay',()=>{
 const c=fixture(),cls=c.GM.classes[0];cls._satBudget={turn:1,used:14};assert.equal(gate(c,-5).approved,0);assert.equal(gate(c,5).approved,0);
 c.GM.turn=2;assert.equal(gate(c,5).approved,5);assert.equal(cls._satBudget.uncertainty,0);
});
test('legacy uncertainty bounds never allow hidden prior movements to exceed fourteen',()=>{
 for(let mask=0;mask<8;mask++)for(let keep=0;keep<=3;keep++)for(const request of [-20,20]){
  const c=fixture(),cls=c.GM.classes[0],deltas=[2,4,8].map((n,i)=>mask&(1<<i)?n:-n),net=deltas.reduce((a,b)=>a+b,0);
  cls.satisfaction=50+net;cls._satBudget={turn:1,used:14};cls._satLedger=deltas.slice(3-keep).map(d=>({t:1,d,src:'prior-event'}));
  const r=gate(c,request);assert(Math.abs(net+r.approved)<=14+1e-9,'migration exceeded actual original-turn net cap');
  c.GM=JSON.parse(JSON.stringify(c.GM));const again=gate(c,request);assert(Math.abs(net+r.approved+again.approved)<=14+1e-9,'save replay reopened unknown legacy budget');
 }
});
test('absolute party calibration becomes a bounded delta with actual mirror ledger',()=>{
 const c=fixture();calibrate(c,[{party:'甲党',cohesion:0,reason:'test target'}]);assert.equal(c.GM.parties[0].cohesion,67);assert.equal(c.GM.partyState['甲党'].cohesion,67);assert.equal(c.GM.partyState['甲党'].historyLog.at(-1).delta,-15);
 calibrate(c,[{party:'甲党',cohesion:0}]);assert.equal(c.GM.parties[0].cohesion,67);c.TM.SocialFoundation.syncPartyTruth(c.GM);assert.equal(c.GM.parties[0].cohesion,67);
});
test('duplicate party rows apply once and differing evidence shares one capped adjustment',()=>{
 const c=fixture();calibrate(c,Array.from({length:5},()=>({party:'甲党',cohesionDelta:-4,reason:'same observation'})));assert.equal(c.GM.parties[0].cohesion,78);assert.equal(c.GM.partyState['甲党'].historyLog.length,1);
 const d=fixture();calibrate(d,Array.from({length:5},(_,i)=>({party:'甲党',cohesionDelta:-15,reason:'observation '+i})));assert.equal(d.GM.parties[0].cohesion,67);assert.equal(d.GM.partyState['甲党'].historyLog.length,1);
});
test('same-turn calibration cannot repeat after serialization but may recover',()=>{
 const c=fixture();calibrate(c,[{party:'甲党',cohesionDelta:-15}]);c.GM=JSON.parse(JSON.stringify(c.GM));calibrate(c,[{party:'甲党',cohesionDelta:-15}]);assert.equal(c.GM.parties[0].cohesion,67);
 calibrate(c,[{party:'甲党',cohesionDelta:8}]);assert.equal(c.GM.parties[0].cohesion,75);assert.equal(c.GM.parties[0]._cohesionCalibrationBudget.net,-7);
 c.GM.turn=2;calibrate(c,[{party:'甲党',cohesionDelta:-15}]);assert.equal(c.GM.parties[0].cohesion,60);
});
test('absolute calibration overwrites earlier deltas and same-row delta only once',()=>{
 const c=fixture();calibrate(c,[{party:'甲党',cohesionDelta:-12},{party:'甲党',cohesion:80,cohesionDelta:-10},{party:'甲党',cohesionDelta:3}]);assert.equal(c.GM.parties[0].cohesion,83);assert.equal(c.GM.partyState['甲党'].historyLog.length,1);assert.equal(c.GM.partyState['甲党'].historyLog[0].delta,1);
 const d=fixture();calibrate(d,[{party:'甲党',cohesion:80},{party:'甲党',cohesionDelta:3},{party:'甲党',cohesion:79}]);assert.equal(d.GM.parties[0].cohesion,79);assert.equal(d.GM.partyState['甲党'].historyLog.length,1);
});
test('calibration preserves explicit zero and records only actual capped increase',()=>{
 const c=fixture();c.GM.parties[0].cohesion=0;calibrate(c,[{party:'甲党',cohesionDelta:-3}]);assert.equal(c.GM.parties[0].cohesion,0);calibrate(c,[{party:'甲党',cohesionDelta:3}]);assert.equal(c.GM.parties[0].cohesion,3);
 const d=fixture();d.GM.parties[0].cohesion=99.5;calibrate(d,[{party:'甲党',cohesionDelta:4}]);assert.equal(d.GM.parties[0].cohesion,100);assert.equal(d.GM.partyState['甲党'].historyLog.at(-1).delta,.5);assert.equal(d.GM.parties[0]._cohesionCalibrationBudget.net,.5);
});
console.log('[smoke-social-satisfaction-recovery] PASS '+count+' cases');
