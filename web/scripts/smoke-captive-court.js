// smoke-captive-court.js — 悬朝演绎层·北狩残局朝廷侧（批七·2026-07-21）
//
// owner 三拍板：①立新君交 AI(朝臣自行酝酿·玩家失控才是北狩之痛) ②玩家继续演太上皇
// ③夺门=复辟旨即谋划(诏令管线·AI 断成败)。本 smoke 不经真 AI：canned 决断直灌
// _applyCourtOutcome 验宪法闸——立新君三验(须真被虏/人选活人非俘非玩家/不重复立)·
// 太上皇称号迁转·夺门三闸(君已归+新君在位+真有复辟旨)·谋泄冷却·兜底轨(被虏6回合自立储君)。
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

function freshSandbox() {
  var sb = { console: console };
  sb.window = sb; sb.global = sb;
  sb._ebs = [];
  sb.addEB = function (cat, msg) { sb._ebs.push(cat + '·' + msg); };
  sb.GM = {
    turn: 30,
    eraName: '社稷非常',
    huangwei: { index: 40 },
    chars: [
      { name: '朱祁镇', isPlayer: true, alive: true, officialTitle: '大明皇帝', family: '朱', childrenIds: ['朱见深'] },
      { name: '朱见深', alive: true, family: '朱', officialTitle: '皇太子' },
      { name: '朱祁钰', alive: true, family: '朱', officialTitle: '亲王' },
      { name: '于谦', alive: true, faction: '朝廷', officialTitle: '兵部尚书', loyalty: 90 }
    ],
    _edictTracker: [],
    _chronicle: []
  };
  sb.P = { conf: { revoltEntityEnabled: true } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-captive-court.js'), 'utf8'), sb, { filename: 'tm-captive-court.js' });
  return sb;
}

console.log('① 立新君宪法三验');
var sb = freshSandbox();
var CC = sb.TM.CaptiveCourt;
var GM = sb.GM;
var player = GM.chars[0];
var r0 = CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '朱祁钰' });
assert(r0.ok === false, '君上未被虏 → 不得另立(闸)');
player._captured = true; player._capturedBy = '瓦剌'; player._capturedLocation = '瓦剌军中';
assert(CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '不存在的人' }).ok === false, '人选不在档 → 拦');
assert(CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '朱祁镇' }).ok === false, '不得立被虏的玩家自己');
var r1 = CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '朱祁钰', narrative: '主战派定策·奉亲王践祚' });
assert(r1.ok === true && GM._rivalEmperor && GM._rivalEmperor.name === '朱祁钰', '立新君落账 _rivalEmperor');
assert(GM.chars[2]._enthroned === true, '新君 _enthroned 竖旗');
assert(player.officialTitle === '太上皇' && player._preCaptureTitle === '大明皇帝', '拍板②：玩家尊为太上皇·原号留档');
assert(CC._applyCourtOutcome(GM, { type: 'proclaim_new', name: '朱见深' }).ok === false, '已立新君 → 不重复立');
assert(sb._ebs.some(function (e) { return e.indexOf('一朝二主') >= 0; }), '立新君落起居注');
assert(GM._chronicle.some(function (c) { return c.text.indexOf('主战派定策') >= 0; }), 'AI 叙事入史');

console.log('② 夺门三闸：君在虏营拦·无复辟旨拦·齐备则复位');
assert(CC._applyCourtOutcome(GM, { type: 'restoration' }).ok === false, '君犹被虏 → 夺门无从谈起');
player._captured = false; delete player._capturedBy; delete player._capturedLocation;  // 赎驾归銮
assert(CC._applyCourtOutcome(GM, { type: 'restoration' }).ok === false, '无复辟旨 → 未见其谋(须玩家真下旨)');
GM._edictTracker.push({ turn: 31, category: '密', content: '密结旧臣·图谋复辟正位' });
GM.turn = 32;
var r2 = CC._applyCourtOutcome(GM, { type: 'restoration', demotedTitle: '郕王' });
assert(r2.ok === true && !GM._rivalEmperor, '夺门成 → 新君清位');
assert(GM.chars[2]._enthroned === false && GM.chars[2]._dethroned === true && GM.chars[2].officialTitle === '郕王', '逊位降号(AI 定号)');
assert(player.officialTitle === '大明皇帝' && player._preCaptureTitle === undefined, '太上皇复位·原号复还');
assert(sb._ebs.some(function (e) { return e.indexOf('夺门之变成') >= 0; }), '复辟落起居注');

console.log('③ 谋泄冷却');
var sb3 = freshSandbox();
var GM3 = sb3.GM, CC3 = sb3.TM.CaptiveCourt;
GM3.chars[0]._captured = true;
CC3._applyCourtOutcome(GM3, { type: 'proclaim_new', name: '朱祁钰' });
GM3.chars[0]._captured = false;
GM3._edictTracker.push({ turn: 31, content: '谋夺门复位' });
GM3.turn = 32;
assert(CC3._applyCourtOutcome(GM3, { type: 'crackdown' }).ok === true, '谋泄落账');
assert(CC3._applyCourtOutcome(GM3, { type: 'restoration' }).ok === false, '冷却内 → 夺门拦(党羽星散须蛰伏)');
GM3.turn = 32 + CC3.CRACKDOWN_COOLDOWN;
assert(CC3._applyCourtOutcome(GM3, { type: 'restoration' }).ok === true, '冷却满 → 可再谋(蛰伏待时)');

console.log('④ 监国');
var sb4 = freshSandbox();
sb4.GM.chars[0]._captured = true;
assert(sb4.TM.CaptiveCourt._applyCourtOutcome(sb4.GM, { type: 'regent', name: '于谦' }).ok === true && sb4.GM._regent.name === '于谦', '立监国落账');
assert(sb4.TM.CaptiveCourt._applyCourtOutcome(sb4.GM, { type: 'regent', name: '朱祁钰' }).ok === false, '已有监国 → 不重复');

console.log('⑤ 兜底轨(双轨)：无 AI·被虏满 6 回合朝廷自立储君');
var sb5 = freshSandbox();
var GM5 = sb5.GM, CC5 = sb5.TM.CaptiveCourt;
GM5.chars[0]._captured = true;
GM5.turn = 40;
CC5.tick(GM5);
assert(!GM5._rivalEmperor && GM5.chars[0]._capturedSince === 40, '首 tick 记被虏起点·不立即立');
GM5.turn = 43; CC5.tick(GM5);
assert(!GM5._rivalEmperor, '未满 6 回合 → 观望');
GM5.turn = 46; CC5.tick(GM5);
assert(GM5._rivalEmperor && GM5._rivalEmperor.name === '朱见深', '满 6 回合 → 自立储君(childrenIds 候选优先)');
assert(GM5.chars[0].officialTitle === '太上皇', '兜底轨同走宪法落账(太上皇)');

console.log('⑥ flag OFF / 常态朝局零行为');
var sb6 = freshSandbox();
sb6.P.conf.revoltEntityEnabled = false;
sb6.GM.chars[0]._captured = true;
sb6.GM.turn = 99; sb6.TM.CaptiveCourt.tick(sb6.GM);
assert(!sb6.GM._rivalEmperor && !sb6.GM.chars[0]._capturedSince, 'flag 关 → 零行为');
var sb7 = freshSandbox();
sb7.TM.CaptiveCourt.tick(sb7.GM);
assert(!sb7.GM._courtInferTurn && !sb7.GM._rivalEmperor, '君安在位 → 本层不插手');

console.log('⑦ 复辟旨匹配器');
var sb8 = freshSandbox();
sb8.GM._edictTracker.push({ turn: 1, content: '着人暗通南宫·候机反正' });
assert(sb8.TM.CaptiveCourt._recentRestorationEdicts(sb8.GM).length === 1, '「反正」关键词命中');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-captive-court: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-captive-court (立新君三验/太上皇迁转/夺门三闸/谋泄冷却/监国/兜底轨/flag门/常态零行为)');
