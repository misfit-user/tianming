'use strict';

// The Electron main process is executable application code. It is updated only
// by a signed installer and must never be loaded from the renderer content-OTA
// cache.
const { app, BrowserWindow } = require('electron');
// Acquire the profile before loading any code that can open storage or write logs.
// https://www.electronjs.org/docs/latest/api/app#apprequestsingleinstancelockadditionaldata
const fixtureWithoutNativeLock = !app.isPackaged && process.env.TIANMING_TEST_EXPORTS === '1' && typeof app.requestSingleInstanceLock !== 'function';
const ownsProfile = fixtureWithoutNativeLock || app.requestSingleInstanceLock();
if (!ownsProfile) {
  app.quit();
} else {
  app.on('second-instance', () => {
    const win = BrowserWindow.getAllWindows().find(window => !window.isDestroyed());
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.show(); win.focus();
  });
  app.on('will-quit', () => {
    // A connected Node debugger must not leave a windowless process holding LevelDB.
    // This runs only after the existing close/save handshake has allowed the exit.
    try { const inspector = require('node:inspector'); if (inspector.url()) inspector.close(); }
    catch (error) { console.warn('[app-close] debugger disconnect failed:', error && error.message); }
  });
  require('./main-impl.js');
}
