'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {functionSource}=require('./lib-perf-round1');
const root=path.resolve(__dirname,'../..'),source=fs.readFileSync(path.join(root,'web/phase8-formal-map.js'),'utf8');
const functions=['ensureMainShell','mapText','mapAttribute','updateMapChrome','scaleToBand','bandToScale','_syncScaleLevelFromZoom','resetMapView'];
const code=functions.map(n=>functionSource(source,n)).join('\n');
let passed=0;
function node(attrs={}){const classes=new Set();return {attrs,dataset:{},style:{display:'none'},disabled:false,textContent:'',setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},hasAttribute(k){return k in this.attrs;},classList:{toggle(k,on){on?classes.add(k):classes.delete(k);},contains:k=>classes.has(k)}};}
function fixture(map){
 const lock=node({'data-map-tier-lock':'1'}),fit=node({'data-map-fit-all':'1'}),handlers={},ids={gc:{addEventListener:(k,f)=>handlers[k]=f},'tm-phase8-main-shell':node(),'tm-phase8-home-return':node()};
 const c={state:{mapMode:'owner',mapScale:'prefecture',mapView:{scale:3,tx:-11,ty:25}},currentMap:map,document:{getElementById:id=>ids[id]||null},syncFormalShellVisibility:()=>true,installMapInteraction(){},mapModeTitle:()=>'',mapHintText:()=>'',renderFormalMapSoon(){},activatePreparedMapLayer:()=>true,renderFormalMap(){},refreshMapPpop(){}};
 c.getMapData=()=>c.currentMap;c.mapChromeQuery=s=>s==='[data-map-tier-lock],[data-map-fit-all]'?[lock,fit]:[];
 vm.createContext(c);vm.runInContext(code,c);c.applyMapTransform=()=>c._syncScaleLevelFromZoom();c.ensureMainShell();
 const click=button=>handlers.click({target:{closest:s=>button==='lock'&&s==='[data-map-tier-lock]'?lock:button==='fit'&&s==='[data-map-fit-all]'?fit:button==='realm'&&s==='.map-scale[data-map-scale]'?{dataset:{mapScale:'realm'}}:null},preventDefault(){},stopPropagation(){}});
 return {c,lock,fit,click};
}
const manifest=JSON.parse(fs.readFileSync(path.join(root,'web/bundled-scenarios/manifest.json'),'utf8'));
const maps=manifest.entries.map(e=>({name:e.id,map:JSON.parse(fs.readFileSync(path.join(root,e.source),'utf8')).map}));
maps.push({name:'custom-without-presentation',map:{id:'custom',regions:[{}]}},{name:'legacy-opt-out',map:{id:'legacy',regions:[{}],hierarchyPresentation:{layerControl:false}}});
for(const {name,map}of maps){
 const h=fixture(map),c=h.c;
 c.updateMapChrome();assert.equal(h.lock.style.display,'',name+' lock control must be visible');assert.equal(h.fit.style.display,'',name+' full map control must be visible');passed+=2;
 h.click('lock');assert.equal(c.state._zoomLevelLinkOff,true,name+' lock click must work');assert.equal(h.lock.textContent,'层级已锁');assert.equal(h.lock.getAttribute('aria-pressed'),'true');passed+=3;
 c.state.mapView.scale=.8;c._syncScaleLevelFromZoom();assert.equal(c.state.mapScale,'prefecture',name+' lock retains layer across zoom threshold');passed++;
 h.click('realm');assert.equal(c.state.mapScale,'realm');assert.equal(c.state.mapView.scale,.8,'manual layer selection must remain available while locked');passed+=2;
 h.click('lock');c.state.mapView.scale=3;c._syncScaleLevelFromZoom();assert.equal(c.state.mapScale,'prefecture',name+' unlocking restores zoom linkage');assert.equal(h.lock.getAttribute('aria-pressed'),'false');passed+=2;
 h.click('fit');assert.equal(c.state.mapScale,'prefecture',name+' full map preserves the selected layer');assert.equal(c.state._zoomLevelLinkOff,true);assert.equal(c.state.mapView.scale,1);assert.equal(c.state.mapView.tx,0);assert.equal(c.state.mapView.ty,0);passed+=5;
 c.currentMap={id:name+'-next',regions:[{}]};c.updateMapChrome();assert.equal(c.state._zoomLevelLinkOff,false,'new map does not inherit old layer lock');passed++;
}
const loading=fixture(null);loading.c.updateMapChrome();assert.equal(loading.lock.style.display,'');assert.equal(loading.fit.style.display,'');assert.equal(loading.lock.disabled,true);assert.equal(loading.fit.disabled,true);loading.click('fit');assert.equal(loading.c.state.mapView.scale,3);passed+=5;
console.log('PASS '+passed+' universal map control assertions');
