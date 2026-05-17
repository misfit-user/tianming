#!/usr/bin/env node
// smoke-endturn-callai.js — Phase 7 P7-β baseline·9/21
// 锁 callAI / callAIMessages / callAIMessagesStream / callAIWithTools 调用 pattern
// 拆分时·sub-call 内部 LLM 调用 API 必保

'use strict';

const { readSource, makeAssert, countMatches } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

const src = readSource();

// ─── 4 种 callAI 风格·拆分时不可改 ───
const callAIVariants = {
  'callAI': /\bawait\s+callAI\s*\(/,
  'callAIMessages': /\bawait\s+callAIMessages\s*\(/,
  'callAIMessagesStream': /\bawait\s+callAIMessagesStream\s*\(/,
  'callAIWithTools': /\bawait\s+callAIWithTools\s*\(/
};

Object.keys(callAIVariants).forEach(function(variant) {
  const matches = src.match(callAIVariants[variant]);
  assert(matches !== null && matches.length >= 1,
    'callAI variant·' + variant + ' 至少 1 处·count=' + (matches ? matches.length : 0));
});

// ─── tier 字段·LLM 调用 tier hint (low/secondary/standard) ───
[
  "'tier-low'",
  "'secondary'"
].forEach(function(tier) {
  assert(src.indexOf(tier) >= 0, 'callAI tier·"' + tier + '"');
});

// ─── _sc1Body / _callABody / _reconcileTools·callAI body 构建 ───
[
  '_sc1Body',
  '_callABody',
  '_reconcileTools',
  '_reconcilePrompt'
].forEach(function(token) {
  assert(src.indexOf(token) >= 0, 'callAI body var·"' + token + '"');
});

// ─── tool_call·structured output 设计 ───
assert(src.indexOf('tool_call') >= 0,
  'tool_call·structured output 锁 narrative/JSON 一致 (Wave 2 设计)');

// ─── max_tokens·body 字段 ───
assert(src.indexOf('max_tokens') >= 0, 'max_tokens body 字段');
assert(src.indexOf('_sc0Body.response_format') >= 0,
  'sc0 OpenAI response_format json_object is set');
assert(src.indexOf("callAIMessages(_callABody.messages, _callABody.max_tokens !== undefined ? _callABody.max_tokens : 1200") >= 0,
  'SC1 Call A compression does not fall back to callAIMessages 500-token default');
assert(src.indexOf("callAIMessagesStream(_sc1Body.messages, _sc1Body.max_tokens !== undefined ? _sc1Body.max_tokens : _sc1BaseTok") >= 0,
  'SC1 stream uses business output budget when max_tokens is omitted');
assert(src.indexOf('timeoutMs: opts.timeoutMs') >= 0,
  '_callEndturnAI forwards timeoutMs to _aiFetchWithRetry when configured');
assert(src.indexOf('maxRetries: opts.maxRetries') >= 0,
  '_callEndturnAI forwards maxRetries to _aiFetchWithRetry when configured');

// ─── 总 callAI 调用次数·至少 4 处 (sub-call 各发起 LLM 调用) ───
const totalAI = countMatches(/\bawait\s+callAI/g);
assert(totalAI >= 4, '总 await callAI 调用 >= 4·实际 ' + totalAI);

// ─── _buildFetchBody 应被 sub-call 用 ───
const buildFetchUses = countMatches(/_buildFetchBody\s*\(/g);
assert(buildFetchUses >= 1,
  '_buildFetchBody 调用 >= 1·实际 ' + buildFetchUses);

console.log('[smoke-endturn-callai] pass assertions=' + passed.value);
