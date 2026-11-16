#!/usr/bin/env node
'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const endturnAi = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai.js'), 'utf8');

const sc1PreIdx = endturnAi.indexOf('SC1_PRE_CONTEXT');
const sc1qIdx = endturnAi.indexOf('sc1q.required_sc1_actions');
const sc1BodyIdx = endturnAi.indexOf('var _sc1Body');

assert(sc1PreIdx >= 0, 'SC1 should inject a SC1_PRE_CONTEXT memory block');
assert(sc1qIdx < 0 || sc1PreIdx < sc1qIdx, 'SC1 memory context should stay before final sc1q requirements');
assert(sc1BodyIdx < 0 || sc1PreIdx < sc1BodyIdx, 'SC1 memory context should be injected before the SC1 API body is built');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
vm.createContext(sandbox);

[
  'tm-memory-trace.js',
  'tm-memory-workshop.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const MT = sandbox.TM && sandbox.TM.MemoryTrace;
const MW = sandbox.TM && sandbox.TM.MemoryWorkshop;
assert(MT, 'MemoryTrace should be exported');
assert.strictEqual(typeof MT.recordCompiledContext, 'function', 'recordCompiledContext should be exported');
assert(MW, 'MemoryWorkshop should be exported');
assert.strictEqual(typeof MW.renderCompiledContextTrace, 'function', 'compiled context trace renderer should be exported');

const rawSecret = 'SECRET_SC1_CONTEXT_BODY_'.repeat(80);
const suppressedSecret = 'HIDDEN_SUPPRESSED_BODY_'.repeat(40);
const zoneSecret = 'ZONE_CONTEXT_SECRET_'.repeat(40);
const GM = { turn: 77, _turnAiResults: {} };

const compiled = {
  schemaVersion: 'memory-context/v0',
  text: '<memory-context>' + rawSecret + '</memory-context>',
  sections: {
    coreFacts: [],
    stateAffairs: [{ id: 'issue-chain-canal' }],
    chronology: [{ id: 'chronicle-rollup-1628' }, { id: 'turn-archive-76-SC1' }],
    characterMemory: [{ id: 'character-dossier-minister-bi' }]
  },
  hits: [
    {
      id: 'issue-chain-canal',
      source: 'chronicle',
      type: 'ongoing_affair',
      text: 'Canal arrears should constrain next turn river works.'.repeat(20),
      lane: 'L3_long_term_affair',
      authority: 'ai_analysis',
      turn: 76,
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-76-SC1', turn: 76 }]
    },
    {
      id: 'character-dossier-minister-bi',
      source: 'character_memory',
      type: 'character_memory',
      text: 'Minister Bi promised to audit canal payroll.'.repeat(20),
      lane: 'L6_retrieved_evidence',
      authority: 'event_log',
      turn: 76
    }
  ],
  zones: [
    {
      id: 'memory-context-stateAffairs',
      source: 'MemoryContextCompiler',
      lane: 'L6_retrieved_evidence',
      reason: 'stateAffairs',
      text: zoneSecret,
      order: 11,
      cost: 55,
      score: 0.8
    }
  ],
  suppressed: [
    {
      id: 'hidden-thread',
      source: 'chronicle',
      reason: 'hidden_control',
      text: suppressedSecret,
      cost: 22
    }
  ],
  diagnostics: {
    kept: [{ id: 'issue-chain-canal', source: 'chronicle', stage: 'fill', cost: 31 }],
    suppressed: [{ id: 'budget-drop', source: 'character_memory', reason: 'budget_exhausted', text: suppressedSecret }]
  },
  tokenEstimate: 456,
  maxTokens: 1800
};

const ctx = MT.recordCompiledContext(GM, {
  id: 'SC1_PRE_CONTEXT',
  stage: 'sc1-pre-inference',
  lane: 'memory_context_compiler',
  compiled,
  text: '<memory-context-disclaimer>trace only</memory-context-disclaimer>\n' + compiled.text,
  intent: 'turn_inference',
  audience: 'system',
  actorScope: 'system',
  maxTokens: 1800,
  compileOpts: { turn: 77, intent: 'turn_inference', audience: 'system', actorScope: 'system', maxTokens: 1800 }
});

assert.strictEqual(ctx.id, 'SC1_PRE_CONTEXT');
assert.strictEqual(ctx.stage, 'sc1-pre-inference');
assert.strictEqual(ctx.intent, 'turn_inference');
assert.strictEqual(ctx.textTokensEstimate, 456);
assert.strictEqual(ctx.maxTokens, 1800);
assert.strictEqual(ctx.sectionCounts.stateAffairs, 1);
assert.strictEqual(ctx.sectionCounts.chronology, 2);
assert.strictEqual(ctx.sectionCounts.characterMemory, 1);
assert.strictEqual(ctx.countsByType.ongoing_affair, 1);
assert.strictEqual(ctx.countsByType.character_memory, 1);
assert.strictEqual(ctx.countsBySource.chronicle, 1);
assert.strictEqual(ctx.countsByLane.L3_long_term_affair, 1);
assert.strictEqual(ctx.countsByAuthority.ai_analysis, 1);
assert.strictEqual(ctx.kept[0].id, 'issue-chain-canal');
assert(ctx.suppressed.some((item) => item.id === 'hidden-thread'), 'suppressed diagnostics should be compacted');
assert(ctx.zones.some((item) => item.id === 'memory-context-stateAffairs'), 'zone packing diagnostics should be compacted');

const traceJson = JSON.stringify(ctx);
assert(!traceJson.includes(rawSecret.slice(0, 80)), 'compiled context trace must not store full raw context text');
assert(!traceJson.includes(suppressedSecret.slice(0, 80)), 'compiled context trace must not store full suppressed text');
assert(!traceJson.includes(zoneSecret.slice(0, 80)), 'compiled context trace must not store full zone text');

const summary = MT.summarize(GM);
assert.strictEqual(summary.compiledContexts, 1, 'summary should count compiled contexts');
assert.strictEqual(summary.compiledContextTokensEstimate, 456, 'summary should count compiled-context token estimates');

const snapshot = MW.buildSnapshot(GM, { playerSafe: true });
assert.strictEqual(snapshot.counts.compiledContexts, 1, 'workshop snapshot should count compiled contexts');

const html = MW.renderCompiledContextTrace(GM, { playerSafe: true });
assert(html.includes('Compiled Context Trace'), 'workshop should render compiled context trace');
assert(html.includes('SC1_PRE_CONTEXT'), 'workshop trace should show SC1_PRE_CONTEXT id');
assert(html.includes('State Affairs:1'), 'workshop trace should show section counts');
assert(!html.includes(rawSecret.slice(0, 80)), 'workshop trace should not leak raw compiled context');

console.log('smoke-memory-sc1-precontext-trace ok');
