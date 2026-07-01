// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Module: tm-corruption-engine.js — 腐败系统 · 核心引擎 (Phase 3 R9·3→1 LAYERED 链合并)
// Domain: 腐败 / 九大来源 / 七项后果 / 真实值与感知值 / clique 朋党 / juanna 捐纳赦免
// Status: active · Last Updated: 2026-05-04 (Phase 3 R9·nested IIFE merge·吸 p2/p4)
// Owner: TM 团队
// Imports: GM·EventBus·addEB·SettlementPipeline·_adjAuthority
// Exports: global.CorruptionEngine (init/tick/calcSources/applyConsequences/updatePerceived 等)·global.CorruptionP2 / CorruptionP4 (nested 子 namespace·保 layer 边界)
// Used by: tm-game-loop·tm-endturn-systems·smoke-corruption-* (8 smoke·56 assertions)
// Side effects: GM.corruption mutation·EventBus.emit·SettlementPipeline.register·_adjAuthority 调用·DOM (panel via callers)
// Test: smoke-corruption-* 8 项·56 assertions·R8 baseline 锁
// Notes: 设计方案-腐败系统.md
//        本文件实现·§2 九大来源 calcSources·§3 七项后果 applyConsequences·§5 真实值↔感知值 updatePerceived·每回合 tick
//        Phase 3 R9 (2026-05-04·Codex)·nested IIFE merge (保 p2/p4 layer 边界·console 启动 log 3 行)·吸 tm-corruption-p2 (MIXED APPEND + OVERRIDE engine.tick·v2·693 行) + tm-corruption-p4 (LAYERED 终端·OVERRIDE engine + p2 tick·v3 最终·560 行)·3→1 net -2 文件
//        Phase 3 R8 (2026-05-04)·8 smoke baseline 锁 (tick-full-pass·detection-event·impact-on-treasury·purge-and-asset-seize·yearly-evaluate·clique-formation·ai-detect-prompt·pardon-and-restore)·R9 merge 全程 zero regression
// ============================================================

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
    if (c.overall === undefined)       c.overall = c.trueIndex;
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

  var CORR_DEPTS = ['central','provincial','military','fiscal','judicial','imperial'];

  function _averageDeptTrue(c) {
    var total = 0, n = 0;
    c = c || (GM && GM.corruption);
    if (!c || !c.subDepts) return NaN;
    CORR_DEPTS.forEach(function(k) {
      var sd = c.subDepts[k];
      if (!sd) return;
      var v = Number(sd.true);
      if (!isFinite(v)) return;
      total += v;
      n++;
    });
    return n > 0 ? total / n : NaN;
  }

  function _syncPerceivedAverage(c, fallback) {
    var total = 0, n = 0;
    if (!c || !c.subDepts) return;
    CORR_DEPTS.forEach(function(k) {
      var sd = c.subDepts[k];
      if (!sd) return;
      if (typeof sd.true === 'number' && isFinite(sd.true) &&
          typeof sd.perceived === 'number' && isFinite(sd.perceived) &&
          sd.perceived > sd.true) {
        sd.perceived = sd.true;
      }
      var p = Number(sd.perceived);
      if (!isFinite(p)) return;
      total += p;
      n++;
    });
    c.perceivedIndex = n > 0 ? clamp(total / n, 0, 100) : fallback;
    c.visibilityTier = calcVisibilityTier();
  }

  function _pushTurnReason(entry, reason) {
    if (!reason) return;
    entry.reasons = entry.reasons || [];
    var exists = entry.reasons.some(function(r) { return r && r.desc === reason; });
    if (!exists) entry.reasons.push({ desc: reason });
  }

  function _recordCorruptionIndexChange(oldVal, newVal, reason) {
    if (!isFinite(oldVal) || !isFinite(newVal) || Math.abs(newVal - oldVal) < 1e-6) return;
    if (!GM.turnChanges) GM.turnChanges = {};
    if (!Array.isArray(GM.turnChanges.variables)) GM.turnChanges.variables = [];
    var path = 'corruption.trueIndex';
    var existing = GM.turnChanges.variables.find(function(v) { return v && v.path === path; });
    if (existing) {
      existing.newValue = newVal;
      _pushTurnReason(existing, reason);
      return;
    }
    var entry = {
      name: '\u540f\u6cbb',
      path: path,
      oldValue: oldVal,
      newValue: newVal,
      reasons: []
    };
    _pushTurnReason(entry, reason);
    GM.turnChanges.variables.push(entry);
  }

  function syncIndexFromSubDepts(reason, opts) {
    opts = opts || {};
    ensureCorruptionModel();
    var c = GM.corruption;
    var oldIndex = Number(c.trueIndex);
    if (!isFinite(oldIndex)) oldIndex = _averageDeptTrue(c);
    var next = _averageDeptTrue(c);
    if (!isFinite(next)) return c.trueIndex;
    next = clamp(next, 0, 100);
    c.trueIndex = next;
    c.overall = next;
    _syncPerceivedAverage(c, next);
    var threshold = typeof opts.trendThreshold === 'number' ? opts.trendThreshold : 0.0001;
    c.trend = next > oldIndex + threshold ? 'rising' :
              next < oldIndex - threshold ? 'falling' : 'stable';
    if (opts.record !== false) _recordCorruptionIndexChange(oldIndex, next, reason);
    return next;
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
    GM.corruption.overall = GM.corruption.trueIndex;
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
    syncIndexFromSubDepts(null, { record: false, trendThreshold: 0.3 * mr });
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
      syncIndexFromSubDepts('\u9063\u94a6\u5dee\u5de1\u67e5');
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
      if (GM.corruption.history.purgeCampaigns.length > 200) GM.corruption.history.purgeCampaigns = GM.corruption.history.purgeCampaigns.slice(-200);
      if (typeof addEB === 'function') addEB('朝代', '肃贪大计启动', { credibility: 'high' });
      syncIndexFromSubDepts('\u8083\u8d2a\u8fd0\u52a8');
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
      syncIndexFromSubDepts('\u6388\u610f\u5f39\u52be');
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
      syncIndexFromSubDepts('\u9177\u540f\u8083\u8d2a');
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
    GM.corruption.overall = GM.corruption.trueIndex;
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
        GM.corruption.overall = GM.corruption.trueIndex;
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
            if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
              global.AuthorityEngines.adjustHuangquan('factionConsuming', -10, '\u53cd\u8150\u515a\u4e89\u5931\u63a7');
            } else if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - 10);
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
              if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
                global.AuthorityEngines.adjustHuangquan('eunuchsRelatives', -8, '\u5382\u536b\u5750\u5927\u53cd\u566c');
              } else if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - 8);
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
            if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
              global.AuthorityEngines.adjustHuangquan('factionConsuming', -5, '\u8150\u8d25\u96c6\u56e2\u653b\u8ba6\u671d\u653f');
            } else if (GM.huangquan) GM.huangquan.index = Math.max(0, GM.huangquan.index - 5);
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
    if (GM.corruption.history.backlash.length > 200) GM.corruption.history.backlash = GM.corruption.history.backlash.slice(-200);
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
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('trustedMinister', -0.3 * mr, '\u8150\u8d25\u4fb5\u8680\u4e2d\u67a2');
      } else {
        GM.huangquan.index = Math.max(0, GM.huangquan.index - 0.3 * mr);
        if (!GM.huangquan.drains) GM.huangquan.drains = {};
        GM.huangquan.drains.trustedMinister = (GM.huangquan.drains.trustedMinister || 0) + 0.3 * mr;
      }
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
    syncIndexFromSubDepts: syncIndexFromSubDepts,
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

// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 腐败系统 P2 扩展
// 依赖：tm-corruption-engine.js
//
// ⚠ 补丁分类（2026-04-24 R12 评估）：MIXED
//   · APPEND 部分：EXPOSURE_CASES/generateExposureCase/applyCaseHandling
//                  /pushLumpSumIncident/markAsRecentAppointment/snapshotHistory
//   · OVERRIDE 部分：CorruptionEngine.tick（覆盖 engine 原 tick）
//   覆盖链：engine v1 → p2 v2 → p4 v3（最终版）
//   合并指引见 PATCH_CLASSIFICATION.md · Corruption 段
//
// 实现：
//   - §6.1 揭发事件库（25 条历史案件 + handlingOptions）
//   - §2.9 接口 pushLumpSumIncident（供诏令系统推入巨额支出）
//   - §9.7 风闻四类（风议/密札/耳报）的补全
//   - 新官 isRecentAppointment 标记 + 自动衰减
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  if (typeof CorruptionEngine === 'undefined') {
    console.warn('[corruption-p2] CorruptionEngine 未加载，P2 跳过');
    return;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, def) { return (v === undefined || v === null) ? (def || 0) : v; }

  // ═════════════════════════════════════════════════════════════
  // §6.1 揭发事件库（25 条）
  // ═════════════════════════════════════════════════════════════

  // 标准处置选项模板（省代码）
  function _optStrict() {
    return { id:'strict', label:'三法司严审',
             cost:{ partyStrife:+20, stress:+15 },
             benefit:{ corruption:-10, minxin:+3, huangwei:+4 },
             historical:'交三法司会审，以儆效尤' };
  }
  function _optModerate() {
    return { id:'moderate', label:'查办首恶',
             cost:{ partyStrife:+8 },
             benefit:{ corruption:-5, minxin:+1 },
             historical:'惩首不及众' };
  }
  function _optCoverUp() {
    return { id:'cover', label:'下不为例',
             cost:{ huangwei:-5, huangquan:-3 },
             benefit:{ partyStrife:-5 },
             historical:'以朝局为重，和光同尘' };
  }
  function _optLeaveItAlone() {
    return { id:'leave', label:'留中不发',
             cost:{ huangwei:-2 },
             benefit:{},
             historical:'扣压奏疏，不予处置' };
  }

  // 案件库
  var EXPOSURE_CASES = [
    // ── 地方类 ──
    { id:'riverWork', name:'河工银被侵案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:50 }, severity:'major',
      evidence:'堤坝决口、账册亏缺、工匠口供',
      suspects:['workMinister','regionalOfficial'],
      textFn:function(d){ return '河工案：' + d.amount + '两工银被克，堤坝甫就即溃'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    { id:'magistrateExtortion', name:'知府勒索案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:55 }, severity:'moderate',
      evidence:'民告状、账册、证人',
      suspects:['prefect'],
      textFn:function(d){ return '某府知府岁敛民财' + d.amount + '两，百姓告至京师'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'reliefDiverted', name:'赈灾截留案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:55, hasFamine:true }, severity:'major',
      evidence:'赈银账册、灾民证词、仓粮实核',
      suspects:['regionalOfficial','granaryOfficer'],
      textFn:function(d){ return '灾区赈银' + d.amount + '两被层层截留，饥民呼号'; },
      options:[_optStrict(),
        { id:'dispatch', label:'遣钦差赈济', cost:{ guoku:-80000 },
          benefit:{ corruption:-8, minxin:+10 }, historical:'钦差复赈，以安民心' },
        _optCoverUp()] },

    { id:'fuShouOverage', name:'浮收加派案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:55 }, severity:'moderate',
      evidence:'税单对照、民间实缴凭证',
      suspects:['regionalOfficial'],
      textFn:function(d){ return '某省浮收加派，民实缴' + d.amount + '两，官府仅入三成'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'frontierPostBully', name:'驿站敲诈案', dept:'provincial',
      trigger:{ dept:'provincial', minTrue:50 }, severity:'minor',
      evidence:'过客申诉、驿马账',
      suspects:['postmaster'],
      textFn:function(d){ return '驿站敲诈过往官差' + d.amount + '文，商旅不行'; },
      options:[_optModerate(), _optLeaveItAlone(),
        { id:'replace', label:'更换驿官', cost:{}, benefit:{ corruption:-2 } }] },

    // ── 中央类 ──
    { id:'examBribery', name:'科场贿赂案', dept:'central',
      trigger:{ dept:'central', minTrue:50, examYear:true }, severity:'major',
      evidence:'考生笔迹、主考家宅查抄',
      suspects:['examMinister','hanlin'],
      textFn:function(d){ return '科场案：举子行贿' + d.amount + '两得第，京师哗然'; },
      options:[
        { id:'behead', label:'两主考斩决', cost:{ huangwei:-3, partyStrife:+10 },
          benefit:{ corruption:-15, minxin:+5, huangwei:+8 },
          historical:'清丁酉、咸丰顺天科场案均有主考斩决' },
        _optModerate(), _optCoverUp()] },

    { id:'sellOffice', name:'卖官鬻爵案', dept:'central',
      trigger:{ dept:'central', minTrue:50, hasSellOffice:true }, severity:'major',
      evidence:'授官名录、收银账册',
      suspects:['nepotist','courtFavorite'],
      textFn:function(d){ return '朝中有卖官案，某员鬻银' + d.amount + '两授某职'; },
      options:[_optStrict(),
        { id:'stop', label:'立即罢捐纳', cost:{ guoku:-50000 },
          benefit:{ corruption:-10, minxin:+5 }, historical:'停办捐纳' },
        _optCoverUp()] },

    { id:'workshopLoss', name:'工部营造损耗案', dept:'central',
      trigger:{ dept:'central', minTrue:50 }, severity:'moderate',
      evidence:'物料账与实核差距、督工口供',
      suspects:['workMinister'],
      textFn:function(d){ return '工部营造损耗' + d.amount + '两，虚报冒领'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'examSelling', name:'学政卖题案', dept:'central',
      trigger:{ dept:'central', minTrue:55, hasJudicial:true }, severity:'major',
      evidence:'试题流出、考生证词',
      suspects:['examMinister'],
      textFn:function(d){ return '学政鬻题' + d.amount + '两，士林哗然'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    { id:'bribedInvestigator', name:'钦差贪污案', dept:'central',
      trigger:{ dept:'central', minTrue:60 }, severity:'major',
      evidence:'同行供词、行李察验',
      suspects:['imperialCommissioner'],
      textFn:function(d){ return '钦差巡抚受贿' + d.amount + '两，反助地方掩饰'; },
      options:[
        { id:'execute', label:'立斩钦差', cost:{ partyStrife:+15 },
          benefit:{ corruption:-12, huangwei:+5 } },
        _optStrict(), _optCoverUp()] },

    // ── 军事类 ──
    { id:'militaryPayCut', name:'军饷克扣案', dept:'military',
      trigger:{ dept:'military', minTrue:50 }, severity:'major',
      evidence:'士卒喧哗、营中告举',
      suspects:['militaryMinister','general'],
      textFn:function(d){ return '某营军饷被克' + d.amount + '两，士气动摇'; },
      options:[_optStrict(),
        { id:'makeup', label:'补发饷银', cost:{ guoku:-100000 },
          benefit:{ corruption:-6, armyMorale:+10 }, historical:'迅速补发以安军心' },
        _optCoverUp()] },

    { id:'ghostMuster', name:'卫所吃空额案', dept:'military',
      trigger:{ dept:'military', minTrue:55 }, severity:'moderate',
      evidence:'点兵实核、粮饷账',
      suspects:['weisoCommander'],
      textFn:function(d){ return '某卫名册五千，实员不及三千，冒支饷银' + d.amount + '两'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'borderPayCut', name:'边饷克扣案', dept:'military',
      trigger:{ dept:'military', minTrue:60, hasWar:true }, severity:'major',
      evidence:'戍卒哗变、账目查勘',
      suspects:['borderGeneral'],
      textFn:function(d){ return '九边饷银被克' + d.amount + '两，戍卒几欲哗变'; },
      options:[
        { id:'urgent', label:'急发帑银', cost:{ guoku:-200000 },
          benefit:{ corruption:-10, armyMorale:+15, huangwei:+5 } },
        _optStrict(), _optCoverUp()] },

    { id:'weaponFraud', name:'军械伪劣案', dept:'military',
      trigger:{ dept:'military', minTrue:50 }, severity:'moderate',
      evidence:'战场遗器、匠人供词',
      suspects:['workMinister','armorer'],
      textFn:function(d){ return '所进军械多为伪劣，工部侵银' + d.amount + '两'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    // ── 税司类 ──
    { id:'saltGangCollusion', name:'盐商勾结案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:55 }, severity:'major',
      evidence:'盐引簿册、商账相校',
      suspects:['saltCommissioner','merchant'],
      textFn:function(d){ return '盐政与商勾连，漏税' + d.amount + '两'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    { id:'tollPostGreased', name:'钞关私肥案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:50 }, severity:'moderate',
      evidence:'过关账目、商队证言',
      suspects:['tollOfficer'],
      textFn:function(d){ return '某钞关私收' + d.amount + '两，过商不收印'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'grainTransportFraud', name:'漕运舞弊案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:55 }, severity:'major',
      evidence:'漕船察验、仓粮实核',
      suspects:['grainCommissioner'],
      textFn:function(d){ return '漕运舞弊，缺粮' + d.amount + '石'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    { id:'mintEmbezzle', name:'铸局贪墨案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:55 }, severity:'moderate',
      evidence:'铜铅出入账、钱样实验',
      suspects:['mintOfficer'],
      textFn:function(d){ return '宝泉/宝源局贪墨铜铅' + d.amount + '斤，铸钱成色不足'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'treasuryShortage', name:'府库亏空案', dept:'fiscal',
      trigger:{ dept:'fiscal', minTrue:60 }, severity:'major',
      evidence:'历年账簿盘点',
      suspects:['fiscalMinister','regionalOfficial'],
      textFn:function(d){ return '某府库亏空' + d.amount + '两，历任累积'; },
      options:[
        { id:'pursue', label:'追究历任',
          cost:{ partyStrife:+15 }, benefit:{ corruption:-8, guoku:+50000 } },
        _optModerate(), _optCoverUp()] },

    // ── 司法类 ──
    { id:'wrongfulDeath', name:'冤狱血案', dept:'judicial',
      trigger:{ dept:'judicial', minTrue:50 }, severity:'major',
      evidence:'翻案供词、尸检复勘',
      suspects:['prefect','judge'],
      textFn:function(d){ return '某冤案枉死' + d.amount + '人，尸骨未寒'; },
      options:[
        { id:'rehab', label:'平反昭雪',
          cost:{ partyStrife:+10 }, benefit:{ corruption:-6, minxin:+8, huangwei:+6 } },
        _optModerate(), _optCoverUp()] },

    { id:'barmanBribe', name:'讼师贿买案', dept:'judicial',
      trigger:{ dept:'judicial', minTrue:55 }, severity:'minor',
      evidence:'讼师账、当事人证词',
      suspects:['barman'],
      textFn:function(d){ return '讼师行贿' + d.amount + '两买通刑房'; },
      options:[_optStrict(), _optModerate(), _optLeaveItAlone()] },

    { id:'judgeFavoritism', name:'提刑徇私案', dept:'judicial',
      trigger:{ dept:'judicial', minTrue:55 }, severity:'moderate',
      evidence:'判决对照、受贿账',
      suspects:['judge'],
      textFn:function(d){ return '提刑司徇私枉法，轻纵要犯' + d.amount + '人'; },
      options:[_optStrict(), _optModerate(), _optCoverUp()] },

    // ── 内廷类 ──
    { id:'eunuchLand', name:'宦官侵田案', dept:'imperial',
      trigger:{ dept:'imperial', minTrue:55 }, severity:'major',
      evidence:'田亩登记、佃户告举',
      suspects:['dominantEunuch'],
      textFn:function(d){ return '宦官某侵占田' + d.amount + '亩，民失其业'; },
      options:[
        { id:'execute', label:'诛之抄其家',
          cost:{ huangquan:-3, partyStrife:+5 },
          benefit:{ corruption:-12, huangwei:+10, guoku:+500000 },
          historical:'明代对宦官侵田者抄家追田' },
        _optModerate(), _optCoverUp()] },

    { id:'imperialRelativeEstate', name:'外戚侵占案', dept:'imperial',
      trigger:{ dept:'imperial', minTrue:55 }, severity:'major',
      evidence:'田契比对、亲友指证',
      suspects:['imperialRelative'],
      textFn:function(d){ return '外戚某侵占良田' + d.amount + '亩，百姓流离'; },
      options:[_optStrict(),
        { id:'redeem', label:'逼令退田', cost:{ huangquan:-2 },
          benefit:{ corruption:-8, minxin:+5 } },
        _optCoverUp()] },

    { id:'innerTreasuryTheft', name:'内帑侵吞案', dept:'imperial',
      trigger:{ dept:'imperial', minTrue:60 }, severity:'major',
      evidence:'内府账目查审',
      suspects:['chiefEunuch','consortFather'],
      textFn:function(d){ return '内府盘点，内帑被侵' + d.amount + '两'; },
      options:[
        { id:'purge', label:'尽逐宦官外戚',
          cost:{ huangquan:-5, partyStrife:+10 },
          benefit:{ corruption:-15, neitang:+200000, huangwei:+8 } },
        _optStrict(), _optCoverUp()] }
  ];

  // 从库中选合适案件
  function pickExposureCase() {
    if (typeof GM === 'undefined' || !GM.corruption) return null;
    var c = GM.corruption;
    var candidates = EXPOSURE_CASES.filter(function(tpl) {
      if (!tpl.trigger) return true;
      var t = tpl.trigger;
      var dept = c.subDepts[t.dept];
      if (!dept) return false;
      if (t.minTrue && dept.true < t.minTrue) return false;
      if (t.hasFamine && !(GM.activeDisasters && GM.activeDisasters.length > 0)) return false;
      if (t.hasWar && !(GM.activeWars && GM.activeWars.length > 0)) return false;
      if (t.hasSellOffice && !(GM.juanna && GM.juanna.active)) return false;
      if (t.examYear && !GM.currentExamYear) return false;
      if (t.hasJudicial && c.subDepts.judicial.true < 40) return false;
      return true;
    });
    if (candidates.length === 0) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }

  // 生成具体案件
  function generateExposureCase() {
    var tpl = pickExposureCase();
    if (!tpl) return null;
    var amount = Math.floor(10000 + Math.random() * 200000);
    var caseObj = {
      id: tpl.id + '_' + GM.turn + '_' + Math.random().toString(36).slice(2, 5),
      templateId: tpl.id,
      name: tpl.name,
      dept: tpl.dept,
      severity: tpl.severity,
      evidence: tpl.evidence,
      suspects: tpl.suspects || [],
      amount: amount,
      text: tpl.textFn ? tpl.textFn({ amount: amount }) : tpl.name,
      options: tpl.options,
      status: 'pending',
      turn: GM.turn,
      // 6 月后过期（按当前刻度换算）
      expireTurn: GM.turn + ((typeof turnsForMonths === 'function') ? turnsForMonths(6) : 6)
    };
    GM.corruption.activeCases = GM.corruption.activeCases || [];
    GM.corruption.activeCases.push(caseObj);

    // 记入风闻录事（告状类）
    if (typeof addEB === 'function') {
      var cred = caseObj.severity === 'major' ? 'high' :
                 caseObj.severity === 'moderate' ? 'medium' : 'low';
      addEB('告状', caseObj.text, {
        credibility: cred,
        ref: caseObj.id
      });
    }
    return caseObj;
  }

  // 应用处置选项
  function applyCaseHandling(caseId, optionId) {
    var cases = (GM.corruption && GM.corruption.activeCases) || [];
    var cIdx = -1;
    for (var i = 0; i < cases.length; i++) {
      if (cases[i].id === caseId) { cIdx = i; break; }
    }
    if (cIdx < 0) return { success: false, reason: '案件已结或不存在' };
    var caseObj = cases[cIdx];
    var opt = (caseObj.options || []).find(function(o) { return o.id === optionId; });
    if (!opt) return { success: false, reason: '选项不存在' };

    var cost = opt.cost || {};
    var ben = opt.benefit || {};

    // 应用代价（扣）
    if (cost.partyStrife && GM.partyStrife !== undefined) GM.partyStrife = Math.min(100, GM.partyStrife + cost.partyStrife);
    if (cost.huangquan && GM.huangquan) {
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('factionConsuming', -Math.abs(cost.huangquan), '\u6574\u8083\u4ee3\u4ef7');
      } else {
        GM.huangquan.index = Math.max(0, GM.huangquan.index - Math.abs(cost.huangquan));
      }
    }
    if (cost.huangwei  && GM.huangwei)  GM.huangwei.index  = Math.max(0, GM.huangwei.index  - Math.abs(cost.huangwei));
    if (cost.minxin    && GM.minxin)    GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - Math.abs(cost.minxin));
    if (cost.guoku     && GM.guoku)     GM.guoku.balance -= Math.abs(cost.guoku);
    if (cost.stress) { /* player stress — hook */ }

    // 应用收益
    if (ben.corruption && caseObj.dept && GM.corruption.subDepts[caseObj.dept]) {
      GM.corruption.subDepts[caseObj.dept].true = Math.max(0,
        GM.corruption.subDepts[caseObj.dept].true + ben.corruption);
    }
    if (ben.minxin   && GM.minxin)   GM.minxin.trueIndex = Math.min(100, GM.minxin.trueIndex + ben.minxin);
    if (ben.huangwei && GM.huangwei) GM.huangwei.index   = Math.min(100, GM.huangwei.index   + ben.huangwei);
    if (ben.huangquan && GM.huangquan) {
      if (global.AuthorityEngines && global.AuthorityEngines.adjustHuangquan) {
        global.AuthorityEngines.adjustHuangquan('personalRule', ben.huangquan, '\u6574\u8083\u594f\u6548');
      } else {
        GM.huangquan.index = Math.min(100, GM.huangquan.index + ben.huangquan);
      }
    }
    if (ben.guoku    && GM.guoku)    GM.guoku.balance   += ben.guoku;
    if (ben.neitang  && GM.neitang)  GM.neitang.balance += ben.neitang;
    if (ben.partyStrife && GM.partyStrife !== undefined) GM.partyStrife = Math.max(0, GM.partyStrife + ben.partyStrife);
    if (ben.armyMorale && GM.armies) {
      GM.armies.forEach(function(a) { a.morale = Math.min(100, (a.morale || 50) + ben.armyMorale); });
    }

    // 关闭案件，挪入历史
    caseObj.status = 'resolved';
    caseObj.resolvedTurn = GM.turn;
    caseObj.resolvedAction = optionId;
    cases.splice(cIdx, 1);
    GM.corruption.history.exposedCases.push(caseObj);
    if (GM.corruption.history.exposedCases.length > 160) GM.corruption.history.exposedCases = GM.corruption.history.exposedCases.slice(-160); // 完整案件对象·单条体积最大·封顶
    syncIndexFromSubDepts('\u8150\u8d25\u6848\u5904\u7f6e');

    if (typeof addEB === 'function') {
      addEB('朝代', '「' + caseObj.name + '」：' + opt.label, {
        credibility: 'high', ref: caseObj.id
      });
    }
    return { success: true, case: caseObj, option: opt };
  }

  // 案件过期处理（玩家不理）
  function expireOldCases() {
    if (!GM.corruption || !GM.corruption.activeCases) return;
    var active = GM.corruption.activeCases;
    var remaining = [];
    for (var i = 0; i < active.length; i++) {
      var c = active[i];
      if (c.expireTurn && GM.turn > c.expireTurn) {
        c.status = 'expired';
        c.resolvedTurn = GM.turn;
        // 不处理的后果：民心 -2，皇威 -1，腐败略升
        if (GM.minxin) GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - 2);
        if (GM.huangwei) GM.huangwei.index = Math.max(0, GM.huangwei.index - 1);
        if (c.dept && GM.corruption.subDepts[c.dept]) {
          GM.corruption.subDepts[c.dept].true = Math.min(100, GM.corruption.subDepts[c.dept].true + 3);
        }
        GM.corruption.history.exposedCases.push(c);
        if (GM.corruption.history.exposedCases.length > 160) GM.corruption.history.exposedCases = GM.corruption.history.exposedCases.slice(-160);
        if (typeof addEB === 'function') {
          addEB('朝代', '「' + c.name + '」久未处置，民心离散', { credibility: 'medium' });
        }
      } else {
        remaining.push(c);
      }
    }
    GM.corruption.activeCases = remaining;
  }

  // ═════════════════════════════════════════════════════════════
  // §2.9 lumpSumIncident 推入 API（供诏令系统调用）
  // ═════════════════════════════════════════════════════════════

  var LUMP_TYPE_MULT = {
    infrastructure: 1.2, military: 1.15, reward: 0.8,
    relief: 1.1, ritual: 1.0, diplomacy: 0.9
  };
  var LUMP_DEPT_DIST = {
    infrastructure: { central:0.35, provincial:0.50, fiscal:0.15 },
    military:       { military:0.50, central:0.25, fiscal:0.25 },
    reward:         { imperial:0.50, central:0.30, fiscal:0.20 },
    relief:         { provincial:0.55, fiscal:0.30, central:0.15 },
    ritual:         { imperial:0.40, central:0.40, fiscal:0.20 },
    diplomacy:      { central:0.50, imperial:0.30, fiscal:0.20 }
  };

  function pushLumpSumIncident(spec) {
    CorruptionEngine.ensureModel();
    var annualIncome = (GM.guoku && GM.guoku.annualIncome) || 1e6;
    var ratio = (spec.amount || 0) / annualIncome;
    if (ratio < 0.05) return null;

    var base = 10 * Math.pow(Math.max(0.01, ratio - 0.04), 1.3);
    var layers = spec.executionLayers || 3;
    if (layers > 3) base *= (1 + (layers - 3) * 0.15);
    if (spec.urgent) base *= 1.25;
    base *= LUMP_TYPE_MULT[spec.type] || 1.0;

    var audit = safe(GM.corruption.supervision.level, 40);
    if (spec.hasDedicatedAudit)  audit += 25;
    if (spec.decreeHasOversight) audit += 15;
    if (spec.stagedApproval)     audit += 10;
    if (spec.publicTally)        audit += 10;
    var auditMult = Math.max(0.25, 1 - audit / 150);
    var totalCorr = base * auditMult;

    var deptDist = LUMP_DEPT_DIST[spec.type] || { central:0.4, provincial:0.3, fiscal:0.3 };
    var depts = {};
    for (var d in deptDist) depts[d] = totalCorr * deptDist[d];

    var incident = {
      id: 'incident_' + GM.turn + '_' + Math.random().toString(36).slice(2, 6),
      decreeId: spec.decreeId || null,
      name: spec.name || '某项大工',
      type: spec.type || 'infrastructure',
      amount: spec.amount,
      ratioToAnnual: ratio,
      peakCorruption: totalCorr,
      currentCorruption: totalCorr * 0.3,
      depts: depts,
      startTurn: GM.turn,
      expectedDuration: spec.durationMonths || 12,
      executionLayers: layers,
      urgent: spec.urgent || false,
      hasDedicatedAudit: spec.hasDedicatedAudit || false,
      decreeHasOversight: spec.decreeHasOversight || false,
      stagedApproval: spec.stagedApproval || false,
      publicTally: spec.publicTally || false,
      directPeopleBurden: spec.directPeopleBurden || false,
      status: 'active'
    };

    GM.corruption.lumpSumIncidents.push(incident);

    if (incident.directPeopleBurden && GM.minxin) {
      GM.minxin.trueIndex = Math.max(0, GM.minxin.trueIndex - ratio * 15);
    }

    if (typeof addEB === 'function') {
      addEB('事件', '大举兴工：' + incident.name + '（费银 ' + Math.round(incident.amount/10000) + ' 万两）', {
        credibility: 'high'
      });
    }
    return incident;
  }

  // ═════════════════════════════════════════════════════════════
  // §9.7 风闻录事四类自动生成（补全风议/密札/耳报）
  // ═════════════════════════════════════════════════════════════

  function _maybeGenerateRumor() {
    var c = GM.corruption;
    if (!c) return;
    var mr = (typeof CorruptionEngine.getMonthRatio === 'function') ? CorruptionEngine.getMonthRatio()
           : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() / 30 : 1);
    // 触发条件：中央腐败高 / 党争激烈 / 有名臣处于危机
    var prob = 0;
    if (c.subDepts.central.true > 50) prob += 0.1;
    if ((c.countermeasures.factionFeud || 0) > 0.3) prob += 0.15;
    if (c.entrenchedFactions.length > 0) prob += 0.1;
    prob *= mr;  // 月概率 → 回合概率
    if (prob <= 0 || Math.random() > prob) return;

    var templates = [
      '翰林私语：近日部堂某某家门若市',
      '士林风议：朝堂忠直者寥寥',
      '文苑讥评：奏疏多颂圣少言事',
      '清流叹息：今日之事不可言也',
      '坊间物议：某部堂近来与盐商往来甚密'
    ];
    var t = templates[Math.floor(Math.random() * templates.length)];
    if (typeof addEB === 'function') {
      addEB('风议', t, { credibility: 'low' });
    }
  }

  function _maybeGeneratePrivateLetter() {
    var chars = GM.chars || [];
    if (chars.length < 2) return;
    var rels = GM.rels || {};
    var relKeys = Object.keys(rels);
    if (relKeys.length === 0) return;
    var mr = (typeof CorruptionEngine.getMonthRatio === 'function') ? CorruptionEngine.getMonthRatio()
           : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() / 30 : 1);
    if (Math.random() > 0.1 * mr) return;

    var templates = [
      '御史某私札：恩师近因河工事忧虑不安',
      '门生私书：近日见恩相气色不佳',
      '同年私语：朝中风向不明，宜谨言慎行',
      '姻亲私书：家严闻陛下近事，卧病数日',
      '旧故私笺：同年之中敢进谏者几何？'
    ];
    var t = templates[Math.floor(Math.random() * templates.length)];
    if (typeof addEB === 'function') {
      addEB('密札', t, { credibility: 'medium' });
    }
  }

  function _maybeGenerateEavesdrop() {
    var insts = ((GM.corruption && GM.corruption.supervision && GM.corruption.supervision.institutions) || []);
    var spyInsts = insts.filter(function(i) {
      return i.name === '锦衣卫' || i.name === '东厂' || i.name === '西厂' || i.name === '提督太监';
    });
    if (spyInsts.length === 0) return;
    var mr = (typeof CorruptionEngine.getMonthRatio === 'function') ? CorruptionEngine.getMonthRatio()
           : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() / 30 : 1);

    // 每机构本回合尝试生成条数（与 radius 和 mr 成正比）
    spyInsts.forEach(function(inst) {
      var baseCount = Math.floor((inst.radius || 50) / 30) + 1;
      // 长回合应多生成
      var count = Math.min(10, Math.ceil(baseCount * Math.max(0.5, mr)));
      for (var i = 0; i < count; i++) {
        if (Math.random() > 0.35) continue;
        var templates = [
          '东厂呈：兵部侍郎某家中近添姬妾数人，园亭日盛',
          '锦衣卫启：户部尚书夜宴巨商，疑有勾结',
          '内监私启：某某私下通书外邦，可疑',
          '密探禀：吏部员外郎蓄养门客数十，动静不明',
          '侦缉报：某将领营中豪奢，疑克扣军饷自肥',
          '厂卫密启：某员近日频访宫闱外戚，意图不明'
        ];
        var t = templates[Math.floor(Math.random() * templates.length)];
        if (typeof addEB === 'function') {
          addEB('耳报', '[' + (inst.name || '厂卫') + '] ' + t, {
            credibility: 'biased',
            source: inst.id
          });
        }
      }
    });
  }

  // ═════════════════════════════════════════════════════════════
  // 新官 isRecentAppointment 标记
  // ═════════════════════════════════════════════════════════════

  function markAsRecentAppointment(charOrId) {
    var ch = typeof charOrId === 'string'
      ? (GM.chars || []).find(function(c) { return c.id === charOrId; })
      : charOrId;
    if (!ch) return;
    ch.isRecentAppointment = true;
    ch.appointedTurn = GM.turn;
  }

  function decayRecentAppointments() {
    var chars = GM.chars || [];
    // 24 月 → 对应回合数（长回合少，短回合多）
    var decayTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(24) : 24;
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (ch.isRecentAppointment && ch.appointedTurn !== undefined) {
        if (GM.turn - ch.appointedTurn > decayTurns) {
          ch.isRecentAppointment = false;
        }
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // §10.6 历史快照（供趋势图）
  // 每回合记录一次，保留最近 120 条
  // ═════════════════════════════════════════════════════════════

  function snapshotCorruptionHistory() {
    if (!GM.corruption) return;
    if (!GM.corruption.history) GM.corruption.history = {};
    if (!GM.corruption.history.snapshots) GM.corruption.history.snapshots = [];
    var sd = GM.corruption.subDepts;
    GM.corruption.history.snapshots.push({
      turn: GM.turn,
      trueIndex: Math.round(GM.corruption.trueIndex * 10) / 10,
      perceivedIndex: Math.round(GM.corruption.perceivedIndex * 10) / 10,
      depts: {
        central:    Math.round(sd.central.true),
        provincial: Math.round(sd.provincial.true),
        military:   Math.round(sd.military.true),
        fiscal:     Math.round(sd.fiscal.true),
        judicial:   Math.round(sd.judicial.true),
        imperial:   Math.round(sd.imperial.true)
      },
      supervision: Math.round((GM.corruption.supervision || {}).level || 0)
    });
    // 保留最近 120 条
    if (GM.corruption.history.snapshots.length > 120) {
      GM.corruption.history.snapshots = GM.corruption.history.snapshots.slice(-120);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 扩展 CorruptionEngine.tick
  // 保持原 tick 所有行为，追加 P2 动作
  // ═════════════════════════════════════════════════════════════

  var _origTick = CorruptionEngine.tick;
  CorruptionEngine.tick = function(context) {
    _origTick.call(this, context);

    // 过期案件处理
    try { expireOldCases(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] expireOldCases:') : console.error('[corruption-p2] expireOldCases:', e); }

    // 概率生成新案件（月概率 × 回合月数）
    try {
      var c = GM.corruption;
      var sup = safe(c.supervision.level, 40);
      var maxCorr = 0;
      ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
        if (c.subDepts[k].true > maxCorr) maxCorr = c.subDepts[k].true;
      });
      var _mr = (context && context._monthRatio) || (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn()/30 : 1);
      var prob = (maxCorr - 40) / 100 * (sup / 100) * 0.4 * _mr;
      var activeCount = (c.activeCases || []).length;
      if (prob > 0 && activeCount < 5 && Math.random() < prob) {
        generateExposureCase();
      }
    } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] case generation:') : console.error('[corruption-p2] case generation:', e); }

    // 风闻四类
    try { _maybeGenerateRumor(); }           catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] rumor:') : console.error('[corruption-p2] rumor:', e); }
    try { _maybeGeneratePrivateLetter(); }   catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] letter:') : console.error('[corruption-p2] letter:', e); }
    try { _maybeGenerateEavesdrop(); }       catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] eavesdrop:') : console.error('[corruption-p2] eavesdrop:', e); }

    // 新官标记衰减
    try { decayRecentAppointments(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] decayAppointments:') : console.error('[corruption-p2] decayAppointments:', e); }
    try { snapshotCorruptionHistory(); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p2] snapshot:') : console.error('[corruption-p2] snapshot:', e); }
  };

  // ═════════════════════════════════════════════════════════════
  // 导出到 CorruptionEngine
  // ═════════════════════════════════════════════════════════════
  CorruptionEngine.EXPOSURE_CASES = EXPOSURE_CASES;
  CorruptionEngine.generateExposureCase = generateExposureCase;
  CorruptionEngine.applyCaseHandling = applyCaseHandling;
  CorruptionEngine.pushLumpSumIncident = pushLumpSumIncident;
  CorruptionEngine.markAsRecentAppointment = markAsRecentAppointment;
  CorruptionEngine.snapshotHistory = snapshotCorruptionHistory;

  console.log('[corruption-p2] 已加载：' + EXPOSURE_CASES.length + ' 条案件库 + lumpSum API + 风闻四类 + 新官标记');

})(typeof window !== 'undefined' ? window : this);

// @ts-check
/// <reference path="types.d.ts" />
// ═══════════════════════════════════════════════════════════════
// 腐败系统 · P4 完善模块
// 依赖：tm-corruption-engine.js + tm-corruption-p2.js
//
// ⚠ 补丁分类（2026-04-24 R12 评估）：LAYERED（叠加链终端）
//   · APPEND 部分：getGameMode/getModeMultipliers/openJuanna/closeJuanna
//                  /enrichCaseWithAI/toggleMapCorruptionOverlay/getCorruptionColor
//                  /renderEditorPanel/aiPurgeAdvisor
//   · OVERRIDE 部分（覆盖 p2 的）：
//       · CorruptionEngine.tick （最终版·覆盖 p2 的 tick）
//       · CorruptionEngine.generateExposureCase （覆盖 p2）
//       · CorruptionEngine.updatePerceived （覆盖 engine 或 p2）
//   合并指引见 PATCH_CLASSIFICATION.md · Corruption 段（预计工时 30h）
//
// 实现：
//   - §9.6 游戏模式调节（严格史实/轻度史实/演义）
//   - §13 官员轮换过频副作用量化
//   - 卖官鬻爵（juanna）子系统激活
//   - §9 AI 真赋能（案件文本 / 风闻文本异步增强）
//   - §10.5 地图污浊热力层
//   - §8 编辑器面板（可嵌入式 HTML 渲染器）
//   - §7.8 腐败 → 制度设计 反向：新设机构腐败继承环境
// ═══════════════════════════════════════════════════════════════

(function(global) {
  'use strict';

  if (typeof CorruptionEngine === 'undefined') {
    console.warn('[corruption-p4] CorruptionEngine 未加载，P4 跳过');
    return;
  }

  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  function safe(v, d) { return (v === undefined || v === null) ? (d || 0) : v; }

  // ═════════════════════════════════════════════════════════════
  // §9.6 游戏模式调节
  // ═════════════════════════════════════════════════════════════

  function getGameMode() {
    if (typeof P !== 'undefined' && P.conf && P.conf.gameMode) return P.conf.gameMode;
    return 'light-history';  // 默认轻度史实
  }

  function getModeMultipliers() {
    var mode = getGameMode();
    if (mode === 'strict')  return { visibilityPenalty: 0.6, exposureFreq: 0.7, backlashMult: 1.5, floateryGap: 1.3 };
    if (mode === 'romance') return { visibilityPenalty: 1.4, exposureFreq: 1.3, backlashMult: 0.6, floateryGap: 0.7 };
    return { visibilityPenalty: 1.0, exposureFreq: 1.0, backlashMult: 1.0, floateryGap: 1.0 };
  }

  // ═════════════════════════════════════════════════════════════
  // §13 轮换过频副作用
  // ═════════════════════════════════════════════════════════════

  function applyRotationSideEffects(context) {
    var cm = GM.corruption.countermeasures;
    if (!cm || !cm.rotation) return;
    var mr = (context && context._monthRatio) ||
             (typeof CorruptionEngine.getMonthRatio === 'function' ? CorruptionEngine.getMonthRatio()
              : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn()/30 : 1));
    if (cm.rotation > 0.6) {
      var severity = cm.rotation - 0.5;
      if (GM._corrStats) GM._corrStats.policyInaccuracy = (GM._corrStats.policyInaccuracy || 0) + severity * mr;
      // 每月小概率 → 按月数
      if (Math.random() < severity * 0.1 * mr) {
        if (typeof addEB === 'function') {
          addEB('朝代', '地方官频调，政令下达而无人详察，百事生疏', { credibility: 'medium' });
        }
        GM.corruption.subDepts.provincial.true = Math.min(100,
          GM.corruption.subDepts.provincial.true + severity * 2);
      }
    } else {
      if (GM._corrStats && GM._corrStats.policyInaccuracy > 0) {
        GM._corrStats.policyInaccuracy = Math.max(0, GM._corrStats.policyInaccuracy - 0.05 * mr);
      }
    }
  }

  // ═════════════════════════════════════════════════════════════
  // 卖官鬻爵（juanna）子系统
  // ═════════════════════════════════════════════════════════════

  function ensureJuannaModel() {
    if (!GM.juanna) {
      GM.juanna = {
        active: false,
        startTurn: null,
        monthlyIncome: 0,           // 每月捐纳收入
        cumulativeSold: 0,           // 累计售出官衔
        tier: 'standard'              // 'open-any'|'standard'|'restricted'
      };
    }
  }

  function openJuanna(tier) {
    ensureJuannaModel();
    var j = GM.juanna;
    j.active = true;
    j.startTurn = GM.turn;
    j.tier = tier || 'standard';
    // 月收入 = 帑廪月入的比例
    var baseMonthly = (GM.guoku && GM.guoku.monthlyIncome) || 50000;
    j.monthlyIncome = tier === 'open-any'   ? baseMonthly * 0.25 :
                      tier === 'standard'   ? baseMonthly * 0.12 :
                                              baseMonthly * 0.05;
    if (typeof addEB === 'function') {
      addEB('朝代', '诏开捐纳：售官' + (tier==='open-any'?'不限级'
                                       : tier==='standard'?'有序捐纳'
                                       :'限捐低阶')
                   + '，月入约 ' + Math.round(j.monthlyIncome/1000) + ' 千两',
            { credibility: 'high' });
    }
    return j;
  }

  function closeJuanna() {
    ensureJuannaModel();
    if (!GM.juanna.active) return;
    GM.juanna.active = false;
    GM.juanna.monthlyIncome = 0;
    if (typeof addEB === 'function') {
      addEB('朝代', '诏罢捐纳，清流拭目', { credibility: 'high' });
    }
  }

  function applyJuannaMonthly(context) {
    ensureJuannaModel();
    if (!GM.juanna.active) return;
    var j = GM.juanna;
    var mr = (context && context._monthRatio) ||
             (typeof CorruptionEngine.getMonthRatio === 'function' ? CorruptionEngine.getMonthRatio()
              : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn()/30 : 1));
    // monthlyIncome 是月入 → 按月数入账
    if (GM.guoku) GM.guoku.balance += j.monthlyIncome * mr;
    j.cumulativeSold = (j.cumulativeSold || 0) + mr;
    // 按月速率加剧部门腐败
    if (GM.corruption) {
      GM.corruption.subDepts.central.true = Math.min(100,
        GM.corruption.subDepts.central.true + 0.05 * mr);
      GM.corruption.subDepts.fiscal.true = Math.min(100,
        GM.corruption.subDepts.fiscal.true + 0.03 * mr);
    }
    // 士人民心按月扣
    if (GM.minxin && GM.minxin.byClass && GM.minxin.byClass.shi) {
      GM.minxin.byClass.shi.true = Math.max(0, GM.minxin.byClass.shi.true - 0.2 * mr);
    }
  }

  // ═════════════════════════════════════════════════════════════
  // §9 AI 文本增强（异步、非阻塞、有回退）
  // ═════════════════════════════════════════════════════════════

  function isAIAvailable() {
    return (typeof callAI === 'function')
        && (typeof P !== 'undefined') && P.ai && P.ai.key;
  }

  // §9.3 肃贪决策 AI 参议
  async function aiPurgeAdvisor() {
    if (!isAIAvailable()) {
      return {
        available: false,
        analysis: _ruleBasedPurgeAdvisor()
      };
    }
    try {
      var c = GM.corruption;
      var h = (GM.huangquan || {}).index || 50;
      var w = (GM.huangwei || {}).index || 50;
      var m = (GM.minxin || {}).trueIndex || 50;
      var guoku = (GM.guoku && GM.guoku.balance) || 0;
      var sup = (c.supervision && c.supervision.level) || 0;
      var factions = (c.entrenchedFactions || []).map(function(f){return f.name;}).join('、') || '无';
      var maxDept = 'central', maxVal = 0;
      ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
        if (c.subDepts[d].true > maxVal) { maxVal = c.subDepts[d].true; maxDept = d; }
      });
      var deptLabel = CorruptionEngine._deptName(maxDept);

      var prompt = '你扮演明察秋毫的辅政大臣，为陛下参议肃贪。' +
        '用奏疏体（200字内，文言雅训），分析三项并给建议：' +
        '1) 是否当行大计；2) 若行，当从何处入手；3) 副作用预警。' +
        '\n\n当前时局：' +
        '\n- 全局腐败：' + Math.round(c.trueIndex) + '/100（最重：' + deptLabel + ' ' + Math.round(maxVal) + '）' +
        '\n- 皇权：' + Math.round(h) + '；皇威：' + Math.round(w) + '；民心：' + Math.round(m) +
        '\n- 监察力度：' + Math.round(sup) + '/100' +
        '\n- 帑廪：' + Math.round(guoku) + ' 两' +
        '\n- 盘根集团：' + factions +
        '\n\n直接输出奏疏（"臣某某谨奏……"），不含解释。';

      var text = await callAI(prompt, 500);
      return {
        available: true,
        analysis: (text || '').trim()
      };
    } catch(e) {
      console.warn('[corruption-p4] aiPurgeAdvisor:', e.message);
      return {
        available: false,
        analysis: _ruleBasedPurgeAdvisor(),
        error: e.message
      };
    }
  }

  // 规则版后备：基于当前状态给出固定建议
  function _ruleBasedPurgeAdvisor() {
    var c = GM.corruption;
    var h = (GM.huangquan || {}).index || 50;
    var w = (GM.huangwei || {}).index || 50;
    var m = (GM.minxin || {}).trueIndex || 50;
    var sup = (c.supervision && c.supervision.level) || 0;
    var guoku = (GM.guoku && GM.guoku.balance) || 0;
    var annual = (GM.guoku && GM.guoku.annualIncome) || 1e6;

    var maxDept = 'central', maxVal = 0;
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
      if (c.subDepts[d].true > maxVal) { maxVal = c.subDepts[d].true; maxDept = d; }
    });

    var lines = [];
    lines.push('【时局】腐败' + Math.round(c.trueIndex) + '，最甚' + CorruptionEngine._deptName(maxDept) + '（' + Math.round(maxVal) + '）。');

    // 判定：当行大计 vs 分部整顿 vs 缓行
    if (maxVal > 70 && sup > 50 && h > 55 && guoku > annual * 0.3) {
      lines.push('【臣议】吏治颓靡，陛下可行大计——六部门并肃。皇权足以震慑，帑廪支撑，监察有力。');
      lines.push('【入手】从最重之' + CorruptionEngine._deptName(maxDept) + '始，诛首恶、宥胁从。');
    } else if (maxVal > 60 && sup > 40 && h > 40) {
      lines.push('【臣议】可行分部整顿，专清一处。全域肃贪恐力有不逮。');
      lines.push('【入手】专清' + CorruptionEngine._deptName(maxDept) + '部门，遣钦差专项稽查。');
    } else {
      lines.push('【臣议】时机未至。');
      var reasons = [];
      if (sup < 40) reasons.push('监察力度不足（当前 ' + Math.round(sup) + '），恐沦为形式');
      if (h < 40) reasons.push('皇权不足以震慑反弹（当前 ' + Math.round(h) + '）');
      if (guoku < annual * 0.3) reasons.push('帑廪不足以支撑朝政瘫痪期');
      if (m < 40) reasons.push('民心动摇（当前 ' + Math.round(m) + '），此时肃贪恐激民变');
      lines.push('【阻因】' + reasons.join('；'));
      lines.push('【建议】先设监察机构、养廉银并用，徐图之。');
    }

    // 副作用预警
    var warnings = [];
    if (c.entrenchedFactions.length > 0) warnings.push('盘根集团' + c.entrenchedFactions.length + '个，清算必激烈反噬');
    if ((c.countermeasures.harshPunishment || 0) > 0.3) warnings.push('酷吏已滥，再行恐致冤狱');
    if (m < 40) warnings.push('民心低迷，肃贪激烈处或激民变');
    if (warnings.length > 0) lines.push('【副作用】' + warnings.join('；'));

    return lines.join('\n\n');
  }

  async function enrichCaseWithAI(caseObj) {
    if (!isAIAvailable()) return null;
    try {
      var deptName = CorruptionEngine._deptName(caseObj.dept);
      var sevLbl = caseObj.severity === 'major' ? '大案' :
                   caseObj.severity === 'moderate' ? '中案' : '小案';
      var prompt = '写一道古代奏疏体的揭发案文（60-120字），格式："臣XX谨奏……"。' +
                   '案件：' + caseObj.name + '。涉及部门：' + deptName + '。' +
                   '严重程度：' + sevLbl + '。涉案金额约 ' + caseObj.amount + ' 两。' +
                   '证据：' + caseObj.evidence + '。只输出奏疏正文，不含解释。';
      var text = await callAI(prompt, 300);
      if (text && text.length > 20) {
        // 更新事件日志
        var el = (GM.evtLog || []).find(function(e) { return e.ref === caseObj.id; });
        if (el) {
          el.text = text.trim().replace(/\n+/g, ' ').substring(0, 200);
          // 刷新面板
          var panel = document.getElementById('lizhi-body');
          if (panel && typeof renderCorruptionPanel === 'function') renderCorruptionPanel();
        }
        return text;
      }
    } catch (e) {
      console.warn('[corruption-p4] enrichCaseWithAI:', e.message);
    }
    return null;
  }

  // 包装原 generateExposureCase：生成后异步让 AI 润色
  var _origGenExpCase = CorruptionEngine.generateExposureCase;
  CorruptionEngine.generateExposureCase = function() {
    var caseObj = _origGenExpCase.apply(this, arguments);
    if (caseObj && isAIAvailable()) {
      // 异步增强（不阻塞）
      setTimeout(function() { enrichCaseWithAI(caseObj); }, 100);
    }
    return caseObj;
  };

  // ═════════════════════════════════════════════════════════════
  // §10.5 地图污浊热力层
  // ═════════════════════════════════════════════════════════════

  function updateRegionalCorruption() {
    if (!GM.mapData || !GM.mapData.cities) return;
    if (!GM.corruption) return;
    if (!GM.corruption.byRegion) GM.corruption.byRegion = {};
    var pc = (GM.corruption.subDepts.provincial || {}).true || 30;

    // 本回合代表的月数
    var mr = (typeof CorruptionEngine.getMonthRatio === 'function') ? CorruptionEngine.getMonthRatio()
           : (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn()/30 : 1);
    // 每月 8% 回归 → 按月数幂次
    var retainMonthly = 0.92;
    var regressMonthly = 0.08;
    var retain = Math.pow(retainMonthly, mr);
    var regress = 1 - retain;

    Object.keys(GM.mapData.cities).forEach(function(cityId) {
      if (GM.corruption.byRegion[cityId] === undefined) {
        var hash = 0;
        for (var i = 0; i < cityId.length; i++) hash = ((hash << 5) - hash) + cityId.charCodeAt(i);
        var variance = ((hash % 41) - 20);
        GM.corruption.byRegion[cityId] = { value: clamp(pc + variance, 0, 100), variance: variance };
      } else {
        var r = GM.corruption.byRegion[cityId];
        r.value = clamp(r.value * retain + (pc + r.variance) * regress, 0, 100);
      }
    });
  }

  function getCorruptionColor(value) {
    // 0-25 清明：青玉
    // 25-50 尚可：金
    // 50-70 渐弊：暗金
    // 70-85 颓靡：朱红
    // 85+  积重：深赤
    if (value < 25) return 'rgba(106,168,138,0.55)';
    if (value < 50) return 'rgba(184,154,83,0.55)';
    if (value < 70) return 'rgba(138,109,43,0.65)';
    if (value < 85) return 'rgba(192,64,48,0.65)';
    return 'rgba(139,46,37,0.8)';
  }

  function toggleMapCorruptionOverlay(on) {
    if (!GM.mapData) return;
    if (!GM.mapData.state) GM.mapData.state = {};
    GM.mapData.state.showCorruption = (on === undefined) ? !GM.mapData.state.showCorruption : !!on;
    if (typeof renderMap === 'function') renderMap();
  }

  // 钩入 renderPolygons——若 showCorruption 开启，覆盖颜色为腐败色
  function installMapHook() {
    if (typeof renderPolygons !== 'function') return;
    if (renderPolygons._corrHookInstalled) return;
    var _origRender = renderPolygons;
    window.renderPolygons = function(ctx) {
      _origRender.call(this, ctx);
      if (!GM.mapData || !GM.mapData.state || !GM.mapData.state.showCorruption) return;
      if (!GM.corruption || !GM.corruption.byRegion) return;
      // 覆盖一层腐败色
      Object.values(GM.mapData.polygons || {}).forEach(function(polygon) {
        var cityId = polygon.cityId;
        var reg = GM.corruption.byRegion[cityId];
        if (!reg) return;
        ctx.beginPath();
        polygon.points.forEach(function(p, i) {
          if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
        });
        ctx.closePath();
        ctx.fillStyle = getCorruptionColor(reg.value);
        ctx.fill();
      });
    };
    window.renderPolygons._corrHookInstalled = true;
  }

  // ═════════════════════════════════════════════════════════════
  // §7.8 腐败 → 制度设计 反向：新设机构继承环境腐败
  // ═════════════════════════════════════════════════════════════

  function getInstitutionInitialCorruption() {
    // 新设机构自带腐败 = 其所属部门腐败的 30%（机构总比部门清廉）
    // 若环境整体腐败严重，新机构也难独善其身
    var avg = 0, n = 0;
    ['central','provincial','fiscal','judicial'].forEach(function(d) {
      avg += (GM.corruption.subDepts[d] || {}).true || 0;
      n++;
    });
    avg = n > 0 ? avg / n : 20;
    return Math.round(avg * 0.3);
  }

  // 包装 setupSecretPolice，让新设机构继承环境腐败
  var _origSetupSP = CorruptionEngine.Actions.setupSecretPolice;
  CorruptionEngine.Actions.setupSecretPolice = function(type) {
    var r = _origSetupSP.call(this, type);
    if (r && r.success) {
      // 修正最后一个新增的机构的 corruption
      var insts = GM.corruption.supervision.institutions;
      if (insts.length > 0) {
        var last = insts[insts.length - 1];
        var envCorr = getInstitutionInitialCorruption();
        last.corruption = Math.max(last.corruption, envCorr);
      }
    }
    return r;
  };

  // ═════════════════════════════════════════════════════════════
  // §8 编辑器腐败配置面板（HTML 渲染器）
  // 返回可嵌入到编辑器的 HTML + 提供保存回调
  // ═════════════════════════════════════════════════════════════

  function renderEditorCorruptionPanel(targetScenario) {
    var sc = targetScenario || {};
    var cc = sc.corruption || {};
    var sd = cc.subDepts || {};
    var sv = cc.supervision || {};
    var html = '<div class="editor-corruption-panel">';
    html += '<h3 style="color:var(--gold);letter-spacing:0.1em;margin-bottom:0.6rem;">腐败初始配置（覆盖朝代预设）</h3>';

    html += '<div style="display:grid;grid-template-columns:140px 1fr;gap:6px 12px;align-items:center;font-size:0.82rem;">';

    function numRow(label, id, val, min, max) {
      return '<label>' + label + '</label>'+
        '<input type="number" id="corrEd_' + id + '" value="' + (val !== undefined ? val : '') +
        '" min="' + (min || 0) + '" max="' + (max || 100) +
        '" placeholder="留空则按朝代预设" style="padding:4px 6px;font-family:inherit;">';
    }

    html += numRow('全局指数', 'trueIndex', cc.trueIndex);
    html += numRow('中央', 'central',    (sd.central||{}).true);
    html += numRow('地方', 'provincial', (sd.provincial||{}).true);
    html += numRow('军队', 'military',   (sd.military||{}).true);
    html += numRow('税司', 'fiscal',     (sd.fiscal||{}).true);
    html += numRow('司法', 'judicial',   (sd.judicial||{}).true);
    html += numRow('内廷', 'imperial',   (sd.imperial||{}).true);
    html += numRow('监察力度', 'supLevel', sv.level);

    html += '</div>';

    // 初始机构列表（简化：文本域 JSON）
    html += '<div style="margin-top:0.8rem;font-size:0.78rem;">'+
      '<label style="display:block;margin-bottom:4px;color:var(--gold);">预设机构（JSON 数组，可选）</label>'+
      '<textarea id="corrEd_institutions" rows="4" style="width:100%;font-family:monospace;font-size:0.72rem;padding:6px;" placeholder=\'[{"name":"都察院","coverage":["central","provincial"],"radius":70,"independence":50,"corruption":20,"vacancies":0.15}]\'>'+
      JSON.stringify(sv.institutions || [], null, 2) + '</textarea></div>';

    // 初始腐败集团
    html += '<div style="margin-top:0.8rem;font-size:0.78rem;">'+
      '<label style="display:block;margin-bottom:4px;color:var(--gold);">盘根错节集团（JSON 数组，可选）</label>'+
      '<textarea id="corrEd_factions" rows="4" style="width:100%;font-family:monospace;font-size:0.72rem;padding:6px;" placeholder=\'[{"name":"严党","dept":"central","strength":75,"years":5}]\'>'+
      JSON.stringify(cc.entrenchedFactions || [], null, 2) + '</textarea></div>';

    html += '<button class="bt bp" style="margin-top:0.6rem;" onclick="window._corrEditorSave()">保存到剧本</button>';
    html += '<p style="font-size:0.7rem;color:var(--txt-d);margin-top:0.4rem;">未填字段将用朝代预设（见 `CorruptionEngine.DYNASTY_PRESETS`）。</p>';
    html += '</div>';
    return html;
  }

  // 保存回调（在页面上下文里由编辑器集成点调用）
  window._corrEditorSave = function() {
    if (typeof P === 'undefined') return;
    var cur = (typeof window.currentEditingScenario !== 'undefined') ? window.currentEditingScenario : P;
    if (!cur) return;
    if (!cur.corruption) cur.corruption = {};
    var cc = cur.corruption;
    function getNum(id) {
      var el = document.getElementById('corrEd_' + id);
      if (!el) return undefined;
      var v = el.value;
      if (v === '') return undefined;
      return Number(v);
    }
    var ti = getNum('trueIndex');
    if (ti !== undefined) cc.trueIndex = ti;

    if (!cc.subDepts) cc.subDepts = {};
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(d) {
      var v = getNum(d);
      if (v !== undefined) {
        if (!cc.subDepts[d]) cc.subDepts[d] = {};
        cc.subDepts[d].true = v;
      }
    });

    var sl = getNum('supLevel');
    if (sl !== undefined) {
      if (!cc.supervision) cc.supervision = {};
      cc.supervision.level = sl;
    }

    var instEl = document.getElementById('corrEd_institutions');
    if (instEl && instEl.value.trim()) {
      try {
        if (!cc.supervision) cc.supervision = {};
        cc.supervision.institutions = JSON.parse(instEl.value);
      } catch(e) { alert('机构 JSON 解析失败：' + e.message); return; }
    }
    var facEl = document.getElementById('corrEd_factions');
    if (facEl && facEl.value.trim()) {
      try {
        cc.entrenchedFactions = JSON.parse(facEl.value);
      } catch(e) { alert('集团 JSON 解析失败：' + e.message); return; }
    }

    if (typeof toast === 'function') toast('腐败配置已保存');
    else alert('已保存');
  };

  // ═════════════════════════════════════════════════════════════
  // 接入 tick（追加 P4 逻辑）
  // ═════════════════════════════════════════════════════════════

  var _origTick = CorruptionEngine.tick;
  CorruptionEngine.tick = function(context) {
    _origTick.call(this, context);
    try { applyRotationSideEffects(context); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p4] rotation:') : console.error('[corruption-p4] rotation:', e); }
    try { applyJuannaMonthly(context); }       catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p4] juanna:') : console.error('[corruption-p4] juanna:', e); }
    try { syncIndexFromSubDepts('\u8150\u8d25\u540e\u7eed\u8054\u52a8', { record: false }); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p4] sync:') : console.error('[corruption-p4] sync:', e); }
    try { updateRegionalCorruption(); }        catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'corruption-p4] region:') : console.error('[corruption-p4] region:', e); }
  };

  // 扩展 updatePerceived 以应用模式调节
  var _origUpdatePerc = CorruptionEngine.updatePerceived;
  CorruptionEngine.updatePerceived = function() {
    _origUpdatePerc.call(this);
    // 根据模式调整感知值偏差
    var mult = getModeMultipliers();
    var c = GM.corruption;
    ['central','provincial','military','fiscal','judicial','imperial'].forEach(function(k) {
      var sd = c.subDepts[k];
      var gap = sd.true - sd.perceived;
      sd.perceived = clamp(sd.true - gap * mult.floateryGap, 0, 100);
    });
  };

  // 首次启动时尝试安装地图钩子
  if (typeof window !== 'undefined') {
    window.addEventListener('load', function() {
      setTimeout(installMapHook, 200);
    });
    if (document.readyState === 'complete') setTimeout(installMapHook, 200);
  }

  // ═════════════════════════════════════════════════════════════
  // 暴露接口
  // ═════════════════════════════════════════════════════════════

  CorruptionEngine.getGameMode = getGameMode;
  CorruptionEngine.getModeMultipliers = getModeMultipliers;
  CorruptionEngine.openJuanna = openJuanna;
  CorruptionEngine.closeJuanna = closeJuanna;
  CorruptionEngine.isAIAvailable = isAIAvailable;
  CorruptionEngine.enrichCaseWithAI = enrichCaseWithAI;
  CorruptionEngine.toggleMapCorruptionOverlay = toggleMapCorruptionOverlay;
  CorruptionEngine.updateRegionalCorruption = updateRegionalCorruption;
  CorruptionEngine.getCorruptionColor = getCorruptionColor;
  CorruptionEngine.renderEditorPanel = renderEditorCorruptionPanel;
  CorruptionEngine.applyJuannaMonthly = applyJuannaMonthly;
  CorruptionEngine.aiPurgeAdvisor = aiPurgeAdvisor;

  console.log('[corruption-p4] 已加载：模式调节 / 轮换副作用 / 卖官 / AI增强 / 地图热力 / 编辑器面板');

})(typeof window !== 'undefined' ? window : this);

})(typeof window !== 'undefined' ? window : this);
