#!/usr/bin/env node
'use strict';

const EventEmitter = require('events');
const fs = require('fs');
const Module = require('module');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const ROOT = path.resolve(__dirname, '..', '..');
const TEST_USER_DATA = path.join(os.tmpdir(), 'tm-close-flush-user-data-' + process.pid);
fs.rmSync(TEST_USER_DATA, { recursive: true, force: true });
fs.mkdirSync(TEST_USER_DATA, { recursive: true });
const eventHandlers = new Map();
let assertions = 0;
const lifecycle = { quit: 0, relaunch: 0, exit: 0, updateInstall: 0 };

function check(value, message) {
  assertions += 1;
  if (!value) throw new Error('[smoke-app-close-background-flush] ' + message);
}

process.env.TIANMING_TEST_EXPORTS = '1';
const electronStub = {
  app: {
    getPath: () => TEST_USER_DATA,
    getVersion: () => '1.3.4.11',
    getAppPath: () => ROOT,
    isPackaged: false,
    whenReady: () => new Promise(() => {}),
    on() {},
    once() {},
    quit() { lifecycle.quit += 1; },
    relaunch() { lifecycle.relaunch += 1; },
    exit() { lifecycle.exit += 1; }
  },
  BrowserWindow: function BrowserWindow() {},
  ipcMain: {
    handle() {},
    on(channel, listener) { eventHandlers.set(channel, listener); }
  },
  dialog: {},
  shell: {},
  Menu: {},
  protocol: { registerSchemesAsPrivileged() {}, handle() {} },
  net: { fetch: (url, init) => fetch(url, init) },
  session: { defaultSession: { setPermissionRequestHandler() {}, setPermissionCheckHandler() {} } }
};
electronStub.BrowserWindow.getAllWindows = () => [];

const originalLoad = Module._load;
Module._load = function (request) {
  if (request === 'electron') return electronStub;
  if (request === 'electron-updater') {
    return { autoUpdater: { on() {}, setFeedURL() {}, checkForUpdates: async () => null, downloadUpdate: async () => [], quitAndInstall() { lifecycle.updateInstall += 1; } } };
  }
  return originalLoad.apply(this, arguments);
};

function makeWindow(initialBounds) {
  const webContents = new EventEmitter();
  const sent = [];
  let bounds = initialBounds || null;
  const frame = {
    url: pathToFileURL(path.join(ROOT, 'web', 'index.html')).href,
    parent: null
  };
  webContents.mainFrame = frame;
  webContents.isDestroyed = () => false;
  webContents.send = (channel, payload) => sent.push({ channel, payload });
  return {
    sent,
    frame,
    webContents,
    setBounds(next) { bounds = next; },
    win: Object.assign({ isDestroyed: () => false, webContents }, initialBounds ? {
      getBounds: () => bounds
    } : {})
  };
}

async function main() {
  const T = require(path.join(ROOT, 'main-impl.js')).__test;
  check(T && typeof T.requestRendererCloseFlush === 'function', 'main exports the production close-flush request helper in test mode');
  check(typeof T.persistWindowBoundsForExit === 'function' && T.paths && T.paths.CONFIG_FILE,
    'main exports the production atomic window-config helper and isolated test path');
  check(eventHandlers.has('app-close-flush-complete'), 'main registers one trusted close-flush acknowledgement channel');
  const acknowledge = eventHandlers.get('app-close-flush-complete');

  const configFile = T.paths.CONFIG_FILE;
  fs.mkdirSync(path.dirname(configFile), { recursive: true });
  fs.writeFileSync(configFile, JSON.stringify({ webRootOverride: 'D:\\dev-web', retained: true }), 'utf-8');
  const persisted = T.persistWindowBoundsForExit(makeWindow({ x: -120, y: 30, width: 1440, height: 900 }).win);
  const mergedConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  check(persisted.ok === true && mergedConfig.webRootOverride === 'D:\\dev-web' && mergedConfig.retained === true,
    'atomic window persistence preserves unrelated app_config fields');
  check(mergedConfig.window.x === -120 && mergedConfig.window.width === 1440,
    'atomic window persistence stores the validated latest bounds');

  const bytesBeforeFailure = fs.readFileSync(configFile);
  const originalRenameSync = fs.renameSync;
  fs.renameSync = function (source, destination) {
    if (path.resolve(destination) === path.resolve(configFile)) throw new Error('injected config rename failure');
    return originalRenameSync.apply(this, arguments);
  };
  let failedPersist;
  try {
    failedPersist = T.persistWindowBoundsForExit(makeWindow({ x: 1, y: 2, width: 800, height: 600 }).win);
  } finally {
    fs.renameSync = originalRenameSync;
  }
  check(failedPersist.ok === false && failedPersist.code === 'window-config-write-failed',
    'atomic window persistence reports injected commit failure');
  check(fs.readFileSync(configFile).equals(bytesBeforeFailure), 'failed atomic config write preserves the old file byte-for-byte');
  check(fs.readdirSync(path.dirname(configFile)).every(name => name.indexOf(path.basename(configFile) + '.tmp-') !== 0),
    'failed atomic config write removes its temporary file');

  const corruptBytes = Buffer.from('{"webRootOverride":');
  fs.writeFileSync(configFile, corruptBytes);
  const backupsBefore = new Set(fs.readdirSync(path.dirname(configFile)));
  const recovered = T.persistWindowBoundsForExit(makeWindow({ x: 9, y: 8, width: 1024, height: 768 }).win);
  const backupsAfter = fs.readdirSync(path.dirname(configFile)).filter(name =>
    name.indexOf(path.basename(configFile) + '.corrupt-') === 0 && !backupsBefore.has(name));
  check(recovered.ok === true && backupsAfter.length === 1,
    'invalid legacy config is explicitly backed up before safe recovery');
  check(fs.readFileSync(path.join(path.dirname(configFile), backupsAfter[0])).equals(corruptBytes),
    'corrupt-config recovery preserves the original bytes in its diagnostic backup');
  check(JSON.parse(fs.readFileSync(configFile, 'utf-8')).window.width === 1024,
    'corrupt-config recovery replaces the invalid root with a valid window config');

  const success = makeWindow();
  const successPromise = T.requestRendererCloseFlush(success.win, 'renderer-test', 1000);
  check(success.sent.length === 1 && success.sent[0].channel === 'app-close-flush-request', 'main sends one close-flush request');
  const successId = success.sent[0].payload.requestId;
  acknowledge({ sender: success.webContents, senderFrame: success.frame }, {
    requestId: successId,
    ok: true,
    reason: 'queue-drained'
  });
  const successResult = await successPromise;
  check(successResult.ok === true && successResult.reason === 'queue-drained', 'matching renderer acknowledgement permits close');
  check(success.webContents.listenerCount('destroyed') === 0, 'success acknowledgement removes the renderer lifecycle listener');

  const failure = makeWindow();
  const failurePromise = T.requestRendererCloseFlush(failure.win, 'renderer-test', 1000);
  acknowledge({ sender: failure.webContents, senderFrame: failure.frame }, {
    requestId: failure.sent[0].payload.requestId,
    ok: false,
    code: 'background-save-flush-failed',
    reason: 'injected write failure'
  });
  const failureResult = await failurePromise;
  check(failureResult.ok === false && failureResult.code === 'background-save-flush-failed', 'renderer save failure cancels close with a structured code');

  const destroyed = makeWindow();
  const destroyedPromise = T.requestRendererCloseFlush(destroyed.win, 'window-close', 1000);
  destroyed.webContents.emit('destroyed');
  const destroyedResult = await destroyedPromise;
  check(destroyedResult.ok === false && destroyedResult.code === 'renderer-destroyed-before-flush', 'renderer destruction cannot be mistaken for a successful flush');

  const timeout = makeWindow();
  const timeoutResult = await T.requestRendererCloseFlush(timeout.win, 'window-close', 10);
  check(timeoutResult.ok === false && timeoutResult.code === 'background-save-flush-timeout', 'missing acknowledgement fails closed after the bounded timeout');
  check(timeout.webContents.listenerCount('destroyed') === 0, 'timeout also removes the renderer lifecycle listener');

  const unavailable = await T.requestRendererCloseFlush(null, 'window-close', 10);
  check(unavailable.ok === true && unavailable.skipped === true, 'already unavailable renderer has no pending queue to flush');

  T.resetApplicationExitStateForTest();
  fs.writeFileSync(configFile, JSON.stringify({ webRootOverride: 'E:\\preserve-me' }), 'utf-8');
  const repeatedClose = makeWindow({ x: 10, y: 20, width: 1200, height: 700 });
  let configCommitCount = 0;
  fs.renameSync = function (source, destination) {
    if (path.resolve(destination) === path.resolve(configFile)) configCommitCount += 1;
    return originalRenameSync.apply(this, arguments);
  };
  const firstClosePromise = T.requestApplicationQuit('window-close', repeatedClose.win);
  const secondClosePromise = T.requestApplicationQuit('window-close', repeatedClose.win);
  check(firstClosePromise === secondClosePromise && repeatedClose.sent.length === 1,
    'repeated close requests share one save-and-config transaction');
  repeatedClose.setBounds({ x: 40, y: 50, width: 1600, height: 1000 });
  acknowledge({ sender: repeatedClose.webContents, senderFrame: repeatedClose.frame }, {
    requestId: repeatedClose.sent[0].payload.requestId,
    ok: true,
    reason: 'queue-drained'
  });
  let repeatedCloseResult;
  try {
    repeatedCloseResult = await firstClosePromise;
    await new Promise(resolve => setImmediate(resolve));
  } finally {
    fs.renameSync = originalRenameSync;
  }
  const closeConfig = JSON.parse(fs.readFileSync(configFile, 'utf-8'));
  check(repeatedCloseResult.success === true && configCommitCount === 1,
    'successful repeated close writes app_config exactly once after the renderer handshake');
  check(closeConfig.webRootOverride === 'E:\\preserve-me' && closeConfig.window.x === 40 && closeConfig.window.width === 1600,
    'close transaction persists the latest bounds while preserving existing config fields');
  check(lifecycle.quit === 1, 'successful close schedules one normal app.quit');
  lifecycle.quit = 0;
  T.resetApplicationExitStateForTest();

  check(typeof T.requestApplicationRelaunch === 'function' && typeof T.requestApplicationUpdateInstall === 'function',
    'test exports expose the production relaunch and installer lifecycle coordinators');
  const blockedInstall = makeWindow();
  const blockedInstallPromise = T.requestApplicationUpdateInstall('installer-update-test', blockedInstall.win);
  check(lifecycle.updateInstall === 0, 'installer update cannot quit before renderer save acknowledgement');
  acknowledge({ sender: blockedInstall.webContents, senderFrame: blockedInstall.frame }, {
    requestId: blockedInstall.sent[0].payload.requestId,
    ok: false,
    code: 'desktop-autosave-flush-failed',
    reason: 'injected mirror failure'
  });
  const blockedInstallResult = await blockedInstallPromise;
  check(blockedInstallResult.success === false && lifecycle.updateInstall === 0, 'failed save handshake cancels installer quitAndInstall');

  const relaunch = makeWindow();
  const relaunchPromise = T.requestApplicationRelaunch('hot-update-reload-test', relaunch.win);
  check(lifecycle.relaunch === 0 && lifecycle.exit === 0 && lifecycle.quit === 0, 'hot reload cannot relaunch or force-exit before save acknowledgement');
  acknowledge({ sender: relaunch.webContents, senderFrame: relaunch.frame }, {
    requestId: relaunch.sent[0].payload.requestId,
    ok: true,
    reason: 'canonical-and-desktop-mirror-flushed'
  });
  const relaunchResult = await relaunchPromise;
  check(relaunchResult.success === true && lifecycle.relaunch === 1 && lifecycle.exit === 0, 'successful hot reload schedules relaunch without app.exit bypass');
  await new Promise((resolve) => setTimeout(resolve, 130));
  check(lifecycle.quit === 1 && lifecycle.exit === 0, 'hot reload exits through normal app.quit lifecycle after relaunch scheduling');

  console.log('[smoke-app-close-background-flush] PASS assertions=' + assertions);
}

main().catch(error => {
  console.error(error && error.stack || error);
  process.exitCode = 1;
}).finally(() => {
  Module._load = originalLoad;
});
