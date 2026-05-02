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
          if (TM.safeEval(rule.condition, { char: ch, GM: GM })) {
            factors.push(rule.label || rule.condition);
          }
        } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
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
  remember: function(charName, event, emotion, importance, relatedPerson, meta) {
    if (!GM.chars) return;
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    if (!ch || ch.alive === false) return;
    if (!ch._memory) ch._memory = [];
    if (!ch._memArchive) ch._memArchive = [];

    // 4.4: 结构化记忆类型推断
    var memType = (meta && meta.type) || 'general';
    if (memType === 'general') {
      if (/背叛|叛|反|谋|阴谋/.test(event)) memType = 'betrayal';
      else if (/恩|救|助|赏|赐|提拔|擢升/.test(event)) memType = 'kindness';
      else if (/辱|羞|贬|斥|罢/.test(event)) memType = 'humiliation';
      else if (/升|任|封|授|入仕|及第/.test(event)) memType = 'promotion';
      else if (/亡|死|丧|失|败/.test(event)) memType = 'loss';
      else if (/婚|嫁|娶|联姻/.test(event)) memType = 'marriage';
      else if (/战|征|伐|胜|败/.test(event)) memType = 'military';
      else if (/问对|谈|说|议/.test(event)) memType = 'dialogue';
    }

    var memEntry = {
      event: event,
      emotion: emotion || '平',
      importance: Math.max(0.1, Math.min(10, importance || 5)),
      turn: GM.turn,
      who: relatedPerson || '',
      type: memType,
      // === 方向4/13：感官+可信度扩展字段 ===
      location: (meta && meta.location) || '',
      witnesses: (meta && Array.isArray(meta.witnesses)) ? meta.witnesses.slice(0, 6) : [],
      source: (meta && meta.source) || 'witnessed',  // witnessed/reported/rumor/intuition
      credibility: (meta && meta.credibility != null) ? Math.max(0, Math.min(100, meta.credibility)) : 95,
      arcId: (meta && meta.arcId) || '',
      participants: (meta && Array.isArray(meta.participants)) ? meta.participants.slice(0, 10) : []
    };
    ch._memory.push(memEntry);
    if (typeof CharFullSchema !== 'undefined' && typeof CharFullSchema.syncInteractionMemory === 'function') {
      try { CharFullSchema.syncInteractionMemory(ch, memEntry, relatedPerson); } catch(_) {}
    }

    // === 方向5：全量无损归档（永不压缩） ===
    if (!GM._memoryArchiveFull) GM._memoryArchiveFull = [];
    var archiveEntry = Object.assign({}, memEntry, { char: charName, archiveTurn: GM.turn });
    GM._memoryArchiveFull.push(archiveEntry);

    // === 方向11：关系历史快照（favor 变化 ≥5 时记录） ===
    if (relatedPerson && relatedPerson !== charName) {
      if (!ch._impressions) ch._impressions = {};
      if (!ch._impressions[relatedPerson]) ch._impressions[relatedPerson] = { favor: 0, events: [] };
      var imp = ch._impressions[relatedPerson];
      var impWeight = Math.max(1, Math.min(importance || 5, 10)) / 5;
      var baseDelta = emotion === '喜' || emotion === '敬' ? 3 : emotion === '怒' || emotion === '恨' ? -4 : emotion === '忧' || emotion === '惧' ? -1 : 0;
      var delta = Math.round(baseDelta * impWeight);
      var oldFavor = imp.favor;
      imp.favor = Math.max(-100, Math.min(100, imp.favor + delta));
      imp.events.push(event.slice(0, 25));
      if (imp.events.length > 8) imp.events = imp.events.slice(-8);
      // 关系变化快照
      if (Math.abs(imp.favor - oldFavor) >= 5) {
        if (!ch._relationHistory) ch._relationHistory = {};
        if (!ch._relationHistory[relatedPerson]) ch._relationHistory[relatedPerson] = [];
        ch._relationHistory[relatedPerson].push({
          turn: GM.turn,
          favor: imp.favor,
          delta: imp.favor - oldFavor,
          reason: event.slice(0, 40),
          trigger: memType
        });
        if (ch._relationHistory[relatedPerson].length > 40) ch._relationHistory[relatedPerson] = ch._relationHistory[relatedPerson].slice(-40);
      }
    }

    NpcMemorySystem._updateMood(ch);
    if (NpcMemorySystem._memCache && NpcMemorySystem._memCache[charName]) delete NpcMemorySystem._memCache[charName];

    var _cap = NpcMemorySystem.getCapacity(ch);
    if (ch._memory.length > _cap.active) {
      if (ch._lastDecayTurn !== GM.turn) {
        ch._lastDecayTurn = GM.turn;
        var _monthScale = (typeof getTimeRatio === 'function') ? getTimeRatio() * 12 : 1;
        ch._memory.forEach(function(m) {
          if (m.turn >= GM.turn) return;
          var baseRate = (m.emotion === '\u6012' || m.emotion === '\u6068') ? 0.02 : 0.05;
          m.importance = Math.max(0.1, Math.min(10, (m.importance || 5) - baseRate * _monthScale));
        });
      }
      NpcMemorySystem._compressMemory(ch, _cap);
    }

    // === 方向2：互动镜像——为 relatedPerson 自动写入对应记忆 ===
    if (!(meta && meta._noMirror) && relatedPerson && relatedPerson !== charName) {
      NpcMemorySystem._mirrorToOther(charName, event, emotion, importance, relatedPerson, meta);
    }

    // === 方向2扩展：为所有 participants 写入（防镜像递归 + 必须是顶层调用）===
    if (meta && !meta._noMirror && Array.isArray(meta.participants) && meta.participants.length > 0) {
      meta.participants.forEach(function(pName) {
        if (!pName || pName === charName || pName === relatedPerson) return;
        NpcMemorySystem._mirrorToOther(charName, event, emotion, importance, pName, Object.assign({}, meta, { _noMirror: true, _asParticipant: true, participants: [] }));
      });
    }
  },

  /** 方向2：把事件镜像到另一方·情绪自动翻转 */
  _mirrorToOther: function(originName, event, emotion, importance, otherName, meta) {
    if (!GM.chars) return;
    var other = GM.chars.find(function(c) { return c.name === otherName; });
    if (!other || other.alive === false) return;
    if (other._fakeDeath) return;
    // 情绪翻转映射
    var flipMap = { '怒': '平', '恨': '警', '忧': '察', '惧': '强', '喜': '喜', '敬': '谦', '平': '平' };
    var asParticipant = meta && meta._asParticipant;
    var mirroredEmotion = asParticipant ? emotion : (flipMap[emotion] || '平');
    // 构造镜像事件描述
    var mirroredEvent;
    if (asParticipant) mirroredEvent = '（在场）' + event;
    else mirroredEvent = '（与' + originName + '）' + event;
    // importance 稍衰减（非亲历者记忆稍浅）
    var mirroredImp = Math.max(0.5, (importance || 5) - (asParticipant ? 0 : 1));
    // 镜像 meta·标记 _noMirror 防止死循环
    var mirroredMeta = Object.assign({}, meta || {}, { _noMirror: true });
    // 递归调用 remember·但关闭 mirror
    NpcMemorySystem.remember(otherName, mirroredEvent, mirroredEmotion, mirroredImp, originName, mirroredMeta);
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
      try { var cc = CurrencyEngine.getAIContext(); if (cc) parts.push(cc); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof CentralLocalEngine !== 'undefined' && typeof CentralLocalEngine.getAIContext === 'function') {
      try { var cl = CentralLocalEngine.getAIContext(); if (cl) parts.push(cl); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof HujiEngine !== 'undefined' && typeof HujiEngine.getAIContext === 'function') {
      try { var hj = HujiEngine.getAIContext(); if (hj) parts.push(hj); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof HujiDeepFill !== 'undefined' && typeof HujiDeepFill.getExtendedAIContext === 'function') {
      try { var hjd = HujiDeepFill.getExtendedAIContext(); if (hjd) parts.push(hjd); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof EnvCapacityEngine !== 'undefined' && typeof EnvCapacityEngine.getAIContext === 'function') {
      try { var env = EnvCapacityEngine.getAIContext(); if (env) parts.push(env); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof EdictParser !== 'undefined' && typeof EdictParser.getAIContext === 'function') {
      try { var ep = EdictParser.getAIContext(); if (ep) parts.push(ep); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof AuthorityEngines !== 'undefined' && typeof AuthorityEngines.getAuthorityAIContext === 'function') {
      try { var auth = AuthorityEngines.getAuthorityAIContext(); if (auth) parts.push(auth); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof AuthorityComplete !== 'undefined' && typeof AuthorityComplete.getExtendedAIContext === 'function') {
      try { var authc = AuthorityComplete.getExtendedAIContext(); if (authc) parts.push(authc); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
    }
    if (typeof HistoricalPresets !== 'undefined' && typeof HistoricalPresets.getAIContext === 'function') {
      try { var hp = HistoricalPresets.getAIContext(); if (hp) parts.push(hp); } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-mechanics');}catch(_){}}
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
  },

  // ═══════════════════════════════════════════════════════════════════
  //  方向 3：ch._arcs 个人剧情弧管理
  // ═══════════════════════════════════════════════════════════════════
  /**
   * 将记忆关联到现有 arc 或创建新 arc
   * @param {string} charName
   * @param {Object} arcData - {id?, title, type, participants?, phase?}
   */
  upsertArc: function(charName, arcData) {
    if (!GM.chars || !arcData || !arcData.title) return null;
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    if (!ch) return null;
    if (!ch._arcs) ch._arcs = [];
    var arc = null;
    if (arcData.id) arc = ch._arcs.find(function(a) { return a.id === arcData.id; });
    if (!arc) arc = ch._arcs.find(function(a) { return a.title === arcData.title; });
    if (!arc) {
      arc = {
        id: arcData.id || ('arc_' + (GM.turn || 0) + '_' + Math.random().toString(36).slice(2, 7)),
        title: arcData.title,
        type: arcData.type || 'political',
        participants: arcData.participants || [charName],
        phase: arcData.phase || 'brewing',
        startTurn: GM.turn || 0,
        lastUpdateTurn: GM.turn || 0,
        events: [],
        emotionalTrajectory: '',
        unresolved: arcData.unresolved || ''
      };
      ch._arcs.push(arc);
    }
    // 更新字段
    if (arcData.phase) arc.phase = arcData.phase;
    if (arcData.emotionalTrajectory) arc.emotionalTrajectory = arcData.emotionalTrajectory;
    if (arcData.unresolved) arc.unresolved = arcData.unresolved;
    arc.lastUpdateTurn = GM.turn || 0;
    // 限制：每人最多 15 个活跃 arc·resolved 超 10 回合删除
    ch._arcs = ch._arcs.filter(function(a) {
      if (a.phase === 'resolved' && (GM.turn - a.lastUpdateTurn) > 10) return false;
      return true;
    });
    if (ch._arcs.length > 15) {
      // 保留最近活跃的
      ch._arcs.sort(function(a, b) { return b.lastUpdateTurn - a.lastUpdateTurn; });
      ch._arcs = ch._arcs.slice(0, 15);
    }
    return arc;
  },

  /**
   * 把一条 memory 关联到 arc
   */
  linkMemoryToArc: function(charName, memoryIdx, arcId) {
    if (!GM.chars) return;
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    if (!ch || !ch._memory || !ch._memory[memoryIdx]) return;
    ch._memory[memoryIdx].arcId = arcId;
    if (ch._arcs) {
      var arc = ch._arcs.find(function(a) { return a.id === arcId; });
      if (arc) {
        arc.events.push({ turn: GM.turn || 0, memoryIdx: memoryIdx });
        arc.lastUpdateTurn = GM.turn || 0;
        if (arc.events.length > 30) arc.events = arc.events.slice(-30);
      }
    }
  },

  // ═══════════════════════════════════════════════════════════════════
  //  方向 6：recallMemory API（RAG 式按需检索）
  //  支持 keywords/turnRange/participant/minImportance/arcId/type 过滤
  //  从 GM._memoryArchiveFull（永久档）检索·返回匹配条目数组
  // ═══════════════════════════════════════════════════════════════════
  recallMemory: function(query, opts) {
    query = query || {};
    opts = opts || {};
    var limit = opts.limit || 20;
    var sortBy = opts.sortBy || 'importance';  // importance|turn|credibility
    var archive = (typeof GM !== 'undefined' && GM._memoryArchiveFull) ? GM._memoryArchiveFull : [];
    if (archive.length === 0) return [];

    var results = archive.filter(function(m) {
      if (!m) return false;
      // 关键词匹配（全文扫）
      if (query.keywords && Array.isArray(query.keywords) && query.keywords.length > 0) {
        var text = (m.event || '') + ' ' + (m.who || '') + ' ' + (m.char || '') + ' ' + (m.location || '');
        var anyMatch = query.keywords.some(function(kw) { return text.indexOf(kw) >= 0; });
        if (!anyMatch) return false;
      }
      // 回合范围
      if (query.turnRange && Array.isArray(query.turnRange)) {
        if (m.turn < query.turnRange[0] || m.turn > query.turnRange[1]) return false;
      }
      // 参与者（who 或 participants[]）
      if (query.participant) {
        var isParticipant = m.who === query.participant ||
                            m.char === query.participant ||
                            (Array.isArray(m.participants) && m.participants.indexOf(query.participant) >= 0) ||
                            (Array.isArray(m.witnesses) && m.witnesses.indexOf(query.participant) >= 0);
        if (!isParticipant) return false;
      }
      // 最低重要度
      if (query.minImportance && (m.importance || 0) < query.minImportance) return false;
      // arcId
      if (query.arcId && m.arcId !== query.arcId) return false;
      // type
      if (query.type && m.type !== query.type) return false;
      // 最低可信度
      if (query.minCredibility && (m.credibility || 0) < query.minCredibility) return false;
      // source 过滤
      if (query.source && m.source !== query.source) return false;
      return true;
    });

    // 排序
    results.sort(function(a, b) {
      if (sortBy === 'turn') return (b.turn || 0) - (a.turn || 0);
      if (sortBy === 'credibility') return (b.credibility || 0) - (a.credibility || 0);
      return (b.importance || 0) - (a.importance || 0);
    });

    return results.slice(0, limit);
  },

  /** 获取 NPC 的所有活跃 arc（phase ≠ resolved） */
  getActiveArcs: function(charName) {
    if (!GM.chars) return [];
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    if (!ch || !ch._arcs) return [];
    return ch._arcs.filter(function(a) { return a.phase !== 'resolved'; });
  },

  /** 获取 NPC 对另一人的关系演变快照 */
  getRelationHistory: function(charName, otherName) {
    if (!GM.chars) return [];
    var ch = GM.chars.find(function(c) { return c.name === charName; });
    if (!ch || !ch._relationHistory || !ch._relationHistory[otherName]) return [];
    return ch._relationHistory[otherName];
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
