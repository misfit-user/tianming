#!/usr/bin/env node
'use strict';
/* smoke-agency-covert-report — 谍报S3·暗流风闻（2026-07-06·方向五谍报线收官）防腐线。
 * 常侦(S1)+阴谋密报(S2)之上：推演暗流(sc15 hidden_moves→followup 落 GM._recentHiddenMoves 缓冲)
 * 亦入密探耳目·效力门槛+每回合2报+同人同类8回合窗防重+措辞留白。
 * §a 行为(vm 切片实跑 _agencyWatch S3 段)  §b S2 零回归  §c 接线契约 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-agency-covert-report');

var src = read('tm-conspiracy.js');
var s = src.indexOf('function _agencyWatchOn');
var e = src.indexOf('// 玩家反制总入口');
ok(s >= 0 && e > s, '切片边界在(_agencyWatchOn.._agencyWatch)');
var PRE = "var CFG = { agencyBase: 6, agencyCap: 16, agencyIndepMax: 30 };\n"
        + "function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }\n"
        + "var __plots = [];\n"
        + "function activePlots() { return __plots; }\n"
        + "function _G() { return null; }\n";
var code = PRE + src.slice(s, e);

function mkCtx(flagOn) {
  var ctx = { P: { conf: { agencyWatchEnabled: flagOn !== false } }, Math: Math, Number: Number, Array: Array, console: console };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'agency-slice.js' });
  return ctx;
}
function mkG(moves, opts) {
  opts = opts || {};
  return {
    turn: 20,
    corruption: { supervision: { institutions: [ opts.weak
      ? { independence: 5, radius: 30, corruption: 0, vacancies: 0 }
      : { independence: 5, radius: 100, corruption: 0, vacancies: 0 } ] } },
    currentIssues: [],
    chars: [{ name: '王体乾', alive: true }, { name: '李永贞', alive: true }, { name: '崔呈秀', alive: true }, { name: '亡者', alive: false }, { name: '帝', isPlayer: true, alive: true }],
    _recentHiddenMoves: { turn: (opts.bufTurn != null ? opts.bufTurn : 19), moves: moves },
    _agencyMoveReported: opts.seen || []
  };
}

/* ── §a 行为 ─────────────────────────────────────────────────── */
console.log('— §a · 暗流风闻行为 —');
(function () {
  var ctx = mkCtx();
  var G = mkG([
    { actor: '王体乾', text: '深夜密会边将私议粮饷' },
    { actor: '李永贞', text: '暗中收受盐商重贿' }
  ]);
  var intensity = ctx._agencyWatch(G);
  ok(intensity === 6, '满效衙门 intensity=6(过风闻门槛)');
  var spyMoves = G.currentIssues.filter(function (i) { return i.id.indexOf('iss_spy_move_') === 0; });
  ok(spyMoves.length === 2, '两条暗流→两条密探风闻入御案 (得 ' + spyMoves.length + ')');
  ok(spyMoves[0].title.indexOf('密探风闻') === 0 && spyMoves[0]._spyReport === true, '风闻题头+_spyReport 标');
  ok(spyMoves.every(function (i) { return i.description.indexOf('迹类') >= 0 && i.description.indexOf('未得实据') >= 0; }), '措辞留白(迹类X·未得实据)');
  ok(spyMoves.every(function (i) { return i.description.indexOf('密会') < 0 && i.description.indexOf('重贿') < 0; }), '★不给原文(真相要玩家穷治)');
  ok(spyMoves.some(function (i) { return i.description.indexOf('暗结朋党') >= 0; }) && spyMoves.some(function (i) { return i.description.indexOf('贿门私通') >= 0; }), '风闻类别按行迹派生');
  ok(spyMoves.every(function (i) { return i.description.indexOf('查办') >= 0; }), '附查办指引(接既有反制扫描闭环)');

  // 防重：同 G 再跑一轮·同人同类 8 回合窗内不重报
  var before = G.currentIssues.length;
  ctx._agencyWatch(G);
  ok(G.currentIssues.length === before, '同人同类 8 回合窗内不重报');
  // 窗过期(>8回合)可再报
  var G2 = mkG([{ actor: '王体乾', text: '又与人密会串联' }], { seen: [{ k: '王体乾·暗结朋党', turn: 10 }] });
  ctx._agencyWatch(G2);
  ok(G2.currentIssues.length === 1, '窗过期(20-10>=8)重现行迹可再报');

  // 每回合封顶 2
  var G3 = mkG([
    { actor: '王体乾', text: '私蓄甲兵' }, { actor: '李永贞', text: '联络外藩' }, { actor: '崔呈秀', text: '广收门生结党' }
  ]);
  ctx._agencyWatch(G3);
  ok(G3.currentIssues.filter(function (i) { return i.id.indexOf('iss_spy_move_') === 0; }).length === 2, '每回合至多2报(密探人手有限)');

  // 查无此人/死者/陛下不报
  var G4 = mkG([
    { actor: '不存在者', text: '密谋' }, { actor: '亡者', text: '密谋' }, { actor: '帝', text: '密谋' }
  ]);
  ctx._agencyWatch(G4);
  ok(G4.currentIssues.length === 0, '查无此人/已故/陛下本人——皆不报');

  // 弱衙门(效力不足)捕不到暗流
  var G5 = mkG([{ actor: '王体乾', text: '密会' }], { weak: true });
  var i5 = ctx._agencyWatch(G5);
  ok(i5 < 6 && G5.currentIssues.length === 0, '弱衙门(intensity<6)捕不到暗流');

  // 陈年缓冲不报
  var G6 = mkG([{ actor: '王体乾', text: '密会' }], { bufTurn: 10 });
  ctx._agencyWatch(G6);
  ok(G6.currentIssues.length === 0, '陈年缓冲(>2回合)不报');

  // flag 关全停
  var ctxOff = mkCtx(false);
  var G7 = mkG([{ actor: '王体乾', text: '密会' }]);
  ok(ctxOff._agencyWatch(G7) === 0 && G7.currentIssues.length === 0, 'flag 关→常侦整体停(含风闻)');

  // 防重窗口 cap 24
  var seed = [];
  for (var i = 0; i < 30; i++) seed.push({ k: 'x' + i, turn: 1 });
  var G8 = mkG([{ actor: '王体乾', text: '密会串联' }], { seen: seed });
  ctx._agencyWatch(G8);
  ok(G8._agencyMoveReported.length <= 24, '防重窗口封顶24(就地截断)');
})();

/* ── §b S2 零回归 ────────────────────────────────────────────── */
console.log('— §b · S2 阴谋密报零回归 —');
(function () {
  var ctx = mkCtx();
  ctx.__plots.length = 0;
  ctx.__plots.push({ id: 'p1', ringleader: '崔呈秀', conspirators: ['甲', '乙'], momentum: 72, exposure: 60, _knownToPlayer: true });
  var G = mkG([]);
  G._recentHiddenMoves = null;
  ctx._agencyWatch(G);
  var s2 = G.currentIssues.filter(function (i) { return i.id === 'iss_spy_p1'; });
  ok(s2.length === 1 && s2[0].title.indexOf('密探回禀') === 0, 'S2 阴谋密报照旧(密探回禀·每谋一报)');
  ok(ctx.__plots[0].exposure === 66, 'S1 常侦推 exposure 照旧(60+6)');
  ctx.__plots.length = 0;
})();

console.log('\nsmoke-agency-covert-report ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
