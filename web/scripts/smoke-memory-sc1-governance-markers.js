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
  'tm-context-zones.js',
  'tm-memory-evidence-registry.js',
  'tm-memory-envelope.js',
  'tm-memory-retrieval.js',
  'tm-memory-context-compiler.js',
  'tm-memory-trace.js',
  'tm-memory-controls.js',
  'tm-memory-writegate.js',
  'tm-memory-turn-inference.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const TM = sandbox.TM;
const MT = TM && TM.MemoryTrace;
const MTI = TM && TM.MemoryTurnInference;
const WG = TM && TM.MemoryWriteGate;
const MC = TM && TM.MemoryContextCompiler;
assert(MT && MTI && WG && MC, 'memory turn/write/read modules should be exported');

const GM = {
  turn: 301,
  _turnAiResults: {},
  _memoryAccepted: [
    {
      id: 'accepted-issue-canal-old',
      type: 'issue_update',
      body: 'The canal arrears issue remains unresolved and blocks grain transport.',
      safeBody: 'The canal arrears issue remains unresolved and blocks grain transport.',
      status: 'active',
      reviewStatus: 'accepted',
      authority: 'ai_analysis',
      source: 'ai_extracted',
      factKey: 'state-affair:issue-canal',
      ownerScope: 'world',
      readScope: 'public',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1-old', turn: 300 }],
      basisRefs: [{ type: 'memoryTrace.compiledContext', id: 'SC1_PRE_CONTEXT', turn: 300 }],
      lane: 'L5_advisory_context'
    },
    {
      id: 'accepted-treasury-old',
      type: 'semantic_fact',
      body: 'Treasury reserve is 500 taels.',
      safeBody: 'Treasury reserve is 500 taels.',
      status: 'active',
      reviewStatus: 'accepted',
      authority: 'ai_extracted',
      source: 'ai_extracted',
      factKey: 'core:treasury-reserve',
      ownerScope: 'world',
      readScope: 'public',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1-old', turn: 300 }],
      lane: 'L6_retrieved_evidence'
    }
  ]
};

MT.ensureTurnTrace(GM, { source: 'sc1-governance-markers-smoke' });
MT.recordCompiledContext(GM, {
  id: 'SC1_PRE_CONTEXT',
  stage: 'sc1-pre-inference',
  compiled: {
    text: '<memory-context>old canal basis</memory-context>',
    sections: {},
    hits: [{ id: 'accepted-issue-canal-old', source: 'accepted_memory', type: 'issue_update', text: 'old canal basis' }]
  },
  text: '<memory-context>old canal basis</memory-context>',
  intent: 'turn_inference',
  audience: 'system',
  actorScope: 'system'
});

const aiResult = {
  turn_summary: 'The court resolved the canal arrears dispute and corrected the treasury note.',
  current_issues_update: [
    {
      action: 'resolve',
      id: 'issue-canal',
      title: 'Canal arrears settled',
      description: 'The canal arrears issue is resolved by emergency treasury transfer.',
      resolution: 'Emergency transfer clears arrears.',
      confidence: 0.82,
      source_refs: [{ type: 'courtRecords', id: 'cr-canal-301', turn: 301 }]
    },
    {
      action: 'update',
      id: 'treasury-reserve',
      fact_key: 'core:treasury-reserve',
      title: 'Treasury correction',
      description: 'Treasury reserve is 800 taels.',
      confidence: 0.9,
      contradicts_refs: [{ type: 'accepted_memory', id: 'accepted-treasury-old' }],
      source_refs: [{ type: 'courtRecords', id: 'cr-treasury-301', turn: 301 }]
    }
  ],
  character_memory_updates: [
    {
      actor: 'Minister Bi',
      memory_type: 'commitment',
      memory: 'Minister Bi promised to report canal arrears each month.',
      confidence: 0.76,
      source_refs: [{ type: 'jishiRecords', id: 'jr-bi-301', turn: 301 }]
    }
  ]
};

const candidates = MTI.collectPostTurnCandidates(GM, aiResult, { sourceId: 'SC1' });
const summary = candidates.find((item) => item.type === 'turn_inference_summary');
const canal = candidates.find((item) => item.issueId === 'issue-canal');
const treasury = candidates.find((item) => item.issueId === 'treasury-reserve');
const character = candidates.find((item) => item.type === 'character_memory' && item.ownerScope === 'npc:Minister Bi');

assert(summary && summary.factKey === 'chronicle:turn:301:SC1', 'SC1 summary should receive stable chronicle factKey');
assert(canal, 'SC1 should produce canal issue candidate');
assert.strictEqual(canal.type, 'issue_resolution', 'resolve action should produce issue_resolution');
assert.strictEqual(canal.factKey, 'state-affair:issue-canal', 'issue candidate should receive stable issue factKey');
assert(canal.supersedesRefs.some((ref) => ref.id === 'accepted-issue-canal-old'), 'issue resolution should supersede prior accepted issue with same factKey');
assert(treasury && treasury.factKey === 'core:treasury-reserve', 'explicit fact_key should be preserved');
assert(treasury.contradictsRefs.some((ref) => ref.id === 'accepted-treasury-old'), 'explicit contradicts_refs should be preserved');
assert(character && /^character:minister-bi:commitment:/.test(character.factKey), 'character memory should receive stable actor/type factKey');

const queued = MTI.enqueuePostTurnCandidates(GM, aiResult, { sourceId: 'SC1', forceDraft: true });
assert.strictEqual(queued.added, 4, 'SC1 should enqueue summary, two issue candidates, and character memory');
const canalDraft = GM._memoryDraftInbox.find((item) => item.issueId === 'issue-canal');
const treasuryDraft = GM._memoryDraftInbox.find((item) => item.issueId === 'treasury-reserve');
assert(canalDraft && canalDraft.supersedesRefs.some((ref) => ref.id === 'accepted-issue-canal-old'), 'queued draft should preserve supersedesRefs');
assert(treasuryDraft && treasuryDraft.contradictsRefs.some((ref) => ref.id === 'accepted-treasury-old'), 'queued draft should preserve contradictsRefs');

WG.acceptDraft(GM, canalDraft.id, { reviewer: 'sc1-governance-smoke', governanceCooldownTurns: 3 });
WG.acceptDraft(GM, treasuryDraft.id, { reviewer: 'sc1-governance-smoke', governanceCooldownTurns: 3 });

assert(GM._memEdges.some((edge) => edge.type === 'supersedes' && edge.src === canalDraft.id && edge.dst === 'accepted-issue-canal-old'), 'accepting SC1 issue resolution should create supersedes edge');
assert(GM._memEdges.some((edge) => edge.type === 'contradicts' && edge.src === treasuryDraft.id && edge.dst === 'accepted-treasury-old'), 'accepting SC1 contradiction should create contradicts edge');

const compiled = MC.compileFromGM(GM, { turn: 302, intent: 'turn_inference', audience: 'system', actorScope: 'system' });
assert(compiled.text.includes('Emergency transfer clears arrears.'), 'next-turn context should include accepted SC1 resolution');
assert(!compiled.text.includes('remains unresolved and blocks grain transport'), 'next-turn context should suppress superseded issue memory');
assert(compiled.text.includes('Treasury reserve is 800 taels.'), 'next-turn context should include accepted SC1 contradiction source');
assert(!compiled.text.includes('Treasury reserve is 500 taels.'), 'next-turn context should suppress contradicted accepted memory');

console.log('smoke-memory-sc1-governance-markers ok');
