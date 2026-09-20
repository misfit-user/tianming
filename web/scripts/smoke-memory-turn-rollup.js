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
}; // 本 smoke 聚焦 rollup sink；严格预检本体由 smoke-ai-writeback-integrity 覆盖。
// These tests exercise archive/rollup after successful domain application; domain rejection is tested separately.
sandbox._archiveApplyCalls=0;
sandbox.applyAITurnChanges = function(payload) {
  assert.strictEqual(payload._strictValidation,true,'archive requires strict main application');
  Object.keys(payload).forEach(key=>{if(Array.isArray(payload[key]) && key!=='npc_actions')assert.strictEqual(payload[key].length,0,'archive-only fixture has no hidden hard state operation: '+key);});
  sandbox._archiveApplyCalls++;
  return {ok:true,applied:{failed:[]}};
};
vm.createContext(sandbox);

function load(file) {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
}

[
  'tm-memory-evidence-registry.js',
  'tm-memory-issue-governance.js',
  'tm-memory-envelope.js',
  'tm-memory-controls.js',
  'tm-memory-retrieval.js',
  'tm-context-zones.js',
  'tm-memory-context-compiler.js',
  'tm-memory-turn-archive.js',
  'tm-memory-turn-rollup.js'
].forEach(load);

const MTR = sandbox.TM && sandbox.TM.MemoryTurnRollup;
const ME = sandbox.TM && sandbox.TM.MemoryEnvelope;
const MCC = sandbox.TM && sandbox.TM.MemoryContextCompiler;
assert(MTR, 'TM.MemoryTurnRollup should be exported');
assert.strictEqual(typeof MTR.rebuildFromArchive, 'function', 'rebuildFromArchive API should exist');

const GM = {
  turn: 24,
  sid: 'save-rollup-smoke',
  worldId: 'world-rollup-smoke',
  currentYear: 1627,
  _turnMemoryArchive: [
    {
      id: 'turn-archive-21-SC1',
      schemaVersion: 'memory-turn-archive/v0',
      turn: 21,
      year: 1627,
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-21-SC1', turn: 21 }],
      chronicle: [
        {
          id: 'turn-archive-21-SC1:chronicle',
          type: 'chronicle_event',
          body: 'spring payroll arrears brought salt quotas into court debate.',
          turn: 21,
          sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-21-SC1', turn: 21 }]
        }
      ],
      stateAffairs: [
        {
          id: 'issue_update-issue-salt-t21',
          type: 'issue_update',
          issueId: 'issue-salt',
          body: 'salt quota pressure begins to threaten border payroll.',
          turn: 21,
          sourceRefs: [{ type: 'events', id: 'ev-salt-21', turn: 21 }]
        }
      ],
      characterEvents: [
        {
          id: 'npc-action-21-minister-bi-censor-li',
          type: 'relationship_event',
          body: 'minister-bi warned censor-li about payroll fraud.',
          turn: 21,
          ownerScope: 'npc:minister-bi',
          readScope: 'public',
          entities: ['minister-bi', 'censor-li'],
          extra: { actor: 'minister-bi', target: 'censor-li', kind: 'warn' },
          sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-21-SC1', turn: 21 }]
        }
      ]
    },
    {
      id: 'turn-archive-22-SC1',
      schemaVersion: 'memory-turn-archive/v0',
      turn: 22,
      year: 1627,
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-22-SC1', turn: 22 }],
      chronicle: [
        {
          id: 'turn-archive-22-SC1:chronicle',
          type: 'chronicle_event',
          body: 'summer river repair backlog delayed tax transport.',
          turn: 22,
          sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-22-SC1', turn: 22 }]
        }
      ],
      stateAffairs: [
        {
          id: 'issue_update-issue-salt-t22',
          type: 'issue_update',
          issueId: 'issue-salt',
          body: 'salt quota pressure worsens after transport delays.',
          turn: 22,
          sourceRefs: [{ type: 'events', id: 'ev-salt-22', turn: 22 }]
        },
        {
          id: 'strategic_issue-issue-river-t22',
          type: 'strategic_issue',
          issueId: 'issue-river',
          body: 'river repair backlog becomes a new public works pressure.',
          turn: 22,
          sourceRefs: [{ type: 'events', id: 'ev-river-22', turn: 22 }]
        }
      ],
      characterEvents: [
        {
          id: 'npc-action-22-censor-li-clerks',
          type: 'relationship_event',
          body: 'censor-li opened an inquiry into river clerks.',
          turn: 22,
          ownerScope: 'npc:censor-li',
          readScope: 'public',
          entities: ['censor-li', 'river-clerks'],
          extra: { actor: 'censor-li', target: 'river-clerks', kind: 'investigate' },
          sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-22-SC1', turn: 22 }]
        }
      ]
    }
  ]
};

const rollup = MTR.rebuildFromArchive(GM, { turn: 24 });
assert.strictEqual(rollup.schemaVersion, 'memory-turn-rollup/v0', 'rollup schema version');
assert.strictEqual(rollup.chronicleRollups, 1, 'one yearly chronicle rollup');
assert.strictEqual(rollup.issueChains, 2, 'two issue chains');
assert.strictEqual(rollup.characterDossiers, 3, 'actor and target dossiers are built');

assert(Array.isArray(GM._memoryChronicleRollups), 'chronicle rollup store exists');
assert(GM._memoryChronicleRollups[0].body.includes('spring payroll') && GM._memoryChronicleRollups[0].body.includes('summer river'), 'yearly rollup combines multiple turns');
assert(GM._memoryIssueChains.some((chain) => chain.issueId === 'issue-salt' && chain.body.includes('worsens')), 'issue chain keeps issue timeline');
assert(GM._memoryCharacterDossiers.some((dossier) => dossier.actor === 'minister-bi' && dossier.body.includes('payroll fraud')), 'character dossier keeps actor event');

const envelopes = ME.collect(GM, { turn: 24 });
assert(envelopes.some((env) => env.type === 'historiography_summary' && env.safeBody.includes('summer river')), 'chronicle rollup projects as historiography_summary');
assert(envelopes.some((env) => env.type === 'ongoing_affair' && env.safeBody.includes('salt quota pressure worsens')), 'issue chain projects as ongoing_affair');
assert(envelopes.some((env) => env.type === 'character_memory' && env.safeBody.includes('payroll fraud')), 'character dossier projects as character_memory');
assert(!envelopes.some((env) => String(env.safeBody || '').includes('undefined')), 'rollup projection has no undefined text');

const compiled = MCC.compileFromGM(GM, {
  turn: 24,
  audience: 'system',
  actorScope: 'system',
  intent: 'turn_inference',
  maxTokens: 1600
});
assert(compiled.text.includes('<chronology'), 'compiled context includes chronology');
assert(compiled.text.includes('<state-affairs'), 'compiled context includes state affairs');
assert(compiled.text.includes('<character-memory'), 'compiled context includes character memory');
assert(compiled.text.includes('salt quota pressure worsens'), 'compiled context includes issue chain');
assert(compiled.text.includes('payroll fraud'), 'compiled context includes character dossier');

[
  'tm-memory-writegate.js',
  'tm-memory-turn-inference.js',
  'tm-endturn-apply.js',
  'tm-endturn-apply-stages.js'
].forEach(load);

(async function testEndturnRollupIntegration() {
  const GM2 = { turn: 25, currentYear: 1627, chars: [], currentIssues: [] };
  sandbox.GM = GM2;
  sandbox.addEB = function() {};
  sandbox._dbg = function() {};
  sandbox.getTSText = function(turn) { return 'T' + turn; };
  sandbox.findCharByName = function() { return null; };
  sandbox.DebugLog = { log: function() {}, warn: function() {} };
  sandbox.applyCharacterDeaths = function() {};
  const ctx = {
    results: {
      sc1: {
        shizhengji: 'The court revisited salt quotas and river repairs.',
        turn_summary: 'Salt and river issues remain linked.',
        current_issues_update: [
          {
            action: 'add',
            title: 'salt-river linkage',
            description: 'salt transport and river repair now constrain each other.',
            evidenceRefs: [{ type: 'events', id: 'ev-salt-river-25', turn: 25 }],
            confidence: 0.7
          }
        ],
        npc_actions: [
          { name: 'minister-bi', target: 'censor-li', behaviorType: 'coordinate', action: 'coordinated a joint memorial', result: 'audit expands' }
        ]
      }
    },
    prompt: {},
    record: {},
    meta: { errors: [], warnings: [], timing: {}, retries: {} }
  };

  await sandbox.TM.Endturn.AI.apply.writeBack(ctx);
  assert.strictEqual(sandbox._archiveApplyCalls,1,"archive follows exactly one required successful application");
  assert(ctx.meta.memoryArchive && ctx.meta.memoryArchive.archived === true, 'writeBack archive still runs');
  assert(ctx.meta.memoryRollup && ctx.meta.memoryRollup.issueChains === 1, 'writeBack refreshes rollup');
  assert(Array.isArray(GM2._memoryIssueChains) && GM2._memoryIssueChains.length === 1, 'rollup store persisted after writeBack');
  const ctx2 = MCC.compileFromGM(GM2, { turn: 25, audience: 'system', actorScope: 'system', intent: 'turn_inference', maxTokens: 1200 });
  assert(ctx2.text.includes('salt-river linkage'), 'writeBack rollup is prompt-visible through compiler');
  console.log('smoke-memory-turn-rollup ok');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
