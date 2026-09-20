import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),live=process.argv.includes('--installed');
const dir=live?path.join(root,'web'):path.join(work,'after'),src=fs.readFileSync(path.join(dir,'phase8-formal-map.js'),'utf8');
const {functionSource}=(await import(pathToFileURL(path.join(root,'web/scripts/lib-perf-round1.js')))).default;
const checks=[];function test(name,fn){try{const detail=fn();checks.push({name,passed:true,detail});console.log('PASS '+name);}catch(e){checks.push({name,passed:false,error:String(e.stack)});console.log('FAIL '+name+' '+e.message);}}
function mock(){
 const events={},s={mapView:{scale:1,tx:0,ty:0},_mapVBW:1200,_mapVBH:720},cls={add(){},remove(){},toggle(){},contains(){return false;}};
 const stage={isConnected:true,clientWidth:1200,clientHeight:720,classList:cls,getBoundingClientRect(){return {left:30,top:20,width:1200,height:720};},addEventListener(n,f){events[n]=f;},removeEventListener(){},setPointerCapture(){}};
 const document={fonts:null,getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return [];}};
 const c={console,state:s,document,_preparedMapLayers:null,setTimeout(){return 1;},clearTimeout(){},requestAnimationFrame(){return 1;},addEventListener(){},removeEventListener(){},mapStage:()=>stage,getMapData:()=>({width:1200,height:720}),scheduleMapTransform(){c.scheduled++;},scheduled:0,applyMapTransform(){},cssEscape:x=>x,openRegionDossier(){},bridge:{}};c.window=c;vm.createContext(c);
 vm.runInContext(fs.readFileSync(path.join(root,'web/tm-pinch-pan.js'),'utf8'),c);
 for(const f of ['clampMapScale','clampMapView','zoomMapAt','zoomMap','mapViewportMetrics','installMapInteraction','focusRegion'])vm.runInContext(functionSource(src,f),c);
 c.installMapInteraction();return {c,events,s,stage,document};
}
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,a+' != '+b);
test('unified-min-max-and-invalid-values',()=>{const {c}=mock();assert.equal(c.clampMapScale(100000),128);assert.equal(c.clampMapScale(.01),.72);for(const v of [NaN,Infinity,-1,0,'bad'])assert.equal(c.clampMapScale(v),1);});
test('button-reaches-128-and-keeps-center-fixed',()=>{const {c,s}=mock();for(let i=0;i<40;i++)c.zoomMap(1.22);assert.equal(s.mapView.scale,128);near((600-s.mapView.tx)/128,600);near((360-s.mapView.ty)/128,360);});
test('button-back-to-whole-map-range',()=>{const {c,s}=mock();for(let i=0;i<60;i++)c.zoomMap(.82);assert.equal(s.mapView.scale,.72);});
test('wheel-goes-beyond-both-old-limits',()=>{const {c,s,events}=mock();for(let i=0;i<45;i++)events.wheel({deltaY:-100,deltaMode:0,clientX:600,clientY:320,preventDefault(){}});assert.equal(s.mapView.scale,128);near((570-s.mapView.tx)/128,570);near((300-s.mapView.ty)/128,300);});
test('wheel-after-large-button-zoom-does-not-snap-to-3-4',()=>{const {c,s,events}=mock();for(let i=0;i<20;i++)c.zoomMap(1.22);const old=s.mapView.scale;events.wheel({deltaY:1,deltaMode:0,clientX:600,clientY:320,preventDefault(){}});assert.ok(s.mapView.scale>40&&s.mapView.scale<old);});
test('wheel-preserves-sub-notch-distance',()=>{const {s,events}=mock();events.wheel({deltaY:-1,deltaMode:0,clientX:600,clientY:320,preventDefault(){}});near(s.mapView.scale,Math.exp(.002));});
test('restored-camera-is-clamped-and-finite',()=>{const {c}=mock();const r=c.clampMapView({scale:99999,tx:1e9,ty:-1e9});assert.equal(r.scale,128);assert.equal(r.tx,0);assert.equal(r.ty,720*(1-128));});
function touch(xs){return {touches:xs.map(x=>({clientX:x,clientY:300})),target:{},cancelable:true,preventDefault(){}};}
test('actual-pinch-bridge-reaches-128',()=>{const {s,events}=mock();for(let i=0;i<8;i++){events.touchstart(touch([530,630]));events.touchmove(touch([480,680]));events.touchend(touch([]));}assert.equal(s.mapView.scale,128);near((550-s.mapView.tx)/128,550);near((280-s.mapView.ty)/128,280);});
test('pinch-in-and-out-retains-the-finger-anchor',()=>{const {s,events}=mock();events.touchstart(touch([530,630]));events.touchmove(touch([480,680]));events.touchmove(touch([530,630]));near(s.mapView.scale,1);near(s.mapView.tx,0);near(s.mapView.ty,0);});
test('small-island-search-focus-is-readable-without-changing-geometry',()=>{const {c,s}=mock();const r={id:'island',center:[700,350],points:[[699.7,349.7],[700.3,350.3]]};const frozen=JSON.stringify(r);c.findRegion=()=>r;c.actualCenter=()=>({x:700,y:350});c.TMMapRealmLayout={region:()=>({bounds:{minX:699.7,maxX:700.3,minY:349.7,maxY:350.3}})};c.focusRegion('island',false);assert.equal(s.mapView.scale,128);assert.equal(JSON.stringify(r),frozen);});
test('focus-never-zooms-back-out-from-user-detail',()=>{const {c,s}=mock();s.mapView.scale=32;c.findRegion=()=>({});c.actualCenter=()=>({x:700,y:350});c.TMMapRealmLayout={region:()=>({bounds:{minX:600,maxX:800,minY:300,maxY:400}})};c.focusRegion('large',false);assert.equal(s.mapView.scale,32);});
test('deep-vector-and-compositor-transition-do-not-double-transform',()=>{
 const {c,s,stage,document}=mock();const attrs={},camera={classList:{contains:()=>true},style:{},clientWidth:1200,clientHeight:720},svg={parentElement:camera,dataset:{}},world={ownerSVGElement:svg,setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];}},label={setAttribute(){}};
 document.getElementById=id=>id==='tmf-map-world'?world:id==='tmf-label-world'?label:null;c._syncScaleLevelFromZoom=()=>{};c.scheduleLabelLayout=()=>{};
 vm.runInContext(functionSource(src,'applyMapTransform'),c);s.mapView={scale:64,tx:-20000,ty:-10000};c.applyMapTransform();assert.equal(svg.dataset.zoomRendering,'vector');assert.equal(camera.style.transform,'none');assert.ok(attrs.transform.includes('64.000000'));
 s.mapView={scale:2,tx:-200,ty:-100};c.applyMapTransform();assert.equal(svg.dataset.zoomRendering,'compositor');assert.equal(attrs.transform,undefined);assert.ok(camera.style.transform.includes('scale(2.0000)'));
});
test('high-zoom-label-grid-memory-is-bounded-and-overlap-stays-exact',()=>{
 const c={console,module:{exports:{}}};c.window=c;vm.createContext(c);vm.runInContext(fs.readFileSync(path.join(dir,'tm-map-label-collide.js'),'utf8'),c);
 const rows=[{cx:0,cy:0,hw:1e7,hh:1e7},{cx:0,cy:0,hw:1,hh:1},{cx:3e7,cy:0,hw:1e7,hh:1e7}];
 assert.deepEqual(Array.from(c.TMMapLabelCollide.placeGreedy(rows)),[false,true,false]);
});
const result={time:new Date().toISOString(),installed:live,passed:checks.filter(r=>r.passed).length,failed:checks.filter(r=>!r.passed).length,checks};
fs.writeFileSync(path.join(work,live?'unit-installed.json':'unit-staged.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,failed:result.failed}));if(result.failed)process.exitCode=1;
