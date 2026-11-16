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

const GM = {
  turn: 801,
  _memoryChronicleRollups: [
    {
      id: 'rollup-undo-chronicle',
      type: 'chronicle_rollup',
      body: 'Canal inspections were summarized for the year.',
      authority: 'ai_rollup',
      lane: 'chronology',
      sourceRefs: [{ type: 'biannianItems', id: 'bn-undo' }]
    }
  ],
  _memoryIssueChains: [],
  _memoryCharacterDossiers: [],
  _memoryControls: {
    'rollup-clear-existing': { pinned: true, reason: 'preexisting pin', updatedTurn: 800 }
  },
  _memoryAuditEvents: []
};

const marked = MW.handleAction(GM, 'mark-false-rollup', 'rollup-undo-chronicle', {
  reviewer: 'workshop-smoke',
  reason: 'wrong rollup summary'
});
assert(marked && marked.markedFalse === true, 'mark-false-rollup should write a control before undo');
const markEvent = GM._memoryAuditEvents.find((event) => event.action === 'mark_false_rollup');
assert(markEvent && markEvent.auditId, 'rollup mark-false audit should include auditId');
assert(markEvent.undoable === true, 'rollup mark-false audit should be undoable');
assert(markEvent.undo.controls.some((entry) => entry.key === 'rollup-undo-chronicle' && entry.before == null), 'rollup mark-false undo should remember absence of prior control');

const undoMark = MW.handleAction(GM, 'undo-memory-control', markEvent.auditId, {
  reviewer: 'workshop-smoke',
  reason: 'undo wrong rollup correction'
});
assert(undoMark && undoMark.undone === true, 'undo should undo rollup mark-false audit');
assert(!GM._memoryControls['rollup-undo-chronicle'], 'undo should remove rollup control that did not exist before');
assert(markEvent.undone === true, 'undo should mark the rollup audit event as undone');

const cleared = MW.handleAction(GM, 'clear-rollup-control', 'rollup-clear-existing', {
  reviewer: 'workshop-smoke',
  reason: 'test clear existing rollup'
});
assert.strictEqual(cleared, true, 'clear-rollup-control should remove existing control before undo');
assert(!GM._memoryControls['rollup-clear-existing'], 'clear-rollup-control should remove preexisting rollup control');
const clearEvent = GM._memoryAuditEvents.find((event) => event.action === 'clear_rollup_control');
assert(clearEvent && clearEvent.undoable === true, 'clear-rollup-control audit should be undoable');
assert(clearEvent.undo.controls.some((entry) => entry.key === 'rollup-clear-existing' && entry.before && entry.before.pinned === true), 'clear rollup undo should keep previous control');

const undoClear = MW.handleAction(GM, 'undo-memory-control', clearEvent.auditId, {
  reviewer: 'workshop-smoke',
  reason: 'restore rollup control'
});
assert(undoClear && undoClear.undone === true, 'undo should undo rollup clear-control audit');
assert(GM._memoryControls['rollup-clear-existing'] && GM._memoryControls['rollup-clear-existing'].pinned === true, 'undo should restore cleared rollup control');
assert.strictEqual(GM._memoryControls['rollup-clear-existing'].reason, 'preexisting pin', 'undo should restore rollup control reason');

const auditHtml = MW.renderAuditEvents(GM, { playerSafe: true });
assert(auditHtml.includes('mark_false_rollup'), 'audit render should show rollup mark-false action');
assert(auditHtml.includes('clear_rollup_control'), 'audit render should show rollup clear action');
assert(auditHtml.includes('undone'), 'audit render should show undone state for rollup events');

console.log('smoke-memory-workshop-rollup-undo ok');
