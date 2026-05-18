#!/usr/bin/env node
// smoke-endturn-public-contract.js - Phase 7 public contract.
// Split-aware after P7-gamma/P7-delta/P7-epsilon/P7-zeta/P7-eta: prompt, AI subcalls,
// apply, follow-up, and record may live outside tm-endturn-ai-infer.js, but the public
// entrypoint remains unchanged.

'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, readSource, readAiInferSource, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

const src = readSource();
const aiInferSrc = readAiInferSource();
const aiInferLines = aiInferSrc.split('\n');

// [slice 3c.1·2026-05-07] 放宽允许可选 externalCtx 第 5 参数·4 参数调用仍合法
assert(/^async\s+function\s+_endTurn_aiInfer\s*\(\s*edicts\s*,\s*xinglu\s*,\s*memRes\s*,\s*oldVars(?:\s*,\s*externalCtx)?\s*\)/m.test(aiInferSrc),
  'public signature: async function _endTurn_aiInfer(edicts, xinglu, memRes, oldVars [, externalCtx])');

const fnLines = aiInferLines.reduce(function(acc, line, idx) {
  if (/^async\s+function\s+_endTurn_aiInfer\s*\(/.test(line)) acc.push(idx + 1);
  return acc;
}, []);
assert(fnLines.length === 1, '_endTurn_aiInfer has one declaration, count=' + fnLines.length);
assert(fnLines[0] >= 17 && fnLines[0] <= 30, '_endTurn_aiInfer stays near file head, actual L' + fnLines[0]);

['\u00a71', '\u00a72', '\u00a73', '\u00a74', '\u00a75'].forEach(function(section) {
  assert(src.indexOf('//   ' + section + ' [L') >= 0 || src.indexOf('// ' + section + ' [L') >= 0,
    'R147 head note keeps ' + section + ' navigation marker');
});

assert(/global\.TM\.Endturn\.AI\.prompt\.build\s*=/.test(src), 'prompt module exposes TM.Endturn.AI.prompt.build');
assert(/TM\.Endturn\.AI\.subcalls\.setupInfra\s*\(ctx\)/.test(aiInferSrc), 'ai-infer calls subcalls.setupInfra(ctx)');
assert(/TM\.Endturn\.AI\.subcalls\.runMain\s*\(ctx\s*(,\s*async\s+function\s*\(\)\s*\{)?/.test(aiInferSrc), 'ai-infer awaits subcalls.runMain(ctx)');
assert(/TM\.Endturn\.AI\.apply\.writeBack\s*\(ctx\)/.test(aiInferSrc), 'ai-infer calls apply.writeBack(ctx) inside afterSc1');
assert(/TM\.Endturn\.AI\.followup\.run\s*\(ctx\)/.test(aiInferSrc), 'ai-infer calls followup.run(ctx) after sc1 callback close');
assert(/return\s+TM\.Endturn\.AI\.record\.finalize\s*\(ctx\)/.test(aiInferSrc), 'ai-infer returns via record.finalize(ctx) (P7-eta)');
assert(/ns\.setupInfra\s*=\s*function\s*\(ctx\)/.test(src), 'tm-endturn-ai.js exposes setupInfra(ctx)');
assert(/ns\.runMain\s*=\s*async\s+function\s*\(ctx\s*(,\s*afterSc1)?\)/.test(src), 'tm-endturn-ai.js exposes runMain(ctx)');
assert(/ns\.writeBack\s*=\s*async\s+function\s*\(ctx\)/.test(src), 'tm-endturn-apply.js exposes writeBack(ctx)');
assert(/ns\.run\s*=\s*async\s+function\s*\(ctx\)/.test(src), 'tm-endturn-followup.js exposes run(ctx)');
assert(/ns\.finalize\s*=\s*function\s*\(ctx\)/.test(src), 'tm-endturn-record.js exposes finalize(ctx)');

assert(/\u00a71\s*.*sysP\s*prompt/.test(src), 'section 1 body marker exists in prompt family');
assert(/\u00a72\s*Sub-call\s*/.test(src), 'section 2 body marker exists in AI family');
assert(/\u00a73\s*Sub-calls?\s*sc0/.test(src), 'section 3 body marker exists in AI family');
assert(/\u00a74\s*sc1\s*/.test(src), 'section 4 body marker exists in apply family');
assert(/\u00a75\s*sc15-sc27\s*/.test(src), 'section 5 body marker exists in followup family');
assert(!/\u00a75\s*sc15-sc27\s*/.test(aiInferSrc), 'section 5 body marker moved out of ai-infer');

const returnMatches = src.match(/return\s*\{[\s\S]*?shiluText[\s\S]*?szjTitle[\s\S]*?szjSummary[\s\S]*?personnelChanges[\s\S]*?hourenXishuo[\s\S]*?\}/);
assert(returnMatches !== null, 'return object keeps record fields shiluText/szjTitle/szjSummary/personnelChanges/hourenXishuo');

const followupModulePath = path.join(ROOT, 'tm-endturn-followup.js');
assert(fs.existsSync(followupModulePath), 'tm-endturn-followup.js exists');
const followupModuleText = fs.readFileSync(followupModulePath, 'utf8');
const followupModuleLines = followupModuleText.split('\n');
const runHeadInFollowup = followupModuleLines.findIndex(function(line) { return /ns\.run\s*=\s*async\s+function\s*\(ctx\)/.test(line); }) + 1;
const sec5InFollowup = followupModuleLines.findIndex(function(line) { return /\u00a75\s*sc15-sc27\s*/.test(line); }) + 1;
assert(runHeadInFollowup > 0, 'followup ns.run marker exists');
assert(sec5InFollowup > 0, 'section 5 marker remains in followup module');
// 2026-05-15: followup can grow shared helpers before ns.run.
// Keep the marker close to the run head, while behavior/topology is locked by smoke-endturn-followup.
assert(sec5InFollowup > runHeadInFollowup && sec5InFollowup - runHeadInFollowup <= 120,
  'section 5 marker near followup run head, actual L' + sec5InFollowup + ', run L' + runHeadInFollowup);

assert(aiInferLines.length >= 200 && aiInferLines.length <= 280,
  'ai-infer line count after P7-zeta is 200-280, actual ' + aiInferLines.length);

const aiModulePath = path.join(ROOT, 'tm-endturn-ai.js');
assert(fs.existsSync(aiModulePath), 'tm-endturn-ai.js exists');
const aiModuleLines = fs.readFileSync(aiModulePath, 'utf8').split('\n').length;
assert(aiModuleLines >= 2600 && aiModuleLines <= 3200, 'tm-endturn-ai.js line count 2600-3200, actual ' + aiModuleLines);

const applyModulePath = path.join(ROOT, 'tm-endturn-apply.js');
assert(fs.existsSync(applyModulePath), 'tm-endturn-apply.js exists');
const applyModuleLines = fs.readFileSync(applyModulePath, 'utf8').split('\n').length;
assert(applyModuleLines >= 4550 && applyModuleLines <= 4850, 'tm-endturn-apply.js line count 4550-4850, actual ' + applyModuleLines);
assert(followupModuleLines.length >= 2200 && followupModuleLines.length <= 2750,
  'tm-endturn-followup.js line count 2200-2750, actual ' + followupModuleLines.length);

// P7-eta·tm-endturn-record.js: 文件存在·finalize export·sanitize 留 ai-infer·suggestions 优先 ctx.record
const recordModulePath = path.join(ROOT, 'tm-endturn-record.js');
assert(fs.existsSync(recordModulePath), 'tm-endturn-record.js exists (P7-eta)');
const recordModuleText = fs.readFileSync(recordModulePath, 'utf8');
const recordModuleLines = recordModuleText.split('\n');
assert(recordModuleLines.length >= 30 && recordModuleLines.length <= 100,
  'tm-endturn-record.js line count 30-100, actual ' + recordModuleLines.length);
assert(/ns\.finalize\s*=\s*function\s*\(ctx\)/.test(recordModuleText), 'record module exposes finalize(ctx)');
assert(/_stripHtmlResidue/.test(aiInferSrc), 'sanitize (_stripHtmlResidue) stays in ai-infer (not record)');
assert(!/_stripHtmlResidue/.test(recordModuleText), 'record module does NOT contain _stripHtmlResidue (sanitize is main-entry)');
assert(!/p2\s*&&\s*p2\.suggestions/.test(recordModuleText), 'record module does NOT use direct (p2 && p2.suggestions) - prefer ctx.record.suggestions');
assert(/record\.suggestions/.test(recordModuleText), 'record module reads ctx.record.suggestions (P7-zeta writeback path)');

console.log('[smoke-endturn-public-contract] pass assertions=' + passed.value);
