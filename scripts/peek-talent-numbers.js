'use strict';
/* peek-talent-numbers.js — 看引擎真实行为（空壳 vs 齐备 vs 无岗位 vs 制度压制）
 * 非断言，纯打印数值供肉眼校准曲线。末尾打印一段真实的「人才与风气」AI 注入实样。
 */
var TC = require('../tm-talent-cohorts.js');

function run(o) {
  var GM = { turn: 0 }, P = { conf: { talentCohortEnabled: true } };
  TC.init(GM, P);
  TC.registerParadigm(GM, { label: '旧', kind: 'established', stock: 500000 });
  var e = TC.registerParadigm(GM, { label: '新', kind: 'emergent', maturityTurns: 3 });
  TC.registerSource(GM, 's', e.id, 60000);
  var ctx = { teacherCapacityFor: function () { return o.tc; }, absorptionDemandFor: function () { return o.ad; }, institutionalRoomFor: function () { return o.rm == null ? 1 : o.rm; } };
  for (var t = 1; t <= 8; t++) { GM.turn = t; TC.tick(GM, P, ctx); }
  var s = TC.penetration(GM, P, ctx), m = TC.findParadigm(GM, e.id);
  return { pen: s.byParadigm[e.id], stock: Math.round(m.stock), eff: Math.round(m.effectiveStock), un: Math.round(m.unemployed), q: m.lastQuality };
}
var A = run({ tc: 10, ad: 1e9, rm: 1 });
var B = run({ tc: 1e7, ad: 2000, rm: 1 });
var C = run({ tc: 1e7, ad: 1e9, rm: 1 });
var C2 = run({ tc: 1e7, ad: 1e9, rm: 0.2 });

console.log('== 同样年招 6 万、旧式存量 50 万、历练 3 回合、跑 8 回合 ==');
console.log('A 空壳(师资极缺)   pen=' + A.pen.toFixed(4) + ' 成熟=' + A.stock + ' 有效=' + A.eff + ' 质量=' + A.q.toFixed(4));
console.log('B 无岗位(吸纳极小) pen=' + B.pen.toFixed(4) + ' 成熟=' + B.stock + ' 失业=' + B.un);
console.log('C 齐备             pen=' + C.pen.toFixed(4) + ' 成熟=' + C.stock + ' 有效=' + C.eff + ' 质量=' + C.q.toFixed(4));
console.log('C2 齐备但制度压制  pen=' + C2.pen.toFixed(4) + ' (room 0.2)');
console.log('RATIO 齐备/空壳=' + (C.pen / Math.max(1e-9, A.pen)).toFixed(1) + '×   齐备/无岗位=' + (C.pen / Math.max(1e-9, B.pen)).toFixed(1) + '×');

// 一段真实的「人才与风气」AI 注入实样（多范式·带 influenceProfile + 阻力）
var GM = { turn: 0 }, P = { conf: { talentCohortEnabled: true } };
TC.init(GM, P);
TC.registerParadigm(GM, { label: '科举经义', kind: 'established', stock: 800000 });
var g = TC.registerParadigm(GM, { label: '格致之学', kind: 'emergent', maturityTurns: 4, influenceProfile: { techPromotion: 0.8, industry: 0.6 }, absorptionKind: ['industry'] });
TC.registerSource(GM, 'xuetang', g.id, 12000);
var ctx = { teacherCapacityFor: function () { return 4e5; }, absorptionDemandFor: function () { return 9000; }, institutionalRoomFor: function () { return 0.7; } };
for (var t = 1; t <= 12; t++) { GM.turn = t; TC.tick(GM, P, ctx); }
console.log('\n== 「人才与风气」AI 注入实样（跑 12 回合后）==');
console.log(TC.summarize(GM, P, ctx));
