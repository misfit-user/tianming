#!/usr/bin/env node
/* Offline end-to-end smoke for large Guoshi attachments. No network/API calls. */
'use strict';
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const AA = require(path.join(__dirname, '..', 'editor-authoring-agent.js'));
const uiSource = fs.readFileSync(path.join(__dirname, '..', 'editor-authoring-agent-ui.js'), 'utf8');
assert(!/String\(rt\.result\s*\|\|\s*''\)\.slice\(0,\s*12000\)/.test(uiSource), 'UI must retain complete FileReader text');
assert(/附件仍在读取/.test(uiSource) && /attachments:\s*_textAttachments/.test(uiSource), 'UI must block pending reads and pass attachments to every mode');

class FakeReader {
  readAsText(file) { setTimeout(() => { this.result = file.__text; if (this.onload) this.onload(); if (this.onloadend) this.onloadend(); }, 10); }
  readAsDataURL(file) { setTimeout(() => { this.result = 'data:' + file.type + ';base64,fixture'; if (this.onload) this.onload(); if (this.onloadend) this.onloadend(); }, 10); }
}
const uiContext = { console, JSON, Math, Date, Promise, Object, Set, WeakMap, FileReader: FakeReader, setTimeout, clearTimeout,
  document: { readyState: 'loading', addEventListener() {}, getElementById() { return null; } },
  localStorage: { getItem() { return null; }, setItem() {}, removeItem() {} }, TM: { AuthoringAgent: AA } };
uiContext.window = uiContext; uiContext.globalThis = uiContext;
vm.runInNewContext(uiSource, uiContext, { filename: 'editor-authoring-agent-ui.js' });
const UI = uiContext.TM_AuthoringAgentUI;
assert(UI && UI._ui && typeof UI.attachIngest === 'function', 'UI attachment bridge loads in an offline browser context');

const filler = Array.from({ length: 70000 }, (_, i) => i % 10 === 0 ? '"needle-' + i + '"' : '"padding"').join(',');
const raw = '{"name":"官方大档","meta":{"marker":"keep-me"},"map":{"regions":[{"id":"r0","name":"甲"}],"tail":{"value":42}},"payload":[' + filler + ']}';
assert(raw.length > 300 * 1024, 'fixture must exceed 300KB');
const attachments = [{ name: 'official-large.json', text: raw }];
const runCtx = { attachments };
const draft = { name: '草稿', map: { regions: [] } };

const page = AA.dispatchTool(draft, 'readAttachment', { name: attachments[0].name, offset: raw.length - 100, limit: 200 }, null, runCtx);
assert(page.ok && page.done && page.totalChars === raw.length, 'large attachment is retained and paginates to EOF');
const hits = AA.dispatchTool(draft, 'searchAttachment', { name: attachments[0].name, query: 'needle', limit: 3 }, null, runCtx);
assert(hits.ok && hits.hits.length === 3 && hits.hits[0].offset > 0, 'attachment search scans full text with offsets');
const json = AA.dispatchTool(draft, 'readAttachmentJson', { name: attachments[0].name, path: 'map.tail.value' }, null, runCtx);
assert(json.ok && json.value === 42, 'JSON path reader lazily reads a nested field');
const applied = AA.dispatchTool(draft, 'applyAttachmentField', { name: attachments[0].name, attachmentPath: 'meta.marker', draftPath: 'name' }, null, runCtx);
assert(applied.ok && draft.name === 'keep-me', 'explicit attachment field application writes only requested field');

const fileForReader = { name: 'reader-large.json', type: 'application/json', size: raw.length, __text: raw };
UI.attachIngest([fileForReader]);
assert.equal(UI._ui._att.pending, 1, 'send chain sees FileReader pending before async load finishes');
setTimeout(function () {
  assert.equal(UI._ui._att.pending, 0, 'FileReader pending counter drains after load');
  assert.equal(UI._ui._att.files[0].text.length, raw.length, 'real FileReader path retains complete attachment body');
}, 20);

const huge90 = '{"meta":{"tail":{"value":"末字段"}},"payload":"' + 'x'.repeat(90 * 1024 * 1024) + '"}';
assert(huge90.length >= 90 * 1024 * 1024, '90MB official-sized fixture must exceed 90MB');
const hugeFile = [{ name: 'official-90mb.json', text: huge90 }];
const tail = AA.dispatchTool({}, 'readAttachmentJson', { name: 'official-90mb.json', path: 'meta.tail.value' }, null, { attachments: hugeFile });
assert(tail.ok && tail.value === '末字段', '90MB JSON parses and reads a field after the large payload');

let round = 0;
const first = AA.runAuthoringLoop({ name: 'x' }, '读取大附件', {
  attachments,
  noMemoryRecall: true,
  maxIterations: 1,
  caller: function () { round++; return Promise.resolve({ toolCalls: [{ name: 'readAttachmentJson', input: { name: 'official-large.json', path: 'map.tail.value' } }] }); }
});
first.then(function (result) {
  assert(result.resumeState, 'unfinished run exposes resumable state');
  let resumedRound = 0;
  return AA.runAuthoringLoop(result.draft, '继续处理附件', {
    resumeState: result.resumeState,
    noMemoryRecall: true,
    caller: function () {
      resumedRound++;
      return Promise.resolve({ toolCalls: [{ name: 'readAttachment', input: { name: 'official-large.json', offset: raw.length - 40, limit: 40 } }] });
    }
  }).then(function (continued) {
    const tr = continued.transcript.find(t => t.name === 'readAttachment');
    assert(tr && tr.result.ok && tr.result.content.length > 0, 'continued run retains attachment body without re-upload');
    const beforeApply = { name: 'before' }, changed = AA.makeDraft(beforeApply);
    const sourceApplied = AA.dispatchTool(changed, 'applyAttachmentField', { name: 'official-large.json', attachmentPath: 'meta.marker', draftPath: 'name' }, null, runCtx);
    const diffs = AA.computeDiff(beforeApply, changed);
    const live = AA.makeDraft(beforeApply);
    const selected = AA.applySelectedDiffs(live, changed, diffs, function () { return true; });
    assert(sourceApplied.ok && selected && selected.name === 'keep-me', 'attachment field survives diff preview and selected apply');
    console.log('[smoke-authoring-agent-attachments] pass');
  });
}).catch(function (e) { console.error(e.stack || e); process.exit(1); });
