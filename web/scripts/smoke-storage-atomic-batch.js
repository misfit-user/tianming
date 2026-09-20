#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const fullSource = fs.readFileSync(path.join(ROOT, 'tm-storage.js'), 'utf8');
const bootAt = fullSource.lastIndexOf('\nTM_SaveDB.open().then');
const source = bootAt > 0 ? fullSource.slice(0, bootAt) : fullSource;
let assertions = 0;
function check(value, message) {
  if (!value) throw new Error('[smoke-storage-atomic-batch] ' + message);
  assertions++;
}
function clone(value) { return value == null ? value : JSON.parse(JSON.stringify(value)); }

function makeLocalStorage(initial, failKey, failureName) {
  const rows = new Map(Object.entries(initial || {}).map(([k, v]) => [k, String(v)]));
  let failed = false;
  return {
    rows,
    get length() { return rows.size; },
    key(i) { return Array.from(rows.keys())[i] || null; },
    getItem(k) { return rows.has(String(k)) ? rows.get(String(k)) : null; },
    setItem(k, v) {
      if (!failed && failKey && String(k) === failKey) {
        failed = true;
        const error = new Error('injected-local-write-failure');
        error.name = failureName || 'Error';
        throw error;
      }
      rows.set(String(k), String(v));
    },
    removeItem(k) { rows.delete(String(k)); }
  };
}

function makeIndexedDB(initial, failPutAt, failureName) {
  const stores = new Map([
    ['saves', new Map(Object.entries(initial && initial.saves || {}).map(([k, v]) => [k, clone(v)]))],
    ['saveMetadata', new Map(Object.entries(initial && initial.saveMetadata || {}).map(([k, v]) => [k, clone(v)]))],
    ['projects', new Map()],
    ['chronicleRecords', new Map(Object.entries(initial && initial.chronicleRecords || {}).map(([k, v]) => [k, clone(v)]))],
    ['turnPublishReceipts', new Map(Object.entries(initial && initial.turnPublishReceipts || {}).map(([k, v]) => [k, clone(v)]))]
  ]);
  const stats = { readwriteTransactions: 0, puts: 0 };
  const db = {
    objectStoreNames: { contains(name) { return stores.has(name); } },
    close() {},
    transaction(names, mode) {
      if (mode === 'readwrite') stats.readwriteTransactions++;
      const pending = [];
      const tx = { error: null, oncomplete: null, onerror: null, onabort: null };
      tx.objectStore = name => ({
        put(value) { stats.puts++; pending.push({ name, value: clone(value), putNo: stats.puts }); },
        delete(id) { pending.push({ name, deleteId: String(id) }); },
        get(id) {
          const req = {};
          setTimeout(() => { req.result = clone(stores.get(name).get(String(id))); if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
          return req;
        },
        getAll() {
          const req = {};
          setTimeout(() => { req.result = Array.from(stores.get(name).values()).map(clone); if (req.onsuccess) req.onsuccess({ target: req }); }, 0);
          return req;
        }
      });
      setTimeout(() => {
        if (failPutAt && pending.some(op => op.putNo === failPutAt)) {
          tx.error = new Error('injected-idb-write-failure');
          tx.error.name = failureName || 'Error';
          if (tx.onabort) tx.onabort({ target: { error: tx.error } });
          return;
        }
        pending.forEach(op => {
          if (op.deleteId != null) stores.get(op.name).delete(op.deleteId);
          else stores.get(op.name).set(String(op.value.id), clone(op.value));
        });
        if (tx.oncomplete) tx.oncomplete({ target: tx });
      }, 0);
      return tx;
    }
  };
  return {
    stores, stats,
    open() { const req = {}; setTimeout(() => req.onsuccess && req.onsuccess({ target: { result: db } }), 0); return req; }
  };
}

function makeContext(indexedDB, localStorage) {
  const workCounters = Object.create(null);
  const context = {
    console: { log() {}, warn() {}, error() {}, info() {} },
    Promise, Math, Date, JSON, Object, Array, Number, String, Boolean, Error,
    Blob, Response, CompressionStream: undefined, DecompressionStream: undefined, TextDecoder,
    setTimeout, clearTimeout, localStorage, indexedDB,
    navigator: { storage: null },
    TM: { perf: {
      count(name, delta = 1) { workCounters[name] = (workCounters[name] || 0) + Number(delta); },
      withSpan(_name, fn) { return fn(); }
    } },
    workCounters
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-reliability.js'), 'utf8'), context, { filename: 'tm-endturn-reliability.js' });
  vm.runInContext(source, context, { filename: 'tm-storage.js' });
  return context;
}

(async function main() {
  const idb = makeIndexedDB();
  const ctx = makeContext(idb, makeLocalStorage());
  await ctx.TM_SaveDB.open();
  const state = { GM: { turn: 50, _campaignId: 'campaign-state', _timelineId: 'tml_state_12345678' }, P: {} };
  const ok = await ctx.TM_SaveDB.saveManyAtomic([
    { id: 'autosave', gameState: state, meta: { type: 'auto', turn: 50 } },
    { id: 'slot_0', gameState: state, meta: { type: 'auto', turn: 50 } }
  ]);
  check(ok === true && idb.stats.readwriteTransactions === 1, 'both canonical slots use one IndexedDB readwrite transaction');
  check(idb.stores.get('saves').size === 2 && idb.stores.get('saveMetadata').size === 2, 'payloads and metadata commit together');
  check(ctx.workCounters['save.stringify.count'] === 1
    && ctx.workCounters['save.compress.count'] === 1
    && ctx.workCounters['save.payloadReuse.count'] === 1,
  'one canonical state is stringified/compressed once and reused by autosave plus slot_0');
  check(idb.stores.get('saves').get('autosave').gameState === idb.stores.get('saves').get('slot_0').gameState,
  'both canonical slots persist byte-identical payloads');

  const batchReceiptMarker = {
    campaignId: 'campaign-batch-receipt', timelineId: 'tml_batch_12345678', transactionId: 'turn-batch-receipt-12345678', saveName: '测试档',
    turn: 50, stateChecksum: 'checksum-batch-12345678'
  };
  const receiptBatchIdb = makeIndexedDB();
  const receiptBatchCtx = makeContext(receiptBatchIdb, makeLocalStorage());
  await receiptBatchCtx.TM_SaveDB.open();
  const receiptBatchSaved = await receiptBatchCtx.TM_SaveDB.saveManyAtomic([
    { id: 'autosave', gameState: state, meta: { type: 'auto', turn: 50 } },
    { id: 'slot_0', gameState: state, meta: { type: 'auto', turn: 50 } }
  ], { turnPublishReceipt: batchReceiptMarker });
  check(receiptBatchSaved === true && receiptBatchIdb.stats.readwriteTransactions === 1
    && receiptBatchIdb.stores.get('saves').size === 2 && receiptBatchIdb.stores.get('turnPublishReceipts').size === 1,
  'canonical worlds and the world-committed turn receipt commit in one IndexedDB transaction');
  const receiptBatchPuts = receiptBatchIdb.stats.puts;
  const receiptBatchDeleted = await receiptBatchCtx.TM_SaveDB.deleteTurnPublishReceipt(batchReceiptMarker);
  check(receiptBatchDeleted === true && receiptBatchIdb.stats.puts === receiptBatchPuts
    && receiptBatchIdb.stores.get('saves').size === 2 && receiptBatchIdb.stores.get('turnPublishReceipts').size === 0,
  'publishing clears only the lightweight receipt and never rewrites either world payload');

  const legacyChronicle = {
    id: 'chronicle:campaign-legacy:tml_legacy_storage_12345678:2024',
    campaignId: 'campaign-legacy', timelineId: 'tml_legacy_storage_12345678', year: 2024,
    sourceTurn: -1, historyBasisHash: '', migrationState: 'legacy-unassigned', generatedAt: 10,
    chronicle: { content: '隔离旧正史', afterword: '旧史评' }
  };
  const legacyIdb = makeIndexedDB({ chronicleRecords: { [legacyChronicle.id]: legacyChronicle } });
  const legacyCtx = makeContext(legacyIdb, makeLocalStorage());
  await legacyCtx.TM_SaveDB.open();
  const quarantined = await legacyCtx.TM_SaveDB.listQuarantinedChronicleRecords('campaign-legacy');
  let unconfirmedRejected = false;
  try {
    await legacyCtx.TM_SaveDB.importQuarantinedChronicleRecord({ recordId: legacyChronicle.id, confirmed: false });
  } catch (_) { unconfirmedRejected = true; }
  const claimed = await legacyCtx.TM_SaveDB.importQuarantinedChronicleRecord({
    recordId: legacyChronicle.id, confirmed: true, campaignId: 'campaign-legacy', timelineId: 'tml_current_branch_12345678',
    year: 2024, sourceTurn: 12, historyBasisHash: 'chb_current_basis', loadGeneration: 3
  });
  const legacyRows = Array.from(legacyIdb.stores.get('chronicleRecords').values());
  check(quarantined.length === 1 && unconfirmedRejected && claimed.migrationState === 'legacy-confirmed'
    && legacyRows.length === 2 && legacyRows.some(row => row.migrationState === 'legacy-unassigned')
    && legacyRows.some(row => row.timelineId === 'tml_current_branch_12345678' && row.sourceTurn === 12),
  'quarantined legacy chronicles require explicit confirmation and import as a copy bound to the current history basis');

  let duplicateRejected = false;
  try {
    await ctx.TM_SaveDB.saveManyAtomic([
      { id: 'slot_0', gameState: state },
      { id: 'slot_0', gameState: state }
    ]);
  } catch (_) { duplicateRejected = true; }
  check(duplicateRejected, 'duplicate ids are rejected before opening a batch transaction');

  const oldAuto = { id: 'autosave', gameState: 'old-auto' };
  const oldSlot = { id: 'slot_0', gameState: 'old-slot' };
  const failingIdb = makeIndexedDB({ saves: { autosave: oldAuto, slot_0: oldSlot }, saveMetadata: {
    autosave: { id: 'autosave', turn: 49 }, slot_0: { id: 'slot_0', turn: 49 }
  } }, 3);
  const failingCtx = makeContext(failingIdb, makeLocalStorage());
  await failingCtx.TM_SaveDB.open();
  let rejected = false;
  try {
    await failingCtx.TM_SaveDB.saveManyAtomic([
      { id: 'autosave', gameState: state, meta: { turn: 50 } },
      { id: 'slot_0', gameState: state, meta: { turn: 50 } }
    ]);
  } catch (_) { rejected = true; }
  check(rejected && failingIdb.stores.get('saves').get('autosave').gameState === 'old-auto' && failingIdb.stores.get('saves').get('slot_0').gameState === 'old-slot',
    'an injected second-slot failure aborts the complete IndexedDB batch');

  const quotaInitial = {
    saves: {
      autosave: { id: 'autosave', type: 'auto', gameState: 'old-auto' },
      slot_0: { id: 'slot_0', type: 'auto', gameState: 'old-slot' },
      older_auto_1: { id: 'older_auto_1', type: 'auto', gameState: 'disposable' }
    },
    saveMetadata: {
      autosave: { id: 'autosave', type: 'auto', turn: 49, timestamp: 20 },
      slot_0: { id: 'slot_0', type: 'auto', turn: 49, timestamp: 20 },
      older_auto_1: { id: 'older_auto_1', type: 'auto', turn: 12, timestamp: 1 }
    }
  };
  const quotaIdb = makeIndexedDB(quotaInitial, 1, 'QuotaExceededError');
  const quotaCtx = makeContext(quotaIdb, makeLocalStorage());
  await quotaCtx.TM_SaveDB.open();
  const quotaSaved = await quotaCtx.TM_SaveDB.saveManyAtomic([
    { id: 'autosave', gameState: state, meta: { type: 'auto', turn: 50 } },
    { id: 'slot_0', gameState: state, meta: { type: 'auto', turn: 50 } }
  ]);
  check(quotaSaved === true && !quotaIdb.stores.get('saves').has('older_auto_1'),
    'quota failure aborts the batch, deletes one disposable old auto save, then retries once');
  check(JSON.parse(quotaIdb.stores.get('saves').get('autosave').gameState).GM.turn === 50
    && JSON.parse(quotaIdb.stores.get('saves').get('slot_0').gameState).GM.turn === 50,
  'quota recovery still advances both canonical slots together');

  const noDisposableIdb = makeIndexedDB({ saves: { autosave: oldAuto, slot_0: oldSlot }, saveMetadata: {
    autosave: { id: 'autosave', type: 'auto', turn: 49, timestamp: 1 },
    slot_0: { id: 'slot_0', type: 'auto', turn: 49, timestamp: 1 }
  } }, 1, 'QuotaExceededError');
  const noDisposableCtx = makeContext(noDisposableIdb, makeLocalStorage());
  await noDisposableCtx.TM_SaveDB.open();
  const noDisposableSaved = await noDisposableCtx.TM_SaveDB.saveManyAtomic([
    { id: 'autosave', gameState: state, meta: { type: 'auto', turn: 50 } },
    { id: 'slot_0', gameState: state, meta: { type: 'auto', turn: 50 } }
  ]);
  check(noDisposableSaved === false
    && noDisposableIdb.stores.get('saves').get('autosave').gameState === 'old-auto'
    && noDisposableIdb.stores.get('saves').get('slot_0').gameState === 'old-slot',
  'quota recovery never deletes either canonical slot when no disposable auto save exists');

  const singleOnlySlotIdb = makeIndexedDB({ saves: { slot_0: oldSlot }, saveMetadata: {
    slot_0: { id: 'slot_0', type: 'auto', turn: 49, timestamp: 1 }
  } }, 1, 'QuotaExceededError');
  const singleOnlySlotCtx = makeContext(singleOnlySlotIdb, makeLocalStorage());
  await singleOnlySlotCtx.TM_SaveDB.open();
  const singleOnlySlotSaved = await singleOnlySlotCtx.TM_SaveDB.save('slot_0', state, { type: 'auto', turn: 50 });
  check(singleOnlySlotSaved === false && singleOnlySlotIdb.stores.get('saves').get('slot_0').gameState === 'old-slot',
    'single-slot quota recovery never deletes the old target when no disposable save exists');

  const singleCanonicalIdb = makeIndexedDB({ saves: { autosave: oldAuto, slot_0: oldSlot }, saveMetadata: {
    autosave: { id: 'autosave', type: 'auto', turn: 49, timestamp: 1 },
    slot_0: { id: 'slot_0', type: 'auto', turn: 49, timestamp: 2 }
  } }, 1, 'QuotaExceededError');
  const singleCanonicalCtx = makeContext(singleCanonicalIdb, makeLocalStorage());
  await singleCanonicalCtx.TM_SaveDB.open();
  const singleCanonicalSaved = await singleCanonicalCtx.TM_SaveDB.save('slot_0', state, { type: 'auto', turn: 50 });
  check(singleCanonicalSaved === false
    && singleCanonicalIdb.stores.get('saves').get('autosave').gameState === 'old-auto'
    && singleCanonicalIdb.stores.get('saves').get('slot_0').gameState === 'old-slot',
  'single-slot quota recovery protects every canonical recovery slot');

  const singleDisposableIdb = makeIndexedDB(quotaInitial, 1, 'QuotaExceededError');
  const singleDisposableCtx = makeContext(singleDisposableIdb, makeLocalStorage());
  await singleDisposableCtx.TM_SaveDB.open();
  const singleDisposableSaved = await singleDisposableCtx.TM_SaveDB.save('slot_0', state, { type: 'auto', turn: 50 });
  check(singleDisposableSaved === true
    && !singleDisposableIdb.stores.get('saves').has('older_auto_1')
    && singleDisposableIdb.stores.get('saves').get('autosave').gameState === 'old-auto'
    && JSON.parse(singleDisposableIdb.stores.get('saves').get('slot_0').gameState).GM.turn === 50,
  'single-slot quota recovery removes only a disposable auto save before retrying the target');

  const chronicleSaved = await ctx.TM_SaveDB.saveChronicleRecord({
    campaignId: 'campaign-chronicle', timelineId: 'tml_chronicle_12345678', year: 2025, sourceTurn: 12,
    historyBasisHash: 'chb_12345678', requestId: 'req-1', loadGeneration: 3,
    generatedAt: 123, chronicle: { content: '年度正史', afterword: '史评', read: false }
  });
  const chronicleRows = await ctx.TM_SaveDB.listChronicleRecords('campaign-chronicle', 'tml_chronicle_12345678');
  check(chronicleSaved === true && chronicleRows.length === 1
    && chronicleRows[0].chronicle.content === '年度正史' && idb.stores.get('saves').size === 2,
  'annual chronicles checkpoint in a lightweight store without rewriting world saves');

  const receiptMarker = {
    campaignId: 'campaign-receipt', timelineId: 'tml_receipt_12345678', transactionId: 'turn-receipt-12345678', saveName: '测试档',
    turn: 50, stateChecksum: 'checksum-12345678'
  };
  const receiptSaved = await ctx.TM_SaveDB.saveTurnPublishReceipt(receiptMarker, 'world-committed');
  const receiptRows = await ctx.TM_SaveDB.listTurnPublishReceipts('campaign-receipt', 'tml_receipt_12345678', 'world-committed');
  const receiptDeleted = await ctx.TM_SaveDB.deleteTurnPublishReceipt(receiptMarker);
  check(receiptSaved === true && receiptRows.length === 1 && receiptRows[0].transactionId === receiptMarker.transactionId
    && receiptDeleted === true && idb.stores.get('turnPublishReceipts').size === 0,
  'turn bundle receipts use an independent lightweight store with explicit lifecycle');

  const gcIdb = makeIndexedDB();
  const gcCtx = makeContext(gcIdb, makeLocalStorage());
  await gcCtx.TM_SaveDB.open();
  const gcState = { GM: { turn: 12, _campaignId: 'campaign-gc', _timelineId: 'tml_gc_12345678' }, P: {} };
  await gcCtx.TM_SaveDB.save('slot_gc_a', gcState, { name: 'A', type: 'manual', turn: 12 });
  await gcCtx.TM_SaveDB.save('slot_gc_b', gcState, { name: 'B', type: 'manual', turn: 12 });
  await gcCtx.TM_SaveDB.saveChronicleRecord({
    campaignId: 'campaign-gc', timelineId: 'tml_gc_12345678', year: 2025, sourceTurn: 12,
    historyBasisHash: 'chb_gc_12345678', chronicle: { content: 'GC 正史' }
  });
  const gcReceipt = {
    campaignId: 'campaign-gc', timelineId: 'tml_gc_12345678', transactionId: 'turn-gc-12345678',
    turn: 12, stateChecksum: 'checksum-gc-12345678'
  };
  await gcCtx.TM_SaveDB.saveTurnPublishReceipt(gcReceipt, 'world-committed');
  await gcCtx.TM_SaveDB.delete('slot_gc_a');
  check(gcIdb.stores.get('chronicleRecords').size === 1 && gcIdb.stores.get('turnPublishReceipts').size === 1,
    'deleting one save keeps auxiliary records while another save still references the timeline');
  await gcCtx.TM_SaveDB.delete('slot_gc_b');
  check(gcIdb.stores.get('chronicleRecords').size === 0 && gcIdb.stores.get('turnPublishReceipts').size === 0,
    'deleting the final timeline save garbage-collects its chronicle and receipt records');

  const desktopGcIdb = makeIndexedDB();
  const desktopGcCtx = makeContext(desktopGcIdb, makeLocalStorage());
  let desktopRefs = [{ storageKey: 'manual-desktop', campaignId: 'campaign-desktop-gc', timelineId: 'tml_desktop_gc_12345678' }];
  let desktopRefsComplete = true;
  desktopGcCtx.tianming = {
    isDesktop: true,
    async listSaveTimelineRefs() { return { success: true, complete: desktopRefsComplete, refs: desktopRefs }; }
  };
  await desktopGcCtx.TM_SaveDB.open();
  const desktopGcState = { GM: { turn: 8, _campaignId: 'campaign-desktop-gc', _timelineId: 'tml_desktop_gc_12345678' }, P: {} };
  await desktopGcCtx.TM_SaveDB.save('slot_desktop_gc', desktopGcState, { type: 'manual', turn: 8 });
  await desktopGcCtx.TM_SaveDB.saveChronicleRecord({
    campaignId: 'campaign-desktop-gc', timelineId: 'tml_desktop_gc_12345678', year: 2024, sourceTurn: 8,
    historyBasisHash: 'chb_desktop_gc_12345678', chronicle: { content: '桌面分支正史' }
  });
  await desktopGcCtx.TM_SaveDB.delete('slot_desktop_gc');
  check(desktopGcIdb.stores.get('chronicleRecords').size === 1,
    'desktop sidecar reference keeps auxiliary records after the final IndexedDB slot is removed');
  desktopRefs = [];
  desktopRefsComplete = false;
  await desktopGcCtx.TM_SaveDB.save('slot_desktop_gc_retry', desktopGcState, { type: 'manual', turn: 8 });
  await desktopGcCtx.TM_SaveDB.delete('slot_desktop_gc_retry');
  check(desktopGcIdb.stores.get('chronicleRecords').size === 1,
    'incomplete desktop reference registry makes auxiliary GC fail closed');
  desktopRefsComplete = true;
  await desktopGcCtx.TM_SaveDB.save('slot_desktop_gc_final', desktopGcState, { type: 'manual', turn: 8 });
  await desktopGcCtx.TM_SaveDB.delete('slot_desktop_gc_final');
  check(desktopGcIdb.stores.get('chronicleRecords').size === 0,
    'auxiliary records are collected only after both IndexedDB and complete desktop registries have no references');

  const oldBranchState = { GM: { turn: 20, _campaignId: 'campaign-overwrite', _timelineId: 'tml_overwrite_old_12345678' }, P: {} };
  await gcCtx.TM_SaveDB.save('slot_overwrite', oldBranchState, { type: 'manual', turn: 20 });
  await gcCtx.TM_SaveDB.saveChronicleRecord({
    campaignId: 'campaign-overwrite', timelineId: 'tml_overwrite_old_12345678', year: 2030, sourceTurn: 20,
    historyBasisHash: 'chb_overwrite_12345678', chronicle: { content: '旧分支正史' }
  });
  const newBranchState = { GM: { turn: 10, _campaignId: 'campaign-overwrite', _timelineId: 'tml_overwrite_new_12345678' }, P: {} };
  await gcCtx.TM_SaveDB.save('slot_overwrite', newBranchState, { type: 'manual', turn: 10 });
  check(gcIdb.stores.get('chronicleRecords').size === 0,
    'overwriting the final save reference with a new timeline garbage-collects the orphaned old branch');

  const marker = { transactionId: 'turn-marker-12345678', campaignId: 'campaign-1', timelineId: 'tml_marker_12345678', turn: 50 };
  const markerState = { GM: { turn: 51, _pendingTurnDataPublish: marker }, P: {} };
  const markerIdb = makeIndexedDB({ saves: {
    autosave: { id: 'autosave', type: 'auto', turn: 51, gameState: JSON.stringify(markerState), _compressed: false },
    slot_0: { id: 'slot_0', type: 'auto', turn: 51, gameState: JSON.stringify(markerState), _compressed: false }
  }, saveMetadata: {
    autosave: { id: 'autosave', type: 'auto', turn: 51 }, slot_0: { id: 'slot_0', type: 'auto', turn: 51 }
  } });
  const markerCtx = makeContext(markerIdb, makeLocalStorage());
  await markerCtx.TM_SaveDB.open();
  const markerCleared = await markerCtx.TM_SaveDB.clearPendingTurnDataPublishAtomic(['autosave', 'slot_0'], marker.transactionId);
  const clearedAuto = await markerCtx.TM_SaveDB.load('autosave');
  const clearedSlot = await markerCtx.TM_SaveDB.load('slot_0');
  check(markerCleared === true && !clearedAuto.gameState.GM._pendingTurnDataPublish && !clearedSlot.gameState.GM._pendingTurnDataPublish,
    'successful turn-data publish checkpoint clears both canonical markers atomically');

  const keys = {
    auto: 'tm_idb_saves_autosave', autoMeta: 'tm_idb_saveMetadata_autosave',
    slot: 'tm_idb_saves_slot_0', slotMeta: 'tm_idb_saveMetadata_slot_0'
  };
  const initial = { [keys.auto]: 'old-auto', [keys.autoMeta]: 'old-auto-meta', [keys.slot]: 'old-slot', [keys.slotMeta]: 'old-slot-meta' };
  const local = makeLocalStorage(initial, keys.slotMeta);
  const localCtx = makeContext(null, local);
  await localCtx.TM_SaveDB.open();
  rejected = false;
  try {
    await localCtx.TM_SaveDB.saveManyAtomic([
      { id: 'autosave', gameState: state, meta: { turn: 50 } },
      { id: 'slot_0', gameState: state, meta: { turn: 50 } }
    ]);
  } catch (_) { rejected = true; }
  check(rejected && Object.entries(initial).every(([k, v]) => local.getItem(k) === v), 'localStorage failure restores all four prior values');
  check(local.getItem('tm_save_batch_journal_v1') === null, 'successful rollback removes the local batch journal');

  const localReceipt = makeLocalStorage();
  const localReceiptCtx = makeContext(null, localReceipt);
  await localReceiptCtx.TM_SaveDB.open();
  const localReceiptSaved = await localReceiptCtx.TM_SaveDB.saveManyAtomic([
    { id: 'autosave', gameState: state, meta: { type: 'auto', turn: 50 } },
    { id: 'slot_0', gameState: state, meta: { type: 'auto', turn: 50 } }
  ], { turnPublishReceipt: batchReceiptMarker });
  const localReceiptKey = Array.from(localReceipt.rows.keys()).find(key => key.indexOf('tm_idb_turnPublishReceipts_') === 0);
  check(localReceiptSaved === true && !!localReceiptKey && localReceipt.getItem('tm_save_batch_journal_v1') === null,
    'localStorage journal commits canonical worlds and the lightweight receipt as one recoverable batch');

  const localQuotaInitial = {
    [keys.auto]: JSON.stringify({ id: 'autosave', type: 'auto', name: 'old auto', timestamp: 20, turn: 49, gameState: JSON.stringify({ GM: { turn: 49 }, P: {} }) }),
    [keys.autoMeta]: JSON.stringify({ id: 'autosave', type: 'auto', name: 'old auto', turn: 49, timestamp: 20 }),
    [keys.slot]: JSON.stringify({ id: 'slot_0', type: 'auto', name: 'old slot', timestamp: 20, turn: 49, gameState: JSON.stringify({ GM: { turn: 49 }, P: {} }) }),
    [keys.slotMeta]: JSON.stringify({ id: 'slot_0', type: 'auto', name: 'old slot', turn: 49, timestamp: 20 }),
    tm_idb_saves_older_auto_1: JSON.stringify({ id: 'older_auto_1', type: 'auto', gameState: '{}' }),
    tm_idb_saveMetadata_older_auto_1: JSON.stringify({ id: 'older_auto_1', type: 'auto', turn: 12, timestamp: 1 })
  };
  const localQuota = makeLocalStorage(localQuotaInitial, keys.slotMeta, 'QuotaExceededError');
  const localQuotaCtx = makeContext(null, localQuota);
  await localQuotaCtx.TM_SaveDB.open();
  const localQuotaSaved = await localQuotaCtx.TM_SaveDB.saveManyAtomic([
    { id: 'autosave', gameState: state, meta: { type: 'auto', turn: 50 } },
    { id: 'slot_0', gameState: state, meta: { type: 'auto', turn: 50 } }
  ]);
  check(localQuotaSaved === true
    && localQuota.getItem('tm_idb_saves_older_auto_1') === null
    && localQuota.getItem('tm_idb_saveMetadata_older_auto_1') === null,
  'localStorage quota recovery restores the batch, removes one disposable auto save, and retries once');
  check(JSON.parse(JSON.parse(localQuota.getItem(keys.auto)).gameState).GM.turn === 50
    && JSON.parse(JSON.parse(localQuota.getItem(keys.slot)).gameState).GM.turn === 50,
  'localStorage quota recovery still advances both canonical slots together');

  const localSingleQuota = makeLocalStorage(localQuotaInitial, keys.slotMeta, 'QuotaExceededError');
  const localSingleQuotaCtx = makeContext(null, localSingleQuota);
  await localSingleQuotaCtx.TM_SaveDB.open();
  const localSingleSaved = await localSingleQuotaCtx.TM_SaveDB.save('slot_0', state, { type: 'auto', turn: 50 });
  check(localSingleSaved === true
    && localSingleQuota.getItem('tm_idb_saves_older_auto_1') === null
    && JSON.parse(localSingleQuota.getItem(keys.auto)).gameState === JSON.parse(localQuotaInitial[keys.auto]).gameState
    && JSON.parse(JSON.parse(localSingleQuota.getItem(keys.slot)).gameState).GM.turn === 50,
  'localStorage single-slot quota recovery preserves canonical slots and removes only disposable autos');

  const preparedItems = Object.entries(initial).map(([key, previous]) => ({ key, previous }));
  const crashLocal = makeLocalStorage(Object.assign({}, initial, {
    [keys.auto]: 'new-auto',
    tm_save_batch_journal_v1: JSON.stringify({ version: 1, phase: 'prepared', items: preparedItems })
  }));
  const crashCtx = makeContext(null, crashLocal);
  await crashCtx.TM_SaveDB.open();
  check(crashLocal.getItem(keys.auto) === 'old-auto' && crashLocal.getItem('tm_save_batch_journal_v1') === null,
    'open recovers a crash left in prepared phase');

  const committedLocal = makeLocalStorage(Object.assign({}, initial, {
    [keys.auto]: 'new-auto',
    [keys.autoMeta]: 'new-auto-meta',
    [keys.slot]: 'new-slot',
    [keys.slotMeta]: 'new-slot-meta',
    tm_save_batch_journal_v1: JSON.stringify({ version: 1, phase: 'committed', items: preparedItems })
  }));
  const committedCtx = makeContext(null, committedLocal);
  await committedCtx.TM_SaveDB.open();
  check(committedLocal.getItem(keys.auto) === 'new-auto' && committedLocal.getItem(keys.slot) === 'new-slot' &&
    committedLocal.getItem('tm_save_batch_journal_v1') === null,
  'open keeps the new batch when a crash occurs after the committed journal marker');

  const corruptLocal = makeLocalStorage({ tm_save_batch_journal_v1: '{broken-json' });
  const corruptCtx = makeContext(null, corruptLocal);
  await corruptCtx.TM_SaveDB.open();
  check(corruptLocal.getItem('tm_save_batch_journal_v1') === null,
    'a corrupt journal is discarded instead of permanently blocking storage startup');

  console.log('[smoke-storage-atomic-batch] PASS assertions=' + assertions);
})().catch(error => {
  console.error(error && error.stack || error);
  process.exit(1);
});
