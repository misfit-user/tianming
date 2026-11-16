const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const issueGovernancePath = path.join(ROOT, 'tm-memory-issue-governance.js');

assert(fs.existsSync(issueGovernancePath), 'tm-memory-issue-governance.js should exist');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;

[
  'tm-memory-trace.js',
  'tm-memory-evidence-registry.js',
  'tm-memory-source-bound.js',
  'tm-memory-issue-governance.js',
].forEach((file) => {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox.window, { filename: file });
});

const MIG = sandbox.window.TM && sandbox.window.TM.MemoryIssueGovernance;
assert(MIG, 'TM.MemoryIssueGovernance should be exported');
assert.strictEqual(typeof MIG.normalizeIssueUpdate, 'function', 'normalizeIssueUpdate should be exported');
assert.strictEqual(typeof MIG.recordIssueEdge, 'function', 'recordIssueEdge should be exported');
assert.strictEqual(typeof MIG.createIssueResolutionEdge, 'function', 'createIssueResolutionEdge should be exported');

const GM = {
  turn: 42,
  _edictTracker: [{ id: 'edict-river', turn: 41, status: 'executing' }],
};

const unverified = MIG.normalizeIssueUpdate({
  action: 'add',
  title: 'Rumor-only faction tension',
  confidence: 0.93,
}, GM);

assert.strictEqual(unverified.authorityLevel, 'ai_analysis', 'AI-generated issues should default to ai_analysis authority');
assert.strictEqual(unverified.factStatus, 'advisory_unverified', 'issue without evidence should be advisory_unverified');
assert(unverified.confidence <= 0.45, 'unverified issue confidence should be capped');
assert.strictEqual(unverified.evidenceRefs.length, 0, 'unverified issue should not invent evidence refs');

const verified = MIG.normalizeIssueUpdate({
  action: 'add',
  title: 'River works unresolved',
  evidenceRefs: [{ type: 'edictTracker', id: 'edict-river', authority: 'player_pin' }],
}, GM);

assert.strictEqual(verified.factStatus, 'advisory', 'issue with evidence should remain advisory by default');
assert(verified.evidenceRefs.some((r) => r.type === 'edictTracker' && r.id === 'edict-river'), 'explicit evidence ref should be preserved');
assert(verified.evidenceRefs.every((r) => typeof r.authorityRank === 'number'), 'issue evidence refs should be normalized');

const edge = MIG.recordIssueEdge(GM, {
  type: 'supersedes',
  src: 'issue-new',
  dst: 'issue-old',
  reason: 'new issue merges stale issue',
});
MIG.recordIssueEdge(GM, {
  type: 'supersedes',
  src: 'issue-new',
  dst: 'issue-old',
  reason: 'duplicate should not be recorded twice',
});

assert(edge, 'recordIssueEdge should return the stored edge');
assert.strictEqual(edge.turn, 42, 'issue edge should default to current turn');
assert.strictEqual(edge.srcRef, 'currentIssues:issue-new', 'edge should carry a typed source ref');
assert.strictEqual(edge.dstRef, 'currentIssues:issue-old', 'edge should carry a typed destination ref');
assert.strictEqual(GM._memEdges.length, 1, 'issue edges should dedupe identical src/dst/type triples');

console.log('smoke-memory-current-issues-governance ok');
