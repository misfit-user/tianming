'use strict';
// Focused native CSS regression: production styles, split text layer and LOD.
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'..');
if(!process.versions.electron){
  fs.mkdirSync(path.join(root,'_codex_tmp'),{recursive:true});
  const out=fs.mkdtempSync(path.join(root,'_codex_tmp/prefecture-labels-'));
  const env={...process.env,TEMP:out,TMP:out,TM_LABEL_TEST_DIR:out};delete env.ELECTRON_RUN_AS_NODE;
  const run=cp.spawnSync(require('electron'),[__filename],{cwd:root,env,windowsHide:true,encoding:'utf8',timeout:25000,maxBuffer:1024*1024});
  console.log(run.stdout||'');if(run.status!==0)console.error(run.stderr||run.error||'native process failed');
  console.log('REPORT '+path.join(out,'report.json'));process.exitCode=run.status===0&&!run.error?0:1;
}else{
  const {app,BrowserWindow,session}=require('electron'),{pathToFileURL}=require('url'),assert=require('assert/strict');
  const out=process.env.TM_LABEL_TEST_DIR;
  app.setPath('userData',path.join(out,'profile'));app.setPath('sessionData',path.join(out,'session'));
  let win;const report={ok:false,rows:[]},deadline=setTimeout(()=>finish(Error('label visibility timeout')),20000);
  function finish(error){clearTimeout(deadline);if(error)report.error=String(error.stack||error);fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report));if(win&&!win.isDestroyed())win.destroy();app.exit(report.ok?0:1);}
  app.whenReady().then(async()=>{
    session.defaultSession.webRequest.onBeforeRequest({urls:['https://*/*','http://*/*']},(_r,done)=>done({cancel:true}));
    const style=pathToFileURL(path.join(root,'web/phase8-formal-bridge-styles.js')).href;
    const collide=pathToFileURL(path.join(root,'web/tm-map-label-collide.js')).href;
    const label=(name,x,fs)=>'<g class="ming-label tmf-region-label tmf-territory-fit" data-fs="'+fs+'" data-lw="40" data-lh="18" data-ax="'+x+'" data-ay="60" data-pr="'+fs+'" style="--realm-label-size:'+fs+'px" transform="translate('+x+' 60)"><text class="main">'+name+'</text></g>';
    const fixture=path.join(out,'fixture.html');
    fs.writeFileSync(fixture,'<!doctype html><meta charset="utf-8"><body class="tm-phase8-formal tm-phase8-game-active"><div id="mapwrap" data-map-scale="prefecture"><div id="ming-map-layer"><svg id="tmf-map-labels" class="ming-map-svg tmf-map-label-overlay" viewBox="0 0 300 120">'+label('府州甲',60,16)+label('府州乙',220,16)+label('过小地名',150,1)+'</svg></div></div><script src="'+style+'"></script><script src="'+collide+'"></script><script>TM.__p8BridgeParts.installStyles();</script></body>');
    win=new BrowserWindow({show:false,width:800,height:600,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});await win.loadFile(fixture);
    report.rows=await win.webContents.executeJavaScript(`(()=>{
      const map=document.getElementById('mapwrap'),stage=document.getElementById('ming-map-layer');
      return ['region','prefecture','realm','prefecture'].map(tier=>{
        map.dataset.mapScale=tier;TMMapLabelCollide.resolve(stage,1,tier,{minPx:3,pad:.5});
        for(const animation of document.getAnimations())animation.finish();
        return {tier,labels:Array.from(stage.querySelectorAll('.tmf-region-label')).map(g=>({name:g.textContent,hidden:g.classList.contains('tmf-collide-hidden'),opacity:Number(getComputedStyle(g).opacity)}))};
      });
    })()`);
    for(const row of report.rows){
      if(row.tier==='realm')assert(row.labels.every(g=>g.hidden&&g.opacity===0),'realm does not leak regional labels');
      else{assert(row.labels.slice(0,2).every(g=>!g.hidden&&g.opacity>0),row.tier+' hides readable region names');assert(row.labels[2].hidden&&row.labels[2].opacity===0,'small-label LOD still wins');}
    }
    report.ok=true;finish();
  }).catch(finish);
}
