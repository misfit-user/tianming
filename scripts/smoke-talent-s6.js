'use strict';
/* smoke-talent-s6.js — S6 可观测面板数据 + 剧本 preset 自测（11 检查）
 * ① TalentCohorts.cards 显示就绪数据(范式/渗透档/有效/成熟/失业/质量 + 倾向 + 阻力·flag关 null)
 * ② 剧本 preset 播种逻辑(sc.talentParadigms → 既有正统·flag门控·去重·跨朝代取剧本label)
 * 注：面板渲染 _dfTalentCohortsHtml 在 player-core(浏览器·escHtml 耦合)·此处验数据层·渲染走真机/preview。
 */
var TC = require('../tm-talent-cohorts.js');

var passed = 0, failed = 0;
function ok(desc, cond) { if (cond) { passed++; console.log('  PASS ' + desc); } else { failed++; console.log('  FAIL ' + desc); } }

// ── ① cards 显示就绪数据 ──
ok('cards flag 关 → null（面板隐藏·零视觉）', TC.cards({ turn: 1 }, { conf: {} }) === null);
ok('cards 无范式 → null', (function () { var g = { turn: 1 }, p = { conf: { talentCohortEnabled: true } }; TC.init(g, p); return TC.cards(g, p) === null; })());

var GM = { turn: 0 }, P = { conf: { talentCohortEnabled: true } };
TC.init(GM, P);
TC.registerParadigm(GM, { label: '科举经义', kind: 'established', stock: 800000 });
var e = TC.registerParadigm(GM, { label: '格致之学', kind: 'emergent', maturityTurns: 3, influenceProfile: { techPromotion: 0.8, industry: 0.6 } });
TC.registerSource(GM, 'sch', e.id, 12000);
var ctx = { teacherCapacityFor: function () { return 4e5; }, absorptionDemandFor: function () { return 9000; }, institutionalRoomFor: function () { return 1; } };
for (var t = 1; t <= 20; t++) { GM.turn = t; TC.tick(GM, P, ctx); }
var data = TC.cards(GM, P);

ok('cards 返回 paradigms 数组（含既有正统 + 新学）', data && Array.isArray(data.paradigms) && data.paradigms.length === 2);
var em = data.paradigms.filter(function (p) { return p.kind === 'emergent'; })[0];
var es = data.paradigms.filter(function (p) { return p.kind === 'established'; })[0];
ok('新学卡片含 label/tier/penetration/effectiveStock/stock/training/unemployed/quality/intake', em && em.label === '格致之学' && em.tier && em.penetration > 0 && em.effectiveStock >= 0 && em.stock >= 0 && em.quality > 0 && em.intake > 0);
ok('既有正统卡片含 kind=established + stock', es && es.kind === 'established' && es.stock > 0 && es.label === '科举经义');
ok('cards 倾向由 influenceProfile 派生（techPromotion）', data.tendencies && data.tendencies.some(function (t) { return t.key === 'techPromotion' && t.value > 0; }));
ok('cards 含双向阻力字段（backlash/unrest/unemployed·数值）', typeof data.backlash === 'number' && typeof data.unrest === 'number' && typeof data.unemployed === 'number');

// ── ② 剧本 preset 播种逻辑（镜像 tm-patches doActualStart 的 _seedTalentParadigms）──
function seed(GM, P, sc) {
  if (!TC.enabled(P)) return;
  var presets = sc.talentParadigms || sc.talentCohorts;
  if (!Array.isArray(presets) || !presets.length) return;
  TC.init(GM, P);
  presets.forEach(function (pd) {
    if (!pd || !pd.label || TC.findParadigm(GM, pd.label)) return;
    TC.registerParadigm(GM, { label: pd.label, kind: (pd.kind === 'emergent') ? 'emergent' : 'established', stock: pd.stock, influenceProfile: pd.influenceProfile, absorptionKind: pd.absorptionKind, maturityTurns: pd.maturityTurns });
  });
}
var sc = { talentParadigms: [{ label: '科举经义', kind: 'established', stock: 800000 }, { label: '泰西新学', kind: 'emergent', influenceProfile: { techPromotion: 0.7 }, absorptionKind: ['industry'] }] };

var Gseed = { turn: 0 }, Pon = { conf: { talentCohortEnabled: true } };
seed(Gseed, Pon, sc);
var estP = TC.findParadigm(Gseed, '科举经义'), emP = TC.findParadigm(Gseed, '泰西新学');
ok('preset 播种既有正统（label/初始 stock·kind）', estP && estP.kind === 'established' && estP.stock === 800000);
ok('preset 播种新兴范式（influenceProfile/absorptionKind 保留）', emP && emP.kind === 'emergent' && emP.influenceProfile.techPromotion === 0.7 && emP.absorptionKind[0] === 'industry');

var Goff = { turn: 0 };
seed(Goff, { conf: {} }, sc);
ok('preset flag 关 → 不播种（零回归）', !Goff._talentCohorts);

seed(Gseed, Pon, sc);  // 二次
ok('preset 去重：同 label 不重复立', Object.keys(Gseed._talentCohorts.paradigms).length === 2);

console.log('\n[smoke-talent-s6] ' + (failed === 0 ? 'ALL PASS ' : 'FAIL ') + passed + (failed ? ' / ' + failed + ' failed' : ' (11 checks)'));
process.exit(failed === 0 ? 0 : 1);
