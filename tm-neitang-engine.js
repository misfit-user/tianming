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

  // 民心走 MinxinLedger 总闸(2026-07-04 收口)：delta 落叶子+按源封顶。直写 trueIndex 会被 aggregateTrue 冲掉。
  function _mxApply(delta, reason, kind) {
    if (!delta) return;
    try {
      var L = (typeof TM !== 'undefined' && TM.MinxinLedger) || global.MinxinLedger;
      if (L && L.recordAndApply) L.recordAndApply(global.GM, { sourceSystem: 'neitang-engine', kind: kind || 'neitangPalace', delta: delta, reason: reason });
    } catch (_e) {}
  }

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

  function _isRecurringFiscalEntryActive(entry) {
    if (!entry || !entry.recurring) return false;
    var turn = GM.turn || 0;
    if (entry.stopAfterTurn !== undefined && entry.stopAfterTurn !== null &&
        turn > Number(entry.stopAfterTurn)) return false;
    if (entry.lastSettledTurn === turn) return false;
    if (entry.addedTurn === turn && entry.applied !== undefined) return false;
    return true;
  }

  function _ensureLedger(container, resource) {
    if (!container.ledgers) container.ledgers = {};
    if (!container.ledgers[resource]) {
      container.ledgers[resource] = { stock: 0, lastTurnIn: 0, lastTurnOut: 0, sources: {}, sinks: {}, history: [] };
    }
    var ledger = container.ledgers[resource];
    if (!ledger.sources) ledger.sources = {};
    if (!ledger.sinks) ledger.sinks = {};
    if (!ledger.history) ledger.history = [];
    return ledger;
  }

  function _applyRecurringFiscalEntries(container, mr) {
    var result = { moneyIn: 0, moneyOut: 0 };
    var turn = GM.turn || 0;
    function applyList(list, kind) {
      (list || []).forEach(function(entry) {
        if (!_isRecurringFiscalEntryActive(entry)) return;
        var resource = (entry.resource === 'grain' || entry.resource === 'cloth') ? entry.resource : 'money';
        var amount = Math.max(0, Number(entry.amount) || 0) / 12 * mr;
        if (amount <= 0) return;
        var ledger = _ensureLedger(container, resource);
        var label = entry.name || entry.category || (kind === 'income' ? 'recurring income' : 'recurring expense');
        if (kind === 'income') {
          ledger.stock = (Number(ledger.stock) || 0) + amount;
          ledger.thisTurnIn = (Number(ledger.thisTurnIn) || 0) + amount;
          ledger.sources[label] = (Number(ledger.sources[label]) || 0) + amount;
          if (resource === 'money') result.moneyIn += amount;
        } else {
          ledger.stock = (Number(ledger.stock) || 0) - amount;
          ledger.thisTurnOut = (Number(ledger.thisTurnOut) || 0) + amount;
          ledger.sinks[label] = (Number(ledger.sinks[label]) || 0) + amount;
          if (resource === 'money') result.moneyOut += amount;
        }
        if (resource === 'money') {
          container.balance = ledger.stock;
          container.money = ledger.stock;
        }
        entry.lastSettledTurn = turn;
        entry.lastSettlementAmount = amount;
      });
    }
    applyList(container.extraIncome, 'income');
    applyList(container.extraExpense, 'expense');
    return result;
  }

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
    if (rescueThisPeriod > 0 && typeof FiscalEngine !== 'undefined' && FiscalEngine.addToGuoku) {
      // 入库走 FiscalEngine 真账(2026-07-04 收口)·手工双账同步退役
      FiscalEngine.addToGuoku({ money: rescueThisPeriod }, '内帑济国用');
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

    if (fixedRanThisTurn && n.ledgers && n.ledgers.money) {
      n.ledgers.money.thisTurnIn = (Number(n.ledgers.money.thisTurnIn) || 0) + periodIn;
      n.ledgers.money.thisTurnOut = (Number(n.ledgers.money.thisTurnOut) || 0) + periodOut;
    } else {
      n.ledgers.money.thisTurnIn = periodIn;
      n.ledgers.money.thisTurnOut = periodOut;
    }

    var recurringFiscal = _applyRecurringFiscalEntries(n, mr);
    if (recurringFiscal.moneyIn || recurringFiscal.moneyOut) {
      periodIn += recurringFiscal.moneyIn;
      periodOut += recurringFiscal.moneyOut;
      n.lastDelta = (n.ledgers.money.thisTurnIn || periodIn) - (n.ledgers.money.thisTurnOut || periodOut);
      n.turnIncome = Math.round(n.ledgers.money.thisTurnIn || periodIn);
      n.turnExpense = Math.round(n.ledgers.money.thisTurnOut || periodOut);
      n.ledgers.money.lastTurnIn = periodIn;
      n.ledgers.money.lastTurnOut = periodOut;
      var _finalThreshold = (totalIncome / 12) * 0.1;
      n.trend = n.lastDelta > _finalThreshold ? 'up' :
                n.lastDelta < -_finalThreshold ? 'down' : 'stable';
    }
    n.money = n.balance;
    if (n.ledgers && n.ledgers.money) n.ledgers.money.stock = n.balance;

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
    if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
      global.AuthorityEngines.adjustHuangwei('familyScandal', -5, '内帑匮乏·皇家体面难维');
    } else if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 5); // 沙箱回退
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
      // 国库侧走 FiscalEngine 真账(2026-07-04 收口)
      if (typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) FiscalEngine.spendFromGuoku({ money: amount }, '拨入内帑');
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
      if (typeof FiscalEngine !== 'undefined' && FiscalEngine.addToGuoku) FiscalEngine.addToGuoku({ money: amount }, '内帑济国用'); // 收口·走真账
      GM.neitang._annualRescueAmount = (GM.neitang._annualRescueAmount || 0) + amount;
      // 皇家德政 → 皇威+ 民心+
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('benevolence', 3, '罄内帑济国用·皇家德政');
      } else if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + 3); // 沙箱回退
      _mxApply(2, '罄内帑济国用·皇家德政', 'imperialVirtue');
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
      _mxApply(-5, '开征' + (type || '特税') + '·中官四出害民', 'taxation');
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('lostVirtueRumor', -3, '中官税使四出·天下侧目');
      } else if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 3); // 沙箱回退
      if (typeof addEB === 'function') addEB('朝代', '开' + type + '，月收 ' + Math.round(monthly/1000) + ' 千两入内帑', { credibility: 'high' });
      return { success: true };
    },

    // 废特别税
    disableSpecialTax: function() {
      ensureNeitangModel();
      if (!GM.neitang.specialTaxActive) return { success: false, reason: '未开启' };
      GM.neitang.specialTaxActive = false;
      _mxApply(3, '罢特税·民困得苏', 'taxation');
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('benevolence', 2, '罢特税·民感圣德');
      } else if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + 2); // 沙箱回退
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
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('grandCeremony', gains[type] || 8, '大典彰威');
      } else if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + (gains[type] || 8)); // 沙箱回退
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

// ============================================================
// Phase 3 (2026-05-03)·从 tm-neitang-p2.js inline·~500 行
// 原 p2: S/A 级补完·5 incidentalSources·15 历史预设·royalClanPressure·neicangRules·taxDestinationOverrides·transferResistance
// APPEND only·无 OVERRIDE chain·安全 inline 为本文件的第二 IIFE 块·原 file 已 delete
// ============================================================
(function(global) {
  'use strict';

  if (typeof NeitangEngine === 'undefined') {
    console.warn('[neitang-p2] NeitangEngine 未加载');
    return;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  // 民心走 MinxinLedger 总闸(2026-07-04 收口)·同 p1 的 _mxApply(两 IIFE 各一份·作用域隔离)
  function _mxApply(delta, reason, kind) {
    if (!delta) return;
    try {
      var L = (typeof TM !== 'undefined' && TM.MinxinLedger) || global.MinxinLedger;
      if (L && L.recordAndApply) L.recordAndApply(global.GM, { sourceSystem: 'neitang-engine', kind: kind || 'neitangPalace', delta: delta, reason: reason });
    } catch (_e) {}
  }
  function rng(min, max) { return min + Math.random() * (max - min); }

  // ═════════════════════════════════════════════════════════════
  // S1: 5 类 incidentalSources
  // ═════════════════════════════════════════════════════════════

  var INCIDENTAL_TEMPLATES = {
    regional_tribute: {
      id: 'regional_tribute', name: '诸道进奉',
      historical: '唐德宗建中后，节度使以"羡余"进奉大盈库',
      defaultMode: 'random_monthly',
      defaultRange: [50000, 500000],
      // 每月检查，概率 30%
      monthlyProb: 0.3,
      side: { huangquan: -0.2, minxin: -0.3 }  // 地方借进奉坐大，民心负
    },
    yizui_yin: {
      id: 'yizui_yin', name: '议罪银',
      historical: '乾隆朝官员"议罪"缴银赎罪入内帑',
      defaultMode: 'event_driven',
      defaultRange: [30000, 300000],
      monthlyProb: 0.15,
      side: { corruption_imperial: +0.5, minxin: -0.2 }  // 法制松动，腐败升
    },
    guanshui_yingyu: {
      id: 'guanshui_yingyu', name: '关税盈余',
      historical: '粤海关盈余解内务府（清中期）',
      defaultMode: 'percent_over_quota',
      defaultPercent: 0.20,
      quarterlyProb: 0.8
    },
    yanzheng_gongxian: {
      id: 'yanzheng_gongxian', name: '盐政献纳',
      historical: '两淮盐商年献额银，明清皆有',
      defaultMode: 'fixed_annual',
      defaultAmount: 300000,
      side: { corruption_fiscal: +1 }  // 盐商捐输长期化催生腐败集团
    },
    gongpin_bianjia: {
      id: 'gongpin_bianjia', name: '外国贡物变价',
      historical: '四夷朝贡物品变卖银入内帑',
      defaultMode: 'random_annual',
      defaultRange: [20000, 200000]
    }
  };

  function processIncidentalSources(mr) {
    if (!GM.neitang) return;
    var rules = GM.neitang.neicangRules || {};
    var active = rules.incidentalSources || [];
    if (active.length === 0) return;

    active.forEach(function(src) {
      var tpl = INCIDENTAL_TEMPLATES[src.id];
      if (!tpl) return;
      var mode = src.mode || tpl.defaultMode;
      var income = 0;
      var tickProb = (tpl.monthlyProb || 0.3) * mr;

      if (mode === 'random_monthly') {
        if (Math.random() < tickProb) {
          var range = src.amountRange || tpl.defaultRange;
          income = Math.round(rng(range[0], range[1]));
        }
      } else if (mode === 'random_annual') {
        // 年度一次（近似：每月 1/12 概率）
        if (Math.random() < (1/12) * mr) {
          var range2 = src.amountRange || tpl.defaultRange;
          income = Math.round(rng(range2[0], range2[1]));
        }
      } else if (mode === 'fixed_annual') {
        // 按月均摊
        income = Math.round((src.amount || tpl.defaultAmount) * mr / 12);
      } else if (mode === 'percent_over_quota') {
        // 取关税盈余的 X%（需有"超额"机制，简化：读 customs 超额）
        var customsOverage = safe(GM.fiscal && GM.fiscal.customsOverage, 0);
        if (customsOverage > 0 && Math.random() < 0.25 * mr) {
          income = Math.round(customsOverage * (src.percent || tpl.defaultPercent));
          GM.fiscal.customsOverage = 0;  // 清零
        }
      } else if (mode === 'event_driven') {
        // 由事件触发，这里只做小概率被动触发（简化）
        if (Math.random() < tickProb * 0.5) {
          var range3 = src.amountRange || tpl.defaultRange;
          income = Math.round(rng(range3[0], range3[1]));
        }
      }

      if (income > 0) {
        GM.neitang.balance += income;
        GM.neitang._recentIncidental = (GM.neitang._recentIncidental || 0) + income;
        // 副作用
        var side = src.side || tpl.side || {};
        if (side.huangquan && GM.huangquan) {
          if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
            global.AuthorityEngines.adjustHuangquan(side.huangquan > 0 ? 'personalRule' : 'eunuchsRelatives', side.huangquan * mr, '\u5185\u5e11\u6765\u6e90\u526f\u4f5c\u7528');
          } else {
            GM.huangquan.index = clamp(GM.huangquan.index + side.huangquan * mr, 0, 100);
          }
        }
        if (side.minxin) _mxApply(side.minxin * mr, '内帑举措及民');
        if (side.corruption_imperial && GM.corruption && GM.corruption.subDepts.imperial) {
          GM.corruption.subDepts.imperial.true = clamp(GM.corruption.subDepts.imperial.true + side.corruption_imperial * mr, 0, 100);
        }
        if (side.corruption_fiscal && GM.corruption && GM.corruption.subDepts.fiscal) {
          GM.corruption.subDepts.fiscal.true = clamp(GM.corruption.subDepts.fiscal.true + side.corruption_fiscal * mr, 0, 100);
        }
        if (typeof addEB === 'function') {
          addEB('朝代', tpl.name + '入内帑 ' + Math.round(income/10000) + ' 万两', {
            credibility: 'high'
          });
        }
      }
    });
  }

  // ═════════════════════════════════════════════════════════════
  // S2: 15 条历史预设
  // ═════════════════════════════════════════════════════════════

  var DETAILED_PRESETS = {
    'shaofu_qinhan': {
      name: '秦汉初·少府制',
      historical: '山海池泽归少府（内帑）；算赋田租归国库',
      ratio: 0.22,
      rules: {
        taxDestinationOverrides: { salt: 'neicang', iron: 'neicang', mining: 'neicang' },
        transferResistance: { guokuToNeicang: 0.5, neicangToGuoku: 0.3 }
      }
    },
    'hanwu_yantie': {
      name: '汉武帝·盐铁国有',
      historical: '盐铁酒收归国库；贡献抄没仍归内帑',
      ratio: 0.12,
      rules: {
        taxDestinationOverrides: { salt: 'guoku', iron: 'guoku', wine: 'guoku' },
        transferResistance: { guokuToNeicang: 0.3 }
      }
    },
    'tang_early_clear': {
      name: '唐初·内外分明',
      historical: '租庸调全入国库；皇庄/矿冶入内帑',
      ratio: 0.10,
      rules: {
        transferResistance: { guokuToNeicang: 0.4, neicangToGuoku: 0.2 }
      }
    },
    'tang_late_xianyu': {
      name: '唐后期·羡余泛滥',
      historical: '诸道进奉大盈库；宦官掌内库；中央权威衰',
      ratio: 0.25,
      rules: {
        incidentalSources: [
          { id: 'regional_tribute', mode: 'random_monthly', amountRange: [80000, 600000] }
        ],
        transferResistance: { guokuToNeicang: 0.8, neicangToGuoku: 0.7 }  // 宦官把持
      }
    },
    'song_feng_zhuang': {
      name: '宋·封桩上供',
      historical: '内藏库定额上供；封桩济边成制度',
      ratio: 0.15,
      rules: {
        autoTransfers: [
          { from: 'guoku.money', to: 'neicang.money', mode: 'fixed', amount: 60000, cadence: 'monthly', reason: '上供内藏' }
        ],
        transferResistance: { guokuToNeicang: 0.3, neicangToGuoku: 0.2 }
      }
    },
    'yuan_tuoxia': {
      name: '元·投下分地',
      historical: '税粮入户部；五户丝入诸王；抄没入内帑',
      ratio: 0.18,
      rules: {
        taxDestinationOverrides: { wusihou: 'neicang' }
      }
    },
    'ming_jinhua': {
      name: '明初·金花银制',
      historical: '正统七年（1442）漕粮折银 100 万两定额入内承运库',
      ratio: 0.18,
      rules: {
        autoTransfers: [
          { from: 'guoku.money', to: 'neicang.money', mode: 'fixed', amount: Math.round(1000000/12), cadence: 'monthly', reason: '金花银' }
        ]
      }
    },
    'ming_mid_huangzhuang': {
      name: '明中·皇庄盐课内输',
      historical: '皇庄 300 余处；两淮盐课 68 万两中 10 万解内库',
      ratio: 0.20,
      rules: {
        autoTransfers: [
          { from: 'guoku.money', to: 'neicang.money', mode: 'fixed', amount: Math.round(100000/12), cadence: 'monthly', reason: '盐课内解' }
        ],
        royalClanPressure: { enabled: true, basePopulation: 20000, stipendPerCapita: 50 }
      }
    },
    'ming_late_mining': {
      name: '明末·矿税横行',
      historical: '万历 24-34 年矿税 569 万两全入内库；抄家入内承运',
      ratio: 0.30,
      rules: {
        incidentalSources: [
          { id: 'regional_tribute', mode: 'random_monthly', amountRange: [100000, 800000] }
        ],
        taxDestinationOverrides: { mining: 'neicang', customs: 'neicang' },
        royalClanPressure: { enabled: true, basePopulation: 80000, stipendPerCapita: 50,
          growthRatePerYear: 0.015 }
      }
    },
    'qing_early_neiwu': {
      name: '清初·内务府初制',
      historical: '皇庄/贡入内务府；户部主大宗',
      ratio: 0.15,
      rules: {
        transferResistance: { guokuToNeicang: 0.2, neicangToGuoku: 0.15 }
      }
    },
    'qing_mid_yizui': {
      name: '清中·盈余议罪',
      historical: '乾隆朝粤海关盈余入内务府；议罪银直入；和珅时代',
      ratio: 0.28,
      rules: {
        incidentalSources: [
          { id: 'yizui_yin', mode: 'event_driven', amountRange: [50000, 300000] },
          { id: 'guanshui_yingyu', mode: 'percent_over_quota', percent: 0.25 },
          { id: 'yanzheng_gongxian', mode: 'fixed_annual', amount: 300000 },
          { id: 'gongpin_bianjia', mode: 'random_annual', amountRange: [30000, 200000] }
        ]
      }
    },
    'qing_late_reverse': {
      name: '清末·反向救济',
      historical: '嘉道咸同，户部反补内务府亏空',
      ratio: 0.10,
      rules: {
        autoTransfers: [
          { from: 'guoku.money', to: 'neicang.money', mode: 'fixed', amount: Math.round(500000/12), cadence: 'monthly', reason: '补内务府亏空' }
        ]
      }
    },
    'no_split': {
      name: '无分账',
      historical: '所有收入入国库；内帑仅自动转账',
      ratio: 0.05,
      rules: {}
    }
  };

  // 按朝代→预设 key 的推荐映射
  var DYNASTY_PRESET_MAP = {
    '秦': ['shaofu_qinhan'],
    '汉': ['shaofu_qinhan', 'hanwu_yantie'],
    '魏晋': ['hanwu_yantie'],
    '唐': ['tang_early_clear', 'tang_early_clear', 'tang_late_xianyu', 'tang_late_xianyu'],  // 开国/全盛/中衰/末世
    '五代': ['tang_late_xianyu'],
    '北宋': ['song_feng_zhuang'],
    '南宋': ['song_feng_zhuang'],
    '元':   ['yuan_tuoxia'],
    '明':   ['ming_jinhua', 'ming_mid_huangzhuang', 'ming_mid_huangzhuang', 'ming_late_mining'],
    '清':   ['qing_early_neiwu', 'qing_mid_yizui', 'qing_mid_yizui', 'qing_late_reverse']
  };

  var PHASE_INDEX = { founding:0, peak:1, decline:2, collapse:3,
    '开国':0, '全盛':1, '守成':1, '中衰':2, '末世':3, '衰落':2 };

  function selectHistoricalPreset(dynasty, phase) {
    var list = DYNASTY_PRESET_MAP[dynasty];
    if (!list) {
      for (var k in DYNASTY_PRESET_MAP) {
        if (dynasty && dynasty.indexOf(k) !== -1) { list = DYNASTY_PRESET_MAP[k]; break; }
      }
    }
    if (!list) return DETAILED_PRESETS['no_split'];
    var pi = PHASE_INDEX[phase] !== undefined ? PHASE_INDEX[phase] : 1;
    var key = list[Math.min(pi, list.length - 1)];
    return DETAILED_PRESETS[key] || DETAILED_PRESETS['no_split'];
  }

  // ═════════════════════════════════════════════════════════════
  // S3: royalClanPressure（明代宗室压力）
  // ═════════════════════════════════════════════════════════════

  function applyRoyalClanPressure(mr) {
    var rules = GM.neitang.neicangRules || {};
    var rcp = rules.royalClanPressure;
    if (!rcp || !rcp.enabled) return;
    if (!GM.neitang._royalClan) {
      GM.neitang._royalClan = {
        population: rcp.basePopulation || 5000,
        startTurn: GM.turn
      };
    }
    var rc = GM.neitang._royalClan;

    // 年增长率（按月累加）
    var monthlyGrowth = Math.pow(1 + (rcp.growthRatePerYear || 0.015), 1/12) - 1;
    rc.population = Math.round(rc.population * Math.pow(1 + monthlyGrowth, mr));

    // 宗室俸禄（每月）
    var stipendPerCapita = rcp.stipendPerCapita || 50;
    var monthlyCost = rc.population * stipendPerCapita / 12 * mr;  // 年折月

    // 默认出帑廪粮（明代）
    var dest = rcp.destination || 'guoku.grain';
    // 宗禄出账判权(2026-07-04 审查定罪)：rcp.annualStipendPaid 已配则 FixedExpense.calcRoyalStipend
    // 按年额扣同一 sink「宗禄」——本引擎同回合再按人口扣一遍=双扣。FixedExpense 本回合已跑即让位(人口演化照跑)。
    var _fixedOwnsStipend = (Number(rcp.annualStipendPaid) > 0) && (GM._lastFixedExpenseTurn === GM.turn);
    if (!_fixedOwnsStipend) {
      // 宗禄支出走 FiscalEngine 真账(2026-07-04 收口)·粮价 5 两/石等价折算
      if (dest === 'guoku.grain' && typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) {
        FiscalEngine.spendFromGuoku({ grain: monthlyCost / 5 }, '宗禄');
      } else if (typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) {
        FiscalEngine.spendFromGuoku({ money: monthlyCost }, '宗禄');
      }
    }

    // 崩溃触发
    if (rcp.collapseTrigger) {
      var grainStock = (GM.guoku && GM.guoku.ledgers && GM.guoku.ledgers.grain && GM.guoku.ledgers.grain.stock) || 0;
      var threshold = grainStock * 0.3;
      var annualCost = rc.population * stipendPerCapita;
      if (annualCost > threshold && Math.random() < 0.02 * mr) {
        triggerRoyalClanBankruptcy();
      }
    }

    GM.neitang._royalClan.lastStipendCost = monthlyCost;
  }

  function triggerRoyalClanBankruptcy() {
    if (typeof addEB === 'function') {
      addEB('朝代', '宗室子孙繁衍数十倍，朝廷难以供养，藩王贫极殴夺民产',
        { credibility: 'high' });
    }
    _mxApply(-10, '宗室繁衍难供·藩王殴夺民产');
    if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
      global.AuthorityEngines.adjustHuangwei('familyScandal', -8, '宗禄难支·藩王夺民产');
    } else if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 8); // 沙箱回退
    if (GM.neitang.history) GM.neitang.history.events.push({
      turn: GM.turn, type: 'royal_clan_bankruptcy'
    });
  }

  // ═════════════════════════════════════════════════════════════
  // A1+A2: neicangRules 完整读取 + taxDestinationOverrides
  // ═════════════════════════════════════════════════════════════

  var _origInit = NeitangEngine.initFromDynasty;
  NeitangEngine.initFromDynasty = function(dynasty, phase, scenarioOverride) {
    var r = _origInit.call(this, dynasty, phase, scenarioOverride);

    // 应用详细历史预设
    if (!GM.neitang.neicangRules) GM.neitang.neicangRules = {};
    var preset = selectHistoricalPreset(dynasty, phase);
    if (preset && preset.rules) {
      // 深合并
      Object.keys(preset.rules).forEach(function(k) {
        if (GM.neitang.neicangRules[k] === undefined) {
          GM.neitang.neicangRules[k] = preset.rules[k];
        }
      });
      GM.neitang._presetName = preset.name;
      GM.neitang._presetHistorical = preset.historical;
    }

    // 剧本 fiscalConfig.neicangRules 完整覆盖
    if (scenarioOverride && scenarioOverride.fiscalConfig && scenarioOverride.fiscalConfig.neicangRules) {
      var scRules = scenarioOverride.fiscalConfig.neicangRules;
      Object.keys(scRules).forEach(function(k) {
        GM.neitang.neicangRules[k] = scRules[k];
      });
    }

    return Object.assign({ preset: preset ? preset.name : null }, r);
  };

  // taxDestinationOverrides：修改帑廪 Sources，让某些税种入内帑
  // 通过包装 GuokuEngine.Sources 实现
  if (typeof GuokuEngine !== 'undefined' && GuokuEngine.Sources) {
    var _origGuokuSources = {};
    Object.keys(GuokuEngine.Sources).forEach(function(key) {
      _origGuokuSources[key] = GuokuEngine.Sources[key];
      GuokuEngine.Sources[key] = function() {
        var rules = (GM.neitang && GM.neitang.neicangRules) || {};
        var overrides = rules.taxDestinationOverrides || {};
        // 若该税被标为 neicang，返回 0（帑廪不收），同时累加到 _redirectedToNeicang
        if (overrides[key] === 'neicang') {
          var orig = _origGuokuSources[key]() || 0;
          if (!GM.neitang._redirectedThisMonth) GM.neitang._redirectedThisMonth = 0;
          GM.neitang._redirectedThisMonth += orig / 12;  // 月度等份
          return 0;
        }
        return _origGuokuSources[key]();
      };
    });
  }

  // ═════════════════════════════════════════════════════════════
  // A3: transferResistance 调拨阻力
  // ═════════════════════════════════════════════════════════════

  var _origTransferFromGuoku = NeitangEngine.Actions.transferFromGuoku;
  NeitangEngine.Actions.transferFromGuoku = function(amount) {
    var rules = (GM.neitang && GM.neitang.neicangRules) || {};
    var resistance = (rules.transferResistance || {}).guokuToNeicang || 0;
    if (resistance > 0) {
      // 阻力 > 0.5 视为需要廷议（简化：概率失败）
      if (Math.random() < resistance * 0.5) {
        if (typeof addEB === 'function') {
          addEB('朝代', '谏官抗议：国用岂可私输内帑？调拨未果', { credibility: 'high' });
        }
        return { success: false, reason: '廷议否决（阻力 ' + resistance.toFixed(2) + '）' };
      }
    }
    return _origTransferFromGuoku.call(this, amount);
  };

  var _origRescueGuoku = NeitangEngine.Actions.rescueGuoku;
  NeitangEngine.Actions.rescueGuoku = function(amount) {
    var rules = (GM.neitang && GM.neitang.neicangRules) || {};
    var resistance = (rules.transferResistance || {}).neicangToGuoku || 0;
    // 内帑→帑廪阻力低得多（皇家德政），只在极端阻力下失败
    if (resistance > 0.7 && Math.random() < (resistance - 0.7)) {
      if (typeof addEB === 'function') {
        addEB('朝代', '宦官/近臣劝阻：内帑不可轻输国用', { credibility: 'medium' });
      }
      return { success: false, reason: '近臣劝阻（阻力 ' + resistance.toFixed(2) + '）' };
    }
    return _origRescueGuoku.call(this, amount);
  };

  // ═════════════════════════════════════════════════════════════
  // 接入 tick
  // ═════════════════════════════════════════════════════════════

  var _origTick = NeitangEngine.tick;
  NeitangEngine.tick = function(context) {
    _origTick.call(this, context);
    var mr = (context && context._monthRatio) ||
             (typeof NeitangEngine.getMonthRatio === 'function' ? NeitangEngine.getMonthRatio() : 1);

    try { processIncidentalSources(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'neitang-p2] incidental:') : console.error('[neitang-p2] incidental:', e); }
    try { applyRoyalClanPressure(mr); }   catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'neitang-p2] royalClan:') : console.error('[neitang-p2] royalClan:', e); }

    function isNeitangMoneyPath(path) {
      return path === 'neitang.money' || path === 'neicang.money';
    }
    function syncCashMirrors() {
      // 国库侧对账走 FiscalEngine(2026-07-04 收口)·空扣账=纯 reconcile(ledger↔balance 单一真相)
      try { if (typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) FiscalEngine.spendFromGuoku({}, '对账'); } catch (_e) {}
      if (GM.neitang && typeof GM.neitang.balance === 'number') {
        GM.neitang.money = GM.neitang.balance;
        if (GM.neitang.ledgers && GM.neitang.ledgers.money) GM.neitang.ledgers.money.stock = GM.neitang.balance;
      }
    }

    // 应用被重定向的税收
    if (GM.neitang._redirectedThisMonth && GM.neitang._redirectedThisMonth > 0) {
      GM.neitang.balance += GM.neitang._redirectedThisMonth;
      GM.neitang._redirectedThisMonth = 0;
    }

    // 执行 autoTransfers
    var autos = ((GM.neitang.neicangRules || {}).autoTransfers) || [];
    autos.forEach(function(tr) {
      var cadence = tr.cadence || 'monthly';
      if (cadence === 'monthly') {
        var amt = 0;
        if (tr.mode === 'fixed') amt = (tr.amount || 0) * mr;
        else if (tr.mode === 'percent') amt = (tr.percent || 0) * ((GM.guoku && GM.guoku.monthlyIncome) || 0) * mr;
        if (amt > 0 && GM.guoku && GM.guoku.balance > amt) {
          // 国库侧走 FiscalEngine 真账(2026-07-04 收口)·内帑侧仍本引擎自账
          if (tr.from === 'guoku.money' && isNeitangMoneyPath(tr.to)) {
            if (typeof FiscalEngine !== 'undefined' && FiscalEngine.spendFromGuoku) FiscalEngine.spendFromGuoku({ money: amt }, '定拨内帑');
            GM.neitang.balance += amt;
          } else if (isNeitangMoneyPath(tr.from) && tr.to === 'guoku.money') {
            if (GM.neitang.balance > amt) {
              GM.neitang.balance -= amt;
              if (typeof FiscalEngine !== 'undefined' && FiscalEngine.addToGuoku) FiscalEngine.addToGuoku({ money: amt }, '内帑定拨入库');
            }
          }
        }
      }
    });
    syncCashMirrors();
  };

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  NeitangEngine.INCIDENTAL_TEMPLATES = INCIDENTAL_TEMPLATES;
  NeitangEngine.DETAILED_PRESETS = DETAILED_PRESETS;
  NeitangEngine.DYNASTY_PRESET_MAP = DYNASTY_PRESET_MAP;
  NeitangEngine.selectHistoricalPreset = selectHistoricalPreset;
  NeitangEngine.processIncidentalSources = processIncidentalSources;
  NeitangEngine.applyRoyalClanPressure = applyRoyalClanPressure;

  console.log('[neitang-p2] 加载：5 进奉类 + 13 预设 + 宗室压力 + 调拨阻力 + 税种重定向');

})(typeof window !== 'undefined' ? window : this);
