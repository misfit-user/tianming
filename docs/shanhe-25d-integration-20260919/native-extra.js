// Additional checks in the isolated, real game page. Does not access personal saves or APIs.
(async()=>{
 const checks=[],test=(name,pass,detail)=>{checks.push({name,passed:!!pass,detail});if(!pass)throw Error(name+': '+JSON.stringify(detail));},pause=ms=>new Promise(r=>setTimeout(r,ms));
 async function ready(){const start=performance.now();while(true){const d=TMShanheRuntime.diagnostics(),p=TMPhase8FormalBridge.map.preparationStatus();if(d.active&&(!p||p.ready)&&d.errors.length===0)return d;if(performance.now()-start>90000)throw Error('Map update timeout');await pause(200);}}
 function glInfo(){const g=document.querySelector('.tmf-shanhe-canvas')?.getContext('webgl2'),e=g?.getExtension('WEBGL_debug_renderer_info');return g?{error:g.getError(),renderer:e?g.getParameter(e.UNMASKED_RENDERER_WEBGL):g.getParameter(g.RENDERER),vendor:e?g.getParameter(e.UNMASKED_VENDOR_WEBGL):g.getParameter(g.VENDOR)}:null;}
 const originalMap=GM.mapData,identity=originalMap.regions.map(r=>r.id).join('|');const before=await ready();
 for(const mode of ['mood','classPressure','tax','army','office','yizheng','owner']){
  const b=document.querySelector('.map-layer[data-map-mode="'+mode+'"]');test('existing-mode-button-'+mode,!!b);b.click();await pause(300);const d=await ready();
  test('native-mode-'+mode,TMPhase8FormalBridge.__p8MapParts.state.mapMode===mode&&d.active&&d.regions===originalMap.regions.length,{labels:d.visibleLabels,frame:d.frame,gl:glInfo()});
 }
 const freeze=TMShanheRuntime.diagnostics();for(let i=0;i<3;i++)TMPhase8FormalBridge.map.renderFormalMap();await pause(180);const idle=TMShanheRuntime.diagnostics();test('unchanged-refresh-does-not-rebuild',JSON.stringify(freeze.stats.work)===JSON.stringify(idle.stats.work),{before:freeze.stats.work,after:idle.stats.work});
 const loads=Array.from(document.scripts).filter(s=>/vendor\/shanhe25d\/(engine|environment)\.js/.test(s.src)).length;TMShanheRuntime.setEnabled(false);TMShanheRuntime.setEnabled(true);TMShanheRuntime.setEnabled(false);TMShanheRuntime.setEnabled(true);await pause(500);await ready();test('rapid-toggle-one-canvas',document.querySelectorAll('.tmf-shanhe-canvas').length===1);test('rapid-toggle-no-duplicate-library',Array.from(document.scripts).filter(s=>/vendor\/shanhe25d\/(engine|environment)\.js/.test(s.src)).length===loads);
 TMPhase8FormalBridge.map.invalidateFormalMap();TMPhase8FormalBridge.map.renderFormalMap();await pause(500);const invalidated=await ready();test('geometry-invalidation-rebuilds-current-map',invalidated.active&&invalidated.mapId===originalMap.id&&GM.mapData.regions.map(r=>r.id).join('|')===identity);
 if(GM.sid==='sc-tianqi7-1627'){
  const region=GM.mapData.regions.find(r=>r.name==='保定府'),enemy=GM.facs.find(f=>f.name==='后金'),owner=region.owner;
  const node=()=>Array.from(document.querySelectorAll('#tmf-formal-map .tmf-region')).find(n=>n.dataset.regionId===region.id);const oldFill=node()?.getAttribute('fill'),oldUploads=TMShanheRuntime.diagnostics().stats.work.overlayUploads;
  try{TM.FactionMembership.assignProvince(region.id,enemy.id,{silent:true});TMPhase8FormalBridge.map.refreshMapFromRuntime();await pause(500);const transferred=await ready();test('live-owner-change-reaches-draped-layer',region.owner===enemy.id&&node()?.getAttribute('fill')!==oldFill&&transferred.stats.work.overlayUploads>oldUploads,{oldFill,newFill:node()?.getAttribute('fill'),oldUploads,newUploads:transferred.stats.work.overlayUploads});}
  finally{TM.FactionMembership.assignProvince(region.id,owner,{silent:true});TMPhase8FormalBridge.map.refreshMapFromRuntime();await pause(500);await ready();}test('live-owner-recapture-restored',region.owner===owner&&node()?.getAttribute('fill')===oldFill);
 }
 const gl=glInfo();test('webgl-command-stream-valid',gl&&gl.error===0,gl);return {checks,passed:checks.filter(x=>x.passed).length,failed:checks.filter(x=>!x.passed).length,gpu:gl};
})()
