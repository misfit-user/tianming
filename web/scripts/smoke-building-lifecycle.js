/* smoke-building-lifecycle.js — S6 生命周期深化断言
 *   维护费分档(军工/水利贵·文教/仓廪廉) + damaged 半损/修缮机制 + 灾异触发(读 disasterRecord) + 开关守卫
 */
'use strict';
var path = require('path');
var BW = require(path.join(__dirname, '..', 'tm-building-works.js'));

var pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('  ✗ ' + m); } }

// ── 1. 维护费分档 ──
(function () {
  var mil = BW.upkeepFor({ name: '镇边堡', costActual: 100000 }, null);   // 堡→军工 3%
  var cul = BW.upkeepFor({ name: '府学', costActual: 100000 }, null);     // 学→文教 1.2%
  var def = BW.upkeepFor({ name: '市集坊', costActual: 100000 }, null);   // 无匹配→2%
  ok(mil === 3000, '军工/城防贵养 3%(镇边堡 100000→3000)·实=' + mil);
  ok(cul === 1200, '文教廉养 1.2%(府学 100000→1200)·实=' + cul);
  ok(def === 2000, '余 2%(市集坊 100000→2000)·实=' + def);
  ok(mil > def && def > cul, '分档序：军工 > 默认 > 文教');
})();

// ── 2. damageBuilding 半损（存量减半·民心不损） ──
(function () {
  var div = { economyBase: { farmland: 100000 }, fortLevel: 3, minxin: 60 };
  var bld = { name: '雄关', status: 'completed', costActual: 80000, appliedDelta: { 'economyBase.farmland': 40000, 'fortLevel': 2, '_minxin': 1 } };
  var r = BW.damageBuilding(div, bld);
  ok(r === true && bld.status === 'damaged', '半损·status=damaged');
  ok(div.economyBase.farmland === 80000, '半损·田亩减一半(100000→80000)·实=' + div.economyBase.farmland);
  ok(div.fortLevel === 2, '半损·城防减一半(3→2)·实=' + div.fortLevel);
  ok(bld._damageReverted && bld._damageReverted['economyBase.farmland'] === 20000 && bld._damageReverted['fortLevel'] === 1, '半损·记 _damageReverted(待修缮复)');
  ok(bld.appliedDelta['economyBase.farmland'] === 20000, 'appliedDelta 同步减为当前实应用(20000)');
  ok(BW.damageBuilding(div, bld) === false, '已损·不重复半损');
})();

// ── 3. repairBuilding 修缮复完 ──
(function () {
  var div = { economyBase: { farmland: 100000 }, fortLevel: 3 };
  var bld = { name: '雄关', status: 'completed', costActual: 80000, appliedDelta: { 'economyBase.farmland': 40000, 'fortLevel': 2 } };
  BW.damageBuilding(div, bld);   // → farmland 80000·fortLevel 2
  var r = BW.repairBuilding(div, bld);
  ok(r === true && bld.status === 'completed', '修缮·status=completed');
  ok(div.economyBase.farmland === 100000, '修缮·田亩复满(80000→100000)·实=' + div.economyBase.farmland);
  ok(div.fortLevel === 3, '修缮·城防复满(2→3)·实=' + div.fortLevel);
  ok(!bld._damageReverted, '修缮·_damageReverted 清');
})();

// ── 4. 损后拆毁·不双扣（appliedDelta 同步保证 revert 正确·回到 baseline） ──
(function () {
  var div = { economyBase: { farmland: 100000 }, fortLevel: 3 };   // baseline=60000 farmland / fortLevel 1（建筑贡献 40000 / 2）
  var bld = { name: '雄关', status: 'completed', costActual: 80000, appliedDelta: { 'economyBase.farmland': 40000, 'fortLevel': 2 } };
  BW.damageBuilding(div, bld);    // → farmland 80000·fortLevel 2
  BW.revertBuilding(div, bld);    // 拆毁·revert 当前 appliedDelta(已减半)
  ok(div.economyBase.farmland === 60000, '损后拆毁·田亩回 baseline 60000(不双扣)·实=' + div.economyBase.farmland);
  ok(div.fortLevel === 1, '损后拆毁·城防回 baseline 1·实=' + div.fortLevel);
})();

// ── 5. tick 灾异触发半损（读 disasterRecord·Math.random 受控） ──
(function () {
  var div = {
    name: '宁远', economyBase: { farmland: 100000, disasterRecord: [{ type: '旱', severity: '重', startTurn: 5 }] },
    fortLevel: 3, publicTreasury: { money: { stock: 20000 } },
    buildings: [{ name: '城', status: 'completed', costActual: 50000, appliedDelta: { 'fortLevel': 2 } }]
  };
  // 区划只留游戏里那份（GM·2026-11-15）：营造结算只扫 GM 的区划，P 只供设置与建筑类型表
  var GM = { turn: 5, adminHierarchy: { player: { divisions: [div] } } };
  var P = { conf: {} };
  var orig = Math.random; Math.random = function () { return 0; };   // 0 < 0.4 → 重灾必损
  var st = BW.tick(GM, P);
  Math.random = orig;
  ok(div.buildings[0].status === 'damaged', 'tick·遭重灾→城半损(status=damaged)');
  ok(div.fortLevel === 2, 'tick·灾损·城防减半(3→2)·实=' + div.fortLevel);
  ok(st.damaged === 1, 'tick·stat.damaged=1');
})();

// ── 6. tick 次回合修缮（库银可支半费·无新灾） ──
(function () {
  var div = {
    name: '宁远', economyBase: { farmland: 100000, disasterRecord: [{ type: '旱', severity: '重', startTurn: 5 }] },
    fortLevel: 3, publicTreasury: { money: { stock: 20000 } },
    buildings: [{ name: '城', status: 'completed', costActual: 50000, appliedDelta: { 'fortLevel': 2 } }]
  };
  var P = { conf: {} };
  var AH = { player: { divisions: [div] } };   // 区划挂在 GM 上（区划只留游戏里那份）
  var orig = Math.random; Math.random = function () { return 0; };
  BW.tick({ turn: 5, adminHierarchy: AH }, P);                 // 回合5·灾损
  var st2 = BW.tick({ turn: 6, adminHierarchy: AH }, P);       // 回合6·无新灾(startTurn=5≠6)→修缮
  Math.random = orig;
  ok(div.buildings[0].status === 'completed', 'tick·次回合修缮复完(status=completed)');
  ok(div.fortLevel === 3, 'tick·修缮·城防复满(2→3)·实=' + div.fortLevel);
  ok(div.publicTreasury.money.stock === 5000, 'tick·修缮扣半费 15000(20000→5000)·实=' + div.publicTreasury.money.stock);
  ok(st2.repaired === 1, 'tick·stat.repaired=1');
})();

// ── 8. S7·buildingLedger 可观测账（实入账=真贡献·非 per-level 规则） ──
(function () {
  var bld = { name: '龙江矿场', status: 'completed', level: 1, costActual: 5000000, appliedDelta: { 'economyBase.mineralProduction': 400000, 'fortLevel': 1, '_minxin': 1 } };
  var led = BW.buildingLedger(bld, null);
  ok(Array.isArray(led.applied) && led.applied.length >= 3, 'ledger·实入账多条');
  ok(led.applied.some(function (x) { return x.indexOf('矿课') >= 0 && x.indexOf('40万') >= 0; }), 'ledger·矿课 +40万(实入账·万化·非 per-level 规则)');
  ok(led.applied.some(function (x) { return x.indexOf('城防档') >= 0 && x.indexOf('+1') >= 0; }), 'ledger·城防档 +1');
  ok(led.applied.some(function (x) { return x.indexOf('民心') >= 0; }), 'ledger·民心账');
  ok(led.flowPct > 0, 'ledger·工成之利岁入 %/回合 > 0(大役)·实=' + led.flowPct);
  ok(led.upkeep > 0, 'ledger·维护费 > 0');
  ok(led.damaged === false, 'ledger·完工·非半损');
  var bld2 = { name: '城', status: 'damaged', costActual: 50000, appliedDelta: { 'fortLevel': 1 }, _damageReverted: { 'fortLevel': 1 } };
  ok(BW.buildingLedger(bld2, null).damaged === true, 'ledger·半损态 damaged=true');
})();

console.log('\n[smoke-building-lifecycle] ' + pass + '/' + (pass + fail) + ' 通过' + (fail ? ('·' + fail + ' 失败') : ''));
process.exit(fail ? 1 : 0);
