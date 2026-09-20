'use strict';
// Real production entry, preload and IPC. Only test ownership (temporary userData),
// presentation and external-network denial are injected. No renderer bridge substitute.
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const { app, session, net } = require('electron');
const root = process.env.TM_BRIDGE_TEST_ROOT;
const mode = process.env.TM_BRIDGE_TEST_MODE;
const baseline = process.env.TM_BRIDGE_TEST_BASELINE === '1';
const visiblePerformance = mode === 'performance' || mode === 'performance-inspect' || mode === 'performance-autosave' || mode === 'performance-panels';
const visibleWindow = mode === 'shanhe-map' || mode === 'authoring-efficiency' || mode.indexOf('native-start-') === 0 || mode === 'map-tiers' || mode === 'startup-mode' || mode === 'strategic-map' || mode === 'tactical-units' || mode === 'tactical-phase2' || mode === 'tactical-terrain' || mode === 'personal-campaign' || mode === 'startup-autosave' || mode === 'office-writeback' || mode === 'seven-ui' || mode === 'authoring-autoapply' || mode === 'player-feedback' || mode === 'workshop-hierarchy' || mode === 'authoring-continuation' || mode === 'memorial-reading' || visiblePerformance || mode === 'building-appraisal' || mode === 'edict-polish' || mode === 'edict-clarity' || mode === 'character-actions' || mode === 'rail-badges' || mode === 'relief-pilot' || mode === 'relief-inspect' || mode === 'authoring-stream' || mode === 'authoring-boundaries' || mode === 'authoring-recovery';
process.env.NODE_PATH = path.resolve(__dirname, '../../node_modules'); require('module').Module._initPaths();
if (mode === 'test-exports') process.env.TIANMING_TEST_EXPORTS = '1'; else delete process.env.TIANMING_TEST_EXPORTS;
const temp = process.env.TM_BRIDGE_TEST_USERDATA || fs.mkdtempSync(path.join(os.tmpdir(), 'tm-bridge-gate-'));
app.setPath('userData', temp); app.setPath('sessionData', path.join(temp, 'session')); app.getAppPath = () => root;
const deny = () => { throw new Error('test-external-network-denied'); };
for (const name of ['http', 'https']) { require(name).request = deny; require(name).get = deny; }
net.request = deny; net.fetch = deny; global.fetch = deny;
const results = [], failures = [];
const bridgeStartedAt = Date.now();
const controls = {};
let performanceReport;
const windowOptions = [];
// Electron 33's getLastWebPreferences omits preload. Observe, do not alter, the
// options sent by production createWindow to the real native constructor.
const Module = require('module'), load = Module._load;
const nativeElectron = require('electron');
const observedElectron = new Proxy(nativeElectron, { get(target, key) {
  if (key === 'ipcMain') return new Proxy(target.ipcMain, { get(ipc, method) {
    if (method !== 'handle') return typeof ipc[method] === 'function' ? ipc[method].bind(ipc) : ipc[method];
    return (channel, handler) => ipc.handle(channel, async (...args) => {
      const result = await handler(...args); // real trusted sender check and implementation
      if (channel === 'load-auto-save' && mode === 'startup-autosave') controls.startupAutoSaveReads = (controls.startupAutoSaveReads || 0) + 1;
      if (channel === 'save-project' && controls.saveGate) { controls.saveArrived = true; await controls.saveGate; }
      return result;
    });
  } });
  if (key === 'dialog') return new Proxy(target.dialog, { get(dialog, method) {
    if (method === 'showOpenDialog' && controls.openDialog) return async () => controls.openDialog;
    if (method === 'showSaveDialog' && controls.saveDialog) return async () => controls.saveDialog;
    return typeof dialog[method] === 'function' ? dialog[method].bind(dialog) : dialog[method];
  } });
  if (key !== 'BrowserWindow') return target[key];
  return new Proxy(target.BrowserWindow, { construct(Window, args) {
    if (visibleWindow) args[0] = { ...args[0], width: 1280, height: 800, fullscreen: false, show: true, alwaysOnTop: true, webPreferences: { ...args[0].webPreferences, backgroundThrottling: false } }; // UI gates must not wait for a ready-to-show event bypassed by test navigation.
    windowOptions.push(args[0]); return Reflect.construct(Window, args);
  } });
} });
Module._load = function(request, parent, ...rest) {
  if (request === 'electron' && parent && parent.filename === path.join(root, 'main-impl.js')) return observedElectron;
  if (request === './main-json-file.js' && parent && parent.filename === path.join(root, 'main-impl.js')) {
    const actual = load.call(this, request, parent, ...rest);
    return { ...actual, readJsonFileOffMainThread(file, options) {
      return actual.readJsonFileOffMainThread(file, { ...options, ...controls.importOptions });
    } };
  }
  return load.call(this, request, parent, ...rest);
};
let finished = false;
function finish(error) {
  if (finished) return; finished = true;
  if (error) failures.push(String(error.stack || error));
  const report = { complete: true, ok: failures.length === 0, mode, baseline, versions: process.versions, results, failures,
    timing: { startedAt: new Date(bridgeStartedAt).toISOString(), assertionsFinishedAt: new Date().toISOString(), elapsedMs: Date.now()-bridgeStartedAt, nodeUptimeSeconds: process.uptime() },
    securityScope: 'real unpackaged production main/preload; '+(visibleWindow ? 'visible' : 'hidden')+' window; temporary userData; '+(mode==='native-start-live-authoring'?'configured-provider-only test transport; selected local API configuration read-only; synthetic world, no player saves':'external network denied; '+(mode === 'authoring-regions' && process.env.TM_AUTHORING_REGION_FIXTURE ? 'read-only user-supplied scenario clone' : 'no player data')),
    temporaryUserData: temp, performance: performanceReport };
  const reportText=JSON.stringify(report,null,2)+'\n';
  fs.writeFileSync(process.env.TM_BRIDGE_TEST_REPORT, mode==='native-start-live-authoring'&&global.__tmNativeLiveAcceptance ? global.__tmNativeLiveAcceptance.redact(reportText) : reportText);
  process.stdout.write('BRIDGE_EXIT_REQUESTED '+JSON.stringify({mode,at:new Date().toISOString(),code:report.ok?0:1})+'\n');
  // This exits the disposable gate process, not the application's production quit path.
  app.exit(report.ok ? 0 : 1);
}
async function check(name, fn) { const started=Date.now(); console.log('BRIDGE_CASE_START '+JSON.stringify({name,at:new Date(started).toISOString()})); await profileHeavyCase(name); await fn(); results.push({ name, status: 'PASS' }); console.log('BRIDGE_CASE_PASS '+JSON.stringify({name,elapsedMs:Date.now()-started})); }
// These correctness suites contain many bounded UI scenarios; keep each scenario wait and all explicit performance assertions unchanged.
const multiScenarioAuthoring = ['authoring-boundaries','authoring-continuation','authoring-autoapply','authoring-efficiency'].includes(mode);
setTimeout(() => finish(new Error('electron-bridge-timeout')), (multiScenarioAuthoring && mode === 'authoring-efficiency') || mode === 'relief-pilot' ? 600000 : multiScenarioAuthoring ? 180000 : mode === 'strategic-map' ? 600000 : mode === 'shanhe-map' ? 135000 : mode === 'native-start-live-authoring' ? 570000 : mode === 'performance-inspect' || mode === 'relief-inspect' ? 1800000 : mode === 'relief-pilot' || mode === 'native-start-neutral-atlas' ? 180000 : visiblePerformance ? 240000 : 75000);
process.on('uncaughtException', finish); process.on('unhandledRejection', finish);
process.on('exit', code => { if (finished) process.stdout.write('BRIDGE_NODE_EXIT '+JSON.stringify({mode,at:new Date().toISOString(),code})+'\n'); });
app.on('browser-window-created', (_event, win) => {
  if (!visibleWindow) win.show = () => {};
  win.setFullScreen = () => {};
  win.webContents.on('console-message',(_e,level,message)=>{if(/^RELIEF_DIGEST_/.test(message))fs.appendFileSync(path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),'digest-progress.log'),new Date().toISOString()+' '+message+'\n');if(/^RELIEF_|^STRATEGIC_/.test(message)||level>=3)console.log('BRIDGE_RENDER_DIAG '+String(message).slice(0,2200));});
  win.webContents.on('preload-error', (_event, file, error) => finish(new Error('production-preload-failed: ' + file + ': ' + error.message)));
  win.webContents.on('render-process-gone', (_event, details) => finish(new Error('render-process-gone: ' + JSON.stringify(details))));
  win.webContents.on('did-fail-load', (_event, code, description, url, mainFrame) => { if (mainFrame) finish(new Error('did-fail-load: ' + code + ' ' + description + ' ' + url)); });
  win.webContents.once('did-finish-load', async () => {
    try {
      await check('locked-electron-runtime', () => assert.equal(process.versions.electron, require(path.resolve(__dirname, '../../package-lock.json')).packages['node_modules/electron'].version));
      await check('production-webpreferences', () => {
        const p = win.webContents.getLastWebPreferences();
        assert.equal(p.sandbox, true); assert.equal(p.contextIsolation, true); assert.equal(p.nodeIntegration, false);
        const configured = windowOptions[0].webPreferences;
        assert.equal(configured.sandbox, true); assert.equal(configured.contextIsolation, true); assert.equal(configured.nodeIntegration, false);
        assert.equal(path.dirname(configured.preload), root);
        if (!baseline) assert.equal(path.basename(configured.preload), 'preload-impl.js');
        assert.equal(app.commandLine.hasSwitch('no-sandbox'), false);
      });
      await check('real-bridge-and-ipc', async () => {
        const bridge = await win.webContents.executeJavaScript(`(async () => {
          const b = window.tianming;
          return { exists: !!b, desktop: b && b.isDesktop, protocol: b && b.turnDataProtocolVersion,
            saves: b && await b.listSaves(), info: b && await b.getAppInfo(),
            leaked: [typeof window.require, typeof window.ipcRenderer, typeof window.fs, typeof window.process,
              b && typeof b.require, b && typeof b.ipcRenderer, b && typeof b.fs] };
        })()`);
        assert.equal(bridge.exists, true); assert.equal(bridge.desktop, true);
        assert.equal(bridge.saves.success, true); assert.ok(Array.isArray(bridge.saves.files));
        assert.ok(bridge.info && typeof bridge.info.version === 'string');
        assert.deepEqual(bridge.leaked, Array(7).fill('undefined'));
        if (!baseline) assert.equal(bridge.protocol, 2);
        results.push({ name: 'observed-turn-data-protocol', value: bridge.protocol === undefined ? null : bridge.protocol, status: 'PASS', required: baseline ? 'bridge-only baseline; no v2 claim' : 2 });
      });
      await check('production-test-exports-boundary', () => {
        const exports = require(path.join(root, 'main-impl.js'));
        assert.equal(!!exports.__test, mode === 'test-exports');
      });
      if (mode === 'performance') performanceReport = await require('../perf/round1-electron-cases.cjs')({ win, root, temp, controls, check, recordPerformance: report => { performanceReport = report; } });
      else if (mode === 'performance-inspect') performanceReport = await require('../perf/inspect-electron-cases.cjs')({ win, root, temp, check });
      else if (mode === 'performance-autosave') performanceReport = await require('../perf/autosave-electron-cases.cjs')({ win, root, temp, check, recordPerformance: report => { performanceReport = report; } });
      else if (mode === 'performance-panels') performanceReport = await require('../perf/panels-electron-cases.cjs')({ win, root, temp, check, recordPerformance: report => { performanceReport = report; } });
      else if (mode === 'building-appraisal') await require('./building-appraisal-cases.cjs')({ win, temp, check });
      else if (mode === 'edict-polish') await require('./edict-polish-cases.cjs')({ win, temp, check });
      else if (mode === 'edict-clarity') await require('./edict-clarity-cases.cjs')({ win, check });
      else if (mode === 'memorial-reading') await require('./memorial-reading-cases.cjs')({ win, check });
      else if (mode === 'character-actions') await require('./character-actions-cases.cjs')({ win, check });
      else if (mode === 'rail-badges') await require('./rail-badges-cases.cjs')({ win, check });
      else if (mode === 'player-feedback') await require('./player-feedback-cases.cjs')({ win, check });
      else if (mode === 'authoring-regions') await require('./authoring-region-cases.cjs')({ win, root, temp, check });
      else if (mode === 'workshop-hierarchy') await require('./workshop-hierarchy-cases.cjs')({ win, root, temp, check });
      else if (mode === 'authoring-stream') await require('./authoring-stream-cases.cjs')({ win, root, temp, check });
      else if (mode === 'authoring-boundaries') await require('./authoring-boundary-cases.cjs')({ win, root, temp, check });
      else if (mode === 'authoring-recovery') await require('./authoring-recovery-cases.cjs')({ win, root, temp, check });
      else if (mode === 'authoring-continuation') await require('./authoring-continuation-cases.cjs')({ win, root, temp, check });
      else if (mode === 'authoring-autoapply') await require('./authoring-autoapply-cases.cjs')({ win, root, temp, check });
      else if (mode === 'seven-ui') await require('./seven-ui-cases.cjs')({ win, root, temp, check });
      else if (mode === 'native-start-entry' || mode === 'native-start-restart') await require('./native-start-entry-cases.cjs')({ win, root, temp, check, results, mode });
      else if (mode === 'native-start-workbench-assets' || mode === 'native-start-workbench-restart') await require('./native-workbench-asset-cases.cjs')({ win, root, temp, check, results, mode });
      else if (mode === 'native-start-workbench-flow') await require('./native-workbench-flow-cases.cjs')({ win, root, temp, check, results, controls });
      else if (mode === 'native-start-workbench-permissions') await require('./native-workbench-permission-cases.cjs')({ win, root, temp, check, results, controls });
      else if (mode === 'native-start-map-hits') await require('./native-map-hit-cases.cjs')({ win, root, temp, check, results, controls });
      else if (mode.indexOf('native-start-legacy-') === 0) await require('./native-legacy-official-cases.cjs')({ win, root, temp, check, results, controls, mode });
      else if (mode === 'native-start-neutral-atlas') await require('./native-neutral-atlas-cases.cjs')({ win, root, temp, check, results, controls, mode });
      else if (mode === 'native-start-live-authoring') await require('./native-live-authoring-cases.cjs')({ win, root, temp, check, results, controls, mode });
      else if (mode === 'native-start-workbench-tasks' || mode === 'native-start-workbench-tasks-restart') await require('./native-workbench-task-cases.cjs')({ win, root, temp, check, results, mode });
      else if (mode === 'native-start-faults') await require('./native-start-fault-cases.cjs')({ win, root, temp, check, results });
      else if (mode === 'native-start-preparation') await require('./native-start-preparation-cases.cjs')({ win, root, temp, check, results });
      else if (mode === 'native-start-core') await require('./native-start-core-cases.cjs')({ win, root, temp, check, results });
      else if (mode === 'native-start-isolation') await require('./native-start-isolation-cases.cjs')({ win, root, temp, check, results });
      else if (mode === 'office-writeback') await require('./office-writeback-cases.cjs')({ win, root, temp, check });
      else if (mode === 'startup-autosave') await require('./startup-autosave-cases.cjs')({ win, root, temp, controls, check });
      else if (mode === 'personal-campaign') await require('./personal-campaign-cases.cjs')({ win, root, temp, check });
      else if (mode === 'tactical-terrain') await require('./tactical-terrain-cases.cjs')({ win, root, temp, check });
      else if (mode === 'tactical-phase2') await require('./tactical-terrain-cases.cjs')({ win, root, temp, check, phase2: true });
      else if (mode === 'tactical-units') await require('./tactical-units-cases.cjs')({ win, root, temp, check });
      else if (mode === 'shanhe-map') await require('./shanhe-default-cases.cjs')({win,root,check});
      else if (mode === 'strategic-map') await require('./strategic-map-cases.cjs')({ win, root, temp, check, baseline });
      else if (mode === 'map-tiers') await require('./map-tier-cases.cjs')({ win, root, temp, check, baseline });
      else if (mode === 'startup-mode') await require('./startup-mode-cases.cjs')({ win, root, temp, check, baseline });
      else if (mode === 'authoring-efficiency') await require('./authoring-efficiency-cases.cjs')({ win, root, temp, check });
      else if (mode === 'relief-pilot' || mode === 'relief-inspect') await require('./relief-pilot-cases.cjs')({ win, root, temp, check, mode });
      else if (!baseline) await require('./desktop-cases.cjs')({ win, root, temp, mode, controls, check });
      finish();
    } catch (error) { finish(error); }
  });
});
app.whenReady().then(() => session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true })));
require(path.join(root, 'main.js'));

async function profileHeavyCase(name){
 if(process.env.TM_BRIDGE_CPU_PROFILE!=='1'||!/^relief-closing|^official authoring tasks/.test(name))return;
 const win=nativeElectron.BrowserWindow.getAllWindows()[0],dbg=win.webContents.debugger;
 console.log('CASE_HEAP '+JSON.stringify(await win.webContents.executeJavaScript('({limit:performance.memory.jsHeapSizeLimit,used:performance.memory.usedJSHeapSize,total:performance.memory.totalJSHeapSize})')));
 if(!dbg.isAttached())dbg.attach('1.3');await dbg.sendCommand('Profiler.enable');await dbg.sendCommand('Profiler.start');
 const output=path.join(path.dirname(process.env.TM_BRIDGE_TEST_REPORT),'heavy-case.cpuprofile');
 setTimeout(async()=>{try{const r=await dbg.sendCommand('Profiler.stop');fs.writeFileSync(output,JSON.stringify(r.profile));console.log('CASE_PROFILE '+output);}catch(e){console.log('CASE_PROFILE_ERROR '+e.message);}},45000);
}
