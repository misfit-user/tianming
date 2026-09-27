// Actual battle renderer, offline and isolated from the player's settings/saves.
import {app,BrowserWindow} from 'electron';import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const work=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(work,'../..'),dir=path.join(work,'battle-native');
fs.mkdirSync(dir,{recursive:true});for(const key of ['userData','sessionData']){const p=path.join(dir,key);fs.mkdirSync(p,{recursive:true});app.setPath(key,p);}
let win,finished=false;const report={complete:false,errors:[],started:new Date().toISOString()};
const deadline=setTimeout(()=>finish(1,'deadline'),120000);
function finish(code,error){if(finished)return;finished=true;clearTimeout(deadline);report.code=code;report.error=error;try{fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));}finally{if(win&&!win.isDestroyed())win.destroy();app.exit(code);}}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
app.whenReady().then(async()=>{win=new BrowserWindow({width:1280,height:800,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.session.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_,cb)=>cb({cancel:true}));
 win.webContents.on('console-message',(_,level,message)=>{if(level>=3&&report.errors.length<20)report.errors.push(String(message).slice(0,500));});
 win.webContents.on('render-process-gone',(_,d)=>finish(1,JSON.stringify(d)));const js=s=>win.webContents.executeJavaScript(s,true);
 try{await win.loadFile(path.join(root,'web/battle/index.html'));report.start=await js(`(()=>{const roster=MAPS.hunhe.roster();const r=startBattle({mapId:'hunhe',mapSeed:1937,weather:'clear',armies:{ming:roster.M,jin:roster.J}});state.paused=true;state.phase='deploy';document.getElementById('compose').style.display='none';draw();return r;})()`);console.log('battle-started',JSON.stringify(report.start));
 await sleep(1800);report.ready=await js(`({ready:R3D.ready,unitsReady:R3D.unitsReady,raster:R3D.rasterInfo,resolution:R3D.resolution,phase:state.phase,units:units.length})`);
 if(!report.ready.ready)throw Error('Actual WebGL renderer not ready');report.gpu=app.getGPUFeatureStatus();
 report.draw=await js(`(()=>{const gl=R3D.context,counts={},saved={},times=[];for(const name of ['getUniformLocation','getAttribLocation','drawElements','drawArrays','texSubImage2D']){saved[name]=gl[name];gl[name]=function(...a){counts[name]=(counts[name]||0)+1;return saved[name].apply(this,a);};}let oldTime=state.time;try{for(let i=0;i<12;i++){const t=performance.now();draw();times.push(performance.now()-t);}return {counts,times,error:gl.getError(),simulationUnchanged:state.time===oldTime,projection:Array.from(R3D.projection||[])};}finally{for(const name of Object.keys(saved))gl[name]=saved[name];}})()`);
 if(report.draw.error!==0||!report.draw.simulationUnchanged)throw Error('Battle render contract failed');
 report.complete=true;console.log('battle-complete',JSON.stringify(report.draw));finish(0);
 }catch(e){finish(1,String(e.stack||e));}
}).catch(e=>finish(1,String(e.stack||e)));
