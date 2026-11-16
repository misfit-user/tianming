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
  'tm-memory-workshop.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const MW = sandbox.TM && sandbox.TM.MemoryWorkshop;
assert(MW, 'MemoryWorkshop should be exported');
assert.strictEqual(typeof MW.handleAction, 'function', 'MemoryWorkshop should expose handleAction');

const GM = {
  turn: 444,
  _memoryDraftInbox: [
    {
      id: 'draft-river-resolution',
      type: 'issue_resolution',
      body: 'River payroll is resolved by a treasury transfer.',
      status: 'draft',
      reviewStatus: 'pending_review',
      authority: 'ai_analysis',
      factKey: 'state-affair:river-governance-action-smoke',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-river-old' }],
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 444 }],
      basisRefs: [{ type: 'memoryTrace.compiledContext', id: 'SC1_PRE_CONTEXT', turn: 444 }],
      ownerScope: 'world',
      readScope: 'public'
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
      factKey: 'state-affair:river-governance-action-smoke',
      supersedesRefs: [{ type: 'accepted_memory', id: 'accepted-river-old' }],
      acceptedBy: 'workshop-smoke',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1', turn: 444 }],
      basisRefs: [{ type: 'memoryTrace.compiledContext', id: 'SC1_PRE_CONTEXT', turn: 444 }]
    },
    {
      id: 'accepted-river-old',
      type: 'issue_update',
      body: 'River payroll was still unresolved.',
      status: 'active',
      reviewStatus: 'accepted',
      authority: 'ai_analysis',
      factStatus: 'accepted_memory',
      factKey: 'state-affair:river-governance-action-smoke',
      sourceRefs: [{ type: 'aiTurnResult', id: 'SC1-old', turn: 443 }]
    }
  ],
  _memoryControls: {},
  _memoryQuarantine: [],
  _memoryAuditEvents: []
};
GM._memoryWriteQueue = GM._memoryDraftInbox.concat(GM._memoryQuarantine);

const draftHtml = MW.renderDraftInbox(GM, { playerSafe: true });
assert(draftHtml.includes('data-action="hide-memory"'), 'draft rows should render hide control action');
assert(draftHtml.includes('data-action="mark-false-memory"'), 'draft rows should render mark false control action');
assert(draftHtml.includes('data-action="cooldown-memory"'), 'draft rows should render cooldown control action');
assert(draftHtml.includes('data-action="apply-supersedes"'), 'draft rows should render apply supersedes control action');
assert(draftHtml.includes('data-action="clear-memory-control"'), 'draft rows should render clear control action');

const acceptedHtml = MW.renderAcceptedMemory(GM, { playerSafe: true });
assert(acceptedHtml.includes('data-action="hide-memory"'), 'accepted rows should render hide control action');
assert(acceptedHtml.includes('data-action="apply-supersedes"'), 'accepted rows with supersedesRefs should render apply supersedes control action');

const hidden = MW.handleAction(GM, 'hide-memory', 'draft-river-resolution', {
  reviewer: 'workshop-smoke',
  reason: 'manual hide'
});
assert(hidden && hidden.hidden === true, 'hide-memory should write hidden control');
assert(GM._memoryControls['draft-river-resolution'].hidden === true, 'hide-memory should persist hidden control');
assert(GM._memoryAuditEvents.some((event) => event.id === 'draft-river-resolution' && event.action === 'hide_memory'), 'hide-memory should audit control action');

const markedFalse = MW.handleAction(GM, 'mark-false-memory', 'draft-river-resolution', {
  reviewer: 'workshop-smoke',
  reason: 'manual false mark'
});
assert(markedFalse && markedFalse.markedFalse === true && markedFalse.hidden === true, 'mark-false-memory should mark false and hide');
assert(GM._memoryAuditEvents.some((event) => event.id === 'draft-river-resolution' && event.action === 'mark_false_memory'), 'mark-false-memory should audit control action');

const cooled = MW.handleAction(GM, 'cooldown-memory', 'draft-river-resolution', {
  reviewer: 'workshop-smoke',
  reason: 'manual cooldown',
  cooldownTurns: 6
});
assert(cooled && cooled.cooldownUntilTurn === 450, 'cooldown-memory should set a relative cooldown turn');
assert(GM._memoryAuditEvents.some((event) => event.id === 'draft-river-resolution' && event.action === 'cooldown_memory'), 'cooldown-memory should audit control action');

const cleared = MW.handleAction(GM, 'clear-memory-control', 'draft-river-resolution', {
  reviewer: 'workshop-smoke',
  reason: 'manual clear'
});
assert.strictEqual(cleared, true, 'clear-memory-control should return true when a control was removed');
assert(!GM._memoryControls['draft-river-resolution'], 'clear-memory-control should remove memory control');
assert(GM._memoryAuditEvents.some((event) => event.id === 'draft-river-resolution' && event.action === 'clear_memory_control'), 'clear-memory-control should audit control action');

const superseded = MW.handleAction(GM, 'apply-supersedes', 'accepted-river-new', {
  reviewer: 'workshop-smoke',
  reason: 'manual supersedes'
});
assert(superseded && superseded.applied === 1, 'apply-supersedes should apply one supersedes relation');
assert(GM._memoryControls['accepted-river-old'].supersededBy === 'accepted-river-new', 'apply-supersedes should mark old memory as superseded by new id');
assert(Array.isArray(GM._memEdges) && GM._memEdges.some((edge) => edge.type === 'supersedes' && edge.src === 'accepted-river-new' && edge.dst === 'accepted-river-old'), 'apply-supersedes should create a supersedes edge');
assert(GM._memoryAuditEvents.some((event) => event.id === 'accepted-river-new' && event.action === 'apply_supersedes'), 'apply-supersedes should audit control action');

const updatedAcceptedHtml = MW.renderAcceptedMemory(GM, { playerSafe: true });
assert(updatedAcceptedHtml.includes('supersededBy=accepted-river-new'), 'accepted render should show newly applied supersededBy control');

console.log('smoke-memory-workshop-governance-actions ok');
