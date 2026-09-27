// Retain all existing assertions; load the new shared clamp and exercise the SVG path too.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]),f=path.join(root,'web/scripts/smoke-map-viewport-collision.js');
const b=fs.readFileSync(f),hash=x=>crypto.createHash('sha256').update(x).digest('hex');let t=b.toString('utf8');
function one(a,v){if(t.includes('\r\n')){a=a.replace(/\r?\n/g,'\r\n');v=v.replace(/\r?\n/g,'\r\n');}assert.equal(t.split(a).length,2,a);t=t.replace(a,v);}
one('world={ownerSVGElement:svg}','world={ownerSVGElement:svg,removeAttribute(){},setAttribute(){}}');
one('document:{getElementById:()=>world}','document:{getElementById:()=>world,querySelector:()=>null}');
one("['clampMapView','applyMapTransform','mapViewportMetrics']","['clampMapScale','clampMapView','applyMapTransform','mapViewportMetrics']");
const extra=`for(const [w,h,W,H] of [[1280,800,1200,720],[600,1000,1920,1200]])for(const scale of [8,32,128]){
 const attrs={},camera={clientWidth:w,clientHeight:h,classList:{contains:()=>true},style:{}},svg={parentElement:camera,dataset:{}},world={ownerSVGElement:svg,setAttribute(k,v){attrs[k]=v;},removeAttribute(k){delete attrs[k];}};
 const state={_mapVBW:W,_mapVBH:H,mapView:{scale,tx:-W*scale*.45,ty:-H*scale*.4}},stage={classList:{toggle(){}},getBoundingClientRect:()=>({left:12,top:30,width:w,height:h})};
 const ctx=vm.createContext({state,document:{getElementById:()=>world,querySelector:()=>null},mapStage:()=>stage,_syncScaleLevelFromZoom(){},scheduleLabelLayout(){}});
 vm.runInContext(['clampMapScale','clampMapView','applyMapTransform','mapViewportMetrics'].map(n=>functionSource(src,n)).join('\\n'),ctx);ctx.applyMapTransform();
 const v=state.mapView,m=attrs.transform.match(/translate\\(([-\\d.]+) ([-\\d.]+)\\) scale\\(([-\\d.]+)\\)/).slice(1).map(Number),ratio=Math.min(w/W,h/H);
 assert.equal(camera.style.transform,'none');assert.equal(svg.dataset.tmfComposited,'0');assert.equal(svg.dataset.zoomRendering,'vector');
 for(const [x,y] of [[0,0],[W/2,H/2],[W,H]]){assert(Math.abs((x*m[2]+m[0])*ratio-(x*v.scale+v.tx)*ratio)<.001);assert(Math.abs((y*m[2]+m[1])*ratio-(y*v.scale+v.ty)*ratio)<.001);}passed++;
}
assert(fs.readFileSync(path.join(__dirname,'../phase8-formal-bridge-styles.js'),'utf8').includes('.tmf-map-world{transform-box:view-box;transform-origin:0 0;}'),'SVG transforms must use the viewBox, not geography-dependent fill bounds');passed++;
`;
one('function node(values){',extra+'function node(values){');
const backup=path.join(w,'before/smoke-map-viewport-collision.js');assert.ok(!fs.existsSync(backup));fs.writeFileSync(backup,b);assert.equal(hash(fs.readFileSync(f)),hash(b));fs.writeFileSync(f,t);
fs.writeFileSync(path.join(w,'viewport-test-update.json'),JSON.stringify({file:'web/scripts/smoke-map-viewport-collision.js',before:hash(b),after:hash(t),originalAssertionsRetained:true},null,2));
console.log('Updated original viewport fixture; added six deep-zoom projection cases and CSS origin assertion.');
