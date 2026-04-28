// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 帑廪（国库）系统 · 核心引擎
// 设计方案：设计方案-财政系统.md（决策 A-G + 补充 H-P）
//
// 本文件实现：
//   - 八类收入计算（田赋/丁税/漕粮/专卖/市舶/榷税/捐纳/其他）
//   - 八类支出计算（俸禄/军饷/赈济/工程/祭祀/赏赐/内廷/其他）
//   - 与腐败的实征率联动（三数对照）
//   - 年度决算 + 历史归档
//   - 破产事件 + 紧急措施（加派/借贷）
//   - 时间刻度适配（daysPerTurn）
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

    return {
      nominal: annualNominal,
      actualReceived: annualNominal * (1 - leakageRate) * purchasingPower,
      peasantPaid: annualNominal * (1 + overCollectRate),
      leakageRate: leakageRate,
      overCollectRate: overCollectRate,
      purchasingPower: purchasingPower
    };
  }

  // ═════════════════════════════════════════════════════════════
  // 月度结算
  // ═════════════════════════════════════════════════════════════

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
    var _cascadeRanForIncome = (GM._lastCascadeTurn === GM.turn) ||
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
    var cascadeRanThisTurn = (GM._lastCascadeTurn === GM.turn) || ((g.ledgers.money.thisTurnIn || 0) > 0);
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

    // 历史快照
    g.history.monthly.push({
      turn: GM.turn, balance: g.balance,
      income: g.monthlyIncome, expense: g.monthlyExpense, delta: g.lastDelta
    });
    if (g.history.monthly.length > 120) g.history.monthly = g.history.monthly.slice(-120);

    // 破产检查
    checkBankruptcy(mr);

    // 借款月付
    if (g.emergency.loan.active && g.emergency.loan.monthsLeft > 0) {
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

  function checkBankruptcy(mr) {
    var g = GM.guoku;
    var half = g.annualIncome * 0.5;

    if (g.balance < -half) {
      g.bankruptcy.consecutiveMonths = (g.bankruptcy.consecutiveMonths || 0) + mr;
      if (!g.bankruptcy.active) {
        g.bankruptcy.active = true;
        g.bankruptcy.severity = Math.abs(g.balance) / g.annualIncome;
        triggerBankruptcyEvent();
      }
      // 持续破产加剧
      if (g.bankruptcy.consecutiveMonths > 6) {
        g.bankruptcy.severity += 0.1 * mr;
        if (Math.random() < 0.05 * mr) {
          triggerMutinyOrFamine();
        }
      }
    } else {
      if (g.bankruptcy.active) {
        g.bankruptcy.consecutiveMonths = Math.max(0, g.bankruptcy.consecutiveMonths - mr);
        if (g.bankruptcy.consecutiveMonths < 1) {
          g.bankruptcy.active = false;
          if (typeof addEB === 'function') addEB('朝代', '帑廪渐充，财政危机解除', { credibility: 'high' });
        }
      }
    }
  }

  function triggerBankruptcyEvent() {
    if (typeof addEB === 'function') {
      addEB('朝代', '帑廪亏空，岁入不敷所出，财政危机!', { credibility: 'high' });
    }
    // 七连锁反应（见 设计方案-财政系统.md §21.10）
    if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - 10);
    if (GM.huangwei)  GM.huangwei.index = Math.max(0, GM.huangwei.index - 15);
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
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 10);
    }
    if (GM.activeDisasters && GM.activeDisasters.length > 0) {
      if (typeof addEB === 'function') addEB('朝代', '赈济不继，饥民暴起', { credibility: 'high' });
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 15);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 紧急措施（加派/借贷/开仓）
  // ═════════════════════════════════════════════════════════════

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
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - rate * 15);
      if (typeof addEB === 'function') addEB('朝代', '加派' + Math.round(rate*100) + '%，民怨骤起', { credibility: 'high' });
      return { success: true };
    },

    // 开仓放粮（紧急赈济）
    openGranary: function(scale) {
      ensureGuokuModel();
      var g = GM.guoku;
      scale = scale || 'regional';
      var cost = scale === 'national' ? 500000 :
                 scale === 'regional' ? 150000 : 50000;
      if (g.balance < cost) return { success: false, reason: '帑廪不足' };
      g.balance -= cost;
      // 民心回升
      var minxinGain = scale === 'national' ? 15 :
                       scale === 'regional' ? 8 : 3;
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + minxinGain);
      if (typeof addEB === 'function') addEB('朝代', '开仓赈济（' + scale + '）', { credibility: 'high' });
      return { success: true };
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
      if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 3);
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
      if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - percent * 20);
      // 民心微升（节俭）
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + 2);
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
      if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + percent * 30);
      if (GM.huangwei) GM.huangwei.index = Math.min(100, GM.huangwei.index + percent * 8);
      if (typeof addEB === 'function') addEB('朝代', '减赋 ' + Math.round(percent*100) + '%，民感圣恩', { credibility: 'high' });
      return { success: true };
    },

    // 发行纸币（历代险招）
    issuePaperCurrency: function(amount) {
      ensureGuokuModel();
      amount = amount || 500000;
      GM.guoku.balance += amount;
      // 立即后果：通胀、皇威损
      if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 8);
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 5);
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
      // 月均估计
      if (go.monthlyIncomeEstimate) {
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
  // 主 tick
  // ═════════════════════════════════════════════════════════════

  function tick(context) {
    ensureGuokuModel();
    var mr = (context && context._monthRatio) || getMonthRatio();
    if (context) context._guokuMonthRatio = mr;

    try { monthlySettle(mr); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'guoku] monthlySettle:') : console.error('[guoku] monthlySettle:', e); }

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
    computeTaxFlow: computeTaxFlow,
    monthlySettle: monthlySettle,
    yearlySettle: yearlySettle,
    checkBankruptcy: checkBankruptcy,
    initFromDynasty: initFromDynasty,
    DYNASTY_PRESETS: DYNASTY_PRESETS
  };

  console.log('[guoku] 引擎已加载：8 收入源 + 8 支出类 + 破产链 + 6 紧急措施 + 朝代预设');

})(typeof window !== 'undefined' ? window : this);
