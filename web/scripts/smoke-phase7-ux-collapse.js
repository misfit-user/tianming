#!/usr/bin/env node
// smoke-phase7-ux-collapse.js — Phase 7 + 7.5·UX 收口 + 设置面板 6 决定 锚

'use strict';

const fs = require('fs');
const path = require('path');
const { makeAssert } = require('./smoke-endturn-baseline-helpers');

const ROOT = path.resolve(__dirname, '..');
const passed = { value: 0 };
const assert = makeAssert(passed);

const infraSrc = (fs.readFileSync(path.join(ROOT, 'tm-ai-infra-retry.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-ai-infra.js'), 'utf8'));
const recordSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-record.js'), 'utf8');
const saveSrc = fs.readFileSync(path.join(ROOT, 'tm-save-lifecycle.js'), 'utf8');
const patchesSrc = (fs.readFileSync(path.join(ROOT, 'tm-patches.js'), 'utf8') + '\n' + fs.readFileSync(path.join(ROOT, 'tm-patches-start.js'), 'utf8'));

// ─── Phase 7 Slice A·_costHistory hook ───
assert(/_captureCostHistorySnapshot/.test(recordSrc),
  'Phase 7·_captureCostHistorySnapshot 函数');
assert(/GM\._costHistory\.push/.test(recordSrc),
  'Phase 7·每回合末写入 _costHistory');
assert(/_costHistory\.length\s*>\s*20[\s\S]*?slice\(-20\)/.test(recordSrc),
  'Phase 7·_costHistory 容量保护·最近 20 回合');
assert(/_captureCostHistorySnapshot\(\);[\s\S]{0,200}ns\.finalize/.test(recordSrc) || /ns\.finalize\s*=\s*function\(ctx\)\s*\{\s*_captureCostHistorySnapshot/.test(recordSrc),
  'Phase 7·finalize 触发 capture');

// ─── Phase 7 Slice B·诊断 export ───
assert(/function\s+exportAIDiagnosticsJSON/.test(infraSrc),
  'Phase 7·exportAIDiagnosticsJSON 函数');
assert(/exportDiagnostics:/.test(infraSrc),
  'Phase 7·TM.ai.exportDiagnostics 公开 API');
assert(/recordSubcallError:/.test(infraSrc),
  'Phase 7·TM.ai.recordSubcallError 公开 API');
assert(/openaiStrict:\s*P\.ai\.openaiStrict/.test(infraSrc),
  'Phase 7·export payload 含所有 P.ai opt-in flag');

// ─── Phase 7.5 Slice C·D1·删 showRelation zombie ───
// 注·tm-patches.js 含 \uXXXX 转义·所以源中 "Phase 7.5 D1·..." 显示为 \u 转义形式
assert(/Phase 7\.5 D1/.test(patchesSrc) && /showRelation zombie/.test(patchesSrc),
  'Phase 7.5 D1·zombie toggle 已删 marker');
assert(!/onchange=\\"P\.conf\.showRelation=this\.checked\\"/.test(patchesSrc),
  'Phase 7.5 D1·UI toggle HTML 真删 (源中不再 generate)');

// ─── Phase 7.5 Slice D·6 决定 defaults ───
assert(/dialogueRecallTurns\s*!==\s*'number'.*=\s*3/.test(saveSrc),
  'Phase 7.5 D3·dialogueRecallTurns default=3');
assert(/costAlertThreshold\s*!==\s*'number'.*=\s*0\.5/.test(saveSrc),
  'Phase 7.5 D5·costAlertThreshold default=0.5');
assert(/strictSchemaEnabled\s*!==\s*'boolean'/.test(saveSrc),
  'Phase 7.5 D4·strictSchemaEnabled default=false (boolean)');

console.log('[smoke-phase7-ux-collapse] pass assertions=' + passed.value);
