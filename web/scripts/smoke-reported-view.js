#!/usr/bin/env node
'use strict';
/* smoke-reported-view — 奏报失真层核心引擎(S1)：
 * gate(严格史实+开关双条件)·纯推导确定性(同回合恒定/跨回合变)·方向(坏消息瞒减/好消息虚增)·
 * 封顶35%·吏治面+经手人点·揭真许可(reveal→显实情·ttl过重蒙尘)·据奏徽·非数值直通。 */
global.window = global;
global.GM = { sid: 'sc-t', turn: 10, corruption: { trueIndex: 60, subDepts: { military: { true: 80 } } } };
global.P = { conf: { gameMode: 'strict_hist', reportedViewEnabled: true } };

const RV = require('../tm-reported-view.js');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-reported-view');

// ── gate 双条件 ──
ok(RV.active(global.P) === true, '① 严格史实+开关开 → active');
ok(RV.active({ conf: { gameMode: 'strict_hist' } }) === true, '① 严格史实默认开启');
ok(RV.active({ conf: { gameMode: 'strict_hist', reportedViewEnabled: false } }) === false, '① 显式关闭仍直通真值');
ok(RV.active({ conf: { gameMode: 'yanyi', reportedViewEnabled: true } }) === false, '① 非严格史实 → inactive(演义照旧)');
const rOff = RV.value('fiscal', 'guoku', 1000, { P: { conf: {} } });
ok(rOff.shown === 1000 && !rOff.distorted && rOff.basis === 'inactive', '① inactive → 直通真值');

// ── 纯推导确定性 ──
const r1 = RV.value('fiscal', 'guoku', 100000, { direction: 'bad' });
const r2 = RV.value('fiscal', 'guoku', 100000, { direction: 'bad' });
ok(r1.shown === r2.shown, '② 同回合同键两次调用 → 同上报值(不落库也不乱跳)');
global.GM.turn = 11;
const r3 = RV.value('fiscal', 'guoku', 100000, { direction: 'bad' });
global.GM.turn = 10;
ok(r3.shown !== r1.shown || r3.frac !== r1.frac, '② 回合推进 → 种子变·上报值可变');

// ── 方向与封顶 ──
ok(r1.distorted && r1.shown < 100000, '③ 坏消息(direction bad) → 瞒减(报少)');
const rG = RV.value('fiscal', 'suiru', 100000, { direction: 'good' });
ok(rG.distorted && rG.shown > 100000, '③ 好消息(direction good) → 虚增(报多)');
ok(Math.abs(r1.shown - 100000) <= 100000 * 0.35 + 1 && r1.frac <= 0.35, '③ 偏移封顶 ≤35%');
ok(r1.shown === Math.round(r1.shown), '③ 整数真值 → 整数上报(口径形态)');

// ── 吏治面 + 经手人点 ──
const rClean = (function(){ const bak = global.GM.corruption; global.GM.corruption = { trueIndex: 5 }; const r = RV.value('fiscal', 'guoku', 100000, { direction: 'bad' }); global.GM.corruption = bak; return r; })();
ok(rClean.frac < r1.frac, '④ 吏治清明(浊5) → 粉饰远小于浊世(浊60)');
const rLoyal = RV.value('fiscal', 'x1', 100000, { direction: 'bad', handler: { loyalty: 90 } });
const rTraitor = RV.value('fiscal', 'x1', 100000, { direction: 'bad', handler: { loyalty: 20 } });
ok(rLoyal.frac < rTraitor.frac, '④ 直臣经手(忠90)偏移 < 离心之臣(忠20)');
const rDept = RV.value('army', 'y1', 100000, { direction: 'good', dept: 'military' });
const rNoDept = RV.value('army', 'y1', 100000, { direction: 'good' });
ok(rDept.frac >= rNoDept.frac, '④ 分部门吏治(军队浊80) ≥ 全局(浊60)');

// ── 揭真许可 ──
RV.reveal('fiscal', 'guoku', 'audit');
ok(RV.revealed('fiscal', 'guoku') === true, '⑤ reveal 登记 → revealed');
const rRev = RV.value('fiscal', 'guoku', 100000, { direction: 'bad' });
ok(rRev.shown === 100000 && !rRev.distorted && rRev.basis === 'revealed', '⑤ 已揭键 → 显实情');
global.GM.turn = 10 + RV.REVEAL_TTL + 1;
ok(RV.revealed('fiscal', 'guoku') === false, '⑤ ttl 过 → 重新蒙尘');
global.GM.turn = 10;
ok(global.GM._reportedReveals && !('shown' in (global.GM._reportedReveals['fiscal:guoku'] || {})), '⑤ 许可表只存许可不存数值(非第二本账)');

// ── 徽与直通 ──
ok(/据奏/.test(RV.badge(r1)) && RV.badge(rRev) === '', '⑥ 失真配据奏徽·实情无徽');
const rNaN = RV.value('fiscal', 'z', '未录', {});
ok(rNaN.shown === '未录' && !rNaN.distorted, '⑥ 非数值直通不碰');

console.log('\nsmoke-reported-view ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
