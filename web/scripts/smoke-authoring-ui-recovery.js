#!/usr/bin/env node
'use strict';
/* Offline UI recovery contract: 1,616 edits survive pause, continuation,
 * full application, and an external edit conflict. */
const assert = require('assert/strict'), fs = require('fs'), path = require('path');
const AA = require(path.join(__dirname, '..', 'editor-authoring-agent.js'));
const uiSource = fs.readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8');
assert(/ui\._recovery && ui\.draft/.test(uiSource));
assert(/resetResults\(continuing\)/.test(uiSource));
assert(/AA\.computeDiff\(ui\.baseScenario/.test(uiSource));
assert(/AA\.applySelectedDiffs\(ui\.adapter\.getScenario\(\), ui\.draft/.test(uiSource));
const N = 1616;
const base = { name: '大档', items: Array.from({ length: N }, (_, i) => ({ id: 'item-' + i, value: 'old-' + i })) };
const draft = AA.makeDraft(base);
const edits = Array.from({ length: N }, (_, i) => ({ path: 'items.' + i + '.value', value: 'new-' + i }));
(async function () {
  let calls = 0, failed;
  try {
    await AA.runAuthoringLoop(draft, '批量修改后暂停', { maxIterations: 4, maxTokens: 1000000, blockingChecks: [], qualityGate: false, caller: function () {
      calls++;
      if (calls === 1) return Promise.resolve({ toolCalls: [{ name: 'multiEdit', input: { edits: edits } }] });
      return Promise.reject(new Error('controlled-pause'));
    } });
  } catch (e) { failed = e; }
  assert(failed && failed.partial && failed.partial.resumeState);
  assert.equal(draft.items.length, N);
  assert(draft.items.every((x, i) => x.value === 'new-' + i));
  const continued = await AA.runAuthoringLoop(draft, '继续未完成部分', { resumeState: failed.partial.resumeState, maxIterations: 2, maxTokens: 1000000, blockingChecks: [], qualityGate: false, caller: () => Promise.resolve({ toolCalls: [{ name: 'finish', input: { summary: '续接完成' } }] }) });
  assert(continued.finished && continued.resumed);
  const diffs = AA.computeDiff(base, draft);
  assert.equal(diffs.length, N);
  const applied = AA.applySelectedDiffs(AA.makeDraft(base), draft, diffs, () => true);
  assert(applied.items.every((x, i) => x.value === 'new-' + i));
  const conflictLive = AA.makeDraft(base); conflictLive.items[700].value = 'human-edit';
  let conflict; try { AA.applySelectedDiffs(conflictLive, draft, diffs, () => true); } catch (e) { conflict = e; }
  assert(conflict && conflict.code === 'edit-conflict');
  assert.equal(conflictLive.items[700].value, 'human-edit');
  assert(draft.items.every((x, i) => x.value === 'new-' + i));
  console.log('[smoke-authoring-ui-recovery] PASS 1,616-edit pause/continue/apply/conflict');
})().catch(e => { console.error(e.stack || e); process.exit(1); });
