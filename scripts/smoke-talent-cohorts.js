'use strict';
/* smoke-talent-cohorts.js — S1 引擎自测（13 检查）
 * 验证多瓶颈漏斗的三铁律：现实因果链 / 防数字游戏 / 范式自由。
 * 每条 = 一个「符合设计预期」的具体边界。打印 PASS/FAIL，全过 exit 0。
 */
var TC = require('../tm-talent-cohorts.js');

var passed = 0, failed = 0;
function ok(desc, cond) { if (cond) { passed++; console.log('  PASS ' + desc); } else { failed++; console.log('  FAIL ' + desc); } }

// 标准跑：旧式 50 万存量 + 一个新范式(maturity 3)·年招 6 万，三瓶颈由 ctx 注入
function run(o) {
  var GM = { turn: 0 }, P = { conf: { talentCohortEnabled: true } };
  TC.init(GM, P);
  TC.registerParadigm(GM, { label: '旧', kind: 'established', stock: 500000 });
  var e = TC.registerParadigm(GM, { label: '新', kind: 'emergent', maturityTurns: 3 });
  TC.registerSource(GM, 's', e.id, 60000);
  var ctx = {
    teacherCapacityFor: function () { return o.tc; },
    absorptionDemandFor: function () { return o.ad; },
    institutionalRoomFor: function () { return o.rm == null ? 1 : o.rm; }
  };
  for (var t = 1; t <= 8; t++) { GM.turn = t; TC.tick(GM, P, ctx); }
  var s = TC.penetration(GM, P, ctx), m = TC.findParadigm(GM, e.id);
  return { pen: s.byParadigm[e.id], stock: m.stock, eff: m.effectiveStock, un: m.unemployed };
}
var A = run({ tc: 10, ad: 1e9, rm: 1 });      // 空壳：海量招生，师资极缺
var B = run({ tc: 1e7, ad: 2000, rm: 1 });     // 无岗位：师资足，吸纳极小
var C = run({ tc: 1e7, ad: 1e9, rm: 1 });      // 齐备
var C2 = run({ tc: 1e7, ad: 1e9, rm: 0.2 });   // 齐备但制度压制

// 1. API 面齐全
ok('API 面齐全（11 个方法 + TUNING）', ['init', 'registerParadigm', 'findParadigm', 'registerSource', 'revokeSource', 'tick', 'penetration', 'globalModifiers', 'backlashSignals', 'summarize', 'enabled'].every(function (k) { return typeof TC[k] === 'function'; }) && TC.TUNING && typeof TC.TUNING === 'object');
// 2-11. 现实因果链 + 防数字游戏
ok('A 招到大量人（堆数量确有量）', A.stock > 50000);
ok('A 空壳出水货：有效 < 人数 15%（师资瓶颈）', A.eff < A.stock * 0.15);
ok('A 空壳渗透极低 < 1%', A.pen < 0.01);
ok('C 齐备高质量：有效 > 人数 70%', C.eff > C.stock * 0.7);
ok('C 齐备渗透可观 > 3%', C.pen > 0.03);
ok('防数字游戏核心：同样招生，C 齐备渗透 > A 空壳 20 倍', C.pen > A.pen * 20);
ok('岗位要紧：C 渗透 > B 无岗位 5 倍', C.pen > B.pen * 5);
ok('无岗位大量失业 > 10 万', B.un > 100000);
ok('无岗位截流：B 成熟人数 < A（进不了历练）', B.stock < A.stock);
ok('制度压制显著：C2 渗透 < C 六成', C2.pen < C.pen * 0.6);
// 12. flag 关零回归
ok('flag 关零回归（tick no-op·不建状态）', (function () {
  var g = { turn: 0 }, p = { conf: {} }; var st = TC.tick(g, p, {});
  return st.paradigms === 0 && !g._talentCohorts;
})());
// 13. 范式自由：引擎不含任何写死的「学」，summarize 用玩家给的 label
ok('范式自由：summarize 用玩家给的 label（引擎无专名）', (function () {
  var g = { turn: 0 }, p = { conf: { talentCohortEnabled: true } }; TC.init(g, p);
  var x = TC.registerParadigm(g, { label: '某架空学派ZZ', kind: 'emergent' });
  TC.registerSource(g, 'b', x.id, 9000);
  for (var t = 1; t <= 5; t++) { g.turn = t; TC.tick(g, p, {}); }
  var seg = TC.summarize(g, p, {});
  return seg.indexOf('某架空学派ZZ') >= 0 && seg.indexOf('实学') < 0 && seg.indexOf('西学') < 0;
})());

console.log('\n[smoke-talent-cohorts] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
