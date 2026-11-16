#!/usr/bin/env node
'use strict';
/* smoke-goal-axis-repair — 目标轴修复（2026-07-06）防腐线。
 * 病根：目标引擎/UI槽全在·但天启五目标用引擎不认的 turn_before 永不达成·绍宋五目标无 conditions 永0进度·
 *       且 checkGoals 藏通关哑弹(_showVictoryScreen·违「无胜利判定」铁律·因目标失效从未触发)。
 * §a 引擎新分支(turn_before/turn_between)  §b 达成→里程碑·通关哑弹已拆  §c 官方剧本目标可评估  §d 侧栏进度契约 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-goal-axis-repair');

var src = read('tm-endturn-helpers.js');
var s = src.indexOf('function _evalGoalCondition');
var e = src.indexOf('function _showVictoryScreen');
ok(s >= 0 && e > s, '切片边界在(_evalGoalCondition..checkGoals)');
var code = src.slice(s, e);

function mk(turn, vars, goals, chars) {
  var log = { ebs: [], victory: 0, defeat: 0, biannian: [] };
  var ctx = {
    GM: { turn: turn, vars: vars || {}, chars: chars || [], biannianItems: log.biannian },
    P: { goals: goals },
    addEB: function (cat, txt) { log.ebs.push(cat + '|' + txt); },
    setTimeout: function (fn) { fn(); },
    getTSText: function () { return 'T'; },
    _dbg: function () {},
    TM: { safeEval: function () { return false; } },
    _showVictoryScreen: function () { log.victory++; },
    _showDefeatScreen: function () { log.defeat++; },
    Math: Math, Number: Number, Array: Array, console: console
  };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'goal-slice.js' });
  return { ctx: ctx, log: log };
}

/* ── §a 引擎新分支 ────────────────────────────────────────────── */
console.log('— §a · turn_before/turn_between —');
(function () {
  var h = mk(5, {}, []);
  ok(h.ctx._evalGoalCondition({ type: 'turn_before', value: 6 }) === true, 'turn_before：限内(5<=6)为真');
  var h2 = mk(7, {}, []);
  ok(h2.ctx._evalGoalCondition({ type: 'turn_before', value: 6 }) === false, 'turn_before：过期(7>6)为假');
  ok(h.ctx._evalGoalCondition({ type: 'turn_between', from: 3, to: 8 }) === true, 'turn_between：窗内为真');
  var h3 = mk(9, {}, []);
  ok(h3.ctx._evalGoalCondition({ type: 'turn_between', from: 3, to: 8 }) === false, 'turn_between：窗外为假');
})();

/* ── §b 达成→里程碑·哑弹已拆 ─────────────────────────────────── */
console.log('— §b · 达成里程碑·通关哑弹已拆 —');
(function () {
  // 天启形目标(milestone+turn_before)·条件齐→达成
  var tqGoal = { name: '诛魏忠贤·平阉党', type: 'milestone', conditions: [
    { type: 'variable_lte', variable: '阉党权势值', value: 20 },
    { type: 'variable_gte', variable: '皇威', value: 55 },
    { type: 'turn_before', value: 6 }
  ] };
  var h = mk(5, { '阉党权势值': { value: 18 }, '皇威': { value: 60 } }, [tqGoal]);
  h.ctx.checkGoals();
  ok(tqGoal.completed === true && tqGoal.progress === 100, '天启形目标条件齐→达成(引擎修复后真能成)');
  ok(h.log.ebs.some(function (x) { return x.indexOf('里程碑|达成：诛魏忠贤') === 0; }), '达成记里程碑事件');
  ok(h.log.biannian.length === 1 && h.log.biannian[0].title.indexOf('里程碑') === 0, '入编年');

  // 部分达成→进度真在动
  var tqGoal2 = { name: '诛魏忠贤·平阉党', type: 'milestone', conditions: tqGoal.conditions };
  var h2 = mk(5, { '阉党权势值': { value: 60 }, '皇威': { value: 60 } }, [tqGoal2]);
  h2.ctx.checkGoals();
  ok(tqGoal2.completed !== true && tqGoal2.progress === 67, '条件2/3→进度67%·不再纹丝不动');

  // 限期已过→永不达成(进度封在未竟)
  var tqGoal3 = { name: '诛魏忠贤·平阉党', type: 'milestone', conditions: tqGoal.conditions };
  var h3 = mk(10, { '阉党权势值': { value: 18 }, '皇威': { value: 60 } }, [tqGoal3]);
  h3.ctx.checkGoals();
  ok(tqGoal3.completed !== true, '限期已过(turn10>6)→不达成(限期语义)');

  // ★通关哑弹已拆：全部 winCondition 目标达成→只聚合里程碑·不弹胜利屏
  var w1 = { name: '大业一', winCondition: 'x', conditions: [{ type: 'turn_reached', value: 1 }] };
  var w2 = { name: '大业二', winCondition: 'y', conditions: [{ type: 'turn_reached', value: 1 }] };
  var h4 = mk(5, {}, [w1, w2]);
  h4.ctx.checkGoals();
  ok(w1.completed && w2.completed, '两 winCondition 目标均达成');
  ok(h4.log.victory === 0, '★不弹 _showVictoryScreen(无胜利判定铁律)');
  ok(h4.log.ebs.some(function (x) { return x.indexOf('诸大业俱成') >= 0; }), '聚合里程碑「诸大业俱成」入事件');
  ok(!h4.log.ebs.some(function (x) { return x.indexOf('胜利|') === 0; }), '无「胜利」类事件');

  // loseCondition 照旧触发败局·且不记里程碑
  var lg = { name: '社稷倾', loseCondition: true, conditions: [{ type: 'turn_reached', value: 1 }] };
  var h5 = mk(5, {}, [lg]);
  h5.ctx.checkGoals();
  ok(h5.log.defeat === 1, 'loseCondition 目标照旧触发败局屏(亡国可做)');
  ok(!h5.log.ebs.some(function (x) { return x.indexOf('里程碑|') === 0; }), '败因目标不记里程碑');
})();

/* ── §c 官方剧本目标可评估 ────────────────────────────────────── */
console.log('— §c · 官方剧本目标 —');
(function () {
  // 官方根 JSON 是唯一真源；web/scenarios/*.js 只是紧凑生成物，不能再靠其格式/空格切片。
  var ss = JSON.parse(read('../scenarios/绍宋·建炎元年八月（官方）.json'));
  var ssGoals = Array.isArray(ss.goals) ? ss.goals : [];
  ok(ssGoals.length === 5 && ssGoals.every(function(g) { return Array.isArray(g.conditions) && g.conditions.length > 0; }), '绍宋五目标全配 conditions(不再是纯装饰文本)');
  var ssConditions = JSON.stringify(ssGoals.map(function(g) { return g.conditions; }));
  ok(ssConditions.indexOf('苗刘伏笔压力') >= 0 && ssConditions.indexOf('宗泽') >= 0, '条件用剧本真变量/真人物(苗刘伏笔压力/宗泽)');
  ok(ssGoals.every(function(g) { return g.type === 'milestone'; }), '绍宋五目标全标 milestone');
  var tq = JSON.parse(read('../scenarios/天启七年·九月（官方）.json'));
  ok((tq.goals || []).some(function(g) { return (g.conditions || []).some(function(c) { return c.type === 'turn_before'; }); }), '天启目标 turn_before 原样保留(引擎已认)');
  // 绍宋阈值须高于开局值(防第1回合白送)：民心35→55·皇权35→50·御营纪律35→60
  var h = mk(1, { '民心': { value: 35 }, '皇权': { value: 35 } }, [
    { name: '稳东南', type: 'milestone', conditions: [
      { type: 'variable_gte', variable: '民心', value: 55 },
      { type: 'variable_gte', variable: '皇权', value: 50 },
      { type: 'turn_before', value: 18 }
    ] }
  ]);
  h.ctx.checkGoals();
  ok(h.ctx.P.goals[0].completed !== true && h.ctx.P.goals[0].progress === 33, '开局值不白送(仅 turn_before 满足=33%)');
})();

console.log('\nsmoke-goal-axis-repair ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
