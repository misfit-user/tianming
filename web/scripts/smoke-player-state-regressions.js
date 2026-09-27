'use strict';
const assert=require('assert/strict');
const {context,load,population,run}=require('./lib-player-error-regression');
const tests=[];const test=(name,fn)=>tests.push({name,fn});
function fiscal(rows){const c=context({GM:{turn:3,regions:[{id:'r',name:'地区'}],fiscal:{_centralLocalInited:true,regions:rows}},TM:{}});load(c,'tm-central-local-engine.js');return c;}
test('old initialized regions without ledgers receive a complete schema',()=>{
 const c=fiscal({r:{regionId:'r'}});c.CentralLocalEngine.init({});assert.deepEqual({...c.GM.fiscal.regions.r.ledgers},{money:0,grain:0,cloth:0});assert.doesNotThrow(()=>c.CentralLocalEngine.generateLocalActions({turn:3}));
 const first=JSON.stringify(c.GM.fiscal.regions);c.CentralLocalEngine.normalizeRegions();assert.equal(JSON.stringify(c.GM.fiscal.regions),first);
});
test('legacy numeric balances and stock metadata are preserved exactly',()=>{
 const c=fiscal({r:{money:4500,grain:{stock:700,lastIn:20},cloth:'12.5',retainedBudget:9876}});c.CentralLocalEngine.normalizeRegions();const r=c.GM.fiscal.regions.r;
 assert.equal(r.ledgers.money,4500);assert.equal(r.ledgers.grain,700);assert.equal(r.ledgers.cloth,12.5);assert.equal(r._centralLocalLegacyLedgers.grain.lastIn,20);assert.equal(r.retainedBudget,9876);
 const actions=c.CentralLocalEngine.generateLocalActions({turn:3});assert(actions.length>0,'real existing budget remains available');
});
test('zero authoritative ledger wins over stale legacy balance and keeps its shared object',()=>{
 const ledgers={money:0,grain:10,cloth:0},c=fiscal({r:{ledgers,money:9000}});c.CentralLocalEngine.normalizeRegions();assert.equal(c.GM.fiscal.regions.r.ledgers,ledgers);assert.equal(ledgers.money,0);assert.equal(c.CentralLocalEngine.generateLocalActions({turn:3}).length,0);
});
test('corrupt later row does not partially migrate an earlier row',()=>{
 const c=fiscal({r:{money:4000},bad:{ledgers:{money:'not-money'}}}),before=JSON.stringify(c.GM.fiscal.regions);assert.throws(()=>c.CentralLocalEngine.normalizeRegions(),e=>e.code==='central-local-ledger-invalid');assert.equal(JSON.stringify(c.GM.fiscal.regions),before);
});
test('conflicting legacy balances are reported instead of silently choosing one',()=>{
 const c=fiscal({r:{money:4000,balance:7000}});assert.throws(()=>c.CentralLocalEngine.normalizeRegions(),e=>e.code==='central-local-ledger-invalid');assert.equal(c.GM.fiscal.regions.r.ledgers,undefined);
});
test('tax splits can run after legacy schema migration without erasing funds',()=>{
 const c=fiscal({r:{money:1000}});const split=c.CentralLocalEngine.splitTax('r','land_grain',100);assert(split);assert(c.GM.fiscal.regions.r.ledgers.grain>0);assert.equal(c.GM.fiscal.regions.r.ledgers.money,1000);
});
for(const collision of ['name','id'])test('environment mortality is player-scoped despite NPC '+collision+' collision',()=>{
 const {context:c,playerLeaves:p,npcLeaves:n}=population();n[1][collision]=p[1].id;c.HujiEngine.applyPopulationLoss({cause:'initialize-only',factionScope:'player',regionId:p[1].id,mouths:0});c.GM.environment.byRegion={'player-south':{currentLoad:1.3}};
 const beforeP=p[1].populationDetail.mouths,beforeN=JSON.stringify(n.map(r=>r.populationDetail));c._tickOverloadFeedback({turn:1},1);
 assert.equal(p[1].populationDetail.mouths,beforeP-267);assert.equal(JSON.stringify(n.map(r=>r.populationDetail)),beforeN);assert.equal(c.GM.population.national.mouths,p.reduce((a,r)=>a+r.populationDetail.mouths,0));
});
test('an exact leaf ID outranks a same-faction display-name alias in both resolve and debit',()=>{
 const {context:c,playerLeaves:p}=population();p[0].name='player-south';c.GM.environment.byRegion={'player-south':{currentLoad:1.3}};
 const capital=p[0].populationDetail.mouths,south=p[1].populationDetail.mouths;c._tickOverloadFeedback({turn:1},1);assert.equal(p[0].populationDetail.mouths,capital);assert.equal(p[1].populationDetail.mouths,south-267);
});
test('true duplicate IDs inside the target faction still fail without guessing',()=>{
 const {context:c,playerLeaves:p}=population();p[0].id=p[1].id;const before=JSON.stringify(p.map(r=>r.populationDetail));
 const result=c.HujiEngine.applyPopulationLoss({cause:'probe',factionScope:'player',regionId:p[1].id,mouths:267});assert(!result.ok);assert.equal(result.reason,'region-ambiguous');assert.equal(JSON.stringify(p.map(r=>r.populationDetail)),before);
});
test('explicit NPC loss remains supported and does not affect player population',()=>{
 const {context:c,playerLeaves:p,npcLeaves:n}=population(),before=p.reduce((a,r)=>a+r.populationDetail.mouths,0),npc=n[1].populationDetail.mouths;
 const result=c.HujiEngine.applyPopulationLoss({cause:'npc-probe',factionId:'fac-npc',regionId:n[1].id,mouths:300});assert(result.ok);assert.equal(n[1].populationDetail.mouths,npc-300);assert.equal(p.reduce((a,r)=>a+r.populationDetail.mouths,0),before);
});
run(tests);
