#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(ROOT, 'tm-storage.js'), 'utf8');
let assertions = 0;

function check(condition, message) {
  if (!condition) throw new Error('[smoke-storage-metadata-index] ' + message);
  assertions += 1;
}

function makeFakeIndexedDB(legacySaves, options) {
  options = options || {};
  const stores = new Map();
  if (Array.isArray(legacySaves)) {
    stores.set('saves', new Map(legacySaves.map((record) => [String(record.id), JSON.parse(JSON.stringify(record))])));
    stores.set('projects', new Map());
  }
  if (options.oldVersion > 0 && !stores.has('saves')) {
    stores.set('saves', new Map());
    stores.set('saveMetadata', new Map());
    stores.set('projects', new Map());
  }
  if (Array.isArray(options.chronicles)) {
    stores.set('chronicleRecords', new Map(options.chronicles.map((record) => [String(record.id), clone(record)])));
  }
  if (Array.isArray(options.receipts)) {
    stores.set('turnPublishReceipts', new Map(options.receipts.map((record) => [String(record.id), clone(record)])));
  }
  const oldVersion = Number(options.oldVersion) || (Array.isArray(legacySaves) ? 2 : 0);
  const counters = { openedVersion: 0, openCalls: 0, closed: 0, getAll: Object.create(null), get: Object.create(null) };

  function clone(value) {
    return value == null ? value : JSON.parse(JSON.stringify(value));
  }

  function objectStore(name) {
    if (!stores.has(name)) throw new Error('missing store ' + name);
    const rows = stores.get(name);
    return {
      indexNames: { contains() { return false; } },
      createIndex() {},
      put(value) { rows.set(String(value.id), clone(value)); },
      delete(id) { rows.delete(String(id)); },
      get(id) {
        counters.get[name] = (counters.get[name] || 0) + 1;
        const request = {};
        setTimeout(() => {
          request.result = clone(rows.get(String(id)));
          if (request.onsuccess) request.onsuccess({ target: request });
        }, 0);
        return request;
      },
      getAll() {
        counters.getAll[name] = (counters.getAll[name] || 0) + 1;
        const request = {};
        setTimeout(() => {
          request.result = Array.from(rows.values()).map(clone);
          if (request.onsuccess) request.onsuccess({ target: request });
        }, 0);
        return request;
      },
      openCursor() {
        const request = {};
        const values = Array.from(rows.values()).map(clone);
        let index = 0;
        function advance() {
          setTimeout(() => {
            request.result = index < values.length ? {
              value: values[index++],
              continue: advance
            } : null;
            if (request.onsuccess) request.onsuccess({ target: request });
          }, 0);
        }
        advance();
        return request;
      }
    };
  }

  const db = {
    objectStoreNames: { contains(name) { return stores.has(name); } },
    close() { counters.closed += 1; },
    createObjectStore(name) {
      stores.set(name, new Map());
      return objectStore(name);
    },
    transaction(names) {
      const tx = {
        objectStore,
        error: null,
        oncomplete: null,
        onerror: null,
        onabort: null
      };
      setTimeout(() => { if (tx.oncomplete) tx.oncomplete({ target: tx }); }, 0);
      return tx;
    }
  };

  return {
    stores,
    db,
    counters,
    open(name, version) {
      counters.openCalls += 1;
      counters.openedVersion = version;
      const request = {};
      setTimeout(() => {
        const upgradeTx = db.transaction([]);
        if (request.onupgradeneeded) {
          request.onupgradeneeded({ oldVersion, target: { result: db, transaction: upgradeTx } });
        }
        setTimeout(() => {
          request.result = db;
          if (request.onsuccess) request.onsuccess({ target: request });
        }, oldVersion ? 20 : 0);
      }, 0);
      return request;
    }
  };
}

function makeLocalStorage() {
  const rows = new Map();
  return {
    get length() { return rows.size; },
    key(index) { return Array.from(rows.keys())[index] || null; },
    getItem(key) { return rows.has(String(key)) ? rows.get(String(key)) : null; },
    setItem(key, value) { rows.set(String(key), String(value)); },
    removeItem(key) { rows.delete(String(key)); }
  };
}

(async function main() {
  const indexedDB = makeFakeIndexedDB();
  const context = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    Promise, Math, Date, JSON, Object, Array, Number, String, Boolean, Error,
    Blob, Response, CompressionStream, DecompressionStream, TextDecoder,
    setTimeout, clearTimeout,
    localStorage: makeLocalStorage(),
    navigator: { storage: null },
    indexedDB
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  const bootAt = source.lastIndexOf('\nTM_SaveDB.open().then');
  vm.runInContext(bootAt > 0 ? source.slice(0, bootAt) : source, context, { filename: 'tm-storage.js' });
  context.SaveCompression.compress = (text) => Promise.resolve(text);

  await context.TM_SaveDB.open();
  check(indexedDB.counters.openedVersion === 6, 'storage schema must open IndexedDB version 6');
  check(indexedDB.stores.has('chronicleRecords') && indexedDB.stores.has('turnPublishReceipts'),
    'v6 upgrade creates lightweight chronicle and turn receipt stores');

  const payload = 'x'.repeat(64 * 1024);
  await Promise.all(Array.from({ length: 100 }, (_, index) => context.TM_SaveDB.save(
    'slot_' + index,
    { GM: { turn: index, payload }, P: { name: 'scenario-' + index } },
    { name: '存档' + index, type: index % 2 ? 'manual' : 'auto', turn: index, scenarioName: '剧本' + index }
  )));

  indexedDB.counters.getAll = Object.create(null);
  const listed = await context.TM_SaveDB.list();
  check(listed.length === 100, 'metadata list must return every saved slot');
  check((indexedDB.counters.getAll.saveMetadata || 0) === 1, 'list must query the metadata store exactly once');
  check((indexedDB.counters.getAll.saves || 0) === 0, 'list must never materialize payload records');
  check(Array.from(indexedDB.stores.get('saveMetadata').values()).every((row) => !Object.prototype.hasOwnProperty.call(row, 'gameState')),
    'metadata store must contain no gameState payload');

  const loaded = await context.TM_SaveDB.load('slot_42');
  check(loaded.gameState.GM.turn === 42 && loaded.gameState.GM.payload.length === payload.length,
    'payload must remain loadable by id after metadata separation');
  check((indexedDB.counters.get.saves || 0) === 1, 'loading one slot must read exactly one payload record');

  await context.TM_SaveDB.delete('slot_42');
  check(!indexedDB.stores.get('saves').has('slot_42') && !indexedDB.stores.get('saveMetadata').has('slot_42'),
    'delete must atomically remove payload and metadata records');

  check(typeof indexedDB.db.onversionchange === 'function', 'opened connection must register an onversionchange release hook');
  indexedDB.db.onversionchange();
  check(indexedDB.counters.closed === 1 && context.TM_SaveDB.isAvailable() === false,
    'version change closes the stale connection and clears availability');
  await context.TM_SaveDB.open();
  check(indexedDB.counters.openCalls === 2 && context.TM_SaveDB.isAvailable() === true,
    'next operation can establish a fresh connection after version change');

  const legacyIndexedDB = makeFakeIndexedDB([
    { id: 'legacy-a', name: '旧档甲', type: 'manual', timestamp: 10, turn: 3, gameState: '{"GM":{"turn":3},"P":{}}' },
    { id: 'legacy-b', name: '旧档乙', type: 'auto', timestamp: 20, turn: 4, gameState: '{"GM":{"turn":4},"P":{}}' }
  ]);
  const legacyContext = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    Promise, Math, Date, JSON, Object, Array, Number, String, Boolean, Error,
    Blob, Response, CompressionStream, DecompressionStream, TextDecoder,
    setTimeout, clearTimeout,
    localStorage: makeLocalStorage(), navigator: { storage: null }, indexedDB: legacyIndexedDB
  };
  legacyContext.window = legacyContext;
  legacyContext.globalThis = legacyContext;
  vm.createContext(legacyContext);
  vm.runInContext(bootAt > 0 ? source.slice(0, bootAt) : source, legacyContext, { filename: 'tm-storage-legacy.js' });
  await legacyContext.TM_SaveDB.open();
  const migratedList = await legacyContext.TM_SaveDB.list();
  check(migratedList.length === 2 && migratedList[0].id === 'legacy-b', 'v2 upgrade must backfill and sort metadata for existing saves');
  check(Array.from(legacyIndexedDB.stores.get('saveMetadata').values()).every((row) => !Object.prototype.hasOwnProperty.call(row, 'gameState')),
    'v2 metadata backfill must not duplicate legacy payloads');

  const oldChronicleId = 'chronicle:campaign-v4:2025';
  const oldReceiptId = 'turn-publish:campaign-v4:txn-v4';
  const auxiliaryIndexedDB = makeFakeIndexedDB(null, {
    oldVersion: 5,
    chronicles: [{
      id: oldChronicleId,
      campaignId: 'campaign-v4',
      year: 2025,
      generatedAt: 10,
      chronicle: { content: '旧版正史', afterword: '旧评' }
    }],
    receipts: [{
      id: oldReceiptId,
      campaignId: 'campaign-v4',
      transactionId: 'txn-v4',
      turn: 12,
      stateChecksum: 'a'.repeat(64),
      status: 'world-committed'
    }]
  });
  const auxiliaryContext = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    Promise, Math, Date, JSON, Object, Array, Number, String, Boolean, Error,
    Blob, Response, CompressionStream, DecompressionStream, TextDecoder,
    setTimeout, clearTimeout,
    localStorage: makeLocalStorage(), navigator: { storage: null }, indexedDB: auxiliaryIndexedDB
  };
  auxiliaryContext.window = auxiliaryContext;
  auxiliaryContext.globalThis = auxiliaryContext;
  vm.createContext(auxiliaryContext);
  vm.runInContext(bootAt > 0 ? source.slice(0, bootAt) : source, auxiliaryContext, { filename: 'tm-storage-v5-aux.js' });
  await auxiliaryContext.TM_SaveDB.open();
  await new Promise(resolve => setTimeout(resolve, 30));
  const migratedChronicles = Array.from(auxiliaryIndexedDB.stores.get('chronicleRecords').values());
  const migratedReceipts = Array.from(auxiliaryIndexedDB.stores.get('turnPublishReceipts').values());
  check(migratedChronicles.length === 1 && migratedChronicles[0].id !== oldChronicleId
    && /^tml_legacy_/.test(migratedChronicles[0].timelineId)
    && migratedChronicles[0].migrationState === 'legacy-unassigned',
  'v4/v5 chronicle rows migrate atomically to deterministic legacy timeline keys');
  check(migratedReceipts.length === 1 && migratedReceipts[0].id !== oldReceiptId
    && migratedReceipts[0].timelineId === migratedChronicles[0].timelineId
    && migratedReceipts[0].migrationState === 'legacy-v4',
  'v4/v5 turn receipts remain recoverable on the same deterministic legacy timeline');
  check((await auxiliaryContext.TM_SaveDB.listChronicleRecords('campaign-v4', migratedChronicles[0].timelineId)).length === 1,
    'migrated chronicle is visible through the timeline-scoped query');

  console.log('[smoke-storage-metadata-index] PASS assertions=' + assertions);
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
