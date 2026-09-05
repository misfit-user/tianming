'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), assert = require('assert'), { EventEmitter } = require('events'), { Worker } = require('worker_threads');
const reader = require('../../main-json-file'), { readImageFile } = require('../../main-image-file');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-audit-import-'));
const tick = () => new Promise(setImmediate);
(async () => {
  const small = path.join(dir, 'small.json'), large = path.join(dir, 'large.json');
  fs.writeFileSync(small, '{"turn":1}'); fs.writeFileSync(large, JSON.stringify({ turn: 10, padding: 'a'.repeat(8 * 1024 * 1024) }));
  assert.equal((await reader.readJsonFileOffMainThread(small)).turn, 1);
  let ticks = 0; const timer = setInterval(() => ticks++, 1);
  try { assert.equal((await reader.readJsonFileOffMainThread(large)).padding.length, 8 * 1024 * 1024); } finally { clearInterval(timer); }
  assert(ticks > 0); // responsiveness only, not an Electron latency/RSS measurement
  await assert.rejects(reader.readJsonFileOffMainThread(large, { maxBytes: 100 }), { code: 'IMPORT_TOO_LARGE' });
  await assert.rejects(reader.readJsonFileOffMainThread(dir), { code: 'IMPORT_NOT_FILE' });
  const bad = path.join(dir, 'bad.json'); fs.writeFileSync(bad, '{broken'); await assert.rejects(reader.readJsonFileOffMainThread(bad, { workerThresholdBytes: 0 }));
  fs.writeFileSync(bad, 'null'); await assert.rejects(reader.readJsonFileOffMainThread(bad), { code: 'IMPORT_SCHEMA' });
  await assert.rejects(reader.readJsonFileOffMainThread(small, { kind: 'geojson' }), { code: 'IMPORT_SCHEMA' });
  const geo = path.join(dir, 'map.geojson'); fs.writeFileSync(geo, '{"type":"FeatureCollection","features":[]}'); assert.equal((await reader.readJsonFileOffMainThread(geo, { kind: 'geojson' })).features.length, 0);
  const cancelled = new AbortController(); cancelled.abort(); await assert.rejects(reader.readJsonFileOffMainThread(small, { signal: cancelled.signal }), { code: 'IMPORT_CANCELLED' });
  const during = new AbortController(); const cancel = reader.readJsonFileOffMainThread(large, { signal: during.signal, workerFactory: (file, opts) => { const w = new Worker(file, opts); setImmediate(() => during.abort()); return w; } });
  await assert.rejects(cancel, { code: 'IMPORT_CANCELLED' });
  let terminated = 0;
  const stalled = () => Object.assign(new EventEmitter(), { terminate: async () => { terminated++; } });
  await assert.rejects(reader.readJsonFileOffMainThread(large, { timeoutMs: 10, workerFactory: stalled }), { code: 'IMPORT_TIMEOUT' }); assert.equal(terminated, 1);
  await assert.rejects(reader.readJsonFileOffMainThread(large, { workerFactory: () => { const w = stalled(); setImmediate(() => w.emit('exit', 1)); return w; } }), { code: 'IMPORT_WORKER_EXIT' });
  await assert.rejects(reader.readJsonFileOffMainThread(large, { workerFactory: () => { throw new Error('worker-create'); } }), /worker-create/);
  // A file replaced between parent inspection and worker read is not silently imported.
  await assert.rejects(reader.readJsonFileOffMainThread(small, { workerThresholdBytes: 0, workerFactory: (file, opts) => { fs.writeFileSync(small, '{"turn":999,"changed":true}'); return new Worker(file, opts); } }), { code: 'IMPORT_FILE_CHANGED' });
  await tick(); const controllers = Array.from({ length: 10 }, () => new AbortController());
  const jobs = controllers.map(c => reader.readJsonFileOffMainThread(large, { signal: c.signal, workerFactory: stalled }).catch(e => e.code));
  await tick(); await assert.rejects(reader.readJsonFileOffMainThread(large, { workerFactory: stalled }), { code: 'IMPORT_BUSY' });
  assert.equal(reader.importActivity().active, 2); assert.equal(reader.importActivity().queued, 8);
  controllers.forEach(c => c.abort()); await Promise.all(jobs); await tick(); assert.deepEqual(reader.importActivity(), { active: 0, queued: 0 });
  assert.equal((await reader.readJsonFileOffMainThread(small)).turn, 999);
  const png = path.join(dir, 'image.png'), pngBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==', 'base64');
  fs.writeFileSync(png, pngBytes); assert.equal((await readImageFile(png)).width, 1);
  const bomb = Buffer.from(pngBytes); bomb.writeUInt32BE(0x7fffffff, 16); fs.writeFileSync(png, bomb); await assert.rejects(readImageFile(png), /像素/);
  const oversized = path.join(dir, 'large.png'); const fd = fs.openSync(oversized, 'w'); fs.ftruncateSync(fd, 33 * 1024 * 1024); fs.closeSync(fd); await assert.rejects(readImageFile(oversized), { code: 'IMPORT_TOO_LARGE' });
  const h = require('./lib-audit-main')();
  try {
    h.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [geo] }); assert.equal((await h.invoke('dialog-load-geojson')).success, true);
    h.dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [bad] }); assert.equal((await h.invoke('dialog-import')).success, false);
    h.dialog.showOpenDialog = async () => ({ canceled: true, filePaths: [] }); assert.equal((await h.invoke('dialog-import')).canceled, true);
    assert.equal((await h.invoke('cancel-file-imports')).success, true);
  } finally { h.cleanup(); }
  console.log('PASS bounded import, real Worker, cancellation, timeout, error cleanup, concurrency, TOCTOU and pixel limits; Node headless only');
})().catch(e => { console.error(e); process.exitCode = 1; }).finally(() => fs.rmSync(dir, { recursive: true, force: true }));
