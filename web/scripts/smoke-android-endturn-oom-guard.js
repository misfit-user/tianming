#!/usr/bin/env node
/* eslint-env node */
/*
 * smoke-android-endturn-oom-guard.js
 * 2026-06-11·安卓过回合闪退护栏(诊断:第三方中转无 CORS→CapacitorHttp 原生路整段 materialize→
 * 小堆上多并发 OOM 闪退)。三处护栏:
 *   ① _runSubcallBatch：安卓默认串行(并发 1)·峰值÷并发数·玩家显式 aiSubcallConcurrency 仍尊重。
 *   ② _callEndturnAI：安卓 _RAW_CAP 收紧到 ~384KB + 本回合首个超大响应 toast 告知。
 *   ③ robustParseJSON：安卓 MAX_PARSE_LEN 收紧到 ~256KB。
 * 测：源码契约 + 平台探测表达式在三种 mock 全局下的行为(capacitor via TM.platform / via Capacitor 回退 / 桌面)。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const endturnAi = fs.readFileSync(path.join(ROOT, 'tm-endturn-ai.js'), 'utf8');
const aiInfraJson = fs.readFileSync(path.join(ROOT, 'tm-ai-infra-json.js'), 'utf8');

let passed = 0;
function assert(cond, msg) {
  if (!cond) throw new Error('FAIL: ' + msg);
  passed += 1;
}

function slice(src, startNeedle, endNeedle) {
  const s = src.indexOf(startNeedle);
  assert(s >= 0, 'anchor missing: ' + startNeedle);
  const e = endNeedle ? src.indexOf(endNeedle, s + startNeedle.length) : -1;
  return src.slice(s, e >= 0 ? e : s + 4000);
}

// ── ① _runSubcallBatch 安卓串行 ──────────────────────────────────────────────
const batch = slice(endturnAi, 'async function _runSubcallBatch(label, tasks, limit)', 'async function _runSubcall ');
assert(/_confLimit\s*>\s*0\s*\?\s*_confLimit\s*:\s*\(_isCap\s*\?\s*1\s*:/.test(batch.replace(/\s+/g, ' ')),
  '_runSubcallBatch 须:玩家显式并发优先·否则安卓=1·桌面=limit||3');
assert(/TM\.platform\.kind\s*===\s*'capacitor'/.test(batch), '_runSubcallBatch 须用 TM.platform.kind 判 capacitor');
assert(/Capacitor\.isNativePlatform/.test(batch), '_runSubcallBatch 平台探测须有 Capacitor.isNativePlatform 回退');

// ── ② _callEndturnAI 源头封顶安卓收紧 + toast ────────────────────────────────
const cap = slice(endturnAi, 'var _RAW_CAP =', 'catch(_capE)');
assert(/_capIsCap\s*\?\s*393216\s*:\s*1000000/.test(cap), '_RAW_CAP 须安卓 384KB(393216)·桌面 1MB(1000000)');
assert(/_oversizedResponses\.length\s*===\s*1/.test(cap), '安卓 toast 须仅本回合首个超大响应触发(不刷屏)');
assert(cap.indexOf('if (_capIsCap &&') >= 0, 'toast 须 gated on 安卓(_capIsCap)');
assert(/已拦截防闪退/.test(cap), 'toast 文案须说明已拦截防闪退');

// ── ③ robustParseJSON 解析上限安卓收紧 ───────────────────────────────────────
const rpj = slice(aiInfraJson, 'function robustParseJSON(raw)', 'Layer 1');
assert(/MAX_PARSE_LEN\s*=\s*_rpjIsCap\s*\?\s*262144\s*:\s*500000/.test(rpj), 'MAX_PARSE_LEN 须安卓 256KB(262144)·桌面 500KB(500000)');
assert(/window\.TM\s*&&\s*window\.TM\.platform/.test(rpj), 'robustParseJSON 平台探测须经 window.TM.platform 并防 window 未定义');

// ── 平台探测表达式行为校验(从源码抽出 IIFE·在三种 mock 全局下 eval)────────────
// 抽 _runSubcallBatch 里的 _isCap = (function(){...})();
const isCapMatch = batch.match(/var _isCap = (\(function\(\)\{[\s\S]*?\}\)\(\));/);
assert(isCapMatch, '抽不到 _runSubcallBatch 的 _isCap IIFE');
const isCapExpr = isCapMatch[1];

// 浏览器里 window === globalThis 且 TM/Capacitor 是其属性(裸 TM ≡ window.TM)。
// 用自引用全局对象还原此语义:g.window = g，再挂 TM/Capacitor。
function evalDetect(expr, props) {
  const g = {};
  g.window = g;
  if (props) Object.assign(g, props);
  const ctx = vm.createContext(g);
  return vm.runInContext('(' + expr + ')', ctx);
}
// (a) capacitor·走 TM.platform.kind
assert(evalDetect(isCapExpr, { TM: { platform: { kind: 'capacitor' } } }) === true,
  '探测:TM.platform.kind=capacitor → true');
// (b) electron·走 TM.platform.kind
assert(evalDetect(isCapExpr, { TM: { platform: { kind: 'electron' } } }) === false,
  '探测:TM.platform.kind=electron → false');
// (c) 无 TM.platform·回退 Capacitor.isNativePlatform()=true
assert(evalDetect(isCapExpr, { Capacitor: { isNativePlatform: function () { return true; } } }) === true,
  '探测:无 TM.platform·Capacitor.isNativePlatform()=true → true');
// (d) 啥都没有 → false(桌面/web 不误判)
assert(evalDetect(isCapExpr, {}) === false, '探测:无 TM 无 Capacitor → false');
// (e) window 本身 undefined 不抛(robustParseJSON 跑在可能无 window 的 node 环境)
const rpjIsCapMatch = rpj.match(/var _rpjIsCap = (\(function\(\)\{[\s\S]*?\}\)\(\));/);
assert(rpjIsCapMatch, '抽不到 robustParseJSON 的 _rpjIsCap IIFE');
const ctxNoWindow = vm.createContext({}); // 无 window·靠 typeof window 守卫
assert(vm.runInContext('(' + rpjIsCapMatch[1] + ')', ctxNoWindow) === false,
  'robustParseJSON 探测:window undefined → false(不抛)');
// rpj 探测在 capacitor 下也须为 true
assert(evalDetect(rpjIsCapMatch[1], { TM: { platform: { kind: 'capacitor' } } }) === true,
  'robustParseJSON 探测:capacitor → true');

// ── 旧桌面行为不破:桌面阈值/默认并发 3 仍在 ──────────────────────────────────
assert(/limit\s*\|\|\s*3/.test(batch), '桌面默认并发回退 3 须保留');
assert(cap.indexOf('1000000') >= 0, '桌面 _RAW_CAP 1MB 须保留');
assert(rpj.indexOf('500000') >= 0, '桌面 MAX_PARSE_LEN 500KB 须保留');

console.log('[smoke-android-endturn-oom-guard] PASS ' + passed + ' assertions');
