'use strict';

const fs = require('fs');
const { Worker, isMainThread, parentPort, workerData } = require('worker_threads');

const DEFAULT_WORKER_THRESHOLD = 256 * 1024;
const DEFAULT_MAX_BYTES = 512 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 120000;
const MAX_ACTIVE = 2, MAX_QUEUED = 8;
let active = 0;
const queue = [];
function coded(code, message) { const e = new Error(message || code); e.code = code; return e; }
function aborted(signal) { if (signal && signal.aborted) throw coded('IMPORT_CANCELLED', '导入已取消'); }
function schedule(work, signal) {
  return new Promise((resolve, reject) => {
    if (signal && signal.aborted) { reject(coded('IMPORT_CANCELLED')); return; }
    if (active >= MAX_ACTIVE && queue.length >= MAX_QUEUED) { reject(coded('IMPORT_BUSY', '并发导入数量超过上限')); return; }
    const item = { run() {
      if (signal) signal.removeEventListener('abort', onAbort);
      active++;
      Promise.resolve().then(() => { aborted(signal); return work(); }).then(resolve, reject).finally(() => { active--; if (queue.length) queue.shift().run(); });
    } };
    function onAbort() { const i = queue.indexOf(item); if (i >= 0) { queue.splice(i, 1); signal.removeEventListener('abort', onAbort); reject(coded('IMPORT_CANCELLED')); } }
    if (active < MAX_ACTIVE) item.run(); else { queue.push(item); if (signal) signal.addEventListener('abort', onAbort, { once: true }); }
  });
}
function sameFile(a, b) { return a.dev === b.dev && a.ino === b.ino && a.size === b.size && a.mtimeMs === b.mtimeMs && a.ctimeMs === b.ctimeMs; }
async function readOpened(file, options) {
  const beforeOpen = await fs.promises.lstat(file);
  if (!beforeOpen.isFile() || beforeOpen.isSymbolicLink()) throw coded('IMPORT_NOT_FILE', '导入路径不是普通文件');
  const handle = await fs.promises.open(file, fs.constants.O_RDONLY | (fs.constants.O_NOFOLLOW || 0));
  try {
    const before = await handle.stat();
    if (!before.isFile() || !sameFile(before, beforeOpen) || (options.expected && !sameFile(before, options.expected))) throw coded('IMPORT_FILE_CHANGED', '导入文件已变化');
    if (before.size > options.maxBytes) throw coded('IMPORT_TOO_LARGE', 'JSON 文件超过读取上限');
    const data = Buffer.alloc(before.size); let offset = 0;
    while (offset < data.length) {
      aborted(options.signal);
      const { bytesRead } = await handle.read(data, offset, Math.min(1024 * 1024, data.length - offset), offset);
      if (!bytesRead) break; offset += bytesRead;
    }
    aborted(options.signal);
    const after = await handle.stat();
    if (offset !== data.length || !sameFile(before, after)) throw coded('IMPORT_FILE_CHANGED', '读取期间文件已变化');
    return data;
  } finally { await handle.close(); }
}
function validateData(data, kind) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw coded('IMPORT_SCHEMA', '导入内容必须为 JSON 对象');
  if (kind === 'geojson' && !((data.type === 'FeatureCollection' && Array.isArray(data.features))
      || (data.type === 'Feature' && data.geometry && typeof data.geometry === 'object')
      || (['Point', 'MultiPoint', 'LineString', 'MultiLineString', 'Polygon', 'MultiPolygon'].includes(data.type) && Array.isArray(data.coordinates))
      || (data.type === 'GeometryCollection' && Array.isArray(data.geometries)))) throw coded('IMPORT_SCHEMA', 'GeoJSON 结构无效');
  return data;
}

function errorRecord(error) {
  return {
    name: String(error && error.name || 'Error'),
    message: String(error && error.message || error),
    code: error && error.code ? String(error.code) : '',
    stack: error && error.stack ? String(error.stack) : ''
  };
}

function reviveWorkerError(record) {
  const error = new Error(record && record.message || 'JSON worker failed');
  if (record && record.name) error.name = record.name;
  if (record && record.code) error.code = record.code;
  if (record && record.stack) error.stack = record.stack;
  return error;
}

if (!isMainThread && workerData && workerData.tmJsonFileWorker === 1) {
  readOpened(workerData.file, workerData.options).then(buffer => validateData(JSON.parse(buffer.toString('utf8')), workerData.options.kind))
    .then(data => parentPort.postMessage({ ok: true, data }), error => parentPort.postMessage({ ok: false, error: errorRecord(error) }));
} else {
  async function readJsonFileOffMainThread(file, options) {
    options = options || {};
    return schedule(async () => {
    const stat = await fs.promises.lstat(file);
    const maxBytes = Number.isFinite(options.maxBytes) ? Math.min(DEFAULT_MAX_BYTES, Math.max(0, options.maxBytes)) : DEFAULT_MAX_BYTES;
    if (!stat.isFile() || stat.isSymbolicLink()) throw coded('IMPORT_NOT_FILE', 'JSON 路径不是普通文件');
    if (stat.size > maxBytes) throw coded('IMPORT_TOO_LARGE', 'JSON 文件超过读取上限');
    const config = { maxBytes, kind: options.kind || 'object', expected: { dev: stat.dev, ino: stat.ino, size: stat.size, mtimeMs: stat.mtimeMs, ctimeMs: stat.ctimeMs } };
    const threshold = Number.isFinite(options.workerThresholdBytes)
      ? Math.min(DEFAULT_WORKER_THRESHOLD, Math.max(0, options.workerThresholdBytes))
      : DEFAULT_WORKER_THRESHOLD;
    if (stat.size < threshold) {
      const buffer = await readOpened(file, { ...config, signal: options.signal });
      return validateData(JSON.parse(buffer.toString('utf8')), config.kind);
    }

    return new Promise((resolve, reject) => {
      aborted(options.signal);
      const worker = (options.workerFactory || ((file, opts) => new Worker(file, opts)))(__filename, {
        workerData: { tmJsonFileWorker: 1, file: file, options: config }
      });
      const timeoutMs = Number.isFinite(options.timeoutMs) ? Math.max(1, Math.min(DEFAULT_TIMEOUT_MS, options.timeoutMs)) : DEFAULT_TIMEOUT_MS;
      let settled = false;
      const timer = setTimeout(() => finish(reject, coded('IMPORT_TIMEOUT', 'JSON 文件解析超时')), timeoutMs);
      const onAbort = () => finish(reject, coded('IMPORT_CANCELLED', '导入已取消'));
      if (options.signal) options.signal.addEventListener('abort', onAbort, { once: true });

      function finish(fn, value) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (options.signal) options.signal.removeEventListener('abort', onAbort);
        // Do not release the concurrency slot until the actual Worker is terminated.
        Promise.resolve().then(() => worker.terminate()).then(() => fn(value), reject);
      }

      worker.once('message', message => {
        if (message && message.ok === true) finish(resolve, message.data);
        else finish(reject, reviveWorkerError(message && message.error));
      });
      worker.once('error', error => finish(reject, error));
      worker.once('exit', code => {
        if (!settled) finish(reject, coded('IMPORT_WORKER_EXIT', 'JSON worker exited before returning data (code ' + code + ')'));
      });
    });
    }, options.signal);
  }

  module.exports = {
    readJsonFileOffMainThread,
    DEFAULT_WORKER_THRESHOLD,
    DEFAULT_MAX_BYTES
    , readBinaryFileLimited: (file, options = {}) => schedule(() => readOpened(file, { maxBytes: Math.min(DEFAULT_MAX_BYTES, options.maxBytes || 32 * 1024 * 1024), signal: options.signal }), options.signal)
    , validateData
    , importActivity: () => ({ active, queued: queue.length })
  };
}
