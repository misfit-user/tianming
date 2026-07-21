// smoke-revolt-breach.js — R2 破京终局链（批二刀1·2026-07-21·随 revoltEntityEnabled）
//
// owner 铁律：终局=玩家角色被杀·被杀有储君=继统续玩。旧轨=爬梯级5瞬时 _gameOver(数值阈值终局)。
// 新轨(flag ON)：authority-complete 级5改挂 r._breachMarch·镜像层三拍接力——拍1进军京师(反应窗)
// →拍2破京(G._capitalFallen 首个真写入者)→玩家过 adjudicatePlayerDeath(kind=regicide)：
// succession=继统续玩残局·gameover=裁决器 _playerDead 信号独家收场(绝不双发 _gameOver)·
// 裁决器缺席=回落经典 _gameOver 契约形状+breach 增强。另静态验 authority 旧轨字节保留。
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
  sb.addEB = function (cat, msg) { sb._ebs.push(cat + '·' + msg); };
  sb._ebs = [];
  if (adjImpl) sb.adjudicatePlayerDeath = adjImpl;
  sb.GM = {
    turn: 20,
    facs: [], chars: [{ name: '朱由检', isPlayer: true, alive: true }], armies: [],
    minxin: { revolts: [{ id: 'rv9', region: '陕西', status: 'ongoing', level: 5, scale: 1000000, turn: 10, _breachMarch: { started: 20 } }] }
  };
  sb.P = { conf: { revoltEntityEnabled: true } };
  vm.createContext(sb);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-revolt-entity.js'), 'utf8'), sb, { filename: 'tm-revolt-entity.js' });
  return sb;
}

console.log('① 拍1·进军：义军移师京师·不破京不终局');
var adjCalls = [];
var sb = freshSandbox(function (ch, cause, opts) {
  adjCalls.push({ name: ch && ch.name, cause: cause, kind: opts && opts.kind });
  return { outcome: 'succession', heir: '皇太子' };
});
sb.TM.RevoltEntity.sync(sb.GM);
var army = sb.GM.armies.find(function (a) { return a && a._revoltEntity; });
assert(!!army && army.location === '京师' && army.state === 'march', '义军主力移师京师(march 态)');
assert(!sb.GM._capitalFallen && !sb.GM._gameOver, '拍1 不破京不终局（一回合反应窗）');
assert(adjCalls.length === 0, '拍1 不叫裁决器');
assert(sb._ebs.some(function (e) { return e.indexOf('进逼京师') >= 0; }), '进军落起居注');

console.log('② 拍2·破京→有储君=继统续玩残局');
sb.GM.turn = 21;
sb.TM.RevoltEntity.sync(sb.GM);
assert(sb.GM._capitalFallen === true, '破京 → _capitalFallen 竖旗(皇威 capitalFall 信号端既有消费)');
assert(adjCalls.length === 1 && adjCalls[0].kind === 'regicide' && adjCalls[0].name === '朱由检', '玩家过裁决器·kind=regicide(R1f 合法性门生效)');
assert(!sb.GM._gameOver, 'succession → 不写 _gameOver·续玩残局');
assert(sb.GM._dynastyFallInfo && sb.GM._dynastyFallInfo.fate === 'succession', '_dynastyFallInfo 记实(富屏增强·新字段)');
assert(sb.GM.minxin.revolts[0]._breachDone === true, '_breachDone 竖旗');
assert(sb.GM.facs.some(function (f) { return f._revoltEntity; }), '实体留场(残局舞台)');
assert(sb._ebs.some(function (e) { return e.indexOf('京师陷落') >= 0; }) && sb._ebs.some(function (e) { return e.indexOf('继统') >= 0; }), '破京+继统落起居注');

console.log('③ 幂等：破京后不重复裁决');
sb.GM.turn = 22;
sb.TM.RevoltEntity.sync(sb.GM);
assert(adjCalls.length === 1, '_breachDone 后不再叫裁决器');

console.log('④ 无嗣终局：裁决器 gameover → 信号独家收场·绝不双发 _gameOver');
var adjCalls2 = [];
var sb2 = freshSandbox(function (ch, cause, opts) {
  adjCalls2.push(1);
  sb2.GM._playerDead = true;  // 模拟裁决器行为
  return { outcome: 'gameover' };
});
sb2.TM.RevoltEntity.sync(sb2.GM);  // 拍1
sb2.GM.turn = 21;
sb2.TM.RevoltEntity.sync(sb2.GM);  // 拍2
assert(adjCalls2.length === 1 && sb2.GM._playerDead === true, '裁决器定终局(_playerDead)');
assert(!sb2.GM._gameOver, '裁决器接手 → 不再写 _gameOver（单发纪律·防双终局屏）');
assert(sb2.GM._dynastyFallInfo && sb2.GM._dynastyFallInfo.fate === 'gameover', '_dynastyFallInfo 记 gameover');

console.log('⑤ 裁决器缺席 → 回落经典 _gameOver 契约形状+breach 增强');
var sb3 = freshSandbox(null);
sb3.GM.minxin.revolts[0].leader = '高迎祥';
sb3.TM.RevoltEntity.sync(sb3.GM);  // 拍1
sb3.GM.turn = 21;
sb3.TM.RevoltEntity.sync(sb3.GM);  // 拍2
var go = sb3.GM._gameOver;
assert(!!go && go.type === 'dynasty_change' && go.revolt === 'rv9' && go.region === '陕西' && go.level === 5 && go.levelName === '改朝' && go.leader === '高迎祥', '回落 _gameOver 保留旧消费端契约字段(_consumeDynastyEndSignal)');
assert(go.breach === true && go.capitalFallen === true, 'breach/capitalFallen 增强字段');

console.log('⑥ 静态契约：authority-complete 旧轨字节保留+新轨路由');
var authSrc = fs.readFileSync(path.join(ROOT, 'tm-authority-complete.js'), 'utf8');
assert(/type:\s*'dynasty_change',\s*revolt:\s*r\.id,\s*turn:\s*ctx\.turn/.test(authSrc), '旧轨 _gameOver 块仍在(flag OFF 字节级旧行为)');
assert(/revoltEntityEnabled === true/.test(authSrc) && /_breachMarch\s*=\s*\{\s*started:\s*ctx\.turn\s*\}/.test(authSrc), '新轨:flag ON 改挂 _breachMarch(镜像层接力)');
assert(/改朝换代！天命已移/.test(authSrc), '旧轨终局起居注文案未动');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-revolt-breach: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-revolt-breach (三拍进军窗/破京信号/继统续玩/终局单发/裁决器缺席回落/旧轨字节保留)');
