#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),assert=require('assert');
const repo=path.resolve(__dirname,'../..'),file=path.join(__dirname,'smoke-start-game-data-integrity.js');
const source=fs.readFileSync(file,'utf8').replace(/^#![^\n]*\n/,'');
const end=source.indexOf('(async function main()');
assert(end>0,'full startup helper boundary missing');
const h=new Function('require','process','__dirname','__filename','module','exports',source.slice(0,end)+'\nreturn {loadGame};')(require,process,__dirname,file,{exports:{}},{});
const c=h.loadGame(null),sc=JSON.parse(fs.readFileSync(path.join(repo,'scenarios/天启七年·九月（官方）.json'),'utf8'));
let calls=0;const gate=c.TM.ClassEngine.gateSatisfaction;
c.TM.ClassEngine.gateSatisfaction=function(g,cls,d,info){if(info?.source==='renli-corvee-grain')calls++;return gate.apply(this,arguments);};
c.__source=sc;
vm.runInContext(`P.scenarios=(P.scenarios||[]).filter(s=>s.id!==__source.id);P.scenarios.push(__source);P.ai.key='';P.ai.url='';P.ai.model='';doActualStart(__source.id);`,c,{timeout:60000});
function protectedState(){
  return JSON.stringify({turn:c.GM.turn,classes:c.GM.classes.map(x=>[x.name,x.satisfaction,x._satBudget,x.regionalVariants]),
    population:c.GM.population,treasury:c.GM.guoku,memorials:c.GM.memorials,letters:c.GM.letters,
    leaves:c.TM.Renli.leaves(c.P).map(leaf=>{const p=c.TM.Renli.popOf(leaf)||{},r=c.GM.renli?.byRegion?.[leaf.id||leaf.name]||{};
      return [leaf.id||leaf.name,p.ding,p.fugitives,p.fledDing,p.hiddenCount,p.hiddenDing,p.commendedDing,r.soil,r.levyPolicy?.remitTurns];})});
}
setTimeout(()=>{try{
  assert.strictEqual(c.GM.turn,1,'opening must not advance the turn');
  assert.strictEqual(calls,0,'opening must not execute renli satisfaction settlement');
  for(const expected of sc.classes)assert.strictEqual(c.GM.classes.find(x=>x.name===expected.name).satisfaction,expected.satisfaction,'opening must preserve scenario satisfaction: '+expected.name);
  const before=protectedState();c.TM.Renli.prime(c.GM,c.P);c.TM.Renli.prime(c.GM,c.P);
  assert.strictEqual(protectedState(),before,'repeated opening prime must not settle population, policy duration, soil, treasury, classes or correspondence');
  assert(Object.values(c.GM.renli.byRegion).some(x=>x.ready && x.grainOutput>=0),'opening still derives the seeded local role/grain view');
  console.log('[smoke-opening-renli-prime] PASS complete official startup preserves all class values, zero renli gate calls, repeated prime has no turn side effects');
  process.exit(0);
}catch(e){console.error('[smoke-opening-renli-prime] FAIL',e.stack);process.exit(1);}},150);
