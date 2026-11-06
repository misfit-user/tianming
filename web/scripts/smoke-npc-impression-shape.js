#!/usr/bin/env node
// smoke-npc-impression-shape.js
// 2026-11-06·印象条目统一取用口（NpcMemorySystem._impressionEntry）。
//   案由：天启七年剧本给杨鹤手写了 18 条 _impressions，样子是 { favor, note }，没有 events。
//   remember() 原先直接 imp.events.push，AI 一给杨鹤写忠诚/压力（char_updates，|Δ|和≥3）就抛
//   「Cannot read properties of undefined (reading 'push')」，连累同一批写回整批回滚。
//   修法：印象的样子只由 _impressionEntry 定（favor 有限数、events 数组、其余字段原样留），
//   remember() 与 monthlyDecay() 这两个写口都走它；getImpression() 只读、认得旧样子。
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const ROOT = path.resolve(__dirname, '..');
let passed = 0, failed = 0;
function ok(cond, msg) { if (cond) { passed++; console.log('  ok - ' + msg); } else { failed++; console.error('  ✗ ' + msg); } }

function load(chars) {
  const game = { turn: 3, chars };
  const ctx = { GM: game, P: {}, console: { log() {}, warn() {}, error() {}, info() {} },
    Math, JSON, Date, setTimeout() {}, clearTimeout() {} };
  ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-mechanics-memory.js'), 'utf8'), ctx, { filename: 'tm-mechanics-memory.js' });
  return { ctx, game, NMS: ctx.NpcMemorySystem };
}

console.log('===== 剧本手写的 { favor, note }（无 events） =====');
(function () {
  const yang = { name: '杨鹤', alive: true, _impressions: {
    '朱由检': { favor: 25, note: '新帝·未见其面·然东林盛传其英果·老臣寄望极深' },
    '魏忠贤': { favor: -60, note: '阉党之首·天启四年构陷东林·鹤被其党劾归' }
  } };
  const { NMS } = load([yang, { name: '朱由检', alive: true }, { name: '魏忠贤', alive: true }]);
  let err = null;
  try { NMS.remember('杨鹤', '起复总理陕西赈济，感恩图报', '喜', 8, '朱由检'); } catch (e) { err = e; }
  ok(!err, 'remember() 碰到无 events 的剧本印象不再抛错' + (err ? '（' + err.message + '）' : ''));
  const imp = yang._impressions['朱由检'];
  ok(Array.isArray(imp.events) && imp.events.length === 1 && /起复总理陕西赈济/.test(imp.events[0]), '事件记进 events');
  ok(imp.favor > 25 && imp.favor <= 100, '好感按「喜」上调（25→' + imp.favor + '）');
  ok(imp.note === '新帝·未见其面·然东林盛传其英果·老臣寄望极深', '剧本写的 note 原样保留');
  ok(!('events' in yang._impressions['魏忠贤']), '没被写到的条目不顺手改（只读路径不规整）');
  ok(NMS.getImpression('杨鹤', '魏忠贤') === -60, 'getImpression 读剧本样子的条目');
})();

console.log('===== 旧档里只存一个数的印象 =====');
(function () {
  const ch = { name: '崔呈秀', alive: true, _impressions: { '魏忠贤': 40 } };
  const { NMS } = load([ch, { name: '魏忠贤', alive: true }]);
  ok(NMS.getImpression('崔呈秀', '魏忠贤') === 40, 'getImpression 读数字样子');
  ok(ch._impressions['魏忠贤'] === 40, 'getImpression 只读，不改条目');
  let err = null;
  try { NMS.remember('崔呈秀', '九千岁解职，恐祸及己身', '怒', 8, '魏忠贤'); } catch (e) { err = e; }
  ok(!err, 'remember() 碰到数字样子不抛错' + (err ? '（' + err.message + '）' : ''));
  const imp = ch._impressions['魏忠贤'];
  ok(imp && typeof imp === 'object' && Array.isArray(imp.events) && imp.events.length === 1, '数字样子写入时规整成 { favor, events }');
  ok(imp.favor < 40, '好感按「怒」下调（40→' + imp.favor + '）');
})();

console.log('===== 没有条目时新建 =====');
(function () {
  const ch = { name: '王承恩', alive: true };
  const { NMS } = load([ch, { name: '朱由检', alive: true }]);
  NMS.remember('王承恩', '奉旨暗接宫门宿卫', '敬', 7, '朱由检');
  const imp = ch._impressions && ch._impressions['朱由检'];
  ok(imp && typeof imp.favor === 'number' && Array.isArray(imp.events) && imp.events.length === 1, '新建条目为 { favor, events }');
})();

console.log('===== 统一口本身 =====');
(function () {
  const { NMS } = load([]);
  ok(typeof NMS._impressionEntry === 'function', '_impressionEntry 已导出在 NpcMemorySystem 上');
  const ch = { name: '甲', _impressions: { 乙: { favor: '12', note: 'n' }, 丙: { favor: 'abc' }, 丁: { favor: 500, events: ['旧事'] }, 戊: null } };
  const a = NMS._impressionEntry(ch, '乙'), b = NMS._impressionEntry(ch, '丙'), c = NMS._impressionEntry(ch, '丁'), d = NMS._impressionEntry(ch, '戊');
  ok(a.favor === 12 && a.note === 'n' && Array.isArray(a.events), '字符串好感转成数，note 保留');
  ok(b.favor === 0, '不是数的好感归零');
  ok(c.favor === 100 && c.events.length === 1 && c.events[0] === '旧事', '好感钳到 ±100，原有 events 不动');
  ok(d.favor === 0 && Array.isArray(d.events) && ch._impressions['戊'] === d, '空条目补成新条目并挂回');
  ok(NMS._impressionEntry(ch, '乙') === a, '再取得到同一个对象（原物规整，不换新）');
})();

console.log('===== 月度衰减也走统一口 =====');
(function () {
  const ch = { name: '杨鹤', alive: true, _impressions: { '韩爌': { favor: 50, note: '东林前辈·同道' }, '徐光启': 40 } };
  const { NMS, game } = load([ch]);
  let err = null;
  try { NMS.monthlyDecay(); } catch (e) { err = e; }
  ok(!err, 'monthlyDecay() 碰到剧本样子与数字样子不抛错' + (err ? '（' + err.message + '）' : ''));
  const h = ch._impressions['韩爌'], x = ch._impressions['徐光启'];
  ok(h && Math.abs(h.favor - 49.6) < 1e-9 && h.note === '东林前辈·同道', '剧本样子照常衰减（50→' + (h && h.favor) + '），note 保留');
  ok(x && typeof x === 'object' && Math.abs(x.favor - 39.6) < 1e-9, '数字样子规整后照常衰减（40→' + (x && x.favor) + '）');
  ok(game.turn === 3, '衰减不动回合');
})();

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed) process.exit(1);
