#!/usr/bin/env node
'use strict';
/* smoke-party-class-v3style — 党派阶层 V3式升级（2026-07-03）防腐线。
 * V4a 政柄格局(秉政/在野/边缘+双齿)  V4b 政治运动(凝成/壮大/退潮+激进⑥项)
 * V4c 合法性失衡喂运动生长          曝光面(正册/校准快照/UI helpers)
 * 运动引擎行为级(vm 实跑 SocialFoundation)·政柄块与曝光面源码契约级。 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-party-class-v3style');

/* ── V4b · 行为级：政治运动生命周期 ───────────────────────────── */
console.log('— V4b · 政治运动(行为) —');
var ctx = { console: { log: function(){}, warn: function(){}, error: function(){} }, Math: Math, JSON: JSON, Object: Object, Array: Array, String: String, Number: Number, Boolean: Boolean, Date: Date, parseInt: parseInt, parseFloat: parseFloat, isNaN: isNaN, isFinite: isFinite };
ctx.window = ctx; ctx.global = ctx; ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(read('tm-engine-constants.js'), ctx, { filename: 'tm-engine-constants.js' });
vm.runInContext(read('tm-social-foundation.js'), ctx, { filename: 'tm-social-foundation.js' });
var SF = ctx.TM.SocialFoundation;
ok(typeof SF.tickMovements === 'function' && typeof SF.classMovementLoad === 'function', '运动 API 导出');

function mkCls(name, items) {
  return { name: name, satisfaction: 40, _agenda: { items: items } };
}
var GMx = { turn: 10, classes: [] };
var clsA = mkCls('自耕农', [{ kind: 'tax', text: '减赋·罢加派', urgency: 3, sinceTurn: 4 }]);   // 高急·已持续6回合
var clsB = mkCls('商贾', [{ kind: 'war', text: '靖海路', urgency: 2, sinceTurn: 4 }]);          // 急度不足
GMx.classes = [clsA, clsB];
SF.tickMovements(GMx, GMx.classes, 10);
ok(Array.isArray(GMx._politicalMovements) && GMx._politicalMovements.length === 1, '高急持续诉求凝成运动·急度不足不凝 (' + GMx._politicalMovements.length + ')');
var mv = GMx._politicalMovements[0];
ok(mv.className === '自耕农' && mv.support === 26 && mv.phase === '初起', '初凝 support=20+6 初起 (得 ' + mv.support + '/' + mv.phase + ')');
SF.tickMovements(GMx, GMx.classes, 11);
SF.tickMovements(GMx, GMx.classes, 12);
ok(mv.support === 38, '未偿逐回合壮大 +6 (得 ' + mv.support + ')');
GMx._legitimacy = { divergence: -30 };   // 天命权重失衡(缙绅离心)
SF.tickMovements(GMx, GMx.classes, 13);
ok(mv.support === 48 && mv.phase === '成势', 'V4c 合法性失衡时生长加速 +10·跨成势线 (得 ' + mv.support + '/' + mv.phase + ')');
ok(SF.classMovementLoad(GMx, clsA) === 0.07 && SF.classMovementLoad(GMx, clsB) === 0, '激进⑥项按运动势位取档(成势0.07/无运动0)');
GMx._legitimacy = null;
for (var t = 14; t <= 17; t++) SF.tickMovements(GMx, GMx.classes, t);
ok(mv.support >= 70 && mv.phase === '鼎沸' && SF.classMovementLoad(GMx, clsA) === 0.15, '持续未偿至鼎沸·激进⑥项 0.15 (得 ' + mv.support + ')');
clsA._agenda.items = [];   // 诉求得偿/消失
SF.tickMovements(GMx, GMx.classes, 18);
var afterDecay = GMx._politicalMovements.length && GMx._politicalMovements[0].support;
ok(afterDecay < 72 && afterDecay > 0, '诉求不再活跃→退潮 -18/回合 (得 ' + afterDecay + ')');
for (var t2 = 19; t2 <= 24; t2++) SF.tickMovements(GMx, GMx.classes, t2);
ok(GMx._politicalMovements.length === 0, '退潮归零除名·运动消散');

/* ── V4b · 行为级：激进项⑥⑦真进 pressure ────────────────────── */
console.log('— V4b/V4a · 激进⑥⑦项(行为) —');
(function() {
  var G2 = { turn: 20, huangwei: { index: 80 }, _politicalMovements: [{ key: '织户·tax', className: '织户', kind: 'tax', label: '罢机税', support: 75, phase: '鼎沸' }] };
  var base = { name: '织户', satisfaction: 50, _agenda: { items: [] } };
  var withMv = { name: '织户', satisfaction: 50, _agenda: { items: [] } };
  var noMv = { name: '灶户', satisfaction: 50, _agenda: { items: [] } };
  SF.tickClassRadical(G2, withMv, {}, 20);
  SF.tickClassRadical(G2, noMv, {}, 20);
  ok((withMv._radicalFrac || 0) > (noMv._radicalFrac || 0), '鼎沸运动阶层激进压力更高 (' + withMv._radicalFrac + ' vs ' + noMv._radicalFrac + ')');
  var marg = { name: '灶户', satisfaction: 50, _agenda: { items: [] }, _marginalPatronTurn: 20 };
  var margFree = { name: '灶户乙', satisfaction: 50, _agenda: { items: [] } };
  SF.tickClassRadical(G2, marg, {}, 20);
  SF.tickClassRadical(G2, margFree, {}, 20);
  ok((marg._radicalPressure || 0) > (margFree._radicalPressure || 0), '⑦奥援边缘化项进 pressure (' + marg._radicalPressure + ' vs ' + margFree._radicalPressure + ')');
})();

/* ── V4a · 政柄格局(契约) ────────────────────────────────────── */
console.log('— V4a · 政柄格局(契约) —');

/* ── 曝光面(契约) ────────────────────────────────────────────── */
console.log('— 曝光面(契约) —');
console.log('— 叙事面(契约·V3机制入时政记/实录/戏说) —');

console.log('\nsmoke-party-class-v3style ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);
