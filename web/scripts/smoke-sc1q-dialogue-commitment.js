#!/usr/bin/env node
// smoke-sc1q-dialogue-commitment.js — Phase 2.5·sc1q 对话承诺推演 锚
// 用·锁定 sc1q 子调用 + 并行 sc0 + apply 闭环 + 覆盖率检查 不被回退

'use strict';

const fs = require('fs');
const path = require('path');
const { readSource, makeAssert } = require('./smoke-endturn-baseline-helpers');

const ROOT = path.resolve(__dirname, '..');
const passed = { value: 0 };
const assert = makeAssert(passed);

const src = readSource();
const schemaSrc = fs.readFileSync(path.join(ROOT, 'tm-ai-schema.js'), 'utf8');
const validatorSrc = fs.readFileSync(path.join(ROOT, 'tm-ai-output-validator.js'), 'utf8');
const applySrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
const orderSrc = fs.readFileSync(path.join(ROOT, 'tm-imperial-orders.js'), 'utf8');
assert(applySrc.includes('TM.ImperialOrders.fromDialogue(GM,'), 'apply delegates dialogue feedback to the source-bound order owner');

// ─── Slice A·schema + validator + registry ───
assert(/dialogue_commitment_feedback:\s*\{\s*type:\s*'array'/.test(schemaSrc),
  'Slice A·tm-ai-schema.js·dialogue_commitment_feedback 字段定义');
assert(/_applyDialogueCommitmentFeedback/.test(schemaSrc),
  'Slice A·schema consumedBy 标 _applyDialogueCommitmentFeedback');
assert(/dialogue_commitment_feedback:\s*'array'/.test(validatorSrc),
  'Slice A·tm-ai-output-validator.js 加 fallback');
assert(/id:'sc1q',\s*name:'对话承诺推演'/.test(src),
  'Slice A·_subcallMeta 加 sc1q entry (minDepth:lite·order:2)');
assert(/sc1q:_p\('normal',60000/.test(src),
  'Slice A·CALL_POLICIES 加 sc1q 策略 (60s timeout)');

// ─── Slice B·sc1q 子调用并行 sc0 ───
assert(/var _sc0P = _runSubcall\('sc0'/.test(src),
  'Slice B·sc0 改并行 Promise (var _sc0P)');
assert(/var _sc1qP = _runSubcall\('sc1q'/.test(src),
  'Slice B·sc1q 子调用 IIFE (var _sc1qP)');
assert(/Promise\.all\(\[_sc0P, _sc1qP\]\)/.test(src),
  'Slice B·sc0 + sc1q Promise.all 并行 await');

// 6 GM 输入字段 grep (Round 2 已核实真实存在)
['GM.jishiRecords', 'GM._courtRecords', 'GM._secretMeetings', 'GM._npcCommitments', 'GM.letters', 'GM._approvedMemorials'].forEach(function(f) {
  // 兼容 `if (GM.jishiRecords)` / `GM.jishiRecords)` 等读法
  var marker = f.replace('.', '\\.');
  assert(new RegExp(marker).test(src), 'Slice B·sc1q reads ' + f);
});

// 4 输出字段 in prompt
['dialogue_commitments', 'collective_resolutions', 'npc_dialogue_intent', 'required_sc1_actions'].forEach(function(f) {
  assert(src.indexOf('"' + f + '"') >= 0, 'Slice B·sc1q output schema·"' + f + '"');
});

// ─── Slice C·SC1 prompt 注入 sc1q ───
assert(/本回合对话承诺·sc1q 推演输出/.test(src),
  'Slice C·SC1 prompt 注入 dialogue_commitments 段');
assert(/朝议\/常朝\/廷议 决议·sc1q 推演输出/.test(src),
  'Slice C·SC1 prompt 注入 collective_resolutions 段');
assert(/sc1q 硬性要求/.test(src),
  'Slice C·SC1 prompt LSR 注入 required_sc1_actions');

// ─── Slice D·apply 闭环 + dedup ───
assert(/p1\.dialogue_commitment_feedback/.test(applySrc),
  'Slice D·apply 消费 dialogue_commitment_feedback');
assert(/_sc1qSourceConvId/.test(orderSrc),
  'Slice D·sc1q 专属前缀字段 _sc1qSourceConvId');
assert(/_sc1qSource\b/.test(orderSrc) && /_sc1qTarget\b/.test(orderSrc) && /_sc1qPlayerEmphasis/.test(orderSrc),
  'Slice D·全 4 个 _sc1q* 前缀字段·避免与 wendui 冲突');
assert(/dialogue_commitment_feedback\] applied/.test(applySrc),
  'Slice D·apply 日志·便于调试');

// ─── Slice E·sc_audit 覆盖率检查 ───
assert(/sc1q coverage/.test(src),
  'Slice E·sc1q 覆盖率检查·log 出现');
assert(/GM\._sc1qMissedLastTurn/.test(src),
  'Slice E·GM._sc1qMissedLastTurn 记下回合优先');

// ─── B 分离·dialogue_commitment_feedback 与 commitment_update 独立 ───
assert(applySrc.includes('TM.ImperialOrders.updates(GM, p1.commitment_update)') && applySrc.includes('TM.ImperialOrders.fromDialogue(GM,'),
  '保留独立·dialogue_commitment_feedback 与 commitment_update 不混 (user 选 B)');

console.log('[smoke-sc1q-dialogue-commitment] pass assertions=' + passed.value);
