#!/usr/bin/env node
/* eslint-env node */
// smoke-class-roving-coalesce.js — C4·流寇（2026-06-16 起；民变重做·民2c 11-14 改）实跑断言（真模块 PhaseF3）
//   民2c 起流寇池并进游击：全国逃户池不再凝成流寇（起义阶层在场、逃户池再大也不凝）——流寇只从各州起事来
//   （tm-revolt-cases.js 判、tm-revolt-rising.js 落地、tm-revolt-guerrilla.js 管连带）。
//   旧档里已有的流寇照旧：不喂新血每月溃散一成回逃户（守恒）、势穷瓦解；镇压（斩首离籍/溃散回逃户/耗军饷）、
//   招抚（守恒回编户/军户 + 开恶例）照旧。
'use strict';

const path = require('path');
const fs = require('fs');
const WEB = path.join(__dirname, '..');
require(path.join(WEB, 'tm-engine-constants.js'));
require(path.join(WEB, 'tm-class-mobility.js'));
const PF3 = global.PhaseF3;

let A = 0, F = 0;
function ok(c, m) { if (c) { A++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ ' + m); } }
const ebLog = [];
global.addEB = function (cat, msg) { ebLog.push(cat + '·' + msg); };

function mkGM(extra) {
  return Object.assign({
    turn: 5,
    classes: [{ name: '自耕农', _radicalFrac: 0.7, revoltState: { phase: 'uprising' },
      regionalVariants: [{ region: '陕西', satisfaction: 8, _radicalFrac: 0.7 }, { region: '江南', satisfaction: 40 }] }],
    population: { byClass: { peasant_self: { mouths: 5000000 } }, byLegalStatus: { taoohu: { mouths: 300000 } } }
  }, extra || {});
}
// 旧档里已有的一股流寇（民2c 前凝成的）
function oldBand(strength) {
  return { id: 'roving_3_0', name: '流寇', strength: strength, regions: ['陕西'], _bornTurn: 3, _peakStrength: strength, _lastGrewTurn: 3, disbanded: false };
}
function total(G) {
  var t = 0, p = G.population || {};
  Object.keys(p.byClass || {}).forEach(function (k) { t += Number(p.byClass[k].mouths) || 0; });
  Object.keys(p.byLegalStatus || {}).forEach(function (k) { t += Number(p.byLegalStatus[k].mouths) || 0; });
  (G.rovingRebels || []).forEach(function (r) { t += Number(r.strength) || 0; });
  return t;
}

console.log('smoke-class-roving-coalesce — C4 流寇（民2c：不再凝聚，旧档流寇溃散、剿抚照旧）');

// 1. 不再凝聚：暴烈起义阶层在场、地域热区、逃户池三十万——全国逃户池不凝成流寇，逃户一口不动
const g1 = mkGM(); global.GM = g1;
const tot1 = total(g1);
PF3._tickRovingCoalesce({ turn: 5 }, 1);
ok((g1.rovingRebels || []).length === 0, '起义+逃户池三十万→不再凝出全国流寇（流寇只从各州起事来）');
ok(g1.population.byLegalStatus.taoohu.mouths === 300000, '逃户池不动 (got ' + g1.population.byLegalStatus.taoohu.mouths + ')');
ok(total(g1) === tot1, '总数不变');
ok(!ebLog.some(function (e) { return /聚为流寇/.test(e); }), '不再报「流民聚为流寇」');
// 连跑几回合也不凝
for (let t = 6; t <= 9; t++) { g1.turn = t; PF3._tickRovingCoalesce({ turn: t }, 1); }
ok((g1.rovingRebels || []).length === 0 && g1.population.byLegalStatus.taoohu.mouths === 300000, '连跑四回合仍不凝、逃户不动');

// 2. 旧档里已有的流寇：不喂新血每月溃散一成回逃户（守恒）
const g2 = mkGM({ rovingRebels: [oldBand(48000)] }); g2.population.byLegalStatus.taoohu.mouths = 252000; global.GM = g2;
const totBefore2 = total(g2);
PF3._tickRovingCoalesce({ turn: 5 }, 1);
ok(g2.rovingRebels.length === 1 && g2.rovingRebels[0].strength === 43200, '旧流寇溃散 −10%/月 48000→43200 (got ' + (g2.rovingRebels[0] || {}).strength + ')');
ok(g2.population.byLegalStatus.taoohu.mouths === 252000 + 4800, '溃散者回逃户 (got ' + g2.population.byLegalStatus.taoohu.mouths + ')');
ok(total(g2) === totBefore2, '★溃散守恒（总数不变）');
// 起义阶层再盛也不给旧流寇喂新血
g2.turn = 6;
PF3._tickRovingCoalesce({ turn: 6 }, 1);
ok(g2.rovingRebels[0].strength === 38880, '旧流寇不再壮大，接着溃散 43200→38880 (got ' + g2.rovingRebels[0].strength + ')');

// 2b. 势穷瓦解：不足五千，余众星散为逃户
const g2b = mkGM({ rovingRebels: [oldBand(5200)] }); global.GM = g2b;
const totBefore2b = total(g2b);
PF3._tickRovingCoalesce({ turn: 5 }, 1);
ok((g2b.rovingRebels || []).length === 0, '不足五千→势穷瓦解、清出名册');
ok(total(g2b) === totBefore2b, '★瓦解守恒（余众回逃户）');
ok(ebLog.some(function (e) { return /势穷瓦解/.test(e); }), '邸报·势穷瓦解（真改了账才报）');

// 3. 镇压旧流寇（部分兵力）：斩首离籍 + 溃散回逃户 + 耗军饷
const g3 = mkGM({ fiscal: { treasury: 1000000 }, rovingRebels: [oldBand(48000)] }); g3.population.byLegalStatus.taoohu.mouths = 252000; global.GM = g3;
const totBefore3 = total(g3);
const sup = PF3.suppressRovingRebel(g3.rovingRebels[0], 20000);   // hit=min(48000,24000)=24000
ok(sup.ok && sup.killed === 12000 && sup.scattered === 12000, '镇压·斩首12000+溃散12000 (got ' + sup.killed + '/' + sup.scattered + ')');
ok(g3.rovingRebels[0].strength === 24000 && !g3.rovingRebels[0].disbanded, '镇压后流寇余势 24000·未灭 (got ' + g3.rovingRebels[0].strength + ')');
ok(g3.population.byLegalStatus.taoohu.mouths === 252000 + 12000, '溃散者守恒回逃户 (got ' + g3.population.byLegalStatus.taoohu.mouths + ')');
ok(total(g3) === totBefore3 - sup.killed, '★镇压·人口净减=斩首数(余守恒) (' + total(g3) + ' == ' + (totBefore3 - sup.killed) + ')');
ok(g3.fiscal.treasury === 1000000 - sup.silver && sup.silver === 10000, '镇压耗军饷扣国库 (' + sup.silver + ')');
// 3b. 续剿至瓦解
const sup2 = PF3.suppressRovingRebel(g3.rovingRebels[0], 60000);
ok(sup2.disbanded === true && (g3.rovingRebels || []).length === 0, '续剿·贼势瓦解·清出名册');

// 4. 招抚旧流寇：守恒回编户/军户 + 开恶例
const g4 = mkGM({ rovingRebels: [oldBand(48000)] }); g4.population.byClass.military = { mouths: 1000000 }; global.GM = g4;
const totBefore4 = total(g4);
const pac = PF3.pacifyRovingRebel(g4.rovingRebels[0]);
ok(pac.ok && pac.absorbed === 48000 && pac.toMil === 14400 && pac.toBian === 33600, '招抚·编户33600+军户14400=48000 (got ' + pac.toBian + '/' + pac.toMil + ')');
ok(g4.population.byLegalStatus.huangji.mouths === 33600 && g4.population.byClass.military.mouths === 1000000 + 14400, '招抚守恒入编户/军户格子');
ok(total(g4) === totBefore4, '★招抚守恒（总数不变）');
ok(g4._amnestyPrecedent === 1 && (g4.rovingRebels || []).length === 0, '招抚·开恶例记账 + 流寇消');

// 5. 没有流寇时剿抚不动账
const g5 = mkGM({ fiscal: { treasury: 1000000 } }); global.GM = g5;
ok(PF3.suppressRovingRebel(null, 20000).ok === false && g5.fiscal.treasury === 1000000, '无流寇·镇压不动账（不扣军饷）');
ok(PF3.pacifyRovingRebel(null).ok === false && !g5._amnestyPrecedent, '无流寇·招抚不动账（不开恶例）');

// 6. 源契约
const src = fs.readFileSync(path.join(WEB, 'tm-class-mobility.js'), 'utf8');
ok(typeof PF3._tickRovingCoalesce === 'function' && typeof PF3.suppressRovingRebel === 'function' && typeof PF3.pacifyRovingRebel === 'function', '源契约·PhaseF3 照旧导出溃散/镇压/招抚三 API');
ok(!/流民聚为流寇/.test(src) && !/_isViolentUprising/.test(src), '源契约·全国逃户池凝聚流寇那一段已删（民2c）');

console.log('\n[smoke-class-roving-coalesce] ' + (F ? 'FAIL' : 'PASS') + ' — ' + A + ' 通过 / ' + F + ' 失败');
process.exit(F ? 1 : 0);
