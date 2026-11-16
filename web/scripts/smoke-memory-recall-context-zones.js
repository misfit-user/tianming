const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const traceSrc = fs.readFileSync(path.join(ROOT, 'tm-memory-trace.js'), 'utf8');
const zonesSrc = fs.readFileSync(path.join(ROOT, 'tm-context-zones.js'), 'utf8');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;
vm.runInNewContext(traceSrc, sandbox.window, { filename: 'tm-memory-trace.js' });
vm.runInNewContext(zonesSrc, sandbox.window, { filename: 'tm-context-zones.js' });

const CZ = sandbox.window.TM && sandbox.window.TM.ContextZones;
const GM = { turn: 12, _turnAiResults: {} };
const packed = CZ.packZones([
  { id: 'recall-header', lane: 'L6_retrieved_evidence', text: '<recalled-memories>\n', mustKeep: true, order: 0 },
  { id: 'keep-hard', lane: 'L1_world_truth', text: 'hard state '.repeat(10), source: 'hard_state', score: 0.5, order: 10 },
  { id: 'drop-old', lane: 'L6_retrieved_evidence', text: 'old vector '.repeat(120), source: 'vector', score: 0.4, order: 20 },
  { id: 'recall-footer', lane: 'L6_retrieved_evidence', text: '</recalled-memories>\n', mustKeep: true, order: 999 },
], { maxTokens: 80 });
const trace = CZ.recordZoneInjection(GM, packed, { stage: 'sc05-recall' });
assert(trace && trace.stage === 'sc05-recall', 'recordZoneInjection should persist sc05-recall stage');
assert(trace.suppressed && trace.suppressed.some((s) => s.reason === 'zone_budget_exceeded'), 'zone injection trace should preserve dropped zone reason');

console.log('smoke-memory-recall-context-zones ok');
