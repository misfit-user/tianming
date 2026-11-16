#!/usr/bin/env node
// smoke-wdsusp-suspicion.js — 君上疑窦(GM._wdSuspicions·原写而不读)接入
//   A. 喂 AI:tm-endturn-prompt.js 注入「君上疑窦」块(近3回合·每人最近一条·要求被疑之臣有反应)
//   B. 留痕:人物图志 tabRelations 渲染「君上之疑」节(仅非玩家·读全局 _wdSuspicions 中 who===本人者)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

console.log('smoke-wdsusp-suspicion');

// ───────────── A. prompt 源契约 ─────────────
const ps = fs.readFileSync(path.join(ROOT, 'tm-endturn-prompt.js'), 'utf8');
// CRLF 保持 + 无裸 LF 混入
assert((ps.match(/[^\r]\n/g) || []).length === 0, 'A⑦ prompt 文件 CRLF 保持(无裸 LF)');

// ───────────── B. tabRelations 功能测 ─────────────
const els = {};
function bySel(s) { if (typeof s === 'string' && s.charAt(0) === '#') return el(s.slice(1)); return el('__' + s); }
function el(id) { if (!els[id]) els[id] = { id, value: '', checked: false, style: {}, innerHTML: '', textContent: '', classList: { add() {}, remove() {} }, appendChild() {}, remove() {}, querySelector(s) { return bySel(s); }, querySelectorAll() { return []; }, scrollTop: 0, focus() {} }; return els[id]; }
const ctx = {
  console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, Date: { now: () => 0 },
  setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  document: { getElementById: el, querySelector: bySel, querySelectorAll: () => [], createElement: () => el('__tmp'), body: el('__body'), head: el('__head'), addEventListener() {} },
  window: null, GM: { turn: 10, chars: [], characterArcs: {}, culturalWorks: [] }, P: { playerInfo: { characterName: '朱由检' } },
  findCharByName(n) { return (ctx.GM.chars || []).find(c => c && c.name === n) || null; },
  getRankLevel() { return 9; }, buildIndices() {}, renderOfficeTree() {}, toast() {}, confirm: () => true
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-renwu-tuzhi.js'), 'utf8'), ctx, { filename: 'tm-renwu-tuzhi.js' });

ctx.GM.chars = [
  { name: '朱由检', isPlayer: true, faction: '明朝廷', officialTitle: '皇帝', alive: true },
  { name: '隐忍者', faction: '东林', officialTitle: '吏部尚书', administration: 70, alive: true },
  { name: '坦荡者', faction: '中立', officialTitle: '户部尚书', administration: 65, alive: true }
];
ctx.GM._wdSuspicions = [
  { turn: 10, who: '隐忍者', hiding: '似在为某边将通敌遮掩', caught: true },
  { turn: 8, who: '隐忍者', hiding: '隐瞒田产', caught: false },
  { turn: 9, who: '朱由检', hiding: '不该有的自疑', caught: true } // 玩家·守卫应排除
];
const main = () => el('tm-zhi-main').innerHTML;

// 被疑之臣 → 显「君上之疑」节
ctx.TMZhi.selectP('隐忍者');
ctx.TMZhi.switchTab('relations');
let h = main();
assert(h.indexOf('君 上 之 疑') >= 0, 'B① 被疑之臣 tabRelations 显「君上之疑」节');
assert(h.indexOf('似在为某边将通敌遮掩') >= 0, 'B② 渲染所隐内容(turn10·hiding)');
assert(h.indexOf('当面识破') >= 0, 'B③ caught=true → 当面识破');
assert(h.indexOf('隐瞒田产') >= 0 && h.indexOf('隐隐觉出') >= 0, 'B④ 多条全列(turn8·caught=false→隐隐觉出)');
assert(h.indexOf('本回合') >= 0, 'B⑤ turn 标签(本回合/第N回)');

// 无疑窦者 → 无该节
ctx.TMZhi.selectP('坦荡者');
ctx.TMZhi.switchTab('relations');
assert(main().indexOf('君 上 之 疑') < 0, 'B⑥ 无疑窦者不显该节');

// ★玩家守卫:朱由检即便有 _wdSuspicions 也不显(君不自疑)
ctx.TMZhi.selectP('朱由检');
ctx.TMZhi.switchTab('relations');
assert(main().indexOf('君 上 之 疑') < 0, 'B⑦ ★玩家(朱由检)守卫:不显君上之疑(!p.isPlayer)');

// 源契约

console.log('\n结果: ' + A + ' 通过 / 0 失败');
