#!/usr/bin/env node
'use strict';
// Real preload and renderer autosave implementation; IPC transport is the only stub.
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
let pass = 0;
async function check(name, fn) { await fn(); pass++; console.log('PASS ' + name); }
const plain = value => JSON.parse(JSON.stringify(value));
function setup() {
  let api, token = 'autosave-text-session-0001', reply = async () => ({ success: true });
  const calls = [];
  const ipc = { sendSync(channel, value) { if (channel === 'auto-save-session-rotate') token = value; return { success: true, token }; },
    invoke(channel, payload) { calls.push({ channel, payload }); return reply(channel, payload); }, on() {}, removeListener() {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'preload-impl.js'), 'utf8'), {
    require(name) { assert.equal(name, 'electron'); return { contextBridge: { exposeInMainWorld(name, value) { assert.equal(name, 'tianming'); api = value; } }, ipcRenderer: ipc }; },
    process: { platform: process.platform }, Buffer, console, crypto: require('crypto').webcrypto
  }, { filename: 'preload-impl.js' });
  return { api, calls, setReply(fn) { reply = fn; } };
}
function renderer(api) {
  const source = fs.readFileSync(path.join(root, 'web/tm-save-lifecycle.js'), 'utf8');
  const start = source.indexOf('var _autoSaveInFlight=false;'), end = source.indexOf('if(_tmHasNativeFs()){', start);
  assert(start >= 0 && end > start);
  const c = { console: { warn() {}, error() {}, log() {} }, Date, setTimeout, clearTimeout,
    window: { _tmLoadGen: 1, tianming: api },
    GM: { running: true, turn: 8, sid: 'public-fixture', saveName: '保存😀', _campaignId: 'campaign-a', _timelineId: 'timeline-a' },
    P: { conf: {}, scenarios: [] }, deepClone: plain, _tmLiteSafeConf: plain, localStorage: { setItem() {}, removeItem() {} },
    findScenarioById: () => ({ name: '中文 e\u0301 😀' }) };
  vm.createContext(c); vm.runInContext(source.slice(start, end), c, { filename: 'tm-save-lifecycle.js' });
  c._tmAdoptCommittedWorldSnapshot({ GM: c.GM, P: c.P }, { transactionId: 'committed-a' });
  return c;
}
async function main() {
  const h = setup();
  await check('text capability exposed by actual preload', () => assert.equal(typeof h.api.autoSaveJson, 'function'));
  const data = { conf: { name: '正常 & < > " \' 中文😀 e\u0301' }, gameState: { turn: 8, missing: undefined, value: NaN } };
  await check('text and object paths produce identical JSON persistence envelopes', async () => {
    await h.api.autoSave(data); await h.api.autoSaveJson(JSON.stringify(data));
    assert.equal(h.calls[0].channel, 'auto-save'); assert.deepEqual(plain(h.calls[0]), plain(h.calls[1]));
    assert.equal(h.calls[1].payload.sessionToken, 'autosave-text-session-0001');
  });
  for (const value of ['{broken', 'null', '[]', '1', '"text"', null, {}]) {
    await check('malformed/non-object text rejected before IPC: ' + String(value), async () => {
      const count = h.calls.length; await assert.rejects(async () => h.api.autoSaveJson(value)); assert.equal(h.calls.length, count);
    });
  }
  await check('IPC negative result and rejection remain observable', async () => {
    h.setReply(async () => ({ success: false, error: 'quota' })); assert.equal((await h.api.autoSaveJson('{}')).success, false);
    h.setReply(async () => { throw Error('transport'); }); await assert.rejects(h.api.autoSaveJson('{}'), /transport/);
    h.setReply(async () => ({ success: true }));
  });
  await check('session comes from preload, not JSON metadata', async () => {
    h.api.rotateAutoSaveSession('autosave-text-session-0002'); await h.api.autoSaveJson('{"sessionToken":"untrusted"}');
    assert.equal(h.calls.at(-1).payload.sessionToken, 'autosave-text-session-0002');
  });
  const c = renderer(h.api); let stringCalls = 0, objectCalls = 0;
  const text = h.api.autoSaveJson, object = h.api.autoSave;
  h.api.autoSaveJson = value => { assert.equal(typeof value, 'string'); stringCalls++; return text(value); };
  h.api.autoSave = value => { objectCalls++; return object(value); };
  await check('renderer selects text transport without changing committed world or live state', async () => {
    const before = JSON.stringify({ GM: c.GM, P: c.P, committed: c.lastCommittedSnapshot });
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true);
    assert.equal(stringCalls, 1); assert.equal(objectCalls, 0);
    assert.equal(JSON.stringify({ GM: c.GM, P: c.P, committed: c.lastCommittedSnapshot }), before);
    assert.deepEqual(plain(h.calls.at(-1).payload.data.gameState), c.GM);
  });
  await check('old shell keeps existing transport and frequency guards', async () => {
    delete h.api.autoSaveJson;
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true); assert.equal(objectCalls, 1);
    h.api.autoSaveJson = text;
    c.GM.busy = true; const count = h.calls.length;
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).deferred, true); assert.equal(h.calls.length, count); c.GM.busy = false;
  });
  await check('JSON failure is not retried through the object bridge and in-flight state resets', async () => {
    c.lastCommittedSnapshot.GM.bad = 1n; const count = h.calls.length;
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, false);
    assert.equal(h.calls.length, count); assert.equal(c._autoSaveInFlight, false); assert.equal(c._autoSaveInFlightPromise, null);
    delete c.lastCommittedSnapshot.GM.bad;
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true);
  });
  for (const transport of ['text', 'legacy']) {
    await check(transport + ': failed write never advances success clock/turn, retry still succeeds', async () => {
      if (transport === 'legacy') delete h.api.autoSaveJson; else h.api.autoSaveJson = text;
      c._autoSaveLastDoneMs = 123; c._autoSaveLastSavedTurn = 4;
      for (const fail of [async () => ({ success: false, error: 'quota' }), async () => { throw Error('write'); }]) {
        h.setReply(fail); assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, false);
        assert.equal(c._autoSaveLastDoneMs, 123); assert.equal(c._autoSaveLastSavedTurn, 4);
        assert.equal(c._autoSaveInFlight, false); assert.equal(c._autoSaveInFlightPromise, null);
      }
      h.setReply(async () => ({ success: true })); assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true);
      assert(c._autoSaveLastDoneMs > 123); assert.equal(c._autoSaveLastSavedTurn, 8);
      h.api.autoSaveJson = text;
    });
  }
  await check('late IPC does not mark the replacement world saved; overlapping call does not write twice', async () => {
    let release; h.setReply(() => new Promise(resolve => { release = resolve; }));
    const a = c._tmRunDesktopAutoSaveTick({ force: true }); await Promise.resolve();
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).reason, 'in-flight');
    c.GM = { ...c.GM, _timelineId: 'timeline-b' }; h.api.rotateAutoSaveSession('autosave-text-session-0003');
    release({ success: true }); assert.equal((await a).stale, true); assert.equal(c._autoSaveInFlightPromise, null);
    h.setReply(async () => ({ success: true }));
    c._tmAdoptCommittedWorldSnapshot({ GM: c.GM, P: c.P }, { transactionId: 'committed-b' });
    assert.equal((await c._tmRunDesktopAutoSaveTick({ force: true })).ok, true);
    assert.equal(h.calls.at(-1).payload.data.gameState._timelineId, 'timeline-b');
  });
  console.log(`autosave text bridge: ${pass} PASS, 0 FAIL`);
}
main().catch(error => { console.error(error.stack || error); process.exitCode = 1; });
