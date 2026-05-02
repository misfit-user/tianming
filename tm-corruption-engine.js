// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 腐败系统 · 核心引擎
// 设计方案：设计方案-腐败系统.md
//
// 本文件实现：
//   - §2 九大来源的计算（calcSources）
//   - §3 七项后果的传导（applyConsequences 与 calc 函数）
//   - §5 真实值↔感知值的动态更新（updatePerceived）
//   - 每回合主循环（tick）
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  // ─── 工具：clamp ───
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, def) { return (v === undefined || v === null) ? (def || 0) : v; }

  function hasCatalogKeyOffice(grp) {
    var offices = Array.isArray(grp && grp.keyOffices) ? grp.keyOffices : [];
    if (!offices.length) return false;
    var catalog = null;
    try {
      catalog = (global.TM && TM.InfluenceGroups && typeof TM.InfluenceGroups.getCatalog === 'function') ? TM.InfluenceGroups.getCatalog(GM) : null;
    } catch (_) {}
    var typeCat = catalog && grp && catalog[grp.type];
    var keys = typeCat && Array.isArray(typeCat.keyOffices) ? typeCat.keyOffices : [];
    if (!keys.length) return true;
    return offices.some(function(o) {
      var text = String(o || '');
      return keys.some(function(k) { return k && text.indexOf(String(k)) >= 0; });
    });
  }

  // ─── 确保数据模型完整 ───
  function ensureCorruptionModel() {
    if (!GM.corruption) GM.corruption = {};
    var c = GM.corruption;
    if (c.trueIndex === undefined)     c.trueIndex = 30;
    if (c.perceivedIndex === undefined) c.perceivedIndex = c.trueIndex;
    if (!c.phase) c.phase = 'moderate';
    if (!c.subDepts) c.subDepts = {};
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
      if (!c.subDepts[k]) c.subDepts[k] = { true: c.trueIndex, perceived: c.trueIndex, trend: 'stable' };
      if (c.subDepts[k].trend === undefined) c.subDepts[k].trend = 'stable';
    });
    if (!c.supervision) c.supervision = { level: 40, institutions: [], recentReports: [] };
    if (!c.supervision.institutions) c.supervision.institutions = [];
    if (!c.supervision.recentReports) c.supervision.recentReports = [];
    if (!c.sources) c.sources = {
      lowSalary:0, laxSupervision:0, emergencyLevy:0, officeSelling:0,
      nepotism:0, innerCircle:0, redundancy:0, institutional:0, lumpSumSpending:0
    };
    if (!c.countermeasures) c.countermeasures = {
      standingSupervision: 0.35,
      imperialCommissioners: [],
      harshPunishment: 0,
      factionFeud: 0,
      publicAppeal: 0.5,
      purgeCampaign: null,
      salaryReform: 0,
      rotation: 0.15
    };
    if (!c.lumpSumIncidents) c.lumpSumIncidents = [];
    if (!c.entrenchedFactions) c.entrenchedFactions = [];
    if (!c.history) c.history = {
      exposedCases: [], failedInvestigations: [], purgeCampaigns: [], backlash: []
    };
  }

  // ═════════════════════════════════════════════════════════════
  // §2 九大来源的计算
  // 返回 { total, byDept:{central,provincial,military,fiscal,judicial,imperial} }
  // ═════════════════════════════════════════════════════════════

  var Sources = {
    // 2.1 俸禄过低
    lowSalary: function() {
      // 简化：从 官员平均俸禄 vs 生活成本 比
      var avgSalary  = safe(GM.officialSalary && GM.officialSalary.avg, 80);
      var livingCost = safe(GM.officialSalary && GM.officialSalary.livingCost, 100);
      var ratio = avgSalary / livingCost;
      var base = ratio >= 1.0 ? 0 : (1.0 - ratio) * 30;
      if (GM.officialSystem && GM.officialSystem.clerksPaid === false) base *= 1.5;
      return base;
    },
    // 2.2 监察松弛
    laxSupervision: function() {
      var sup = safe(GM.corruption.supervision.level, 40);
      return Math.max(0, (60 - sup) * 0.4);
    },
    // 2.3 战时/灾时加派
    emergencyLevy: function() {
      var boost = 0;
      if (GM.activeWars && GM.activeWars.length > 0) boost += 5;
      if (GM.activeDisasters && GM.activeDisasters.length > 0) boost += 4;
      if (GM.activePlague) boost += 3;
      return boost;
    },
    // 2.4 卖官鬻爵
    officeSelling: function() {
      if (!GM.juanna || !GM.juanna.active) return 0;
      var scale = safe(GM.juanna.monthlyIncome, 0) / Math.max(safe(GM.guoku && GM.guoku.monthlyIncome, 1), 1);
      return clamp(scale * 80, 0, 40);
    },
    // 2.5 裙带/荫补
    nepotism: function() {
      var yin = safe(GM.officialSystem && GM.officialSystem.yinBuRatio, 0.1);
      var family = safe(GM.factionStats && GM.factionStats.kinshipDensity, 0.1);
      return yin * 15 + family * 10;
    },
    // 2.6 宠臣/宦官/外戚
    innerCircle: function() {
      var groups = GM.influenceGroupState || {};
      var groupTotal = 0;
      Object.keys(groups).forEach(function(name) {
        var grp = groups[name];
        if (!grp || typeof grp !== 'object') return;
        if (grp.type !== 'eunuch' && grp.type !== 'waiqi' && grp.type !== 'consort') return;
        var infl = Number(grp.influence) || 0;
        if (infl < 60) return;
        var coh = Number(grp.cohesion);
        if (!isFinite(coh)) coh = 50;
        var officeBonus = hasCatalogKeyOffice(grp) ? 3 : 0;
        groupTotal += (infl - 60) * 0.4 + Math.max(0, (coh - 50) * 0.1) + officeBonus;
      });
      if (groupTotal > 0) return groupTotal;
      var chars = GM.chars || [];
      var active = chars.filter(function(c) {
        return c.influence > 80 && c.integrity < 30 && c.isImperialFavorite;
      });
      return active.reduce(function(sum, c) { return sum + (c.influence - 70) * 0.3; }, 0);
    },
    // 2.7 冗官冗员
    redundancy: function() {
      var actual = safe(GM.totalOfficials, (GM.chars || []).length);
      var ideal  = Math.max(safe(GM.idealOfficialCount,
                            Math.floor((GM.hukou && GM.hukou.registeredTotal || 1e7) / 2000)), 1);
      var excess = actual / ideal;
      return Math.max(0, (excess - 1.0) * 12);
    },
    // 2.8 制度漏洞
    institutional: function() {
      var insts = GM.dynamicInstitutions || [];
      var gap = 0;
      for (var i = 0; i < insts.length; i++) {
        var it = insts[i];
        if (!it.hasAudit)        gap += 1;
        if (!it.hasTermLimit)    gap += 1;
        if (!it.hasSupervision)  gap += 2;
        if (it.budget > 100000 && !it.hasAccountability) gap += 2;
      }
      return Math.min(gap, 15);
    },
    // 2.9 诏书巨额一次性支出（lumpSumIncidents 聚合）
    lumpSumSpending: function() {
      var total = 0;
      var incs = GM.corruption.lumpSumIncidents || [];
      for (var i = 0; i < incs.length; i++) {
        if (incs[i].status === 'closed') continue;
        total += safe(incs[i].currentCorruption, 0);
      }
      return total;
    }
  };

  // 按部门分摊来源（每源有主要目标部门）
  var SOURCE_DEPT_WEIGHTS = {
    lowSalary:      { central:0.3, provincial:0.3, military:0.15, fiscal:0.1, judicial:0.1, imperial:0.05 },
    laxSupervision: { central:0.2, provincial:0.25, military:0.2, fiscal:0.2, judicial:0.1, imperial:0.05 },
    emergencyLevy:  { provincial:0.5, fiscal:0.3, military:0.15, central:0.05 },
    officeSelling:  { central:0.5, provincial:0.3, fiscal:0.2 },
    nepotism:       { central:0.4, provincial:0.3, imperial:0.2, military:0.1 },
    innerCircle:    { imperial:0.7, central:0.3 },
    redundancy:     { central:0.4, provincial:0.4, military:0.1, fiscal:0.1 },
    institutional:  { central:0.5, fiscal:0.2, judicial:0.2, provincial:0.1 },
    lumpSumSpending:{ central:0.3, provincial:0.3, fiscal:0.2, military:0.1, imperial:0.1 }
  };

  function aggregateSources() {
    var byDept = { central:0, provincial:0, military:0, fiscal:0, judicial:0, imperial:0 };
    var sourceTotals = {};
    for (var key in Sources) {
      var val = 0;
      try { val = Sources[key]() || 0; } catch(e) { val = 0; }
      sourceTotals[key] = val;
      var weights = SOURCE_DEPT_WEIGHTS[key] || {};
      for (var dept in weights) byDept[dept] += val * weights[dept];
    }
    // 写入 GM.corruption.sources（便于 UI 显示）
    for (var k in sourceTotals) GM.corruption.sources[k] = sourceTotals[k];
    return { byDept: byDept, sourceTotals: sourceTotals };
  }

  // ═════════════════════════════════════════════════════════════
  // §3 七项后果传导
  // ═════════════════════════════════════════════════════════════

  var Consequences = {
    // 3.1 税收漏损（实征率）
    calcActualTaxRate: function() {
      var fc = GM.corruption.subDepts.fiscal.true;
      var pc = GM.corruption.subDepts.provincial.true;
      var leakage = (fc + pc) / 200 * 0.7;
      return 1 - leakage;
    },
    // 3.2 军费侵吞（空额率）
    calcMilitaryGhostRate: function() {
      var mc = GM.corruption.subDepts.military.true;
      return mc / 100 * 0.4;
    },
    // 3.3 工程质量折扣
    calcConstructionQuality: function() {
      var cc = GM.corruption.subDepts.central.true;
      var pc = GM.corruption.subDepts.provincial.true;
      return 1 - (cc + pc) / 400;
    },
    // 3.4 司法不公
    calcJudicialImpact: function() {
      var jc = GM.corruption.subDepts.judicial.true;
      return {
        wrongfulConvictionRate: jc / 100 * 0.3,
        corruptAcquittalRate:   jc / 100 * 0.4,
        civilUnrestContribution: jc * 0.3
      };
    },
    // 3.5 数据失真（AI 用）
    calcReportingBias: function() {
      var bias = {};
      ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
        var sd = GM.corruption.subDepts[d];
        bias[d] = (sd.true - sd.perceived);
      });
      return bias;
    },
    // 3.6 卖官成风 → 新官能力衰减（留 hook）
    calcOfficialQualityDecay: function() {
      var os = GM.corruption.sources.officeSelling || 0;
      var ns = GM.corruption.sources.nepotism || 0;
      return { abilityDiscount: (os + ns) / 200, integrityPenalty: (os + ns) * 0.2 };
    },
    // 3.7 内帑侵吞
    calcInnerTreasuryLeak: function() {
      var ic = GM.corruption.subDepts.imperial.true;
      var monthly = safe(GM.neitang && GM.neitang.monthlyIncome, 0);
      return monthly * (ic / 100 * 0.5);
    }
  };

  // 每回合应用后果到实际数值（tick 调用）
  function applyConsequencesPerTurn(mr) {
    mr = mr || getMonthRatio();
    // 3.1 税收漏损 → 帑廪实征
    if (GM.guoku) {
      var rate = Consequences.calcActualTaxRate();
      GM.guoku.actualTaxRate = rate;
      var nominal = safe(GM.guoku.monthlyIncome, 0);
      var actual = nominal * rate;
      var leakage = (nominal - actual) * mr;  // 按回合月数累计
      if (!GM._corrStats) GM._corrStats = {};
      GM._corrStats.lastMonthLeakage = leakage;
    }

    // 3.7 内帑侵吞 → 每月扣内帑
    if (GM.neitang) {
      var leak = Consequences.calcInnerTreasuryLeak();
      // leak 是年度值（见 calcInnerTreasuryLeak），转回合：× mr / 12
      var monthlyLeak = leak * mr / 12;
      GM.neitang.balance = Math.max(0, safe(GM.neitang.balance, 0) - monthlyLeak);
      if (!GM._corrStats) GM._corrStats = {};
      GM._corrStats.lastMonthInnerLeak = monthlyLeak;
    }

    // 3.4 司法不公 → 民心
    if (GM.minxin) {
      var ji = Consequences.calcJudicialImpact();
      GM.minxin.trueIndex = clamp(
        safe(GM.minxin.trueIndex, 50) - ji.civilUnrestContribution * 0.05 * mr,
        0, 100);
    }

    // 其他（空额率/工程质量）留待军事/工程系统实现时调用 Consequences.calcXxx()
  }

  // ═════════════════════════════════════════════════════════════
  // §5 真实值↔感知值的更新
  // ═════════════════════════════════════════════════════════════

  function calcVisibilityTier() {
    var sup = safe(GM.corruption.supervision.level, 0);
    // 简化：独立性平均用 50 作为默认
    var effectiveSup = sup * 0.7 + 15;
    if (effectiveSup >= 80) return 'accurate';
    if (effectiveSup >= 50) return 'moderate';
    if (effectiveSup >= 20) return 'vague';
    return 'blind';
  }

  function updatePerceived() {
    var c = GM.corruption;
    var sup = safe(c.supervision.level, 40);

    // 各部门感知偏差
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
      var sd = c.subDepts[k];
      var maxDelta = (100 - sup) * 0.3;   // 监察越弱 → 偏差越大
      // 粉饰偏差（始终偏正，即 perceived < true，看起来"好"）
      var downwardBias = Math.random() * maxDelta * 0.8;
      sd.perceived = clamp(sd.true - downwardBias, 0, 100);
    });

    // 全局感知（部门加权）
    var tot = 0, avg = 0;
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
      avg += c.subDepts[k].perceived;
      tot++;
    });
    c.perceivedIndex = tot > 0 ? avg / tot : c.trueIndex;

    // 可见性层
    c.visibilityTier = calcVisibilityTier();
  }

  // ═════════════════════════════════════════════════════════════
  // 主循环（每回合调用一次）
  // ═════════════════════════════════════════════════════════════

  // 工具：获取本回合代表的月数比例（1 月/回合 = 1；1 日/回合 = 1/30；1 年/回合 = 12）
  function getMonthRatio() {
    if (typeof _getDaysPerTurn === 'function') {
      return _getDaysPerTurn() / 30;
    }
    return 1;
  }

  function tick(context) {
    ensureCorruptionModel();

    // 本回合代表的月数（用于所有"月速率"换算）
    var mr = getMonthRatio();
    // 记录到 context 供 P2/P4 tick 扩展使用
    if (context) context._monthRatio = mr;

    // 1. 计算九源 → 按部门分摊
    var agg = aggregateSources();

    // 每部门自然衰减（无来源时回归）
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
      var sd = GM.corruption.subDepts[k];
      var oldTrue = sd.true;
      // 原设计：每月累计 8% 来源值。按回合换算：× mr
      var gain = (agg.byDept[k] || 0) * 0.08 * mr;
      // 基础衰减：每月 0.5%
      var decay = Math.max(0, (sd.true - 5)) * 0.005 * mr;

      // 反制机制衰减（每月速率 → 每回合）
      var cmDecay = 0;
      var cm = GM.corruption.countermeasures;
      cmDecay += cm.standingSupervision * 0.3;
      cmDecay += cm.harshPunishment * 0.4 * (sd.true > 50 ? 1 : 0.3);
      cmDecay += cm.rotation * 0.15;
      cmDecay += cm.salaryReform * 0.25;
      cmDecay += cm.publicAppeal * 0.1;
      if (cm.purgeCampaign && cm.purgeCampaign.active) cmDecay += 0.8;
      cmDecay *= mr;  // 全体反制也按月速率换算

      sd.true = clamp(sd.true + gain - decay - cmDecay, 0, 100);
      // 趋势阈值也应随时间刻度伸缩（大回合变化量自然大）
      var trendThresh = 0.3 * mr;
      sd.trend = sd.true > oldTrue + trendThresh ? 'rising' :
                 sd.true < oldTrue - trendThresh ? 'falling' : 'stable';
    });

    // 2. 总指数 = 部门加权平均
    var totalTrue = 0, n = 0;
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
      totalTrue += GM.corruption.subDepts[k].true;
      n++;
    });
    var oldIndex = GM.corruption.trueIndex;
    GM.corruption.trueIndex = n > 0 ? totalTrue / n : oldIndex;
    var gtrendThresh = 0.3 * mr;
    GM.corruption.trend = GM.corruption.trueIndex > oldIndex + gtrendThresh ? 'rising' :
                          GM.corruption.trueIndex < oldIndex - gtrendThresh ? 'falling' : 'stable';

    // 3. 更新感知值
    updatePerceived();

    // 4. lumpSum 衰减
    _decayLumpSumIncidents(mr);

    // 5. 后果应用到实际数值
    applyConsequencesPerTurn(mr);

    // 6. 临时反制衰减
    _decayCountermeasures(mr);

    // 7. 揭发事件概率（每月速率 → 每回合）
    _maybeGenerateExposure(mr);
  }

  function _decayLumpSumIncidents(mr) {
    mr = mr || getMonthRatio();
    var incs = GM.corruption.lumpSumIncidents || [];
    for (var i = 0; i < incs.length; i++) {
      var inc = incs[i];
      if (inc.status === 'closed') continue;
      if (inc.status === 'active') {
        // 缓慢爬升到 peak（每月 2%）
        inc.currentCorruption = Math.min(
          inc.peakCorruption || 20,
          safe(inc.currentCorruption, 0) + safe(inc.peakCorruption, 20) * 0.02 * mr
        );
      } else if (inc.status === 'completed' || inc.status === 'audited') {
        // 每月衰减 8% → 按月数幂次
        inc.currentCorruption = safe(inc.currentCorruption, 0) * Math.pow(0.92, mr);
        if (inc.currentCorruption < 0.5) inc.status = 'closed';
      }
    }
  }

  function _decayCountermeasures(mr) {
    mr = mr || getMonthRatio();
    var cm = GM.corruption.countermeasures;
    // 每月衰减率 × mr
    cm.harshPunishment = Math.max(0, cm.harshPunishment - 0.02 * mr);
    cm.factionFeud     = Math.max(0, cm.factionFeud - 0.03 * mr);
    if (cm.purgeCampaign && cm.purgeCampaign.turnsLeft !== undefined) {
      // turnsLeft 本就按回合
      cm.purgeCampaign.turnsLeft--;
      if (cm.purgeCampaign.turnsLeft <= 0) cm.purgeCampaign.active = false;
    }
  }

  function _maybeGenerateExposure(mr) {
    mr = mr || getMonthRatio();
    var sup = safe(GM.corruption.supervision.level, 0);
    var maxDeptCorr = 0;
    var worstDept = 'central';
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
      if (GM.corruption.subDepts[k].true > maxDeptCorr) {
        maxDeptCorr = GM.corruption.subDepts[k].true;
        worstDept = k;
      }
    });
    // 月概率 × mr → 回合概率（长回合多发，短回合概率低）
    var prob = (maxDeptCorr - 40) / 100 * (sup / 100) * 0.5 * mr;
    if (prob <= 0) return;
    if (Math.random() < prob) {
      // 通过 addEB 写入风闻录事
      if (typeof addEB === 'function') {
        var templates = [
          '某部侵吞钱粮案发',
          '地方官克扣河工银两被告发',
          '税司郎中收贿案浮出',
          '卫所克扣军饷事露'
        ];
        var t = templates[Math.floor(Math.random() * templates.length)];
        addEB('告状', t, { credibility: sup > 50 ? 'high' : 'medium' });
      }
      // 揭发后部门腐败略降
      GM.corruption.subDepts[worstDept].true = Math.max(0,
        GM.corruption.subDepts[worstDept].true - 3 - Math.random() * 5
      );
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 反制手段 · 实际效果（供面板调用）
  // ═════════════════════════════════════════════════════════════

  var Actions = {

    // 派遣钦差（立即扣银 + 持续 3 回合降腐败）
    dispatchCommissioner: function(opts) {
      opts = opts || {};
      var cost = opts.cost || 50000;
      if (GM.guoku && GM.guoku.balance < cost) {
        return { success: false, reason: '帑廪不足' };
      }
      if (GM.guoku) GM.guoku.balance -= cost;
      // 集中压一个部门腐败
      var dept = opts.targetDept || 'provincial';
      if (GM.corruption.subDepts[dept]) {
        GM.corruption.subDepts[dept].true = Math.max(0,
          GM.corruption.subDepts[dept].true - 8 - Math.random() * 8);
      }
      GM.corruption.countermeasures.imperialCommissioners.push({
        turn: GM.turn, dept: dept, duration: 3
      });
      if (typeof addEB === 'function') {
        addEB('朝代', '遣钦差赴' + _deptName(dept) + '巡查', { credibility: 'high' });
      }
      return { success: true };
    },

    // 肃贪运动（大幅降腐败 + 副作用）
    launchPurge: function(opts) {
      opts = opts || {};
      var scale = opts.scale || 'departmental';
      var reduction = scale === 'dynastyWide' ? 30 : scale === 'departmental' ? 20 : 10;
      ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
        GM.corruption.subDepts[k].true = Math.max(0,
          GM.corruption.subDepts[k].true - reduction);
      });
      // 副作用
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 5);
      GM.corruption.countermeasures.purgeCampaign = {
        active: true, scale: scale, startTurn: GM.turn, turnsLeft: 6
      };
      GM.corruption.history.purgeCampaigns.push({ scale:scale, turn:GM.turn });
      if (typeof addEB === 'function') addEB('朝代', '肃贪大计启动', { credibility: 'high' });
      return { success: true };
    },

    // 俸禄改革（长期降 lowSalary，帑廪支出倍增）
    reformSalary: function(opts) {
      opts = opts || {};
      var mult = opts.multiplier || 1.5;
      if (GM.officialSalary) {
        GM.officialSalary.avg = safe(GM.officialSalary.avg, 80) * mult;
      } else {
        GM.officialSalary = { avg: 120, livingCost: 100 };
      }
      GM.corruption.countermeasures.salaryReform = Math.min(1, 0.3 + (mult - 1));
      if (typeof addEB === 'function') addEB('朝代', '俸禄改革：官员俸禄倍增', { credibility: 'high' });
      return { success: true };
    },

    // 授意弹劾（一次性揭发，党争升级）
    factionExposure: function() {
      ['central','provincial','fiscal'].forEach(function(k) {
        GM.corruption.subDepts[k].true = Math.max(0,
          GM.corruption.subDepts[k].true - 5 - Math.random() * 5);
      });
      GM.corruption.countermeasures.factionFeud = Math.min(1,
        GM.corruption.countermeasures.factionFeud + 0.3);
      if (typeof addEB === 'function') addEB('朝代', '党人授意弹劾，朝堂震荡', { credibility: 'medium' });
      return { success: true };
    },

    // 登闻鼓疏通
    openAppeals: function() {
      GM.corruption.countermeasures.publicAppeal = Math.min(1,
        GM.corruption.countermeasures.publicAppeal + 0.25);
      if (typeof addEB === 'function') addEB('朝代', '登闻鼓畅通，民告有门', { credibility: 'high' });
      return { success: true };
    },

    // 官员轮换
    rotateOfficials: function(opts) {
      opts = opts || {};
      var freq = opts.frequency || 3;
      GM.corruption.countermeasures.rotation = 1 / freq;
      if (typeof addEB === 'function') addEB('朝代',
        '定官员轮换，每' + freq + '年一调', { credibility: 'high' });
      return { success: true };
    },

    // 酷吏肃贪（强效 + 冤狱激增）
    harshRule: function() {
      ['central','provincial','military','fiscal'].forEach(function(k) {
        GM.corruption.subDepts[k].true = Math.max(0,
          GM.corruption.subDepts[k].true - 15);
      });
      // 司法腐败反升（酷吏造冤狱）
      GM.corruption.subDepts.judicial.true = Math.min(100,
        GM.corruption.subDepts.judicial.true + 10);
      GM.corruption.countermeasures.harshPunishment = Math.min(1,
        GM.corruption.countermeasures.harshPunishment + 0.5);
      // 民心↓
      if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 8);
      if (typeof addEB === 'function') addEB('朝代', '陛下以酷吏肃贪，朝野肃然', { credibility: 'high' });
      return { success: true };
    },

    // 设特务机构
    setupSecretPolice: function(type) {
      type = type || 'jinyiwei';
      var template = {
        jinyiwei:  { name:'锦衣卫', coverage:['central','military'],    radius:90, independence:20, corruption:15, cost:50000 },
        dongchang: { name:'东厂',   coverage:['central','imperial'],    radius:100, independence:5,  corruption:20, cost:60000 },
        duchayuan: { name:'都察院', coverage:['central','provincial','judicial'], radius:70, independence:50, corruption:10, cost:35000 },
        yushitai:  { name:'御史台', coverage:['central','judicial'],    radius:60, independence:60, corruption:10, cost:20000 }
      }[type] || null;
      if (!template) return { success: false, reason: '未知机构类型' };
      if (GM.guoku && GM.guoku.balance < template.cost) return { success: false, reason: '帑廪不足' };
      if (GM.guoku) GM.guoku.balance -= template.cost;
      GM.corruption.supervision.institutions.push(Object.assign({}, template, {
        id: 'inst_' + GM.turn + '_' + Math.random().toString(36).slice(2,7),
        establishedTurn: GM.turn,
        vacancies: 0.1
      }));
      // 监察力度提升
      GM.corruption.supervision.level = Math.min(100,
        safe(GM.corruption.supervision.level, 40) + 15);
      if (typeof addEB === 'function') addEB('朝代', '陛下诏设' + template.name, { credibility: 'high' });
      return { success: true };
    }
  };

  // ─── 工具：部门中文名 ───
  function _deptName(k) {
    return { central:'中央', provincial:'地方', military:'军队',
             fiscal:'税司', judicial:'司法', imperial:'内廷' }[k] || k;
  }

  // ═════════════════════════════════════════════════════════════
  // §11 朝代预设表（12 朝 × 4 阶段）
  // ═════════════════════════════════════════════════════════════

  var DYNASTY_PRESETS = {
    // 每项：[开国 founding, 全盛 peak, 中衰 decline, 末世 collapse]
    // 及部门偏好（哪些部门高于/低于平均）
    '秦': { phases:[20,25,40,65], emphasis:{ central:+5, military:+3 } },
    '汉': { phases:[15,30,50,80], emphasis:{ imperial:+10, central:+5 } }, // 外戚宦官
    '魏晋': { phases:[20,35,55,75], emphasis:{ central:+10, imperial:+5 } }, // 门阀
    '唐': { phases:[20,30,55,85], emphasis:{ imperial:+15, provincial:+10 } }, // 宦官+藩镇
    '五代': { phases:[50,55,65,85], emphasis:{ military:+20 } }, // 武人跋扈
    '北宋': { phases:[25,35,45,70], emphasis:{ central:+8, judicial:+3 } }, // 冗官
    '南宋': { phases:[30,40,55,75], emphasis:{ central:+10, imperial:+5 } }, // 权相
    '元': { phases:[40,50,70,85], emphasis:{ provincial:+10, fiscal:+8 } }, // 色目豪强
    '明': { phases:[15,25,60,85], emphasis:{ imperial:+20, central:+8 } }, // 宦官专权
    '清': { phases:[10,25,55,80], emphasis:{ imperial:+5, fiscal:+5 } }, // 和珅后期
    '上古': { phases:[5,15,30,50], emphasis:{} }, // 三代
    '民国': { phases:[40,50,65,80], emphasis:{ military:+10, provincial:+10 } }
  };

  // 阶段名 → 索引
  var PHASE_INDEX = {
    founding:0, 'founding':0, peak:1, 'peak':1,
    decline:2, 'decline':2, collapse:3, 'collapse':3,
    // 中文兼容
    '开国':0, '全盛':1, '守成':1, '中衰':2, '末世':3, '衰落':2
  };

  // 剧本加载时调用（或手动初始化）
  // scenarioOverride: 可选，从剧本对象传入 { corruption: {...} } 覆盖朝代预设
  // 支持的覆盖字段：
  //   trueIndex: number               // 全局腐败指数 0-100
  //   subDepts: {                     // 六部门真实值
  //     central:{true:N}, provincial:{true:N}, military:{true:N},
  //     fiscal:{true:N}, judicial:{true:N}, imperial:{true:N}
  //   }
  //   supervision: { level: N, institutions: [...] }
  //   entrenchedFactions: [{ name, dept, strength, years }]
  function initFromDynasty(dynasty, phase, scenarioOverride) {
    ensureCorruptionModel();

    // 先应用朝代预设作为基础
    var preset = DYNASTY_PRESETS[dynasty];
    if (!preset) {
      for (var k in DYNASTY_PRESETS) {
        if (dynasty && dynasty.indexOf(k) !== -1) { preset = DYNASTY_PRESETS[k]; break; }
      }
    }
    if (!preset) preset = { phases:[20,30,50,70], emphasis:{} };
    var pi = PHASE_INDEX[phase] !== undefined ? PHASE_INDEX[phase] : 1;
    var base = preset.phases[pi];

    GM.corruption.trueIndex = base;
    GM.corruption.perceivedIndex = Math.max(0, base - 8);

    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
      var off = preset.emphasis[d] || 0;
      var v = clamp(base + off + (Math.random() - 0.5) * 8, 0, 100);
      GM.corruption.subDepts[d].true = v;
      GM.corruption.subDepts[d].perceived = Math.max(0, v - 5 - Math.random() * 10);
      GM.corruption.subDepts[d].trend = pi >= 2 ? 'rising' : 'stable';
    });

    var supByPhase = [60, 55, 40, 25];
    GM.corruption.supervision.level = supByPhase[pi];

    // 再应用剧本覆盖（可部分覆盖，未指定的字段保留朝代预设）
    var overridden = false;
    if (scenarioOverride && scenarioOverride.corruption) {
      var cc = scenarioOverride.corruption;
      overridden = true;
      if (typeof cc.trueIndex === 'number') {
        GM.corruption.trueIndex = clamp(cc.trueIndex, 0, 100);
      }
      if (cc.subDepts) {
        ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
          if (cc.subDepts[d] && typeof cc.subDepts[d].true === 'number') {
            GM.corruption.subDepts[d].true = clamp(cc.subDepts[d].true, 0, 100);
            GM.corruption.subDepts[d].perceived = Math.max(0, cc.subDepts[d].true - 5);
          }
        });
      }
      if (cc.supervision) {
        if (typeof cc.supervision.level === 'number') {
          GM.corruption.supervision.level = clamp(cc.supervision.level, 0, 100);
        }
        if (Array.isArray(cc.supervision.institutions)) {
          // 合并：已有 + 剧本新增
          cc.supervision.institutions.forEach(function(inst) {
            GM.corruption.supervision.institutions.push(Object.assign({
              id: 'inst_preset_' + Math.random().toString(36).slice(2, 7),
              establishedTurn: 1,
              vacancies: 0.1
            }, inst));
          });
        }
      }
      if (Array.isArray(cc.entrenchedFactions)) {
        cc.entrenchedFactions.forEach(function(f) {
          GM.corruption.entrenchedFactions.push(Object.assign({
            id: 'faction_preset_' + Math.random().toString(36).slice(2, 5),
            formedTurn: 1,
            status: 'active',
            wealthHoarded: 1000000,
            patrons: []
          }, f));
        });
      }
    }

    return {
      dynasty: dynasty, phase: phase, base: base, preset: preset,
      overridden: overridden
    };
  }

  // ═════════════════════════════════════════════════════════════
  // §6.2 腐败集团凝聚（entrenched factions）
  // 触发：某部门持续 > 60 腐败超过 60 月
  // ═════════════════════════════════════════════════════════════

  // 历史腐败集团模板（按部门）
  var FACTION_TEMPLATES = {
    fiscal:     [
      { name:'盐商党',     historical:'清代扬州盐商' },
      { name:'钞关党',     historical:'明代钞关利益集团' },
      { name:'漕运党',     historical:'清代漕帮' }
    ],
    military:   [
      { name:'卫所党',     historical:'明代卫所军官世袭' },
      { name:'九边将门',   historical:'明末辽东将门' },
      { name:'禁军将勋',   historical:'宋初禁军利益集团' }
    ],
    central:    [
      { name:'阉党',       historical:'魏忠贤阉党' },
      { name:'严党',       historical:'嘉靖严嵩党' },
      { name:'和珅一脉',   historical:'乾隆后期和珅集团' }
    ],
    provincial: [
      { name:'豪强势族',   historical:'东汉门阀豪强' },
      { name:'督抚私党',   historical:'清末地方督抚' },
      { name:'土司党',     historical:'西南土司盘踞' }
    ],
    judicial:   [
      { name:'讼师党',     historical:'明清讼师集团' },
      { name:'刑部奸胥',   historical:'各代刑部书吏' }
    ],
    imperial:   [
      { name:'宦官集团',   historical:'明代司礼监' },
      { name:'外戚集团',   historical:'汉代外戚' },
      { name:'后宫干政',   historical:'武韦之祸' }
    ]
  };

  function checkFactionFormation(context) {
    ensureCorruptionModel();
    if (!GM._corrDeptLongTerm) GM._corrDeptLongTerm = {};
    var longTerm = GM._corrDeptLongTerm;
    var mr = (context && context._monthRatio) || getMonthRatio();

    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
      var sd = GM.corruption.subDepts[d];
      if (sd.true > 60) {
        // counter 追踪"月数"而非回合数
        longTerm[d] = (longTerm[d] || 0) + mr;
      } else {
        longTerm[d] = Math.max(0, (longTerm[d] || 0) - 2 * mr);
      }

      // 持续 60 月以上 → 概率生成集团（概率按月随 mr 缩放）
      if (longTerm[d] >= 60) {
        var existing = GM.corruption.entrenchedFactions.filter(function(f) { return f.dept === d; });
        if (existing.length === 0 && Math.random() < 0.15 * mr) {
          var templates = FACTION_TEMPLATES[d] || [];
          if (templates.length === 0) return;
          var t = templates[Math.floor(Math.random() * templates.length)];
          var faction = {
            id: 'faction_' + GM.turn + '_' + d,
            name: t.name,
            historical: t.historical,
            dept: d,
            strength: 40 + Math.floor(Math.random() * 30),
            years: Math.floor(longTerm[d] / 12),
            wealthHoarded: 500000 + Math.floor(Math.random() * 2000000),
            patrons: [],
            formedTurn: GM.turn,
            status: 'active'
          };
          GM.corruption.entrenchedFactions.push(faction);
          if (typeof addEB === 'function') {
            addEB('朝代', '「' + faction.name + '」盘根错节，已成气候', {
              credibility: 'high', subject: faction.id
            });
          }
          longTerm[d] = 0; // 触发后重置
        }
      }
    });

    // 集团自身腐败加剧（每月速率 → 按回合）
    GM.corruption.entrenchedFactions.forEach(function(f) {
      if (f.status !== 'active') return;
      f.strength = Math.min(100, f.strength + 0.3 * mr);
      // 按月数换算年
      var monthsElapsed = (GM.turn - f.formedTurn) * mr;
      f.years = monthsElapsed / 12;
      if (GM.corruption.subDepts[f.dept]) {
        GM.corruption.subDepts[f.dept].true = Math.min(100,
          GM.corruption.subDepts[f.dept].true + 0.05 * mr);
      }
    });
  }

  // ═════════════════════════════════════════════════════════════
  // §6.3 反噬事件
  // ═════════════════════════════════════════════════════════════

  function checkBacklash(context) {
    ensureCorruptionModel();
    var cm = GM.corruption.countermeasures;
    if (!GM._corrBacklashCounters) GM._corrBacklashCounters = {
      harshAccum:0, factionFeudAccum:0, secretPoliceAccum:0, purgeHistory:0
    };
    var counters = GM._corrBacklashCounters;
    var mr = (context && context._monthRatio) || getMonthRatio();

    // 酷吏反噬：harshPunishment 持续 > 0.5 超过 24 月 → 反弹
    if (cm.harshPunishment > 0.5) {
      counters.harshAccum = (counters.harshAccum || 0) + mr;
      if (counters.harshAccum > 24 && Math.random() < 0.05 * mr) {
        _triggerBacklash('harshOfficialBacklash',
          '酷吏来俊臣之流被清算，朝野方知冤狱之惨',
          function() {
            GM.corruption.subDepts.judicial.true += 15;
            GM.corruption.countermeasures.harshPunishment = 0;
            if (GM.minxin) GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + 5);
            if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 8);
          });
        counters.harshAccum = 0;
      }
    } else {
      counters.harshAccum = Math.max(0, (counters.harshAccum || 0) - mr);
    }

    // 党争祸：factionFeud 持续 > 0.5 超过 36 月 → 党祸
    if (cm.factionFeud > 0.5) {
      counters.factionFeudAccum = (counters.factionFeudAccum || 0) + mr;
      if (counters.factionFeudAccum > 36 && Math.random() < 0.04 * mr) {
        _triggerBacklash('partyFeudDisaster',
          '党祸连坐数百人，朝政瘫痪',
          function() {
            GM.corruption.countermeasures.factionFeud = 0;
            if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - 10);
            if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 8);
            // 清流大批辞官
            if (GM.chars) {
              var quit = 0;
              GM.chars.forEach(function(c) {
                if (c.integrity > 70 && Math.random() < 0.1) { c.retired = true; quit++; }
              });
              if (quit > 0 && typeof addEB === 'function') {
                addEB('人事', '党祸之后，清流挂冠者 ' + quit + ' 人', { credibility: 'high' });
              }
            }
          });
        counters.factionFeudAccum = 0;
      }
    } else {
      counters.factionFeudAccum = Math.max(0, (counters.factionFeudAccum || 0) - mr);
    }

    // 特务机构反噬：机构自身腐败 > 60 持续 > 36 月
    var spInsts = (GM.corruption.supervision.institutions || []).filter(function(i) {
      return i.name === '锦衣卫' || i.name === '东厂' || i.name === '西厂';
    });
    if (spInsts.length > 0) {
      var maxSpCorr = Math.max.apply(null, spInsts.map(function(i) { return i.corruption || 0; }));
      if (maxSpCorr > 60) {
        counters.secretPoliceAccum = (counters.secretPoliceAccum || 0) + mr;
        if (counters.secretPoliceAccum > 36 && Math.random() < 0.05 * mr) {
          _triggerBacklash('eunuchSupremacy',
            '特务坐大，反噬朝廷；今见厂卫欺君，朝野震悚',
            function() {
              spInsts.forEach(function(i) { i.corruption += 15; });
              GM.corruption.subDepts.imperial.true += 10;
              if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - 8);
            });
          counters.secretPoliceAccum = 0;
        }
      } else {
        counters.secretPoliceAccum = Math.max(0, (counters.secretPoliceAccum || 0) - mr);
      }
    }

    // 腐败集团坐大反咬（月概率 0.02 × mr）
    GM.corruption.entrenchedFactions.forEach(function(f) {
      if (f.status === 'active' && f.strength > 80 && Math.random() < 0.02 * mr) {
        _triggerBacklash('factionRevealed',
          '「' + f.name + '」竟遣党羽攻讦朝中正直',
          function() {
            f.strength = 100;
            if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - 5);
          });
      }
    });
  }

  function _triggerBacklash(type, message, effectFn) {
    if (typeof addEB === 'function') {
      addEB('朝代', message, { credibility: 'high' });
    }
    if (effectFn) try { effectFn(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption] backlash error:') : console.error('[corruption] backlash error:', e); }
    GM.corruption.history.backlash.push({
      type: type, turn: GM.turn, message: message
    });
  }

  // ═════════════════════════════════════════════════════════════
  // §7 腐败 → 其他变量联动（每回合调用）
  // ═════════════════════════════════════════════════════════════

  function applyCrossLinkage(context) {
    ensureCorruptionModel();
    var c = GM.corruption;
    var mr = (context && context._monthRatio) || getMonthRatio();

    // 腐败 → 军事（空额率是即时状态，士气是累积扣）
    if (GM.armies && GM.armies.length > 0) {
      var mc = c.subDepts.military.true;
      var ghostRate = mc / 100 * 0.4;
      GM.armies.forEach(function(a) {
        a._effectiveSize = Math.floor((a.size || 0) * (1 - ghostRate));
        // 士气按月扣 0.2 → 按回合月数
        if (mc > 50) a.morale = Math.max(0, (a.morale || 50) - 0.2 * mr);
      });
    }

    // 腐败 → 户口（隐户加速）
    if (GM.hukou) {
      var pc = c.subDepts.provincial.true;
      if (pc > 60) {
        // 原每月逃户率 → 按回合月数
        var fleeRate = (pc - 60) * 0.00008 * mr;
        var lost = Math.floor(GM.hukou.registeredTotal * fleeRate);
        GM.hukou.registeredTotal = Math.max(0, GM.hukou.registeredTotal - lost);
        GM.hukou.estimatedHidden = (GM.hukou.estimatedHidden || 0) + lost;
        GM.hukou.lastDelta = (GM.hukou.lastDelta || 0) - lost;
      }
    }

    // 腐败 → 皇权（每月扣 0.3 → 按月数）
    if (GM.huangquan && c.trueIndex > 70) {
      GM.huangquan.index = Math.max(0, GM.huangquan.index - 0.3 * mr);
      if (!GM.huangquan.drains) GM.huangquan.drains = {};
      GM.huangquan.drains.trustedMinister = (GM.huangquan.drains.trustedMinister || 0) + 0.3 * mr;
    }

    // 腐败 → 皇威（每月扣 0.2 → 按月数）
    if (GM.huangwei && c.trueIndex > 75) {
      GM.huangwei.index = Math.max(0, GM.huangwei.index - 0.2 * mr);
      if (!GM.huangwei.drains) GM.huangwei.drains = {};
      GM.huangwei.drains.lostVirtueRumor = (GM.huangwei.drains.lostVirtueRumor || 0) + 0.2 * mr;
    }

    // 冗官和卖官导致新官能力衰减（每月扣 → 按月数）
    var decay = Consequences.calcOfficialQualityDecay();
    if (decay.integrityPenalty > 0 && GM.chars) {
      GM.chars.forEach(function(ch) {
        if (ch.isRecentAppointment) {
          ch.integrity = Math.max(0, (ch.integrity || 50) - decay.integrityPenalty * 0.05 * mr);
          if (ch.abilities) {
            ch.abilities.administration = Math.max(0,
              (ch.abilities.administration || 60) * (1 - decay.abilityDiscount * 0.1 * mr));
          }
        }
      });
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 改造 tick() → 调用新增 P1 模块
  // ═════════════════════════════════════════════════════════════

  var _origTick = tick;
  tick = function(context) {
    ensureCorruptionModel();
    _origTick(context);
    // P1 扩展
    try { checkFactionFormation(context); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption] checkFactionFormation:') : console.error('[corruption] checkFactionFormation:', e); }
    try { checkBacklash(context); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption] checkBacklash:') : console.error('[corruption] checkBacklash:', e); }
    try { applyCrossLinkage(context); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption] applyCrossLinkage:') : console.error('[corruption] applyCrossLinkage:', e); }
  };

  // ─── 导出到全局 ───
  global.CorruptionEngine = {
    tick: tick,
    ensureModel: ensureCorruptionModel,
    updatePerceived: updatePerceived,
    calcVisibilityTier: calcVisibilityTier,
    getMonthRatio: getMonthRatio,
    Sources: Sources,
    Consequences: Consequences,
    Actions: Actions,
    _deptName: _deptName,
    // P1
    initFromDynasty: initFromDynasty,
    DYNASTY_PRESETS: DYNASTY_PRESETS,
    checkFactionFormation: checkFactionFormation,
    checkBacklash: checkBacklash,
    applyCrossLinkage: applyCrossLinkage,
    FACTION_TEMPLATES: FACTION_TEMPLATES
  };

})(typeof window !== 'undefined' ? window : this);
