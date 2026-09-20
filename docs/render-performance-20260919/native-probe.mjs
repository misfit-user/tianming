// Isolated, offline probe of the installed game. Never reads the player's saves or API settings.
import { app, BrowserWindow } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const work = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(work, '../..');
const tag = process.env.TM_RENDER_PROBE_TAG || 'before';
if (!/^[a-z0-9-]+$/.test(tag)) throw Error('Invalid tag');
const dir = path.join(work, tag); fs.mkdirSync(dir, { recursive: true });
for (const key of ['userData', 'sessionData']) { const p = path.join(dir, key); fs.mkdirSync(p, { recursive: true }); app.setPath(key, p); }
const report = { started: new Date().toISOString(), complete: false, steps: [], errors: [] };
let win, finished = false; const started = Date.now();
function save() { fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(report, null, 2)); }
function mark(name, data = {}) { report.steps.push({ name, ms: Date.now() - started, ...data }); save(); console.log(name, JSON.stringify(data)); }
function finish(code, error) { if (finished) return; finished = true; clearTimeout(deadline); report.code = code; report.error = error; try { save(); } catch (writeError) { console.error('Report write failed:', String(writeError)); } finally { if (win && !win.isDestroyed()) win.destroy(); app.exit(code); } }
const deadline = setTimeout(() => finish(1, 'Probe deadline exceeded'), 180000);
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
app.whenReady().then(async () => {
  report.gpu = app.getGPUFeatureStatus();
  win = new BrowserWindow({ width: 1600, height: 1000, show: false, webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true, backgroundThrottling: false } });
  win.webContents.session.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (_, callback) => callback({ cancel: true }));
  win.webContents.on('render-process-gone', (_, detail) => finish(1, JSON.stringify(detail)));
  win.webContents.on('console-message', (_, level, message) => { if (level >= 3 && report.errors.length < 15) report.errors.push(String(message).slice(0, 350)); });
  const js = source => win.webContents.executeJavaScript(source, true);
  try {
    await win.loadFile(path.join(root, 'web/index.html')); mark('page-loaded');
    const scenarioName = process.env.TM_RENDER_PROBE_SCENARIO || '绍宋·建炎元年八月（官方）.json';
    if (path.basename(scenarioName) !== scenarioName) throw Error('Invalid scenario');
    const scenario = JSON.parse(fs.readFileSync(path.join(root, 'scenarios', scenarioName), 'utf8'));
    const sid = scenario.id; report.scenario = scenarioName;
    await js(`(async()=>{P.ai={key:'',url:'',model:''};P.conf=P.conf||{};P.conf.officeActivationEnabled=false;await TMOfficialScenarioLoader.ready();await TMOfficialScenarioLoader.ensure(${JSON.stringify(sid)});await TM.Features.ensure('formalMapLabels');})()`);
    mark('scenario-loaded', { sid });
    await js(`(()=>{window.__renderProbe={calls:{},ms:{}};const p=window.__renderProbe;function wrap(o,k,label){if(!o||typeof o[k]!=='function')return;const f=o[k];o[k]=function(...a){const t=performance.now();try{return f.apply(this,a)}finally{p.calls[label]=(p.calls[label]||0)+1;p.ms[label]=(p.ms[label]||0)+performance.now()-t}}}for(const k of ['region','fit','boundaryMesh','prepare'])wrap(TMMapRealmLayout,k,k);wrap(window.TMMapRuntime,'getMap','getMap');})()`);
    await js(`doActualStart(${JSON.stringify(sid)})`); mark('start-returned');
    await js(`TMPhase8FormalBridge.refresh()`);
    let state, readyAt = Date.now();
    do { state = await js(`({running:GM.running,paths:document.querySelectorAll('#tmf-formal-map .tmf-region').length,regions:GM.mapData?.regions?.length,preparing:TMMapRealmLayout.stats.preparing,message:document.getElementById('ming-map-layer')?.innerText?.slice(0,100)})`); if (state.paths > 0 && !state.preparing) break; if (Date.now()-readyAt>110000) throw Error('Map readiness timeout: '+JSON.stringify(state)); await sleep(500); } while (!finished);
    report.ready = state; report.preparation = await js(`({profile:__renderProbe,stats:TMMapRealmLayout.stats})`); mark('map-ready', state);
    await sleep(500); report.gpuAfterReady = app.getGPUFeatureStatus();
    win.webContents.debugger.attach('1.3'); await win.webContents.debugger.sendCommand('Profiler.enable'); await win.webContents.debugger.sendCommand('Profiler.start');
    report.refresh = await js(`(()=>{const p=__renderProbe;p.calls={};p.ms={};const stage=document.getElementById('ming-map-layer'),world=document.getElementById('tmf-map-world'),observer=new MutationObserver(()=>{});observer.observe(document.getElementById('mapwrap'),{subtree:true,childList:true,attributes:true});const times=[];for(let i=0;i<12;i++){const t=performance.now();TMPhase8FormalBridge.map.renderFormalMap();times.push(performance.now()-t)}const mutations=observer.takeRecords();observer.disconnect();return{times,profile:p,stats:TMMapRealmLayout.stats,retained:world===document.getElementById('tmf-map-world'),mutationRecords:mutations.length,childListMutations:mutations.filter(m=>m.type==='childList').length,canvasCount:stage.querySelectorAll('canvas').length,pathCount:stage.querySelectorAll('path').length,svgBytes:stage.innerHTML.length}})()`);
    const cpu = await win.webContents.debugger.sendCommand('Profiler.stop'); fs.writeFileSync(path.join(dir, 'refresh.cpuprofile'), JSON.stringify(cpu.profile)); win.webContents.debugger.detach();
    mark('refresh-measured', report.refresh);
    report.complete = true; mark('complete'); finish(0);
  } catch (error) { mark('failed', { error: String(error.stack || error) }); finish(1, String(error.stack || error)); }
}).catch(error => finish(1, String(error.stack || error)));
