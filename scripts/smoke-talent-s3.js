'use strict';
/* smoke-talent-s3.js — S3 端到端自测（8 检查）+ 打印「人才与风气」实样
 * 全管线：建筑桥接 onComplete → 引擎多回合 tick（瓶颈 ctx 由 tm-talent-bottlenecks 据真实全国产业实算）
 *   → 渗透爬升 / 师资自举 / 产业吸纳 / influenceProfile 全局倾向 / 双向阻力 / summarize AI 注入段。
 */
var TC = require('../tm-talent-cohorts.js');
var TBB = require('../tm-talent-building-bridge.js');
var BN = require('../tm-talent-bottlenecks.js');

var passed = 0, failed = 0;
function ok(desc, cond) { if (cond) { passed++; console.log('  PASS ' + desc); } else { failed++; console.log('  FAIL ' + desc); } }

// 富工矿商贸国（叶级 economyBase）→ 岗位需求 > 招生 → 吸纳得了
var P = {
  conf: { talentCohortEnabled: true },
  adminHierarchy: { F: { divisions: [
    { name: '工矿大府', economyBase: { mineralProduction: 5000000, commerceVolume: 10000000 }, populationDetail: { mouths: 2000000 }, troops: 20000 }
  ] } }
};
var GM = { turn: 0 };
TC.init(GM, P);
TC.registerParadigm(GM, { label: '科举经义', kind: 'established', stock: 800000 });   // 旧式庞大
// 一座新式学堂完工（造价 10 万 → 年毕业封 8000）→ 教「格致之学」（利于科技/工业）
var bld = { name: '格致学堂', startTurn: 1, costActual: 100000, effectsStructured: { talentSource: { newParadigm: { label: '格致之学', maturityTurns: 3, influenceProfile: { techPromotion: 0.8, industry: 0.6 }, absorptionKind: ['industry'] }, graduates: 12000 } } };
TBB.onComplete({ name: '京师' }, bld, null, P, GM);
var g = TC.findParadigm(GM, '格致之学');

// 多回合 tick（瓶颈 ctx 实算·无 teacherCapacityFor → 引擎师资自举默认）
var qEarly = null, qLate = null, penEarly = null;
for (var t = 1; t <= 40; t++) {
  GM.turn = t;
  var ctx = BN.buildCtx(GM, P);
  TC.tick(GM, P, ctx);
  if (t === 3) { qEarly = g.lastQuality; penEarly = TC.penetration(GM, P, ctx).byParadigm[g.id]; }
  if (t === 40) { qLate = g.lastQuality; }
}
var ctxF = BN.buildCtx(GM, P);
var penLate = TC.penetration(GM, P, ctxF).byParadigm[g.id];
var mods = TC.globalModifiers(GM, P, ctxF);
var bs = TC.backlashSignals(GM, P, ctxF);
var seg = TC.summarize(GM, P, ctxF);

// 1. 端到端渗透爬升
ok('端到端：渗透从近零爬升（penLate > penEarly·学校→历练→渗透）', penLate > penEarly && penLate > 0.01);
// 2. 师资自举：早期 stock≈0 师资稀 → 质量低；成熟人才回流后质量升
ok('师资自举：后期培养质量 > 早期（成熟人才回流任教）', qLate > qEarly && qEarly < 0.5);
// 3. 产业吸纳接线：富产业 → 吸纳得了 → 失业远小于成熟存量
ok('产业吸纳：富工矿国失业 < 成熟存量 5%（岗位充裕）', g.unemployed < g.stock * 0.05);
// 4. summarize 产出「人才与风气」段·含玩家 label·无写死专名
ok('summarize 含「人才与风气」+ 玩家 label「格致之学」·无写死「实学/西学」', seg.indexOf('人才与风气') >= 0 && seg.indexOf('格致之学') >= 0 && seg.indexOf('实学') < 0);
// 5. globalModifiers 反映 influenceProfile（格致 → techPromotion）
ok('全局倾向：influenceProfile 驱动 techPromotion > 0', num(mods.techPromotion) > 0 && num(mods.industry) > 0);
// 6. backlashSignals：渗透上升 → 旧势力反扑信号 > 0
ok('双向阻力：渗透上升触发旧势力反扑 backlash > 0', bs.backlash > 0);
// 7. 多范式：旧学庞大仍在分母 → emergent 渗透 < 1（几千新人改变不了数亿之国，须积累）
ok('多范式：旧学 80 万在分母 → 格致渗透 0<pen<0.6（旧式未被瞬间取代）', penLate > 0 && penLate < 0.6);
// 8. flag 关 → 端到端 no-op·summarize 空
ok('flag 关 → tick no-op + summarize 空', (function () {
  var gm = { turn: 1 }, p = { conf: {} };
  TC.tick(gm, p, {});
  return !gm._talentCohorts && TC.summarize(gm, p, {}) === '';
})());

function num(v) { var n = Number(v); return isFinite(n) ? n : 0; }

console.log('\n── 「人才与风气」AI 注入实样（跑 40 回合后）──');
console.log(seg);
console.log('\n[smoke-talent-s3] ' + (failed === 0 ? 'ALL PASS ' : 'FAIL ') + passed + (failed ? ' / ' + failed + ' failed' : ' (8 checks)'));
process.exit(failed === 0 ? 0 : 1);
