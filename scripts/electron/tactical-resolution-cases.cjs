'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({call,check,dir}){
  await check('software-only resolution control preserves HUD, picking, roster and explicit native choice',async()=>{
    const r=await call(`(()=>{const control=$('optResolution'),snapshot=()=>({resolution:R3D.resolution,raster:R3D.rasterInfo,gl:[R3D.context.canvas.width,R3D.context.canvas.height],css:[R3D.context.canvas.clientWidth,R3D.context.canvas.clientHeight],hud:[cv.width,cv.height,W,H,DPR],matrix:Array.from(R3D.projection),soldiers:units.map(u=>[u.id,u.soldiers,u.x,u.y]),point:R3D.project(cam.x,cam.y)});draw();const before=snapshot();try{control.value='native';control.dispatchEvent(new Event('change'));draw();const native=snapshot(),saved=localStorage.getItem('tm_battle_resolution_v1');control.value='auto';control.dispatchEvent(new Event('change'));draw();return{before,native,auto:snapshot(),saved,autoSaved:localStorage.getItem('tm_battle_resolution_v1'),error:R3D.context.getError()};}finally{control.value=before.resolution.mode;control.dispatchEvent(new Event('change'));draw();}})()`);
    fs.writeFileSync(path.join(dir,'resolution-controls.json'),JSON.stringify(r,null,2));
    assert.equal(r.error,0);assert.equal(r.saved,'native');assert.equal(r.autoSaved,'auto');assert.equal(r.native.resolution.scale,1);assert.deepEqual(r.native.gl,r.native.css.map(Math.round));
    for(const next of [r.native,r.auto]){assert.deepEqual(next.hud,r.before.hud);assert.deepEqual(next.soldiers,r.before.soldiers);assert.deepEqual(next.matrix,r.before.matrix);assert.deepEqual(next.point,r.before.point);}
    if(r.auto.raster.software&&r.auto.css[0]*r.auto.css[1]>240000){assert(r.auto.resolution.scale<1);assert(r.auto.gl[0]*r.auto.gl[1]<=240000);}else assert.equal(r.auto.resolution.scale,1);
  });
};
