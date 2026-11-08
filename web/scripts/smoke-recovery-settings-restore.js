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
for(const count of [0,1,7,20])test('secondary retry '+count+' survives delayed old projects and a fresh restart',async()=>{
  const f=fixture({aiSecondaryRetryCount:count});assert.equal(f.c.P.conf.aiSecondaryRetryCount,count);
  f.idb({...oldProject(),conf:{aiSecondaryRetryCount:12}});await tick();assert.equal(f.c.P.conf.aiSecondaryRetryCount,count);
  f.c.saveP();const saved=JSON.parse(f.store.tm_P_lite).conf;assert.equal(saved.aiSecondaryRetryCount,count);
  const restarted=fixture(saved);assert.equal(restarted.c.P.conf.aiSecondaryRetryCount,count);
  restarted.idb({...oldProject(),conf:{aiSecondaryRetryCount:12}});await tick();assert.equal(restarted.c.P.conf.aiSecondaryRetryCount,count);
});
test('secondary retry zero survives desktop autosave restoration',async()=>{
  const f=fixture({aiSecondaryRetryCount:0},true);f.idb(null);await tick();
  f.desktop({...oldProject(),conf:{aiSecondaryRetryCount:12}});await tick();assert.equal(f.c.P.conf.aiSecondaryRetryCount,0);
});
test('secondary retries saved while an old project read is pending stay authoritative',async()=>{
  const f=fixture({aiSecondaryRetryCount:1});f.c.P.conf.aiSecondaryRetryCount=6;f.c.saveP();
  f.idb({...oldProject(),conf:{aiSecondaryRetryCount:12}});await tick();assert.equal(f.c.P.conf.aiSecondaryRetryCount,6);
});
test('unconfigured legacy projects leave secondary retry policy defaults implicit',async()=>{
  const f=fixture({});assert.equal(Object.hasOwn(f.c.P.conf,'aiSecondaryRetryCount'),false);
  f.idb(oldProject());await tick();assert.equal(Object.hasOwn(f.c.P.conf,'aiSecondaryRetryCount'),false);
  f.c.saveP();assert.equal(Object.hasOwn(JSON.parse(f.store.tm_P_lite).conf,'aiSecondaryRetryCount'),false);
});
test('valid legacy secondary preferences restore when no device choice exists',async()=>{
  const f=fixture(null);f.idb({...oldProject(),conf:{aiSecondaryRetryCount:4}});await tick();assert.equal(f.c.P.conf.aiSecondaryRetryCount,4);
});
for(const count of [-1,1.5,21,'5',{},null])test('invalid device secondary retry '+JSON.stringify(count)+' cannot overwrite a valid restored value',async()=>{
  const f=fixture({aiSecondaryRetryCount:count});f.idb({...oldProject(),conf:{aiSecondaryRetryCount:4}});await tick();assert.equal(f.c.P.conf.aiSecondaryRetryCount,4);
});

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
for(const count of [0,1,7,20])test('loading an old game preserves current recovery and retry budgets including secondary '+count,async()=>{
  const lifecycle=fs.readFileSync(path.resolve(__dirname,'../tm-save-lifecycle.js'),'utf8');
  const keys=lifecycle.match(/var PREF_CONF_KEYS = \[[\s\S]*?\];/)[0];
  const start=lifecycle.indexOf('async function _fullLoadGameApplyImpl('),stop=lifecycle.indexOf('  if(GM){',start);
  const selected={mode:'off',tier:'primary',maxCalls:100,maxRepairs:50,maxSteps:1000,maxTokens:2000000,timeoutMs:0};
  const c={P:{conf:{emergencyRecovery:selected,aiCallRetryOverrides:{sc1:8},aiSecondaryRetryCount:count}},GM:{},TM:{},localStorage:{getItem:()=>null},
    _tmCulturalRestoreOptions:()=>({}),_tmStripSaveTransportMetadata(){},_ensurePDefaults(){},_ensureGMDefaults(){},_tmRunCriticalLoadStep:(_n,fn)=>fn()};
  c.window=c;vm.createContext(c);vm.runInContext(keys+'\n'+lifecycle.slice(start,stop)+'return true;}',c);
  await c._fullLoadGameApplyImpl({gameState:{GM:{turn:1},P:{conf:{emergencyRecovery:{mode:'auto',maxCalls:6},aiCallRetryOverrides:{sc1:0},aiSecondaryRetryCount:12,difficulty:'saved'}}}},{});
  equal(c.P.conf.emergencyRecovery,selected);equal(c.P.conf.aiCallRetryOverrides,{sc1:8});assert.equal(c.P.conf.aiSecondaryRetryCount,count);assert.equal(c.P.conf.difficulty,'saved');
});
function progressFixture(){
  const listeners=new Map(),cancelled=[],active=new Map();let document,endTop=648,hasEnd=true;
  class Element{
    constructor(tag){this.tagName=tag.toUpperCase();this.children=[];this.attributes={};this.events={};this.style={};this.hidden=false;this.textContent='';}
    appendChild(child){child.parentNode=this;this.children.push(child);return child;}
    append(...children){children.forEach(child=>this.appendChild(child));}
    replaceChildren(){this.children.forEach(child=>{child.parentNode=null;});this.children=[];}
    setAttribute(key,value){this.attributes[key]=String(value);}
    getAttribute(key){return Object.hasOwn(this.attributes,key)?this.attributes[key]:null;}
    addEventListener(type,fn){(this.events[type]||=[]).push(fn);}
    contains(child){return this===child||this.children.some(node=>node.contains(child));}
    click(){(this.events.click||[]).forEach(fn=>fn({target:this}));}
    focus(){document.activeElement=this;}
    remove(){if(this.parentNode){this.parentNode.children=this.parentNode.children.filter(node=>node!==this);this.parentNode=null;}}
  }
  const body=new Element('body'),walk=node=>[node,...node.children.flatMap(walk)],end={getBoundingClientRect:()=>({top:endTop})};
  document={body,activeElement:body,createElement:tag=>new Element(tag),querySelector:selector=>selector==='#endturn .et-big'&&hasEnd?end:null,
    getElementById:id=>walk(body).find(node=>node.id===id)||null};
  const c=vm.createContext({document,innerHeight:720,console,Number,String,TM:{
    RecoveryReview:{status:()=>[...active.values()],cancel:id=>{cancelled.push({kind:'turn-review',id});active.delete(id);}},
    EmergencyRecovery:{cancel:id=>{cancelled.push({kind:'recovery',id});active.delete(id);}}},
    GM:Object.freeze({turn:3}),P:Object.freeze({conf:Object.freeze({})}),saveP(){throw Error('progress display must not save');},
    addEventListener:(type,fn)=>listeners.set(type,(listeners.get(type)||[]).concat(fn))});
  c.window=c;vm.runInContext(fs.readFileSync(path.resolve(__dirname,'../tm-emergency-recovery-settings.js'),'utf8'),c,{filename:'tm-emergency-recovery-settings.js'});
  function emit(row){if(row.phase==='verified'||row.phase==='stopped')active.delete(row.id);else active.set(row.id,row);(listeners.get('tm-emergency-recovery')||[]).forEach(fn=>fn({detail:row}));}
  return {c,document,cancelled,emit,walk,panel:()=>document.getElementById('tm-recovery-progress'),details:()=>document.getElementById('tm-recovery-progress-details'),
    toggle:()=>walk(body).find(node=>node.getAttribute('data-recovery-collapse')!==null),
    button:text=>walk(body).find(node=>node.tagName==='BUTTON'&&node.textContent===text),
    resize:(height,top)=>{c.innerHeight=height;endTop=top;(listeners.get('resize')||[]).forEach(fn=>fn());},noEnd:()=>{hasEnd=false;}};
}
function progressRow(id='review-active',phase='investigating',kind='turn-review'){
  return Object.freeze({id,phase,kind,call:'每回合复核',detail:'核查完整原文',calls:2,steps:1,repairs:1,estimatedTokens:32789,budget:Object.freeze({maxCalls:6,maxTokens:0})});
}
test('progress collapse and expansion preserve the active row and never cancel or save',()=>{
  const f=progressFixture(),row=progressRow(),before=JSON.stringify(row);f.emit(row);
  const collapse=f.toggle();assert.equal(collapse.tagName,'BUTTON');assert.equal(collapse.type,'button');assert.equal(collapse.textContent,'收起进度');
  assert.equal(collapse.getAttribute('data-recovery-collapse'),'true');assert.equal(collapse.getAttribute('aria-expanded'),'true');assert.equal(collapse.getAttribute('aria-controls'),f.details().id);
  assert.equal(collapse.getAttribute('tabindex'),null,'native button remains in the normal keyboard tab order');
  assert.equal(collapse.events.keydown,undefined,'native Enter/Space activation is not overridden or doubled');
  collapse.focus();collapse.click();assert.equal(f.details().hidden,true);assert.equal(f.toggle().textContent,'展开进度');
  assert.equal(f.toggle().getAttribute('data-recovery-collapse'),'false');assert.equal(f.toggle().getAttribute('aria-expanded'),'false');
  assert.equal(f.document.activeElement,f.toggle(),'keyboard focus follows the replacement toggle');
  assert.equal(f.panel().style.bottom,'80px');assert(720-parseFloat(f.panel().style.bottom)<648,'collapsed badge ends above the real turn button');
  assert.equal(f.c.TM.RecoveryReview.status()[0],row);assert.equal(f.cancelled.length,0);
  f.toggle().click();assert.equal(f.details().hidden,false);assert.equal(f.toggle().textContent,'收起进度');assert.equal(f.document.activeElement,f.toggle());
  assert.equal(f.c.TM.RecoveryReview.status()[0],row);assert.equal(JSON.stringify(row),before);assert.equal(f.cancelled.length,0);
});
test('same review updates keep progress collapsed and a new review resets the display',()=>{
  const f=progressFixture(),row=progressRow();f.emit(row);f.toggle().click();const oldToggle=f.toggle();
  const updated=Object.freeze({...row,phase:'verifying',detail:'核验实际修改',calls:3});f.emit(updated);
  assert.equal(f.panel().getAttribute('data-recovery-id'),row.id);assert.equal(f.details().hidden,true);assert.equal(f.toggle().getAttribute('aria-expanded'),'false');
  assert.equal(f.document.activeElement,f.toggle());assert(f.walk(f.details()).some(node=>node.textContent==='核验实际修改'));
  assert.equal(f.c.TM.RecoveryReview.status()[0],updated);assert.equal(f.cancelled.length,0);
  oldToggle.click();assert.equal(f.details().hidden,true,'detached previous update cannot change the current display');
  f.resize(900,760);assert.equal(f.panel().style.bottom,'148px');f.resize(720,900);assert.equal(f.panel().style.bottom,'16px');
  f.noEnd();f.resize(720,648);assert.equal(f.panel().style.bottom,'16px');
  f.emit(progressRow('review-next'));assert.equal(f.panel().getAttribute('data-recovery-id'),'review-next');assert.equal(f.details().hidden,false);
  assert.equal(f.toggle().getAttribute('data-recovery-collapse'),'true');assert.equal(f.toggle().getAttribute('aria-expanded'),'true');assert.equal(f.cancelled.length,0);
});
test('completed collapsed progress stays closable without cancelling either recovery owner',()=>{
  for(const phase of ['verified','stopped']){const f=progressFixture();f.emit(progressRow());f.toggle().click();f.emit(progressRow('review-active',phase));
    assert.equal(f.details().hidden,true);assert(f.button('关闭提示'));assert.equal(f.c.TM.RecoveryReview.status().length,0);
    f.button('关闭提示').click();assert.equal(f.panel(),null);assert.equal(f.cancelled.length,0);
    f.emit(progressRow('review-after-close'));assert.equal(f.details().hidden,false);
  }
});
test('only the original explicit cancel button invokes the selected recovery owner',()=>{
  for(const kind of ['turn-review','recovery']){const f=progressFixture(),row=progressRow('explicit-'+kind,'investigating',kind);f.emit(row);
    f.toggle().click();assert.equal(f.cancelled.length,0);f.toggle().click();assert.equal(f.cancelled.length,0);
    f.button(kind==='turn-review'?'取消回合复核':'取消应急恢复').click();assert.deepEqual(f.cancelled,[{kind,id:row.id}]);
  }
});
(async()=>{let pass=0,fail=0;for(const t of tests)try{await t.fn();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
