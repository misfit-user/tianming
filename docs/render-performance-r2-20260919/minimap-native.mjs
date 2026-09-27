import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import { fileURLToPath } from 'node:url';
const work=path.dirname(fileURLToPath(import.meta.url));
for(const key of ['userData','sessionData']){const p=path.join(work,'minimap-isolated-'+key);fs.mkdirSync(p,{recursive:true});app.setPath(key,p);}
const report={variants:{},checks:[],complete:false};let win;
const timeout=setTimeout(()=>{console.error('Minimap test timeout');app.exit(1);},90000);
const digest=x=>crypto.createHash('sha256').update(x).digest('hex');
function fixture(){
 document.body.innerHTML='<div class="me-stage"></div>';
 window.__ticks=[];window.__frames=[];window.__counts={};
 window.setInterval=fn=>{__ticks.push(fn);return __ticks.length;};
 window.requestAnimationFrame=fn=>{__frames.push(fn);return __frames.length;};
 window.flush=()=>{let n=0;while(__frames.length){if(n++>50)throw Error('frame loop');__frames.splice(0).forEach(fn=>fn());}};
 for(const key of ['fill','fillRect','lineTo','drawImage']){const original=CanvasRenderingContext2D.prototype[key];CanvasRenderingContext2D.prototype[key]=function(...a){__counts[key]=(__counts[key]||0)+1;return original.apply(this,a);};}
 const divisions=Array.from({length:300},(_,i)=>{const x=(i%20)*60,y=Math.floor(i/20)*48;return{id:'r'+i,bbox:{x,y,w:50,h:40},polygon:[[x,y],[x+50,y],[x+50,y+40],[x,y+40]],colorKey:0x657849};});
 const listeners={},canvas=document.createElement('canvas');canvas.width=800;canvas.height=600;
 const me={EDITOR:{map:{bitmapWidth:1280,bitmapHeight:800,divisions},camera:{x:0,y:0,zoom:1},canvas,selectedIds:new Set()},requestRender(){},on(k,fn){(listeners[k]||=[]).push(fn);},fire(k){(listeners[k]||[]).forEach(fn=>fn());}};
 window.TM={MapEditor:me};window.tick=n=>{for(let i=0;i<n;i++)__ticks.forEach(fn=>fn());flush();};
 window.shot=()=>document.querySelector('#me-minimap canvas').toDataURL();
}
app.on('window-all-closed',()=>{});
app.whenReady().then(async()=>{
 try{
  for(const [name,file] of [['before','web__map-editor-minimap.js.before'],['candidate','minimap-current.js']]){
   win=new BrowserWindow({width:900,height:700,show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
   await win.loadURL('about:blank');const js=s=>win.webContents.executeJavaScript(s,true);
   await js('('+fixture.toString()+')()');await js(fs.readFileSync(path.join(work,file),'utf8'));
   await js('TM.MapEditor.minimap.init();flush()');const result={images:{initial:digest(await js('shot()'))}};
   result.idle=await js('(()=>{__counts={};const t=performance.now();tick(60);return{counts:__counts,ms:performance.now()-t};})()');result.images.idle=digest(await js('shot()'));
   result.pan=await js('(()=>{__counts={};const t=performance.now();for(let i=0;i<30;i++){TM.MapEditor.EDITOR.camera.x-=3;tick(1);}return{counts:__counts,ms:performance.now()-t};})()');result.images.pan=digest(await js('shot()'));
   const cases={
    selection:"TM.MapEditor.EDITOR.selectedIds.add('r25');TM.MapEditor.fire('selection-change');flush()",
    mutation:"TM.MapEditor.EDITOR.map.divisions[24].colorKey=0xaa2211;TM.MapEditor.fire('mutation');flush()",
    resize:"TM.MapEditor.EDITOR.canvas.width=1000;tick(1)",
    mapReplacement:"TM.MapEditor.EDITOR.map={bitmapWidth:1500,bitmapHeight:900,divisions:[{id:'new',bbox:{x:20,y:30,w:800,h:700},polygon:[[20,30],[820,30],[820,730],[20,730]],colorKey:0x884411}]};TM.MapEditor.fire('map-loaded');flush()",
    foldedMutation:"TM.MapEditor.minimap.setEnabled(false);TM.MapEditor.EDITOR.map.divisions[0].colorKey=0x2266cc;TM.MapEditor.fire('mutation');tick(3);TM.MapEditor.minimap.setEnabled(true);flush();tick(1)",
    repeatedForce:"TM.MapEditor.EDITOR.map.divisions[0].colorKey=0x992277;TM.MapEditor.minimap.render();TM.MapEditor.minimap.render()"
   };
   for(const [label,code] of Object.entries(cases)){await js(code);result.images[label]=digest(await js('shot()'));}
   result.hidden=await js("(()=>{TM.MapEditor.minimap.setEnabled(false);__counts={};tick(20);return __counts;})()");
   report.variants[name]=result;win.destroy();win=null;
  }
  const a=report.variants.before,b=report.variants.candidate;
  for(const label of Object.keys(a.images))report.checks.push({name:'pixel-identical-'+label,passed:a.images[label]===b.images[label]});
  report.checks.push({name:'idle-zero-draws',passed:Object.keys(b.idle.counts).length===0});
  report.checks.push({name:'pan-reuses-geometric-base',passed:(b.pan.counts.fill||0)===0&&(b.pan.counts.drawImage||0)===30});
  report.checks.push({name:'folded-zero-draws',passed:Object.keys(b.hidden).length===0});
  report.complete=true;report.passed=report.checks.every(c=>c.passed);console.log(JSON.stringify(report,null,2));
 }catch(e){report.error=String(e.stack||e);console.error(report.error);}
 finally{clearTimeout(timeout);fs.writeFileSync(path.join(work,'minimap-native-report.json'),JSON.stringify(report,null,2));if(win&&!win.isDestroyed())win.destroy();app.exit(report.passed?0:1);}
});
