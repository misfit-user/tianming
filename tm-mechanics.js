// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// Soft Floor System - 软下限系统
// Requires: tm-data-model.js (P, GM), tm-utils.js (_dbg)
// ============================================================

/**
 * 软下限系统
 * 防止变量雪崩式下降，当接近下限时增加阻尼
 *
 * 核心机制：
 * 1. 为关键变量设定软下限阈值
 * 2. 当变量低于阈值时，负向变动会被阻尼（减弱）
 * 3. 阻尼系数可配置（0-1，越小阻尼越强）
 * 4. 正向变动不受影响
 */
var SoftFloorSystem = (function() {
  /**
   * 应用软下限阻尼
   * @param {string} varName - 变量名
   * @param {number} currentValue - 当前值
   * @param {number} delta - 原始变动值
   * @returns {number} - 应用阻尼后的变动值
   */
  function applyDamping(varName, currentValue, delta) {
    var config = P.softFloors;
    if (!config) return delta;

    var floorConfig = config[varName];
    if (!floorConfig || !floorConfig.enabled) return delta;

    // 正向变动不受影响
    if (delta >= 0) return delta;

    var threshold = floorConfig.threshold || 0;
    var damping = floorConfig.damping || 0.5;

    // 当前值高于阈值，不应用阻尼
    if (currentValue > threshold) return delta;

    // 当前值低于阈值，应用阻尼
    var dampedDelta = delta * damping;

    _dbg('[SoftFloor] ' + varName + ' 触发软下限 (当前: ' + currentValue.toFixed(1) +
                ', 阈值: ' + threshold + ', 阻尼: ' + damping +
                ', 原始变动: ' + delta.toFixed(2) + ' → 阻尼后: ' + dampedDelta.toFixed(2) + ')');

    return dampedDelta;
  }

  /**
   * 批量检查并应用软下限
   * @param {Array} changes - 变动数组
   * @returns {Array} - 应用阻尼后的变动数组
   */
  function processChanges(changes) {
    if (!P.softFloors) return changes;

    return changes.map(function(change) {
      if (change.type !== 'variable' || change.delta === undefined) {
        return change;
      }

      // 获取当前值
      var variable = Object.values(GM.vars).find(function(v) { return v.name === change.target; });
      if (!variable) return change;

      var currentValue = variable.value || 0;
      var dampedDelta = applyDamping(change.target, currentValue, change.delta);

      // 如果阻尼后的变动与原始变动不同，创建新的变动对象
      if (dampedDelta !== change.delta) {
        return {
          id: change.id,
          type: change.type,
          target: change.target,
          field: change.field,
          delta: dampedDelta,
          newValue: change.newValue,
          description: change.description + ' [软下限阻尼]',
          source: change.source,
          timestamp: change.timestamp
        };
      }

      return change;
    });
  }

  return {
    applyDamping: applyDamping,
    processChanges: processChanges
  };
})();

// ============================================================
// Offend Groups System - 得罪群体系统
// ============================================================

/**
 * 得罪群体系统
 * 追踪玩家决策对不同利益集团的得罪程度
 *
 * 核心机制：
 * 1. 每个决策可以得罪多个利益集团（配置在决策的 offendGroups 字段）
 * 2. 累积得罪分数，达到阈值触发后果
 * 3. 得罪分数每回合自然衰减
 * 4. 利益集团来源：P.offendGroups.groups（独立配置）+ GM.parties/GM.classes中带offendThresholds的条目
 */
var OffendGroupsSystem = (function() {
  /**
   * 收集所有可得罪的群体（合并独立配置 + 党派 + 阶层）
   * @returns {Array} 统一格式的群体列表 [{id, name, thresholds, source}]
   */
  function _collectAllGroups() {
    var all = [];
    // 独立offendGroups已移除，得罪机制完全由党派/阶层的offendThresholds驱动
    // 1. 党派中带offendThresholds的
    if (GM.parties) {
      GM.parties.forEach(function(p) {
        if (p.offendThresholds && p.offendThresholds.length > 0) {
          var pid = 'party_' + p.name;
          if (!all.some(function(a) { return a.id === pid; })) {
            all.push({ id: pid, name: p.name + '(党)', thresholds: p.offendThresholds, description: p.description || '', source: 'party' });
          }
        }
      });
    }
    // 3. 阶层中带offendThresholds的
    if (GM.classes) {
      GM.classes.forEach(function(c) {
        if (c.offendThresholds && c.offendThresholds.length > 0) {
          var cid = 'class_' + c.name;
          if (!all.some(function(a) { return a.id === cid; })) {
            all.push({ id: cid, name: c.name + '(阶层)', thresholds: c.offendThresholds, description: c.description || '', source: 'class' });
          }
        }
      });
    }
    return all;
  }

  /**
   * 初始化得罪群体分数
   */
  function initialize() {
    var groups = _collectAllGroups();
    if (groups.length === 0) return;

    // 初始化所有集团的得罪分数为 0
    groups.forEach(function(group) {
      if (!GM.offendGroupScores[group.id]) {
        GM.offendGroupScores[group.id] = 0;
      }
    });

    _dbg('[OffendGroups] 初始化完成，集团数量: ' + groups.length + '（独立+党派+阶层）');
  }

  /**
   * 添加得罪分数
   * @param {string} groupId - 集团ID
   * @param {number} score - 得罪分数
   * @param {string} reason - 原因描述
   */
  function addOffendScore(groupId, score, reason) {

    if (!GM.offendGroupScores[groupId]) {
      GM.offendGroupScores[groupId] = 0;
    }

    var oldScore = GM.offendGroupScores[groupId];
    GM.offendGroupScores[groupId] += score;

    _dbg('[OffendGroups] ' + groupId + ' 得罪分数: ' +
                oldScore.toFixed(1) + ' → ' + GM.offendGroupScores[groupId].toFixed(1) +
                ' (+' + score.toFixed(1) + ') [' + reason + ']');

    // 检查是否触发阈值
    checkThresholds(groupId);
  }

  /**
   * 检查阈值触发
   * @param {string} groupId - 集团ID
   */
  function checkThresholds(groupId) {
    var allGroups = _collectAllGroups();
    var group = allGroups.find(function(g) { return g.id === groupId; });
    if (!group || !group.thresholds) return;

    var currentScore = GM.offendGroupScores[groupId] || 0;

    // 检查所有阈值（从高到低）
    var triggeredThreshold = null;
    for (var i = group.thresholds.length - 1; i >= 0; i--) {
      var threshold = group.thresholds[i];
      if (currentScore >= threshold.score) {
        // 检查是否已经触发过
        var triggeredKey = groupId + '_' + threshold.score;
        if (!GM.triggeredOffendEvents) GM.triggeredOffendEvents = {};
        if (!GM.triggeredOffendEvents[triggeredKey]) {
          triggeredThreshold = threshold;
          GM.triggeredOffendEvents[triggeredKey] = true;
          break;
        }
      }
    }

    if (triggeredThreshold) {
      triggerOffendEvent(group, triggeredThreshold, currentScore);
    }
  }

  /**
   * 触发得罪事件
   * @param {Object} group - 集团对象
   * @param {Object} threshold - 阈值对象
   * @param {number} currentScore - 当前得罪分数
   */
  function triggerOffendEvent(group, threshold, currentScore) {
    _dbg('[OffendGroups] 触发得罪事件: ' + group.name + ' (分数: ' + currentScore.toFixed(1) + ', 阈值: ' + threshold.score + ')');

    // 记录到编年
    if (GM.biannianItems) {
      GM.biannianItems.unshift({ turn: GM.turn, date: typeof getTSText === 'function' ? getTSText(GM.turn) : '', title: group.name + '之怨', content: threshold.description, importance: currentScore > 80 ? 'high' : 'normal' });
    }

    // 通知AI
    if (typeof addEB === 'function') {
      addEB('群体不满', group.name + '不满已达' + currentScore.toFixed(0) + '分：' + threshold.description);
    }

    // === 机械后果执行（按严重程度递进）===
    var _ms = _getDaysPerTurn() / 30;

    // level1(score>=30): 不满——相关NPC忠诚度下降
    if (currentScore >= 30 && GM.chars) {
      GM.chars.forEach(function(c) {
        if (c.alive === false) return;
        // 匹配：NPC属于该群体（党派名/阶层名匹配group.name）
        var isRelated = (c.party && c.party === group.name) || (c.className && c.className === group.name) || (c.faction && c.faction === group.name);
        if (isRelated) {
          c.loyalty = Math.max(0, (c.loyalty || 50) - 3 * _ms);
        }
      });
    }

    // level2(score>=60): 抗议——生成奏疏进入奏议面板
    if (currentScore >= 60 && GM.memorials) {
      GM.memorials.push({
        turn: GM.turn,
        from: group.name + '代表',
        title: '〔' + group.name + '〕联名上书',
        content: threshold.description + '。望陛下体恤民意，从速施策安抚。',
        type: 'protest',
        importance: 'high'
      });
    }

    // level3(score>=90): 暴动——触发叛乱风险提醒
    if (currentScore >= 90) {
      addEB('暴动警告', group.name + '已到暴动边缘！');
    }
  }

  /**
   * 回合结束时的衰减处理
   */
  function applyDecay() {
    var decayRate = 0.05; // 月基准5%衰减
    var _ms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
    var decayCount = 0;

    for (var groupId in GM.offendGroupScores) {
      if (GM.offendGroupScores[groupId] > 0) {
        var oldScore = GM.offendGroupScores[groupId];
        GM.offendGroupScores[groupId] *= (1 - decayRate * _ms);

        // 如果分数很低，直接归零
        if (GM.offendGroupScores[groupId] < 0.1) {
          GM.offendGroupScores[groupId] = 0;
        }

        if (oldScore !== GM.offendGroupScores[groupId]) {
          _dbg('[OffendGroups] ' + groupId + ' 得罪分数衰减: ' +
                      oldScore.toFixed(1) + ' → ' + GM.offendGroupScores[groupId].toFixed(1));
          decayCount++;
        }
      }
    }

    if (decayCount > 0) {
      _dbg('[OffendGroups] 得罪分数衰减完成，影响 ' + decayCount + ' 个集团');
    }
  }

  /**
   * 获取所有集团的得罪分数
   * @returns {Object} 集团得罪分数对象
   */
  function getAllScores() {
    return GM.offendGroupScores || {};
  }

  /**
   * 获取单个集团的得罪分数
   * @param {string} groupId - 集团ID
   * @returns {number} 得罪分数
   */
  function getScore(groupId) {
    return GM.offendGroupScores[groupId] || 0;
  }

  /**
   * 重置所有得罪分数
   */
  function reset() {
    GM.offendGroupScores = {};
    GM.triggeredOffendEvents = {};
    _dbg('[OffendGroups] 已重置所有得罪分数');
  }

  /** 为AI上下文提供得罪群体数据（合并独立+党派+阶层） */
  function getContext() {
    var scores = getAllScores();
    if (!scores || Object.keys(scores).length === 0) return '';
    var allGroups = _collectAllGroups();
    var hasContent = false;
    var ctx = '【群体不满】\n';
    for (var gid in scores) {
      if (scores[gid] > 5) {
        var gName = gid;
        allGroups.forEach(function(g) { if (g.id === gid) gName = g.name; });
        ctx += '  ' + gName + '：不满' + scores[gid].toFixed(0) + '分\n';
        hasContent = true;
      }
    }
    return hasContent ? ctx : '';
  }

  return {
    initialize: initialize,
    addOffendScore: addOffendScore,
    applyDecay: applyDecay,
    getAllScores: getAllScores,
    getScore: getScore,
    getContext: getContext,
    reset: reset
  };
})();

// ============================================================
// Auto Rebound System - 自动反弹系统
// ============================================================

/**
 * 自动反弹系统
 * 重大改革引发反弹，变量快速反向变化
 *
 * 核心机制：
 * 1. 定义改革触发条件（如变量大幅变化）
 * 2. 触发后启动反弹规则，每回合反向变化
 * 3. 反弹强度逐渐衰减
 * 4. 改革定义由剧本编辑器配置
 */
var AutoReboundSystem = (function() {
  /**
   * 检查是否触发改革反弹
   * @param {Object} variableChanges - 本回合变量变化 { varName: delta }
   */
  function checkReforms(variableChanges) {
    if (!P.autoRebound || !P.autoRebound.enabled) return;

    var reforms = P.autoRebound.reforms || [];

    reforms.forEach(function(reform) {
      if (!reform.triggerConditions) return;

      var triggered = false;

      // 检查变量变化触发条件
      if (reform.triggerConditions.variableChange) {
        var condition = reform.triggerConditions.variableChange;
        var varName = condition.variable;
        var threshold = condition.threshold || 0;
        var direction = condition.direction || 'any'; // 'positive', 'negative', 'any'

        var change = variableChanges[varName] || 0;

        if (direction === 'positive' && change >= threshold) {
          triggered = true;
        } else if (direction === 'negative' && change <= -threshold) {
          triggered = true;
        } else if (direction === 'any' && Math.abs(change) >= threshold) {
          triggered = true;
        }
      }

      // 检查是否已经触发过
      var alreadyActive = GM.activeRebounds.some(function(r) { return r.reformId === reform.id; });

      if (triggered && !alreadyActive) {
        triggerRebound(reform);
      }
    });
  }

  /**
   * 触发改革反弹
   * @param {Object} reform - 改革对象
   */
  function triggerRebound(reform) {
    _dbg('[AutoRebound] 触发改革反弹: ' + reform.name);

    // 创建反弹记录
    var rebound = {
      reformId: reform.id,
      reformName: reform.name,
      startTurn: GM.turn,
      currentTurn: 0,
      rules: deepClone(reform.reboundRules || []),
      active: true
    };

    GM.activeRebounds.push(rebound);

    // 显示反弹事件弹窗
    var html = '<div style="padding:20px;">';
    html += '<h3 style="color:var(--vermillion-400);margin-top:0;">'+tmIcon('strife',16)+' 改革反弹</h3>';
    html += '<p style="font-size:14px;line-height:1.6;">' + reform.description + '</p>';

    if (reform.reboundRules && reform.reboundRules.length > 0) {
      html += '<h4 style="margin-top:15px;">反弹效果：</h4>';
      html += '<ul style="font-size:13px;line-height:1.8;">';
      reform.reboundRules.forEach(function(rule) {
        var directionText = rule.delta > 0 ? '+' : '';
        html += '<li>' + rule.variable + ' 每回合 ' + directionText + rule.delta +
                ' (持续 ' + rule.duration + ' 回合)</li>';
      });
      html += '</ul>';
    }

    html += '</div>';

    // 记录到编年
    var biannianText = '【改革反弹】' + reform.name + '：' + reform.description;
    if (GM.biannianItems) {
      GM.biannianItems.push({name: biannianText, startTurn: GM.turn, duration: 1, desc: biannianText});
    }

    // 显示弹窗
    showModal('改革反弹', html, function() {
      _dbg('[AutoRebound] 反弹事件确认');
    });
  }

  /**
   * 应用所有活跃的反弹效果
   */
  function applyRebounds() {
    if (!P.autoRebound || !P.autoRebound.enabled) return;
    if (!GM.activeRebounds || GM.activeRebounds.length === 0) return;

    var decayRate = P.autoRebound.globalDecayRate || 0.1;
    var completedRebounds = [];

    GM.activeRebounds.forEach(function(rebound, index) {
      if (!rebound.active) return;

      rebound.currentTurn++;

      _dbg('[AutoRebound] 应用反弹: ' + rebound.reformName + ' (第 ' + rebound.currentTurn + ' 回合)');

      rebound.rules.forEach(function(rule) {
        if (rebound.currentTurn > rule.duration) return;

        // 计算衰减后的变化值
        var progress = rebound.currentTurn / rule.duration;
        var decayMultiplier = 1 - (progress * decayRate * rebound.currentTurn);
        decayMultiplier = Math.max(0.1, decayMultiplier); // 最低保持 10%

        var actualDelta = rule.delta * decayMultiplier;

        // 添加到变动队列
        ChangeQueue.enqueue({
          type: 'variable',
          target: rule.variable,
          field: 'value',
          delta: actualDelta,
          description: '改革反弹: ' + rebound.reformName + ' (第' + rebound.currentTurn + '/' + rule.duration + '回合)',
          source: 'AutoReboundSystem'
        });

        _dbg('[AutoRebound] ' + rule.variable + ' 反弹变化: ' + actualDelta.toFixed(2) +
                    ' (原始: ' + rule.delta + ', 衰减: ' + (decayMultiplier * 100).toFixed(1) + '%)');
      });

      // 检查是否所有规则都已完成
      var allCompleted = rebound.rules.every(function(rule) {
        return rebound.currentTurn >= rule.duration;
      });

      if (allCompleted) {
        rebound.active = false;
        completedRebounds.push(index);
        _dbg('[AutoRebound] 反弹结束: ' + rebound.reformName);
      }
    });

    // 清理已完成的反弹
    if (completedRebounds.length > 0) {
      GM.activeRebounds = GM.activeRebounds.filter(function(r) { return r.active; });
      _dbg('[AutoRebound] 已清理 ' + completedRebounds.length + ' 个已完成的反弹');
    }
  }

  /**
   * 获取所有活跃的反弹
   * @returns {Array} 活跃反弹数组
   */
  function getActiveRebounds() {
    return GM.activeRebounds || [];
  }

  /**
   * 重置所有反弹
   */
  function reset() {
    GM.activeRebounds = [];
    _dbg('[AutoRebound] 已重置所有反弹');
  }

  /** 为AI上下文提供活跃反弹数据 */
  function getContext() {
    var rebounds = getActiveRebounds();
    if (!rebounds || rebounds.length === 0) return '';
    var ctx = '【改革反弹】\n';
    rebounds.forEach(function(r) {
      ctx += '  ' + r.reformName + '：第' + r.currentTurn + '回合反弹中';
      if (r.rules && r.rules.length > 0) {
        var effects = r.rules.map(function(rule) {
          return rule.variable + (rule.delta > 0 ? '+' : '') + rule.delta;
        });
        ctx += '（每回合' + effects.join('，') + '）';
      }
      ctx += '\n';
    });
    return ctx;
  }

  return {
    checkReforms: checkReforms,
    applyRebounds: applyRebounds,
    getActiveRebounds: getActiveRebounds,
    getContext: getContext,
    reset: reset
  };
})();

// ============================================================
// State Coupling System - 状态耦合系统
// ============================================================

/**
 * 状态耦合系统
 * 实现游戏变量之间的联动关系
 *
 * 核心功能：
 * 1. 检测变量变化
 * 2. 根据耦合规则触发联动效果
 * 3. 通过 ChangeQueue 应用联动变动
 */
var StateCouplingSystem = (function() {
  var previousValues = {}; // 上一回合的变量值

  /**
   * 初始化系统
   */
  function initialize() {
    if (!P.stateCoupling || !P.stateCoupling.enabled) {
      _dbg('[StateCoupling] 系统未启用');
      return;
    }

    // 记录当前所有变量的值
    Object.values(GM.vars).forEach(function(v) {
      previousValues[v.name] = v.value || 0;
    });

    _dbg('[StateCoupling] 系统已初始化，记录 ' + Object.keys(previousValues).length + ' 个变量');
  }

  /**
   * 检测变量变化并触发耦合
   */
  function processCouplings() {
    if (!P.stateCoupling || !P.stateCoupling.enabled) {
      return;
    }

    var config = P.stateCoupling;
    var couplings = config.couplings || [];

    if (couplings.length === 0) {
      _dbg('[StateCoupling] 无耦合规则配置');
      return;
    }

    _dbg('[StateCoupling] 开始处理 ' + couplings.length + ' 个耦合规则');
    var triggeredCount = 0;

    // 遍历所有耦合规则
    couplings.forEach(function(coupling) {
      var sourceVar = Object.values(GM.vars).find(function(v) { return v.name === coupling.source; });
      if (!sourceVar) {
        return;
      }

      var currentValue = sourceVar.value || 0;
      var previousValue = previousValues[coupling.source] || 0;
      var delta = currentValue - previousValue;

      // 检查是否满足最小影响值
      if (Math.abs(delta) < (config.minImpact || 0.1)) {
        return;
      }

      // 检查条件（如果有）
      if (coupling.condition) {
        if (!evaluateCondition(coupling.condition)) {
          return;
        }
      }

      // 计算目标变量的变动
      var impact = delta * (coupling.coefficient || 0.5);

      // 通过 ChangeQueue 应用变动
      ChangeQueue.enqueue({
        type: 'variable',
        target: coupling.target,
        delta: impact,
        description: '联动效果：' + coupling.source + ' 变化 ' + delta.toFixed(1) + ' → ' + coupling.target + ' 变化 ' + impact.toFixed(1),
        source: 'StateCoupling'
      });

      triggeredCount++;
      _dbg('[StateCoupling] 触发耦合: ' + coupling.source + ' → ' + coupling.target +
                 ' (系数: ' + coupling.coefficient + ', 影响: ' + impact.toFixed(1) + ')');
    });

    _dbg('[StateCoupling] 处理完成，触发 ' + triggeredCount + ' 个耦合效果');
  }

  /**
   * 评估条件
   */
  function evaluateCondition(condition) {
    if (!condition) return true;

    // 支持简单的变量阈值条件
    if (condition.variable && condition.operator && condition.value !== undefined) {
      var variable = Object.values(GM.vars).find(function(v) { return v.name === condition.variable; });
      if (!variable) return false;

      var value = variable.value || 0;
      switch (condition.operator) {
        case '>': return value > condition.value;
        case '>=': return value >= condition.value;
        case '<': return value < condition.value;
        case '<=': return value <= condition.value;
        case '==': return value === condition.value;
        case '!=': return value !== condition.value;
        default: return true;
      }
    }

    return true;
  }

  /**
   * 更新变量快照（在回合结束时调用）
   */
  function updateSnapshot() {
    Object.values(GM.vars).forEach(function(v) {
      previousValues[v.name] = v.value || 0;
    });
    _dbg('[StateCoupling] 已更新变量快照');
  }

  /**
   * 重置系统
   */
  function reset() {
    previousValues = {};
    _dbg('[StateCoupling] 已重置系统');
  }

  return {
    initialize: initialize,
    processCouplings: processCouplings,
    updateSnapshot: updateSnapshot,
    reset: reset
  };
})();

// ============================================================
// Vacant Position Reminder System - 空缺提醒系统
// ============================================================

/**
 * 空缺提醒系统
 * 定期检查官职空缺并提醒玩家
 *
 * 核心功能：
 * 1. 检查官制树中的空缺职位
 * 2. 按配置的间隔提醒玩家
 * 3. 显示空缺职位列表
 */
var VacantPositionReminder = (function() {
  /**
   * 检查并提醒空缺职位
   */
  function checkVacantPositions() {
    if (!P.vacantPositionReminder || !P.vacantPositionReminder.enabled) {
      return;
    }

    var config = P.vacantPositionReminder;
    var interval = config.checkInterval || 12;

    // 检查是否到达检查间隔
    if (GM.turn % interval !== 0) {
      return;
    }

    _dbg('[VacantPosition] 开始检查空缺职位 (T' + GM.turn + ')');

    // 收集所有空缺职位
    var vacantPositions = [];

    if (GM.officeTree && GM.officeTree.length > 0) {
      collectVacantPositions(GM.officeTree, vacantPositions);
    }

    if (vacantPositions.length === 0) {
      _dbg('[VacantPosition] 无空缺职位');
      return;
    }

    _dbg('[VacantPosition] 发现 ' + vacantPositions.length + ' 个空缺职位');

    // 显示提醒弹窗
    showVacantPositionModal(vacantPositions);
  }

  /**
   * 递归收集空缺职位
   */
  function collectVacantPositions(nodes, result) {
    nodes.forEach(function(node) {
      // 检查当前节点是否空缺
      if (!node.holder || node.holder === '') {
        result.push({
          name: node.name || '未命名职位',
          level: node.level || 0,
          description: node.description || ''
        });
      }

      // 递归检查子节点
      if (node.children && node.children.length > 0) {
        collectVacantPositions(node.children, result);
      }
    });
  }

  /**
   * 显示空缺职位提醒弹窗
   */
  function showVacantPositionModal(vacantPositions) {
    var config = P.vacantPositionReminder;
    var title = config.reminderTitle || '官职空缺提醒';
    var message = config.reminderMessage || '以下官职当前空缺，请考虑任命合适人选：';

    // 构建职位列表HTML
    var listHtml = '<ul style="text-align:left; max-height:300px; overflow-y:auto;">';
    vacantPositions.forEach(function(pos) {
      listHtml += '<li><strong>' + pos.name + '</strong>';
      if (pos.description) {
        listHtml += ' - ' + pos.description;
      }
      listHtml += '</li>';
    });
    listHtml += '</ul>';

    var html = '<div style="padding:20px;">' +
               '<p>' + message + '</p>' +
               listHtml +
               '<p style="margin-top:15px; color:#666;">共 ' + vacantPositions.length + ' 个空缺职位</p>' +
               '<button onclick="closeModal()" style="margin-top:15px; padding:8px 20px;">知道了</button>' +
               '</div>';

    showModal(title, html);
  }

  /**
   * 重置系统
   */
  function reset() {
    _dbg('[VacantPosition] 已重置系统');
  }

  return {
    checkVacantPositions: checkVacantPositions,
    reset: reset
  };
})();

// ============================================================
// Natural Character Death System - 自然死亡系统
// ============================================================

/**
 * 自然死亡系统
 * 根据角色年龄和健康状况判定自然死亡
 *
 * 核心功能：
 * 1. 检查所有角色的年龄
 * 2. 根据年龄阈值计算死亡率
 * 3. 健康状况影响死亡率
 * 4. 随机判定是否死亡
 */
var NaturalDeathSystem = (function() {
  /**
   * 检查并处理自然死亡
   */
  function checkNaturalDeaths() {
    if (!P.naturalDeath || !P.naturalDeath.enabled) {
      return;
    }

    _dbg('[NaturalDeath] 开始检查自然死亡 (T' + GM.turn + ')');

    var config = P.naturalDeath;
    var atRisk = [];

    // 遍历所有角色
    GM.chars.forEach(function(char) {
      if (!char || char.dead) {
        return; // 跳过已死亡角色
      }

      // 获取角色年龄
      var age = char.age || 0;
      if (age < 60) {
        return; // 60岁以下不检查自然死亡
      }

      // 计算基础死亡率
      var baseDeathRate = getBaseDeathRate(age, config.ageThresholds);
      if (baseDeathRate === 0) {
        return;
      }

      // 应用健康状况修正
      var healthStatus = char.health || 'normal';
      var healthMod = config.healthModifier[healthStatus] || 0;
      var finalDeathRate = Math.max(0, Math.min(1, baseDeathRate + healthMod));

      // 随机判定是否面临死亡风险
      var roll = random();
      if (roll < finalDeathRate) {
        atRisk.push({ name: char.name, age: char.age, reason: '年老体弱', probability: Math.round(finalDeathRate * 100) + '%' });
      }
    });

    if (atRisk.length === 0) {
      _dbg('[NaturalDeath] 无角色面临死亡风险');
      GM._deathRiskChars = [];
      return;
    }

    _dbg('[NaturalDeath] ' + atRisk.length + ' 个角色面临死亡风险，交由AI决定');

    // 存储到GM供AI上下文读取，由AI在叙事中决定谁实际死亡
    GM._deathRiskChars = atRisk;
  }

  /**
   * 获取基础死亡率
   */
  function getBaseDeathRate(age, thresholds) {
    var rate = 0;

    // 找到适用的最高阈值
    thresholds.forEach(function(threshold) {
      if (age >= threshold.age) {
        rate = threshold.deathRate;
      }
    });

    return rate;
  }

  /**
   * 处理角色死亡
   */
  function processCharacterDeath(char, reason) {
    // 标记为死亡
    char.dead = true;
    char.deathTurn = GM.turn;
    char.deathReason = reason;

    // 从官职树中移除
    if (GM.officeTree && GM.officeTree.length > 0) {
      removeFromOfficeTree(GM.officeTree, char.name);
    }

    // 记录到编年
    if (GM.biannianItems) {
      GM.biannianItems.push({
        turn: GM.turn,
        time: getTSText(GM.turn),
        type: 'death',
        content: char.name + ' ' + reason + '，享年 ' + (char.age || '未知') + ' 岁'
      });
    }

    _dbg('[NaturalDeath] ' + char.name + ' 死亡，享年 ' + (char.age || '未知') + ' 岁');
  }

  /**
   * 从官职树中移除角色
   */
  function removeFromOfficeTree(nodes, charName) {
    nodes.forEach(function(node) {
      if (node.holder === charName) {
        node.holder = '';
      }
      if (node.children && node.children.length > 0) {
        removeFromOfficeTree(node.children, charName);
      }
    });
  }

  /**
   * 显示死亡通知
   */
  function showDeathNotification(deathList) {
    var html = '<div style="padding:20px;">' +
               '<h3 style="color:var(--red); margin-bottom:15px;">讣告</h3>' +
               '<p>以下人物已去世：</p>' +
               '<ul style="text-align:left; max-height:300px; overflow-y:auto;">';

    deathList.forEach(function(death) {
      var char = death.char;
      html += '<li><strong>' + char.name + '</strong> - 享年 ' + (char.age || '未知') + ' 岁';
      if (char.position) {
        html += ' (' + char.position + ')';
      }
      html += '</li>';
    });

    html += '</ul>' +
            '<p style="margin-top:15px; color:#666;">共 ' + deathList.length + ' 人</p>' +
            '<button onclick="closeModal()" style="margin-top:15px; padding:8px 20px;">知道了</button>' +
            '</div>';

    showModal('讣告', html);
  }

  /**
   * 重置系统
   */
  function reset() {
    _dbg('[NaturalDeath] 已重置系统');
  }

  return {
    checkNaturalDeaths: checkNaturalDeaths,
    reset: reset
  };
})();

// ============================================================
// Position System - 职位模板与岗位分离系统
// ============================================================

/**
 * 职位模板与岗位分离系统
 * 借鉴晚唐风云的设计：PositionTemplate（静态）+ Post（动态坑位）
 *
 * 核心概念：
 * 1. PositionTemplate：定义职位种类的静态属性（如"刺史"、"县令"）
 * 2. Post：具体的坑位实例（如"扬州刺史"、"长安县令"），预生成
 * 3. 任命只修改 Post.holderId，不创建/删除 Post
 * 4. 品位体系：29 级文武散官，贤能积累自动晋升
 */
var PositionSystem = (function() {
  /**
   * 初始化职位系统
   */
  function initialize() {
    if (!P.positionSystem || !P.positionSystem.enabled) {
      return;
    }

    _dbg('[PositionSystem] 初始化职位系统');

    // 初始化所有角色的品位和贤能
    GM.chars.forEach(function(char) {
      if (!char.rankLevel) {
        char.rankLevel = P.positionSystem.defaultRankLevel || 1;
      }
      if (!char.prestige) {
        char.prestige = 0;
      }
      if (!char.posts) {
        char.posts = [];
      }
    });

    _dbg('[PositionSystem] 初始化完成');
  }

  /**
   * 获取角色的品位名称
   */
  function getRankName(character) {
    var rankLevel = character.rankLevel || 1;
    var rank = P.positionSystem.ranks.find(function(r) {
      return r.level === rankLevel;
    });
    return rank ? rank.name : '无品';
  }

  /**
   * 检查角色是否可以晋升品位
   */
  function checkRankPromotion(character) {
    if (!P.positionSystem || !P.positionSystem.enabled) {
      return false;
    }

    var currentRankLevel = character.rankLevel || 1;
    var prestige = character.prestige || 0;

    // 查找下一个品位
    var nextRank = P.positionSystem.ranks.find(function(r) {
      return r.level === currentRankLevel + 1;
    });

    if (!nextRank) {
      return false; // 已达最高品位
    }

    // 检查是否满足晋升条件
    if (prestige >= nextRank.prestigeRequired) {
      return true;
    }

    return false;
  }

  /**
   * 晋升角色品位
   */
  function promoteRank(character) {
    if (!checkRankPromotion(character)) {
      return false;
    }

    var oldRankLevel = character.rankLevel || 1;
    character.rankLevel = oldRankLevel + 1;

    var newRankName = getRankName(character);
    _dbg('[PositionSystem] ' + character.name + ' 晋升品位: ' + newRankName);

    return true;
  }

  /**
   * 每回合更新贤能积分
   */
  function updatePrestige() {
    if (!P.positionSystem || !P.positionSystem.enabled) {
      return;
    }

    var _ms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
    var gainPerTurn = (P.positionSystem.prestigeGainPerTurn || 2) * _ms;

    GM.chars.forEach(function(char) {
      if (char.dead) {
        return;
      }

      // 增加贤能积分（月基准，按天数缩放）
      char.prestige = (char.prestige || 0) + gainPerTurn;

      // 检查是否可以晋升
      while (checkRankPromotion(char)) {
        promoteRank(char);
      }
    });

    _dbg('[PositionSystem] 贤能积分更新完成');
  }

  /**
   * 任命角色到岗位
   */
  function appointToPost(characterId, postId) {
    if (!P.positionSystem || !P.positionSystem.enabled) {
      return false;
    }

    var character = GM.chars.find(function(c) { return c.id === characterId; });
    var post = P.positionSystem.posts.find(function(p) { return p.id === postId; });

    if (!character || !post) {
      console.error('[PositionSystem] 任命失败：角色或岗位不存在');
      return false;
    }

    // 检查品位要求
    var template = P.positionSystem.templates.find(function(t) {
      return t.id === post.templateId;
    });

    if (template && template.minRankLevel) {
      if (character.rankLevel < template.minRankLevel) {
        console.error('[PositionSystem] 任命失败：品位不足');
        return false;
      }
    }

    // 罢免原任职者
    if (post.holderId) {
      var oldHolder = GM.chars.find(function(c) { return c.id === post.holderId; });
      if (oldHolder && oldHolder.posts) {
        oldHolder.posts = oldHolder.posts.filter(function(p) { return p !== postId; });
      }
    }

    // 任命新任职者
    post.holderId = characterId;
    post.appointedTurn = GM.turn;
    post.status = 'occupied';

    if (!character.posts) {
      character.posts = [];
    }
    character.posts.push(postId);

    _dbg('[PositionSystem] 任命成功: ' + character.name + ' → ' + post.id);
    return true;
  }

  /**
   * 罢免角色的岗位
   */
  function dismissFromPost(postId) {
    if (!P.positionSystem || !P.positionSystem.enabled) {
      return false;
    }

    var post = P.positionSystem.posts.find(function(p) { return p.id === postId; });
    if (!post || !post.holderId) {
      return false;
    }

    var character = GM.chars.find(function(c) { return c.id === post.holderId; });
    if (character && character.posts) {
      character.posts = character.posts.filter(function(p) { return p !== postId; });
    }

    post.holderId = null;
    post.status = 'vacant';

    _dbg('[PositionSystem] 罢免成功: ' + postId);
    return true;
  }

  /**
   * 重置系统
   */
  function reset() {
    _dbg('[PositionSystem] 已重置系统');
  }

  return {
    initialize: initialize,
    getRankName: getRankName,
    checkRankPromotion: checkRankPromotion,
    promoteRank: promoteRank,
    updatePrestige: updatePrestige,
    appointToPost: appointToPost,
    dismissFromPost: dismissFromPost,
    reset: reset
  };
})();

// ============================================================
// 正统性系统（借鉴晚唐风云 legitimacyCalc）
// 适配天命全朝代：从 P 配置读取而非硬编码
// ============================================================
// 4.4改造：LegitimacySystem——信息注入模式，不直接修改数值
// 正统性/合法性的来源和规则完全由编辑器配置(P.mechanicsConfig.characterRules.legitimacyConfig)
// 不硬编码品级公式——部落勇士的legitimacy来源可能是军功而非品级
var LegitimacySystem = {
  /** 正统性差值→好感影响（保留，供OpinionSystem引用） */
  calcGapOpinion: function(legitimacy, expectedLegitimacy) {
    var d = (legitimacy||50) - (expectedLegitimacy||50);
    if (d >= 10) return 10;
    if (d >= 0) return 0;
    if (d >= -10) return -5;
    if (d >= -20) return -15;
    if (d >= -30) return -30;
    return -50;
  },

  /** 分析正统性状况（信息注入，不修改数值） */
  analyze: function() {
    if (!GM.chars) return;
    var alerts = [];
    var lcfg = (P.mechanicsConfig && P.mechanicsConfig.characterRules && P.mechanicsConfig.characterRules.legitimacyConfig) || {};
    var rules = lcfg.rules || [];

    GM.chars.forEach(function(ch) {
      if (ch.alive === false) return;
      if (ch.legitimacy === undefined) ch.legitimacy = 50;
      // 从编辑器配置的规则评估正统性状况
      var factors = [];
      rules.forEach(function(rule) {
        try {
          if (new Function('char','GM','return ' + rule.condition)(ch, GM)) {
            factors.push(rule.label || rule.condition);
          }
        } catch(e) {}
      });
      // 君主/领袖的正统性状况注入AI参考
      if ((ch.isPlayer || ch.isRuler) && (ch.legitimacy < 30 || factors.length > 0)) {
        var desc = ch.name + '\u6B63\u7EDF\u6027' + Math.round(ch.legitimacy);
        if (factors.length > 0) desc += '(\u56E0\u7D20:' + factors.join(',') + ')';
        if (ch.legitimacy < 30) desc += ' \u26A0\u6B63\u7EDF\u6027\u4E25\u91CD\u4E0D\u8DB3';
        alerts.push(desc);
      }
    });
    GM._legitimacyAlerts = alerts;
  }
};

// 注册到结算流水线
SettlementPipeline.register('legitimacy', '\u6B63\u7EDF\u6027\u5206\u6790', function() { LegitimacySystem.analyze(); }, 21, 'perturn');

// ============================================================
// 压力系统（轻量级，CK3启发）
// 角色的 stressOn/stressOff 特质影响压力值，压力影响 AI 叙事和决策
// ============================================================
var StressSystem = {
  /**
   * 检查事件是否触发角色压力变化
   * @param {Object} char - 角色
   * @param {string} action - 发生的行为（如"处决""赦免""征战"）
   * @param {number} [magnitude=1] - 强度倍率
   */
  checkStress: function(char, action, magnitude) {
    if (!char || !char.traitIds || !P.traitDefinitions) return 0;
    if (!char.stress && char.stress !== 0) char.stress = 0;
    var delta = 0;
    magnitude = magnitude || 1;

    char.traitIds.forEach(function(tid) {
      var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
      if (!def) return;
      // stressOn: 这类行为让角色痛苦
      if (def.stressOn) {
        def.stressOn.forEach(function(trigger) {
          if (action.indexOf(trigger) >= 0) delta += 5 * magnitude;
        });
      }
      // stressOff: 这类行为让角色舒适
      if (def.stressOff) {
        def.stressOff.forEach(function(trigger) {
          if (action.indexOf(trigger) >= 0) delta -= 3 * magnitude;
        });
      }
    });

    if (delta !== 0) {
      char.stress = clamp((char.stress || 0) + delta, 0, 100);
      _dbg('[Stress] ' + char.name + ': ' + (delta > 0 ? '+' : '') + delta + ' → ' + char.stress);
    }
    return delta;
  },

  /** 月度压力自然恢复（-2/月，除非超高压力） */
  monthlyDecay: function() {
    if (!GM.chars) return;
    var _ms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;
    GM.chars.forEach(function(c) {
      if (c.alive === false || !c.stress) return;
      if (c.stress > 50) {
        c.stress = Math.min(100, c.stress + 1 * _ms);
      } else if (c.stress > 0) {
        c.stress = Math.max(0, c.stress - 2 * _ms);
      }
    });
  },

  /**
   * 获取角色压力描述（供AI prompt）
   * @param {Object} char
   * @returns {string} 压力描述
   */
  getStressLabel: function(char) {
    var s = (char && char.stress) || 0;
    if (s >= 80) return '精神崩溃';
    if (s >= 60) return '焦虑难安';
    if (s >= 40) return '忧心忡忡';
    if (s >= 20) return '略有烦忧';
    return '心态平和';
  },

  /**
   * 获取高压力角色列表（供AI叙事参考）
   * @returns {string} 格式化的压力报告
   */
  getStressContext: function() {
    if (!GM.chars) return '';
    var stressed = GM.chars.filter(function(c) { return c.alive !== false && (c.stress || 0) >= 40; });
    if (stressed.length === 0) return '';
    var ctx = '【角色压力】\n';
    stressed.forEach(function(c) {
      ctx += '  ' + c.name + '：' + StressSystem.getStressLabel(c) + '(' + c.stress + ')';
      // 提示AI什么行为能缓解
      if (c.traitIds && P.traitDefinitions) {
        var relievers = [];
        c.traitIds.forEach(function(tid) {
          var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
          if (def && def.stressOff) relievers = relievers.concat(def.stressOff);
        });
        if (relievers.length) ctx += ' 可缓解:' + relievers.slice(0, 3).join('/');
      }
      ctx += '\n';
    });
    return ctx;
  }
};

// 注册月度压力衰减
SettlementPipeline.register('stressDecay', '压力衰减', function() { StressSystem.monthlyDecay(); }, 24, 'monthly');

// ============================================================
// 个人目标满足度系统 — GoalSatisfactionSystem
// 每回合根据目标类型检查条件，更新 _goalSatisfaction
// ============================================================
var GoalSatisfactionSystem = {
  /** 目标类型关键词→goalType映射 */
  _inferType: function(goal) {
    if (!goal) return 'survival';
    var g = goal.toLowerCase ? goal.toLowerCase() : goal;
    if (/权|位|宰|相|帝|王|升/.test(g)) return 'power';
    if (/富|财|钱|金|库/.test(g)) return 'wealth';
    if (/仇|敌|报|诛|杀/.test(g)) return 'revenge';
    if (/改|革|制|法|新/.test(g)) return 'reform';
    if (/忠|君|效|护/.test(g)) return 'loyalty';
    if (/活|命|保|全|避/.test(g)) return 'survival';
    if (/名|史|传|世|青/.test(g)) return 'legacy';
    if (/乐|享|酒|色/.test(g)) return 'hedonism';
    return 'survival';
  },

  /** 每回合更新所有NPC的目标满足度 */
  update: function() {
    if (!GM.chars) return;
    var _ms = _getDaysPerTurn() / 30;
    GM.chars.forEach(function(c) {
      if (c.alive === false || c.isPlayer) return;
      if (!c.personalGoal) { c._goalSatisfaction = 50; return; }

      var type = c._goalType || (c._goalType = GoalSatisfactionSystem._inferType(c.personalGoal));
      var sat = c._goalSatisfaction !== undefined ? c._goalSatisfaction : 50;

      // 根据类型评估满足度变化（月基准）
      var delta = 0;
      if (type === 'power') {
        delta = (c.title || c.officialTitle) ? 1 : -1;
        if ((c.ambition || 50) > 70 && !c.title) delta -= 1;
      } else if (type === 'wealth') {
        delta = (GM.stateTreasury || 0) > 0 ? 0.5 : -1;
      } else if (type === 'loyalty') {
        delta = (GM.eraState && GM.eraState.socialStability > 0.6) ? 1 : -0.5;
      } else if (type === 'reform') {
        delta = (GM.eraState && GM.eraState.bureaucracyStrength > 0.6) ? 1 : -0.5;
      } else if (type === 'survival') {
        delta = (GM.eraState && GM.eraState.socialStability > 0.6) ? 0.5 : -1;
      } else if (type === 'legacy') {
        delta = (GM.eraState && GM.eraState.culturalVibrancy > 0.7) ? 1 : 0;
      } else {
        delta = 0;
      }

      sat = Math.max(0, Math.min(100, sat + delta * _ms));
      c._goalSatisfaction = sat;

      // 满足度极低→压力增加+不满行为
      if (sat < 20 && c.stress !== undefined) {
        c.stress = Math.min(100, (c.stress || 0) + 1 * _ms);
      }
      // 满足度极低+野心高→可能叛变提示
      if (sat < 10 && (c.ambition || 50) > 75 && !c._goalFrustrationLogged) {
        if (typeof addEB === 'function') addEB('人心', c.name + '志愿不遂，心怀异志');
        c._goalFrustrationLogged = GM.turn;
      }
    });
  }
};

// 注册目标满足度到结算流水线
SettlementPipeline.register('goalSatisfaction', '目标满足度', function() { GoalSatisfactionSystem.update(); }, 26, 'monthly');

// ============================================================
// 压力-特质挂钩系统 — StressTraitSystem
// 决策违背特质→压力增加，高压力→后果
// ============================================================
var StressTraitSystem = {
  /**
   * 检查某个行为是否违背角色特质（在AI应用变更后调用）
   * @param {Object} char - 角色
   * @param {string} actionType - 行为类型(punish/reward/declare_war/betray/mercy等)
   * @returns {number} 压力变化值（正=增加，负=释放）
   */
  evaluateStress: function(char, actionType) {
    if (!char || !char.traitIds || !P.traitDefinitions) return 0;
    var total = 0;

    char.traitIds.forEach(function(tid) {
      var def = P.traitDefinitions.find(function(t) { return t.id === tid; });
      if (!def) return;

      // stressOn: 做这些事会增加压力
      if (def.stressOn && def.stressOn.indexOf(actionType) >= 0) {
        total += 8; // 违背性格
      }
      // stressOff: 做这些事会释放压力
      if (def.stressOff && def.stressOff.indexOf(actionType) >= 0) {
        total -= 5; // 符合性格
      }
    });

    return total;
  },

  /**
   * 检查高压力后果（每回合调用）
   */
  checkHighStress: function() {
    if (!GM.chars) return;
    var _ms = _getDaysPerTurn() / 30;

    GM.chars.forEach(function(c) {
      if (c.alive === false || !c.stress) return;

      // 压力>70：行为失控风险
      if (c.stress > 70 && !c._stressOutburstTurn) {
        // 根据特质决定失控类型
        var dims = typeof _aggregatePersonalityDims === 'function' ? _aggregatePersonalityDims(c) : {};
        if (dims.vengefulness > 0.2) {
          if (typeof addEB === 'function') addEB('失控', c.name + '压力过大，可能做出报复性行为');
        } else if (dims.greed > 0.2) {
          if (typeof addEB === 'function') addEB('失控', c.name + '压力过大，可能贪墨舞弊');
        } else {
          if (typeof addEB === 'function') addEB('失控', c.name + '压力过大，精神状态堪忧');
        }
        c._stressOutburstTurn = GM.turn;
      }

      // 压力>90：精神崩溃
      if (c.stress > 90 && !c._breakdownTurn) {
        c._breakdownTurn = GM.turn;
        // 崩溃效果：忠诚骤降
        c.loyalty = Math.max(0, (c.loyalty || 50) - 15);
        if (typeof addEB === 'function') addEB('崩溃', c.name + '精神崩溃！忠诚度骤降');
        if (GM.qijuHistory) {
          GM.qijuHistory.unshift({
            turn: GM.turn,
            date: typeof getTSText === 'function' ? getTSText(GM.turn) : '',
            content: '【精神崩溃】' + c.name + '因压力过大精神崩溃，朝中震动。'
          });
        }
      }

      // 重置失控标记（间隔10回合）
      if (c._stressOutburstTurn && GM.turn - c._stressOutburstTurn > 10) {
        c._stressOutburstTurn = null;
      }
    });
  }
};

// 注册压力-特质检查到结算流水线
SettlementPipeline.register('stressTrait', '压力特质', function() { StressTraitSystem.checkHighStress(); }, 25, 'monthly');

// ============================================================
// NPC 记忆系统 — 每个角色有自己的主观记忆
// ============================================================
var NpcMemorySystem = {
  /**
   * 获取角色的动态记忆容量（根据品位/身份/互动量分级）
   * @param {Object} ch - 角色对象
   * @returns {{active:number, archive:number, scars:number}}
   */
  getCapacity: function(ch) {
    if (!ch) return { active: 15, archive: 8, scars: 8 };

    // 模型上下文倍率（大模型=更多记忆容量）
    var modelScale = 1.0;
    if (typeof getCompressionParams === 'function') {
      var cp = getCompressionParams();
      modelScale = Math.max(0.6, Math.min(cp.scale, 2.5)); // 0.6~2.5
    }

    // 基础容量（所有人都有）
    var active = 20, archive = 12, scars = 10;

    // ── 身份加成 ──
    // 玩家角色
    if (ch.isPlayer) { active = 80; archive = 40; scars = 30; }
    // 后妃
    else if (ch.spouse) { active = 70; archive = 35; scars = 25; }
    else {
      // 官职品位加成
      var rank = 0;
      if (ch.officialTitle || ch.title) {
        var t = (ch.officialTitle || ch.title || '');
        if (/宰相|丞相|太师|太傅|太保|大将军|一品|摄政/.test(t)) rank = 5;
        else if (/尚书|节度使|枢密|中书|门下|二品|都督/.test(t)) rank = 4;
        else if (/侍郎|刺史|知府|三品|四品|将军|转运使/.test(t)) rank = 3;
        else if (/郎中|参军|员外|御史|五品|六品|县令/.test(t)) rank = 2;
        else if (t.length > 0) rank = 1;
      }
      active += rank * 8;   // 一品+40, 五六品+16, 无品+0
      archive += rank * 4;  // 一品+20
      scars += rank * 3;    // 一品+15

      // 势力首领额外
      if (GM.facs) {
        var isLeader = GM.facs.some(function(f) { return f.leader === ch.name; });
        if (isLeader) { active += 15; archive += 8; scars += 6; }
      }
    }

    // ── 互动加成（与玩家互动越多，记忆越丰富）──
    // D11: 使用GM._charInteractionCount缓存，每回合只计算一次
    var interactionBonus = 0;
    if (!GM._charInteractionCount || GM._charInteractionCountTurn !== GM.turn) {
      // 重建缓存
      GM._charInteractionCount = {};
      GM._charInteractionCountTurn = GM.turn;
      // 统计问对次数
      if (GM.wenduiHistory) {
        for (var _wk in GM.wenduiHistory) {
          GM._charInteractionCount[_wk] = (GM._charInteractionCount[_wk] || 0) + Math.min(20, (GM.wenduiHistory[_wk]||[]).length * 2);
        }
      }
      // 统计朝议参与
      if (GM._courtRecords) {
        GM._courtRecords.forEach(function(cr) {
          if (cr.stances) {
            for (var _cn in cr.stances) { GM._charInteractionCount[_cn] = (GM._charInteractionCount[_cn] || 0) + 4; }
          }
        });
      }
      // 统计纪事出现
      if (GM.jishiRecords) {
        var _jCounts = {};
        GM.jishiRecords.forEach(function(r) { if (r.char) _jCounts[r.char] = (_jCounts[r.char] || 0) + 1; });
        for (var _jk in _jCounts) { GM._charInteractionCount[_jk] = (GM._charInteractionCount[_jk] || 0) + Math.min(10, _jCounts[_jk]); }
      }
    }
    interactionBonus = GM._charInteractionCount[ch.name] || 0;
    active += interactionBonus;
    archive += Math.floor(interactionBonus / 2);

    // ── 模型倍率（大模型能处理更多记忆）──
    active = Math.round(active * modelScale);
    archive = Math.round(archive * modelScale);
    scars = Math.round(scars * modelScale);

    return {
      active: Math.max(10, Math.min(active, 200)),   // 绝对范围10~200
      archive: Math.max(5, Math.min(archive, 80)),    // 绝对范围5~80
      scars: Math.max(5, Math.min(scars, 50))         // 绝对范围5~50
    };
  },

  /**
   * 记录NPC个人记忆
   * @param {string} charName
   * @param {string} event - 事件描述
   * @param {string} emotion - 喜/怒/忧/惧/恨/敬/平
   * @param {number} [importance=5] - 1-10
   * @param {string} [relatedPerson] - 相关人物
   */
  remember: function(charName, event, emotion, importance, relatedPerson) {
    if (!GM.chars) return;
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    if (!ch || ch.alive === false) return;
    if (!ch._memory) ch._memory = [];
    if (!ch._memArchive) ch._memArchive = [];

    // 4.4: 结构化记忆类型推断
    var memType = 'general';
    if (/背叛|叛|反|谋|阴谋/.test(event)) memType = 'betrayal';
    else if (/恩|救|助|赏|赐|提拔|擢升/.test(event)) memType = 'kindness';
    else if (/辱|羞|贬|斥|罢/.test(event)) memType = 'humiliation';
    else if (/升|任|封|授|入仕|及第/.test(event)) memType = 'promotion';
    else if (/亡|死|丧|失|败/.test(event)) memType = 'loss';
    else if (/婚|嫁|娶|联姻/.test(event)) memType = 'marriage';
    else if (/战|征|伐|胜|败/.test(event)) memType = 'military';
    else if (/问对|谈|说|议/.test(event)) memType = 'dialogue';

    ch._memory.push({
      event: event,
      emotion: emotion || '平',
      importance: Math.max(0.1, Math.min(10, importance || 5)),
      turn: GM.turn,
      who: relatedPerson || '',
      type: memType  // 4.4: 结构化类型
    });

    // 更新情绪状态（最近3条记忆的主导情绪）
    NpcMemorySystem._updateMood(ch);
    // 6.2: 写入后清除该角色的记忆缓存
    if (NpcMemorySystem._memCache && NpcMemorySystem._memCache[charName]) delete NpcMemorySystem._memCache[charName];

    // 超过动态上限→压缩旧记忆
    var _cap = NpcMemorySystem.getCapacity(ch);
    if (ch._memory.length > _cap.active) {
      // 4.4: 记忆衰减——每回合只衰减一次，衰减量按回合时间缩放
      if (ch._lastDecayTurn !== GM.turn) {
        ch._lastDecayTurn = GM.turn;
        // 月基准衰减率 × 回合月数（1天≈0.033月，1季≈3月，1年≈12月）
        var _monthScale = (typeof getTimeRatio === 'function') ? getTimeRatio() * 12 : 1;
        ch._memory.forEach(function(m) {
          if (m.turn >= GM.turn) return;
          var baseRate = (m.emotion === '\u6012' || m.emotion === '\u6068') ? 0.02 : 0.05;
          m.importance = Math.max(0.1, Math.min(10, (m.importance || 5) - baseRate * _monthScale));
        });
      }
      NpcMemorySystem._compressMemory(ch, _cap);
    }

    // 更新对相关人物的印象（importance加权——重大事件影响更深）
    if (relatedPerson && relatedPerson !== charName) {
      if (!ch._impressions) ch._impressions = {};
      if (!ch._impressions[relatedPerson]) ch._impressions[relatedPerson] = { favor: 0, events: [] };
      var imp = ch._impressions[relatedPerson];
      var impWeight = Math.max(1, Math.min(importance || 5, 10)) / 5; // 1->0.2, 5->1.0, 10->2.0
      var baseDelta = emotion === '喜' || emotion === '敬' ? 3 : emotion === '怒' || emotion === '恨' ? -4 : emotion === '忧' || emotion === '惧' ? -1 : 0;
      var delta = Math.round(baseDelta * impWeight);
      imp.favor = Math.max(-100, Math.min(100, imp.favor + delta));
      imp.events.push(event.slice(0, 25));
      if (imp.events.length > 8) imp.events = imp.events.slice(-8);
    }
  },

  /**
   * 简化版记忆写入（适配新系统的addMemory调用）
   * @param {string} charName
   * @param {string} event - 事件描述
   * @param {number} importance - 1-10
   * @param {string} [category] - 类别标签（career/scheme/political等，用于事件前缀）
   */
  addMemory: function(charName, event, importance, category) {
    // 根据事件内容和重要性推断情绪
    var emotion = '平';
    if (/嘉许|优等|擢升|成功|得逞|入仕|继位|登基|喜|大捷|胜/.test(event)) emotion = '喜';
    else if (/败露|劣等|受害|名裂|驾崩|阴谋|失败/.test(event)) emotion = '忧';
    else if (/识破|不安|忧惧|左迁|贬/.test(event)) emotion = '惧';
    // 委托给remember
    this.remember(charName, event, emotion, importance || 5);
    // 6.2: 写入后使该角色的缓存失效
    if (this._memCache && this._memCache[charName]) delete this._memCache[charName];
  },

  /** 更新角色当前情绪状态（基于近期记忆的主导情绪） */
  _updateMood: function(ch) {
    if (!ch._memory || ch._memory.length === 0) { ch._mood = '平'; return; }
    var recent = ch._memory.slice(-3);
    var counts = {};
    recent.forEach(function(m) { counts[m.emotion] = (counts[m.emotion] || 0) + m.importance; });
    var dominant = '平', maxW = 0;
    for (var e in counts) { if (counts[e] > maxW) { maxW = counts[e]; dominant = e; } }
    ch._mood = dominant;
  },

  /**
   * 压缩旧记忆——保留关键事件，提炼摘要，高importance变为"伤疤/勋章"
   */
  _compressMemory: function(ch, cap) {
    if (!cap) cap = NpcMemorySystem.getCapacity(ch);
    var half = Math.floor(ch._memory.length / 2);
    var old = ch._memory.slice(0, half);
    ch._memory = ch._memory.slice(half);

    // 高importance的记忆（>=7）不进入摘要，而是变成永久"伤疤/勋章"
    if (!ch._scars) ch._scars = [];
    var remaining = [];
    old.forEach(function(m) {
      if (m.importance >= 7) {
        ch._scars.push({ event: m.event.slice(0, 40), emotion: m.emotion, turn: m.turn, who: m.who || '' });
        if (ch._scars.length > cap.scars) ch._scars.shift();
      } else {
        remaining.push(m);
      }
    });

    // 剩余记忆：按importance排序，保留最重要的事件全文，其余按情绪分组
    if (remaining.length > 0) {
      // 分离：importance>=5的保留详细，<5的压缩
      var importantOnes = remaining.filter(function(m) { return (m.importance || 0) >= 5; });
      var trivialOnes = remaining.filter(function(m) { return (m.importance || 0) < 5; });

      var summaryParts = [];
      // 重要事件保留较长描述
      if (importantOnes.length > 0) {
        summaryParts.push(importantOnes.map(function(m) {
          return m.event.slice(0, 30) + (m.who ? '(' + m.who + ')' : '') + '[' + m.emotion + ']';
        }).join('；'));
      }
      // 琐碎事件按情绪分组压缩
      if (trivialOnes.length > 0) {
        var emotionGroups = {};
        trivialOnes.forEach(function(m) {
          if (!emotionGroups[m.emotion]) emotionGroups[m.emotion] = [];
          emotionGroups[m.emotion].push(m.event.slice(0, 15));
        });
        for (var emo in emotionGroups) {
          summaryParts.push('(' + emo + ')' + emotionGroups[emo].join('、'));
        }
      }
      var turnRange = remaining[0].turn + '-' + remaining[remaining.length - 1].turn;

      if (!ch._memArchive) ch._memArchive = [];
      ch._memArchive.push({
        period: turnRange,
        summary: summaryParts.join('。'),
        count: remaining.length,
        keyEvents: importantOnes.length
      });
      if (ch._memArchive.length > cap.archive) {
        ch._memArchive = ch._memArchive.slice(-cap.archive);
      }
    }
    _dbg('[NpcMem] ' + ch.name + ' 记忆压缩：' + old.length + '条→归档+' + (ch._scars||[]).length + '伤疤');
  },

  /** 获取角色的记忆摘要（供AI使用——像一个人的内心自述）6.2: 带每回合缓存 */
  _memCache: {}, _memCacheTurn: -1,
  getMemoryContext: function(charName) {
    // 6.2: 每回合缓存——同一回合内同一角色只构建一次
    if (this._memCacheTurn !== GM.turn) { this._memCache = {}; this._memCacheTurn = GM.turn; }
    if (this._memCache[charName]) return this._memCache[charName];
    if (!GM.chars) return '';
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    if (!ch) return '';
    var parts = [];

    // 角色自我认识（字/家族/仕途/心事等，AI 据此保持身份一致）
    if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.toAIContext === 'function') {
      var selfCtx = CharFullSchema.toAIContext(ch);
      if (selfCtx) parts.push(selfCtx);
    }
    // 角色所知天下大势——货币/央地财政/户口/环境/诏令（精要）
    if (typeof CurrencyEngine !== 'undefined' && typeof CurrencyEngine.getAIContext === 'function') {
      try { var cc = CurrencyEngine.getAIContext(); if (cc) parts.push(cc); } catch(e) {}
    }
    if (typeof CentralLocalEngine !== 'undefined' && typeof CentralLocalEngine.getAIContext === 'function') {
      try { var cl = CentralLocalEngine.getAIContext(); if (cl) parts.push(cl); } catch(e) {}
    }
    if (typeof HujiEngine !== 'undefined' && typeof HujiEngine.getAIContext === 'function') {
      try { var hj = HujiEngine.getAIContext(); if (hj) parts.push(hj); } catch(e) {}
    }
    if (typeof HujiDeepFill !== 'undefined' && typeof HujiDeepFill.getExtendedAIContext === 'function') {
      try { var hjd = HujiDeepFill.getExtendedAIContext(); if (hjd) parts.push(hjd); } catch(e) {}
    }
    if (typeof EnvCapacityEngine !== 'undefined' && typeof EnvCapacityEngine.getAIContext === 'function') {
      try { var env = EnvCapacityEngine.getAIContext(); if (env) parts.push(env); } catch(e) {}
    }
    if (typeof EdictParser !== 'undefined' && typeof EdictParser.getAIContext === 'function') {
      try { var ep = EdictParser.getAIContext(); if (ep) parts.push(ep); } catch(e) {}
    }
    if (typeof AuthorityEngines !== 'undefined' && typeof AuthorityEngines.getAuthorityAIContext === 'function') {
      try { var auth = AuthorityEngines.getAuthorityAIContext(); if (auth) parts.push(auth); } catch(e) {}
    }
    if (typeof AuthorityComplete !== 'undefined' && typeof AuthorityComplete.getExtendedAIContext === 'function') {
      try { var authc = AuthorityComplete.getExtendedAIContext(); if (authc) parts.push(authc); } catch(e) {}
    }
    if (typeof HistoricalPresets !== 'undefined' && typeof HistoricalPresets.getAIContext === 'function') {
      try { var hp = HistoricalPresets.getAIContext(); if (hp) parts.push(hp); } catch(e) {}
    }

    // 人生阶段感（基于年龄和经历量）
    if (ch.age) {
      var memCount = (ch._memory || []).length + (ch._memArchive || []).length;
      if (ch.age < 25) parts.push(memCount > 10 ? '年少历多' : '年少气盛');
      else if (ch.age < 35) parts.push('正值壮年');
      else if (ch.age < 50) parts.push(memCount > 15 ? '饱经风霜' : '阅历渐丰');
      else if (ch.age < 65) parts.push('老成持重');
      else parts.push('垂暮之年');
    }

    // 当前情绪（更细腻的表达，叠加压力修正）
    if (ch._mood && ch._mood !== '平') {
      var moodLabels = { '喜': '心中暗喜', '怒': '满腔怒火难平', '忧': '眉头紧锁', '惧': '心中忐忑', '恨': '怨恨难消', '敬': '心怀感念' };
      var ml = moodLabels[ch._mood] || ch._mood;
      if ((ch.stress || 0) > 60) ml += '且压力沉重';
      parts.push(ml);
    } else if ((ch.stress || 0) > 60) {
      parts.push('压力沉重，精神疲惫');
    }

    // 性格沉淀——从归档记忆中提取此人的"人生底色"
    if (ch._memArchive && ch._memArchive.length > 0) {
      // 统计归档中各情绪出现比例→推断人生底色
      var emoCount = { '喜': 0, '怒': 0, '忧': 0, '惧': 0, '恨': 0, '敬': 0 };
      ch._memArchive.forEach(function(a) {
        var s = a.summary || '';
        if (s.indexOf('喜') >= 0) emoCount['喜']++;
        if (s.indexOf('怒') >= 0) emoCount['怒']++;
        if (s.indexOf('忧') >= 0) emoCount['忧']++;
        if (s.indexOf('恨') >= 0) emoCount['恨']++;
        if (s.indexOf('敬') >= 0) emoCount['敬']++;
      });
      var dominant = Object.keys(emoCount).reduce(function(a, b) { return emoCount[a] >= emoCount[b] ? a : b; });
      if (emoCount[dominant] >= 2) {
        var sediment = { '喜': '一生多逢好事，心态乐观', '怒': '一生多遭不平，性格暴躁', '忧': '一生多经忧患，性格沉郁', '恨': '一生多遭背叛，心怀戒备', '敬': '一生多遇贵人，知恩图报' };
        parts.push(sediment[dominant] || '');
      }
      // 最近一段归档
      parts.push('往事：' + ch._memArchive[ch._memArchive.length - 1].summary.slice(0, 80));
    }

    // 4.4: 近期记忆（按重要性前4，结构化格式含类型和重要度）
    if (ch._memory && ch._memory.length > 0) {
      var sorted = ch._memory.slice().sort(function(a, b) { return b.importance - a.importance; });
      var top = sorted.slice(0, 4);
      var memIdx = 0;
      var circled = ['①','②','③','④','⑤','⑥','⑦','⑧'];
      parts.push('铭记：' + top.map(function(m) {
        var label = circled[memIdx++] || (memIdx + '.');
        var mType = m.type || 'general';
        var imp = Math.round(m.importance) || 5;
        return label + 'T' + (m.turn || GM.turn) + ' 类型:' + mType + ' ' + m.event + (m.who ? '(' + m.who + ')' : '') + '(' + (m.emotion || '平') + ',重' + imp + ')';
      }).join(' '));
    }

    // 对人的感情（更丰富的关系描述，含原因）
    if (ch._impressions) {
      var impParts = [];
      for (var pName in ch._impressions) {
        var imp = ch._impressions[pName];
        if (Math.abs(imp.favor) >= 5) {
          var rel = imp.favor >= 30 ? '感恩戴德' : imp.favor >= 15 ? '视为恩人' : imp.favor >= 5 ? '颇有好感' : imp.favor <= -30 ? '不共戴天' : imp.favor <= -15 ? '恨之入骨' : imp.favor <= -5 ? '心存芥蒂' : '';
          if (rel) {
            var reason = (imp.events && imp.events.length > 0) ? imp.events[imp.events.length - 1] : '';
            impParts.push('对' + pName + rel + (reason ? '(因' + reason.slice(0, 12) + ')' : ''));
          }
        }
      }
      if (impParts.length > 0) parts.push(impParts.slice(0, 5).join('，'));
    }

    // 永久伤疤/勋章（一生中最刻骨铭心的经历，永远影响此人）
    if (ch._scars && ch._scars.length > 0) {
      parts.push('刻骨铭心：' + ch._scars.slice(-3).map(function(s) {
        return s.event + '[' + s.emotion + ']';
      }).join('；'));
    }

    // 师徒关系
    if (ch._mentorId) parts.push('师从' + ch._mentorId);

    // 任职经历
    if (ch._tenure) {
      var posts = [];
      for (var pk in ch._tenure) { if (ch._tenure[pk] >= 3) posts.push(pk + Math.floor(ch._tenure[pk] / 4) + '年'); }
      if (posts.length) parts.push('历任' + posts.slice(-3).join('、'));
    }

    var result = parts.join('。');
    this._memCache[charName] = result;
    return result;
  },

  /** 获取对特定人物的印象值 */
  getImpression: function(charName, targetName) {
    if (!GM.chars) return 0;
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    if (!ch || !ch._impressions || !ch._impressions[targetName]) return 0;
    return ch._impressions[targetName].favor;
  },

  /** 获取角色当前情绪 */
  getMood: function(charName) {
    if (!GM.chars) return '平';
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    return (ch && ch._mood) || '平';
  },

  /** 月度记忆衰减（智能版：重要记忆不衰减，低重要记忆缓慢淡忘） */
  monthlyDecay: function() {
    if (!GM.chars) return;
    GM.chars.forEach(function(ch) {
      if (ch.alive === false) return;
      // 确保所有活着的角色都有记忆系统（延迟初始化）
      if (!ch._memory) ch._memory = [];
      if (!ch._memArchive) ch._memArchive = [];
      if (!ch._impressions) ch._impressions = {};
      if (!ch._scars) ch._scars = [];
      if (ch._memory) {
        ch._memory = ch._memory.filter(function(m) {
          var age = GM.turn - (m.turn || 0);
          // importance>=7的记忆永不自动淡忘（会在压缩时变成_scars）
          if (m.importance >= 7) return true;
          // importance 5-6: 超过30回合才可能淡忘
          if (m.importance >= 5) return age <= 30;
          // importance 3-4: 超过18回合淡忘
          if (m.importance >= 3) return age <= 18;
          // importance 1-2: 超过10回合淡忘
          return age <= 10;
        });
      }
      // 印象衰减（不对称：恩情慢衰，怨恨更慢衰——人记仇比记恩更久）
      if (ch._impressions) {
        for (var pn in ch._impressions) {
          var imp = ch._impressions[pn];
          if (imp.favor > 0) imp.favor = Math.max(0, imp.favor - 0.4);
          else if (imp.favor < 0) imp.favor = Math.min(0, imp.favor + 0.2); // 怨恨衰减更慢
          if (Math.abs(imp.favor) < 0.5 && (!imp.events || imp.events.length === 0)) delete ch._impressions[pn];
        }
      }
      NpcMemorySystem._updateMood(ch);
    });
  }
};

// ============================================================
// NPC 成长系统 — 属性随经历自然变化
// ============================================================
var CharacterGrowthSystem = {
  /**
   * 记录角色历练（不是数值升级，而是记录具体的成长经历供AI参考）
   * AI在推演中根据这些经历自然地调整角色的表现
   * @param {string} charName
   * @param {string} domain - 历练领域
   * @param {string} desc - 具体经历描述
   */
  recordExperience: function(charName, domain, desc) {
    if (!GM.chars) return;
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    if (!ch || ch.alive === false) return;
    if (!ch._lifeExp) ch._lifeExp = [];
    ch._lifeExp.push({ domain: domain, desc: desc, turn: GM.turn });
    if (ch._lifeExp.length > 20) ch._lifeExp = ch._lifeExp.slice(-20);
  },

  /**
   * 每回合更新——基于角色处境积累人生经历
   * 不直接修改属性——属性变化通过AI推演的char_updates字段实现
   */
  /**
   * 每回合更新——静默积累任职时间，仅在关键节点记录经历
   * 真实的人不会每天记录"今天又上班了"，只有里程碑才值得铭记
   */
  autoGainExperience: function() {
    if (!GM.chars) return;
    GM.chars.forEach(function(ch) {
      if (ch.alive === false) return;

      // 静默积累任职时间（不生成经历条目）
      if (!ch._tenure) ch._tenure = {};
      var office = typeof findNpcOffice === 'function' ? findNpcOffice(ch.name) : null;
      if (office) {
        var posKey = (office.deptName || '') + (office.posName || '');
        if (!ch._tenure[posKey]) ch._tenure[posKey] = 0;
        ch._tenure[posKey]++;

        // 里程碑节点：任职满一年(4回合)时记录一次
        if (ch._tenure[posKey] === 4) {
          var domain = (posKey.indexOf('将') >= 0 || posKey.indexOf('军') >= 0) ? '军旅' : (posKey.indexOf('刺史') >= 0 || posKey.indexOf('太守') >= 0 || posKey.indexOf('知') >= 0) ? '治理' : '仕途';
          CharacterGrowthSystem.recordExperience(ch.name, domain, '任' + posKey + '已满一年，渐入佳境');
        }
        // 任职满三年——已是老手
        else if (ch._tenure[posKey] === 12) {
          CharacterGrowthSystem.recordExperience(ch.name, '老练', '任' + posKey + '三年有余，深谙其道');
        }
      }

      // 师徒——不是每回合记录，而是根据师徒关系时长
      if (ch._mentorId) {
        if (!ch._mentorTurns) ch._mentorTurns = 0;
        ch._mentorTurns++;
        var mentor = GM.chars.find(function(c2) { return c2.name === ch._mentorId && c2.alive !== false; });
        if (mentor) {
          // 拜师半年——初有所得
          if (ch._mentorTurns === 2) {
            var mField = (mentor.intelligence || 50) > (mentor.valor || 50) ? '学问' : '武艺';
            CharacterGrowthSystem.recordExperience(ch.name, '师承', '从' + mentor.name + '处研习' + mField + '，初窥门径');
          }
          // 拜师两年——登堂入室
          else if (ch._mentorTurns === 8) {
            CharacterGrowthSystem.recordExperience(ch.name, '师承', '随' + mentor.name + '学艺已久，渐有所成');
          }
        } else {
          NpcMemorySystem.remember(ch.name, '恩师' + ch._mentorId + '已逝', '忧', 9, ch._mentorId);
          CharacterGrowthSystem.recordExperience(ch.name, '丧师', '恩师' + ch._mentorId + '去世，从此独行');
          ch._mentorId = null;
          ch._mentorTurns = 0;
        }
      }

      // 人生阶段转变——只在关键年龄记录
      if (ch.age) {
        if (ch.age === 20 && ch._lastAgeEvent !== 20) { ch._lastAgeEvent = 20; CharacterGrowthSystem.recordExperience(ch.name, '弱冠', '年满二十，束发加冠'); }
        else if (ch.age === 30 && ch._lastAgeEvent !== 30) { ch._lastAgeEvent = 30; CharacterGrowthSystem.recordExperience(ch.name, '而立', '三十而立，当有作为'); }
        else if (ch.age === 40 && ch._lastAgeEvent !== 40) { ch._lastAgeEvent = 40; CharacterGrowthSystem.recordExperience(ch.name, '不惑', '四十不惑，世事洞明'); }
        else if (ch.age === 50 && ch._lastAgeEvent !== 50) { ch._lastAgeEvent = 50; CharacterGrowthSystem.recordExperience(ch.name, '知命', '五十知天命，从心所欲'); }
        else if (ch.age === 60 && ch._lastAgeEvent !== 60) { ch._lastAgeEvent = 60; CharacterGrowthSystem.recordExperience(ch.name, '花甲', '年届花甲，阅尽沧桑'); }
        else if (ch.age === 70 && ch._lastAgeEvent !== 70) { ch._lastAgeEvent = 70; CharacterGrowthSystem.recordExperience(ch.name, '古稀', '古来稀有之年，力不从心'); if (ch.valor && ch.valor > 30) ch.valor -= 2; }
      }

      // 长期闲置的有野心者——不安与筹谋
      if (!office && (ch.ambition || 50) > 70 && GM.turn % 6 === 0) {
        NpcMemorySystem.remember(ch.name, '空有抱负却无施展之地', '忧', 5);
      }

      // 压力——不是每回合记录，只在首次进入高压和崩溃临界时
      if (ch.stress) {
        if (ch.stress > 60 && !ch._stressRecorded60) {
          ch._stressRecorded60 = true;
          CharacterGrowthSystem.recordExperience(ch.name, '磨难', '身心俱疲，夜不能寐');
          NpcMemorySystem.remember(ch.name, '压力山大，濒临极限', '惧', 6);
        } else if (ch.stress <= 40) {
          ch._stressRecorded60 = false; // 压力缓解后重置标记
        }
      }
    });
  },

  /**
   * 设置师徒关系
   */
  setMentor: function(studentName, mentorName) {
    var student = GM.chars ? GM.chars.find(function(c) { return c.name === studentName; }) : null;
    var mentor = GM.chars ? GM.chars.find(function(c) { return c.name === mentorName; }) : null;
    if (!student || !mentor) { toast('角色不存在'); return; }
    if (student.alive === false || mentor.alive === false) { toast('角色已故'); return; }
    student._mentorId = mentorName;
    NpcMemorySystem.remember(studentName, '拜' + mentorName + '为师，虚心求教', '敬', 8, mentorName);
    NpcMemorySystem.remember(mentorName, '收' + studentName + '为徒，悉心教导', '喜', 6, studentName);
    if (typeof AffinityMap !== 'undefined') AffinityMap.add(studentName, mentorName, 10, '师徒之谊');
    addEB('师徒', studentName + '拜' + mentorName + '为师');
    toast(studentName + '拜' + mentorName + '为师');
  },

  /**
   * 玩家培养角色——记录培养经历，AI在推演中体现效果
   */
  playerTrain: function(charName, trainingType) {
    var labels = {
      military_drill: '操练武艺，亲授兵法',
      book_study: '赐下珍本典籍研读',
      governance_practice: '派往地方历练政务',
      mentorship: '御前亲自教诲治国之道'
    };
    var desc = labels[trainingType];
    if (!desc) return;
    CharacterGrowthSystem.recordExperience(charName, '帝师', desc);
    NpcMemorySystem.remember(charName, '蒙圣上栽培——' + desc, '敬', 8, (P.playerInfo && P.playerInfo.characterName) || '陛下');
    var ch = GM.chars ? GM.chars.find(function(c) { return c.name === charName; }) : null;
    if (ch) {
      ch.loyalty = Math.min(100, (ch.loyalty || 50) + 3);
      if (typeof AffinityMap !== 'undefined') AffinityMap.add(charName, (P.playerInfo && P.playerInfo.characterName) || '玩家', 6, '受帝王栽培');
    }
    toast(charName + '感恩涕零，誓以死报');
  },

  /** 获取角色历练上下文（供AI推演参考，让AI自行判断成长结果） */
  getGrowthContext: function() {
    if (!GM.chars) return '';
    var withExp = GM.chars.filter(function(c) {
      return c.alive !== false && c._lifeExp && c._lifeExp.length >= 2;
    });
    if (withExp.length === 0) return '';
    // 只展示最有故事的角色
    withExp.sort(function(a, b) { return (b._lifeExp ? b._lifeExp.length : 0) - (a._lifeExp ? a._lifeExp.length : 0); });
    var ctx = '【角色历练】\n';
    withExp.slice(0, 6).forEach(function(c) {
      var recent = c._lifeExp.slice(-3);
      var parts = [];
      if (c.age) parts.push(c.age + '岁');
      if (c._mentorId) parts.push('师从' + c._mentorId);
      // 任职年限
      if (c._tenure) {
        var longestPost = '', longestYears = 0;
        for (var pk in c._tenure) { if (c._tenure[pk] > longestYears) { longestYears = c._tenure[pk]; longestPost = pk; } }
        if (longestYears >= 4) parts.push('任' + longestPost + Math.floor(longestYears / 4) + '年');
      }
      var expDesc = recent.map(function(e) { return e.desc; }).join('；');
      ctx += '  ' + c.name + (parts.length ? '(' + parts.join('，') + ')' : '') + '：' + expDesc + '\n';
    });
    ctx += '  ※ 请在char_updates中自然体现经历对角色的影响（如久经战阵→武力渐长，治理有方→政声鹊起，年迈体衰→力不从心）。\n';
    return ctx;
  }
};

/**
 * 性格演变——重大经历可能改变角色性格特质
 * 每年检查一次，根据累积的记忆情绪判断是否触发性格转变
 */
function checkPersonalityEvolution() {
  if (!GM.chars || !P.traitDefinitions) return;
  GM.chars.forEach(function(ch) {
    if (ch.alive === false || !ch._memory || ch._memory.length < 5) return;
    if (!ch.traitIds) ch.traitIds = [];

    // 统计近期记忆的情绪比例
    var emoCount = {};
    ch._memory.forEach(function(m) { emoCount[m.emotion] = (emoCount[m.emotion] || 0) + 1; });
    var total = ch._memory.length;

    // 大量怒/恨记忆 → 可能变得"复仇"或"暴怒"
    if ((emoCount['怒'] || 0) + (emoCount['恨'] || 0) > total * 0.5) {
      if (ch.traitIds.indexOf('vengeful') < 0 && ch.traitIds.indexOf('wrathful') < 0) {
        var newTrait = (emoCount['恨'] || 0) > (emoCount['怒'] || 0) ? 'vengeful' : 'wrathful';
        var def = P.traitDefinitions.find(function(t) { return t.id === newTrait; });
        if (def && (!def.opposite || ch.traitIds.indexOf(def.opposite) < 0)) {
          ch.traitIds.push(newTrait);
          if (ch.traitIds.length > 5) ch.traitIds = ch.traitIds.slice(-5);
          NpcMemorySystem.remember(ch.name, '经历了太多不公，性情大变', '怒', 9);
          addEB('性格', ch.name + '因累积怨恨，性情变得' + def.name);
          if (typeof recordCharacterArc === 'function') recordCharacterArc(ch.name, 'achievement', '性格转变——' + def.name);
        }
      }
    }
    // 大量喜/敬记忆 → 可能变得"宽容"或"勤勉"
    else if ((emoCount['喜'] || 0) + (emoCount['敬'] || 0) > total * 0.6) {
      if (ch.traitIds.indexOf('forgiving') < 0 && ch.traitIds.indexOf('diligent') < 0) {
        var posTrait = (emoCount['敬'] || 0) > (emoCount['喜'] || 0) ? 'diligent' : 'forgiving';
        var pDef = P.traitDefinitions.find(function(t) { return t.id === posTrait; });
        if (pDef && (!pDef.opposite || ch.traitIds.indexOf(pDef.opposite) < 0)) {
          ch.traitIds.push(posTrait);
          if (ch.traitIds.length > 5) ch.traitIds = ch.traitIds.slice(-5);
          NpcMemorySystem.remember(ch.name, '心境有所转变，愈发' + pDef.name, '喜', 7);
          addEB('性格', ch.name + '心境转变，变得' + pDef.name);
        }
      }
    }
    // 大量忧/惧记忆 → 可能变得"谨慎"
    else if ((emoCount['忧'] || 0) + (emoCount['惧'] || 0) > total * 0.5) {
      if (ch.traitIds.indexOf('cautious') < 0) {
        var cDef = P.traitDefinitions.find(function(t) { return t.id === 'cautious'; });
        if (cDef && (!cDef.opposite || ch.traitIds.indexOf(cDef.opposite) < 0)) {
          ch.traitIds.push('cautious');
          if (ch.traitIds.length > 5) ch.traitIds = ch.traitIds.slice(-5);
          NpcMemorySystem.remember(ch.name, '经历太多风波，行事愈加谨慎', '忧', 6);
          addEB('性格', ch.name + '变得谨小慎微');
        }
      }
    }
  });
}

// ============================================================
// 变量信息传递 — 将编辑者定义的所有变量元数据原样提供给AI
// 不假设任何固定字段名/格式，编辑者写了什么就传什么
// ============================================================

/**
 * 收集所有变量的附加信息（编辑者写的任何元数据），传给AI
 * 不做程序层面的计算——公式和规则由AI理解和运用
 */
function getVarCalcContext() {
  if (!GM.vars) return '';
  var ctx = '';

  // 收集有附加信息的变量（不假设字段名，遍历所有非核心字段）
  var richVars = [];
  var _coreFields = {value:1, min:1, max:1, name:1, id:1, sid:1, color:1, icon:1, visible:1, _category:1};
  Object.keys(GM.vars).forEach(function(vn) {
    var v = GM.vars[vn];
    var extra = [];
    Object.keys(v).forEach(function(k) {
      if (_coreFields[k]) return;
      var val = v[k];
      if (val === undefined || val === null || val === '') return;
      if (typeof val === 'object') val = JSON.stringify(val).slice(0, 50);
      else val = String(val).slice(0, 50);
      extra.push(k + ':' + val);
    });
    if (extra.length > 0) {
      richVars.push('  ' + vn + '=' + v.value + ' ' + extra.join(' '));
    }
  });

  if (richVars.length > 0) {
    ctx += '\u3010\u53D8\u91CF\u8BE6\u60C5\u3011\n';
    ctx += richVars.slice(0, 15).join('\n') + '\n';
    ctx += '  \u203B \u4EE5\u4E0A\u662F\u5267\u672C\u7F16\u8F91\u8005\u5B9A\u4E49\u7684\u53D8\u91CF\u9644\u52A0\u4FE1\u606F\u3002AI\u5728\u8C03\u6574resource_changes\u65F6\u5E94\u53C2\u8003\u8FD9\u4E9B\u4FE1\u606F\uFF08\u5355\u4F4D\u3001\u8BA1\u7B97\u65B9\u6CD5\u3001\u6784\u6210\u7B49\uFF09\u3002\n';
  }

  // 公式/关联关系——原样传递编辑者写的内容
  if (GM._varFormulas && GM._varFormulas.length > 0) {
    ctx += '\u3010\u53D8\u91CF\u5173\u8054\u89C4\u5219\u3011\n';
    GM._varFormulas.forEach(function(f) {
      // 不假设字段名：尝试多种可能的字段
      var name = f.name || f.target || f.title || '';
      var expr = f.expression || f.expr || f.formula || f.rule || '';
      var desc = f.desc || f.description || f.note || '';
      var related = f.relatedVars || f.related || f.variables || '';
      if (Array.isArray(related)) related = related.join(',');
      var line = '  ' + name;
      if (expr) line += ': ' + expr;
      if (related) line += ' (\u6D89\u53CA:' + related + ')';
      if (desc) line += ' [' + desc.slice(0, 30) + ']';
      ctx += line + '\n';
    });
    ctx += '  \u203B \u4EE5\u4E0A\u662F\u5267\u672C\u7F16\u8F91\u8005\u5B9A\u4E49\u7684\u53D8\u91CF\u95F4\u5173\u8054\u89C4\u5219\u3002AI\u5E94\u7406\u89E3\u8FD9\u4E9B\u89C4\u5219\u7684\u542B\u4E49\uFF0C\u5728\u63A8\u6F14\u65F6\u8BA9\u53D8\u91CF\u53D8\u5316\u7B26\u5408\u8FD9\u4E9B\u903B\u8F91\u3002\n';
  }

  // StateCoupling已配置的耦合关系
  if (P.stateCoupling && P.stateCoupling.couplings && P.stateCoupling.couplings.length > 0) {
    ctx += '\u3010\u53D8\u91CF\u8026\u5408\u5173\u7CFB\u3011\n';
    P.stateCoupling.couplings.forEach(function(c) {
      ctx += '  ' + (c.source || '') + ' \u2192 ' + (c.target || '') + ' (\u7CFB\u6570:' + (c.coefficient || 0) + ')\n';
    });
  }

  // 通用级联提示（即使没有编辑器配置，也告诉AI要思考级联）
  if (Object.keys(GM.vars).length > 3) {
    ctx += '  \u203B \u53D8\u91CF\u4E4B\u95F4\u5B58\u5728\u81EA\u7136\u7684\u7EA7\u8054\u5173\u7CFB\u3002AI\u5728\u8C03\u6574resource_changes\u65F6\uFF0C\u5E94\u8003\u8651\u4E00\u4E2A\u53D8\u91CF\u7684\u53D8\u5316\u5BF9\u5176\u4ED6\u53D8\u91CF\u7684\u5F71\u54CD\uFF0C\u5E76\u4E00\u5E76\u8C03\u6574\u3002\n';
  }

  return ctx;
}

// 注册自动经验积累到结算流水线（每回合）
SettlementPipeline.register('charGrowth', '角色成长', function() { CharacterGrowthSystem.autoGainExperience(); }, 25, 'perturn');
// 注册性格演变（每年检查一次）
SettlementPipeline.register('personalityEvolution', '\u6027\u683C\u6F14\u53D8', checkPersonalityEvolution, 26, 'perturn');
// npcMemDecay uses 26 monthly — different phase, no conflict
// 注册NPC记忆衰减（每月）
SettlementPipeline.register('npcMemDecay', 'NPC记忆衰减', function() { NpcMemorySystem.monthlyDecay(); }, 26, 'monthly');

// ============================================================
// 门阀家族系统 — AI 在开局时为角色生成郡望门第
// ============================================================

/**
 * 门第等级描述
 * @param {string} tier
 * @returns {string}
 */
function getFamilyTierName(tier) {
  var map = {'imperial':'\u7687\u65CF\u5B97\u5BA4','noble':'\u4E16\u5BB6\u5927\u65CF','gentry':'\u5730\u65B9\u58EB\u65CF','common':'\u5BD2\u95E8'};
  return map[tier] || '\u5BD2\u95E8';
}

/**
 * AI 为所有角色生成郡望家族名（如"琅琊王氏""陇西李氏""寒门·张"）
 * 在 enterGame:after 时异步调用
 */
async function _aiEnrichFamilyNames() {
  if (!P.ai || !P.ai.key || !GM.chars) return;
  // 如果角色家族名已经包含郡望（超过2个字），跳过
  var needEnrich = GM.chars.filter(function(c) {
    return c.alive !== false && c.family && c.family.length <= 3 && !c._familyEnriched;
  });
  if (needEnrich.length === 0) return;

  var sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
  var era = sc ? (sc.era || sc.dynasty || '') : '';

  var charList = needEnrich.slice(0, 20).map(function(c) {
    return c.name + '(' + c.family + ',\u5FE0' + (c.loyalty || 50) + ',\u804C:' + (c.title || '\u65E0') + ',\u95E8\u7B2C:' + getFamilyTierName(c.familyTier) + ')';
  }).join('; ');

  try {
    var prompt = '\u5386\u53F2\u80CC\u666F\uFF1A' + era + '\n';
    prompt += '\u4EE5\u4E0B\u662F\u4E00\u6279\u89D2\u8272\uFF0C\u8BF7\u4E3A\u6BCF\u4EBA\u751F\u6210\u5408\u4E4E\u5386\u53F2\u80CC\u666F\u7684\u5BB6\u65CF\u90E1\u671B\u540D\u3002\n';
    prompt += '\u89C4\u5219\uFF1A\n';
    prompt += '- \u7687\u65CF\u5B97\u5BA4\uFF1A\u5982\u201C\u7687\u65CF\u00B7\u5F00\u56FD\u674E\u6C0F\u201D\u201C\u5B97\u5BA4\u00B7\u7687\u5B50\u201D\n';
    prompt += '- \u4E16\u5BB6\u5927\u65CF\uFF1A\u5982\u201C\u7405\u740A\u738B\u6C0F\u201D\u201C\u9648\u90E1\u8C22\u6C0F\u201D\u201C\u6E05\u6CB3\u5D14\u6C0F\u201D\u201C\u8D75\u90E1\u674E\u6C0F\u201D\u2014\u2014\u4EE5\u90E1\u671B+\u59D3\u6C0F\u683C\u5F0F\n';
    prompt += '- \u5730\u65B9\u58EB\u65CF\uFF1A\u5982\u201C\u6C5F\u5357\u5F20\u6C0F\u201D\u201C\u5173\u4E2D\u5415\u6C0F\u201D\u2014\u2014\u4EE5\u5730\u57DF+\u59D3\u6C0F\u683C\u5F0F\n';
    prompt += '- \u5BD2\u95E8\uFF1A\u5982\u201C\u5BD2\u95E8\u00B7\u5F20\u201D\u201C\u5E02\u4E95\u00B7\u674E\u201D\u201C\u519C\u5BB6\u00B7\u738B\u201D\u2014\u2014\u4EE5\u51FA\u8EAB+\u59D3\u683C\u5F0F\n';
    prompt += '\u540C\u59D3\u4F46\u4E0D\u540C\u90E1\u671B\u662F\u4E0D\u540C\u5BB6\u65CF\uFF08\u5982\u201C\u7405\u740A\u738B\u6C0F\u201D\u4E0E\u201C\u592A\u539F\u738B\u6C0F\u201D\u4E0D\u540C\uFF09\u3002\n';
    prompt += '\u89D2\u8272\u5217\u8868\uFF1A' + charList + '\n';
    prompt += '\u8FD4\u56DEJSON\uFF1A[{"name":"\u89D2\u8272\u540D","family":"\u90E1\u671B\u5BB6\u65CF\u540D"}]';

    var result = await callAI(prompt, 800);
    var parsed = extractJSON(result);
    if (Array.isArray(parsed)) {
      parsed.forEach(function(item) {
        if (!item.name || !item.family) return;
        var ch = findCharByName(item.name);
        if (ch) {
          ch.family = item.family;
          ch._familyEnriched = true;
        }
      });
      _dbg('[Family] AI enriched ' + parsed.length + ' family names');
    }
  } catch(e) {
    _dbg('[Family] AI enrichment failed:', e);
  }
}

GameHooks.on('enterGame:after', function() {
  _aiEnrichFamilyNames().then(function() { initFamilyRegistry(); }).catch(function() { initFamilyRegistry(); });
});

// ============================================================
// 家族注册表 — GM.families 全局数据结构
// ============================================================

/**
 * 从当前角色数据构建家族注册表
 * GM.families = { "琅琊王氏": { name, tier, renown, branches[], history[], relations{} } }
 */
function initFamilyRegistry() {
  if (!GM.families) GM.families = {};
  if (!GM.chars) return;

  // 按family字段分组
  var grouped = {};
  GM.chars.forEach(function(c) {
    if (!c.family) return;
    if (!grouped[c.family]) grouped[c.family] = [];
    grouped[c.family].push(c);
  });

  Object.keys(grouped).forEach(function(famName) {
    var members = grouped[famName];
    // 如果已有注册表条目且有branches，保留已有数据
    if (GM.families[famName] && GM.families[famName].branches) {
      // 仅同步成员列表
      var existing = GM.families[famName];
      var allNames = members.map(function(c) { return c.name; });
      // 更新嫡系成员
      if (existing.branches.length > 0) {
        existing.branches[0].members = allNames.filter(function(n) {
          // 如果不在任何分支中，归入嫡系
          for (var i = 1; i < existing.branches.length; i++) {
            if (existing.branches[i].members.indexOf(n) >= 0) return false;
          }
          return true;
        });
      }
      return;
    }

    // 创建新条目
    var tier = members[0].familyTier || 'common';
    // 选当家：有官职者优先，年长者其次
    var head = members[0].name;
    members.forEach(function(c) {
      if (c.title && (!findCharByName(head) || !findCharByName(head).title)) head = c.name;
    });

    GM.families[famName] = {
      name: famName,
      tier: tier,
      renown: tier === 'imperial' ? 80 : tier === 'noble' ? 60 : tier === 'gentry' ? 35 : 15,
      founder: head,
      motto: '',
      branches: [{
        id: 'main',
        name: '\u5AE1\u7CFB',
        head: head,
        members: members.map(function(c) { return c.name; })
      }],
      history: [{ turn: GM.turn, event: '\u5BB6\u65CF\u5EFA\u7ACB', desc: famName + '\u7ACB\u4E8E\u671D\u5802' }],
      relations: {}
    };
  });

  // 推断血缘关系
  Object.keys(GM.families).forEach(function(fn) { inferBloodRelations(fn); });
  _dbg('[Family] Registry built:', Object.keys(GM.families).length, 'families');
}

/** 获取角色所属家族对象 */
function getFamilyOf(charName) {
  var ch = findCharByName(charName);
  if (!ch || !ch.family || !GM.families) return null;
  return GM.families[ch.family] || null;
}

/** 获取角色所在家支 */
function getFamilyBranch(charName) {
  var fam = getFamilyOf(charName);
  if (!fam) return null;
  for (var i = 0; i < fam.branches.length; i++) {
    if (fam.branches[i].members.indexOf(charName) >= 0) return fam.branches[i];
  }
  return fam.branches[0] || null;
}

/** 添加角色到家族 */
function addToFamily(charName, familyName, branchId) {
  if (!GM.families) GM.families = {};
  if (!GM.families[familyName]) {
    var ch = findCharByName(charName);
    GM.families[familyName] = {
      name: familyName, tier: (ch && ch.familyTier) || 'common', renown: 15,
      founder: charName, motto: '',
      branches: [{ id: 'main', name: '\u5AE1\u7CFB', head: charName, members: [charName] }],
      history: [{ turn: GM.turn, event: '\u5BB6\u65CF\u5EFA\u7ACB', desc: familyName }],
      relations: {}
    };
    return;
  }
  var fam = GM.families[familyName];
  var branch = branchId ? fam.branches.find(function(b) { return b.id === branchId; }) : fam.branches[0];
  if (!branch) branch = fam.branches[0];
  if (branch && branch.members.indexOf(charName) < 0) {
    branch.members.push(charName);
  }
}

/** 设置家族内血缘关系 */
function setFamilyRelation(familyName, nameA, nameB, relType) {
  if (!GM.families || !GM.families[familyName] || !nameA || !nameB || nameA === nameB) return;
  var key = nameA < nameB ? nameA + '|' + nameB : nameB + '|' + nameA;
  GM.families[familyName].relations[key] = relType;
}

/** 获取两人的血缘关系 */
function getFamilyRelation(nameA, nameB) {
  if (!nameA || !nameB || nameA === nameB) return null;
  var chA = findCharByName(nameA), chB = findCharByName(nameB);
  if (!chA || !chB || chA.family !== chB.family || !GM.families) return null;
  var fam = GM.families[chA.family];
  if (!fam) return null;
  var key = nameA < nameB ? nameA + '|' + nameB : nameB + '|' + nameA;
  return fam.relations[key] || null;
}

/** 获取角色的所有血亲 */
function getBloodRelatives(charName) {
  var ch = findCharByName(charName);
  if (!ch || !ch.family || !GM.families || !GM.families[ch.family]) return [];
  var rels = GM.families[ch.family].relations;
  var results = [];
  Object.keys(rels).forEach(function(key) {
    var parts = key.split('|');
    if (parts[0] === charName) results.push({ name: parts[1], relation: rels[key] });
    else if (parts[1] === charName) results.push({ name: parts[0], relation: rels[key] });
  });
  return results;
}

/** 推断家族内的血缘关系（从parent-child数据自动构建） */
function inferBloodRelations(familyName) {
  var fam = GM.families[familyName];
  if (!fam || !GM.chars) return;
  var allMembers = [];
  fam.branches.forEach(function(b) { allMembers = allMembers.concat(b.members); });

  // 构建亲子图
  var parentMap = {}; // child -> parent
  var childrenMap = {}; // parent -> [children]
  allMembers.forEach(function(name) {
    var ch = findCharByName(name);
    if (!ch) return;
    // parentOf指向父亲
    if (ch.parentOf && allMembers.indexOf(ch.parentOf) >= 0) {
      parentMap[name] = ch.parentOf;
      if (!childrenMap[ch.parentOf]) childrenMap[ch.parentOf] = [];
      if (childrenMap[ch.parentOf].indexOf(name) < 0) childrenMap[ch.parentOf].push(name);
    }
    // children[]指向母亲的孩子（通过spouse角色）
    if (ch.children && ch.children.length > 0) {
      ch.children.forEach(function(cn) {
        if (allMembers.indexOf(cn) >= 0) {
          var child = findCharByName(cn);
          var relType = ch.spouse ? '\u6BCD\u5B50' : '\u7236\u5B50';
          setFamilyRelation(familyName, name, cn, relType);
        }
      });
    }
  });

  // 推断父子
  Object.keys(parentMap).forEach(function(child) {
    setFamilyRelation(familyName, parentMap[child], child, '\u7236\u5B50');
  });

  // 推断兄弟姐妹（共享父亲）
  Object.keys(childrenMap).forEach(function(parent) {
    var sibs = childrenMap[parent];
    for (var i = 0; i < sibs.length; i++) {
      for (var j = i + 1; j < sibs.length; j++) {
        var ci = findCharByName(sibs[i]), cj = findCharByName(sibs[j]);
        var rel = (ci && ci.gender === '\u5973') || (cj && cj.gender === '\u5973') ? '\u5144\u59B9' : '\u5144\u5F1F';
        if (!getFamilyRelation(sibs[i], sibs[j])) setFamilyRelation(familyName, sibs[i], sibs[j], rel);
      }
    }
  });

  // 推断叔侄（A的兄弟B的孩子C → A是C的叔父）
  Object.keys(fam.relations).forEach(function(key) {
    if (fam.relations[key] !== '\u5144\u5F1F' && fam.relations[key] !== '\u5144\u59B9') return;
    var parts = key.split('|');
    [0, 1].forEach(function(idx) {
      var uncle = parts[idx], sibling = parts[1 - idx];
      (childrenMap[sibling] || []).forEach(function(nephew) {
        if (!getFamilyRelation(uncle, nephew)) setFamilyRelation(familyName, uncle, nephew, '\u53D4\u4FA8');
      });
    });
  });
}

/** 创建家族分支 */
function createBranch(familyName, branchName, headName, memberNames) {
  var fam = GM.families[familyName];
  if (!fam) return;
  var newBranch = { id: 'branch_' + uid(), name: branchName, head: headName, members: [] };
  memberNames.forEach(function(name) {
    // 从旧分支中移除
    fam.branches.forEach(function(b) {
      var idx = b.members.indexOf(name);
      if (idx >= 0) b.members.splice(idx, 1);
    });
    newBranch.members.push(name);
  });
  fam.branches.push(newBranch);
  fam.history.push({ turn: GM.turn, event: '\u5206\u652F', desc: branchName + '\u7ACB' });
}

/** 更新家族声望 */
function updateFamilyRenown(familyName, delta, reason) {
  var fam = GM.families[familyName];
  if (!fam) return;
  fam.renown = clamp((fam.renown || 50) + delta, 0, 100);
  if (Math.abs(delta) >= 3) {
    fam.history.push({ turn: GM.turn, event: delta > 0 ? '\u58F0\u671B\u5347' : '\u58F0\u671B\u964D', desc: reason || '' });
  }
}

/** 家族声望月度结算 */
function settleRenown() {
  if (!GM.families || !GM.chars) return;
  Object.keys(GM.families).forEach(function(fn) {
    var fam = GM.families[fn];
    var delta = 0;
    // 统计在职官员数
    var officialCount = 0;
    var allMembers = [];
    fam.branches.forEach(function(b) { allMembers = allMembers.concat(b.members); });
    allMembers.forEach(function(name) {
      var ch = findCharByName(name);
      if (!ch || ch.alive === false) return;
      if (typeof findNpcOffice === 'function' && findNpcOffice(name)) officialCount++;
    });
    delta += Math.min(3, officialCount); // 每个官员+1，上限+3

    // 门第基础加成
    if (fam.tier === 'imperial') delta += 1;
    else if (fam.tier === 'noble') delta += 0.5;

    // 回归均值
    if (fam.renown > 70) delta -= 0.5;
    else if (fam.renown < 20) delta += 0.5;

    if (delta !== 0) fam.renown = clamp((fam.renown || 50) + delta, 0, 100);
  });
}

SettlementPipeline.register('familyRenown', '\u5BB6\u65CF\u58F0\u671B', settleRenown, 36, 'monthly');

// ============================================================
// 后宫位份系统 — 朝代感知，AI 可在开局时定制
// ============================================================

// 默认位份（当AI/剧本未指定时使用）
var _DEFAULT_HAREM_RANKS = [
  {id:'empress', name:'\u7687\u540E', level:0, icon:'\u{1F451}'},
  {id:'consort_noble', name:'\u8D35\u5983', level:1, icon:'\u{1F490}'},
  {id:'consort', name:'\u5983', level:2, icon:'\u{1F490}'},
  {id:'concubine', name:'\u5ABE', level:3, icon:'\u{1F338}'},
  {id:'attendant', name:'\u8D35\u4EBA', level:4, icon:'\u{1F33C}'},
  {id:'maid', name:'\u5E38\u5728', level:5, icon:'\u{1F33C}'}
];

/**
 * 获取当前剧本的后宫位份等级（朝代感知）
 * 优先使用 GM.harem.rankSystem（AI/剧本配置）
 * @returns {Array<{id,name,level,icon}>}
 */
function getHaremRanks() {
  if (GM.harem && GM.harem.rankSystem && GM.harem.rankSystem.length > 0) {
    return GM.harem.rankSystem;
  }
  return _DEFAULT_HAREM_RANKS;
}

/**
 * 将 spouseRank id 转为显示名（朝代感知）
 * @param {string} rankId
 * @returns {string}
 */
function getHaremRankName(rankId) {
  if (!rankId) return '';
  var ranks = getHaremRanks();
  var r = ranks.find(function(x) { return x.id === rankId; });
  if (r) return r.name;
  // 兼容旧数据的英文id
  var fallback = {'empress':'\u7687\u540E','queen':'\u738B\u540E','consort':'\u5983','concubine':'\u5ABE','attendant':'\u4F8D\u59BE'};
  return fallback[rankId] || rankId;
}

/** 获取位份图标 */
function getHaremRankIcon(rankId) {
  var ranks = getHaremRanks();
  var r = ranks.find(function(x) { return x.id === rankId; });
  if (r) return r.icon || '\u{1F490}';
  var fallback = {'empress':'\u{1F451}','queen':'\u{1F451}','consort':'\u{1F490}','concubine':'\u{1F338}','attendant':'\u{1F33C}'};
  return fallback[rankId] || '\u{1F490}';
}

/** 获取位份等级数值（用于排序，越小越尊） */
function getHaremRankLevel(rankId) {
  var ranks = getHaremRanks();
  var r = ranks.find(function(x) { return x.id === rankId; });
  if (r) return r.level;
  var fallback = {'empress':0,'queen':0,'consort':1,'concubine':2,'attendant':3};
  return fallback[rankId] !== undefined ? fallback[rankId] : 9;
}

/** 是否为正室（用于嫡庶判断） */
function isLegitimateRank(rankId) {
  var ranks = getHaremRanks();
  var r = ranks.find(function(x) { return x.id === rankId; });
  if (r) return r.level === 0;
  return rankId === 'empress' || rankId === 'queen';
}

/**
 * AI 在游戏开始时生成朝代对应的后宫位份
 * 注册到 enterGame:after 钩子
 */
async function _aiGenerateHaremRanks() {
  if (GM.harem && GM.harem.rankSystem && GM.harem.rankSystem.length > 0) return;
  if (!P.ai || !P.ai.key) return;
  var sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
  if (!sc) return;
  var era = sc.era || sc.dynasty || '';
  if (!era) return;

  try {
    var prompt = '\u8BF7\u6839\u636E"' + era + '"\u671D\u4EE3\uFF0C\u8FD4\u56DE\u8BE5\u671D\u4EE3\u7684\u540E\u5BAB\u4F4D\u4EFD\u7B49\u7EA7\u5236\u5EA6\u3002\n';
    prompt += '\u8FD4\u56DEJSON\u6570\u7EC4\uFF0C\u6309\u5C0A\u5351\u6392\u5E8F\uFF1A[{"id":"english_id","name":"\u4E2D\u6587\u540D","level":0},...]\n';
    prompt += 'level=0\u662F\u6700\u9AD8\u4F4D\uFF08\u7687\u540E/\u738B\u540E\uFF09\uFF0C\u5F80\u4E0B\u9012\u589E\u3002\n';
    prompt += '\u793A\u4F8B\uFF08\u5510\u671D\uFF09\uFF1A[{"id":"empress","name":"\u7687\u540E","level":0},{"id":"guifei","name":"\u8D35\u5983","level":1},{"id":"shufei","name":"\u6DD1\u5983","level":1},{"id":"defei","name":"\u5FB7\u5983","level":1},{"id":"xiangfei","name":"\u8D24\u5983","level":1},{"id":"pin","name":"\u5ABE","level":2},{"id":"jieyu","name":"\u5A55\u5983","level":3},{"id":"meiren","name":"\u7F8E\u4EBA","level":4},{"id":"cairen","name":"\u624D\u4EBA","level":5}]\n';
    prompt += '\u53EA\u8FD4\u56DEJSON\uFF0C\u4E0D\u8981\u89E3\u91CA\u3002';
    var result = await callAI(prompt, 500);
    var parsed = extractJSON(result);
    if (Array.isArray(parsed) && parsed.length >= 3) {
      GM.harem.rankSystem = parsed;
      _dbg('[Harem] AI generated rank system for ' + era + ':', parsed.map(function(r) { return r.name; }).join('\u2192'));
    }
  } catch(e) {
    _dbg('[Harem] AI rank generation failed:', e);
  }
}

GameHooks.on('enterGame:after', function() { _aiGenerateHaremRanks(); });

// ============================================================
// 外戚系统 — 后宫母族与前朝势力联动
// ============================================================

/**
 * 更新外戚势力（每回合结算时调用）
 * 得宠妃嫔的母族势力上升，失宠者下降
 */
function updateConsortClanInfluence() {
  if (!GM.chars || !GM.facs) return;
  var playerName = P.playerInfo && P.playerInfo.characterName;
  if (!playerName) return;

  GM.chars.forEach(function(sp) {
    if (!sp.spouse || sp.alive === false || !sp.motherClan) return;

    // 查找母族对应的势力
    var clanFac = GM.facs.find(function(f) { return f.name === sp.motherClan || (f.name && f.name.indexOf(sp.motherClan) >= 0); });
    if (!clanFac) {
      // 查找党派
      if (GM.parties) {
        clanFac = GM.parties.find(function(p) { return p.name === sp.motherClan || (p.name && p.name.indexOf(sp.motherClan) >= 0); });
      }
    }
    if (!clanFac) return;

    // 宠爱程度影响母族势力
    var favor = 0;
    if (typeof AffinityMap !== 'undefined') {
      favor = AffinityMap.get(playerName, sp.name) || 0;
    }

    // 得宠 → 母族势力+1~3，失宠 → -1
    var delta = 0;
    if (favor > 30) delta = 2;
    else if (favor > 10) delta = 1;
    else if (favor < -10) delta = -1;

    // 有子嗣且为太子 → 额外+2
    if (GM.harem && GM.harem.heirs && sp.children) {
      sp.children.forEach(function(childName) {
        if (GM.harem.heirs[0] === childName) delta += 2;
      });
    }

    if (delta !== 0) {
      if (clanFac.strength !== undefined) {
        clanFac.strength = clamp((clanFac.strength || 50) + delta, 0, 100);
      } else if (clanFac.influence !== undefined) {
        clanFac.influence = clamp((clanFac.influence || 50) + delta, 0, 100);
      }
    }
  });
}

/**
 * 家族亲疏维护——同族成员之间天然有少量亲近感
 * 每季度微调一次，避免每回合都跑
 */
function updateFamilyBonds() {
  if (!GM.chars || typeof AffinityMap === 'undefined') return;
  // 只处理有明确血缘关系的族人——远亲不一定亲近
  if (!GM.families) return;
  Object.keys(GM.families).forEach(function(fam) {
    var famObj = GM.families[fam];
    if (!famObj || !famObj.relations) return;
    // 只有已确认血缘关系的人之间才有自然亲近
    Object.keys(famObj.relations).forEach(function(key) {
      var parts = key.split('|');
      var chA = findCharByName(parts[0]), chB = findCharByName(parts[1]);
      if (!chA || !chB || chA.alive === false || chB.alive === false) return;
      var cur = AffinityMap.get(parts[0], parts[1]) || 0;
      var rel = famObj.relations[key];
      // 父子/母子纽带最强；兄弟较强；叔侄一般
      var cap = 25, strength = 1;
      if (rel === '\u7236\u5B50' || rel === '\u6BCD\u5B50') { cap = 35; strength = 2; }
      else if (rel === '\u5144\u5F1F' || rel === '\u5144\u59B9') { cap = 25; strength = 1; }
      else if (rel === '\u53D4\u4FA8') { cap = 15; strength = 1; }
      // 但如果已经有仇（cur < -10），不再自动修复——家族内部矛盾由AI驱动
      if (cur < -10) return;
      if (cur < cap) AffinityMap.add(parts[0], parts[1], strength, rel);
    });
  });
}

// 注册家族亲疏到结算流水线（每季度）
SettlementPipeline.register('familyBonds', '\u5BB6\u65CF\u4EB2\u758F', updateFamilyBonds, 29, 'monthly');

// 注册外戚势力更新到结算流水线
SettlementPipeline.register('consortClan', '\u5916\u621A\u52BF\u529B', updateConsortClanInfluence, 28, 'perturn');

// ============================================================
// 后宫结算系统 — HaremSettlement
// 处理怀孕进度、子女成长、继承人排序
// ============================================================
var HaremSettlement = {
  // 每回合结算（注册到pipeline）
  settle: function() {
    if (!GM.harem) return;
    if (!GM.chars) return;
    var _dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var _ms = _dpv / 30;

    // 0. 宫闱政治——妃嫔宠爱度衰减 + 外戚势力波动
    if (GM.harem.consorts && GM.harem.consorts.length > 0) {
      GM.harem.consorts.forEach(function(con) {
        if (!con.name) return;
        var ch = typeof findCharByName === 'function' ? findCharByName(con.name) : null;
        if (!ch || ch.alive === false) { con.active = false; return; }
        // 宠爱自然衰减（月基准-0.5）
        con.favor = Math.max(0, (con.favor || 50) - 0.5 * _ms);
        // 外戚势力随宠爱波动
        if (con.favor > 70) {
          con.clanInfluence = Math.min(100, (con.clanInfluence || 0) + 0.3 * _ms);
        } else if (con.favor < 30) {
          con.clanInfluence = Math.max(0, (con.clanInfluence || 0) - 0.5 * _ms);
        }
        // 低宠妃嫔怨恨→AI事件提示
        if (con.favor < 15 && (con.ambition || 50) > 60 && !con._grievanceLogged) {
          if (typeof addEB === 'function') addEB('后宫', con.name + '失宠已久，心怀怨恨，恐生事端');
          con._grievanceLogged = GM.turn;
        }
      });

      // 储位争端检测
      var princes = (GM.chars || []).filter(function(c) {
        return c.alive !== false && c.age && c.age >= 15 && c.gender === '男' && c.isHeir !== false && (c.father || c.motherClan);
      });
      if (princes.length >= 2) {
        // 多位适龄皇子→储位争端
        var clanDiff = Math.abs((princes[0].motherClanInfluence || 0) - (princes[1].motherClanInfluence || 0));
        if (clanDiff < 20 && !GM.harem._successionDispute) {
          GM.harem._successionDispute = true;
          if (typeof addEB === 'function') addEB('储位', '多位皇子适龄，储位之争暗流涌动');
        }
      } else {
        GM.harem._successionDispute = false;
      }
    }

    // 1. 推进怀孕进度（用天数累计，约300天=10个月）
    if (GM.harem.pregnancies && GM.harem.pregnancies.length > 0) {
      var completed = [];
      GM.harem.pregnancies.forEach(function(preg) {
        preg.progressDays = (preg.progressDays || (preg.progress||0)*30) + _dpv;
        if (preg.progressDays >= 300) { // 约10个月=300天
          completed.push(preg);
        }
      });

      completed.forEach(function(preg) {
        var mother = findCharByName(preg.motherName);
        if (mother && mother.alive !== false) {
          addEB('\u5BAB\u4E2D\u559C\u8BAF', preg.motherName + '\u5373\u5C06\u4EA7\u5B50\uFF0C\u8BF7AI\u5728\u4E0B\u56DE\u5408\u901A\u8FC7new_characters\u5B89\u6392\u8BDE\u751F');
          preg.dueThisTurn = true;
        }
      });

      GM.harem.pregnancies = GM.harem.pregnancies.filter(function(p) { return !p.dueThisTurn; });
    }

    // 2. 子女年龄增长（累计天数跨365天时+1岁）
    var _prevDays = (GM.turn - 1) * _dpv;
    var _curDays = GM.turn * _dpv;
    var _yearCrossed = Math.floor(_curDays / 365) > Math.floor(_prevDays / 365);

    if (_yearCrossed && GM.chars) {
      GM.chars.forEach(function(c) {
        if (c.alive !== false && c.age !== undefined && typeof c.age === 'number') {
          c.age += 1;
        }
      });
    }

    // 3. 继承人排序更新（按嫡长子优先，再按年龄）
    this.updateSuccession();
  },

  // 登记怀孕（由AI通过事件触发，或玩家行录触发）
  registerPregnancy: function(motherName) {
    if (!GM.harem) GM.harem = { heirs: [], succession: 'eldest_legitimate', pregnancies: [] };
    if (!GM.harem.pregnancies) GM.harem.pregnancies = [];
    // 防止重复
    var existing = GM.harem.pregnancies.find(function(p) { return p.motherName === motherName; });
    if (existing) return;
    GM.harem.pregnancies.push({ motherName: motherName, progress: 0, startTurn: GM.turn });
    addEB('\u5BAB\u4E2D', motherName + '\u6709\u5B55');
    _dbg('[Harem] Pregnancy registered: ' + motherName);
  },

  // 更新继承人排序
  updateSuccession: function() {
    if (!GM.harem || !GM.chars) return;
    var playerName = P.playerInfo && P.playerInfo.characterName;
    if (!playerName) return;

    // 收集所有皇子（活着的男性子嗣）
    var princes = GM.chars.filter(function(c) {
      return c.alive !== false && c.parentOf === playerName && c.gender !== '\u5973';
    });
    if (princes.length === 0) { GM.harem.heirs = []; return; }

    // 排序：嫡子优先，年长优先
    princes.sort(function(a, b) {
      // 嫡子（母亲为正室）优先——使用朝代感知的位份判断
      var aLegit = 0, bLegit = 0;
      var aMom = GM.chars.find(function(c) { return c.children && c.children.indexOf(a.name) >= 0; });
      if (aMom && isLegitimateRank(aMom.spouseRank)) aLegit = 1;
      var bMom = GM.chars.find(function(c) { return c.children && c.children.indexOf(b.name) >= 0; });
      if (bMom && isLegitimateRank(bMom.spouseRank)) bLegit = 1;
      if (aLegit !== bLegit) return bLegit - aLegit;
      // 年长优先
      return (b.age || 0) - (a.age || 0);
    });

    GM.harem.heirs = princes.map(function(p) { return p.name; });
  }
};

// 注册到结算流水线
SettlementPipeline.register('haremSettle', '\u540E\u5BAB\u7ED3\u7B97', function() { HaremSettlement.settle(); }, 27, 'perturn');

// ============================================================
// 昏君活动系统 — TyrantActivitySystem
// 让玩家体验各种荒唐行为，提供丰富的正反馈叙事
// ============================================================
var TYRANT_ACTIVITIES = [
  // cost/gain 使用 costType:'economy'|'military' 和 costPct 百分比，运行时自动匹配剧本变量
  // —— 声色犬马 ——
  {id:'feast', name:'大摆宴席', icon:'🍷', category:'声色',
    desc:'连日宴饮，歌舞升平，美酒佳肴不断',
    flavor:['觥筹交错间，丝竹管弦之声不绝于耳。殿上珍馐百味，琼浆玉液，一夜消金千两。','今夜的宫宴极尽奢华。舞姬翩翩如仙鹤临风，乐师吹奏的曲调令人如痴如醉。酒酣之际，满殿都是笑声。','烛光摇曳，美人在侧。你举杯畅饮，暂时忘却了那些烦人的奏疏和边关急报。生为帝王，不就该如此快活？'],
    stress:-15, costType:'economy', costPct:0.03,
    aiHint:'大摆宴席，奢靡享乐'},
  {id:'harem', name:'广纳后宫', icon:'💃', category:'声色',
    desc:'选秀入宫，增添嫔妃',
    flavor:['新入宫的佳丽如云，各个姿色出众。你漫步其间，心旷神怡。天子坐拥天下，佳人自当如此。','采选之日，车马如龙。民间多少良家女子入了宫墙。有人哭，有人笑，但你只看到了那双含泪的眼——真美。','后宫又添新人。皇后面上不显，心中必已不悦。但你哪管得了这些？人生几何，当及时行乐。'],
    stress:-10, costType:'economy', costPct:0.02,
    aiHint:'选秀纳妃，沉溺美色'},
  {id:'hunt', name:'围猎三日', icon:'🏇', category:'声色',
    desc:'率禁军出京围猎，驰骋草原',
    flavor:['马蹄声碎，鹰隼高飞。你一骑绝尘，连射三鹿。风从耳畔呼啸而过，血脉偾张——这才是帝王该过的日子！','三日围猎，获鹿十二、獐八、雁无数。群臣齐声称贺。你策马而立，意气风发，仿佛天地间唯你一人。','随行将领争相献猎物。你纵马追逐一头白鹿直到暮色四合，笑声回荡在山谷之间。朝政？明日再说！'],
    stress:-20, costType:'economy', costPct:0.015,
    aiHint:'率众围猎，荒废数日朝政'},

  // —— 大兴土木 ——
  {id:'palace', name:'修建行宫', icon:'🏯', category:'土木',
    desc:'在风景秀美之处大兴土木修建行宫',
    flavor:['图纸上的行宫美轮美奂——九重台阁、曲水流觞、四季花园。工匠们说需要三千民夫和两年工期。你大手一挥：不惜工本！','新行宫选址于湖畔山麓。你亲自督工，连日不倦。群臣面面相觑，却无人敢言。造出来的那一刻，你会让他们知道什么叫千古一帝。','宫殿渐成，琉璃瓦在阳光下熠熠生辉。虽然国库为此消减了不少，但每次驻跸于此，你都觉得值了。'],
    stress:-8, costType:'economy', costPct:0.08,
    aiHint:'大兴土木修建行宫，劳民伤财'},
  {id:'tomb', name:'修建陵寝', icon:'⛰️', category:'土木',
    desc:'为自己提前修建宏伟的帝王陵寝',
    flavor:['你站在选定的风水宝地上，满意地点头。这里背山面水，龙脉所钟。你的陵寝要比先帝的更宏伟十倍。','地宫深入地下九层，以金银珠宝装饰。工程浩大，但你乐在其中——身后之事，岂可马虎？','方士说此处乃千年龙穴，葬于此处可保后世子孙万代昌盛。你听得龙颜大悦，当即加拨银两。'],
    stress:-5, costType:'economy', costPct:0.10,
    aiHint:'修建陵寝，大量消耗国帑'},

  // —— 求仙问道 ——
  {id:'alchemy', name:'炼丹求仙', icon:'🧪', category:'求仙',
    desc:'召集方士炼制仙丹，追求长生不老',
    flavor:['丹炉日夜不息，方士跪呈新炼的仙丹——通体金红，异香扑鼻。你服下一粒，顿觉精神百倍。长生不老，或许并非空谈？','今日的丹药让你感觉浑身燥热，但方士说这是"仙气灌体"的征兆。你深信不疑，又赏了千金。','紫烟缭绕的丹房中，你看着方士忙碌的身影，心中满是期待。若真能得道飞升，区区人间帝王又算得了什么？'],
    stress:-12, costType:'economy', costPct:0.04,
    aiHint:'迷信方术，炼丹服药'},
  {id:'taoism', name:'问道访仙', icon:'🏔️', category:'求仙',
    desc:'微服出宫寻访名山大川的高人隐士',
    flavor:['你扮作商旅，带了几个心腹出了宫。山间清风、林中鸟鸣，比御花园不知好了多少倍。一老道说你"帝王之气冲天"——你心中暗喜。','深山古观中，一老道为你推演天机。他说你前世是上界星君，今世当做八十年太平天子。你听后大笑，赏赐无数。','你在山间偶遇的隐士谈玄论道，令你心旷神怡。回宫后竟觉得朝堂上的争执都索然无味。凡人啊凡人……'],
    stress:-18, costType:'economy', costPct:0.015,
    aiHint:'微服出宫访仙问道，不理朝政'},

  // —— 穷兵黩武 ——
  {id:'war_glory', name:'御驾亲征', icon:'⚔️', category:'穷兵',
    desc:'不顾群臣反对亲率大军出征',
    flavor:['铁甲锵然，战旗猎猎。你端坐在御辇上，检阅十万大军。这才是帝王的气魄！什么宰相谏阻，什么粮草不济，朕亲率大军，谁能挡之？','出征前夜，你独自立于城楼之上。月光如水，你手按佩剑，豪情万丈。青史之上，哪个千古一帝不是马上得天下？','大军浩浩荡荡开出都城，百姓夹道观看。你意气风发地挥手致意。不管结果如何，至少这一刻你是真正的帝王。'],
    stress:-5, costType:'military', costPct:0.08,
    aiHint:'御驾亲征，不顾群臣反对'},
  {id:'expand', name:'穷兵开拓', icon:'🛡️', category:'穷兵',
    desc:'连年用兵，大举扩张疆土',
    flavor:['新的战报传来，又下一城！你在地图上重重画下新的疆域线，踌躇满志。四方蛮夷，终将臣服。','你下令再征十万壮丁入伍。民间有怨言，但你相信：只要打下更多的地盘，百姓终会理解你的雄才大略。','又一场大胜。你在庆功宴上对将军们许下厚赏——爵位、土地、金银。帝国的版图又大了一圈。'],
    stress:-8, costType:'military', costPct:0.05,
    aiHint:'穷兵黩武扩张领土'},

  // —— 宠佞弄权 ——
  {id:'favor_sycophant', name:'宠幸佞臣', icon:'🎭', category:'弄权',
    desc:'提拔善于逢迎拍马的小人',
    flavor:['新提拔的近臣真会说话。每句话都是你爱听的，每个表情都恰到好处。虽然群臣侧目，但你就是觉得——终于有人懂朕了。','佞臣跪献的礼物极合你心意。他笑着说"小的不过是尽臣子本分"。你龙颜大悦，当即封赏。那些整天板着脸进谏的忠臣，能有他这么贴心？','你把最信任的位置给了那个最会逢迎的人。朝堂上有人叹气，有人冷笑，但你毫不在意——朕的天下，朕做主。'],
    stress:-10,
    aiHint:'宠幸佞臣，排斥忠良'},
  {id:'eunuch_power', name:'重用内侍', icon:'🏠', category:'弄权',
    desc:'将大权交给身边的内侍/宦官',
    flavor:['内侍们日夜侍候在侧，比那些高高在上的宰相忠心多了。你索性让他们代批奏疏——反正那些奏疏看了也头疼。','你新赐予内侍总管监军之权。大臣们如丧考妣，但你觉得这些奴才反倒比臣子们可靠——至少他们离不开你。','内侍们的权力越来越大，朝臣们越来越沉默。宫中一派和谐。你满意地想：这才是朕要的太平。'],
    stress:-8,
    aiHint:'重用宦官/内侍，架空朝臣'},

  // —— 横征暴敛 ——
  {id:'heavy_tax', name:'加征重税', icon:'💰', category:'暴敛',
    desc:'巧立名目增加赋税',
    flavor:['新的税目设得极巧妙——商税、盐税、过路税、婚丧税……户部尚书虽然面色难看，但国库确实充盈了。你满意地点头：天下之财，尽归天子。','税吏们效率极高。仅一个月，国库就多了一大笔收入。至于民间的怨声——隔着宫墙，你听不见。','你创设了一种新税。佞臣们争相拍马，说这是"富国强兵之策"。忠臣们的反对声？不过是些迂腐之论罢了。'],
    stress:-3, gainType:'economy', gainPct:0.06,
    aiHint:'横征暴敛，加重赋税'},
  {id:'confiscate', name:'抄家灭族', icon:'🔥', category:'暴敛',
    desc:'以谋反之名抄没富户/功臣家产',
    flavor:['又一家"谋反"的大族被抄了。金银珠宝堆满了大殿。你随手拿起一块美玉把玩——这种感觉，真好。','抄家的士兵带回了整整三十车金银和珍宝字画。你在宝物中流连忘返。至于那个被灭族的大臣……他一定是真的谋反了，对吧？','群臣噤若寒蝉。但你不在乎——一来充实国库，二来铲除异己，何乐而不为？'],
    stress:-5, gainType:'economy', gainPct:0.12,
    aiHint:'罗织罪名抄家灭族'},

  // —— 文化毁灭 ——
  {id:'burn_books', name:'焚书禁学', icon:'📕', category:'文化',
    desc:'焚毁"妖书"，禁止私学议政',
    flavor:['大火冲天，那些"蛊惑人心"的书籍化为灰烬。你站在城楼上看着火光，心中一片安宁——再也没有人拿圣人之言来指责朕了。','禁令一下，天下肃然。私学关闭，议政之声绝迹。你终于耳根清净了。这才是天子该有的权威。','有大臣以头撞柱以死谏阻。你冷冷看着被拖走的尸体，淡淡说了句"收殓吧"。从此，再无人敢议。'],
    stress:-5,
    aiHint:'焚书禁学，钳制言论'},

  // —— 荒废朝政 ——
  {id:'skip_court', name:'罢朝不出', icon:'😴', category:'荒政',
    desc:'连日不上朝，在后宫嬉戏',
    flavor:['又是一个不想上朝的清晨。你翻了个身，把奏疏推开。外面的事，让宰相去烦吧。被窝里真暖和。','已经半个月没有上朝了。太监小心翼翼地说"群臣等候多时"，你挥挥手："就说朕龙体欠安。"','你在后苑里钓了一整天的鱼。晚间听说边关急报到了三道。你打了个哈欠：明天再看吧。'],
    stress:-20,
    aiHint:'罢朝不出，荒废政事'},
  {id:'play_craft', name:'沉迷杂艺', icon:'🎨', category:'荒政',
    desc:'沉迷于木工/绘画/蟋蟀/斗鸡等杂艺嗜好',
    flavor:['你精心雕刻的木器终于完工了。线条流畅，工艺精湛，连老工匠都赞不绝口。你举起作品端详，满心欢喜——这比批奏疏有趣多了！','今天的斗蟋蟀赢了三场！你激动地跳起来，赏赐了养蟋蟀的太监。朝臣们看你的眼神很复杂，但谁在乎呢？','你的画技又有精进。今日画了一幅《春山图》，连宫中画师都自叹不如。你得意地想：若不做皇帝，定是一代画圣。'],
    stress:-15,
    aiHint:'沉迷杂艺嗜好，不问政事'}
];

// ============================================================
// 变量角色映射——AI在游戏开始时确认哪个变量是经济/军事等
// ============================================================

// GM._varMapping = {economy:'财政', military:'兵力', food:'粮食', population:'人口', morale:'民心', ...}
// 由 AI 在 enterGame 时确认，之后所有系统使用此映射

function _findVarByType(type) {
  if (!GM.vars) return null;
  // 优先使用AI确认的映射
  if (GM._varMapping && GM._varMapping[type]) {
    var mapped = GM._varMapping[type];
    if (GM.vars[mapped]) return mapped;
  }
  // 兜底：遍历所有变量，用desc/name关键字模糊匹配
  var keys = Object.keys(GM.vars);
  var hints = {
    economy: ['财','金','银','铜','钱','库','帑','税','资金','贯','两','缗'],
    military: ['兵','军','甲','士','卒','禁','将','武','马'],
    food: ['粮','食','仓','谷','米','粟'],
    population: ['人口','民','户','丁'],
    morale: ['民心','人心','满意','民望','声望']
  };
  var hintList = hints[type];
  if (!hintList) return keys.length > 0 ? keys[0] : null;
  for (var i = 0; i < keys.length; i++) {
    var v = GM.vars[keys[i]];
    var searchText = keys[i] + (v.desc || '');
    for (var j = 0; j < hintList.length; j++) {
      if (searchText.indexOf(hintList[j]) >= 0) return keys[i];
    }
  }
  return null;
}

// AI确认变量映射（在enterGame时异步调用，不阻塞）
async function _aiConfirmVarMapping() {
  if (GM._varMapping) return; // 已映射过
  if (!P.ai || !P.ai.key) {
    // 无AI密钥——使用启发式自动映射
    _heuristicVarMapping();
    return;
  }
  var keys = Object.keys(GM.vars || {});
  if (keys.length === 0) return;

  var varList = keys.map(function(k) {
    var v = GM.vars[k];
    return k + '(' + v.min + '-' + v.max + (v.desc ? ',' + v.desc.slice(0, 20) : '') + ')';
  }).join('; ');

  var prompt = '以下是一个历史模拟游戏的变量列表：\n' + varList + '\n\n';
  prompt += '请判断每个变量的角色类型，返回JSON：\n';
  prompt += '{"economy":"最像国库/财政的变量名","military":"最像兵力/军队的变量名","food":"最像粮食的变量名(可null)","population":"最像人口的变量名(可null)","morale":"最像民心的变量名(可null)"}\n';
  prompt += '注意：直接返回变量名字符串，如果没有对应的就填null。只返回JSON。';

  try {
    var result = await callAI(prompt, 300);
    var parsed = extractJSON(result);
    if (parsed) {
      GM._varMapping = {};
      ['economy', 'military', 'food', 'population', 'morale'].forEach(function(role) {
        if (parsed[role] && typeof parsed[role] === 'string' && GM.vars[parsed[role]]) {
          GM._varMapping[role] = parsed[role];
        }
      });
      _dbg('[VarMapping] AI confirmed:', GM._varMapping);
    } else {
      _heuristicVarMapping();
    }
  } catch (e) {
    _dbg('[VarMapping] AI failed, fallback to heuristic:', e);
    _heuristicVarMapping();
  }
}

// 启发式映射（无AI时的兜底）
function _heuristicVarMapping() {
  GM._varMapping = {};
  ['economy', 'military', 'food', 'population', 'morale'].forEach(function(role) {
    var found = _findVarByType(role);
    if (found) GM._varMapping[role] = found;
  });
  _dbg('[VarMapping] Heuristic:', GM._varMapping);
}

// 注册到enterGame钩子（异步，不阻塞进入游戏）
GameHooks.on('enterGame:after', function() {
  _aiConfirmVarMapping();
});

// 将百分比消耗解析为实际数值
function _resolveTyrantCost(act) {
  var result = {costKey: null, costAmount: 0, gainKey: null, gainAmount: 0};
  if (act.costType && act.costPct) {
    var k = _findVarByType(act.costType);
    if (k && GM.vars[k]) {
      result.costKey = k;
      result.costAmount = Math.max(1, Math.round(GM.vars[k].max * act.costPct));
    }
  }
  if (act.gainType && act.gainPct) {
    var gk = _findVarByType(act.gainType);
    if (gk && GM.vars[gk]) {
      result.gainKey = gk;
      result.gainAmount = Math.max(1, Math.round(GM.vars[gk].max * act.gainPct));
    }
  }
  return result;
}

// 昏君活动系统
var TyrantActivitySystem = {
  // 本回合选中的活动
  selectedActivities: [],

  // 累计荒淫值（用于成就和AI叙事参考）
  getDecadence: function() { return GM._tyrantDecadence || 0; },

  // 选择/取消活动
  toggle: function(actId) {
    var idx = this.selectedActivities.indexOf(actId);
    if (idx >= 0) {
      this.selectedActivities.splice(idx, 1);
    } else {
      // 最多同时选3个
      if (this.selectedActivities.length >= 3) {
        toast('一回合最多选择三项活动');
        return;
      }
      this.selectedActivities.push(actId);
    }
    this.renderPanel();
  },

  // 收集本回合活动（供endTurn使用）
  collectActivities: function() {
    var self = this;
    var result = [];
    this.selectedActivities.forEach(function(id) {
      var act = TYRANT_ACTIVITIES.find(function(a) { return a.id === id; });
      if (act) result.push(act);
    });
    return result;
  },

  // 应用活动效果（在endTurn的系统更新阶段调用）
  applyEffects: function(activities) {
    if (!activities || activities.length === 0) return null;
    if (!GM._tyrantDecadence) GM._tyrantDecadence = 0;
    if (!GM._tyrantHistory) GM._tyrantHistory = [];

    var totalStress = 0;
    var flavorTexts = [];
    var costLog = [];
    var gainLog = [];

    activities.forEach(function(act) {
      // 随机选一条风味文本
      var flav = (act.flavor && act.flavor.length > 0) ? act.flavor[Math.floor(random() * act.flavor.length)] : act.desc || '';
      flavorTexts.push({name: act.name, icon: act.icon, text: flav});

      totalStress += act.stress || 0;

      // 根据百分比解析实际消耗/收益
      var resolved = _resolveTyrantCost(act);

      // 扣除消耗
      if (resolved.costKey && resolved.costAmount > 0 && GM.vars[resolved.costKey]) {
        GM.vars[resolved.costKey].value = clamp(
          GM.vars[resolved.costKey].value - resolved.costAmount,
          GM.vars[resolved.costKey].min, GM.vars[resolved.costKey].max
        );
        costLog.push(resolved.costKey + '-' + resolved.costAmount);
      }
      // 获得收益
      if (resolved.gainKey && resolved.gainAmount > 0 && GM.vars[resolved.gainKey]) {
        GM.vars[resolved.gainKey].value = clamp(
          GM.vars[resolved.gainKey].value + resolved.gainAmount,
          GM.vars[resolved.gainKey].min, GM.vars[resolved.gainKey].max
        );
        gainLog.push(resolved.gainKey + '+' + resolved.gainAmount);
      }

      // 记入事件日志
      addEB('\u5E1D\u738B\u884C\u6B62', act.icon + ' ' + act.name);
    });

    // 减压效果
    if (totalStress !== 0 && P.playerInfo && P.playerInfo.characterName) {
      var pCh = findCharByName(P.playerInfo.characterName);
      if (pCh) {
        pCh.stress = clamp((pCh.stress || 0) + totalStress, 0, 100);
      }
    }

    // 记录历史（_tyrantDecadence现在等于历史总活动数，不再是显式数字）
    GM._tyrantHistory.push({
      turn: GM.turn,
      acts: activities.map(function(a) { return a.id; })
    });
    // 根据历史计算内部值（用于AI参考，不向玩家展示）
    GM._tyrantDecadence = 0;
    GM._tyrantHistory.forEach(function(h) { GM._tyrantDecadence += (h.acts ? h.acts.length : 0) * 5; });

    // 记入玩家角色记忆
    if (typeof NpcMemorySystem !== 'undefined' && P.playerInfo && P.playerInfo.characterName) {
      var memDesc = activities.map(function(a) { return a.name; }).join('\u3001');
      NpcMemorySystem.remember(P.playerInfo.characterName, memDesc, '\u559C', 5);
    }

    // 清空选择
    this.selectedActivities = [];

    return {
      flavorTexts: flavorTexts,
      totalStress: totalStress,
      costLog: costLog,
      gainLog: gainLog
    };
  },

  // 生成AI提示（告诉AI玩家做了哪些昏君行为）
  getAIContext: function(activities) {
    if (!activities || activities.length === 0) return '';
    var ctx = '\n\u3010\u5E1D\u738B\u79C1\u884C\u3011\uFF08\u4EE5\u4E0B\u884C\u4E3A\u5DF2\u53D1\u751F\uFF0C\u8BF7\u5728\u53D9\u4E8B\u4E2D\u751F\u52A8\u63CF\u5199\u5176\u8FC7\u7A0B\u548C\u5373\u65F6\u611F\u53D7\u2014\u2014\u4EE5\u4EAB\u4E50\u7684\u6B63\u9762\u4F53\u9A8C\u4E3A\u4E3B\u8C03\uFF0C\u540E\u679C\u8BA9NPC\u548C\u5C40\u52BF\u81EA\u7136\u53CD\u5E94\uFF09\n';
    activities.forEach(function(act) {
      var resolved = _resolveTyrantCost(act);
      ctx += '  \u00B7 ' + act.icon + ' ' + act.name + '\uFF1A' + act.desc;
      if (resolved.costKey) ctx += '\uFF08\u8017' + resolved.costKey + '\uFF09';
      if (resolved.gainKey) ctx += '\uFF08\u5F97' + resolved.gainKey + '\uFF09';
      ctx += '\n';
    });
    // 根据历史频率判断严重程度（不显示具体数字）
    var histLen = GM._tyrantHistory ? GM._tyrantHistory.length : 0;
    if (histLen > 12) {
      ctx += '  \u203B \u5E1D\u738B\u957F\u671F\u653E\u7EB5\uFF0C\u660F\u5EB8\u4E4B\u540D\u5DF2\u5E7F\u4F20\u3002\u671D\u5802\u4EBA\u5FC3\u6D6E\u52A8\uFF0C\u8FB9\u5C06\u89C2\u671B\uFF0C\u6C11\u95F4\u8BAE\u8BBA\u7EB7\u7EB7\u3002\n';
      ctx += '  \u4F46\u53D9\u4E8B\u57FA\u8C03\u4ECD\u4EE5\u5E1D\u738B\u89C6\u89D2\u4E3A\u4E3B\u2014\u2014\u4ED6\u4EAB\u53D7\u7740\u6B64\u523B\uFF0C\u5BF9\u5916\u754C\u7684\u8BAE\u8BBA\u6D51\u7136\u4E0D\u89C9\u6216\u6BEB\u4E0D\u5728\u610F\u3002\n';
    } else if (histLen > 6) {
      ctx += '  \u203B \u5E1D\u738B\u6709\u653E\u7EB5\u4E4B\u540D\u3002\u5FE0\u81E3\u79C1\u4E0B\u5FE7\u8651\uFF0C\u4F5E\u81E3\u8D81\u673A\u9022\u8FCE\u3002\n';
      ctx += '  \u53D9\u4E8B\u4E2D\u4E0D\u8981\u76F4\u63A5\u6279\u8BC4\u2014\u2014\u8BA9\u4F5E\u81E3\u7684\u5949\u627F\u548C\u5FE0\u81E3\u7684\u53F9\u606F\u81EA\u7136\u4F53\u73B0\u5BF9\u6BD4\u3002\n';
    }
    // 资源状况对照（自动检测变量名）
    var _ecoKey = _findVarByType('economy');
    var _milKey = _findVarByType('military');
    if (_ecoKey && GM.vars[_ecoKey] && GM.vars[_ecoKey].value < GM.vars[_ecoKey].max * 0.2) {
      ctx += '  \u203B \u56FD\u5E93\u5DF2\u8FD1\u7A7A\u865A\uFF0C\u4F46\u5E1D\u738B\u4ECD\u5728\u6325\u970D\u3002\u4F5E\u81E3\u4E0D\u6562\u63D0\u9192\uFF0C\u5FE0\u81E3\u594F\u62A5\u88AB\u6401\u7F6E\u3002\n';
    }
    if (_milKey && GM.vars[_milKey] && GM.vars[_milKey].value < GM.vars[_milKey].max * 0.3) {
      ctx += '  \u203B \u5175\u529B\u8584\u5F31\uFF0C\u800C\u5E1D\u738B\u65E0\u5FC3\u519B\u52A1\u3002\u8FB9\u9632\u662F\u5426\u7A7A\u865A\uFF1F\n';
    }
    return ctx;
  },

  // 渲染活动面板
  renderPanel: function() {
    var el = _$('tyrant-panel');
    if (!el) return;
    var self = this;
    var categories = {};
    TYRANT_ACTIVITIES.forEach(function(act) {
      if (!categories[act.category]) categories[act.category] = [];
      categories[act.category].push(act);
    });

    var catNames = {'声色':'声色犬马','土木':'大兴土木','求仙':'求仙问道','穷兵':'穷兵黩武','弄权':'宠佞弄权','暴敛':'横征暴敛','文化':'文化毁灭','荒政':'荒废朝政'};
    var catIcons = (typeof tmIcon==='function')?{'声色':tmIcon('person',13),'土木':tmIcon('office',13),'求仙':tmIcon('scroll',13),'穷兵':tmIcon('troops',13),'弄权':tmIcon('strife',13),'暴敛':tmIcon('treasury',13),'文化':tmIcon('chronicle',13),'荒政':tmIcon('end-turn',13)}:{};

    var h = '';
    var selCount = self.selectedActivities.length;

    // 不显示荒淫值数字——玩家应通过NPC反应和叙事感受到后果
    // 仅显示关键资源速览
    if (GM.vars) {
      var _eKey = _findVarByType('economy');
      var _mKey = _findVarByType('military');
      var _resItems = [];
      if (_eKey && GM.vars[_eKey]) _resItems.push(_eKey + ':' + Math.round(GM.vars[_eKey].value));
      if (_mKey && GM.vars[_mKey]) _resItems.push(_mKey + ':' + Math.round(GM.vars[_mKey].value));
      if (_resItems.length > 0) {
        h += '<div style="font-size:0.65rem;color:var(--txt-d);text-align:center;margin-bottom:0.3rem;">' + _resItems.join(' | ') + '</div>';
      }
    }

    Object.keys(categories).forEach(function(cat) {
      h += '<div style="margin-bottom:0.5rem;">';
      h += '<div style="font-size:0.75rem;color:var(--gold-d);margin-bottom:0.2rem;">' + (catIcons[cat] || '') + ' ' + (catNames[cat] || cat) + '</div>';
      h += '<div style="display:flex;flex-wrap:wrap;gap:0.3rem;">';
      categories[cat].forEach(function(act) {
        var selected = self.selectedActivities.indexOf(act.id) >= 0;
        var resolved = _resolveTyrantCost(act);
        var costText = '';
        var canAfford = true;
        if (resolved.costKey && resolved.costAmount > 0) {
          var _curVal = GM.vars[resolved.costKey] ? GM.vars[resolved.costKey].value : 0;
          costText = resolved.costKey + '-' + resolved.costAmount;
          if (_curVal < resolved.costAmount) canAfford = false;
        }
        if (resolved.gainKey && resolved.gainAmount > 0) {
          costText = resolved.gainKey + '+' + resolved.gainAmount;
        }
        var stressText = act.stress < 0 ? '\u538B\u529B' + act.stress : '';
        var _disabledStyle = !canAfford && !selected ? 'opacity:0.5;' : '';
        var _onclickFn = !canAfford && !selected
          ? "toast('\u8D44\u6E90\u4E0D\u8DB3')"
          : "TyrantActivitySystem.toggle('" + act.id + "')";

        h += '<div class="tyrant-act-btn' + (selected ? ' selected' : '') + '" style="' + _disabledStyle + '" onclick="' + _onclickFn + '" title="' + escHtml(act.desc) + (costText ? '\n' + costText : '') + (stressText ? '\n' + stressText : '') + '">';
        h += '<span>' + act.icon + '</span> ' + act.name;
        if (selected) h += ' <span style="color:var(--green);font-size:0.7rem;">\u2713</span>';
        h += '</div>';
      });
      h += '</div></div>';
    });

    if (selCount > 0) {
      h += '<div style="font-size:0.72rem;color:var(--gold);text-align:center;margin-top:0.3rem;">已选 ' + selCount + '/3 项活动，结束回合时生效</div>';
    }

    el.innerHTML = h;
  }
};

// ============================================================
// 事件类型白名单系统
// ============================================================

var EventConstraintSystem = (function() {
  'use strict';

  function _getConfig() {
    return P.eventConstraints || { enabled: false, types: [] };
  }

  /**
   * 校验AI生成的事件是否符合白名单约束
   * @param {Object} event - AI返回的事件 {type, title, ...}
   * @returns {{allowed:boolean, reason:string, downgraded:boolean}}
   */
  function validate(event) {
    var cfg = _getConfig();
    if (!cfg.enabled || !cfg.types || cfg.types.length === 0) {
      return { allowed: true, reason: '', downgraded: false };
    }

    if (!event || !event.type) return { allowed: true, reason: '', downgraded: false };

    // 查找白名单中匹配的类型
    var typeDef = cfg.types.find(function(t) {
      return t.id === event.type || t.name === event.type;
    });

    // 不在白名单中
    if (!typeDef) {
      var policy = cfg.unknownPolicy || 'narrative_only';
      if (policy === 'block') return { allowed: false, reason: '事件类型"' + event.type + '"不在白名单中', downgraded: false };
      return { allowed: true, reason: '', downgraded: true }; // 降级为纯叙事，无机械效果
    }

    // 检查频率上限
    if (typeDef.maxPerYear) {
      if (!GM.eventCooldowns) GM.eventCooldowns = {};
      var yearKey = event.type + '_year';
      var yearCount = GM.eventCooldowns[yearKey] || 0;
      // 判断是否同一年内（用isYearBoundary重置）
      if (yearCount >= typeDef.maxPerYear) {
        return { allowed: false, reason: '事件"' + typeDef.name + '"本年已达上限(' + typeDef.maxPerYear + '次)', downgraded: false };
      }
    }

    // 检查最小间隔
    if (typeDef.minIntervalMonths) {
      var intervalTurns = (typeof turnsForMonths === 'function') ? turnsForMonths(typeDef.minIntervalMonths) : typeDef.minIntervalMonths;
      var lastKey = event.type + '_last';
      var lastTurn = (GM.eventCooldowns && GM.eventCooldowns[lastKey]) || 0;
      if (lastTurn > 0 && GM.turn - lastTurn < intervalTurns) {
        return { allowed: false, reason: '事件"' + typeDef.name + '"冷却中(剩' + (intervalTurns - (GM.turn - lastTurn)) + '回合)', downgraded: false };
      }
    }

    // 检查条件（简单表达式）
    if (typeDef.condition) {
      var condMet = _evaluateSimpleCondition(typeDef.condition);
      if (!condMet) {
        return { allowed: false, reason: '事件"' + typeDef.name + '"条件不满足: ' + typeDef.condition, downgraded: false };
      }
    }

    return { allowed: true, reason: '', downgraded: false, priority: typeDef.priority || 'normal' };
  }

  /**
   * 记录事件触发（更新冷却计数）
   */
  function recordTriggered(eventType) {
    if (!GM.eventCooldowns) GM.eventCooldowns = {};
    GM.eventCooldowns[eventType + '_last'] = GM.turn;
    GM.eventCooldowns[eventType + '_year'] = (GM.eventCooldowns[eventType + '_year'] || 0) + 1;
  }

  /**
   * 年度重置频率计数
   */
  function resetYearlyCounts() {
    if (!GM.eventCooldowns) return;
    Object.keys(GM.eventCooldowns).forEach(function(k) {
      if (k.endsWith('_year')) GM.eventCooldowns[k] = 0;
    });
  }

  function _evaluateSimpleCondition(cond) {
    // 简单条件: "unrest>=50" / "partyStrife>=80" / "prosperity<=0.3"
    var m = cond.match(/^(\w+)(>=|<=|>|<|==)(.+)$/);
    if (!m) return true;
    var field = m[1], op = m[2], val = parseFloat(m[3]);
    var actual = 0;
    // 从GM直接读取
    if (GM[field] !== undefined) actual = GM[field];
    else if (GM.eraState && GM.eraState[field] !== undefined) actual = GM.eraState[field];
    else if (GM.vars && GM.vars[field]) actual = GM.vars[field].value;
    if (op === '>=') return actual >= val;
    if (op === '<=') return actual <= val;
    if (op === '>') return actual > val;
    if (op === '<') return actual < val;
    if (op === '==') return actual == val;
    return true;
  }

  return { validate: validate, recordTriggered: recordTriggered, resetYearlyCounts: resetYearlyCounts };
})();

// ============================================================
// 五常语义层 — 在8D性格向量之上叠加仁义礼智信
// 面向AI和玩家的中国文化语义标签，不替代8D底层参数
// ============================================================

/**
 * 计算角色的五常值（仁义礼智信，0-100）
 * 优先使用手动覆盖(wuchangOverride)，否则从8D性格+特质修正派生
 * @param {Object} character - 角色对象
 * @returns {{仁:number,义:number,礼:number,智:number,信:number,气质:string}}
 */
function calculateWuchang(character) {
  if (!character) return {仁:50,义:50,礼:50,智:50,信:50,气质:'平和'};

  // 读取8D性格向量（可能由calcPersonality计算或特质定义）
  var dims = character._calculatedDims || {};
  // 若无预计算，尝试从特质动态计算
  if (!dims.compassion && character.traitIds && P.traitDefinitions) {
    dims = {boldness:0,compassion:0,greed:0,honor:0,rationality:0,sociability:0,vengefulness:0,energy:0};
    character.traitIds.forEach(function(tid) {
      var td = P.traitDefinitions.find(function(t){return t.id===tid;});
      if (td && td.dims) {
        Object.keys(td.dims).forEach(function(k) { dims[k] = (dims[k]||0) + (td.dims[k]||0); });
      }
    });
    // 钳制到[-1,1]
    Object.keys(dims).forEach(function(k) { dims[k] = Math.max(-1, Math.min(1, dims[k])); });
  }

  // 特质五常修正（如有wuchangMod字段）
  var traitMod = {仁:0,义:0,礼:0,智:0,信:0};
  if (character.traitIds && P.traitDefinitions) {
    character.traitIds.forEach(function(tid) {
      var td = P.traitDefinitions.find(function(t){return t.id===tid;});
      if (td && td.wuchangMod) {
        Object.keys(td.wuchangMod).forEach(function(k) { traitMod[k] = (traitMod[k]||0) + (td.wuchangMod[k]||0); });
      }
    });
  }

  // 从8D派生五常基础值
  var c = dims.compassion||0, h = dims.honor||0, s = dims.sociability||0;
  var r = dims.rationality||0, b = dims.boldness||0, v = dims.vengefulness||0;
  var e = dims.energy||0, g = dims.greed||0;

  var wc = {
    仁: clamp(Math.round((c*0.6 + h*0.2 + s*0.2)*100 + traitMod.仁), 0, 100),
    义: clamp(Math.round((h*0.5 + b*0.3 + v*0.2)*100 + traitMod.义), 0, 100),
    礼: clamp(Math.round((h*0.4 + s*0.3 + r*0.3)*100 + traitMod.礼), 0, 100),
    智: clamp(Math.round((r*0.6 + e*0.2 + b*0.2)*100 + traitMod.智), 0, 100),
    信: clamp(Math.round((h*0.5 + c*0.2 + s*0.3 - g*0.5)*100 + traitMod.信), 0, 100)
  };

  // 手动覆盖（编辑器中为历史名人精确定位）
  var ov = character.wuchangOverride;
  if (ov) {
    if (typeof ov.仁 === 'number') wc.仁 = ov.仁;
    if (typeof ov.义 === 'number') wc.义 = ov.义;
    if (typeof ov.礼 === 'number') wc.礼 = ov.礼;
    if (typeof ov.智 === 'number') wc.智 = ov.智;
    if (typeof ov.信 === 'number') wc.信 = ov.信;
  }

  // 也可从角色的直接属性映射（兼容现有数据）
  // benevolence→仁, valor→义的辅助分量, intelligence→智的辅助分量
  if (character.benevolence && !ov) wc.仁 = clamp(Math.round((wc.仁 + character.benevolence) / 2), 0, 100);
  if (character.intelligence && !ov) wc.智 = clamp(Math.round((wc.智 + character.intelligence) / 2), 0, 100);

  // 气质（四选一，取最高分）
  var temperaments = {
    '刚烈': wc.义*0.4 + wc.礼*0.3 - wc.仁*0.3,     // 岳飞/海瑞型
    '豪爽': wc.仁*0.4 + wc.义*0.3 - wc.礼*0.3,     // 李白/苏轼型
    '沉郁': wc.智*0.4 + wc.信*0.3 - wc.义*0.3,     // 诸葛亮/张居正型
    '恬淡': wc.仁*0.3 + wc.信*0.4 - wc.智*0.3      // 陶渊明型
  };
  var maxTemp = '平和', maxVal = -Infinity;
  Object.keys(temperaments).forEach(function(k) {
    if (temperaments[k] > maxVal) { maxVal = temperaments[k]; maxTemp = k; }
  });
  // 如果所有分数都很低（<10），归为"平和"
  if (maxVal < 10) maxTemp = '平和';
  wc.气质 = maxTemp;

  return wc;
}

/**
 * 获取五常的简短文本描述（用于AI prompt）
 * @param {Object} character
 * @returns {string} 如 "五常:仁72义35礼60智80信45 气质:沉郁"
 */
function getWuchangText(character) {
  var wc = calculateWuchang(character);
  return '五常:仁' + wc.仁 + '义' + wc.义 + '礼' + wc.礼 + '智' + wc.智 + '信' + wc.信 + ' 气质:' + wc.气质;
}

// ============================================================
// 家世门第系统
// ============================================================

var FAMILY_STATUS_LEVELS = {
  imperial: {name:'皇族', level:1, description:'天潢贵胄'},
  noble: {name:'世族', level:2, description:'累世公卿'},
  scholar: {name:'士族', level:3, description:'诗书传家'},
  commoner: {name:'寒门', level:4, description:'布衣出身'},
  peasant: {name:'庶民', level:5, description:'黎庶百姓'},
  outcast: {name:'贱籍', level:6, description:'贱民出身'}
};

/**
 * 获取角色家世文本
 * @param {Object} character
 * @returns {string} 如 "家世:士族(陇西李氏)声望75"
 */
function getFamilyStatusText(character) {
  if (!character) return '';
  var fs = character.familyStatus;
  if (!fs || !fs.门第) return '';
  var def = FAMILY_STATUS_LEVELS[fs.门第] || {};
  var text = '家世:' + (def.name || fs.门第);
  if (fs.郡望) text += '(' + fs.郡望 + ')';
  if (fs.声望) text += '声望' + fs.声望;
  return text;
}

/**
 * 计算家世对出仕的门槛修正
 * @param {Object} character
 * @returns {number} 乘数（1.0=无修正，>1=更难）
 */
function getFamilyBarrierMultiplier(character) {
  if (!character || !character.familyStatus) return 1.0;
  var level = (FAMILY_STATUS_LEVELS[character.familyStatus.门第] || {}).level || 4;
  return 1 + (level - 1) * 0.12; // imperial=1.0, noble=1.12, scholar=1.24, commoner=1.36, peasant=1.48, outcast=1.60
}

// ============================================================
// 恩怨系统 — 结构化恩/怨追踪
// ============================================================

var EnYuanSystem = (function() {
  'use strict';

  /**
   * 添加恩怨记录
   * @param {string} type - 'en'(恩) | 'yuan'(怨)
   * @param {string} from - 施恩/结怨者
   * @param {string} to - 受恩/受害者
   * @param {number} 强度 - 1-5
   * @param {string} 事由
   * @param {boolean} [不共戴天] - 杀父/灭族级仇恨，永不衰减
   */
  function add(type, from, to, 强度, 事由, 不共戴天) {
    if (!GM.enYuanRecords) GM.enYuanRecords = [];
    GM.enYuanRecords.push({
      type: type,
      from: from,
      to: to,
      强度: clamp(强度 || 1, 1, 5),
      事由: 事由 || '',
      turn: GM.turn,
      衰减率: type === 'en' ? 0.05 : 0.02, // 恩5%/回合衰减，怨2%
      不共戴天: !!不共戴天,
      currentValue: (强度 || 1) * (type === 'en' ? 10 : 15) // 恩×10, 怨×15
    });
  }

  /**
   * 每回合衰减恩怨（按timeRatio缩放）
   */
  function decay() {
    if (!GM.enYuanRecords || !GM.enYuanRecords.length) return;
    // 衰减率是月基准（恩5%/月，怨2%/月），按天数比例缩放
    var _ms = (typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn() : 30) / 30;

    GM.enYuanRecords = GM.enYuanRecords.filter(function(r) {
      if (r.不共戴天) return true; // 永不衰减
      r.currentValue = r.currentValue * (1 - r.衰减率 * _ms);
      return r.currentValue >= 0.5; // 低于0.5则移除
    });
  }

  /**
   * 获取from对to的恩怨好感修正
   * @returns {number} 正=恩多，负=怨多
   */
  function getModifier(from, to) {
    if (!GM.enYuanRecords) return 0;
    var total = 0;
    GM.enYuanRecords.forEach(function(r) {
      if (r.from === from && r.to === to) {
        total += (r.type === 'en' ? 1 : -1) * r.currentValue;
      }
    });
    return Math.round(total);
  }

  /**
   * 获取角色间恩怨的AI prompt文本
   * @param {string} charName
   * @returns {string}
   */
  function getTextForChar(charName) {
    if (!GM.enYuanRecords || !GM.enYuanRecords.length) return '';
    var parts = [];
    GM.enYuanRecords.forEach(function(r) {
      if (r.from === charName && r.currentValue >= 1) {
        var typeStr = r.type === 'en' ? '恩' : '怨';
        parts.push('对' + r.to + typeStr + Math.round(r.currentValue) + '(' + r.事由 + (r.不共戴天 ? '·不共戴天' : '') + ')');
      }
    });
    return parts.length > 0 ? '恩怨:' + parts.join('; ') : '';
  }

  return {
    add: add,
    decay: decay,
    getModifier: getModifier,
    getTextForChar: getTextForChar
  };
})();

// 注册恩怨衰减到SettlementPipeline
SettlementPipeline.register('enYuanDecay', '恩怨衰减', function() {
  EnYuanSystem.decay();
}, 60, 'perturn');

// ============================================================
// 门生故吏网络
// ============================================================

var PatronNetwork = (function() {
  'use strict';

  /**
   * 建立门生关系
   * @param {string} 座主 - 举荐者角色名
   * @param {string} 门生 - 被举荐者角色名
   * @param {string} 关系类型 - '座主门生'|'同年'|'同乡'|'故吏'|'姻亲'
   * @param {number} [亲密度] - 初始亲密度(0-100)
   */
  function establish(座主, 门生, 关系类型, 亲密度) {
    if (!GM.patronNetwork) GM.patronNetwork = [];
    // 检查重复
    var exists = GM.patronNetwork.some(function(r) {
      return r.座主 === 座主 && r.门生 === 门生 && r.关系类型 === 关系类型;
    });
    if (exists) return;

    GM.patronNetwork.push({
      座主: 座主,
      门生: 门生,
      关系类型: 关系类型 || '座主门生',
      turn: GM.turn,
      亲密度: 亲密度 || 60
    });
  }

  /**
   * 获取角色的门生网络AI prompt文本
   */
  function getTextForChar(charName) {
    if (!GM.patronNetwork || !GM.patronNetwork.length) return '';
    var parts = [];
    GM.patronNetwork.forEach(function(r) {
      if (r.座主 === charName) parts.push('门生' + r.门生 + '(' + r.关系类型 + ')');
      if (r.门生 === charName) parts.push('座主' + r.座主 + '(' + r.关系类型 + ')');
    });
    // 同年关系
    GM.patronNetwork.forEach(function(r) {
      if (r.关系类型 === '同年' && (r.座主 === charName || r.门生 === charName)) {
        var other = r.座主 === charName ? r.门生 : r.座主;
        if (parts.indexOf('同年' + other) < 0) parts.push('同年' + other);
      }
    });
    return parts.length > 0 ? '门生:' + parts.join(',') : '';
  }

  /**
   * 获取观感修正（门生关系带来的好感加成）
   */
  function getOpinionModifier(from, to) {
    if (!GM.patronNetwork) return 0;
    var mod = 0;
    GM.patronNetwork.forEach(function(r) {
      // 座主→门生: +20亲+15恩
      if (r.座主 === from && r.门生 === to) mod += 20;
      // 门生→座主: +25恩+20敬+15亲
      if (r.门生 === from && r.座主 === to) mod += 25;
      // 同门（同一座主）: +10
      if (r.关系类型 !== '同年') {
        GM.patronNetwork.forEach(function(r2) {
          if (r2.座主 === r.座主 && r.门生 === from && r2.门生 === to) mod += 10;
        });
      }
      // 同年: +10
      if (r.关系类型 === '同年') {
        if ((r.座主 === from && r.门生 === to) || (r.门生 === from && r.座主 === to)) mod += 10;
      }
    });
    return mod;
  }

  /**
   * 座主被杀→门生对凶手产生仇恨
   * @param {string} 座主Name - 被杀的座主
   * @param {string} killerName - 凶手
   */
  function onPatronKilled(座主Name, killerName) {
    if (!GM.patronNetwork) return;
    GM.patronNetwork.forEach(function(r) {
      if (r.座主 === 座主Name) {
        EnYuanSystem.add('yuan', r.门生, killerName, 4, '杀害座主' + 座主Name, random() < 0.3); // 30%概率不共戴天
      }
    });
  }

  return {
    establish: establish,
    getTextForChar: getTextForChar,
    getOpinionModifier: getOpinionModifier,
    onPatronKilled: onPatronKilled
  };
})();

// ============================================================
// 矛盾演化系统 — ContradictionSystem
// 让剧本的"显著矛盾"成为动态生命体
// ============================================================
var ContradictionSystem = (function() {
  'use strict';

  /** 维度→关联GM字段映射 */
  var _dimFields = {
    political: ['partyStrife','prestige'],
    economic: ['taxPressure','unrest'],
    military: ['unrest','prestige'],
    social: ['unrest','partyStrife']
  };

  /**
   * 初始化：为每个矛盾补全运行时字段
   */
  function initialize() {
    var sc = typeof findScenarioById === 'function' ? findScenarioById(GM.sid) : null;
    var pi = sc && sc.playerInfo ? sc.playerInfo : {};
    var contrs = pi.coreContradictions || [];
    if (!GM._contradictions) GM._contradictions = [];
    contrs.forEach(function(c, i) {
      if (!GM._contradictions[i]) {
        GM._contradictions[i] = {
          title: c.title || '',
          dimension: c.dimension || 'political',
          severity: c.severity || 'major',
          intensity: c.severity === 'critical' ? 60 : c.severity === 'major' ? 40 : 20,
          phase: 'latent',
          lastEscalation: 0
        };
      }
    });
  }

  /**
   * 每回合更新矛盾强度和阶段
   */
  function update() {
    if (!GM._contradictions || !GM._contradictions.length) return;
    var _ms = _getDaysPerTurn() / 30;

    GM._contradictions.forEach(function(c) {
      if (c.phase === 'resolved') return;

      // 根据关联字段计算压力值
      var fields = _dimFields[c.dimension] || ['unrest'];
      var pressure = 0;
      fields.forEach(function(f) {
        var val = GM[f] || 0;
        pressure += val > 60 ? (val - 60) * 0.3 : val < 30 ? -(30 - val) * 0.2 : 0;
      });

      // intensity 自然衰减 + 压力驱动（月基准）
      c.intensity = Math.max(0, Math.min(100, c.intensity + pressure * 0.02 * _ms - 0.2 * _ms));

      // 阶段跃迁
      var oldPhase = c.phase;
      if (c.intensity >= 90 && c.phase !== 'crisis') {
        c.phase = 'crisis';
        c.lastEscalation = GM.turn;
        if (typeof addEB === 'function') addEB('矛盾爆发', '〔' + c.title + '〕已升级为危机！');
        if (GM.qijuHistory) GM.qijuHistory.unshift({ turn: GM.turn, date: typeof getTSText === 'function' ? getTSText(GM.turn) : '', content: '【矛盾危机】' + c.title + '已全面激化，朝野震动。' });
      } else if (c.intensity >= 70 && c.phase === 'latent') {
        c.phase = 'escalating';
        c.lastEscalation = GM.turn;
        if (typeof addEB === 'function') addEB('矛盾激化', '〔' + c.title + '〕正在激化');
      } else if (c.intensity < 20 && (c.phase === 'escalating' || c.phase === 'crisis')) {
        c.phase = 'resolved';
        if (typeof addEB === 'function') addEB('矛盾缓解', '〔' + c.title + '〕已得到解决');
        if (GM.biannianItems) GM.biannianItems.unshift({ turn: GM.turn, date: typeof getTSText === 'function' ? getTSText(GM.turn) : '', title: '矛盾解决：' + c.title, content: '经朝廷多方施策，' + c.title + '之患终得平息。', importance: 'high' });
      }
    });
  }

  /**
   * 生成AI注入文本
   */
  function getPromptInjection() {
    if (!GM._contradictions || !GM._contradictions.length) return '';
    var active = GM._contradictions.filter(function(c) { return c.phase !== 'resolved'; });
    if (!active.length) return '';
    var lines = ['【显著矛盾·当前态势】'];
    var phaseNames = { latent: '潜伏', escalating: '激化中', crisis: '危机' };
    active.forEach(function(c) {
      lines.push('- ' + c.title + '（' + (phaseNames[c.phase] || c.phase) + '，烈度' + Math.round(c.intensity) + '/100）');
      if (c.phase === 'crisis') lines.push('  ⚠ 此矛盾已爆发为危机，本回合叙事应以此为核心冲突！');
      else if (c.phase === 'escalating') lines.push('  本回合叙事应体现此矛盾的加剧。');
    });
    return lines.join('\n');
  }

  return { initialize: initialize, update: update, getPromptInjection: getPromptInjection };
})();

// 注册矛盾演化到结算流水线
SettlementPipeline.register('contradictions', '矛盾演化', function() {
  ContradictionSystem.update();
}, 16, 'monthly');
