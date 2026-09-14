'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({frame,win,check,reportDir}){
  const call=code=>frame.executeJavaScript(code,true),delay=ms=>new Promise(r=>setTimeout(r,ms)),metrics={};
  await check('production moveUnit completes a house detour without crossing solid geometry',async()=>{
    const r=await call(`(()=>{const o=TERR.tactical.props.find(p=>p.kind==='house'),a=NAV.nearest({x:o.x-o.size*4-120,y:o.y}),b=NAV.nearest({x:o.x+o.size*4+120,y:o.y});const u={...units.find(u=>u.side==='ming'&&!u._hero),...a,tx:b.x,ty:b.y,order:'move',target:null,state:'steady',sta:100,hidden:false,_balk:false,_navTrail:[a],facing:0,name:'绕障验收阵'};let unsafe=0,steps=0,maxStep=0,route=0;const saved=state.time;for(;steps<3500&&u.tx!=null;steps++){const before={x:u.x,y:u.y};state.time+=.05;MOTION.beginStep([u]);moveUnit(u,.05);MOTION.endStep([u]);if(!NAV.walkable(u.x,u.y))unsafe++;maxStep=Math.max(maxStep,Math.hypot(u.x-before.x,u.y-before.y));route=Math.max(route,(u._navRoute||[]).length);}state.time=saved;return{unsafe,steps,maxStep,route,distance:Math.hypot(u.x-b.x,u.y-b.y),status:u._navStatus};})()`);
    fs.writeFileSync(path.join(reportDir,'routing-house.json'),JSON.stringify(r,null,2));assert.equal(r.unsafe,0);assert(r.route>2);assert(r.steps<3500);assert(r.distance<25,JSON.stringify(r));assert(r.maxStep<30);metrics.house=r;
  });
  await check('production movement crosses the bridge and individual crowd feet stay out of deep water',async()=>{
    const r=await call(`(()=>{const w=TERR.tactical,b=w.crossings.find(b=>b.kind==='bridge'),a={x:b.x-b.ty*1800,y:b.y+b.tx*1800},goal={x:b.x+b.ty*1800,y:b.y-b.tx*1800};const u={...units.find(u=>u.side==='ming'&&!u._hero),...a,tx:goal.x,ty:goal.y,order:'move',target:null,state:'steady',sta:100,hidden:false,_balk:false,_navTrail:[a],facing:Math.atan2(goal.y-a.y,goal.x-a.x),name:'渡桥验收阵'};const men=Array.from({length:9},(_,i)=>({x:a.x+(i-4)*30,y:a.y}));let unsafe=0,crowdUnsafe=0,crossed=0,steps=0;const saved=state.time;for(;steps<4500&&u.tx!=null;steps++){state.time+=.05;MOTION.beginStep([u]);moveUnit(u,.05);MOTION.endStep([u]);if(!NAV.walkable(u.x,u.y))unsafe++;if(w.riverInfo(u.x,u.y).distance<w.riverW/2)crossed++;for(const [i,m] of men.entries()){const target=MOTION.crowdTarget(m,u,{x:u.x+(i-4)*45,y:u.y}),nx=m.x+(target.x-m.x)*.35,ny=m.y+(target.y-m.y)*.35;MOTION.crowdMove(m,nx,ny,false);if(!NAV.walkable(m.x,m.y,6))crowdUnsafe++;}}state.time=saved;return{unsafe,crowdUnsafe,crossed,steps,distance:Math.hypot(u.x-goal.x,u.y-goal.y)};})()`);
    fs.writeFileSync(path.join(reportDir,'routing-bridge.json'),JSON.stringify(r,null,2));assert.equal(r.unsafe,0);assert.equal(r.crowdUnsafe,0);assert(r.crossed>0);assert(r.steps<4500);assert(r.distance<25,JSON.stringify(r));metrics.bridge=r;
  });
  await check('placement cannot move into the enemy half or onto a building',async()=>{
    const r=await call(`(()=>{const u={...units.find(u=>u.side==='ming'&&!u._hero)},old={x:u.x,y:u.y},enemy=TERR.tactical.deployment('jin'),no=MOTION.place(u,enemy),same=u.x===old.x&&u.y===old.y,own=TERR.tactical.deployment('ming'),yes=MOTION.place(u,own);return{no,same,yes,safe:NAV.walkable(u.x,u.y)};})()`);assert.equal(r.no,false);assert(r.same&&r.yes&&r.safe);
  });
  // Actual controls change a rendered scene; leave simulation paused for a stable visual comparison.
  await call(`(()=>{$('btnPlay').click();})()`);await delay(100);await call(`(()=>{if(!state.paused)$('btnPlay').click();const p=TERR.tactical.hamlets[0];cam.x=p.x;cam.y=p.y+400;cam.zoom=.42;camYaw=.35;$('optGraphics').value='high';$('optGraphics').dispatchEvent(new Event('change'));draw();})()`);await delay(150);
  const high=(await win.webContents.capturePage());fs.writeFileSync(path.join(reportDir,'phase2-village-high.png'),high.toPNG());
  await check('high graphics allocates both shadow cascades and renders detailed instances',async()=>{
    const r=await call('R3D.landscapeStats');assert(r.detail&&r.detail.instancing);assert(r.detail.lodCounts[0]>0);assert(r.shadow.supported&&r.shadow.enabled);assert.deepEqual(r.shadow.sizes,[2048,1024]);assert.equal(await call(`R3D.context.getError()`),0);metrics.high=r;
  });
  await call(`$('optShadows').click();draw();`);await delay(120);const unshadowed=await win.webContents.capturePage();
  await check('shadow checkbox changes real image pixels while keeping the same high-detail geometry',async()=>{
    const r=await call('R3D.landscapeStats');assert(!r.shadow.enabled);assert.equal(r.graphics,'high');assert.equal(r.detail.triangles,metrics.high.detail.triangles);assert.deepEqual(r.detail.lodCounts,metrics.high.detail.lodCounts);const a=high.toBitmap(),b=unshadowed.toBitmap(),size=high.getSize();let changed=0,samples=0;for(let y=Math.floor(size.height*.28);y<size.height*.65;y++)for(let x=Math.floor(size.width*.25);x<size.width*.75;x++){const k=(y*size.width+x)*4;const diff=Math.abs(a[k]-b[k])+Math.abs(a[k+1]-b[k+1])+Math.abs(a[k+2]-b[k+2]);if(diff>25)changed++;samples++;}assert(changed>1000,'shadow pixel delta '+changed);metrics.shadowPixels={changed,samples};
  });
  await call(`$('optShadows').click();$('optGraphics').value='low';$('optGraphics').dispatchEvent(new Event('change'));draw();`);
  await check('power-saving control uses distant LOD and releases shadow allocations',async()=>{const r=await call('R3D.landscapeStats');assert.equal(r.graphics,'low');assert(!r.shadow.enabled);assert.equal(r.shadow.cascades,0);assert.equal(r.detail.lodCounts[0]+r.detail.lodCounts[1],0);assert(r.detail.lodCounts[2]>0);assert.equal(await call(`R3D.context.getError()`),0);metrics.low=r;});
  await call(`(()=>{$('optGraphics').value='high';$('optGraphics').dispatchEvent(new Event('change'));const p=TERR.tactical.props.find(p=>p.kind==='tree');cam.x=p.x;cam.y=p.y+250;cam.zoom=.75;camYaw=.5;draw();})()`);await delay(150);
  fs.writeFileSync(path.join(reportDir,'phase2-forest-close.png'),(await win.webContents.capturePage()).toPNG());
  await check('close forest at high quality remains responsive',async()=>{const r=await call(`new Promise(resolve=>{const times=[];let last=performance.now();function sample(now){times.push(now-last);last=now;if(times.length===35){times.sort((a,b)=>a-b);resolve({median:times[17],p95:times[32]});}else requestAnimationFrame(sample);}requestAnimationFrame(sample);})`);assert(r.median<80&&r.p95<160,JSON.stringify(r));metrics.highForestFrames=r;});
  await call(`$('optGraphics').value='balanced';$('optGraphics').dispatchEvent(new Event('change'));draw();`);
  await check('context loss falls back to a usable map and restores geometry without changing soldiers',async()=>{
    const before=await call('units.reduce((n,u)=>n+u.soldiers,0)');
    await call(`window.__loseTerrainContext=R3D.context.getExtension('WEBGL_lose_context');if(!__loseTerrainContext)throw Error('context-loss test extension missing');__loseTerrainContext.loseContext();`);await delay(120);
    assert(await call('!R3D.ready&&!!terrainCanvas&&terrainCanvas.width>0'));
    await call('__loseTerrainContext.restoreContext();');const end=Date.now()+12000;let ready=false;while(Date.now()<end){ready=await call('R3D.ready&&R3D.unitsReady&&R3D.landscapeStats.detail.drawn>0');if(ready)break;await delay(40);}assert(ready,'GPU scene did not restore');
    assert.equal(await call('units.reduce((n,u)=>n+u.soldiers,0)'),before);assert.equal(await call(`R3D.context.getError()`),0);metrics.contextRestored=true;
  });
  fs.writeFileSync(path.join(reportDir,'phase2-metrics.json'),JSON.stringify(metrics,null,2));
};
