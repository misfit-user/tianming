'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../tm-save-lifecycle.js'), 'utf8');
const jobs = fs.readFileSync(path.join(__dirname, '../tm-post-turn-jobs.js'), 'utf8');
function fn(src, name) { const start = src.indexOf('function ' + name + '('); for (let i = src.indexOf('}', start); i >= 0; i = src.indexOf('}', i + 1)) { try { new vm.Script('(' + src.slice(start, i + 1) + ')'); return src.slice(start, i + 1); } catch (_) {} } throw new Error('function missing'); }
function deferred(){let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};}
function harness(){
  const io=[], messages=[];let name='save-A', background=Promise.resolve();
  const c={GM:{sid:'A',turn:20,_campaignId:'A',_timelineId:'A',saveName:'old-A'},P:{meta:{v:'test'}},Promise,console,
    _$:()=>({value:name}),findScenarioById:()=>({name:'scenario'}),getTSText:()=>'',toast:x=>messages.push(x),enterGame:()=>messages.push('enter'),
    _tmAwaitLoadBarrier:async()=>true,_awaitPostTurnJobsForSave:()=>background};
  c.window=c;c._buildSaveState=()=>({gameState:structuredClone(c.GM)});
  c.tianming={saveProject:(name,data)=>{const d=deferred();io.push({name,data,...d});return d.promise;}};
  vm.createContext(c);vm.runInContext(fn(jobs,'_tmCaptureWorldLease')+';'+fn(jobs,'_tmWorldLeaseCurrent'),c);
  vm.runInContext(source.slice(source.indexOf('window.desktopDoSave=async function'),source.indexOf('// 2. 读档')),c);
  return {c,io,messages,setName:n=>{name=n;},setBackground:p=>{background=p;},switchWorld:()=>{c.GM={...c.GM,_campaignId:'B',_timelineId:'B',saveName:'B'};c.P={meta:{v:'B'}};}};
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
  const h=harness(), before=JSON.stringify(h.c.GM), saved=h.c.desktopDoSave();await tick();
  assert.equal(JSON.stringify(h.c.GM),before);h.io[0].resolve({success:true});assert.equal(await saved,true);assert.equal(h.c.GM.saveName,'save-A');
  for(const failure of [false,'reject']){const t=harness(), p=t.c.desktopDoSave();await tick();if(failure)t.io[0].reject(new Error('disk'));else t.io[0].resolve({success:false});assert.equal(await p,false);assert.equal(t.c.GM.saveName,'old-A');assert.ok(!t.messages.includes('enter'));}
  const b=harness(), wait=deferred();b.setBackground(wait.promise);const waiting=b.c.desktopDoSave();await tick();b.switchWorld();wait.resolve();assert.equal(await waiting,false);assert.equal(b.io.length,0);
  const barrier=harness(), load=deferred();barrier.c._tmAwaitLoadBarrier=()=>load.promise;const loading=barrier.c.desktopDoSave();await tick();barrier.switchWorld();load.resolve();assert.equal(await loading,false);assert.equal(barrier.io.length,0);assert.equal(barrier.messages.length,0);
  const late=harness(), p=late.c.desktopDoSave();await tick();late.switchWorld();late.io[0].resolve({success:true});assert.equal(await p,false);assert.equal(late.c.GM.saveName,'B');assert.equal(late.messages.length,0);
  const order=harness(), first=order.c.desktopDoSave();await tick();order.setName('save-latest');const second=order.c.desktopDoSave();await tick();assert.equal(order.io.length,1);order.io[0].resolve({success:true});assert.equal(await first,false);await tick();assert.equal(order.io.length,2);order.io[1].resolve({success:true});assert.equal(await second,true);assert.equal(order.c.GM.saveName,'save-latest');
  console.log('PASS manual save lease, detached state, failures, same-turn world replacement and serial intent order');
})().catch(error=>{console.error(error);process.exitCode=1;});
