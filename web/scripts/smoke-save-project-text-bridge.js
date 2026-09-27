#!/usr/bin/env node
'use strict';
// 手动存档的文本通道：真实 preload 与真实 desktopDoSave，只有 IPC 是桩。
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..');
let pass = 0;
async function check(name, fn) { await fn(); pass++; console.log('PASS ' + name); }

function preload() {
  let api;
  const calls = [];
  const ipc = {
    sendSync() { return { success: true, token: 'save-project-text-0001' }; },
    invoke(channel, payload) { calls.push({ channel, payload }); return Promise.resolve({ success: true }); },
    on() {}, removeListener() {}
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'preload-impl.js'), 'utf8'), {
    require(name) { assert.equal(name, 'electron'); return { contextBridge: { exposeInMainWorld(n, value) { assert.equal(n, 'tianming'); api = value; } }, ipcRenderer: ipc }; },
    process: { platform: process.platform }, Buffer, console, crypto: require('crypto').webcrypto
  }, { filename: 'preload-impl.js' });
  return { api, calls };
}

function sliceAssignedFunction(source, marker) {
  const start = source.indexOf(marker);
  assert(start >= 0, 'missing ' + marker);
  let at = source.indexOf('{', start), depth = 0;
  for (; at < source.length; at++) {
    if (source[at] === '{') depth++;
    else if (source[at] === '}' && --depth === 0) return source.slice(start, at + 1) + ';';
  }
  throw new Error('unterminated ' + marker);
}

function renderer(bridge) {
  const source = fs.readFileSync(path.join(root, 'web/tm-save-lifecycle.js'), 'utf8');
  const code = sliceAssignedFunction(source, 'window.desktopDoSave=async function(){');
  const built = { gameState: { turn: 12, 名: '绍宋😀', nested: { list: [1, 2, 3] } }, conf: { a: 1 } };
  const c = {
    window: { tianming: bridge }, JSON, Promise, Date,
    GM: { sid: 'fixture', turn: 12 },
    toasts: [], entered: 0,
    _$: () => ({ value: '手动存档😀' }),
    toast(msg) { c.toasts.push(msg); },
    enterGame() { c.entered++; },
    _tmAwaitLoadBarrier: async () => true,
    _awaitPostTurnJobsForSave: async () => true,
    _tmCaptureWorldLease: () => ({ turn: 12, gmRef: { sid: 'fixture' }, pRef: { meta: { v: '1.3.5.2' } } }),
    _tmWorldLeaseCurrent: () => true,
    findScenarioById: () => ({ name: '绍宋' }),
    _buildSaveState: () => JSON.parse(JSON.stringify(built)),
    getTSText: () => '建炎元年'
  };
  vm.createContext(c);
  vm.runInContext(code, c, { filename: 'tm-save-lifecycle.js' });
  return { c, built };
}

async function main() {
  const h = preload();
  await check('real preload exposes the text channel next to the object channel', () => {
    assert.equal(typeof h.api.saveProjectJson, 'function');
    assert.equal(typeof h.api.saveProject, 'function');
  });
  await check('text channel parses once and reuses the save-project IPC', async () => {
    const data = { gameState: { turn: 3, 名: '天启 é 😀' }, P: { list: [1, 2] } };
    const r = await h.api.saveProjectJson('存档一', JSON.stringify(data));
    assert.equal(r.success, true);
    assert.equal(h.calls.length, 1);
    assert.equal(h.calls[0].channel, 'save-project');
    assert.equal(h.calls[0].payload.filename, '存档一');
    assert.deepEqual(JSON.parse(JSON.stringify(h.calls[0].payload.data)), data);
  });
  await check('invalid text never reaches IPC', async () => {
    const before = h.calls.length;
    for (const bad of [{}, 42, '{"broken"', '[1,2]', 'null']) {
      await assert.rejects(async () => h.api.saveProjectJson('坏档', bad));
    }
    assert.equal(h.calls.length, before);
  });
  await check('desktopDoSave sends text on a new shell', async () => {
    const calls = { text: [], object: [] };
    const { c, built } = renderer({
      saveProjectJson: async (name, json) => { assert.equal(typeof json, 'string'); calls.text.push({ name, json }); return { success: true }; },
      saveProject: async (name, data) => { calls.object.push({ name, data }); return { success: true }; }
    });
    assert.equal(await c.window.desktopDoSave(), true);
    assert.equal(calls.text.length, 1);
    assert.equal(calls.object.length, 0);
    const sent = JSON.parse(calls.text[0].json);
    assert.equal(calls.text[0].name, '手动存档😀');
    assert.deepEqual(sent.gameState, built.gameState);
    assert.equal(sent._saveMeta.name, '手动存档😀');
    assert.equal(sent._saveMeta.turn, 12);
    assert.equal(c.entered, 1, '存档成功后仍回到游戏画面');
  });
  await check('desktopDoSave keeps the object channel on an old shell', async () => {
    const calls = [];
    const { c } = renderer({ saveProject: async (name, data) => { calls.push({ name, data }); return { success: true }; } });
    assert.equal(await c.window.desktopDoSave(), true);
    assert.equal(calls.length, 1);
    assert.equal(typeof calls[0].data, 'object');
    assert.equal(calls[0].data._saveMeta.name, '手动存档😀');
  });
  console.log('smoke-save-project-text-bridge ok assertions=' + pass);
}
main().catch(error => { console.error(error && error.stack || error); process.exitCode = 1; });
