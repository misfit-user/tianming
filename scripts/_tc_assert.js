'use strict';
// 收紧数值断言:每条 = 一个"符合设计预期"的具体边界。全过 exit 0,否则 exit 50+条号。
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
  return { pen: s.byParadigm[e.id], stock: m.stock, eff: m.effectiveStock, un: m.unemployed };
}
var A = run({ tc: 10, ad: 1e9, rm: 1 });      // 空壳:海量招生,师资极缺
var B = run({ tc: 1e7, ad: 2000, rm: 1 });     // 无岗位:师资足,吸纳极小
var C = run({ tc: 1e7, ad: 1e9, rm: 1 });      // 齐备
var C2 = run({ tc: 1e7, ad: 1e9, rm: 0.2 });   // 齐备但制度压制

var checks = [
  ['A招到大量人(堆数量确有量)', A.stock > 50000],
  ['A空壳出水货:有效<人数15%(师资瓶颈)', A.eff < A.stock * 0.15],
  ['A空壳渗透极低<1%', A.pen < 0.01],
  ['C齐备高质量:有效>人数70%', C.eff > C.stock * 0.7],
  ['C齐备渗透可观>3%', C.pen > 0.03],
  ['防数字游戏核心:同样招生,C齐备渗透>A空壳20倍', C.pen > A.pen * 20],
  ['岗位要紧:C渗透>B无岗位5倍', C.pen > B.pen * 5],
  ['无岗位大量失业>10万', B.un > 100000],
  ['无岗位截流:B成熟人数<A(进不了历练)', B.stock < A.stock],
  ['制度压制显著:C2渗透<C六成', C2.pen < C.pen * 0.6],
  ['flag关零回归', (function () { var g = { turn: 0 }, p = { conf: {} }; var st = TC.tick(g, p, {}); return st.paradigms === 0 && !g._talentCohorts; })()],
  ['范式自由:引擎不含"实学"等专名(summarize 用玩家给的label)', (function () { var g = { turn: 0 }, p = { conf: { talentCohortEnabled: true } }; TC.init(g, p); var x = TC.registerParadigm(g, { label: '某架空学派ZZ', kind: 'emergent' }); TC.registerSource(g, 'b', x.id, 9000); for (var t = 1; t <= 5; t++) { g.turn = t; TC.tick(g, p, {}); } return TC.summarize(g, p, {}).indexOf('某架空学派ZZ') >= 0; })()]
];
var failed = 0, idx = 0;
for (var i = 0; i < checks.length; i++) { if (!checks[i][1]) { failed = i + 1; break; } }
// 干净输出仅给文件(供 base64 短读),退出码承载判决
var summary = 'CHECKS=' + checks.length + ' FAILED_AT=' + failed;
console.log(summary);
process.exit(failed === 0 ? 0 : (50 + failed));
