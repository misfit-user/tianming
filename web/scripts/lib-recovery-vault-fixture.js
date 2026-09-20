'use strict';
// In-memory IndexedDB fixture for synthetic recovery checkpoints only.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { webcrypto } = require('crypto');
const ROOT = path.resolve(__dirname, '..');
const copy = value => value == null ? value : JSON.parse(JSON.stringify(value));
function database() {
  const disk = new Map();
  let established = false;
  function transaction() {
    const staged = [];
    const tx = { aborted: false };
    function finish() {
      if (tx.aborted) return;
      staged.splice(0).forEach(fn => fn());
      if (tx.oncomplete) tx.oncomplete();
    }
    tx.abort = () => { tx.aborted = true; if (tx.onabort) tx.onabort(); };
    tx.objectStore = () => ({
      get(key) {
        const request = {};
        setImmediate(() => {
          request.result = copy(disk.get(key));
          if (request.onsuccess) request.onsuccess();
          setImmediate(finish);
        });
        return request;
      },
      put(value, key) { staged.push(() => disk.set(key, copy(value))); setImmediate(finish); },
      delete(key) { staged.push(() => disk.delete(key)); }
    });
    return tx;
  }
  const api = { open() {
    const request = {};
    setImmediate(() => {
      request.result = { objectStoreNames: { contains: () => established }, createObjectStore() { established = true; }, close() {}, transaction };
      request.transaction = { abort() {} };
      if (!established && request.onupgradeneeded) request.onupgradeneeded();
      if (request.onsuccess) request.onsuccess();
    });
    return request;
  } };
  return { api, disk };
}
function load(c, db) {
  c.crypto = webcrypto;
  c.TextEncoder = TextEncoder;
  c.indexedDB = db.api;
  c.setTimeout = setTimeout;
  c.clearTimeout = clearTimeout;
  const local = new Map();
  c.localStorage = { getItem: key => local.get(key) || null, setItem: (key, value) => local.set(key, String(value)) };
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-recovery-vault.js'), 'utf8'), c, { filename: 'tm-endturn-recovery-vault.js' });
  return c.TM.Endturn.RecoveryVault;
}
module.exports = { database, load, ROOT, copy };
