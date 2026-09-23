'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tm-shanhe-runtime.js'),'utf8');
let passed=0;
const flush=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
function harness(options={}){
  let time=0,nextTimer=0,creates=0,refreshes=0;
  const timers=new Map(),listeners=new Map(),scripts=[],renderers=[];
  function node(){const attrs=new Map(),events=new Map();return {style:{setProperty(){}},dataset:{},isConnected:false,classList:{add(){},remove(){},toggle(){}},setAttribute(k,v){attrs.set(k,v)},getAttribute(k){return attrs.get(k)??null},removeAttribute(k){attrs.delete(k)},hasAttribute(k){return attrs.has(k)},remove(){this.isConnected=false;this.parentNode=null},addEventListener(k,f){events.set(k,f)},emit(k){events.get(k)?.({preventDefault(){}})},append(){},getContext(){return {}},querySelector(){return null},querySelectorAll(){return []}};}
  const parent=node();parent.insertBefore=c=>{c.parentNode=parent;c.isConnected=true;};
  const svg=node();svg.closest=()=>parent;
  const stage=node();stage.clientWidth=1200;stage.clientHeight=720;stage.querySelector=s=>s==='#tmf-formal-map'?svg:null;
  const button=node();
  const map={id:'test',width:400,height:400,regions:[{id:'one',center:[200,200]}],projection:{type:'equirectangular',bbox:[80,0,120,40],scale:10,offset:[0,0]}};
  const state={mapScale:'realm',mapMode:'owner'},view={scale:1,tx:0,ty:0};
  const root={URL,URLSearchParams,location:{search:'',href:'file:///game/index.html'},performance:{now:()=>time},devicePixelRatio:1,
    console:{error(){},warn(){}},DOMMatrix:class {},Path2D:class {},MutationObserver:class{observe(){}disconnect(){}},
    setTimeout(fn,ms){const id=++nextTimer;timers.set(id,{fn,at:time+ms});return id;},clearTimeout(id){timers.delete(id)},
    requestAnimationFrame:()=>0,cancelAnimationFrame(){},addEventListener(k,f){listeners.set(k,f)},
    document:{currentScript:{src:'file:///game/tm-shanhe-runtime.js'},querySelector(){return null},getElementById:id=>id==='tm-shanhe-toggle'?button:null,
      createElement:()=>node(),head:{appendChild(s){if(!s.src)return;scripts.push(s);if(!options.holdScripts)queueMicrotask(()=>{if(s.src.includes('engine.js'))root.TMShanhe25D=api;else root.TM_SHANHE_ENV={schema:'tm-shanhe-25d/1'};s.onload();});}}},
    TMPhase8FormalBridge:{map:{renderFormalMapSoon(){refreshes++;if(!options.noRefresh)root.TMShanheRuntime.apply(stage,map,view,state);}}}};
  const api={Renderer:{async create(canvas){creates++;if(options.create)return options.create(canvas,creates,makeRenderer);return makeRenderer(canvas);}}};
  function makeRenderer(canvas){const r={canvas,gl:{},lost:false,disposed:false,bounds:null,work:{overlayUploads:0},options:{},_uploadOverlay(){},setScenario(){},configure({size}){Object.assign(this,size)},render(){return {submitMs:0,triangles:0,drawCalls:0,gridRevision:0,work:{}}},dispose(){this.disposed=true;}};renderers.push(r);return r;}
  if(options.loaded!==false){root.TMShanhe25D=api;root.TM_SHANHE_ENV={schema:'tm-shanhe-25d/1'};}
  root.window=root;vm.runInNewContext(source,root,{filename:'tm-shanhe-runtime.js'});
  return {root,map,stage,button,timers,scripts,renderers,makeRenderer,emit:k=>listeners.get(k)?.({}),apply:()=>root.TMShanheRuntime.apply(stage,map,view,state),diag:()=>root.TMShanheRuntime.diagnostics(),creates:()=>creates,refreshes:()=>refreshes,
    async advance(ms){time+=ms;const due=[...timers].filter(([,t])=>t.at<=time);for(const[id,t]of due){timers.delete(id);t.fn();await flush();}}};
}
async function test(name,fn){await fn();passed++;console.log('PASS '+name);}
(async()=>{
  await test('transient renderer initialization failure recovers automatically',async()=>{
    const h=harness({create:async(c,n,make)=>{if(n===1)throw Error('temporary resource failure');return make(c);}});
    h.apply();await flush();assert.equal(h.diag().active,false);assert.match(h.button.textContent,/恢复/);
    await h.advance(1000);assert.equal(h.diag().active,true);assert.equal(h.creates(),2);
  });
  await test('slow resources remain a single in-flight load',async()=>{
    let release;const h=harness({create:c=>new Promise(r=>{release=()=>r(h.makeRenderer(c));})});
    h.apply();await flush();await h.advance(60000);for(let i=0;i<30;i++)h.apply();
    assert.equal(h.creates(),1);assert.match(h.button.textContent,/载入/);release();await flush();assert.equal(h.diag().active,true);
  });
  await test('failed asset script is retried once resources become available',async()=>{
    const h=harness({loaded:false,holdScripts:true});h.apply();await flush();h.scripts[0].onerror();await flush();
    assert.equal(h.diag().active,false);await h.advance(1000);assert.equal(h.scripts.length,2);
    h.root.TMShanhe25D={Renderer:{create:async c=>h.makeRenderer(c)}};h.scripts[1].onload();await flush();
    h.root.TM_SHANHE_ENV={schema:'tm-shanhe-25d/1'};h.scripts[2].onload();await flush();assert.equal(h.diag().active,true);
  });
  await test('permanent failure has bounded backoff and explicit manual retry',async()=>{
    let failed=true;const h=harness({create:async(c,n,make)=>{if(failed)throw Error('no WebGL');return make(c);}});
    h.apply();await flush();for(const ms of [1000,3000,8000,30000])await h.advance(ms);
    assert.equal(h.creates(),4);assert.equal(h.timers.size,0);assert.match(h.button.textContent,/重试/);
    failed=false;h.root.TMShanheRuntime.setEnabled(true);await flush();assert.equal(h.diag().active,true);
  });
  await test('manual disable cancels automatic recovery',async()=>{
    const h=harness({create:async()=>{throw Error('temporary');}});h.apply();await flush();h.root.TMShanheRuntime.setEnabled(false);
    await h.advance(60000);assert.equal(h.creates(),1);assert.equal(h.diag().active,false);assert.equal(h.button.textContent,'底图：原版');
  });
  await test('stale bootstrap rejection after pagehide cannot poison next activation',async()=>{
    let reject;const h=harness({create:(c,n,make)=>n===1?new Promise((_,r)=>{reject=r;}):Promise.resolve(make(c))});
    h.apply();await flush();h.emit('pagehide');reject(Error('stale'));await flush();
    assert.equal(h.diag().errors.length,0);h.apply();await flush();assert.equal(h.diag().active,true);
  });
  await test('page restoration retries a previous failed load',async()=>{
    const h=harness({create:async(c,n,make)=>{if(n===1)throw Error('temporary');return make(c);}});
    h.apply();await flush();h.emit('pagehide');h.apply();await flush();assert.equal(h.diag().active,true);
  });
  await test('stale bootstrap success disposes its own renderer',async()=>{
    let release,old;const h=harness({create:(c,n,make)=>n===1?new Promise(r=>{release=()=>{old=make(c);r(old);};}):Promise.resolve(make(c))});
    h.apply();await flush();h.emit('pagehide');h.apply();await flush();release();await flush();
    assert.equal(old.disposed,true);assert.equal(h.diag().active,true);
  });
  await test('context recovery is cancelled while map is hidden and resumes on return',async()=>{
    const h=harness();h.apply();await flush();const r=h.renderers[0];r.lost=true;r.canvas.emit('webglcontextlost');
    assert.match(h.button.textContent,/恢复/);h.root.TMShanheRuntime.hide();await h.advance(60000);assert.equal(h.creates(),1);
    h.apply();await h.advance(3000);assert.equal(h.diag().active,true);assert.equal(r.disposed,true);
  });
  await test('unsupported map reports original terrain and next supported map can load',async()=>{
    const h=harness();delete h.map.projection;h.apply();await flush();assert.equal(h.creates(),0);assert.match(h.button.textContent,/原版/);
    h.map.projection={type:'equirectangular',bbox:[80,0,120,40],scale:10,offset:[0,0]};h.apply();await flush();assert.equal(h.diag().active,true);
  });
  console.log('PASS '+passed+' shanhe loading lifecycle cases');
})().catch(e=>{console.error(e);process.exitCode=1;});
