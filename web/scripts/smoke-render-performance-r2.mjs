import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
import assert from 'node:assert/strict'; import { fileURLToPath } from 'node:url';
import lib from './lib-perf-round1.js';
const root=process.env.TM_RENDER_TEST_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=f=>fs.readFileSync(path.join(root,'web',f),'utf8');
const mapSource=source('phase8-formal-map.js'), rwSource=source('tm-renwu-ui.js');
const html=source('battle/index.html'), start=html.indexOf('const R3D=(function(){');
const battleSource=html.slice(start,html.indexOf('/* ---------- 交互 ---------- */',start));
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
function loadFunctions(c,s,names){vm.createContext(c);vm.runInContext(names.filter(n=>s.includes('function '+n+'(')).map(n=>lib.functionSource(s,n)).join('\n'),c);return c;}
class Node {
 constructor(id=''){this.id=id;this.attrs={};this.dataset={};this.style={display:''};this.writes=0;this._html='';this._text='';this.isConnected=true;const classes=new Set();this.classList={contains:k=>classes.has(k),toggle:(k,on)=>{if(classes.has(k)===on)return;on?classes.add(k):classes.delete(k);this.writes++;}};}
 get innerHTML(){return this._html;} set innerHTML(s){this._html=String(s).replace(/&#39;/g,"'");this.writes++;}
 get textContent(){return this._text;} set textContent(s){this._text=String(s);this.writes++;}
 getAttribute(k){return this.attrs[k]??null;} setAttribute(k,v){this.attrs[k]=String(v);this.writes++;}
}
function mapHarness(){
 const ids=Object.fromEntries(['mapwrap','map-tools-mode','tmf-map-hint','tmf-map-legend','map-region-list','map-search-results'].map(id=>[id,new Node(id)]));
 const alert=new Node('alerts'),mode=new Node(),tier=new Node(),lock=new Node();mode.dataset.mapMode='owner';tier.dataset.mapScale='region';lock.hasAttribute=()=>true;
 const map={id:'fixture',regions:[{id:'one',name:'甲州',owner:'甲国'}],hierarchyPresentation:{layerControl:true}};
 const c={Map,WeakMap,console,_mapHTMLCache:new WeakMap(),state:{mapMode:'owner',mapScale:'region'},issues:[],getIssues(){return c.issues;},getMapData:()=>map,
  document:{getElementById:id=>ids[id]||null,querySelector:()=>alert,querySelectorAll:sel=>sel==='.map-layer'?[mode]:sel==='[data-map-scale]'?[tier]:[lock]},
  esc:String,attr:v=>String(v).replace(/'/g,'&#39;'),shortText:String,canonicalOwnerKey:r=>r.owner,ownerName:r=>r.owner,regionColor:()=> '#abc',GRADE_BANDS:{}};
 loadFunctions(c,mapSource,['mapText','mapAttribute','mapHTML','mapHintText','mapChromeQuery','updateMapChrome','renderMapAlerts','renderLegend','mapScaleNote','mapModeNote','mapModeTitle','syncMapSearch','renderMapSearchResults']);
 return {c,ids,map,alert,nodes:[...Object.values(ids),alert,mode,tier,lock]};
}
check('map: unchanged chrome and alerts cause no further DOM writes',()=>{
 const h=mapHarness();h.c.updateMapChrome();h.c.renderMapAlerts(h.map);const before=h.nodes.map(n=>n.writes);
 for(let i=0;i<60;i++){h.c.updateMapChrome();h.c.renderMapAlerts(h.map);}assert.deepEqual(h.nodes.map(n=>n.writes),before);
});
check('map: normalized HTML is retained, external edits are repaired',()=>{
 const h=mapHarness();h.c.issues=[{title:"O'Reilly",status:'pending'}];h.c.renderMapAlerts(h.map);const good=h.alert.innerHTML,first=h.alert.writes;
 h.c.renderMapAlerts(h.map);assert.equal(h.alert.writes,first);h.alert.innerHTML='external replacement';h.c.renderMapAlerts(h.map);assert.equal(h.alert.innerHTML,good);
});
check('map: same-turn changes to alerts, region counts and mode remain visible',()=>{
 const h=mapHarness();h.c.renderMapAlerts(h.map);h.c.issues=[{title:'新警报',status:'pending'}];h.map.regions.push({id:'two',name:'乙州',owner:'乙国'});
 h.c.state.mapMode='tax';h.c.updateMapChrome();h.c.renderMapAlerts(h.map);assert.match(h.alert.innerHTML,/新警报/);assert.match(h.ids['tmf-map-hint'].textContent,/2 地块/);assert.match(h.ids['tmf-map-hint'].textContent,/财赋/);
});
check('map: renamed regions and transferred owners update retained controls',()=>{
 const h=mapHarness();h.c.renderLegend(h.map);h.c.syncMapSearch(h.map);h.map.regions[0].name='新地名';h.map.regions[0].owner='新势力';
 h.c.renderLegend(h.map);h.c.syncMapSearch(h.map);assert.match(h.ids['tmf-map-legend'].innerHTML,/新势力/);assert.match(h.ids['map-region-list'].innerHTML,/新地名/);
});
function rosterHarness(){
 const grid=new Node('rw-grid'),panel=new Node('gt-renwu');panel.style.display='block';let visible=true;panel.getClientRects=()=>visible?[{}]:[];
 const tasks=[],c={console,document:{hidden:false},window:{getComputedStyle:()=>({display:panel.style.display})},_rwRenderBatchToken:1,_rwRenderInitialLimit:80,_rwRenderBatchSize:60,_rwNeedsRender:false,
  _$:id=>id==='rw-grid'?grid:id==='gt-renwu'?panel:null,_rwYield:fn=>tasks.push(fn),_rwRenderEntry:e=>'<i>'+e.char.id+'</i>'};
 loadFunctions(c,rwSource,['_rwIsPanelVisible','_rwAppendCardsChunked','renderRenwu']);
 const entries=Array.from({length:1000},(_,id)=>({type:'card',char:{id}}));grid.insertAdjacentHTML=(_,text)=>{grid._html+=text;grid.writes++;};
 return {c,grid,panel,tasks,entries,hide(){visible=false;panel.style.display='none';},show(){visible=true;panel.style.display='block';},start(force=false){c._rwAppendCardsChunked(grid,entries,{},c._rwRenderBatchToken,'',force);},drain(){let n=0;while(tasks.length){assert(++n<100);tasks.shift()();}}};
}
check('roster: closing after first 80 cards stops all remaining work',()=>{
 const h=rosterHarness();h.start();h.hide();h.drain();assert.equal((h.grid.innerHTML.match(/<i>/g)||[]).length,80);assert.equal(h.c._rwNeedsRender,true);
});
check('roster: reopening renders all cards once, without omissions or duplicates',()=>{
 const h=rosterHarness();h.start();h.hide();h.drain();h.show();h.c._rwRenderBatchToken++;h.start();h.drain();assert.equal((h.grid.innerHTML.match(/<i>/g)||[]).length,1000);assert.match(h.grid.innerHTML,/<i>999<\/i>/);
});
check('roster: detached containers cannot consume background render batches',()=>{
 const h=rosterHarness();h.start(true);h.grid.isConnected=false;h.drain();assert.equal((h.grid.innerHTML.match(/<i>/g)||[]).length,80);
});
check('roster: forced render remains available while panel is hidden',()=>{
 const h=rosterHarness();h.hide();h.start(true);h.drain();assert.equal((h.grid.innerHTML.match(/<i>/g)||[]).length,1000);
});
check('roster: a deferred hidden refresh invalidates stale queued work',()=>{
 const h=rosterHarness();h.start();h.hide();h.c.renderRenwu();h.show();h.drain();assert.equal((h.grid.innerHTML.match(/<i>/g)||[]).length,80);
});
check('roster: hidden document and collapsed ancestors are recognized',()=>{
 const h=rosterHarness();h.c.document.hidden=true;assert.equal(h.c._rwIsPanelVisible(),false);h.c.document.hidden=false;h.hide();h.panel.style.display='block';assert.equal(h.c._rwIsPanelVisible(),false);
});
function graphicsHarness(){
 const counts={uniform:0,attribute:0},trace=[],program={},mesh={pos:{},nrm:{},uv:{},ib:{}};
 const makeGL=()=>new Proxy({getUniformLocation(p,n){counts.uniform++;return n==='missing'?null:{program:p,name:n};},getAttribLocation(p,n){counts.attribute++;return ({aPos:0,aNrm:1,aUV:2})[n]??-1;},ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,FLOAT:3,DEPTH_TEST:4,LEQUAL:5,BLEND:6},{get(o,k){return k in o?o[k]:(...args)=>trace.push([k,...args]);}});
 const c={Map,WeakMap,console,gl:makeGL(),shaderLocationContexts:new WeakMap(),mesh,unitsReady:true,unitRenderer:null,extInst:{},uProg:program,_mvp:[1,0,0,1],_drawGroup:(...a)=>trace.push(['group',...a]),uMeshes:{foot:{}}};
 loadFunctions(c,battleSource,['programLocations','cachedLocation','uniformLocation','attributeLocation','bindMesh','_drawUnits']);
 if(!c.uniformLocation)c.uniformLocation=(p,n)=>c.gl.getUniformLocation(p,n);if(!c.attributeLocation)c.attributeLocation=(p,n)=>c.gl.getAttribLocation(p,n);
 return {c,counts,trace,program,makeGL};
}
check('battle: 60 mesh binds query three attributes only once',()=>{
 const h=graphicsHarness();for(let i=0;i<60;i++)h.c.bindMesh(h.program,true);assert.equal(h.counts.attribute,3);assert.equal(h.trace.filter(t=>t[0]==='vertexAttribPointer').length,180);
});
check('battle: 60 unit draws cache locations without skipping uniform uploads',()=>{
 const h=graphicsHarness();for(let i=0;i<60;i++)h.c._drawUnits({foot:[{}]});assert.equal(h.counts.uniform,2);assert.equal(h.trace.filter(t=>t[0]==='uniformMatrix4fv').length,60);assert.equal(h.trace.filter(t=>t[0]==='uniform3fv').length,60);assert.equal(h.trace.filter(t=>t[0]==='group').length,60);
});
check('battle: optimized-out null and minus-one locations are cached',()=>{
 const h=graphicsHarness();for(let i=0;i<10;i++){assert.equal(h.c.uniformLocation(h.program,'missing'),null);assert.equal(h.c.attributeLocation(h.program,'missing'),-1);}assert.equal(h.counts.uniform,1);assert.equal(h.counts.attribute,1);
});
check('battle: different programs and different contexts never share locations',()=>{
 const h=graphicsHarness(),a=h.c.uniformLocation(h.program,'uMVP'),other={};assert.equal(h.c.uniformLocation(h.program,'uMVP'),a);assert.notEqual(h.c.uniformLocation(other,'uMVP'),a);
 h.c.gl=h.makeGL();assert.notEqual(h.c.uniformLocation(h.program,'uMVP'),a);assert.equal(h.counts.uniform,3);
});
check('geometry: unchanged strings return the original shape and metadata',()=>{
 const c={module:{exports:{}},console,setTimeout,clearTimeout};vm.runInNewContext(source('tm-map-realm-layout.js'),c);const api=c.module.exports;
 const r={d:'M0 0L10 0L10 10Z'},first=api.region(r);for(let i=0;i<60;i++)assert.equal(api.region(r),first);
 assert.equal(api.stats.geometry,1);assert.equal(JSON.stringify(first).includes('pathSources'),false);
 r.d='M0 0L20 0L20 10Z';assert.notEqual(api.region(r),first);assert.equal(api.region(r).bounds.maxX,20);
 const prior=api.region(r);api.clear();assert.notEqual(api.region(r),prior);
});
check('geometry: arrays, mutable path objects and source switches still invalidate',()=>{
 const c={module:{exports:{}},console,setTimeout,clearTimeout};vm.runInNewContext(source('tm-map-realm-layout.js'),c);const api=c.module.exports;
 const r={points:[[0,0],[10,0],[10,10]]},a=api.region(r);r.points[1][0]=15;assert.notEqual(api.region(r),a);
 let text='M0 0L30 0L30 10Z';r.d={toString:()=>text};const b=api.region(r);text='M0 0L40 0L40 10Z';assert.notEqual(api.region(r),b);assert.equal(api.region(r).bounds.maxX,40);
 r.d='M0 0L50 0L50 10Z';const d=api.region(r);delete r.d;assert.notEqual(api.region(r),d);assert.equal(api.region(r).bounds.maxX,15);
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
