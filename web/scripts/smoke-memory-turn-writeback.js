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
sandbox.validateAIWriteBackBatch = function(output) {
  return { ok: true, output: JSON.parse(JSON.stringify(output)), failures: [] };
}; // 本 smoke 聚焦 memory sink；严格预检本体由 smoke-ai-writeback-integrity 覆盖。
sandbox._memoryOnlyApplyCount = 0;
sandbox.applyAITurnChanges = function(payload) {
  assert(payload._strictValidation === true, 'memory-only writeback retains strict application');
  Object.keys(payload).forEach(key => { if (Array.isArray(payload[key])) assert(payload[key].length === 0, 'isolated fixture must not accept hard mutations: ' + key); });
  sandbox._memoryOnlyApplyCount++;
  return {ok:true, applied:{failed:[]}};
};
vm.createContext(sandbox);

[
  'tm-memory-evidence-registry.js',
  'tm-memory-envelope.js',
  'tm-memory-writegate.js',
  'tm-memory-turn-inference.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const MTI = sandbox.TM && sandbox.TM.MemoryTurnInference;
assert(MTI, 'TM.MemoryTurnInference should be exported');
assert.strictEqual(typeof MTI.collectPostTurnCandidates, 'function', 'candidate builder should be exported');
assert.strictEqual(typeof MTI.enqueueCandidates, 'function', 'candidate enqueue helper should be exported');

const GM = { turn: 9 };
const candidates = MTI.collectPostTurnCandidates(GM, {
  character_memory_updates: [
    { actor: 'han-kuang', memory: 'Han remembers the emperor promised a three-day review.', private: false, confidence: 0.72, source_refs: [{ type: 'jishiRecords', id: 'jr-han' }] },
    { actor: 'wen-tiren', memory: 'Wen privately suspects a faction betrayal.', private: true, confidence: 0.71, source_refs: [{ type: 'courtRecords', id: 'cr-wen' }] }
  ]
}, { sourceId: 'SC1' });

assert.strictEqual(candidates.length, 2, 'two character candidates');
assert.strictEqual(candidates[0].type, 'character_memory', 'public character memory type');
assert.strictEqual(candidates[0].readScope, 'public', 'public memory readScope');
assert.strictEqual(candidates[0].ownerScope, 'npc:han-kuang', 'public memory keeps owner scope');
assert.strictEqual(candidates[1].type, 'character_belief', 'private memory type');
assert.strictEqual(candidates[1].readScope, 'npc:wen-tiren', 'private memory readScope');
assert.strictEqual(candidates[1].ownerScope, 'npc:wen-tiren', 'private memory ownerScope');
assert(candidates[1].sourceRefs.some((ref) => ref.type === 'courtRecords' && ref.id === 'cr-wen'), 'candidate keeps explicit source lineage');

const result = MTI.enqueueCandidates(GM, candidates, { forceDraft: true });
assert.strictEqual(result.added, 2, 'two candidates enqueued');
assert.strictEqual(GM._memoryDraftInbox.length, 2, 'draft inbox receives AI memories');
assert(!GM._memoryAccepted || GM._memoryAccepted.length === 0, 'drafts are not accepted automatically');
assert(GM._memoryDraftInbox.every((item) => item.reviewStatus === 'pending_review'), 'drafts wait for review');
assert(GM._memoryDraftInbox.some((item) => item.readScope === 'npc:wen-tiren'), 'draft keeps private readScope');

const hardResult = MTI.enqueueCandidates(GM, [{
  id: 'ai-hard-state',
  type: 'hard_state',
  body: 'The emperor is dead.',
  authority: 'ai_extracted',
  sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 9 }]
}], { forceDraft: true });

assert.strictEqual(hardResult.added, 1, 'hard-state candidate is still routed');
assert.strictEqual(GM._memoryQuarantine.length, 1, 'AI hard_state is quarantined');
assert.strictEqual(GM._memoryQuarantine[0].status, 'quarantined', 'hard_state does not become draft');
assert(GM._memoryQuarantine[0].reasons.some((reason) => reason.code === 'unauthorized_hard_state'), 'hard_state quarantine cites authority issue');

vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8'), sandbox, { filename: 'tm-endturn-apply.js' });
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-endturn-apply-stages.js'), 'utf8'), sandbox, { filename: 'tm-endturn-apply-stages.js' }); // apply解构S2·stages紧随origin(writeBack dispatcher运行时调ns.stages)

(async function testEndturnIntegration() {
  const GM2 = { turn: 10, chars: [] };
  sandbox.GM = GM2;
  const ctx = {
    results: {
      sc1: {
        shizhengji: 'Turn resolved.',
        character_memory_updates: [
          { actor: 'han-kuang', memory: 'Han now remembers the late-night audience.', private: false, confidence: 0.7, source_refs: [{ type: 'jishiRecords', id: 'jr-night-audience' }] },
          { actor: 'wen-tiren', memory: 'Wen privately resents the late-night summons.', private: true, confidence: 0.85, source_refs: [{ type: 'courtRecords', id: 'cr-wen-night' }] }
        ]
      }
    },
    prompt: {},
    record: {},
    meta: { errors: [], warnings: [], timing: {}, retries: {} }
  };

  sandbox.applyCharacterDeaths = function() {};
  await sandbox.TM.Endturn.AI.apply.writeBack(ctx);
  assert.strictEqual(sandbox._memoryOnlyApplyCount, 1, "required no-op transaction is invoked exactly once");
  assert(Array.isArray(GM2._memoryDraftInbox), 'endturn writeBack should create draft inbox');
  assert(GM2._memoryDraftInbox.some((item) => item.type === 'turn_inference_summary'), 'endturn writeBack drafts SC1 summary memory');
  // Trusted endturn (autoAcceptTrusted lane) auto-accepts ONLY low-risk PUBLIC character memory.
  assert(Array.isArray(GM2._memoryAccepted) && GM2._memoryAccepted.length === 1, 'endturn writeBack auto-accepts exactly one low-risk public character memory');
  assert(GM2._memoryAccepted[0].type === 'character_memory', 'auto-accepted item is the public character memory');
  // Scope guards: summary stays draft; private belief is NOT auto-accepted but routed to Draft for review.
  assert(GM2._memoryDraftInbox.some((item) => item.type === 'turn_inference_summary' && item.status === 'draft'), 'SC1 summary remains draft for review');
  assert(!GM2._memoryAccepted.some((item) => item.type === 'character_belief'), 'private belief is NOT auto-accepted');
  assert(GM2._memoryDraftInbox.some((item) => item.type === 'character_belief'), 'private belief routes to Draft for review');
  console.log('smoke-memory-turn-writeback ok');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
