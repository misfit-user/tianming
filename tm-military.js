// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-military.js — 军事·封建·头衔·补给·铨选·战争·建筑 (R122 从 tm-economy-military.js L723-end 拆出)
// 姊妹: tm-economy.js (L1-722·经济+继承)
// ============================================================

// ============================================================
// 战斗策略抽取系统
// ============================================================

// 战斗策略系统：将战术细节从 AI 推演中抽取出来，提供可视化展示
// 不替换现有的 AI 战斗推演，而是作为增强层提供战术分析

// 战术类型定义
var TacticTypes = {
  offensive: {
    frontal_assault: { name: '正面强攻', moraleCost: 15, casualtyRate: 0.2, successRate: 0.6 },
    flanking: { name: '侧翼包抄', moraleCost: 10, casualtyRate: 0.15, successRate: 0.7 },
    cavalry_charge: { name: '骑兵冲锋', moraleCost: 12, casualtyRate: 0.18, successRate: 0.65 },
    siege: { name: '围城', moraleCost: 8, casualtyRate: 0.1, successRate: 0.5 },
    ambush: { name: '伏击', moraleCost: 5, casualtyRate: 0.08, successRate: 0.8 }
  },
  defensive: {
    hold_ground: { name: '坚守阵地', moraleCost: 8, casualtyRate: 0.12, successRate: 0.7 },
    retreat: { name: '战略撤退', moraleCost: 20, casualtyRate: 0.05, successRate: 0.9 },
    counter_attack: { name: '反击', moraleCost: 12, casualtyRate: 0.15, successRate: 0.65 },
    fortify: { name: '加固防御', moraleCost: 5, casualtyRate: 0.08, successRate: 0.75 }
  },
  special: {
    night_raid: { name: '夜袭', moraleCost: 10, casualtyRate: 0.12, successRate: 0.7 },
    feint: { name: '佯攻', moraleCost: 5, casualtyRate: 0.05, successRate: 0.8 },
    scorched_earth: { name: '坚壁清野', moraleCost: 15, casualtyRate: 0.02, successRate: 0.85 },
    psychological: { name: '心理战', moraleCost: 3, casualtyRate: 0.01, successRate: 0.6 }
  }
};

// 战斗策略分析
function analyzeBattleStrategy(attacker, defender, context) {
  if (!attacker || !defender) return null;

  var analysis = {
    attacker: {
      name: attacker.name,
      strength: calculateArmyStrength(attacker),
      morale: attacker.morale || 70,
      commander: attacker.commander,
      recommendedTactics: []
    },
    defender: {
      name: defender.name,
      strength: calculateArmyStrength(defender),
      morale: defender.morale || 70,
      commander: defender.commander,
      recommendedTactics: []
    },
    terrain: context.terrain || 'plains',
    weather: context.weather || 'clear',
    prediction: null
  };

  // 推荐进攻方战术
  analysis.attacker.recommendedTactics = recommendTactics(attacker, defender, 'offensive', context);

  // 推荐防守方战术
  analysis.defender.recommendedTactics = recommendTactics(defender, attacker, 'defensive', context);

  // 预测战斗结果
  analysis.prediction = predictBattleOutcome(analysis);

  return analysis;
}

// 计算军队实力
/**
 * 增强军力计算：兵力 × 士气 × 训练 × 品质 × 将领 × 补给 × 地形 × 兵种
 * @param {Object} army - 军队对象
 * @param {Object} [context] - 可选战场上下文 {terrain, isDefender, enemyType}
 * @returns {number}
 */
function calculateArmyStrength(army, context) {
  if (!army || army.destroyed) return 0;
  var ctx = context || {};

  var baseStrength = army.soldiers || army.strength || 1000;
  var moraleMod = 0.5 + (army.morale || 70) / 200;       // 0.5-1.0
  var trainingMod = 0.5 + (army.training || 50) / 200;    // 0.5-1.0
  var qualityMod = army.quality === '\u7CBE\u9510' ? 1.3 : army.quality === '\u65B0\u5175' ? 0.7 : 1.0;

  // 将领加成（军事能力+智力综合）
  var commanderMod = 1.0;
  if (army.commander) {
    var commander = typeof findCharByName === 'function' ? findCharByName(army.commander) : null;
    if (commander) {
      var military = commander.military || commander.valor || 50;
      var intel = commander.intelligence || 50;
      commanderMod = 1 + (military * 0.7 + intel * 0.3) / 200; // 1.0-1.5
    }
  }

  // 补给加成（0.5无补给~1.2满补给）
  var supplyMod = 1.0;
  if (army.supplyRatio !== undefined) {
    supplyMod = 0.5 + (army.supplyRatio || 0) * 0.7; // 0.5-1.2
  }

  // 地形加成（从P.battleConfig读取，防守方额外+10%）
  var terrainMod = 1.0;
  if (ctx.terrain && P.battleConfig && P.battleConfig.terrainModifiers) {
    var tMod = P.battleConfig.terrainModifiers[ctx.terrain];
    if (tMod) terrainMod = ctx.isDefender ? (tMod.defender || 1.0) : (tMod.attacker || 1.0);
  } else if (ctx.isDefender) {
    terrainMod = 1.1; // 默认防守方+10%
  }

  // 兵种克制（简化：从unitTypes配置读取）
  var unitMod = 1.0;
  if (army.type && ctx.enemyType && P.battleConfig && P.battleConfig.unitTypes) {
    var unitDef = P.battleConfig.unitTypes.find(function(u) { return u.id === army.type; });
    if (unitDef && unitDef.strong_against && unitDef.strong_against.indexOf(ctx.enemyType) >= 0) unitMod = 1.25;
    if (unitDef && unitDef.weak_against && unitDef.weak_against.indexOf(ctx.enemyType) >= 0) unitMod = 0.75;
  }

  return baseStrength * moraleMod * trainingMod * qualityMod * commanderMod * supplyMod * terrainMod * unitMod;
}

// 推荐战术
function recommendTactics(army, enemy, tacticCategory, context) {
  var tactics = [];
  var availableTactics = TacticTypes[tacticCategory] || {};

  var armyStrength = calculateArmyStrength(army);
  var enemyStrength = calculateArmyStrength(enemy);
  var strengthRatio = armyStrength / (enemyStrength || 1);

  Object.keys(availableTactics).forEach(function(tacticKey) {
    var tactic = availableTactics[tacticKey];
    var score = evaluateTactic(tactic, army, enemy, strengthRatio, context);

    tactics.push({
      key: tacticKey,
      name: tactic.name,
      score: score,
      moraleCost: tactic.moraleCost,
      casualtyRate: tactic.casualtyRate,
      successRate: tactic.successRate,
      description: generateTacticDescription(tactic, army, enemy, context)
    });
  });

  // 按得分排序
  tactics.sort(function(a, b) { return b.score - a.score; });

  return tactics.slice(0, 3); // 返回前 3 个推荐战术
}

// 评估战术得分
function evaluateTactic(tactic, army, enemy, strengthRatio, context) {
  var score = tactic.successRate * 100;

  // 实力比影响
  if (strengthRatio > 1.5) {
    // 优势方：进攻战术加分
    if (tactic.name.indexOf('强攻') >= 0 || tactic.name.indexOf('冲锋') >= 0) {
      score += 20;
    }
  } else if (strengthRatio < 0.7) {
    // 劣势方：防守和特殊战术加分
    if (tactic.name.indexOf('撤退') >= 0 || tactic.name.indexOf('防御') >= 0) {
      score += 20;
    }
  }

  // 士气影响
  var morale = army.morale || 70;
  if (morale < 50 && tactic.moraleCost > 10) {
    score -= 30; // 低士气时避免高士气消耗战术
  }

  // 地形影响
  if (context.terrain === 'mountains' && tactic.name.indexOf('骑兵') >= 0) {
    score -= 20; // 山地不利于骑兵
  } else if (context.terrain === 'plains' && tactic.name.indexOf('骑兵') >= 0) {
    score += 15; // 平原有利于骑兵
  }

  // 天气影响
  if (context.weather === 'rain' && tactic.name.indexOf('夜袭') >= 0) {
    score += 10; // 雨天有利于夜袭
  }

  return Math.max(0, Math.min(100, score));
}

// 生成战术描述
function generateTacticDescription(tactic, army, enemy, context) {
  var desc = tactic.name + '：';

  if (tactic.successRate > 0.7) {
    desc += '成功率高，';
  } else if (tactic.successRate < 0.5) {
    desc += '风险较大，';
  }

  if (tactic.casualtyRate > 0.15) {
    desc += '伤亡较重';
  } else if (tactic.casualtyRate < 0.1) {
    desc += '伤亡较轻';
  }

  if (tactic.moraleCost > 12) {
    desc += '，对士气影响大';
  }

  return desc;
}

// 预测战斗结果
function predictBattleOutcome(analysis) {
  var attackerStrength = analysis.attacker.strength;
  var defenderStrength = analysis.defender.strength;
  var strengthRatio = attackerStrength / (defenderStrength || 1);

  var prediction = {
    winner: null,
    confidence: 0,
    attackerCasualties: 0,
    defenderCasualties: 0,
    duration: 0 // 战斗持续回合数
  };

  // 简单预测逻辑
  if (strengthRatio > 1.3) {
    prediction.winner = analysis.attacker.name;
    prediction.confidence = Math.min(0.9, 0.5 + (strengthRatio - 1) * 0.2);
    prediction.attackerCasualties = Math.floor(attackerStrength * 0.1);
    prediction.defenderCasualties = Math.floor(defenderStrength * 0.4);
    prediction.duration = 1;
  } else if (strengthRatio < 0.7) {
    prediction.winner = analysis.defender.name;
    prediction.confidence = Math.min(0.9, 0.5 + (1 / strengthRatio - 1) * 0.2);
    prediction.attackerCasualties = Math.floor(attackerStrength * 0.4);
    prediction.defenderCasualties = Math.floor(defenderStrength * 0.1);
    prediction.duration = 1;
  } else {
    prediction.winner = '胶着';
    prediction.confidence = 0.5;
    prediction.attackerCasualties = Math.floor(attackerStrength * 0.2);
    prediction.defenderCasualties = Math.floor(defenderStrength * 0.2);
    prediction.duration = 2;
  }

  return prediction;
}

// 生成战斗策略报告
function generateBattleStrategyReport(analysis) {
  if (!analysis) return '无战斗分析数据';

  var report = '【战斗策略分析】\n\n';

  // 进攻方
  report += '【进攻方：' + analysis.attacker.name + '】\n';
  report += '实力：' + Math.floor(analysis.attacker.strength) + ' | ';
  report += '士气：' + analysis.attacker.morale + '\n';
  if (analysis.attacker.commander) {
    report += '统帅：' + analysis.attacker.commander + '\n';
  }
  report += '推荐战术：\n';
  analysis.attacker.recommendedTactics.forEach(function(t, i) {
    report += '  ' + (i + 1) + '. ' + t.name + '（得分：' + t.score.toFixed(0) + '）\n';
    report += '     ' + t.description + '\n';
  });
  report += '\n';

  // 防守方
  report += '【防守方：' + analysis.defender.name + '】\n';
  report += '实力：' + Math.floor(analysis.defender.strength) + ' | ';
  report += '士气：' + analysis.defender.morale + '\n';
  if (analysis.defender.commander) {
    report += '统帅：' + analysis.defender.commander + '\n';
  }
  report += '推荐战术：\n';
  analysis.defender.recommendedTactics.forEach(function(t, i) {
    report += '  ' + (i + 1) + '. ' + t.name + '（得分：' + t.score.toFixed(0) + '）\n';
    report += '     ' + t.description + '\n';
  });
  report += '\n';

  // 战场环境
  report += '【战场环境】\n';
  report += '地形：' + analysis.terrain + ' | 天气：' + analysis.weather + '\n\n';

  // 预测结果
  if (analysis.prediction) {
    report += '【战果预测】\n';
    report += '预测胜者：' + analysis.prediction.winner + '\n';
    report += '置信度：' + (analysis.prediction.confidence * 100).toFixed(0) + '%\n';
    report += '预计伤亡：\n';
    report += '  进攻方：' + analysis.prediction.attackerCasualties + ' 人\n';
    report += '  防守方：' + analysis.prediction.defenderCasualties + ' 人\n';
    report += '预计持续：' + analysis.prediction.duration + ' 回合\n';
  }

  return report;
}

// 执行战术（应用战术效果）
function executeTactic(army, tacticKey, tacticCategory) {
  var tactics = TacticTypes[tacticCategory];
  if (!tactics || !tactics[tacticKey]) {
    return { success: false, reason: '战术不存在' };
  }

  var tactic = tactics[tacticKey];

  // 应用士气消耗
  if (army.morale !== undefined) {
    army.morale = Math.max(0, army.morale - tactic.moraleCost);
  }

  // 应用伤亡
  if (army.soldiers !== undefined) {
    var casualties = Math.floor(army.soldiers * tactic.casualtyRate);
    army.soldiers = Math.max(0, army.soldiers - casualties);
  }

  // 记录战术使用
  addEB('战术', army.name + ' 使用战术：' + tactic.name);

  return {
    success: true,
    tactic: tactic,
    moraleLoss: tactic.moraleCost,
    casualties: Math.floor((army.soldiers || 0) * tactic.casualtyRate)
  };
}

// ============================================================
// 战斗结算引擎（BattleEngine）
// 接通已有 analyzeBattleStrategy + calculateArmyStrength + predictBattleOutcome
// 输出确定性战斗结果，注入AI prompt作为不可更改事实
// ============================================================

var MilitarySystems = (function(global) {
  'use strict';

  function _root(root) {
    return root || global.GM || {};
  }

  function _clone(value) {
    if (value === undefined) return undefined;
    try { return JSON.parse(JSON.stringify(value)); }
    catch(_) {
      if (Array.isArray(value)) return value.slice();
      if (value && typeof value === 'object') return Object.assign({}, value);
      return value;
    }
  }

  function _getPath(obj, path) {
    if (!obj || !path) return undefined;
    var cur = obj;
    String(path).split('.').forEach(function(part) {
      if (cur === undefined || cur === null) return;
      cur = cur[part];
    });
    return cur;
  }

  function _readConstant(path, root) {
    var sources = [_root(root), global.GM, global.P, global.scriptData];
    var api = (global.TM && global.TM.EngineConstants) || global.EngineConstants;
    if (api && typeof api.read === 'function') {
      for (var i = 0; i < sources.length; i++) {
        if (!sources[i]) continue;
        try {
          var viaApi = api.read(path, sources[i]);
          if (viaApi !== undefined) return viaApi;
        } catch(_) {}
      }
    }
    for (var j = 0; j < sources.length; j++) {
      var ec = sources[j] && sources[j].engineConstants;
      var value = _getPath(ec, path);
      if (value !== undefined) return _clone(value);
    }
    return undefined;
  }

  function _normalizeAttribution(value) {
    value = String(value || '').toLowerCase();
    if (value === 'commander' || value === 'general' || value === 'private') return 'commander';
    if (value === 'leader') return 'leader';
    if (value === 'local') return 'local';
    if (value === 'throne') return 'throne';
    if (value === 'banner') return 'banner';
    return 'state';
  }

  function _legacySystems(root) {
    var list = [];
    var src = (global.P && global.P.military && global.P.military.militarySystem) ||
              (global.scriptData && global.scriptData.military && global.scriptData.military.militarySystem) ||
              (_root(root).military && _root(root).military.militarySystem);
    if (Array.isArray(src)) list = src;
    else if (src && typeof src === 'object') {
      Object.keys(src).forEach(function(key) {
        var item = src[key];
        if (item && typeof item === 'object') list.push(Object.assign({ id: key }, item));
      });
    }
    if (!list.length) {
      list = [{ id:'recruited_army', name:'\u52df\u5175', recruitmentType:'paid', salaryType:'central', peacetimeRole:'garrison', mobilizationDelay:2, loyaltyAttribution:'commander' }];
    }
    return list;
  }

  function _normalizeSystem(sys, index) {
    sys = sys || {};
    var id = String(sys.id || sys.key || sys.name || ('military_system_' + index));
    return {
      id: id,
      name: String(sys.name || sys.label || id),
      recruitmentType: String(sys.recruitmentType || sys.recruitment || sys.type || 'paid'),
      salaryType: String(sys.salaryType || sys.paymentModel || sys.salary || 'central'),
      peacetimeRole: String(sys.peacetimeRole || sys.role || 'garrison'),
      mobilizationDelay: Math.max(0, Math.round(Number(sys.mobilizationDelay || 0))),
      loyaltyAttribution: _normalizeAttribution(sys.loyaltyAttribution || sys.loyalty || sys.ownerType)
    };
  }

  function getMilitarySystems(root) {
    var declared = _readConstant('militarySystems', root);
    var list = Array.isArray(declared) && declared.length ? declared : _legacySystems(root);
    return list.map(_normalizeSystem);
  }

  function getMilitarySystemForArmy(army, root) {
    army = army || {};
    var systems = getMilitarySystems(root);
    var keys = [
      army.militarySystemId, army.systemId, army.militarySystem,
      army.armyType, army.type, army.branch, army.paymentModel
    ].filter(Boolean).map(function(v) { return String(v).toLowerCase(); });
    for (var i = 0; i < systems.length; i++) {
      var s = systems[i];
      var hay = [s.id, s.name, s.recruitmentType, s.salaryType].map(function(v) { return String(v).toLowerCase(); });
      if (keys.some(function(k) { return hay.indexOf(k) >= 0; })) return s;
    }
    return systems[0] || _normalizeSystem(null, 0);
  }

  function payArrearsBaseline(army, root) {
    army = army || {};
    var cfg = _readConstant('militaryPayArrearsBaseline', root) || {};
    var months = Math.max(0, Math.round(Number(army.payArrearsMonths || 0)));
    var moralePerMonth = Number(cfg.moralePerMonth);
    var loyaltyPerMonth = Number(cfg.loyaltyPerMonth);
    var routeMoraleBelow = Number(cfg.routeMoraleBelow);
    if (!isFinite(moralePerMonth)) moralePerMonth = -10;
    if (!isFinite(loyaltyPerMonth)) loyaltyPerMonth = -5;
    if (!isFinite(routeMoraleBelow)) routeMoraleBelow = 10;
    return {
      months: months,
      moraleDelta: months > 0 ? moralePerMonth * months : 0,
      loyaltyDelta: months > 0 ? loyaltyPerMonth * months : 0,
      routeMoraleBelow: routeMoraleBelow
    };
  }

  function _withinClamp(value, baseline, clamp) {
    value = Number(value);
    baseline = Number(baseline);
    if (!isFinite(value) || !isFinite(baseline)) return false;
    if (baseline === 0) return value === 0;
    return Math.abs(value - baseline) <= Math.abs(baseline) * clamp + 0.0001;
  }

  function validatePayArrearsAdjustment(army, adjustment, root) {
    var base = payArrearsBaseline(army, root);
    var clamp = Number(_readConstant('militaryPayArrearsClamp', root));
    if (!isFinite(clamp)) clamp = 0.3;
    adjustment = adjustment || {};
    var moraleDelta = adjustment.moraleDelta === undefined ? base.moraleDelta : Number(adjustment.moraleDelta);
    var loyaltyDelta = adjustment.loyaltyDelta === undefined ? base.loyaltyDelta : Number(adjustment.loyaltyDelta);
    var ok = _withinClamp(moraleDelta, base.moraleDelta, clamp) && _withinClamp(loyaltyDelta, base.loyaltyDelta, clamp);
    if (ok && (moraleDelta !== base.moraleDelta || loyaltyDelta !== base.loyaltyDelta) && !adjustment.reason) {
      ok = false;
    }
    return {
      ok: ok,
      reason: ok ? '' : 'pay-arrears-adjustment-out-of-clamp',
      clamp: clamp,
      baseline: base,
      adjusted: { moraleDelta: moraleDelta, loyaltyDelta: loyaltyDelta }
    };
  }

  function _clamp100(value) {
    value = Number(value);
    if (!isFinite(value)) value = 0;
    return Math.max(0, Math.min(100, Math.round(value)));
  }

  function _markRouted(army, attribution, turn) {
    army.routed = true;
    army.state = 'routed';
    army._routedTurn = turn || 0;
    army._routedReason = 'pay_arrears_morale_collapse';
    army.loyaltyAttribution = attribution;
    if (attribution === 'commander' || attribution === 'leader') {
      if (army.commanderAlive === false || army._commanderLost || army.leaderAlive === false || army._leaderLost) {
        army.disbandedRisk = Math.min(100, (army.disbandedRisk || 0) + 20);
        army._routedAftermath = attribution === 'leader' ? 'leader_lost' : 'commander_lost';
      } else {
        army.loyalty = _clamp100((army.loyalty || 50) - 5);
        army._routedAftermath = attribution === 'leader' ? 'leader_holds' : 'commander_holds';
      }
    } else if (attribution === 'banner') {
      army.mutinyRisk = Math.min(100, (army.mutinyRisk || 0) + 10);
      army.cohesion = _clamp100((army.cohesion === undefined ? 70 : army.cohesion) - 10);
      army._routedAftermath = 'banner_internal';
    } else if (attribution === 'local') {
      army.mutinyRisk = Math.min(100, (army.mutinyRisk || 0) + 15);
      army.cohesion = _clamp100((army.cohesion === undefined ? 70 : army.cohesion) - 5);
      army._routedAftermath = 'local_fragmentation';
    } else if (attribution === 'throne') {
      army.mutinyRisk = Math.min(100, (army.mutinyRisk || 0) + 20);
      army.loyalty = _clamp100((army.loyalty || 50) - 10);
      army._routedAftermath = 'throne_guard_disgraced';
    } else {
      army.mutinyRisk = Math.min(100, (army.mutinyRisk || 0) + 25);
      army._routedAftermath = 'state_collapse';
    }
  }

  function applyPayArrearsPressure(army, options, root) {
    if (!army) return { ok: false, reason: 'missing-army' };
    options = options || {};
    var G = _root(root);
    var turn = Number(G.turn || global.GM && global.GM.turn || 0) || 0;
    var base = payArrearsBaseline(army, G);
    if (base.months <= 0) return { ok: true, skipped: true, reason: 'no-arrears', baseline: base };
    if (!options.force && army._payArrearsAppliedTurn === turn && army._payArrearsAppliedMonths === base.months) {
      return { ok: true, skipped: true, reason: 'already-applied', baseline: base };
    }
    var validated = validatePayArrearsAdjustment(army, options.adjustment || null, G);
    if (!validated.ok) return validated;
    var system = getMilitarySystemForArmy(army, G);
    var attribution = _normalizeAttribution(army.loyaltyAttribution || system.loyaltyAttribution);
    army.morale = _clamp100((army.morale === undefined ? 70 : army.morale) + validated.adjusted.moraleDelta);
    army.loyalty = _clamp100((army.loyalty === undefined ? 50 : army.loyalty) + validated.adjusted.loyaltyDelta);
    army.loyaltyAttribution = attribution;
    army._payArrearsAppliedTurn = turn;
    army._payArrearsAppliedMonths = base.months;
    if (army.morale < base.routeMoraleBelow) _markRouted(army, attribution, turn);
    if (!G._militaryPayArrearsLog) G._militaryPayArrearsLog = [];
    G._militaryPayArrearsLog.push({
      turn: turn,
      army: army.name || army.id || '',
      months: base.months,
      moraleDelta: validated.adjusted.moraleDelta,
      loyaltyDelta: validated.adjusted.loyaltyDelta,
      loyaltyAttribution: attribution,
      routed: !!army.routed,
      source: options.source || 'military-systems'
    });
    return { ok: true, army: army, baseline: base, adjusted: validated.adjusted, routed: !!army.routed, loyaltyAttribution: attribution };
  }

  function _armyRefs(G) {
    return Array.isArray(G.armies) ? G.armies : [];
  }

  function _findArmy(ref, G) {
    if (!ref) return null;
    var key = String(ref);
    var matches = _armyRefs(G).filter(function(a) {
      return a && (String(a.id || '') === key || String(a.name || '') === key || String(a.armyId || '') === key);
    });
    if (matches.length) return matches[0];
    matches = _armyRefs(G).filter(function(a) { return a && String(a.faction || a.owner || '') === key; });
    return matches.length === 1 ? matches[0] : null;
  }

  function _applyCasualty(army, loss) {
    if (!army || !isFinite(Number(loss))) return false;
    loss = Math.max(0, Math.round(Number(loss)));
    var field = army.soldiers !== undefined ? 'soldiers' : (army.troops !== undefined ? 'troops' : (army.strength !== undefined ? 'strength' : 'soldiers'));
    army[field] = Math.max(0, Math.round(Number(army[field] || 0) - loss));
    return true;
  }

  function _findChar(name, G) {
    if (!name || !Array.isArray(G.chars)) return null;
    return G.chars.find(function(c) { return c && c.name === name; }) || null;
  }

  function applyBattleResult(battleResult, root) {
    var G = _root(root);
    var br = battleResult || {};
    if (!br || typeof br !== 'object') return { ok: false, reason: 'missing-battleResult' };
    var winner = br.winnerFactionId || br.winnerFaction || br.winner || '';
    var loser = br.loserFactionId || br.loserFaction || br.loser || '';
    if (!winner || !loser) return { ok: false, reason: 'missing-winner-loser' };
    function _armyNameOf(army) {
      return army ? String(army.name || army.id || army.armyId || '') : '';
    }
    function _armyFieldOf(army) {
      if (!army || typeof army !== 'object') return 'soldiers';
      if (army.soldiers !== undefined) return 'soldiers';
      if (army.troops !== undefined) return 'troops';
      if (army.strength !== undefined) return 'strength';
      return 'soldiers';
    }
    function _toNum(value, fallback) {
      var n = Number(value);
      return isFinite(n) ? n : (fallback || 0);
    }
    function _partyNameOf(army, commanderName) {
      var party = '';
      if (commanderName && Array.isArray(G.chars)) {
        var ch = _findChar(commanderName, G);
        if (ch && ch.party) party = String(ch.party || '').trim();
      }
      if (!party && army && army.party) party = String(army.party || '').trim();
      if (!party && army && army.partyName) party = String(army.partyName || '').trim();
      if (!party && army && army.partyRef && army.partyRef.id) party = String(army.partyRef.id || '').trim();
      return party;
    }
    function _buildArmySnapshot(army, side, loss, moraleDelta, loyaltyDelta, cohesionDelta, state, commanderName, commanderFate) {
      return {
        side: side || '',
        armyId: army && (army.id || army.armyId || army.name || ''),
        name: _armyNameOf(army),
        owner: army && (army.owner || army.faction || ''),
        faction: army && (army.faction || army.owner || ''),
        commander: commanderName || '',
        party: _partyNameOf(army, commanderName),
        loss: loss || 0,
        moraleDelta: moraleDelta || 0,
        loyaltyDelta: loyaltyDelta || 0,
        cohesionDelta: cohesionDelta || 0,
        stateBefore: army && army._battleResultStateBefore ? army._battleResultStateBefore : (army && army.state) || '',
        stateAfter: state || (army && army.state) || '',
        routed: !!(army && army.routed),
        disbanded: !!(army && army.disbanded),
        commanderFate: commanderFate && commanderFate.name ? {
          name: commanderFate.name,
          outcome: String(commanderFate.outcome || 'survived')
        } : null
      };
    }
    function _syncCommanderBattleMemory(ch, army, summary) {
      if (!ch || !summary) return;
      var event = '战后' + (summary.side === 'attacker' ? '攻方' : summary.side === 'defender' ? '守方' : '军队') +
        '·' + (_armyNameOf(army) || ch.name || '') +
        '·伤亡' + (summary.loss || 0) +
        '·士气' + (summary.moraleDelta || 0) +
        '·忠诚' + (summary.loyaltyDelta || 0);
      var mem = {
        turn: G.turn || 0,
        event: event,
        emotion: summary.loss > 0 ? '紧' : '平',
        importance: Math.max(3, Math.min(10, Math.round((summary.loss || 0) / 80) + Math.abs(summary.moraleDelta || 0) + 3)),
        who: ch.name || '',
        type: 'military',
        source: 'battleResult',
        participants: [winner, loser, _armyNameOf(army)].filter(Boolean),
        location: army && (army.garrison || army.location || ''),
        subject: ch.name || '',
        summary: event
      };
      try {
        if (global.CharFullSchema && typeof global.CharFullSchema.syncInteractionMemory === 'function') {
          global.CharFullSchema.syncInteractionMemory(ch, mem, ch.name || '');
        } else {
          ch.lastInteractionMemory = mem;
          if (!ch.recognitionState || typeof ch.recognitionState !== 'object') {
            ch.recognitionState = {
              subject: ch.name || '',
              familiarity: 0,
              level: '陌生',
              lastTurn: 0,
              lastEvent: '',
              lastEmotion: '平',
              lastType: 'general',
              lastSource: '',
              lastWho: '',
              summary: '',
              history: []
            };
          }
          ch.recognitionState.lastTurn = mem.turn;
          ch.recognitionState.lastEvent = mem.event;
          ch.recognitionState.lastEmotion = mem.emotion;
          ch.recognitionState.lastType = mem.type;
          ch.recognitionState.lastSource = mem.source;
          ch.recognitionState.lastWho = mem.who;
          ch.recognitionState.summary = mem.summary;
          ch.recognitionState.familiarity = Math.min(100, Math.max(0, (Number(ch.recognitionState.familiarity) || 0) + Math.max(4, Math.round((summary.loss || 0) / 100) + 4)));
          ch.recognitionState.level = ch.recognitionState.familiarity >= 85 ? '知己' : (ch.recognitionState.familiarity >= 65 ? '熟识' : (ch.recognitionState.familiarity >= 35 ? '眼熟' : (ch.recognitionState.familiarity >= 10 ? '略识' : '陌生')));
          if (!Array.isArray(ch.recognitionState.history)) ch.recognitionState.history = [];
          ch.recognitionState.history.push({
            turn: mem.turn,
            subject: ch.name || '',
            level: ch.recognitionState.level,
            event: mem.summary,
            emotion: mem.emotion
          });
          if (ch.recognitionState.history.length > 8) ch.recognitionState.history = ch.recognitionState.history.slice(-8);
        }
      } catch(_) {}
    }
    var attackerArmy = _findArmy(br.attackerArmyId || br.attackerArmy || br.attacker, G);
    var defenderArmy = _findArmy(br.defenderArmyId || br.defenderArmy || br.defender, G);
    var lossBySide = {
      attacker: Math.max(0, Math.round(_toNum((br.casualties || {}).attacker, 0))),
      defender: Math.max(0, Math.round(_toNum((br.casualties || {}).defender, 0)))
    };
    var appliedLossBySide = { attacker: 0, defender: 0 };
    var sawSideEntry = { attacker: false, defender: false };
    var handledCommanders = {};
    var partyEffects = {};
    function _partyBucket(name) {
      if (!name) return null;
      if (!partyEffects[name]) {
        partyEffects[name] = {
          party: name,
          armies: [],
          winCount: 0,
          loseCount: 0,
          lossTotal: 0,
          moraleDelta: 0,
          loyaltyDelta: 0,
          cohesionDelta: 0,
          commanderFates: 0
        };
      }
      return partyEffects[name];
    }
    function _applyArmyEntry(entry, fallbackArmy, fallbackSide) {
      if (!entry && !fallbackArmy) return null;
      entry = entry || {};
      var armyRef = entry.armyId || entry.id || entry.army || entry.name || entry.ref || entry.armyRef || entry.target || '';
      var army = armyRef ? _findArmy(armyRef, G) : null;
      if (!army) army = fallbackArmy || null;
      if (!army) return null;
      var side = String(entry.side || fallbackSide || '').toLowerCase();
      if (side !== 'attacker' && side !== 'defender') side = fallbackSide || '';
      if (side === 'attacker' || side === 'defender') sawSideEntry[side] = true;
      var loss = entry.loss;
      if (!isFinite(Number(loss))) loss = entry.soldiersLost;
      if (!isFinite(Number(loss)) && entry.casualties && typeof entry.casualties === 'object') {
        if (side === 'attacker') loss = entry.casualties.attacker;
        else if (side === 'defender') loss = entry.casualties.defender;
      }
      if (!isFinite(Number(loss))) {
        loss = side === 'attacker' ? lossBySide.attacker : (side === 'defender' ? lossBySide.defender : 0);
        if (side === 'attacker') lossBySide.attacker = 0;
        else if (side === 'defender') lossBySide.defender = 0;
      } else if (side === 'attacker' || side === 'defender') {
        lossBySide[side] = 0;
      }
      loss = Math.max(0, Math.round(_toNum(loss, 0)));
      if (side === 'attacker') appliedLossBySide.attacker += loss;
      else if (side === 'defender') appliedLossBySide.defender += loss;
      var field = _armyFieldOf(army);
      var beforeState = army.state || '';
      army._battleResultStateBefore = beforeState;
      if (loss > 0) _applyCasualty(army, loss);
      var moraleDelta = isFinite(Number(entry.moraleDelta)) ? Number(entry.moraleDelta) : (loss > 0 ? -Math.max(1, Math.round(loss / 80)) : 0);
      var loyaltyDelta = isFinite(Number(entry.loyaltyDelta)) ? Number(entry.loyaltyDelta) : (loss > 0 ? -Math.max(1, Math.round(loss / 120)) : 0);
      var cohesionDelta = isFinite(Number(entry.cohesionDelta)) ? Number(entry.cohesionDelta) : ((loss > 0 && side === 'defender') ? -Math.max(1, Math.round(loss / 140)) : 0);
      if (moraleDelta) army.morale = _clamp100((army.morale === undefined ? 50 : army.morale) + moraleDelta);
      if (loyaltyDelta) army.loyalty = _clamp100((army.loyalty === undefined ? 50 : army.loyalty) + loyaltyDelta);
      if (cohesionDelta) army.cohesion = _clamp100((army.cohesion === undefined ? 70 : army.cohesion) + cohesionDelta);
      if (isFinite(Number(entry.mutinyRiskDelta))) army.mutinyRisk = Math.max(0, Math.min(100, Math.round((Number(army.mutinyRisk) || 0) + Number(entry.mutinyRiskDelta))));
      if (isFinite(Number(entry.supplyDelta))) army.supply = _clamp100((army.supply === undefined ? 70 : army.supply) + Number(entry.supplyDelta));
      var explicitState = String(entry.state || '').trim();
      if (explicitState === 'routed' || explicitState === 'disbanded' || explicitState === 'garrison' || explicitState === 'marching' || explicitState === 'sieging') {
        army.state = explicitState;
      }
      else if (army[field] !== undefined && Number(army[field]) <= 0) army.state = 'disbanded';
      else if (typeof army.morale === 'number' && army.morale < 25 && loss > 0) army.state = 'routed';
      else if (typeof army.loyalty === 'number' && army.loyalty < 20 && loss > 0) army.state = 'routed';
      if (army.state === 'routed') army.routed = true;
      if (army.state === 'disbanded') army.disbanded = true;
      army._battleResultTurn = G.turn || 0;
      army._battleResultBattleId = result.battleId;
      var commanderName = String(entry.commander || army.commander || '').trim();
      var commander = commanderName ? _findChar(commanderName, G) : null;
      var commanderFate = entry.commanderFate || null;
      if (!commanderFate && br.commanderFate && String(br.commanderFate.name || '') === commanderName) commanderFate = br.commanderFate;
      if (commander && commanderFate && commanderFate.name) {
        var outcome = String(commanderFate.outcome || 'survived');
        commander._battleFate = outcome;
        commander._battleFateTurn = G.turn || 0;
        if (outcome === 'killed' || outcome === 'dead') commander.alive = false;
        else if (outcome === 'captured') commander.capturedBy = winner;
        else if (outcome === 'fled') commander._fledTurn = G.turn || 0;
        else if (outcome === 'surrendered') commander.surrenderedTo = winner;
        else if (outcome === 'injured') commander._battleInjured = true;
        army.commanderFate = outcome;
        if (outcome === 'killed' || outcome === 'dead' || outcome === 'captured' || outcome === 'surrendered' || outcome === 'fled') {
          army._commanderLost = true;
          if (outcome === 'killed' || outcome === 'dead') army.commanderAlive = false;
          if (outcome === 'captured') army.commanderCaptured = true;
          if (outcome === 'fled') army.commanderFled = true;
        }
      }
      var summary = _buildArmySnapshot(army, side, loss, moraleDelta, loyaltyDelta, cohesionDelta, army.state || beforeState, commanderName, commanderFate);
      result.affectedArmies.push(summary);
      result.applied.affectedArmies.push(summary);
      if (loss > 0) result.applied.casualties.push({ side: side || 'unknown', army: summary.name || summary.armyId || '', loss: loss });
      if (commander && (loss > 0 || commanderFate)) {
        _syncCommanderBattleMemory(commander, army, summary);
        handledCommanders[commanderName] = true;
      }
      var partyName = summary.party;
      if (partyName) {
        var bucket = _partyBucket(partyName);
        if (bucket) {
          bucket.armies.push(summary);
          bucket.lossTotal += loss;
          bucket.moraleDelta += moraleDelta;
          bucket.loyaltyDelta += loyaltyDelta;
          bucket.cohesionDelta += cohesionDelta;
          if (summary.routed || summary.disbanded) bucket.commanderFates += 1;
          var armyFaction = summary.faction || summary.owner || '';
          if (armyFaction && armyFaction === winner) bucket.winCount += 1;
          else if (armyFaction && armyFaction === loser) bucket.loseCount += 1;
          else if (summary.loss > 0) bucket.loseCount += 1;
        }
      }
      if (commanderFate && commanderFate.name && !result.applied.commanderFate) {
        result.applied.commanderFate = { name: commanderFate.name, outcome: String(commanderFate.outcome || 'survived'), ok: !!commander };
      }
      return summary;
    }
    var result = {
      battleId: br.battleId || br.id || (typeof uid === 'function' ? uid() : ('battle_' + Date.now())),
      turn: G.turn || 0,
      structured: true,
      verdict: 'structured',
      winner: winner,
      loser: loser,
      attackerLoss: 0,
      defenderLoss: 0,
      affectedArmies: [],
      partyStateEffects: [],
      applied: { occupiedCityIds: [], casualties: [], affectedArmies: [], commanderFate: null, postBattleEffects: [], partyState: [] }
    };
    var cityIds = Array.isArray(br.occupiedCityIds) ? br.occupiedCityIds : [];
    cityIds.forEach(function(cityId) {
      var id = String(cityId);
      var changed = false;
      try {
        var setter = global.setProvinceOwner || (global.TM && global.TM.ThreeSystems && global.TM.ThreeSystems.setProvinceOwner);
        if (typeof setter === 'function') { setter(id, winner, 'battleResult'); changed = true; }
      } catch(_) {}
      if (Array.isArray(G.cities)) {
        G.cities.forEach(function(c) {
          if (!c) return;
          if (String(c.id || c.cityId || c.name || c.provinceId || '') === id) {
            c.owner = winner;
            c.ownerFaction = winner;
            c.faction = winner;
            changed = true;
          }
        });
      }
      if (G.provinceStats && G.provinceStats[id]) {
        G.provinceStats[id].owner = winner;
        changed = true;
      }
      result.applied.occupiedCityIds.push({ id: id, ok: changed });
    });
    var affectedArmies = Array.isArray(br.affectedArmies) ? br.affectedArmies : [];
    var attackerLoss = lossBySide.attacker;
    var defenderLoss = lossBySide.defender;
    if (affectedArmies.length) {
      affectedArmies.forEach(function(entry) {
        if (!entry || typeof entry !== 'object') return;
        _applyArmyEntry(entry, null, String(entry.side || '').toLowerCase());
      });
    } else {
      if (attackerArmy) _applyArmyEntry({ side: 'attacker', loss: attackerLoss }, attackerArmy, 'attacker');
      if (defenderArmy) _applyArmyEntry({ side: 'defender', loss: defenderLoss }, defenderArmy, 'defender');
      result.attackerLoss = attackerLoss;
      result.defenderLoss = defenderLoss;
    }
    result.attackerLoss = sawSideEntry.attacker ? appliedLossBySide.attacker : attackerLoss;
    result.defenderLoss = sawSideEntry.defender ? appliedLossBySide.defender : defenderLoss;
    var fate = br.commanderFate || null;
    if (fate && fate.name) {
      var ch = _findChar(fate.name, G);
      var outcome = String(fate.outcome || 'survived');
      if (ch && !handledCommanders[fate.name]) {
        ch._battleFate = outcome;
        ch._battleFateTurn = G.turn || 0;
        if (outcome === 'killed' || outcome === 'dead') ch.alive = false;
        else if (outcome === 'captured') ch.capturedBy = winner;
        else if (outcome === 'fled') ch._fledTurn = G.turn || 0;
        else if (outcome === 'surrendered') ch.surrenderedTo = winner;
        var fateArmy = null;
        if (attackerArmy && String(attackerArmy.commander || '') === fate.name) fateArmy = attackerArmy;
        else if (defenderArmy && String(defenderArmy.commander || '') === fate.name) fateArmy = defenderArmy;
        else fateArmy = attackerArmy || defenderArmy || null;
        _syncCommanderBattleMemory(ch, fateArmy, {
          side: fateArmy === attackerArmy ? 'attacker' : (fateArmy === defenderArmy ? 'defender' : ''),
          loss: Math.max(attackerLoss, defenderLoss),
          moraleDelta: 0,
          loyaltyDelta: 0,
          commanderFate: fate,
          state: outcome,
          party: ch.party || ''
        });
      }
      result.applied.commanderFate = { name: fate.name, outcome: outcome, ok: !!ch };
    }
    Object.keys(partyEffects).forEach(function(partyName) {
      var ps = G.partyState && G.partyState[partyName];
      var eff = partyEffects[partyName];
      if (!ps) return;
      if (!Array.isArray(ps.historyLog)) ps.historyLog = [];
      var influenceDelta = 0;
      var cohesionDelta = 0;
      if (eff.winCount > 0) {
        influenceDelta += Math.max(1, eff.winCount);
        cohesionDelta += Math.max(1, Math.round(eff.winCount / 2));
      }
      if (eff.loseCount > 0 || (eff.winCount === 0 && eff.lossTotal > 0)) {
        influenceDelta -= Math.max(1, eff.loseCount * 2 + Math.round(eff.lossTotal / 250));
        cohesionDelta -= Math.max(1, eff.loseCount + Math.round(eff.lossTotal / 200) + eff.commanderFates);
      } else if (eff.winCount > 0 && eff.lossTotal > 0) {
        cohesionDelta -= Math.max(0, Math.round(eff.lossTotal / 400));
      }
      if (eff.moraleDelta) influenceDelta += Math.round(eff.moraleDelta / 10);
      if (eff.loyaltyDelta) cohesionDelta += Math.round(eff.loyaltyDelta / 10);
      ps.influence = Math.max(0, Math.min(100, (Number(ps.influence) || 0) + influenceDelta));
      ps.cohesion = Math.max(0, Math.min(100, (Number(ps.cohesion) || 0) + cohesionDelta));
      ps.lastShift = { turn: G.turn || 0, influenceDelta: influenceDelta, reason: 'battleResult:' + result.battleId };
      var logItem = {
        turn: G.turn || 0,
        type: 'battleResult',
        battleId: result.battleId,
        party: partyName,
        lossTotal: eff.lossTotal,
        winCount: eff.winCount,
        loseCount: eff.loseCount,
        influenceDelta: influenceDelta,
        cohesionDelta: cohesionDelta,
        armies: eff.armies.map(function(a) { return a.name || a.armyId || ''; }).filter(Boolean)
      };
      ps.historyLog.push(logItem);
      if (ps.historyLog.length > 20) ps.historyLog = ps.historyLog.slice(-20);
      result.partyStateEffects.push(logItem);
      result.applied.partyState.push(logItem);
    });
    var effects = Array.isArray(br.postBattleEffects) ? br.postBattleEffects : [];
    if (effects.length) {
      if (!G._postBattleEffects) G._postBattleEffects = [];
      effects.forEach(function(eff) {
        var item = Object.assign({ turn: G.turn || 0, battleId: result.battleId }, eff || {});
        G._postBattleEffects.push(item);
        result.applied.postBattleEffects.push(item);
        if (item.target && G.partyState && G.partyState[item.target]) {
          if (!G.partyState[item.target].historyLog) G.partyState[item.target].historyLog = [];
          G.partyState[item.target].historyLog.push(item);
        }
      });
    }
    result.report = 'structured battleResult: ' + winner + ' > ' + loser;
    if (!G.battleHistory) G.battleHistory = [];
    G.battleHistory.push(result);
    if (G.battleHistory.length > 100) G.battleHistory = G.battleHistory.slice(-100);
    return { ok: true, result: result, applied: result.applied };
  }

  var api = {
    getMilitarySystems: getMilitarySystems,
    getMilitarySystemForArmy: getMilitarySystemForArmy,
    payArrearsBaseline: payArrearsBaseline,
    validatePayArrearsAdjustment: validatePayArrearsAdjustment,
    applyPayArrearsPressure: applyPayArrearsPressure,
    applyBattleResult: applyBattleResult,
    _readConstant: _readConstant
  };

  if (!global.TM) global.TM = {};
  global.TM.MilitarySystems = api;
  global.MilitarySystems = api;
  return api;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : globalThis));

var BattleEngine = (function() {
  'use strict';

  /**
   * 获取战斗配置（编辑器可调）
   */
  function _getConfig() {
    var cfg = (P && P.battleConfig) || {};
    return {
      enabled: cfg.enabled !== false,
      thresholds: cfg.thresholds || { decisive: 1.5, victory: 1.0, stalemate: 0.7 },
      varianceRange: typeof cfg.varianceRange === 'number' ? cfg.varianceRange : 0.15,
      seasonMod: cfg.seasonMod || { '春': 1.0, '夏': 0.95, '秋': 1.0, '冬': 0.85 },
      fortLevelBonus: cfg.fortLevelBonus || [1.0, 1.3, 1.6, 2.0, 2.5, 3.0],
      terrainModifiers: cfg.terrainModifiers || null
    };
  }

  /**
   * 获取当前季节名
   */
  function _getSeason() {
    if (!P.time) return '春';
    var perTurn = P.time.perTurn || '1m';
    var startMonth = P.time.startMonth || 1;
    var turnMonths = 0;
    if (perTurn === '1d') turnMonths = (GM.turn - 1) / 30;
    else if (perTurn === '1m') turnMonths = GM.turn - 1;
    else if (perTurn === '1s') turnMonths = (GM.turn - 1) * 3;
    else if (perTurn === '1y') turnMonths = (GM.turn - 1) * 12;
    else if (perTurn === 'custom' && P.time.customDays) turnMonths = (GM.turn - 1) * P.time.customDays / 30;
    var curMonth = ((startMonth - 1 + turnMonths) % 12) + 1;
    if (curMonth <= 3) return '春';
    if (curMonth <= 6) return '夏';
    if (curMonth <= 9) return '秋';
    return '冬';
  }

  /**
   * 获取地形修正系数
   * @param {string} terrain - 地形类型
   * @returns {{attackMod:number, defenseMod:number}}
   */
  function _getTerrainMod(terrain) {
    var cfg = _getConfig();
    // 优先使用编辑器配置的地形修正
    if (cfg.terrainModifiers && cfg.terrainModifiers[terrain]) {
      var t = cfg.terrainModifiers[terrain];
      return { attackMod: t.attackMod || 1.0, defenseMod: t.defenseMod || 1.0 };
    }
    // 默认地形修正（硬编码兜底）
    var defaults = {
      plains: { attackMod: 1.0, defenseMod: 1.0 },
      hills: { attackMod: 0.85, defenseMod: 1.15 },
      mountain: { attackMod: 0.7, defenseMod: 1.3 },
      river: { attackMod: 0.8, defenseMod: 1.0 },
      swamp: { attackMod: 0.6, defenseMod: 0.8 },
      desert: { attackMod: 0.9, defenseMod: 0.9 },
      forest: { attackMod: 0.75, defenseMod: 1.2 }
    };
    return defaults[terrain] || { attackMod: 1.0, defenseMod: 1.0 };
  }

  /**
   * 确定性战斗结算
   * @param {Object} attackerArmy - 攻方军队 {name, soldiers, morale, training, quality, commander, faction}
   * @param {Object} defenderArmy - 守方军队
   * @param {Object} context - 战场上下文 {terrain, weather, fortLevel, season, battleId}
   * @returns {Object} 结算结果 {winner, loser, attackerLoss, defenderLoss, ratio, verdict, report}
   */
  function resolve(attackerArmy, defenderArmy, context) {
    context = context || {};
    if (context.battleResult || context.structuredVerdict) {
      var structured = MilitarySystems.applyBattleResult(context.battleResult || context.structuredVerdict, context.root || (typeof GM !== 'undefined' ? GM : null));
      if (structured && structured.ok) return structured.result;
    }
    var cfg = _getConfig();
    if (!cfg.enabled) return null; // 未启用战斗引擎，回退AI自由裁量

    var terrain = context.terrain || 'plains';
    var fortLevel = context.fortLevel || 0;
    var season = context.season || _getSeason();

    // 1. 调用已有函数计算双方战力
    var attackStrength = calculateArmyStrength(attackerArmy);
    var defendStrength = calculateArmyStrength(defenderArmy);

    // 2. 应用地形修正
    var tMod = _getTerrainMod(terrain);
    attackStrength *= tMod.attackMod;
    defendStrength *= tMod.defenseMod;

    // 3. 应用城防加成（围城战守方加成）
    if (fortLevel > 0 && fortLevel < cfg.fortLevelBonus.length) {
      defendStrength *= cfg.fortLevelBonus[fortLevel];
    } else if (fortLevel >= cfg.fortLevelBonus.length) {
      defendStrength *= cfg.fortLevelBonus[cfg.fortLevelBonus.length - 1];
    }

    // 4. 应用季节修正
    var sMod = cfg.seasonMod[season] || 1.0;
    attackStrength *= sMod;
    defendStrength *= sMod;

    // 5. 计算比值 + 确定性随机偏差
    var rawRatio = attackStrength / Math.max(defendStrength, 1);
    var battleSeed = (_rngState.seed || 'battle') + '_T' + GM.turn + '_' + (context.battleId || attackerArmy.name);
    var subRng = createSubRng(battleSeed);
    var variance = (subRng() - 0.5) * 2 * cfg.varianceRange; // ±varianceRange
    var ratio = rawRatio * (1 + variance);

    // 6. 按阈值判定结果
    var th = cfg.thresholds;
    var verdict, attackerLossRate, defenderLossRate;

    if (ratio >= th.decisive) {
      verdict = '大胜';
      attackerLossRate = 0.10 + subRng() * 0.10; // 10-20%
      defenderLossRate = 0.30 + subRng() * 0.20; // 30-50%
    } else if (ratio >= th.victory) {
      verdict = '小胜';
      attackerLossRate = 0.15 + subRng() * 0.10; // 15-25%
      defenderLossRate = 0.20 + subRng() * 0.10; // 20-30%
    } else if (ratio >= th.stalemate) {
      verdict = '僵持';
      attackerLossRate = 0.10 + subRng() * 0.10; // 10-20%
      defenderLossRate = 0.10 + subRng() * 0.10; // 10-20%
    } else {
      verdict = '败北';
      attackerLossRate = 0.25 + subRng() * 0.15; // 25-40%
      defenderLossRate = 0.10 + subRng() * 0.05; // 10-15%
    }

    // 7. 按timeRatio缩放伤亡（日制下一回合战斗消耗远小于年制）
    // 但战斗本身是一次性事件——不按时间缩放，而是按"战斗强度"缩放
    // 如果回合=1天，一天的战斗损失应该比一年的小
    // 使用sqrt(timeRatio×12)作为强度因子：月制=1.0，日制≈0.18，年制≈3.46
    var intensityFactor = Math.min(1.0, Math.sqrt((typeof getTimeRatio === 'function' ? getTimeRatio() : 1 / 12) * 12));

    var attackerSoldiers = attackerArmy.soldiers || attackerArmy.strength || 0;
    var defenderSoldiers = defenderArmy.soldiers || defenderArmy.strength || 0;
    var attackerLoss = Math.floor(attackerSoldiers * attackerLossRate * intensityFactor);
    var defenderLoss = Math.floor(defenderSoldiers * defenderLossRate * intensityFactor);

    // 8. 确定胜负方名称
    var winner, loser;
    if (verdict === '大胜' || verdict === '小胜') {
      winner = attackerArmy.name || attackerArmy.faction || '攻方';
      loser = defenderArmy.name || defenderArmy.faction || '守方';
    } else if (verdict === '败北') {
      winner = defenderArmy.name || defenderArmy.faction || '守方';
      loser = attackerArmy.name || attackerArmy.faction || '攻方';
    } else {
      winner = '僵持';
      loser = '僵持';
    }

    // 9. 同时调用已有分析获取战术推荐（供AI叙事参考，非约束）
    var analysis = analyzeBattleStrategy(attackerArmy, defenderArmy, context);
    var tacticHint = '';
    if (analysis && analysis.attacker.recommendedTactics.length > 0) {
      tacticHint = '攻方推荐战术: ' + analysis.attacker.recommendedTactics[0].name;
    }
    if (analysis && analysis.defender.recommendedTactics.length > 0) {
      tacticHint += ' | 守方推荐战术: ' + analysis.defender.recommendedTactics[0].name;
    }

    var result = {
      battleId: context.battleId || uid(),
      turn: GM.turn,
      attacker: attackerArmy.name || attackerArmy.faction,
      defender: defenderArmy.name || defenderArmy.faction,
      attackerFaction: attackerArmy.faction,
      defenderFaction: defenderArmy.faction,
      attackerSoldiers: attackerSoldiers,
      defenderSoldiers: defenderSoldiers,
      terrain: terrain,
      fortLevel: fortLevel,
      season: season,
      rawRatio: Math.round(rawRatio * 100) / 100,
      adjustedRatio: Math.round(ratio * 100) / 100,
      verdict: verdict,
      winner: winner,
      loser: loser,
      attackerLoss: attackerLoss,
      defenderLoss: defenderLoss,
      tacticHint: tacticHint,
      intensityFactor: Math.round(intensityFactor * 100) / 100
    };

    // 10. 生成可读报告（注入AI prompt用）
    result.report = _formatReport(result);

    _dbg('[BattleEngine]', result.attacker, 'vs', result.defender,
         '比值' + result.adjustedRatio, '→', result.verdict,
         '损' + result.attackerLoss + '/' + result.defenderLoss);

    return result;
  }

  /**
   * 格式化战斗报告（注入AI prompt）
   */
  function _formatReport(r) {
    var s = r.attacker + '(' + r.attackerSoldiers + '人)';
    s += ' vs ' + r.defender + '(' + r.defenderSoldiers + '人)';
    s += ' 地形:' + r.terrain;
    if (r.fortLevel > 0) s += ' 城防:' + r.fortLevel + '级';
    s += ' 季节:' + r.season;
    s += ' 比值:' + r.adjustedRatio;
    s += ' → ' + r.verdict + '。';
    s += r.attacker + '损失' + r.attackerLoss + '人，';
    s += r.defender + '损失' + r.defenderLoss + '人。';
    if (r.verdict === '大胜' || r.verdict === '小胜') {
      s += r.winner + '胜。';
    } else if (r.verdict === '败北') {
      s += r.winner + '胜，' + r.loser + '败退。';
    } else {
      s += '双方僵持不下。';
    }
    if (r.tacticHint) s += ' (' + r.tacticHint + ')';
    return s;
  }

  /**
   * 批量结算本回合所有进行中的战斗
   * 从 GM.activeBattles 读取，结果写入 GM._turnBattleResults
   * 在 _endTurn_updateSystems 中调用（SettlementPipeline注册）
   */
  function resolveAllBattles() {
    if (!GM.activeBattles || !GM.activeBattles.length) return;
    if (!GM._turnBattleResults) GM._turnBattleResults = [];

    var cfg = _getConfig();
    if (!cfg.enabled) return;

    GM.activeBattles.forEach(function(battle) {
      if (battle.phase === 'resolved') return; // 已结算
      if (battle.phase === 'march') return;    // 行军中，未接战

      var structuredVerdict = battle.battleResult || battle.structuredVerdict || battle.structuredResult;
      if (structuredVerdict) {
        var structured = MilitarySystems.applyBattleResult(structuredVerdict, GM);
        if (structured && structured.ok) {
          battle.phase = 'resolved';
          battle.result = structured.result;
          GM._turnBattleResults.push(structured.result);
        }
        return;
      }

      // 查找对应军队
      var attackerArmy = (GM.armies || []).find(function(a) {
        return a.name === battle.attackerArmy || a.faction === battle.attackerFaction;
      });
      var defenderArmy = (GM.armies || []).find(function(a) {
        return a.name === battle.defenderArmy || a.faction === battle.defenderFaction;
      });

      if (!attackerArmy || !defenderArmy) return;

      // 地形：优先battle字段 → 省份数据 → 默认平原
      var _bTerrain = battle.terrain;
      if (!_bTerrain && battle.location && GM.provinceStats && GM.provinceStats[battle.location]) {
        _bTerrain = GM.provinceStats[battle.location].terrain;
      }
      var result = resolve(attackerArmy, defenderArmy, {
        terrain: _bTerrain || 'plains',
        fortLevel: battle.fortLevel || 0,
        battleId: battle.id
      });

      if (result) {
        // 应用伤亡到军队
        attackerArmy.soldiers = Math.max(0, (attackerArmy.soldiers || 0) - result.attackerLoss);
        defenderArmy.soldiers = Math.max(0, (defenderArmy.soldiers || 0) - result.defenderLoss);

        // 应用士气影响
        if (result.verdict === '败北') {
          attackerArmy.morale = Math.max(0, (attackerArmy.morale || 70) - 15);
          defenderArmy.morale = Math.min(100, (defenderArmy.morale || 70) + 10);
        } else if (result.verdict === '大胜' || result.verdict === '小胜') {
          attackerArmy.morale = Math.min(100, (attackerArmy.morale || 70) + 10);
          defenderArmy.morale = Math.max(0, (defenderArmy.morale || 70) - 15);
        }

        // 标记战斗为已结算
        battle.phase = 'resolved';
        battle.result = result;

        // 记入本回合结果
        GM._turnBattleResults.push(result);

        // 记入历史
        if (!GM.battleHistory) GM.battleHistory = [];
        GM.battleHistory.push(result);
        if (GM.battleHistory.length > 100) GM.battleHistory = GM.battleHistory.slice(-100);
      }
    });

    // 清理已结算的战斗
    GM.activeBattles = GM.activeBattles.filter(function(b) { return b.phase !== 'resolved'; });
  }

  /**
   * 生成本回合全部战斗的AI prompt注入文本
   * @returns {string} 注入AI的战况摘要
   */
  function getPromptInjection() {
    if (!GM._turnBattleResults || !GM._turnBattleResults.length) return '';
    var lines = ['【机械结算·战况（胜负和数字不可更改，请据此叙事）】'];
    GM._turnBattleResults.forEach(function(r) {
      lines.push('  ' + r.report);
      lines.push('  → 请描述战役经过，可自由发挥战术细节、天气氛围、将领表现，但数字不可改。');
    });
    return lines.join('\n');
  }

  return {
    resolve: resolve,
    resolveAllBattles: resolveAllBattles,
    applyStructuredResult: MilitarySystems.applyBattleResult,
    getPromptInjection: getPromptInjection,
    _getConfig: _getConfig,
    _getTerrainMod: _getTerrainMod,
    _getSeason: _getSeason
  };
})();

// ============================================================
// 行军系统（MarchSystem）— 双模式：地图寻路 / AI地理推演
// ============================================================

var MarchSystem = (function() {
  'use strict';

  function _getConfig() {
    var mc = (P && P.battleConfig && P.battleConfig.marchConfig) || {};
    return {
      enabled: mc.enabled === true,
      baseSpeeds: mc.baseSpeeds || { infantry: 1, cavalry: 2, siege: 0.5 },
      postRoadBonus: mc.postRoadBonus || 0.5,
      winterPenalty: mc.winterPenalty || 0.7,
      largeSizeThreshold: mc.largeSizeThreshold || 50000,
      largeSizePenalty: mc.largeSizePenalty || 0.8,
      noMap: mc.noMap || {
        baseKmPerDay: { infantry: 30, cavalry: 50, siege: 15 },
        officialRoadBonus: 1.2,
        noRoadPenalty: 0.8,
        commanderAdminWeight: 0.005
      }
    };
  }

  /**
   * 创建行军命令
   * @param {Object} army - 军队对象
   * @param {string} from - 出发地
   * @param {string} to - 目的地
   * @param {Object} [aiGeoData] - AI地理推演数据(无地图模式) {routeKm, terrainDifficulty, hasOfficialRoad, estimatedDaysBase}
   * @returns {Object|null} marchOrder
   */
  function createMarchOrder(army, from, to, aiGeoData) {
    var cfg = _getConfig();
    if (!cfg.enabled) return null;

    var mapEnabled = P && P.map && P.map.enabled && GM.mapData && GM.mapData.adjacencyGraph;
    var marchDays = 0;
    var routeDesc = '';
    var path = [];

    if (mapEnabled && typeof findPath === 'function') {
      // ═══ 地图模式：A*寻路 ═══
      var pathResult = findPath(from, to, { avoidEnemy: true, faction: army.faction });
      if (pathResult) {
        path = pathResult.path || [];
        var distance = path.length;
        var baseSpeed = _getMinSpeed(army, cfg.baseSpeeds);
        var seasonMod = _getSeasonMod(cfg);
        var sizeMod = (army.soldiers || 0) > cfg.largeSizeThreshold ? cfg.largeSizePenalty : 1.0;
        var hasRoad = pathResult.hasPostRoad || false;
        var speed = baseSpeed * (hasRoad ? (1 + cfg.postRoadBonus) : 1.0) * seasonMod * sizeMod;
        marchDays = Math.ceil(distance * 30 / Math.max(speed, 0.1)); // 距离单位=领地，速度=领地/月
        routeDesc = '经' + path.join('→');
      }
    } else if (aiGeoData && aiGeoData.routeKm) {
      // ═══ 无地图模式：AI地理推演 ═══
      var noMapCfg = cfg.noMap;
      var mainType = _getMainUnitType(army);
      var baseKmDay = (noMapCfg.baseKmPerDay && noMapCfg.baseKmPerDay[mainType]) || 30;
      var terrainMod = aiGeoData.terrainDifficulty || 0.8;
      var roadMod = aiGeoData.hasOfficialRoad ? (noMapCfg.officialRoadBonus || 1.2) : (noMapCfg.noRoadPenalty || 0.8);
      var commanderMod = 1.0;
      if (army.commander) {
        var cmd = typeof findCharByName === 'function' ? findCharByName(army.commander) : null;
        if (cmd) commanderMod = 1 + (cmd.administration || 50) * (noMapCfg.commanderAdminWeight || 0.005);
      }
      var supplyMod = (army.supplyRatio !== undefined && army.supplyRatio < 0.5) ? 0.7 : 1.0;
      var seasonMod2 = _getSeasonMod(cfg);
      var sizeMod2 = (army.soldiers || 0) > cfg.largeSizeThreshold ? cfg.largeSizePenalty : 1.0;
      var actualKmDay = baseKmDay * terrainMod * roadMod * commanderMod * supplyMod * seasonMod2 * sizeMod2;
      marchDays = Math.ceil(aiGeoData.routeKm / Math.max(actualKmDay, 1));
      routeDesc = aiGeoData.routeDescription || (from + '→' + to);
      path = aiGeoData.passesAndBarriers || [];
    } else {
      // ═══ 兜底：无地图+无AI推演，使用估算 ═══
      marchDays = 15; // 默认半个月
      routeDesc = from + '→' + to + '(估算)';
    }

    // 转换天数为回合数
    var turnDays = (typeof getTurnDays === 'function') ? getTurnDays() : 30;
    var marchTurns = Math.max(1, Math.ceil(marchDays / turnDays));

    var order = {
      id: uid(),
      armyId: army.id || army.name,
      armyName: army.name,
      from: from,
      to: to,
      path: path,
      routeDescription: routeDesc,
      totalDays: marchDays,
      totalTurns: marchTurns,
      progress: 0,
      startTurn: GM.turn,
      eta: GM.turn + marchTurns,
      status: 'marching',
      terrain: aiGeoData ? (aiGeoData.terrainDifficulty > 0.8 ? 'mountain' : aiGeoData.terrainDifficulty > 0.6 ? 'hills' : 'plains') : 'plains',
      passesAndBarriers: aiGeoData ? (aiGeoData.passesAndBarriers || []) : []
    };

    if (!GM.marchOrders) GM.marchOrders = [];
    GM.marchOrders.push(order);

    addEB('行军', army.name + '从' + from + '出发前往' + to + '，预计' + marchDays + '天(' + marchTurns + '回合)到达。' + routeDesc);
    _dbg('[March]', army.name, from, '→', to, marchDays + '天/' + marchTurns + '回合');

    return order;
  }

  /**
   * 每回合推进行军进度
   */
  function advanceAll() {
    if (!GM.marchOrders || !GM.marchOrders.length) return;
    GM.marchOrders.forEach(function(order) {
      if (order.status !== 'marching') return;
      order.progress++;
      if (order.progress >= order.totalTurns) {
        order.status = 'arrived';
        // 无地图模式：根据行军距离设置补给效率衰减
        var _army2 = (GM.armies||[]).find(function(a){return a.id===order.armyId||a.name===order.armyName;});
        if (_army2 && order.totalDays) {
          _army2.supplyRatio = Math.max(0.3, 1.0 - (order.totalDays / 1000) * 0.3);
        }
        addEB('行军', (order.armyName || '某军') + '已抵达' + order.to + '。');
        _dbg('[March] 到达:', order.armyName, order.to);
      }
    });
    // 清理已到达的
    GM.marchOrders = GM.marchOrders.filter(function(o) { return o.status === 'marching'; });
  }

  /**
   * 生成AI prompt注入
   */
  function getPromptInjection() {
    if (!GM.marchOrders || !GM.marchOrders.length) return '';
    var lines = ['【行军状况】'];
    GM.marchOrders.forEach(function(o) {
      if (o.status !== 'marching') return;
      var remaining = o.totalTurns - o.progress;
      lines.push('  ' + (o.armyName||'某军') + ': ' + o.from + '→' + o.to +
        ' 进度' + o.progress + '/' + o.totalTurns + '回合 剩余' + remaining + '回合' +
        (o.routeDescription ? ' (' + o.routeDescription + ')' : ''));
    });
    return lines.length > 1 ? lines.join('\n') : '';
  }

  // ─── 内部辅助 ───

  function _getMinSpeed(army, baseSpeeds) {
    // 取军队中最慢兵种的速度
    if (army.composition && Array.isArray(army.composition) && army.composition.length > 0) {
      var minSpeed = Infinity;
      army.composition.forEach(function(c) {
        var spd = baseSpeeds[c.type] || baseSpeeds[c.unitTypeId] || 1;
        if (spd < minSpeed) minSpeed = spd;
      });
      return minSpeed === Infinity ? 1 : minSpeed;
    }
    return baseSpeeds.infantry || 1;
  }

  function _getMainUnitType(army) {
    if (army.composition && Array.isArray(army.composition) && army.composition.length > 0) {
      var maxCount = 0, mainType = 'infantry';
      army.composition.forEach(function(c) {
        if ((c.count || 0) > maxCount) { maxCount = c.count; mainType = c.type || c.unitTypeId || 'infantry'; }
      });
      return mainType;
    }
    return 'infantry';
  }

  function _getSeasonMod(cfg) {
    if (typeof BattleEngine !== 'undefined') {
      var season = BattleEngine._getSeason();
      var sMods = (P.battleConfig && P.battleConfig.seasonMod) || {};
      var mod = sMods[season];
      if (typeof mod === 'number') return mod;
    }
    return 1.0;
  }

  return {
    createMarchOrder: createMarchOrder,
    advanceAll: advanceAll,
    getPromptInjection: getPromptInjection,
    _getConfig: _getConfig
  };
})();

// 注册行军推进到SettlementPipeline
SettlementPipeline.register('march', '行军推进', function() {
  if (MarchSystem._getConfig().enabled) MarchSystem.advanceAll();
}, 33, 'perturn'); // priority 33: 在provinceEconomy(35)之前，行军先完成再计算地方区划

// ============================================================
// 围城系统（SiegeSystem）— 双模式
// ============================================================

var SiegeSystem = (function() {
  'use strict';

  function _getConfig() {
    var sc = (P && P.battleConfig && P.battleConfig.siegeConfig) || {};
    return {
      enabled: sc.enabled === true,
      progressCoeff: sc.progressCoeff || 0.15,
      defenderAttritionRate: sc.defenderAttritionRate || 0.03,
      attackerAttritionRate: sc.attackerAttritionRate || 0.01,
      starvationMoraleLoss: sc.starvationMoraleLoss || 15,
      surrenderMoraleThreshold: sc.surrenderMoraleThreshold || 10
    };
  }

  /**
   * 创建围城
   * @param {Object} attackerArmy - 围城军
   * @param {string} targetCity - 目标城市名
   * @param {number} [fortLevel] - 城防等级(0-5)，无地图时由AI指定
   * @param {number} [garrison] - 守军人数，无则估算
   * @returns {Object|null} siege对象
   */
  function createSiege(attackerArmy, targetCity, fortLevel, garrison) {
    var cfg = _getConfig();
    if (!cfg.enabled) return null;

    fortLevel = fortLevel || 0;
    garrison = garrison || 3000;

    var siege = {
      id: uid(),
      attackerArmy: attackerArmy.name || attackerArmy.id,
      attackerFaction: attackerArmy.faction,
      targetCity: targetCity,
      fortLevel: fortLevel,
      garrison: garrison,
      garrisonMorale: 70,
      garrisonSupply: 100, // 0-100 百分比
      progress: 0,         // 0 → 1.0（≥1.0城陷）
      startTurn: GM.turn,
      status: 'ongoing'    // 'ongoing' | 'fallen' | 'surrendered' | 'lifted'
    };

    if (!GM.activeSieges) GM.activeSieges = [];
    GM.activeSieges.push(siege);

    addEB('围城', attackerArmy.name + '开始围困' + targetCity + '（城防' + fortLevel + '级，守军' + garrison + '）');
    return siege;
  }

  /**
   * 每回合推进所有围城
   */
  function advanceAll() {
    if (!GM.activeSieges || !GM.activeSieges.length) return;

    var cfg = _getConfig();
    var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
    var scale = tr * 12; // 月度缩放因子

    GM.activeSieges.forEach(function(siege) {
      if (siege.status !== 'ongoing') return;

      // 查找围城军
      var attacker = (GM.armies || []).find(function(a) {
        return a.name === siege.attackerArmy || a.id === siege.attackerArmy;
      });
      var attackerTroops = attacker ? (attacker.soldiers || 0) : 10000;

      // 计算围城值（如果有兵种数据则用siegeValue，否则用兵力/1000）
      var siegeValue = attackerTroops / 1000;
      if (attacker && attacker.composition && Array.isArray(attacker.composition)) {
        var totalSV = 0;
        attacker.composition.forEach(function(c) {
          var ut = (typeof getUnitTypes === 'function') ? getUnitTypes()[c.type || c.unitTypeId] : null;
          totalSV += (c.count || 0) / 1000 * ((ut && ut.siegeValue) || 3);
        });
        if (totalSV > 0) siegeValue = totalSV;
      }

      // 围城进度（按月度缩放）
      var progressDelta = siegeValue / Math.max(siege.garrison / 1000 + siege.fortLevel * 0.5, 0.1) * cfg.progressCoeff * scale;
      siege.progress += progressDelta;

      // 守军损耗
      var defAttrition = Math.floor(siege.garrison * cfg.defenderAttritionRate * (1 - siege.garrisonSupply / 100) * scale);
      siege.garrison = Math.max(0, siege.garrison - defAttrition);

      // 围城军损耗
      if (attacker) {
        var attAttrition = Math.floor(attackerTroops * cfg.attackerAttritionRate * scale);
        attacker.soldiers = Math.max(0, (attacker.soldiers || 0) - attAttrition);
      }

      // 守军补给消耗（每月-8%，按timeRatio缩放）
      siege.garrisonSupply = Math.max(0, siege.garrisonSupply - 8 * scale);

      // 断粮效果
      if (siege.garrisonSupply <= 0) {
        siege.garrisonMorale = Math.max(0, siege.garrisonMorale - cfg.starvationMoraleLoss * scale);
        siege.garrison = Math.max(0, siege.garrison - Math.floor(siege.garrison * 0.05 * scale));
      }

      // 判定结果
      if (siege.progress >= 1.0) {
        siege.status = 'fallen';
        addEB('围城', siege.targetCity + '城破！' + (siege.attackerFaction || '') + '攻陷城池。');
      } else if (siege.garrisonMorale <= cfg.surrenderMoraleThreshold) {
        siege.status = 'surrendered';
        addEB('围城', siege.targetCity + '守军士气崩溃，开城投降。');
      } else if (siege.garrison <= 0) {
        siege.status = 'fallen';
        addEB('围城', siege.targetCity + '守军全灭，城池失守。');
      }
    });

    // 清理已结束的围城
    var resolved = GM.activeSieges.filter(function(s) { return s.status !== 'ongoing'; });
    if (resolved.length > 0) {
      if (!GM._turnSiegeResults) GM._turnSiegeResults = [];
      resolved.forEach(function(s) { GM._turnSiegeResults.push(s); });
    }
    GM.activeSieges = GM.activeSieges.filter(function(s) { return s.status === 'ongoing'; });
  }

  /**
   * AI prompt注入
   */
  function getPromptInjection() {
    var lines = [];
    if (GM.activeSieges && GM.activeSieges.length > 0) {
      lines.push('【围城状况】');
      GM.activeSieges.forEach(function(s) {
        lines.push('  ' + (s.attackerFaction||'') + '围困' + s.targetCity +
          ' 进度' + (s.progress*100).toFixed(0) + '% 城防' + s.fortLevel + '级' +
          ' 守军' + s.garrison + '(士气' + s.garrisonMorale + ')' +
          (s.garrisonSupply <= 0 ? ' ⚠断粮' : ' 补给' + s.garrisonSupply + '%'));
      });
    }
    if (GM._turnSiegeResults && GM._turnSiegeResults.length > 0) {
      lines.push('【围城结果（不可更改）】');
      GM._turnSiegeResults.forEach(function(s) {
        lines.push('  ' + s.targetCity + ': ' + (s.status === 'fallen' ? '城破' : s.status === 'surrendered' ? '投降' : s.status));
      });
    }
    return lines.length > 0 ? lines.join('\n') : '';
  }

  return {
    createSiege: createSiege,
    advanceAll: advanceAll,
    getPromptInjection: getPromptInjection,
    _getConfig: _getConfig
  };
})();

// 注册围城推进到SettlementPipeline
SettlementPipeline.register('siege', '围城结算', function() {
  if (SiegeSystem._getConfig().enabled) {
    GM._turnSiegeResults = [];
    SiegeSystem.advanceAll();
  }
}, 36, 'perturn');

// ============================================================
// 军队编制（Unit）系统
// ============================================================

// Unit 系统：多兵种管理，不替换现有 army.soldiers
// 作为增强层提供更细粒度的军队组织

// 兵种类型定义（默认硬编码，可被编辑器 P.battleConfig.unitTypes 覆盖）
var _DEFAULT_UNIT_TYPES = {
  infantry: {
    name: '步兵',
    baseCost: 10, upkeep: 2,
    attack: 5, defense: 6, speed: 3, morale: 5, siegeValue: 3,
    description: '基础步兵单位，防御力强'
  },
  cavalry: {
    name: '骑兵',
    baseCost: 30, upkeep: 6,
    attack: 8, defense: 4, speed: 9, morale: 7, siegeValue: 1,
    description: '机动性强，冲击力大'
  },
  archer: {
    name: '弓箭手',
    baseCost: 15, upkeep: 3,
    attack: 7, defense: 3, speed: 4, morale: 4, siegeValue: 2,
    description: '远程攻击单位'
  },
  spearman: {
    name: '长矛兵',
    baseCost: 12, upkeep: 2,
    attack: 6, defense: 7, speed: 3, morale: 5, siegeValue: 3,
    description: '克制骑兵的步兵单位'
  },
  crossbowman: {
    name: '弩兵',
    baseCost: 20, upkeep: 4,
    attack: 8, defense: 4, speed: 3, morale: 5, siegeValue: 4,
    description: '强力远程单位，穿透力强'
  },
  heavy_cavalry: {
    name: '重骑兵',
    baseCost: 50, upkeep: 10,
    attack: 10, defense: 7, speed: 7, morale: 8, siegeValue: 1,
    description: '精锐骑兵，攻防兼备'
  },
  siege: {
    name: '攻城器械',
    baseCost: 100, upkeep: 15,
    attack: 12, defense: 2, speed: 1, morale: 3, siegeValue: 10,
    description: '攻城专用，移动缓慢'
  }
};

/**
 * 获取兵种定义（优先编辑器配置，回退硬编码默认）
 * 编辑器中用户可自定义兵种（如秦朝加"弩兵阵"，宋朝加"神臂弓手"）
 * @returns {Object} 兵种类型映射 {id: {name, attack, defense, speed, ...}}
 */
function getUnitTypes() {
  // 优先使用编辑器配置的兵种
  if (P && P.battleConfig && P.battleConfig.unitTypes && Array.isArray(P.battleConfig.unitTypes) && P.battleConfig.unitTypes.length > 0) {
    var map = {};
    P.battleConfig.unitTypes.forEach(function(ut) {
      if (ut && ut.id) map[ut.id] = ut;
    });
    return map;
  }
  return _DEFAULT_UNIT_TYPES;
}

// 兼容性别名——让所有现有 UnitTypes[x] 引用仍然工作（向后兼容）
var UnitTypes = _DEFAULT_UNIT_TYPES;

/**
 * 渲染战斗配置编辑器面板（在编辑器的军事面板中调用）
 * @param {string} containerId - 容器DOM ID
 */
function renderBattleConfigEditor(containerId) {
  var el = document.getElementById(containerId);
  if (!el) return;
  if (!scriptData.battleConfig) scriptData.battleConfig = {enabled:true,thresholds:{decisive:1.5,victory:1.0,stalemate:0.7},varianceRange:0.15,unitTypes:null,terrainModifiers:null};
  var bc = scriptData.battleConfig;

  var html = '<div class="cd"><h4>⚔ 战斗结算系统</h4>';
  html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(bc.enabled!==false?'checked':'')+' onchange="scriptData.battleConfig.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用战斗机械结算（AI叙事前先计算确定性战果）</div></div>';

  // 阈值配置
  var th = bc.thresholds || {};
  html += '<div style="margin-top:8px"><div style="font-size:12px;color:var(--txt-d);margin-bottom:4px">比值阈值（攻方战力/守方战力）</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap">';
  html += '<label style="font-size:12px">大胜≥<input type="number" step="0.1" value="'+(th.decisive||1.5)+'" style="width:50px" onchange="if(!scriptData.battleConfig.thresholds)scriptData.battleConfig.thresholds={};scriptData.battleConfig.thresholds.decisive=parseFloat(this.value)||1.5"></label>';
  html += '<label style="font-size:12px">小胜≥<input type="number" step="0.1" value="'+(th.victory||1.0)+'" style="width:50px" onchange="scriptData.battleConfig.thresholds.victory=parseFloat(this.value)||1.0"></label>';
  html += '<label style="font-size:12px">僵持≥<input type="number" step="0.1" value="'+(th.stalemate||0.7)+'" style="width:50px" onchange="scriptData.battleConfig.thresholds.stalemate=parseFloat(this.value)||0.7"></label>';
  html += '</div></div>';

  // 随机偏差
  html += '<div style="margin-top:6px"><label style="font-size:12px">随机偏差幅度 ±<input type="number" step="0.05" value="'+(bc.varianceRange||0.15)+'" style="width:50px" onchange="scriptData.battleConfig.varianceRange=parseFloat(this.value)||0.15"> (0=完全确定，0.3=高随机性)</label></div>';

  html += '</div>';

  // 兵种定义
  html += '<div class="cd" style="margin-top:10px"><h4>🗡 兵种定义</h4>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">自定义本朝代兵种。留空则使用默认7兵种（步兵/骑兵/弓箭手/长矛兵/弩兵/重骑兵/攻城器械）</div>';

  var units = bc.unitTypes || [];
  if (units.length > 0) {
    units.forEach(function(u, i) {
      html += '<div style="border:1px solid var(--bg-4);border-radius:4px;padding:6px 8px;margin-bottom:4px;display:flex;align-items:center;gap:6px;flex-wrap:wrap">';
      html += '<b style="min-width:60px">' + escHtml(u.name||u.id) + '</b>';
      html += '<span style="font-size:11px;color:var(--txt-d)">攻'+( u.attack||0)+' 防'+(u.defense||0)+' 速'+(u.speed||0)+' 攻城'+(u.siegeValue||0)+' 费'+(u.baseCost||0)+'</span>';
      html += '<button class="bd bsm" onclick="editBattleUnitType('+i+')">编辑</button>';
      html += '<button class="bd bsm" onclick="deleteBattleUnitType('+i+')">删</button>';
      html += '</div>';
    });
  } else {
    html += '<div style="font-size:12px;color:var(--txt-d);padding:4px">未自定义（使用默认兵种）</div>';
  }
  html += '<button class="bt bs bsm" onclick="addBattleUnitType()" style="margin-top:4px">+ 添加兵种</button>';
  html += '</div>';

  // 地形修正配置
  html += '<div class="cd" style="margin-top:10px"><h4>🏔 地形战斗修正</h4>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin-bottom:6px">自定义地形对攻守方的修正系数。留空则使用默认值。攻方修正<1.0表示进攻不利，守方修正>1.0表示防守有利。</div>';
  var tm = bc.terrainModifiers || {};
  var defaultTerrains = [
    {id:'plains', name:'平原', aDef:1.0, dDef:1.0},
    {id:'hills', name:'丘陵', aDef:0.85, dDef:1.15},
    {id:'mountain', name:'山地', aDef:0.7, dDef:1.3},
    {id:'river', name:'河流', aDef:0.8, dDef:1.0},
    {id:'swamp', name:'沼泽', aDef:0.6, dDef:0.8},
    {id:'desert', name:'沙漠', aDef:0.9, dDef:0.9},
    {id:'forest', name:'林地', aDef:0.75, dDef:1.2}
  ];
  html += '<table style="font-size:12px;border-collapse:collapse;width:100%"><tr style="border-bottom:1px solid var(--bg-4)"><th style="text-align:left;padding:3px">地形</th><th>攻方修正</th><th>守方修正</th></tr>';
  defaultTerrains.forEach(function(t) {
    var cur = tm[t.id] || {};
    var aVal = cur.attackMod !== undefined ? cur.attackMod : t.aDef;
    var dVal = cur.defenseMod !== undefined ? cur.defenseMod : t.dDef;
    html += '<tr><td style="padding:3px">' + t.name + '(' + t.id + ')</td>';
    html += '<td style="text-align:center"><input type="number" step="0.05" value="' + aVal + '" style="width:50px" onchange="if(!scriptData.battleConfig.terrainModifiers)scriptData.battleConfig.terrainModifiers={};if(!scriptData.battleConfig.terrainModifiers[\'' + t.id + '\'])scriptData.battleConfig.terrainModifiers[\'' + t.id + '\']={};scriptData.battleConfig.terrainModifiers[\'' + t.id + '\'].attackMod=parseFloat(this.value)||' + t.aDef + '"></td>';
    html += '<td style="text-align:center"><input type="number" step="0.05" value="' + dVal + '" style="width:50px" onchange="if(!scriptData.battleConfig.terrainModifiers)scriptData.battleConfig.terrainModifiers={};if(!scriptData.battleConfig.terrainModifiers[\'' + t.id + '\'])scriptData.battleConfig.terrainModifiers[\'' + t.id + '\']={};scriptData.battleConfig.terrainModifiers[\'' + t.id + '\'].defenseMod=parseFloat(this.value)||' + t.dDef + '"></td>';
    html += '</tr>';
  });
  html += '</table>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin-top:4px">无地图时：AI根据剧本地理知识自动判断战场地形类型</div>';
  html += '</div>';

  // 行军配置
  var mcfg = bc.marchConfig || {};
  html += '<div class="cd" style="margin-top:10px"><h4>🚩 行军系统</h4>';
  html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(mcfg.enabled?'checked':'')+' onchange="if(!scriptData.battleConfig.marchConfig)scriptData.battleConfig.marchConfig={};scriptData.battleConfig.marchConfig.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用行军距离系统（军队移动需要时间，非瞬间到达）</div></div>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin:4px 0">有地图：A*寻路计算距离。无地图：AI查询历史地理知识（地理志、距离、地形、驿道）估算行军时间。</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">';
  var bs = mcfg.baseSpeeds || {};
  html += '<label style="font-size:12px">步兵速度(领地/月)<input type="number" step="0.5" value="'+(bs.infantry||1)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig)scriptData.battleConfig.marchConfig={};if(!scriptData.battleConfig.marchConfig.baseSpeeds)scriptData.battleConfig.marchConfig.baseSpeeds={};scriptData.battleConfig.marchConfig.baseSpeeds.infantry=parseFloat(this.value)||1"></label>';
  html += '<label style="font-size:12px">骑兵速度<input type="number" step="0.5" value="'+(bs.cavalry||2)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig.baseSpeeds)scriptData.battleConfig.marchConfig.baseSpeeds={};scriptData.battleConfig.marchConfig.baseSpeeds.cavalry=parseFloat(this.value)||2"></label>';
  html += '<label style="font-size:12px">辎重速度<input type="number" step="0.1" value="'+(bs.siege||0.5)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig.baseSpeeds)scriptData.battleConfig.marchConfig.baseSpeeds={};scriptData.battleConfig.marchConfig.baseSpeeds.siege=parseFloat(this.value)||0.5"></label>';
  html += '</div>';
  var nm = mcfg.noMap || {};
  html += '<div style="margin-top:6px;font-size:12px;color:var(--txt-d)"><b>无地图模式参数（AI地理推演用）</b></div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:2px">';
  var bk = nm.baseKmPerDay || {};
  html += '<label style="font-size:12px">步兵日行(km)<input type="number" value="'+(bk.infantry||30)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig.noMap)scriptData.battleConfig.marchConfig.noMap={};if(!scriptData.battleConfig.marchConfig.noMap.baseKmPerDay)scriptData.battleConfig.marchConfig.noMap.baseKmPerDay={};scriptData.battleConfig.marchConfig.noMap.baseKmPerDay.infantry=parseInt(this.value)||30"></label>';
  html += '<label style="font-size:12px">骑兵日行(km)<input type="number" value="'+(bk.cavalry||50)+'" style="width:45px" onchange="if(!scriptData.battleConfig.marchConfig.noMap.baseKmPerDay)scriptData.battleConfig.marchConfig.noMap.baseKmPerDay={};scriptData.battleConfig.marchConfig.noMap.baseKmPerDay.cavalry=parseInt(this.value)||50"></label>';
  html += '</div></div>';

  // 围城配置
  var sgc = bc.siegeConfig || {};
  html += '<div class="cd" style="margin-top:10px"><h4>🏯 围城系统</h4>';
  html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(sgc.enabled?'checked':'')+' onchange="if(!scriptData.battleConfig.siegeConfig)scriptData.battleConfig.siegeConfig={};scriptData.battleConfig.siegeConfig.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用围城系统（攻城需要时间，守军可坚守/投降/突围）</div></div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">';
  html += '<label style="font-size:12px">进度系数<input type="number" step="0.05" value="'+(sgc.progressCoeff||0.15)+'" style="width:45px" onchange="if(!scriptData.battleConfig.siegeConfig)scriptData.battleConfig.siegeConfig={};scriptData.battleConfig.siegeConfig.progressCoeff=parseFloat(this.value)||0.15"></label>';
  html += '<label style="font-size:12px">守军月损耗<input type="number" step="0.01" value="'+(sgc.defenderAttritionRate||0.03)+'" style="width:45px" onchange="scriptData.battleConfig.siegeConfig.defenderAttritionRate=parseFloat(this.value)||0.03"></label>';
  html += '<label style="font-size:12px">投降士气阈值<input type="number" value="'+(sgc.surrenderMoraleThreshold||10)+'" style="width:45px" onchange="scriptData.battleConfig.siegeConfig.surrenderMoraleThreshold=parseInt(this.value)||10"></label>';
  html += '</div>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin-top:4px">无地图时城防等级由AI据史料判断（如"潼关"→5级雄关，"许昌"→2级平原城镇）</div>';
  html += '</div>';

  // 后勤/补给配置
  var sc = bc.supplyConfig || {};
  html += '<div class="cd" style="margin-top:10px"><h4>📦 后勤补给</h4>';
  html += '<div class="toggle-wrap"><label class="toggle"><input type="checkbox" '+(sc.enabled?'checked':'')+' onchange="if(!scriptData.battleConfig.supplyConfig)scriptData.battleConfig.supplyConfig={};scriptData.battleConfig.supplyConfig.enabled=this.checked;if(typeof autoSave===\'function\')autoSave()"><span class="toggle-slider"></span></label><div>启用补给消耗系统（军队消耗粮草武器，断供导致士气崩溃）</div></div>';
  html += '<div style="font-size:11px;color:var(--txt-d);margin:4px 0">天命已内置完整补给系统（生产/消耗/运输/断供惩罚）。开启后军队每回合自动消耗补给，断粮会导致兵变。</div>';
  html += '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:4px">';
  html += '<label style="font-size:12px">低补给士气损失/月<input type="number" value="'+(sc.lowSupplyMoraleLoss||10)+'" style="width:45px" onchange="if(!scriptData.battleConfig.supplyConfig)scriptData.battleConfig.supplyConfig={};scriptData.battleConfig.supplyConfig.lowSupplyMoraleLoss=parseInt(this.value)||10"></label>';
  html += '<label style="font-size:12px">断粮士气损失/月<input type="number" value="'+(sc.starvationMoraleLoss||20)+'" style="width:45px" onchange="if(!scriptData.battleConfig.supplyConfig)scriptData.battleConfig.supplyConfig={};scriptData.battleConfig.supplyConfig.starvationMoraleLoss=parseInt(this.value)||20"></label>';
  html += '</div></div>';

  el.innerHTML = html;
}

/** 添加自定义兵种 */
function addBattleUnitType() {
  if (!scriptData.battleConfig) scriptData.battleConfig = {};
  if (!scriptData.battleConfig.unitTypes) scriptData.battleConfig.unitTypes = [];

  var fields = [
    {key:'id', label:'兵种ID(英文)', default:'new_unit_'+Date.now()},
    {key:'name', label:'兵种名称', default:'新兵种'},
    {key:'attack', label:'攻击力(1-15)', default:'6', type:'number'},
    {key:'defense', label:'防御力(1-15)', default:'6', type:'number'},
    {key:'speed', label:'速度(1-10)', default:'3', type:'number'},
    {key:'siegeValue', label:'攻城值(0-10)', default:'3', type:'number'},
    {key:'baseCost', label:'基础花费', default:'15', type:'number'},
    {key:'upkeep', label:'维护费/月', default:'3', type:'number'},
    {key:'morale', label:'基础士气', default:'5', type:'number'},
    {key:'description', label:'描述', default:''}
  ];

  var body = fields.map(function(f) {
    return '<div class="fd"><label>'+f.label+'</label><input id="bcut-'+f.key+'" value="'+f.default+'" '+(f.type==='number'?'type="number"':'')+' style="width:100%"></div>';
  }).join('');

  openEditorModal('添加兵种', body, function() {
    var ut = {};
    fields.forEach(function(f) {
      var el = document.getElementById('bcut-'+f.key);
      ut[f.key] = f.type === 'number' ? (parseFloat(el.value) || 0) : (el.value || '');
    });
    scriptData.battleConfig.unitTypes.push(ut);
    if (typeof autoSave === 'function') autoSave();
    renderBattleConfigEditor('battleConfigContainer');
  });
}

/** 编辑兵种 */
function editBattleUnitType(index) {
  var ut = scriptData.battleConfig.unitTypes[index];
  if (!ut) return;

  var fields = ['id','name','attack','defense','speed','siegeValue','baseCost','upkeep','morale','description'];
  var labels = {id:'兵种ID',name:'名称',attack:'攻击力',defense:'防御力',speed:'速度',siegeValue:'攻城值',baseCost:'花费',upkeep:'维护费',morale:'士气',description:'描述'};
  var numFields = ['attack','defense','speed','siegeValue','baseCost','upkeep','morale'];

  var body = fields.map(function(f) {
    var isNum = numFields.indexOf(f) >= 0;
    return '<div class="fd"><label>'+labels[f]+'</label><input id="bcut-'+f+'" value="'+(ut[f]||'')+'" '+(isNum?'type="number"':'')+' style="width:100%"></div>';
  }).join('');

  openEditorModal('编辑兵种 - ' + (ut.name||ut.id), body, function() {
    fields.forEach(function(f) {
      var el = document.getElementById('bcut-'+f);
      ut[f] = numFields.indexOf(f)>=0 ? (parseFloat(el.value)||0) : (el.value||'');
    });
    if (typeof autoSave === 'function') autoSave();
    renderBattleConfigEditor('battleConfigContainer');
  });
}

/** 删除兵种 */
function deleteBattleUnitType(index) {
  scriptData.battleConfig.unitTypes.splice(index, 1);
  if (scriptData.battleConfig.unitTypes.length === 0) scriptData.battleConfig.unitTypes = null;
  if (typeof autoSave === 'function') autoSave();
  renderBattleConfigEditor('battleConfigContainer');
}

// 初始化 Unit 系统
function initUnitSystem() {
  if (!P.unitSystem || !P.unitSystem.enabled) return;

  GM.units = GM.units || [];
  GM._indices.unitById = GM._indices.unitById || new Map();

  // 从现有军队创建 Unit
  if (GM.armies && GM.armies.length > 0) {
    GM.armies.forEach(function(army) {
      if (!army.units || army.units.length === 0) {
        // 为没有 Unit 的军队创建默认编制
        var defaultUnits = createDefaultUnits(army);
        army.units = defaultUnits.map(function(u) { return u.id; });
        defaultUnits.forEach(function(u) {
          GM.units.push(u);
          addToIndex('unit', u.id, u);
        });
      }
    });
  }
}

// 创建默认编制
function createDefaultUnits(army) {
  var totalSoldiers = army.soldiers || 1000;
  var units = [];

  // 默认编制：60% 步兵，20% 弓箭手，20% 骑兵
  var infantryCount = Math.floor(totalSoldiers * 0.6);
  var archerCount = Math.floor(totalSoldiers * 0.2);
  var cavalryCount = totalSoldiers - infantryCount - archerCount;

  if (infantryCount > 0) {
    units.push(createUnit('infantry', infantryCount, army));
  }
  if (archerCount > 0) {
    units.push(createUnit('archer', archerCount, army));
  }
  if (cavalryCount > 0) {
    units.push(createUnit('cavalry', cavalryCount, army));
  }

  return units;
}

// 创建 Unit
function createUnit(type, count, army) {
  var unitType = getUnitTypes()[type];
  if (!unitType) return null;

  var unit = {
    id: uid(),
    type: type,
    name: unitType.name,
    count: count,
    armyId: army.id,
    armyName: army.name,
    morale: army.morale || 70,
    experience: 0,
    equipment: 'standard',
    status: 'ready',
    createdTurn: GM.turn
  };

  return unit;
}

// 更新 Unit 系统
function updateUnitSystem() {
  if (!P.unitSystem || !P.unitSystem.enabled || !GM.units) return;

  GM.units.forEach(function(unit) {
    // 更新士气
    var army = GM.armies.find(function(a) { return a.id === unit.armyId; });
    if (army) {
      unit.morale = army.morale || 70;
    }

    // 经验增长（月基准0.5，按天数缩放）
    if (unit.status === 'ready') {
      var _ums = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
      unit.experience = Math.min(100, unit.experience + 0.5 * _ums);
    }

    // 维护费用
    var unitType = getUnitTypes()[unit.type];
    if (unitType && army) {
      var upkeepCost = unitType.upkeep * unit.count;
      // 这里可以从军队或势力扣除维护费
    }
  });

  // 同步军队总兵力
  GM.armies.forEach(function(army) {
    if (army.units && army.units.length > 0) {
      var totalSoldiers = 0;
      army.units.forEach(function(unitId) {
        var unit = GM._indices.unitById.get(unitId);
        if (unit) {
          totalSoldiers += unit.count;
        }
      });
      army.soldiers = totalSoldiers;
    }
  });
}

// 计算 Unit 战斗力
function calculateUnitCombatPower(unit) {
  if (!unit) return 0;

  var unitType = getUnitTypes()[unit.type];
  if (!unitType) return unit.count;

  var basePower = (unitType.attack + unitType.defense) / 2;
  var moraleMod = unit.morale / 100;
  var experienceMod = 1 + unit.experience / 200;

  return unit.count * basePower * moraleMod * experienceMod;
}

// 计算军队总战斗力（基于 Unit）
function calculateArmyCombatPowerByUnits(army) {
  if (!army || !army.units || army.units.length === 0) {
    return calculateArmyStrength(army); // 回退到旧系统
  }

  var totalPower = 0;
  army.units.forEach(function(unitId) {
    var unit = GM._indices.unitById.get(unitId);
    if (unit) {
      totalPower += calculateUnitCombatPower(unit);
    }
  });

  return totalPower;
}

// 招募 Unit
function recruitUnit(army, type, count) {
  if (!army || !type || count <= 0) {
    return { success: false, reason: '参数无效' };
  }

  var unitType = getUnitTypes()[type];
  if (!unitType) {
    return { success: false, reason: '兵种不存在' };
  }

  var totalCost = unitType.baseCost * count;

  // 检查势力财政
  var faction = findFacByName(army.faction);
  if (!faction || faction.money < totalCost) {
    return { success: false, reason: '资金不足' };
  }

  // 扣除费用
  faction.money -= totalCost;

  // 创建 Unit
  var unit = createUnit(type, count, army);
  if (!GM.units) GM.units = [];
  GM.units.push(unit);
  addToIndex('unit', unit.id, unit);

  // 添加到军队
  if (!army.units) army.units = [];
  army.units.push(unit.id);

  // 更新军队总兵力
  army.soldiers = (army.soldiers || 0) + count;

  addEB('招募', army.name + ' 招募了 ' + count + ' 名' + unitType.name);

  return { success: true, unit: unit, cost: totalCost };
}

// 解散 Unit
function disbandUnit(unitId) {
  var unit = GM._indices.unitById.get(unitId);
  if (!unit) {
    return { success: false, reason: 'Unit 不存在' };
  }

  var army = GM.armies.find(function(a) { return a.id === unit.armyId; });
  if (army) {
    // 从军队移除
    army.units = army.units.filter(function(id) { return id !== unitId; });
    // 更新总兵力
    army.soldiers = Math.max(0, (army.soldiers || 0) - unit.count);
  }

  // 从索引移除
  removeFromIndex('unit', unitId);

  // 从列表移除
  GM.units = GM.units.filter(function(u) { return u.id !== unitId; });

  addEB('解散', unit.name + ' 已解散（' + unit.count + ' 人）');

  return { success: true };
}

// 转移 Unit
function transferUnit(unitId, targetArmyId) {
  var unit = GM._indices.unitById.get(unitId);
  if (!unit) {
    return { success: false, reason: 'Unit 不存在' };
  }

  var targetArmy = GM.armies.find(function(a) { return a.id === targetArmyId; });
  if (!targetArmy) {
    return { success: false, reason: '目标军队不存在' };
  }

  var sourceArmy = GM.armies.find(function(a) { return a.id === unit.armyId; });

  // 从源军队移除
  if (sourceArmy) {
    sourceArmy.units = sourceArmy.units.filter(function(id) { return id !== unitId; });
    sourceArmy.soldiers = Math.max(0, (sourceArmy.soldiers || 0) - unit.count);
  }

  // 添加到目标军队
  if (!targetArmy.units) targetArmy.units = [];
  targetArmy.units.push(unitId);
  targetArmy.soldiers = (targetArmy.soldiers || 0) + unit.count;

  // 更新 Unit 归属
  unit.armyId = targetArmyId;
  unit.armyName = targetArmy.name;

  addEB('调动', unit.name + ' 从 ' + (sourceArmy ? sourceArmy.name : '未知') + ' 调往 ' + targetArmy.name);

  return { success: true };
}

// 生成军队编制报告
function generateArmyCompositionReport(army) {
  if (!army) return '无军队数据';

  var report = '【军队编制：' + army.name + '】\n\n';
  report += '总兵力：' + (army.soldiers || 0) + ' 人\n';
  report += '士气：' + (army.morale || 70) + '\n';
  if (army.commander) {
    report += '统帅：' + army.commander + '\n';
  }
  report += '\n';

  if (!army.units || army.units.length === 0) {
    report += '（未启用编制系统）\n';
    return report;
  }

  report += '【兵种构成】\n';
  army.units.forEach(function(unitId) {
    var unit = GM._indices.unitById.get(unitId);
    if (unit) {
      var unitType = getUnitTypes()[unit.type];
      report += '• ' + unit.name + '：' + unit.count + ' 人\n';
      if (unitType) {
        report += '  攻击：' + unitType.attack + ' | 防御：' + unitType.defense + ' | 速度：' + unitType.speed + '\n';
      }
      report += '  士气：' + unit.morale + ' | 经验：' + unit.experience.toFixed(0) + '\n';
      report += '  战斗力：' + calculateUnitCombatPower(unit).toFixed(0) + '\n';
    }
  });

  report += '\n总战斗力：' + calculateArmyCombatPowerByUnits(army).toFixed(0) + '\n';

  return report;
}

// ============================================================
// 补给系统
// ============================================================

// 补给系统：增强战略深度，不影响现有战斗逻辑
// 提供补给链路管理（生产→运输→消耗）

// 补给类型定义
var SupplyTypes = {
  food: { name: '粮草', weight: 1, consumeRate: 1 },
  weapon: { name: '武器', weight: 2, consumeRate: 0.1 },
  armor: { name: '盔甲', weight: 3, consumeRate: 0.05 },
  medicine: { name: '药品', weight: 0.5, consumeRate: 0.2 },
  fodder: { name: '马料', weight: 1.5, consumeRate: 0.5 }
};

// 初始化补给系统
function initSupplySystem() {
  if (!P.supplySystem || !P.supplySystem.enabled) return;

  GM.supplyDepots = GM.supplyDepots || [];
  GM.supplyRoutes = GM.supplyRoutes || [];
  GM._indices.supplyDepotById = GM._indices.supplyDepotById || new Map();

  // 为每个势力创建主要补给仓库
  (GM.facs || []).forEach(function(faction) {
    if (!faction.supplyDepots || faction.supplyDepots.length === 0) {
      var depot = createSupplyDepot(faction.name + '主仓', faction.name, faction.capital || '未知');
      GM.supplyDepots.push(depot);
      addToIndex('supplyDepot', depot.id, depot);

      if (!faction.supplyDepots) faction.supplyDepots = [];
      faction.supplyDepots.push(depot.id);
    }
  });
}

// 创建补给仓库
function createSupplyDepot(name, factionName, location) {
  var depot = {
    id: uid(),
    name: name,
    faction: factionName,
    location: location,
    capacity: 10000,
    supplies: {
      food: 5000,
      weapon: 1000,
      armor: 500,
      medicine: 200,
      fodder: 1000
    },
    createdTurn: GM.turn
  };
  return depot;
}

// ============================================================
// 建筑系统 - 借鉴 KingOfIreland Barony 建筑
// ============================================================

// 建筑类型定义（中国古代背景）
var BUILDING_TYPES = {
  // 经济类建筑
  farmland: { name: '农田', category: 'economy', maxLevel: 5 },
  market: { name: '集市', category: 'economy', maxLevel: 5 },
  workshop: { name: '工坊', category: 'economy', maxLevel: 5 },
  mine: { name: '矿场', category: 'economy', maxLevel: 5 },

  // 军事类建筑
  barracks: { name: '兵营', category: 'military', maxLevel: 5 },
  stable: { name: '马厩', category: 'military', maxLevel: 5 },
  arsenal: { name: '军械库', category: 'military', maxLevel: 5 },
  fortress: { name: '城防', category: 'military', maxLevel: 5 },

  // 文化类建筑
  academy: { name: '书院', category: 'culture', maxLevel: 5 },
  temple: { name: '庙宇', category: 'culture', maxLevel: 5 },
  library: { name: '藏书楼', category: 'culture', maxLevel: 5 },

  // 行政类建筑
  office: { name: '官署', category: 'administration', maxLevel: 5 },
  warehouse: { name: '仓库', category: 'administration', maxLevel: 5 }
};

// 建筑��果计算（按等级）— 优先使用编辑器结构化效果，回退到硬编码
function getBuildingEffects(type, level) {
  var effects = {
    monthlyIncome: 0, monthlyTax: 0, levy: 0, garrison: 0,
    fortLevel: 0, culturalInfluence: 0, administrativeEfficiency: 0, prosperity: 0
  };

  // 优先从 BUILDING_TYPES 中的 structuredEffects 计算
  var btDef = BUILDING_TYPES[type];
  if (btDef && btDef.structuredEffects) {
    var se = btDef.structuredEffects;
    effects.monthlyIncome = (se.monthlyIncome || 0) * level;
    effects.monthlyTax = (se.monthlyTax || 0) * level;
    effects.levy = (se.levy || 0) * level;
    effects.garrison = (se.garrison || 0) * level;
    effects.fortLevel = (se.fortLevel || 0) * level;
    effects.culturalInfluence = (se.culturalInfluence || 0) * level;
    effects.administrativeEfficiency = (se.adminEfficiency || 0) * level;
    effects.prosperity = (se.prosperity || 0) * level;
    return effects;
  }

  // 回退：硬编码默认值
  switch(type) {
    case 'farmland': effects.monthlyIncome = 50 * level; effects.monthlyTax = 20 * level; break;
    case 'market': effects.monthlyIncome = 80 * level; effects.monthlyTax = 30 * level; break;
    case 'workshop': effects.monthlyIncome = 60 * level; effects.monthlyTax = 25 * level; break;
    case 'mine': effects.monthlyIncome = 100 * level; effects.monthlyTax = 40 * level; break;
    case 'barracks': effects.levy = 50 * level; effects.garrison = 20 * level; break;
    case 'stable': effects.levy = 30 * level; effects.garrison = 10 * level; break;
    case 'arsenal': effects.levy = 40 * level; break;
    case 'fortress': effects.garrison = 100 * level; effects.fortLevel = level; break;
    case 'academy': effects.culturalInfluence = 10 * level; effects.administrativeEfficiency = 5 * level; break;
    case 'temple': effects.culturalInfluence = 8 * level; break;
    case 'library': effects.culturalInfluence = 12 * level; break;
    case 'office': effects.administrativeEfficiency = 10 * level; effects.monthlyTax = 15 * level; break;
    case 'warehouse': effects.monthlyIncome = 30 * level; break;
  }

  return effects;
}

// 建筑升级成本计算（优先用编辑器配置）
function getBuildingCost(type, level) {
  var btDef = BUILDING_TYPES[type];
  var baseCost = (btDef && btDef.baseCost) ? btDef.baseCost : 1000;

  // 如果没有编辑器配置，按类别回退
  if (!btDef || !btDef.baseCost) {
    var category = btDef ? btDef.category : 'economy';
    switch(category) {
      case 'economy': case 'economic': baseCost = 800; break;
      case 'military': baseCost = 1200; break;
      case 'culture': case 'cultural': baseCost = 1000; break;
      case 'administration': case 'administrative': baseCost = 900; break;
    }
  }

  return Math.floor(baseCost * Math.pow(1.5, level - 1));
}

// 建筑升级耗时计算（优先用编辑器配置）
function getBuildingTime(type, level) {
  var btDef = BUILDING_TYPES[type];
  var baseTime = (btDef && btDef.buildTime) ? btDef.buildTime : 3;

  if (!btDef || !btDef.buildTime) {
    var category = btDef ? btDef.category : 'economy';
    switch(category) {
      case 'economy': case 'economic': baseTime = 2; break;
      case 'military': baseTime = 4; break;
      case 'culture': case 'cultural': baseTime = 3; break;
      case 'administration': case 'administrative': baseTime = 3; break;
    }
  }

  return Math.floor(baseTime * Math.pow(1.3, level - 1));
}

// 初始化建筑系统
function initBuildingSystem() {
  if (!P.buildingSystem || !P.buildingSystem.enabled) return;

  // 从编辑器配置加载建筑类型到运行时注册表
  if (P.buildingSystem.buildingTypes && P.buildingSystem.buildingTypes.length > 0) {
    P.buildingSystem.buildingTypes.forEach(function(bt) {
      var key = (bt.name || '').replace(/\s/g, '_').toLowerCase();
      if (!key) return;
      // 合入 BUILDING_TYPES（编辑器配置优先于硬编码）
      BUILDING_TYPES[key] = {
        name: bt.name,
        category: bt.category || 'economic',
        maxLevel: bt.maxLevel || 5,
        baseCost: bt.baseCost || 1000,
        buildTime: bt.buildTime || 3,
        structuredEffects: bt.structuredEffects || null,
        description: bt.description || '',
        requirements: bt.requirements || ''
      };
    });
  }

  GM.buildings = GM.buildings || [];
  GM.buildingQueue = GM.buildingQueue || [];
  GM._indices.buildingById = GM._indices.buildingById || new Map();
  GM._indices.buildingByTerritory = GM._indices.buildingByTerritory || new Map();

  // 为每个势力的领地创建初始建筑
  (GM.facs || []).forEach(function(faction) {
    if (!faction.territories || faction.territories.length === 0) {
      var territory = faction.capital || faction.name + '领地';
      createInitialBuildings(faction.name, territory);
    } else {
      faction.territories.forEach(function(territory) {
        createInitialBuildings(faction.name, territory);
      });
    }
  });
}

// 为领地创建初始建筑
function createInitialBuildings(factionName, territory) {
  // 每个领地默认有农田1级和城防1级
  var farmland = createBuilding('farmland', 1, factionName, territory);
  var fortress = createBuilding('fortress', 1, factionName, territory);

  GM.buildings.push(farmland);
  GM.buildings.push(fortress);

  addToIndex('building', farmland.id, farmland);
  addToIndex('building', fortress.id, fortress);

  // 按领地索引
  if (!GM._indices.buildingByTerritory.has(territory)) {
    GM._indices.buildingByTerritory.set(territory, []);
  }
  GM._indices.buildingByTerritory.get(territory).push(farmland);
  GM._indices.buildingByTerritory.get(territory).push(fortress);
}

// 创建建筑
function createBuilding(type, level, factionName, territory) {
  var buildingInfo = BUILDING_TYPES[type];
  var effects = getBuildingEffects(type, level);

  var building = {
    id: uid(),
    type: type,
    name: buildingInfo ? buildingInfo.name : '未知建筑',
    level: level,
    faction: factionName,
    territory: territory,
    effects: effects,
    createdTurn: GM.turn,
    lastUpgradedTurn: GM.turn
  };

  return building;
}

// 开始建造/升级建筑
function startBuildingUpgrade(buildingId, factionName) {
  var building = GM._indices.buildingById ? GM._indices.buildingById.get(buildingId) : null;
  if (!building) {
    toast('建筑不存在');
    return false;
  }

  var buildingInfo = BUILDING_TYPES[building.type];
  if (!buildingInfo) {
    toast('建筑类型无效');
    return false;
  }

  // 检查是否已达到最大等级
  if (building.level >= buildingInfo.maxLevel) {
    toast(building.name + '已达到最大等级');
    return false;
  }

  var nextLevel = building.level + 1;
  var cost = getBuildingCost(building.type, nextLevel);
  var time = getBuildingTime(building.type, nextLevel);

  // 检查势力财政
  var faction = GM._indices.facByName ? GM._indices.facByName.get(factionName) : null;
  if (!faction) {
    toast('势力不存在');
    return false;
  }

  if (faction.money < cost) {
    toast('资金不足，需要 ' + cost + ' 金');
    return false;
  }

  // 扣除费用
  faction.money -= cost;

  // 添加到建造队列
  var task = {
    id: uid(),
    buildingId: buildingId,
    buildingName: building.name,
    type: building.type,
    currentLevel: building.level,
    targetLevel: nextLevel,
    faction: factionName,
    territory: building.territory,
    startTurn: GM.turn,
    completeTurn: GM.turn + time,
    cost: cost,
    time: time
  };

  GM.buildingQueue.push(task);

  toast(building.name + ' 开始升级至 ' + nextLevel + ' 级，预计 ' + time + ' 回合完成');
  return true;
}

// 更新建筑系统
function updateBuildingSystem() {
  if (!P.buildingSystem || !P.buildingSystem.enabled) return;
  if (!GM.buildingQueue || GM.buildingQueue.length === 0) return;

  var completedTasks = [];

  // 检查建造队列
  GM.buildingQueue.forEach(function(task) {
    if (GM.turn >= task.completeTurn) {
      // 建造完成
      var building = GM._indices.buildingById ? GM._indices.buildingById.get(task.buildingId) : null;
      if (building) {
        building.level = task.targetLevel;
        building.lastUpgradedTurn = GM.turn;
        building.effects = getBuildingEffects(building.type, building.level);

        toast(building.name + ' 升级至 ' + building.level + ' 级完成！');
        completedTasks.push(task.id);
      }
    }
  });

  // 移除已完成的任务
  GM.buildingQueue = GM.buildingQueue.filter(function(task) {
    return completedTasks.indexOf(task.id) === -1;
  });
}

// 获取领地的所有建筑
function getTerritoryBuildings(territory) {
  if (GM._indices.buildingByTerritory && GM._indices.buildingByTerritory.has(territory)) {
    return GM._indices.buildingByTerritory.get(territory);
  }
  return [];
}

// 计算领地的建筑总效果
function calculateTerritoryBuildingEffects(territory) {
  var buildings = getTerritoryBuildings(territory);
  var totalEffects = {
    monthlyIncome: 0,
    monthlyTax: 0,
    levy: 0,
    garrison: 0,
    fortLevel: 0,
    culturalInfluence: 0,
    administrativeEfficiency: 0
  };

  buildings.forEach(function(building) {
    if (building.effects) {
      Object.keys(building.effects).forEach(function(key) {
        if (totalEffects.hasOwnProperty(key)) {
          totalEffects[key] += building.effects[key];
        }
      });
    }
  });

  return totalEffects;
}

// 在势力收入计算中应用建筑效果
function applyBuildingEffectsToFaction(faction) {
  if (!P.buildingSystem || !P.buildingSystem.enabled) return { income: 0, tax: 0 };
  if (!faction.territories || faction.territories.length === 0) return { income: 0, tax: 0 };

  var totalIncome = 0;
  var totalTax = 0;

  faction.territories.forEach(function(territory) {
    var effects = calculateTerritoryBuildingEffects(territory);
    totalIncome += effects.monthlyIncome;
    totalTax += effects.monthlyTax;
  });

  // 应用到势力收入
  if (totalIncome > 0) {
    faction.money = (faction.money || 0) + totalIncome;
  }

  return {
    income: totalIncome,
    tax: totalTax
  };
}

// ============================================================
// 2.5: 建筑产出公式（时间缩放版）
// 产出值为月基准 × getTimeRatio()*12
// 建造时间用天数（buildDays）配置，运行时转换为回合数
// ============================================================
function calculateBuildingOutput() {
  if (!P.buildingSystem || !P.buildingSystem.enabled) return;
  if (!GM.buildings || !GM.buildings.length) return;
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1/12);
  var monthScale = tr * 12;
  var balBuilding = (typeof getBalanceVal === 'function') ? getBalanceVal('building', {}) : {};
  var maxOutput = balBuilding.maxOutputPerTurn || {};
  var totalOutput = { money: 0, grain: 0, militaryStrength: 0 };
  var outputDescs = [];

  GM.buildings.forEach(function(b) {
    if (!b.effects || b.underConstruction) return;
    for (var key in b.effects) {
      if (!b.effects.hasOwnProperty(key)) continue;
      var monthBase = b.effects[key];
      if (typeof monthBase !== 'number' || monthBase === 0) continue;
      var scaled = monthBase * monthScale;
      // clamp单建筑单回合产出
      var cap = maxOutput[key];
      if (cap && Math.abs(scaled) > cap) scaled = scaled > 0 ? cap : -cap;
      totalOutput[key] = (totalOutput[key] || 0) + scaled;
    }
  });

  // 应用到 GM 经济状态（国库用 GM.stateTreasury，粮食查 GM.vars 中含"粮"的变量）
  if (totalOutput.money && typeof GM.stateTreasury === 'number') {
    var oldT = GM.stateTreasury;
    GM.stateTreasury += Math.round(totalOutput.money);
    if (typeof ChangeLog !== 'undefined') ChangeLog.record('building', 'treasury', 'treasury', oldT, GM.stateTreasury, '建筑产出');
  }
  if (totalOutput.grain && GM.vars) {
    // 查找粮食相关变量
    var _grainKey = null;
    Object.keys(GM.vars).forEach(function(vk) { if (/粮|grain/i.test(vk) && !_grainKey) _grainKey = vk; });
    if (_grainKey && GM.vars[_grainKey]) {
      var oldG = GM.vars[_grainKey].value || 0;
      GM.vars[_grainKey].value = oldG + Math.round(totalOutput.grain);
      if (typeof ChangeLog !== 'undefined') ChangeLog.record('building', _grainKey, 'value', oldG, GM.vars[_grainKey].value, '建筑产出');
    }
  }
  if (totalOutput.militaryStrength && typeof GM.militaryStrength === 'number') {
    var oldM = GM.militaryStrength;
    GM.militaryStrength += Math.round(totalOutput.militaryStrength);
    if (typeof ChangeLog !== 'undefined') ChangeLog.record('building', 'militaryStrength', 'militaryStrength', oldM, GM.militaryStrength, '建筑产出');
  }

  // 汇总供 AI prompt 注入
  for (var k in totalOutput) {
    if (totalOutput[k] && Math.abs(totalOutput[k]) >= 1) {
      outputDescs.push(k + (totalOutput[k] >= 0 ? '+' : '') + Math.round(totalOutput[k]));
    }
  }
  GM._buildingOutputReport = outputDescs.length ? '建筑产出：' + outputDescs.join('、') : '';
  if (outputDescs.length) {
    DebugLog.log('building', GM._buildingOutputReport);
  }
}

// 注册建筑产出到结算流水线（在 updateBuildingSystem 之后）
SettlementPipeline.register('buildingOutput', '建筑产出', function() {
  calculateBuildingOutput();
}, 30, 'perturn');

// ============================================================
// 4.2: 省级独立经济
// 每回合计算省份收入，月基准 × getTimeRatio()*12
// 字段用通用名（incomeRate而非taxRate），初始值从编辑器读取
// ============================================================
function calculateProvinceEconomy() {
  if (!GM.provinceStats) return;
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1 / 12);
  var monthScale = tr * 12;
  var provinceNames = Object.keys(GM.provinceStats);

  provinceNames.forEach(function(name) {
    var ps = GM.provinceStats[name];
    if (!ps) return;
    // 确保字段存在
    if (!ps.treasury) ps.treasury = { money: 0, grain: 0 };
    if (ps.population === undefined) ps.population = 0;
    if (ps.incomeRate === undefined) ps.incomeRate = 0;
    if (!ps.monthlyIncome) ps.monthlyIncome = { money: 0, grain: 0 };

    // 计算月收入：人口 × 收入率 × (1 - 腐败/100)
    var corruptionFactor = 1 - (ps.corruption || 0) / 100;
    var baseMonthlyMoney = (ps.population || 0) * (ps.incomeRate || 0) * corruptionFactor;

    // governor 能力加成
    if (ps.governor) {
      var gov = (typeof findCharByName === 'function') ? findCharByName(ps.governor) : null;
      if (gov && gov.alive !== false) {
        var adminSkill = (gov.administration || gov.intelligence || 50) / 100;
        baseMonthlyMoney *= (0.7 + adminSkill * 0.6); // 能力50=×1.0, 能力80=×1.18
      }
    }

    // 时间缩放
    var scaledMoney = baseMonthlyMoney * monthScale;
    var scaledGrain = (ps.population || 0) * 0.001 * corruptionFactor * monthScale; // 粮食简化计算

    ps.monthlyIncome = { money: Math.round(scaledMoney), grain: Math.round(scaledGrain) };
    ps.treasury.money = (ps.treasury.money || 0) + ps.monthlyIncome.money;
    ps.treasury.grain = (ps.treasury.grain || 0) + ps.monthlyIncome.grain;

    if (typeof ChangeLog !== 'undefined' && ps.monthlyIncome.money) {
      ChangeLog.record('economy', name, 'money', ps.treasury.money - ps.monthlyIncome.money, ps.treasury.money, '省份收入');
    }
  });
}

SettlementPipeline.register('provinceEconomy', '地方区划', function() {
  calculateProvinceEconomy();
}, 35, 'perturn');

// ============================================================
// 4.3: 战斗系统增强——动量+兵种差异（编辑器配置）
// 兵种从 P.militaryConfig.unitTypes[] 读取，不硬编码
// 围城 progress × timeRatio
// ============================================================
function enhancedResolveBattle(attacker, defender, context) {
  var milCfg = (typeof P !== 'undefined' && P.militaryConfig) ? P.militaryConfig : {};
  var unitTypes = milCfg.unitTypes || [];
  var phases = milCfg.battlePhases || [{ id: 'deploy' }, { id: 'clash' }, { id: 'decisive' }];
  var momCfg = milCfg.momentumConfig || { winGain: 0.15, losePenalty: 0.15, max: 1.5, min: 0.6 };

  // 初始化动量
  if (!attacker.momentum) attacker.momentum = 1.0;
  if (!defender.momentum) defender.momentum = 1.0;

  var result = { phases: [], winner: '', attLoss: 0, defLoss: 0 };

  // 计算兵种战力加成
  function _unitBonus(army, phaseId) {
    if (!army.unitType || !unitTypes.length) return 1.0;
    var ut = unitTypes.find(function(u) { return u.id === army.unitType; });
    if (!ut || !ut.stats) return 1.0;
    return (ut.stats[phaseId] || 5) / 5; // 归一化到基准5
  }

  // 按阶段计算
  for (var i = 0; i < phases.length; i++) {
    var phase = phases[i];
    var attCmd = context && context.attCommander ? (context.attCommander.military || 50) : 50;
    var defCmd = context && context.defCommander ? (context.defCommander.military || 50) : 50;

    var attPower = (attacker.strength || 1000) * (0.5 + attCmd * 0.005) * attacker.momentum * _unitBonus(attacker, phase.id);
    var defPower = (defender.strength || 1000) * (0.5 + defCmd * 0.005) * defender.momentum * _unitBonus(defender, phase.id);

    var phaseWinner = attPower > defPower ? 'attacker' : 'defender';
    var ratio = Math.max(attPower, defPower) / (Math.min(attPower, defPower) || 1);
    var phaseLoss = Math.round(Math.min(attacker.strength, defender.strength) * 0.05 * Math.min(ratio, 3));

    // 更新动量
    if (phaseWinner === 'attacker') {
      attacker.momentum = Math.min(momCfg.max, attacker.momentum + momCfg.winGain);
      defender.momentum = Math.max(momCfg.min, defender.momentum - momCfg.losePenalty);
      result.defLoss += phaseLoss;
    } else {
      defender.momentum = Math.min(momCfg.max, defender.momentum + momCfg.winGain);
      attacker.momentum = Math.max(momCfg.min, attacker.momentum - momCfg.losePenalty);
      result.attLoss += phaseLoss;
    }
    result.phases.push({ phase: phase.id, name: phase.name || phase.id, winner: phaseWinner, attPower: Math.round(attPower), defPower: Math.round(defPower) });
  }

  // 总胜负
  var attWins = result.phases.filter(function(p) { return p.winner === 'attacker'; }).length;
  result.winner = attWins > phases.length / 2 ? 'attacker' : 'defender';

  return result;
}

// 4.3: 围城进度计算（月基准 × timeRatio）
function calculateSiegeProgress(siege) {
  if (!siege || !siege.attackerStrength) return 0;
  var tr = (typeof getTimeRatio === 'function') ? getTimeRatio() : (1 / 12);
  var monthScale = tr * 12;
  var defenderFactor = (siege.population || 10000) / 500 + (siege.defenderStrength || 0) / 10;
  var progress = (siege.attackerStrength / (defenderFactor || 1)) * monthScale;
  return Math.min(100, Math.round(progress * 10) / 10);
}

// ============================================================
// 行政区划更新（每回合）— governor能力影响省份
// ============================================================
function updateAdminHierarchy() {
  if (!P.adminHierarchy || !GM.provinceStats) return;

  var _adminKeys = Object.keys(P.adminHierarchy);
  _adminKeys.forEach(function(k) {
    var ah = P.adminHierarchy[k];
    if (!ah || !ah.divisions) return;

    function _updateDiv(divs) {
      divs.forEach(function(d) {
        var ps = GM.provinceStats[d.name];
        if (ps) {
          if (d.governor) {
            // governor能力影响省份：好官减腐败增稳定，庸官反之
            var gov = GM.chars ? GM.chars.find(function(c) { return c.name === d.governor && c.alive !== false; }) : null;
            if (gov) {
              var adm = gov.administration || 50;
              var loy = gov.loyalty || 50;
              var _gms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
              if (adm > 60) ps.corruption = Math.max(0, ps.corruption - 0.5 * _gms);
              else if (adm < 30) ps.corruption = Math.min(100, ps.corruption + 0.5 * _gms);
              if (loy > 70) ps.stability = Math.min(100, ps.stability + 0.3 * _gms);
              else if (loy < 30) { ps.stability = Math.max(0, ps.stability - 0.5 * _gms); ps.corruption = Math.min(100, ps.corruption + 0.3 * _gms); }
            } else {
              d.governor = '';
              ps.governor = '';
            }
          } else {
            var _gms2 = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
            ps.corruption = Math.min(100, ps.corruption + 0.5 * _gms2);
          }
          // 双向同步 prosperity ↔ wealth, population
          d.prosperity = ps.wealth;
          if (ps.population && d.population) {
            // 省份人口变化回写到行政区划
            d.population = ps.population;
          }
          // 行政区划地形/特产持续影响省份
          if (d.terrain && !ps.terrain) ps.terrain = d.terrain;
          if (d.specialResources && !ps.specialResources) ps.specialResources = d.specialResources;
          if (d.taxLevel && !ps.taxLevel) ps.taxLevel = d.taxLevel;
          // 同步governor
          ps.governor = d.governor || '';
        }
        if (d.children) _updateDiv(d.children);
      });
    }
    _updateDiv(ah.divisions);
  });
}

// ============================================================
// 皇城宫殿·妃嫔居所分配系统
// ============================================================

/**
 * 获取妃嫔的居所信息
 * @param {Object} character
 * @returns {Object|null} {palace, subHall} or null
 */
function getCharacterResidence(character) {
  if (!character || !character.residence || !P.palaceSystem) return null;
  var palaces = P.palaceSystem.palaces || [];
  var pal = palaces.find(function(p) { return p.id === character.residence.palaceId; });
  if (!pal) return null;
  var sh = null;
  if (character.residence.subHallId && pal.subHalls) {
    sh = pal.subHalls.find(function(s) { return s.id === character.residence.subHallId; });
  }
  return { palace: pal, subHall: sh };
}

/**
 * 按位分自动分配妃嫔居所
 * 规则：高位(皇后/皇贵妃/贵妃)住主殿独居；中位(妃嫔)住偏殿；低位(贵人以下)合住附殿
 */
function autoAssignHaremResidences() {
  if (!P.palaceSystem || !P.palaceSystem.palaces || !P.palaceSystem.palaces.length) return;
  if (!GM.chars) return;
  var palaces = P.palaceSystem.palaces;
  // 获取位分映射（按name查级）
  var ranks = (P.haremConfig && P.haremConfig.rankSystem) || [];
  var rankByName = {};
  ranks.forEach(function(r) { rankByName[r.name] = r; });

  // 筛选所有后妃角色（有 rankLevel 或 haremRank）
  var consorts = GM.chars.filter(function(c) {
    return c.alive !== false && (c.haremRank || c.rankLevel || c.isConsort);
  });
  // 已占用表
  var occupiedSubHalls = {};
  palaces.forEach(function(p) {
    if (!p.subHalls) return;
    p.subHalls.forEach(function(sh) {
      if (sh.occupants && sh.occupants.length) {
        occupiedSubHalls[sh.id] = sh.occupants.slice();
      } else {
        sh.occupants = [];
      }
    });
  });

  // 按位分从高到低排序（level越小越尊）
  consorts.sort(function(a, b) {
    var ra = rankByName[a.haremRank] || rankByName[a.rankLevel];
    var rb = rankByName[b.haremRank] || rankByName[b.rankLevel];
    return ((ra && ra.level) || 99) - ((rb && rb.level) || 99);
  });

  // 逐个分配
  consorts.forEach(function(c) {
    if (c.residence && c.residence.palaceId && c.residence.subHallId) return; // 已有居所
    var rankName = c.haremRank || c.rankLevel;
    var rank = rankByName[rankName];
    // 找符合 rankRestriction 的 subHall
    var candidates = [];
    palaces.forEach(function(p) {
      if (p.type !== 'consort_residence' && p.type !== 'imperial_residence' && p.type !== 'main_hall') return;
      (p.subHalls || []).forEach(function(sh) {
        var occ = sh.occupants || [];
        if (occ.length >= (sh.capacity || 1)) return;
        // 位分限制
        if (sh.rankRestriction && sh.rankRestriction.length > 0) {
          if (sh.rankRestriction.indexOf(rankName) < 0) return;
        }
        // role偏好：高位优先main，低位优先side/attached
        var priority = 0;
        if (rank) {
          if (rank.level <= 2 && sh.role === 'main') priority = 10;
          else if (rank.level >= 3 && rank.level <= 5 && sh.role === 'side') priority = 8;
          else if (rank.level > 5 && (sh.role === 'side' || sh.role === 'attached')) priority = 6;
        }
        candidates.push({ palace: p, subHall: sh, priority: priority });
      });
    });
    candidates.sort(function(a, b) { return b.priority - a.priority; });
    var pick = candidates[0];
    if (pick) {
      c.residence = { palaceId: pick.palace.id, subHallId: pick.subHall.id };
      pick.subHall.occupants = (pick.subHall.occupants || []).concat([c.name]);
    }
  });
}

// ═══════════════════════════════════════════════════════════════════
// 军事双 schema 同步：GM.armies[] (权威·startGame 写) ↔ GM.population.military.types{} (派生·军费/军粮/军事消耗用)
// 之前仅 startGame 同步一次·后续 endturn 任免/调动会脱节
// 调用：endturn 末尾·tm-ai-change-applier 应用 army_updates 后·任何修改 GM.armies 的地方调用
// ═══════════════════════════════════════════════════════════════════
function syncMilitarySources(GM) {
  if (!GM || !Array.isArray(GM.armies)) return;
  if (!GM.population) GM.population = {};
  if (!GM.population.military) GM.population.military = { types: {} };
  if (!GM.population.military.types) GM.population.military.types = {};
  // 按军种(branch/type)聚合
  var typesMap = {};
  GM.armies.forEach(function(a) {
    if (!a || a.destroyed) return;
    var soldiers = a.soldiers || a.size || a.strength || 0;
    if (soldiers <= 0) return;
    var key = a.branch || a.type || a.kind || 'infantry';
    if (!typesMap[key]) {
      typesMap[key] = {
        enabled: true, strength: 0, paymentModel: 'wage',
        morale: 0, supply: 0, training: 0, _count: 0
      };
    }
    var t = typesMap[key];
    t.strength += soldiers;
    t.morale  += (a.morale || 50) * soldiers;
    t.supply  += (a.supply || 50) * soldiers;
    t.training += (a.training || 50) * soldiers;
    t._count += soldiers;
    // paymentModel 从首支军种继承（兼容 _tickMilitarySupply）
    if (a.paymentModel) t.paymentModel = a.paymentModel;
  });
  // 平均化质量字段（按兵力加权）
  Object.keys(typesMap).forEach(function(key) {
    var t = typesMap[key];
    if (t._count > 0) {
      t.morale = Math.round(t.morale / t._count);
      t.supply = Math.round(t.supply / t._count);
      t.training = Math.round(t.training / t._count);
    }
    delete t._count;
  });
  // 写入·保留 population.military.types 已有的非数值字段(如 historicalNote)
  Object.keys(typesMap).forEach(function(key) {
    var existing = GM.population.military.types[key] || {};
    GM.population.military.types[key] = Object.assign(existing, typesMap[key]);
  });
  // 派生类型不再有任何 army·设 enabled=false 但保留(供历史回看)
  Object.keys(GM.population.military.types).forEach(function(key) {
    if (!typesMap[key]) {
      GM.population.military.types[key].enabled = false;
      GM.population.military.types[key].strength = 0;
    }
  });
}

if (typeof window !== 'undefined') {
  window.syncMilitarySources = syncMilitarySources;
}
