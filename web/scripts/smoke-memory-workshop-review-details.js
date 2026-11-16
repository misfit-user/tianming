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
  'tm-memory-writegate.js',
  'tm-memory-workshop.js'
].forEach((file) => {
  vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, { filename: file });
});

const MW = sandbox.TM && sandbox.TM.MemoryWorkshop;
assert(MW, 'MemoryWorkshop should be exported');
assert.strictEqual(typeof MW.handleAction, 'function', 'MemoryWorkshop should expose handleAction');

const GM = {
  turn: 21,
  _memoryWriteQueue: [],
  _memoryDraftInbox: [
    {
      id: 'draft-belief',
      type: 'character_belief',
      body: 'Wen privately suspects Han is using the levy dispute to weaken him.',
      status: 'draft',
      reviewStatus: 'pending_review',
      ownerScope: 'npc:wen-tiren',
      readScope: 'npc:wen-tiren',
      sourceRefs: [{ type: 'jishiRecords', id: 'jr-belief', turn: 20 }],
      basisRefs: [{ type: 'courtRecords', id: 'court-levy', turn: 20 }],
      extra: { actor: 'wen-tiren', memoryType: 'belief', qualityStatus: 'draftable', confidence: 0.73 }
    }
  ],
  _memoryQuarantine: [
    {
      id: 'q-short',
      type: 'character_memory',
      body: 'He is angry.',
      status: 'quarantined',
      reviewStatus: 'quarantined',
      ownerScope: 'npc:sun-chuanting',
      readScope: 'public',
      sourceRefs: [],
      basisRefs: [],
      extra: { actor: 'sun-chuanting', memoryType: 'mood', qualityStatus: 'quarantined', confidence: 0.31 },
      reasons: [
        { code: 'low_confidence', message: 'confidence below review threshold' },
        { code: 'missing_source_refs', message: 'no explicit source refs' },
        { code: 'too_short', message: 'body too short' }
      ]
    }
  ],
  _memoryAccepted: [],
  _memoryAuditEvents: []
};
GM._memoryWriteQueue = GM._memoryDraftInbox.concat(GM._memoryQuarantine);

const draftHtml = MW.renderDraftInbox(GM, { playerSafe: false });
assert(draftHtml.includes('belief'), 'draft rows should show memory_type');
assert(draftHtml.includes('draftable'), 'draft rows should show quality status');
assert(draftHtml.includes('0.73'), 'draft rows should show confidence');
assert(draftHtml.includes('npc:wen-tiren'), 'draft rows should show readScope or ownerScope');
assert(draftHtml.includes('jishiRecords:jr-belief'), 'draft rows should show source refs');
assert(draftHtml.includes('courtRecords:court-levy'), 'draft rows should show basis refs');
assert(draftHtml.includes('data-action="set-read-scope"'), 'draft rows should render readScope action buttons');
assert(draftHtml.includes('data-read-scope="public"'), 'draft rows should offer public readScope');
assert(draftHtml.includes('data-read-scope="npc:wen-tiren"'), 'draft rows should offer owner readScope');

const quarantineHtml = MW.renderQuarantine(GM, { playerSafe: false });
assert(quarantineHtml.includes('mood'), 'quarantine rows should show memory_type');
assert(quarantineHtml.includes('quarantined'), 'quarantine rows should show quality status');
assert(quarantineHtml.includes('low_confidence'), 'quarantine rows should show low confidence reason');
assert(quarantineHtml.includes('missing_source_refs'), 'quarantine rows should show source reason');
assert(quarantineHtml.includes('too_short'), 'quarantine rows should show short body reason');
assert(quarantineHtml.includes('data-action="set-read-scope"'), 'quarantine rows should also allow scope editing before review');

const changed = MW.handleAction(GM, 'set-read-scope', 'draft-belief', {
  reviewer: 'workshop-smoke',
  readScope: 'public',
  reason: 'make memory public after review'
});
assert(changed && changed.readScope === 'public', 'set-read-scope should update the draft item');
assert(GM._memoryDraftInbox[0].readScope === 'public', 'draft inbox item should reflect readScope update');
assert(GM._memoryWriteQueue.find((item) => item.id === 'draft-belief').readScope === 'public', 'write queue item should reflect readScope update');
assert(GM._memoryAuditEvents.some((event) => event.action === 'set_read_scope' && event.id === 'draft-belief'), 'readScope change should append audit event');

const accepted = MW.handleAction(GM, 'accept-draft', 'draft-belief', { reviewer: 'workshop-smoke' });
assert(accepted && accepted.status === 'active', 'draft can still be accepted after readScope edit');
assert(GM._memoryAccepted.some((item) => item.id === 'draft-belief' && item.readScope === 'public'), 'accepted memory preserves edited readScope');

console.log('smoke-memory-workshop-review-details ok');
