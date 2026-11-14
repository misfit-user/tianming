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
// 第二项：本路军饷出存留（11-13，见 payArmiesFromRetained）——军的地方那一份从剧本写明的承付之路扣，不够按军记欠；
//   11-14 起本路欠账接军心，本路余钱先还旧欠，陕西诸军可截川纲。
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
  //   剧本给军写了折色价（funding.grainCommute：每石折钱若干，剧本钱的单位）的除外：库粮不够的那部分月粮照价改支钱，
  //   并进当月应支钱一起从库银出；库银也不够，饷钱与折色同比例短发，短发的折色仍按粮记欠。本路余钱还旧欠时，粮欠库粮还不上的
  //   也照价拿余钱折还。明代卫所月粮「福建、兩廣、四川則米七鈔三…已而定制，衛軍有家屬者，月米六斗，無者四斗五升，餘皆折鈔」，
  //   后改折银（太仓岁入有「改折月糧銀」；均《明史》卷八二·食货六）；天启本路诸军地方库多银少粮，不折则月月欠粮。
  //   不够的按军记欠（G._armyRetained.byArmy[军]：arrears 累计钱粮布，months 折成的月数——按钱、粮两项里欠得多的那项算，
  //   按全饷折：本路只出一部分的军，本路那份欠一个月只算欠了份额那么多；布每兵每月不过几分，不计月数，只记账）。
  //   这是该路欠的，不进太仓欠账。
  // 接军心（11-14 同志「按你推荐来」）：欠饷月数＝太仓账＋本路账，由 TM.MilitaryArrears（tm-military-arrears.js）对账写回军上，
  //   军务（tm-military.js applyPayArrearsPressure）按新欠的月数扣军心、按本路还掉的月数回军心；老「三系统」每回合白减一月
  //   对写明承付之路的军不再管。为此本路账另记两个只增不减的累计：accruedMonths（欠下的）、repaidMonths（本路余钱还掉的）。
  //   本路余钱先还旧欠：本回合各组路的当月饷都付完（先付当月，免得一组还旧欠挤掉另一组的当月），库里还有钱粮布的，
  //   按各军所欠同比例还；月数按钱、粮两项里还剩得多的那项同比例减。
  //   截川纲（建炎元年六月诏「陝西六路仍聽支諸司錢，及截川綱金銀」，《建炎以來繫年要錄》卷六）：军的 funding.interceptRegionIds
  //   写了几路的，本路钱付不足时，从这几路本回合起运到太仓的钱里截留补上——最多截到这几路本回合的起运钱数
  //   （各府 fiscal._thisTurnRemitMoney，本回合征过的才算），且不让太仓透支；只截钱（金银），记在太仓钱账「截川纲」名下。
  //   写了承付之路却在区划里找不到的记 missing，不扣也不记欠。同一回合只扣一次（G._armyRetained.turn）。
  function payerRegions(army) {
    var f = (army && army.funding) || {};
    if (Array.isArray(f.regionIds) && f.regionIds.length) return f.regionIds.map(String);
    if (f.regionId) return [String(f.regionId)];
    return [];
  }
  function interceptRegions(army) {
    var f = (army && army.funding) || {};
    return Array.isArray(f.interceptRegionIds) ? f.interceptRegionIds.map(String) : [];
  }
  // 折色价：每石折钱若干（剧本钱的单位）；没写或不是正数的不折
  function commuteRate(army) {
    var r = Number(((army && army.funding) || {}).grainCommute);
    return isFinite(r) && r > 0 ? r : 0;
  }
  // 几路本回合起运到太仓的钱（本回合征过的府才算；征税没碰的府留着上回合的数，不算）
  function remittedThisTurn(G, ids) {
    var turn = G.turn || 0, total = 0;
    ids.forEach(function(id) {
      var r = findRegion(G, id);
      if (!r) return;
      leavesOf(r).forEach(function(d) {
        var f = d && d.fiscal;
        if (f && f._thisTurnRemitTurn === turn) total += Math.max(0, num(f._thisTurnRemitMoney, 0));
      });
    });
    return total;
  }
  // 太仓钱眼下能动的数（账与标量取小的，不让截川纲把太仓扣成欠）
  function guokuMoneyAvailable(G) {
    var acc = G.guoku || {}, led = acc.ledgers && acc.ledgers.money;
    var scalar = acc.money != null ? num(acc.money, 0) : num(acc.balance, 0);
    var stock = led && led.stock != null ? num(led.stock, 0) : scalar;
    return Math.max(0, Math.min(stock, scalar));
  }
  function ensureRec(ledger, it, ids) {
    var id = String(it.armyId || it.name);
    var rec = ledger.byArmy[id] || (ledger.byArmy[id] = { name: it.name, arrears: { money: 0, grain: 0, cloth: 0 }, months: 0 });
    if (!rec.arrears || typeof rec.arrears !== 'object') rec.arrears = { money: 0, grain: 0, cloth: 0 };
    // 11-13 的旧账没有累计欠下的月数：那时还没有还旧欠，欠下的就是现欠
    if (rec.accruedMonths == null) rec.accruedMonths = num(rec.months, 0);
    if (rec.repaidMonths == null) rec.repaidMonths = 0;
    rec.name = it.name; rec.regionIds = ids.slice();
    return rec;
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
    // paid.money 只算饷钱；折色另记 commuted（当月）、repaidCommuted（还旧欠）：grain 是折掉的石数，money 是为此出的钱
    var sum = { due: { money: 0, grain: 0, cloth: 0 }, paid: { money: 0, grain: 0, cloth: 0 }, short: { money: 0, grain: 0, cloth: 0 },
      commuted: { grain: 0, money: 0 }, repaidCommuted: { grain: 0, money: 0 },
      intercepted: 0, repaid: { money: 0, grain: 0, cloth: 0 }, repaidMonths: 0, armies: 0, shortArmies: [], repaidArmies: [], missing: [] };
    var pools = {}, order = [], budgets = {};
    items.forEach(function(it) {
      var ids = payerRegions(it.army), leaves = [];
      ids.forEach(function(id) { var r = findRegion(G, id); if (r) leaves = leaves.concat(leavesOf(r)); });
      if (!leaves.length) { sum.missing.push(it.name); return; }
      var cut = interceptRegions(it.army);
      var key = ids.slice().sort().join('|') + '#' + cut.slice().sort().join('|');
      if (!pools[key]) { pools[key] = { ids: ids, leaves: leaves, cut: cut, items: [] }; order.push(key); }
      pools[key].items.push(it);
    });
    // 先付当月：粮先从库粮出；写了折色价的军，库粮不够的那部分照价折钱，并进饷钱一起从库银出（截川纲也一并截补）
    order.forEach(function(key) {
      var pool = pools[key], ratio = {};
      var rates = pool.items.map(function(it) { return commuteRate(it.army); });
      var dueOf = function(k) { return pool.items.reduce(function(s, it) { return s + Math.max(0, num(it[k], 0)); }, 0); };
      var dueG = dueOf('grain'), paidG = drawFromLeaves(pool.leaves, 'grain', dueG);
      ratio.grain = dueG > 0 ? Math.min(1, paidG / dueG) : 1;
      var dueC = pool.items.reduce(function(s, it, i) { return s + Math.max(0, num(it.grain, 0)) * (1 - ratio.grain) * rates[i]; }, 0);
      var dueM = dueOf('money'), needM = dueM + dueC;
      var paidM = drawFromLeaves(pool.leaves, 'money', needM);
      if (needM - paidM > 1e-9 && pool.cut.length && global.FiscalEngine && typeof global.FiscalEngine.spendFromGuoku === 'function') {
        var bk = pool.cut.slice().sort().join('|');
        if (budgets[bk] == null) budgets[bk] = remittedThisTurn(G, pool.cut);
        var take = Math.min(needM - paidM, budgets[bk], guokuMoneyAvailable(G));
        if (take > 1e-9) {
          var spent = global.FiscalEngine.spendFromGuoku({ money: take }, '截川纲', G);
          var got = spent && spent.deducted && spent.deducted.money ? num(spent.deducted.money.deducted, 0) : 0;
          budgets[bk] -= got; paidM += got; sum.intercepted += got;
        }
      }
      // 库银不够时饷钱与折色同比例短发
      ratio.money = needM > 0 ? Math.min(1, paidM / needM) : 1;
      var dueCl = dueOf('cloth'), paidCl = drawFromLeaves(pool.leaves, 'cloth', dueCl);
      ratio.cloth = dueCl > 0 ? Math.min(1, paidCl / dueCl) : 1;
      sum.due.money += dueM; sum.paid.money += dueM * ratio.money; sum.short.money += dueM * (1 - ratio.money);
      sum.due.grain += dueG; sum.paid.grain += paidG;
      sum.due.cloth += dueCl; sum.paid.cloth += paidCl; sum.short.cloth += Math.max(0, dueCl - paidCl);
      sum.commuted.money += dueC * ratio.money;
      pool.items.forEach(function(it, i) {
        var rec = ensureRec(ledger, it, pool.ids);
        var share = Math.max(0, Math.min(1, num(it.localShare, 1)));
        var gDue = Math.max(0, num(it.grain, 0)), gCut = rates[i] > 0 ? gDue * (1 - ratio.grain) * ratio.money : 0;
        var paidRatio = { money: ratio.money, grain: gDue > 0 ? Math.min(1, ratio.grain + gCut / gDue) : 1, cloth: ratio.cloth };
        sum.commuted.grain += gCut; sum.short.grain += gDue * (1 - paidRatio.grain);
        var owed = 0;
        RES.forEach(function(k) {
          var due = Math.max(0, num(it[k], 0)), short = due * (1 - paidRatio[k]);
          rec.arrears[k] = round(num(rec.arrears[k], 0) + short);
          if (k !== 'cloth' && due > 0) owed = Math.max(owed, 1 - paidRatio[k]);
        });
        sum.armies++;
        if (owed > 1e-9) {
          var add = owed * share * months;
          rec.months = round(num(rec.months, 0) + add);
          rec.accruedMonths = round(num(rec.accruedMonths, 0) + add);
          sum.shortArmies.push(it.name);
        }
      });
    });
    // 再拿余钱还旧欠：钱粮布各还各的；写了折色价的军，粮欠库粮还不上的，再照价拿余下的库银折还
    order.forEach(function(key) {
      var pool = pools[key];
      var recs = pool.items.map(function(it) { return ensureRec(ledger, it, pool.ids); });
      var rates = pool.items.map(function(it) { return commuteRate(it.army); });
      var before = recs.map(function(rec) { return { money: num(rec.arrears.money, 0), grain: num(rec.arrears.grain, 0), months: num(rec.months, 0) }; });
      RES.forEach(function(k) {
        var owedK = recs.reduce(function(s, rec) { return s + Math.max(0, num(rec.arrears[k], 0)); }, 0);
        if (!(owedK > 1e-9)) return;
        var got = drawFromLeaves(pool.leaves, k, owedK);
        if (!(got > 0)) return;
        recs.forEach(function(rec) {
          var mine = Math.max(0, num(rec.arrears[k], 0));
          rec.arrears[k] = round(Math.max(0, mine - got * mine / owedK));
        });
        sum.repaid[k] += got;
      });
      var needC = recs.reduce(function(s, rec, i) { return s + Math.max(0, num(rec.arrears.grain, 0)) * rates[i]; }, 0);
      var gotC = needC > 1e-9 ? drawFromLeaves(pool.leaves, 'money', needC) : 0;
      if (gotC > 0) {
        recs.forEach(function(rec, i) {
          if (!(rates[i] > 0)) return;
          var mine = Math.max(0, num(rec.arrears.grain, 0)), stone = gotC * mine / needC;
          rec.arrears.grain = round(Math.max(0, mine - stone));
          sum.repaidCommuted.grain += stone;
        });
        sum.repaidCommuted.money += gotC;
      }
      recs.forEach(function(rec, i) {
        var b = before[i], left = null;
        ['money', 'grain'].forEach(function(k) {
          if (b[k] > 1e-9) { var x = Math.max(0, num(rec.arrears[k], 0)) / b[k]; left = left == null ? x : Math.max(left, x); }
        });
        if (left == null || !(b.months > 1e-9)) return;
        var after = round(b.months * Math.min(1, left)), back = round(b.months - after);
        if (back > 1e-9) {
          rec.months = after;
          rec.repaidMonths = round(num(rec.repaidMonths, 0) + back);
          sum.repaidMonths += back;
          sum.repaidArmies.push(rec.name);
        }
      });
    });
    RES.forEach(function(k) { sum.due[k] = round(sum.due[k]); sum.paid[k] = round(sum.paid[k]); sum.short[k] = round(sum.short[k]); sum.repaid[k] = round(sum.repaid[k]); });
    ['grain', 'money'].forEach(function(k) { sum.commuted[k] = round(sum.commuted[k]); sum.repaidCommuted[k] = round(sum.repaidCommuted[k]); });
    sum.intercepted = round(sum.intercepted); sum.repaidMonths = round(sum.repaidMonths);
    ledger.turn = turn;
    ledger.last = sum;
    // 欠饷月数写回军上（界面、推演读的是它）；军务那边过回合时也会再对一次
    var MA = global.TM && global.TM.MilitaryArrears;
    if (MA && typeof MA.syncArmy === 'function') items.forEach(function(it) { if (it.army) MA.syncArmy({ game: G, army: it.army }); });
    return sum;
  }

  var parts = (global.TM = global.TM || {}).__fiscalParts = global.TM.__fiscalParts || {};
  parts.payRoyalFromRetained = payRoyalFromRetained;
  parts.payArmiesFromRetained = payArmiesFromRetained;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
