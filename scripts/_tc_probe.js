'use strict';
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
  return { pen: s.byParadigm[e.id], stock: Math.round(m.stock), eff: Math.round(m.effectiveStock), un: Math.round(m.unemployed) };
}
var A = run({ tc: 10, ad: 1e9, rm: 1 });
var B = run({ tc: 1e7, ad: 2000, rm: 1 });
var C = run({ tc: 1e7, ad: 1e9, rm: 1 });
var C2 = run({ tc: 1e7, ad: 1e9, rm: 0.2 });
var lines = [];
lines.push('A(kongke) pen=' + A.pen.toFixed(4) + ' stock=' + A.stock + ' eff=' + A.eff);
lines.push('B(nojob)  pen=' + B.pen.toFixed(4) + ' un=' + B.un + ' stock=' + B.stock);
lines.push('C(full)   pen=' + C.pen.toFixed(4) + ' stock=' + C.stock + ' eff=' + C.eff);
lines.push('C2(press) pen=' + C2.pen.toFixed(4));
lines.push('RATIO_C/A=' + (C.pen / Math.max(1e-9, A.pen)).toFixed(1) + ' RATIO_C/B=' + (C.pen / Math.max(1e-9, B.pen)).toFixed(1));
console.log(lines.join('\n'));
