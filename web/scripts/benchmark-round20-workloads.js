'use strict';

// Informational benchmark only. CI gates structural counters in smoke tests;
// these wall-clock/heap observations are reported but never used as a hard gate.
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { performance } = require('perf_hooks');

const ROOT = path.resolve(__dirname, '..');
const lifecycle = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
function extractFunction(source, marker) {
  const start = source.indexOf(marker);
  let at = source.indexOf('{', start);
  let depth = 0;
  for (; at < source.length; at++) {
    if (source[at] === '{') depth++;
    else if (source[at] === '}' && --depth === 0) return source.slice(start, at + 1);
  }
  throw new Error('missing function ' + marker);
}
const builderSource = extractFunction(lifecycle, 'function _tmSaveSnapshotSkipKeys(') + '\n'
  + extractFunction(lifecycle, 'function _autoSaveSnapshotGM(') + '\n'
  + extractFunction(lifecycle, 'function _buildSaveState(');

function run(turns) {
  const context = {
    console, performance, Date, Math, JSON, Object, Array, Number,
    window: null,
    deepClone(value) { return JSON.parse(JSON.stringify(value)); },
    _tmStripAiKeyInPlace(value) { return value; },
    _prepareGMForSave(gm, p) { return { GM: gm, P: p }; },
    GM: {
      turn: turns,
      _campaignId: 'benchmark',
      _timelineId: 'benchmark-timeline',
      chars: Array.from({ length: 120 }, (_, i) => ({ id: 'char-' + i, name: '人物' + i, stats: { loyalty: i % 100 } })),
      facs: Array.from({ length: 12 }, (_, i) => ({ id: 'fac-' + i, name: '势力' + i })),
      shijiHistory: Array.from({ length: turns }, (_, i) => ({ id: 'history-' + i, turn: i, shilu: ('固定长局史料' + i).repeat(16) })),
      evtLog: Array.from({ length: turns }, (_, i) => ({ id: 'event-' + i, turn: i, text: ('固定事件' + i).repeat(8) })),
      population: { national: { mouths: 50000000, households: 10000000, ding: 15000000 } },
      mapData: { regions: Array.from({ length: 100 }, (_, i) => ({ id: 'region-' + i, development: i, troops: i * 100 })) }
    },
    P: { conf: { fixedSeed: 20260824 }, ai: {} }
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-perf.js'), 'utf8'), context);
  vm.runInContext(builderSource, context);
  const heapBefore = process.memoryUsage().heapUsed;
  const started = performance.now();
  const pre = context._buildSaveState({ format: 'idb', detach: true, gm: context.GM, p: context.P });
  context.GM.turn += 1;
  const final = context._buildSaveState({ format: 'idb', detach: true, gm: context.GM, p: context.P });
  const json = JSON.stringify(final);
  const elapsedMs = performance.now() - started;
  const heapAfter = process.memoryUsage().heapUsed;
  const counters = context.TM.perf.workReport().counters;
  return {
    turns,
    elapsedMs: Number(elapsedMs.toFixed(3)),
    heapDeltaBytes: heapAfter - heapBefore,
    payloadBytes: Buffer.byteLength(json),
    persistenceBuilds: counters['world.persistenceBuild.count'] || 0,
    visitedTopLevelNodes: counters['world.persistenceVisitedNodes'] || 0,
    detachedIsolation: pre.GM !== context.GM && final.GM !== context.GM,
    gcControlled: false,
    longTaskObserved: null
  };
}

console.log(JSON.stringify({
  kind: 'round20-informational-node-benchmark',
  note: 'Wall clock and heap are observations only; deterministic smoke counters are the gate.',
  samples: [0, 100, 500, 1000].map(run)
}, null, 2));
