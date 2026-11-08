'use strict';
// Read-only diagnostic preload. The production test, assertions and deadlines are unchanged.
const fs = require('fs'), path = require('path'), vm = require('vm');
const root = path.resolve(__dirname, '../..');
const originalRead = fs.readFileSync.bind(fs), originalExists = fs.existsSync.bind(fs);
const output = process.env.TM_FULL_TURN_TRACE;
if (!output) throw new Error('TM_FULL_TURN_TRACE output is required');
const started = Date.now();
function emit(row) { fs.appendFileSync(output, JSON.stringify({ ms: Date.now() - started, ...row }) + '\n'); }
const baseline = process.env.TM_FULL_TURN_BASELINE || null;
const overlays = new Map();
if (baseline) {
  const cache = JSON.parse(originalRead(process.env.TM_FULL_TURN_BASELINE_CACHE, 'utf8'));
  if (cache.baseline !== baseline) throw new Error('Diagnostic baseline cache identity mismatch');
  for (const row of cache.files) {
    overlays.set(path.resolve(root, row.path).toLowerCase(), row.base64 === null ? null : Buffer.from(row.base64, 'base64'));
  }
  function overlayKey(file) {
    if (typeof file !== 'string') return null;
    return path.resolve(file).toLowerCase();
  }
  fs.existsSync = function(file) { const key = overlayKey(file); return key && overlays.has(key) ? overlays.get(key) !== null : originalExists(file); };
  fs.readFileSync = function(file, options) {
    const key = overlayKey(file);
    if (!key || !overlays.has(key)) return originalRead(file, options);
    const bytes = overlays.get(key);
    if (bytes === null) { const error = new Error('File absent in diagnostic baseline: ' + file); error.code = 'ENOENT'; throw error; }
    const encoding = typeof options === 'string' ? options : options && options.encoding;
    return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
  };
  emit({ event: 'baseline_read_overlay', baseline, files: cache.files.map(r => r.path), prefetchMsOutsideChild: cache.prefetchMs, note: 'Git blobs are prefetched outside the child deadline; the child only decodes cached bytes. Working tree is never changed.' });
}
const actualRun = vm.runInContext;
let latestContext = null, currentStage = null, observedSaveContext = null, observersInstalled = false;
const promises = {};
function observeCall(owner, key, captureContext) {
  if (!owner || typeof owner[key] !== 'function') return;
  const original = owner[key];
  owner[key] = function() {
    if (captureContext) observedSaveContext = arguments[0];
    const record = promises[key] = { status: 'called', calledAtMs: Date.now() - started };
    emit({ event: 'observed_call', name: key });
    const value = original.apply(this, arguments);
    if (value && typeof value.then === 'function') {
      record.status = 'pending';
      value.then(function(result) { record.status = 'fulfilled'; record.settledAtMs = Date.now() - started; record.result = typeof result === 'boolean' ? result : result && result.ok; emit({ event: 'observed_settlement', name: key, ...record }); }, function(error) { record.status = 'rejected'; record.settledAtMs = Date.now() - started; record.error = String(error && error.message || error).slice(0, 350); emit({ event: 'observed_settlement', name: key, ...record }); });
    } else record.status = 'returned';
    return value;
  };
}
function state() {
  const c = latestContext, g = c && c.GM, f = c && c.__flow;
  if (!g || !f) return null;
  const pending = g._pendingShijiModal;
  const diagnostics = [].concat(f.logs || [], f.warns || [], f.errors || []);
  const schemaErrors = diagnostics.filter(s => /schema|协议|JSON.*(?:失败|无效)|结构.*(?:错误|失败)|AI 返回不可用|validation|parse.*error/i.test(s));
  const jobRows = [].concat(g._postTurnJobs && g._postTurnJobs.pending || [], Array.isArray(g._postTurnDetachedJobs) ? g._postTurnDetachedJobs : []);
  const saveMeta = observedSaveContext && observedSaveContext.meta;
  let saveDB = null;
  if (c.TM_SaveDB) { const write = typeof c.TM_SaveDB.writeStatus === 'function' ? c.TM_SaveDB.writeStatus() : {}; saveDB = { available: typeof c.TM_SaveDB.isAvailable === 'function' && c.TM_SaveDB.isAvailable(), blocked: write.blocked, code: write.code }; }
  return {
    turn: g.turn, running: !!g.running, busy: !!g.busy, endTurnBusy: !!g._endTurnBusy,
    pending: pending && { aiReady: !!pending.aiReady, payload: !!pending.payload, courtDone: !!pending.courtDone },
    aiCalls: (f.aiCalls || []).length, steps: (f.steps || []).slice(-6),
    loading: (f.loading || []).slice(-3), errorTail: (f.errors || []).slice(-3), warnTail: (f.warns || []).slice(-3),
    writeTurnData: f.writeTurnData, autoSave: f.autoSave, preEndTurnSave: f.preEndTurnSave,
    modelSchemaErrorCount: schemaErrors.length, modelSchemaErrorTail: schemaErrors.slice(-4).map(s => s.slice(0, 350)),
    postTurnJobs: jobRows.map(j => ({ id: j.id, status: j.status, attempts: j.attempts, totalAttempts: j.totalAttempts, maxAttempts: j.maxAttempts, error: j.lastError && String(j.lastError.message || j.lastError).slice(0, 200) })),
    saveDB, promises, save: saveMeta && { hasEndTurnSavePromise: !!saveMeta.endTurnSavePromise, hasCanonicalPayload: !!saveMeta.canonicalWorldPayload, receiptState: saveMeta.canonicalSaveReceipt && saveMeta.canonicalSaveReceipt.state }
  };
}
vm.runInContext = function(code, context, options) {
  latestContext = context;
  if (!observersInstalled && String(code).trim() === 'endTurn();') {
    observersInstalled = true;
    observeCall(context, '_endTurn_saveSnapshot', true);
    observeCall(context.TM_SaveDB, 'createCanonicalPayload', false);
    observeCall(context.TM_SaveDB, 'saveManyAtomic', false);
  }
  const label = options && options.filename || String(code).trim().slice(0, 180).replace(/\s+/g, ' ');
  currentStage = label;
  const t = Date.now(); emit({ event: 'vm_begin', stage: label });
  try {
    const result = actualRun.apply(this, arguments);
    emit({ event: 'vm_return', stage: label, elapsedMs: Date.now() - t, promise: !!(result && typeof result.then === 'function'), state: options && options.filename ? undefined : state() });
    return result;
  } catch (error) { emit({ event: 'vm_throw', stage: label, elapsedMs: Date.now() - t, error: String(error), state: state() }); throw error; }
};
const timer = setInterval(() => emit({ event: 'heartbeat', currentStage, state: state() }), 5000);
timer.unref();
process.on('exit', code => emit({ event: 'exit', code, state: state() }));
emit({ event: 'begin', node: process.version, baseline });
