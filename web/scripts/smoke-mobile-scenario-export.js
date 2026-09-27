#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const root = path.resolve(__dirname, '..');
const app = fs.readFileSync(path.join(root, 'preview/scenario-editor-reset-app.js'), 'utf8');
const audio = fs.readFileSync(path.join(root, 'tm-audio-theme.js'), 'utf8');

function functionSlice(source, name, next) {
  const start = source.indexOf('function ' + name + '(');
  const end = source.indexOf('function ' + next + '(', start);
  assert(start >= 0 && end > start, name + ' remains available');
  return source.slice(start, end).replace(/\s*async\s*$/, '');
}

function harness(options = {}) {
  const calls = [], statuses = [], downloads = [];
  const scenario = { name: '测试剧本', characters: [{ name: '甲' }] };
  const sandbox = {
    console, Promise, Blob, setTimeout: fn => fn(),
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL() {} },
    document: {
      body: { appendChild() {} },
      createElement: () => ({ click() { downloads.push(this.download); }, remove() {} })
    },
    EXPORT_NAME: '天命剧本.json',
    state: { scenario, pendingExport: null, fieldNotes: {}, selectedField: 'characters' },
    clone: value => JSON.parse(JSON.stringify(value)),
    validateImportedScenario: () => ({ ok: true, warnings: [], errors: [] }),
    pushStatusLog() {}, renderStatusLog() {},
    setStatus: (text, kind) => statuses.push({ text, kind }),
    toast: text => statuses.push({ text }),
    buildProjectSnapshot: () => ({ id: 'snap-1', name: '测试快照', scenario, fieldNotes: {} }),
    getProjectBody: async () => ({ id: 'snap-1', name: '测试快照', scenario, fieldNotes: {} }),
    buildReleaseNotes: () => '说明',
    P: { conf: { gameTitle: '测试项目' }, world: {}, ai: { apiKey: 'private' } },
    _tmStripAiKeyView: value => ({ conf: value.conf, world: value.world }),
    TM: { fileExport: {
      isNative: () => options.native !== false,
      saveJson: async (json, filename) => {
        calls.push({ json, filename });
        if (options.error) throw new Error(options.error);
        return options.result || { mode: 'native', path: 'Documents/天命/' + filename };
      }
    } }
  };
  if (options.desktop) sandbox.tianming = { dialogExport: async (data, opts) => {
    calls.push({ data, opts });
    return { success: true, path: 'D:/剧本.json' };
  } };
  sandbox.window = sandbox;
  sandbox.global = sandbox;
  vm.createContext(sandbox);
  for (const [name, next] of [
    ['performExportDownload', 'exportScenario'],
    ['exportScenario', 'forceExportScenario'],
    ['forceExportScenario', 'projectStats'],
    ['exportBulkField', 'buildScenarioDiff']
  ]) vm.runInContext(functionSlice(app, name, next), sandbox);
  vm.runInContext('async ' + functionSlice(app, 'exportProjectSnapshot', 'normalizeProjectPackage'), sandbox);
  vm.runInContext(audio.slice(audio.indexOf('function doExport(){'), audio.indexOf('// 在启动页也加导出按钮')), sandbox);
  return { sandbox, calls, statuses, downloads };
}

async function drain() { await new Promise(resolve => setImmediate(resolve)); }

(async function () {
  let h = harness();
  const immediate = h.sandbox.exportScenario();
  assert.strictEqual(immediate.name, '测试剧本', 'scenario export preserves its synchronous cloned return');
  assert.notStrictEqual(immediate, h.sandbox.state.scenario);
  assert.strictEqual(h.statuses.length, 0, 'success waits for native write completion');
  await drain();
  assert.strictEqual(h.calls[0].filename, '天命剧本.json');
  assert.strictEqual(JSON.parse(h.calls[0].json).characters[0].name, '甲');
  assert.strictEqual(h.downloads.length, 0);
  assert(h.statuses.some(s => s.text.includes('Documents/天命/')));

  h = harness({ result: { mode: 'canceled' } });
  h.sandbox.exportScenario(); await drain();
  assert.deepStrictEqual(h.statuses.map(s => s.kind), ['warn']);
  assert(h.statuses[0].text.includes('取消'));
  assert.strictEqual(h.downloads.length, 0);

  h = harness({ error: '请更新手机版安装包' });
  h.sandbox.exportScenario(); await drain();
  assert.deepStrictEqual(h.statuses.map(s => s.kind), ['error']);
  assert(h.statuses[0].text.includes('请更新手机版安装包'));
  assert.strictEqual(h.downloads.length, 0, 'native failure never falls through to hidden browser download');
  h.sandbox.state.pendingExport = { scenario: h.sandbox.state.scenario, report: { errors: ['bad'] } };
  h.sandbox.forceExportScenario(); await drain();
  assert(h.statuses.at(-1).text.includes('强制导出失败'));

  h = harness();
  const pack = await h.sandbox.exportProjectSnapshot();
  assert.strictEqual(pack.format, 'tianming-scenario-editor-reset-package');
  assert.strictEqual(h.calls[0].filename, 'tianming-scenario-package-snap-1.json');
  h = harness({ error: '写入失败' });
  assert.strictEqual(await h.sandbox.exportProjectSnapshot(), null);
  assert.strictEqual(h.statuses.at(-1).kind, 'error');
  h = harness({ result: { mode: 'canceled' } });
  assert.strictEqual(await h.sandbox.exportProjectSnapshot(), null);
  assert(h.statuses.at(-1).text.includes('取消'));

  h = harness();
  const bulk = h.sandbox.exportBulkField('characters');
  assert.strictEqual(bulk.count, 1);
  await drain();
  assert.strictEqual(h.calls[0].filename, 'tianming-bulk-characters.json');
  assert.strictEqual(h.downloads.length, 0);
  h = harness({ error: '写入失败' });
  h.sandbox.exportBulkField('characters'); await drain();
  assert.strictEqual(h.statuses.at(-1).kind, 'error');
  h = harness();
  h.sandbox.exportBulkField('characters', { download: false }); await drain();
  assert.strictEqual(h.calls.length, 0, 'in-memory bulk extraction remains side-effect free');

  h = harness();
  await h.sandbox.doExport();
  assert.strictEqual(h.calls[0].filename, '测试项目.json');
  assert(!h.calls[0].json.includes('private'), 'project export still uses the AI-key-stripped view');
  assert.strictEqual(h.downloads.length, 0);
  h = harness({ result: { mode: 'canceled' } });
  await h.sandbox.doExport();
  assert.deepStrictEqual(h.statuses.map(s => s.text), ['已取消导出']);
  h = harness({ error: '写入失败' });
  await h.sandbox.doExport();
  assert.deepStrictEqual(h.statuses.map(s => s.text), ['导出失败：写入失败']);

  h = harness({ native: false, desktop: true });
  assert.strictEqual((await h.sandbox.performExportDownload({ name: '桌面' }, '桌面.json')).path, 'D:/剧本.json');
  assert.strictEqual(h.calls[0].opts.filename, '桌面.json');
  assert.strictEqual(h.downloads.length, 0);
  h = harness({ native: false });
  assert.strictEqual((await h.sandbox.performExportDownload({ name: '浏览器' }, '浏览器.json')).mode, 'download');
  assert.deepStrictEqual(h.downloads, ['浏览器.json']);
  h.sandbox.doExport();
  assert.strictEqual(h.downloads.at(-1), '测试项目.json');
  console.log('PASS mobile scenario export: native success/cancel/failure, unchanged desktop/browser, snapshot/bulk/project entry points');
})().catch(error => { console.error(error); process.exitCode = 1; });
