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
const MCC = sandbox.TM && sandbox.TM.MemoryContextCompiler;
assert(MW, 'MemoryWorkshop should be exported');
assert.strictEqual(typeof MW.renderRollupReview, 'function', 'rollup review renderer should be exported');
assert.strictEqual(typeof MW.handleAction, 'function', 'MemoryWorkshop should expose handleAction');

const GM = {
  turn: 31,
  _memoryChronicleRollups: [
    {
      id: 'chronicle-rollup-1627',
      type: 'historiography_summary',
      yearKey: '1627',
      body: '1627 chronicle rollup: spring payroll arrears | summer river works',
      turn: 30,
      authority: 'structured_chronicle',
      lane: 'L7_chronicle_context',
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-30-SC1', turn: 30 }]
    }
  ],
  _memoryIssueChains: [
    {
      id: 'issue-chain-salt',
      type: 'ongoing_affair',
      issueId: 'issue-salt',
      body: 'salt quota issue chain: salt quota pressure worsens after transport delays',
      turn: 30,
      authority: 'ai_analysis',
      lane: 'L3_long_term_affair',
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-30-SC1', turn: 30 }]
    }
  ],
  _memoryCharacterDossiers: [
    {
      id: 'character-dossier-minister-bi',
      type: 'character_memory',
      actor: 'minister-bi',
      body: 'minister-bi character dossier: minister-bi warned censor-li about payroll fraud',
      turn: 30,
      authority: 'event_log',
      ownerScope: 'npc:minister-bi',
      readScope: 'public',
      lane: 'L6_retrieved_evidence',
      sourceRefs: [{ type: 'turnArchive', id: 'turn-archive-30-SC1', turn: 30 }]
    }
  ],
  _memoryAuditEvents: []
};

const html = MW.renderRollupReview(GM, { playerSafe: false });
assert(html.includes('Rollup Review'), 'rollup review section should render');
assert(html.includes('1627 chronicle rollup'), 'chronicle rollup body appears');
assert(html.includes('salt quota issue chain'), 'issue chain body appears');
assert(html.includes('minister-bi character dossier'), 'character dossier body appears');
assert(html.includes('data-action="pin-rollup"'), 'pin action renders');
assert(html.includes('data-action="resident-rollup"'), 'resident action renders');
assert(html.includes('data-action="hide-rollup"'), 'hide action renders');
assert(html.includes('data-action="mark-false-rollup"'), 'mark false action renders');
assert(html.includes('data-action="clear-rollup-control"'), 'clear control action renders');

const snapshot = MW.buildSnapshot(GM, { playerSafe: false });
assert.strictEqual(snapshot.counts.rollups, 3, 'snapshot counts all rollup records');
assert.strictEqual(snapshot.counts.chronicleRollups, 1, 'snapshot counts chronicle rollups');
assert.strictEqual(snapshot.counts.issueChains, 1, 'snapshot counts issue chains');
assert.strictEqual(snapshot.counts.characterDossiers, 1, 'snapshot counts character dossiers');

const before = MCC.compileFromGM(GM, { turn: 31, audience: 'system', actorScope: 'system', intent: 'turn_inference', maxTokens: 1600 });
assert(before.text.includes('salt quota pressure worsens'), 'issue chain is initially injectable');

const hidden = MW.handleAction(GM, 'hide-rollup', 'issue-chain-salt', { reviewer: 'workshop-smoke', reason: 'hide stale issue chain' });
assert(hidden && hidden.hidden === true, 'hide-rollup writes hidden control');
assert(GM._memoryControls['issue-chain-salt'].hidden === true, 'control stored by rollup id');
assert(GM._memoryAuditEvents.some((event) => event.action === 'hide_rollup' && event.id === 'issue-chain-salt'), 'hide action audited');

const afterHide = MCC.compileFromGM(GM, { turn: 31, audience: 'system', actorScope: 'system', intent: 'turn_inference', maxTokens: 1600 });
assert(!afterHide.text.includes('salt quota pressure worsens'), 'hidden issue chain is suppressed by compiler path');

const resident = MW.handleAction(GM, 'resident-rollup', 'character-dossier-minister-bi', { reviewer: 'workshop-smoke', reason: 'keep actor dossier resident' });
assert(resident && resident.resident === true && resident.pinned === true, 'resident-rollup pins and marks resident');

const falseCtrl = MW.handleAction(GM, 'mark-false-rollup', 'chronicle-rollup-1627', { reviewer: 'workshop-smoke', reason: 'bad rollup' });
assert(falseCtrl && falseCtrl.markedFalse === true && falseCtrl.hidden === true, 'mark-false-rollup marks false and hides');

const cleared = MW.handleAction(GM, 'clear-rollup-control', 'issue-chain-salt', { reviewer: 'workshop-smoke' });
assert.strictEqual(cleared, true, 'clear-rollup-control returns true');
assert(!GM._memoryControls['issue-chain-salt'], 'clear removes control');
assert(GM._memoryAuditEvents.some((event) => event.action === 'clear_rollup_control' && event.id === 'issue-chain-salt'), 'clear action audited');

console.log('smoke-memory-workshop-rollup-controls ok');
