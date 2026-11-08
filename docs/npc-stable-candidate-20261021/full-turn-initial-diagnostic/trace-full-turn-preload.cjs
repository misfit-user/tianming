'use strict';
// Read-only diagnostic preload. The production test, assertions and deadlines are unchanged.
const fs = require('fs'), path = require('path'), cp = require('child_process'), vm = require('vm');
const root = path.resolve(__dirname, '../..');
const originalRead = fs.readFileSync.bind(fs), originalExists = fs.existsSync.bind(fs);
const output = process.env.TM_FULL_TURN_TRACE;
if (!output) throw new Error('TM_FULL_TURN_TRACE output is required');
const started = Date.now();
function emit(row) { fs.appendFileSync(output, JSON.stringify({ ms: Date.now() - started, ...row }) + '\n'); }
const baseline = process.env.TM_FULL_TURN_BASELINE || null;
const overlays = new Map();
if (baseline) {
  const changed = cp.execFileSync('git', ['diff', '--name-only', '-z', baseline, 'HEAD', '--', 'web', 'package.json', 'package-lock.json'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const file of changed) {
    const result = cp.spawnSync('git', ['show', baseline + ':' + file], { cwd: root, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
    overlays.set(path.resolve(root, file).toLowerCase(), result.status === 0 ? result.stdout : null);
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
  emit({ event: 'baseline_read_overlay', baseline, files: changed, note: 'Changed files are read from the named commit in memory; working tree is never changed.' });
}
const actualRun = vm.runInContext;
let latestContext = null, currentStage = null;
function state() {
  const c = latestContext, g = c && c.GM, f = c && c.__flow;
  if (!g || !f) return null;
  const pending = g._pendingShijiModal;
  return {
    turn: g.turn, running: !!g.running, busy: !!g.busy, endTurnBusy: !!g._endTurnBusy,
    pending: pending && { aiReady: !!pending.aiReady, payload: !!pending.payload, courtDone: !!pending.courtDone },
    aiCalls: (f.aiCalls || []).length, steps: (f.steps || []).slice(-6),
    loading: (f.loading || []).slice(-3), errorTail: (f.errors || []).slice(-3), warnTail: (f.warns || []).slice(-3),
    writeTurnData: f.writeTurnData, autoSave: f.autoSave, preEndTurnSave: f.preEndTurnSave
  };
}
vm.runInContext = function(code, context, options) {
  latestContext = context;
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
