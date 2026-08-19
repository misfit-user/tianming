#!/usr/bin/env node
'use strict';
// smoke-nokey-endturn-guard — 验证「无 AI 密钥前置守卫」(2026-06-14)
// 抽取真 endTurn() 函数源在 vm 沙箱实跑（非重新实现）：
//   · 无 key / 空白 key → 弹 notifyUrgent + 中止过回合（不进 court prompt）+ 确认跳设置
//   · 有效 key → 不弹 + 只进入纯 UI court prompt；pre-submit 校准留在事务快照之后
//   · 源契约：守卫必须在 court prompt 之前（否则拦不住）

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');
const coreSrc = fs.readFileSync(path.join(ROOT, 'tm-endturn-core.js'), 'utf8');

let passed = 0;
function assert(cond, msg) { if (!cond) throw new Error('[assert] ' + msg); passed++; }

// ── 抽取真 endTurn 函数源（到紧随其后的事务快照 helper） ──
const startMarker = 'async function endTurn(){';
const endMarker = 'function _tmCaptureEndTurnObject(';
const si = coreSrc.indexOf(startMarker);
const ei = coreSrc.indexOf(endMarker, si);
assert(si >= 0, 'endTurn 函数存在于源码');
assert(ei > si, '事务快照 helper 标记在 endTurn 之后');
const endTurnSrc = coreSrc.slice(si, ei).trim();

// ── 源契约：守卫在 court prompt 之前 ──
const guardIdx = endTurnSrc.indexOf('P.ai.key');
const courtIdx = endTurnSrc.indexOf('_showPostTurnCourtPromptAndStartEndTurn');
assert(guardIdx >= 0, 'endTurn 含 P.ai.key 守卫');
assert(courtIdx >= 0, 'endTurn 调用 court prompt');
assert(guardIdx < courtIdx, '无 key 守卫位于 court prompt 之前（否则拦不住空转）');

function makeEnv(key) {
  const calls = { notifyUrgent: 0, openSettings: 0, court: 0, calibration: 0, alert: 0 };
  const env = {
    console, String,
    P: { ai: (key === undefined ? {} : { key: key }) },
    GM: { busy: false },
    window: { TM: {} },
    TM: {},
    notifyUrgent: function(title, detail, onConfirm) {
      calls.notifyUrgent++;
      if (typeof onConfirm === 'function') { try { onConfirm(); } catch (_) {} } // 模拟「机已知悉」
    },
    openSettings: function() { calls.openSettings++; },
    alert: function() { calls.alert++; },
    _runPreSubmitPartyClassCalibration: async function() { calls.calibration++; },
    _showPostTurnCourtPromptAndStartEndTurn: function() { calls.court++; }
  };
  env.calls = calls;
  return env;
}

async function run(key) {
  const env = makeEnv(key);
  const ctx = vm.createContext(env);
  const fn = vm.runInContext('(' + endTurnSrc + ')', ctx); // 真函数，闭包绑定沙箱全局
  await fn();
  return env.calls;
}

(async () => {
  // A. 无 ai.key 字段（P.ai = {}）→ 拦下
  let c = await run(undefined);
  assert(c.notifyUrgent === 1, 'A 无key：弹一次 notifyUrgent');
  assert(c.court === 0, 'A 无key：未进 court prompt（过回合已中止）');
  assert(c.calibration === 0, 'A 无key：未进 pre-submit 校准');
  assert(c.openSettings === 1, 'A 无key：确认后跳转设置');

  // B. 空白 key → 拦下
  c = await run('   ');
  assert(c.notifyUrgent === 1, 'B 空白key：弹 notifyUrgent');
  assert(c.court === 0, 'B 空白key：未进 court prompt');

  // C. 有效 key → 放行
  c = await run('sk-test-123');
  assert(c.notifyUrgent === 0, 'C 有效key：不弹通知');
  assert(c.calibration === 0, 'C 有效key：court 选择前不得运行会修改 GM 的 pre-submit 校准');
  assert(c.court === 1, 'C 有效key：进入 court prompt');

  const captureIdx = coreSrc.indexOf('_turnTxn = _tmCaptureEndTurnTransaction()', ei);
  const calibrationIdx = coreSrc.indexOf('await _runPreSubmitPartyClassCalibration()', captureIdx);
  assert(captureIdx >= 0 && calibrationIdx > captureIdx, 'pre-submit 校准只在事务快照创建后执行');

  console.log('PASS smoke-nokey-endturn-guard · ' + passed + ' 断言');
})().catch(e => { console.error('FAIL smoke-nokey-endturn-guard'); console.error(e); process.exit(1); });
