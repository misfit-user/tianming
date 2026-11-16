#!/usr/bin/env node
// smoke-wentian-facparty-hardchange.js
// 验证「问天无法修改势力/党派数值」已治:_wtApplyHardChange 给 facs(势力)/parties(党派) 补按名解析器·
// facs[势力名].strength/economy/playerRelation 与 parties[党派名].influence/cohesion 真写进对象(夹取)·
// 不再落数组幽灵属性静默失败(与已修阶层/军队 bug 同根)。
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
sb.TM = { ClassEngine: { refreshClassPhase: function () {} }, AIChange: { Army: { applyAIArmyChange: function () {}, refreshMilitaryViews: function () {} } } };
sb.P = { ai: {}, conf: {} };
sb.GM = {
  turn: 5,
  facs: [
    { name: '后金', strength: 70, economy: 60, playerRelation: -80 },
    { name: '明朝廷', strength: 50, economy: 50, playerRelation: 100 },
    { name: '蒙古', strength: 40, economy: 30, playerRelation: -20 }
  ],
  parties: [
    { name: '东林党', influence: 60, cohesion: 70 },
    { name: '阉党', influence: 75, cohesion: 50 }
  ]
};
vm.createContext(sb);
try {
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-game-loop.js'), 'utf8'), sb, { filename: 'tm-game-loop.js' });
  vm.runInContext(fs.readFileSync(path.join(WEB, 'tm-game-loop-wentian-hardchange.js'), 'utf8'), sb, { filename: 'tm-game-loop-wentian-hardchange.js' });
} catch (e) {
  console.log('  ✗ 加载 tm-game-loop.js 失败: ' + e.message);
  process.exit(1);
}

console.log('smoke-wentian-facparty-hardchange');
ok(typeof sb._wtApplyHardChange === 'function', '① _wtApplyHardChange 已加载');
ok(typeof sb._wtResolveFacHardChange === 'function', '① 新增 _wtResolveFacHardChange 已加载');
ok(typeof sb._wtResolvePartyHardChange === 'function', '① 新增 _wtResolvePartyHardChange 已加载');

const houjin = () => sb.GM.facs[0];
const ming = () => sb.GM.facs[1];
const menggu = () => sb.GM.facs[2];
const donglin = () => sb.GM.parties[0];
const yandang = () => sb.GM.parties[1];

// ── ② 势力实力 set ──
let r = sb._wtApplyHardChange('facs[后金].实力', 'set', 30);
ok(r === true && houjin().strength === 30, '② facs[后金].实力 set 30 → 真势力 strength=30·实=' + houjin().strength);

// ── ③ 势力经济 add ──
r = sb._wtApplyHardChange('facs[后金].经济', 'add', 20);
ok(r === true && houjin().economy === 80, '③ facs[后金].经济 add 20 → 60→80·实=' + houjin().economy);

// ── ④ 对玩家关系 set + 负向夹取(-150→-100) ──
r = sb._wtApplyHardChange('facs[后金].对玩家关系', 'set', -150);
ok(r === true && houjin().playerRelation === -100, '④ 对玩家关系 set -150 夹到 -100·实=' + houjin().playerRelation);

// ── ⑤ playerRelation 英文字段 + 正向夹取(200→100) ──
r = sb._wtApplyHardChange('facs[明朝廷].playerRelation', 'set', 200);
ok(r === true && ming().playerRelation === 100, '⑤ playerRelation set 200 夹到 100·实=' + ming().playerRelation);

// ── ⑥ strength 夹底(<0→0) ──
r = sb._wtApplyHardChange('facs[明朝廷].strength', 'add', -200);
ok(r === true && ming().strength === 0, '⑥ strength add -200 夹到 0(不为负)·实=' + ming().strength);

// ── ⑦ 裸势力名形式 ──
r = sb._wtApplyHardChange('蒙古.实力', 'set', 55);
ok(r === true && menggu().strength === 55, '⑦ 裸名「蒙古.实力」set 55 → 真势力·实=' + menggu().strength);

// ── ⑧ ★swap-test:GM.facs 数组上不会冒出字符串幽灵键「后金」 ──
ok(!Object.prototype.hasOwnProperty.call(sb.GM.facs, '后金'), '⑧ GM.facs 数组无字符串幽灵键「后金」(旧 bug 会在此写值·真势力不动)');

// ── ⑨ 党派影响力 set ──
r = sb._wtApplyHardChange('parties[东林党].影响力', 'set', 90);
ok(r === true && donglin().influence === 90, '⑨ parties[东林党].影响力 set 90 → 真党派 influence=90·实=' + donglin().influence);

// ── ⑩ 党派凝聚力 add + 夹底 ──
r = sb._wtApplyHardChange('parties[阉党].凝聚力', 'add', -100);
ok(r === true && yandang().cohesion === 0, '⑩ 凝聚力 add -100 夹到 0·实=' + yandang().cohesion);

// ── ⑪ 裸党派名 + cohesion 英文 ──
r = sb._wtApplyHardChange('东林党.cohesion', 'set', 55);
ok(r === true && donglin().cohesion === 55, '⑪ 裸名「东林党.cohesion」set 55 → 真党派·实=' + donglin().cohesion);

// ── ⑫ ★swap-test:GM.parties 数组无字符串幽灵键「东林党」 ──
ok(!Object.prototype.hasOwnProperty.call(sb.GM.parties, '东林党'), '⑫ GM.parties 数组无字符串幽灵键「东林党」');

// ── ⑬ 解析器直测:势力别名 + 命中真对象 ──
let res = sb._wtResolveFacHardChange(['facs', '后金', '实力']);
ok(res && res.field === 'strength' && res.fac === houjin(), '⑬ fac 解析器:实力→strength·命中真后金对象');
res = sb._wtResolvePartyHardChange(['党派', '东林党', '影响力']);
ok(res && res.field === 'influence' && res.party === donglin(), '⑬ party 解析器:影响力→influence·命中真东林党对象');

// ── ⑭ 白名单:非 fac/party 路径不误判 ──
ok(sb._wtResolveFacHardChange(['guoku', 'money']) === null, '⑭ fac 解析器:非势力路径(guoku.money)不误判');
ok(sb._wtResolveFacHardChange(['facs', '后金', 'location']) === null, '⑭ fac 解析器:势力无 location 字段→不接管(避免乱写)');
ok(sb._wtResolvePartyHardChange(['后金', 'strength']) === null, '⑭ party 解析器:后金(势力非党派)+strength(非党派字段)→不误判');

// ── ⑮ 不串台:阶层/军队仍各归各(回归) ──
ok(typeof sb._wtResolveClassHardChange === 'function' && sb._wtResolveClassHardChange(['classes', '后金', 'satisfaction']) === null, '⑮ 阶层解析器对势力名(后金)返回 null·不串台');

// ── ⑯ 源契约:prompt 含 facs/parties 路径 + 接入点 ──

console.log('\n结果: ' + pass + ' 通过 / ' + fail + ' 失败');
process.exit(fail ? 1 : 0);
