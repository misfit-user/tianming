// smoke-save-export-parts.js — 存档分块导出（2026-10-14·手机「抄送副本」闪退）
// 病：整档 JSON.stringify 成一个巨串再整串过 Capacitor 桥，大档把手机内存撑爆。
// 验：①分块序列化拼回来与 JSON.stringify 逐字节相同（键序/undefined/函数/数组内 undefined→null/toJSON）
//     ②新壳：beginExport→appendChunk(≈1MB 一块)→finishExport，块拼回等于全文 ③旧壳无 beginExport 或报 UNIMPLEMENTED：退回 saveFile 整串
//     ④中途失败调 cancelExport ⑤桌面/网页：Blob 多段拼，不先拼大字符串。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function test(name, fn) { try { fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n  ' + (e && e.stack || e)); } }
async function testAsync(name, fn) { try { await fn(); passed++; console.log('PASS ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n  ' + (e && e.stack || e)); } }

// ── 序列化：从 tm-save-manager.js 切出 _tmSerializeExportParts ──
const smSrc = fs.readFileSync(path.join(ROOT, 'tm-save-manager.js'), 'utf8');
const sIdx = smSrc.indexOf('function _tmSerializeExportParts');
const eIdx = smSrc.indexOf("if (typeof window !== 'undefined') window._tmSerializeExportParts", sIdx);
assert(sIdx >= 0 && eIdx > sIdx, '_tmSerializeExportParts block missing');
const serCtx = { console };
vm.createContext(serCtx);
vm.runInContext(smSrc.slice(sIdx, eIdx) + '\nthis.serialize = _tmSerializeExportParts;', serCtx);
const serialize = serCtx.serialize;

test('分块拼回与 JSON.stringify 逐字节相同（含 undefined/函数/symbol 跳过、数组内 undefined→null、toJSON、中文与引号）', () => {
  const rec = {
    id: 'slot_3', name: '崇祯档 "试"', turn: 7, timestamp: 1791900000000, dynastyPhase: undefined, skip() {},
    gameState: {
      GM: { turn: 7, chars: [{ name: '甲', note: undefined, f() {}, arr: [1, undefined, null, { x: undefined }] }], nested: { deep: { a: 1, b: [true, false] } }, when: new Date(0), s: '中文"引号\\反斜杠\n换行' },
      P: { aiConfig: { apiKey: '' }, big: 'x'.repeat(5000), n: null, z: 0, neg: -1.5, sym: Symbol('s') }
    },
    _format: 'tianming-save-v1'
  };
  const parts = serialize(rec);
  assert(Array.isArray(parts) && parts.length > 10, 'should split into many parts, got ' + parts.length);
  assert.strictEqual(parts.join(''), JSON.stringify(rec));
  assert.deepStrictEqual(JSON.parse(parts.join('')), JSON.parse(JSON.stringify(rec)));
});

test('gameState 直接是 P（旧格式）与空对象也能序列化', () => {
  assert.strictEqual(serialize({ gameState: { a: 1 } }).join(''), '{"gameState":{"a":1}}');
  assert.strictEqual(serialize({}).join(''), '{}');
  assert.strictEqual(serialize({ gameState: null }).join(''), '{"gameState":null}');
});

// ── 导出口：加载 tm-file-export.js，用假 Capacitor 插件 ──
function exportContext(plugin, native) {
  const ctx = { console, setTimeout, clearTimeout, Blob, URL: { createObjectURL() { return 'blob:fake'; }, revokeObjectURL() {} },
    document: { body: { appendChild() {} }, createElement() { return { click() {}, parentNode: null, style: {} }; } },
    Capacitor: { isNativePlatform() { return !!native; }, isPluginAvailable() { return true; }, Plugins: { TianmingFileExport: plugin } } };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-file-export.js'), 'utf8'), ctx, { filename: 'tm-file-export.js' });
  return ctx;
}
const bigParts = [];
for (let i = 0; i < 40; i++) bigParts.push(String(i % 10).repeat(100 * 1024));  // 40 段 × 100KB = 4MB
const bigAll = bigParts.join('');

(async () => {
  await testAsync('新壳：beginExport/appendChunk/finishExport，每块约 1MB、拼回等于全文，不走 saveFile', async () => {
    const calls = [];
    const plugin = {
      async beginExport(o) { calls.push(['begin', o.fileName, o.mimeType]); return { started: true }; },
      async appendChunk(o) { calls.push(['chunk', o.chunk]); return { bytes: o.chunk.length }; },
      async finishExport() { calls.push(['finish']); return { saved: true, cancelled: false, fileName: '崇祯档_T7.json', uri: 'content://x' }; },
      async cancelExport() { calls.push(['cancel']); return { cancelled: true }; },
      async saveFile() { throw new Error('should not be called'); }
    };
    const ctx = exportContext(plugin, true);
    const r = await ctx.TM.fileExport.saveJsonParts(bigParts, '崇祯档_T7');
    assert.strictEqual(r.mode, 'native');
    assert.strictEqual(r.fileName, '崇祯档_T7.json');
    assert.deepStrictEqual(calls[0], ['begin', '崇祯档_T7.json', 'application/json']);
    const chunks = calls.filter(c => c[0] === 'chunk').map(c => c[1]);
    assert.strictEqual(chunks.join(''), bigAll);
    assert(chunks.length >= 4 && chunks.length <= 5, 'expected ~1MB chunks, got ' + chunks.length);
    assert(chunks.every(c => c.length <= 1024 * 1024 + 100 * 1024), 'chunk too large');
    assert.strictEqual(calls[calls.length - 1][0], 'finish');
  });

  await testAsync('旧壳：没有 beginExport → 退回 saveFile 整串', async () => {
    let got = null;
    const plugin = { async saveFile(o) { got = o; return { saved: true, cancelled: false, fileName: o.fileName }; } };
    const ctx = exportContext(plugin, true);
    const r = await ctx.TM.fileExport.saveJsonParts(bigParts, 'old.json');
    assert.strictEqual(r.mode, 'native');
    assert.strictEqual(got.data, bigAll);
  });

  await testAsync('旧壳：beginExport 报 UNIMPLEMENTED → 退回 saveFile；别的错误照抛', async () => {
    let got = null;
    const plugin = {
      async beginExport() { const e = new Error('"TianmingFileExport.beginExport()" is not implemented on android'); e.code = 'UNIMPLEMENTED'; throw e; },
      async saveFile(o) { got = o; return { saved: true, cancelled: false, fileName: o.fileName }; }
    };
    const ctx = exportContext(plugin, true);
    const r = await ctx.TM.fileExport.saveJsonParts(['{"a":1}'], 'x.json');
    assert.strictEqual(r.mode, 'native');
    assert.strictEqual(got.data, '{"a":1}');
    const plugin2 = { async beginExport() { throw new Error('EXPORT_BUSY'); }, async saveFile() { throw new Error('no'); } };
    const ctx2 = exportContext(plugin2, true);
    await assert.rejects(ctx2.TM.fileExport.saveJsonParts(['{}'], 'y.json'), /EXPORT_BUSY/);
  });

  await testAsync('中途 appendChunk 失败：调 cancelExport 清缓存并抛错；取消保存返回 canceled', async () => {
    const calls = [];
    const plugin = {
      async beginExport() { return { started: true }; },
      async appendChunk() { throw new Error('disk full'); },
      async finishExport() { calls.push('finish'); return { saved: true }; },
      async cancelExport() { calls.push('cancel'); return { cancelled: true }; }
    };
    const ctx = exportContext(plugin, true);
    await assert.rejects(ctx.TM.fileExport.saveJsonParts(bigParts, 'z.json'), /disk full/);
    assert.deepStrictEqual(calls, ['cancel']);
    const plugin2 = { async beginExport() { return { started: true }; }, async appendChunk() { return {}; }, async finishExport() { return { saved: false, cancelled: true }; }, async cancelExport() { return {}; } };
    const r = await exportContext(plugin2, true).TM.fileExport.saveJsonParts(['{}'], 'c.json');
    assert.strictEqual(r.mode, 'canceled');
  });

  await testAsync('桌面/网页：多段 Blob 直接下载，mode=download', async () => {
    const ctx = exportContext(null, false);
    const r = await ctx.TM.fileExport.saveJsonParts(['{"a":', '1}'], 'd');
    assert.strictEqual(r.mode, 'download');
    assert.strictEqual(r.fileName, 'd.json');
  });

  console.log(`${passed} passed / ${failed} failed`);
  process.exit(failed ? 1 : 0);
})();
