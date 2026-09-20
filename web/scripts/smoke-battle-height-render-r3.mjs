import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath,pathToFileURL} from 'node:url';
const root=process.env.TM_RENDER_TEST_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const {functionSource}= (await import(pathToFileURL(path.join(root,'web/scripts/lib-perf-round1.js')))).default;
const raw=fs.readFileSync(process.env.TM_BATTLE_CANDIDATE||path.join(root,'web/battle/index.html'),'utf8');
const html=[...raw.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi)].map(m=>m[1]).join('\n');
let passed=0,failed=0;function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.stack);}}
const scalar=(hills,x,y)=>{let z=0;for(const h of hills){const dx=x-h.x,dy=y-h.y,r=h.r,d2=dx*dx+dy*dy;if(d2<r*r){const t=1-Math.sqrt(d2)/r;z+=r*.11*t*t*(3-2*t);}}return z;};
const c={TERR:null,_renderElevationScope:null,Map,Number,Math,console};vm.createContext(c);vm.runInContext(['createRenderElevationScope','elevAt'].map(n=>functionSource(html,n)).join('\n'),c);
let seed=1847;const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
const hills=Array.from({length:180},()=>({x:rnd()*30000-5000,y:rnd()*20000-5000,r:rnd()*1400}));hills.push({...hills[0]},{x:0,y:0,r:0},{x:-1500,y:800,r:-75});
check('40,000 points retain exact summed height, including overlapping hills and negative coordinates',()=>{
 const terrain={hills};c.TERR=terrain;c._renderElevationScope=c.createRenderElevationScope(terrain);assert(c._renderElevationScope);
 for(let i=0;i<40000;i++){const x=rnd()*40000-10000,y=rnd()*30000-10000;assert.equal(c.elevAt(x,y),scalar(hills,x,y));}
});
check('centres, circle boundaries and adjacent floating-point values remain exact',()=>{
 for(const h of hills)for(const dx of [0,h.r,-h.r,h.r*(1-Number.EPSILON),h.r*(1+Number.EPSILON)])for(const dy of [0,h.r,-h.r])assert.equal(c.elevAt(h.x+dx,h.y+dy),scalar(hills,h.x+dx,h.y+dy));
});
check('scopes are rebuilt after in-place edits and additions',()=>{
 const t={hills:hills.map(h=>({...h}))};c.TERR=t;c._renderElevationScope=c.createRenderElevationScope(t);t.hills[0].x+=1000;t.hills[1].r*=2;t.hills.push({x:100,y:200,r:400});c._renderElevationScope=c.createRenderElevationScope(t);
 for(const h of t.hills)assert.equal(c.elevAt(h.x,h.y),scalar(t.hills,h.x,h.y));
});
check('replacement terrain, tactical heightfields, and out-of-render simulation bypass stale scope',()=>{
 c.TERR={hills:[{x:1,y:2,r:10}]};assert.equal(c.elevAt(1,2),1.1);c.TERR.tactical={heightAt:(x,y)=>x-y};assert.equal(c.elevAt(3,8),-5);delete c.TERR.tactical;c._renderElevationScope=null;c.TERR.hills[0].r=20;assert.equal(c.elevAt(1,2),2.2);
});
check('small, malformed and extreme input safely uses the original sampler',()=>{
 assert.equal(c.createRenderElevationScope({hills:[]}),null);assert.equal(c.createRenderElevationScope({hills:Array(20).fill({x:Infinity,y:0,r:1})}),null);
 c.TERR={hills};c._renderElevationScope=c.createRenderElevationScope(c.TERR);for(const x of [NaN,Infinity,-Infinity,'0'])assert.equal(c.elevAt(x,0),scalar(hills,x,0));
});
check('render failures restore the previous sampler and cannot affect the next simulation step',()=>{
 c.TERR={hills};const previous={marker:true};c._renderElevationScope=previous;c.RENDER3D=true;c.R3D={ensure(){throw Error('injected-render-failure');}};vm.runInContext(functionSource(html,'draw'),c);
 assert.throws(()=>c.draw(),/injected-render-failure/);assert.equal(c._renderElevationScope,previous);c._renderElevationScope=null;
});
check('sparse terrain queries skip unrelated hills without changing a single height',()=>{
 let reads=0;const hs=Array.from({length:1000},(_,i)=>{const h={x:(i%40)*500,y:Math.floor(i/40)*500};Object.defineProperty(h,'r',{get(){reads++;return 90;}});return h;});
 const scope=c.createRenderElevationScope({hills:hs});assert(scope);reads=0;
 for(let i=0;i<1000;i++)scope.query((i%40)*500,Math.floor(i/40)*500);
 assert(reads<10000,'too many radius reads: '+reads);console.log('HEIGHT_QUERY_COUNTS '+JSON.stringify({fullScan:1000000,indexedRadiusReads:reads}));
});
const meshSource=functionSource(html,'buildMesh');
const originalMesh=meshSource.replace(/    \/\/ Preserve double precision[\s\S]*?const Hf=\(i,j\)=>heightSamples\[\(j\+1\)\*heightStride\+i\+1\];/, '    const Hf=(i,j)=>EXAG*elevAt(Math.min(WORLD.w,Math.max(0,i*sx)),Math.min(WORLD.h,Math.max(0,j*sy)));');
function meshRun(code,tactical,w=12000,h=7333.3){
 const uploads=[];let calls=0;const scope={mesh:null,TERR:tactical?{tactical}:null,WORLD:{w,h},EXAG:1.37,Float32Array,Float64Array,Uint16Array,Math,
 elevAt(x,y){calls++;return Math.sin(x*.013)*Math.cos(y*.017)*76+x*.003-y*.007;},gl:{ARRAY_BUFFER:1,ELEMENT_ARRAY_BUFFER:2,STATIC_DRAW:3,createBuffer(){return{};},bindBuffer(){},deleteBuffer(){},bufferData(_,data){uploads.push({type:data.constructor.name,bytes:Buffer.from(data.buffer)});}}};
 vm.createContext(scope);vm.runInContext(code,scope);scope.buildMesh();return{uploads,calls};
}
check('terrain mesh positions, normals, UVs and indices are byte-for-byte identical',()=>{
 assert.notEqual(originalMesh,meshSource);for(const dims of [null,{nx:7,ny:9},{nx:210,ny:147}]){
 const old=meshRun(originalMesh,dims),next=meshRun(meshSource,dims);assert.deepEqual(next.uploads,old.uploads);assert(next.calls<old.calls/2);console.log('MESH_SAMPLES '+JSON.stringify({dims,old:old.calls,next:next.calls}));}
});
check('repeated mesh builds re-read updated heights rather than caching old geometry',()=>{
 const a=meshRun(meshSource,{nx:9,ny:8},1024,768),b=meshRun(meshSource,{nx:9,ny:8},2048,1024);assert.notDeepEqual(a.uploads,b.uploads);
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
