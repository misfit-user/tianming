'use strict';
const assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
let checks=0;
function near(a,b,label){assert(Math.abs(a-b)<1e-9,label+': '+a+' / '+b);checks++;}
function fixture(count=1,extraMilitary=false){
  let days=30;
  const char={id:'actor',name:'主官',administration:100,military:0,wuchang:{仁:100,义:100,礼:100,智:100,信:100}};
  const positions=Array.from({length:count},(_,i)=>({id:'p'+i,name:'道长官',holderId:char.id,holder:'',actualCount:1,vacancyCount:0,powers:{taxCollect:1,supervise:1,...(extraMilitary?{militaryCommand:1}:{})},_dutyState:{fulfillment:80,lastTurn:null}}));
  const leaves=positions.map((p,i)=>({id:'leaf'+i,name:'州'+i,corruption:50}));
  const divisions=positions.map((p,i)=>({id:'c'+i,name:'道'+i,level:'province',governorOffice:p.id,capital:leaves[i].id,children:[leaves[i]]}));
  const regions=leaves.map((n,i)=>({id:'r'+i,name:n.name,owner:'本方',adminBinding:n.id,capital:true}));
  const G={turn:1,chars:[char],facs:[{id:'f',name:'本方'}],officeTree:[{name:'地方',positions}],adminHierarchy:{player:{divisions}},mapData:{regions,circuitRegistry:divisions.map((n,i)=>({key:n.id,name:n.name,memberRegionIds:[regions[i].id]}))}};
  const c={console,GM:G,P:{playerInfo:{factionName:'本方'},conf:{}},_getDaysPerTurn:()=>days};c.window=c;
  vm.createContext(c);
  for(const name of ['tm-office-holder-state.js','tm-office-action-evidence.js','tm-office-dutystate.js','tm-circuit-governance.js','tm-circuit-governor-effects.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',name),'utf8'),c,{filename:name});
  c.TM.DivisionReassign={ownerKeyOf:r=>r.owner,circuitAdminNode:(gm,key)=>gm.adminHierarchy.player.divisions.find(n=>n.id===key)};
  c.TM.MapRouteDays={DEFAULT_DAYS:10,routeDays:()=>new Map(regions.map(r=>[r.id,{days:0,estimated:false}]))};
  return {c,G,char,positions,leaves,days:n=>{days=n;},view:()=>c.TM.CircuitGovernance.governorOf(G,c.TM.CircuitGovernance.playerCircuits(G)[0],'本方'),tick(){const governors=c.TM.CircuitGovernance.governorPositions(G);c.tickOfficeDutyState(G,{days,skip:p=>governors.has(p)});return c.TM.CircuitGovernorEffects.tick(G,c.P);}};
}
let w=fixture();assert.equal(w.view().status,'serving');assert.equal(w.view().holderName,'主官');checks+=2;
w.positions[0].holderId='missing';w.positions[0].holder='主官';w.positions[0]._dutyState.fulfillment=50;
assert.equal(w.view().status,'serving');assert.equal(w.view().ability,null);checks+=2;
w.tick();near(w.positions[0]._dutyState.fulfillment,50,'invalid stable ID does not fall back to the same name or fabricate a vacancy');
w=fixture();delete w.positions[0].holderId;w.positions[0].occupancyStatus='unrecorded';w.positions[0]._dutyState.fulfillment=50;
assert.equal(w.view().status,'serving');checks++;w.tick();w.G.turn++;w.tick();near(w.positions[0]._dutyState.fulfillment,50,'anonymous occupied governor remains occupied');
w=fixture();Object.assign(w.positions[0],{holderId:null,holder:'',actualHolders:[],actualCount:0,vacancyCount:1,_dutyState:{fulfillment:50}});
assert.equal(w.view().status,'vacant');checks++;w.days(10);w.tick();near(w.positions[0]._dutyState.fulfillment,46,'vacancy follows ten game days');
const frozen=JSON.stringify(w.positions[0]);w.G.turn++;assert.equal(w.c.tickDutyPosition(w.G,w.positions[0],{frozen:true}).ticked,false);assert.equal(JSON.stringify(w.positions[0]),frozen);checks+=2;
const a=fixture(),b=fixture(1,true);a.char.administration=20;b.char.administration=20;b.char.military=100;a.tick();b.tick();
near(a.G.circuitGovernance.byLeaf.leaf0.exec,b.G.circuitGovernance.byLeaf.leaf0.exec,'military power does not change taxation ability');
near(a.leaves[0].corruption,b.leaves[0].corruption,'military power does not change supervision ability');
const one=fixture(),five=fixture(5);one.tick();five.tick();
near(Object.values(five.G.circuitGovernance.byLeaf).reduce((s,r)=>s+r.exec,0),one.G.circuitGovernance.byLeaf.leaf0.exec,'five assignments share one actor workload across five jurisdictions');
near(five.leaves.reduce((s,r)=>s+50-r.corruption,0),50-one.leaves[0].corruption,'supervision workload also shared');
assert.equal(Object.keys(five.G.circuitGovernance.byLeaf).length,5);checks++;
const before=JSON.stringify(five.G);assert.equal(five.tick().skipped,'alreadyTicked');assert.equal(JSON.stringify(five.G),before);checks+=2;
function elapsed(parts,leave){
  const f=fixture();f.positions[0]._dutyState.fulfillment=10;f.leaves[0].corruption=99;
  f.G.circuitGovernance={turn:0,byCircuit:{},byLeaf:{leaf0:{exec:-0.055,circuitKey:'c0'}}};
  if(leave)f.positions[0].officeLeave={characterId:'actor',approved:true,capacity:0.25,startDay:15,endDay:45};
  for(const days of parts){f.days(days);f.tick();f.G.turn++;}
  return {duty:f.positions[0]._dutyState.fulfillment,exec:f.G.circuitGovernance.byLeaf.leaf0.exec,corruption:f.leaves[0].corruption,morals:JSON.stringify(f.char.wuchang)};
}
for(const leave of [false,true]){
  const coarse=elapsed([90],leave),fine=elapsed(Array(90).fill(1),leave);
  for(const key of ['duty','exec','corruption'])near(coarse[key],fine[key],'same ninety days, with boundary/clamp handling '+key+' leave='+leave);
  assert.equal(coarse.morals,fine.morals);checks++;
}
console.log('[smoke-office-circuit-duty] PASS '+checks+' assertions');
