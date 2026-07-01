'use strict';
/* smoke-talent-s3b.js — S3b 瓶颈真实接线自测（12 检查·产业约束）
 * 验证 tm-talent-bottlenecks.buildCtx 把「岗位吸纳」接到真实全国 economyBase/政区/驻军：
 *   没对应产业 = 没岗位 = 毕业即失业（防数字游戏的产业瓶颈变成游戏真约束）。
 */
var TC = require('../tm-talent-cohorts.js');
var BN = require('../tm-talent-bottlenecks.js');

var passed = 0, failed = 0;
function ok(desc, cond) { if (cond) { passed++; console.log('  PASS ' + desc); } else { failed++; console.log('  FAIL ' + desc); } }
function near(a, b) { return Math.abs(a - b) < 1e-6; }

// 含父子嵌套的 adminHierarchy：仅叶级(无 children)计入聚合，父节点跳过不重复计
function world(scale) {
  return {
    adminHierarchy: {
      F1: {
        divisions: [
          { name: '叶1', economyBase: { mineralProduction: 1000 * scale, commerceVolume: 2000 * scale, maritimeTradeVolume: 500 * scale, farmland: 3000 * scale, saltProduction: 100 * scale }, populationDetail: { mouths: 100000 }, troops: 5000 },
          { name: '父', children: [
            { name: '叶2', economyBase: { commerceVolume: 1000 * scale }, populationDetail: { mouths: 50000 }, troops: 1000 }
          ] }
        ]
      }
    }
  };
}
var P1 = world(1);
var t = BN.aggregate(null, P1);

// 1-5. 聚合（叶级·跳父）
ok('聚合 divs=2（叶级·父跳过不重复）', t.divs === 2);
ok('聚合 commerce=3000（叶1 2000 + 叶2 1000）', near(t.commerce, 3000));
ok('聚合 mineral=1000（仅叶1）', near(t.mineral, 1000));
ok('聚合 recruits=6000（troops 5000+1000）', near(t.recruits, 6000));
ok('聚合 mouths=150000', near(t.mouths, 150000));
// 6-8. 各业岗位密度
ok('governance 需求 = divs×20 = 40', near(BN.demandForKind('governance', t), t.divs * BN.DENSITY.governance));
ok('military 需求 = recruits×density', near(BN.demandForKind('military', t), t.recruits * BN.DENSITY.military));
ok('industry 需求 = (mineral+commerce)×density', near(BN.demandForKind('industry', t), (t.mineral + t.commerce) * BN.DENSITY.industry));
// 9-10. ctx.absorptionDemandFor 按范式 absorptionKind 求和
var ctx1 = BN.buildCtx(null, P1);
ok('absorptionDemandFor[industry] = industry 需求', near(ctx1.absorptionDemandFor({ absorptionKind: ['industry'] }), BN.demandForKind('industry', t)));
ok('absorptionDemandFor[industry+military] = 两者之和', near(ctx1.absorptionDemandFor({ absorptionKind: ['industry', 'military'] }), BN.demandForKind('industry', t) + BN.demandForKind('military', t)));
// 11. institutionalRoomFor 读 conf.talentInstitutionalRoom
var ctxRoom = BN.buildCtx(null, { adminHierarchy: P1.adminHierarchy, conf: { talentInstitutionalRoom: 0.5 } });
ok('institutionalRoomFor 读 conf.talentInstitutionalRoom=0.5', near(ctxRoom.institutionalRoomFor({}), 0.5));

// 12. 端到端产业约束：富产业国吸纳得了→失业少渗透高；荒产业国没岗位→毕业即大量失业
function runWorld(P) {
  var GM = { turn: 0 }; P.conf = P.conf || {}; P.conf.talentCohortEnabled = true;
  TC.init(GM, P);
  TC.registerParadigm(GM, { label: '旧', kind: 'established', stock: 300000 });
  var e = TC.registerParadigm(GM, { label: '工技新学', kind: 'emergent', maturityTurns: 3, absorptionKind: ['industry'] });
  TC.registerSource(GM, 'sch', e.id, 8000);   // 年招 8000 工技人才
  var ctx = BN.buildCtx(GM, P);
  // 给足师资(隔离师资瓶颈)，单看产业吸纳
  ctx.teacherCapacityFor = function () { return 1e7; };
  for (var i = 1; i <= 8; i++) { GM.turn = i; TC.tick(GM, P, ctx); }
  return { un: TC.findParadigm(GM, e.id).unemployed, pen: TC.penetration(GM, P, ctx).byParadigm[e.id] };
}
var rich = runWorld(world(5000));   // 工矿商贸放大 5000 倍 → 岗位需求 > 招生，全吸纳
var barren = runWorld(world(1));     // 原始小产业 → 没岗位
ok('端到端产业约束：荒产业毕业即大量失业(>3万)、富产业吸纳得了(失业近零·渗透>荒产业5倍)',
  barren.un > 30000 && rich.un < barren.un * 0.3 && rich.pen > barren.pen * 5);
console.log('    [端到端] 富产业 un=' + Math.round(rich.un) + ' pen=' + rich.pen.toFixed(4) + '  |  荒产业 un=' + Math.round(barren.un) + ' pen=' + barren.pen.toFixed(4));

console.log('\n[smoke-talent-s3b] ' + (failed === 0 ? 'ALL PASS ' : 'FAIL ') + passed + (failed ? ' / ' + failed + ' failed' : ''));
process.exit(failed === 0 ? 0 : 1);
