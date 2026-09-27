'use strict';
// Read-only production audit. All mutations happen in a fresh offline VM.
const fs=require('fs'),path=require('path'),vm=require('vm');
const root=path.resolve(__dirname,'../../..'),dir=path.join(root,'web/scripts');
const helperFile=path.join(dir,'smoke-start-game-data-integrity.js');
const source=fs.readFileSync(helperFile,'utf8').replace(/^#![^\n]*\n/,'');
const end=source.indexOf('(async function main()');
if(end<0)throw Error('harness boundary missing');
const h=new Function('require','process','__dirname','__filename','module','exports',source.slice(0,end)+'\nreturn {loadGame,countState};')(require,process,dir,helperFile,{exports:{}},{});
const c=h.loadGame(null);
const scenario=JSON.parse(fs.readFileSync(path.join(root,'scenarios/天启七年·九月（官方）.json'),'utf8'));
c.__source=scenario;
const startupGates=[];
const originalGate=c.TM.ClassEngine.gateSatisfaction;
c.TM.ClassEngine.gateSatisfaction=function(g,cls,delta,info){
  const before=cls.satisfaction,result=originalGate.apply(this,arguments);
  startupGates.push({turn:g.turn,name:cls.name,source:info?.source,requested:delta,before,after:cls.satisfaction,result});
  return result;
};
vm.runInContext(`P.scenarios=(P.scenarios||[]).filter(s=>s.id!==__source.id);P.scenarios.push(__source);P.ai.key='';P.ai.url='';P.ai.model='';doActualStart(__source.id);`,c,{timeout:60000});
const copy=x=>JSON.parse(JSON.stringify(x));
const summary=g=>copy({turn:g.turn,classes:g.classes.map(x=>({name:x.name,satisfaction:x.satisfaction,baseline:x._structBaseline,ledger:x._satLedger,budget:x._satBudget})),parties:g.parties,partyState:g.partyState||{},coupling:g._classPartyCouplingLog||[],inputs:g._socialStructInputs||{}});
setTimeout(()=>{try{
  const seed=copy(c.GM),config=copy(c.P);
  c.TM.ClassEngine.gateSatisfaction=originalGate;
  const out={scope:'Official full startup; exercise real scheduler and SocialFoundation only, including their own feedback. No AI or player actions and no external economic/army tick. This is a causal isolation experiment, not a complete gameplay simulation.',startupGates:copy(startupGates),initial:summary(seed),initialPressureFields:{fiscal:seed.fiscal,corruption:seed.corruption,armies:seed.armies?.map(a=>({name:a.name,payArrearsMonths:a.payArrearsMonths})),landAnnexation:seed.landAnnexation,minxin:seed.minxin?.trueIndex},runs:{}};
  for(const mode of ['foundation-only','pressure-only','scheduler-foundation']){
    c.GM=copy(seed);c.P=copy(config);
    const rows=[];
    for(let turn=1;turn<=6;turn++){
      c.GM.turn=turn;
      let scan,apply,scheduler;
      if(mode==='pressure-only'){
        scan=c.TM.SocialPoliticalSignals.scanRuntimePressures(c.GM,{source:'pre-submit-party-class-action-scheduler',turn});
        apply=c.TM.PartyClassSignalBridge?c.TM.PartyClassSignalBridge.applyPending(c.GM,{source:'pre-submit-party-class-action-scheduler',turn}):c.TM.SocialPoliticalSignals.applyPending(c.GM,{source:'pre-submit-party-class-action-scheduler',turn});
      }
      if(mode==='scheduler-foundation')scheduler=c.TM.PartyClassActionScheduler.scheduleBeforeSubmit(c.GM,{source:'pre-submit-party-class-action-scheduler',turn});
      if(mode!=='pressure-only')c.TM.SocialFoundation.tick(c.GM,c.P);
      rows.push({...summary(c.GM),scan:scan&&copy(scan),scheduler:scheduler&&copy(scheduler),apply:apply&&copy(apply),signals:copy(c.GM._socialPoliticalSignals?.items||[])});
    }
    out.runs[mode]=rows;
  }
  c.GM=copy(seed);c.P=copy(config);
  let scans=[];
  for(const src of ['probe-a','probe-a','probe-b']){
    const scan=c.TM.SocialPoliticalSignals.scanRuntimePressures(c.GM,{source:src,turn:1});
    c.TM.SocialPoliticalSignals.applyPending(c.GM,{source:src,turn:1});
    scans.push({source:src,kinds:scan.kinds,classes:summary(c.GM).classes});
  }
  out.repeatedScan=scans;
  c.GM=copy(seed);c.P=copy(config);
  const testClass=c.GM.classes.find(x=>x.name==='商人');
  const minus=c.TM.ClassEngine.gateSatisfaction(c.GM,testClass,-14,{turn:1,source:'audit-negative'});
  const plus=c.TM.ClassEngine.gateSatisfaction(c.GM,testClass,10,{turn:1,source:'audit-relief'});
  out.oppositeSignBudget={minus,plus,ledger:testClass._satLedger};
  fs.writeFileSync(path.join(__dirname,'class-results.json'),JSON.stringify(out,null,2));
  console.log('AUDIT_CLASSES '+JSON.stringify({initial:out.initial.classes.map(x=>[x.name,x.satisfaction]),runs:Object.fromEntries(Object.entries(out.runs).map(([name,rows])=>[name,rows.map(r=>({turn:r.turn,satisfaction:r.classes.map(x=>x.satisfaction),signalKinds:r.scan?.kinds||r.scheduler?.runtimeSignals?.kinds}))])),oppositeSignBudget:out.oppositeSignBudget}));
  process.exit(0);
}catch(e){console.error(e.stack);process.exit(1);}},200);
