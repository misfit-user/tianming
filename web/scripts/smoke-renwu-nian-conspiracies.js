#!/usr/bin/env node
// smoke-renwu-nian-conspiracies.js — 人物图志「逆案录」接入 GM._conspiracies(原写而不读·display-only)
// 谋反/政变/弑君记录(主谋+从党+成败+缘由)逐案渲染·得逞=深朱/事败=青·主谋从党可点入列传·护栏未遂标记
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
  window: null, GM: { turn: 10, chars: [], characterArcs: {}, culturalWorks: [] }, P: { playerInfo: { characterName: '朱由检' } },
  findCharByName(n) { return (ctx.GM.chars || []).find(c => c && c.name === n) || null; },
  getRankLevel() { return 9; }, buildIndices() {}, renderOfficeTree() {}, toast() {}, confirm: () => true
};
ctx.window = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-renwu-tuzhi.js'), 'utf8'), ctx, { filename: 'tm-renwu-tuzhi.js' });

console.log('smoke-renwu-nian-conspiracies');

ctx.GM.chars = [
  { name: '朱由检', isPlayer: true, faction: '明朝廷', officialTitle: '皇帝', alive: true },
  { name: '魏忠贤', faction: '阉党', officialTitle: '司礼监掌印', alive: true },
  { name: '崔呈秀', faction: '阉党', officialTitle: '兵部尚书', alive: true },
  { name: '田尔耕', faction: '阉党', officialTitle: '锦衣卫', alive: true }
];
// 真实形态:被护栏拦下的政变 action 在写入时已改写为 coup_failed(tm-endturn-apply:592)
ctx.GM._conspiracies = [
  { turn: 10, action: 'coup_failed', instigator: '魏忠贤', target: '朱由检', outcome: 'suppressed', conspirators: ['崔呈秀', '田尔耕'], reason: '阉党谋废立·拥兵自重', _qamGated: true },
  { turn: 8, action: 'coup_succeeded', instigator: '某藩王', target: '', outcome: 'succeeded', conspirators: [], reason: '拥兵自立' },
  { turn: 5, action: 'plot_failed', instigator: '李逆', outcome: 'failed', conspirators: ['王从'], reason: '谋刺辅臣' }
];

// 切到「逆案」视图
ctx.TMZhi.setView('nian');
const main = () => el('tm-zhi-main').innerHTML;
const folio = () => el('tm-zhi-folio').innerHTML;
let h = main(), f = folio();

// ── ① 视图 tab 新增「逆案」 ──
assert(el('tm-zhi-viewtabs').innerHTML.indexOf('逆案') >= 0, '① 视图 tab 新增「逆案」');

// ── ② 标题 + 三案全渲染 ──
assert(h.indexOf('逆 案 录') >= 0, '② 主区渲染「逆案录」标题');
assert(/ni-item/.test(h) && (h.match(/ni-item/g) || []).length === 3, '② 三案全渲染(3 个 ni-item·实=' + (h.match(/ni-item/g) || []).length + ')');

// ── ③ action 中文化 ──
assert(h.indexOf('政变败露') >= 0, '③ coup_failed → 政变败露');
assert(h.indexOf('政变得逞') >= 0, '③ coup_succeeded → 政变得逞');
assert(h.indexOf('谋逆未遂') >= 0, '③ plot_failed → 谋逆未遂');

// ── ④ outcome 中文化 ──
assert(h.indexOf('事败就擒') >= 0, '④ suppressed → 事败就擒');
assert(h.indexOf('得逞') >= 0, '④ succeeded → 得逞');

// ── ⑤ 成败着色:得逞=success·事败=foiled ──
assert(/ni-item success/.test(h), '⑤ 得逞案有 success 朱色类');
assert(/ni-item foiled/.test(h), '⑤ 事败案有 foiled 青色类');
// 被护栏拦下的政变(outcome=suppressed)应判 foiled 非 success
assert(/ni-act foiled">政变败露/.test(h), '⑤ ★护栏未遂政变=foiled(结局优先于动作·不误判得逞)');

// ── ⑥ 主谋/目标/从党可点入列传 ──
assert(h.indexOf("TMZhi.selectP('魏忠贤')") >= 0, '⑥ 主谋魏忠贤可点');
assert(h.indexOf("TMZhi.selectP('朱由检')") >= 0, '⑥ 目标朱由检可点(findP命中)');
assert(h.indexOf("TMZhi.selectP('崔呈秀')") >= 0, '⑥ 从党崔呈秀可点(findP命中)');
assert(h.indexOf('从党') >= 0 && h.indexOf('王从') >= 0, '⑥ 从党列出(含未在册的王从·纯文本)');

// ── ⑦ 缘由 + 护栏标记 ──
assert(h.indexOf('阉党谋废立') >= 0, '⑦ 缘由渲染');
assert(h.indexOf('护栏·未遂') >= 0, '⑦ _qamGated 案显「护栏·未遂」标记');

// ── ⑧ folio 提要:得逞1/事败2 + 屡谋之人 ──
assert(/得逞 1/.test(f) && /事败 2/.test(f), '⑧ folio 提要:得逞 1·事败 2');

// ── ⑨ 空数据兜底 ──
ctx.GM._conspiracies = [];
ctx.TMZhi.setView('nian');

// ── ⑩ 源契约:三处派发接入 ──

console.log('\n结果: ' + A + ' 通过 / 0 失败');
