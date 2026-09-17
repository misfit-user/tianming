'use strict';
const { app, BrowserWindow, session } = require('electron');
const fs = require('fs'), path = require('path'), { pathToFileURL } = require('url');
const root = path.resolve(__dirname, '../..');
const output = process.env.TM_SEMANTIC_OFFLINE_OUTPUT;
if (!output || !fs.existsSync(output)) throw new Error('isolated output directory required');
const userData = path.join(output, 'fresh-profile');
fs.mkdirSync(userData);
app.setPath('userData', userData);
app.setPath('sessionData', userData);
app.disableHardwareAcceleration();
const report = { ok: false, freshProfile: true, externalRequests: [], console: [] };
let win, finished = false;
function finish(error) {
  if (finished) return;
  finished = true;
  clearTimeout(timeout);
  if (error) report.error = String(error && error.stack || error);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (win && !win.isDestroyed()) win.destroy();
  app.exit(report.ok ? 0 : 1);
}
const timeout = setTimeout(() => finish(new Error('offline semantic runtime timeout')), 110000);
app.whenReady().then(async () => {
  session.defaultSession.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*'] }, (request, callback) => {
    report.externalRequests.push(request.url);
    callback({ cancel: true });
  });
  const index = fs.readFileSync(path.join(root, 'web/index.html'), 'utf8');
  const csp = index.match(/<meta http-equiv="Content-Security-Policy"[^>]*>/i);
  if (!csp) throw new Error('production CSP not found');
  const entry = pathToFileURL(path.join(root, 'web/tm-semantic-recall.js')).href;
  const html = path.join(output, 'fixture.html');
  fs.writeFileSync(html, '<!doctype html><html><head><meta charset="utf-8">' + csp[0] + '</head><body>' +
    '<script>window.Worker = new Proxy(window.Worker, {construct(target,args){const worker=Reflect.construct(target,args);window.__observedWorker=worker;return worker;}});</script>' +
    '<script src="' + entry + '"></script></body></html>');
  win = new BrowserWindow({ show: false, webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true } });
  win.webContents.on('console-message', (_event, level, message) => report.console.push({ level, message: message.slice(0, 1500) }));
  await win.loadFile(html);
  report.result = await win.webContents.executeJavaScript(`(async () => {
    const ready = await SemanticRecall.ensureModel();
    const state = SemanticRecall.status();
    if (!ready) throw new Error('model not ready: ' + JSON.stringify(state));
    const worker = window.__observedWorker;
    if (!worker || !/worker/.test(state.loadSource || '')) throw new Error('expected real off-main-thread inference: ' + JSON.stringify(state));
    const embedding = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('embedding timeout')), 30000);
      function onMessage(event) {
        if (!event.data || event.data.id !== 'offline-verification') return;
        clearTimeout(timer); worker.removeEventListener('message', onMessage);
        if (!event.data.ok) reject(new Error(event.data.err)); else resolve(event.data.vecs);
      }
      worker.addEventListener('message', onMessage);
      worker.postMessage({cmd:'embedBatch', id:'offline-verification', texts:['天命天下，内置地图与人物资料已备齐。']});
    });
    const vec = embedding && embedding[0];
    if (!Array.isArray(vec) || vec.length !== 512 || !vec.every(Number.isFinite)) throw new Error('invalid model vector');
    const norm = Math.sqrt(vec.reduce((sum, item) => sum + item * item, 0));
    if (norm < 0.99 || norm > 1.01) throw new Error('embedding not normalized');
    return { state, dimensions: vec.length, norm };
  })()`);
  if (report.externalRequests.length) throw new Error('attempted external downloads');
  report.ok = true;
  finish();
}).catch(finish);
