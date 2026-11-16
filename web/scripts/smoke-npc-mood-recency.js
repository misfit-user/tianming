#!/usr/bin/env node
// smoke-npc-mood-recency.js
// 验证「心绪派生时近加权」:近期情绪主导·陈年记忆不再冻结低活跃 NPC 心绪。
// 手法:花括号配平抽 tm-mechanics.js 真 _updateMood·配 GM 实跑·并对 .bak 做 swap-test 证 load-bearing。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

function extractUpdateMood(src) {
  const s = src.indexOf('_updateMood: function(ch)');
  let i = src.indexOf('{', s), depth = 0, e = -1;
  for (; i < src.length; i++) { const ch = src[i]; if (ch === '{') depth++; else if (ch === '}') { depth--; if (depth === 0) { e = i + 1; break; } } }
  // 包成可调用函数(去掉 "_updateMood: function" 前缀的对象字面量形式)
  const body = src.slice(src.indexOf('function(ch)', s), e);
  return body; // "function(ch){...}"
}

function mkMood(src, turn) {
  const ctx = { GM: { turn: turn } };
  vm.createContext(ctx);
  vm.runInContext('var _updateMood = ' + extractUpdateMood(src) + ';', ctx, { filename: 'mood.js' });
  return function (ch) { ctx._updateMood(ch); return ch._mood; };
}

const SRC = (fs.readFileSync(path.join(ROOT, 'tm-mechanics.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tm-mechanics-memory.js'), 'utf8'));
const mood = mkMood(SRC, 40); // 当前回合 40

// ① 近期强情绪主导
ok(mood({ _memory: [{ emotion: '怒', importance: 8, turn: 39 }] }) === '怒', '① 近期(turn39)怒→心绪怒');

// ② ★陈年记忆(age>8)不再冻结心绪→归平(本刀核心)
ok(mood({ _memory: [{ emotion: '恨', importance: 9, turn: 3 }, { emotion: '怒', importance: 8, turn: 5 }] }) === '平',
  '② ★低活跃NPC陈年创伤(turn3/5·now40)→心绪归平(不再冻结)');

// ③ 近期 vs 陈年:近期胜
ok(mood({ _memory: [{ emotion: '喜', importance: 9, turn: 4 }, { emotion: '忧', importance: 6, turn: 39 }] }) === '忧',
  '③ 陈年喜(turn4·age36被弃) + 近期忧(turn39)→忧(近期胜)');

// ④ "平"噪声被跳过:近期平 + 窗口内怒 → 怒
ok(mood({ _memory: [{ emotion: '怒', importance: 7, turn: 38 }, { emotion: '平', importance: 9, turn: 40 }] }) === '怒',
  '④ 近期"平"噪声被跳过·窗口内怒胜出');

// ⑤ 空记忆→平
ok(mood({ _memory: [] }) === '平', '⑤ 空记忆→平');
ok(mood({ _memory: [{ emotion: '喜', importance: 5, turn: 20 }, { emotion: '平', importance: 5, turn: 40 }] }) !== undefined, '⑤ 不抛错');

// ⑥ 时近权重:稍旧强情绪 vs 极新弱情绪
//   怒 turn37(age3·w0.6·imp8=4.8) vs 喜 turn40(age0·w1·imp5=5.0)→喜略胜·体现时近加权
ok(mood({ _memory: [{ emotion: '怒', importance: 8, turn: 37 }, { emotion: '喜', importance: 5, turn: 40 }] }) === '喜',
  '⑥ 时近加权:极新弱喜(5.0)略压稍旧强怒(4.8)');

// ── swap-test:同一陈年案例·旧版冻结旧情绪 vs 新版归平 ──
(function () {
  const BAK = path.join(ROOT, 'tm-mechanics.js.bak-mood-20260614');
  if (!fs.existsSync(BAK)) { console.log('  (跳过 swap-test·无 .bak)'); return; }
  const oldMood = mkMood(fs.readFileSync(BAK, 'utf8'), 40);
  const oldCh = { _memory: [{ emotion: '恨', importance: 9, turn: 3 }, { emotion: '怒', importance: 8, turn: 5 }] };
  const oldResult = oldMood(oldCh);
  ok(oldResult === '恨' || oldResult === '怒', 'swap-test:旧版对陈年创伤(turn3/5)冻结为旧情绪「' + oldResult + '」(now40)');
  const newCh = { _memory: [{ emotion: '恨', importance: 9, turn: 3 }, { emotion: '怒', importance: 8, turn: 5 }] };
  ok(mood(newCh) === '平', 'swap-test:新版同案例归「平」→ 修复 load-bearing');
})();

console.log('[smoke-npc-mood-recency] ' + pass + ' passed / ' + fail + ' failed');
process.exit(fail ? 1 : 0);
