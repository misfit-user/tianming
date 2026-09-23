#!/usr/bin/env node
'use strict';
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), assert = require('node:assert/strict');
const source = fs.readFileSync(path.join(__dirname, '../tm-save-lifecycle.js'), 'utf8');
const managerSource = fs.readFileSync(path.join(__dirname, '../tm-save-manager.js'), 'utf8');
const startupMark = source.indexOf('// 启动不读取整份桌面自动存档');
const startup = source.slice(source.lastIndexOf('if(_tmHasNativeFs()){', startupMark), source.indexOf('// 6b.', startupMark));
assert(startupMark > 0 && !startup.includes('loadAutoSave'), 'native startup does not deserialize full backup just to detect it');
let passed = 0, failed = 0;
async function test(label, fn) { try { await fn(); passed++; console.log('PASS ' + label); } catch (e) { failed++; console.error('FAIL ' + label + '\n' + e.stack); } }
function context(response) {
  const calls = { reads: 0, confirm: 0, load: [], timer: [], saved: 0, closed: 0, loading: 0, notices: [] };
  const c = { console: { log() {}, warn() {}, error() {} }, P: { scenarios: [], ai: { key: 'fixture-local-only' } }, GM: { running: false },
    _tmHasNativeFs: () => true, setInterval: (fn, ms) => calls.timer.push({ fn, ms }),
    _tmRunDesktopAutoSaveTick: async () => { calls.saved++; }, confirm: () => { calls.confirm++; return false; },
    showLoading: () => { calls.loading = 1; }, hideLoading: () => { calls.loading = 0; }, toast: m => calls.notices.push(m),
    fullLoadGame: async (data, options) => calls.load.push({ data, options }), closeSaveManager: () => calls.closed++,
    tianming: { loadAutoSave: async () => { calls.reads++; if (response instanceof Error) throw response; return response; } } };
  c.window = c; vm.createContext(c); return { c, calls };
}
const drain = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  for (const turn of [1, 25]) await test('startup with T' + turn + ' stays on menu without a restore prompt or implicit load', async () => {
    const payload = { success: true, data: { gameState: { running: true, turn }, scenarios: [{ id: 'saved-world' }] } };
    const before = JSON.stringify(payload), { c, calls } = context(payload); vm.runInContext(startup, c); await drain();
    assert.equal(calls.reads, 0); assert.equal(calls.confirm, 0); assert.equal(calls.load.length, 0); assert.equal(c.P.scenarios.length, 0); assert.equal(JSON.stringify(payload), before);
  });
  await test('lifecycle leaves legacy project recovery to the unified project owner', async () => {
    const { c, calls } = context({ success: true, data: { scenarios: [{ id: 'legacy-project' }], gameState: { running: false } } });
    vm.runInContext(startup, c); await drain(); assert.equal(c.P.scenarios.length, 0); assert.equal(calls.reads, 0); assert.equal(calls.confirm, 0); assert.equal(calls.load.length, 0);
  });
  await test('missing or unreadable autosave does not block startup', async () => {
    for (const response of [{ success: false }, new Error('fixture read failed')]) {
      const { c, calls } = context(response); vm.runInContext(startup, c); await drain(); assert.equal(calls.confirm, 0); assert.equal(calls.load.length, 0);
    }
  });
  await test('native periodic autosave remains enabled at 60 seconds', async () => {
    const { c, calls } = context({ success: false }); vm.runInContext(startup, c); await drain();
    assert.equal(calls.timer.length, 1); assert.equal(calls.timer[0].ms, 60000); await calls.timer[0].fn(); assert.equal(calls.saved, 1);
  });
  await test('manual desktop recovery uses the validated autosave endpoint and session token', async () => {
    const begin = source.indexOf('window.desktopLoadSave=async function');
    const end = source.indexOf('window.desktopDeleteSave=', begin);
    assert(begin >= 0 && end > begin, 'manual recovery provider exists');
    const response = { success: true, sessionToken: 'fixture-session', data: { gameState: { running: true, turn: 25 } } };
    const { c, calls } = context(response); vm.runInContext(source.slice(begin, end), c);
    const aliasStart = managerSource.indexOf('window.desktopLoadAutoSave=async function');
    const aliasEnd = managerSource.indexOf('function loadDesktopAutoSave()', aliasStart);
    assert(aliasStart > 0 && aliasEnd > aliasStart); vm.runInContext(managerSource.slice(aliasStart, aliasEnd), c);
    assert.equal(await c.desktopLoadAutoSave(), true); assert.equal(calls.load.length, 1);
    assert.equal(calls.load[0].data, response.data); assert.equal(calls.load[0].options.autoSaveSessionToken, 'fixture-session');
    assert.equal(calls.closed, 1); assert.equal(calls.loading, 0); assert.equal(calls.confirm, 0);
  });
  await test('load cleanup preserves current authored identities whose names overlap heuristic stopwords', async () => {
    const { c } = context({ success: false });
    c.GM.sid = 'current';
    c.P.scenarios = [{ id: 'current', characters: [{ id: 'authored', name: '安邦彦' }] }, { id: 'other', characters: [{ id: 'foreign-source', name: '安邦某' }] }];
    c.GM.chars = [{ id: 'authored', name: '安邦彦' }, { id: 'junk', name: '安邦' }, { id: 'foreign-source', name: '安邦某' }];
    c.GM._pendingCharacters = [{ name: '安邦' }];
    const projectBefore = JSON.stringify(c.P);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../tm-char-autogen.js'), 'utf8'), c);
    const result = c.purgeBlacklistedCharacters();
    assert.deepEqual(Array.from(c.GM.chars, ch => ch.id), ['authored']);
    assert.equal(result.chars.length, 2); assert.equal(result.pending.length, 1); assert.equal(JSON.stringify(c.P), projectBefore);
  });
  await test('manual recovery errors leave the load manager open and never claim success', async () => {
    for (const failLoad of [false, true]) {
      const response = failLoad ? { success: true, data: { gameState: { running: true } } } : { success: false };
      const { c, calls } = context(response);
      if (failLoad) c.fullLoadGame = async () => { throw Error('fixture load failed'); };
      vm.runInContext(source.slice(source.indexOf('window.desktopLoadSave=async function'), source.indexOf('window.desktopDeleteSave=')), c);
      vm.runInContext(managerSource.slice(managerSource.indexOf('window.desktopLoadAutoSave=async function'), managerSource.indexOf('function loadDesktopAutoSave()')), c);
      assert.equal(await c.desktopLoadAutoSave(), false); assert.equal(calls.closed, 0); assert.equal(calls.loading, 0); assert(calls.notices.length);
    }
  });
  await test('the manual UI asks only after a click and waits for explicit consent before loading', async () => {
    const { c } = context({ success: false }); let dialog = null, loads = 0;
    c.desktopLoadAutoSave = () => { loads++; }; c.showScrollConfirm = opts => { dialog = opts; };
    vm.runInContext(managerSource.slice(managerSource.indexOf('function loadDesktopAutoSave()'), managerSource.indexOf('function loadSaveSlot(')), c);
    assert.equal(loads, 0); assert.equal(dialog, null); c.loadDesktopAutoSave(); assert(dialog); assert.equal(loads, 0);
    dialog.onOk(); assert.equal(loads, 1);
  });
  console.log(`startup autosave: ${passed} PASS / ${failed} FAIL`); process.exitCode = failed ? 1 : 0;
})();
