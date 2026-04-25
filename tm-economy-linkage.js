// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 经济系统四子系统联动层
// 设计方案：设计方案-经济系统联动总图.md（523 行）
//
// 实现：
//   - 百姓负担层层剥夺模型（peasantBurdenStructure）
//   - 区域财政树（region.fiscal）
//   - 上供/留存 分账
//   - 下拨生命周期（transferOrder）
//   - 俸禄流（财政 → 角色）
//   - 贪腐流（腐败 → 角色）
//   - 抄家触发（肃贪/诛 → 角色 → 内帑）
//   - 事件总线扩展
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
  // 1. 百姓负担层层剥夺模型
  // 设计 §A：peasantActual = nominal × (1 + Σ各级加派)
  // ═════════════════════════════════════════════════════════════

  function ensurePeasantBurden(regionId) {
    if (!GM.fiscal) GM.fiscal = {};
    if (!GM.fiscal.peasantBurden) GM.fiscal.peasantBurden = {};
    if (!GM.fiscal.peasantBurden[regionId]) {
      GM.fiscal.peasantBurden[regionId] = {
        regionId: regionId,
        nominal: 0,
        levyLevels: {
          county:    0,   // 县级加派
          prefecture:0,   // 府级加派
          province:  0,   // 路省级加派
          landlord:  0,   // 豪强吞没
          converter: 0    // 折纳价差
        },
        peasantActual: 0,      // 民间实际负担
        officialReceived: 0,   // 官府实收
        pocketedByLocal: 0,    // 胥吏私肥
        pocketedByLandlord: 0,
        pocketedByConverter: 0
      };
    }
    return GM.fiscal.peasantBurden[regionId];
  }

  function calcPeasantBurden(regionId, nominalTax, mr) {
    mr = mr || 1;
    var b = ensurePeasantBurden(regionId);
    b.nominal = nominalTax;

    // 各级加派率（来自腐败）
    var provincialCorr = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0);
    var fiscalCorr = safe((GM.corruption && GM.corruption.subDepts.fiscal || {}).true, 0);

    // 层层剥夺率
    var countyLevy     = (provincialCorr / 100) * 0.08 + (GM.fiscal.floatingCollectionRate || 0) * 0.3;
    var prefectureLevy = (provincialCorr / 100) * 0.05;
    var provinceLevy   = (fiscalCorr / 100) * 0.06;
    var landlordCut    = safe((GM.minxin && GM.minxin.byClass && GM.minxin.byClass.haoqiang || {}).size, 0.01) * 4;  // 豪强比例影响
    var converterLoss  = (fiscalCorr / 100) * 0.04;  // 折纳价差

    b.levyLevels.county = countyLevy;
    b.levyLevels.prefecture = prefectureLevy;
    b.levyLevels.province = provinceLevy;
    b.levyLevels.landlord = landlordCut;
    b.levyLevels.converter = converterLoss;

    // 民间实缴 = 名义 × (1 + Σ)
    var totalLevy = countyLevy + prefectureLevy + provinceLevy + landlordCut + converterLoss;
    b.peasantActual = nominalTax * (1 + totalLevy);

    // 官府实收 = 名义 × (1 - 实征漏损)
    var leakage = (provincialCorr + fiscalCorr) / 200 * 0.5;
    b.officialReceived = nominalTax * (1 - leakage);

    // 分配被剥夺部分
    var totalPocket = b.peasantActual - b.officialReceived;
    b.pocketedByLocal = totalPocket * (countyLevy + prefectureLevy + provinceLevy) / Math.max(totalLevy, 0.01) * 0.8;
    b.pocketedByLandlord = totalPocket * landlordCut / Math.max(totalLevy, 0.01);
    b.pocketedByConverter = totalPocket * converterLoss / Math.max(totalLevy, 0.01);

    return b;
  }

  // ═════════════════════════════════════════════════════════════
  // 2. 区域财政树（region.fiscal）
  // ═════════════════════════════════════════════════════════════

  function ensureRegionFiscal(regionId) {
    if (!GM.regions) GM.regions = {};
    if (!GM.regions[regionId]) GM.regions[regionId] = {};
    var r = GM.regions[regionId];
    if (!r.fiscal) r.fiscal = {
      ledgers: {
        money: { stock: 0, lastIn: 0, lastOut: 0 },
        grain: { stock: 0, lastIn: 0, lastOut: 0 }
      },
      allocation: {
        localRetain: 0.3,    // 本级留存比
        upToParent: 0.3,     // 上供父级
        upToCenter: 0.4      // 上供中央（央地系统可覆盖）
      },
      fixed:    [],   // 固定扣项（俸禄/守军/驿站）
      discretionary: 0,  // 地方可自主支出
      imperial: [],   // 央令指派（诏修工程）
      illicit:  0,    // 挪用（入地方官 char）
      parentId: null  // 父级区域
    };
    if (!r.publicTreasury) r.publicTreasury = {
      balance: 0, handoverLog: [], handoverDeficit: 0
    };
    return r;
  }

  function allocateRegionTax(regionId, nominalTax, mr) {
    mr = mr || 1;
    var r = ensureRegionFiscal(regionId);
    var b = calcPeasantBurden(regionId, nominalTax, mr);
    var officialReceived = b.officialReceived;

    var alloc = r.fiscal.allocation;
    var localAmt  = officialReceived * alloc.localRetain;
    var parentAmt = officialReceived * alloc.upToParent;
    var centerAmt = officialReceived * alloc.upToCenter;

    // 本级入账
    r.fiscal.ledgers.money.stock += localAmt;
    r.fiscal.ledgers.money.lastIn = localAmt;

    // 公库也更新
    r.publicTreasury.balance = r.fiscal.ledgers.money.stock;

    // 上供父级
    if (parentAmt > 0 && r.fiscal.parentId) {
      var parent = ensureRegionFiscal(r.fiscal.parentId);
      parent.fiscal.ledgers.money.stock += parentAmt;
    }

    // 上供中央（依皇权可支配性 × 皇威乘数）
    if (centerAmt > 0 && GM.guoku) {
      var h = (GM.huangquan || {}).index || 50;
      var complianceMult = h < 35 ? 0.5 :
                           h < 60 ? 0.85 : 1.0;
      GM.guoku.balance += centerAmt * complianceMult;
    }

    // 记录"挪用流"到 illicit
    r.fiscal.illicit += b.pocketedByLocal * mr;

    return { localAmt: localAmt, parentAmt: parentAmt, centerAmt: centerAmt };
  }

  // ═════════════════════════════════════════════════════════════
  // 3. 下拨生命周期（transferOrder）
  // ═════════════════════════════════════════════════════════════

  function ensureTransferOrderState() {
    if (!GM.transferOrders) GM.transferOrders = [];
  }

  // 玩家诏令 / AI 建议 创建下拨
  function createTransferOrder(spec) {
    ensureTransferOrderState();
    var order = {
      id: 'to_' + GM.turn + '_' + Math.random().toString(36).slice(2, 6),
      fromAccount: spec.fromAccount || 'guoku.money',
      toRegion:    spec.toRegion || null,
      toAccount:   spec.toAccount || 'regional',
      amount:      spec.amount || 0,
      purpose:     spec.purpose || '赈济',
      status:      'pending',
      createTurn:  GM.turn,
      startTurn:   GM.turn + 1,
      expectedEndTurn: GM.turn + (spec.durationMonths ? Math.max(1, Math.floor(spec.durationMonths)) : 3),
      deliveredAmount: 0,
      lossRate:    0  // 运输损耗
    };
    GM.transferOrders.push(order);

    // 立即扣源
    if (order.fromAccount === 'guoku.money' && GM.guoku) {
      if (GM.guoku.balance < order.amount) {
        order.status = 'failed';
        order.failReason = '帑廪不足';
        return { success: false, reason: '帑廪不足' };
      }
      GM.guoku.balance -= order.amount;
    } else if (order.fromAccount === 'neitang.money' && GM.neitang) {
      if (GM.neitang.balance < order.amount) {
        order.status = 'failed';
        order.failReason = '内帑不足';
        return { success: false, reason: '内帑不足' };
      }
      GM.neitang.balance -= order.amount;
    }
    return { success: true, order: order };
  }

  function processTransferOrders(mr) {
    ensureTransferOrderState();
    var active = GM.transferOrders.filter(function(o) { return o.status === 'pending' || o.status === 'transit'; });
    active.forEach(function(o) {
      if (GM.turn < o.startTurn) {
        o.status = 'pending';
        return;
      }
      o.status = 'transit';

      // 按期发放（每回合一份）
      var totalTurns = Math.max(1, o.expectedEndTurn - o.startTurn);
      var perTurn = o.amount / totalTurns;
      // 运输损耗（腐败 + 距离）
      var corruptionLoss = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0) / 100 * 0.15;
      var thisDelivery = perTurn * (1 - corruptionLoss);

      // 交付到目标
      if (o.toRegion) {
        var r = ensureRegionFiscal(o.toRegion);
        r.fiscal.ledgers.money.stock += thisDelivery;
        r.publicTreasury.balance = r.fiscal.ledgers.money.stock;
      }
      o.deliveredAmount += thisDelivery;
      o.lossRate = corruptionLoss;

      if (GM.turn >= o.expectedEndTurn) {
        o.status = 'completed';
        if (typeof addEB === 'function') {
          addEB('朝代', '拨银毕：' + o.purpose + '（' + Math.round(o.deliveredAmount / 10000) + ' 万两）',
            { credibility: 'high' });
        }
      }
    });

    // 清理超老的 completed/failed（保留最近 30）
    var completed = GM.transferOrders.filter(function(o) { return o.status === 'completed' || o.status === 'failed'; });
    if (completed.length > 30) {
      GM.transferOrders = GM.transferOrders.filter(function(o) { return o.status !== 'completed' && o.status !== 'failed'; })
        .concat(completed.slice(-30));
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 4. 俸禄流（财政 → 角色）
  // ═════════════════════════════════════════════════════════════

  function paySalariesToOfficials(mr) {
    var chars = GM.chars || [];
    var totalPaid = 0;
    chars.forEach(function(ch) {
      if (!ch.officialTitle || ch.retired || ch.dead) return;
      if (typeof CharEconEngine === 'undefined') return;
      try {
        var salary = CharEconEngine.Income.salary(ch) * mr;
        if (salary <= 0) return;
        // 从对应账户扣款
        // 中央官 → 帑廪；地方官 → 地方 fiscal；皇室 → 内帑
        var paid = false;
        if (ch.department === 'imperial' && GM.neitang) {
          if (GM.neitang.balance >= salary) {
            GM.neitang.balance -= salary;
            paid = true;
          }
        } else if (ch.currentRegion && GM.regions && GM.regions[ch.currentRegion]) {
          // 地方官从地方留存出
          var r = GM.regions[ch.currentRegion];
          if (r.fiscal && r.fiscal.ledgers.money.stock >= salary) {
            r.fiscal.ledgers.money.stock -= salary;
            r.publicTreasury.balance = r.fiscal.ledgers.money.stock;
            paid = true;
          }
        }
        if (!paid && GM.guoku && GM.guoku.balance >= salary) {
          GM.guoku.balance -= salary;
          paid = true;
        }
        if (paid) {
          CharEconEngine.paySalary(ch, salary);
          totalPaid += salary;
        } else {
          // 欠饷 → 压力 + 腐败倾向
          ch.stress = Math.min(100, (ch.stress || 20) + 2 * mr);
          ch._unpaidMonths = (ch._unpaidMonths || 0) + mr;
          // 欠 3+ 月 → integrity 下降（被迫贪）
          if (ch._unpaidMonths > 3) {
            ch.integrity = Math.max(0, (ch.integrity || 50) - 0.5 * mr);
          }
        }
      } catch(e) {
        console.error('[linkage] paySalary:', ch.name, e);
      }
    });
    if (!GM._linkageStats) GM._linkageStats = {};
    GM._linkageStats.lastSalariesPaid = totalPaid;
  }

  // ═════════════════════════════════════════════════════════════
  // 5. 贪腐流（腐败 → 角色）
  // 在腐败 tick 后，按部门腐败强度推送 illicit 收入到相关角色
  // ═════════════════════════════════════════════════════════════

  function distributeIllicitIncome(mr) {
    if (typeof CharEconEngine === 'undefined') return;
    if (!GM.corruption) return;
    var chars = GM.chars || [];
    chars.forEach(function(ch) {
      if (!ch.officialTitle || ch.retired || ch.dead) return;
      if ((ch.integrity || 50) > 65) return;  // 清官不贪
      try {
        // 从 Income.bribes + Income.embezzle 已在 CharEconEngine 中执行
        // 这里额外添加"地方挪用"流：地方 fiscal.illicit → 地方官
        if (ch.currentRegion && GM.regions && GM.regions[ch.currentRegion]) {
          var r = GM.regions[ch.currentRegion];
          if (r.fiscal && r.fiscal.illicit > 0) {
            var share = r.fiscal.illicit * 0.1 * mr;  // 10% 本月入本官腰包
            if (share > 0) {
              CharEconEngine.addBribeIncome(ch, share, 0.5);
              r.fiscal.illicit -= share;
            }
          }
        }
      } catch(e) {
        console.error('[linkage] illicit:', ch.name, e);
      }
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 6. 抄家触发（从肃贪 / 诛事件）
  // ═════════════════════════════════════════════════════════════

  function triggerConfiscationByName(charName, destination, intensity) {
    var ch = (GM.chars || []).find(function(c) { return c.name === charName; });
    if (!ch) return { success: false, reason: '无此人' };
    if (typeof CharEconEngine === 'undefined') return { success: false, reason: '引擎未就绪' };
    return CharEconEngine.confiscate(ch, {
      destination: destination || 'neitang',
      intensity: intensity !== undefined ? intensity : 0.6,
      includeClan: (intensity || 0) > 0.7
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 7. 事件总线扩展（经济事件）
  // ═════════════════════════════════════════════════════════════

  var EconomyEventBus = {
    _listeners: {},
    on: function(type, handler) {
      if (!this._listeners[type]) this._listeners[type] = [];
      this._listeners[type].push(handler);
    },
    emit: function(type, data) {
      (this._listeners[type] || []).forEach(function(h) {
        try { h(data); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'EventBus') : console.error('[EventBus]', type, e); }
      });
    }
  };

  // 预定义事件类型：
  // - qianhuang (钱荒)
  // - confiscation (抄家)
  // - bankruptcy (破产)
  // - reformEnacted (改革颁行)
  // - peasantRevolt (民变)
  // - royalClanBankruptcy (宗室崩溃)

  // ═════════════════════════════════════════════════════════════
  // 8. 主 tick（每回合调用）
  // ═════════════════════════════════════════════════════════════

  function tick(context) {
    var mr = (context && context._monthRatio) || getMonthRatio();
    if (context) context._linkageMonthRatio = mr;

    // 按区域分账（对接财政）
    try {
      // 若有 mapData，按城市/区域分账
      var regions = [];
      if (GM.mapData && GM.mapData.cities) {
        regions = Object.keys(GM.mapData.cities).map(function(id) {
          return { id: id, population: GM.mapData.cities[id].population || 10000 };
        });
      }
      if (regions.length > 0 && GM.guoku) {
        var totalPop = regions.reduce(function(s, r) { return s + r.population; }, 0) || 1;
        var monthlyNominal = (GM.guoku.annualIncome || 1e6) / 12;
        regions.forEach(function(reg) {
          var share = reg.population / totalPop;
          allocateRegionTax(reg.id, monthlyNominal * share, mr);
        });
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] regionAllocation:') : console.error('[linkage] regionAllocation:', e); }

    // 发俸禄
    try { paySalariesToOfficials(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] salaries:') : console.error('[linkage] salaries:', e); }

    // 贪腐分配
    try { distributeIllicitIncome(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] illicit:') : console.error('[linkage] illicit:', e); }

    // 下拨单进度
    try { processTransferOrders(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] transfers:') : console.error('[linkage] transfers:', e); }

    // 民心反馈（基于 peasantBurden 聚合）
    try { applyBurdenToMinxin(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'linkage] burdenMinxin:') : console.error('[linkage] burdenMinxin:', e); }
  }

  // 民心受百姓负担影响
  function applyBurdenToMinxin(mr) {
    if (!GM.minxin || !GM.fiscal || !GM.fiscal.peasantBurden) return;
    var burdens = Object.values(GM.fiscal.peasantBurden);
    if (burdens.length === 0) return;
    // 平均加派率
    var avgLevy = 0;
    burdens.forEach(function(b) {
      var total = (b.levyLevels.county || 0) + (b.levyLevels.prefecture || 0) +
                  (b.levyLevels.province || 0) + (b.levyLevels.landlord || 0) +
                  (b.levyLevels.converter || 0);
      avgLevy += total;
    });
    avgLevy /= burdens.length;

    // 加派 > 0.3 开始显著扣民心
    if (avgLevy > 0.3) {
      var impact = -(avgLevy - 0.3) * 4 * mr;
      GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex + impact);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.EconomyLinkage = {
    tick: tick,
    ensurePeasantBurden: ensurePeasantBurden,
    calcPeasantBurden: calcPeasantBurden,
    ensureRegionFiscal: ensureRegionFiscal,
    allocateRegionTax: allocateRegionTax,
    createTransferOrder: createTransferOrder,
    processTransferOrders: processTransferOrders,
    paySalariesToOfficials: paySalariesToOfficials,
    distributeIllicitIncome: distributeIllicitIncome,
    triggerConfiscationByName: triggerConfiscationByName,
    applyBurdenToMinxin: applyBurdenToMinxin,
    EventBus: EconomyEventBus
  };

  // 全局事件总线（其他系统也可用）
  global.EconomyEventBus = EconomyEventBus;

  console.log('[econLinkage] 已加载：层层剥夺+区域财政树+下拨生命周期+俸禄流+贪腐流+抄家触发+事件总线');

})(typeof window !== 'undefined' ? window : this);
