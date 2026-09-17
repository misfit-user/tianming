'use strict';

// Cross-system Round 20 regression: a writable map is cloned from frozen
// sources, a failed final persistence attempt rolls back every world-owned
// ledger/cache revision, and the following successful turn shares one payload.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const read = (name) => fs.readFileSync(path.join(ROOT, name), 'utf8');
const clone = (value) => JSON.parse(JSON.stringify(value));
function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.keys(value).forEach((key) => deepFreeze(value[key]));
  return value;
}
function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  if (start < 0) throw new Error('missing function ' + marker);
  let at = source.indexOf('{', start);
  let depth = 0;
  for (; at < source.length; at++) {
    if (source[at] === '{') depth++;
    else if (source[at] === '}' && --depth === 0) return source.slice(start, at + 1);
  }
  throw new Error('unterminated function ' + marker);
}
function extractBetween(source, first, last) {
  const start = source.indexOf(first);
  const end = source.indexOf(last, start);
  if (start < 0 || end < 0) throw new Error('missing production slice');
  return source.slice(start, end);
}

(async function main() {
  const scenario = deepFreeze({
    id: 'round20-a',
    map: { regions: [{ id: 'capital', name: '京畿', owner: 'fac-a', development: 40, troops: 1000 }] }
  });
  const P = {
    conf: { fixedSeed: 20 },
    ai: {},
    map: deepFreeze(clone(scenario.map))
  };
  const sourceBytes = JSON.stringify({ P, scenario });
  let committedBaseline = null;
  let snapshotWrites = 0;
  const context = {
    console, Date, Math, JSON, Promise, Number, String, Object, Array, Set, Map,
    structuredClone, setTimeout, clearTimeout,
    crypto: { randomUUID() { return 'round20-combined'; } },
    P,
    GM: {
      running: true, busy: false, sid: scenario.id, turn: 20,
      _campaignId: 'campaign-a', _timelineId: 'timeline-a',
      facs: [{ id: 'fac-a', name: '甲' }, { id: 'fac-b', name: '乙' }],
      activeWars: [{ id: 'war-a-b', attackerId: 'fac-a', defenderId: 'fac-b' }],
      population: { national: { mouths: 100000, households: 20000, ding: 30000 } },
      _memoryRevision: 3, _memoryEdgeRevision: 2, _semanticIndexRevision: 4,
      chars: [], armies: [], officeTree: []
    },
    deepClone: clone,
    findScenarioById(id) { return id === scenario.id ? scenario : null; },
    clamp(value, min, max) { return Math.max(min, Math.min(max, value)); },
    _dbg() {},
    recordChange() {},
    random() { return 0.5; },
    SettlementPipeline: { register() {} },
    document: { getElementById() { return null; }, addEventListener() {} },
    localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} },
    _tmStripAiKeyInPlace(value) { return value; },
    _prepareGMForSave(gm, project) { return { GM: gm, P: project }; },
    buildIndices() {}, renderGameState() {}, closeTurnResult() {},
    _tmAdoptCommittedWorldSnapshot(state) { committedBaseline = clone(state); return true; },
    _tmFlushDeferredDesktopAutoSave() { return Promise.resolve({ ok: true }); },
    StateSnapshot: { save() { snapshotWrites++; return Promise.resolve({ ok: true }); } }
  };
  context.window = context;
  context.globalThis = context;
  context._tmLoadGen = 1;
  vm.createContext(context);
  vm.runInContext(read('tm-perf.js'), context, { filename: 'tm-perf.js' });
  vm.runInContext(read('tm-map-system.js'), context, { filename: 'tm-map-system.js' });
  vm.runInContext(read('tm-feudal-warfare.js'), context, { filename: 'tm-feudal-warfare.js' });
  const lifecycle = read('tm-save-lifecycle.js');
  vm.runInContext(
    extractFunction(lifecycle, 'function _tmSaveSnapshotSkipKeys(') + '\n'
      + extractFunction(lifecycle, 'function _autoSaveSnapshotGM(') + '\n'
      + extractFunction(lifecycle, 'function _buildSaveState(') + '\n'
      + extractBetween(read('tm-endturn-core.js'), 'function _tmCaptureEndTurnObject(', 'async function _tmFinalizeEndTurnTransaction('),
    context,
    { filename: 'round20-combined-boundaries.js' }
  );

  const runtimeMap = context.ensureWritableRuntimeMap();
  assert(runtimeMap === context.GM.mapData && runtimeMap !== context.P.map);
  const beforeGM = clone(context.GM);
  const beforeP = clone(context.P);
  const txn = context._tmCaptureEndTurnTransaction();
  const clickState = context._tmCapturePreEndTurnCommittedState(txn);
  committedBaseline = clone(clickState);

  context.setMapRegionOwner('capital', 'fac-b', { reason: 'combined-failure' });
  context.WarWeightSystem.addTruce(context.GM.facs[0], context.GM.facs[1], 12, context.GM);
  context.GM.population.national.mouths -= 5000;
  context.GM._memoryRevision += 1;
  context.GM._memoryEdgeRevision += 1;
  context.GM._semanticIndexRevision += 1;

  const failedState = context._buildSaveState({ format: 'idb', detach: true, gm: context.GM, p: context.P });
  const failedPayload = { state: failedState, json: JSON.stringify(failedState), checksum: 'not-committed' };
  assert(failedPayload.json.includes('not-committed') === false);
  let atomicSaveFailed = false;
  try {
    throw new Error('injected canonical atomic failure');
  } catch (error) {
    atomicSaveFailed = true;
    assert.strictEqual(context._tmRollbackEndTurnTransaction(txn, error), true);
  }
  assert.strictEqual(atomicSaveFailed, true);
  assert.deepStrictEqual(clone(context.GM.mapData), beforeGM.mapData, 'runtime map rolls back');
  assert.deepStrictEqual(clone(context.GM._warTruces || null), beforeGM._warTruces || null, 'truce ledger rolls back');
  assert.deepStrictEqual(clone(context.GM.population), beforeGM.population, 'hukou/population rolls back');
  assert.strictEqual(context.GM._memoryRevision, beforeGM._memoryRevision, 'memory revision rolls back');
  assert.strictEqual(context.GM._semanticIndexRevision, beforeGM._semanticIndexRevision, 'semantic revision rolls back');
  assert.deepStrictEqual(clone(context.P), beforeP, 'P remains unchanged');
  assert.strictEqual(JSON.stringify({ P: context.P, scenario }), sourceBytes, 'P map and scenario registry remain byte-equivalent');
  assert.strictEqual(JSON.stringify(committedBaseline), JSON.stringify(clickState), 'desktop committed baseline is restored to click state');
  assert.strictEqual(snapshotWrites, 0, 'failed final world never reaches StateSnapshot');

  const successTxn = context._tmCaptureEndTurnTransaction();
  const successPre = context._tmCapturePreEndTurnCommittedState(successTxn);
  context.GM.turn = 21;
  context.updateMapRegionFields('capital', { development: 41 }, { reason: 'combined-success' });
  const successState = context._buildSaveState({ format: 'idb', detach: true, gm: context.GM, p: context.P });
  const json = JSON.stringify(successState);
  const canonicalPayload = Object.freeze({ state: successState, json, compressed: json, checksum: 'success' });
  const plannedSlots = [
    { id: 'autosave', canonicalPayload },
    { id: 'slot_0', canonicalPayload }
  ];
  await context.StateSnapshot.save({ canonicalState: successState, canonicalPayload });
  assert.strictEqual(plannedSlots[0].canonicalPayload, plannedSlots[1].canonicalPayload);
  assert.strictEqual(snapshotWrites, 1);
  assert.strictEqual(successTxn.captureSession.preEndturnState, successPre);

  context.P = { conf: {}, ai: {}, map: deepFreeze({ regions: [{ id: 'world-b', development: 7, troops: 8 }] }) };
  context.GM = {
    running: true, sid: 'round20-b', turn: 1,
    _campaignId: 'campaign-b', _timelineId: 'timeline-b',
    facs: [{ id: 'fac-b-only', name: '乙' }], chars: [], armies: [], officeTree: []
  };
  const worldBMap = context.ensureWritableRuntimeMap();
  context.WarWeightSystem.reset(context.GM);
  assert.strictEqual(worldBMap.regions[0].development, 7, 'world B clones its own immutable map');
  assert.strictEqual(context.WarWeightSystem.hasTruce('甲', '乙', context.GM), false, 'world B inherits no truce');
  assert.strictEqual(context.GM._memoryRevision, undefined, 'world B inherits no memory revision/cache state');
  assert.strictEqual(context.GM._semanticIndexRevision, undefined, 'world B inherits no semantic revision/cache state');

  const counters = context.TM.perf.workReport().counters;
  assert.strictEqual(counters['world.rollbackClone.count'], 2);
  assert.strictEqual(counters['world.persistenceBuild.count'], 4);
  console.log('[smoke-round20-performance-isolation] PASS failed-world-isolated successful-payload-shared world-b-clean');
})().catch((error) => {
  console.error(error && error.stack || error);
  process.exit(1);
});
