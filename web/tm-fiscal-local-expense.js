// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-fiscal-local-expense.js — 地方存留开支（2026-11-12 同志「按推荐来」）
// 第一项：宗禄出存留。明代王府禄米由王府所在布政司的存留支给，不入太仓岁出（《明史·食货志六》林润疏：
//   山西存留百五十二万石而宗禄三百十二万，河南存留八十四万三千石而宗禄百九十二万）。
//   剧本在 neicangRules.royalClanPressure 写明 paidFrom:'存留' 并给 byRegion（各布政司所占宗禄的份额）时：
//   每回合把宗禄岁额（annualStipendPaid，万石）按回合天数折算、按份额分到各布政司，从该司下各府地方库（publicTreasury）扣——
//   本色从库粮出，折色从库银出（本折比例、石折银同太仓宗禄：royalGrainRatio、salaryStoneToSilver；叙事难度减半亦同）；
//   库粮不够的那部分本色照石折银改从库银出（游戏里存留多收银、库粮常是零）；各府按库存多少分摊，
//   银粮都扣不足的折成石记作该布政司欠禄（G._royalRetained.byRegion[id].arrearsStone 累计）。
//   没写 byRegion 的剧本、存档里自带旧 neicangRules 的旧档：照旧不扣。
// 由 FixedExpense.collect（tm-fiscal-engine.js fixedCollect）在本回合固定支出结完时经 bucket TM.__fiscalParts 调用；
//   同一回合只扣一次（G._royalRetained.turn）——固定支出整笔回滚重试时，地方库不会被扣两遍。
// ============================================================
(function(global) {
  'use strict';

  function num(v, d) { var n = Number(v); return isFinite(n) ? n : (d || 0); }
  function round(v) { return Math.round(v * 10000) / 10000; }
  function kids(n) { return (n && (n.children || n.divisions)) || []; }
  function leavesOf(n) { var k = kids(n); return k.length ? k.reduce(function(out, c) { return out.concat(leavesOf(c)); }, []) : [n]; }
  function findRegion(G, ref) {
    var found = null;
    (function visit(list) {
      (list || []).forEach(function(n) {
        if (found || !n) return;
        if (n.id === ref) { found = n; return; }
        visit(kids(n));
      });
    })((((G && G.adminHierarchy) || {}).player || {}).divisions);
    return found;
  }
  function box(div, kind) {
    var pt = div && div.publicTreasury;
    return pt && pt[kind] && typeof pt[kind] === 'object' ? pt[kind] : null;
  }

  // 从一组府的地方库按库存多少扣 amount（kind：money 或 grain），返回实扣；地方库账（publicTreasury）与区划财政账（fiscal.ledgers）同扣，与存留入账同路
  function drawFromLeaves(leaves, kind, amount) {
    if (!(amount > 0)) return 0;
    var rows = leaves.map(function(d) { var b = box(d, kind); return { d: d, b: b, stock: b ? Math.max(0, num(b.stock, 0)) : 0 }; })
      .filter(function(r) { return r.stock > 0; });
    var total = rows.reduce(function(s, r) { return s + r.stock; }, 0);
    var pay = Math.min(amount, total);
    if (!(pay > 0)) return 0;
    rows.forEach(function(r) {
      var take = pay * r.stock / total;
      r.b.stock = round(r.stock - take);
      if (typeof r.b.available === 'number') r.b.available = round(Math.max(0, r.b.available - take));
      var led = r.d.fiscal && r.d.fiscal.ledgers && r.d.fiscal.ledgers[kind];
      if (led) {
        led.stock = round(Math.max(0, num(led.stock, 0) - take));
        led.thisTurnOut = round(num(led.thisTurnOut, 0) + take);
      }
    });
    return pay;
  }

  // royal：calcRoyalStipend 的结果（paidFrom:'存留' 时带 byRegion、annualStone、grainRatio、stoneToSilver、mult）
  function payRoyalFromRetained(G, royal, turnDays) {
    if (!G || !royal || royal.paidFrom !== '存留' || !Array.isArray(royal.byRegion) || !royal.byRegion.length) return null;
    var turn = G.turn || 0;
    var ledger = G._royalRetained && typeof G._royalRetained === 'object' ? G._royalRetained : (G._royalRetained = { byRegion: {} });
    if (!ledger.byRegion || typeof ledger.byRegion !== 'object') ledger.byRegion = {};
    if (ledger.turn === turn) return ledger.last || null;   // 本回合已扣
    var stone = num(royal.annualStone, 0) * Math.max(0, num(turnDays, 30)) / 365 * num(royal.mult, 1);
    var grainRatio = Math.max(0, Math.min(1, num(royal.grainRatio, 0.5)));
    var stoneToSilver = Math.max(0, num(royal.stoneToSilver, 0.6));
    // 单位：石、两；欠禄一律折成石
    var sum = { dueStone: 0, paidGrain: 0, paidMoney: 0, paidStone: 0, shortStone: 0, missing: [] };
    royal.byRegion.forEach(function(row) {
      var share = Math.max(0, num(row && row.share, 0));
      if (!share) return;
      var region = findRegion(G, row.regionId);
      if (!region) { sum.missing.push(row.regionId); return; }
      var leaves = leavesOf(region);
      var regionStone = stone * share;
      var paidGrain = drawFromLeaves(leaves, 'grain', regionStone * grainRatio);
      // 折色那份，加上库粮不够的本色照石折银，都从库银出
      var moneyDue = stoneToSilver > 0 ? (regionStone - paidGrain) * stoneToSilver : 0;
      var paidMoney = drawFromLeaves(leaves, 'money', moneyDue);
      var paidStone = paidGrain + (stoneToSilver > 0 ? paidMoney / stoneToSilver : 0);
      var rec = ledger.byRegion[row.regionId] || (ledger.byRegion[row.regionId] = { name: row.name || region.name || row.regionId, arrearsStone: 0 });
      rec.dueStone = round(regionStone);
      rec.paidGrain = round(paidGrain); rec.paidMoney = round(paidMoney); rec.paidStone = round(paidStone);
      rec.arrearsStone = round(num(rec.arrearsStone, 0) + Math.max(0, regionStone - paidStone));
      sum.dueStone += regionStone; sum.paidGrain += paidGrain; sum.paidMoney += paidMoney; sum.paidStone += paidStone;
      sum.shortStone += Math.max(0, regionStone - paidStone);
    });
    ['dueStone', 'paidGrain', 'paidMoney', 'paidStone', 'shortStone'].forEach(function(k) { sum[k] = round(sum[k]); });
    ledger.turn = turn;
    ledger.last = sum;
    return sum;
  }

  var parts = (global.TM = global.TM || {}).__fiscalParts = global.TM.__fiscalParts || {};
  parts.payRoyalFromRetained = payRoyalFromRetained;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
