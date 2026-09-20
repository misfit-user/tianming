'use strict';
// Exercise the actual canonical creator and actual descriptor reconciliation, including stale replies.
const assert=require('node:assert/strict');
require('../tm-field-pipelines.js');require('../tm-engine-constants.js');require('../tm-class-engine.js');
const SF=require('../tm-social-foundation.js');require('../tm-social-formation.js');
const creator=globalThis.TM.SocialFormation;globalThis.TM.SocialFoundation=SF;
const flush=()=>new Promise(resolve=>setImmediate(resolve));let passed=0;
function fixture(){const g={sid:'test',turn:1,_campaignId:'c',_timelineId:'t',classes:[],parties:[],chars:[]};globalThis.GM=g;globalThis.P={};return g;}
function raw(){return {name:'新盐商',reason:'本局盐商形成共同利益',economicRole:'商贸',influence:40,descriptor:{stratum:'中',fiscalStatus:'盐课专营'}};}
async function check(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
 await check('new class retains independent descriptor and requests one secondary adjudication',async()=>{
  const g=fixture(),input=raw();let calls=0,resolve;
  globalThis.callAI=(prompt,tokens,unused,tier,opts)=>{calls++;assert.equal(tier,'secondary');assert.equal(opts.priority,'low');assert.equal(tokens,300);assert(prompt.includes('盐课专营'));return new Promise(r=>resolve=r);};
  const r=creator.createClass(g,input);assert(r.ok);await flush();assert.equal(calls,1);
  assert.notStrictEqual(r.entity.descriptor,input.descriptor);assert(r.entity.descriptor._needsAdjudication);
  resolve(JSON.stringify({stratum:'中',fiscalStatus:'法外',unrestArchetype:'撤离'}));await flush();
  assert.equal(r.entity.descriptor.fiscalStatus,'法外');assert.equal(r.entity.descriptor._raw_fiscalStatus,'盐课专营');assert.equal(input.descriptor.fiscalStatus,'盐课专营');
  assert(creator.createClass(g,input).duplicate);await flush();assert.equal(calls,1);assert.equal(g.classes.length,1);
 });
 for(const mode of ['world','rollback','manual','turn'])await check('late descriptor result cannot overwrite '+mode,async()=>{
  const g=fixture();let resolve;globalThis.callAI=()=>new Promise(r=>resolve=r);const r=creator.createClass(g,raw());await flush();
  if(mode==='world')globalThis.GM={...g};if(mode==='rollback')g.classes=[];if(mode==='manual')r.entity.descriptor.fiscalStatus='玩家修改';if(mode==='turn')g.turn++;
  const before=JSON.stringify(r.entity.descriptor);resolve('{"fiscalStatus":"法外","stratum":"中"}');await flush();assert.equal(JSON.stringify(r.entity.descriptor),before);
 });
 await check('failed adjudication preserves raw descriptor without an automatic loop',async()=>{
  const g=fixture();let calls=0;globalThis.callAI=async()=>{calls++;throw Error('controlled failure');};const r=creator.createClass(g,raw());await flush();await flush();assert.equal(calls,1);assert.equal(r.entity.descriptor.fiscalStatus,'盐课专营');
 });
 await check('invalid and ambiguous party founders are rejected before insertion',async()=>{
  const g=fixture();g.chars=[{id:'a',name:'同名',alive:true},{id:'b',name:'同名',alive:true},{id:'dead',name:'亡者',alive:false}];
  for(const ref of ['missing','dead','同名']){const r=creator.createParty(g,{name:'新党'+ref,leader:ref,reason:'明确本局事件'});assert.equal(r.ok,false);assert.equal(g.parties.length,0);assert(!g.chars.some(c=>c.party));}
  const r=creator.createParty(g,{name:'正党',leaderId:'a',reason:'本局共同政见'});assert(r.ok);assert.equal(g.parties.length,1);assert.equal(r.entity.leaderId,'a');assert.deepEqual(r.entity.memberIds,['a']);assert.equal(g.chars[0].partyId,r.entity.id);assert(!g.chars[1].partyId);
 });
 await check('ordinary reconciled descriptors add no AI call',async()=>{
  const g=fixture();let calls=0;globalThis.callAI=async()=>{calls++;return '{}';};const input=raw();input.descriptor={stratum:'中',fiscalStatus:'编户',unrestArchetype:'撤离'};
  assert(creator.createClass(g,input).ok);await flush();assert.equal(calls,0);
 });
 console.log(JSON.stringify({pass:passed,fail:0,skip:0,waived:0}));
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
