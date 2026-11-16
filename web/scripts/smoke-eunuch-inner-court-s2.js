#!/usr/bin/env node
'use strict';
/* smoke-eunuch-inner-court-s2 — 宦官专权 S2 内廷特有机制（2026-07-06·方向五机制线）防腐线。
 * §a 内帑寄生(vm 切片实跑 applyInnerCourtParasitism·tm-neitang-engine)
 * §b 政柄耦合(vm 切片实跑 _tickPowerMinister·tm-authority-complete·纯读 partyState.standing)
 * §c 劫主废立+籍没追赃(vm 切片实跑 _powerMinisterEndgame)
 * §d 终局屏具名消费(vm 切片实跑 _consumeDynastyEndSignal·tm-endturn-helpers)
 * §e 接线契约 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function slice(src, startMark, endMark) {
  var s = src.indexOf(startMark), e = src.indexOf(endMark);
  if (s < 0 || e <= s) throw new Error('slice 边界丢失: ' + startMark + ' → ' + endMark);
  return src.slice(s, e);
}
console.log('smoke-eunuch-inner-court-s2');

/* ── §a 内帑寄生(行为) ────────────────────────────────────────── */
console.log('— §a · 内帑寄生 —');
(function () {
  var src = read('tm-neitang-engine.js');
  var code = slice(src, 'function _ensureLedger', 'function _applyRecurringFiscalEntries')
           + slice(src, 'function applyInnerCourtParasitism', '// ═════════════════════════════════════════════════════════════\n  // 接入 tick');
  function mk(pm, bal) {
    var ebs = [];
    var ctx = { GM: { huangquan: { powerMinister: pm }, neitang: { balance: bal, money: bal } },
      addEB: function (cat, txt) { ebs.push(txt); }, Math: Math, Number: Number, console: console };
    ctx.window = ctx; ctx.global = ctx;
    vm.createContext(ctx);
    vm.runInContext(code, ctx, { filename: 'parasitism-slice.js' });
    ctx._ebs = ebs;
    return ctx;
  }
  var pm1 = { name: '某珰', innerCourt: true, controlLevel: 0.8 };
  var c1 = mk(pm1, 100000);
  c1.applyInnerCourtParasitism(1);
  ok(c1.GM.neitang.balance === 96600 && pm1.embezzled === 3400, '内竖 cl0.8 月刮 3.4%（10万→96600·累账3400）');
  ok(c1.GM.neitang.ledgers.money.sinks['内侍截留'] === 3400, '账本 sinks[内侍截留] 留痕');
  ok(c1._ebs.length === 1 && c1._ebs[0].indexOf('截留') >= 0, '首笔 addEB 一报');
  c1.applyInnerCourtParasitism(1);
  ok(c1._ebs.length === 1, '未跨2万档不再报（防逐月刷屏）');
  ok(c1.GM.neitang.balance < 96600 && pm1.embezzled > 3400, '逐月继续刮·累账增');

  var pm2 = { name: '某珰', innerCourt: true, controlLevel: 0.8, embezzled: 19000 };
  var c2 = mk(pm2, 100000);
  c2.applyInnerCourtParasitism(1);
  ok(c2._ebs.length === 1 && pm2.embezzled === 22400, '跨2万两档再报一次');

  var pm3 = { name: '外相', innerCourt: false, controlLevel: 0.9 };
  var c3 = mk(pm3, 100000);
  c3.applyInnerCourtParasitism(1);
  ok(c3.GM.neitang.balance === 100000 && !pm3.embezzled, '外朝权臣无内库之手·不寄生');

  var pm4 = { name: '某珰', innerCourt: true, controlLevel: 0.3 };
  var c4 = mk(pm4, 100000);
  c4.applyInnerCourtParasitism(1);
  ok(c4.GM.neitang.balance === 100000, '初窃柄(cl<0.35)未及内库不刮');

  var pm5 = { name: '某珰', innerCourt: true, controlLevel: 0.8 };
  var c5 = mk(pm5, 500);
  c5.applyInnerCourtParasitism(1);
  ok(c5.GM.neitang.balance === 500, '穷账(<1000)不刮');

  var pm6 = { name: '某珰', innerCourt: true, controlLevel: 1 };
  var c6 = mk(pm6, 100000);
  c6.applyInnerCourtParasitism(2);
  ok(pm6.embezzled === 8000, 'mr=2 双月刮双份（cl1→4%×2=8000）');
})();

/* ── §b 政柄耦合(行为) ────────────────────────────────────────── */
console.log('— §b · 政柄耦合 —');
(function () {
  var src = read('tm-authority-complete.js');
  var code = slice(src, 'function _tickPowerMinister', 'function _powerMinisterCounterEdict');
  function tickWith(standing, legFlag) {
    var pm = { name: '某珰', controlLevel: 0.5, innerCourt: true };
    var G = {
      huangquan: { index: 55, powerMinister: pm },
      chars: [{ name: '某珰', alive: true, party: '内党' }],
      partyState: standing ? { '内党': { standing: standing } } : {},
      _legitimacy: legFlag ? { flag: '缙绅离心' } : null
    };
    var ctx = { global: { GM: G, addEB: function () {} }, Math: Math, Number: Number, console: console };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(code, ctx, { filename: 'pmtick-slice.js' });
    ctx._tickPowerMinister({ turn: 10 }, 1);
    return pm.controlLevel;
  }
  var g = tickWith('governing'), n = tickWith(null), m = tickWith('marginal');
  ok(Math.abs(g - 0.514) < 1e-9, '秉政党撑腰 ×1.4（0.5→0.514）');
  ok(Math.abs(n - 0.510) < 1e-9, '无党/无档不加不减（0.5→0.510）');
  ok(Math.abs(m - 0.5075) < 1e-9, '边缘党孤竖难久 ×0.75（0.5→0.5075）');
  ok(Math.abs(tickWith('governing', true) - 0.521) < 1e-9, '与缙绅离心 ×1.5 叠乘（0.5→0.521）');
})();

/* ── §c 劫主废立+籍没追赃(行为) ───────────────────────────────── */
console.log('— §c · 劫主废立+籍没追赃 —');
(function () {
  var src = read('tm-authority-complete.js');
  var code = slice(src, 'function _powerMinisterEndgame', 'P0-2');
  code = code.slice(0, code.lastIndexOf('// ═'));
  function mk() {
    var log = { ebs: [], hq: null, purged: null, confiscated: null };
    var G = { huangquan: { index: 40, powerMinister: {} }, huangwei: { index: 50 }, minxin: { trueIndex: 50 } };
    var ctx = { global: {
      GM: G,
      addEB: function (cat, txt) { log.ebs.push(txt); },
      AuthorityEngines: { setHuangquan: function (v, r) { log.hq = r; }, executePurge: function (n) { log.purged = n; } },
      NeitangEngine: { Actions: { recordConfiscation: function (amt) { log.confiscated = amt; } } }
    }, Math: Math, Number: Number, console: console };
    ctx.window = ctx;
    vm.createContext(ctx);
    vm.runInContext(code, ctx, { filename: 'pmend-slice.js' });
    return { ctx: ctx, log: log, G: G };
  }
  var a = mk();
  a.ctx._powerMinisterEndgame({ name: '某珰', innerCourt: true, controlLevel: 0.95 }, 'usurpation', { turn: 20 });
  ok(a.log.ebs[0].indexOf('劫主废立') >= 0 && !a.G._gameOver && a.G._playerDeposed && a.G._playerDeposed.mode === 'puppet', '内竖劫主=傀儡态(鼎革R1d·终局信号退役·游戏未终)');
  ok(a.log.hq === '内竖劫主废立', 'setHuangquan 事由分流');
  var b = mk();
  b.ctx._powerMinisterEndgame({ name: '外相', innerCourt: false, controlLevel: 0.95 }, 'usurpation', { turn: 20 });
  ok(b.log.ebs[0].indexOf('篡位夺鼎') >= 0 && !b.G._gameOver && b.G._playerDeposed && b.G._playerDeposed.mode === 'deposed', '外朝篡位=禅代废帝态(R1d·owner「禅代不死游戏未终」)');
  var c = mk();
  c.ctx._powerMinisterEndgame({ name: '某珰', innerCourt: true, embezzled: 10000 }, 'purged', { turn: 20 });
  ok(c.log.confiscated === 6000 && c.log.purged === '某珰' && c.G.huangquan.powerMinister === null, '诛除→籍没追赃六成(10000→6000)·走 recordConfiscation');
  var d = mk();
  d.ctx._powerMinisterEndgame({ name: '外相', innerCourt: false }, 'purged', { turn: 20 });
  ok(d.log.confiscated === null && d.log.purged === '外相', '无截留账不追赃·清洗照常');
})();

/* ── §d 终局屏具名消费(行为) ──────────────────────────────────── */
console.log('— §d · 终局屏具名消费 —');
(function () {
  var src = read('tm-endturn-helpers.js');
  var code = slice(src, 'function _consumeDynastyEndSignal', 'function _recordPlaythrough');
  function consume(gameOver) {
    var ctx = { GM: { turn: 10, _gameOver: gameOver }, Math: Math, Number: Number, console: console };
    ctx.window = ctx; ctx.global = ctx;
    vm.createContext(ctx);
    vm.runInContext(code, ctx, { filename: 'consume-slice.js' });
    return ctx._consumeDynastyEndSignal();
  }
  var r1 = consume({ type: 'usurped_by_power_minister', name: '某珰', turn: 10, innerCourt: true });
  ok(r1 && r1.title.indexOf('劫主') >= 0 && r1.description.indexOf('傀儡') >= 0, '内竖信号→「内竖劫主·废立之变」具名文案');
  var r2 = consume({ type: 'usurped_by_power_minister', name: '外相', turn: 10 });
  ok(r2 && r2.title.indexOf('权臣篡位') >= 0, '外朝信号→原「权臣篡位」文案零回归');
})();

console.log('\nsmoke-eunuch-inner-court-s2 ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
