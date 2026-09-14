'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
module.exports=async function({win,check,phase2}){
  const js=code=>win.webContents.executeJavaScript(code,true),delay=ms=>new Promise(r=>setTimeout(r,ms)),reportDir=path.dirname(process.env.TM_BRIDGE_TEST_REPORT);
  async function until(fn,label){const end=Date.now()+12000;while(Date.now()<end){const r=await fn();if(r)return r;await delay(35);}throw Error('not reached: '+label);}
  win.show();win.focus();await until(()=>js('!!(window.TMBattleEmbed&&window.TMBattleTurn&&MilitarySystems._battleHookInstalled&&MilitarySystems.validateBattleResult)&&document.readyState==="complete"'),'production battle embed');
  const errors=[];win.webContents.on('console-message',(_,level,message)=>{if(level>=1)errors.push(message);});
  await js(`window.__terrainMessages=[];addEventListener('message',e=>{if(e.data&&/^battle/.test(e.data.type||''))__terrainMessages.push(e.data);});`);
  const cases=[{biome:'verdant',dir:'N'},{biome:'plain',dir:'E'},{biome:'snow',dir:'S',weather:'snow'},{biome:'desert',dir:'W'},{biome:'wetland',dir:'N',coast:true},{biome:'verdant',dir:'N',fort:true}];
  const observations=[];
  if(phase2)cases.splice(2);
  for(const [index,p] of cases.entries()){
    const cfg={mapSeed:1701+index*7,weather:p.weather||'clear',terrainProfile:{biome:p.biome,coast:!!p.coast,fort:!!p.fort,provinceMeta:{neighborDir:p.dir,oceanSide:'left',capitalName:'沿河县邑'}},sideName:{ming:'蜀汉',jin:'曹魏'},lead:'敌军主将',armies:{}};
    for(const side of ['ming','jin'])cfg.armies[side]=Array.from({length:8},(_,i)=>({id:side+i,parentArmyId:side,type:i<5?'step':i<7?'bow':'cav',sub:i<5?'spear':i<7?'bow':'shock',name:'第'+(i+1)+'阵',soldiers:500,mor:70,training:65,supply:80,emperor:side==='ming'&&i===0,gen:{n:side==='ming'&&i===0?'刘备':'军将'+side+i,valor:70,mil:70,int:65}}));
    const launched=Date.now();await js(`window.__terrainReturn=null;TMBattleEmbed.launch(${JSON.stringify(cfg)}).then(r=>{window.__terrainReturn=r||{aborted:true}});void 0`);
    let frame;
    try{await until(async()=>{const ret=await js('window.__terrainReturn');if(ret)throw Error('startup returned '+JSON.stringify(ret));frame=win.webContents.mainFrame.frames.find(f=>/\/battle\/index\.html(?:[?#]|$)/.test(f.url.replaceAll('\\','/')));if(!frame)return false;return await frame.executeJavaScript('typeof TERR!=="undefined"&&TERR&&!!TERR.tactical&&R3D.ready&&state.phase==="compose"');},'landscape '+p.biome);}catch(e){fs.writeFileSync(path.join(reportDir,'startup-diagnostic.json'),JSON.stringify({errors,messages:await js('__terrainMessages'),frames:win.webContents.mainFrame.frames.map(f=>f.url)},null,2));fs.writeFileSync(path.join(reportDir,'startup-diagnostic.png'),(await win.webContents.capturePage()).toPNG());throw e;}
    const call=code=>frame.executeJavaScript(code,true);
    await call(`$('cmpGo').click()`);
    await check(p.biome+'/'+p.dir+' real shared height, water, props and GPU draw',async()=>{
      const r=await call(`(()=>{const t=TERR.tactical;return{key:t.key,props:t.props.length,houses:t.props.filter(p=>p.kind==='house').length,stats:R3D.landscapeStats,fields:t.fields.length,army:units.filter(u=>!u._hero).reduce((n,u)=>n+u.soldiers,0),error:R3D.context.getError(),height:elevAt(t.objective.x,t.objective.y),sameHeight:t.heightAt(t.objective.x,t.objective.y)===elevAt(t.objective.x,t.objective.y),crossings:t.crossings.map(b=>({kind:b.kind,move:terrMove({x:b.x,y:b.y,type:'step',sub:'spear'})}))};})()`);
      fs.writeFileSync(path.join(reportDir,'draw-'+index+'.json'),JSON.stringify({result:r,errors},null,2));
      assert(r.stats&&r.stats.vertices>10000);assert(r.props<8000);assert(r.houses>0);assert(r.fields>0);assert.equal(r.error,0);assert(r.sameHeight);assert.equal(r.army,8000);assert(r.crossings.every(b=>b.move>=(b.kind==='bridge'?1:.8)));
      observations.push({...p,...r,startupMs:Date.now()-launched});
    });
    await check(p.biome+'/'+p.dir+' real projection and elevated terrain picking agree',async()=>{
      const r=await call(`(()=>{const t=TERR.tactical;cam.x=t.objective.x;cam.y=t.objective.y;cam.zoom=.18;draw();const points=[t.objective,...t.props.filter(p=>p.kind==='tree').slice(0,50)],out=[];for(const p of points){const s=R3D.project(p.x,p.y);if(s.x<100||s.x>W-100||s.y<130||s.y>H*.68)continue;const q=R3D.unproject(s.x,s.y),s2=R3D.project(q.x,q.y);out.push({objective:p===t.objective,point:{x:p.x,y:p.y,z:elevAt(p.x,p.y)},hit:{x:q.x,y:q.y,z:elevAt(q.x,q.y)},screen:s,screenHit:s2,error:Math.hypot(q.x-p.x,q.y-p.y),screenError:Math.hypot(s.x-s2.x,s.y-s2.y)});}return out;})()`);
      fs.writeFileSync(path.join(reportDir,'picking-'+index+'.json'),JSON.stringify(r,null,2));
      assert(r.some(p=>p.objective));assert(r.find(p=>p.objective).error<6,'visible objective picking error '+r.find(p=>p.objective).error);assert(r.every(p=>p.screenError<.3),'ray must hit the same screen pixel, including occluded background points');observations[index].maxPickingError=r.find(p=>p.objective).error;
    });
    if(index===0)await require('./tactical-cache-cases.cjs')({frame,check,reportDir});
    await check(p.biome+'/'+p.dir+' visible-frame timing stays bounded',async()=>{
      if(index===0&&process.env.TM_BRIDGE_TACTICAL_TRACE==='1'){const trace=require('electron').contentTracing;await trace.startRecording({categoryFilter:'devtools.timeline,blink,cc,gpu,disabled-by-default-devtools.timeline',traceOptions:'record-until-full'});await delay(2000);await trace.stopRecording(path.join(reportDir,'gpu-trace.json'));}
      const gpu=await call(`(()=>{const gl=R3D.context,e=gl.getExtension('WEBGL_debug_renderer_info');return{renderer:e?gl.getParameter(e.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER),width:gl.canvas.width,height:gl.canvas.height,css:{W,H},units:R3D.unitStats,landscape:R3D.landscapeStats};})()`);fs.writeFileSync(path.join(reportDir,'gpu-'+index+'.json'),JSON.stringify(gpu,null,2));
      const r=await call(`new Promise(resolve=>{const times=[];let last=performance.now();function sample(now){times.push(now-last);last=now;if(times.length===45){times.sort((a,b)=>a-b);resolve({median:times[22],p95:times[42]});}else requestAnimationFrame(sample);}requestAnimationFrame(sample);})`);
      assert(r.median<80&&r.p95<160,'frame intervals '+JSON.stringify(r));observations[index].frameMs=r;
    });
    if(phase2&&index===0)await require('./tactical-phase2-cases.cjs')({frame,win,check,reportDir});
    if(index===0||p.coast||p.fort){
      await call(`(()=>{const t=TERR.tactical,p=t.hamlets[0]||t.objective;cam.x=p.x;cam.y=p.y+500;cam.zoom=.24;camYaw=.28;draw();})()`);await delay(120);
      fs.writeFileSync(path.join(reportDir,'terrain-'+p.biome+(p.fort?'-fort':'')+'.png'),(await win.webContents.capturePage()).toPNG());
    }
    await check(p.biome+'/'+p.dir+' fallback map and simulation still work',async()=>{
      const r=await call(`(()=>{RENDER3D=false;draw();const ready=!!terrainCanvas&&terrainCanvas.width>0;RENDER3D=true;$('btnPlay').click();return ready;})()`);assert(r);await until(()=>call('state.time>0'),'battle simulation');
    });
    await js(`(()=>{document.querySelector('#tm-battle-overlay button').click();})()`);
    await until(()=>js('!!window.__terrainReturn'),'clean battle exit');
  }
  fs.writeFileSync(path.join(reportDir,'terrain-metrics.json'),JSON.stringify(observations,null,2));
};
