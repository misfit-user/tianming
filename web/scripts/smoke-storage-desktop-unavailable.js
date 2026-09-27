'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), acorn = require('acorn');
const { fixture, tick, ROOT } = require('./lib-storage-read-deadlines');
let checks = 0;
function check(value, message) { assert.ok(value, message); checks++; }
function loadFunctions(context, file, names) {
  const source = fs.readFileSync(path.join(ROOT, file), 'utf8');
  const ast = acorn.parse(source, { ecmaVersion: 'latest', allowReturnOutsideFunction: true });
  for (const name of names) {
    const fn = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === name);
    assert.ok(fn, name); vm.runInContext(source.slice(fn.start, fn.end), context, { filename: file });
  }
}
(async () => {
  const f = fixture({ holdOpen: true }); f.c.tianming = { isDesktop: true };
  const old = { tm_api: '{"key":"fixture-private-key"}', tm_P_lite: '{"conf":{"retained":true}}', tm_save_index: '{"slot_1":{"turn":8}}' };
  Object.entries(old).forEach(([k, v]) => f.local.set(k, v));
  f.seed('slot_1', 8);
  const realOpen = f.c.indexedDB.open;
  f.c.indexedDB.open = function () {
    const req = realOpen();
    setImmediate(() => req.onerror({ target: { error: Object.assign(new Error('Internal error.'), { name: 'UnknownError' }) } }));
    return req;
  };
  check(f.api.writeStatus().blocked, 'desktop is not writable before storage is ready');
  for (const operation of [() => f.api.list(), () => f.api.load('slot_1'), () => f.api.loadProject(),
    () => f.api.save('autosave', { GM: { turn: 0 }, P: {} }), () => f.api.saveProject({ conf: {} })]) {
    await assert.rejects(operation, error => error.code === 'SAVE_DATABASE_UNAVAILABLE' && error.causeName === 'UnknownError'); checks++;
    assert.deepEqual(Object.fromEntries(f.local), old); checks++;
  }
  check(f.api.writeStatus().blocked, 'failed database open is not an empty healthy database');
  const toasts = []; f.c.toast = text => toasts.push(text);
  f.c.P = { ai: { key: 'old-memory-key' }, conf: { retained: true }, gameState: { retained: true } };
  loadFunctions(f.c, 'tm-patches.js', ['_sDeviceSettingsReady', '_sApplyPrimaryApiFields', 'sSaveAPI', 'sSaveAll', 'sSaveSecondaryAPI', 'sClearSecondaryAPI']);
  loadFunctions(f.c, 'tm-player-settings.js', ['_saveSecondaryAPI']);
  loadFunctions(f.c, 'tm-utils.js', ['saveP']);
  const before = JSON.stringify(f.c.P);
  delete f.c.TM_SaveDB;
  check(f.c.saveP() === false && JSON.stringify(f.c.P) === before, 'early desktop startup cannot persist defaults before the storage script loads');
  assert.deepEqual(Object.fromEntries(f.local), old); checks++;
  f.c.TM_SaveDB = f.api;
  for (const name of ['sSaveAPI', 'sSaveAll', 'sSaveSecondaryAPI', 'sClearSecondaryAPI', '_saveSecondaryAPI', 'saveP']) {
    check(f.c[name]() === false, name + ' refuses persistence while storage is unreadable');
    check(JSON.stringify(f.c.P) === before, name + ' preserves existing in-memory settings');
    assert.deepEqual(Object.fromEntries(f.local), old); checks++;
  }
  const native = require('./lib-desktop-autosave-reliability').fixture();
  native.c.TM_SaveDB = f.api;
  await assert.rejects(native.save, { code: 'SAVE_DATABASE_UNAVAILABLE' }); checks++;
  check(native.calls.length === 0, 'periodic native autosave cannot overwrite an old recovery file after a failed open');
  f.options.holdOpen = false; f.c.indexedDB.open = realOpen;
  await f.api.open(); await tick();
  check(f.api.writeStatus().blocked, 'recovered reads must not let startup defaults overwrite the old profile before reload');
  const loaded = await f.api.load('slot_1');
  check(loaded.gameState.GM.turn === 8, 'retry reads the actual existing save');
  const healthy = fixture(); healthy.c.tianming = { isDesktop: true }; await healthy.api.open();
  check(!healthy.api.writeStatus().blocked, 'a clean restart opens the existing profile for writes');
  f.c.TM_SaveDB = healthy.api;
  let savedProject = 0; f.c.saveP = () => { savedProject++; };
  f.c._$ = name => ({ value: { 's-key': 'new-fixture-key', 's-url': 'https://fixture.invalid', 's-model': 'fixture' }[name] || '' });
  f.options.localFailure = true;
  check(f.c.sSaveAPI() === false, 'a failed key write must not report success');
  check(savedProject === 0 && f.local.get('tm_api') === old.tm_api, 'failed key persistence keeps the old device key');
  check(toasts.at(-1).includes('未保存'), 'failure feedback is visible');
  f.options.localFailure = false; f.c.sSaveAPI();
  check(JSON.parse(f.local.get('tm_api')).key === 'new-fixture-key' && savedProject === 1, 'successful key persistence is read back before project save');
  check(toasts.at(-1).includes('已保存'), 'success feedback requires a confirmed local write');
  const absent = fixture({ noIndexedDB: true }); absent.c.tianming = { isDesktop: true };
  await assert.rejects(() => absent.api.list(), { code: 'SAVE_DATABASE_UNAVAILABLE' }); checks++;
  console.log('[smoke-storage-desktop-unavailable] PASS ' + checks + ' assertions');
})().catch(error => { console.error(error); process.exitCode = 1; });
