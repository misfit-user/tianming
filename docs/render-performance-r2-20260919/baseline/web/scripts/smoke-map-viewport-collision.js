'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const {functionSource}=require('./lib-perf-round1'),C=require('../tm-map-label-collide.js'),src=fs.readFileSync(path.join(__dirname,'../phase8-formal-map.js'),'utf8');
let passed=0;
for(const [w,h,W,H] of [[1280,800,1200,720],[1600,900,1920,1200],[600,1000,1920,1200],[900,400,100,100]])for(const scale of [.85,1,1.7,3.4]){
  const camera={clientWidth:w,clientHeight:h,classList:{contains:()=>true},style:{}},svg={parentElement:camera,dataset:{}},world={ownerSVGElement:svg,removeAttribute(){},setAttribute(){}},state={_mapVBW:W,_mapVBH:H,mapView:{scale,tx:-W*.23,ty:-H*.3}},stage={classList:{toggle(){}},getBoundingClientRect:()=>({left:12,top:30,width:w,height:h})};
  const ctx=vm.createContext({Math,Number,state,document:{getElementById:()=>world,querySelector:()=>null},mapStage:()=>stage,_syncScaleLevelFromZoom(){},scheduleLabelLayout(){}});
  vm.runInContext(['clampMapScale','clampMapView','applyMapTransform','mapViewportMetrics'].map(n=>functionSource(src,n)).join('\n'),ctx);ctx.applyMapTransform();
  const v=state.mapView,m=camera.style.transform.match(/translate\(([-\d.]+)px,([-\d.]+)px\) scale\(([-\d.]+)\)/).slice(1).map(Number),s=Math.min(w/W,h/H),ox=(w-W*s)/2,oy=(h-H*s)/2;
  for(const [x,y] of [[0,0],[W/2,H/2],[W,H]]){assert(Math.abs((ox+x*s)*m[2]+m[0]-(ox+(x*v.scale+v.tx)*s))<.001);assert(Math.abs((oy+y*s)*m[2]+m[1]-(oy+(y*v.scale+v.ty)*s))<.001);}
  const p=ctx.mapViewportMetrics(stage,{width:W,height:H});assert.equal(p.ratio,s);assert.equal(p.left,12+ox);assert.equal(p.top,30+oy);assert.equal(svg.dataset.tmfComposited,'1');passed++;
}
for(const [w,h,W,H] of [[1280,800,1200,720],[600,1000,1920,1200]])for(const scale of [8,32,128]){
 const attrs={},camera={clientWidth:w,clientHeight:h,classList:{contains:()=>true},style:{}},svg={parentElement:camera,dataset:{}},world={ownerSVGElement:svg,setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];}};
 const state={_mapVBW:W,_mapVBH:H,mapView:{scale,tx:-W*scale*.45,ty:-H*scale*.4}},stage={classList:{toggle(){}},getBoundingClientRect:()=>({left:12,top:30,width:w,height:h})};
 const ctx=vm.createContext({state,document:{getElementById:()=>world,querySelector:()=>null},mapStage:()=>stage,_syncScaleLevelFromZoom(){},scheduleLabelLayout(){}});
 vm.runInContext(['clampMapScale','clampMapView','applyMapTransform','mapViewportMetrics'].map(n=>functionSource(src,n)).join('\n'),ctx);ctx.applyMapTransform();
 const v=state.mapView,m=attrs.transform.match(/translate\(([-\d.]+) ([-\d.]+)\) scale\(([-\d.]+)\)/).slice(1).map(Number),ratio=Math.min(w/W,h/H);
 assert.equal(camera.style.transform,'none');assert.equal(svg.dataset.tmfComposited,'0');assert.equal(svg.dataset.zoomRendering,'vector');
 for(const [x,y] of [[0,0],[W/2,H/2],[W,H]]){assert(Math.abs((x*m[2]+m[0])*ratio-(x*v.scale+v.tx)*ratio)<.001);assert(Math.abs((y*m[2]+m[1])*ratio-(y*v.scale+v.ty)*ratio)<.001);}passed++;
}
assert(fs.readFileSync(path.join(__dirname,'../phase8-formal-bridge-styles.js'),'utf8').includes('.tmf-map-world{transform-box:view-box;transform-origin:0 0;}'),'SVG transforms must use the viewBox, not geography-dependent fill bounds');passed++;
function node(values){const a={role:'button',...values},classes=new Set();return{writes:0,getAttribute:k=>a[k]??null,setAttribute(k,v){a[k]=v;this.writes++;},classList:{contains:c=>classes.has(c),toggle(c,on){if(on)classes.add(c);else classes.delete(c);}}};}
const one=node({'data-fs':'12','data-lw':'30','data-lh':'12','data-ax':'20','data-ay':'20'}),two=node({'data-fs':'12','data-lw':'30','data-lh':'12','data-ax':'24','data-ay':'20'}),small=node({'data-fs':'4','data-lw':'4','data-lh':'4','data-ax':'100','data-ay':'20'}),regional=node({'data-fs':'14','data-lw':'24','data-lh':'14','data-ax':'30','data-ay':'30'});
const nodes=[one,two,small,regional],svg={getAttribute:k=>k==='data-tmf-composited'?'1':null,getScreenCTM:()=>({a:1,b:0,c:0,d:1}),querySelectorAll:s=>s.includes(',')?nodes:s==='.tmf-faction-label'?nodes.slice(0,3):[regional]},stage={querySelector:()=>svg};
C.resolve(stage,3,'realm');assert.equal(one.getAttribute('tabindex'),'0');assert.equal(two.getAttribute('tabindex'),'-1');assert.equal(small.getAttribute('aria-hidden'),'true','already-composited scale must not double-count zoom');assert.equal(regional.getAttribute('tabindex'),'-1');
const before=nodes.map(n=>n.writes);C.resolve(stage,3,'realm');assert.deepEqual(nodes.map(n=>n.writes),before,'stable resolution does not churn DOM attributes');
C.resolve(stage,3,'region');assert.equal(one.getAttribute('tabindex'),'-1');assert.equal(regional.getAttribute('tabindex'),'0');passed+=3;
const ink={getBBox:()=>({x:-8,y:-4,width:19,height:9}),writes:0,setAttribute(k,v){this[k]=v;this.writes++;}},label={dataset:{inkWidth:'12',inkHeight:'7'},querySelector:()=>ink},fontCtx=vm.createContext({_mapFontEpoch:0,String,Number,Math});
vm.runInContext(functionSource(src,'measureRealmText'),fontCtx);const fontStage={querySelectorAll:()=>[label]};fontCtx.measureRealmText(fontStage);assert(ink.transform.includes('scale(0.631578'));assert.equal(ink.writes,1);fontCtx.measureRealmText(fontStage);assert.equal(ink.writes,1);fontCtx._mapFontEpoch++;fontCtx.measureRealmText(fontStage);assert.equal(ink.writes,2);passed++;
const tilted={cx:50,cy:50,hw:40,hh:40,obb:{hw:48,hh:4,angle:45}},near={cx:70,cy:30,hw:40,hh:40,obb:{hw:48,hh:4,angle:45}};
assert.equal(C.orientedOverlap(tilted,near),false);assert.equal(C.orientedOverlap(tilted,{...near,cx:55,cy:55}),true);assert.deepEqual(C.placeGreedy([tilted,near]),[false,false]);passed++;
assert.equal(Number(label.dataset.lw),12);assert.equal(Number(label.dataset.obb.split(',')[0]),12,'collision uses measured glyph width, not the larger territory-fit rectangle');passed++;
one.setAttribute('data-ink-scale','.4');C.resolve(stage,1,'realm',{minPx:5});assert.equal(one.getAttribute('aria-hidden'),'true');one.setAttribute('data-ink-scale','1');C.resolve(stage,1,'realm',{minPx:5});assert.equal(one.getAttribute('aria-hidden'),'false');passed++;
console.log('PASS '+passed+' real camera projection, font fallback and collision DOM contracts');
