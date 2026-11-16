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
  'tm-memory-writegate.js',
  'tm-memory-controls.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const TM = sandbox.TM;
const MT = TM && TM.MemoryTrace;
const WG = TM && TM.MemoryWriteGate;
const ME = TM && TM.MemoryEnvelope;
const MR = TM && TM.MemoryRetrieval;
const MC = TM && TM.MemoryContextCompiler;
const MCtl = TM && TM.MemoryControls;

assert(MT, 'MemoryTrace should be exported');
assert(WG, 'MemoryWriteGate should be exported');
assert(ME, 'MemoryEnvelope should be exported');
assert(MR, 'MemoryRetrieval should be exported');
assert(MC, 'MemoryContextCompiler should be exported');
assert(MCtl, 'MemoryControls should be exported');
assert.strictEqual(typeof WG.governAcceptedMemory, 'function', 'WriteGate should expose Accepted governance helper');

const GM = { turn: 210, _turnAiResults: {} };
MT.ensureTurnTrace(GM, { source: 'accepted-governance-smoke' });

function enqueueDraft(candidate) {
  return WG.enqueue(GM, Object.assign({
    type: 'semantic_fact',
    source: 'ai_extracted',
    authority: 'ai_extracted',
    readScope: 'public',
    ownerScope: 'world',
    lane: 'L6_retrieved_evidence',
    sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: GM.turn }]
  }, candidate), { forceDraft: true });
}

function accept(candidate, opts) {
  const draft = enqueueDraft(candidate);
  return WG.acceptDraft(GM, draft.id, Object.assign({
    reviewer: 'governance-smoke',
    governanceCooldownTurns: 4
  }, opts || {}));
}

const oldCanalBody = 'Canal flood risk is low and no emergency repair is required.';
const newCanalBody = 'Canal flood risk is high and emergency repair is required.';

const oldCanal = accept({
  id: 'accepted-canal-old',
  factKey: 'state-affair:canal-flood-risk',
  body: oldCanalBody
});
assert.strictEqual(oldCanal.status, 'active', 'baseline accepted memory should be active');
assert.strictEqual(GM._memoryAccepted.length, 1, 'baseline accepted memory should enter accepted store');

const duplicate = accept({
  id: 'accepted-canal-duplicate',
  factKey: 'state-affair:canal-flood-risk',
  body: oldCanalBody
});
assert.strictEqual(duplicate.status, 'archived', 'duplicate accepted memory should be archived instead of accepted again');
assert.strictEqual(duplicate.reviewStatus, 'duplicate', 'duplicate accepted memory should be marked duplicate');
assert.strictEqual(duplicate.duplicateOf, oldCanal.id, 'duplicate should cite the existing accepted memory');
assert.strictEqual(GM._memoryAccepted.length, 1, 'duplicate accepted memory should not increase accepted store size');
assert(GM._memoryAuditEvents.some((event) => event.action === 'duplicate_accepted' && event.id === duplicate.id), 'duplicate accepted memory should be audit logged');

GM.turn = 211;
const newCanal = accept({
  id: 'accepted-canal-new',
  factKey: 'state-affair:canal-flood-risk',
  body: newCanalBody,
  supersedesRefs: [{ type: 'accepted_memory', id: oldCanal.id }]
});
assert.strictEqual(newCanal.status, 'active', 'explicit superseding memory should be accepted');
assert.strictEqual(GM._memoryAccepted.length, 2, 'superseding memory should be stored as the new accepted fact');
assert(GM._memEdges.some((edge) => edge.type === 'supersedes' && edge.src === newCanal.id && edge.dst === oldCanal.id), 'superseding accepted memory should create a supersedes edge');
assert(GM._memoryControls[oldCanal.id] && GM._memoryControls[oldCanal.id].supersededBy === newCanal.id, 'old accepted memory should have supersededBy control');
assert(GM._memoryControls[oldCanal.id].cooldownUntilTurn >= GM.turn + 4, 'superseded accepted memory should receive cooldown');

GM.turn = 212;
const oldTreasury = accept({
  id: 'accepted-treasury-old',
  factKey: 'core:treasury-reserve',
  body: 'Treasury reserve is 500 taels.',
  authority: 'ai_extracted',
  source: 'ai_extracted'
});

GM.turn = 213;
const playerTreasury = accept({
  id: 'accepted-treasury-player',
  factKey: 'core:treasury-reserve-player-pin',
  body: 'Treasury reserve is 800 taels.',
  authority: 'player_pin',
  source: 'player_pin',
  contradictsRefs: [{ type: 'accepted_memory', id: oldTreasury.id }]
});
assert(playerTreasury.authorityRank > oldTreasury.authorityRank, 'higher-authority accepted memory should keep authority rank');
assert(GM._memEdges.some((edge) => edge.type === 'contradicts' && edge.src === playerTreasury.id && edge.dst === oldTreasury.id), 'contradicting accepted memory should create a contradiction edge');

const envelopes = ME.collect(GM, { turn: 214 });
const hits = envelopes.map((env) => MR.hitFromEnvelope(env));
const ranked = MR.rankHitsDetailed(hits, { GM, turn: 214, intent: 'turn_inference' });
assert(ranked.ranked.some((hit) => hit.id === newCanal.id), 'current retrieval should keep the superseding accepted memory');
assert(!ranked.ranked.some((hit) => hit.id === oldCanal.id), 'current retrieval should suppress superseded accepted memory');
assert(ranked.suppressed.some((hit) => hit.id === oldCanal.id && (hit.reason === 'superseded' || hit.reason === 'archived_control' || hit.reason === 'cooldown')), 'suppression diagnostics should mention old superseded accepted memory');
assert(ranked.ranked.some((hit) => hit.id === playerTreasury.id), 'current retrieval should keep higher-authority contradiction source');
assert(!ranked.ranked.some((hit) => hit.id === oldTreasury.id), 'current retrieval should suppress contradicted accepted memory');
assert(ranked.suppressed.some((hit) => hit.id === oldTreasury.id && hit.reason === 'contradicted' && hit.by === playerTreasury.id), 'contradiction diagnostics should cite the winning accepted memory');

const compiled = MC.compileFromGM(GM, { turn: 214, intent: 'turn_inference', audience: 'system', actorScope: 'system' });
assert(compiled.text.includes(newCanalBody), 'next-turn compiled context should include superseding accepted memory');
assert(!compiled.text.includes(oldCanalBody), 'next-turn compiled context should not include superseded accepted memory');
assert(compiled.text.includes('Treasury reserve is 800 taels.'), 'next-turn compiled context should include higher-authority contradiction source');
assert(!compiled.text.includes('Treasury reserve is 500 taels.'), 'next-turn compiled context should not include contradicted accepted memory');

const trace = MT.snapshot(GM);
assert(trace.writes.some((write) => write.id === 'WRITEGATE_ACCEPT_DUPLICATE' && write.sourceId === duplicate.id), 'duplicate governance should be traced');
assert(trace.writes.some((write) => write.id === 'WRITEGATE_ACCEPT_GOVERNANCE' && write.sourceId === newCanal.id), 'supersedes governance should be traced');
assert(trace.writes.some((write) => write.id === 'WRITEGATE_ACCEPT_GOVERNANCE' && write.sourceId === playerTreasury.id), 'contradiction governance should be traced');

console.log('smoke-memory-accepted-governance ok');
