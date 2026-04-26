// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 内帑（皇室私库）系统 · 核心引擎
// 设计方案：设计方案-财政系统.md 决策 F（内帑规则可配）
//
// 与帑廪平行实施：
//   - 6 源（皇庄田租/皇产/特别税/抄家/朝贡/帑廪转运）
//   - 5 支（宫廷用度/大典/赏赐/后宫陵寝/接济帑廪）
//   - 三列账本（钱/粮/布）
//   - 双向转运（帑廪 ↔ 内帑）
//   - 宫廷危机（内帑空竭 → 内廷腐败暴涨）
//   - 与腐败系统的 imperial 分项联动（侵吞）
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  function getMonthRatio() {
    if (typeof _getDaysPerTurn === 'function') return _getDaysPerTurn() / 30;
    return 1;
  }

  // ═════════════════════════════════════════════════════════════
  // 数据模型保障
  // ═════════════════════════════════════════════════════════════

  function ensureNeitangModel() {
    if (!GM.neitang) GM.neitang = {};
    var n = GM.neitang;
    if (n.balance === undefined) n.balance = 200000;
    if (n.monthlyIncome === undefined) n.monthlyIncome = 15000;
    if (n.monthlyExpense === undefined) n.monthlyExpense = 12000;
    if (n.lastDelta === undefined) n.lastDelta = 0;
    if (n.trend === undefined) n.trend = 'stable';

    if (!n.ledgers) n.ledgers = {};
    ['money','grain','cloth'].forEach(function(k) {
      if (!n.ledgers[k]) n.ledgers[k] = { stock:0, lastTurnIn:0, lastTurnOut:0, sources:{}, sinks:{}, history:[] };
      if (n.ledgers[k].history === undefined) n.ledgers[k].history = [];
    });
    if (n.ledgers.money.stock === 0 && n.balance !== 0) n.ledgers.money.stock = n.balance;

    if (!n.unit) n.unit = { money:'两', grain:'石', cloth:'匹' };
    if (!n.sources) n.sources = {
      huangzhuang:0, huangchan:0, specialTax:0, confiscation:0, tribute:0, guokuTransfer:0
    };
    if (!n.expenses) n.expenses = {
      gongting:0, dadian:0, shangci:0, houGongLingQin:0, guokuRescue:0
    };
    if (!n.sourcesDetail) n.sourcesDetail = {};   // ★ 大类下挂 subItems
    if (!n.expensesDetail) n.expensesDetail = {}; // ★
    if (!n.crisis) n.crisis = { active:false, consecutiveMonths:0, severity:0 };
    if (!n.history) n.history = { monthly:[], yearly:[], events:[] };
  }

  // 取全国 economyBase 字段汇总（CascadeTax 提供）·退化 0
  function _sumEB(field, fallback) {
    if (typeof CascadeTax !== 'undefined' && CascadeTax.sumEconomyBase) {
      var v = CascadeTax.sumEconomyBase(field);
      if (v > 0) return v;
    }
    return fallback || 0;
  }
  function _setSubsN(category, subItems) {
    if (!GM.neitang) return;
    if (!GM.neitang.sourcesDetail) GM.neitang.sourcesDetail = {};
    GM.neitang.sourcesDetail[category] = subItems;
  }
  function _setSubsExpN(category, subItems) {
    if (!GM.neitang) return;
    if (!GM.neitang.expensesDetail) GM.neitang.expensesDetail = {};
    GM.neitang.expensesDetail[category] = subItems;
  }

  // 全国皇庄汇总（imperialFarmland）·退化兜底用 GM.neitang.huangzhuangAcres
  function _imperialFarmlandTotal() {
    var v = _sumEB('imperialFarmland', 0);
    if (v > 0) return v;
    return safe((GM.neitang || {}).huangzhuangAcres, 100000);
  }
  // 全国皇产汇总（zhizao/kuangchang/yuyao）·遍历 adminHierarchy 累加
  function _imperialAssetsTotal() {
    var ret = { zhizao: 0, kuangchang: 0, yuyao: 0 };
    if (!GM.adminHierarchy) return ret;
    Object.keys(GM.adminHierarchy).forEach(function(fk) {
      var tree = GM.adminHierarchy[fk];
      function walk(divs) {
        if (!Array.isArray(divs)) return;
        divs.forEach(function(d) {
          if (!d) return;
          var ia = (d.economyBase && d.economyBase.imperialAssets) || {};
          ret.zhizao += (ia.zhizao || 0);
          ret.kuangchang += (ia.kuangchang || 0);
          ret.yuyao += (ia.yuyao || 0);
          if (d.children) walk(d.children);
          if (d.divisions) walk(d.divisions);
        });
      }
      walk((tree && tree.divisions) || []);
    });
    return ret;
  }

  // ═════════════════════════════════════════════════════════════
  // 6 类收入
  // ═════════════════════════════════════════════════════════════

  var Sources = {
    // 皇庄租·按 division.imperialFarmland 求和（粮租 60% / 银租 40%）
    huangzhuang: function() {
      var acres = _imperialFarmlandTotal();
      var ratePerAcre = 0.5;  // 两/亩·年
      var grainRent = acres * ratePerAcre * 0.6;
      var silverRent = acres * ratePerAcre * 0.4;
      var total = grainRent + silverRent;
      _setSubsN('huangzhuang', [
        { id: 'huangzhuang_grain', name: '皇庄粮租', amount: Math.round(grainRent), note: acres + ' 亩' },
        { id: 'huangzhuang_silver', name: '皇庄银租', amount: Math.round(silverRent) }
      ]);
      return total;
    },
    // 皇产经营·按 division.imperialAssets 求和（织造/矿场/御窑各一类）
    huangchan: function() {
      var assets = _imperialAssetsTotal();
      var zhizaoYield = assets.zhizao * 80000;       // 单局年息 8 万
      var kuangYield = assets.kuangchang * 50000;    // 单矿场年息 5 万
      var yaoYield = assets.yuyao * 30000;           // 单御窑年息 3 万
      var total = zhizaoYield + kuangYield + yaoYield;
      // 退化兜底·若 division 完全没配·读旧字段
      if (total === 0) total = safe((GM.neitang || {}).huangchanMonthly, 8000) * 12;
      _setSubsN('huangchan', [
        { id: 'huangchan_zhi', name: '织造盈余', amount: Math.round(zhizaoYield), note: assets.zhizao + ' 局' },
        { id: 'huangchan_kuang', name: '矿场银息', amount: Math.round(kuangYield), note: assets.kuangchang + ' 场' },
        { id: 'huangchan_yao', name: '御窑息', amount: Math.round(yaoYield), note: assets.yuyao + ' 窑' }
      ]);
      return total;
    },
    // 特别税·矿监税监等（仅 specialTaxActive）
    specialTax: function() {
      if (!GM.neitang || !GM.neitang.specialTaxActive) { _setSubsN('specialTax', []); return 0; }
      var amt = safe(GM.neitang.specialTaxMonthly, 5000) * 12;
      _setSubsN('specialTax', [
        { id: 'special_kuang', name: '矿监税监', amount: Math.round(amt) }
      ]);
      return amt;
    },
    // 抄家·事件触发型
    confiscation: function() {
      var amt = safe((GM.neitang || {})._recentConfiscation, 0);
      _setSubsN('confiscation', amt > 0 ? [
        { id: 'confiscation_in', name: '籍没入内帑', amount: Math.round(amt) }
      ] : []);
      return amt;
    },
    // 朝贡·拆 正贡 + 附礼
    tribute: function() {
      var count = ((GM.activeTributes || []).length) || 0;
      if (count === 0) { _setSubsN('tribute', []); return 0; }
      var main = count * 12000;
      var extra = count * 8000;
      _setSubsN('tribute', [
        { id: 'tribute_main', name: '朝贡正贡', amount: main, note: count + ' 国' },
        { id: 'tribute_extra', name: '朝贡附礼', amount: extra }
      ]);
      return main + extra;
    },
    // 帑廪转运·拆三本色（读 guoku.expenses.neiting 总额按 70/15/15 拆）
    guokuTransfer: function() {
      var total = safe((GM.guoku && GM.guoku.expenses && GM.guoku.expenses.neiting), 0);
      if (total === 0) { _setSubsN('guokuTransfer', []); return 0; }
      var s = Math.round(total * 0.7);
      var g = Math.round(total * 0.15);
      var c = total - s - g;
      _setSubsN('guokuTransfer', [
        { id: 'transfer_in_money', name: '解入银', amount: s },
        { id: 'transfer_in_grain', name: '解入粮(折)', amount: g },
        { id: 'transfer_in_cloth', name: '解入布(折)', amount: c }
      ]);
      return total;
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 5 类支出
  // ═════════════════════════════════════════════════════════════

  var Expenses = {
    // 宫廷·6 项（御膳/服饰/器用/御药房/御马苑/文房宫籍）
    gongting: function() {
      var concubines = safe((GM.harem || {}).count, 30);
      var eunuchs = safe((GM.eunuchs || {}).count, 100);
      var meal = (concubines * 50 + eunuchs * 30 + 1500) * 12;
      var clothes = (concubines * 30 + 1000) * 12;
      var utility = (concubines * 20 + 500) * 12;
      // 御药房·太医院进药用药
      var medicine = 18000 + concubines * 60;
      // 御马苑·御用马匹饲料训练（与 junxiang 战马军器不同·此为皇帝专属仪仗马）
      var royalHorse = 12000;
      // 文房宫籍·内书房+实录修撰+经筵讲章
      var library = 8000;
      var total = meal + clothes + utility + medicine + royalHorse + library;
      _setSubsExpN('gongting', [
        { id: 'gongting_meal', name: '御膳', amount: Math.round(meal), note: concubines + ' 嫔妃·' + eunuchs + ' 宦官' },
        { id: 'gongting_clothes', name: '服饰', amount: Math.round(clothes), note: '内织染局' },
        { id: 'gongting_utility', name: '器用', amount: Math.round(utility), note: '银作/瓷器/玉作' },
        { id: 'gongting_medicine', name: '御药房', amount: Math.round(medicine), note: '太医院/进药' },
        { id: 'gongting_horse', name: '御马苑', amount: royalHorse, note: '皇帝仪仗马' },
        { id: 'gongting_library', name: '文房宫籍', amount: library, note: '内书房/经筵' }
      ]);
      return total;
    },
    // 大典·拆 三大节(元旦/冬至/万寿) / 朝会大典 / 巡幸 / 籍田亲蚕
    dadian: function() {
      var thisYear = safe((GM.neitang || {})._thisYearCeremonyBudget, 0);
      // 三大节·年常项
      var threeFest = 60000;  // 元旦+冬至+万寿三节·内廷年支
      // 朝会大典·常项（大朝会/经筵/起居注）
      var court = 20000;
      // 巡幸·若皇帝出巡（由 GM.emperor.tourActive 触发）
      var tour = (GM.emperor && GM.emperor.tourActive) ? 150000 : 0;
      // 籍田亲蚕·年常礼·春耕亲蚕
      var jitian = 8000;
      var total = thisYear + threeFest + court + tour + jitian;
      _setSubsExpN('dadian', [
        { id: 'dadian_main', name: '本年大典', amount: Math.round(thisYear), note: thisYear > 0 ? '专项' : '无' },
        { id: 'dadian_threefest', name: '三大节', amount: threeFest, note: '元旦/冬至/万寿' },
        { id: 'dadian_court', name: '朝会大典', amount: court, note: '大朝/经筵' },
        { id: 'dadian_tour', name: '巡幸', amount: tour, note: tour > 0 ? '出巡中' : '无' },
        { id: 'dadian_jitian', name: '籍田亲蚕', amount: jitian, note: '春耕礼·年常' }
      ]);
      return total;
    },
    // 赏赐·拆 节庆赐宴 / 宦官打赏 / 嫔妃赏 / 内臣慰劳
    shangci: function() {
      var base = safe((GM.neitang || {})._recentRewards, 20000);
      var concubines = safe((GM.harem || {}).count, 30);
      var eunuchs = safe((GM.eunuchs || {}).count, 100);
      var festBanq = Math.round(base * 0.40);
      var eunuchBonus = eunuchs * 80;  // 太监额外打赏
      var concubineBonus = concubines * 200; // 嫔妃赏
      var officerComfort = Math.round(base * 0.20);  // 内臣慰劳
      var total = festBanq + eunuchBonus + concubineBonus + officerComfort;
      _setSubsExpN('shangci', [
        { id: 'shangci_fest', name: '节庆赐宴', amount: festBanq, note: '内廷宴会' },
        { id: 'shangci_eunuch', name: '宦官打赏', amount: eunuchBonus, note: eunuchs + ' 监' },
        { id: 'shangci_concubine', name: '嫔妃恩赏', amount: concubineBonus, note: concubines + ' 妃' },
        { id: 'shangci_comfort', name: '内臣慰劳', amount: officerComfort, note: '近侍/亲信' }
      ]);
      return total;
    },
    // 后宫陵寝·5 项（嫔妃份例/太监月钱/陵寝/太子俸/公主嫁妆）
    houGongLingQin: function() {
      var concubines = safe((GM.harem || {}).count, 30);
      var eunuchs = safe((GM.eunuchs || {}).count, 100);
      var pinfei = concubines * 200 * 12;
      var taijian = eunuchs * 60 * 12;
      var lingqin = (GM.emperor && GM.emperor.buildingTomb) ? 200000 : 40000;
      // 太子皇子俸·若有储君
      var heirCount = (GM.imperialClan && GM.imperialClan.heirCount) || 0;
      var heir = heirCount * 30000;  // 单皇子年俸 3 万
      // 公主仪仗·按已成年公主数（mock 默认 0）
      var princess = (GM.imperialClan && GM.imperialClan.princessCount) ? GM.imperialClan.princessCount * 8000 : 0;
      var total = pinfei + taijian + lingqin + heir + princess;
      _setSubsExpN('houGongLingQin', [
        { id: 'pinfei', name: '嫔妃份例', amount: Math.round(pinfei), note: concubines + ' 妃' },
        { id: 'taijian', name: '太监宫女月钱', amount: Math.round(taijian), note: eunuchs + ' 监' },
        { id: 'lingqin', name: '陵寝营建', amount: lingqin, note: (GM.emperor && GM.emperor.buildingTomb) ? '建陵中' : '常修' },
        { id: 'heir_stipend', name: '太子皇子俸', amount: heir, note: heirCount + ' 储君' },
        { id: 'princess', name: '公主仪仗嫁妆', amount: princess, note: princess > 0 ? '婚嫁/仪仗' : '无' }
      ]);
      return total;
    },
    // 接济帑廪·事件触发型
    guokuRescue: function() {
      var amt = safe((GM.neitang || {})._annualRescueAmount, 0);
      _setSubsExpN('guokuRescue', amt > 0 ? [
        { id: 'guokuRescue_main', name: '援助户部', amount: Math.round(amt), note: '内帑→帑廪' }
      ] : []);
      return amt;
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 月度结算
  // ═════════════════════════════════════════════════════════════

  function monthlySettle(mr) {
    mr = mr || getMonthRatio();
    ensureNeitangModel();
    var n = GM.neitang;

    // 计算 6 源年度总
    var totalIncome = 0;
    var srcBreakdown = {};
    for (var k in Sources) {
      var v = 0;
      try { v = Sources[k]() || 0; } catch(e) { v = 0; }
      srcBreakdown[k] = v;
      totalIncome += v;
    }
    n.monthlyIncome = Math.round(totalIncome / 12);
    n.sources = srcBreakdown;

    // 计算 5 类支出
    var totalExpense = 0;
    var expBreakdown = {};
    for (var e in Expenses) {
      var ev = 0;
      try { ev = Expenses[e]() || 0; } catch(err) { ev = 0; }
      expBreakdown[e] = ev;
      totalExpense += ev;
    }
    n.monthlyExpense = Math.round(totalExpense / 12);
    n.expenses = expBreakdown;

    // ★ 央地正确衔接（同 GuokuEngine 修复）
    var fixedRanThisTurn = (GM._lastFixedExpenseTurn === GM.turn);
    var oldBalance = n.balance;
    var periodIn, periodOut;
    if (fixedRanThisTurn && n.ledgers && n.ledgers.money) {
      // ✓ FixedExpense 已扣宫廷·monthlySettle 只补 4 项 residual(大典/赏赐/后宫陵寝/接济帑廪)
      periodIn = n.monthlyIncome * mr;  // 内帑 income 不走 cascade·仍由本身 Sources 计算
      var residualExpenseAnnual = (expBreakdown.dadian || 0) + (expBreakdown.shangci || 0)
                                + (expBreakdown.houGongLingQin || 0) + (expBreakdown.guokuRescue || 0);
      periodOut = (residualExpenseAnnual / 12) * mr;
      // 累加到 ledger（不覆盖）
      n.ledgers.money.stock = (n.ledgers.money.stock || 0) + periodIn - periodOut;
      n.balance = n.ledgers.money.stock;
    } else {
      // ✗ Fallback·FixedExpense 未跑·走老逻辑
      periodIn = n.monthlyIncome * mr;
      periodOut = n.monthlyExpense * mr;
      n.balance = oldBalance + periodIn - periodOut;
    }
    // ★ lastDelta 用 ledger 真实净变·避免漏算 FixedExpense 已扣的宫廷
    if (fixedRanThisTurn && n.ledgers && n.ledgers.money) {
      n.lastDelta = (n.ledgers.money.thisTurnIn || 0) - (n.ledgers.money.thisTurnOut || 0);
    } else {
      n.lastDelta = periodIn - periodOut;
    }

    // ★ 写入 turnIncome / turnExpense 供 widget 显示真实回合数字（之前只有 monthlyIncome 是年/12 固定值·widget 退而读它·导致显示永远不变）
    n.turnIncome = Math.round(periodIn);
    n.turnExpense = Math.round(periodOut);
    // 若 FixedExpense 已扣·turnExpense 用真实 ledger.thisTurnOut（含宫廷）
    if (fixedRanThisTurn && n.ledgers && n.ledgers.money) {
      n.turnExpense = Math.round(n.ledgers.money.thisTurnOut || periodOut);
    }
    n.turnDays = (GM.guoku && GM.guoku.turnDays) || (mr * 30);

    // 内帑接济帑廪：把 guokuRescue 实际加给国库（之前只算数字未入账）
    var rescueAnnual = safe(expBreakdown.guokuRescue, 0);
    var rescueThisPeriod = (rescueAnnual / 12) * mr;
    if (rescueThisPeriod > 0 && GM.guoku) {
      GM.guoku.balance = (GM.guoku.balance || 0) + rescueThisPeriod;
      if (GM.guoku.ledgers && GM.guoku.ledgers.money) {
        GM.guoku.ledgers.money.stock = (GM.guoku.ledgers.money.stock || 0) + rescueThisPeriod;
      }
      n._annualRescueAmount = 0;  // 重置一次性接济额
    }

    // 趋势
    var threshold = (totalIncome / 12) * 0.1;
    n.trend = n.lastDelta > threshold ? 'up' :
              n.lastDelta < -threshold ? 'down' : 'stable';

    // 腐败侵吞（§3.7 calcInnerTreasuryLeak）——已在 corruption 中扣，这里确保同步
    // (由 corruption engine 直接修改 n.balance)

    // 同步 ledger·新逻辑下 stock 已在上方累加·此处仅 lastTurnIn/Out 显示用
    if (!fixedRanThisTurn) n.ledgers.money.stock = n.balance;
    n.ledgers.money.lastTurnIn = periodIn;
    n.ledgers.money.lastTurnOut = periodOut;
    n.ledgers.money.sources = {
      皇庄:srcBreakdown.huangzhuang, 皇产:srcBreakdown.huangchan,
      特别税:srcBreakdown.specialTax, 抄家:srcBreakdown.confiscation,
      朝贡:srcBreakdown.tribute, 帑廪转运:srcBreakdown.guokuTransfer
    };
    n.ledgers.money.sinks = {
      宫廷:expBreakdown.gongting, 大典:expBreakdown.dadian,
      赏赐:expBreakdown.shangci, 后宫陵寝:expBreakdown.houGongLingQin,
      接济帑廪:expBreakdown.guokuRescue
    };

    // 历史快照
    n.history.monthly.push({
      turn: GM.turn, balance: n.balance,
      income: n.monthlyIncome, expense: n.monthlyExpense, delta: n.lastDelta
    });
    if (n.history.monthly.length > 120) n.history.monthly = n.history.monthly.slice(-120);

    // 粮布流水（简化）
    updateGrainClothFlow(mr);

    // 危机检查
    checkCrisis(mr);

    // 消费性缓存重置（如 recentConfiscation / recentRewards 等）
    n._recentConfiscation = 0;
  }

  function updateGrainClothFlow(mr) {
    var n = GM.neitang;
    // 内帑粮：朝贡/皇庄的粮食部分
    var grain = n.ledgers.grain;
    var grainIn = (n.sources.huangzhuang * 0.2 + n.sources.tribute * 0.1) / 10 * mr / 12;
    var grainOut = (n.expenses.gongting * 0.3 + n.expenses.shangci * 0.2) / 10 * mr / 12;
    grain.lastTurnIn = Math.round(grainIn);
    grain.lastTurnOut = Math.round(grainOut);
    grain.thisTurnIn = Math.round(grainIn);
    grain.thisTurnOut = Math.round(grainOut);
    grain.turnDelta = Math.round(grainIn - grainOut);
    grain.stock = Math.max(0, (grain.stock || 0) + grainIn - grainOut);

    // 内帑布：织造局、朝贡布帛
    var cloth = n.ledgers.cloth;
    var clothIn = (n.sources.huangchan * 0.15 + n.sources.tribute * 0.2) / 5 * mr / 12;
    var clothOut = (n.expenses.shangci * 0.4 + n.expenses.gongting * 0.1) / 5 * mr / 12;
    cloth.lastTurnIn = Math.round(clothIn);
    cloth.lastTurnOut = Math.round(clothOut);
    cloth.thisTurnIn = Math.round(clothIn);
    cloth.thisTurnOut = Math.round(clothOut);
    cloth.turnDelta = Math.round(clothIn - clothOut);
    cloth.stock = Math.max(0, (cloth.stock || 0) + clothIn - clothOut);

    // 同步给 widget 用的标量（subItems 显示 d 值）
    n.turnGrainIncome = Math.round(grainIn);
    n.turnGrainExpense = Math.round(grainOut);
    n.turnClothIncome = Math.round(clothIn);
    n.turnClothExpense = Math.round(clothOut);
  }

  function checkCrisis(mr) {
    var n = GM.neitang;
    var monthlyReq = n.monthlyExpense;

    if (n.balance < -monthlyReq * 3) {
      // 内帑空竭 3 月支出
      n.crisis.consecutiveMonths = (n.crisis.consecutiveMonths || 0) + mr;
      if (!n.crisis.active) {
        n.crisis.active = true;
        triggerCrisisEvent();
      }
      // 持续空竭 → 宫廷动荡
      if (n.crisis.consecutiveMonths > 3) {
        n.crisis.severity += 0.05 * mr;
        // 内廷腐败暴涨（太监贪污/宫人盗窃）
        if (GM.corruption && GM.corruption.subDepts.imperial) {
          GM.corruption.subDepts.imperial.true = Math.min(100,
            GM.corruption.subDepts.imperial.true + 0.5 * mr);
        }
        if (Math.random() < 0.05 * mr && typeof addEB === 'function') {
          addEB('朝代', '内帑空竭，宫人盗窃成风', { credibility: 'high' });
        }
      }
    } else {
      if (n.crisis.active) {
        n.crisis.consecutiveMonths = Math.max(0, n.crisis.consecutiveMonths - mr);
        if (n.crisis.consecutiveMonths < 1) {
          n.crisis.active = false;
          if (typeof addEB === 'function') addEB('朝代', '内帑渐丰，宫廷复宁', { credibility: 'high' });
        }
      }
    }
  }

  function triggerCrisisEvent() {
    if (typeof addEB === 'function') {
      addEB('朝代', '内帑不足以赡宫廷，皇家体面难维', { credibility: 'high' });
    }
    // 连锁：皇威下降 + 皇家地位减损
    if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 5);
    if (GM.huangquan && GM.huangquan.subDims && GM.huangquan.subDims.imperial) {
      GM.huangquan.subDims.imperial.value = Math.max(0, GM.huangquan.subDims.imperial.value - 8);
    }
    GM.neitang.history.events.push({
      turn: GM.turn, type: 'crisis', severity: GM.neitang.crisis.severity
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 动作（Actions）
  // ═════════════════════════════════════════════════════════════

  var Actions = {
    // 帑廪→内帑 转运
    transferFromGuoku: function(amount) {
      ensureNeitangModel();
      amount = amount || 100000;
      if (!GM.guoku) return { success: false, reason: '帑廪未就绪' };
      if (GM.guoku.balance < amount) return { success: false, reason: '帑廪不足' };
      GM.guoku.balance -= amount;
      GM.neitang.balance += amount;
      if (typeof addEB === 'function') addEB('朝代', '帑廪调拨 ' + Math.round(amount/10000) + ' 万两入内帑', { credibility: 'high' });
      return { success: true };
    },

    // 内帑→帑廪 接济
    rescueGuoku: function(amount) {
      ensureNeitangModel();
      amount = amount || 100000;
      if (GM.neitang.balance < amount) return { success: false, reason: '内帑不足' };
      if (!GM.guoku) return { success: false, reason: '帑廪未就绪' };
      GM.neitang.balance -= amount;
      GM.guoku.balance += amount;
      GM.neitang._annualRescueAmount = (GM.neitang._annualRescueAmount || 0) + amount;
      // 皇家德政 → 皇威+ 民心+
      if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + 3);
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + 2);
      if (typeof addEB === 'function') addEB('朝代', '陛下罄内帑 ' + Math.round(amount/10000) + ' 万两济国用，群臣感泣', { credibility: 'high' });
      return { success: true };
    },

    // 启用特别税
    enableSpecialTax: function(type, monthly) {
      ensureNeitangModel();
      type = type || '矿税';
      monthly = monthly || 5000;
      GM.neitang.specialTaxActive = true;
      GM.neitang.specialTaxType = type;
      GM.neitang.specialTaxMonthly = monthly;
      // 民心损（历史上矿税害民）
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 5);
      if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 3);
      if (typeof addEB === 'function') addEB('朝代', '开' + type + '，月收 ' + Math.round(monthly/1000) + ' 千两入内帑', { credibility: 'high' });
      return { success: true };
    },

    // 废特别税
    disableSpecialTax: function() {
      ensureNeitangModel();
      if (!GM.neitang.specialTaxActive) return { success: false, reason: '未开启' };
      GM.neitang.specialTaxActive = false;
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + 3);
      if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + 2);
      if (typeof addEB === 'function') addEB('朝代', '罢' + (GM.neitang.specialTaxType || '特别税') + '，民感圣德', { credibility: 'high' });
      return { success: true };
    },

    // 举行大典（用内帑）
    holdCeremony: function(type) {
      ensureNeitangModel();
      type = type || 'zhongshou';  // 中等规模
      var costs = {
        major: 500000,   // 封禅/万寿
        middle: 150000,  // 千叟宴/大飨
        minor: 50000     // 郊祀/常礼
      };
      var gains = { major: 15, middle: 8, minor: 3 };
      var cost = costs[type] || 150000;
      if (GM.neitang.balance < cost) return { success: false, reason: '内帑不足' };
      GM.neitang.balance -= cost;
      GM.neitang._thisYearCeremonyBudget = (GM.neitang._thisYearCeremonyBudget || 0) + cost;
      if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + (gains[type] || 8));
      if (typeof addEB === 'function') addEB('朝代', '行大典，费内帑 ' + Math.round(cost/10000) + ' 万两', { credibility: 'high' });
      return { success: true };
    },

    // 抄家入内帑（由别处触发，此处记账）
    recordConfiscation: function(amount) {
      ensureNeitangModel();
      amount = amount || 100000;
      GM.neitang._recentConfiscation = (GM.neitang._recentConfiscation || 0) + amount;
      GM.neitang.balance += amount;
      if (typeof addEB === 'function') addEB('朝代', '抄没家产 ' + Math.round(amount/10000) + ' 万两入内帑', { credibility: 'high' });
      return { success: true };
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 年度决算
  // ═════════════════════════════════════════════════════════════

  function yearlySettle() {
    ensureNeitangModel();
    var n = GM.neitang;
    var year = (typeof getCurrentYear === 'function') ? getCurrentYear() : GM.turn;
    var recent = n.history.monthly.slice(-12);
    var totalIn = 0, totalOut = 0;
    recent.forEach(function(m) { totalIn += m.income || 0; totalOut += m.expense || 0; });

    var archive = {
      year: year,
      totalIncome: totalIn,
      totalExpense: totalOut,
      netChange: totalIn - totalOut,
      finalBalance: n.balance,
      sources: Object.assign({}, n.sources),
      expenses: Object.assign({}, n.expenses),
      crisisMonths: n.crisis.consecutiveMonths || 0
    };
    n.history.yearly.push(archive);
    if (n.history.yearly.length > 40) n.history.yearly = n.history.yearly.slice(-40);

    // 清空年度临时累计
    n._thisYearCeremonyBudget = 0;
    n._annualRescueAmount = 0;

    return archive;
  }

  // ═════════════════════════════════════════════════════════════
  // 朝代预设
  // ═════════════════════════════════════════════════════════════

  var DYNASTY_PRESETS = {
    // 相对帑廪的比例
    '秦':   { ratio: 0.15 },
    '汉':   { ratio: 0.12 },
    '魏晋': { ratio: 0.10 },
    '唐':   { ratio: 0.15 },
    '五代': { ratio: 0.08 },
    '北宋': { ratio: 0.10 },
    '南宋': { ratio: 0.10 },
    '元':   { ratio: 0.20 },
    '明':   { ratio: 0.15 },
    '清':   { ratio: 0.25 },  // 清代内帑占比显著（和珅案可见）
    '上古': { ratio: 0.05 },
    '民国': { ratio: 0.08 }
  };

  function initFromDynasty(dynasty, phase, scenarioOverride) {
    ensureNeitangModel();
    var preset = DYNASTY_PRESETS[dynasty];
    if (!preset) {
      for (var k in DYNASTY_PRESETS) {
        if (dynasty && dynasty.indexOf(k) !== -1) { preset = DYNASTY_PRESETS[k]; break; }
      }
    }
    if (!preset) preset = { ratio: 0.12 };

    var guokuBalance = (GM.guoku && GM.guoku.balance) || 1000000;
    var monthlyInc = (GM.guoku && GM.guoku.monthlyIncome) || 80000;

    GM.neitang.balance = Math.round(guokuBalance * preset.ratio);
    GM.neitang.monthlyIncome = Math.round(monthlyInc * preset.ratio);
    GM.neitang.monthlyExpense = Math.round(monthlyInc * preset.ratio * 0.9);
    GM.neitang.ledgers.money.stock = GM.neitang.balance;
    GM.neitang.huangzhuangAcres = Math.round(((GM.hukou || {}).registeredTotal || 1e7) * 0.002);

    // 剧本覆盖
    if (scenarioOverride && scenarioOverride.neitang) {
      var no = scenarioOverride.neitang;
      // 新字段：initialMoney/initialGrain/initialCloth（三列分账）
      if (no.initialMoney !== undefined) {
        GM.neitang.balance = no.initialMoney;
        GM.neitang.ledgers.money.stock = no.initialMoney;
      }
      if (no.initialGrain !== undefined) {
        GM.neitang.ledgers.grain.stock = no.initialGrain;
        GM.neitang.grain = no.initialGrain;
      }
      if (no.initialCloth !== undefined) {
        GM.neitang.ledgers.cloth.stock = no.initialCloth;
        GM.neitang.cloth = no.initialCloth;
      }
      // 月均估计
      if (no.monthlyIncomeEstimate) {
        if (no.monthlyIncomeEstimate.money != null) GM.neitang.monthlyIncome = no.monthlyIncomeEstimate.money;
        if (no.monthlyIncomeEstimate.grain != null) GM.neitang.monthlyGrainIncome = no.monthlyIncomeEstimate.grain;
        if (no.monthlyIncomeEstimate.cloth != null) GM.neitang.monthlyClothIncome = no.monthlyIncomeEstimate.cloth;
      }
      if (no.monthlyExpenseEstimate) {
        if (no.monthlyExpenseEstimate.money != null) GM.neitang.monthlyExpense = no.monthlyExpenseEstimate.money;
        if (no.monthlyExpenseEstimate.grain != null) GM.neitang.monthlyGrainExpense = no.monthlyExpenseEstimate.grain;
        if (no.monthlyExpenseEstimate.cloth != null) GM.neitang.monthlyClothExpense = no.monthlyExpenseEstimate.cloth;
      }
      // 兼容旧字段
      if (no.balance !== undefined) { GM.neitang.balance = no.balance; GM.neitang.ledgers.money.stock = no.balance; }
      if (no.monthlyIncome !== undefined) GM.neitang.monthlyIncome = no.monthlyIncome;
      if (no.huangzhuangAcres !== undefined) GM.neitang.huangzhuangAcres = no.huangzhuangAcres;
      if (no.specialTaxActive !== undefined) GM.neitang.specialTaxActive = no.specialTaxActive;
    }

    return { dynasty: dynasty, ratio: preset.ratio, balance: GM.neitang.balance };
  }

  // ═════════════════════════════════════════════════════════════
  // 主 tick
  // ═════════════════════════════════════════════════════════════

  function tick(context) {
    ensureNeitangModel();
    var mr = (context && context._monthRatio) || getMonthRatio();

    try { monthlySettle(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'neitang] monthlySettle:') : console.error('[neitang] monthlySettle:', e); }

    // 年末决算
    var dpt = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var curY = Math.floor(GM.turn * dpt / 360);
    var prevY = Math.floor((GM.turn - 1) * dpt / 360);
    if (curY > prevY) {
      try { yearlySettle(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'neitang] yearlySettle:') : console.error('[neitang] yearlySettle:', e); }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.NeitangEngine = {
    tick: tick,
    ensureModel: ensureNeitangModel,
    getMonthRatio: getMonthRatio,
    Sources: Sources,
    Expenses: Expenses,
    Actions: Actions,
    monthlySettle: monthlySettle,
    yearlySettle: yearlySettle,
    checkCrisis: checkCrisis,
    initFromDynasty: initFromDynasty,
    DYNASTY_PRESETS: DYNASTY_PRESETS
  };

  console.log('[neitang] 引擎已加载：6 源 + 5 支 + 双向转运 + 大典 + 危机链');

})(typeof window !== 'undefined' ? window : this);
