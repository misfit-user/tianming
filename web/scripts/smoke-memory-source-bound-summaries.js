const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;

[
  'tm-memory-trace.js',
  'tm-memory-evidence-registry.js',
  'tm-memory-source-bound.js',
].forEach((file) => {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox.window, { filename: file });
});

const MSB = sandbox.window.TM && sandbox.window.TM.MemorySourceBound;
assert(MSB, 'TM.MemorySourceBound should be exported');
assert.strictEqual(typeof MSB.buildSummaryMetadata, 'function', 'buildSummaryMetadata should be exported');

const GM = {
  turn: 15,
  shijiHistory: [{ id: 'shiji-11', turn: 11 }],
};

const meta = MSB.buildSummaryMetadata(GM, {
  type: 'memoryLayerL2',
  turn: 15,
  turnRange: '11-15',
  text: 'Five-turn scene summary for court and river works.',
  sourceItems: [
    {
      id: 'shiji-11',
      turn: 11,
      sourceRefs: [{ type: 'shijiHistory', id: 'shiji-11', authority: 'official_record' }],
      basisRefs: [{ type: 'edictTracker', id: 'edict-river', authority: 'player_pin' }],
    },
    {
      id: 'memory-13',
      turn: 13,
      sourceType: '_aiMemory',
      content: 'Minister warned river works may slip.',
    },
  ],
  maxBasisRefs: 8,
});

assert(/^memoryLayerL2-15-h/.test(meta.id), 'summary id should be stable and content-hash based');
assert.strictEqual(meta.sourceRefs[0].type, 'memoryLayerL2', 'summary source ref should point at the summary layer');
assert.strictEqual(meta.authorityLevel, 'ai_summary', 'summary authority should default to ai_summary');
assert.strictEqual(meta.factStatus, 'summary', 'summary factStatus should be summary');
assert(meta.contentHash && meta.contentHash.startsWith('h'), 'summary should carry contentHash');
assert(meta.basisRefs.some((r) => r.type === 'shijiHistory' && r.id === 'shiji-11'), 'summary should cite source records');
assert(meta.basisRefs.some((r) => r.type === 'edictTracker' && r.id === 'edict-river'), 'summary should inherit source basis refs');
assert(meta.basisRefs.every((r) => typeof r.authorityRank === 'number'), 'summary basis refs should be normalized');

console.log('smoke-memory-source-bound-summaries ok');
