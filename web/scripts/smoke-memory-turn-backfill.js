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
  'tm-memory-turn-rollup.js',
  'tm-memory-turn-backfill.js',
  'tm-memory-workshop.js'
].forEach(load);

const MTB = sandbox.TM && sandbox.TM.MemoryTurnBackfill;
const ME = sandbox.TM && sandbox.TM.MemoryEnvelope;
const MCC = sandbox.TM && sandbox.TM.MemoryContextCompiler;
const MW = sandbox.TM && sandbox.TM.MemoryWorkshop;
assert(MTB, 'TM.MemoryTurnBackfill should be exported');
assert.strictEqual(typeof MTB.collectLegacyBundles, 'function', 'collectLegacyBundles API should exist');
assert.strictEqual(typeof MTB.rebuildFromLegacy, 'function', 'rebuildFromLegacy API should exist');
assert.strictEqual(typeof MTB.ensureBackfilled, 'function', 'ensureBackfilled API should exist');

const GM = {
  turn: 12,
  sid: 'legacy-save-smoke',
  worldId: 'legacy-world-smoke',
  saveName: 'Legacy Smoke',
  shijiHistory: [
    {
      id: 'shiji-t3',
      turn: 3,
      year: 1625,
      title: 'Border granary inquiry',
      shizhengji: 'Border granary inquiry exposed spring arrears.',
      shilu: 'Censor Li opened the border granary books.'
    },
    {
      id: 'shiji-t4',
      turn: 4,
      year: 1625,
      title: 'River works delayed',
      shizhengji: 'River works delay forced salt transport into the same dispute.',
      turnSummary: 'Granary, river, and salt logistics became linked.'
    }
  ],
  qijuHistory: [
    {
      id: 'qiju-edict-t3',
      turn: 3,
      edicts: 'Imperial order: release grain for border granary arrears.',
      category: 'edict'
    },
    {
      id: 'qiju-court-t4',
      turn: 4,
      zhengwen: 'Court diary records Minister Bi defending river works funding.',
      category: 'court'
    }
  ],
  biannianItems: [
    {
      id: 'biannian-t5',
      turn: 5,
      title: 'Salt transport and river works became one long affair.',
      category: 'state-affair'
    }
  ],
  currentIssues: [
    {
      id: 'issue-salt-river',
      raisedTurn: 4,
      title: 'Salt river linkage',
      description: 'Salt transport now depends on river works funding.',
      linkedChars: ['Minister Bi'],
      confidence: 0.7
    },
    {
      id: 'issue-granary',
      raisedTurn: 3,
      resolvedTurn: 5,
      status: 'resolved',
      title: 'Border granary arrears',
      resolution: 'Imperial release order temporarily resolved the arrears.',
      linkedChars: ['Censor Li']
    }
  ],
  jishiRecords: [
    {
      id: 'jishi-li-t4',
      turn: 4,
      char: 'Censor Li',
      mode: 'audience',
      playerSaid: 'Audit the granary ledgers.',
      npcSaid: 'Censor Li promised to compare border and river accounts.',
      topic: 'granary audit'
    }
  ],
  _npcRelationEvents: [
    {
      id: 'rel-bi-li-t5',
      turn: 5,
      actor: 'Minister Bi',
      target: 'Censor Li',
      kind: 'coordination',
      text: 'Minister Bi coordinated with Censor Li on salt transport testimony.'
    }
  ],
  _memoryAuditEvents: []
};

const collected = MTB.collectLegacyBundles(GM, { archiveCap: 80 });
assert.strictEqual(collected.schemaVersion, 'memory-turn-backfill/v0', 'backfill schema version');
assert.strictEqual(collected.bundles.length, 3, 'legacy sources are grouped by turn');
assert.strictEqual(collected.counts.chronicle, 5, 'shiji, qiju, and biannian become chronicle items');
assert.strictEqual(collected.counts.stateAffairs, 2, 'currentIssues become state affair items');
assert.strictEqual(collected.counts.characterEvents, 2, 'jishi and relation events become character events');

const rebuilt = MTB.rebuildFromLegacy(GM, { turn: 12, archiveCap: 80, reviewer: 'smoke' });
assert.strictEqual(rebuilt.rebuilt, true, 'legacy backfill should rebuild');
assert.strictEqual(rebuilt.legacyBundles, 3, 'three legacy archive bundles should be built');
assert.strictEqual(rebuilt.persisted, 3, 'three legacy archive bundles should persist');
assert(rebuilt.rollup && rebuilt.rollup.chronicleRollups >= 1, 'rollup should rebuild chronicle summaries');
assert(rebuilt.rollup.issueChains === 2, 'rollup should rebuild issue chains');
assert(rebuilt.rollup.characterDossiers >= 2, 'rollup should rebuild character dossiers');
assert(Array.isArray(GM._turnMemoryArchive) && GM._turnMemoryArchive.length === 3, 'GM archive store should persist backfilled bundles');
assert(GM._turnMemoryArchive.every((bundle) => bundle.schemaVersion === 'memory-turn-archive/v0'), 'backfilled bundles use turn archive schema');
assert(GM._turnMemoryArchive.every((bundle) => bundle.sourceType === 'legacyBackfill'), 'backfilled bundles are marked as legacy');
assert(GM._memoryAuditEvents.some((event) => event.action === 'memory_turn_backfill'), 'backfill audit event should be recorded');

const envelopes = ME.collect(GM, { turn: 12 });
assert(envelopes.some((env) => env.type === 'chronicle_event' && env.safeBody.includes('Border granary inquiry')), 'legacy chronicle projects as envelope');
assert(envelopes.some((env) => env.type === 'ongoing_affair' && env.safeBody.includes('Salt river linkage')), 'legacy issue chain projects as envelope');
assert(envelopes.some((env) => env.type === 'character_memory' && env.safeBody.includes('Minister Bi coordinated')), 'legacy character dossier projects as envelope');
assert(!envelopes.some((env) => String(env.safeBody || '').includes('undefined')), 'backfill projection should not leak undefined text');

const compiled = MCC.compileFromGM(GM, {
  turn: 12,
  audience: 'system',
  actorScope: 'system',
  intent: 'turn_inference',
  maxTokens: 10000
});
assert(compiled.text.includes('<chronology'), 'compiled context includes chronology from backfill');
assert(compiled.text.includes('<state-affairs'), 'compiled context includes state affairs from backfill');
assert(compiled.text.includes('<character-memory'), 'compiled context includes character dossiers from backfill');
assert(compiled.text.includes('river works funding'), 'compiled context includes legacy issue chain body');
assert(compiled.text.includes('Censor Li promised'), 'compiled context includes legacy character record');

const archiveLen = GM._turnMemoryArchive.length;
const ensured = MTB.ensureBackfilled(GM, { turn: 12, archiveCap: 80 });
assert.strictEqual(ensured.rebuilt, false, 'ensureBackfilled should not duplicate existing archive');
assert.strictEqual(GM._turnMemoryArchive.length, archiveLen, 'ensureBackfilled should keep archive count stable');

const workshopResult = MW.handleAction(GM, 'backfill-legacy', '', { reviewer: 'smoke', reason: 'manual workshop backfill', force: true });
assert(workshopResult && workshopResult.rebuilt === true, 'Workshop backfill action should call backfill API');
assert.strictEqual(GM._turnMemoryArchive.length, archiveLen, 'forced Workshop backfill should replace legacy bundles, not duplicate them');

const GM2 = {
  turn: 9,
  shijiHistory: [
    { id: 'shiji-existing', turn: 4, shizhengji: 'This legacy record should be skipped because SC1 archive exists.' },
    { id: 'shiji-new', turn: 5, shizhengji: 'This legacy record should be backfilled.' }
  ],
  _turnMemoryArchive: [
    {
      id: 'turn-archive-4-SC1',
      schemaVersion: 'memory-turn-archive/v0',
      sourceType: 'aiTurnResult',
      turn: 4,
      chronicle: [
        { id: 'turn-archive-4-SC1:chronicle', type: 'chronicle_event', body: 'Authoritative SC1 archive remains.', turn: 4 }
      ],
      stateAffairs: [],
      characterEvents: []
    }
  ]
};
const skipped = MTB.rebuildFromLegacy(GM2, { turn: 9, archiveCap: 80 });
assert.strictEqual(skipped.skippedExistingTurns, 1, 'authoritative archive turns should not be duplicated by default');
assert(GM2._turnMemoryArchive.some((bundle) => bundle.id === 'turn-archive-4-SC1'), 'authoritative archive should remain');
assert(!GM2._turnMemoryArchive.some((bundle) => bundle.id === 'legacy-turn-archive-4'), 'legacy bundle should skip existing authoritative turn');
assert(GM2._turnMemoryArchive.some((bundle) => bundle.id === 'legacy-turn-archive-5'), 'new legacy turn should backfill');

console.log('smoke-memory-turn-backfill ok');
