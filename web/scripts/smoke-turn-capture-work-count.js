'use strict';

// Round 20: execute the production turn-capture and canonical-save boundaries
// and gate structural work counts rather than unstable wall-clock timings.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

const ROOT = path.resolve(__dirname, '..');
function read(name) { return fs.readFileSync(path.join(ROOT, name), 'utf8'); }
function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('missing function: ' + marker);
  let cursor = source.indexOf('{', start);
  let depth = 0;
  for (; cursor < source.length; cursor++) {
    if (source[cursor] === '{') depth++;
    else if (source[cursor] === '}' && --depth === 0) return source.slice(start, cursor + 1);
  }
  throw new Error('unterminated function: ' + marker);
}
function extractBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  if (start < 0 || end < 0) throw new Error('missing slice ' + startMarker + ' -> ' + endMarker);
  return source.slice(start, end);
}
function clone(value) { return JSON.parse(JSON.stringify(value)); }

(async function main() {
  const lifecycle = read('tm-save-lifecycle.js');
  const core = read('tm-endturn-core.js');
  const render = read('tm-endturn-render.js');
  const snapshotBuilder = extractFunction(lifecycle, 'function _tmSaveSnapshotSkipKeys(') + '\n' + extractFunction(lifecycle, 'function _autoSaveSnapshotGM(');
  const persistenceBuilder = extractFunction(lifecycle, 'function _buildSaveState(');
  const transactionBoundary = extractBetween(core, 'function _tmCaptureEndTurnObject(', 'async function _tmCommitPreEndTurnRecoveryPoint(');
  const finalSave = extractFunction(render, 'function _endTurn_saveSnapshot(');

  let payloadBuilds = 0;
  let snapshotCalls = 0;
  let slotBatch = null;
  const context = {
    console, Promise, Date, Math, JSON, Object, Array, Number, String,
    setTimeout, clearTimeout, structuredClone,
    crypto: { randomUUID() { return 'round20-transaction'; } },
    localStorage: { setItem() {}, getItem() { return null; }, removeItem() {} },
    deepClone: clone,
    _tmStripAiKeyInPlace(value) { return value; },
    _prepareGMForSave(gm, p) { return { GM: gm, P: p }; },
    _endTurn_stripCommittedDraftsFromSnapshot() {},
    async _endTurn_stageTurnData() { return true; },
    async _endTurn_discardStagedTurnData() { return true; },
    _clearPreEndturnMarkerAfterSave() {},
    _updateSaveIndex() {},
    findScenarioById() { return { name: '结构测试剧本' }; },
    getTSText(turn) { return 'T' + turn; },
    TM_SaveDB: {
      async createCanonicalPayload(state, identity) {
        payloadBuilds++;
        const json = JSON.stringify(state);
        return Object.freeze({ identity, state, json, checksum: 'fixed', compressed: json });
      },
      async saveManyAtomic(records) {
        slotBatch = records;
        return true;
      }
    },
    StateSnapshot: {
      async save(input) {
        snapshotCalls++;
        assert.strictEqual(input.canonicalState, slotBatch[0].gameState);
        assert.strictEqual(input.canonicalPayload, slotBatch[0].canonicalPayload);
        return { ok: true };
      }
    }
  };
  context.window = context;
  context.globalThis = context;
  context.GM = {
    sid: 'round20', turn: 40, running: true, busy: false,
    _campaignId: 'campaign-round20', _timelineId: 'timeline-round20',
    treasury: 1000, population: { national: { mouths: 100000 } },
    chars: [], facs: [], armies: [], officeTree: []
  };
  context.P = { conf: { seed: 'fixed' }, ai: {} };
  context._tmLoadGen = 3;

  vm.createContext(context);
  vm.runInContext(read('tm-perf.js'), context, { filename: 'tm-perf.js' });
  vm.runInContext(snapshotBuilder + '\n' + persistenceBuilder + '\n' + transactionBoundary + '\n' + finalSave, context, {
    filename: 'round20-turn-capture-production-boundaries.js'
  });

  const txn = context._tmCaptureEndTurnTransaction();
  const clickState = context._tmCapturePreEndTurnCommittedState(txn);
  assert.strictEqual(clickState.GM.turn, 40);
  context.GM.turn = 41;
  context.GM.treasury = 875;
  const saveContext = { meta: { transaction: txn, transactionId: txn.transactionId } };
  assert.strictEqual(await context._endTurn_saveSnapshot(saveContext), true);

  const work = context.TM.perf.workReport().counters;
  assert.strictEqual(work['world.rollbackClone.count'], 1, 'one rollback capture per successful turn');
  assert.strictEqual(work['world.persistenceBuild.count'], 2, 'pre_endturn plus final canonical are the only detached builds');
  assert.strictEqual(payloadBuilds, 1, 'one canonical payload per final state');
  assert.strictEqual(snapshotCalls, 1, 'StateSnapshot consumes the canonical state once');
  assert.strictEqual(slotBatch.length, 2);
  assert.strictEqual(slotBatch[0].id, 'autosave');
  assert.strictEqual(slotBatch[1].id, 'slot_0');
  assert.strictEqual(slotBatch[0].gameState, slotBatch[1].gameState, 'both slots share the detached state');
  assert.strictEqual(slotBatch[0].canonicalPayload, slotBatch[1].canonicalPayload, 'both slots share one serialized payload');
  assert.strictEqual(txn.captureSession.preEndturnState, clickState);
  assert.strictEqual(txn.captureSession.finalCanonicalState, slotBatch[0].gameState);
  assert.strictEqual(txn.captureSession.finalPayload, slotBatch[0].canonicalPayload);
  assert.strictEqual(slotBatch[0].gameState.GM.turn, 41);
  assert.strictEqual(slotBatch[0].gameState.GM.treasury, 875);
  assert.strictEqual(clickState.GM.turn, 40, 'click snapshot stays detached after live-world mutation');
  assert.strictEqual(clickState.GM.treasury, 1000);

  console.log('[smoke-turn-capture-work-count] PASS rollback=1 detached=2 payload=1 snapshotRebuild=0');
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
