// @ts-check
/// <reference path="types.d.ts" />
// ── 章节导航（grep 小节标题跳转，行号会漂）──
//   NPC 反馈机制（姊妹 tm-mechanics-world.js 世界机制）
//   §1 软下限     SoftFloorSystem：变量接近下限时阻尼负向变动（防雪崩·正向不受影响）
//   §2 其余机制   （grep 各 System 名定位；本文件聚合多个跨域反馈机制）
// ─────────────────────────────────────────────
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
          if (typeof adjustCharacterLoyalty === 'function') {
            adjustCharacterLoyalty(c, -3 * _ms, group.name + '\u4E0D\u6EE1\u79EF\u7D2F', { source:'rebound-group:' + group.name, oncePerTurn:true });
          } else {
            var oldL = (typeof c.loyalty === 'number' && isFinite(c.loyalty)) ? c.loyalty : 50;
            c.loyalty = Math.max(0, oldL - 3 * _ms);
          }
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

  /**
   * 取变量基线快照（深拷）——供 agent 回滚快照本 module 单例 previousValues。
   * previousValues 活在 GM 之外的闭包·flat 数值表·JSON 深拷即可。
   */
  function getPreviousValues() {
    try { return JSON.parse(JSON.stringify(previousValues)); } catch (e) { return {}; }
  }

  /**
   * 还原变量基线快照——回滚时撤销结算 updateSnapshot 对 previousValues 的累进。
   * 不还原则回滚把 GM.vars 复位到 pre-tick·但 previousValues 停在 post-tick → LLM 重跑 processCouplings 的
   * delta=current-previousValues 基线被污染 → 错误耦合 delta 悄悄漂进已提交回合。
   */
  function restorePreviousValues(snap) {
    if (snap && typeof snap === 'object') {
      try { previousValues = JSON.parse(JSON.stringify(snap)); } catch (e) {}
    }
  }

  return {
    initialize: initialize,
    processCouplings: processCouplings,
    updateSnapshot: updateSnapshot,
    reset: reset,
    getPreviousValues: getPreviousValues,
    restorePreviousValues: restorePreviousValues
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

  /** 只读本人钱财；旧内帑/受托库镜像和缺数不能作为个人贫富。 */
  _privateMoney: function(c) {
    var resources = c.resources || {}, accounts = [resources.privateWealth, resources.private, c.privateWealth];
    for (var i = 0; i < accounts.length; i++) {
      var account = accounts[i];
      if (!account || typeof account !== 'object' || account.isNeitang || account.isReadOnly) continue;
      if (account.known === false) return null;
      var value = account.money != null ? account.money : account.cash;
      if (value == null) continue;
      if (typeof value === 'string' && value.trim() !== '') value = Number(value);
      return typeof value === 'number' && isFinite(value) ? value : null;
    }
    return null;
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
        var personalMoney = GoalSatisfactionSystem._privateMoney(c);
        if (personalMoney === null) return;
        delta = personalMoney > 0 ? 0.5 : -1;
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
        if (typeof adjustCharacterLoyalty === 'function') {
          adjustCharacterLoyalty(c, -15, '\u538B\u529B\u8FC7\u5927\u7CBE\u795E\u5D29\u6E83', { source:'stress-breakdown' });
        } else {
          var oldBreakL = (typeof c.loyalty === 'number' && isFinite(c.loyalty)) ? c.loyalty : 50;
          c.loyalty = Math.max(0, oldBreakL - 15);
        }
        if (typeof addEB === 'function') addEB('崩溃', c.name + '精神崩溃！忠诚度骤降');
        if (GM.qijuHistory) {
          if (typeof TM !== 'undefined' && TM.Qiju) TM.Qiju.recordEntry({
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

