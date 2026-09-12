'use strict';
// Real production entry, preload and IPC. Only test ownership (temporary userData),
// presentation and external-network denial are injected. No renderer bridge substitute.
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert/strict');
const { app, session, net } = require('electron');
const root = process.env.TM_BRIDGE_TEST_ROOT;
const mode = process.env.TM_BRIDGE_TEST_MODE;
const baseline = process.env.TM_BRIDGE_TEST_BASELINE === '1';
const visiblePerformance = mode === 'performance' || mode === 'performance-inspect' || mode === 'performance-autosave' || mode === 'performance-panels';
const visibleWindow = mode === 'seven-ui' || mode === 'authoring-autoapply' || mode === 'player-feedback' || mode === 'workshop-hierarchy' || mode === 'authoring-continuation' || mode === 'memorial-reading' || visiblePerformance || mode === 'building-appraisal' || mode === 'edict-polish' || mode === 'edict-clarity' || mode === 'character-actions' || mode === 'rail-badges' || mode === 'relief-pilot' || mode === 'relief-inspect' || mode === 'authoring-stream' || mode === 'authoring-boundaries' || mode === 'authoring-recovery';
process.env.NODE_PATH = path.resolve(__dirname, '../../node_modules'); require('module').Module._initPaths();
if (mode === 'test-exports') process.env.TIANMING_TEST_EXPORTS = '1'; else delete process.env.TIANMING_TEST_EXPORTS;
const temp = process.env.TM_BRIDGE_TEST_USERDATA || fs.mkdtempSync(path.join(os.tmpdir(), 'tm-bridge-gate-'));
app.setPath('userData', temp); app.setPath('sessionData', path.join(temp, 'session')); app.getAppPath = () => root;
const deny = () => { throw new Error('test-external-network-denied'); };
for (const name of ['http', 'https']) { require(name).request = deny; require(name).get = deny; }
net.request = deny; net.fetch = deny; global.fetch = deny;
const results = [], failures = [];
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
    if (visibleWindow) args[0] = { ...args[0], width: 1280, height: 800, fullscreen: false };
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
    securityScope: 'real unpackaged production main/preload; '+(visibleWindow ? 'visible' : 'hidden')+' window; temporary userData; external network denied; '+(mode === 'authoring-regions' && process.env.TM_AUTHORING_REGION_FIXTURE ? 'read-only user-supplied scenario clone' : 'no player data'),
    temporaryUserData: temp, performance: performanceReport };
  fs.writeFileSync(process.env.TM_BRIDGE_TEST_REPORT, JSON.stringify(report, null, 2) + '\n');
  // This exits the disposable gate process, not the application's production quit path.
  app.exit(report.ok ? 0 : 1);
}
async function check(name, fn) { await fn(); results.push({ name, status: 'PASS' }); }
setTimeout(() => finish(new Error('electron-bridge-timeout')), mode === 'performance-inspect' || mode === 'relief-inspect' ? 1800000 : mode === 'relief-pilot' ? 180000 : visiblePerformance ? 240000 : 75000);
process.on('uncaughtException', finish); process.on('unhandledRejection', finish);
app.on('browser-window-created', (_event, win) => {
  if (!visibleWindow) win.show = () => {};
  win.setFullScreen = () => {};
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
      else if (mode === 'authoring-efficiency') await require('./authoring-efficiency-cases.cjs')({ win, root, temp, check });
      else if (mode === 'relief-pilot' || mode === 'relief-inspect') await require('./relief-pilot-cases.cjs')({ win, root, temp, check, mode });
      else if (!baseline) await require('./desktop-cases.cjs')({ win, root, temp, mode, controls, check });
      finish();
    } catch (error) { finish(error); }
  });
});
app.whenReady().then(() => session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true })));
require(path.join(root, 'main.js'));
