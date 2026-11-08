'use strict';
// Small real locked-Electron protocol probe, entirely separate from game QA.
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { app, BrowserWindow, session } = require('electron');
const { startCompositeAllocationSampling } = require('./npc-composite-diagnostics.cjs');
const directory = process.env.TM_COMPOSITE_DIAGNOSTIC_PROBE_OUTPUT;
if (!directory || !path.isAbsolute(directory)) throw Error('explicit absolute probe output directory required');
fs.mkdirSync(directory, { recursive: true }); app.setPath('userData', path.join(directory, 'temporary-profile'));
const report = { scope: 'real CDP protocol on a blank isolated window; no game/world/UI acceptance',
  startedAt: new Date().toISOString(), versions: process.versions, commands: [], ok: false };
let sampler, win, finished = false;
function finish(error) {
  if (finished) return; finished = true; clearTimeout(timer); if (sampler) sampler.dispose();
  report.finishedAt = new Date().toISOString(); report.ok = !error;
  if (error) report.error = String(error.stack || error);
  fs.writeFileSync(path.join(directory, 'probe-report.json'), JSON.stringify(report, null, 2) + '\n', { flag: 'wx' });
  console.log(JSON.stringify(report)); app.exit(error ? 1 : 0);
}
const timer = setTimeout(() => finish(Error('blank allocation protocol probe exceeded 30 seconds')), 30000);
process.on('uncaughtException', finish); process.on('unhandledRejection', finish);
app.whenReady().then(async () => {
  try {
    assert.equal(process.versions.electron, require('../../package-lock.json').packages['node_modules/electron'].version);
    session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*','https://*/*','ws://*/*','wss://*/*'] }, (_details, cb) => cb({ cancel: true }));
    win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, backgroundThrottling: false } });
    win.webContents.on('render-process-gone', (_event, detail) => finish(Error('probe renderer gone: ' + JSON.stringify(detail))));
    await win.loadURL('data:text/html,<title>Allocation protocol probe</title>');
    const dbg = win.webContents.debugger, real = dbg.sendCommand.bind(dbg);
    dbg.sendCommand = function(command, params) { report.commands.push({ command, params: params || null }); return real(command, params); };
    sampler = await startCompositeAllocationSampling({ debugger: dbg, directory, onFailure: finish });
    await win.webContents.executeJavaScript('function allocationProbe(){return Array.from({length:64},()=>Array.from({length:65536},(_,i)=>i));} window.__allocationProbe=allocationProbe(); true;\n//# sourceURL=composite-allocation-probe.js');
    report.sample = await sampler.sample('blank-allocation');
    const files = fs.readdirSync(directory).filter(name => /^allocation-profile-\d+\.json$/.test(name));
    const last = JSON.parse(fs.readFileSync(path.join(directory, files.at(-1)), 'utf8'));
    assert(last.sampledLiveBytes > 0); assert(last.nodes.some(node => node.functionName === 'allocationProbe' || node.url.includes('composite-allocation-probe.js')));
    report.profile = files.at(-1); report.nodeCount = last.nodes.length; report.sampledLiveBytes = last.sampledLiveBytes;
    report.topStacks = last.topStacks.slice(0, 3); report.systemMemoryKiB = process.getSystemMemoryInfo(); finish();
  } catch (error) { finish(error); }
});
