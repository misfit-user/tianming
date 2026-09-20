'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const {functionSource}=require('./lib-perf-round1');
const source=fs.readFileSync(process.env.TM_CULTURE_SOURCE||require('node:path').join(__dirname,'../map-editor-culture-raster.js'),'utf8');
let passed=0,failed=0;function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.stack);}}
const c={};vm.createContext(c);vm.runInContext(['buildNearestTree','nearestThree'].map(n=>functionSource(source,n)).join('\n'),c);
let seed=718;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
function brute(entries,x,y){return entries.map(entry=>({entry,distance:(entry.x-x)**2+(entry.y-y)**2})).filter(a=>a.distance<Infinity).sort((a,b)=>a.distance-b.distance||a.entry.order-b.entry.order).slice(0,3);}
check('exact three-nearest selection, including ties and coincident points',()=>{
 for(const n of [1,2,3,4,17,100,513]){
  const entries=Array.from({length:n},(_,order)=>({x:Math.floor(random()*25)*8,y:Math.floor(random()*25)*8,order})),tree=c.buildNearestTree(entries,0);
  for(let i=0;i<300;i++){const x=Math.floor(random()*40)*8-40,y=Math.floor(random()*40)*8-40;
   assert.deepEqual(JSON.parse(JSON.stringify(c.nearestThree(tree,x,y))),brute(entries,x,y));}
 }
});
function harness(){
 const events={},canvases=[],counts={pixels:0};
 const ME={EDITOR:{map:{bitmapWidth:128,bitmapHeight:128,divisions:[]}},layers:{ETHNIC_COLOR:{a:'#123456',b:'#fedcba',c:'#398'},FAITH_COLOR:{a:'#112233',b:'#aaaaaa'}},requestRender(){},on(n,f){events[n]=f;}};
 const window={TM:{MapEditor:ME}},document={addEventListener(){},createElement(){
  const canvas={width:0,height:0,getContext(){return{createImageData(w,h){counts.pixels+=w*h;return{width:w,height:h,data:new Uint8ClampedArray(w*h*4)};},putImageData(image){canvas.image=image;},drawImage(image){canvas.scaled=image;}};}};canvases.push(canvas);return canvas;
 }};
 const box={window,TM:window.TM,document,console,localStorage:{getItem(){return null;},setItem(){}}};vm.runInNewContext(source,box);
 const api=ME.cultureRaster,sink={save(){},restore(){},drawImage(image){this.image=image;}};api.init();api.setMode('culture');
 return{ME,api,events,counts,render(){api.render(sink,{});return sink.image;}};
}
check('raster pixels exactly match the original three-neighbor blend',()=>{
 const h=harness(),entries=[];h.ME.EDITOR.map.divisions=Array.from({length:80},(_,i)=>{const x=Math.floor(random()*128),y=Math.floor(random()*128),k=['a','b','c'][i%3];entries.push({x,y,order:i,rgb:[[18,52,86],[254,220,186],[51,153,136]][i%3]});return{centroid:[x,y],byEthnicity:{[k]:1}};});
 const result=h.render();assert.equal(result.width,128);assert.equal(result.height,128);const image=result.scaled.image;
 assert.equal(image.width,16);assert.equal(image.height,16);
 for(let y=0;y<16;y++)for(let x=0;x<16;x++){
  const hits=brute(entries,x*8,y*8),weights=hits.map(a=>1/Math.max(1,a.distance)),total=weights.reduce((a,b)=>a+b,0);
  const expected=[0,1,2].map(k=>hits.reduce((sum,a,i)=>sum+a.entry.rgb[k]*weights[i],0)/total|0).concat(180);
  assert.deepEqual(Array.from(image.data.subarray((y*16+x)*4,(y*16+x)*4+4)),expected);
 }
});
check('same-count geometry, culture, palette and map changes invalidate correctly',()=>{
 const h=harness();h.ME.EDITOR.map.divisions=[{centroid:[0,0],byEthnicity:{a:1}}];let prev=h.render();assert.equal(h.render(),prev);
 h.ME.EDITOR.map.divisions[0].centroid[0]=24;let next=h.render();assert.notEqual(next,prev);prev=next;
 h.ME.EDITOR.map.divisions[0].byEthnicity={b:1};next=h.render();assert.notEqual(next,prev);prev=next;
 h.ME.layers.ETHNIC_COLOR.b='#001122';next=h.render();assert.notEqual(next,prev);prev=next;
 h.events.mutation();assert.equal(h.render(),prev);
 h.ME.EDITOR.map={bitmapWidth:64,bitmapHeight:64,divisions:[{centroid:[12,12],byEthnicity:{a:1}}]};assert.equal(h.render().width,64);
});
check('unchanged content converts once across 60 renders',()=>{
 const h=harness();h.ME.EDITOR.map.divisions=[{centroid:[0,0],byEthnicity:{a:1}}];for(let i=0;i<60;i++){h.events.mutation();h.render();}assert.equal(h.counts.pixels,256);
});
check('spatial index avoids full-region traversal for ordinary grid queries',()=>{
 const entries=Array.from({length:2048},(_,order)=>({x:random()*8192,y:random()*4096,order}));
 const probe={visits:0};vm.createContext(probe);vm.runInContext(functionSource(source,'buildNearestTree')+'\n'+functionSource(source,'nearestThree').replace('var p = node.point','visits++; var p = node.point'),probe);
 const tree=probe.buildNearestTree(entries,0);for(let i=0;i<512;i++)probe.nearestThree(tree,random()*8192,random()*4096);
 assert(probe.visits<2048*512/10,'should inspect less than one tenth of brute-force candidates');console.log('NEAREST_VISITS '+probe.visits+' / '+2048*512);
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
