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
}; // 本 smoke 聚焦 archive sink；严格预检本体由 smoke-ai-writeback-integrity 覆盖。
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
  'tm-memory-writegate.js',
  'tm-memory-turn-inference.js',
  'tm-memory-turn-archive.js'
].forEach(load);

const MTA = sandbox.TM && sandbox.TM.MemoryTurnArchive;
const ME = sandbox.TM && sandbox.TM.MemoryEnvelope;
const MCC = sandbox.TM && sandbox.TM.MemoryContextCompiler;
assert(MTA, 'TM.MemoryTurnArchive should be exported');
assert.strictEqual(typeof MTA.archiveTurn, 'function', 'archiveTurn API should exist');
assert.strictEqual(typeof MTA.collectArchiveItems, 'function', 'collectArchiveItems API should exist');

const GM = {
  turn: 18,
  sid: 'save-archive-smoke',
  worldId: 'world-archive-smoke',
  currentIssues: [
    { id: 'issue-salt', title: 'old salt quota pressure', description: 'salt quotas strain border payroll', status: 'pending' }
  ]
};

const aiResult = {
  shizhengji: 'The court debated border grain, salt quotas, and river repairs.',
  turn_summary: 'Border grain and river works became the main court pressure.',
  current_issues_update: [
    {
      action: 'update',
      id: 'issue-salt',
      title: 'salt quota pressure',
      description: 'salt quotas now directly threaten the border payroll.',
      evidenceRefs: [{ type: 'events', id: 'ev-salt-payroll', turn: 18 }],
      confidence: 0.68
    },
    {
      action: 'add',
      title: 'river repair backlog',
      category: 'public works',
      description: 'river embankment repairs are delayed after procurement disputes.',
      evidenceRefs: [{ type: 'events', id: 'ev-river-backlog', turn: 18 }],
      confidence: 0.66
    }
  ],
  npc_actions: [
    {
      name: 'minister-bi',
      target: 'censor-li',
      behaviorType: 'warn',
      action: 'warned about payroll fraud',
      result: 'censor-li becomes cautious'
    }
  ],
  affinity_changes: [
    { a: 'minister-bi', b: 'censor-li', delta: 8, relType: 'trust', reason: 'joint payroll audit' }
  ],
  character_memory_updates: [
    {
      actor: 'minister-bi',
      memory: 'minister-bi privately remembers the payroll promise.',
      confidence: 0.72,
      source_refs: [{ type: 'jishiRecords', id: 'jr-payroll', turn: 18 }]
    }
  ]
};

const archiveResult = MTA.archiveTurn(GM, aiResult, { sourceId: 'SC1', sourceType: 'aiTurnResult' });
assert.strictEqual(archiveResult.archived, true, 'archiveTurn should report archived=true');
assert.strictEqual(archiveResult.chronicle, 1, 'one chronicle archive item');
assert.strictEqual(archiveResult.stateAffairs, 2, 'two state-affair archive items');
assert(archiveResult.characterEvents >= 2, 'relationship/action events archived');

assert(Array.isArray(GM._turnMemoryArchive), 'GM._turnMemoryArchive should exist');
assert.strictEqual(GM._turnMemoryArchive.length, 1, 'one turn archive bundle');
assert.strictEqual(GM._turnMemoryArchive[0].schemaVersion, 'memory-turn-archive/v0', 'archive schema version');
assert(GM._turnMemoryArchive[0].sourceRefs.some((ref) => ref.type === 'aiTurnResult' && ref.id === 'SC1'), 'archive keeps turn source ref');
assert(!GM._memoryAccepted || GM._memoryAccepted.length === 0, 'archive must not accept AI character memories');

const envelopes = ME.collect(GM, { turn: 18 });
assert(envelopes.some((env) => env.type === 'chronicle_event' && env.safeBody.includes('border grain')), 'archive projects chronicle_event');
assert(envelopes.some((env) => env.type === 'issue_update' && env.safeBody.includes('salt quota pressure')), 'archive projects issue_update');
assert(envelopes.some((env) => env.type === 'strategic_issue' && env.safeBody.includes('river repair backlog')), 'archive projects new strategic_issue');
assert(envelopes.some((env) => env.type === 'relationship_event' && env.safeBody.includes('payroll fraud')), 'archive projects npc action relationship_event');
assert(envelopes.every((env) => !String(env.safeBody || '').includes('<')), 'projected archive uses safeBody-compatible text');

const compiled = MCC.compileFromGM(GM, {
  turn: 18,
  audience: 'system',
  actorScope: 'system',
  intent: 'turn_inference',
  maxTokens: 1600
});
assert(compiled.text.includes('<chronology'), 'compiled context includes chronology section');
assert(compiled.text.includes('<state-affairs'), 'compiled context includes state affairs section');
assert(compiled.text.includes('<character-memory'), 'compiled context includes character memory section');
assert(compiled.text.includes('river repair backlog'), 'compiled context includes archived state affair');
assert(compiled.text.includes('payroll fraud'), 'compiled context includes archived character event');

load('tm-endturn-apply.js');
load('tm-endturn-apply-stages.js'); // apply解构S2·stages紧随origin(writeBack dispatcher运行时调ns.stages)

(async function testEndturnArchiveIntegration() {
  const GM2 = { turn: 19, chars: [], currentIssues: [] };
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
        shizhengji: 'The court ordered river survey and warned corrupt clerks.',
        turn_summary: 'River survey begins.',
        current_issues_update: [
          {
            action: 'add',
            title: 'river survey delay',
            description: 'local clerks delayed the survey order.',
            evidenceRefs: [{ type: 'events', id: 'ev-river-survey', turn: 19 }],
            confidence: 0.69
          }
        ],
        npc_actions: [
          { name: 'censor-li', target: 'river-clerks', behaviorType: 'investigate', action: 'opened a survey inquiry', result: 'clerks are afraid' }
        ],
        character_memory_updates: [
          { actor: 'censor-li', memory: 'censor-li remembers the river survey delay.', confidence: 0.7, source_refs: [{ type: 'events', id: 'ev-river-survey', turn: 19 }] }
        ]
      }
    },
    prompt: {},
    record: {},
    meta: { errors: [], warnings: [], timing: {}, retries: {} }
  };

  await sandbox.TM.Endturn.AI.apply.writeBack(ctx);
  assert.strictEqual(sandbox._archiveApplyCalls,1,"archive follows exactly one required successful application");
  assert(ctx.meta.memoryArchive && ctx.meta.memoryArchive.archived === true, 'writeBack should report memory archive result');
  assert(Array.isArray(GM2._turnMemoryArchive) && GM2._turnMemoryArchive.length === 1, 'writeBack should persist turn archive');
  assert(Array.isArray(GM2._memoryDraftInbox) && GM2._memoryDraftInbox.length === 3, 'SC1 summary, issue update, and character memory route to Draft');
  assert(GM2._memoryDraftInbox.some((item) => item.type === 'turn_inference_summary'), 'SC1 summary still routes to Draft');
  assert(GM2._memoryDraftInbox.some((item) => item.type === 'strategic_issue'), 'current issue update still routes to Draft');
  assert(GM2._memoryDraftInbox.some((item) => item.type === 'character_memory'), 'character memory still routes to Draft');
  assert(Array.isArray(GM2._memoryAccepted) && GM2._memoryAccepted.length === 1 && GM2._memoryAccepted[0].type === 'character_memory', 'writeBack archive auto-accepts the low-risk public character memory (trusted lane)');
  const ctx2 = MCC.compileFromGM(GM2, { turn: 19, audience: 'system', actorScope: 'system', intent: 'turn_inference', maxTokens: 1200 });
  assert(ctx2.text.includes('river survey delay'), 'writeBack archive is prompt-visible through compiler');
  console.log('smoke-memory-turn-archive ok');
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
