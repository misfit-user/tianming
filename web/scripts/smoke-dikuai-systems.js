#!/usr/bin/env node
'use strict';
/* smoke-dikuai-systems — 地块系统全面优化 D1-D5（2026-07-03）防腐线。
 * D1 人口三重错位根治(递归叶+双账同写+活承载)  D2 叶级吏治连账(同源漂移)
 * D3 财赋分省分化+claimed加权归一守总额        D4 势力接地块三断链
 * D5 营建死账接活(解额入范式描述+募兵入主池)
 * D2/D3 行为级·余源码契约级(引擎 boot 依赖重·照 repo smoke 惯例)。 */
var fs = require('fs');
var path = require('path');
var ROOT = path.resolve(__dirname, '..');
var P = 0, F = 0;
function ok(c, m) { if (c) { P++; console.log('  ✓ ' + m); } else { F++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-dikuai-systems');

/* ── D3 · 行为级：hard-links 分化+守恒 ───────────────────────── */
console.log('— D3 · 财赋分省分化(行为) —');
global.window = global;
require(path.join(ROOT, 'tm-minxin-hard-links.js'));
var MHL = global.TM.MinxinHardLinks;
function mkLeaf(name, minxin, extra) {
  var leaf = {
    name: name, minxin: minxin,
    populationDetail: { mouths: 100000, households: 25000, ding: 24000, fugitives: 0, hiddenCount: 0 },
    fiscalDetail: { claimedRevenue: 10000, skimmingRate: 0 }
  };
  Object.keys(extra || {}).forEach(function (k) { leaf[k] = extra[k]; });
  return leaf;
}
var leafA = mkLeaf('甲县', 60);
var leafB = mkLeaf('乙县', 60, { _disasterEconomyReduce: 0.4 });
var root = {
  turn: 5,
  adminHierarchy: { player: { divisions: [
    { name: '江南省', children: [leafA] },
    { name: '陕西省', children: [leafB] }
  ] } },
  provinceStats: { '江南省': { magnatePower: 0 }, '陕西省': { magnatePower: 80 } },
  minxin: {}, fiscal: {}, military: {}, hukou: {}, localExecution: {}
};
var r = MHL.tick(root, { turn: 5 });
ok(r && r.ok && r.regions === 2, 'tick 跑通(2 叶)');
ok(leafB._mxhlMagnate === 80 && leafA._mxhlMagnate === 0, '豪强戳按省下沉到叶');
var fdA = leafA.fiscalDetail, fdB = leafB.fiscalDetail;
ok(fdA.actualRevenue > fdB.actualRevenue, '同民心下·豪强+灾情省实征更低(分化)');
var sumActual = fdA.actualRevenue + fdB.actualRevenue;
var sumBase = Math.round(10000 * leafA._mxhlRatios.base + 10000 * leafB._mxhlRatios.base);
ok(Math.abs(sumActual - sumBase) <= Math.max(4, sumBase * 0.002), '守恒:Σ实征≈Σ旧公式基线(K 归一·差=' + (sumActual - sumBase) + ')');
ok(fdA.retainedBudget === Math.max(0, fdA.actualRevenue - fdA.remittedToCenter), '留用=实征-起运(归一后重算)');

/* ── D2 · 行为级：叶级吏治连账 ──────────────────────────────── */
console.log('— D2 · 叶级吏治连账(行为) —');
(function () {
  var harness;
  try { harness = require('./smoke-corruption-harness'); } catch (_e) { harness = null; }
  if (!harness) { ok(false, 'corruption harness 可用'); return; }
  var h = harness.createHarness({ GM: harness.makeBaseGM({ turn: 8 }), P: harness.makeBaseP({}), random: function () { return 0.5; } });
  h.load('tm-corruption-engine.js');
  h.load('tm-corruption-cases.js');
  h.load('tm-corruption-extras.js');
  var CE = h.context.CorruptionEngine;
  CE.ensureModel();
  var GMx = h.context.GM;
  GMx.corruption.subDepts.provincial.true = 40;
  var la = { name: '同名县' }, lb = { name: '同名县' };
  GMx.adminHierarchy = { player: { divisions: [
    { name: '甲省', children: [la] },
    { name: '乙省', children: [lb] }
  ] } };
  GMx.provinceStats = { '甲省': { magnatePower: 0 }, '乙省': { magnatePower: 80 } };
  CE.updateLeafCorruption();
  ok(typeof la.corruption === 'number' && typeof lb.corruption === 'number', '叶 corruption 有确定性写者了');
  ok(lb.corruption - la.corruption > 5, '豪强省叶吏治更浊(同名同哈希·差=' + (lb.corruption - la.corruption).toFixed(1) + ')');
  var before = la.corruption;
  GMx.corruption.subDepts.provincial.true = 10;   // 肃贪大成
  CE.updateLeafCorruption();
  ok(la.corruption < before, '肃贪降基线→叶随之收敛(连账)');
})();

/* ── D1 · 源码契约 ─────────────────────────────────────────── */
console.log('— D1 · 人口三重错位根治(契约) —');
var bridge = read('tm-integration-bridge.js');
var huji = read('tm-huji-engine.js');
ok(/function _walkAdminLeaves\(nodes, out, seen\)/.test(huji)
  && /function _factionLeafGroups\(G\)/.test(huji)
  && /_walkAdminLeaves\(roots, leaves, (?:\[\]|new Set\(\))\)/.test(huji), '人口权威按 faction 递归取得行政区叶子');   // 判重集合 09-27 由数组改为 Set
ok(/function _syncLeafPopulationMirrors\(leaf, detail\)/.test(huji)
  && /leaf\.population\.mouths = detail\.mouths/.test(huji), 'Huji 同步 population 与 populationDetail 双账');
ok(/leafMouthsPerHousehold = Number\(pd\.households\) > 0 \? mouths \/ Number\(pd\.households\)/.test(huji)
  && /leafDingRatio = Number\(pd\.ding\) > 0 \? Number\(pd\.ding\) \/ mouths/.test(huji), '户与丁按本叶既有结构同比缩放');
ok(/detail\.mouths \/ cap/.test(huji) && /env\.currentLoad = load/.test(huji), '活承载负载随 Huji 人口重算');
ok(!/function _naturalPopulationGrowth\(/.test(bridge), 'IntegrationBridge 不再成为第二个人口生产者');

/* ── D4 · 源码契约 ─────────────────────────────────────────── */
console.log('— D4 · 势力接地块三断链(契约) —');
var econ = read('tm-faction-derived-economy.js');
ok(/governanceFactor = _clamp\(sum \/ n, 0\.6, 1\.15\)/.test(econ), '经济治理系数·夹[0.6,1.15]');
ok(/GMx && GMx\.provinceStats/.test(econ) && /st\.stability/.test(econ) && /st\.unrest/.test(econ), '读省活账(稳定/财富/腐败/民乱)');
ok(/governanceFactor: governanceFactor,/.test(econ), '系数出账(透明可查)');
var health = read('tm-faction-derived-health.js');
ok(/territorialControl = \(typeof metrics\.territoryStress === 'number'\)/.test(health), '第五指标 territorialControl(无账回落四指标)');
ok(/_comps\.push\(territorialControl\)/.test(health), '有账才入 overall 均值');
var fidx = read('tm-faction-index.js');
ok(/entry\.metrics\.territoryStress = Math\.round\(sum \/ n\)/.test(fidx), 'index 产 territoryStress(省均动荡)');
var tuzhi = read('tm-renwu-tuzhi.js');
ok(/f\.derivedStrength&&typeof f\.derivedStrength\.value==='number'/.test(tuzhi), '谱牒死链修:读 derivedStrength.value');

/* ── D5 · 源码契约 ─────────────────────────────────────────── */
console.log('— D5 · 营建死账接活(契约) —');
var prov = read('tm-endturn-province.js');
ok(/_builtRecruits \+= Math\.round\(n\)/.test(prov) && /\+ _bldLevy \+ _builtRecruits/.test(prov), '营建募兵入主池(叶 militaryRecruits 累加)');
var kejup = read('tm-keju-paradigm.js');
ok(/function _kjpGeoQuotaFromDivisions\(\)/.test(kejup), '解额分布聚合器在');
ok(/regionQuota\(解额·含营建\)/.test(kejup), '范式描述出解额行(quota 唯一消费链=喂 AI)');
ok(/南\|江\|杭\|无锡\|苏\|长沙\|庐山\|商丘/.test(kejup), '南北中桶与书院网络同款正则(两处一致)');

console.log('\nsmoke-dikuai-systems ' + (F === 0 ? 'PASS' : 'FAIL') + ' ' + P + '/' + (P + F));
process.exit(F === 0 ? 0 : 1);
