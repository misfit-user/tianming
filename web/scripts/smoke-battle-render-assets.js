'use strict';
const assert=require('node:assert/strict'),assets=require('../battle/terrain-assets.js'),shadows=require('../battle/terrain-shadows.js');let n=0;
function test(name,fn){fn();n++;console.log('PASS '+name);}
for(const kind of ['house','broadleaf','pine','willow','snow-pine','rock','palisade'])for(let variant=0;variant<3;variant++)test(kind+' variant '+variant+' valid geometry and descending LOD budget',()=>{
  let previous=Infinity;for(let lod=0;lod<3;lod++){const m=assets.generate(kind,lod,variant);assert.equal(m.count*12,m.vertices.length);assert.equal(m.count%3,0);assert(m.triangles<=previous);previous=m.triangles;assert(m.vertices.every(Number.isFinite));assert(m.triangles<1200);assert.deepEqual(m,assets.generate(kind,lod,variant));for(let i=0;i<m.vertices.length;i+=12){const l=Math.hypot(m.vertices[i+3],m.vertices[i+4],m.vertices[i+5]);assert(Math.abs(l-1)<1e-5);}}
});
test('sun projection keeps the selected focus centered and within depth range',()=>{const c=[15000,11000,150],m=shadows.matrix(c,6000),p=[0,0,0,0];for(let r=0;r<4;r++)p[r]=m[r]*c[0]+m[r+4]*c[1]+m[r+8]*c[2]+m[r+12];assert(Math.abs(p[0])<.001&&Math.abs(p[1])<.001);assert(p[2]>-1&&p[2]<1);});
test('depth-texture absence is an explicit unshadowed fallback without framebuffer allocation',()=>{
  let created=0;const target={MAX_TEXTURE_SIZE:1,HIGH_FLOAT:2,FRAGMENT_SHADER:3,getExtension:()=>null,getParameter:()=>2048,getShaderPrecisionFormat:()=>({precision:23}),createTexture:()=>({}),createFramebuffer:()=>{created++;return{};},getUniformLocation:()=>null};
  const gl=new Proxy(target,{get:(o,k)=>k in o?o[k]:()=>{}}),s=shadows.create(gl,()=>({}));s.update({key:'x'}, {x:0,y:0},()=>{throw Error('no shadow drawing allowed');});assert.equal(created,0);assert.equal(s.stats.enabled,false);assert(s.stats.reason);s.bind({});s.destroy();
});
console.log('PASS battle render assets '+n+' checks');
