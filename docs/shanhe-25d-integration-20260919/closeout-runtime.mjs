// Surgical lifecycle fixes; retain all current game edits and the approved art settings.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const root=path.resolve(import.meta.dirname,'../..'),file=path.join(root,'web/tm-shanhe-runtime.js'),before=fs.readFileSync(file,'utf8');let s=before;const changes=[];
function swap(a,b){if(s.split(a).length!==2)throw Error('Source changed: '+a.slice(0,90));s=s.replace(a,b);changes.push(a.slice(0,100));}
swap('let svgWatch=null;','let svgWatch=null,bootPending=false;');
swap("if(ready)return ready;const epoch=++loadEpoch;ready=(async()=>", "if(ready)return ready;const epoch=++loadEpoch;bootPending=true;ready=(async()=>");
swap("canvas=document.createElement('canvas');canvas.className='tmf-shanhe-canvas';canvas.setAttribute('aria-hidden','true');", "const targetCanvas=document.createElement('canvas');targetCanvas.className='tmf-shanhe-canvas';targetCanvas.setAttribute('aria-hidden','true');");
swap('Renderer.create(canvas,root.TM_SHANHE_ENV,urls', 'Renderer.create(targetCanvas,root.TM_SHANHE_ENV,urls');
swap('renderer=r;installCartography(r);', 'canvas=targetCanvas;renderer=r;installCartography(r);');
swap('})().catch(fail);return ready;', '})().catch(fail).finally(()=>{if(epoch===loadEpoch)bootPending=false;});return ready;');
swap('else if(!renderer){ready=null;bootstrap();}', 'else if(!renderer&&!bootPending){ready=null;bootstrap();}');
swap('renderer.setScenario(nativeScenario(map,p));renderer._sceneLayoutCache.size>4&&renderer._sceneLayoutCache.clear();', 'renderer._defer=true;try{renderer.setScenario(nativeScenario(map,p));}finally{renderer._defer=false;}');
swap("function hide(){restore();dirty=true;}","function hide(){restore();dirty=true;}\nfunction invalidate(map){restore();if(map)profiles.delete(map);else if(current?.map)profiles.delete(current.map);records=new WeakMap();labelRecords=new WeakMap();current=null;if(renderer)renderer.nativeCartography=null;dirty=true;labelStamp='';}");
swap('exportDiagnostics,hide,projection,screenToGame', 'exportDiagnostics,hide,invalidate,projection,screenToGame');
swap("version:'B5-native-1',enabled", "version:'B5-native-1.1',enabled");
swap('renderer?.dispose();renderer=null;});', "renderer?.dispose();renderer=null;ready=null;bootPending=false;});\nroot.addEventListener('pageshow',event=>{if(event.persisted){dirty=true;refresh();}});");
const mapfile=path.join(root,'web/phase8-formal-map.js'),mapBefore=fs.readFileSync(mapfile,'utf8');const anchor='bridge.map.invalidateFormalMap = function(){ try { state._lastFormalMapSig = null; _preparedMapLayers = null; } catch(_){} };';
if(mapBefore.split(anchor).length!==2)throw Error('Native invalidation hook changed');const mapAfter=mapBefore.replace(anchor,'bridge.map.invalidateFormalMap = function(){ try { state._lastFormalMapSig = null; _preparedMapLayers = null; if (window.TMShanheRuntime) TMShanheRuntime.invalidate(); } catch(_){} };');
const backup='D:/tianming-assistant-work/shanhe-25d-20260919/closeout-before-'+Date.now();fs.mkdirSync(backup,{recursive:true});fs.writeFileSync(path.join(backup,'tm-shanhe-runtime.js'),before);fs.writeFileSync(path.join(backup,'phase8-formal-map.js'),mapBefore);
if(fs.readFileSync(file,'utf8')!==before||fs.readFileSync(mapfile,'utf8')!==mapBefore)throw Error('Concurrent source change; nothing installed');
fs.writeFileSync(file,s);fs.writeFileSync(mapfile,mapAfter);const sha=x=>crypto.createHash('sha256').update(x).digest('hex');
fs.writeFileSync(path.join(import.meta.dirname,'closeout-runtime-patch.json'),JSON.stringify({backup,changes,files:[{file,before:sha(before),after:sha(s)},{file:mapfile,before:sha(mapBefore),after:sha(mapAfter)}]},null,2));console.log('Lifecycle, deferred initial build and geometry invalidation updated; no art quality reduction.');
