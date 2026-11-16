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
  'tm-memory-workshop.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const MW = sandbox.TM && sandbox.TM.MemoryWorkshop;
assert(MW, 'MemoryWorkshop should be exported');
assert.strictEqual(typeof MW.renderGovernanceLabel, 'function', 'Workshop should expose governance label renderer');

const GM = {
  turn: 333,
  _memoryDraftInbox: [
    {
      id: 'draft-river-resolution',
      type: 'issue_resolution',
      issueId: 'issue-river',
      body: 'River payroll is resolved by a treasury transfer.',
      status: 'draft',
      reviewStatus: 'pending_review',
      authority: 'ai_analysis',
      factKey: 'state-affair:river-governance-smoke',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-river-old' }],
      contradictsRefs: [{ type: 'accepted_memory', id: 'accepted-river-rumor' }],
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 333 }],
      basisRefs: [{ type: 'memoryTrace.compiledContext', id: 'SC1_PRE_CONTEXT', turn: 333 }],
      ownerScope: 'world',
      readScope: 'public'
    },
    {
      id: 'draft-duplicate',
      type: 'semantic_fact',
      body: 'Duplicate accepted memory should be visible before archival.',
      status: 'archived',
      reviewStatus: 'duplicate',
      authority: 'ai_extracted',
      factKey: 'core:duplicate-governance-smoke',
      duplicateOf: 'accepted-duplicate-source',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 333 }]
    }
  ],
  _memoryAccepted: [
    {
      id: 'accepted-river-new',
      type: 'issue_resolution',
      body: 'River payroll was settled.',
      status: 'active',
      reviewStatus: 'accepted',
      authority: 'ai_analysis',
      factStatus: 'accepted_memory',
      factKey: 'state-affair:river-governance-smoke',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-river-old' }],
      contradictsRefs: [{ type: 'accepted_memory', id: 'accepted-river-rumor' }],
      acceptedBy: 'workshop-smoke',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 333 }],
      basisRefs: [{ type: 'memoryTrace.compiledContext', id: 'SC1_PRE_CONTEXT', turn: 333 }]
    },
    {
      id: 'accepted-river-old',
      type: 'issue_update',
      body: 'River payroll was still unresolved.',
      status: 'active',
      reviewStatus: 'accepted',
      authority: 'ai_analysis',
      factStatus: 'accepted_memory',
      factKey: 'state-affair:river-governance-smoke',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1-old', turn: 332 }]
    }
  ],
  _memoryControls: {
    'accepted-river-old': {
      supersededBy: 'accepted-river-new',
      archived: true,
      cooldownUntilTurn: 338,
      reason: 'accepted memory superseded'
    }
  },
  _memoryQuarantine: [],
  _memoryAuditEvents: []
};

const draftHtml = MW.renderDraftInbox(GM, { playerSafe: true });
assert(draftHtml.includes('Governance'), 'Draft Inbox should include a Governance column');
assert(draftHtml.includes('fact=state-affair:river-governance-smoke'), 'draft governance should show factKey');
assert(draftHtml.includes('supersedes=accepted_memory:accepted-river-old'), 'draft governance should show supersedesRefs');
assert(draftHtml.includes('contradicts=accepted_memory:accepted-river-rumor'), 'draft governance should show contradictsRefs');
assert(draftHtml.includes('duplicateOf=accepted-duplicate-source'), 'draft governance should show duplicateOf');

const acceptedHtml = MW.renderAcceptedMemory(GM, { playerSafe: true });
assert(acceptedHtml.includes('Governance'), 'Accepted Memory should include a Governance column');
assert(acceptedHtml.includes('fact=state-affair:river-governance-smoke'), 'accepted governance should show factKey');
assert(acceptedHtml.includes('supersedes=accepted_memory:accepted-river-old'), 'accepted governance should show supersedesRefs');
assert(acceptedHtml.includes('contradicts=accepted_memory:accepted-river-rumor'), 'accepted governance should show contradictsRefs');
assert(acceptedHtml.includes('supersededBy=accepted-river-new'), 'accepted governance should show control supersededBy');
assert(acceptedHtml.includes('cooldown=338'), 'accepted governance should show control cooldown');

const fullHtml = MW.renderWorkshop(GM, { playerSafe: true });
assert(fullHtml.includes('data-section="drafts"'), 'full Workshop should include Drafts section');
assert(fullHtml.includes('data-section="accepted-memory"'), 'full Workshop should include Accepted section');
assert(fullHtml.includes('supersededBy=accepted-river-new'), 'full Workshop should surface governance control state');

console.log('smoke-memory-workshop-governance-visibility ok');
