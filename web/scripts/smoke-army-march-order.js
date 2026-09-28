#!/usr/bin/env node
'use strict';
/* smoke-army-march-order — Wave2·军令移防（2026-07-07·玩家侧军令动词）防腐线。
 * 此前 createMarchOrder 唯一调用者=AI(tm-endturn-apply)·玩家零军令入口。现:
 * MarchSystem.orderMarch(校验+拒单诚实给因)+军事要务面板「移防」钮+目的地模态+设置开关。
 * §a 引擎行为(vm 切片实跑 MarchSystem)  §b 接线契约 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-army-march-order');

var src = read('tm-military.js');
var s = src.indexOf('var MarchSystem = (function() {');
var e = src.indexOf('// 注册行军推进到SettlementPipeline');
ok(s >= 0 && e > s, '切片边界在(MarchSystem IIFE)');
var code = src.slice(s, e);

function mk(opts) {
  opts = opts || {};
  var ebs = [];
  var ctx = {
    GM: {
      turn: 10,
      armies: opts.armies || [
        { id: 'a1', name: '京营', faction: '明', garrison: '顺天府', state: 'garrison', soldiers: 30000 },
        { id: 'a2', name: '正白旗', faction: '建虏', garrison: '盛京', state: 'garrison', soldiers: 20000 }
      ],
      chars: [{ name: '帝', isPlayer: true, faction: '明', alive: true }],
      mapData: opts.mapData || null
    },
    P: {
      conf: { marchSystemEnabled: opts.confOn !== false },
      battleConfig: opts.battleConfig || {},
      map: opts.map || { enabled: false }
    },
    findPath: opts.findPath || null,
    getTurnDays: function () { return 30; },
    addEB: function (cat, txt) { ebs.push(cat + '|' + txt); },
    _dbg: function () {},
    uid: (function () { var n = 0; return function () { return 'u' + (++n); }; })(),
    findCharByName: function () { return null; },
    Math: Math, Number: Number, Array: Array, Infinity: Infinity, console: console
  };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'march-slice.js' });
  ctx._ebs = ebs;
  return ctx;
}

// 原生数据可能只有势力 ID，玩家不一定在 chars 中带 isPlayer。
{
  const c = mk(); c.GM.chars = []; c.GM.startContext = { playerFactionId: 'fac-ming' };
  c.GM.facs = [{id:'fac-ming',name:'明'},{id:'fac-enemy',name:'建虏'}];
  c.GM.armies[1].factionId = 'fac-enemy';
  ok(c.MarchSystem.orderMarch('a2','保定府').ok === false, '无 isPlayer 人物时也拒绝指挥外国军队');
  ok(c.MarchSystem.orderMarch('a1','保定府').ok === true, '本国名称与原生势力 ID 可相互匹配');
  const missing = mk(); missing.GM.chars = [];
  ok(missing.MarchSystem.orderMarch('a1','保定府').ok === false, '身份缺失时不能默认获得指挥权');
}

/* ── §a 引擎行为 ─────────────────────────────────────────────── */
console.log('— §a · orderMarch 引擎行为 —');
(function () {
  // 设置开关旁路
  var c1 = mk();
  ok(c1.MarchSystem._getConfig().enabled === true, 'P.conf.marchSystemEnabled=true 即开(设置开关旁路)');
  var c2 = mk({ confOn: false });
  ok(c2.MarchSystem._getConfig().enabled === false, '显式关闭仍可退出行军机制');
  ok(c2.MarchSystem.orderMarch('京营', '保定府').ok === false, '闸关拒单');
  var c3 = mk({ confOn: false, battleConfig: { marchConfig: { enabled: true } } });
  ok(c3.MarchSystem._getConfig().enabled === false, '玩家显式关闭优先于剧本开启');
  delete c3.P.conf.marchSystemEnabled;
  ok(c3.MarchSystem._getConfig().enabled === true, '未设置时采用剧本开启');
  c3.P.battleConfig.marchConfig.enabled = false;
  ok(c3.MarchSystem._getConfig().enabled === false, '未设置时保留剧本禁用');
  delete c3.P.battleConfig.marchConfig.enabled;
  ok(c3.MarchSystem._getConfig().enabled === true, '无设置及剧本限制时默认开启');

  // 无图估算下单
  var c4 = mk();
  var r4 = c4.MarchSystem.orderMarch('京营', '保定府');
  ok(r4.ok === true && r4.order && r4.order.status === 'marching', '我军移防下单成功');
  ok(c4.GM.marchOrders.length === 1 && c4.GM.marchOrders[0].to === '保定府', '军令入 GM.marchOrders');
  ok(c4.GM.armies[0].state === 'marching' && c4.GM.armies[0].destination === '保定府', '军队转行军态');
  ok(c4._ebs.some(function (x) { return x.indexOf('行军|京营') === 0; }), '事件簿记行军');
  ok(c4.MarchSystem.orderMarch('京营', '济南府').ok === false, '已在途中拒再令');

  // 拒单诚实给因
  var c5 = mk();
  ok(c5.MarchSystem.orderMarch('不存在军', '保定府').reason === '查无此军', '查无此军');
  ok(c5.MarchSystem.orderMarch('正白旗', '保定府').reason.indexOf('非我王师') === 0, '非我军不受节制');
  ok(c5.MarchSystem.orderMarch('京营', '顺天府').reason.indexOf('已驻') > 0, '同地拒单');
  ok(c5.MarchSystem.orderMarch('京营', '  ').reason === '未指明目的地', '空目的地拒单');

  // 地图模式:寻路失败诚实拒单(勿造1回合瞬移单)
  var c6 = mk({ map: { enabled: true }, mapData: { adjacencyGraph: {} }, findPath: function () { return null; } });
  c6.GM.mapData = { adjacencyGraph: {} };
  var r6 = c6.MarchSystem.orderMarch('京营', '广州府');
  ok(r6.ok === false && r6.reason.indexOf('无路可达') === 0 && !(c6.GM.marchOrders || []).length, '地图模式无路可达→拒单不造瞬移单');

  // 地图模式:真寻路下单
  var c7 = mk({ map: { enabled: true }, findPath: function () { return { path: ['顺天府', '河间府', '济南府'], hasPostRoad: true }; } });
  c7.GM.mapData = { adjacencyGraph: {} };
  var r7 = c7.MarchSystem.orderMarch('京营', '济南府');
  ok(r7.ok === true && r7.order.routeDescription.indexOf('经') === 0 && r7.order.totalTurns === 2, '地图模式A*成路(3领地/驿道→2回合)');

  // advanceAll 到达接防
  var c8 = mk();
  c8.MarchSystem.orderMarch('京营', '保定府');
  c8.MarchSystem.advanceAll();
  ok(c8.GM.armies[0].location === '保定府' && c8.GM.armies[0].state === 'garrison', '抵达自动接防(location/state 更新)');
  ok(c8.GM.marchOrders.length === 0, '到达单清理');
})();

/* ── §b 接线契约 ─────────────────────────────────────────────── */
console.log('— §b · 接线契约 —');
(function () {
  ok(/orderMarch: orderMarch/.test(src), 'MarchSystem 导出 orderMarch');
  ok(/P\.conf\.marchSystemEnabled/.test(src), '引擎闸带设置旁路');
  var se = read('tm-shell-extras.js');
  ok(/data-march-army/.test(se) && /_tmShellMarchPrompt/.test(se), '军事要务面板移防钮+目的地模态在');
  ok(/addEventListener\('click', function\(ev\)\{[\s\S]{0,400}data-march-army[\s\S]{0,400}\}, true\)/.test(se), 'capture 段拦截(防触发整行详情 onclick)');
  ok(/MarchSystem\.orderMarch/.test(se), 'UI 走引擎校验口(不绕闸)');
  ok(/marchSystemEnabled/.test(read('tm-patches.js')), '设置面板开关在(玩法机制·深化)');
})();

console.log('\nsmoke-army-march-order ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
