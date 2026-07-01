'use strict';
/* smoke-talent-s5.js — S5 全局阻力自测（13 检查）
 * ① backlash → 御案时政「请罢新学」(右·有choices) ② unrest → 「失业学潮」(左)
 * ③ 去重/冷却防刷屏 ④ _lastBacklash 写入(供 S5b) ⑤ S5b 动态 room 三态(当道压制/飞轮/政治阻力damp)
 * ⑥ S5c 临界非线性瓦解(旧式加速边缘化) ⑦ flag 关 no-op。
 */
var TC = require('../tm-talent-cohorts.js');
var BN = require('../tm-talent-bottlenecks.js');
var TB = require('../tm-talent-backlash.js');

var passed = 0, failed = 0;
function ok(desc, cond) { if (cond) { passed++; console.log('  PASS ' + desc); } else { failed++; console.log('  FAIL ' + desc); } }

// 手控 ctx（room override 1·隔离动态 room·只看反弹逻辑）
function ctxOf(tc, ad) { return { teacherCapacityFor: function () { return tc; }, absorptionDemandFor: function () { return ad; }, institutionalRoomFor: function () { return 1; } }; }

// ── ⑦ flag 关 no-op（先测·确保干净）──
(function () {
  var gm = { turn: 1 }, p = { conf: {} };
  var r = TB.tick(gm, p, {});
  ok('flag 关 → tick no-op（raised 0·无 currentIssues·无 _lastBacklash）', r.raised === 0 && !gm.currentIssues && !(gm._talentCohorts && gm._talentCohorts._lastBacklash));
})();

// ── ①右：backlash 高 → 请罢新学（渗透骤升触发）──
var GMr = { turn: 0, currentIssues: [] }, Pr = { conf: { talentCohortEnabled: true } };
TC.init(GMr, Pr);
TC.registerParadigm(GMr, { label: '科举经义', kind: 'established', stock: 100000 });
var er = TC.registerParadigm(GMr, { label: '格致之学', kind: 'emergent', maturityTurns: 1 });
TC.registerSource(GMr, 'sch', er.id, 50000);
var ctxR = ctxOf(1e7, 1e9);   // 师资足·岗位足 → 渗透骤升·无失业
for (var t = 1; t <= 3; t++) { GMr.turn = t; TC.tick(GMr, Pr, ctxR); TB.tick(GMr, Pr, ctxR); }
var right = (GMr.currentIssues || []).filter(function (i) { return i.sourceType === 'talent_backlash_right'; });
ok('右·backlash 高 → 御案时政「请罢新学」issue', right.length >= 1);
ok('右·issue 关键决策 + 3 choices 含 aiHint', right[0] && right[0].category === '关键决策' && right[0].choices.length === 3 && right[0].choices.every(function (c) { return c.text && c.aiHint; }));
ok('右·描述引用新学 label + 旧学 label（跨朝代·取剧本名）', right[0] && right[0].description.indexOf('格致之学') >= 0 && right[0].description.indexOf('科举经义') >= 0);
ok('④ _lastBacklash 已写入（供 S5b 动态 room）', GMr._talentCohorts._lastBacklash > 0);

// ── ③去重：再 tick（pending 仍在）→ 不重复 ──
var nBefore = GMr.currentIssues.length;
GMr.turn = 4; TC.tick(GMr, Pr, ctxR); TB.tick(GMr, Pr, ctxR);
ok('③ 去重：pending 右 issue 在 → 不重复添加', GMr.currentIssues.filter(function (i) { return i.sourceType === 'talent_backlash_right'; }).length === 1);
// 冷却：解决该 issue 后冷却期内再 tick → 不新增
GMr.currentIssues.forEach(function (i) { if (i.sourceType === 'talent_backlash_right') i.status = 'resolved'; });
GMr.turn = 5; TC.tick(GMr, Pr, ctxR); TB.tick(GMr, Pr, ctxR);
ok('③ 冷却：解决后冷却期内 → 不新增（防刷屏）', GMr.currentIssues.filter(function (i) { return i.sourceType === 'talent_backlash_right'; }).length === 1);

// ── ①左：unrest 高 → 失业学潮（岗位极少·毕业即失业）──
var GMl = { turn: 0, currentIssues: [] }, Pl = { conf: { talentCohortEnabled: true } };
TC.init(GMl, Pl);
TC.registerParadigm(GMl, { label: '旧学', kind: 'established', stock: 50000 });
var el = TC.registerParadigm(GMl, { label: '新学', kind: 'emergent', maturityTurns: 2 });
TC.registerSource(GMl, 'sch', el.id, 50000);
var ctxL = ctxOf(1e7, 800);   // 师资足·岗位极少 → 大量失业
for (var t2 = 1; t2 <= 4; t2++) { GMl.turn = t2; TC.tick(GMl, Pl, ctxL); TB.tick(GMl, Pl, ctxL); }
var left = (GMl.currentIssues || []).filter(function (i) { return i.sourceType === 'talent_backlash_left'; });
ok('左·unrest 高 → 御案时政「失业学潮」issue', left.length >= 1);
ok('左·描述含失业人数 + 有 choices', left[0] && left[0].description.indexOf('失业') >= 0 && left[0].choices.length === 3);

// ── ⑤ S5b 动态 room 三态 ──
function room(opts) {
  var gm = { _talentCohorts: { paradigms: {}, history: [], seq: 0 } };
  var st = gm._talentCohorts;
  st.paradigms['e1'] = { id: 'e1', kind: 'established', stock: opts.est };
  st.paradigms['m1'] = { id: 'm1', kind: 'emergent', effectiveStock: opts.emEff };
  if (opts.priorPen != null) st.history = [{ turn: 1, byParadigm: { m1: opts.priorPen } }];
  if (opts.bl != null) st._lastBacklash = opts.bl;
  return BN._dynamicRoom(gm, st.paradigms['m1']);
}
var roomDominated = room({ est: 1000000, emEff: 1000, priorPen: 0 });
var roomFlywheel = room({ est: 1000000, emEff: 1000, priorPen: 0.4 });
ok('S5b 旧式当道 → room 受压（<0.4）', roomDominated < 0.4);
ok('S5b 正反馈飞轮：上回合渗透高 → room 升（飞轮 > 当道）', roomFlywheel > roomDominated);
ok('S5b 政治阻力 damp：_lastBacklash 高 → room 更低', room({ est: 1000000, emEff: 1000, priorPen: 0.2, bl: 0.3 }) < room({ est: 1000000, emEff: 1000, priorPen: 0.2, bl: 0 }));

// ── ⑥ S5c 临界非线性瓦解 ──
var GMc = { turn: 0 }, Pc = { conf: { talentCohortEnabled: true } };
TC.init(GMc, Pc);
TC.registerParadigm(GMc, { label: '旧学正统', kind: 'established', stock: 100000 });
var ec = TC.registerParadigm(GMc, { label: '新学大兴', kind: 'emergent', maturityTurns: 1 });
TC.registerSource(GMc, 'sch', ec.id, 80000);
var ctxC = ctxOf(1e7, 1e9);
var collapsedSeen = false, estBeforeTB = null, estAfterTB = null, T = 12;
for (var t3 = 1; t3 <= T; t3++) {
  GMc.turn = t3; TC.tick(GMc, Pc, ctxC);
  var est = TC.findParadigm(GMc, '旧学正统');
  var before = est.stock;
  var r = TB.tick(GMc, Pc, ctxC);
  if (r.collapsed > 0 && estBeforeTB == null) { collapsedSeen = true; estBeforeTB = before; estAfterTB = est.stock; }
}
ok('S5c 渗透越临界 → 旧式正统加速边缘化（首次 collapsed>0·当回合额外衰减）', collapsedSeen && estAfterTB < estBeforeTB);
// 与「纯自然衰减基线」对比：跑 T 回合后旧式存量低于只有 0.015 自然衰减的轨迹 → 证瓦解叠加了额外边缘化
var naturalOnly = 100000 * Math.pow(1 - TC.TUNING.decayRate, T);
var actualEst = TC.findParadigm(GMc, '旧学正统').stock;
ok('S5c 旧式存量低于纯自然衰减基线（非线性瓦解·新进握事权）', actualEst < naturalOnly - 1);

console.log('\n[smoke-talent-s5] ' + (failed === 0 ? 'ALL PASS ' : 'FAIL ') + passed + (failed ? ' / ' + failed + ' failed' : ' (14 checks)'));
process.exit(failed === 0 ? 0 : 1);
