#!/usr/bin/env node
// smoke-endturn-error-path.js — Phase 7 P7-β baseline·7/21
// 锁 error / truncate / partial-result 路径·拆分时不可破坏 fail-soft 行为

'use strict';

const { readSource, makeAssert, countMatches } = require('./smoke-endturn-baseline-helpers');

const passed = { value: 0 };
const assert = makeAssert(passed);

const src = readSource();

// ─── try-catch 数量·fail-soft 设计 ───
const tryCount = countMatches(/\btry\s*\{/g);
const catchCount = countMatches(/\bcatch\s*\(/g);
assert(tryCount >= 50, 'try { count >= 50·fail-soft 多处·实际 ' + tryCount);
assert(catchCount >= 50, 'catch ( count >= 50·实际 ' + catchCount);
assert(Math.abs(tryCount - catchCount) <= 5, 'try / catch count balance·diff <= 5');

// ─── TM.errors.capture / captureSilent·错误统一 channel ───
assert(src.indexOf('TM.errors.captureSilent') >= 0,
  'TM.errors.captureSilent·静默捕获 channel');
assert(src.indexOf('TM.errors.capture') >= 0,
  'TM.errors.capture·捕获 channel');

// ─── _truncatedOnce·truncate flag ───
assert(src.indexOf('_truncatedOnce = false') >= 0, '_truncatedOnce 初值 false');
assert(src.indexOf('_truncatedOnce = true') >= 0, '_truncatedOnce 触发·true 赋值 (跨 phase 一次)');

// ─── _checkTruncated·detect helper ───
assert(/function\s+_checkTruncated/.test(src), '_checkTruncated 函数定义');
assert(src.indexOf("finish_reason") >= 0, '_checkTruncated 检 finish_reason 字段');
assert(src.indexOf('async function _parseOrRepairJsonResult') >= 0,
  '_parseOrRepairJsonResult exists for truncated/invalid JSON repair');
assert(src.indexOf('Repair this end-turn JSON result') >= 0 &&
       src.indexOf('do not invent new deaths, resource changes, battles, or stat changes') >= 0,
  'JSON repair prompt preserves facts and forbids new numeric/fatal changes');
assert(src.indexOf('_jsonRepairs') >= 0 && src.indexOf('_jsonRepairFailures') >= 0,
  'JSON repair success/failure diagnostics recorded');
assert(src.indexOf('function _buildSc1EmergencyFallback') >= 0,
  'SC1 has emergency structured fallback builder');
assert(src.indexOf('SC1/SC1b/SC1c 均无有效数据') >= 0 &&
       src.indexOf('_emergencyFallback') >= 0,
  'SC1 empty result can degrade to a commit-safe emergency ledger');
assert(src.indexOf('critical call failed·will continue to fallback chain') >= 0,
  'SC1 critical call failure remains inside fallback chain instead of aborting the subcall body');
assert(src.indexOf('AI请求超时或被浏览器中断') >= 0 && src.indexOf('ABORT') >= 0,
  'AbortSignal errors are normalized before user-facing AI failure toasts');
assert(src.indexOf('function _normalizeParsedJsonForExpected') >= 0 &&
       src.indexOf('_jsonNormalizations') >= 0,
  'malformed-but-useful AI JSON is normalized before expected-key validation');
assert(src.indexOf("copy('shizhengji'") >= 0 &&
       src.indexOf("copy('resource_changes'") >= 0 &&
       src.indexOf("copy('char_updates'") >= 0,
  'SC1 parser accepts common alias fields for core structured output');

// ─── partial-result handling·sub-call 失败仍尝试后续 ───
// _runSubcall 内应有 try-catch·sub-call 失败不阻塞 pipeline
const runSubcallBlock = src.match(/async\s+function\s+_runSubcall[\s\S]{0,3000}/);
assert(runSubcallBlock !== null, '_runSubcall 函数 body 提取');
if (runSubcallBlock) {
  const block = runSubcallBlock[0];
  assert(/try\s*\{/.test(block) && /catch\s*\(/.test(block),
    '_runSubcall 内含 try-catch (sub-call fail-soft)');
}

// ─── toast 用户提示·错误用户可见 ───
assert(src.indexOf("typeof toast === 'function'") >= 0 || src.indexOf("typeof toast === \"function\"") >= 0,
  'toast 调用·typeof check (UI 不存在时 silent)');

// ─── retry / retries 字段·sub-call 重试 ───
// (可能在 ctx.meta.retries 或 sub-call 内·允许 missing·只 require 至少 1 处 retry related)
const retryCount = countMatches(/retr(y|ies)/gi);
assert(retryCount >= 5, 'retry / retries 提及 >= 5·实际 ' + retryCount);

console.log('[smoke-endturn-error-path] pass assertions=' + passed.value);
