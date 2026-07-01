#!/usr/bin/env node
'use strict';
/* smoke-battle-veterancy-wire — 战后历练活线接入(整编屏刀2):
 * 御驾亲征流程 applyReal→_gainPostBattleVeterancy·玩家军按本战减员率获历练(§12.3)·NPC 军不动·flag-gated。 */
const path = require('path'), fs = require('fs');
global.window = global;
global.document = { addEventListener: function () {}, readyState: 'complete' };
global.MilitarySystems = { applyBattleResult: function () {} };
const AU = require(path.resolve(__dirname, '..', 'tm-army-units.js'));   // sets window.TMArmyUnits
const BT = require(path.resolve(__dirname, '..', 'tm-battle-turn.js'));  // sets window.TMBattleTurn·导出 _gainPostBattleVeterancy
let A = 0, F = 0; function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
console.log('smoke-battle-veterancy-wire');

global.P = { playerInfo: { factionName: '明朝廷' } };

/* ① 玩家军获历练·敌军不获(仅玩家军) */
const A1 = { id: 'A1', faction: '明朝廷', quality: '普通', veterancy: 0, soldiers: 700 }; // 战后700·损300→pre1000·lr0.3
const E1 = { id: 'E1', faction: '后金', quality: '普通', veterancy: 0, soldiers: 800 };
global.GM = { armies: [A1, E1] };
BT._gainPostBattleVeterancy({ affectedArmies: [{ armyId: 'A1', loss: 300 }, { armyId: 'E1', loss: 200 }] }, global.GM);
ok(A1.veterancy > 0, '① 玩家军(明朝廷)战后获历练 veterancy>0 (got ' + A1.veterancy + ')');
ok(E1.veterancy === 0, '① 敌军(后金)不获历练(仅玩家军·NPC不动其历练)');

/* ② 减员率越高→历练越多·轻损也获小幅 */
const L = { id: 'L', faction: '明朝廷', quality: '普通', veterancy: 0, soldiers: 950 }; // 损50/1000=0.05
const H = { id: 'H', faction: '明朝廷', quality: '普通', veterancy: 0, soldiers: 400 }; // 损600/1000=0.6
global.GM = { armies: [L, H] };
BT._gainPostBattleVeterancy({ affectedArmies: [{ armyId: 'L', loss: 50 }, { armyId: 'H', loss: 600 }] }, global.GM);
ok(H.veterancy > L.veterancy, '② 血战(减员60%)历练 > 轻松仗(减员5%·烈度+血战加成)');
ok(L.veterancy > 0, '② 轻损仗也获小幅历练(参战即长)');

/* ③ units[] 历练随之升(签名自愈·端到端) */
const P2 = { id: 'P2', faction: '明朝廷', quality: '普通', veterancy: 0, soldiers: 1000, composition: [{ type: '长枪兵', count: 1000 }] };
AU.ensureArmyUnits(P2);
const vetBefore = P2.units[0].历练;
global.GM = { armies: [P2] };
BT._gainPostBattleVeterancy({ affectedArmies: [{ armyId: 'P2', loss: 500 }] }, global.GM);
AU.ensureArmyUnits(P2);   // 重派(veterancy 变·签名变)
ok(P2.units[0].历练 > vetBefore, '③ 战后 units[] 历练上升 ' + vetBefore + '→' + P2.units[0].历练 + '(签名自愈端到端)');

/* ④ 永不崩 */
let threw = false; try { BT._gainPostBattleVeterancy(null, null); BT._gainPostBattleVeterancy({}, global.GM); BT._gainPostBattleVeterancy({ affectedArmies: [{ armyId: 'X' }] }, global.GM); } catch (e) { threw = true; }
ok(!threw, '④ null/空/未知军→不崩');

/* ⑤ 接线:applyReal 内调用 _gainPostBattleVeterancy(全路径活线·flag-gated) */
const src = fs.readFileSync(path.resolve(__dirname, '..', 'tm-battle-turn.js'), 'utf8');
const arIdx = src.indexOf('function applyReal');
const arBody = src.slice(arIdx, arIdx + 400);
ok(/_gainPostBattleVeterancy\(br, ?GM\)/.test(arBody), '⑤ applyReal 内调 _gainPostBattleVeterancy(三路活线接入·仅御驾亲征流程)');

console.log('\nsmoke-battle-veterancy-wire ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + A + '/' + (A + F));
process.exit(F === 0 ? 0 : 1);
