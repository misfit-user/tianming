'use strict';
// Actual locked Electron runtime + unchanged production main/preload.
// Test-only interception: temporary userData, hidden presentation, all external network denied.
const fs = require('fs'), path = require('path'), os = require('os');
const { app, session } = require('electron');
const repoIndex = process.argv.indexOf('--repo');
const root = repoIndex >= 0 ? path.resolve(process.argv[repoIndex + 1]) : path.resolve(__dirname, '../..');
// Baseline worktree shares the unchanged locked dependencies, not any implementation source.
process.env.NODE_PATH = path.resolve(__dirname, '../../node_modules');
require('module').Module._initPaths();
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-review-electron-'));
app.setPath('userData', temporary);
app.setPath('sessionData', path.join(temporary, 'session'));
app.getAppPath = () => root;
process.env.TIANMING_TEST_EXPORTS = '1';
for (const name of ['http', 'https']) {
  require(name).request = () => { throw new Error('test-external-network-denied'); };
  require(name).get = () => { throw new Error('test-external-network-denied'); };
}
const preloadErrors = [];
let done = false;
function finish(ok, detail) {
  if (done) return; done = true;
  console.log('ELECTRON_PROBE ' + JSON.stringify({ ok, detail, preloadErrors, versions: process.versions, sourceRoot: root,
    sourceHead: require('child_process').execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
    scope: 'production main/preload startup in real Electron; hidden test window; external network denied; no player data',
    temporaryUserData: temporary }));
  // Exits this isolated test process, not a production application or installation.
  app.exit(ok ? 0 : 1);
}
setTimeout(() => finish(false, 'startup-timeout'), 45000);
app.on('browser-window-created', (_event, win) => {
  win.show = () => {}; win.setFullScreen = () => {};
  win.webContents.on('preload-error', (_event, file, error) => {
    preloadErrors.push({ file, message: error.message });
    finish(false, 'production-preload-failed');
  });
  win.webContents.on('render-process-gone', (_event, detail) => finish(false, detail));
  win.webContents.once('did-finish-load', async () => {
    try {
      const bridge = await win.webContents.executeJavaScript('(async()=>({bridge:!!window.tianming,protocol:window.tianming&&window.tianming.turnDataProtocolVersion,saves:window.tianming?await window.tianming.listSaves():null}))()');
      finish(bridge.bridge && bridge.protocol === 2 && bridge.saves && bridge.saves.success === true, bridge);
    } catch (error) { finish(false, error.message); }
  });
});
app.whenReady().then(() => session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (_details, callback) => callback({ cancel: true })));
require(path.join(root, 'main.js'));
