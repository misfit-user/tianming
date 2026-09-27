'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const acorn = require('acorn');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');
let passed = 0;
async function test(name, fn) { await fn(); console.log('PASS ' + name); passed++; }
function harness(native = true) {
  const calls = [], downloads = [], messages = [], timers = [], revoked = [], blobs = [];
  const body = {
    appendChild(a) { a.parentNode = body; },
    removeChild(a) { a.parentNode = null; }
  };
  const ctx = vm.createContext({
    console: { log() {}, warn() {}, error() {} }, Blob,
    setTimeout(fn) { timers.push(fn); }, clearTimeout() {},
    document: { body, createElement() { return { click() { downloads.push(this); } }; } },
    URL: { createObjectURL(b) { blobs.push(b); return 'blob:export'; }, revokeObjectURL(u) { revoked.push(u); } },
    toast(s) { messages.push(s); }, showToast(s) { messages.push(s); },
    Capacitor: { isNativePlatform: () => native, isPluginAvailable: () => true, Plugins: {} }
  });
  ctx.window = ctx;
  ctx.Capacitor.Plugins.TianmingFileExport = { async saveFile(args) {
    calls.push(args); return { saved: true, fileName: args.fileName, uri: 'content://chosen/file.json' };
  } };
  vm.runInContext(read('tm-file-export.js'), ctx);
  return { ctx, calls, downloads, messages, timers, revoked, blobs, api: ctx.TM.fileExport };
}
function loadFunction(ctx, file, predicate, target) {
  const src = read(file), ast = acorn.parse(src, { ecmaVersion: 'latest' });
  let found;
  function walk(node) {
    if (!node || typeof node !== 'object' || found) return;
    if (predicate(node)) { found = node; return; }
    Object.values(node).forEach(v => Array.isArray(v) ? v.forEach(walk) : walk(v));
  }
  walk(ast); assert(found, file + ' export entry point');
  if (found.type === 'Property') found = found.value;
  if (found.type === 'AssignmentExpression') found = found.right;
  vm.runInContext(target + ' = (' + src.slice(found.start, found.end) + ');', ctx);
}
function slotHarness() {
  const h = harness();
  h.ctx.TM_SaveDB = { load: async () => ({ id: 'slot_1', name: '旧卷·中文', turn: 8,
    gameState: { GM: { turn: 8, history: ['原始史书'] }, P: { apiKey: 'private-test-key', name: '天命' } } }) };
  h.ctx._tmStripAiKeyInPlace = p => { delete p.apiKey; };
  h.ctx.SaveCompression = { decompress: async blob => blob.text() };
  loadFunction(h.ctx, 'tm-save-manager.js', n => n.type === 'Property' && n.key.name === 'exportSave', 'slotProperty');
  return h;
}

(async () => {
  await test('native picker receives exact Unicode JSON; no browser download', async () => {
    const h = harness(), json = JSON.stringify({ name: '天启七年·九月', text: '中文😀\n换行', factions: [] });
    const out = await h.api.saveJson(json, '甲/乙:卷.json');
    assert.equal(h.calls[0].data, json);
    assert.equal(h.calls[0].fileName, '甲_乙_卷.json');
    assert.equal(h.calls[0].mimeType, 'application/json');
    assert.equal(out.mode, 'native'); assert.equal(h.downloads.length, 0); assert.equal(h.blobs.length, 0);
  });
  await test('cancel and provider failure never fall back or report success, retry works', async () => {
    const h = harness(), plugin = h.ctx.Capacitor.Plugins.TianmingFileExport;
    plugin.saveFile = async () => ({ saved: false, cancelled: true });
    assert.equal((await h.api.saveJson('{}', 'cancel.json')).mode, 'canceled');
    plugin.saveFile = async () => { throw Error('disk full'); };
    await assert.rejects(h.api.saveJson('{}', 'failed.json'), /disk full/);
    plugin.saveFile = async () => ({ saved: false });
    await assert.rejects(h.api.saveJson('{}', 'unknown.json'), /文件未保存/);
    plugin.saveFile = async () => ({ saved: true, fileName: 'renamed.json' });
    assert.equal((await h.api.saveJson('{}', 'retry.json')).fileName, 'renamed.json');
    assert.equal(h.downloads.length, 0);
  });
  await test('concurrent exports use one picker and unlock after cancellation', async () => {
    const h = harness(); let finish, count = 0;
    h.ctx.Capacitor.Plugins.TianmingFileExport.saveFile = () => { count++; return new Promise(r => { finish = r; }); };
    const first = h.api.saveJson('{}', 'first.json');
    await assert.rejects(h.api.saveJson('{}', 'second.json'), /已有导出窗口/);
    assert.equal(count, 1); finish({ cancelled: true }); await first;
    const retry = h.api.saveJson('{}', 'retry.json'); finish({ saved: true }); await retry;
    assert.equal(count, 2);
  });
  await test('old APK gets an upgrade explanation, never a hidden Blob download', async () => {
    const h = harness(); h.ctx.Capacitor.isPluginAvailable = () => false;
    await assert.rejects(h.api.saveJson('{}', 'old.json'), /新版安装包/);
    assert.equal(h.calls.length, 0); assert.equal(h.downloads.length, 0);
  });
  await test('web download preserves bytes, cleans anchor and revokes object URL', async () => {
    const h = harness(false), json = '{"中文":"完整存档"}';
    assert.equal((await h.api.saveJson(json, '中文.json')).mode, 'download');
    assert.equal(h.downloads[0].download, '中文.json');
    assert.equal(h.downloads[0].parentNode, null); assert.equal(await h.blobs[0].text(), json);
    h.timers.forEach(fn => fn()); assert.deepEqual(h.revoked, ['blob:export']);
  });
  await test('slot export retains portable envelope and redaction; success waits for native save', async () => {
    const h = slotHarness(); let finish;
    h.ctx.Capacitor.Plugins.TianmingFileExport.saveFile = args => { h.calls.push(args); return new Promise(r => { finish = r; }); };
    const pending = h.ctx.slotProperty(1);
    for (let i = 0; i < 8; i++) await Promise.resolve();
    assert.equal(h.messages.length, 0); assert.equal(h.calls.length, 1);
    const data = JSON.parse(h.calls[0].data);
    assert.equal(data._format, 'tianming-save-v1'); assert.equal(data.gameState.GM.turn, 8);
    assert.equal(data.gameState.P.apiKey, undefined); assert.equal(data.gameState.P.name, '天命');
    finish({ saved: true, fileName: '所选存档.json' }); await pending;
    assert.match(h.messages[0], /所选位置.*所选存档/);
  });
  await test('slot export handles decompression, cancellation and rejected picker', async () => {
    const h = slotHarness();
    h.ctx.TM_SaveDB.load = async () => ({ id: 'slot_2', name: '压缩卷', turn: 9,
      gameState: new Blob([JSON.stringify({ GM: { turn: 9 }, P: { name: '旧卷' } })]) });
    h.ctx.Capacitor.Plugins.TianmingFileExport.saveFile = args => { h.calls.push(args); return Promise.resolve({ cancelled: true }); };
    await h.ctx.slotProperty(2); assert.equal(JSON.parse(h.calls[0].data).gameState.GM.turn, 9);
    assert.deepEqual(h.messages, ['已取消导出']);
    h.ctx.Capacitor.Plugins.TianmingFileExport.saveFile = async () => { throw Error('provider unavailable'); };
    await h.ctx.slotProperty(2); assert.match(h.messages[1], /导出失败.*provider unavailable/);
  });
  await test('legacy editor uses adapted scenario and reports cancellation/failure', async () => {
    const h = harness(); h.ctx.scriptData = { name: '自制剧本', hidden: 'editor-only' };
    h.ctx.SchemaAdapter = { exportScenario: sc => ({ name: sc.name, factions: [{ id: 1 }] }) };
    loadFunction(h.ctx, 'editor-fullgen.js', n => n.type === 'FunctionDeclaration' && n.id.name === 'exportScript', 'runExport');
    await h.ctx.runExport(); assert.deepEqual(JSON.parse(h.calls[0].data), { name: '自制剧本', factions: [{ id: 1 }] });
    h.ctx.Capacitor.Plugins.TianmingFileExport.saveFile = async () => ({ cancelled: true });
    await h.ctx.runExport(); assert.equal(h.messages.at(-1), '已取消导出');
    h.ctx.Capacitor.Plugins.TianmingFileExport.saveFile = async () => { throw Error('no provider'); };
    await h.ctx.runExport(); assert.match(h.messages.at(-1), /导出失败/);
  });
  await test('in-game save export keeps its format; desktop still opens its existing save panel', async () => {
    const h = harness();
    Object.assign(h.ctx, {
      GM: { running: true, turn: 11, sid: 'test' }, P: { meta: { v: 'test-version' } },
      _tmAwaitLoadBarrier: async () => {}, _tmHasNativeFs: () => false,
      _buildSaveState: () => ({ GM: { turn: 11 }, P: { name: '完整游戏' } }),
      findScenarioById: () => ({ name: '中文剧本' }), getTSText: () => '秋九月'
    });
    loadFunction(h.ctx, 'tm-save-lifecycle.js', n => n.type === 'AssignmentExpression' && n.left.name === 'doSaveGame', 'runSave');
    await h.ctx.runSave();
    const data = JSON.parse(h.calls[0].data);
    assert.equal(data.GM.turn, 11); assert.equal(data._saveMeta.scenario, '中文剧本');
    assert.match(h.messages.at(-1), /所选位置/);
    h.ctx.Capacitor.Plugins.TianmingFileExport.saveFile = async () => ({ cancelled: true });
    await h.ctx.runSave(); assert.equal(h.messages.at(-1), '已取消导出');
    h.ctx.Capacitor.Plugins.TianmingFileExport.saveFile = async () => { throw Error('disk full'); };
    await h.ctx.runSave(); assert.match(h.messages.at(-1), /导出失败.*disk full/);
    let panel;
    h.ctx._tmHasNativeFs = () => true;
    h.ctx.tianming = { listSaves: async () => ({ success: true, files: [{ name: '旧桌面存档' }] }) };
    h.ctx._tmShowDesktopSavePanel = files => { panel = files; };
    await h.ctx.runSave(); assert.equal(panel[0].name, '旧桌面存档');
    assert.equal(h.calls.length, 1);
  });
  await test('all three pages load the helper before export consumers', async () => {
    for (const [entry, consumer] of [['index.html', 'tm-save-manager.js'], ['editor.html', 'editor-fullgen.js'],
      ['preview/scenario-editor-reset-preview.html', 'scenario-editor-reset-app.js']]) {
      const html = read(entry); assert(html.indexOf('tm-file-export.js') > -1, entry);
      assert(html.indexOf('tm-file-export.js') < html.indexOf('src="' + consumer), entry + ' load order');
    }
  });
  console.log(passed + ' PASS / 0 FAIL');
})().catch(error => { console.error(error); process.exitCode = 1; });
