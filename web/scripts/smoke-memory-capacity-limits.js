const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;

[
  'tm-memory-envelope.js',
  'tm-memory-writegate.js',
  'tm-memory-controls.js',
].forEach((file) => {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox.window, { filename: file });
});

const MW = sandbox.window.TM && sandbox.window.TM.MemoryWriteGate;
const MC = sandbox.window.TM && sandbox.window.TM.MemoryControls;
assert(MW, 'TM.MemoryWriteGate should be exported');
assert(MC, 'TM.MemoryControls should be exported');
assert.strictEqual(typeof MW.pruneQueues, 'function', 'MemoryWriteGate should expose pruneQueues');
assert.strictEqual(typeof MC.pruneControls, 'function', 'MemoryControls should expose pruneControls');

const GM = { turn: 40 };
for (let i = 0; i < 140; i++) {
  MW.enqueue(GM, {
    id: 'draft-' + i,
    type: 'semantic_fact',
    body: 'draft body ' + i,
    source: 'ai_extracted',
    sourceRefs: [{ type: 'dialogue', id: 'dlg-' + i }],
  });
}

assert(GM._memoryWriteQueue.length <= 80, 'write queue should be capped at 80 entries');
assert(GM._memoryDraftInbox.length <= 80, 'draft inbox should be capped at 80 entries');
assert(GM._memoryAuditEvents.length <= 120, 'memory audit events should be capped at 120 entries');
assert(GM._memoryWriteQueue.some((item) => item.id === 'draft-139'), 'write queue should retain newest entries');
assert(!GM._memoryWriteQueue.some((item) => item.id === 'draft-0'), 'write queue should prune oldest entries');

for (let i = 0; i < 140; i++) {
  MC.pinMemory(GM, { type: 'memory', id: 'pin-' + i }, { reason: 'cap test ' + i });
}
assert(Object.keys(GM._memoryControls).length <= 80, 'memory controls should be capped at 80 entries');
assert(GM._memoryControls['memory:pin-139'], 'memory controls should retain newest control');
assert(!GM._memoryControls['memory:pin-0'], 'memory controls should prune oldest control');

for (let i = 0; i < 140; i++) {
  MC.supersedeMemory(GM, { type: 'old', id: 'edge-' + i }, { type: 'new', id: 'edge-' + i }, { reason: 'edge cap ' + i });
}
assert(GM._memEdges.length <= 80, 'memory edges should be capped at 80 entries');
assert(GM._memEdges.some((edge) => edge.dst === 'old:edge-139'), 'memory edges should retain newest edge');
assert(!GM._memEdges.some((edge) => edge.dst === 'old:edge-0'), 'memory edges should prune oldest edge');

console.log('smoke-memory-capacity-limits ok');
