#!/usr/bin/env node
// smoke-renwu-jail-filter.js — 人物图志「羁系」快筛(下诏狱+流放) + 卡片实心朱红标记 + 详情关押时长
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; }

const els = {};
function bySel(s) { if (typeof s === 'string' && s.charAt(0) === '#') return el(s.slice(1)); return el('__' + s); }
function el(id) { if (!els[id]) els[id] = { id, value: '', checked: false, style: {}, innerHTML: '', textContent: '', classList: { add() {}, remove() {} }, appendChild() {}, remove() {}, querySelector(s) { return bySel(s); }, querySelectorAll() { return []; }, scrollTop: 0, focus() {} }; return els[id]; }

const ctx = {
  console, Math, JSON, RegExp, Array, Object, String, Number, Boolean, parseInt, parseFloat, isNaN, Date: { now: () => 0 },
  setTimeout: (f) => { if (typeof f === 'function') f(); return 0; }, clearTimeout() {}, setInterval() { return 0; }, clearInterval() {},
  document: { getElementById: el, querySelector: bySel, querySelectorAll: () => [], createElement: () => el('__tmp'), body: el('__body'), head: el('__head'), addEventListener() {} },
  window: null, GM: { turn: 10, chars: [], characterArcs: {}, culturalWorks: [] }, P: { playerInfo: { characterName: '皇帝' } },
  findCharByName(n) { return (ctx.GM.chars || []).find(c => c && c.name === n) || null; },
  getRankLevel() { return 9; }, buildIndices() {}, renderOfficeTree() {}, toast() {}, confirm: () => true
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-renwu-tuzhi.js'), 'utf8'), ctx, { filename: 'tm-renwu-tuzhi.js' });

ctx.GM.chars = [
  { name: '皇帝', isPlayer: true, faction: '明朝廷', officialTitle: '皇帝', alive: true },
  { name: '下狱者', faction: '明朝廷', officialTitle: '吏部尚书', administration: 70, alive: true, _imprisoned: true, _imprisonedTurn: 7, _imprisonReason: '弹章下诏狱·候勘' },
  { name: '流放者', faction: '东林', officialTitle: '御史', administration: 60, alive: true, _exiled: true, _exileReason: '谪戍辽东' },
  { name: '在朝者', faction: '明朝廷', officialTitle: '户部尚书', administration: 65, alive: true },
  { name: '已殁者', faction: '明朝廷', officialTitle: '礼部侍郎', alive: false, deathReason: '病故', deathTurn: 3 }
];
ctx.TMZhi.selectP('在朝者'); // 首渲+缓存重建

const roster = () => el('tm-zhi-roster').innerHTML;
const statbar = () => el('tm-zhi-statbar').innerHTML;
const main = () => el('tm-zhi-main').innerHTML;

// ── 状态条:应有「羁系」格·计数=2(下狱+流放·不含已殁/在朝) ──
ctx.TMZhi.quickStat('all');
assert(statbar().indexOf('羁系') >= 0, '状态条应有「羁系」格');
// 羁系格的数字应为 2(下狱者+流放者)
var jailCell = statbar().match(/<div class="stat warn[^"]*"[^>]*><b>(\d+)<\/b><span>羁系/);
assert(jailCell && jailCell[1] === '2', '羁系计数应为 2(下狱+流放)·实=' + (jailCell ? jailCell[1] : '未匹配'));

// ── 点「羁系」:名册只剩下狱者+流放者 ──
ctx.TMZhi.quickStat('jail');
var r = roster();
assert(r.indexOf('下狱者') >= 0 && r.indexOf('流放者') >= 0, '羁系筛选应含下狱者+流放者');
assert(r.indexOf('在朝者') < 0, '羁系筛选不应含在朝者');
assert(r.indexOf('已殁者') < 0, '羁系筛选不应含已殁者');

// ── 卡片标记:实心朱红 .ptag.jail·诏狱/流放 ──
assert(/<span class="ptag jail">诏狱<\/span>/.test(r), '下狱者卡片应有实心朱红「诏狱」标记(.ptag.jail)');
assert(/<span class="ptag jail">流放<\/span>/.test(r), '流放者卡片应有实心朱红「流放」标记(.ptag.jail)');

// ── 再点一次「羁系」应 toggle 回 all ──
ctx.TMZhi.quickStat('jail');
assert(roster().indexOf('在朝者') >= 0, '再点羁系应 toggle 回全部(含在朝者)');

// ── 详情横幅:下诏狱 + 已系 N 回合(turn10 - imprisonedTurn7 = 3) ──
ctx.TMZhi.selectP('下狱者');
var m = main();
assert(/下诏狱/.test(m), '下狱者详情应有「下诏狱」横幅');
assert(/已系\s*3\s*回合/.test(m), '应显示关押时长「已系 3 回合」(turn10-7)·实片段=' + (m.match(/下诏狱[^<]{0,20}/) || ['?'])[0]);

// ── 流放者详情横幅:流放在外 ──
ctx.TMZhi.selectP('流放者');
assert(/流放在外/.test(main()), '流放者详情应有「流放在外」横幅');

// ── 源码契约:CSS + computeStat ──

console.log('[smoke-renwu-jail-filter] pass assertions=' + A);
