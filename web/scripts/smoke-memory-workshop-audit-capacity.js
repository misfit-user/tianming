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
  turn: 951,
  _memoryDraftInbox: [],
  _memoryAccepted: [],
  _memoryQuarantine: [],
  _memoryControls: {},
  _memoryAuditEvents: []
};

for (let i = 0; i < 135; i += 1) {
  const id = 'audit-cap-' + i;
  GM._memoryDraftInbox.push({ id, type: 'semantic_fact', body: 'Audit cap ' + i, status: 'draft' });
  MW.handleAction(GM, 'hide-memory', id, {
    reviewer: 'workshop-smoke',
    reason: 'audit cap ' + i
  });
}

assert(GM._memoryAuditEvents.length <= 120, 'Workshop governance audit should keep a bounded default history');
assert(!GM._memoryAuditEvents.some((event) => event.id === 'audit-cap-0'), 'audit capacity should prune the oldest events first');
assert(GM._memoryAuditEvents.some((event) => event.id === 'audit-cap-134'), 'audit capacity should retain newest events');
assert(GM._memoryAuditSeq >= 135, 'audit sequence should stay monotonic after pruning');

const html = MW.renderAuditEvents(GM, { playerSafe: true });
assert(html.includes('audit-cap-134'), 'audit render should include newest retained event');
assert(!html.includes('audit-cap-0'), 'audit render should not include pruned oldest event');

console.log('smoke-memory-workshop-audit-capacity ok');
