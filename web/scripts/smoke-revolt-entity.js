// smoke-revolt-entity.js — 民变实体镜像层（R2 第一波·2026-07-21·flag 默认 OFF）
//
// owner 铁律：民变=实体演进链·非数值阈值。R2 双轨第一波=镜像层——五级爬梯(进度时钟·零改动)
// 中 level≥3 的 ongoing 民变具象化为实体三件套(义军势力/渠帅人物/义军军队)·爬梯状态逐回合
// 镜像(升级扩军/被剿覆灭)·级5改朝实体留场(终局归爬梯 _gameOver)。本 smoke 直调 TM.RevoltEntity.sync
// 验证：flag门/具象化/幂等/在档真人揭竿不重复造/同区重名缀序/升级扩军/覆灭清账/级5保留。
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

var ebs = [];
var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox.addEB = function (cat, msg) { ebs.push(cat + '·' + msg); };
sandbox.GM = {
  turn: 10,
  facs: [{ id: 'f1', name: '大明', strength: 80, economy: 70, playerRelation: 100 }],
  chars: [{ name: '孙承宗', alive: true, faction: '朝廷', loyalty: 80 }],
  armies: [{ id: 'a1', name: '京营', faction: '大明', soldiers: 50000 }],
  minxin: { revolts: [] }
};
sandbox.P = { conf: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-revolt-entity.js'), 'utf8'), sandbox, { filename: 'tm-revolt-entity.js' });

var GM = sandbox.GM;
var RE = sandbox.TM.RevoltEntity;

console.log('① flag OFF（默认）→ 零行为');
GM.minxin.revolts.push({ id: 'rv1', region: '陕西', status: 'ongoing', level: 3, scale: 30000, turn: 8 });
RE.sync(GM);
assert(GM.facs.length === 1 && GM.armies.length === 1 && GM.chars.length === 1, 'flag 关 → 不具象化（默认 OFF 零行为）');

console.log('② flag ON·level3 具象化三件套');
sandbox.P.conf.revoltEntityEnabled = true;
RE.sync(GM);
var fac = GM.facs.find(function (f) { return f._revoltEntity; });
var army = GM.armies.find(function (a) { return a._revoltEntity; });
var leader = GM.chars.find(function (c) { return c._revoltEntity; });
assert(!!fac && fac.name === '陕西义军' && fac.strength === 40, '义军势力入档·strength=40(L3)');
assert(!!army && army.soldiers === 9000 && army.faction === '陕西义军' && army.location === '陕西', '义军军队入档·9000 兵·驻陕西');
assert(!!leader && leader.name === '陕西义军渠帅' && leader.officialTitle === '义军渠帅' && leader.faction === '陕西义军', '渠帅人物入档(民变无首领名→造描述性渠帅)');
assert(army.commander === '陕西义军渠帅', '军队主帅=渠帅');
assert(ebs.some(function (e) { return e.indexOf('陕西民变成势') >= 0; }), '具象化落起居注');

console.log('③ 幂等：重复 sync 不重复造');
RE.sync(GM); RE.sync(GM);
assert(GM.facs.filter(function (f) { return f._revoltEntity; }).length === 1, '势力不重复');
assert(GM.armies.filter(function (a) { return a._revoltEntity; }).length === 1, '军队不重复');
assert(GM.chars.filter(function (c) { return c._revoltEntity; }).length === 1, '渠帅不重复');

console.log('④ 爬梯升级 → 扩军/势力强度镜像');
GM.minxin.revolts[0].level = 4;
RE.sync(GM);
assert(army.soldiers === 60000 && army.size === 60000 && army.strength === 60000, 'L4 → 扩军 60000(含别名)');
assert(fac.strength === 60, 'L4 → 势力强度 60');
assert(ebs.some(function (e) { return e.indexOf('裹挟日众') >= 0; }), '扩军落起居注');

console.log('⑤ 在档真人揭竿 → 不重复造人·只挂链');
GM.minxin.revolts.push({ id: 'rv2', region: '山东', status: 'ongoing', level: 3, scale: 30000, turn: 9, leader: '孙承宗' });
RE.sync(GM);
assert(GM.chars.filter(function (c) { return c.name === '孙承宗'; }).length === 1, '真人首领不重复造');
assert(GM.minxin.revolts[1]._entityLeaderName === '孙承宗', '挂链 _entityLeaderName');
var realLeader = GM.chars.find(function (c) { return c.name === '孙承宗'; });
assert(realLeader.faction === '山东义军', '真人首领转投义军势力');
assert(realLeader._preRevoltFaction === '朝廷' && realLeader.sourceRevoltId === 'rv2', '原势力留痕+挂 sourceRevoltId 链');

console.log('⑥ 同区第二股 → 缀序防重名');
GM.minxin.revolts.push({ id: 'rv3', region: '陕西', status: 'ongoing', level: 3, scale: 30000, turn: 10 });
RE.sync(GM);
var shanxiFacs = GM.facs.filter(function (f) { return f._revoltEntity && String(f.name).indexOf('陕西义军') === 0; });
assert(shanxiFacs.length === 2 && shanxiFacs.some(function (f) { return f.name === '陕西义军·2'; }), '同区第二股 → 「陕西义军·2」');

console.log('⑦ 被剿 → 覆灭清账(军散/势力除档/渠帅溃散流亡·alive 不动)');
GM.minxin.revolts[0].status = 'suppressed';
RE.sync(GM);
assert(!GM.facs.some(function (f) { return f.sourceRevoltId === 'rv1'; }), 'rv1 势力除档');
var deadArmy = GM.armies.find(function (a) { return a.sourceRevoltId === 'rv1'; });
assert(deadArmy && deadArmy.disbanded === true && deadArmy.soldiers === 0, 'rv1 军散(disbanded·清员额)');
var fled = GM.chars.find(function (c) { return c.sourceRevoltId === 'rv1'; });
assert(fled && fled._revoltDefeated === true && fled.alive === true && fled.officialTitle === '溃散流亡', '渠帅溃散流亡·alive 不动(避开死亡系统)');
assert(ebs.some(function (e) { return e.indexOf('烟消云散') >= 0; }), '覆灭落起居注');

console.log('⑧ 级5改朝 → 实体留场(终局归爬梯 _gameOver)');
GM.minxin.revolts[1].level = 5;
GM.minxin.revolts[1].status = 'dispersed';  // 即便状态异动·级5不清账
RE.sync(GM);
assert(GM.facs.some(function (f) { return f.sourceRevoltId === 'rv2'; }), '级5实体不被清·留在终局舞台');

console.log('⑨ 低级民变(level<3)不具象化');
GM.minxin.revolts.push({ id: 'rv4', region: '河南', status: 'ongoing', level: 1, scale: 500, turn: 10 });
RE.sync(GM);
assert(!GM.facs.some(function (f) { return f.sourceRevoltId === 'rv4'; }), '流言/聚啸级 → 不入实体档');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-revolt-entity: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-revolt-entity (flag门/具象化/幂等/真人挂链/重名缀序/扩军镜像/覆灭清账/级5留场)');
