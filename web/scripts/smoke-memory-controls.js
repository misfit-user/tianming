const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;

vm.runInNewContext(fs.readFileSync(path.join(ROOT, 'tm-memory-retrieval.js'), 'utf8'), sandbox.window, {
  filename: 'tm-memory-retrieval.js',
});

const MR = sandbox.window.TM && sandbox.window.TM.MemoryRetrieval;
assert(MR, 'TM.MemoryRetrieval should be exported');
assert.strictEqual(typeof MR.memoryControlKey, 'function', 'memoryControlKey should be exported');
assert.strictEqual(typeof MR.memoryControlForHit, 'function', 'memoryControlForHit should be exported');

const GM = {
  turn: 12,
  _memoryControls: {
    'currentIssues:issue-resident': { resident: true, locked: true, reason: 'player wants this issue always present' },
    'shijiHistory:shiji-cooldown': { cooldownUntilTurn: 20, reason: 'recently injected' },
  },
};

const detailed = MR.rankHitsDetailed([
  {
    id: 'issue-resident',
    source: 'issue',
    text: 'resident issue',
    turn: 10,
    importance: 1,
    sourceRefs: [{ type: 'currentIssues', id: 'issue-resident' }],
  },
  {
    id: 'shiji-cooldown',
    source: 'shiji',
    text: 'cooldown history',
    turn: 11,
    importance: 10,
    sourceRefs: [{ type: 'shijiHistory', id: 'shiji-cooldown' }],
  },
], { turn: 12, GM });

const resident = detailed.ranked.find((h) => h.id === 'issue-resident');
assert(resident, 'resident controlled memory should remain ranked');
assert.strictEqual(resident.pinned, true, 'resident memory should become pinned for packing');
assert.strictEqual(resident.locked, true, 'locked control should be reflected on the hit');
assert(resident.memoryControl && resident.memoryControl.reason, 'hit should carry compact memory control metadata');

assert(!detailed.ranked.some((h) => h.id === 'shiji-cooldown'), 'cooldown memory should not be ranked');
assert(detailed.suppressed.some((s) => s.id === 'shiji-cooldown' && s.reason === 'cooldown'), 'cooldown suppression should be diagnostic');

const packed = MR.packForInjection([
  { query: { purpose: 'controls' }, hits: resident ? [resident] : [] },
], { maxTokens: 40, perHitMaxChars: 20 });

assert(packed.recallResults[0].hits.some((h) => h.id === 'issue-resident'), 'resident memory should survive injection packing');

console.log('smoke-memory-controls ok');
