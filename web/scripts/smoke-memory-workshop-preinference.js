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
  'tm-memory-issue-governance.js',
  'tm-memory-envelope.js',
  'tm-memory-controls.js',
  'tm-memory-retrieval.js',
  'tm-context-zones.js',
  'tm-memory-context-compiler.js',
  'tm-memory-workshop.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const MW = sandbox.TM && sandbox.TM.MemoryWorkshop;
assert(MW, 'MemoryWorkshop should be exported');
assert.strictEqual(typeof MW.buildPreInferenceDiagnostic, 'function', 'pre-inference diagnostic API should be exported');
assert.strictEqual(typeof MW.renderPreInferenceContext, 'function', 'pre-inference renderer should be exported');

const GM = {
  turn: 41,
  chars: [
    { id: 'c-minister-bi', name: 'Minister Bi', alive: true, officialTitle: 'Minister', lastUpdateTurn: 40 },
  ],
  currentIssues: [
    {
      id: 'issue-canal',
      title: 'Canal payroll',
      description: 'Canal payroll arrears threaten river works.',
      raisedTurn: 39,
      confidence: 0.7
    }
  ],
  _memoryChronicleRollups: [
    {
      id: 'chronicle-rollup-1628',
      type: 'historiography_summary',
      yearKey: '1628',
      body: '1628 chronicle rollup: canal payroll arrears followed river works delays.',
      authority: 'structured_chronicle',
      visibility: 'public',
      turn: 40,
      lane: 'L7_chronicle_context',
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-40-SC1', turn: 40 }]
    }
  ],
  _memoryIssueChains: [
    {
      id: 'issue-chain-canal',
      type: 'ongoing_affair',
      issueId: 'issue-canal',
      body: 'canal payroll issue chain: arrears now constrain river works.',
      authority: 'ai_analysis',
      visibility: 'public',
      turn: 40,
      lane: 'L3_long_term_affair',
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-40-SC1', turn: 40 }]
    },
    {
      id: 'issue-chain-stale',
      type: 'ongoing_affair',
      issueId: 'issue-stale',
      body: 'STALE_SECRET_BODY should be suppressed from pre-inference prompt.',
      authority: 'ai_analysis',
      visibility: 'public',
      turn: 38,
      lane: 'L3_long_term_affair',
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-38-SC1', turn: 38 }]
    }
  ],
  _memoryCharacterDossiers: [
    {
      id: 'character-dossier-minister-bi',
      type: 'character_memory',
      actor: 'Minister Bi',
      body: 'Minister Bi character dossier: promised to audit canal payroll.',
      authority: 'event_log',
      visibility: 'internal',
      ownerScope: 'npc:Minister Bi',
      readScope: 'public',
      turn: 40,
      lane: 'L6_retrieved_evidence',
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-40-SC1', turn: 40 }]
    }
  ],
  _memoryControls: {
    'issue-chain-stale': {
      hidden: true,
      reason: 'stale issue retired',
      updatedTurn: 41
    }
  }
};

const diag = MW.buildPreInferenceDiagnostic(GM, {
  turn: 41,
  playerSafe: true,
  preInferenceMaxTokens: 10000
});
assert.strictEqual(diag.available, true, 'diagnostic should compile context');
assert.strictEqual(diag.compileOpts.intent, 'turn_inference', 'diagnostic should use turn inference intent');
assert(diag.sectionRows.some((row) => row.key === 'chronology' && row.count >= 1), 'diagnostic should count chronology section');
assert(diag.sectionRows.some((row) => row.key === 'stateAffairs' && row.count >= 1), 'diagnostic should count state affairs section');
assert(diag.sectionRows.some((row) => row.key === 'characterMemory' && row.count >= 1), 'diagnostic should count character memory section');
assert(diag.countsByType.historiography_summary >= 1, 'diagnostic should count historiography summaries');
assert(diag.countsByType.ongoing_affair >= 1, 'diagnostic should count issue chains');
assert(diag.countsByType.character_memory >= 1, 'diagnostic should count character dossiers');
assert(diag.countsByLane.L3_long_term_affair >= 1, 'diagnostic should count long-term affair lane');
assert(diag.suppressed.some((item) => item.id === 'issue-chain-stale' && item.reason === 'hidden_control'), 'diagnostic should report hidden-control suppression');
assert(!diag.compiled.text.includes('STALE_SECRET_BODY'), 'hidden control should keep stale body out of compiled prompt');
assert(diag.compiled.text.includes('canal payroll issue chain'), 'active issue chain should remain prompt-visible');
assert(diag.compiled.text.includes('Minister Bi character dossier'), 'character dossier should remain prompt-visible');

const html = MW.renderPreInferenceContext(GM, {
  turn: 41,
  playerSafe: true,
  preInferenceMaxTokens: 10000
});
assert(html.includes('Pre-Inference Context'), 'pre-inference section should render');
assert(html.includes('Pre-Inference Distribution'), 'distribution section should render');
assert(html.includes('Pre-Inference Kept'), 'kept diagnostics should render');
assert(html.includes('Pre-Inference Suppressed'), 'suppressed diagnostics should render');
assert(html.includes('Chronology'), 'chronology row should render');
assert(html.includes('State Affairs'), 'state affairs row should render');
assert(html.includes('Character Memory'), 'character memory row should render');
assert(html.includes('hidden_control'), 'suppression reason should render');
assert(html.includes('[hidden memory]'), 'player-safe suppression preview should redact hidden body');
assert(!html.includes('STALE_SECRET_BODY'), 'player-safe pre-inference view should not leak hidden suppressed body');

const workshopHtml = MW.renderWorkshop(GM, {
  turn: 41,
  playerSafe: true,
  preInferenceMaxTokens: 10000
});
assert(workshopHtml.includes('Pre-Inference Context'), 'full workshop should include pre-inference panel');
assert(workshopHtml.indexOf('Pre-Inference Context') < workshopHtml.indexOf('Injection Trace'), 'pre-inference should appear before trace panels');
assert(!workshopHtml.includes('STALE_SECRET_BODY'), 'full workshop should not leak hidden suppressed body');

console.log('smoke-memory-workshop-preinference ok');
