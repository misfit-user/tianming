const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;

[
  'tm-memory-controls.js',
  'tm-memory-retrieval.js',
].forEach((file) => {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox.window, { filename: file });
});

const MC = sandbox.window.TM && sandbox.window.TM.MemoryControls;
const MR = sandbox.window.TM && sandbox.window.TM.MemoryRetrieval;

assert(MC, 'TM.MemoryControls should be exported');
['keyFor', 'pinMemory', 'hideMemory', 'archiveMemory', 'markFalse', 'supersedeMemory', 'clearControl'].forEach((name) => {
  assert.strictEqual(typeof MC[name], 'function', 'MemoryControls should expose ' + name);
});

const GM = { turn: 9 };
const ref = { type: 'currentIssues', id: 'issue-river' };
assert.strictEqual(MC.keyFor(ref), 'currentIssues:issue-river', 'keyFor should use type:id refs');

MC.pinMemory(GM, ref, { resident: true, reason: 'manual pin' });
let ranked = MR.rankHitsDetailed([
  { id: 'issue-river', source: 'issue', text: 'river audit', sourceRefs: [ref], turn: 8 },
], { GM, turn: GM.turn });
assert.strictEqual(ranked.ranked[0].pinned, true, 'pinMemory should make a hit pinned');
assert.strictEqual(ranked.ranked[0].memoryControl.resident, true, 'resident pin should survive into hit metadata');

MC.hideMemory(GM, ref, { reason: 'spoiler' });
ranked = MR.rankHitsDetailed([
  { id: 'issue-river', source: 'issue', text: 'river audit', sourceRefs: [ref], turn: 8 },
], { GM, turn: GM.turn });
assert(ranked.suppressed.some((s) => s.reason === 'hidden_control'), 'hideMemory should suppress hits with hidden_control reason');

MC.clearControl(GM, ref);
MC.markFalse(GM, ref, { reason: 'player corrected this' });
ranked = MR.rankHitsDetailed([
  { id: 'issue-river', source: 'issue', text: 'river audit', sourceRefs: [ref], turn: 8 },
], { GM, turn: GM.turn });
assert(ranked.suppressed.some((s) => s.reason === 'marked_false'), 'markFalse should suppress false memories');

MC.supersedeMemory(GM, ref, { type: 'currentIssues', id: 'issue-river-new' }, { reason: 'merged into newer issue' });
assert(GM._memEdges.some((e) => e.type === 'supersedes' && e.src === 'currentIssues:issue-river-new' && e.dst === 'currentIssues:issue-river'), 'supersedeMemory should create a memory edge');

console.log('smoke-memory-controls-actions ok');
