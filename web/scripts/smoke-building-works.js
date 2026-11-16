#!/usr/bin/env node
/* eslint-env node */
// smoke-building-works.js — 建筑工役引擎实跑断言（2026-06-12）
// 验：工期递减→完工入账（白名单/appliedDelta/pct 起步量/民心摊叶/吏治）→维护费→欠费失修→拆毁回退→旧完工不溯往。
'use strict';

const path = require('path');
const BW = require(path.join(__dirname, '..', 'tm-building-works.js'));

let passed = 0, failed = 0;
function ok(cond, msg) {
  if (cond) { passed += 1; console.log('  PASS', msg); }
  else { failed += 1; console.error('  FAIL', msg); }
}

function leafDiv(name, extra) {
  return Object.assign({
    name: name,
    minxin: 60,
    corruptionLocal: 50,
    economyBase: { commerceVolume: 10000, saltProduction: 0, postRelays: 10, roadQuality: 40, kejuQuota: 5, farmland: 1000000 },
    publicTreasury: { money: { stock: 5000, available: 5000 }, grain: { stock: 0 }, cloth: { stock: 0 } },
    buildings: []
  }, extra || {});
}

const div = leafDiv('北直隶');
const P = {
  buildingSystem: { enabled: true, buildingTypes: [
    { name: '城墙', category: 'military', maxLevel: 5, baseCost: 30000, buildTime: 18 },
    { name: '钞关', category: 'economic', maxLevel: 4, baseCost: 8000, buildTime: 4 },
    { name: '书院', category: 'cultural', maxLevel: 4, baseCost: 6000, buildTime: 6 },
    { name: '盐场·盐课提举司', category: 'economic', maxLevel: 5, baseCost: 10000, buildTime: 6 }
  ] },
  adminHierarchy: { player: { factionName: '明朝廷', divisions: [div] } }
};
// 区划只留游戏里那份（GM·2026-11-15）：营造只扫 GM 的区划；这里让 GM 与 P 共用一棵树，下面往树里加州两边都看得见
const GM = { turn: 10, adminHierarchy: P.adminHierarchy };

// ── 1. 工期递减 → 完工入账（abs: fortLevel）──
div.buildings.push({ name: '城墙', level: 1, status: 'building', remainingTurns: 2, startTurn: 8, costActual: 30000 });
let st = BW.tick(GM, P);
ok(div.buildings[0].status === 'building' && div.buildings[0].remainingTurns === 1, '在建第一回合递减 2→1');
ok(st.building === 1 && st.completed === 0, 'tick 统计：在建 1 完工 0');
GM.turn = 11;
st = BW.tick(GM, P);
ok(div.buildings[0].status === 'completed', '工期归零翻转 completed');
ok(div.fortLevel === 1, '城墙完工 → division.fortLevel = 1（围城读链字段）');
ok(div.buildings[0].appliedTurn === 11, 'appliedTurn 记完工回合（幂等标记）');
ok(div.buildings[0].appliedDelta && div.buildings[0].appliedDelta.fortLevel === 1, 'appliedDelta 记账（可逆）');
ok(typeof div.buildings[0].effectSummary === 'string' && div.buildings[0].effectSummary.indexOf('城防') >= 0, 'effectSummary 摘要生成（AI prompt 消费）');

// ── 2. 维护费扣地方库银 ──
const moneyBefore = div.publicTreasury.money.stock;
GM.turn = 12;
st = BW.tick(GM, P);
const upkeep = BW.upkeepFor(div.buildings[0], BW.typeDefFor('城墙', P));
ok(upkeep === 900, '城墙维护费 = 军工/城防分档 3% = 900 两/回合（S6 维护费分档·原一刀切 2%=600）');
ok(div.publicTreasury.money.stock === moneyBefore - 900, '维护费已扣地方库银');
ok(st.upkeepPaid === 900, 'tick 统计 upkeepPaid');

// ── 3. pct 起步量（现值不足时按 base 起步）──
const div2 = leafDiv('山东');
P.adminHierarchy.player.divisions.push(div2);
div2.buildings.push({ name: '钞关', level: 1, status: 'building', remainingTurns: 1, costActual: 8000 });
GM.turn = 13;
BW.tick(GM, P);
// commerceVolume 现值 10000 → pct 4% = 400 < base 15000 → 起步量 15000
ok(div2.economyBase.commerceVolume === 25000, '钞关完工：商贸 10000 + max(4%, 起步15000) = 25000');

// ── 4. 民心摊叶（书院 +1·封顶）+ 解额 ──
const div3 = leafDiv('河南');
P.adminHierarchy.player.divisions.push(div3);
div3.buildings.push({ name: '书院', level: 1, status: 'building', remainingTurns: 1, costActual: 6000 });
GM.turn = 14;
BW.tick(GM, P);
ok(div3.minxin === 61, '书院完工：叶子民心 60→61（摊叶·封顶±2）');
ok(div3.economyBase.kejuQuota === 7, '书院完工：解额 5→7');

// ── 5. 欠费 3 回合 → 失修 ──
div3.publicTreasury.money.stock = 0; div3.publicTreasury.money.available = 0;
GM.turn = 15; BW.tick(GM, P);
GM.turn = 16; BW.tick(GM, P);
GM.turn = 17; st = BW.tick(GM, P);
ok(div3.buildings[0].status === 'neglected' && div3.buildings[0].arrears >= 3, '连欠 3 回合 → neglected 失修');
// 库银恢复 → 修缮复用
div3.publicTreasury.money.stock = 9999;
GM.turn = 18; BW.tick(GM, P);
ok(div3.buildings[0].status === 'completed' && div3.buildings[0].arrears === 0, '库银恢复 → 修缮复用 completed');

// ── 6. 拆毁回退 appliedDelta ──
BW.revertBuilding(div, div.buildings[0]);
ok(div.fortLevel === 0, '拆毁回退：fortLevel 1→0');
ok(div.buildings[0].appliedDelta === undefined && div.buildings[0].appliedTurn === undefined, '回退后清 appliedDelta/appliedTurn');

// ── 7. 白名单外路径静默丢弃 ──
const div4 = leafDiv('陕西');
P.adminHierarchy.player.divisions.push(div4);
div4.buildings.push({ name: '自拟·黑账工程', level: 1, status: 'building', remainingTurns: 1, costActual: 100,
  effectsStructured: { abs: { 'guoku.money': 999999, 'economyBase.postRelays': 2 } } });
GM.turn = 19;
BW.tick(GM, P);
ok(div4.guoku === undefined, '白名单外路径 guoku.money 被丢弃（apply 硬门）');
// S3 费效封顶后：费 100 两的驿站效果封到 max(1, 100/1500)=1 → 10→11
ok(div4.economyBase.postRelays === 11, '白名单内路径 postRelays 入账且按费效封顶 10→11');

// ── 8. 旧完工建筑不溯往（无 appliedTurn 的 completed 只走维护、不补账）──
const div5 = leafDiv('南直隶');
P.adminHierarchy.player.divisions.push(div5);
div5.buildings.push({ name: '盐场·盐课提举司', level: 3, status: 'completed', costActual: 10000 }); // 旧档建筑
const saltBefore = div5.economyBase.saltProduction;
GM.turn = 20;
BW.tick(GM, P);
ok(div5.economyBase.saltProduction === saltBefore, '旧完工建筑不溯往补账（读档安全）');
ok(div5.buildings[0].appliedTurn === undefined, '旧完工建筑不打 appliedTurn');

// ── 9. 纯叙事建筑（烽燧）完工不入账但有标记 ──
const div6 = leafDiv('辽东');
P.adminHierarchy.player.divisions.push(div6);
div6.buildings.push({ name: '烽火台', level: 1, status: 'building', remainingTurns: 1, costActual: 800 });
const snap6 = JSON.stringify(div6.economyBase);
GM.turn = 21;
BW.tick(GM, P);
ok(div6.buildings[0].status === 'completed' && JSON.stringify(div6.economyBase) === snap6, '烽燧完工：经济账面不动（纯叙事·AI prompt 可见）');

// ── 10. S3 费效封顶：sanitizeStructuredFx ──
const sane1 = BW.sanitizeStructuredFx({ pct: { 'economyBase.commerceVolume': 0.5 }, abs: { fortLevel: 3, 'guoku.money': 5 }, upkeepPerTurn: -5 }, 800);
ok(sane1.pct['economyBase.commerceVolume'] === 0.03, '千两以下 pct 50% 削至 3%（费效为度）');
ok(!sane1.abs || sane1.abs.fortLevel === undefined, '小费修不出雄关：费 800 两的 fortLevel 弃');
ok(sane1.upkeepPerTurn === 0, '负维护费夹到 0');
const sane2 = BW.sanitizeStructuredFx({ abs: { fortLevel: 3, militaryRecruits: 99999 } }, 20000);
ok(sane2.abs.fortLevel === 1, '两万两可修城防·每级至多 +1 档');
ok(sane2.abs.militaryRecruits === 5000, '募兵上限封 cost/4 = 5000');
const sane3 = BW.sanitizeStructuredFx({ abs: { 'economyBase.commerceVolume': 99999999 } }, 10000);
ok(sane3.abs['economyBase.commerceVolume'] === 80000, '大数账目封 cost×8');
ok(BW.sanitizeStructuredFx({ abs: { 'guoku.money': 88 } }, 5000) === null, '全越界 → null（回落推断器）');

// ── 11. S3 端到端：custom_build 完工按核定账入账（封顶后）──
const div7 = leafDiv('湖广');
P.adminHierarchy.player.divisions.push(div7);
div7.buildings.push({ name: '自拟·织锦大坊', level: 1, status: 'building', remainingTurns: 1, costActual: 10000, isCustom: true,
  effectsStructured: { pct: { 'economyBase.commerceVolume': 0.30 }, minxin: 1 } });
GM.turn = 22;
BW.tick(GM, P);
ok(div7.economyBase.commerceVolume === 10800, '自拟织坊完工：30% 削至 8% → 商贸 10000→10800');
ok(div7.minxin === 61, '自拟核定民心 +1 入账');

// ── 12. 双源修（2026-07-03）：工程落 GM.adminHierarchy（活树）而非 P.adminHierarchy 时也须被 tick ──
//   复现玩家 bug：自拟营建经 _adminSources 落 GM 树·P 树为空{}·旧 tick 只扫 P → 工期永不推进「永远工役中」。
(function () {
  var gmDiv = leafDiv('北直隶·GM树');
  gmDiv.buildings.push({ name: '平世大学', level: 1, status: 'building', remainingTurns: 1, costActual: 6000, isCustom: true });
  // P 树为空（真机存档所见）·工程只在 GM 树
  var P2 = { conf: {}, adminHierarchy: {}, buildingSystem: { buildingTypes: [] } };
  var GM2 = { turn: 30, adminHierarchy: { player: { factionName: '明廷', divisions: [gmDiv] } } };
  var s = BW.tick(GM2, P2);
  ok(gmDiv.buildings[0].remainingTurns === 0 && gmDiv.buildings[0].status === 'completed',
     '★工程落 GM 树·P 树空：tick 遍历双源→余1回合工程当回合工竣（根治「永远工役中」）');
  ok(s.completed === 1, 'tick 统计计入 GM 树完工');

  // 去重：同一 div 对象同时挂在 P 树与 GM 树（别名存档）→ 只递减一次，不双减
  var shared = leafDiv('共享区');
  shared.buildings.push({ name: '义仓', level: 1, status: 'building', remainingTurns: 3, costActual: 2000 });
  var Pn = { conf: {}, adminHierarchy: { player: { divisions: [shared] } }, buildingSystem: { buildingTypes: [] } };
  var GMn = { turn: 31, adminHierarchy: { player: { divisions: [shared] } } };  // 同一 shared 对象引用
  BW.tick(GMn, Pn);
  ok(shared.buildings[0].remainingTurns === 2, '★别名树去重：同一 div 只递减一次(3→2·非 3→1 双减)');
})();

console.log('\n[smoke-building-works] ' + (failed === 0 ? 'PASS' : 'FAIL') + ' — ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed === 0 ? 0 : 1);
