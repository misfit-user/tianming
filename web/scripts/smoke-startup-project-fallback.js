'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=process.env.TM_STARTUP_SOURCE_ROOT||path.resolve(__dirname,'..');
const utils=fs.readFileSync(path.join(root,'tm-utils.js'),'utf8');
const core=fs.readFileSync(path.join(root,'tm-player-core.js'),'utf8');
const lifecycle=fs.readFileSync(path.join(root,'tm-save-lifecycle.js'),'utf8');
const apiStart=core.indexOf('(function(){',core.indexOf('//  启动时加载API配置'));
const apiBlock=core.slice(apiStart,core.indexOf('})();',apiStart)+5);
const startupEnd=lifecycle.indexOf('// 6b.'),startupStart=lifecycle.lastIndexOf('if(_tmHasNativeFs()){',startupEnd);
const startupBlock=lifecycle.slice(startupStart,startupEnd);
const tick=()=>new Promise(r=>setImmediate(r)),tests=[];let passed=0;
function project(id='saved'){return {scenarios:[{id,name:id}],characters:[],ai:{url:'fixture-url',model:'fixture-model'},conf:{marker:id}};}
function fixture(options={}){
 const calls={desktop:0,idb:0,ticks:0},events=[],timers=[],intervals=[],listeners={};let resolveIDB,rejectIDB,resolveDesktop,rejectDesktop;
 const store={tm_api:JSON.stringify({key:'fixture-device-key',url:'device-url',model:'device-model'})};
 const db={loadProject(){calls.idb++;if(options.syncError)throw Error('fixture storage unavailable');return new Promise((a,b)=>{resolveIDB=a;rejectIDB=b;});},saveProject:()=>Promise.resolve(true)};
 const c={console:{log(){},warn(){},error(){}},P:{scenarios:[],ai:{},conf:{}},GM:{running:false},Promise,JSON,Math,Date,Object,Array,Number,String,Boolean,RegExp,parseInt,parseFloat,isNaN,encodeURIComponent,decodeURIComponent,
  localStorage:{getItem:k=>store[k]??null,setItem:(k,v)=>store[k]=v,removeItem:k=>delete store[k]},
  setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},setInterval:(fn,ms)=>intervals.push({fn,ms}),
  document:{readyState:options.late?'loading':'complete',querySelector:()=>null,createElement:()=>({click(){}}),addEventListener:(n,fn)=>{(listeners[n]||=[]).push(fn);}},navigator:{userAgent:'fixture'},
  CustomEvent:function(type,opts){this.type=type;this.detail=opts.detail;},dispatchEvent:e=>events.push(e),
  _tmHasNativeFs:()=>true,_tmRunDesktopAutoSaveTick:async()=>{calls.ticks++;},
  tianming:{isDesktop:true,loadAutoSave(){calls.desktop++;return new Promise((a,b)=>{resolveDesktop=a;rejectDesktop=b;});}}};
 if(!options.missingStorage&&!options.late)c.TM_SaveDB=db;c.window=c;vm.createContext(c);
 vm.runInContext(utils,c,{filename:'tm-utils.js'});vm.runInContext(apiBlock,c,{filename:'tm-player-core.js:startup'});vm.runInContext(startupBlock,c,{filename:'tm-save-lifecycle.js:startup'});
 return {c,calls,events,intervals,idb:v=>resolveIDB(v),fail:()=>rejectIDB(Error('fixture IDB failure')),desktop:v=>resolveDesktop(v),desktopFail:()=>rejectDesktop(Error('fixture backup failure')),
  expire(){for(let i=0;i<102;i++)timers.splice(0).forEach(fn=>fn());},ready(){c.TM_SaveDB=db;c.document.readyState='complete';(listeners.DOMContentLoaded||[]).forEach(fn=>fn());}};
}
function test(name,fn){tests.push({name,fn});}
test('all three startup owners wait for the primary project without reading the full backup',async()=>{const f=fixture();await tick();assert.equal(f.calls.desktop,0);f.idb(project());await tick();assert.equal(f.calls.desktop,0);assert.equal(f.c.P.scenarios[0].id,'saved');assert.equal(f.c.P.ai.key,'fixture-device-key');assert.equal(f.events.length,1);});
test('valid empty primary project does not resurrect a deleted project from the backup',async()=>{const f=fixture();f.idb({...project(),scenarios:[]});await tick();assert.equal(f.calls.desktop,0);assert.equal(f.c.P.scenarios.length,0);});
test('incomplete official caches preserve custom scenarios without redundant desktop reads',async()=>{const f=fixture();f.idb({...project(),scenarios:[{id:'sc-tianqi7-1627'},{id:'custom'}]});await tick();assert.equal(f.calls.desktop,0);assert(f.c.P.scenarios.some(s=>s.id==='custom'));});
test('missing project reads the desktop backup exactly once and never enters its running game',async()=>{const f=fixture();f.idb(null);await tick();assert.equal(f.calls.desktop,1);f.desktop({success:true,data:{...project('backup'),gameState:{running:true,turn:77}}});await tick();assert.equal(f.c.P.scenarios[0].id,'backup');assert.equal(f.c.P.ai.key,'fixture-device-key');assert.equal(f.c.GM.running,false);assert.equal(f.c.P.gameState,undefined);assert.equal(f.calls.desktop,1);});
test('malformed project takes the single validated backup path',async()=>{const f=fixture();f.idb({scenarios:'invalid'});await tick();assert.equal(f.calls.desktop,1);f.desktop({success:false});await tick();assert.equal(f.c.P.scenarios.length,0);});
test('async storage failure retains one desktop recovery attempt',async()=>{const f=fixture();f.fail();await tick();assert.equal(f.calls.desktop,1);f.desktop({success:true,data:project('recovered')});await tick();assert.equal(f.c.P.scenarios[0].id,'recovered');});
test('synchronous storage failure is also recoverable',async()=>{const f=fixture({syncError:true});await tick();assert.equal(f.calls.desktop,1);f.desktop({success:true,data:project('recovered')});await tick();assert.equal(f.c.P.scenarios[0].id,'recovered');});
test('missing storage after the bounded readiness wait falls back once',async()=>{const f=fixture({missingStorage:true});f.expire();await tick();assert.equal(f.calls.idb,0);assert.equal(f.calls.desktop,1);});
test('slow script loading still gets primary storage first at DOM readiness',async()=>{const f=fixture({late:true});f.expire();await tick();assert.equal(f.calls.desktop,0);f.ready();assert.equal(f.calls.idb,1);f.idb(project());await tick();assert.equal(f.calls.desktop,0);});
test('a game started while the primary read was pending cannot trigger a late backup read',async()=>{const f=fixture();f.c.GM.running=true;f.idb(null);await tick();assert.equal(f.calls.desktop,0);});
test('a backup already in flight cannot overwrite a newly started game',async()=>{const f=fixture();f.idb(null);await tick();f.c.GM.running=true;f.c.P.scenarios=[{id:'playing'}];f.desktop({success:true,data:project('old')});await tick();assert.equal(f.c.P.scenarios[0].id,'playing');});
test('a replaced world rejects a stale project fallback',async()=>{const f=fixture();f.idb(null);await tick();f.c.GM={running:false};f.desktop({success:true,data:project('old')});await tick();assert.equal(f.c.P.scenarios.length,0);});
test('failed backup does not invent recovered data or launch another read',async()=>{const f=fixture();f.idb(null);await tick();f.desktopFail();await tick();assert.equal(f.calls.desktop,1);assert.equal(f.c.P.scenarios.length,0);});
test('periodic desktop autosave remains scheduled at 60 seconds',async()=>{const f=fixture();f.idb(project());await tick();assert.equal(f.intervals.length,1);assert.equal(f.intervals[0].ms,60000);await f.intervals[0].fn();assert.equal(f.calls.ticks,1);});
(async()=>{for(const t of tests){await t.fn();passed++;console.log('PASS '+t.name);}console.log('PASS '+passed+' startup project fallback scenarios');})().catch(e=>{console.error(e.stack);process.exitCode=1;});
