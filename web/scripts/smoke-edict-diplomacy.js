#!/usr/bin/env node
'use strict';
/* smoke-edict-diplomacy — 诏令·外交动词（2026-07-07·深挖第五轮⑤）防腐线。
 * 病灶：外交后端全齐(declareWar/endWar/setFactionRelation/applyFactionInteraction·AI 在用)·
 * 玩家侧零发起端(只能等敌使上门问对)·诏令解析器六大类型全内政零外交意图。
 * 修：extractEdictDiplomacy(议和/宣战/互市/岁币·否定门·点名势力)+applyEdictDiplomacy 调既有后端·
 * flag edictDiplomacyEnabled 默认关+设置开关。
 * §a 意图解析  §b 落效行为  §c 接线契约 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-edict-diplomacy');

var src = read('tm-endturn-edict.js');
var s = src.indexOf('function _edPlayerFacName()');
ok(s > 0, '切片边界在(外交动词函数组·文件尾)');
var code = src.slice(s);

function mk(opts) {
  opts = opts || {};
  var calls = { endWar: [], declareWar: [], setRel: [], interact: [], auth: [], ebs: [] };
  var ctx = {
    GM: {
      turn: 15,
      facs: [{ name: '大明' }, { name: '后金', strength: 80 }, { name: '蒙古', strength: 40 }],
      activeWars: opts.wars || []
    },
    P: { conf: opts.conf || { edictDiplomacyEnabled: true }, playerInfo: { factionName: '大明' } },
    CasusBelliSystem: {
      endWar: function (id) { calls.endWar.push(id); },
      declareWar: function (att, def, cb) { calls.declareWar.push(att + '|' + def + '|' + cb); return opts.warResult || { success: true }; }
    },
    setFactionRelation: function (f, t, patch) { calls.setRel.push(f + '|' + t + '|' + (patch.delta || 0) + '|' + (patch.desc || '')); },
    applyFactionInteraction: function (f, t, type) { calls.interact.push(f + '|' + t + '|' + type); return true; },
    _adjAuthority: function (name, delta, reason) { calls.auth.push(name + '|' + delta + '|' + reason); },
    addEB: function (cat, txt) { calls.ebs.push(cat + '|' + txt); },
    console: { warn: function () {} }, Math: Math, String: String, Array: Array
  };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'edip-slice.js' });
  ctx._calls = calls;
  return ctx;
}

/* ── §a 意图解析 ─────────────────────────────────────────────── */
console.log('— §a · 意图解析 —');
(function () {
  var c0 = mk({ conf: {} });
  ok(c0.extractEdictDiplomacy('遣使赴后金议和').length === 0, 'flag 默认关：零解析(零回归)');

  var c = mk();
  var r1 = c.extractEdictDiplomacy('着礼部遣使赴后金议和，以纾边患。');
  ok(r1.length === 1 && r1[0].type === 'peace' && r1[0].target === '后金', '议和意图+点名后金');
  ok(c.extractEdictDiplomacy('后金狼子野心，不许议和，严饬边备。').length === 0, '否定门：「不许议和」不误执行');
  var r2 = c.extractEdictDiplomacy('朕意已决，兴师伐后金，以张挞伐。');
  ok(r2.length === 1 && r2[0].type === 'declare_war' && r2[0].target === '后金', '征讨意图+点名');
  var r3 = c.extractEdictDiplomacy('准与蒙古开互市于边镇，通有无。');
  ok(r3.length === 1 && r3[0].type === 'open_market' && r3[0].target === '蒙古', '互市意图');
  ok(c.extractEdictDiplomacy('即日罢互市，蒙古不臣，绝其贸易。').length === 0, '否定门：「罢互市」不误执行');
  var r4 = c.extractEdictDiplomacy('岁币三十万予后金，暂纾兵锋。');
  ok(r4.length === 1 && r4[0].type === 'pay_tribute', '岁币意图');
  ok(c.extractEdictDiplomacy('速速议和，以安社稷。').length === 0, '未点名势力→不瞎猜(交 AI 推演)');
  ok(c.extractEdictDiplomacy('即刻兴师伐后金；如其请降，亦可议和。').length === 0, '战和同现(有条件文意)→双撤交 AI');
  ok(c.extractEdictDiplomacy('后金若不受抚，则大军征讨之。').length === 0, '「不受抚则征讨」——否定词贴近动词被保守拦下(宁漏勿错·交 AI)');
})();

/* ── §b 落效行为 ─────────────────────────────────────────────── */
console.log('— §b · 落效行为 —');
(function () {
  // 议和·有战：真止战+皇威-4+关系回暖
  var c1 = mk({ wars: [{ id: 'w1', attacker: '后金', defender: '大明' }] });
  c1.applyEdictDiplomacy([{ type: 'peace', target: '后金', raw: '议和' }]);
  ok(c1._calls.endWar.length === 1 && c1._calls.endWar[0] === 'w1', '议和有战：endWar 真止战(上停战期)');
  ok(c1._calls.auth.some(function (x) { return /huangwei\|-4/.test(x); }), '主动请和·皇威-4(屈己安边)');
  ok(c1._calls.setRel.some(function (x) { return /大明\|后金\|12/.test(x); }), '关系回暖 delta12');

  // 议和·无战：仅通好
  var c2 = mk();
  c2.applyEdictDiplomacy([{ type: 'peace', target: '蒙古', raw: '通好' }]);
  ok(c2._calls.endWar.length === 0 && c2._calls.setRel.some(function (x) { return /大明\|蒙古\|8/.test(x); }), '无战事：遣使通好 delta8(不硬造停战)');

  // 宣战
  var c3 = mk();
  c3.applyEdictDiplomacy([{ type: 'declare_war', target: '后金', raw: '征讨' }]);
  ok(c3._calls.declareWar.length === 1 && c3._calls.declareWar[0] === '大明|后金|holy', '宣战走 CasusBelli(天子讨不臣·CB 表剧本可覆盖)');
  ok(c3._calls.ebs.some(function (x) { return /奉诏兴师/.test(x); }), '兴师入编年');

  // 宣战被后端拒(停战期)：诚实给因
  var c4 = mk({ warResult: { success: false, message: '停战期未满' } });
  c4.applyEdictDiplomacy([{ type: 'declare_war', target: '后金', raw: '征讨' }]);
  ok(c4._calls.ebs.some(function (x) { return /未克行/.test(x) && /停战期未满/.test(x); }), '停战期宣战被拒：编年诚实给因');

  // 岁币：真账+皇威-6
  var c5 = mk();
  c5.applyEdictDiplomacy([{ type: 'pay_tribute', target: '后金', raw: '岁币' }]);
  ok(c5._calls.interact.some(function (x) { return x === '大明|后金|pay_tribute'; }), '岁币走 applyFactionInteraction(玩家侧真扣国库·strength 派生额)');
  ok(c5._calls.auth.some(function (x) { return /huangwei\|-6/.test(x); }), '纳币·皇威-6(问对准索贡同款)');

  // 互市
  var c6 = mk();
  c6.applyEdictDiplomacy([{ type: 'open_market', target: '蒙古', raw: '互市' }]);
  ok(c6._calls.interact.some(function (x) { return x === '大明|蒙古|open_market'; }), '互市走 applyFactionInteraction(红利真入账)');

  // 后端缺位不抛
  var c7 = mk();
  delete c7.CasusBelliSystem;
  var threw = false;
  try { c7.applyEdictDiplomacy([{ type: 'declare_war', target: '后金', raw: '征讨' }]); } catch (e) { threw = true; }
  ok(!threw, '后端缺位(typeof 守卫)不抛');
})();

console.log('\nsmoke-edict-diplomacy ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
