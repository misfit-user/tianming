const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const zonesPath = path.join(ROOT, 'tm-context-zones.js');

assert(fs.existsSync(zonesPath), 'tm-context-zones.js should exist');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;

[
  'tm-memory-trace.js',
  'tm-context-zones.js',
].forEach((file) => {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox.window, { filename: file });
});

const CZ = sandbox.window.TM && sandbox.window.TM.ContextZones;
assert(CZ, 'TM.ContextZones should be exported');
assert.strictEqual(typeof CZ.packZones, 'function', 'packZones should be exported');

const packed = CZ.packZones([
  { id: 'world', lane: 'L1_world_truth', text: 'hard world truth '.repeat(8), mustKeep: true, order: 10, score: 0.1 },
  { id: 'law', lane: 'L2_active_law_commitment', text: 'active law '.repeat(8), mustKeep: true, order: 20, score: 0.1 },
  { id: 'history-a', lane: 'L6_retrieved_evidence', text: 'long recalled history A '.repeat(30), order: 60, score: 0.9 },
  { id: 'history-b', lane: 'L6_retrieved_evidence', text: 'long recalled history B '.repeat(30), order: 61, score: 0.8 },
  { id: 'lesson', lane: 'L5_advisory_context', text: 'short procedural lesson', order: 50, score: 0.7 },
], {
  maxTokens: 95,
  defaultMaxTokens: 1000,
});

const keptIds = packed.items.map((i) => i.id);
assert(keptIds.includes('world'), 'L1 world truth should be kept');
assert(keptIds.includes('law'), 'L2 active law/commitment should be kept');
assert(keptIds.includes('lesson'), 'short advisory guidance should fit after must-keep zones');
assert(!keptIds.includes('history-a') || !keptIds.includes('history-b'), 'low-priority retrieved evidence should drop under budget');
assert(packed.tokenEstimate <= 95, 'packed zones should stay within max token budget');
assert(packed.text.indexOf('hard world truth') < packed.text.indexOf('active law'), 'packed text should preserve zone order');
assert(packed.diagnostics.dropped > 0, 'diagnostics should count dropped zones');
assert(packed.suppressed.some((s) => s.reason === 'zone_budget_exceeded'), 'suppressed zones should explain budget drops');

const GM = { turn: 9, _turnAiResults: {} };
const traceItem = CZ.recordZoneInjection(GM, packed, { stage: 'sc1-prefix' });
assert(traceItem, 'recordZoneInjection should write MemoryTrace injection');
assert.strictEqual(traceItem.lane, 'context_zones', 'zone trace should use context_zones lane');
assert(traceItem.items.some((i) => i.id === 'world' && i.lane === 'L1_world_truth'), 'zone trace should keep item lanes');

console.log('smoke-context-zones-core ok');
