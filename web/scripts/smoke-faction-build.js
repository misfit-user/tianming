/* smoke-faction-build.js — S5 NPC 自主营建断言
 *   _formatBuildOpportunities(营建机宜感知·开关守卫) + _landFactionBuilds(落本派叶·硬门·防重复·只许本派地块)
 *   mock 要件：GM.adminHierarchy['后金'].divisions 的叶无 owner 字段(被 _findAdminTreeForFac 保留)·fac.name='后金' 匹配 key
 */
'use strict';
var path = require('path');
global.window = global;
global.TM = global.TM || {};
global.TM.BuildingWorks = require(path.join(__dirname, '..', 'tm-building-works.js'));
var FND = require(path.join(__dirname, '..', 'tm-faction-npc-llm-decision.js'));

var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

function setup(switchOn) {
  var leafBorder = { name: '宁远', borderRisk: 80, officeVacancy: 0, economyBase: { farmland: 0 }, buildings: [] };
  var leafVac = { name: '沈阳', borderRisk: 10, officeVacancy: 3, economyBase: { farmland: 0 }, buildings: [] };
  var leafFarm = { name: '辽阳', borderRisk: 5, officeVacancy: 0, economyBase: { farmland: 120000 }, buildings: [] };
  global.GM = { turn: 3, _factionLivingWorld: false, facs: [{ name: '后金' }], adminHierarchy: { '后金': { factionName: '后金', divisions: [leafBorder, leafVac, leafFarm] } } };   // 势力活世界已翻默认 ON(2026-07-22)·此处显式关·令 factionAgentEnabled 只由 switchOn 决定(否则默认总闸会带亮子闸·污染开关关的零回归断言)
  global.P = { conf: { factionAgentEnabled: !!switchOn } };
  return { leafBorder: leafBorder, leafVac: leafVac, leafFarm: leafFarm };
}

// ── T1: _formatBuildOpportunities 开关开→列需 ──
(function () {
  setup(true);
  var lines = FND._formatBuildOpportunities({ name: '后金' });
  ok(Array.isArray(lines) && lines.length > 0, 'BUILD_OPPORTUNITIES 开关开·列出营建机宜');
  var joined = lines.join('\n');
  ok(joined.indexOf('宁远') >= 0 && joined.indexOf('边警') >= 0, '边镇险情·列边警高的宁远(80)');
  ok(joined.indexOf('沈阳') >= 0 && joined.indexOf('官缺') >= 0, '官缺待补·列官缺高的沈阳(3)');
  ok(joined.indexOf('辽阳') >= 0 && joined.indexOf('田亩') >= 0, '农本可兴·列田邑辽阳');
})();

// ── T2: 开关关→返空(零回归) ──
(function () {
  setup(false);
  var lines = FND._formatBuildOpportunities({ name: '后金' });
  ok(Array.isArray(lines) && lines.length > 0, '旧关闭值不再关闭正式势力营建感知');
})();

// ── T3: _landFactionBuilds 落地本派叶 ──
(function () {
  var m = setup(true);
  var builds = [{ territory: '宁远', name: '镇边堡', category: 'military', feasibility: '合理', costActual: 20000, timeActual: 3, effectsStructured: { abs: { defenseBonus: 2 } }, judgedEffects: '固防', reason: '边警高' }];
  var landed = FND._landFactionBuilds({ name: '后金' }, builds);
  ok(landed && landed.length === 1, '落地·返回 1 条');
  ok(m.leafBorder.buildings.length === 1, '落地·push 到本派叶 division.buildings');
  var b = m.leafBorder.buildings[0];
  ok(b.status === 'building' && b.remainingTurns === 3, '落地·status=building·remainingTurns=工期');
  ok(b.isCustom === true && b._viaFactionAgent === '后金', '落地·标 _viaFactionAgent(可观测·NPC 自主营建)');
  ok(b.effectsStructured && b.effectsStructured.abs && b.effectsStructured.abs.defenseBonus === 2, '落地·effectsStructured 过硬门(defenseBonus 白名单·A4)');
})();

// ── T4: 只许本派真实地块·外地/不存在丢弃 ──
(function () {
  var m = setup(true);
  var builds = [{ territory: '北京', name: 'X', feasibility: '合理', costActual: 1000, timeActual: 2 }];  // 非本派地块
  var landed = FND._landFactionBuilds({ name: '后金' }, builds);
  ok(!landed, '非本派地块·不落地(只许本派真实地块建)');
  ok(m.leafBorder.buildings.length === 0 && m.leafVac.buildings.length === 0, '外地块·无任何 push');
})();

// ── T5: 防重复同名 + 不合理拒 ──
(function () {
  var m = setup(true);
  m.leafBorder.buildings = [{ name: '镇边堡' }];  // 已有同名
  var builds = [
    { territory: '宁远', name: '镇边堡', feasibility: '合理', costActual: 1000, timeActual: 1 },    // 重复·跳
    { territory: '沈阳', name: '不合理工', feasibility: '不合理', costActual: 1000, timeActual: 1 },  // 不合理·跳
    { territory: '辽阳', name: '屯田所', feasibility: '合理', costActual: 5000, timeActual: 2, effectsStructured: { pct: { 'economyBase.farmland': 0.05 } } }  // 合理·落
  ];
  var landed = FND._landFactionBuilds({ name: '后金' }, builds);
  ok(landed && landed.length === 1 && landed[0].name === '屯田所', '防重复+不合理拒·仅屯田所落地');
  ok(m.leafBorder.buildings.length === 1, '重复同名·未二次 push');
  ok(m.leafFarm.buildings.length === 1 && m.leafFarm.buildings[0].name === '屯田所', '屯田所落到辽阳');
})();

// ── 6. 完善·经济约束（扣本派库银·不继不建） ──
(function () {
  var m = setup(true);
  var poorFac = { name: '后金', treasury: { money: 10000 } };
  var lp = FND._landFactionBuilds(poorFac, [{ territory: '宁远', name: '巨堡', feasibility: '合理', costActual: 50000, timeActual: 3 }]);
  ok(!lp, '经济约束·库银不继(10000<50000)→不建');
  ok(m.leafBorder.buildings.length === 0, '不继·无 push');
  ok(poorFac.treasury.money === 10000, '不继·库银不扣');
  var m2 = setup(true);
  var richFac = { name: '后金', treasury: { money: 50000 } };
  var lr = FND._landFactionBuilds(richFac, [{ territory: '宁远', name: '镇边堡', feasibility: '合理', costActual: 20000, timeActual: 3, effectsStructured: { abs: { defenseBonus: 1 } } }]);
  ok(lr && lr.length === 1, '库银足→建');
  ok(richFac.treasury.money === 30000, '建→扣本派库银(50000-20000=30000)·实=' + richFac.treasury.money);
  ok(lr[0].cost === 20000, '落地清单带 cost');
})();

// ── 7. 完善·可观测（addEB 谍报让玩家见敌国营建） ──
(function () {
  setup(true);
  var ebCalls = [];
  global.addEB = function (cat, text) { ebCalls.push({ cat: cat, text: text }); };
  var fac = { name: '后金', treasury: { money: 50000 } };
  FND._landFactionBuilds(fac, [{ territory: '宁远', name: '镇边堡', category: 'military', feasibility: '合理', costActual: 20000, timeActual: 3, judgedEffects: '固边防' }]);
  ok(ebCalls.length >= 1, '可观测·addEB 被调');
  ok(ebCalls.some(function (c) { return c.cat === '谍报' && c.text.indexOf('后金') >= 0 && c.text.indexOf('宁远') >= 0 && c.text.indexOf('镇边堡') >= 0; }), '可观测·谍报含势力/地块/工役名');
  ok(ebCalls.some(function (c) { return c.text.indexOf('筑') >= 0; }), '可观测·军事工役用「筑」');
  delete global.addEB;
})();

// ── 8. 完善·NPC 自修半损建筑（闭 S6 损坏循环） ──
(function () {
  var dmgLeaf = { name: '宁远', buildings: [{ name: '城', status: 'damaged', costActual: 50000, _damageReverted: { fortLevel: 1 }, appliedDelta: { fortLevel: 1 } }], fortLevel: 2 };
  global.GM = { turn: 3, facs: [{ name: '后金' }], adminHierarchy: { '后金': { factionName: '后金', divisions: [dmgLeaf] } } };
  global.P = { conf: { factionAgentEnabled: true } };
  var ebCalls = []; global.addEB = function (cat, text) { ebCalls.push({ cat: cat, text: text }); };
  var fac = { name: '后金', treasury: { money: 20000 } };
  var rp = FND._repairFactionBuildings(fac);
  ok(rp && rp.length === 1, 'NPC自修·返修复 1 条');
  ok(dmgLeaf.buildings[0].status === 'completed', 'NPC自修·半损→completed');
  ok(dmgLeaf.fortLevel === 3, 'NPC自修·城防复(2→3·repairBuilding 复那一半)·实=' + dmgLeaf.fortLevel);
  ok(fac.treasury.money === 5000, 'NPC自修·扣半费 15000(造价30%·20000→5000)·实=' + fac.treasury.money);
  ok(ebCalls.some(function (c) { return c.text.indexOf('葺治') >= 0; }), 'NPC自修·谍报「葺治」可观测');
  var dmgLeaf2 = { name: '沈阳', buildings: [{ name: '台', status: 'damaged', costActual: 50000, _damageReverted: { fortLevel: 1 }, appliedDelta: { fortLevel: 1 } }], fortLevel: 2 };
  global.GM.adminHierarchy['后金'].divisions = [dmgLeaf2];
  var rp2 = FND._repairFactionBuildings({ name: '后金', treasury: { money: 1000 } });
  ok(!rp2 && dmgLeaf2.buildings[0].status === 'damaged', 'NPC自修·库银不继(1000<15000)→不修·仍半损');
  delete global.addEB;
})();

// ── 9. 完善·感知财力门槛 ──
(function () {
  setup(true);
  var lines = FND._formatBuildOpportunities({ name: '后金', treasury: { money: 88000 } });
  var joined = lines.join('\n');
  // 运行时措辞为权威：提示词实文是「本派库藏约…」·spec 原认死「库银」已过时
  ok(joined.indexOf('库藏') >= 0 && joined.indexOf('量入为出') >= 0, '感知·财力门槛(库藏/量入为出·让 LLM 量力而拟)');
})();

console.log('\n[smoke-faction-build] ' + pass + '/' + (pass + fail) + ' 通过' + (fail ? ('·' + fail + ' 失败') : ''));
process.exit(fail ? 1 : 0);
