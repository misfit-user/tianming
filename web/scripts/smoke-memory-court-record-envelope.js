const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;

[
  'tm-memory-envelope.js',
  'tm-memory-governance.js',
  'tm-memory-retrieval.js',
].forEach((file) => {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox.window, { filename: file });
});

const ME = sandbox.window.TM && sandbox.window.TM.MemoryEnvelope;
const MR = sandbox.window.TM && sandbox.window.TM.MemoryRetrieval;
assert(ME, 'TM.MemoryEnvelope should be exported');
assert(MR, 'TM.MemoryRetrieval should be exported');

const GM = {
  turn: 12,
  _courtRecords: [
    {
      id: 'court-1',
      turn: 12,
      phase: 'post-turn',
      sourceType: 'changchao',
      sourceId: 'cc-12',
      topic: 'Liaodong pay arrears',
      decision: 'Approve emergency grain transport',
      result: 'approved',
      adopted: ['grain transport'],
      participants: ['Sun Chengzong', 'Yuan Chonghuan'],
      speaker: 'Sun Chengzong',
      visibility: 'public',
    },
  ],
};

const envelopes = ME.collect(GM);
const court = envelopes.find((env) => env && env.id === 'court-1');
assert(court, '_courtRecords should project into MemoryEnvelope');
assert.strictEqual(court.type, 'court_resolution', 'court decision should use court_resolution type');
assert.strictEqual(court.authority, 'rule_validated', 'court resolution should be rule_validated');
assert.strictEqual(court.lane, 'L4_dialogue_evidence', 'court record should use dialogue evidence lane');
assert(court.body.includes('Liaodong pay arrears'), 'court body should include topic');
assert(court.body.includes('Approve emergency grain transport'), 'court body should include decision');
assert(court.sourceRefs.some((ref) => ref.type === 'courtRecords' && ref.id === 'court-1'), 'court envelope should use courtRecords sourceRef');
assert(court.basisRefs.some((ref) => ref.type === 'changchao' && ref.id === 'cc-12'), 'court envelope should preserve source basisRef');
assert(court.entities.includes('Sun Chengzong') && court.entities.includes('Yuan Chonghuan'), 'court envelope should preserve participants');

const hits = MR.collectPriorityHits(GM, { keywords: ['Liaodong', 'grain'] }, { turn: 12 });
const hit = hits.find((item) => item && item.id === 'court-1');
assert(hit, 'court record envelope should be retrievable as a priority hit');
assert.strictEqual(hit.source, 'court_record', 'court retrieval source should be court_record');
assert(hit.sourceRefs.some((ref) => ref.type === 'courtRecords' && ref.id === 'court-1'), 'court hit should preserve sourceRefs');

console.log('smoke-memory-court-record-envelope ok');
