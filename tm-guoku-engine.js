// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-guoku-engine.js — 帑廪（国库）系统 · 核心引擎 (Phase 3 R9·5→2 LAYERED 链合并)
// Domain: 帑廪 / 国库 / 财政收入 / 改革税种 / 借贷 / 通胀 / 民心反馈
// Status: active · Last Updated: 2026-05-04 (Phase 3 R9·flat inline merge·吸 p2/p4/p5/p6)
// Owner: TM 团队
// Imports: GM·_getDaysPerTurn·NeitangEngine·EventBus·addEB·SettlementPipeline·_adjAuthority
// Exports: global.GuokuEngine (init/tick/yearly/computeTaxFlow/Sources/Expenses/junxiang/initFromDynasty/yearlySettle 等)
// Used by: tm-game-loop·tm-endturn-systems·tm-guoku-panel·smoke-guoku-* (8 smoke·121 assertions)
// Side effects: GM.guoku mutation·EventBus.emit·SettlementPipeline.register·_adjAuthority 调用 (民心/皇权/皇威 反馈)
// Test: smoke-guoku-* 8 项·121 assertions·R8 baseline 锁
// Notes: 设计方案-财政系统.md (决策 A-G + 补充 H-P)
//        本文件实现·8 类收入 (田赋/丁税/漕粮/专卖/市舶/榷税/捐纳/其他) + 8 类支出 (俸禄/军饷/赈济/工程/祭祀/赏赐/内廷/其他) + 腐败实征率联动 + 年度决算 + 破产/借贷 + daysPerTurn 缩放
//        Phase 3 R9 (2026-05-04·Claude)·flat inline merge·吸 tm-guoku-p2 (民心顺从度/皇权可支配/皇威虚账·332 行) + tm-guoku-p4 (改革/税种/单位/物价/AI诏令/铸币·440 行) + tm-guoku-p5 (LAYERED 5 层链第 4·OVERRIDE engine.tick·344 行) + tm-guoku-p6 (LAYERED 终端·329 行)·5→2 net -3 文件
//        Phase 3 R8 (2026-05-04)·8 smoke baseline 锁 (compute-tax-flow·tick-full-pass·sources-scenario-disabled·yearly-settle·init-from-dynasty·enact-reform·loan-and-bankruptcy·tax-flow-tyrant)·R9 merge 全程 zero regression
// ============================================================

(function(global) {
  'use strict';

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  // 民心走 MinxinLedger 总闸(2026-07-04 收口)：delta 落叶子+按源封顶。
  // 直写 GM.minxin.trueIndex 是死路——它只是聚合缓存·下次 aggregateTrue 按叶子人口加权重算即冲掉。
  function _mxApply(delta, reason, kind) {
    if (!delta) return;
    try {
      var L = (typeof TM !== 'undefined' && TM.MinxinLedger) || global.MinxinLedger;
      if (L && L.recordAndApply) L.recordAndApply(global.GM, { sourceSystem: 'guoku-engine', kind: kind || 'guokuFiscal', delta: delta, reason: reason });
    } catch (_e) {}
  }

  function getMonthRatio() {
    if (typeof _getDaysPerTurn === 'function') return _getDaysPerTurn() / 30;
    return 1;
  }

  var BANKRUPTCY_STAGES = [
    { stage:1, id:'cash_warning',       name:'帑廪告急',     event:'第一阶段：帑廪告急，支出逼近库底。' },
    { stage:2, id:'salary_arrears',     name:'欠俸积压',     event:'第二阶段：百官欠俸，廉耻渐薄。' },
    { stage:3, id:'emergency_borrowing',name:'举债续命',     event:'第三阶段：向商贾豪强举债，财政信用受损。' },
    { stage:4, id:'tax_credit_break',   name:'加派失信',     event:'第四阶段：加派与拖欠并行，民间不信朝廷财计。' },
    { stage:5, id:'army_pay_break',     name:'军饷断裂',     event:'第五阶段：军饷断绝，营伍骚动。' },
    { stage:6, id:'relief_failure',     name:'赈济断裂',     event:'第六阶段：赈济不继，灾荒转为民变。' },
    { stage:7, id:'fiscal_collapse',    name:'财政崩溃',     event:'第七阶段：财政崩溃，皇权与皇威皆被动摇。' }
  ];

  function _bankruptcyStageDef(stage) {
    return BANKRUPTCY_STAGES[Math.max(1, Math.min(7, stage)) - 1] || BANKRUPTCY_STAGES[0];
  }

  function _ensureBankruptcyState(g) {
    if (!g.bankruptcy) g.bankruptcy = {};
    var b = g.bankruptcy;
    if (typeof b.active !== 'boolean') b.active = false;
    if (typeof b.consecutiveMonths !== 'number') b.consecutiveMonths = 0;
    if (typeof b.severity !== 'number') b.severity = 0;
    if (typeof b.stage !== 'number') b.stage = b.active ? Math.max(1, Math.round((b.severity || 0) * 4)) : 0;
    if (!Array.isArray(b.history)) b.history = [];
    if (!b.effects) b.effects = {};
    if (!Array.isArray(b.effects.appliedStageIds)) b.effects.appliedStageIds = [];
    b.stateMachine = true;
    if (b.stage > 0) {
      var def = _bankruptcyStageDef(b.stage);
      b.stageId = def.id;
      b.stageName = def.name;
    } else {
      b.stageId = 'stable';
      b.stageName = '财政平稳';
    }
    return b;
  }

  // ═════════════════════════════════════════════════════════════
  // 数据模型保障
  // ═════════════════════════════════════════════════════════════

  function ensureGuokuModel() {
    if (!GM.guoku) GM.guoku = {};
    var g = GM.guoku;
    if (g.balance === undefined) g.balance = 1000000;
    if (g.monthlyIncome === undefined) g.monthlyIncome = 80000;
    if (g.monthlyExpense === undefined) g.monthlyExpense = 75000;
    if (g.annualIncome === undefined) g.annualIncome = g.monthlyIncome * 12;
    if (g.lastDelta === undefined) g.lastDelta = 0;
    if (g.trend === undefined) g.trend = 'stable';
    if (g.actualTaxRate === undefined) g.actualTaxRate = 1.0;

    if (!g.ledgers) g.ledgers = {};
    ['money','grain','cloth'].forEach(function(k) {
      if (!g.ledgers[k]) {
        g.ledgers[k] = { stock:0, lastTurnIn:0, lastTurnOut:0,
                         sources:{}, sinks:{}, history:[] };
      }
      if (g.ledgers[k].history === undefined) g.ledgers[k].history = [];
    });
    // 同步 money.stock 与 balance
    if (g.ledgers.money.stock === 0 && g.balance !== 0) g.ledgers.money.stock = g.balance;

    if (!g.unit) g.unit = { money:'两', grain:'石', cloth:'匹' };
    if (!g.sources) g.sources = { tianfu:0, dingshui:0, caoliang:0, yanlizhuan:0,
                                  shipaiShui:0, quanShui:0, juanNa:0, qita:0,
                                  mining:0, fishingTax:0 };
    if (!g.expenses) g.expenses = { fenglu:0, junxiang:0, zhenzi:0, gongcheng:0,
                                    jisi:0, shangci:0, neiting:0, qita:0 };
    if (!g.sourcesDetail) g.sourcesDetail = {};   // ★ 大类下挂的子项·按 division 公式拆分
    if (!g.expensesDetail) g.expensesDetail = {}; // ★ 同上
    if (!g.bankruptcy) g.bankruptcy = { active:false, consecutiveMonths:0, severity:0 };
    _ensureBankruptcyState(g);
    if (!g.emergency) g.emergency = { extraTax:{active:false,rate:0},
                                       loan:{active:false,amount:0,monthsLeft:0} };
    if (!g.history) g.history = { monthly:[], yearly:[], events:[] };
  }

  // ═════════════════════════════════════════════════════════════
  // 八类收入计算
  // ═════════════════════════════════════════════════════════════

  // 取 CascadeTax 全国汇总·若不可用退回户口估算
  function _sumEB(field, fallback) {
    if (typeof CascadeTax !== 'undefined' && CascadeTax.sumEconomyBase) {
      var v = CascadeTax.sumEconomyBase(field);
      if (v > 0) return v;
    }
    return fallback || 0;
  }
  function _setSubs(category, subItems) {
    if (!GM.guoku) return;
    if (!GM.guoku.sourcesDetail) GM.guoku.sourcesDetail = {};
    GM.guoku.sourcesDetail[category] = subItems;
  }
  function _setSubsExp(category, subItems) {
    if (!GM.guoku) return;
    if (!GM.guoku.expensesDetail) GM.guoku.expensesDetail = {};
    GM.guoku.expensesDetail[category] = subItems;
  }

  var Sources = {
    // 田赋·按 division.farmland 求和（公式：farmland × landTaxRate × actualTaxRate）
    tianfu: function() {
      var hukou = GM.hukou || {};
      var regTotal = safe(hukou.registeredTotal, 10000000);
      // 全国总耕地（亩）·退化兜底=人口×0.3 户均田
      var totalFarmland = _sumEB('farmland', regTotal * 0.3);
      var landTaxRate = (GM.policies && GM.policies.landTaxRate) || 0.04;  // 4% 田税
      var taxMult = (hukou.taxRateMultiplier || 1);
      var actualRate = safe((GM.guoku || {}).actualTaxRate, 1);
      var total = totalFarmland * landTaxRate * taxMult * actualRate;
      _setSubs('tianfu', [
        { id: 'tianfu_main', name: '田赋·正赋', amount: Math.round(total * 0.9), note: totalFarmland.toFixed(0) + ' 亩 × ' + landTaxRate },
        { id: 'tianfu_addon', name: '田赋·附加(漕水分摊)', amount: Math.round(total * 0.1) }
      ]);
      return total;
    },
    // 丁税（人头税）—— 仍按全国丁口（hukou 已有 ding 数据）
    dingshui: function() {
      var hukou = GM.hukou || {};
      var regTotal = safe(hukou.registeredTotal, 10000000);
      var dingCount = safe(hukou.ding, regTotal * 0.25);
      var pollTax = (GM.policies && GM.policies.pollTaxPerCapita) || 0.03;
      var actualRate = safe((GM.guoku || {}).actualTaxRate, 1);
      var total = dingCount * pollTax * actualRate;
      _setSubs('dingshui', [
        { id: 'ding_yin', name: '丁银', amount: Math.round(total), note: dingCount.toFixed(0) + ' 丁 × ' + pollTax }
      ]);
      return total;
    },
    // 漕粮（折银）—— 漕粮按户口估算（漕户）·绝对量与户口正相关
    caoliang: function() {
      var regTotal = safe((GM.hukou || {}).registeredTotal, 10000000);
      var grainPrice = ((GM.currency || {}).market && GM.currency.market.grainPrice) || 100;
      var grainAmount = regTotal * 0.005;  // 漕粮石数 ~人口×0.5%
      var actualRate = safe((GM.guoku || {}).actualTaxRate, 1);
      var total = grainAmount * grainPrice / 100 * actualRate;  // 折银 × 实征率
      _setSubs('caoliang', [
        { id: 'caoliang_grain', name: '漕粮(本色)', amount: Math.round(total * 0.6), note: grainAmount.toFixed(0) + ' 石' },
        { id: 'caoliang_zhe', name: '漕粮折银', amount: Math.round(total * 0.4) }
      ]);
      return total;
    },
    // 专卖·盐铁茶酒（盐课按 saltProduction 求和；其余按人口估算）
    yanlizhuan: function() {
      var monopolyActive = (GM.policies || {}).monopolyActive !== false;
      if (!monopolyActive) { _setSubs('yanlizhuan', []); return 0; }
      var hukou = GM.hukou || {};
      var regTotal = safe(hukou.registeredTotal, 10000000);
      // 盐课：按全国 saltProduction 求和（产盐区有·普通区为 0）
      var saltProd = _sumEB('saltProduction', 0);
      var saltPrice = (GM.policies && GM.policies.saltPrice) || 0.05;  // 单价 文/斤
      var saltRate = (GM.policies && GM.policies.saltTaxRate) || 0.40; // 盐课税率
      var saltTax = saltProd * saltPrice * saltRate;
      // 若 saltProduction 全为 0（剧本未配产盐区），退化按人口
      if (saltProd <= 0) saltTax = regTotal * 0.015;
      // 茶酒铁·人口估算
      var teaWine = regTotal * 0.005;
      var ironTax = regTotal * 0.005;
      var actualRate = safe((GM.guoku || {}).actualTaxRate, 1);
      saltTax *= actualRate; teaWine *= actualRate; ironTax *= actualRate;
      var total = saltTax + teaWine + ironTax;
      _setSubs('yanlizhuan', [
        { id: 'yan_ke', name: '盐课', amount: Math.round(saltTax), note: saltProd > 0 ? saltProd.toFixed(0) + ' 斤产' : '人口估' },
        { id: 'cha_jiu', name: '茶酒课', amount: Math.round(teaWine) },
        { id: 'tie_ke', name: '铁课', amount: Math.round(ironTax) }
      ]);
      return total;
    },
    // 市舶（港口海关）—— 按 division.maritimeTradeVolume 求和（hasPort 为前提）
    shipaiShui: function() {
      var maritimeTotal = _sumEB('maritimeTradeVolume', 0);
      // 退化：若 division 没配·读旧字段
      if (maritimeTotal <= 0) {
        if (!GM.hasMaritimePort) { _setSubs('shipaiShui', []); return 0; }
        maritimeTotal = safe(GM.maritimeTradeVolume, 0);
      }
      var maritimeRate = (GM.policies && GM.policies.maritimeTaxRate) || 0.08;
      var actualRate = safe((GM.guoku || {}).actualTaxRate, 1);
      var total = maritimeTotal * maritimeRate * actualRate;
      _setSubs('shipaiShui', [
        { id: 'shi_bo', name: '市舶税', amount: Math.round(total), note: maritimeTotal.toFixed(0) + ' 海贸量' }
      ]);
      return total;
    },
    // 榷税（关津+城商）—— 按 division.commerceVolume 求和
    quanShui: function() {
      var commerceTotal = _sumEB('commerceVolume', 0);
      var hukou = GM.hukou || {};
      var regTotal = safe(hukou.registeredTotal, 10000000);
      // 退化：若 division 没配·按户口估
      if (commerceTotal <= 0) commerceTotal = regTotal * 0.05;
      var commerceRate = (GM.policies && GM.policies.commerceTaxRate) || 0.03;
      var actualRate = safe((GM.guoku || {}).actualTaxRate, 1);
      var total = commerceTotal * commerceRate * actualRate;
      _setSubs('quanShui', [
        { id: 'guan_jin', name: '关津税', amount: Math.round(total * 0.5), note: commerceTotal.toFixed(0) + ' 商业量' },
        { id: 'cheng_shang', name: '城商税', amount: Math.round(total * 0.5) }
      ]);
      return total;
    },
    // 捐纳（卖官）·事件触发型
    juanNa: function() {
      if (!GM.juanna || !GM.juanna.active) { _setSubs('juanNa', []); return 0; }
      var total = (GM.juanna.monthlyIncome || 0) * 12;
      _setSubs('juanNa', [
        { id: 'juan_guan', name: '捐官·实纳', amount: Math.round(total) }
      ]);
      return total;
    },
    // ★ 矿冶·新增类·按 division.mineralProduction 求和（mineralRegion）
    mining: function() {
      var mineralTotal = _sumEB('mineralProduction', 0);
      var mineralRate = (GM.policies && GM.policies.mineralTaxRate) || 0.20;
      var miningTax = mineralTotal * mineralRate;
      // 铸钱息（若货币系统启用）·按粗估
      var mintBonus = 0;
      if (GM.currency && GM.currency.mintAgency && GM.currency.mintAgency.active) {
        mintBonus = mineralTotal * 0.05;  // 5% 铸钱息
      }
      var actualRate = safe((GM.guoku || {}).actualTaxRate, 1);
      miningTax *= actualRate; mintBonus *= actualRate;
      var total = miningTax + mintBonus;
      _setSubs('mining', [
        { id: 'kuang_shui', name: '矿税', amount: Math.round(miningTax), note: mineralTotal.toFixed(0) + ' 两产' },
        { id: 'zhu_qian_xi', name: '铸钱息', amount: Math.round(mintBonus) }
      ]);
      return total;
    },
    // ★ 渔课·新增类·按 division.fishingProduction 求和（fishingRegion）
    fishingTax: function() {
      var fishingTotal = _sumEB('fishingProduction', 0);
      var fishingRate = (GM.policies && GM.policies.fishingTaxRate) || 0.10;
      var actualRate = safe((GM.guoku || {}).actualTaxRate, 1);
      var total = fishingTotal * fishingRate * actualRate;
      _setSubs('fishingTax', [
        { id: 'yu_ke', name: '渔课', amount: Math.round(total), note: fishingTotal.toFixed(0) + ' 两产' }
      ]);
      return total;
    },
    // 其他（杂项）
    qita: function() {
      var total = safe((GM.guoku || {}).otherIncome, 0);
      _setSubs('qita', [
        { id: 'qita_yu', name: '杂项', amount: Math.round(total) }
      ]);
      return total;
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 八类支出计算
  // ═════════════════════════════════════════════════════════════

  var Expenses = {
    // 俸禄·5 档分类（文/武/吏员/宗藩/致仕）
    fenglu: function() {
      var officialCount = safe(GM.totalOfficials, (GM.chars || []).length * 3);
      var avgSalary = safe((GM.officialSalary || {}).avg, 80);
      var reformMult = 1;
      if (GM.corruption && GM.corruption.countermeasures &&
          GM.corruption.countermeasures.salaryReform > 0) {
        reformMult = 1 + GM.corruption.countermeasures.salaryReform * 0.5;
      }
      var baseTotal = officialCount * avgSalary * 12 * reformMult;
      // 宗藩世禄·按 GM.imperialClan.princeCount 算·每王年禄米折银 ~ 1万
      var princeCount = (GM.imperialClan && GM.imperialClan.princeCount) || 0;
      if (princeCount === 0) princeCount = Math.max(20, Math.floor(officialCount * 0.05)); // 默认 5%
      var clanStipend = princeCount * 10000;  // 王禄·宗禄·郡王禄
      // 致仕官半俸·按 0.05 比例
      var retireStipend = Math.round(baseTotal * 0.05);
      var total = baseTotal + clanStipend + retireStipend;
      _setSubsExp('fenglu', [
        { id: 'salary_civil', name: '文官俸禄', amount: Math.round(baseTotal * 0.50), note: Math.floor(officialCount*0.6) + ' 员' },
        { id: 'salary_military', name: '武官俸饷', amount: Math.round(baseTotal * 0.30) },
        { id: 'salary_clerk', name: '吏员工食', amount: Math.round(baseTotal * 0.20), note: '胥吏/差役' },
        { id: 'salary_clan', name: '宗藩世禄', amount: clanStipend, note: princeCount + ' 王/郡王' },
        { id: 'salary_retire', name: '致仕恩俸', amount: retireStipend, note: '半俸' }
      ]);
      return total;
    },
    // 军饷·按兵种分类·扣减国产马抵扣的战马支出
    junxiang: function() {
      var central = 0, frontier = 0, garrison = 0, navy = 0;
      (GM.armies || []).forEach(function(a) {
        var size = a.size || 0;
        var type = a.armyType || '';
        if (/禁|京营/.test(type)) central += size;
        else if (/边|镇|藩/.test(type)) frontier += size;
        else if (/水师/.test(type)) navy += size;
        else garrison += size;
      });
      var totalSoldiers = central + frontier + garrison + navy;
      if (totalSoldiers === 0) {
        var hukou = GM.hukou || {};
        totalSoldiers = safe(hukou.registeredTotal, 10000000) * 0.01;
        garrison = totalSoldiers;  // 默认全归"地方守备"
      }
      // 单兵年饷·按兵种差异
      var costCentral = central * 18;     // 京营月粮高
      var costFrontier = frontier * 15;   // 边军
      var costGarrison = garrison * 10;   // 守备
      var costNavy = navy * 16;           // 水师
      // 空额吃饷：在册兵=实兵+空额，朝廷按在册发饷·腐败越高空额越多
      var ghostRate = 0;
      try {
        if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.Consequences) {
          ghostRate = CorruptionEngine.Consequences.calcMilitaryGhostRate() || 0;
        }
      } catch(_){}
      var ghostBase = costCentral + costFrontier + costGarrison + costNavy;
      var ghostExtra = ghostBase * ghostRate;
      // 战马军器·扣减国产马（horseProduction 抵扣 20 两/匹）
      var armsBase = totalSoldiers * 5;   // 单兵年均 5 两
      var horseDomestic = _sumEB('horseProduction', 0) * 20;
      var costArms = Math.max(0, armsBase - horseDomestic);
      // 三饷加派（明末崇祯特征·辽饷/剿饷/练饷）·剧本可单独激活每项
      var threeFees = 0;
      var threeFeesNote = [];
      var pol = GM.policies || {};
      if (pol.liaoXiang) { var lx = pol.liaoXiangAmount || 5200000; threeFees += lx; threeFeesNote.push('辽 ' + Math.round(lx/10000) + '万'); }
      if (pol.jiaoXiang) { var jx = pol.jiaoXiangAmount || 3300000; threeFees += jx; threeFeesNote.push('剿 ' + Math.round(jx/10000) + '万'); }
      if (pol.lianXiang) { var lnx = pol.lianXiangAmount || 7300000; threeFees += lnx; threeFeesNote.push('练 ' + Math.round(lnx/10000) + '万'); }
      // 武学训练·小项
      var wuxue = totalSoldiers * 0.5;  // 0.5两/兵·年
      // 营葬犒赏·按近期阵亡数（兜底小额）
      var battleBonus = (GM.guoku && GM.guoku._battleCasualtyBonus) || 0;
      var total = costCentral + costFrontier + costGarrison + costNavy + ghostExtra + costArms + threeFees + wuxue + battleBonus;
      _setSubsExp('junxiang', [
        { id: 'army_central', name: '京营月粮', amount: Math.round(costCentral), note: central + ' 兵' },
        { id: 'army_frontier', name: '边军协济', amount: Math.round(costFrontier), note: frontier + ' 兵' },
        { id: 'army_garrison', name: '地方守备', amount: Math.round(costGarrison), note: garrison + ' 兵' },
        { id: 'army_navy', name: '水师', amount: Math.round(costNavy), note: navy + ' 兵' },
        { id: 'army_ghost', name: '空额吃饷', amount: Math.round(ghostExtra), note: ghostRate > 0 ? '兵部腐 ' + Math.round(ghostRate*100) + '% 虚冒' : '无' },
        { id: 'army_arms_horse', name: '战马军器', amount: Math.round(costArms), note: horseDomestic > 0 ? '国产抵 ' + Math.round(horseDomestic) : '' },
        { id: 'army_threefee', name: '三饷加派', amount: Math.round(threeFees), note: threeFees > 0 ? threeFeesNote.join('/') : '未派' },
        { id: 'army_wuxue', name: '武学训练', amount: Math.round(wuxue) },
        { id: 'army_casualty', name: '营葬犒赏', amount: Math.round(battleBonus), note: battleBonus > 0 ? '阵亡抚恤' : '' }
      ]);
      return total;
    },
    // 赈济·按灾害类型分类（旱/水/瘟/蝗/其他）
    zhenzi: function() {
      var disasters = GM.activeDisasters || [];
      var byType = { drought: 0, flood: 0, plague: 0, locust: 0, other: 0 };
      var unitCost = { drought: 80000, flood: 100000, plague: 60000, locust: 50000, other: 70000 };
      disasters.forEach(function(d) {
        var t = d && d.type ? String(d.type).toLowerCase() : 'other';
        if (/(旱|drought)/.test(t)) byType.drought++;
        else if (/(水|洪|flood)/.test(t)) byType.flood++;
        else if (/(瘟|疫|plague)/.test(t)) byType.plague++;
        else if (/(蝗|locust)/.test(t)) byType.locust++;
        else byType.other++;
      });
      var subs = [];
      if (byType.drought) subs.push({ id: 'relief_drought', name: '旱灾赈济', amount: byType.drought * unitCost.drought, note: byType.drought + ' 处' });
      if (byType.flood) subs.push({ id: 'relief_flood', name: '水灾赈济', amount: byType.flood * unitCost.flood, note: byType.flood + ' 处' });
      if (byType.plague) subs.push({ id: 'relief_plague', name: '瘟疫赈抚', amount: byType.plague * unitCost.plague, note: byType.plague + ' 处' });
      if (byType.locust) subs.push({ id: 'relief_locust', name: '蝗灾赈济', amount: byType.locust * unitCost.locust, note: byType.locust + ' 处' });
      if (byType.other) subs.push({ id: 'relief_other', name: '其他灾赈', amount: byType.other * unitCost.other, note: byType.other + ' 处' });
      // 流民安置·按全国 fugitives 人户
      var fugitives = (GM.hukou && GM.hukou.fugitives) || 0;
      if (fugitives > 0) {
        var migCost = Math.round(fugitives * 1.2);  // 单户安置 1.2 两
        subs.push({ id: 'relief_migrants', name: '流民安置', amount: migCost, note: fugitives + ' 户·路费/口粮' });
      }
      // 平籴常平·年常项
      var pingdi = 30000;
      subs.push({ id: 'relief_pingdi', name: '常平平籴', amount: pingdi, note: '丰年贱买/荒年贱卖' });
      _setSubsExp('zhenzi', subs);
      return subs.reduce(function(s, x) { return s + x.amount; }, 0);
    },
    // 工程·按 lumpSumIncidents 分类（河工/城防/大工）
    gongcheng: function() {
      var subs = { river: 0, city: 0, grand: 0 };
      var lsi = (GM.corruption && GM.corruption.lumpSumIncidents) || [];
      lsi.forEach(function(inc) {
        if (inc.status === 'active' && inc.amount && inc.expectedDuration) {
          var monthly = inc.amount / inc.expectedDuration * 12;
          var cat = (inc.category || inc.name || '');
          if (/河|漕|水/.test(cat)) subs.river += monthly;
          else if (/城|墙|防/.test(cat)) subs.city += monthly;
          else subs.grand += monthly;
        }
      });
      // 漕渠维护·年常项·按全国 postRelays 部分支出
      var postRelaysG = (typeof CascadeTax !== 'undefined' && CascadeTax.sumEconomyBase) ?
        CascadeTax.sumEconomyBase('postRelays') : 0;
      var caoQu = Math.max(50000, postRelaysG * 30);  // 漕路驿站维护
      // 宫殿太庙修缮·常项
      var palace = 30000;
      // 长城边墙修补·若激活边备
      var greatWall = (GM.policies && GM.policies.frontierFortify) ? 80000 : 20000;
      // 工程质量折扣 → 同效益需多花钱（豆腐渣 → 重修/返工）
      var quality = 1, qualityMult = 1;
      try {
        if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.Consequences) {
          quality = CorruptionEngine.Consequences.calcConstructionQuality() || 1;
          qualityMult = quality > 0.5 ? (1 / quality) : 2;  // cap at 2x
        }
      } catch(_){}
      var qualityBase = subs.river + subs.city + subs.grand + caoQu + palace + greatWall;
      var qualityExtra = qualityBase * (qualityMult - 1);  // 多花的部分
      var total = qualityBase + qualityExtra;
      // 记录到 GM.guoku 供下游消费（城防有效率/河工抗洪率等）
      if (GM.guoku) GM.guoku._constructionQuality = quality;
      _setSubsExp('gongcheng', [
        { id: 'work_river', name: '河工漕渠', amount: Math.round(subs.river), note: '黄/淮水患' },
        { id: 'work_city', name: '城防工程', amount: Math.round(subs.city) },
        { id: 'work_grand', name: '大工陵寝', amount: Math.round(subs.grand), note: '陵殿/敕建' },
        { id: 'work_caoqu', name: '漕渠维护', amount: Math.round(caoQu), note: '岁修常项' },
        { id: 'work_palace', name: '宫殿太庙修缮', amount: palace },
        { id: 'work_greatwall', name: '长城边墙', amount: greatWall, note: greatWall > 50000 ? '强化边备' : '维持' },
        { id: 'work_quality', name: '豆腐渣返工', amount: Math.round(qualityExtra), note: quality < 1 ? '工部腐·质 ' + Math.round(quality*100) + '%' : '无' }
      ]);
      return total;
    },
    // 祭祀·5 项（太常/大祀/月祀/释奠/帝陵）
    jisi: function() {
      var yearly = 20000;  // 太常岁祭固定
      var grand = safe((GM.guoku || {})._thisYearGrandRitual, 0);  // 大祀触发
      var monthly = 8000;  // 月祀祠+节庆祀年支
      var shidian = 6000;  // 太学释奠(春秋两次祀孔)
      // 帝陵岁祭·按 GM.imperialClan.tombsCount 算
      var tombs = (GM.imperialClan && GM.imperialClan.tombsCount) || 12;
      var lingji = tombs * 1500;  // 单陵岁祭 1500 两
      var total = yearly + grand + monthly + shidian + lingji;
      _setSubsExp('jisi', [
        { id: 'ritual_yearly', name: '太常岁祭', amount: yearly },
        { id: 'ritual_grand', name: '大祀(南郊/祭天)', amount: grand, note: grand > 0 ? '本年举办' : '未举' },
        { id: 'ritual_monthly', name: '月祀节庆', amount: monthly, note: '社稷/方泽/朝日' },
        { id: 'ritual_shidian', name: '太学释奠', amount: shidian, note: '春秋祀孔' },
        { id: 'ritual_lingji', name: '帝陵岁祭', amount: lingji, note: tombs + ' 陵' }
      ]);
      return total;
    },
    // 赏赐·5 项（大臣/蒙藏/节庆/战功/其他）
    shangci: function() {
      var budget = safe((GM.guoku || {}).rewardBudget, 50000);
      var courtier = Math.round(budget * 0.45);
      var minority = Math.round(budget * 0.18);
      var festival = Math.round(budget * 0.20);  // 元旦/冬至/万寿三大节
      var battle = safe((GM.guoku || {})._battleReward, 0);  // 战功犒赏·事件触发
      var other = budget - courtier - minority - festival;
      var total = budget + battle;
      _setSubsExp('shangci', [
        { id: 'reward_courtier', name: '大臣赏', amount: courtier, note: '袍服/银币/玉带' },
        { id: 'reward_minority', name: '蒙藏王公赏', amount: minority, note: '羁縻笼络' },
        { id: 'reward_festival', name: '节庆颁赐', amount: festival, note: '三大节' },
        { id: 'reward_battle', name: '战功犒赏', amount: battle, note: battle > 0 ? '近捷' : '无战功' },
        { id: 'reward_other', name: '其他赏赐', amount: other, note: '婚嫁/经筵/朝贡使' }
      ]);
      return total;
    },
    // 内廷转运·拆三本色（银/粮/布）
    neiting: function() {
      if (!GM.neitang) { _setSubsExp('neiting', []); return 0; }
      var g = GM.guoku || {};
      var rate = safe(g.neicangTransferRate, 0.01);
      var silverAmt = rate * 12 * safe(g.monthlyIncome, 80000) * 0.7;
      var grainAmt = safe(g.monthlyGrainIncome, 0) * 12 * 0.05;
      var clothAmt = safe(g.monthlyClothIncome, 0) * 12 * 0.05;
      var total = silverAmt + grainAmt + clothAmt;
      _setSubsExp('neiting', [
        { id: 'transfer_silver', name: '解送银', amount: Math.round(silverAmt) },
        { id: 'transfer_grain', name: '解送粮(折银)', amount: Math.round(grainAmt) },
        { id: 'transfer_cloth', name: '解送布(折银)', amount: Math.round(clothAmt) }
      ]);
      return total;
    },
    // 其他·拆 教育科举(用 kejuQuota) / 驿递站银(用 postRelays) / 杂支
    qita: function() {
      // 教育科举·按全国 kejuQuota 求和 × 单生开销
      var kejuQuota = (typeof CascadeTax !== 'undefined' && CascadeTax.sumEconomyBase) ?
        CascadeTax.sumEconomyBase('kejuQuota') : 0;
      var eduCost = kejuQuota * 50;  // 单生 50 两(路费+程仪+卷纸)·年
      // 当前正在举办大考时额外开销
      if (GM.P && GM.P.keju && GM.P.keju.currentExam) eduCost += 30000;
      // 驿递站银·按全国 postRelays × 站银
      var postRelays = (typeof CascadeTax !== 'undefined' && CascadeTax.sumEconomyBase) ?
        CascadeTax.sumEconomyBase('postRelays') : 0;
      var postCost = postRelays * 200;  // 单驿年银 200 两
      if (postCost === 0) postCost = 30000;  // 无配置兜底
      // 杂支兜底
      var miscCost = safe((GM.guoku || {}).otherExpense, 0);
      // 救荒社仓·按全国户数粗估（100 户一仓，年支 0.5 两）
      var householdsTotal = (GM.hukou && GM.hukou.households) || 0;
      if (householdsTotal === 0) householdsTotal = (GM.hukou && GM.hukou.registeredTotal) || 10000000;
      if (householdsTotal > 1e8) householdsTotal = householdsTotal / 5;  // 防止误传 mouths
      var sheCang = Math.round(householdsTotal / 100 * 0.5);
      // 修史印典·年常支
      var xiushi = 15000;  // 史馆+印书+律例
      // 翻译通事·四夷馆+鸿胪寺
      var translation = 8000;
      var total = eduCost + postCost + miscCost + sheCang + xiushi + translation;
      _setSubsExp('qita', [
        { id: 'edu_keju', name: '教育科举', amount: Math.round(eduCost), note: kejuQuota + ' 解额' },
        { id: 'guard_yi', name: '驿递站银', amount: Math.round(postCost), note: postRelays + ' 驿' },
        { id: 'shecang', name: '社仓救荒', amount: sheCang, note: Math.round(householdsTotal/100/10000) + '万仓' },
        { id: 'xiushi', name: '修史印典', amount: xiushi, note: '史馆+律例+颁布' },
        { id: 'translation', name: '四夷馆通事', amount: translation, note: '鸿胪寺' },
        { id: 'misc_other', name: '杂支兜底', amount: Math.round(miscCost) }
      ]);
      return total;
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 三数对照（与腐败联动）
  // ═════════════════════════════════════════════════════════════

  function computeTaxFlow(annualNominal) {
    // 腐败漏损率
    var leakageRate = 0;
    var overCollectRate = 0;
    if (GM.corruption && typeof CorruptionEngine !== 'undefined' && CorruptionEngine.Consequences) {
      var rate = CorruptionEngine.Consequences.calcActualTaxRate();  // 实征率
      leakageRate = 1 - rate;
      var fc = (GM.corruption.subDepts.fiscal || {}).true || 0;
      var pc = (GM.corruption.subDepts.provincial || {}).true || 0;
      overCollectRate = (fc + pc) / 200 * 0.5;
    }
    // 养廉银 → 浮收率减
    if (GM.corruption && GM.corruption.countermeasures && GM.corruption.countermeasures.salaryReform > 0) {
      overCollectRate *= (1 - GM.corruption.countermeasures.salaryReform * 0.4);
    }

    // 通胀购买力系数·grainPrice 越高·购买力越低（实征银两的实际购买力衰减）
    var purchasingPower = 1.0;
    var grainIdx = (GM.currency && GM.currency.market && GM.currency.market.grainPrice) ||
                   (GM.prices && GM.prices.grain) || 1.0;
    purchasingPower = Math.max(0.5, 1 / Math.max(0.7, grainIdx));

    // ── p2 inline (R9a 2026-05-04)·民心顺从度 + 皇权可支配性 ──
    var compliance = 1.0;
    if (GM.minxin) {
      var m = safe(GM.minxin.trueIndex, 50);
      compliance = Math.max(0.3, m / 100 * 0.7 + 0.3);
    }
    var huangquanMult = 1.0;
    if (GM.huangquan) {
      var h = safe(GM.huangquan.index, 50);
      if (h < 35) huangquanMult = 0.5;       // 权臣段·地方截留 50%
      else if (h < 60) huangquanMult = 0.85;
      else if (h > 80) huangquanMult = 1.05;  // 专制段·压榨略增
    }

    return {
      nominal: annualNominal,
      actualReceived: annualNominal * (1 - leakageRate) * purchasingPower * compliance * huangquanMult,
      peasantPaid: annualNominal * (1 + overCollectRate),
      leakageRate: leakageRate,
      overCollectRate: overCollectRate,
      purchasingPower: purchasingPower,
      compliance: compliance,
      huangquanMult: huangquanMult
    };
  }

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
          // 扣账不打负·落0+记欠(与 deductFromLedger 同语义)——旧写法直打负余额·同一国库账里
          // 年例欠账走负余额而俸饷欠账走 deficit·破产判据双轨不一致(2026-07-04 审查定罪)
          var _have = Number(ledger.stock) || 0;
          var _ded = Math.min(_have, amount);
          var _short = amount - _ded;
          ledger.stock = _have - _ded;
          ledger.thisTurnOut = (Number(ledger.thisTurnOut) || 0) + _ded;
          ledger.sinks[label] = (Number(ledger.sinks[label]) || 0) + _ded;
          if (_short > 0) {
            ledger.sinks[label + '_欠'] = (Number(ledger.sinks[label + '_欠']) || 0) + _short;
            ledger.deficit = (Number(ledger.deficit) || 0) + _short;
          }
          if (resource === 'money') result.moneyOut += _ded;
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
    ensureGuokuModel();
    var g = GM.guoku;

    // 计算八源年度名义收入
    var totalIncomeAnnual = 0;
    var sourceBreakdown = {};
    for (var k in Sources) {
      var v = 0;
      try { v = Sources[k]() || 0; } catch(e) { v = 0; }
      sourceBreakdown[k] = v;
      totalIncomeAnnual += v;
    }

    // 腐败漏损
    var flow = computeTaxFlow(totalIncomeAnnual);
    g.actualTaxRate = 1 - flow.leakageRate;
    // ★ 若 cascade 已为本回合写入 thisTurnIn → 已设置真实 annualIncome（按 turnFracOfYear 推算），不要用八源公式覆盖
    // 2026-06-11·补 GM.turn-1:endturn 里 cascade(SubTickRunner)跑在 GM.turn++ 之前(_lastCascadeTurn=旧回合)·
    //   monthlySettle 在自增后跑·旧检测 _lastCascadeTurn===GM.turn 必假→误落八源 fallback 覆盖月入(治「过回合月入96万·读档才正常」)。
    //   load 路 cascade 跑时 GM.turn 未变·仍走第一条件·不受影响。
    var _cascadeRanForIncome = (GM._lastCascadeTurn === GM.turn) || (GM._lastCascadeTurn === (GM.turn - 1)) ||
                               (g.ledgers && g.ledgers.money && (g.ledgers.money.thisTurnIn || 0) > 0);
    if (!_cascadeRanForIncome) {
      g.annualIncome = Math.round(flow.actualReceived);
      g.monthlyIncome = Math.round(g.annualIncome / 12);
    }

    // 计算八类支出
    var totalExpenseAnnual = 0;
    var expBreakdown = {};
    for (var e in Expenses) {
      var ev = 0;
      try { ev = Expenses[e]() || 0; } catch(err) { ev = 0; }
      expBreakdown[e] = ev;
      totalExpenseAnnual += ev;
    }
    g.monthlyExpense = Math.round(totalExpenseAnnual / 12);

    // ★ 央地财政正确衔接（防止 CascadeTax/FixedExpense 写入被覆盖）
    var cascadeRanThisTurn = (GM._lastCascadeTurn === GM.turn) || (GM._lastCascadeTurn === (GM.turn - 1)) || ((g.ledgers.money.thisTurnIn || 0) > 0);
    var fixedRanThisTurn = (GM._lastFixedExpenseTurn === GM.turn);
    var oldBalance = g.balance || 0;
    var periodIn, periodOut;
    if (cascadeRanThisTurn) {
      // ✓ 正确路径：cascade 已写入 thisTurnIn·FixedExpense 已扣 fenglu/junxiang/neiting → ledger.stock 当前已含两者
      periodIn = g.ledgers.money.thisTurnIn || 0;
      // monthlySettle 只补 residual 5 类（赈济/工程/祭祀/赏赐/其他）·neiting 由 FixedExpense / NeitangEngine 处理
      var residualMap = {
        zhenzi: { label: '赈济', amount: expBreakdown.zhenzi || 0 },
        gongcheng: { label: '工程', amount: expBreakdown.gongcheng || 0 },
        jisi: { label: '祭祀', amount: expBreakdown.jisi || 0 },
        shangci: { label: '赏赐', amount: expBreakdown.shangci || 0 },
        qita: { label: '其他', amount: expBreakdown.qita || 0 }
      };
      // 若 FixedExpense 未跑·neiting 也归 residual
      if (!fixedRanThisTurn) residualMap.neiting = { label: '内廷转运', amount: expBreakdown.neiting || 0 };
      periodOut = 0;
      if (!g.ledgers.money.sinks) g.ledgers.money.sinks = {};
      // 累加 residual 到 stock + thisTurnOut + sinks（不覆盖 FixedExpense 写入的 俸禄/军饷/宫廷）
      Object.keys(residualMap).forEach(function(catKey) {
        var item = residualMap[catKey];
        var thisTurnAmt = (item.amount / 12) * mr;
        if (thisTurnAmt > 0) {
          periodOut += thisTurnAmt;
          g.ledgers.money.sinks[item.label] = (g.ledgers.money.sinks[item.label] || 0) + thisTurnAmt;
        }
      });
      g.ledgers.money.stock = (g.ledgers.money.stock || 0) - periodOut;
      g.ledgers.money.thisTurnOut = (g.ledgers.money.thisTurnOut || 0) + periodOut;
      g.balance = g.ledgers.money.stock;
    } else {
      // ✗ Fallback·cascade 未跑·走老逻辑
      periodIn = g.monthlyIncome * mr;
      periodOut = g.monthlyExpense * mr;
      g.balance = oldBalance + periodIn - periodOut;
      g.ledgers.money.stock = g.balance;
      g.ledgers.money.thisTurnIn = periodIn;
      g.ledgers.money.thisTurnOut = periodOut;
      // 老逻辑下 sinks 全覆盖·且按 this-turn 单位写(annual/12*mr) 与 thisTurnOut 对齐
      var _factor = mr / 12;
      g.ledgers.money.sinks = {
        俸禄: Math.round((expBreakdown.fenglu || 0) * _factor),
        军饷: Math.round((expBreakdown.junxiang || 0) * _factor),
        赈济: Math.round((expBreakdown.zhenzi || 0) * _factor),
        工程: Math.round((expBreakdown.gongcheng || 0) * _factor),
        祭祀: Math.round((expBreakdown.jisi || 0) * _factor),
        赏赐: Math.round((expBreakdown.shangci || 0) * _factor),
        内廷转运: Math.round((expBreakdown.neiting || 0) * _factor),
        其他: Math.round((expBreakdown.qita || 0) * _factor)
      };
    }
    // ★ lastDelta 用 ledger 真实净变(thisTurnIn - thisTurnOut)·避免漏算 FixedExpense 已扣的俸禄/军饷/宫廷
    if (cascadeRanThisTurn) {
      g.lastDelta = (g.ledgers.money.thisTurnIn || 0) - (g.ledgers.money.thisTurnOut || 0);
      // ★ turnExpense 同步真实 ledger.thisTurnOut(含 FixedExpense + residual)·避免 widget/抽屉/史记 只见 FixedExpense 那部分
      g.turnExpense = Math.round(g.ledgers.money.thisTurnOut || 0);
    } else {
      g.lastDelta = periodIn - periodOut;
    }

    // 2026-06-11·显示对齐 cascade 真账:从权威 ledger(cascade 已写真实 thisTurnIn·FixedExpense+residual 已写 thisTurnOut)反算
    //   显示用月入月支(= thisTurn/mr·数学上等价 cascade fiscal-engine:1283/1729 与 load 后的值)·彻底治「过回合月入96万/月支170万·读档才正常」。
    //   仅 cascade 真跑过(本回合或刚结束回合)且确有进项时执行·fallback(cascade 未跑)保持原八源/八类显示。
    if (cascadeRanThisTurn && mr > 0 && (g.ledgers.money.thisTurnIn || 0) > 0) {
      g.monthlyIncome = Math.round((g.ledgers.money.thisTurnIn || 0) / mr);
      g.monthlyExpense = Math.round((g.ledgers.money.thisTurnOut || 0) / mr);
      g.annualIncome = Math.round(g.monthlyIncome * 12);
    }
    // 趋势
    var threshold = g.annualIncome * 0.01;
    g.trend = g.lastDelta > threshold ? 'up' :
              g.lastDelta < -threshold ? 'down' : 'stable';

    // 更新分项（存储本回合的细项）
    g.sources = sourceBreakdown;
    g.expenses = expBreakdown;

    // 同步 lastTurn·分项细目（display 用）
    g.ledgers.money.lastTurnIn = periodIn;
    g.ledgers.money.lastTurnOut = periodOut;
    // sources 处理：若 cascade 已跑·保留其 per-tax this-turn 写入(中文/英文混合 key OK)·panel 用 _tagNameMap 翻译
    // 若 fallback 路径·写 this-turn amounts (annual/12*mr)·与 thisTurnIn 单位一致
    if (!cascadeRanThisTurn) {
      var _factorIn = mr / 12;  // annual → this-turn
      g.ledgers.money.sources = {
        田赋: Math.round((sourceBreakdown.tianfu || 0) * _factorIn),
        丁税: Math.round((sourceBreakdown.dingshui || 0) * _factorIn),
        漕粮: Math.round((sourceBreakdown.caoliang || 0) * _factorIn),
        专卖: Math.round((sourceBreakdown.yanlizhuan || 0) * _factorIn),
        市舶: Math.round((sourceBreakdown.shipaiShui || 0) * _factorIn),
        榷税: Math.round((sourceBreakdown.quanShui || 0) * _factorIn),
        捐纳: Math.round((sourceBreakdown.juanNa || 0) * _factorIn),
        矿冶: Math.round((sourceBreakdown.mining || 0) * _factorIn),
        渔课: Math.round((sourceBreakdown.fishingTax || 0) * _factorIn),
        其他: Math.round((sourceBreakdown.qita || 0) * _factorIn)
      };
    }

    var recurringFiscal = _applyRecurringFiscalEntries(g, mr);
    if (recurringFiscal.moneyIn || recurringFiscal.moneyOut) {
      periodIn += recurringFiscal.moneyIn;
      periodOut += recurringFiscal.moneyOut;
      g.lastDelta = (g.ledgers.money.thisTurnIn || 0) - (g.ledgers.money.thisTurnOut || 0);
      g.turnIncome = Math.round(g.ledgers.money.thisTurnIn || periodIn);
      g.turnExpense = Math.round(g.ledgers.money.thisTurnOut || periodOut);
      g.ledgers.money.lastTurnIn = periodIn;
      g.ledgers.money.lastTurnOut = periodOut;
      var _finalThreshold = g.annualIncome * 0.01;
      g.trend = g.lastDelta > _finalThreshold ? 'up' :
                g.lastDelta < -_finalThreshold ? 'down' : 'stable';
    }
    g.money = g.balance;
    if (g.ledgers && g.ledgers.money) g.ledgers.money.stock = g.balance;

    // 历史快照
    g.history.monthly.push({
      turn: GM.turn, balance: g.balance,
      income: g.monthlyIncome, expense: g.monthlyExpense, delta: g.lastDelta
    });
    if (g.history.monthly.length > 120) g.history.monthly = g.history.monthly.slice(-120);

    // 破产检查
    checkBankruptcy(mr);

    // 借款月付（legacy 2%/月）——新账 emergency.loans[] 存在时由 processLoansMonthly 本息摊还·
    // 此腿须让位：takeLoanBySource 双写新旧账·两腿同扣曾令一笔借款每月双重还款(+24%·2026-07-04 审查定罪)
    var _newLoansActive = Array.isArray(g.emergency.loans) && g.emergency.loans.length > 0;
    if (!_newLoansActive && g.emergency.loan.active && g.emergency.loan.monthsLeft > 0) {
      var payment = (g.emergency.loan.amount || 0) * 0.02 * mr;  // 本息 2%/月
      g.balance -= payment;
      g.emergency.loan.monthsLeft -= mr;
      if (g.emergency.loan.monthsLeft <= 0) {
        g.emergency.loan.active = false;
        g.emergency.loan.amount = 0;
        if (typeof addEB === 'function') addEB('朝代', '借贷已还清', { credibility: 'high' });
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 破产检查
  // ═════════════════════════════════════════════════════════════

  function _bankruptcyTargetStage(g, b) {
    var annual = Math.max(1, safe(g.annualIncome, safe(g.monthlyIncome, 80000) * 12));
    var deficitRatio = Math.max(0, -(g.balance || 0) / annual);
    var delta = safe(g.lastDelta, safe(g.monthlyIncome, 0) - safe(g.monthlyExpense, 0));
    var expensePressure = Math.max(0, (safe(g.monthlyExpense, 0) - safe(g.monthlyIncome, 0)) / Math.max(1, safe(g.monthlyIncome, annual / 12)));
    var byRatio = deficitRatio >= 1.05 ? 6 :
      deficitRatio >= 0.75 ? 5 :
      deficitRatio >= 0.50 ? 4 :
      deficitRatio >= 0.25 ? 3 :
      deficitRatio >= 0.10 ? 2 :
      (g.balance < 0 || delta < -annual * 0.02 || expensePressure > 0.35) ? 1 : 0;
    var byMonths = b.consecutiveMonths >= 8 ? 7 :
      b.consecutiveMonths >= 6 ? 6 :
      b.consecutiveMonths >= 5 ? 5 :
      b.consecutiveMonths >= 4 ? 4 :
      b.consecutiveMonths >= 3 ? 3 :
      b.consecutiveMonths >= 2 ? 2 :
      b.consecutiveMonths >= 1 ? 1 : 0;
    if (deficitRatio >= 1.0 && b.consecutiveMonths >= 6) byRatio = Math.max(byRatio, 7);
    if (deficitRatio >= 1.5 && b.consecutiveMonths >= 4) byRatio = Math.max(byRatio, 7);
    return Math.max(byRatio, byMonths);
  }

  function _pushBankruptcyHistory(b, def, direction) {
    b.history.push({
      turn: GM.turn || 0,
      stage: def ? def.stage : 0,
      stageId: def ? def.id : 'stable',
      stageName: def ? def.name : '财政平稳',
      direction: direction || 'advance',
      balance: GM.guoku && GM.guoku.balance || 0,
      severity: b.severity || 0,
      consecutiveMonths: b.consecutiveMonths || 0
    });
    if (b.history.length > 80) b.history.splice(0, b.history.length - 80);
  }

  function _adjustAuthorityIndex(key, delta) {
    if (!delta || !GM[key]) return;
    if (typeof GM[key] === 'number') GM[key] = clamp(GM[key] + delta, 0, 100);
    else if (typeof GM[key].index === 'number') GM[key].index = clamp(GM[key].index + delta, 0, 100);
    else if (key === 'minxin' && typeof GM[key].trueIndex === 'number') GM[key].trueIndex = clamp(GM[key].trueIndex + delta, 0, 100);
  }

  function _applyBankruptcyStageEffects(def) {
    if (!def || !GM.guoku) return;
    var b = _ensureBankruptcyState(GM.guoku);
    if (b.effects.appliedStageIds.indexOf(def.id) >= 0) return;
    b.effects.appliedStageIds.push(def.id);
    if (!Array.isArray(b.effects.ledger)) b.effects.ledger = [];
    var row = { turn: GM.turn || 0, stage: def.stage, stageId: def.id, deltas: {} };

    if (def.stage === 1) {
      row.deltas.credit = -3;
      GM.guoku.fiscalCredit = clamp(safe(GM.guoku.fiscalCredit, 70) - 3, 0, 100);
    } else if (def.stage === 2) {
      if (GM.corruption && GM.corruption.sources) GM.corruption.sources.lowSalary = safe(GM.corruption.sources.lowSalary, 0) + 6;
      (GM.chars || []).forEach(function(ch) {
        if (ch && ch.alive !== false && typeof ch.loyalty === 'number' && ch.officialTitle) ch.loyalty = clamp(ch.loyalty - 1, 0, 100);
      });
      row.deltas.lowSalaryCorruption = 6;
    } else if (def.stage === 3) {
      GM.guoku.debtPressure = safe(GM.guoku.debtPressure, 0) + 0.12;
      _adjustAuthorityIndex('huangwei', -2);
      row.deltas.debtPressure = 0.12;
      row.deltas.huangwei = -2;
    } else if (def.stage === 4) {
      _adjustAuthorityIndex('minxin', -4);
      _adjustAuthorityIndex('huangwei', -3);
      if (!GM.guoku.extraTaxPressure) GM.guoku.extraTaxPressure = 0;
      GM.guoku.extraTaxPressure += 0.08;
      row.deltas.minxin = -4;
      row.deltas.huangwei = -3;
    } else if (def.stage === 5) {
      if (GM.military && typeof GM.military.morale === 'number') GM.military.morale = clamp(GM.military.morale - 8, 0, 100);
      (GM.armies || []).forEach(function(army) {
        if (!army) return;
        if (typeof army.morale === 'number') army.morale = clamp(army.morale - 6, 0, 100);
        if (typeof army.supply === 'number') army.supply = clamp(army.supply - 4, 0, 100);
      });
      _adjustAuthorityIndex('minxin', -3);
      row.deltas.armyMorale = -6;
      row.deltas.minxin = -3;
    } else if (def.stage === 6) {
      (GM.regions || []).forEach(function(r) {
        if (r && typeof r.unrest === 'number') r.unrest = clamp(r.unrest + 5, 0, 100);
      });
      _adjustAuthorityIndex('minxin', -6);
      row.deltas.regionalUnrest = 5;
      row.deltas.minxin = -6;
    } else if (def.stage === 7) {
      _adjustAuthorityIndex('huangquan', -8);
      _adjustAuthorityIndex('huangwei', -10);
      _adjustAuthorityIndex('minxin', -8);
      if (GM.huangwei && GM.huangwei.subDims && GM.huangwei.subDims.foreign) {
        GM.huangwei.subDims.foreign.value = clamp(GM.huangwei.subDims.foreign.value - 10, 0, 100);
      }
      (GM.regions || []).forEach(function(r) {
        if (r && typeof r.unrest === 'number') r.unrest = clamp(r.unrest + 8, 0, 100);
      });
      row.deltas.huangquan = -8;
      row.deltas.huangwei = -10;
      row.deltas.minxin = -8;
    }

    b.effects.ledger.push(row);
    if (b.effects.ledger.length > 80) b.effects.ledger.splice(0, b.effects.ledger.length - 80);
  }

  function _setBankruptcyStage(g, nextStage) {
    var b = _ensureBankruptcyState(g);
    nextStage = Math.max(0, Math.min(7, Math.round(nextStage || 0)));
    var oldStage = Math.max(0, Math.min(7, b.stage || 0));
    if (nextStage > oldStage) {
      for (var s = oldStage + 1; s <= nextStage; s++) {
        var def = _bankruptcyStageDef(s);
        b.stage = s;
        b.stageId = def.id;
        b.stageName = def.name;
        b.active = true;
        _pushBankruptcyHistory(b, def, 'advance');
        _applyBankruptcyStageEffects(def);
        if (typeof addEB === 'function') addEB('朝代', def.event, { credibility: 'high' });
      }
    } else if (nextStage < oldStage) {
      var def2 = nextStage > 0 ? _bankruptcyStageDef(nextStage) : null;
      b.stage = nextStage;
      b.stageId = def2 ? def2.id : 'stable';
      b.stageName = def2 ? def2.name : '财政平稳';
      b.active = nextStage > 0;
      _pushBankruptcyHistory(b, def2, 'recover');
      if (!b.active && typeof addEB === 'function') addEB('朝代', '帑廪渐充，财政危机解除', { credibility: 'high' });
    }
    return b;
  }

  function checkBankruptcy(mr) {
    var g = GM.guoku;
    if (!g) return;
    mr = (typeof mr === 'number' && isFinite(mr) && mr > 0) ? mr : 1;
    var b = _ensureBankruptcyState(g);
    var annual = Math.max(1, safe(g.annualIncome, safe(g.monthlyIncome, 80000) * 12));
    var inCrisis = (g.balance || 0) < 0 || (g.ledgers && g.ledgers.money && g.ledgers.money.deficit > 0);

    if (inCrisis) {
      b.recoveryMonths = 0;
      b.consecutiveMonths = (b.consecutiveMonths || 0) + mr;
      b.severity = Math.max(b.severity || 0, Math.abs(Math.min(0, g.balance || 0)) / annual);
      var nextStage = _bankruptcyTargetStage(g, b);
      _setBankruptcyStage(g, nextStage);
      if (b.consecutiveMonths > 6 && Math.random() < 0.05 * mr) triggerMutinyOrFamine();
    } else {
      b.recoveryMonths = (b.recoveryMonths || 0) + mr;
      b.consecutiveMonths = Math.max(0, (b.consecutiveMonths || 0) - mr * 1.5);
      b.severity = Math.max(0, (b.severity || 0) - 0.12 * mr);
      if ((b.stage || 0) > 0) _setBankruptcyStage(g, Math.max(0, (b.stage || 0) - Math.max(1, Math.floor(b.recoveryMonths || 1))));
      if ((b.stage || 0) <= 0) b.active = false;
    }
    return b;
  }

  function triggerBankruptcyEvent() {
    _setBankruptcyStage(GM.guoku, Math.max(1, (GM.guoku.bankruptcy && GM.guoku.bankruptcy.stage) || 1));
    if (typeof addEB === 'function') {
      addEB('朝代', '帑廪亏空，岁入不敷所出，财政危机!', { credibility: 'high' });
    }
    // 七连锁反应（见 设计方案-财政系统.md §21.10）
    if (GM.huangquan) {
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('idleGovern', -10, '\u56fd\u5e93\u7834\u4ea7\u52a8\u6447\u7687\u6743');
      } else {
        GM.huangquan.index = Math.max(0, GM.huangquan.index - 10);
      }
    }
    if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
      global.AuthorityEngines.adjustHuangwei('brokenPromise', -15, '国库破产·朝廷失信天下');
    } else if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 15); // 沙箱回退
    if (GM.corruption && GM.corruption.sources) {
      GM.corruption.sources.lowSalary = (GM.corruption.sources.lowSalary || 0) + 15;
    }
    if (GM.huangwei && GM.huangwei.subDims && GM.huangwei.subDims.foreign) {
      GM.huangwei.subDims.foreign.value = Math.max(0, GM.huangwei.subDims.foreign.value - 15);
    }
    GM.guoku.history.events.push({
      turn: GM.turn, type: 'bankruptcy', severity: GM.guoku.bankruptcy.severity
    });
  }

  function triggerMutinyOrFamine() {
    if (GM.activeWars && GM.activeWars.length > 0) {
      if (typeof addEB === 'function') addEB('军事', '军饷断绝，兵变四起', { credibility: 'high' });
      _mxApply(-10, '军饷断绝，兵变四起');
    }
    if (GM.activeDisasters && GM.activeDisasters.length > 0) {
      if (typeof addEB === 'function') addEB('朝代', '赈济不继，饥民暴起', { credibility: 'high' });
      _mxApply(-15, '赈济不继，饥民暴起', 'disasterRelief');
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 紧急措施（加派/借贷/开仓）
  // ═════════════════════════════════════════════════════════════

  // ═══ 天灾生命周期（治"activeDisasters 只 push 从不清除 → 国库每回合永久失血"）═══
  function _disasterCatCN(cat) {
    var c = String(cat || '').toLowerCase();
    if (/(旱|drought)/.test(c)) return '旱灾';
    if (/(水|洪|flood)/.test(c)) return '水灾';
    if (/(瘟|疫|plague)/.test(c)) return '瘟疫';
    if (/(蝗|locust)/.test(c)) return '蝗灾';
    if (/(震|quake|earthquake)/.test(c)) return '地震';
    return '灾异';
  }
  // 灾害历时：按灾种真实月数 → 回合(时间感知·经 turnsForMonths 随 daysPerTurn 换算)·夹 [1,12] 回合
  // (★呼应「涉时间阈值须匹配机制时间刻度」教训：不写死回合数·避免 1天/回合细刻度下灾害无限拖、365天/回合粗刻度下瞬消)
  function _disasterDurationTurns(cat) {
    var c = String(cat || '').toLowerCase();
    var months = /(瘟|疫|plague)/.test(c) ? 4 : /(旱|drought)/.test(c) ? 5 : /(蝗|locust)/.test(c) ? 3 : /(水|洪|flood)/.test(c) ? 2 : /(震|quake)/.test(c) ? 1 : 3;
    var t = (typeof turnsForMonths === 'function') ? turnsForMonths(months) : months;
    t = Math.round(t);
    return Math.max(1, Math.min(12, t || 1));
  }
  // 灾害派生信号:从在册天灾聚合 GM.vars.disasterLevel(0-1)/disasterType + GM.activeFamine —— 盘活 8+ 处既有【死输入】消费方
  //   (人口死亡率 huji:459·自耕农满意度 authority-complete:106·粮价 economy:570/992·水/旱赈济疏 edict-complete·
  //    饥荒迁移 huji-deep-fill:123·民变归因 prophecy·治安 edict-parser)·全代码零生产者→此前恒 0·各消费方自有阈值/夹幅(无新涟漪代码·忠于原设计)
  //   裸值存 GM.vars:全 Object.keys(GM.vars) 的 .value 写迭代(ai-infer/help-social)均 non-strict→对裸值静默 no-op(不被随机游走/危机乘子篡改·已核源文件 non-strict)·无灾即清防陈旧
  var _DISASTER_SEV = { minor:0.2, moderate:0.45, severe:0.7, catastrophic:0.95 };
  function _syncDisasterSignals(active) {
    if (typeof GM === 'undefined' || !GM) return;
    active = Array.isArray(active) ? active : [];
    if (!active.length) {
      if (GM.vars && GM.vars.disasterLevel) GM.vars.disasterLevel = 0;       // 仅曾设过时清·不无谓触碰
      if (GM.vars && GM.vars.disasterType) GM.vars.disasterType = '';
      if (GM.activeFamine) GM.activeFamine = false;
      return;
    }
    var maxSev = 0, worstCat = '';
    active.forEach(function(d) {
      if (!d) return;
      var sev = _DISASTER_SEV[String(d.severity || 'moderate').toLowerCase()];
      if (typeof sev !== 'number') sev = 0.45;
      if (sev > maxSev) { maxSev = sev; worstCat = String(d.category || d.type || ''); }
    });
    // 最重灾种主导(×0.7) + 多灾叠加(每多一处 +0.12·封顶 +0.3)·夹 [0,1]·单个 moderate≈0.32(刚过 0.3 阈值·轻)·severe≈0.49·灾退即随之回落
    var level = Math.max(0, Math.min(1, maxSev * 0.7 + Math.min(0.3, Math.max(0, active.length - 1) * 0.12)));
    if (!GM.vars) GM.vars = {};
    GM.vars.disasterLevel = Math.round(level * 100) / 100;
    GM.vars.disasterType = worstCat;   // 'drought'/'flood'/'plague'/…(供水/旱赈济疏 disasterType==='flood'/'drought' 判定)
    GM.activeFamine = level > 0.35 && /drought|locust|flood|旱|蝗|水|洪/.test(worstCat.toLowerCase());  // 饥荒:够重 + 旱/蝗/水类
  }
  // 每回合一次：到期灾害出队(已赈灾者寿命减半·更快平息)·返回平息数。治本"永不消除"。
  function tickDisasters() {
    if (typeof GM === 'undefined' || !GM) return 0;
    if (!Array.isArray(GM.activeDisasters) || !GM.activeDisasters.length) { _syncDisasterSignals([]); return 0; }  // 无灾:清陈旧派生信号(原早返回致 disasterLevel 永不归零)
    var now = GM.turn || 0, kept = [], passed = 0;
    GM.activeDisasters.forEach(function(d) {
      if (!d) return;
      var started = (d.startedTurn != null) ? d.startedTurn : (d._startedTurn || 0);
      var dur = (d.duration != null) ? d.duration : _disasterDurationTurns(d.category || d.type);
      var effDur = d._relieved ? Math.max(1, Math.ceil(dur / 2)) : dur; // 赈灾加速平息
      if ((now - started) >= effDur) {
        passed++;
        if (typeof addEB === 'function') { try { addEB('朝代', (d.region || '某地') + '·' + _disasterCatCN(d.category || d.type) + (d._relieved ? '·赈济得力，灾情渐息' : '·灾情渐息'), { credibility: 'high' }); } catch (_e) {} }
      } else { kept.push(d); }
    });
    GM.activeDisasters = kept;
    _syncDisasterSignals(kept);   // 在册天灾→派生 disasterLevel/disasterType/activeFamine(盘活既有消费方·灾退→kept 缩→level 回落→无灾清零)
    return passed;
  }

  var Actions = {
    // 加派（临时提高税率）
    extraTax: function(rate) {
      ensureGuokuModel();
      var g = GM.guoku;
      rate = clamp(rate || 0.3, 0, 1.0);
      g.emergency.extraTax.active = true;
      g.emergency.extraTax.rate = rate;
      // 立即效果：腐败+（地方乘机浮收）
      if (GM.corruption) {
        GM.corruption.sources.emergencyLevy = (GM.corruption.sources.emergencyLevy || 0) + rate * 10;
      }
      // 民心大损
      _mxApply(-(rate * 15), '加派' + Math.round(rate*100) + '%，民怨骤起', 'taxation');
      if (typeof addEB === 'function') addEB('朝代', '加派' + Math.round(rate*100) + '%，民怨骤起', { credibility: 'high' });
      return { success: true };
    },

    // 开仓放粮（紧急赈济）·region 可选(国赈全境/指定区赈该区/未指定赈全部在灾)
    openGranary: function(scale, region) {
      ensureGuokuModel();
      var g = GM.guoku;
      scale = scale || 'regional';
      var cost = scale === 'national' ? 500000 :
                 scale === 'regional' ? 150000 : 50000;
      if (g.balance < cost) return { success: false, reason: '帑廪不足' };
      g.balance -= cost;
      // 赈灾真挂钩灾害：按 scale/region 标记对应灾害已赈(tickDisasters 令其更快平息)·治"赈灾与灾害对象脱钩"
      var relieved = 0;
      if (Array.isArray(GM.activeDisasters)) {
        GM.activeDisasters.forEach(function(d) {
          if (!d) return;
          var hit = (scale === 'national') || !region || d.region === region;
          if (hit && !d._relieved) { d._relieved = true; d._reliefTurn = GM.turn || 0; relieved++; }
        });
      }
      // 民心回升：有灾可赈按 scale·无灾空赈减半(避免无灾刷民心)
      var minxinGain = scale === 'national' ? 15 :
                       scale === 'regional' ? 8 : 3;
      if (relieved === 0) minxinGain = Math.round(minxinGain / 2);
      _mxApply(minxinGain, '开仓赈济·民得食', 'disasterRelief');
      // 刀五·赈济→灾民回迁：开仓得食→流亡之民复归编户(减既有逃户池=釜底抽流寇之薪)。与刀B粮荒欠征(扣库粮)不同轴·非双算。
      //   不碰 hukou.fugitives(每回合由 aggregatePopulation 从叶子重算·改之无效)·只动 byLegalStatus 流亡池→编户(守恒·持久)。
      var resettled = 0;
      try {
        GM.population = GM.population || {};
        var _bls = GM.population.byLegalStatus = GM.population.byLegalStatus || {};
        var _tao = _bls.taoohu;
        if (_tao && (Number(_tao.mouths) || 0) > 0 && (relieved > 0 || scale === 'national')) {
          var _quota = scale === 'national' ? 200000 : scale === 'regional' ? 60000 : 20000;
          resettled = Math.min(Number(_tao.mouths) || 0, _quota);
          if (resettled > 0) {
            _tao.mouths = (Number(_tao.mouths) || 0) - resettled;
            var _hj = _bls.huangji || (_bls.huangji = { mouths: 0 });
            _hj.mouths = (Number(_hj.mouths) || 0) + resettled; // 守恒回编户
          }
        }
      } catch (_zhE) {}
      if (typeof addEB === 'function') addEB('朝代', '开仓赈济（' + scale + '）' + (relieved ? '·赈 ' + relieved + ' 处灾情' : '') + (resettled ? '·流民复业 ' + resettled : ''), { credibility: 'high' });
      return { success: true, relieved: relieved, resettled: resettled };
    },

    // 借贷（盐商/钱商/外国）
    takeLoan: function(amount, term) {
      ensureGuokuModel();
      var g = GM.guoku;
      amount = amount || 200000;
      term = term || 12;  // 默认12月
      g.balance += amount;
      g.emergency.loan.active = true;
      g.emergency.loan.amount = amount;
      g.emergency.loan.monthsLeft = term;
      // 皇威代价
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('brokenPromise', -3, '举债应急·有损天威');
      } else if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 3); // 沙箱回退
      if (typeof addEB === 'function') addEB('朝代', '借银 ' + Math.round(amount/10000) + ' 万两，限 ' + term + ' 月归还', { credibility: 'high' });
      return { success: true };
    },

    // 裁冗员（节流）
    cutOfficials: function(percent) {
      ensureGuokuModel();
      percent = percent || 0.1;  // 默认裁 10%
      if (!GM.totalOfficials) GM.totalOfficials = 500;
      var cut = Math.floor(GM.totalOfficials * percent);
      GM.totalOfficials -= cut;
      // 皇权代价（官员离心）
      if (GM.huangquan) {
        if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
          global.AuthorityEngines.adjustHuangquan('memorialObjection', -percent * 20, '\u88c1\u64a4\u5197\u5458\u5f15\u53d1\u5b98\u5458\u79bb\u5fc3');
        } else {
          GM.huangquan.index = Math.max(0, GM.huangquan.index - percent * 20);
        }
      }
      // 民心微升（节俭）
      _mxApply(2, '裁冗员省俸禄·朝廷示俭');
      if (typeof addEB === 'function') addEB('朝代', '裁冗员 ' + cut + ' 名，省俸禄', { credibility: 'high' });
      return { success: true };
    },

    // 减赋（长线惠民）
    reduceTax: function(percent) {
      ensureGuokuModel();
      percent = percent || 0.2;
      // 通过调整 taxRateMultiplier
      if (!GM.hukou) GM.hukou = {};
      GM.hukou.taxRateMultiplier = (GM.hukou.taxRateMultiplier || 1) * (1 - percent);
      _mxApply(percent * 30, '减税' + Math.round(percent*100) + '%·民困得纾', 'taxation');
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('benevolence', percent * 8, '减赋施仁');
      } else if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + percent * 8); // 沙箱回退
      if (typeof addEB === 'function') addEB('朝代', '减赋 ' + Math.round(percent*100) + '%，民感圣恩', { credibility: 'high' });
      return { success: true };
    },

    // 发行纸币（历代险招）
    issuePaperCurrency: function(amount) {
      ensureGuokuModel();
      amount = amount || 500000;
      GM.guoku.balance += amount;
      // 立即后果：通胀、皇威损
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('brokenPromise', -8, '滥发纸钞·钱法失信');
      } else if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 8); // 沙箱回退
      _mxApply(-5, '朝廷敛财应急·物议沸腾');
      // 粮价/物价浮动留 hook 给货币系统
      if (GM.currency) GM.currency.inflationPressure = (GM.currency.inflationPressure || 0) + amount / 1000000;
      if (typeof addEB === 'function') addEB('朝代', '发行纸钞 ' + Math.round(amount/10000) + ' 万，市面疑虑', { credibility: 'high' });
      return { success: true };
    }
  };

  // ═════════════════════════════════════════════════════════════
  // 年度决算
  // ═════════════════════════════════════════════════════════════

  function yearlySettle() {
    ensureGuokuModel();
    var g = GM.guoku;
    var year = (typeof getCurrentYear === 'function') ? getCurrentYear() : GM.turn;

    // 提取最近 12 月数据汇总
    var recent = g.history.monthly.slice(-12);
    var totalIn = 0, totalOut = 0;
    recent.forEach(function(m) { totalIn += m.income || 0; totalOut += m.expense || 0; });

    var archive = {
      year: year,
      totalIncome: totalIn,
      totalExpense: totalOut,
      netChange: totalIn - totalOut,
      finalBalance: g.balance,
      sources: Object.assign({}, g.sources),
      expenses: Object.assign({}, g.expenses),
      bankruptcyMonths: g.bankruptcy.consecutiveMonths,
      ledgers: {
        money: g.ledgers.money.stock,
        grain: g.ledgers.grain.stock,
        cloth: g.ledgers.cloth.stock
      }
    };
    g.history.yearly.push(archive);
    if (g.history.yearly.length > 40) g.history.yearly = g.history.yearly.slice(-40);
    if (typeof addEB === 'function') {
      var status = archive.netChange >= 0 ? '岁有余' : '岁亏';
      addEB('朝代', year + '年度决算：' + status + Math.round(Math.abs(archive.netChange)/10000) + '万两', {
        credibility: 'high'
      });
    }
    return archive;
  }

  // ═════════════════════════════════════════════════════════════
  // 朝代预设
  // ═════════════════════════════════════════════════════════════

  var DYNASTY_PRESETS = {
    '秦':   { founding:0.9, peak:1.3, decline:0.6, collapse:0.2 },
    '汉':   { founding:0.5, peak:1.6, decline:0.9, collapse:0.3 },
    '魏晋': { founding:0.8, peak:1.0, decline:0.6, collapse:0.2 },
    '唐':   { founding:1.2, peak:2.0, decline:1.0, collapse:0.3 },
    '五代': { founding:0.6, peak:0.7, decline:0.5, collapse:0.3 },
    '北宋': { founding:1.3, peak:2.2, decline:1.4, collapse:0.6 },
    '南宋': { founding:0.9, peak:1.5, decline:0.9, collapse:0.4 },
    '元':   { founding:1.1, peak:1.8, decline:0.8, collapse:0.3 },
    '明':   { founding:1.0, peak:1.8, decline:0.9, collapse:0.4 },
    '清':   { founding:1.2, peak:2.5, decline:1.3, collapse:0.5 },
    '上古': { founding:0.3, peak:0.5, decline:0.3, collapse:0.1 },
    '民国': { founding:0.8, peak:1.0, decline:0.6, collapse:0.3 }
  };

  var PHASE_INDEX = {
    founding:0, peak:1, decline:2, collapse:3,
    '开国':0, '全盛':1, '守成':1, '中衰':2, '末世':3, '衰落':2
  };

  function initFromDynasty(dynasty, phase, scenarioOverride) {
    ensureGuokuModel();
    var preset = DYNASTY_PRESETS[dynasty];
    if (!preset) {
      for (var k in DYNASTY_PRESETS) {
        if (dynasty && dynasty.indexOf(k) !== -1) { preset = DYNASTY_PRESETS[k]; break; }
      }
    }
    if (!preset) preset = { founding:0.5, peak:1.0, decline:0.6, collapse:0.3 };
    var phases = [preset.founding, preset.peak, preset.decline, preset.collapse];
    var pi = PHASE_INDEX[phase] !== undefined ? PHASE_INDEX[phase] : 1;
    var mult = phases[pi];

    // 基准：月入 8 万 × 乘数
    var baseIncome = 80000 * mult;
    GM.guoku.monthlyIncome = Math.round(baseIncome);
    GM.guoku.annualIncome = Math.round(baseIncome * 12);
    GM.guoku.monthlyExpense = Math.round(baseIncome * 0.95);  // 开销略低
    // 起始余额 = 6 月收入
    GM.guoku.balance = Math.round(baseIncome * 6);
    GM.guoku.ledgers.money.stock = GM.guoku.balance;

    // 剧本覆盖
    if (scenarioOverride && scenarioOverride.guoku) {
      var go = scenarioOverride.guoku;
      // 新字段：initialMoney/initialGrain/initialCloth（三列分账）
      if (go.initialMoney !== undefined) {
        GM.guoku.balance = go.initialMoney;
        GM.guoku.ledgers.money.stock = go.initialMoney;
      }
      if (go.initialGrain !== undefined) {
        GM.guoku.ledgers.grain.stock = go.initialGrain;
        GM.guoku.grain = go.initialGrain;
      }
      if (go.initialCloth !== undefined) {
        GM.guoku.ledgers.cloth.stock = go.initialCloth;
        GM.guoku.cloth = go.initialCloth;
      }
      // 配额
      if (go.quotaMoney !== undefined) GM.guoku.ledgers.money.quota = go.quotaMoney;
      if (go.quotaGrain !== undefined) GM.guoku.ledgers.grain.quota = go.quotaGrain;
      if (go.quotaCloth !== undefined) GM.guoku.ledgers.cloth.quota = go.quotaCloth;
      // 月均估计（仅占位：剧本 monthlyIncomeEstimate 是静态估算·真值由 cascadeCollect 活算）。
      // 守卫 _lastCascadeSummary：若已跑过真财政征收(开局/回合)则不让静态估算覆盖真活算值——
      //   根治「绍宋开局月入显估算 20万/旧兜底 7万·实应 ~70万」。无真 settle 时仍用估算占位。
      if (go.monthlyIncomeEstimate && !(typeof GM !== 'undefined' && GM && GM._lastCascadeSummary)) {
        if (go.monthlyIncomeEstimate.money != null) GM.guoku.monthlyIncome = go.monthlyIncomeEstimate.money;
        if (go.monthlyIncomeEstimate.grain != null) GM.guoku.monthlyGrainIncome = go.monthlyIncomeEstimate.grain;
        if (go.monthlyIncomeEstimate.cloth != null) GM.guoku.monthlyClothIncome = go.monthlyIncomeEstimate.cloth;
      }
      if (go.monthlyExpenseEstimate) {
        if (go.monthlyExpenseEstimate.money != null) GM.guoku.monthlyExpense = go.monthlyExpenseEstimate.money;
        if (go.monthlyExpenseEstimate.grain != null) GM.guoku.monthlyGrainExpense = go.monthlyExpenseEstimate.grain;
        if (go.monthlyExpenseEstimate.cloth != null) GM.guoku.monthlyClothExpense = go.monthlyExpenseEstimate.cloth;
      }
      // 兼容旧字段（balance/monthlyIncome 直接给）
      if (go.balance !== undefined)       { GM.guoku.balance = go.balance; GM.guoku.ledgers.money.stock = go.balance; }
      if (go.monthlyIncome !== undefined) GM.guoku.monthlyIncome = go.monthlyIncome;
      if (go.monthlyExpense !== undefined) GM.guoku.monthlyExpense = go.monthlyExpense;
      if (go.annualIncome !== undefined)  GM.guoku.annualIncome = go.annualIncome;
    }
    return { dynasty: dynasty, phase: phase, multiplier: mult };
  }

  // ═════════════════════════════════════════════════════════════
  // p2 inline (R9a 2026-05-04)·暴君虚账·民心反馈·地域分账·粮布流水
  // 原 tm-guoku-p2.js 已 inline·见 §21.2-§21.5
  // ═════════════════════════════════════════════════════════════

  function applyTyrantFiscalDistortion(mr) {
    if (!GM.huangwei || !GM.guoku) return;
    if (GM.huangwei.index < 90) return;
    var monthlyIncome = GM.guoku.monthlyIncome || 0;
    var bubble = monthlyIncome * 0.15 * mr;
    GM.guoku.balance += bubble;
    if (GM.huangwei.tyrantSyndrome && GM.huangwei.tyrantSyndrome.hiddenDamage) {
      GM.huangwei.tyrantSyndrome.hiddenDamage.fiscalBubble =
        (GM.huangwei.tyrantSyndrome.hiddenDamage.fiscalBubble || 0) + bubble;
    }
    if (!GM.fiscal) GM.fiscal = {};
    GM.fiscal.floatingCollectionRate = (GM.fiscal.floatingCollectionRate || 0) + 0.08 * mr;
  }

  function applyTaxMinxinFeedback(mr) {
    if (!GM.minxin || !GM.guoku) return;
    var g = GM.guoku;
    var overCollect = (GM.fiscal && GM.fiscal.floatingCollectionRate) || 0;
    var monthlyPeasantPaid = g.monthlyIncome * (1 + overCollect) * mr;
    var regTotal = safe((GM.hukou || {}).registeredTotal, 10000000);
    var ability = regTotal * 0.01 * mr;
    if (ability <= 0) return;
    var ratio = monthlyPeasantPaid / ability;
    var impact = 0;
    if (ratio > 1.0) {
      impact = -Math.pow(ratio - 1, 1.5) * 5 * mr;
    } else if (ratio < 0.7) {
      impact = 2 * (0.7 - ratio) * mr;
    }
    if (Math.abs(impact) > 0.1) {
      _mxApply(impact, impact < 0 ? '农户税负过重·民力不支' : '税负轻省·民得休息', 'taxation');
    }
    if (GM.fiscal && GM.fiscal.floatingCollectionRate > 0) {
      GM.fiscal.floatingCollectionRate = Math.max(0, GM.fiscal.floatingCollectionRate - 0.02 * mr);
    }
  }

  function getRegions() {
    if (GM.mapData && GM.mapData.cities) {
      return Object.keys(GM.mapData.cities).map(function(cid) {
        var c = GM.mapData.cities[cid];
        return { id: cid, name: c.name || cid, population: c.population || 0 };
      });
    }
    return [{ id: 'national', name: '全境', population: safe((GM.hukou||{}).registeredTotal, 1e7) }];
  }

  function updateRegionalAccounts(mr, totalMonthlyIncome, totalMonthlyExpense) {
    if (!GM.guoku.byRegion) GM.guoku.byRegion = {};
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
      Object.keys(GM.guoku.byRegion).forEach(function(k) {
        if (!seen[k] && k !== 'national') delete GM.guoku.byRegion[k];
      });
      return;
    }
    var regions = getRegions();
    var totalPop = 0;
    regions.forEach(function(r) { totalPop += r.population || 1; });
    if (totalPop === 0) totalPop = 1;
    regions.forEach(function(r) {
      var share = (r.population || 1) / totalPop;
      if (!GM.guoku.byRegion[r.id]) {
        GM.guoku.byRegion[r.id] = {
          name: r.name,
          stock: share * (GM.guoku.balance || 0),
          lastIn: 0, lastOut: 0, cumIn: 0, cumOut: 0
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
    var activeIds = {};
    regions.forEach(function(r) { activeIds[r.id] = true; });
    Object.keys(GM.guoku.byRegion).forEach(function(id) {
      if (!activeIds[id] && id !== 'national') delete GM.guoku.byRegion[id];
    });
  }

  function updateGrainClothFlow(mr) {
    var g = GM.guoku;
    if (!g.ledgers) return;
    if (GM._lastCascadeTurn === GM.turn) {
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
    var grain = g.ledgers.grain;
    var tianfu = (g.sources || {}).tianfu || 0;
    var grainFromTax = tianfu * 0.3 / 10;
    var caoliang = (g.sources || {}).caoliang || 0;
    var grainFromCao = caoliang / 10;
    var grainIn = (grainFromTax + grainFromCao) * mr / 12;
    var junxiang = (g.expenses || {}).junxiang || 0;
    var zhenzi = (g.expenses || {}).zhenzi || 0;
    var fenglu = (g.expenses || {}).fenglu || 0;
    var grainForJun = junxiang * 0.6 / 10;
    var grainForZhen = zhenzi * 0.7 / 10;
    var grainForBosu = fenglu * 0.2 / 10;
    var grainOut = (grainForJun + grainForZhen + grainForBosu) * mr / 12;
    grain.lastTurnIn = Math.round(grainIn);
    grain.lastTurnOut = Math.round(grainOut);
    grain.stock = Math.max(0, (grain.stock || 0) + grainIn - grainOut);
    grain.sources = { 田赋: Math.round(grainFromTax / 12 * mr), 漕粮: Math.round(grainFromCao / 12 * mr) };
    grain.sinks = { 军粮: Math.round(grainForJun / 12 * mr), 赈济: Math.round(grainForZhen / 12 * mr), 俸粮: Math.round(grainForBosu / 12 * mr) };
    var cloth = g.ledgers.cloth;
    var dingshui = (g.sources || {}).dingshui || 0;
    var clothFromTax = (tianfu * 0.15 + dingshui * 0.2) / 5;
    var clothIn = clothFromTax * mr / 12;
    var shangci = (g.expenses || {}).shangci || 0;
    var clothForReward = shangci * 0.3 / 5;
    var clothForSalary = fenglu * 0.05 / 5;
    var clothOut = (clothForReward + clothForSalary) * mr / 12;
    cloth.lastTurnIn = Math.round(clothIn);
    cloth.lastTurnOut = Math.round(clothOut);
    cloth.stock = Math.max(0, (cloth.stock || 0) + clothIn - clothOut);
    cloth.sources = { 田赋布: Math.round(tianfu * 0.15 / 5 / 12 * mr), 丁税布: Math.round(dingshui * 0.2 / 5 / 12 * mr) };
    cloth.sinks = { 赏赐: Math.round(clothForReward / 12 * mr), 俸布: Math.round(clothForSalary / 12 * mr) };
    grain.history = grain.history || [];
    grain.history.push({ turn: GM.turn, in: grain.lastTurnIn, out: grain.lastTurnOut, stock: grain.stock });
    if (grain.history.length > 40) grain.history = grain.history.slice(-40);
    cloth.history = cloth.history || [];
    cloth.history.push({ turn: GM.turn, in: cloth.lastTurnIn, out: cloth.lastTurnOut, stock: cloth.stock });
    if (cloth.history.length > 40) cloth.history = cloth.history.slice(-40);
  }

  // ═════════════════════════════════════════════════════════════
  // p4 inline (R9b 2026-05-04)·4 改革·税种勾选·物价·铸币·AI 诏令
  // 原 tm-guoku-p4.js 已 inline
  // ═════════════════════════════════════════════════════════════

  var FISCAL_REFORMS = {
    twoTax: { id:'twoTax', name:'两税法', historical:'唐德宗建中元年（780）杨炎', desc:'合并租庸调为夏秋两征，以资产为本，赋税制度化。', prerequisites:{huangquan:45,huangwei:50,minxin:40}, durationMonths:12,
      effects:{ sourceMultipliers:{tianfu:1.3,dingshui:0}, corruptionDelta:{fiscal:-5,provincial:-3}, minxinDelta:3, huangweiDelta:5, note:'赋税制度化，暗中豪强抵制' } },
    fieldEquity: { id:'fieldEquity', name:'方田均税法', historical:'宋神宗熙宁五年（1072）王安石', desc:'丈量田亩、均摊赋税、清隐田。', prerequisites:{huangquan:55,huangwei:60,minxin:35}, durationMonths:18,
      effects:{ sourceMultipliers:{tianfu:1.15}, corruptionDelta:{provincial:-8}, hiddenHouseholdDelta:-0.2, minxinDelta:-3, huangweiDelta:3, note:'清查田亩，豪强隐瞒之弊减，但豪强心离' } },
    oneWhip: { id:'oneWhip', name:'一条鞭法', historical:'明万历九年（1581）张居正', desc:'合并田赋丁役杂派，一切征银。', prerequisites:{huangquan:60,huangwei:60,minxin:45}, durationMonths:24,
      effects:{ sourceMultipliers:{tianfu:1.2,dingshui:0}, corruptionDelta:{fiscal:-5,provincial:-3}, minxinDelta:5, huangweiDelta:8, requiresSilver:true, note:'赋役合并征银，简化财政，促进货币经济' } },
    tanDingRuMu: { id:'tanDingRuMu', name:'摊丁入亩', historical:'清康熙末至雍正初', desc:'废除千年丁税，全摊田亩。', prerequisites:{huangquan:65,huangwei:70}, durationMonths:36,
      effects:{ sourceMultipliers:{tianfu:1.35,dingshui:0}, corruptionDelta:{fiscal:-3}, populationGrowthBonus:0.1, minxinDelta:8, huangweiDelta:10, note:'人地分离，废千年丁税，利户口登记' } }
  };

  function canEnactReform(reformId) {
    var r = FISCAL_REFORMS[reformId];
    if (!r) return { can: false, reason: '未知改革' };
    var ongoing = (GM.guoku && GM.guoku.ongoingReforms) || [];
    if (ongoing.some(function(o) { return o.id === reformId; })) return { can: false, reason: '已在施行或已完成' };
    var completed = (GM.guoku && GM.guoku.completedReforms) || [];
    if (completed.indexOf(reformId) !== -1) return { can: false, reason: '已完成' };
    var pre = r.prerequisites || {};
    var fails = [];
    if (pre.huangquan !== undefined && GM.huangquan && GM.huangquan.index < pre.huangquan)
      fails.push('皇权 ' + Math.round(GM.huangquan.index) + '/' + pre.huangquan);
    if (pre.huangwei !== undefined && GM.huangwei && GM.huangwei.index < pre.huangwei)
      fails.push('皇威 ' + Math.round(GM.huangwei.index) + '/' + pre.huangwei);
    if (pre.minxin !== undefined && GM.minxin && GM.minxin.trueIndex < pre.minxin)
      fails.push('民心 ' + Math.round(GM.minxin.trueIndex) + '/' + pre.minxin);
    if (fails.length > 0) return { can: false, reason: '前提不足：' + fails.join('、') };
    return { can: true };
  }

  function enactReform(reformId) {
    var check = canEnactReform(reformId);
    if (!check.can) return { success: false, reason: check.reason };
    var r = FISCAL_REFORMS[reformId];
    ensureGuokuModel();
    if (!GM.guoku.ongoingReforms) GM.guoku.ongoingReforms = [];
    if (!GM.guoku.completedReforms) GM.guoku.completedReforms = [];
    GM.guoku.ongoingReforms.push({
      id: reformId, startTurn: GM.turn,
      endTurn: GM.turn + ((typeof turnsForMonths === 'function') ? turnsForMonths(r.durationMonths) : r.durationMonths)
    });
    if (typeof addEB === 'function') addEB('朝代', '颁行' + r.name + '——' + r.desc, { credibility: 'high' });
    return { success: true, reform: r };
  }

  function tickReforms(context) {
    var mr = (context && context._monthRatio) || (typeof getMonthRatio === 'function' ? getMonthRatio() : 1);
    var ongoing = (GM.guoku && GM.guoku.ongoingReforms) || [];
    if (ongoing.length === 0) return;
    var remaining = [];
    ongoing.forEach(function(o) {
      if (GM.turn >= o.endTurn) {
        var r = FISCAL_REFORMS[o.id];
        if (!r) return;
        var eff = r.effects || {};
        if (!GM.guoku.sourceMultipliers) GM.guoku.sourceMultipliers = {};
        if (eff.sourceMultipliers) for (var k in eff.sourceMultipliers) GM.guoku.sourceMultipliers[k] = eff.sourceMultipliers[k];
        if (eff.corruptionDelta && GM.corruption && GM.corruption.subDepts) {
          for (var d in eff.corruptionDelta) {
            if (GM.corruption.subDepts[d]) GM.corruption.subDepts[d].true = Math.max(0, GM.corruption.subDepts[d].true + eff.corruptionDelta[d]);
          }
        }
        if (eff.hiddenHouseholdDelta && GM.hukou) {
          GM.hukou.estimatedHidden = Math.max(0, (GM.hukou.estimatedHidden || 0) * (1 + eff.hiddenHouseholdDelta));
          var found = -(GM.hukou.estimatedHidden || 0) * eff.hiddenHouseholdDelta;
          GM.hukou.registeredTotal += Math.floor(found);
        }
        if (eff.populationGrowthBonus && GM.hukou) GM.hukou.growthBonus = (GM.hukou.growthBonus || 0) + eff.populationGrowthBonus;
        if (eff.minxinDelta) _mxApply(eff.minxinDelta, '财政改革奏效及民');
        if (eff.huangweiDelta && GM.huangwei) {
          if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
            global.AuthorityEngines.adjustHuangwei('structuralReform', eff.huangweiDelta, '财政改革之效');
          } else GM.huangwei.index = clamp(GM.huangwei.index + eff.huangweiDelta, 0, 100); // 沙箱回退
        }
        GM.guoku.completedReforms.push(o.id);
        if (typeof addEB === 'function') addEB('朝代', r.name + ' 施行既毕，' + eff.note, { credibility: 'high' });
      } else {
        if (GM.guoku) GM.guoku.balance -= (GM.guoku.monthlyIncome || 0) * 0.08 * mr;
        remaining.push(o);
      }
    });
    GM.guoku.ongoingReforms = remaining;
  }

  function updatePriceIndex(mr) {
    if (!GM.prices) GM.prices = { grain:1.0, cloth:1.0, general:1.0 };
    var g = GM.guoku;
    var grainStock = (g.ledgers.grain && g.ledgers.grain.stock) || 0;
    var annualNeed = ((GM.hukou || {}).registeredTotal || 1e7) * 0.6;
    var stockRatio = grainStock / Math.max(1, annualNeed);
    var stockFactor = stockRatio < 0.3 ? 1.8 : stockRatio < 0.6 ? 1.3 : stockRatio < 1.0 ? 1.0 : 0.9;
    var inflationFactor = 1.0;
    if (GM.currency && GM.currency.inflationPressure) inflationFactor = 1 + GM.currency.inflationPressure * 0.2;
    if (GM.activeDisasters && GM.activeDisasters.length > 0) stockFactor *= (1 + GM.activeDisasters.length * 0.15);
    var targetGrain = stockFactor * inflationFactor;
    GM.prices.grain = GM.prices.grain * 0.8 + targetGrain * 0.2;
    GM.prices.cloth = GM.prices.cloth * 0.9 + inflationFactor * 0.1;
    GM.prices.general = (GM.prices.grain + GM.prices.cloth) / 2;
    if (GM.prices.grain > 1.5 && GM.guoku.expenses) GM.guoku._militaryCostMultiplier = GM.prices.grain;
    else GM.guoku._militaryCostMultiplier = 1;
    if (GM.prices.grain > 2.0 && GM.minxin) {
      var impact = -(GM.prices.grain - 2.0) * 3 * mr;
      _mxApply(impact, '粮价' + GM.prices.grain.toFixed(2) + '倍·民生艰难', 'priceStability');
      if (Math.random() < 0.1 * mr && typeof addEB === 'function') addEB('事件', '粮价涨至 ' + GM.prices.grain.toFixed(2) + ' 倍，民生艰难', { credibility: 'high' });
    }
  }

  async function aiParseFiscalDecree(decreeText, actionType) {
    var isAvail = (typeof callAI === 'function') && (typeof P !== 'undefined') && P.ai && P.ai.key;
    if (!isAvail) return null;
    var hint = {
      extraTax: '判断加派税率（0.0-1.0，如 0.3 表示三成）',
      openGranary: '判断赈济规模（county/regional/national）',
      takeLoan: '判断借贷金额（以两为单位）与月限',
      cutOfficials: '判断裁员比例（0.0-1.0）',
      reduceTax: '判断减赋比例（0.0-1.0）',
      issuePaperCurrency: '判断发钞金额（以两为单位）'
    }[actionType] || '判断合理参数';
    var prompt = '你是财政辅政大臣。玩家颁下诏令："' + decreeText + '"。请' + hint + '。以 JSON 回复：{"amount":数值, "reason":"短解释"}。只输出 JSON。';
    try {
      var resp = await callAI(prompt, 200);
      var m = (resp || '').match(/\{[\s\S]*\}/);
      if (!m) return null;
      return JSON.parse(m[0]);
    } catch(e) { console.warn('[guoku] aiParseFiscalDecree:', e.message); return null; }
  }

  var MintingActions = {
    lightCoining: function(reduction) {
      reduction = reduction || 0.2;
      var g = GM.guoku;
      var boost = (g.monthlyIncome || 0) * 3 * reduction;
      g.balance += boost;
      if (!GM.currency) GM.currency = {};
      GM.currency.inflationPressure = (GM.currency.inflationPressure || 0) + reduction * 0.5;
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('brokenPromise', -reduction * 15, '减重改铸·钱法失信');
      } else if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - reduction * 15); // 沙箱回退
      _mxApply(-(reduction * 8), '减重改铸·新钱成色降·市面疑虑');
      if (typeof addEB === 'function') addEB('朝代', '减重改铸：新钱成色降 ' + Math.round(reduction*100) + '%，市面疑虑', { credibility: 'high' });
      return { success: true, revenue: boost };
    },
    banPrivateMint: function() {
      if (!GM.currency) GM.currency = {};
      GM.currency.privateCastBanned = true;
      if (GM.corruption && GM.corruption.subDepts.fiscal) GM.corruption.subDepts.fiscal.true = Math.min(100, GM.corruption.subDepts.fiscal.true + 3);
      if (typeof addEB === 'function') addEB('朝代', '严禁私铸——私钱匠徒法严诛', { credibility: 'high' });
      return { success: true };
    },
    newCoining: function(name) {
      name = name || '通宝';
      if (!GM.currency) GM.currency = {};
      GM.currency.inflationPressure = Math.max(0, (GM.currency.inflationPressure || 0) - 0.3);
      GM.currency.latestCoin = name;
      var cost = 100000;
      if (GM.guoku) GM.guoku.balance -= cost;
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei('benevolence', 5, '新钱精良·民信渐复');
      } else if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + 5); // 沙箱回退
      if (typeof addEB === 'function') addEB('朝代', '新铸"' + name + '"钱，成色精良，民信渐复', { credibility: 'high' });
      return { success: true, cost: cost };
    }
  };

  // ═════════════════════════════════════════════════════════════
  // p4 inline·Sources wrap (taxesEnabled + sourceMultipliers)·initFromDynasty unit override·Expenses.junxiang 物价乘
  // ═════════════════════════════════════════════════════════════

  (function _p4WrapSources() {
    var _origSources = Sources;
    var _wrappedSources = {};
    Object.keys(_origSources).forEach(function(key) {
      _wrappedSources[key] = function() {
        var cfg = ((typeof P !== 'undefined' && P.fiscalConfig) || (GM.fiscalConfig) || {}).taxesEnabled;
        if (cfg && cfg[key] === false) return 0;
        var val = _origSources[key]() || 0;
        var mults = (GM.guoku && GM.guoku.sourceMultipliers) || {};
        if (mults[key] !== undefined) val *= mults[key];
        return val;
      };
    });
    Sources = _wrappedSources;
  })();

  (function _p4WrapInit() {
    var _origInit = initFromDynasty;
    initFromDynasty = function(dynasty, phase, scenarioOverride) {
      var r = _origInit(dynasty, phase, scenarioOverride);
      var fc = (scenarioOverride && scenarioOverride.fiscalConfig) || null;
      if (fc && fc.unit) {
        if (fc.unit.money) GM.guoku.unit.money = fc.unit.money;
        if (fc.unit.grain) GM.guoku.unit.grain = fc.unit.grain;
        if (fc.unit.cloth) GM.guoku.unit.cloth = fc.unit.cloth;
      }
      return r;
    };
  })();

  (function _p4WrapJunxiang() {
    var _origJunxiang = Expenses.junxiang;
    Expenses.junxiang = function() {
      var base = _origJunxiang() || 0;
      var mult = (GM.guoku && GM.guoku._militaryCostMultiplier) || 1;
      return base * mult;
    };
  })();

  (function _p4WrapYearlySettle() {
    var _origYearlySettle = yearlySettle;
    yearlySettle = function() {
      var archive = _origYearlySettle();
      if (archive && GM.guoku.byRegion) {
        archive.byRegion = {};
        Object.keys(GM.guoku.byRegion).forEach(function(rid) {
          var r = GM.guoku.byRegion[rid];
          archive.byRegion[rid] = { name: r.name, stock: r.stock, cumIn: r.cumIn, cumOut: r.cumOut, net: (r.cumIn || 0) - (r.cumOut || 0) };
          r.cumIn = 0;
          r.cumOut = 0;
        });
      }
      return archive;
    };
  })();

  // ═════════════════════════════════════════════════════════════
  // p5 inline (R9c 2026-05-04)·漕运损耗·漕弊事件·3 借贷源·AI 财政参议
  // 原 tm-guoku-p5.js 已 inline
  // ═════════════════════════════════════════════════════════════

  function isAIAvailable() {
    return (typeof callAI === 'function') && (typeof P !== 'undefined') && P.ai && P.ai.key;
  }

  function calcCaoyunLossRate() {
    if (!GM.corruption) return 0.05;
    var fc = safe((GM.corruption.subDepts.fiscal || {}).true, 0);
    var pc = safe((GM.corruption.subDepts.provincial || {}).true, 0);
    var lossRate = 0.05 + (fc + pc) / 200 * 0.3;
    var factions = (GM.corruption.entrenchedFactions || []);
    var hasCaoyunCabal = factions.some(function(f) {
      return f.name === '漕运党' || (f.name || '').indexOf('漕') !== -1;
    });
    if (hasCaoyunCabal) lossRate += 0.05;
    return clamp(lossRate, 0.02, 0.6);
  }

  // p5 inline·Sources.caoliang wrap (扣损耗·追踪)
  (function _p5WrapCaoliang() {
    var _origCaoliang = Sources.caoliang;
    Sources.caoliang = function() {
      var nominal = _origCaoliang() || 0;
      var lossRate = calcCaoyunLossRate();
      var actual = nominal * (1 - lossRate);
      if (!GM.guoku._caoyunStats) GM.guoku._caoyunStats = {};
      GM.guoku._caoyunStats.nominal = nominal;
      GM.guoku._caoyunStats.lossRate = lossRate;
      GM.guoku._caoyunStats.actual = actual;
      GM.guoku._caoyunStats.lossAmount = nominal - actual;
      return actual;
    };
  })();

  function maybeTriggerCaoyunIncident(mr) {
    var lossRate = calcCaoyunLossRate();
    if (lossRate < 0.25) return;
    var prob = (lossRate - 0.25) * 0.1 * mr;
    if (Math.random() > prob) return;
    var events = [
      '漕船沉没于淮上，损粮数万石',
      '漕丁哗变，截留粮米充私',
      '漕船晚至京师，京营断炊',
      '沿河官吏讹索，漕船停滞',
      '漕帮把持河道，新船不得行'
    ];
    var txt = events[Math.floor(Math.random() * events.length)];
    if (typeof addEB === 'function') addEB('事件', '漕弊：' + txt, { credibility: 'high' });
    _mxApply(-2, '漕弊扰民');
    if (GM.guoku && GM.guoku.ledgers && GM.guoku.ledgers.grain) {
      GM.guoku.ledgers.grain.stock = Math.max(0, GM.guoku.ledgers.grain.stock * 0.95);
    }
    if (GM.guoku && GM.guoku.history) {
      GM.guoku.history.events.push({ turn: GM.turn, type: 'caoyun_incident', text: txt });
    }
  }

  var LOAN_SOURCES = {
    saltMerchant: { id:'saltMerchant', name:'两淮盐商', interest:0.015, maxAmount:300000, historical:'清代盐商多向朝廷借贷，以盐引为质',
      requires: function() { var cfg = (typeof P !== 'undefined' && P.fiscalConfig) || {}; var tx = cfg.taxesEnabled; return !tx || tx.yanlizhuan !== false; },
      sideEffects: { huangquan: -1, fiscalCorruption: +2 } },
    moneyMerchant: { id:'moneyMerchant', name:'山陕钱商（票号）', interest:0.02, maxAmount:500000, historical:'明清山西票号、陕西钱庄', sideEffects:{} },
    foreignLoan: { id:'foreignLoan', name:'外邦借银', interest:0.03, maxAmount:1000000, historical:'清末向列强举债，开局末世', sideEffects:{ huangwei:-5, foreign:-10, minxin:-3 } }
  };

  function takeLoanBySource(sourceId, amount, termMonths) {
    var src = LOAN_SOURCES[sourceId];
    if (!src) return { success: false, reason: '未知借贷来源' };
    if (src.requires && !src.requires()) return { success: false, reason: '条件不备' };
    amount = Math.min(amount || src.maxAmount * 0.3, src.maxAmount);
    termMonths = termMonths || 12;
    ensureGuokuModel();
    GM.guoku.balance += amount;
    if (!GM.guoku.emergency.loans) GM.guoku.emergency.loans = [];
    GM.guoku.emergency.loans.push({ source:sourceId, sourceName:src.name, principal:amount, interestRate:src.interest, monthsLeft:termMonths, totalTerm:termMonths });
    GM.guoku.emergency.loan.active = true;
    GM.guoku.emergency.loan.amount = (GM.guoku.emergency.loan.amount || 0) + amount;
    GM.guoku.emergency.loan.monthsLeft = Math.max(GM.guoku.emergency.loan.monthsLeft || 0, termMonths);
    var se = src.sideEffects || {};
    if (se.huangquan && GM.huangquan) {
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan(se.huangquan > 0 ? 'personalRule' : 'idleGovern', se.huangquan, '\u501f\u8d37\u6765\u6e90\u526f\u4f5c\u7528');
      } else {
        GM.huangquan.index = clamp(GM.huangquan.index + se.huangquan, 0, 100);
      }
    }
    if (se.huangwei && GM.huangwei) {
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangwei) {
        global.AuthorityEngines.adjustHuangwei(se.huangwei > 0 ? 'benevolence' : 'brokenPromise', se.huangwei, '借贷来源副作用');
      } else GM.huangwei.index = clamp(GM.huangwei.index + se.huangwei, 0, 100); // 沙箱回退
    }
    if (se.minxin) _mxApply(se.minxin, '应急借贷·市面所感');
    if (se.foreign && GM.huangwei && GM.huangwei.subDims && GM.huangwei.subDims.foreign) {
      GM.huangwei.subDims.foreign.value = clamp(GM.huangwei.subDims.foreign.value + se.foreign, 0, 100);
    }
    if (se.fiscalCorruption && GM.corruption && GM.corruption.subDepts.fiscal) {
      GM.corruption.subDepts.fiscal.true = clamp(GM.corruption.subDepts.fiscal.true + se.fiscalCorruption, 0, 100);
    }
    if (typeof addEB === 'function') addEB('朝代', '借银 ' + Math.round(amount/10000) + ' 万两于' + src.name + '，利率 ' + (src.interest * 100).toFixed(1) + '%/月，限 ' + termMonths + ' 月', { credibility: 'high' });
    return { success: true, loan: src };
  }

  function processLoansMonthly(mr) {
    if (!GM.guoku || !GM.guoku.emergency || !GM.guoku.emergency.loans) return;
    var loans = GM.guoku.emergency.loans;
    var remaining = [];
    loans.forEach(function(L) {
      var payment = L.principal * (1 / L.totalTerm + L.interestRate) * mr;
      GM.guoku.balance -= payment;
      L.monthsLeft -= mr;
      if (L.monthsLeft > 0) remaining.push(L);
      else if (typeof addEB === 'function') addEB('朝代', L.sourceName + '借银已还清', { credibility: 'high' });
    });
    GM.guoku.emergency.loans = remaining;
    if (remaining.length === 0) {
      GM.guoku.emergency.loan.active = false;
      GM.guoku.emergency.loan.amount = 0;
      GM.guoku.emergency.loan.monthsLeft = 0;
    }
  }

  // p5 inline·Actions.takeLoan wrap (default → moneyMerchant)
  (function _p5WrapActions() {
    Actions.takeLoan = function(amount, term) { return takeLoanBySource('moneyMerchant', amount, term); };
    Actions.takeLoanBySource = takeLoanBySource;
  })();

  async function aiFiscalAdvisor() {
    if (!isAIAvailable()) return { available: false, analysis: _ruleBasedFiscalAdvisor() };
    var g = GM.guoku || {}, n = GM.neitang || {};
    var reform = (g.ongoingReforms || []).map(function(o) { return (FISCAL_REFORMS[o.id] || {}).name; }).join('、') || '无';
    var completed = (g.completedReforms || []).map(function(id) { return (FISCAL_REFORMS[id] || {}).name; }).join('、') || '无';
    var cabal = ((GM.corruption || {}).entrenchedFactions || []).map(function(f) { return f.name; }).join('、') || '无';
    var prompt = '你扮演户部尚书，为陛下参议财政大计。以奏疏体（200 字内，文言雅训），分析三项：1) 帑廪现况断言（岁有余/岁亏/危殆）2) 当务之急：加派/开仓/借贷/减赋/裁员/发钞/改革，择一二。3) 副作用预警。\n\n当前时局：'
      + '\n- 帑廪 ' + Math.round(g.balance || 0) + ' 两（年入 ' + Math.round(g.annualIncome || 0) + '）'
      + '\n- 月入 ' + Math.round(g.monthlyIncome || 0) + '，月支 ' + Math.round(g.monthlyExpense || 0)
      + '\n- 实征率 ' + Math.round((g.actualTaxRate || 1) * 100) + '%'
      + '\n- 内帑 ' + Math.round(n.balance || 0) + ' 两'
      + '\n- 皇权 ' + Math.round((GM.huangquan || {}).index || 50) + '，皇威 ' + Math.round((GM.huangwei || {}).index || 50)
      + '\n- 民心 ' + Math.round((GM.minxin || {}).trueIndex || 50)
      + '\n- 粮价 ' + (((GM.prices || {}).grain) || 1).toFixed(2) + ' ×'
      + '\n- 施行中改革：' + reform + '；已完成：' + completed
      + '\n- 腐败集团：' + cabal
      + '\n- 破产：' + (g.bankruptcy && g.bankruptcy.active ? '已连续 ' + Math.round(g.bankruptcy.consecutiveMonths || 0) + ' 月' : '否')
      + '\n\n直接输出奏疏（"臣户部尚书某某谨奏……"），不含解释。';
    try { var text = await callAI(prompt, 600); return { available: true, analysis: (text || '').trim() }; }
    catch(e) { console.warn('[guoku] aiFiscalAdvisor:', e.message); return { available: false, analysis: _ruleBasedFiscalAdvisor(), error: e.message }; }
  }

  function _ruleBasedFiscalAdvisor() {
    var g = GM.guoku || {};
    var balance = g.balance || 0, annual = g.annualIncome || 1;
    var h = (GM.huangquan || {}).index || 50;
    var m = (GM.minxin || {}).trueIndex || 50;
    var grainPrice = ((GM.prices || {}).grain) || 1;
    var lines = [];
    if (g.bankruptcy && g.bankruptcy.active) lines.push('【断言】帑廪已破，' + Math.round(g.bankruptcy.consecutiveMonths || 0) + ' 月连亏，危殆。');
    else if (balance < annual * 0.2) lines.push('【断言】帑廪不足年入二成，近于危境。');
    else if (balance < 0) lines.push('【断言】帑廪初亏，不可不慎。');
    else if (balance > annual * 3) lines.push('【断言】岁有余帑三年之积。');
    else lines.push('【断言】岁有小余，中平之局。');
    var actions = [];
    if (balance < 0 && h > 50 && m > 40) actions.push('加派赋税以济目前');
    if (balance < annual * 0.3 && m > 50) actions.push('向盐商/钱商借银十至三十万');
    if ((g.ongoingReforms || []).length === 0 && balance > annual * 0.5 && h > 55) actions.push('推大改革（如一条鞭法/摊丁入亩）以立长治');
    if (balance > annual * 2 && m > 60) actions.push('减赋两成以惠百姓');
    if (grainPrice > 1.5) actions.push('开仓赈济，平抑粮价');
    if (actions.length > 0) lines.push('【臣请】' + actions.join('；'));
    else lines.push('【臣请】维持现状，徐图之。');
    var warnings = [];
    var fCabal = (GM.corruption && GM.corruption.entrenchedFactions) || [];
    if (fCabal.some(function(f) { return f.dept === 'fiscal'; })) warnings.push('税司腐败集团盘踞，改革必激反噬');
    if (h < 45) warnings.push('皇权不足，大改恐推行不力');
    if (m < 40) warnings.push('民心不稳，加派激民变');
    if (warnings.length > 0) lines.push('【副作用】' + warnings.join('；'));
    return lines.join('\n\n');
  }

  // ═════════════════════════════════════════════════════════════
  // p6 inline (R9d 2026-05-04)·自定义税种·transferLimits·fixedDeductions·AI 漕运/税种
  // 原 tm-guoku-p6.js 已 inline·5 层链最终版
  // ═════════════════════════════════════════════════════════════

  function calcCustomTaxes() {
    var cfg = ((typeof P !== 'undefined' && P.fiscalConfig) || {}).customTaxes;
    if (!Array.isArray(cfg) || cfg.length === 0) return {};
    var results = {};
    cfg.forEach(function(tax) {
      if (!tax.id) return;
      var val = 0;
      var regTotal = safe((GM.hukou || {}).registeredTotal, 1e7);
      try {
        if (tax.formulaType === 'perCapita') val = regTotal * (tax.rate || 0.01);
        else if (tax.formulaType === 'flat') val = tax.amount || 0;
        else if (tax.formulaType === 'percent') {
          var baseVal = tax.base === 'commerce' ? regTotal * 0.1 : tax.base === 'land' ? regTotal * 0.05 : regTotal;
          val = baseVal * (tax.rate || 0.01);
        }
      } catch(e) { val = 0; }
      results[tax.id] = { amount: val, name: tax.name || tax.id };
    });
    return results;
  }

  // p6 inline·再 wrap Sources.qita (p4 wrap 之上·加 custom taxes)
  (function _p6WrapQita() {
    var _origQita = Sources.qita;
    Sources.qita = function() {
      var base = _origQita() || 0;
      var custom = calcCustomTaxes();
      var total = base;
      for (var k in custom) total += custom[k].amount;
      if (!GM.guoku._customTaxStats) GM.guoku._customTaxStats = {};
      GM.guoku._customTaxStats = custom;
      return total;
    };
  })();

  // transferLimits helpers
  function _yearKey() {
    if (typeof getCurrentYear === 'function') return getCurrentYear();
    var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var baseYear = (typeof P !== 'undefined' && P.time && typeof P.time.year === 'number') ? P.time.year : 0;
    return baseYear + Math.floor(Math.max(0, (GM.turn || 1) - 1) * dpv / 365);
  }
  function _getYearCum(direction) {
    if (!GM.neitang._transferYearCum) GM.neitang._transferYearCum = {};
    var y = _yearKey();
    if (GM.neitang._transferYearCum.year !== y) {
      GM.neitang._transferYearCum = { year: y, guokuToNeicang: 0, neicangToGuoku: 0 };
    }
    return GM.neitang._transferYearCum[direction] || 0;
  }
  function _addYearCum(direction, amount) {
    if (!GM.neitang._transferYearCum) GM.neitang._transferYearCum = {};
    var y = _yearKey();
    if (GM.neitang._transferYearCum.year !== y) {
      GM.neitang._transferYearCum = { year: y, guokuToNeicang: 0, neicangToGuoku: 0 };
    }
    GM.neitang._transferYearCum[direction] = (GM.neitang._transferYearCum[direction] || 0) + amount;
  }

  // p6 inline·NeitangEngine wraps (条件 if NeitangEngine 已加载)
  if (typeof NeitangEngine !== 'undefined' && NeitangEngine.Actions) {
    var _origTransferIn = NeitangEngine.Actions.transferFromGuoku;
    NeitangEngine.Actions.transferFromGuoku = function(amount) {
      var rules = (GM.neitang && GM.neitang.neicangRules) || {};
      var limits = (rules.transferLimits || {}).guokuToNeicang || {};
      if (limits.maxPerTransfer && amount > limits.maxPerTransfer) {
        return { success: false, reason: '单次调拨上限 ' + limits.maxPerTransfer + ' 两' };
      }
      if (limits.maxPerYear) {
        var cum = _getYearCum('guokuToNeicang');
        if (cum + amount > limits.maxPerYear) {
          return { success: false, reason: '年度调拨上限 ' + limits.maxPerYear + ' · 本年已 ' + cum };
        }
      }
      var r = _origTransferIn.call(this, amount);
      if (r.success) _addYearCum('guokuToNeicang', amount);
      return r;
    };
    var _origRescue = NeitangEngine.Actions.rescueGuoku;
    NeitangEngine.Actions.rescueGuoku = function(amount) {
      var rules = (GM.neitang && GM.neitang.neicangRules) || {};
      var limits = (rules.transferLimits || {}).neicangToGuoku || {};
      if (limits.maxPerTransfer && amount > limits.maxPerTransfer) {
        return { success: false, reason: '单次捐输上限 ' + limits.maxPerTransfer + ' 两' };
      }
      if (limits.maxPerYear) {
        var cum = _getYearCum('neicangToGuoku');
        if (cum + amount > limits.maxPerYear) {
          return { success: false, reason: '年度捐输上限 ' + limits.maxPerYear + ' · 本年已 ' + cum };
        }
      }
      var r = _origRescue.call(this, amount);
      if (r.success) _addYearCum('neicangToGuoku', amount);
      return r;
    };
  }

  function processFixedDeductions(mr) {
    if (!GM.neitang || !GM.neitang.neicangRules) return;
    var deds = GM.neitang.neicangRules.fixedDeductions;
    if (!Array.isArray(deds) || deds.length === 0) return;
    deds.forEach(function(d) {
      var amt = 0;
      if (d.cadence === 'monthly') amt = (d.amount || 0) * mr;
      else if (d.cadence === 'annual') amt = (d.amount || 0) * mr / 12;
      if (amt <= 0) return;
      var fromAcc = d.account === 'neicang' ? 'neitang' : 'guoku';
      var toAcc = d.destination === 'neicang' ? 'neitang' : d.destination === 'guoku' ? 'guoku' : null;
      if (fromAcc === 'neitang' && GM.neitang) GM.neitang.balance -= amt;
      if (fromAcc === 'guoku' && GM.guoku) GM.guoku.balance -= amt;
      if (toAcc === 'neitang' && GM.neitang) GM.neitang.balance += amt;
      if (toAcc === 'guoku' && GM.guoku) GM.guoku.balance += amt;
    });
  }

  async function aiCaoyunWarning() {
    var lossRate = calcCaoyunLossRate();
    var stats = (GM.guoku && GM.guoku._caoyunStats) || {};
    if (lossRate < 0.15) return { available: false, analysis: '漕运损耗正常，未有预警。' };
    if (!isAIAvailable()) return { available: false, analysis: _ruleCaoyunWarning(lossRate) };
    var fc = safe((GM.corruption && GM.corruption.subDepts.fiscal || {}).true, 0);
    var pc = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0);
    var hasCaoyunCabal = ((GM.corruption && GM.corruption.entrenchedFactions) || []).some(function(f) { return (f.name||'').indexOf('漕') !== -1; });
    var prompt = '你扮演漕运总督，奏疏体（150 字内）为陛下预警漕运危机：\n- 漕运损耗率 ' + Math.round(lossRate*100) + '%\n- 税司腐败 ' + Math.round(fc) + '，地方腐败 ' + Math.round(pc) + '\n- 漕帮党：' + (hasCaoyunCabal ? '已成气候' : '未现') + '\n- 名义岁漕 ' + Math.round(stats.nominal||0) + ' 两，实入 ' + Math.round(stats.actual||0) + ' 两\n\n请分析风险（漕船沉没/漕丁哗变/漕帮把持）并建言。直接输出奏疏。';
    try { var text = await callAI(prompt, 400); return { available: true, analysis: (text || '').trim() }; }
    catch(e) { return { available: false, analysis: _ruleCaoyunWarning(lossRate), error: e.message }; }
  }

  function _ruleCaoyunWarning(lossRate) {
    var lines = ['【断言】漕运损耗 ' + Math.round(lossRate*100) + '%，'];
    lines[0] += lossRate > 0.4 ? '危在旦夕。' : lossRate > 0.25 ? '颓势明显。' : '尚可维持。';
    var reasons = [];
    var fc = safe((GM.corruption && GM.corruption.subDepts.fiscal || {}).true, 0);
    var pc = safe((GM.corruption && GM.corruption.subDepts.provincial || {}).true, 0);
    if (fc > 50) reasons.push('税司贪墨 ' + Math.round(fc));
    if (pc > 50) reasons.push('地方苛征 ' + Math.round(pc));
    var hasCabal = ((GM.corruption && GM.corruption.entrenchedFactions) || []).some(function(f) { return (f.name||'').indexOf('漕') !== -1; });
    if (hasCabal) reasons.push('漕帮党盘踞');
    if (reasons.length > 0) lines.push('【源】' + reasons.join('；'));
    var actions = [];
    if (fc > 50 || pc > 50) actions.push('派钦差稽查漕线');
    if (hasCabal) actions.push('肃贪运动清漕帮');
    actions.push('新铸"漕帑"印钞监督损耗');
    lines.push('【臣请】' + actions.join('；'));
    return lines.join('\n\n');
  }

  async function aiTaxAdvisor() {
    if (!isAIAvailable()) return { available: false, analysis: _ruleTaxAdvisor() };
    var g = GM.guoku || {};
    var sources = g.sources || {};
    var srcLines = [];
    var srcLabels = { tianfu:'田赋', dingshui:'丁税', caoliang:'漕粮', yanlizhuan:'专卖', shipaiShui:'市舶', quanShui:'榷税', juanNa:'捐纳', qita:'其他' };
    for (var k in sources) srcLines.push((srcLabels[k]||k) + ' ' + Math.round(sources[k]||0));
    var prompt = '你扮演户部左侍郎，奏疏体（200 字内）为陛下分析税种结构并建议：\n- 本岁各税：' + srcLines.join('，') + '\n- 民心 ' + Math.round((GM.minxin||{}).trueIndex || 50) + '，粮价 ' + (((GM.prices||{}).grain)||1).toFixed(2) + '倍\n- 改革：' + (((g.completedReforms||[]).length ? '已' : '未') + '行大改') + '\n\n请指出当今税制弊端（如税种单一/重农轻商/丁税过重等），并建议增减/改革。直接输出奏疏。';
    try { var text = await callAI(prompt, 500); return { available: true, analysis: (text || '').trim() }; }
    catch(e) { return { available: false, analysis: _ruleTaxAdvisor(), error: e.message }; }
  }

  function _ruleTaxAdvisor() {
    var g = GM.guoku || {};
    var sources = g.sources || {};
    var lines = [];
    var total = 0;
    for (var k in sources) total += (sources[k]||0);
    if (total > 0) {
      var tianfuPct = (sources.tianfu||0) / total;
      var dingPct = (sources.dingshui||0) / total;
      var yanPct = (sources.yanlizhuan||0) / total;
      var juanPct = (sources.juanNa||0) / total;
      var notes = [];
      if (tianfuPct > 0.6) notes.push('田赋占 ' + Math.round(tianfuPct*100) + '%，过重农于民');
      if (dingPct > 0.1) notes.push('丁税 ' + Math.round(dingPct*100) + '%，压贫厚富');
      if (yanPct < 0.08 && !((typeof P!=='undefined') && P.fiscalConfig && P.fiscalConfig.taxesEnabled && P.fiscalConfig.taxesEnabled.yanlizhuan === false)) notes.push('盐铁专卖未尽其利');
      if (juanPct > 0.15) notes.push('捐纳 ' + Math.round(juanPct*100) + '%，官源弊端');
      if ((sources.shipaiShui||0) === 0) notes.push('市舶未开，失海外之利');
      if (notes.length > 0) lines.push('【臣议】' + notes.join('；'));
    }
    var actions = [];
    if ((sources.dingshui||0) / Math.max(1,total) > 0.08 && !(g.completedReforms||[]).includes('tanDingRuMu')) actions.push('推摊丁入亩以废丁税');
    if ((sources.dingshui||0) > 0 && !(g.completedReforms||[]).includes('oneWhip')) actions.push('行一条鞭合并征银');
    if ((sources.shipaiShui||0) === 0 && !(g.completedReforms||[]).includes('twoTax')) actions.push('开海市舶以博商利');
    if (actions.length > 0) lines.push('【建言】' + actions.join('；'));
    else lines.push('【建言】税制渐成，徐图之。');
    return lines.join('\n\n');
  }

  // ═════════════════════════════════════════════════════════════
  // 主 tick
  // ═════════════════════════════════════════════════════════════

  // 清偿旧欠：库有余则按月偿还 ledgers.money.deficit（欠俸/欠饷累欠）。
  // deficit 此前全仓只进不出——一次欠账=永久 inCrisis·破产链棘轮升满永不解除(2026-07-04 审查定罪)。
  // 节奏：每月最多偿 月入25%×mr·且不动用库藏最后一成(留缓冲)·清讫发邸报。
  function _repayDeficit(mr) {
    var g = GM.guoku;
    var led = g && g.ledgers && g.ledgers.money;
    if (!led) return 0;
    var owed = Math.max(0, safe(led.deficit, 0));
    if (!owed) return 0;
    var avail = Math.max(0, safe(g.balance, 0));
    if (avail <= 0) return 0;
    var monthly = Math.max(0, safe(g.monthlyIncome, 0));
    var cap = monthly > 0 ? monthly * 0.25 * mr : avail * 0.25;
    var pay = Math.round(Math.min(owed, avail * 0.9, cap));
    if (pay <= 0) return 0;
    led.stock = Math.max(0, safe(led.stock, 0) - pay);
    g.balance = led.stock;
    led.deficit = Math.round(Math.max(0, owed - pay));
    if (!led.sinks) led.sinks = {};
    led.sinks['清偿旧欠'] = safe(led.sinks['清偿旧欠'], 0) + pay;
    if (led.deficit === 0 && typeof addEB === 'function') addEB('财政', '累年积欠清讫，帑藏归于常度', { credibility: 'high' });
    return pay;
  }

  function tick(context) {
    ensureGuokuModel();
    var mr = (context && context._monthRatio) || getMonthRatio();
    if (context) context._guokuMonthRatio = mr;

    try { monthlySettle(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] monthlySettle:') : console.error('[guoku] monthlySettle:', e); }
    // ── p2 inline (R9a)·tick add-ons ──
    try { applyTyrantFiscalDistortion(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] tyrant:') : console.error('[guoku] tyrant:', e); }
    try { applyTaxMinxinFeedback(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] minxinFeedback:') : console.error('[guoku] minxinFeedback:', e); }
    try { updateRegionalAccounts(mr, GM.guoku.monthlyIncome || 0, GM.guoku.monthlyExpense || 0); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] regional:') : console.error('[guoku] regional:', e); }
    try { updateGrainClothFlow(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] grainCloth:') : console.error('[guoku] grainCloth:', e); }
    // ── p4 inline (R9b)·tick add-ons ──
    try { tickReforms(context); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] tickReforms:') : console.error('[guoku] tickReforms:', e); }
    try { updatePriceIndex(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] prices:') : console.error('[guoku] prices:', e); }
    // ── p5 inline (R9c)·tick add-ons ──
    try { maybeTriggerCaoyunIncident(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] caoyun:') : console.error('[guoku] caoyun:', e); }
    try { processLoansMonthly(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] loans:') : console.error('[guoku] loans:', e); }
    // ── p6 inline (R9d)·tick add-ons ──
    try { processFixedDeductions(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] fixedDed:') : console.error('[guoku] fixedDed:', e); }
    try { _repayDeficit(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] repayDeficit:') : console.error('[guoku] repayDeficit:', e); }

    // 年末决算（每年一次，简化：若当前 turn 跨越年）
    var dpt = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var daysPerYear = 360;
    var currentDay = GM.turn * dpt;
    var currentYear = Math.floor(currentDay / daysPerYear);
    var prevYear = Math.floor((GM.turn - 1) * dpt / daysPerYear);
    if (currentYear > prevYear) {
      try { yearlySettle(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] yearlySettle:') : console.error('[guoku] yearlySettle:', e); }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 导出
  // ═════════════════════════════════════════════════════════════

  global.GuokuEngine = {
    tick: tick,
    ensureModel: ensureGuokuModel,
    getMonthRatio: getMonthRatio,
    Sources: Sources,
    Expenses: Expenses,
    Actions: Actions,
    tickDisasters: tickDisasters,
    computeTaxFlow: computeTaxFlow,
    monthlySettle: monthlySettle,
    yearlySettle: yearlySettle,
    checkBankruptcy: checkBankruptcy,
    BANKRUPTCY_STAGES: BANKRUPTCY_STAGES,
    initFromDynasty: initFromDynasty,
    DYNASTY_PRESETS: DYNASTY_PRESETS,
    // ── p2 inline (R9a 2026-05-04) ──
    applyTyrantFiscalDistortion: applyTyrantFiscalDistortion,
    applyTaxMinxinFeedback: applyTaxMinxinFeedback,
    updateRegionalAccounts: updateRegionalAccounts,
    updateGrainClothFlow: updateGrainClothFlow,
    getRegions: getRegions,
    // ── p4 inline (R9b 2026-05-04) ──
    FISCAL_REFORMS: FISCAL_REFORMS,
    canEnactReform: canEnactReform,
    enactReform: enactReform,
    tickReforms: tickReforms,
    updatePriceIndex: updatePriceIndex,
    aiParseFiscalDecree: aiParseFiscalDecree,
    MintingActions: MintingActions,
    // ── p5 inline (R9c 2026-05-04) ──
    LOAN_SOURCES: LOAN_SOURCES,
    takeLoanBySource: takeLoanBySource,
    calcCaoyunLossRate: calcCaoyunLossRate,
    aiFiscalAdvisor: aiFiscalAdvisor,
    isAIAvailable: isAIAvailable,
    // ── p6 inline (R9d 2026-05-04)·5 层链最终版 ──
    calcCustomTaxes: calcCustomTaxes,
    aiCaoyunWarning: aiCaoyunWarning,
    aiTaxAdvisor: aiTaxAdvisor,
    processFixedDeductions: processFixedDeductions
  };

  console.log('[guoku] 引擎已加载：8 收入源 + 8 支出类 + 破产链 + 6 紧急措施 + 朝代预设');

})(typeof window !== 'undefined' ? window : this);
