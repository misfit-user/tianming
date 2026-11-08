'use strict';

// Diagnostic only: explicit GC and tiny objects. This does not launch the game,
// run browser acceptance, measure production retained bytes, or prove an OOM fix.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const crypto = require('crypto');
const cp = require('child_process');
const assert = require('assert/strict');
const args = process.argv.slice(2);
const option = (name) => { const i = args.indexOf(name); return i < 0 ? null : args[i + 1]; };
const repo = path.resolve(__dirname, '../../..');
const sourcePath = 'web/tm-endturn-render.js';
const commit = option('--source-commit');
const unconfirmed = args.includes('--unconfirmed');
const bytes = commit
  ? cp.execFileSync('git', ['show', commit + ':' + sourcePath], { cwd: repo })
  : fs.readFileSync(path.join(repo, sourcePath));
const source = bytes.toString('utf8');
const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim();
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const functionStart = source.indexOf('function _endTurn_saveSnapshot(ctx) {');
const functionEnd = source.indexOf('\n// 世界态变更摘要', functionStart);
assert(functionStart >= 0 && functionEnd > functionStart, 'actual source boundaries must exist');
assert.equal(typeof global.gc, 'function', 'run this diagnostic with --expose-gc');
let resolveRequired;
const required = new Promise(resolve => { resolveRequired = resolve; });
let stateWeak, payloadWeak, backgroundRequests = 0, snapshotRequests = 0, recoveryObserved = false;
const game = { turn: 4, sid: 'diagnostic-only', _campaignId: 'small-test', _timelineId: 'small-timeline', eraName: 'test' };
const player = { name: 'small-player' };
const context = {
  GM: game, P: player, window: { _tmLoadGen: 0 }, console: { warn() {} },
  localStorage: { getItem() { return null; }, removeItem() {}, setItem() {} },
  TM: {}, Date, Promise, JSON, Array, Object, String, Number,
  _buildSaveState() {
    const state = { GM: { ...game, pad: 'small'.repeat(16) }, P: { ...player } };
    stateWeak = new WeakRef(state);
    return state;
  },
  TM_SaveDB: {
    createCanonicalPayload(state, identity) {
      const payload = { state, identity, json: JSON.stringify(state), compressed: 'tiny' };
      payloadWeak = new WeakRef(payload);
      return Promise.resolve(payload);
    },
    async saveManyAtomic(rows, options) {
      assert.equal(rows.length, 2);
      if (unconfirmed) { const error = new Error('diagnostic unknown storage result'); error.code = 'SAVE_WRITE_UNCONFIRMED'; throw error; }
      options.onCommitted({ state: 'committed', transactionId: 'small-tx', slots: ['autosave', 'slot_0'].map(id => ({ id, turn: 4, campaignId: 'small-test', timelineId: 'small-timeline' })) });
      return true;
    }
  },
  _awaitPostTurnJobsForSave() { return required; },
  _postTurnSaveRequiredIds() { return ['sc25', 'sc25c']; },
  requestBackgroundAutosave() { backgroundRequests++; return Promise.resolve({ ok: true, scheduled: true }); },
  StateSnapshot: { save(options) {
    snapshotRequests++;
    recoveryObserved = options.canonicalState === stateWeak.deref() && options.canonicalPayload === payloadWeak.deref();
    return Promise.resolve({ ok: true });
  } }
};
context.window.TM = context.TM;
vm.createContext(context);
// Load the real source, including any extracted producer helper. No save/review
// implementation is copied into this diagnostic.
vm.runInContext(source, context, { filename: sourcePath });
// Isolate storage IO; this helper is outside the function whose retention is tested.
context._endTurn_stageTurnData = () => Promise.resolve();
const tick = () => new Promise(resolve => setImmediate(resolve));
async function collect() { for (let i = 0; i < 4; i++) { await tick(); global.gc(); } }

(async () => {
  const startedAt = new Date().toISOString();
  const ctx = { meta: { transactionId: 'small-tx', transaction: { captureSession: {} } } };
  if (unconfirmed) await assert.rejects(context._endTurn_saveSnapshot(ctx), { code: 'SAVE_WRITE_UNCONFIRMED' });
  else assert.equal(await context._endTurn_saveSnapshot(ctx), true);
  // Match the fields cleared by the committed core boundary. The real current
  // world/canonical owner is intentionally absent: only producer retention is tested.
  function releaseCommittedFields() {
    ctx.meta.canonicalWorldSnapshot = null;
    ctx.meta.canonicalWorldSnapshotMeta = null;
    ctx.meta.canonicalWorldPayload = null;
    ctx.meta.acceptReconciledCommit = null;
    Object.keys(ctx.meta.transaction.captureSession).forEach(key => { ctx.meta.transaction.captureSession[key] = null; });
  }
  if (!unconfirmed) releaseCommittedFields();
  await collect();
  const whilePending = { stateRetained: !!stateWeak.deref(), payloadRetained: !!payloadWeak.deref(), backgroundRequests };
  await tick();
  resolveRequired();
  await collect();
  const afterProducer = { stateRetained: !!stateWeak.deref(), payloadRetained: !!payloadWeak.deref(), backgroundRequests };
  assert.deepEqual(afterProducer, { stateRetained: unconfirmed, payloadRetained: unconfirmed, backgroundRequests: 1 });
  let afterReconciliation = null;
  if (unconfirmed) {
    assert.equal(typeof ctx.meta.acceptReconciledCommit, 'function');
    await ctx.meta.acceptReconciledCommit();
    assert.equal(snapshotRequests, 1);
    assert.equal(recoveryObserved, true, 'reconciliation must still receive the same canonical state and payload');
    releaseCommittedFields();
    await collect();
    afterReconciliation = { stateRetained: !!stateWeak.deref(), payloadRetained: !!payloadWeak.deref(), snapshotRequests, recoveryObserved };
    assert.deepEqual(afterReconciliation, { stateRetained: false, payloadRetained: false, snapshotRequests: 1, recoveryObserved: true });
  }
  const expected = option('--expected-pending');
  if (expected) {
    assert(['retained', 'released'].includes(expected));
    assert.deepEqual(whilePending, { stateRetained: expected === 'retained', payloadRetained: expected === 'retained', backgroundRequests: 0 });
  }
  const result = {
    diagnosticOnly: true, explicitGc: true, gameStarted: false, productionAcceptance: false,
    head, sourceCommit: commit || null, sourcePath, sourceSha256: hash(bytes),
    functionSha256: hash(source.slice(functionStart, functionEnd)), versions: process.versions,
    startedAt, finishedAt: new Date().toISOString(), unconfirmed, whilePending, afterProducer, afterReconciliation
  };
  const json = JSON.stringify(result, null, 2) + '\n';
  if (option('--output')) fs.writeFileSync(path.resolve(option('--output')), json, { flag: 'wx' });
  process.stdout.write(json);
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
