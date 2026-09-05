'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert');
const source = fs.readFileSync(path.join(__dirname, '../tm-save-manager.js'), 'utf8');
function harness() {
  const notices = [], writes = [], idx = new Map();
  const c = { Promise, console: { log() {}, error() {} }, Blob, GM: { running: true, turn: 7 }, P: {},
    toast: x => notices.push(x), localStorage: { getItem: k => idx.get(k), setItem: (k, v) => idx.set(k, v) },
    _tmAwaitLoadBarrier: async () => {}, _awaitPostTurnJobsForSave: async () => {}, _buildSaveState: () => ({ GM: { turn: 7 }, P: {} }),
    TM_SaveDB: { isAvailable: () => true, save: async (...args) => { writes.push(args); return true; }, delete: async () => true, load: async () => null },
    showLoading() {}, hideLoading() {}, setTimeout: fn => { queueMicrotask(fn); return 1; } };
  c.window = c; vm.createContext(c); vm.runInContext(source, c);
  c._playJadeSealAnimation = () => {}; c.closeSaveManager = () => notices.push('close'); c.openSaveManager = () => notices.push('open'); c.showPrompt = (s, name, cb) => cb(name);
  return { c, notices, writes, idx };
}
(async () => {
  for (const fault of ['true', 'false', 'reject', 'quota', 'barrier', 'snapshot']) {
    const h = harness();
    if (fault === 'false') h.c.TM_SaveDB.save = async () => false;
    if (fault === 'reject' || fault === 'quota') h.c.TM_SaveDB.save = async () => { throw new Error(fault); };
    if (fault === 'barrier') h.c._tmAwaitLoadBarrier = async () => { throw new Error('barrier'); };
    if (fault === 'snapshot') h.c._buildSaveState = () => { throw new Error('snapshot'); };
    h.c.TM = { errors: { capture() { throw new Error('diagnostic'); } } };
    const result = await h.c.saveToSlot(1); assert.strictEqual(result, fault === 'true', fault);
    assert.equal(h.idx.size > 0, result); assert.equal(h.notices.includes('open'), result);
    if (!result) assert(!h.notices.some(x => /已保存|已载入编年/.test(x)));
  }
  const h = harness(); let release;
  h.c.TM_SaveDB.save = () => new Promise(resolve => { release = resolve; });
  let finished = false; const p = h.c.saveToSlot(1).then(x => { finished = true; return x; });
  await new Promise(setImmediate); assert.equal(finished, false); release(true); assert.equal(await p, true);
  for (const value of [true, false, 'reject']) {
    h.c.TM_SaveDB.delete = async () => { if (value === 'reject') throw new Error('delete'); return value; };
    assert.equal(await h.c.SaveManager.deleteSlot(1), value === true);
  }
  h.c.TM_SaveDB.load = async () => ({ name: 'slot', gameState: { GM: { turn: 1 }, P: {} } });
  let loaded = false; h.c.fullLoadGame = async () => { await new Promise(setImmediate); loaded = true; };
  assert.equal(await h.c.SaveManager.loadFromSlot(1), true); assert(loaded);
  h.c.TM_SaveDB.load = async () => { throw new Error('load'); }; assert.equal(await h.c.SaveManager.loadFromSlot(1), false);
  console.log('PASS save slot boolean results, awaited wrappers, quota/barrier/snapshot failures and load/delete completion');
})().catch(e => { console.error(e); process.exitCode = 1; });
