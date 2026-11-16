const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.join(__dirname, '..');
const workshopPath = path.join(ROOT, 'tm-memory-workshop.js');
assert(fs.existsSync(workshopPath), 'tm-memory-workshop.js should exist');

const sandbox = { console, Date, Math, JSON, window: {} };
sandbox.window.window = sandbox.window;

[
  'tm-memory-evidence-registry.js',
  'tm-memory-envelope.js',
  'tm-memory-trace.js',
  'tm-memory-writegate.js',
  'tm-memory-workshop.js',
].forEach((file) => {
  vm.runInNewContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox.window, { filename: file });
});

const TM = sandbox.window.TM;
const MW = TM && TM.MemoryWorkshop;
const MT = TM && TM.MemoryTrace;
assert(MW, 'TM.MemoryWorkshop should be exported');
[
  'buildSnapshot',
  'renderInjectionTrace',
  'renderRetrievalTrace',
  'renderDraftInbox',
  'renderQuarantine',
  'renderMemoryControls',
  'renderEvidenceSources',
  'renderEnvelopeInventory',
  'renderWorkshop',
  'open',
  'close',
  'toggle',
  'refresh',
].forEach((name) => {
  assert.strictEqual(typeof MW[name], 'function', 'MemoryWorkshop should expose ' + name);
});

const GM = {
  turn: 33,
  chars: [
    { id: 'c-wei', name: 'Wei Zhongxian', alive: true, officialTitle: 'Director', lastUpdateTurn: 32 },
  ],
  activeEdicts: [
    { id: 'edict-1', status: 'active', content: 'Repair canal', startedTurn: 31 },
  ],
  currentIssues: [
    { id: 'issue-1', title: 'Canal silting', status: 'pending', category: '民生', confidence: 0.6 },
  ],
  qijuHistory: [
    { turn: 33, edictsSource: 'promulgated', edicts: { political: 'Repair canal' }, xinglu: 'Inspect canal works' },
  ],
  jishiRecords: [
    { turn: 33, char: 'Wei Zhongxian', playerSaid: 'Audit canal funds', npcSaid: 'I will report.', mode: 'wendui' },
  ],
  biannianItems: [
    { id: 'bn-1', turn: 32, title: 'Canal floods', content: 'Canal water rose.', type: 'disaster' },
  ],
  _chronicleTracks: [
    { id: 'track-canal', title: 'Canal repair', status: 'active', progress: 40, sourceType: 'edict', sourceId: 'edict-1' },
  ],
  memoryAnchors: [
    {
      id: 'anchor-hidden',
      body: 'SECRET_HEAVEN_TEXT should never be rendered raw',
      text: 'SECRET_HEAVEN_TEXT should never be rendered raw',
      visibility: 'heaven_secret',
      sourceRefs: [{ type: 'note', id: 'secret' }],
    },
  ],
  _memoryDraftInbox: [
    {
      id: 'draft-1',
      type: 'semantic_fact',
      body: 'Draft fact about Sun',
      status: 'draft',
      visibility: 'player_known',
      sourceRefs: [{ type: 'dialogue', id: 'dlg-1' }],
    },
  ],
  _memoryQuarantine: [
    {
      id: 'q-1',
      type: 'semantic_fact',
      body: 'QUARANTINED_PROMPT_SECRET',
      status: 'quarantined',
      visibility: 'quarantine',
      reasons: [{ code: 'prompt_injection', message: 'unsafe' }],
      sourceRefs: [{ type: 'dialogue', id: 'dlg-2' }],
    },
  ],
  _memoryControls: {
    'currentIssues:issue-1': {
      pinned: true,
      resident: true,
      reason: 'designer pin',
      updatedTurn: 33,
    },
    'shijiHistory:old-1': {
      markedFalse: true,
      reason: 'player corrected',
      updatedTurn: 32,
    },
  },
  _turnAiResults: {},
};

MT.recordInjection(GM, {
  lane: 'L2_active_law_commitment',
  stage: 'SC_PROMPT',
  text: 'Injected law block',
  tokenEstimate: 12,
  items: [{ id: 'edict-1', source: 'activeEdict', reason: 'guaranteed', lane: 'L2_active_law_commitment' }],
});
MT.recordRetrieval(GM, {
  id: 'SC_RECALL',
  status: 'hit',
  query: { keywords: ['Wei Zhongxian'], purpose: 'test retrieval' },
  hits: [{ id: 'hit-1', source: 'hard_state', text: 'Wei Zhongxian alive', turn: 33, score: 0.9 }],
  suppressed: [{ id: 'old-1', source: 'vector', reason: 'contradicted', text: 'old rumor' }],
  budget: {
    maxTokens: 100,
    tokenEstimate: 20,
    diagnostics: {
      guaranteed: 1,
      fair: 0,
      filled: 0,
      dropped: 1,
      kept: [{ id: 'hit-1', source: 'hard_state', stage: 'guaranteed', cost: 8 }],
    },
  },
});

const snapshot = MW.buildSnapshot(GM);
assert.strictEqual(snapshot.counts.injections, 1, 'snapshot should count injection traces');
assert.strictEqual(snapshot.counts.retrievals, 1, 'snapshot should count retrieval traces');
assert(snapshot.counts.envelopes >= 3, 'snapshot should collect envelope inventory');
assert.strictEqual(snapshot.counts.drafts, 1, 'snapshot should count draft inbox');
assert.strictEqual(snapshot.counts.quarantine, 1, 'snapshot should count quarantine');
assert(snapshot.counts.evidenceSources >= 5, 'snapshot should count evidence sources');

const injectionHtml = MW.renderInjectionTrace(GM);
assert(injectionHtml.includes('SC_PROMPT'), 'injection panel should render injection stage');
assert(injectionHtml.includes('L2_active_law_commitment'), 'injection panel should render lane');

const retrievalHtml = MW.renderRetrievalTrace(GM);
assert(retrievalHtml.includes('SC_RECALL'), 'retrieval panel should render retrieval id');
assert(retrievalHtml.includes('contradicted'), 'retrieval panel should render suppression reason');
assert(retrievalHtml.includes('dropped'), 'retrieval panel should render budget diagnostics');

const draftHtml = MW.renderDraftInbox(GM, { playerSafe: true });
assert(draftHtml.includes('draft-1'), 'draft panel should render draft id');
assert(draftHtml.includes('Draft fact about Sun'), 'draft panel should render player-known draft body');

const quarantineHtml = MW.renderQuarantine(GM, { playerSafe: true });
assert(quarantineHtml.includes('q-1'), 'quarantine panel should render item id');
assert(quarantineHtml.includes('prompt_injection'), 'quarantine panel should render reason code');
assert(!quarantineHtml.includes('QUARANTINED_PROMPT_SECRET'), 'player-safe quarantine panel should redact raw quarantined body');

const controlsHtml = MW.renderMemoryControls(GM, { playerSafe: true });
assert(controlsHtml.includes('currentIssues:issue-1'), 'controls panel should render control keys');
assert(controlsHtml.includes('pinned'), 'controls panel should render pinned state');
assert(controlsHtml.includes('markedFalse'), 'controls panel should render marked false state');

const evidenceHtml = MW.renderEvidenceSources(GM, { playerSafe: true });
assert(evidenceHtml.includes('currentIssues'), 'evidence panel should render currentIssues source');
assert(evidenceHtml.includes('ai_analysis'), 'evidence panel should render authority levels');
assert(evidenceHtml.includes('chronicleTracks'), 'evidence panel should render ChronicleTracker source');

const inventoryHtml = MW.renderEnvelopeInventory(GM, { playerSafe: true });
assert(inventoryHtml.includes('anchor-hidden'), 'inventory should render hidden item identity');
assert(inventoryHtml.includes('[hidden memory]'), 'player-safe inventory should show redaction placeholder');
assert(!inventoryHtml.includes('SECRET_HEAVEN_TEXT'), 'player-safe inventory should redact hidden memory body');

const workshopHtml = MW.renderWorkshop(GM, { playerSafe: true });
[
  'Injection Trace',
  'Retrieval Trace',
  'Draft Inbox',
  'Quarantine',
  'Memory Controls',
  'Evidence Sources',
  'Envelope Inventory',
].forEach((label) => assert(workshopHtml.includes(label), 'workshop should include section: ' + label));
assert(!workshopHtml.includes('SECRET_HEAVEN_TEXT'), 'workshop should not leak hidden body');
assert(!workshopHtml.includes('QUARANTINED_PROMPT_SECRET'), 'workshop should not leak quarantined body');

console.log('smoke-memory-workshop-mvp ok');
