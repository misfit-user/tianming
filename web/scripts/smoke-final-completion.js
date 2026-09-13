#!/usr/bin/env node
// smoke-final-completion.js — "剩下的全做" 最终 Pass·锁所有补完功能

'use strict';

const fs = require('fs');
const path = require('path');
const { makeAssert } = require('./smoke-endturn-baseline-helpers');

const ROOT = path.resolve(__dirname, '..');
const passed = { value: 0 };
const assert = makeAssert(passed);

const aiSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai.js'), 'utf8');
const followupSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-followup.js'), 'utf8');
const saveSrc = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const patchesSrc = (fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8'));
const infraSrc = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));

// ─── #1·SC1 增量 retry ───
assert(/function\s+_findMissingSc1Fields/.test(aiSrc), '#1·_findMissingSc1Fields 存在');
assert(/async\s+function\s+_runIncrementalSc1Retry/.test(aiSrc), '#1·_runIncrementalSc1Retry 存在');
assert(/_sc1IncrementalRetried/.test(aiSrc), '#1·防重试循环 (一回合一次)');
assert(/_sc1IncrementalFilled/.test(aiSrc), '#1·成功标记 _sc1IncrementalFilled');
assert(/missing<=3·skip retry/.test(aiSrc) || /missing>3/.test(aiSrc) || /_missing\.length\s*>\s*3/.test(aiSrc),
  '#1·missing>3 才 retry 守 (R-B 误判循环)');

// ─── #2·rename + migration ───
assert(/memorySynthesisEnabled/.test(saveSrc), '#2·memorySynthesisEnabled 字段加入');
assert(/consolidationEnabled[\s\S]{0,200}memorySynthesisEnabled/.test(saveSrc), '#2·老存档 mirror 旧字段到新');
assert(/memorySynthesisEnabled/.test(followupSrc), '#2·sc_consolidate 读新名');

// ─── #3·Phase 7.5 A·9 toggle UI ───
['stream_sc1', 'openaiStrict', 'sc1OwnedBySc1b', 'sc1OwnedBySc1c', 'sc17Skip', 'sc16Lite', 'sc18Lite', 'sc25cEnabled', 'sc15nEnabled', 'sc2Pipeline'].forEach(function(flag) {
  assert(new RegExp('P\\.ai\\.' + flag).test(patchesSrc), '#3·toggle 暴露·P.ai.' + flag);
});
assert(/AI 管线开关 \(高级\)|AI \\u7BA1\\u7EBF\\u5F00\\u5173/.test(patchesSrc), '#3·设置面板加 "AI 管线开关 (高级)" 段');

// ─── #5·Phase 6 Q1-4·全 19 调用扩 schema ───
['_buildSc1dJsonSchema', '_buildSc15JsonSchema', '_buildSc15nJsonSchema', '_buildSc16JsonSchema',
 '_buildSc17JsonSchema', '_buildSc18JsonSchema', '_buildSc2JsonSchema', '_buildSc25JsonSchema',
 '_buildSc25cJsonSchema', '_buildSc27JsonSchema', '_buildSc28JsonSchema'].forEach(function(fn) {
  assert(new RegExp('function\\s+' + fn + '\\s*\\(').test(aiSrc), '#5·' + fn + ' 存在');
});
assert(/_buildGenericArrayObjectSchema/.test(aiSrc), '#5·通用 schema builder helper');

// ─── #9·Failure dashboard·localStorage 持久 ───
assert(/tianming_subcallErrors_history/.test(infraSrc), '#9·subcall errors localStorage 持久化');
assert(/persistedErrorHistory/.test(infraSrc), '#9·导出 payload 含 persistedErrorHistory');

console.log('[smoke-final-completion] pass assertions=' + passed.value);
