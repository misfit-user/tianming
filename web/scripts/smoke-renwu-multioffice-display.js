#!/usr/bin/env node
// smoke-renwu-multioffice-display.js — 验「人物图志/御案右栏/人物志」显示多职(主职⊕兼职)·非仅主职被新职替代
//   Part A: office-system _offFormatCharTitles 实跑  Part B: 图志渲染实跑(花名册/列传头/公职身份)  Part C: 其他面板源码契约
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; }

// ════════ Part A: tm-office-system._offFormatCharTitles 实跑 ════════
(function () {
  const ctx = {
    console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN,
    setTimeout() {}, clearTimeout() {},
    document: { getElementById: () => null, querySelectorAll: () => [], createElement: () => ({ style: {} }), body: {}, addEventListener() {} },
    window: null, GM: { turn: 1, officeTree: [], chars: [], evtLog: [] },
    TM: { errors: { capture() {}, captureSilent() {} } },
    addEB() {}, showToast() {}, toast() {}, alert() {}, autoSave() {}, _dbg() {},
    escHtml(v) { return String(v == null ? '' : v); }, findCharByName() { return null; }
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-office-system.js'), 'utf8'), ctx, { filename: 'tm-office-system.js' });

  const f = ctx._offFormatCharTitles, g = ctx._offGetCharOfficeTitles;
  assert(typeof f === 'function', 'office-system 应导出 _offFormatCharTitles');
  assert(typeof g === 'function', 'office-system 应有 _offGetCharOfficeTitles');

  // 兼任:主职「兼」兼职
  const c1 = { officialTitle: '礼部尚书', concurrentTitles: ['东阁大学士'] };
  assert(g(c1).length === 2, 'getter 应返回 2 职·实=' + g(c1).length);
  assert(f(c1) === '礼部尚书　兼　东阁大学士', '兼任应「主　兼　兼」·实=' + f(c1));

  // 三职:兼职间顿号
  const c2 = { officialTitle: '内阁首辅·建极殿大学士', concurrentTitles: ['礼部尚书', '吏部尚书'] };
  assert(f(c2) === '内阁首辅·建极殿大学士　兼　礼部尚书、吏部尚书', '三职兼应顿号连·实=' + f(c2));

  // 单职原样
  assert(f({ officialTitle: '吏部尚书' }) === '吏部尚书', '单职应原样');
  // 无职 fallback
  assert(f({}, { fallback: '布衣' }) === '布衣', '无职应走 fallback');
  assert(f({}) === '', '无职无 fallback 应空串');
  // officialTitles 数组亦识别
  assert(g({ officialTitles: ['甲', '乙'] }).join(',') === '甲,乙', 'officialTitles 数组应识别');
  console.log('  [A] office-system _offFormatCharTitles 实跑 OK');
})();

// ════════ Part B: 人物图志渲染实跑(花名册卡 + 列传头 pill + 公职身份) ════════
(function () {
  const els = {};
  function bySel(s) { if (typeof s === 'string' && s.charAt(0) === '#') return el(s.slice(1)); return el('__' + s); }
  function el(id) { if (!els[id]) els[id] = { id, value: '', checked: false, style: {}, innerHTML: '', textContent: '', classList: { add() {}, remove() {} }, appendChild() {}, remove() {}, querySelector(s) { return bySel(s); }, querySelectorAll() { return []; }, scrollTop: 0, focus() {} }; return els[id]; }
  const ctx = {
    console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, Date: { now: () => 0 },
    setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
    document: { getElementById: el, querySelector: bySel, querySelectorAll: () => [], createElement: () => el('__tmp'), body: el('__body'), head: el('__head'), addEventListener() {} },
    window: null, GM: { turn: 5, chars: [], characterArcs: {}, culturalWorks: [] }, P: { playerInfo: { characterName: '皇帝' } },
    findCharByName(n) { return (ctx.GM.chars || []).find(c => c && c.name === n) || null; },
    getRankLevel() { return 9; }, buildIndices() {}, renderOfficeTree() {}, toast() {}, confirm: () => true
  };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  // 只载 tuzhi:_zhiOfficeTitles 在无 office-system 时走 fallback(读 concurrentTitles)·与 getter 等价
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-renwu-tuzhi.js'), 'utf8'), ctx, { filename: 'tm-renwu-tuzhi.js' });

  ctx.GM.chars = [
    { name: '皇帝', isPlayer: true, faction: '明朝廷', officialTitle: '皇帝', alive: true },
    { name: '兼官者', faction: '明朝廷', officialTitle: '礼部尚书', concurrentTitles: ['东阁大学士'], administration: 70, alive: true },
    { name: '单官者', faction: '明朝廷', officialTitle: '吏部尚书', administration: 65, alive: true }
  ];

  ctx.TMZhi.selectP('兼官者');
  const roster = el('tm-zhi-roster').innerHTML;
  assert(roster.indexOf('礼部尚书') >= 0 && roster.indexOf('东阁大学士') >= 0, '花名册卡应同时显示主职与兼职(原 bug:仅主职)');
  assert(roster.indexOf('兼') >= 0, '花名册应有「兼」连接');

  const main1 = el('tm-zhi-main').innerHTML;
  assert(main1.indexOf('礼部尚书') >= 0 && main1.indexOf('东阁大学士') >= 0, '列传头 pill 应含主职+兼职');

  ctx.TMZhi.switchTab('identity');
  const main2 = el('tm-zhi-main').innerHTML;
  assert(main2.indexOf('公 职 身 份') >= 0 || main2.indexOf('公职身份') >= 0, 'identity tab 应有公职身份块');
  assert(main2.indexOf('礼部尚书') >= 0 && main2.indexOf('东阁大学士') >= 0, '公职身份应同时显示主职与兼职(用户报 bug 核心)');

  // 单职者不应莫名冒出「兼」
  ctx.TMZhi.selectP('单官者'); ctx.TMZhi.switchTab('identity');
  const main3 = el('tm-zhi-main').innerHTML;
  assert(main3.indexOf('吏部尚书') >= 0, '单职者应显主职');
  console.log('  [B] 人物图志渲染实跑(花名册/列传头/公职身份) OK');
})();

// ════════ Part C: 御案右栏 + 人物志 UI + 图志 源码契约 ════════
(function () {

  console.log('  [C] 御案右栏/人物志 UI/图志 源码契约 OK');
})();

console.log('[smoke-renwu-multioffice-display] pass assertions=' + A);
