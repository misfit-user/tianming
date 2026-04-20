/**
 * tm-phase-a-patches.js — A 阶段经济补完
 *
 * 补完：
 *  A1 监察系统完整（派遣御史/成本/覆盖率/虚报暴露）
 *  A2 央地扩展 calcLocalRetentionRate / localGovernorAIDecision + 强征冷却 + 地域币值递减
 *  A3 Ledger 年度归档 + 家族两层继承 + 角色经济 AI 生成
 */
(function(global) {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════
  //  A1 · 监察系统完整
  // ═══════════════════════════════════════════════════════════════════

  var AUDIT_COVERAGE_COST = {
    light: { costPerRegion: 5000, exposeChance: 0.15, laborCost: 2 },
    normal: { costPerRegion: 12000, exposeChance: 0.35, laborCost: 5 },
    intensive: { costPerRegion: 30000, exposeChance: 0.65, laborCost: 10 }
  };

  function initAuditSystem(G) {
    if (!G.auditSystem) {
      G.auditSystem = {
        inspectorsAvailable: 10,
        inspectorsAssigned: {},
        activeAudits: [],
        totalAuditsCompleted: 0,
        totalFraudExposed: 0,
        strength: 0.5,  // 0-1 = 当前监察力度
        history: []
      };
    }
  }

  function dispatchAudit(targetRegionId, intensity) {
    var G = global.GM;
    initAuditSystem(G);
    var cfg = AUDIT_COVERAGE_COST[intensity || 'normal'];
    if (!cfg) return { ok: false, reason: '未知监察强度' };
    if (G.auditSystem.inspectorsAvailable < cfg.laborCost) return { ok: false, reason: '御史不足' };
    if (G.guoku && G.guoku.money < cfg.costPerRegion) return { ok: false, reason: '帑廪不足' };
    if (G.guoku) G.guoku.money -= cfg.costPerRegion;
    G.auditSystem.inspectorsAvailable -= cfg.laborCost;
    var audit = {
      id: 'audit_' + (G.turn || 0) + '_' + Math.floor(Math.random()*10000),
      region: targetRegionId,
      intensity: intensity || 'normal',
      startTurn: G.turn || 0,
      expectedReturnTurn: (G.turn || 0) + (intensity === 'intensive' ? 3 : intensity === 'light' ? 1 : 2),
      cost: cfg.costPerRegion,
      inspectors: cfg.laborCost,
      status: 'in_progress'
    };
    G.auditSystem.activeAudits.push(audit);
    if (global.addEB) global.addEB('监察', '遣御史察 ' + targetRegionId + '（' + (intensity || '常') + '）');
    return { ok: true, audit: audit };
  }

  /** 每回合监察演进 */
  function _tickAudits(ctx) {
    var G = global.GM;
    if (!G.auditSystem || !G.auditSystem.activeAudits) return;
    var remaining = [];
    G.auditSystem.activeAudits.forEach(function(audit) {
      if (audit.status !== 'in_progress') { remaining.push(audit); return; }
      if ((ctx.turn || 0) < audit.expectedReturnTurn) { remaining.push(audit); return; }
      // 完成
      var cfg = AUDIT_COVERAGE_COST[audit.intensity];
      var found = Math.random() < cfg.exposeChance;
      audit.status = 'completed';
      audit.found = found;
      G.auditSystem.totalAuditsCompleted++;
      if (found) {
        G.auditSystem.totalFraudExposed++;
        // 查出问题：对应 region 贪腐下降，虚报曝光
        _exposeFraud(audit, G);
      }
      // 御史回京
      G.auditSystem.inspectorsAvailable += audit.inspectors;
      // 强度回升
      G.auditSystem.strength = Math.min(1, G.auditSystem.strength + (found ? 0.05 : 0.02));
      if (global.addEB) global.addEB('监察', '御史回奏 ' + audit.region + (found ? '：查实舞弊' : '：未见异常'));
      remaining.push(audit);
    });
    // 仅保留最近 40 条
    G.auditSystem.activeAudits = remaining.slice(-40);
    // 未使用时强度自然衰减
    if (G.auditSystem.activeAudits.filter(function(a){return a.status==='in_progress';}).length === 0) {
      G.auditSystem.strength = Math.max(0.1, G.auditSystem.strength - 0.01);
    }
  }

  function _exposeFraud(audit, G) {
    var reg = G.fiscal && G.fiscal.regions && G.fiscal.regions[audit.region];
    if (reg) {
      reg.compliance = Math.min(1, (reg.compliance || 0.7) + 0.1);
      reg.skimmingRate = Math.max(0, (reg.skimmingRate || 0.1) - 0.05);
    }
    // 全国贪腐下降少许
    if (G.corruption && typeof G.corruption === 'object') {
      G.corruption.overall = Math.max(0, (G.corruption.overall || 30) - 2);
    }
    // 若该 region 的地方官存在 → 可能下狱
    var localGov = (G.chars || []).find(function(c){return c.alive !== false && c.region === audit.region && (c.officialTitle||'').match(/知|总督|巡抚|刺史/);});
    if (localGov && Math.random() < 0.5) {
      localGov.alive = false;
      localGov._purgedTurn = G.turn;
      if (global.addEB) global.addEB('监察', localGov.name + ' 因舞弊被斩');
    }
    // 虚报暴露：撤销本回合虚报额
    var peasantBurden = reg && reg.peasantBurden;
    if (peasantBurden && peasantBurden.claimed > peasantBurden.actual) {
      var diff = peasantBurden.claimed - peasantBurden.actual;
      if (G.guoku) G.guoku.money += Math.floor(diff * 0.5);  // 追缴一半
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A2 · 央地 calcLocalRetentionRate + 地方官 AI 决策 + 强征冷却 + 地域币值
  // ═══════════════════════════════════════════════════════════════════

  /** 地方留存率公式 */
  function calcLocalRetentionRate(regionId) {
    var G = global.GM;
    if (!G.fiscal || !G.fiscal.regions) return 0.3;
    var reg = G.fiscal.regions[regionId];
    if (!reg) return 0.3;
    var base = reg.retentionRate || 0.3;
    // 皇权影响（弱皇权 → 地方留更多）
    var hqIndex = G.huangquan && G.huangquan.index || 55;
    var hqMod = 1 + (55 - hqIndex) / 100;  // 皇权 30 → 1.25x；皇权 80 → 0.75x
    // 地方自治度
    var autonomyMod = 1 + (reg.autonomyLevel || 0.3) * 0.5;
    // 皇威（失威段 → 地方扣更多）
    var hwIndex = G.huangwei && G.huangwei.index || 50;
    var hwMod = hwIndex < 30 ? 1.3 : hwIndex > 70 ? 0.9 : 1.0;
    var final = base * hqMod * autonomyMod * hwMod;
    return Math.max(0.1, Math.min(0.8, final));
  }

  /** 地方官 AI 决策（prompt 上下文注入用） */
  function localGovernorAIDecision(regionId, context) {
    var G = global.GM;
    var reg = G.fiscal && G.fiscal.regions && G.fiscal.regions[regionId];
    if (!reg) return null;
    var localGov = (G.chars || []).find(function(c){return c.alive !== false && c.region === regionId && (c.officialTitle||'').match(/知|总督|巡抚/);});
    var priority = [];
    // 根据实际情况选择
    var localPop = G.population && G.population.byRegion && G.population.byRegion[regionId];
    if (localPop && localPop.disasterLevel > 0.3) priority.push('relief_disaster');
    if (reg.retainedBudget > 100000) priority.push('public_works');
    if (reg.peasantBurden && reg.peasantBurden.ratio > 0.6) priority.push('burden_reduction');
    if (reg.unrest > 60) priority.push('security');
    // 腐败倾向
    var corrupt = localGov && (localGov.integrity || 60) < 40;
    if (corrupt) priority.push('embezzlement');
    // 立功
    if (localGov && (localGov.ambition || 50) > 70) priority.push('showcase_project');
    return {
      region: regionId,
      governor: localGov ? localGov.name : '无主官',
      availableBudget: reg.retainedBudget || 0,
      priorities: priority,
      complianceCurrent: reg.compliance || 0.7,
      suggestion: priority[0] || 'maintenance'
    };
  }

  /** 强征冷却（连续2回合内再征 → 双倍惩罚） */
  function checkForcedLevyCooldown(regionId, amount) {
    var G = global.GM;
    if (!G.fiscal || !G.fiscal.regions) return { ok: true };
    var reg = G.fiscal.regions[regionId];
    if (!reg) return { ok: false };
    if (!reg.forcedLevyHistory) reg.forcedLevyHistory = [];
    var recentLevy = reg.forcedLevyHistory.filter(function(h){return (G.turn - h.turn) < 2;});
    var penaltyMult = 1.0;
    if (recentLevy.length > 0) {
      // 二次强征：双倍 compliance 惩罚
      reg.compliance = Math.max(0.1, (reg.compliance || 0.7) - 0.4);
      penaltyMult = 2.0;
      if (global.addEB) global.addEB('央地', regionId + ' 连征，合规骤降（强征冷却惩罚）');
    } else {
      reg.compliance = Math.max(0.1, (reg.compliance || 0.7) - 0.2);
    }
    reg.forcedLevyHistory.push({ turn: G.turn || 0, amount: amount, penaltyMult: penaltyMult });
    if (reg.forcedLevyHistory.length > 10) reg.forcedLevyHistory.splice(0, reg.forcedLevyHistory.length - 10);
    return { ok: true, penaltyMult: penaltyMult };
  }

  /** 地域币值递减 acceptanceByRegion */
  function updateCurrencyAcceptance(G, mr) {
    if (!G.currency || !G.currency.coins) return;
    if (!G.currency.market) G.currency.market = {};
    if (!G.currency.market.acceptanceByRegion) G.currency.market.acceptanceByRegion = {};
    // 以京畿 100% 为基准，边远地逐级递减
    var capitalRegion = G._capital || 'central';
    (G.regions || []).forEach(function(r) {
      if (!r.id) return;
      var base = 1.0;
      if (r.id === capitalRegion) base = 1.0;
      else if (/苏|杭|扬/.test(r.name || '')) base = 0.95;
      else if (/边|塞|戍/.test(r.name || '')) base = 0.6;
      else if (/藏|滇|黔|蜀/.test(r.name || '')) base = 0.7;
      else base = 0.85;
      // 通胀影响
      var inflation = (G.currency.market.inflation || 0);
      base *= Math.max(0.5, 1 - Math.abs(inflation));
      // 铸币成色
      var purity = G.currency.coins.copper && G.currency.coins.copper.currentPurity || 0.9;
      base *= purity;
      G.currency.market.acceptanceByRegion[r.id] = {
        acceptance: Math.max(0.3, Math.min(1, base)),
        effectiveValue: Math.max(0.3, Math.min(1, base))
      };
    });
  }

  // ═══════════════════════════════════════════════════════════════════
  //  A3 · Ledger 年度归档 + 家族继承 + 角色 AI 生成
  // ═══════════════════════════════════════════════════════════════════

  /** Ledger.history 年度归档 */
  function archiveLedgerYearly(G, turn) {
    if (!G.guoku) return;
    if (!G.guoku.history) G.guoku.history = { monthly: [], yearlyArchive: [] };
    var hist = G.guoku.history;
    if (!hist.yearlyArchive) hist.yearlyArchive = [];
    var monthly = hist.monthly || [];
    if (monthly.length < 12) return;
    // 聚合最后 12 月
    var lastYear = monthly.slice(-12);
    var yearly = {
      year: G.year || 1,
      totalIncome: 0,
      totalExpense: 0,
      bySource: {},
      bySink: {},
      endBalance: G.guoku.money || 0
    };
    lastYear.forEach(function(m) {
      yearly.totalIncome += m.income || 0;
      yearly.totalExpense += m.expense || 0;
      (m.sources || []).forEach(function(s) {
        yearly.bySource[s.type] = (yearly.bySource[s.type] || 0) + s.amount;
      });
      (m.sinks || []).forEach(function(s) {
        yearly.bySink[s.type] = (yearly.bySink[s.type] || 0) + s.amount;
      });
    });
    hist.yearlyArchive.push(yearly);
    // 清 monthly 最早 12 月
    hist.monthly = monthly.slice(-12);
    // 最多保留 20 年
    if (hist.yearlyArchive.length > 20) hist.yearlyArchive.splice(0, hist.yearlyArchive.length - 20);
    if (global.addEB) global.addEB('帑廪', '年度决算：岁入 ' + yearly.totalIncome + ' 钱，岁出 ' + yearly.totalExpense + ' 钱');
  }

  /** 家族两层（core / extended）继承 */
  function initFamilyStructure(character) {
    // 兼容：某些剧本数据里 family 是字符串（家族名）·需升级为对象
    if (typeof character.family === 'string') {
      character.family = { name: character.family };
    }
    if (!character.family || typeof character.family !== 'object') character.family = {};
    if (!character.family.core) character.family.core = {};
    if (!('spouse' in character.family.core)) character.family.core.spouse = null;
    if (!Array.isArray(character.family.core.children)) character.family.core.children = [];
    if (!Array.isArray(character.family.core.inheritors)) character.family.core.inheritors = [];
    if (!character.family.extended) character.family.extended = {};
    if (!Array.isArray(character.family.extended.siblings)) character.family.extended.siblings = [];
    if (!Array.isArray(character.family.extended.uncles)) character.family.extended.uncles = [];
    if (!Array.isArray(character.family.extended.inLaws)) character.family.extended.inLaws = [];
  }

  function processInheritance(character, G) {
    if (!character || character.alive !== false) return;
    initFamilyStructure(character);
    if (character._inheritanceProcessed) return;
    character._inheritanceProcessed = true;
    // 继承
    var coreHeirs = character.family.core.inheritors && character.family.core.inheritors.length > 0 ?
                    character.family.core.inheritors :
                    character.family.core.children || [];
    var extendedHeirs = character.family.extended.siblings || [];
    // 核心继承 80%
    var wealth = character.privateWealth || {};
    if (coreHeirs.length > 0) {
      var perCore = {};
      Object.keys(wealth).forEach(function(k) {
        var total = typeof wealth[k] === 'number' ? wealth[k] : 0;
        perCore[k] = total * 0.8 / coreHeirs.length;
      });
      coreHeirs.forEach(function(heirName) {
        var heir = (G.chars || []).find(function(c){return c.name===heirName;});
        if (heir) {
          heir.privateWealth = heir.privateWealth || {};
          Object.keys(perCore).forEach(function(k) {
            heir.privateWealth[k] = (heir.privateWealth[k] || 0) + perCore[k];
          });
        }
      });
    }
    // 扩展继承 20%（若无核心则 100%）
    var extendedShare = coreHeirs.length > 0 ? 0.2 : 1.0;
    if (extendedHeirs.length > 0) {
      var perExt = {};
      Object.keys(wealth).forEach(function(k) {
        var total = typeof wealth[k] === 'number' ? wealth[k] : 0;
        perExt[k] = total * extendedShare / extendedHeirs.length;
      });
      extendedHeirs.forEach(function(heirName) {
        var heir = (G.chars || []).find(function(c){return c.name===heirName;});
        if (heir) {
          heir.privateWealth = heir.privateWealth || {};
          Object.keys(perExt).forEach(function(k) {
            heir.privateWealth[k] = (heir.privateWealth[k] || 0) + perExt[k];
          });
        }
      });
    }
    if (global.addEB) global.addEB('继承', character.name + ' 遗产入册 ' + coreHeirs.length + ' 核心 + ' + extendedHeirs.length + ' 扩展');
  }

  /** 角色经济 AI 生成（扩展到 6 资源） */
  function aiGenerateCharacterEconomy(char, context) {
    // 按阶层默认模板生成
    var classKey = char.class || 'commoner';
    var templates = {
      imperial:       { publicTreasury: 10000000, cash: 500000, land: 100000, treasure: 50000, slaves: 500, commerce: 100000, fame: 80, virtueMerit: 60 },
      noble:          { publicTreasury: 500000,   cash: 200000, land: 50000,  treasure: 20000, slaves: 100, commerce: 30000, fame: 60, virtueMerit: 40 },
      civilOfficial:  { publicTreasury: 100000,   cash: 50000,  land: 10000,  treasure: 5000,  slaves: 20,  commerce: 5000,  fame: 50, virtueMerit: 50 },
      militaryOfficial:{ publicTreasury: 200000,  cash: 30000,  land: 20000,  treasure: 3000,  slaves: 30,  commerce: 2000,  fame: 55, virtueMerit: 40 },
      merchant:       { publicTreasury: 0,        cash: 300000, land: 5000,   treasure: 30000, slaves: 10,  commerce: 200000, fame: 30, virtueMerit: 20 },
      landlord:       { publicTreasury: 0,        cash: 20000,  land: 30000,  treasure: 2000,  slaves: 50,  commerce: 3000,  fame: 35, virtueMerit: 25 },
      clergy:         { publicTreasury: 50000,    cash: 5000,   land: 5000,   treasure: 1000,  slaves: 5,   commerce: 1000,  fame: 45, virtueMerit: 55 },
      commoner:       { publicTreasury: 0,        cash: 500,    land: 50,     treasure: 0,     slaves: 0,   commerce: 100,   fame: 10, virtueMerit: 15 }
    };
    var template = templates[classKey] || templates.commoner;
    // 根据重要性（官阶、剧本地位）缩放
    var importance = (char.rank ? (10 - char.rank) / 10 : 0.5);
    char.resources = char.resources || {};
    char.resources.publicTreasury = Math.floor(template.publicTreasury * (0.5 + importance));
    char.privateWealth = {
      cash:     Math.floor(template.cash * (0.5 + importance * 0.5)),
      land:     Math.floor(template.land * (0.5 + importance * 0.5)),
      treasure: Math.floor(template.treasure * (0.5 + importance * 0.5)),
      slaves:   Math.floor(template.slaves * (0.5 + importance * 0.5)),
      commerce: Math.floor(template.commerce * (0.5 + importance * 0.5))
    };
    char.fame = (char.fame !== undefined) ? char.fame : template.fame;
    char.virtueMerit = (char.virtueMerit !== undefined) ? char.virtueMerit : template.virtueMerit;
    // 行为权重注入（高美德 → 倾向慈善；高野心 → 倾向贿赂）
    char.aiBehaviorWeights = {
      charity: Math.max(0, (char.benevolence || 50) / 100 - 0.3),
      bribe:   Math.max(0, (char.ambition || 50) / 100 - 0.3) * (1 - (char.integrity || 60) / 100),
      embezzle: Math.max(0, 0.5 - (char.integrity || 60) / 100),
      showcase: Math.max(0, (char.ambition || 50) / 100 - 0.4)
    };
    return char;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  Tick + Init
  // ═══════════════════════════════════════════════════════════════════

  function tick(ctx) {
    ctx = ctx || {};
    var mr = ctx.monthRatio || 1;
    var G = global.GM;
    // 监察
    try { _tickAudits(ctx); } catch(e) { console.error('[phaseA] audit:', e); }
    // 地域币值
    try { updateCurrencyAcceptance(G, mr); } catch(e) { console.error('[phaseA] curAccept:', e); }
    // 年度归档（财政年初）
    try {
      if ((G.month || 1) === 1 && (G.turn || 0) > 0) {
        archiveLedgerYearly(G, G.turn);
      }
    } catch(e) { console.error('[phaseA] archive:', e); }
    // 死亡继承扫描
    try {
      (G.chars || []).forEach(function(c) {
        if (c.alive === false && !c._inheritanceProcessed && (ctx.turn - (c._deathTurn || ctx.turn)) < 3) {
          processInheritance(c, G);
        }
      });
    } catch(e) { console.error('[phaseA] inherit:', e); }
  }

  function init(sc) {
    var G = global.GM;
    if (!G) return;
    initAuditSystem(G);
  }

  // ═══════════════════════════════════════════════════════════════════
  //  导出
  // ═══════════════════════════════════════════════════════════════════

  global.PhaseA = {
    init: init,
    tick: tick,
    dispatchAudit: dispatchAudit,
    calcLocalRetentionRate: calcLocalRetentionRate,
    localGovernorAIDecision: localGovernorAIDecision,
    checkForcedLevyCooldown: checkForcedLevyCooldown,
    updateCurrencyAcceptance: updateCurrencyAcceptance,
    archiveLedgerYearly: archiveLedgerYearly,
    processInheritance: processInheritance,
    aiGenerateCharacterEconomy: aiGenerateCharacterEconomy,
    AUDIT_COVERAGE_COST: AUDIT_COVERAGE_COST,
    VERSION: 1
  };

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
