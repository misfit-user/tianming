#!/usr/bin/env node
'use strict';
/* smoke-disaster-genesis — 天时·灾异推演（2026-07-07·深挖第五轮③）防腐线。
 * 病灶：GM.activeDisasters 全库唯一生产者=AI 叙事一致性补录——明末小冰河主线上游信号
 * (climatePhase/nationalLoad/region.disasterLevel)与下游灾荒机器(派生信号/粮价/流民/民变/赈灾)
 * 俱全·中间零连通。修：确定性发生器(flag disasterSimEnabled 默认关)+区域准灾上卷+平粜双轨补齐。
 * §a 发生器行为(vm 实跑60回合)  §b 平粜压价  §c 接线契约 */
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var ROOT = path.resolve(__dirname, '..');
var P0 = 0, F0 = 0;
function ok(c, m) { if (c) { P0++; console.log('  ✓ ' + m); } else { F0++; console.log('  ✗ FAIL: ' + m); } }
function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
console.log('smoke-disaster-genesis');

var src = read('tm-guoku-engine.js');
var s = src.indexOf('function _disasterCatCN(');
var e = src.indexOf('var Actions = {');
ok(s > 0 && e > s, '切片边界在(灾害生命周期+发生器)');
var code = src.slice(s, e);

function mkCtx(opts) {
  opts = opts || {};
  var ebs = [];
  var ctx = {
    GM: {
      turn: opts.turn || 1,
      activeDisasters: [],
      vars: {},
      environment: opts.env || { climatePhase: 'little_ice_age', nationalLoad: 1.3 },
      regions: opts.regions
    },
    P: { conf: opts.conf || { disasterSimEnabled: true } },
    turnsForMonths: function (m) { return m; },          // 月刻度 1:1
    calcDateFromTurn: function (t) { return { month: ((t - 1) % 12) + 1 }; },
    addEB: function (cat, txt) { ebs.push(txt); },
    Math: Math, Object: Object, Array: Array, String: String, console: console
  };
  ctx.window = ctx; ctx.global = ctx;
  vm.createContext(ctx);
  vm.runInContext(code, ctx, { filename: 'dsim-slice.js' });
  ctx._ebs = ebs;
  return ctx;
}

/* ── §a 发生器行为 ─────────────────────────────────────────────── */
console.log('— §a · 发生器行为 —');
(function () {
  // flag 默认关：零行为
  var c0 = mkCtx({ conf: {} });
  ok(c0.simulateDisasterGenesis() === null && c0.GM.activeDisasters.length === 0, 'flag 默认关：零行为(零回归)');
  c0.tickDisasters();
  ok(c0.GM.activeDisasters.length === 0 && c0.GM.vars.disasterLevel === undefined, '关闸下 tickDisasters 原样(不无谓触碰 vars)');

  // 小冰河 60 回合模拟：生成节奏/并发cap/冷却
  var c1 = mkCtx({});
  var genCount = 0, maxConcurrent = 0, genTurns = [];
  for (var t = 1; t <= 60; t++) {
    c1.GM.turn = t;
    var before = c1.GM.activeDisasters.length;
    c1.tickDisasters();
    var simNow = c1.GM.activeDisasters.filter(function (d) { return d._simGen; }).length;
    if (simNow > maxConcurrent) maxConcurrent = simNow;
    if (c1.GM.activeDisasters.length > before || (c1.GM._lastSimDisasterTurn === t)) { if (c1.GM._lastSimDisasterTurn === t) { genCount++; genTurns.push(t); } }
  }
  ok(genCount >= 4 && genCount <= 15, '小冰河60月生成 ' + genCount + ' 起(年均≈1.9·区间[4,15])');
  ok(maxConcurrent <= 2, '自然灾并发封顶2(实测峰值 ' + maxConcurrent + ')');
  var minGap = 99;
  for (var g = 1; g < genTurns.length; g++) minGap = Math.min(minGap, genTurns[g] - genTurns[g - 1]);
  ok(genTurns.length < 2 || minGap >= 3, '冷却≥3月(实测最小间隔 ' + minGap + ')');
  ok(c1.GM.vars.disasterLevel > 0 || c1.GM.activeDisasters.length === 0, '灾在册时派生信号 disasterLevel>0(下游机器点火)');
  ok(c1._ebs.some(function (x) { return /起（/.test(x) && /天时严酷/.test(x); }), '编年入册·小冰河措辞');

  // 暖期显著少发
  var c2 = mkCtx({ env: { climatePhase: 'medieval_warm', nationalLoad: 1.0 } });
  var warmCount = 0;
  for (var t2 = 1; t2 <= 60; t2++) { c2.GM.turn = t2; c2.tickDisasters(); if (c2.GM._lastSimDisasterTurn === t2) warmCount++; }
  ok(warmCount < genCount, '暖期显著少发(暖 ' + warmCount + ' < 小冰河 ' + genCount + ')');

  // 确定性：同状态同回合两次独立跑→同产出
  function firstGen(seedTurn) {
    var c = mkCtx({ turn: seedTurn });
    for (var t3 = seedTurn; t3 <= seedTurn + 30; t3++) { c.GM.turn = t3; var r = c.simulateDisasterGenesis(); if (r) return r; }
    return null;
  }
  var g1 = firstGen(1), g2 = firstGen(1);
  ok(!!g1 && !!g2 && g1.region === g2.region && g1.category === g2.category && g1.severity === g2.severity && g1.startedTurn === g2.startedTurn, '确定性：同局同回合同天时(存档重载不漂·不触全局rng)');

  // 区域准灾上卷：高 disasterLevel 区域被加权选中·选中后回落
  var hitA = 0, hitB = 0, sawRelease = false;
  for (var st = 1; st <= 80; st += 1) {
    var c3 = mkCtx({ turn: st, regions: [{ id: 'ra', name: '甲省', disasterLevel: 0.9 }, { id: 'rb', name: '乙省', disasterLevel: 0 }] });
    c3.GM.turn = st;
    var r3 = c3.simulateDisasterGenesis();
    if (r3) {
      if (r3.region === '甲省') { hitA++; if (c3.GM.regions[0].disasterLevel < 0.9) sawRelease = true; }
      else if (r3.region === '乙省') hitB++;
    }
  }
  ok(hitA + hitB > 0 && hitA > hitB, '区域准灾加权：积弊之地(0.9)中选 ' + hitA + ' > 无事之地 ' + hitB + '(双轨互认)');
  ok(sawRelease, '准灾上卷成真灾后该区灾级回落(防连环)');

  // schema 对齐补录同款
  ok(!!g1 && g1.type === g1.category && typeof g1.duration === 'number' && g1.duration >= 1 && g1._simGen === true && typeof g1.region === 'string', 'schema 对齐 AI 补录同款(下游 openGranary/tickDisasters 原样消费)');

  // 赈灾闭环回归：生成灾标记 _relieved 后寿命减半
  var c4 = mkCtx({});
  c4.GM.turn = 1; c4.GM.activeDisasters.push({ category: 'drought', region: '某省', severity: 'moderate', startedTurn: 1, duration: 5 });
  c4.GM.activeDisasters[0]._relieved = true;
  c4.GM.turn = 4; c4.P.conf.disasterSimEnabled = false; c4.tickDisasters();
  ok(c4.GM.activeDisasters.length === 0, '赈灾加速平息原路不变(dur5赈后ceil(2.5)=3·第4回合出队)');
})();

/* ── §b 平粜压价 ─────────────────────────────────────────────── */
console.log('— §b · 平粜/开仓压粮价指数 —');
(function () {
  var s2 = src.indexOf('function updatePriceIndex(');
  var e2 = src.indexOf('\n  }', s2) + 4;   // 函数闭合(2空格缩进·体内块闭合皆≥4空格)
  ok(s2 > 0 && e2 > s2, 'updatePriceIndex 切片边界在');
  var pcode = src.slice(s2, e2);
  function runPrice(releaseTurn) {
    var ctx = {
      GM: {
        turn: 10, prices: { grain: 1.0, cloth: 1.0, general: 1.0 },
        guoku: { ledgers: { grain: { stock: 1e7 } }, expenses: {} },
        hukou: { registeredTotal: 1e7 }, currency: null, activeDisasters: [],
        _grainReleaseTurn: releaseTurn
      },
      turnsForMonths: function (m) { return m; },
      finiteNumberOr: function (value, fallback) {
        return (typeof value === 'number' && Number.isFinite(value)) ? value : fallback;
      },
      _mxApply: function () {}, addEB: function () {},
      Math: Math, console: console
    };
    ctx.window = ctx; ctx.global = ctx;
    vm.createContext(ctx);
    vm.runInContext(pcode, ctx, { filename: 'price-slice.js' });
    ctx.updatePriceIndex(1);
    return ctx.GM.prices.grain;
  }
  var pNo = runPrice(undefined), pYes = runPrice(10), pOld = runPrice(2);
  ok(pYes < pNo, '近期放粮(平粜/开仓)→粮价指数被压(' + pYes.toFixed(3) + ' < ' + pNo.toFixed(3) + ')');
  ok(Math.abs(pOld - pNo) < 1e-9, '放粮已过窗(8回合前·窗2月)→不再压价(信号有时效)');
})();

/* ── §c 接线契约 ─────────────────────────────────────────────── */
console.log('— §c · 接线契约 —');
(function () {
  ok(/try \{ simulateDisasterGenesis\(\); \} catch/.test(src), 'tickDisasters 开头挂发生器(管线零改动·新灾当回合入派生信号)');
  ok(/simulateDisasterGenesis: simulateDisasterGenesis,/.test(src), '发生器导出(可诊断)');
  ok(/disasterSimEnabled !== true\) return null/.test(src), 'flag 闸在发生器内(默认关)');
  ok(/GM\._grainReleaseTurn = GM\.turn \|\| 0/.test(src), 'openGranary 落放粮信号');
  var cl = read('tm-central-local-engine.js');
  ok(/global\.GM\._grainReleaseTurn = global\.GM\.turn \|\| 0/.test(cl), '央地平粜同写放粮信号');
  ok(/disasterSimEnabled/.test(read('tm-patches.js')), '设置开关在(玩法机制·深化)');
})();

console.log('\nsmoke-disaster-genesis ' + (F0 === 0 ? 'PASS' : 'FAIL') + ' ' + P0 + '/' + (P0 + F0));
process.exit(F0 === 0 ? 0 : 1);
