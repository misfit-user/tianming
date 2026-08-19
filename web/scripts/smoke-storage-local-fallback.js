#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'tm-storage.js'), 'utf8');
let assertions = 0;

function check(condition, message) {
  if (!condition) throw new Error('[smoke-storage-local-fallback] ' + message);
  assertions += 1;
}

function makeLocalStorage() {
  const data = new Map();
  return {
    get length() { return data.size; },
    key(index) { return Array.from(data.keys())[index] || null; },
    getItem(key) { return data.has(String(key)) ? data.get(String(key)) : null; },
    setItem(key, value) { data.set(String(key), String(value)); },
    removeItem(key) { data.delete(String(key)); },
    clear() { data.clear(); }
  };
}

function makeFailingIndexedDB() {
  return {
    open() {
      const request = {};
      queueMicrotask(() => {
        if (typeof request.onerror === 'function') {
          request.onerror({ target: { error: new Error('synthetic IndexedDB open failure') } });
        }
      });
      return request;
    }
  };
}

function makeContext(indexedDB) {
  const localStorage = makeLocalStorage();
  const quietConsole = { log() {}, warn() {}, error() {}, info() {} };
  const context = {
    console: quietConsole,
    Promise, Math, Date, JSON, Object, Array, Number, String, Boolean, Error,
    Blob, Response, CompressionStream, DecompressionStream, TextDecoder,
    localStorage,
    navigator: { storage: null },
    indexedDB
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'tm-storage.js' });
  return context;
}

async function exerciseFallback(indexedDB, label) {
  const context = makeContext(indexedDB);
  const expected = {
    GM: { turn: 12, sid: 'fallback-smoke', nested: { zero: 0, empty: [], enabled: false } },
    P: { name: '降级存档', flags: { safe: true } }
  };
  const saved = await context.TM_SaveDB.save('fallback', expected, { type: 'manual', turn: 12 });
  check(saved === true, label + ': save should report success');

  const raw = JSON.parse(context.localStorage.getItem('tm_idb_saves_fallback'));
  check(raw._compressed === false, label + ': localStorage record must not claim gzip compression');
  check(typeof raw.gameState === 'string' && raw.gameState.indexOf('fallback-smoke') >= 0,
    label + ': localStorage record must retain the JSON payload instead of serializing Blob to {}');

  const loaded = await context.TM_SaveDB.load('fallback');
  check(JSON.stringify(loaded.gameState) === JSON.stringify(expected), label + ': save/load must round-trip deeply');
}

(async function main() {
  check(typeof CompressionStream !== 'undefined', 'fixture requires CompressionStream to exercise the Blob branch');
  await exerciseFallback(undefined, 'missing IndexedDB');
  await exerciseFallback(makeFailingIndexedDB(), 'failed IndexedDB open');
  console.log('[smoke-storage-local-fallback] PASS assertions=' + assertions);
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
