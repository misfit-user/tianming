#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

const sandbox = { window: {}, console, Date, Math, JSON };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

[
  'tm-memory-evidence-registry.js',
  'tm-memory-envelope.js',
  'tm-memory-writegate.js',
  'tm-memory-trace.js',
  'tm-memory-turn-inference.js',
  'tm-memory-workshop.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const MT = sandbox.TM && sandbox.TM.MemoryTrace;
const MTI = sandbox.TM && sandbox.TM.MemoryTurnInference;
const MW = sandbox.TM && sandbox.TM.MemoryWorkshop;
assert(MT, 'MemoryTrace should be exported');
assert.strictEqual(typeof MT.recordWrite, 'function', 'MemoryTrace should expose recordWrite');
assert(MTI, 'MemoryTurnInference should be exported');
assert.strictEqual(typeof MTI.collectPostTurnCandidates, 'function', 'candidate builder should be exported');
assert.strictEqual(typeof MTI.enqueuePostTurnCandidates, 'function', 'post-turn enqueue helper should be exported');
assert(MW, 'MemoryWorkshop should be exported');
assert.strictEqual(typeof MW.renderWriteTrace, 'function', 'Workshop should expose Write Trace renderer');

const longChronicle = 'SECRET_CHRONICLE_BODY_'.repeat(80);
const longIssue = 'SECRET_ISSUE_BODY_'.repeat(80);
const longCharacter = 'SECRET_CHARACTER_BODY_'.repeat(80);
const GM = {
  turn: 88,
  _turnAiResults: {}
};

MT.ensureTurnTrace(GM, { source: 'writeback-loop-smoke' });
MT.recordCompiledContext(GM, {
  id: 'SC1_PRE_CONTEXT',
  stage: 'sc1-pre-inference',
  lane: 'memory_context_compiler',
  compiled: {
    schemaVersion: 'memory-context/v0',
    text: '<memory-context>read basis</memory-context>',
    sections: { stateAffairs: [{ id: 'issue-chain-canal' }], chronology: [{ id: 'chronicle-rollup-1628' }], characterMemory: [] },
    hits: [{ id: 'issue-chain-canal', source: 'chronicle', type: 'ongoing_affair', text: 'canal issue chain basis', lane: 'L3_long_term_affair', authority: 'ai_analysis' }],
    tokenEstimate: 120,
    maxTokens: 1800
  },
  text: '<memory-context>read basis</memory-context>',
  intent: 'turn_inference',
  audience: 'system',
  actorScope: 'system',
  maxTokens: 1800,
  compileOpts: { turn: 88, intent: 'turn_inference', audience: 'system', actorScope: 'system', maxTokens: 1800 }
});

const aiResult = {
  turn_summary: longChronicle,
  shizhengji_basis: 'The canal payroll dispute is the decisive court issue this turn.',
  current_issues_update: [
    {
      action: 'update',
      id: 'issue-canal',
      title: 'Canal payroll arrears',
      category: '民生',
      description: longIssue,
      confidence: 0.7,
      source_refs: [{ type: 'courtRecords', id: 'cr-canal-88', turn: 88 }]
    }
  ],
  character_memory_updates: [
    {
      actor: 'Minister Bi',
      memory_type: 'commitment',
      memory: longCharacter,
      private: false,
      confidence: 0.74,
      source_refs: [{ type: 'jishiRecords', id: 'jr-bi-88', turn: 88 }]
    }
  ]
};

const candidates = MTI.collectPostTurnCandidates(GM, aiResult, { sourceId: 'SC1' });
assert(candidates.some((item) => item.type === 'turn_inference_summary'), 'SC1 turn summary should become a WriteGate candidate');
assert(candidates.some((item) => item.type === 'issue_update' && item.issueId === 'issue-canal'), 'current_issues_update should become a WriteGate candidate');
assert(candidates.some((item) => item.type === 'character_memory' && item.ownerScope === 'npc:Minister Bi'), 'character_memory_updates should still become actor-scoped candidates');
assert(candidates.every((item) => Array.isArray(item.sourceRefs) && item.sourceRefs.some((ref) => ref.type === 'aiTurnResult' && ref.id === 'SC1')), 'all SC1-derived candidates should cite aiTurnResult:SC1');
assert(candidates.every((item) => Array.isArray(item.basisRefs) && item.basisRefs.some((ref) => ref.type === 'memoryTrace.compiledContext' && ref.id === 'SC1_PRE_CONTEXT')), 'all SC1-derived candidates should link back to SC1_PRE_CONTEXT read context');

const result = MTI.enqueuePostTurnCandidates(GM, aiResult, { sourceId: 'SC1', forceDraft: true });
assert.strictEqual(result.added, 3, 'SC1 should enqueue chronicle, issue, and character candidates');
assert.strictEqual(result.candidates, 3, 'result should report candidate count');
assert.strictEqual(result.drafts, 3, 'AI candidates should remain drafts');
assert.strictEqual(result.quarantined, 0, 'valid sourced candidates should not be quarantined');
assert(Array.isArray(result.ids) && result.ids.length === 3, 'writeback result should return compact ids');
assert.strictEqual(GM._memoryDraftInbox.length, 3, 'WriteGate draft inbox receives all three candidates');
assert(GM._memoryDraftInbox.every((item) => item.reviewStatus === 'pending_review'), 'SC1-derived candidates wait for review');
assert(!GM._memoryAccepted || GM._memoryAccepted.length === 0, 'SC1-derived candidates are not accepted automatically');

const trace = MT.snapshot(GM);
assert(trace && Array.isArray(trace.writes), 'memory trace should keep writes list');
assert.strictEqual(trace.writes.length, 1, 'SC1 writeback should record one write trace');
const write = trace.writes[0];
assert.strictEqual(write.id, 'SC1_WRITEBACK');
assert.strictEqual(write.stage, 'postturn-memory-writeback');
assert.strictEqual(write.sourceId, 'SC1');
assert.strictEqual(write.added, 3);
assert.strictEqual(write.drafts, 3);
assert.strictEqual(write.quarantined, 0);
assert(write.readContextRefs.some((ref) => ref.id === 'SC1_PRE_CONTEXT'), 'write trace should link read context');
assert(write.items.some((item) => item.type === 'turn_inference_summary'), 'write trace should include chronicle candidate summary');
assert(write.items.some((item) => item.type === 'issue_update'), 'write trace should include issue candidate summary');
assert(write.items.some((item) => item.type === 'character_memory'), 'write trace should include character candidate summary');

const traceJson = JSON.stringify(trace);
assert(!traceJson.includes(longChronicle.slice(0, 120)), 'write trace must not store full chronicle body');
assert(!traceJson.includes(longIssue.slice(0, 120)), 'write trace must not store full issue body');
assert(!traceJson.includes(longCharacter.slice(0, 120)), 'write trace must not store full character body');

const summary = MT.summarize(GM);
assert.strictEqual(summary.writes, 1, 'trace summary should count writes');
assert.strictEqual(summary.writeCandidates, 3, 'trace summary should count write candidates');
assert.strictEqual(summary.writeDrafts, 3, 'trace summary should count draft writes');

const html = MW.renderWriteTrace(GM, { playerSafe: true });
assert(html.includes('Write Trace'), 'Workshop should render write trace');
assert(html.includes('SC1_WRITEBACK'), 'Workshop write trace should show write id');
assert(html.includes('SC1_PRE_CONTEXT'), 'Workshop write trace should show read-context linkage');
assert(!html.includes(longChronicle.slice(0, 120)), 'Workshop write trace should not leak full chronicle body');

console.log('smoke-memory-sc1-writeback-loop ok');
