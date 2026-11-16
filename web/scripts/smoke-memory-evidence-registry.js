const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const registryPath = path.join(ROOT, 'tm-memory-evidence-registry.js');
assert(fs.existsSync(registryPath), 'tm-memory-evidence-registry.js should exist');

const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const registryIdx = indexHtml.indexOf('tm-memory-evidence-registry.js');
const envelopeIdx = indexHtml.indexOf('tm-memory-envelope.js');
assert(registryIdx >= 0, 'index should load tm-memory-evidence-registry.js');
assert(envelopeIdx >= 0, 'index should load tm-memory-envelope.js');
assert(registryIdx < envelopeIdx, 'evidence registry should load before memory envelope');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;
vm.runInNewContext(fs.readFileSync(registryPath, 'utf8'), sandbox.window, { filename: 'tm-memory-evidence-registry.js' });

const ER = sandbox.window.TM && sandbox.window.TM.MemoryEvidenceRegistry;
assert(ER, 'TM.MemoryEvidenceRegistry should be exported');
[
  'getDefinitions',
  'getAuthorityRank',
  'buildEvidenceSnapshot',
  'buildBasisRefs',
].forEach((name) => assert.strictEqual(typeof ER[name], 'function', 'EvidenceRegistry should expose ' + name));

const GM = {
  turn: 41,
  chars: [{ id: 'char-hai', name: 'Hai Rui', alive: true }],
  currentIssues: [
    {
      id: 'issue-flood',
      title: 'River floods',
      category: '民生',
      status: 'pending',
      sourceType: 'ai_analysis',
      authorityLevel: 'ai_analysis',
      confidence: 0.55,
      evidenceRefs: [{ type: 'shijiHistory', id: 'shiji-40' }],
    },
  ],
  shijiHistory: [
    { id: 'shiji-40', turn: 40, shilu: 'Official river flood record', shizhengji: 'River floods pressure the court.' },
  ],
  qijuHistory: [
    { turn: 41, edictsSource: 'promulgated', edicts: { political: 'Repair river dikes' }, xinglu: 'Inspect river works' },
    { turn: 40, category: '民变', content: 'Villagers report broken dikes.' },
  ],
  jishiRecords: [
    { turn: 41, char: 'Hai Rui', playerSaid: 'Investigate the river works', npcSaid: 'I will inspect the dikes.', mode: 'mizhao' },
  ],
  biannianItems: [
    { id: 'bn-flood', turn: 40, title: 'Flood rises', content: 'Yellow River floods several counties.', type: 'disaster' },
  ],
  _chronicleTracks: [
    { id: 'track-river', title: 'River repair', status: 'active', progress: 35, sourceType: 'edict', sourceId: 'edict-river' },
    { id: 'track-scheme', title: 'Hidden grain hoarding', status: 'active', hidden: true, sourceType: 'scheme', sourceId: 'scheme-grain' },
  ],
  _edictTracker: [
    { id: 'edict-river', status: 'pending', content: 'Repair river dikes', turn: 41 },
  ],
  _memTables: {
    imperialEdict: { rows: [{ id: 'table-edict-river', status: 'active', title: 'River works order', content: 'Repair river dikes' }] },
  },
  _turnAiResults: { subcall1: { turn_summary: 'River pressure grows.' }, memoryTrace: {} },
  _stateBoard: { pressure: 'river' },
  _lastSc28Snapshot: { risks: ['river'] },
  _consolidatedMemory: 'The river works have been delayed for three turns.',
};

sandbox.window.ChronicleSystem = {
  monthDrafts: {
    '1-1': { turn: 40, summary: 'Monthly river draft', detail: 'Dikes weakened.' },
  },
  yearChronicles: {
    1: { year: 1, content: 'Year river summary', summary: 'Floods shaped the year.' },
  },
};

const defs = ER.getDefinitions();
['chars', 'currentIssues', 'shijiHistory', 'qijuHistory', 'jishiRecords', 'biannianItems', 'chronicleTracks', 'turnAiResults'].forEach((id) => {
  assert(defs.some((d) => d.id === id), 'definition should include ' + id);
});

assert(ER.getAuthorityRank('engine_state') > ER.getAuthorityRank('ai_analysis'), 'engine_state should outrank ai_analysis');
assert(ER.getAuthorityRank('player_pin') > ER.getAuthorityRank('raw_narrative'), 'player_pin should outrank raw narrative');

const snapshot = ER.buildEvidenceSnapshot(GM);
assert.strictEqual(snapshot.schemaVersion, 'memoryEvidence.v1', 'snapshot should carry schema version');
assert(snapshot.sources.length >= 10, 'snapshot should cover major evidence sources');

function source(id) {
  const found = snapshot.sources.find((s) => s.id === id);
  assert(found, 'snapshot should include source ' + id);
  return found;
}

assert.strictEqual(source('currentIssues').authority, 'ai_analysis', 'currentIssues should be advisory analysis');
assert.strictEqual(source('currentIssues').role, 'advisory', 'currentIssues should not be hard fact');
assert.strictEqual(source('currentIssues').count, 1, 'currentIssues count should be populated');
assert.strictEqual(source('qijuHistory').count, 2, 'qijuHistory count should include mixed schemas');
assert.strictEqual(source('jishiRecords').authority, 'court_report', 'jishiRecords should be court_report authority');
assert.strictEqual(source('chronicleTracks').authority, 'rule_validated', 'visible chronicle tracks should be rule_validated authority');
assert(source('chronicleTracks').hiddenCount >= 1, 'chronicleTracks should report hidden tracks separately');
assert.strictEqual(source('turnAiResults').role, 'ephemeral_bus', 'turnAiResults should be marked as an ephemeral bus');

const basisRefs = ER.buildBasisRefs(GM, { maxRefs: 12 });
assert(basisRefs.some((r) => r.type === 'edictTracker' && r.id === 'edict-river'), 'basis refs should include edictTracker');
assert(basisRefs.some((r) => r.type === 'qijuHistory'), 'basis refs should include qijuHistory');
assert(basisRefs.some((r) => r.type === 'currentIssues' && r.id === 'issue-flood'), 'basis refs should include currentIssues');
assert(basisRefs.every((r) => r.authority && typeof r.authorityRank === 'number'), 'basis refs should carry authority rank');

console.log('smoke-memory-evidence-registry ok');
