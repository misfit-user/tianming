'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
module.exports=async function({win,temp,check,baseline}){
  const dir=path.dirname(process.env.TM_BRIDGE_TEST_REPORT),file=process.env.TM_MAP_FIXTURE;
  const started=Date.now(),js=async code=>{const value=await win.webContents.executeJavaScript(code,true);console.log('ZOOM step',Date.now()-started,code.slice(0,64));return value;},hash=()=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'),before=hash();
  // Never pair one era's start with another era's map, even in a benchmark.
  const source=JSON.parse(fs.readFileSync(file,'utf8'));
  fs.mkdirSync(path.join(temp,'scenarios'),{recursive:true});fs.copyFileSync(file,path.join(temp,'scenarios','地图隔离验收.json'));console.log('ZOOM fixture ready',source.id);
  win.webContents.on('console-message',(_e,_l,message)=>{if(message.startsWith('[map-prepare]'))console.log(message);});
  await js('window.__TM_MAP_PREP_DIAGNOSTICS=true');
  win.show();win.focus();win.setAlwaysOnTop(true);win.setTitle('天命 · 缩放性能测试（隔离副本）');
  await js(`(async()=>{await TM_Changelog.getUnreadCount();await new Promise(r=>setTimeout(r,600));TM_Changelog.markRead();TM_Changelog.close();const reply=await tianming.loadScenario('地图隔离验收');if(!reply.success)throw Error('fixture-load');_installDesktopScenario(reply.data);P.ai={key:'',url:'',model:''};P.conf=P.conf||{};P.conf.officeActivationEnabled=false;doActualStart(reply.data.id);await TM.Features.ensure('formalMapLabels');TMPhase8FormalBridge.refresh();await document.fonts.ready;for(const b of document.querySelectorAll('#tm-firstturn-guide button,#tm-nokey-banner button'))if(['开始临朝','知道了'].includes(b.textContent))b.click();if(typeof closeSaveManager==='function')closeSaveManager();document.querySelector('.map-scale[data-map-scale="realm"]').click();await new Promise(r=>setTimeout(r,500));})()`);
  await js(`new Promise((resolve,reject)=>{const start=performance.now();function poll(){const status=TMPhase8FormalBridge.map.preparationStatus?.();if(document.querySelector('#tmf-formal-map')&&!TMMapRealmLayout.stats.preparing&&(!status||status.ready&&status.layers===3))resolve();else if(performance.now()-start>25000)reject(Error('map preparation did not finish'));else setTimeout(poll,100);}poll();})`);
  console.log('ZOOM started');const metrics={baseline,sha256:before,runs:[]};
  const identity=await js(`({sid:GM.sid,year:P.time.year,map:TMPhase8FormalBridge.map.getMapData().id,preparation:TMPhase8FormalBridge.map.preparationStatus?.(),stats:TMMapRealmLayout.stats})`);
  assert.equal(identity.sid,source.id);assert.equal(identity.year,source.time?.year??source.startYear);assert.equal(identity.map,(source.mapData?.regions?.length?source.mapData:source.map).id);metrics.identity=identity;
  fs.writeFileSync(path.join(dir,'zoom-metrics.json'),JSON.stringify(metrics,null,2));
  if(process.env.TM_BRIDGE_ZOOM_SIMPLE==='1'){
    const simple=await js(`(async()=>{const rows=[];for(const tier of ['region','prefecture','realm']){document.querySelector('.map-scale[data-map-scale="'+tier+'"]').click();await new Promise(r=>requestAnimationFrame(r));const s=TMPhase8FormalBridge.map.preparationStatus(),svg=document.getElementById('tmf-formal-map'),labels=document.getElementById('tmf-map-labels'),m=svg.querySelector('#tmf-map-world').getScreenCTM(),l=document.getElementById('tmf-label-world').getScreenCTM();rows.push({tier,boundary:svg.querySelector('.tmf-tier-boundaries').dataset.tier,regions:svg.querySelectorAll('.tmf-region').length,labels:labels.querySelectorAll('text.main').length,vector:!labels.closest('.ming-map-camera')&&getComputedStyle(labels).transform==='none',alignment:Math.max(...['a','d','e','f'].map(k=>Math.abs(m[k]-l[k]))),serial:s.serial});}return rows;})()`);
    const sourceMap=source.mapData?.regions?.length?source.mapData:source.map;
    await check('three prepared tiers retain map geometry and independent aligned vector text',async()=>{assert(simple.every(r=>r.tier===r.boundary&&r.regions>0&&r.regions<=sourceMap.regions.length&&r.labels>0&&r.vector&&r.alignment<1),JSON.stringify(simple));assert.equal(new Set(simple.map(r=>r.serial)).size,1);});metrics.simple=simple;
    const at=await js(`(()=>{const b=document.getElementById('ming-map-layer').getBoundingClientRect();return{x:Math.round(b.left+b.width*.55),y:Math.round(b.top+b.height*.5),scale:TMPhase8FormalBridge._state.mapView.scale};})()`);
    win.webContents.sendInputEvent({type:'mouseWheel',x:at.x,y:at.y,deltaX:0,deltaY:50,canScroll:true});await js('new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)))');
    const zoomed=await js('TMPhase8FormalBridge._state.mapView.scale');
    await check('real wheel changes zoom with cached layers',async()=>assert(zoomed>at.scale));
    fs.writeFileSync(path.join(dir,'zoom-final.png'),(await win.webContents.capturePage()).toPNG());
    await check('the original scenario, year and map stay paired and source stays unchanged',async()=>assert.equal(hash(),before));
    fs.writeFileSync(path.join(dir,'zoom-metrics.json'),JSON.stringify(metrics,null,2));return;
  }else{
  const tracing=process.env.TM_BRIDGE_ZOOM_TRACE==='1';
  win.webContents.debugger.attach('1.3');
  if(tracing)await win.webContents.debugger.sendCommand('Tracing.start',{categories:'devtools.timeline,disabled-by-default-devtools.timeline',transferMode:'ReturnAsStream'});
  else{await win.webContents.debugger.sendCommand('Profiler.enable');await win.webContents.debugger.sendCommand('Profiler.start');}
  for(const cold of [true]){
    await js(`document.querySelector('.map-scale[data-map-scale="realm"]').click();`);
    await js('new Promise(r=>setTimeout(r,500))');
    const at=await js(`(()=>{const b=document.getElementById('ming-map-layer').getBoundingClientRect();return{x:Math.round(b.left+b.width/2),y:Math.round(b.top+b.height/2)};})()`);
    await js(`(()=>{window.__zoomProbe={frames:[],last:0,rebuilds:0,scales:[],start:performance.now()};window.__zoomNode=document.querySelector('#tmf-formal-map');window.__zoomObserver=new MutationObserver(()=>{const node=document.querySelector('#tmf-formal-map');if(node!==__zoomNode){__zoomProbe.rebuilds++;__zoomNode=node;}});__zoomObserver.observe(document.getElementById('ming-map-layer'),{childList:true});function tick(t){if(!__zoomProbe.stop){if(__zoomProbe.last)__zoomProbe.frames.push(t-__zoomProbe.last);__zoomProbe.last=t;__zoomProbe.scales.push(TMPhase8FormalBridge._state.mapView.scale);requestAnimationFrame(tick);}}requestAnimationFrame(tick);})()`);
    for(let i=0;i<(tracing?4:process.env.TM_BRIDGE_ZOOM_SHORT==='1'?8:16);i++){
      win.webContents.sendInputEvent({type:'mouseWheel',...at,deltaX:0,deltaY:i<8?50:-50,canScroll:true});
      await js('new Promise(r=>requestAnimationFrame(()=>setTimeout(r,20)))');
    }
    await js('new Promise(r=>setTimeout(r,150))');
    const result=await js(`(()=>{__zoomProbe.stop=true;__zoomObserver.disconnect();const p=__zoomProbe,a=p.frames.slice().sort((a,b)=>a-b),svg=document.querySelector('#tmf-formal-map');return{frames:a.length,median:a[Math.floor(a.length*.5)],p95:a[Math.floor(a.length*.95)],max:Math.max(...a),stalls:a.filter(v=>v>100).length,rebuilds:p.rebuilds,scales:new Set(p.scales.map(v=>v.toFixed(3))).size,tier:TMPhase8FormalBridge._state.mapScale,boundary:svg.querySelector('.tmf-tier-boundaries')?.dataset.tier,regions:svg.querySelectorAll('.tmf-region').length,stats:TMMapRealmLayout.stats};})()`);
    metrics.runs.push({cold,...result});fs.writeFileSync(path.join(dir,'zoom-metrics.json'),JSON.stringify(metrics,null,2));
    if(tracing){
      const complete=new Promise(resolve=>win.webContents.debugger.on('message',(_e,method,params)=>{if(method==='Tracing.tracingComplete')resolve(params);}));
      await win.webContents.debugger.sendCommand('Tracing.end');const {stream}=await complete;let text='';
      for(;;){const chunk=await win.webContents.debugger.sendCommand('IO.read',{handle:stream});text+=chunk.data;if(chunk.eof)break;}
      await win.webContents.debugger.sendCommand('IO.close',{handle:stream});fs.writeFileSync(path.join(dir,'zoom-trace.json'),text);
    }else{const {profile}=await win.webContents.debugger.sendCommand('Profiler.stop');fs.writeFileSync(path.join(dir,'zoom.cpuprofile'),JSON.stringify(profile));}
    win.webContents.debugger.detach();
    await check((cold?'cold':'warm')+' zoom retains geometry, crosses scales and finishes on the correct tier',async()=>{assert.equal(result.regions,575);assert(result.scales>4,JSON.stringify(result));assert.equal(result.tier,result.boundary);});
    if(!baseline)await check((cold?'cold':'warm')+' zoom avoids synchronous tier stalls',async()=>{assert(result.max<350,JSON.stringify(result));assert(result.p95<100,JSON.stringify(result));});
  }
  fs.writeFileSync(path.join(dir,'zoom-final.png'),(await win.webContents.capturePage()).toPNG());
  }
  const mingFile=path.join(__dirname,'../../scenarios/天启七年·九月（官方）.json'),ming=JSON.parse(fs.readFileSync(mingFile,'utf8'));
  fs.copyFileSync(mingFile,path.join(temp,'scenarios','明朝切换验收.json'));
  await js(`(async()=>{const reply=await tianming.loadScenario('明朝切换验收');if(!reply.success)throw Error('ming-load');_installDesktopScenario(reply.data);doActualStart(reply.data.id);await new Promise((resolve,reject)=>{const start=performance.now();function poll(){const s=TMPhase8FormalBridge.map.preparationStatus?.();if(s?.ready&&s.layers===3&&document.querySelector('#tmf-formal-map'))resolve();else if(performance.now()-start>15000)reject(Error('ming-map-prepare'));else setTimeout(poll,100);}poll();});})()`);
  const switched=await js(`({sid:GM.sid,year:P.time.year,regions:document.querySelectorAll('#tmf-formal-map .tmf-region').length,map:TMPhase8FormalBridge.map.getMapData().id,prepared:TMPhase8FormalBridge.map.preparationStatus?.()})`);
  await check('switching from the original Tang scenario to Ming discards the old prepared map',async()=>{assert.equal(switched.sid,ming.id);assert.equal(switched.year,ming.time.year);assert.notEqual(switched.map,identity.map);assert.notEqual(switched.regions,575);assert.equal(switched.prepared.mapId,switched.map);});
  metrics.switched=switched;fs.writeFileSync(path.join(dir,'zoom-metrics.json'),JSON.stringify(metrics,null,2));
  await check('scenario source remains unchanged',async()=>assert.equal(hash(),before));
};
