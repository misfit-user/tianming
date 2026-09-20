'use strict';
// Isolated database-event fixture. Never opens player storage or makes network requests.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
const clone = value => value == null ? value : structuredClone(value);
const tick = async () => { for (let i = 0; i < 5; i++) await new Promise(resolve => setImmediate(resolve)); };
function fixture(options = {}, root = ROOT) {
  const timers = new Map(), opens = [], txs = [], stores = new Map(), events = [];
  let timerId = 0;
  const c = {
    console: { log() {}, warn() { events.push('warning'); } }, Date, Promise, structuredClone, TextEncoder,
    crypto: { randomUUID: () => 'fixture-id' },
    GM: { turn: 3, _campaignId: 'tmc_fixture', _timelineId: 'tml_fixture_branch_1234', chars: [{ id: 'one', name: '甲' }], history: '完整记忆'.repeat(20) },
    P: { conf: { quality: 'full' } },
    setTimeout(fn, ms) { const id = ++timerId; timers.set(id, { fn, ms }); return id; },
    clearTimeout(id) { timers.delete(id); }, addEventListener() {},
    _buildSaveState(opts) { return { GM: clone(opts.gm), P: clone(opts.p) }; }
  };
  function rows(name) { if (!stores.has(name)) stores.set(name, new Map()); return stores.get(name); }
  function readRequest(value, hold) {
    const req = {};
    if (!hold) setImmediate(() => req.onsuccess && req.onsuccess({ target: { result: clone(value) } }));
    return req;
  }
  function database() {
    const db = { closes: 0, close() { this.closes++; }, objectStoreNames: { contains: () => true }, createObjectStore() { throw Error('Unexpected migration'); } };
    db.transaction = (names, mode) => {
      const list = Array.isArray(names) ? names : [names], staged = [];
      const tx = { db, mode, names: list, aborted: false, finished: false, abortCalls: 0 };
      txs.push(tx);
      tx.abort = () => {
        tx.abortCalls++;
        if (options.abortThrows) throw Error('Commit outcome unavailable');
        if (tx.finished) throw Error('Already complete');
        tx.aborted = true; tx.error = Error('Fixture abort');
        if (tx.onabort) tx.onabort({ target: tx });
      };
      tx.complete = () => {
        if (tx.aborted || tx.finished) return;
        tx.finished = true;
        for (const x of staged) {
          if (x.op === 'put') rows(x.store).set(x.key, clone(x.value));
          else rows(x.store).delete(x.key);
        }
        events.push('commit'); if (tx.oncomplete) tx.oncomplete();
      };
      let scheduled = false;
      function schedule(op) {
        if (scheduled) return; scheduled = true;
        if (!(options.holdWrites && op === 'put') && !(options.holdCleanup && op === 'delete')) setImmediate(tx.complete);
      }
      tx.objectStore = name => ({
        put(value) {
          if (options.failLineagePut && name === 'timeline_graph') throw Error('Fixture lineage put failed');
          staged.push({ op: 'put', store: name, key: value.id, value: clone(value) }); schedule('put'); return {};
        },
        delete(key) { staged.push({ op: 'delete', store: name, key }); schedule('delete'); return {}; },
        get(key) { return readRequest(rows(name).get(key), options.holdReads); },
        index() {
          const selected = query => [...rows(name).values()].filter(r => r.campaignId === query[0] && r.timelineId === query[1]);
          const index = {
            getAll(query) { return readRequest(selected(query), options.holdReads); },
            getAllKeys(query) { return readRequest(selected(query).map(r => r.id), options.holdKeys); }
          };
          if (options.cursorOnly) {
            delete index.getAllKeys;
            index.openKeyCursor = () => {
              const req = { result: { primaryKey: 'fixture-key', continue() { events.push('cursor-continued'); } } };
              options.cursorRequest = req; return req;
            };
          }
          return index;
        }
      });
      return tx;
    };
    return db;
  }
  c.indexedDB = { open() {
    if (options.throwOpen) throw Error('Fixture open failure');
    const req = {}, db = database();
    req.database = db; req.succeed = () => req.onsuccess && req.onsuccess({ target: { result: db } });
    opens.push(req); if (!options.holdOpen) setImmediate(req.succeed); return req;
  } };
  c.window = c; vm.createContext(c);
  vm.runInContext(fs.readFileSync(path.join(root, 'tm-state-snapshot.js'), 'utf8'), c, { filename: 'tm-state-snapshot.js' });
  function fire(ms) {
    let count = 0;
    for (const [id, timer] of [...timers]) if (timer.ms === ms) { timers.delete(id); timer.fn(); count++; }
    return count;
  }
  function seed(count) {
    for (let t = 0; t < count; t++) {
      const record = { id: c.GM._campaignId + ':' + c.GM._timelineId + ':' + t, turn: t, campaignId: c.GM._campaignId, timelineId: c.GM._timelineId, state: { GM: { ...clone(c.GM), turn: t }, P: clone(c.P) } };
      rows('snapshots_v2').set(record.id, record);
    }
  }
  return { c, options, timers, opens, txs, stores, events, rows, fire, seed, save() { return c.StateSnapshot.save(c.GM.turn); } };
}
module.exports = { fixture, tick, clone, ROOT };
