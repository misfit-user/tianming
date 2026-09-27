'use strict';
// Isolated storage tests: no network or player database access.
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const clone = value => value == null ? value : structuredClone(value);
const tick = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
function fixture(options = {}, root = ROOT) {
  const stores = new Map(), local = new Map(), events = [], requests = [], transactions = [], opens = [], timers = new Map();
  let nextTimer = 0;
  function rows(name) { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name); }
  const c = {
    console: { log() {}, warn() { events.push('warning'); }, error() { events.push('error'); } },
    Date, Promise, JSON, Object, Array, Number, Set, Map, Blob, Response, TextEncoder, TextDecoder, structuredClone,
    navigator: { storage: {} },
    setTimeout(fn, ms) { const id = ++nextTimer; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); }
  };
  c.localStorage = {
    get length() { return local.size; }, key(i) { return [...local.keys()][i] || null; },
    getItem(key) { return local.get(key) || null; },
    setItem(key, value) { if (options.localFailure) throw Error('Fixture local write failure'); local.set(key, String(value)); },
    removeItem(key) { local.delete(key); }
  };
  function database() {
    const db = { closes: 0, close() { this.closes++; }, objectStoreNames: { contains: () => true }, createObjectStore() { events.push('upgrade-created-store'); return {}; } };
    db.transaction = (names, mode) => {
      if (options.throwTransaction) throw Error('Fixture transaction failure');
      const tx = { db, names: Array.isArray(names) ? names : [names], mode, staged: [], aborted: false, finished: false, abortCalls: 0 };
      transactions.push(tx);
      tx.abort = () => {
        tx.abortCalls++;
        if (options.abortThrows) throw Error('Fixture abort unavailable');
        if (tx.finished) throw Error('Already finished');
        tx.aborted = true; tx.error = Error('Fixture abort');
        if (tx.onabort) tx.onabort({ target: tx });
      };
      tx.complete = () => {
        if (tx.aborted || tx.finished) return;
        tx.finished = true;
        tx.staged.forEach(x => x.delete ? rows(x.store).delete(x.key) : rows(x.store).set(x.key, clone(x.value)));
        events.push('commit'); if (tx.oncomplete) tx.oncomplete({ target: tx });
      };
      let scheduled = false;
      function schedule() { if (scheduled) return; scheduled = true; if (!options.holdWrites) setImmediate(tx.complete); }
      function request(kind, store, value) {
        const req = { tx, kind, store, result: undefined };
        req.succeed = () => { req.result = clone(value); if (req.onsuccess) req.onsuccess({ target: req }); };
        req.fail = error => { req.error = error; if (req.onerror) req.onerror({ target: req }); };
        requests.push(req); events.push('read:' + kind);
        const held = options.holdReads === true || typeof options.holdReads === 'function' && options.holdReads(kind, store);
        if (!held) setImmediate(() => { if (!tx.aborted) req.succeed(); });
        return req;
      }
      tx.objectStore = name => ({
        put(value) { tx.staged.push({ store: name, key: value.id, value: clone(value) }); schedule(); return {}; },
        delete(key) { tx.staged.push({ store: name, key, delete: true }); schedule(); return {}; },
        get(key) { return request('get', name, rows(name).get(key)); },
        getAll() { return request('getAll', name, [...rows(name).values()]); },
        index(indexName) {
          if (options.missingIndex) throw Object.assign(Error('Fixture missing index'), { name: 'NotFoundError' });
          return { getAll(query) {
            const selected = [...rows(name).values()].filter(row => {
              const key = indexName === 'campaignTimelineStatus' ? [row.campaignId, row.timelineId, row.status] : [row.campaignId, row.timelineId];
              return JSON.stringify(key) === JSON.stringify(query);
            });
            return request('index', name, selected);
          } };
        }
      });
      return tx;
    };
    return db;
  }
  c.indexedDB = { open() {
    if (options.throwOpen) throw Error('Fixture open failure');
    const req = { database: database() };
    req.succeed = () => { if (req.onsuccess) req.onsuccess({ target: { result: req.database } }); };
    req.fail = () => { if (req.onerror) req.onerror({ target: { error: Error('Fixture opening rejected') } }); };
    req.block = () => { if (req.onblocked) req.onblocked({ target: req }); };
    req.upgrade = () => { const tx = { abortCalls: 0, abort() { this.abortCalls++; } }; if (req.onupgradeneeded) req.onupgradeneeded({ oldVersion: 0, target: { result: req.database, transaction: tx } }); return tx; };
    opens.push(req); if (!options.holdOpen) setImmediate(req.succeed); return req;
  } };
  if (options.noIndexedDB) c.indexedDB = undefined;
  c.window = c; vm.createContext(c);
  const source = fs.readFileSync(path.join(root, 'tm-storage.js'), 'utf8');
  const footer = source.indexOf('// 页面加载时立即打开数据库并迁移旧存档');
  if (footer < 0) throw Error('Storage startup boundary not found');
  vm.runInContext(source.slice(0, footer), c, { filename: 'tm-storage.js' });
  function fire(ms) { let count = 0; for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); count++; } return count; }
  function seed(id = 'autosave', turn = 4) {
    const state = { GM: { turn, _campaignId: 'tmc_fixture', _timelineId: 'tml_fixture_branch_1234', fullNarrative: '完整世界正文与长期记忆。'.repeat(40) }, P: { conf: { quality: 'full' } } };
    const record = { id, type: 'auto', name: 'Fixture full save', timestamp: 1, turn, campaignId: state.GM._campaignId, timelineId: state.GM._timelineId, _compressed: false, gameState: JSON.stringify(state) };
    rows('saves').set(id, clone(record)); rows('saveMetadata').set(id, { ...record, gameState: undefined });
    return state;
  }
  return { c, options, stores, local, events, requests, transactions, opens, timers, rows, fire, seed, api: c.TM_SaveDB };
}
module.exports = { fixture, tick, clone, ROOT };
