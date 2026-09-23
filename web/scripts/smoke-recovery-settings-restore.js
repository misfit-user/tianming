'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync(path.resolve(__dirname,'../tm-utils.js'),'utf8'),tests=[];
const test=(name,fn)=>tests.push({name,fn}),tick=()=>new Promise(r=>setImmediate(r));
const selected={mode:'auto',tier:'same',maxCalls:6,maxRepairs:3,maxSteps:18,maxTokens:120000,timeoutMs:0};
function fixture(conf,desktop=false,lateStorage=false){
  const store={};if(conf!==null)store.tm_P_lite=JSON.stringify({scenarios:[],ai:{},conf,_hasFullData:true});
  let resolveIDB,resolveDesktop,loads=0;const events=[],timers=[],listeners=new Map();
  const db={loadProject:()=>{loads++;return new Promise(r=>{resolveIDB=r;});},saveProject:()=>Promise.resolve(true)};
  const c={console:{log(){},warn(){},error(){}},JSON,Object,Array,Math,Date,Promise,Error,TypeError,Number,String,Boolean,RegExp,parseInt,parseFloat,isNaN,encodeURIComponent,decodeURIComponent,
    P:{scenarios:[],ai:{},conf:{}},GM:{running:false},setTimeout:fn=>{timers.push(fn);return timers.length;},clearTimeout(){},
    localStorage:{getItem:k=>Object.hasOwn(store,k)?store[k]:null,setItem:(k,v)=>{store[k]=String(v);},removeItem:k=>{delete store[k];}},
    TM_SaveDB:db,
    document:{readyState:'loading',querySelector:()=>null,createElement:()=>({click(){}}),addEventListener:(type,fn)=>listeners.set(type,(listeners.get(type)||[]).concat(fn)),createEvent:()=>({initEvent(){}})},navigator:{userAgent:'fixture'},
    CustomEvent:function(type,opts){this.type=type;this.detail=opts.detail;},dispatchEvent:e=>events.push(e)};
  if(lateStorage)delete c.TM_SaveDB;
  c.window=c;if(desktop)c.tianming={isDesktop:true,loadAutoSave:()=>new Promise(r=>{resolveDesktop=r;})};
  vm.createContext(c);vm.runInContext(source,c,{filename:'tm-utils.js'});
  return {c,store,events,idb:p=>resolveIDB(p),desktop:p=>resolveDesktop({success:true,data:p}),loads:()=>loads,
    expire:()=>{for(let i=0;i<101;i++)timers.splice(0).forEach(fn=>fn());},
    ready:(available=true)=>{if(available)c.TM_SaveDB=db;c.document.readyState='interactive';(listeners.get('DOMContentLoaded')||[]).forEach(fn=>fn());},
    timerCount:()=>timers.length};
}
function oldProject(){return {scenarios:[{id:'custom',name:'旧项目'}],characters:[],ai:{},conf:{emergencyRecovery:{...selected,mode:'off',maxTokens:4000},aiCallRetryOverrides:{sc1:0},unrelatedProjectFlag:'restored'}};}
function equal(value,expected){assert.equal(JSON.stringify(value),JSON.stringify(expected));}
test('late IndexedDB project cannot replace the latest synchronous recovery or retry preferences',async()=>{
  const f=fixture({emergencyRecovery:selected,aiCallRetryOverrides:{sc1:8}});equal(f.c.P.conf.emergencyRecovery,selected);
  f.idb(oldProject());await tick();equal(f.c.P.conf.emergencyRecovery,selected);equal(f.c.P.conf.aiCallRetryOverrides,{sc1:8});
  assert.equal(f.c.P.conf.unrelatedProjectFlag,'restored');assert.equal(f.c.P.scenarios[0].id,'custom');
});
test('explicitly disabled recovery and an empty retry override survive desktop autosave restoration',async()=>{
  const disabled={...selected,mode:'off'},f=fixture({emergencyRecovery:disabled,aiCallRetryOverrides:{}},true);
  f.idb(null);await tick();
  f.desktop({...oldProject(),conf:{emergencyRecovery:selected,aiCallRetryOverrides:{sc1:15}}});await tick();equal(f.c.P.conf.emergencyRecovery,disabled);equal(f.c.P.conf.aiCallRetryOverrides,{});
});
test('settings saved while an old project read is pending remain authoritative',async()=>{
  const f=fixture({emergencyRecovery:{...selected,mode:'off'}}),saved={...selected,maxCalls:9};
  f.c.P.conf.emergencyRecovery=saved;f.c.P.conf.aiCallRetryOverrides={sc25c:4};f.c.saveP();
  f.idb(oldProject());await tick();equal(f.c.P.conf.emergencyRecovery,saved);equal(f.c.P.conf.aiCallRetryOverrides,{sc25c:4});
});
test('incomplete official project merge retains current recovery settings without losing custom data',async()=>{
  const f=fixture({emergencyRecovery:selected});f.idb({...oldProject(),scenarios:[{id:'sc-tianqi7-1627',name:'官方'},{id:'custom',name:'自建'}]});await tick();
  equal(f.c.P.conf.emergencyRecovery,selected);assert(f.c.P.scenarios.some(s=>s.id==='custom'));
});
test('legacy projects with no device override retain their own stored preferences',async()=>{
  const f=fixture(null),old=oldProject();f.idb(old);await tick();equal(f.c.P.conf.emergencyRecovery,old.conf.emergencyRecovery);
});
test('malformed lite cache does not suppress valid project restoration',async()=>{
  const f=fixture(null);f.store.tm_P_lite='{bad json';const old=oldProject();f.idb(old);await tick();equal(f.c.P.conf.emergencyRecovery,old.conf.emergencyRecovery);assert.equal(f.c.P.scenarios.length,1);
});
test('restored listeners see the rehydrated setting, not the stale intermediate value',async()=>{
  const f=fixture({emergencyRecovery:selected});let observed;f.c.dispatchEvent=()=>{observed=f.c.P.conf.emergencyRecovery.mode;};f.idb(oldProject());await tick();assert.equal(observed,'auto');
});
test('storage loaded after the initial polling window still restores after real script readiness',async()=>{
  const f=fixture({emergencyRecovery:selected},false,true);f.expire();assert.equal(f.loads(),0);assert.equal(f.timerCount(),0);
  f.ready();assert.equal(f.loads(),1);f.idb(oldProject());await tick();equal(f.c.P.conf.emergencyRecovery,selected);assert.equal(f.c.P.scenarios[0].id,'custom');
});
test('missing storage at script completion stops without endless timers or fabricated restoration',()=>{
  const f=fixture(null,false,true);f.expire();f.ready(false);assert.equal(f.loads(),0);assert.equal(f.timerCount(),0);assert.equal(f.events.length,0);
});
test('loading an old game preserves current recovery and retry budgets through the production load owner',async()=>{
  const lifecycle=fs.readFileSync(path.resolve(__dirname,'../tm-save-lifecycle.js'),'utf8');
  const keys=lifecycle.match(/var PREF_CONF_KEYS = \[[\s\S]*?\];/)[0];
  const start=lifecycle.indexOf('async function _fullLoadGameApplyImpl('),stop=lifecycle.indexOf('  if(GM){',start);
  const selected={mode:'off',tier:'primary',maxCalls:100,maxRepairs:50,maxSteps:1000,maxTokens:2000000,timeoutMs:0};
  const c={P:{conf:{emergencyRecovery:selected,aiCallRetryOverrides:{sc1:8}}},GM:{},TM:{},localStorage:{getItem:()=>null},
    _tmCulturalRestoreOptions:()=>({}),_tmStripSaveTransportMetadata(){},_ensurePDefaults(){},_ensureGMDefaults(){},_tmRunCriticalLoadStep:(_n,fn)=>fn()};
  c.window=c;vm.createContext(c);vm.runInContext(keys+'\n'+lifecycle.slice(start,stop)+'return true;}',c);
  await c._fullLoadGameApplyImpl({gameState:{GM:{turn:1},P:{conf:{emergencyRecovery:{mode:'auto',maxCalls:6},aiCallRetryOverrides:{sc1:0},difficulty:'saved'}}}},{});
  equal(c.P.conf.emergencyRecovery,selected);equal(c.P.conf.aiCallRetryOverrides,{sc1:8});assert.equal(c.P.conf.difficulty,'saved');
});
(async()=>{let pass=0,fail=0;for(const t of tests)try{await t.fn();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
