#!/usr/bin/env node
// smoke-wentian-class-hardchange.js
// 验证「问天无法修改阶层影响力与满意度」已治:_wtApplyHardChange 给阶层补按名解析器·
// classes[阶层名].satisfaction/influence 真写进阶层对象(0-100夹取)·不再落数组幽灵属性静默失败。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const WEB = path.resolve(__dirname, '..');
let pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('  ✓ ' + m); } else { fail++; console.log('  ✗ ' + m); } }

// ── 富 sandbox 加载 tm-game-loop.js(全局函数声明)──
const sb = {};
sb.window = sb; sb.global = sb; sb.globalThis = sb;
sb.console = { log() {}, warn() {}, error() {} };
sb.document = { getElementById() { return null; }, activeElement: null, createElement() { return { style: {}, appendChild() {}, setAttribute() {} }; } };
sb.toast = function () {}; sb.escHtml = function (s) { return String(s == null ? '' : s); };
sb.callAI = function () { return Promise.resolve('{}'); };
sb._$ = function () { return null; };
sb.requestIdleCallback = function (fn) { try { fn(); } catch (_) {} };
sb.requestAnimationFrame = function (fn) { try { fn(); } catch (_) {} };
sb.setTimeout = setTimeout; sb.clearTimeout = clearTimeout;
sb.extractJSON = function () { return null; };
sb.addEventListener = function () {}; sb.removeEventListener = function () {};
sb.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
sb.navigator = { userAgent: 'node', maxTouchPoints: 0 };
sb.location = { href: '', search: '' };
sb.document.addEventListener = function () {}; sb.document.body = { appendChild() {}, classList: { add() {}, remove() {}, toggle() {}, contains() { return false; } } };
sb.document.querySelectorAll = function () { return []; }; sb.document.querySelector = function () { return null; };
sb.TM = { ClassEngine: { refreshClassPhase: function () {} } };
sb.P = { ai: {}, conf: {} };
sb.GM = {
  turn: 5,
  classes: [
    { name: '农户', satisfaction: 50, influence: 40, population: 8000000 },
    { name: '军户', satisfaction: 60, influence: 55, population: 1200000 },
    { name: '士绅', satisfaction: 70, influence: 80 }
  ]
};
// renderXxx 等 UI 刷新都 typeof 守卫·不提供即跳过
vm.createContext(sb);
try {
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-game-loop.js'), 'utf8'), sb, { filename: 'tm-game-loop.js' });
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-game-loop-wentian-hardchange.js'), 'utf8'), sb, { filename: 'tm-game-loop-wentian-hardchange.js' });
} catch (e) {
  console.log('  ✗ 加载 tm-game-loop.js 失败: ' + e.message);
  process.exit(1);
}

console.log('smoke-wentian-class-hardchange');
ok(typeof sb._wtApplyHardChange === 'function', '① _wtApplyHardChange 已加载');
ok(typeof sb._wtResolveClassHardChange === 'function', '① 新增 _wtResolveClassHardChange 已加载');

function farmer() { return sb.GM.classes[0]; }
function soldier() { return sb.GM.classes[1]; }

// ── ② 满意度 set ──
let r = sb._wtApplyHardChange('classes[农户].满意度', 'set', 85);
ok(r === true && farmer().satisfaction === 85, '② classes[农户].满意度 set 85 → 真阶层 satisfaction=85·实=' + farmer().satisfaction);

// ── ③ 影响力 add ──
r = sb._wtApplyHardChange('classes[军户].影响力', 'add', 10);
ok(r === true && soldier().influence === 65, '③ classes[军户].影响力 add 10 → 55→65·实=' + soldier().influence);

// ── ④ 英文字段 + 夹取(>100→100) ──
r = sb._wtApplyHardChange('classes[士绅].satisfaction', 'set', 150);
ok(r === true && sb.GM.classes[2].satisfaction === 100, '④ 超 100 夹到 100·实=' + sb.GM.classes[2].satisfaction);

// ── ⑤ ★无幽灵属性:GM.classes 数组上不会冒出字符串键「农户」 ──
ok(!Object.prototype.hasOwnProperty.call(sb.GM.classes, '农户'), '⑤ GM.classes 数组无字符串幽灵键「农户」(旧 bug 会在此写值·真阶层不动)');

// ── ⑥ 裸阶层名形式 ──
r = sb._wtApplyHardChange('军户.满意度', 'set', 30);
ok(r === true && soldier().satisfaction === 30, '⑥ 裸名「军户.满意度」set 30 → 真阶层·实=' + soldier().satisfaction);

// ── ⑦ 影响力 mul + 负向 add ──
r = sb._wtApplyHardChange('classes[农户].influence', 'add', -100);
ok(r === true && farmer().influence === 0, '⑦ 影响力 add -100 夹到 0(不为负)·实=' + farmer().influence);

// ── ⑧ 解析器直测:别名 + 不误判 ──
const res = sb._wtResolveClassHardChange(['classes', '农户', '满意度']);
ok(res && res.field === 'satisfaction' && res.cls === farmer(), '⑧ 解析器:满意度→satisfaction·命中真农户对象');
ok(sb._wtResolveClassHardChange(['guoku', 'money']) === null, '⑧ 解析器:非阶层路径(guoku.money)不误判为阶层');
ok(sb._wtResolveClassHardChange(['classes', '农户', 'location']) === null, '⑧ 解析器:阶层无 location 字段→不接管(避免乱写)');

// ── ⑨ 源契约:prompt 含阶层路径 + 接入点 ──

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
