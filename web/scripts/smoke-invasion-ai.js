// smoke-invasion-ai.js — 外患演绎层（批四·2026-07-21·AI 主导·spawner 降兜底）
//
// owner 范式：入不入寇/打多大/什么名义交敌国 AI·引擎只当宪法闸。本 smoke 不经真 AI：
// canned moves 直灌 _applyInvasionActions·验闸——非敌对不得入寇/义军排除/无真边压不得
// 凭空入寇/兵额封顶/一国一军/冷却/press·withdraw·demand 落账。兜底轨回归=既有
// smoke-border-invasion(其沙箱无 callAI·确定性路径字节级未动)。
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
  { name: '大同', borderRisk: 20 }
];
var sandbox = { console: console };
sandbox.window = sandbox;
sandbox.global = sandbox;
sandbox._ebs = [];
sandbox.addEB = function (cat, msg) { sandbox._ebs.push(cat + '·' + msg); };
sandbox.IntegrationBridge = { getLeafDivisions: function () { return leaves; } };
sandbox.GM = {
  turn: 40,
  adminHierarchy: { player: {} },
  facs: [
    { id: 'f_hj', name: '后金', strength: 80, playerRelation: -90 },
    { id: 'f_cx', name: '朝鲜', strength: 40, playerRelation: 60 },
    { id: 'f_rev', name: '闯字营', strength: 60, playerRelation: -85, _revoltEntity: true, sourceRevoltId: 'rvX' }
  ],
  armies: [],
  chars: [],
  _edictTracker: [{ turn: 39, category: '外交', content: '许后金岁币十万两·以息兵锋' }]
};
sandbox.P = { conf: { borderInvasionEnabled: true } };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(ROOT, 'tm-border-invasion.js'), 'utf8'), sandbox, { filename: 'tm-border-invasion.js' });

var GM = sandbox.GM;
var BI = sandbox.TM.BorderInvasion;

console.log('① 入寇宪法闸：非敌对/义军/无边压全拦·合规才成军(兵额封顶)');
var r1 = BI._applyInvasionActions(GM, { moves: [{ type: 'invade', fac: '朝鲜', target: '蓟州', soldiers: 30000 }] });
assert(r1.blocked === 1 && GM.armies.length === 0, '朝鲜(关系+60·非敌对) → 不得入寇');
var r2 = BI._applyInvasionActions(GM, { moves: [{ type: 'invade', fac: '闯字营', target: '蓟州' }] });
assert(r2.blocked === 1 && GM.armies.length === 0, '义军(_revoltEntity) → 排除·民变不走边患链');
var r3 = BI._applyInvasionActions(GM, { moves: [{ type: 'invade', fac: '后金', target: '大同', soldiers: 30000 }] });
assert(r3.blocked === 1 && GM.armies.length === 0, '大同边警仅20(<40) → 无真边压不得凭空入寇');
var r4 = BI._applyInvasionActions(GM, { moves: [{ type: 'invade', fac: '后金', target: '蓟州', soldiers: 999999, pretext: '七大恨告天' }] });
var inv = GM.armies.find(function (a) { return a._borderInvasion; });
assert(!!inv && inv.faction === '后金' && inv.location === '蓟州', '后金入寇蓟州(边警80) → 成军');
assert(inv.soldiers === 20000 + 80 * 800, 'AI 报兵 999999 → 宪法封顶 84000');
assert(sandbox._ebs.some(function (e) { return e.indexOf('七大恨告天') >= 0; }), '入寇名义(pretext)入起居注');

console.log('② 一国一军');
var r5 = BI._applyInvasionActions(GM, { moves: [{ type: 'invade', fac: '后金', target: '蓟州' }] });
assert(r5.blocked === 1 && GM.armies.filter(function (a) { return !a.disbanded; }).length === 1, '已有在场军 → 再入寇拦');

console.log('③ press 深入');
BI._applyInvasionActions(GM, { moves: [{ type: 'press', fac: '后金', target: '大同' }] });
assert(inv.location === '大同', '铁骑深入 → 移驻大同');
assert(sandbox._ebs.some(function (e) { return e.indexOf('铁骑深入') >= 0; }), '深入落起居注');

console.log('④ demand 要挟落账');
BI._applyInvasionActions(GM, { moves: [{ type: 'demand', fac: '后金', terms: '岁币二十万·开边市' }] });
assert(sandbox._ebs.some(function (e) { return e.indexOf('要挟') >= 0 && e.indexOf('岁币二十万') >= 0; }), '要挟条款入起居注');
assert(Array.isArray(GM._chronicle) && GM._chronicle.some(function (c) { return c.type === '边患'; }), '要挟入史(玩家可据以下旨回应)');

console.log('⑤ withdraw 退兵+冷却');
BI._applyInvasionActions(GM, { moves: [{ type: 'withdraw', fac: '后金', reason: '朝廷许以岁币' }] });
assert(inv.disbanded === true, 'AI 决断退兵 → 散档');
var hj = GM.facs.find(function (f) { return f.name === '后金'; });
assert((hj._invCooldownUntil || 0) > GM.turn, '退后冷却');
assert(sandbox._ebs.some(function (e) { return e.indexOf('朝廷许以岁币') >= 0; }), '退兵缘由落起居注');

console.log('⑥ 冷却期再入寇拦');
var r6 = BI._applyInvasionActions(GM, { moves: [{ type: 'invade', fac: '后金', target: '蓟州' }] });
assert(r6.blocked === 1, '冷却中 → 拦');

console.log('⑦ AI 轨排程门：有敌有压才排·回合戳幂等');
sandbox.callAI = function () { return new Promise(function () {}); };  // 挂起的假 AI·只验排程不验执行
GM.turn = 60;
BI.tick(GM);
assert(GM._invInferTurn === 60, '有敌有压 → 排 AI 演绎(回合戳)');
var stamp = GM._invInferTurn;
BI.tick(GM);
assert(GM._invInferTurn === stamp, '同回合重 tick → 幂等不重排');

console.log('');
if (failures.length) {
  console.log('FAIL smoke-invasion-ai: ' + failures.length + ' 处失败');
  failures.forEach(function (f) { console.log('  - ' + f); });
  process.exit(1);
}
console.log('PASS smoke-invasion-ai (非敌对拦/义军排除/边压闸/兵额顶/一国一军/press·demand·withdraw/冷却/排程幂等)');
