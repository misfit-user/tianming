#!/usr/bin/env node
'use strict';
/* smoke-battle-replenish — 御驾亲征战后补员双源(§7/§12.4/O7·整编屏交互)
 *   ① replenishQuote:丁口=min(缺口,征兵池×征兵效率)·募兵=min(缺口,国库可负担)
 *   ② applyReplenish ding:真 FieldPipes.capRecruitDelta 扣池·soldiers 三标量同步·历练稀释·units[] 自愈放大
 *   ③ 池耗尽→第二笔 0·同回合共享记账
 *   ④ applyReplenish recruit:走 chargeRecruitment 单一扣费点(stub 记账)·国库夹报价
 *   ⑤ 永不崩:缺 army/缺 FieldPipes/缺口0
 * 真模块:tm-field-pipelines.js + tm-army-units.js;stub:TM.AIChange.Army(charge 已由 smoke-army-recruit-cost 单测)
 */
const path = require('path');
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-battle-replenish');

const charges = [];
global.window = {};
global.document = { addEventListener: function () {} };
global.window.MilitarySystems = { applyBattleResult: function () {} };
global.window.GM = {
  turn: 6, _yujiaQinzheng: true,
  guoku: { ledgers: { money: { stock: 5000 }, grain: { stock: 900 } }, money: 5000, grain: 900 },
  armies: [{ id: 'pa', faction: '宋', name: '背嵬军', soldiers: 2000, size: 2000, strength: 2000, morale: 75, quality: '精锐', veterancy: 20, type: '步军', location: '鄂州', composition: [{ type: '长枪兵', count: 1400 }, { type: '刀盾兵', count: 600 }] }]
};
global.window.P = {
  playerInfo: { factionName: '宋' }
};
// 区划只留游戏里那份（GM·2026-11-15）：驻地、征兵池都读 GM 的区划，P 只给开局与编辑器
global.window.GM.adminHierarchy = { song: { divisions: [{ name: '鄂州', minxin: 62, populationDetail: { ding: 40000 }, militaryDetail: { availableRecruits: 300 } }] } };
global.window.TM = { FieldPipes: require(path.resolve(__dirname, '..', 'tm-field-pipelines.js')) };
global.window.TMArmyUnits = require(path.resolve(__dirname, '..', 'tm-army-units.js'));
global.window.TM.AIChange = { Army: {
  recruitUnitCost: function (army) { return /骑/.test(String(army && army.type || '')) ? { money: 4, grain: 1.5 } : { money: 2, grain: 1 }; },
  chargeRecruitment: function (G, army, n, change, reason, source) { charges.push({ army: army.name, n: n, reason: reason, source: source }); return { ok: true }; }
} };
const GM = global.window.GM, P = global.window.P, AU = global.window.TMArmyUnits;
const TURN = require(path.resolve(__dirname, '..', 'tm-battle-turn.js'));
const army = GM.armies[0];

/* ① 报价 */
let q = TURN.replenishQuote(GM, army, 800);
ok(q.ding.n === 300, '① 丁口报价=min(缺口800,池300)=' + q.ding.n);
ok(q.recruit.n === 800 && q.recruit.silver === 1600 && q.recruit.grain === 800, '① 募兵报价=800·银1600·粮800(国库足)');
q = TURN.replenishQuote(GM, army, 100);
ok(q.ding.n === 100 && q.recruit.n === 100, '① 缺口100→两源皆夹到100');
GM._conscriptEffMult = 0.5;
q = TURN.replenishQuote(GM, army, 800);
ok(q.ding.n === 150, '① 征兵效率0.5→丁口报价=池300×0.5=150(与 capRecruitDelta 同口径)');
GM._conscriptEffMult = 1;
GM.guoku.ledgers.grain.stock = 50;
q = TURN.replenishQuote(GM, army, 800);
ok(q.recruit.n === 50, '① 粮仅50→募兵报价被国库夹到50(避免欠饷士气挫)');
GM.guoku.ledgers.grain.stock = 900;

/* ② 丁口落地:真 capRecruitDelta 扣池 + 稀释 + units 自愈 */
AU.ensureArmyUnits(army);
const unitsBefore = army.units.reduce(function (s, u) { return s + u.men; }, 0);
const vetBefore = AU.effectiveVet(army);
let r = TURN.applyReplenish(GM, army, 300, 'ding');
ok(r.added === 300, '② 丁口补员落地300');
ok(army.soldiers === 2300 && army.size === 2300 && army.strength === 2300, '② soldiers/size/strength 三标量=2300');
ok(GM.adminHierarchy.song.divisions[0].militaryDetail.availableRecruits === 0, '② 征兵池 300→0(真 capRecruitDelta 扣池)');
ok(GM.adminHierarchy.song.divisions[0].minxin === 62, '② 报价预夹→无强征过池·民心不扣');
const vetAfter = AU.effectiveVet(army);
ok(vetAfter < vetBefore, '② 新兵稀释历练 ' + vetBefore + '→' + vetAfter);
AU.ensureArmyUnits(army);
const unitsAfter = army.units.reduce(function (s, u) { return s + u.men; }, 0);
ok(unitsAfter === 2300 && unitsAfter > unitsBefore, '② units[] 签名自愈放大 ' + unitsBefore + '→' + unitsAfter);

/* ③ 池耗尽→报 0·不再落地 */
q = TURN.replenishQuote(GM, army, 500);
ok(q.ding.n === 0, '③ 池耗尽→丁口报价0(同回合共享记账)');
r = TURN.applyReplenish(GM, army, 0, 'ding');
ok(r.added === 0, '③ want=0→no-op');

/* ④ 募兵落地:走单一扣费点 */
r = TURN.applyReplenish(GM, army, 200, 'recruit');
ok(r.added === 200 && army.soldiers === 2500, '④ 募兵补员200→兵2500');
ok(charges.length === 1 && charges[0].n === 200 && charges[0].source === 'battle-replenish', '④ 走 chargeRecruitment 单一扣费点(防双扣/武库/欠饷逻辑复用)');

/* ⑤ 永不崩 */
ok(TURN.applyReplenish(GM, null, 100, 'ding').added === 0, '⑤ 无军→0');
ok(TURN.replenishQuote(GM, null, 100).ding.n === 0, '⑤ 无军报价→0');
const fp = global.window.TM.FieldPipes; global.window.TM.FieldPipes = null;
ok(TURN.applyReplenish(GM, army, 100, 'ding').added === 0, '⑤ 缺 FieldPipes→丁口0(不崩)');
global.window.TM.FieldPipes = fp;
const rep = []; TURN._collectReport(rep, { playerArmies: [army], battleResult: {} }, { pa: 2600 }, GM);
ok(rep.length === 1 && rep[0].armyId === 'pa' && rep[0].loss === 100, '⑤ 战报行带 armyId(补员交互挂钩)·损=快照-现兵');

console.log('\n结果: ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
