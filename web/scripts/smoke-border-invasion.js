// smoke-border-invasion.js — 威胁→侵攻确定性接点（批二刀2·2026-07-21·flag 默认 OFF）
//
// 第七轮记债：borderRisk 只涨不咬·「威胁高→南侵」停在文案层。修法=确定性具象化：
// 玩家领 leaf.borderRisk≥70 连续3回合 → 最强敌对势力(排除义军)出一支真入侵军(每势力至多
// 一支·每回合至多一支)·风险<40 连续2回合或被打散→退兵+6回合冷却。战斗归既有军事系统。
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

var leaves = [
  { name: '蓟州', borderRisk: 80 },
  { name: '大同', borderRisk: 50 }
];
var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox._ebs = [];
sandbox.addEB = function (cat, msg) { sandbox._ebs.push(cat + '·' + msg); };
sandbox.IntegrationBridge = { getLeafDivisions: function () { return leaves; } };
sandbox.GM = {
  turn: 30,
  adminHierarchy: { player: {} },
  facs: [
    { id: 'f_hj', name: '后金', strength: 80, playerRelation: -90 },
    { id: 'f_mg', name: '漠南部', strength: 60, playerRelation: -70 },
    { id: 'f_cx', name: '朝鲜', strength: 40, playerRelation: 60 },
    { id: 'f_rev', name: '陕西义军', strength: 60, playerRelation: -85, _revoltEntity: true, sourceRevoltId: 'rvX' }
  ],
  armies: [],
  chars: []
};
sandbox.P = { conf: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-border-invasion.js'), 'utf8'), sandbox, { filename: 'tm-border-invasion.js' });

var GM = sandbox.GM;
var BI = sandbox.TM.BorderInvasion;

console.log('① flag OFF（默认）→ 零行为');
BI.tick(GM); BI.tick(GM); BI.tick(GM); BI.tick(GM);
assert(GM.armies.length === 0, 'flag 关 → 永不出兵');
assert(!leaves[0]._invRiskStreak, 'flag 关 → 连 streak 都不记');

console.log('② 高压三回合 → 最强敌对势力出兵（义军被排除）');
sandbox.P.conf.borderInvasionEnabled = true;
BI.tick(GM); GM.turn++;
assert(GM.armies.length === 0 && leaves[0]._invRiskStreak === 1, '第1回合高压 → 只记账不出兵');
BI.tick(GM); GM.turn++;
assert(GM.armies.length === 0 && leaves[0]._invRiskStreak === 2, '第2回合高压 → 仍不出兵(确定性·非随机)');
BI.tick(GM); GM.turn++;
var inv = GM.armies.find(function (a) { return a._borderInvasion; });
assert(!!inv, '第3回合高压 → 出兵');
assert(inv.faction === '后金' && inv.sourceFacName === '后金', '攻方=最强敌对(后金80>漠南60)·义军(-85)被排除');
assert(inv.soldiers === 20000 + 80 * 800, '兵额=20000+strength×800=84000');
assert(inv.location === '蓟州', '兵锋落最险 leaf(蓟州80>大同50)');
assert(sandbox._ebs.some(function (e) { return e.indexOf('大举犯边') >= 0; }), '出兵落起居注');

console.log('③ 每势力同时至多一支·streak 出兵后清零重计');
BI.tick(GM); GM.turn++; BI.tick(GM); GM.turn++; BI.tick(GM); GM.turn++;
var hjArmies = GM.armies.filter(function (a) { return a._borderInvasion && a.sourceFacName === '后金' && !a.disbanded; });
assert(hjArmies.length === 1, '后金在场入侵军恒一支');
var mnArmy = GM.armies.find(function (a) { return a._borderInvasion && a.sourceFacName === '漠南部' && !a.disbanded; });
assert(!!mnArmy, '后金占位后·次强漠南部继起犯边(高压持续)');

console.log('④ 风险回落两回合 → 饱掠而归+冷却');
leaves[0].borderRisk = 20; leaves[1].borderRisk = 20;
BI.tick(GM); GM.turn++;
assert(!inv.disbanded, '低压第1回合 → 未撤(需连续2回合)');
BI.tick(GM); GM.turn++;
assert(inv.disbanded === true && inv.soldiers === 0, '低压第2回合 → 退兵散档');
var hjFac = GM.facs.find(function (f) { return f.name === '后金'; });
assert((hjFac._invCooldownUntil || 0) > GM.turn, '后金进冷却');
assert(sandbox._ebs.some(function (e) { return e.indexOf('饱掠而归') >= 0; }), '退兵落起居注');

console.log('⑤ 冷却期不再犯·期满可再犯');
leaves[0].borderRisk = 90;
BI.tick(GM); GM.turn++; BI.tick(GM); GM.turn++; BI.tick(GM); GM.turn++;
var hjActive = GM.armies.filter(function (a) { return a._borderInvasion && a.sourceFacName === '后金' && !a.disbanded; });
assert(hjActive.length === 0, '冷却中后金不再犯(漠南部在场也占位)');
GM.turn = hjFac._invCooldownUntil + 1;
// 漠南部先撤(模拟被打散)·腾出唯一新增位
var mn = GM.armies.find(function (a) { return a.sourceFacName === '漠南部' && !a.disbanded; });
if (mn) mn.soldiers = 0;
BI.tick(GM); GM.turn++;              // 本回合处理漠南覆没
BI.tick(GM); GM.turn++; BI.tick(GM); GM.turn++; BI.tick(GM); GM.turn++;
hjActive = GM.armies.filter(function (a) { return a._borderInvasion && a.sourceFacName === '后金' && !a.disbanded; });
assert(hjActive.length === 1, '冷却期满+高压再续 → 后金再犯');

console.log('⑥ 被打散 → 覆没退场');
var cur = hjActive[0];
cur.soldiers = 0;
BI.tick(GM);
assert(cur.disbanded === true, 'soldiers≤0 → 全军覆没散档');
assert(sandbox._ebs.some(function (e) { return e.indexOf('全军覆没') >= 0; }), '覆没落起居注');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-border-invasion: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-border-invasion (flag门/三回合确定出兵/义军排除/单支限额/退兵冷却/覆没退场)');
