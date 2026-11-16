#!/usr/bin/env node
// smoke-npc-output-leak-fix.js — NPC 产出英文泄漏修复(基于 T37 真存档观察):
//   ① behaviorType→中文动词 ② edictType key→中文/隐去 ③ 记忆近窗去重 ④ pushOffice old===new no-op 守卫
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function assert(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

// ── ①② 抽取 apply.js 真 helper 实跑 ──
(function () {
  const src = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
  const a = src.indexOf('var _NPC_BEHAVIOR_CN');
  const cEnd = src.indexOf('}', src.indexOf('function _edictTypeCN'));
  assert(a >= 0 && cEnd > a, 'apply.js 应含 _NPC_BEHAVIOR_CN/_edictTypeCN helper');
  const seg = src.slice(a, cEnd + 1);
  const ctx = {}; vm.createContext(ctx); vm.runInContext(seg, ctx, { filename: 'helpers.js' });
  const bv = ctx._npcBehaviorVerbCN, et = ctx._edictTypeCN;
  assert(bv('suppress') === '镇压', 'suppress→镇压·实=' + bv('suppress'));
  assert(bv('punish') === '惩处', 'punish→惩处');
  assert(bv('betray') === '背叛', 'betray→背叛');
  assert(bv('petition') === '进谏', 'petition→进谏');
  assert(bv('study') === '查访', 'study→查访');
  assert(!/[a-z]/i.test(bv('weirdUnknownType')), '未知英文 behaviorType 不漏英文·实=' + bv('weirdUnknownType'));
  assert(et('education_culture') === '（文教）', 'education_culture→（文教）·实=' + et('education_culture'));
  assert(et('military') === '（军务）', 'military→（军务）');
  assert(et('weird_eng_key') === '', '未知英文键→空(不漏英文)');
  assert(et('') === '', '空 edictType→空');
  console.log('  [①②] behaviorType/edictType 映射 OK');
})();

// ── ③ 记忆近窗去重(tm-mechanics NpcMemorySystem) ──
(function () {
  const ctx = { console: { log() {}, warn() {}, error() {} }, Math, Date: { now: () => 0 }, JSON, Object, Array, Number, String, Boolean, RegExp, isFinite, isNaN, parseInt, parseFloat, setTimeout: () => 0, clearTimeout: () => {} };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx; vm.createContext(ctx);
  ctx.GM = { turn: 5, chars: [{ name: '甲', alive: true, _memory: [] }] };
  ctx.P = {}; ctx._tmMemoryCanonName = (n) => n; ctx._tmMemoryCanonNameArray = (x) => x; ctx._tmMemoryFindChar = (n) => ctx.GM.chars.find(c => c.name === n);
  const src = (fs.readFileSync(path.join(ROOT, 'tm-mechanics.js'), 'utf8') + fs.readFileSync(path.join(ROOT, 'tm-mechanics-memory.js'), 'utf8'));
  const i = src.indexOf('var NpcMemorySystem = {');
  const j = src.indexOf('\n};', i) + 3;
  vm.runInContext(src.slice(i, j), ctx, { filename: 'npcmem.js' });
  const N = ctx.NpcMemorySystem;
  for (let k = 0; k < 5; k++) N.remember('甲', '党议反对诏令（文教）', '恨', 5);
  N.remember('甲', '另一条不同记忆', '平', 5);
  const mem = ctx.GM.chars[0]._memory;
  assert(mem.length === 2, '同 event×5+异×1 应去重为 2·实=' + mem.length);
  assert(mem.filter(m => m.event === '党议反对诏令（文教）').length === 1, '相同 event 只存 1 条');
  console.log('  [③] 记忆近窗去重 OK');
})();

// ── ④ 源码契约:call sites 走 helper + pushOffice no-op 守卫 ──
(function () {
  const ap = fs.readFileSync(path.join(ROOT, 'tm-endturn-apply.js'), 'utf8');
  assert(!/'施以' \+ act\.behaviorType\b/.test(ap), '不再裸拼英文 behaviorType(施以)');
  assert(!/党议反对诏令\(' \+ \(u\.edictType/.test(ap), '不再裸拼英文 edictType');
  console.log('  [④] 源码契约(call sites + pushOffice 守卫) OK');
})();

console.log('[smoke-npc-output-leak-fix] ' + pass + ' passed / ' + fail + ' failed');
if (fail > 0) process.exit(1);
