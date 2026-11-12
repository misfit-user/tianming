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
// 第二项：本路军饷出存留（11-13，见 payArmiesFromRetained）——军的地方那一份从剧本写明的承付之路扣，不够按军记欠。
// 由 FixedExpense.collect（tm-fiscal-engine.js fixedCollect）在本回合固定支出结完时经 bucket TM.__fiscalParts 调用；
//   两项各自同一回合只扣一次（G._royalRetained.turn、G._armyRetained.turn）——固定支出整笔回滚重试时，地方库不会被扣两遍。
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

  // 第二项：本路军饷出存留（11-13 同志「按你推荐来」）。剧本给军写了 funding.localShare（本路自筹、地方支给）的，
  //   地方那一份原先不进太仓、也没人扣——地方库只进不出。现在每回合从承付诸路的地方库扣：
  //   承付之路由剧本写明——funding.regionIds（几路合用，如陕西六路、川峡四路），或 funding.regionId（一路）。
  //   没写的不扣：旧档里的军是开局时从剧本抄进存档的，没有这两项，照旧不扣（同「旧档不拾新口径」）；
  //   也不按驻地去猜——天启诸军的驻地是地图地块、不是区划，绍宋陕西诸军按驻地会全压在泾原一路。
  //   钱、粮、布各从地方库的钱、粮、布出，不互折（各剧本钱的单位与粮价不一）；同一组路下的各军按应支同比例分摊。
  //   不够的按军记欠（G._armyRetained.byArmy[军]：arrears 累计钱粮布，months 累计折成的月数——按钱、粮两项里欠得多的那项算；
  //   布每兵每月不过几分，不计月数，只记账）。这是该路欠的，不进太仓欠账，补饷诏书也不从太仓补。
  //   本路欠账暂不写进军的欠饷月数（army.payArrearsMonths）、不扣军心：老「三系统」回合更新（tm-three-systems-ext.js
  //   _updateMilitaryState）对没有太仓欠账的军，只要势力账上钱不为负就每回合把欠饷月数白减一月，写进去也会在算军心前被抹掉；
  //   且京畿、陕西本路存留只够付其军饷一二成，接上军心则数月溃散——两事待同志定。
  //   写了承付之路却在区划里找不到的记 missing，不扣也不记欠。同一回合只扣一次（G._armyRetained.turn）。
  function payerRegions(army) {
    var f = (army && army.funding) || {};
    if (Array.isArray(f.regionIds) && f.regionIds.length) return f.regionIds.map(String);
    if (f.regionId) return [String(f.regionId)];
    return [];
  }
  function payArmiesFromRetained(G, items, turnDays) {
    if (!G || !Array.isArray(items)) return null;
    // 只认写明承付之路的；一个都没有（旧档、没写的剧本）就不建账，照旧不扣
    items = items.filter(function(it) { return it && payerRegions(it.army).length; });
    if (!items.length) return null;
    var turn = G.turn || 0;
    var ledger = G._armyRetained && typeof G._armyRetained === 'object' ? G._armyRetained : (G._armyRetained = { byArmy: {} });
    if (!ledger.byArmy || typeof ledger.byArmy !== 'object') ledger.byArmy = {};
    if (ledger.turn === turn) return ledger.last || null;   // 本回合已扣
    var months = Math.max(0, num(turnDays, 30)) / 30, RES = ['money', 'grain', 'cloth'];
    var sum = { due: { money: 0, grain: 0, cloth: 0 }, paid: { money: 0, grain: 0, cloth: 0 }, short: { money: 0, grain: 0, cloth: 0 }, armies: 0, shortArmies: [], missing: [] };
    var pools = {}, order = [];
    items.forEach(function(it) {
      var ids = payerRegions(it.army), leaves = [];
      ids.forEach(function(id) { var r = findRegion(G, id); if (r) leaves = leaves.concat(leavesOf(r)); });
      if (!leaves.length) { sum.missing.push(it.name); return; }
      var key = ids.slice().sort().join('|');
      if (!pools[key]) { pools[key] = { ids: ids, leaves: leaves, items: [] }; order.push(key); }
      pools[key].items.push(it);
    });
    order.forEach(function(key) {
      var pool = pools[key], ratio = {};
      RES.forEach(function(k) {
        var due = pool.items.reduce(function(s, it) { return s + Math.max(0, num(it[k], 0)); }, 0);
        var paid = drawFromLeaves(pool.leaves, k, due);
        ratio[k] = due > 0 ? paid / due : 1;
        sum.due[k] += due; sum.paid[k] += paid; sum.short[k] += Math.max(0, due - paid);
      });
      pool.items.forEach(function(it) {
        var id = String(it.armyId || it.name);
        var rec = ledger.byArmy[id] || (ledger.byArmy[id] = { name: it.name, arrears: { money: 0, grain: 0, cloth: 0 }, months: 0 });
        rec.name = it.name; rec.regionIds = pool.ids.slice();
        var owed = 0;
        RES.forEach(function(k) {
          var due = Math.max(0, num(it[k], 0)), short = due * (1 - ratio[k]);
          rec.arrears[k] = round(num(rec.arrears[k], 0) + short);
          if (k !== 'cloth' && due > 0) owed = Math.max(owed, 1 - ratio[k]);
        });
        sum.armies++;
        if (owed > 1e-9) {
          rec.months = round(num(rec.months, 0) + owed * months);
          sum.shortArmies.push(it.name);
        }
      });
    });
    RES.forEach(function(k) { sum.due[k] = round(sum.due[k]); sum.paid[k] = round(sum.paid[k]); sum.short[k] = round(sum.short[k]); });
    ledger.turn = turn;
    ledger.last = sum;
    return sum;
  }

  var parts = (global.TM = global.TM || {}).__fiscalParts = global.TM.__fiscalParts || {};
  parts.payRoyalFromRetained = payRoyalFromRetained;
  parts.payArmiesFromRetained = payArmiesFromRetained;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
