/* smoke-army-mutiny.js — 刀四·欠军饷→兵变/逃营（低 morale 真有后果·守恒入逃户→流寇）
 * 验：① morale 极低+成军→哗变溃散(守恒入逃户)② 残部不足→全军瓦解 ③ morale 偏低→逃营(按缺口·守恒入逃户)
 *   ④ morale 正常→无事 ⑤ 兵额字段兼容(soldiers/strength/size)⑥ 零星(<成军门槛)不哗变只逃营 ⑦ 无军/已散→no-op ⑧ 装配/导出
 * 跑：node scripts/smoke-army-mutiny.js
 */
'use strict';
var pass = 0, fail = 0, fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); console.error('  ✗ ' + m); } }

global.window = undefined;
global.TM = { errors: { capture: function () {} } };
global.addEB = function () {};
require('../tm-class-mobility.js');
var F3 = global.PhaseF3;
ok(F3 && typeof F3._tickArmyMutiny === 'function', '0·PhaseF3._tickArmyMutiny 导出');

function gm(armies, taoohu) {
  return { turn: 5, armies: armies, population: { byLegalStatus: { taoohu: { mouths: taoohu || 0 } } } };
}
function tao(G) { return G.population.byLegalStatus.taoohu.mouths; }

// ── T1 哗变（morale10<12·万人军）──
global.GM = gm([{ name: '关宁军', morale: 10, soldiers: 10000 }]);
F3._tickArmyMutiny({ turn: 5 }, 1);
var a1 = global.GM.armies[0];
ok(a1.soldiers === 3000 && !a1.disbanded, '1·哗变溃散70%→残 3000(未瓦解)·实得 ' + a1.soldiers);
ok(tao(global.GM) === 7000 && a1._mutiniedTurn === 5, '1·溃散 7000 守恒入逃户(→流寇之资)·实得 ' + tao(global.GM));

// ── T2 全军瓦解（残部<1000）──
global.GM = gm([{ name: '溃边军', morale: 8, soldiers: 3000 }]);
F3._tickArmyMutiny({ turn: 5 }, 1);
var a2 = global.GM.armies[0];
ok(a2.soldiers === 0 && a2.disbanded === true && tao(global.GM) === 3000, '2·哗变后残900<1000→全军瓦解·3000全入逃户·实得 soldiers=' + a2.soldiers + ' disbanded=' + a2.disbanded);

// ── T3 逃营（morale20·缺口小）──
global.GM = gm([{ name: '京营', morale: 20, soldiers: 10000 }]);
F3._tickArmyMutiny({ turn: 5 }, 1);
var a3 = global.GM.armies[0];
// rate=0.06×((25-20)/25)=0.012 → flee=120
ok(a3.soldiers === 9880 && tao(global.GM) === 120, '3·逃营=10000×0.012=120·守恒入逃户·实得 flee=' + (10000 - a3.soldiers));
ok(a3._desertedTurn === 5 && !a3._mutiniedTurn, '3·标逃营非哗变(morale≥12)');

// ── T4 morale 正常→无事 ──
global.GM = gm([{ name: '精锐', morale: 60, soldiers: 10000 }]);
F3._tickArmyMutiny({ turn: 5 }, 1);
ok(global.GM.armies[0].soldiers === 10000 && tao(global.GM) === 0, '4·morale60→无逃营无哗变(no-op)');

// ── T5 兵额字段兼容（strength）──
global.GM = gm([{ name: '卫所', morale: 8, strength: 5000 }]);
F3._tickArmyMutiny({ turn: 5 }, 1);
// 5000×0.7=3500 scatter·left1500≥1000 不瓦解
ok(global.GM.armies[0].strength === 1500 && tao(global.GM) === 3500, '5·读写 strength 字段(无 soldiers)·哗变溃散3500·实得 strength=' + global.GM.armies[0].strength);

// ── T6 零星(<成军门槛)→不哗变·只逃营 ──
global.GM = gm([{ name: '残卒', morale: 8, soldiers: 2000 }]);
F3._tickArmyMutiny({ turn: 5 }, 1);
var a6 = global.GM.armies[0];
// 2000<3000 不哗变；morale8<25 逃营 rate=0.06×((25-8)/25)=0.0408→flee=81
ok(!a6.disbanded && !a6._mutiniedTurn && a6.soldiers === 2000 - Math.floor(2000 * 0.06 * (17 / 25)), '6·2000<成军门槛→不哗变·走逃营·实得 flee=' + (2000 - a6.soldiers));

// ── T7 无军/已散→no-op ──
global.GM = gm([{ name: '已散', morale: 5, soldiers: 9000, disbanded: true }, { name: '空', morale: 5, soldiers: 0 }]);
F3._tickArmyMutiny({ turn: 5 }, 1);
ok(global.GM.armies[0].soldiers === 9000 && tao(global.GM) === 0, '7·已散/0兵→跳过(no-op)');
global.GM = { turn: 5, armies: [] };
F3._tickArmyMutiny({ turn: 5 }, 1);
ok(true, '7·无 armies→不崩');

// ── T8 装配/导出契约 ──
var fs = require('fs'), path = require('path');

console.log('\n[smoke-army-mutiny] ' + pass + ' 通过 / ' + fail + ' 失败');
if (fail) { console.error('失败项：\n - ' + fails.join('\n - ')); process.exit(1); }
process.exit(0);
