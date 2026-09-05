'use strict';
// Real main implementation, isolated userData and trusted IPC sender; no Electron window/network/production data.
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { createRequire } = require('module'), { pathToFileURL } = require('url');
module.exports = function createHarness(options = {}) {
  const root = path.resolve(__dirname, '../..'), file = path.join(root, 'main-impl.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-audit-main-'));
  const handlers = new Map(), req = createRequire(file);
  const io = Object.create(fs); io.createWriteStream = () => ({ write() {}, end() {} });
  const dialog = { showSaveDialog: async () => ({ canceled: true }), showOpenDialog: async () => ({ canceled: true, filePaths: [] }) };
  const frame = { url: pathToFileURL(path.join(root, 'web/index.html')).href, parent: null };
  const event = { senderFrame: frame, sender: { mainFrame: frame, isDestroyed: () => false } };
  const app = { isPackaged: false, getPath: () => dir, getAppPath: () => root, getVersion: () => '1.3.4.11', whenReady: () => new Promise(() => {}), on() {}, once() {} };
  const electron = { app, BrowserWindow: Object.assign(function() {}, { getAllWindows: () => [] }), ipcMain: { handle: (name, fn) => handlers.set(name, fn), on() {} }, dialog, shell: {}, Menu: {}, protocol: { registerSchemesAsPrivileged() {} }, net: { fetch() { throw new Error('Unexpected network'); } }, session: {} };
  const module = { exports: {} }, proc = Object.create(process); proc.env = { ...process.env, TIANMING_TEST_EXPORTS: '1' }; proc.on = () => {};
  const context = { Buffer, URL, URLSearchParams, AbortController, AbortSignal, TextDecoder, TextEncoder, setTimeout, clearTimeout, setInterval, clearInterval, process: proc, console: { log() {}, info() {}, warn() {}, error() {}, debug() {} }, __dirname: root, __filename: file, module, exports: module.exports,
    require: name => options.requireOverrides && Object.prototype.hasOwnProperty.call(options.requireOverrides, name) ? options.requireOverrides[name]
      : name === 'electron' ? electron : name === 'fs' ? io : name === 'electron-updater' ? { autoUpdater: { on() {}, setFeedURL() {} } } : req(name) };
  vm.runInNewContext(fs.readFileSync(file, 'utf8'), context, { filename: file });
  return { T: module.exports.__test, dir, io, dialog, context, handlers, invoke: (name, ...args) => handlers.get(name)(event, ...args), cleanup: () => fs.rmSync(dir, { recursive: true, force: true }) };
};
