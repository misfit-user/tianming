'use strict';
/* smoke-talent-s2.js — S2 建筑接线自测（18 检查）
 * 桥接单元（费效封顶/readSpec/新范式注册/registerSource/幂等/可逆/flag关/复用范式）
 * + 端到端（真 building-works.applyCompletion 触发桥接）
 * + 普通建筑零回归（无 talentSource → 不路由、效果照常入账）。
 * 注：require 三个 talent 模块 + building-works 后，均挂在 globalThis.TM.*，互相按 window.TM 兜底可见。
 */
var TC = require('../tm-talent-cohorts.js');             // → globalThis.TM.TalentCohorts
var TBB = require('../tm-talent-building-bridge.js');     // → globalThis.TM.TalentBuildingBridge
var BW = require('../tm-building-works.js');              // → globalThis.TM.BuildingWorks（含 S2 hook）

var passed = 0, failed = 0;
function ok(desc, cond) { if (cond) { passed++; console.log('  PASS ' + desc); } else { failed++; console.log('  FAIL ' + desc); } }

// ── 桥接单元：费效封顶（造价档定年毕业数上限）──
ok('费效封顶：5000 毕业 @cost30000 → 封 3000', TBB.capGraduates(5000, 30000) === 3000);
ok('费效封顶：低于上限不动（100 @cost150000 → 100）', TBB.capGraduates(100, 150000) === 100);
ok('费效封顶：十两银办不出大学堂（5000 @cost100 → 50）', TBB.capGraduates(5000, 100) === 50);
ok('费效封顶：零毕业 → 0', TBB.capGraduates(0, 30000) === 0);

// ── 桥接单元：readSpec ──
ok('readSpec 读 effectsStructured.talentSource', (function () {
  var s = TBB.readSpec({ effectsStructured: { talentSource: { graduates: 100 } } }, null);
  return s && s.graduates === 100;
})());
ok('readSpec 回落 typeDef.effects.talentSource', (function () {
  var s = TBB.readSpec({}, { effects: { talentSource: { graduates: 7 } } });
  return s && s.graduates === 7;
})());
ok('readSpec 无 talentSource → null', TBB.readSpec({ effectsStructured: { abs: {} } }, null) === null);

// ── 桥接：onComplete 新范式 + registerSource + 费效封顶 + 幂等 ──
var G1 = { turn: 3 }, Pon = { conf: { talentCohortEnabled: true } };
var div1 = { name: '京师' };
var bld1 = { name: '格致学堂', startTurn: 1, costActual: 30000, effectsStructured: { talentSource: { newParadigm: { label: '格致之学', influenceProfile: { techPromotion: 0.8 }, absorptionKind: ['industry'] }, graduates: 5000 } } };
var r1 = TBB.onComplete(div1, bld1, null, Pon, G1);
var pdg = TC.findParadigm(G1, '格致之学');
ok('onComplete 新范式注册（findParadigm by label）', r1 === true && pdg && pdg.kind === 'emergent');
ok('onComplete registerSource（sources 含该建筑源）', pdg && Object.keys(pdg.sources).length === 1);
ok('onComplete 年毕业费效封顶（5000 @cost30000 → 源 3000）', pdg && pdg.sources[bld1._talentSrcId] === 3000);
ok('onComplete 打 bld._talentSrcId/_talentParadigmId', !!bld1._talentSrcId && bld1._talentParadigmId === pdg.id);
ok('onComplete 幂等（二次调用 → false·不重复注册）', TBB.onComplete(div1, bld1, null, Pon, G1) === false && Object.keys(pdg.sources).length === 1);

// ── 桥接：复用已有范式（paradigm 数不变）──
var nBefore = Object.keys(G1._talentCohorts.paradigms).length;
var bld2 = { name: '格致分校', startTurn: 2, costActual: 6000, effectsStructured: { talentSource: { paradigm: '格致之学', graduates: 2000 } } };
TBB.onComplete({ name: '南京' }, bld2, null, Pon, G1);
var nAfter = Object.keys(G1._talentCohorts.paradigms).length;
ok('复用已有范式（同 label → 不新建·paradigm 数不变）', nAfter === nBefore && bld2._talentParadigmId === pdg.id);

// ── 桥接：flag 关 no-op ──
ok('flag 关 → onComplete no-op（false·不建状态）', (function () {
  var g = { turn: 0 }, p = { conf: {} };
  var r = TBB.onComplete({ name: 'X' }, { name: 'Y', startTurn: 0, costActual: 30000, effectsStructured: { talentSource: { graduates: 5000 } } }, null, p, g);
  return r === false && !g._talentCohorts;
})());

// ── 桥接：onRevert 撤源（可逆）──
var srcId1 = bld1._talentSrcId;
var rev = TBB.onRevert(div1, bld1, G1);
ok('onRevert 撤源（sources 不再含该源）', rev === true && pdg.sources[srcId1] == null);
ok('onRevert 清 bld._talentSrcId/_talentParadigmId', !bld1._talentSrcId && !bld1._talentParadigmId);

// ── 端到端：真 building-works.applyCompletion 触发桥接 ──
ok('端到端：真 applyCompletion → 桥接注册范式 + 源', (function () {
  var GM = { turn: 5 }, P = { conf: { talentCohortEnabled: true } };
  var div = { name: '武昌' };
  var bld = { name: '船政学堂', startTurn: 4, costActual: 30000, effectsStructured: { talentSource: { newParadigm: { label: '船政之学', absorptionKind: ['military'] }, graduates: 4000 } } };
  var booked = BW.applyCompletion(div, bld, P, GM);
  var p = TC.findParadigm(GM, '船政之学');
  return booked === true && p && p.sources[bld._talentSrcId] === 3000;  // 4000 @cost30000 封 3000
})());

// ── 零回归：普通建筑（无 talentSource）不路由、效果照常入账 ──
ok('零回归：普通建筑不建范式 + 效果照常入账（flag 开也不误路由）', (function () {
  var GM = { turn: 5 }, P = { conf: { talentCohortEnabled: true } };
  var div = { name: '扬州', economyBase: { commerceVolume: 10000 } };
  var bld = { name: '钞关', startTurn: 4, costActual: 30000, effectsStructured: { abs: { 'economyBase.commerceVolume': 5000 } } };
  var booked = BW.applyCompletion(div, bld, P, GM);
  var noTalent = !GM._talentCohorts || Object.keys(GM._talentCohorts.paradigms).length === 0;
  return booked === true && div.economyBase.commerceVolume > 10000 && noTalent;
})());

console.log('\n[smoke-talent-s2] ' + (failed === 0 ? 'ALL PASS ' : 'FAIL ') + passed + (failed ? ' / ' + failed + ' failed' : ' (18 checks)'));
process.exit(failed === 0 ? 0 : 1);
