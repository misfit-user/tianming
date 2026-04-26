// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 帑廪 P0 补完模块
// 依赖：tm-guoku-engine.js
// 实现：
//   - §21.2 民心→帑廪 顺从度
//   - §21.3 皇权→帑廪 可支配性（权臣段地方截留/专制段压榨）
//   - §21.4 皇威→帑廪 暴君段账面虚增
//   - §21.5 帑廪→民心 赋税反馈
//   - 决策 G 地域分账（byRegion）
//   - 决策 A 粮/布流水完整
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  if (typeof GuokuEngine === 'undefined') {
    console.warn('[guoku-p2] GuokuEngine 未加载');
    return;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  // ═════════════════════════════════════════════════════════════
  // §21.2 民心顺从度 — 扩展 computeTaxFlow
  // ═════════════════════════════════════════════════════════════

  var _origComputeTaxFlow = GuokuEngine.computeTaxFlow;
  GuokuEngine.computeTaxFlow = function(annualNominal) {
    var base = _origComputeTaxFlow.call(this, annualNominal);

    // 民心顺从度
    var compliance = 1.0;
    if (GM.minxin) {
      var m = safe(GM.minxin.trueIndex, 50);
      compliance = Math.max(0.3, m / 100 * 0.7 + 0.3);
    }

    // 皇权可支配性
    var huangquanMult = 1.0;
    if (GM.huangquan) {
      var h = safe(GM.huangquan.index, 50);
      if (h < 35) huangquanMult = 0.5;       // 权臣段：地方截留 50%
      else if (h < 60) huangquanMult = 0.85;
      else if (h > 80) huangquanMult = 1.05;  // 专制段：压榨略增（但有副作用）
    }

    // 更新 actualReceived
    base.actualReceived = base.actualReceived * compliance * huangquanMult;
    base.compliance = compliance;
    base.huangquanMult = huangquanMult;
    return base;
  };

  // ═════════════════════════════════════════════════════════════
  // §21.4 皇威暴君段账面虚增 + 民间浮收暴涨
  // ═════════════════════════════════════════════════════════════

  function applyTyrantFiscalDistortion(mr) {
    if (!GM.huangwei || !GM.guoku) return;
    if (GM.huangwei.index < 90) return;

    // 账面虚增（地方争相报"超额完成"）
    var monthlyIncome = GM.guoku.monthlyIncome || 0;
    var bubble = monthlyIncome * 0.15 * mr;
    GM.guoku.balance += bubble;

    // 记录到暴君综合症隐藏代价
    if (GM.huangwei.tyrantSyndrome && GM.huangwei.tyrantSyndrome.hiddenDamage) {
      GM.huangwei.tyrantSyndrome.hiddenDamage.fiscalBubble =
        (GM.huangwei.tyrantSyndrome.hiddenDamage.fiscalBubble || 0) + bubble;
    }

    // 民间浮收率暴涨（对民心的额外负向）
    if (!GM.fiscal) GM.fiscal = {};
    GM.fiscal.floatingCollectionRate = (GM.fiscal.floatingCollectionRate || 0) + 0.08 * mr;
  }

  // ═════════════════════════════════════════════════════════════
  // §21.5 赋税反馈 → 民心
  // ═════════════════════════════════════════════════════════════

  function applyTaxMinxinFeedback(mr) {
    if (!GM.minxin || !GM.guoku) return;
    var g = GM.guoku;
    // 民间实缴 = 月入 × (1 + 浮收率) × mr
    var overCollect = (GM.fiscal && GM.fiscal.floatingCollectionRate) || 0;
    var monthlyPeasantPaid = g.monthlyIncome * (1 + overCollect) * mr;

    // 民间支付能力（基于户口规模）
    var regTotal = safe((GM.hukou || {}).registeredTotal, 10000000);
    var ability = regTotal * 0.01 * mr;  // 月人均 0.01 两

    if (ability <= 0) return;
    var ratio = monthlyPeasantPaid / ability;

    var impact = 0;
    if (ratio > 1.0) {
      // 超负荷征收 → 民心跌（非线性）
      impact = -Math.pow(ratio - 1, 1.5) * 5 * mr;
    } else if (ratio < 0.7) {
      // 轻税 → 民心缓升
      impact = 2 * (0.7 - ratio) * mr;
    }

    if (Math.abs(impact) > 0.1) {
      GM.minxin.trueIndex = clamp(GM.minxin.trueIndex + impact, 0, 100);
    }

    // 浮收率缓慢衰减（否则永久增长）
    if (GM.fiscal && GM.fiscal.floatingCollectionRate > 0) {
      GM.fiscal.floatingCollectionRate = Math.max(0, GM.fiscal.floatingCollectionRate - 0.02 * mr);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 决策 G 地域分账
  // 使用 GM.mapData.cities 作为区域单元；若无，用默认"全境"单元
  // ═════════════════════════════════════════════════════════════

  function getRegions() {
    // 优先：mapData.cities（每城一个区域）
    if (GM.mapData && GM.mapData.cities) {
      return Object.keys(GM.mapData.cities).map(function(cid) {
        var c = GM.mapData.cities[cid];
        return { id: cid, name: c.name || cid, population: c.population || 0 };
      });
    }
    // 回退：单一全境
    return [{ id: 'national', name: '全境', population: safe((GM.hukou||{}).registeredTotal, 1e7) }];
  }

  function updateRegionalAccounts(mr, totalMonthlyIncome, totalMonthlyExpense) {
    if (!GM.guoku.byRegion) GM.guoku.byRegion = {};

    // ★ 优先：从 adminHierarchy 顶级 division 的 fiscal.ledgers 真实聚合（cascade 已写入实际值）
    //   旧法按人口均分 monthlyIncome → 同等人口区域显示完全相同数字（5 区 -4w/-6w 一模一样 bug）
    if (GM.adminHierarchy && GM._lastCascadeTurn === GM.turn) {
      var seen = {};
      Object.keys(GM.adminHierarchy).forEach(function(fkey) {
        var tree = GM.adminHierarchy[fkey];
        ((tree && tree.divisions) || []).forEach(function(div) {
          if (!div || !div.fiscal || !div.fiscal.ledgers || !div.fiscal.ledgers.money) return;
          var led = div.fiscal.ledgers.money;
          var key = div.id || div.name;
          if (!key) return;
          seen[key] = true;
          if (!GM.guoku.byRegion[key]) {
            GM.guoku.byRegion[key] = { name: div.name || key, stock: 0, lastIn: 0, lastOut: 0, cumIn: 0, cumOut: 0 };
          }
          var acc = GM.guoku.byRegion[key];
          acc.name = div.name || key;
          acc.stock = led.stock || 0;
          acc.lastIn = led.thisTurnIn || 0;
          acc.lastOut = led.thisTurnOut || 0;
          acc.cumIn = (acc.cumIn || 0) + (led.thisTurnIn || 0);
          acc.cumOut = (acc.cumOut || 0) + (led.thisTurnOut || 0);
        });
      });
      // 移除老的（mapData.cities-based）旧条目，避免春秋诸城残留
      Object.keys(GM.guoku.byRegion).forEach(function(k) {
        if (!seen[k] && k !== 'national') delete GM.guoku.byRegion[k];
      });
      return;
    }

    // ─── Legacy fallback：cascade 未跑·按人口均分 ───
    var regions = getRegions();
    var totalPop = 0;
    regions.forEach(function(r) { totalPop += r.population || 1; });
    if (totalPop === 0) totalPop = 1;

    // 按人口加权分配全国月入/月支到各区
    regions.forEach(function(r) {
      var share = (r.population || 1) / totalPop;
      if (!GM.guoku.byRegion[r.id]) {
        GM.guoku.byRegion[r.id] = {
          name: r.name,
          stock: share * (GM.guoku.balance || 0),
          lastIn: 0, lastOut: 0,
          cumIn: 0, cumOut: 0
        };
      }
      var acc = GM.guoku.byRegion[r.id];
      var regIn = totalMonthlyIncome * share * mr;
      var regOut = totalMonthlyExpense * share * mr;
      acc.lastIn = regIn;
      acc.lastOut = regOut;
      acc.stock += (regIn - regOut);
      acc.cumIn += regIn;
      acc.cumOut += regOut;
    });

    // 移除地图已删除的区域
    var activeIds = {};
    regions.forEach(function(r) { activeIds[r.id] = true; });
    Object.keys(GM.guoku.byRegion).forEach(function(id) {
      if (!activeIds[id] && id !== 'national') delete GM.guoku.byRegion[id];
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 决策 A 粮/布流水完整
  // ═════════════════════════════════════════════════════════════

  function updateGrainClothFlow(mr) {
    var g = GM.guoku;
    if (!g.ledgers) return;

    // ★ 若 cascade 已为本回合写入 grain/cloth 真实流水（FixedExpense 已扣俸禄/军饷），跳过 legacy 近似覆盖
    //   旧代码会用 (junxiang*0.6/10) 这类 approximation 全量覆盖 grain.sinks/cloth.sinks，
    //   把 FixedExpense 写好的 俸禄/军饷 detail 抹掉，只剩零头·导致面板"军粮 2万"远远小于 thisTurnOut 181万
    if (GM._lastCascadeTurn === GM.turn) {
      // 仍写历史快照（基于已正确的 lastTurn 字段）
      var grainL = g.ledgers.grain, clothL = g.ledgers.cloth;
      if (grainL) {
        grainL.history = grainL.history || [];
        grainL.history.push({ turn: GM.turn, in: grainL.lastTurnIn || grainL.thisTurnIn || 0, out: grainL.lastTurnOut || grainL.thisTurnOut || 0, stock: grainL.stock });
        if (grainL.history.length > 40) grainL.history = grainL.history.slice(-40);
      }
      if (clothL) {
        clothL.history = clothL.history || [];
        clothL.history.push({ turn: GM.turn, in: clothL.lastTurnIn || clothL.thisTurnIn || 0, out: clothL.lastTurnOut || clothL.thisTurnOut || 0, stock: clothL.stock });
        if (clothL.history.length > 40) clothL.history = clothL.history.slice(-40);
      }
      return;
    }

    // ─── Legacy fallback：cascade 未跑·走老 approximation ───
    // ─ 粮 ─
    var grain = g.ledgers.grain;
    // 田赋部分以粮征（约 30%）
    var tianfu = (g.sources || {}).tianfu || 0;
    var grainFromTax = tianfu * 0.3 / 10;  // 粮价约 10 两/石
    // 漕粮直接征粮
    var caoliang = (g.sources || {}).caoliang || 0;
    var grainFromCao = caoliang / 10;
    // 粮入
    var grainIn = (grainFromTax + grainFromCao) * mr / 12;

    // 粮支：军粮、赈济、俸禄一部分
    var junxiang = (g.expenses || {}).junxiang || 0;
    var zhenzi = (g.expenses || {}).zhenzi || 0;
    var fenglu = (g.expenses || {}).fenglu || 0;
    var grainForJun = junxiang * 0.6 / 10;  // 60% 军饷以粮支
    var grainForZhen = zhenzi * 0.7 / 10;   // 70% 赈济以粮支
    var grainForBosu = fenglu * 0.2 / 10;   // 20% 俸禄以粮支
    var grainOut = (grainForJun + grainForZhen + grainForBosu) * mr / 12;

    grain.lastTurnIn = Math.round(grainIn);
    grain.lastTurnOut = Math.round(grainOut);
    grain.stock = Math.max(0, (grain.stock || 0) + grainIn - grainOut);
    grain.sources = {
      田赋: Math.round(grainFromTax / 12 * mr),
      漕粮: Math.round(grainFromCao / 12 * mr)
    };
    grain.sinks = {
      军粮: Math.round(grainForJun / 12 * mr),
      赈济: Math.round(grainForZhen / 12 * mr),
      俸粮: Math.round(grainForBosu / 12 * mr)
    };

    // ─ 布 ─
    var cloth = g.ledgers.cloth;
    // 部分田赋/丁税以布征（约 15%）
    var dingshui = (g.sources || {}).dingshui || 0;
    var clothFromTax = (tianfu * 0.15 + dingshui * 0.2) / 5;  // 布约 5 两/匹
    var clothIn = clothFromTax * mr / 12;

    // 布支：赏赐、俸禄一小部分
    var shangci = (g.expenses || {}).shangci || 0;
    var clothForReward = shangci * 0.3 / 5;
    var clothForSalary = fenglu * 0.05 / 5;
    var clothOut = (clothForReward + clothForSalary) * mr / 12;

    cloth.lastTurnIn = Math.round(clothIn);
    cloth.lastTurnOut = Math.round(clothOut);
    cloth.stock = Math.max(0, (cloth.stock || 0) + clothIn - clothOut);
    cloth.sources = {
      田赋布: Math.round(tianfu * 0.15 / 5 / 12 * mr),
      丁税布: Math.round(dingshui * 0.2 / 5 / 12 * mr)
    };
    cloth.sinks = {
      赏赐: Math.round(clothForReward / 12 * mr),
      俸布: Math.round(clothForSalary / 12 * mr)
    };

    // 历史快照（最近 40 次）
    grain.history = grain.history || [];
    grain.history.push({ turn: GM.turn, in: grain.lastTurnIn, out: grain.lastTurnOut, stock: grain.stock });
    if (grain.history.length > 40) grain.history = grain.history.slice(-40);

    cloth.history = cloth.history || [];
    cloth.history.push({ turn: GM.turn, in: cloth.lastTurnIn, out: cloth.lastTurnOut, stock: cloth.stock });
    if (cloth.history.length > 40) cloth.history = cloth.history.slice(-40);
  }

  // ═════════════════════════════════════════════════════════════
  // 扩展 GuokuEngine.tick
  // ═════════════════════════════════════════════════════════════

  var _origTick = GuokuEngine.tick;
  GuokuEngine.tick = function(context) {
    // 先执行原 tick
    _origTick.call(this, context);

    var mr = (context && context._monthRatio) ||
             (typeof GuokuEngine.getMonthRatio === 'function' ? GuokuEngine.getMonthRatio() : 1);

    // P0 扩展
    try { applyTyrantFiscalDistortion(mr); }    catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku-p2] tyrant:') : console.error('[guoku-p2] tyrant:', e); }
    try { applyTaxMinxinFeedback(mr); }          catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku-p2] minxinFeedback:') : console.error('[guoku-p2] minxinFeedback:', e); }
    try {
      updateRegionalAccounts(mr,
        GM.guoku.monthlyIncome || 0,
        GM.guoku.monthlyExpense || 0);
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku-p2] regional:') : console.error('[guoku-p2] regional:', e); }
    try { updateGrainClothFlow(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku-p2] grainCloth:') : console.error('[guoku-p2] grainCloth:', e); }
  };

  // 暴露
  GuokuEngine.applyTyrantFiscalDistortion = applyTyrantFiscalDistortion;
  GuokuEngine.applyTaxMinxinFeedback = applyTaxMinxinFeedback;
  GuokuEngine.updateRegionalAccounts = updateRegionalAccounts;
  GuokuEngine.updateGrainClothFlow = updateGrainClothFlow;
  GuokuEngine.getRegions = getRegions;

  console.log('[guoku-p2] 加载：民心顺从度+皇权可支配+皇威虚账+赋税反馈+地域分账+粮布流水');

})(typeof window !== 'undefined' ? window : this);
