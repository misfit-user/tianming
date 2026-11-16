#!/usr/bin/env node
// smoke-renwu-jiawang-real.js — 人物图志「家族统览」假家望治理
// 旧:家望=familyTier 硬编静态值(皇族100/士族60/世家78/寒门40)+假进度条·与游戏进程无关(同征税效率假数字)
// 新:改读真实动态「名望」(p.mingwang·随政绩/事件升降)·进度条变真
// 真功能测:同 familyTier 两人不同 mingwang → 名望不同(旧码会都显同一静态值)
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let A = 0;
function assert(c, m) { if (!c) throw new Error('FAIL: ' + m); A++; console.log('  ✓ ' + m); }

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

console.log('smoke-renwu-jiawang-real');

// 两人同为「士族」(gentry)·旧码名望恒 60·新码读真 mingwang(30 vs 90)
ctx.GM.chars = [
  { name: '皇帝', isPlayer: true, faction: '明朝廷', officialTitle: '皇帝', alive: true, familyTier: 'imperial', family: '朱', mingwang: 95 },
  { name: '寒士甲', faction: '东林', officialTitle: '编修', alive: true, familyTier: 'gentry', family: '甲', mingwang: 30 },
  { name: '名士乙', faction: '东林', officialTitle: '侍读', alive: true, familyTier: 'gentry', family: '乙', mingwang: 90 },
  { name: '无名丙', faction: '中立', officialTitle: '主事', alive: true, familyTier: 'gentry', family: '丙' } // 无 mingwang
];
ctx.TMZhi.selectP('寒士甲');
const main = () => el('tm-zhi-main').innerHTML;

// ① 切到家族页·应显「名望」标签(已正名·不再「家望」假指标)
ctx.TMZhi.switchTab('family');
let h甲 = main();
assert(h甲.indexOf('名望') >= 0, '① 家族统览显「名望」标签(真实动态声望·已正名)');
assert(h甲.indexOf('家 族 统 览') >= 0, '① 仍在家族统览区块内');

// ② 寒士甲(gentry·mingwang30) → 名望显 30(非旧静态 60)
assert(/名望[\s\S]{0,80}>30</.test(h甲) || h甲.indexOf('>30<') >= 0, '② 寒士甲 名望=30(读真 mingwang·实含>30<)');

// ③ ★swap-test:名士乙 同为 gentry 但 mingwang90 → 名望显 90(旧码两人都会显 60)
ctx.TMZhi.selectP('名士乙');
ctx.TMZhi.switchTab('family');
let h乙 = main();
assert(h乙.indexOf('>90<') >= 0, '③ 名士乙(同gentry·mingwang90) 名望=90·实含>90<');
assert(h甲.indexOf('>30<') >= 0 && h乙.indexOf('>90<') >= 0, '③ ★同门第两人名望不同(30≠90)·证已脱离 familyTier 静态映射(旧码恒 60)');
// 旧静态值 60/78 不应作为这两 gentry 的名望出现
assert(h乙.indexOf('>60<') < 0, '③ 名士乙不再显旧静态家望 60');

// ④ 无 mingwang 者 → 名望显「—」(不编造数字)
ctx.TMZhi.selectP('无名丙');
ctx.TMZhi.switchTab('family');
let h丙 = main();
assert(/名望[\s\S]{0,80}—/.test(h丙) || h丙.indexOf('>—<') >= 0, '④ 无 mingwang → 名望显「—」(不编造)');

// ⑤ 源契约:旧静态假公式已除·真字段已接
const src = fs.readFileSync(path.join(ROOT, 'tm-renwu-tuzhi.js'), 'utf8');
assert(!/renown=p\.familyTier===.imperial.\?100/.test(src), '⑤ 旧 familyTier 硬编 renown 公式已删');
assert(src.indexOf("['家望',renown,renown]") < 0, '⑤ 旧 [家望,renown,renown] 假进度条已除');

console.log('\n结果: ' + A + ' 通过 / 0 失败');
