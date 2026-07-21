// smoke-breach-fate-menu.js — 破京定命三态菜单（批四·2026-07-21·场景交AI·宪法验菜单）
//
// owner 范式：破京当回合的定命场景由 AI 演(殉国/被俘北狩/出走勤王)·引擎只验菜单落账——
// death=仍只走裁决器(regicide·继统门生效)·captured=_captured 北狩态续玩(endturn
// _capturedSovereign 段既有消费)·escaped=驻跸于外续玩·菜单外一律按 death 兜底。
// AI 缺席回归=既有 smoke-revolt-breach(其沙箱无 RevoltInference·直落 death 旧行为)。
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
var failures = [];
function assert(cond, msg) {
  if (cond) { console.log('  PASS ' + msg); }
  else { failures.push(msg); console.log('  FAIL ' + msg); }
}

function freshSandbox(adjImpl) {
  var sb = { console: console };
  sb.window = sb; sb.global = sb;
  sb._ebs = [];
  sb.addEB = function (cat, msg) { sb._ebs.push(cat + '·' + msg); };
  if (adjImpl) sb.adjudicatePlayerDeath = adjImpl;
  sb.GM = {
    turn: 21,
    facs: [], chars: [{ name: '朱由检', isPlayer: true, alive: true }], armies: [],
    minxin: { revolts: [{ id: 'rvZ', region: '陕西', status: 'ongoing', level: 5, turn: 10, leader: '李闯' }] },
    _chronicle: []
  };
  sb.P = { conf: { revoltEntityEnabled: true } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-revolt-entity.js'), 'utf8'), sb, { filename: 'tm-revolt-entity.js' });
  return sb;
}

console.log('① captured → 北狩态续玩(不叫裁决器·不终局)');
var adjCalls = [];
var sb = freshSandbox(function () { adjCalls.push(1); return { outcome: 'gameover' }; });
var r = sb.GM.minxin.revolts[0];
sb.TM.RevoltEntity._applyBreachOutcome(sb.GM, r, { fate: 'captured', narrative: '乱军突入大内·君上为贼所执·幽于偏殿' });
var player = sb.GM.chars[0];
assert(player._captured === true && player._capturedBy === '陕西义军', '君上 _captured 竖旗·记执者(北狩态·推演既有消费)');
assert(adjCalls.length === 0 && !sb.GM._gameOver && !sb.GM._playerDead, '被俘≠死·不叫裁决器·不终局·续玩');
assert(sb.GM._dynastyFallInfo && sb.GM._dynastyFallInfo.fate === 'captured', '_dynastyFallInfo 记 captured');
assert(sb.GM._chronicle.some(function (c) { return c.type === '国变' && c.text.indexOf('幽于偏殿') >= 0; }), 'AI 场景入史');
assert(sb._ebs.some(function (e) { return e.indexOf('君上蒙尘') >= 0; }), '被俘落起居注');

console.log('② escaped → 出走勤王续玩');
var sb2 = freshSandbox(function () { failures.push('escaped 不应叫裁决器'); return {}; });
sb2.TM.RevoltEntity._applyBreachOutcome(sb2.GM, sb2.GM.minxin.revolts[0], { fate: 'escaped' });
assert(!sb2.GM.chars[0]._captured && !sb2.GM._gameOver && !sb2.GM._playerDead, '出走 → 自由身续玩');
assert(sb2.GM._dynastyFallInfo.fate === 'escaped', '_dynastyFallInfo 记 escaped');
assert(sb2._ebs.some(function (e) { return e.indexOf('勤王') >= 0; }), '出走落起居注(诏勤王)');

console.log('③ death → 仍只走裁决器(继统门生效)');
var adjCalls3 = [];
var sb3 = freshSandbox(function (ch, cause, opts) { adjCalls3.push(opts && opts.kind); return { outcome: 'succession', heir: '太子' }; });
sb3.TM.RevoltEntity._applyBreachOutcome(sb3.GM, sb3.GM.minxin.revolts[0], { fate: 'death' });
assert(adjCalls3.length === 1 && adjCalls3[0] === 'regicide', '死亡唯一产地=裁决器·kind=regicide');
assert(!sb3.GM._gameOver, 'succession → 续玩不终局');

console.log('④ 菜单外值 → 按 death 兜底(宪法验菜单)');
var adjCalls4 = [];
var sb4 = freshSandbox(function () { adjCalls4.push(1); return { outcome: 'gameover' }; });
sb4.GM._playerDead = false;
sb4.TM.RevoltEntity._applyBreachOutcome(sb4.GM, sb4.GM.minxin.revolts[0], { fate: '登仙' });
assert(adjCalls4.length === 1, '「登仙」不在菜单 → 按 death 走裁决器(禁玄幻)');

console.log('⑤ 拍2·AI 在场 → 排定命场景 job·不立即裁决');
var sched = [];
var sb5 = freshSandbox(function () { failures.push('AI 排程路径不应立即裁决'); return {}; });
sb5.TM.RevoltInference = { aiOn: function () { return true; }, scheduleBreachScene: function (G, rr) { sched.push(rr.id); } };
var r5 = sb5.GM.minxin.revolts[0];
r5._breachMarch = { started: 20, marched: 20 };
sb5.TM.RevoltEntity.sync(sb5.GM);  // turn 21 → 拍2
assert(r5._breachDone === true && sb5.GM._capitalFallen === true, '拍2 破京落账照常');
assert(sched.length === 1 && sched[0] === 'rvZ', '定命交 AI 场景 job·引擎不抢戏');
assert(!sb5.GM._gameOver && !sb5.GM._playerDead, '等 AI 场景期间不终局');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-breach-fate-menu: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-breach-fate-menu (北狩续玩/出走续玩/死亡唯一产地裁决器/菜单外兜底/AI排程不抢戏)');
