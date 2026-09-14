'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),R=require('../battle/render-resolution.js');
for(const [w,h] of [[1280,800],[1920,1080],[3840,2160],[800,1280],[320,200],[1,1]]){
  for(const software of [false,true])for(const mode of ['auto','native']){
    const s=R.size(w,h,software,mode);assert(s.width>0&&s.height>0&&s.width<=w&&s.height<=h);
    if(!software||mode==='native'){assert.equal(s.width,w);assert.equal(s.height,h);assert.equal(s.scale,1);}
    else{assert(s.width*s.height<=R.SOFTWARE_PIXELS);assert(Math.abs(s.width/w-s.height/h)<=1/w+1/h);}
  }
}
assert.deepEqual(R.size(NaN,Infinity,true,'bad'),{width:1,height:1,scale:1,software:true,mode:'auto'});
const budget=R.create();for(let i=1;i<=80;i++)budget.frame(i*100,false);assert.equal(budget.pixels,R.SOFTWARE_PIXELS,'hardware/manual mode cannot adapt');
budget.reset();for(let i=1;i<=80;i++)budget.frame(i*16.7,true);assert.equal(budget.pixels,R.SOFTWARE_PIXELS,'healthy frames retain detail');
budget.reset();for(let i=1;i<=80;i++)budget.frame(i*100,true);assert.equal(budget.pixels,R.MIN_SOFTWARE_PIXELS,'slow software path adapts to a bounded minimum');
const low=R.size(1280,800,true,'auto',budget.pixels);assert(low.width*low.height<=R.MIN_SOFTWARE_PIXELS);budget.reset();assert.equal(budget.pixels,R.SOFTWARE_PIXELS);
const html=fs.readFileSync(require.resolve('../battle/index.html'),'utf8');assert(html.indexOf('src="render-resolution.js')<html.indexOf('const R3D='));assert(html.includes('id="optResolution"'));assert(html.includes("localStorage.setItem('tm_battle_resolution_v1',mode)"));
assert(html.includes('M4.persp(FOV,W/Math.max(1,H)'),'projection must use CSS aspect, not rounded raster dimensions');
const source=html.slice(html.indexOf('function battleGraphicsProfile('),html.indexOf('const $=id=>'));
for(const renderer of ['SwiftShader Device','llvmpipe','Microsoft Basic Render Driver','ANGLE WARP','NVIDIA RTX','Intel Iris Xe','AMD Radeon']){
  const s={};vm.runInNewContext(source,s);const soft=/SwiftShader|llvmpipe|Microsoft Basic Render|WARP/.test(renderer);
  assert.equal(s.battleGraphicsProfile({getExtension:()=>null,getParameter:()=>renderer}).software,soft);
}
console.log('PASS software-only raster budget, full-resolution opt-out, hardware unchanged, portrait/4K aspect, invalid input, settings persistence and load order');
