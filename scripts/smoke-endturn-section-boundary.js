#!/usr/bin/env node
// smoke-endturn-section-boundary.js - Phase 7 section boundary gate.
// Split-aware after P7-zeta/P7-eta: section 2+3 live in tm-endturn-ai.js,
// section 4 lives in tm-endturn-apply.js, section 5 lives in
// tm-endturn-followup.js, and the final return assembly lives in
// tm-endturn-record.js.

'use strict';

const fs = require('fs');
const path = require('path');
const { ROOT, readSource, readAiInferSource, makeAssert } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

const src = readSource();
const aiInferSrc = readAiInferSource();
const aiInferLines = aiInferSrc.split('\n');
const aiPath = path.join(ROOT, 'tm-endturn-ai.js');
const applyPath = path.join(ROOT, 'tm-endturn-apply.js');
const followupPath = path.join(ROOT, 'tm-endturn-followup.js');

function findLines(text, regex) {
  return text.split('\n').reduce(function(acc, line, idx) {
    if (regex.test(line)) acc.push(idx + 1);
    return acc;
  }, []);
}

const recordPath = path.join(ROOT, 'tm-endturn-record.js');
assert(fs.existsSync(path.join(ROOT, 'tm-endturn-prompt.js')), 'tm-endturn-prompt.js exists');
assert(fs.existsSync(aiPath), 'tm-endturn-ai.js exists');
assert(fs.existsSync(applyPath), 'tm-endturn-apply.js exists');
assert(fs.existsSync(followupPath), 'tm-endturn-followup.js exists');
assert(fs.existsSync(recordPath), 'tm-endturn-record.js exists (P7-eta)');

const aiText = fs.readFileSync(aiPath, 'utf8');
const aiLines = aiText.split('\n');
const applyText = fs.readFileSync(applyPath, 'utf8');
const applyLines = applyText.split('\n');
const followupText = fs.readFileSync(followupPath, 'utf8');
const followupLines = followupText.split('\n');

const sec2 = findLines(aiText, /\u00a72\s*Sub-call\s*/).filter(function(line) { return line > 20; });
const sec3 = findLines(aiText, /\u00a73\s*Sub-calls?\s*sc0/).filter(function(line) { return line > 20; });
assert(sec2.length === 1, 'section 2 marker appears once in tm-endturn-ai.js, count=' + sec2.length);
assert(sec3.length === 1, 'section 3 marker appears once in tm-endturn-ai.js, count=' + sec3.length);
assert(sec2[0] >= 100 && sec2[0] <= 430, 'section 2 marker in ai module near setup bridge, actual L' + sec2[0]);
assert(sec3[0] >= 240 && sec3[0] <= 650, 'section 3 marker in ai module after infra, actual L' + sec3[0]);

const sec5 = findLines(followupText, /\u00a75\s*sc15-sc27\s*/).filter(function(line) { return line > 25; });
const followupRunHead = findLines(followupText, /ns\.run\s*=\s*async\s+function\s*\(ctx\)/);
const sec4 = findLines(applyText, /\u00a74\s*sc1\s*/).filter(function(line) { return line > 25; });
assert(sec4.length === 1, 'section 4 marker appears once in tm-endturn-apply.js, count=' + sec4.length);
assert(sec5.length === 1, 'section 5 marker appears once in tm-endturn-followup.js, count=' + sec5.length);
assert(followupRunHead.length === 1, 'followup run head appears once in tm-endturn-followup.js, count=' + followupRunHead.length);
assert(sec4[0] >= 40 && sec4[0] <= 80, 'section 4 marker in apply module near writeBack head, actual L' + sec4[0]);
// 2026-05-15: followup can grow shared helpers before ns.run.
assert(sec5[0] > followupRunHead[0] && sec5[0] - followupRunHead[0] <= 120,
  'section 5 marker in followup module near run head, actual L' + sec5[0] + ', run L' + followupRunHead[0]);

assert(aiInferLines.length >= 200 && aiInferLines.length <= 280,
  'ai-infer line count after P7-zeta 200-280, actual ' + aiInferLines.length);
assert(aiLines.length >= 2600 && aiLines.length <= 3200,
  'tm-endturn-ai.js line count after P7-delta 2600-3200, actual ' + aiLines.length);
assert(applyLines.length >= 4550 && applyLines.length <= 4850,
  'tm-endturn-apply.js line count after P7-epsilon 4550-4850, actual ' + applyLines.length);
assert(followupLines.length >= 2200 && followupLines.length <= 2750,
  'tm-endturn-followup.js line count after P7-zeta 2200-2750, actual ' + followupLines.length);
assert(/ns\.setupInfra\s*=/.test(aiText), 'tm-endturn-ai.js exposes setupInfra');
assert(/ns\.runMain\s*=/.test(aiText), 'tm-endturn-ai.js exposes runMain');
assert(/TM\.Endturn\.AI\.subcalls\.runMain\s*\(ctx\s*(,\s*async\s+function\s*\(\)\s*\{)?/.test(aiInferSrc), 'ai-infer bridge calls runMain(ctx)');
assert(/ns\.writeBack\s*=/.test(applyText), 'tm-endturn-apply.js exposes writeBack');
assert(/TM\.Endturn\.AI\.apply\.writeBack\s*\(ctx\)/.test(aiInferSrc), 'ai-infer bridge calls apply.writeBack(ctx)');
assert(/ns\.run\s*=/.test(followupText), 'tm-endturn-followup.js exposes run');
assert(/TM\.Endturn\.AI\.followup\.run\s*\(ctx\)/.test(aiInferSrc), 'ai-infer bridge calls followup.run(ctx)');

const recordText = fs.readFileSync(recordPath, 'utf8');
assert(/ns\.finalize\s*=/.test(recordText), 'tm-endturn-record.js exposes finalize');
assert(/return\s+TM\.Endturn\.AI\.record\.finalize\s*\(ctx\)/.test(aiInferSrc), 'ai-infer bridge returns via record.finalize(ctx)');

assert(/global\.TM\.Endturn\.AI\.prompt\.build\s*=/.test(src), 'prompt module still exposes build');

console.log('[smoke-endturn-section-boundary] pass assertions=' + passed.value);
