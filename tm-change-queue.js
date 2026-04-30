// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// ChangeQueue System - 变动队列系统
// Requires: tm-data-model.js (P, GM), tm-utils.js (_dbg, deepClone),
//           tm-mechanics.js (SoftFloorSystem)
// ============================================================

/**
 * 变动队列系统
 * 借鉴 ChongzhenSim TypeScript 版本的核心架构
 *
 * 核心原则：
 * 1. 所有数据变动都先进入队列，不立即执行
 * 2. 只有 applyAll() 方法可以修改游戏状态
 * 3. 只有 endTurn() 可以调用 applyAll()
 * 4. 结算完成后清空队列
 * 5. 强制日志审计 - 所有变动必须记录
 */
/**
 * 变动队列 - 所有数据变动先入队，endTurn 统一结算
 * @namespace
 * @property {function(Object):void} enqueue - 入队
 * @property {function():Object} applyAll - 执行全部
 * @property {function():void} clear - 清空
 * @property {function():Object} getStats - 统计
 */
var ChangeQueue = (function() {
  var queue = [];
  var isApplying = false;
  var appliedChanges = [];

  /**
   * 添加变动到队列
   * @param {Object} change - 变动对象
   * @param {string} change.type - 类型：'treasury'|'variable'|'character'|'faction'|'province'|'nation'
   * @param {string} change.target - 目标ID
   * @param {string} change.field - 字段名
   * @param {number} [change.delta] - 变动值（累积模式）
   * @param {number} [change.newValue] - 新值（绝对值模式）
   * @param {string} change.description - 描述
   * @param {string} change.source - 来源
   */
  function enqueue(change) {
    var id = Date.now() + '_' + (typeof random==='function'?random():Math.random()).toString(36).substr(2, 9);
    var timestamp = Date.now();

    var request = {
      id: id,
      type: change.type,
      target: change.target,
      field: change.field,
      delta: change.delta,
      newValue: change.newValue,
      description: change.description || '未知变动',
      source: change.source || 'unknown',
      timestamp: timestamp
    };

    queue.push(request);

    _dbg('[ChangeQueue] 已加入待结算队列: ' + request.description + ' (队列长度: ' + queue.length + ')');
  }

  /**
   * 应用所有变动到游戏状态
   * ⚠️ 警告：只有 endTurn() 可以调用此方法！
   * @returns {Object} { logs: string[], appliedCount: number }
   */
  function applyAll() {
    if (isApplying) {
      console.error('[ChangeQueue] applyAll 正在执行中，防止重入！');
      return { logs: [], appliedCount: 0 };
    }

    isApplying = true;
    appliedChanges = [];

    var logs = [];
    var appliedCount = 0;
    var multiplier = 1;

    _dbg('[ChangeQueue] 开始应用 ' + queue.length + ' 个变动');

    try {
      // 应用软下限系统
      var processedQueue = SoftFloorSystem.processChanges(queue);
      _dbg('[ChangeQueue] 软下限系统处理完成');

      for (var i = 0; i < processedQueue.length; i++) {
        var change = processedQueue[i];

        switch (change.type) {
          case 'treasury':
            applyTreasuryChange(change, logs, multiplier);
            break;
          case 'variable':
            applyVariableChange(change, logs, multiplier);
            break;
          case 'character':
            applyCharacterChange(change, logs, multiplier);
            break;
          case 'faction':
            applyFactionChange(change, logs, multiplier);
            break;
          case 'province':
            applyProvinceChange(change, logs, multiplier);
            break;
          case 'nation':
            applyNationChange(change, logs, multiplier);
            break;
          default:
            console.warn('[ChangeQueue] 未知变动类型: ' + change.type);
        }

        appliedCount++;
      }

      _dbg('[ChangeQueue] 成功应用 ' + appliedCount + ' 个变动');

    } catch (error) {
      console.error('[ChangeQueue] 应用变动失败:', error);
    } finally {
      isApplying = false;
    }

    return { logs: logs, appliedCount: appliedCount };
  }

  /**
   * 清空队列
   */
  function clear() {
    var count = queue.length;
    queue = [];
    _dbg('[ChangeQueue] 已清空 ' + count + ' 个变动');
  }

  /**
   * 获取队列长度
   */
  function length() {
    return queue.length;
  }

  /**
   * 获取队列统计
   */
  function getStats() {
    var stats = {
      total: queue.length,
      byType: {}
    };

    queue.forEach(function(change) {
      if (!stats.byType[change.type]) {
        stats.byType[change.type] = 0;
      }
      stats.byType[change.type]++;
    });

    return stats;
  }

  /**
   * 获取已应用的变动（用于 AccountingSystem）
   */
  function getAppliedChanges() {
    return appliedChanges.slice();
  }

  // ==================== 私有方法：应用各类变动 ====================

  function applyTreasuryChange(change, logs, multiplier) {
    var actualDelta = Math.round((change.delta || 0) * multiplier);

    // 记录到 appliedChanges（用于 AccountingSystem）
    appliedChanges.push({
      type: 'treasury',
      field: change.field,
      delta: actualDelta,
      originalDelta: change.delta || 0,
      description: change.description,
      source: change.source
    });

    var logMsg = '国库' + change.field + ': ' + (actualDelta >= 0 ? '+' : '') + actualDelta +
                 ' [' + change.description + ']';
    logs.push(logMsg);
    _dbg('[ChangeQueue] ' + logMsg);
  }

  function applyVariableChange(change, logs, multiplier) {
    if (!GM.vars[change.target]) {
      console.warn('[ChangeQueue] 变量不存在: ' + change.target);
      return;
    }

    var oldValue = GM.vars[change.target].value || 0;
    var vMin = GM.vars[change.target].min != null ? GM.vars[change.target].min : 0;
    var vMax = GM.vars[change.target].max != null ? GM.vars[change.target].max : 999999999;
    var newValue;

    if (change.newValue !== undefined) {
      newValue = Math.max(vMin, Math.min(vMax, change.newValue));
    } else if (change.delta !== undefined) {
      var actualDelta = change.delta * multiplier;
      newValue = Math.max(vMin, Math.min(vMax, oldValue + actualDelta));
    } else {
      return;
    }

    GM.vars[change.target].value = newValue;

    var actualChange = newValue - oldValue;
    var logMsg = change.target + ': ' + oldValue.toFixed(1) + ' → ' + newValue.toFixed(1) +
                 ' (实际: ' + (actualChange >= 0 ? '+' : '') + actualChange.toFixed(1) +
                 ', 原始: ' + (change.delta >= 0 ? '+' : '') + (change.delta || 0) + ') [' + change.description + ']';
    logs.push(logMsg);
    _dbg('[ChangeQueue] ' + logMsg);
  }

  function applyCharacterChange(change, logs, multiplier) {
    var char = GM.chars.find(function(c) { return c.name === change.target; });
    if (!char) {
      console.warn('[ChangeQueue] 角色不存在: ' + change.target);
      return;
    }

    var oldValue = char[change.field] || 0;
    var cMin = change.min != null ? change.min : 0;
    var cMax = change.max != null ? change.max : 100;
    var newValue;

    if (change.newValue !== undefined) {
      newValue = Math.max(cMin, Math.min(cMax, change.newValue));
    } else if (change.delta !== undefined) {
      var actualDelta = change.delta * multiplier;
      newValue = Math.max(cMin, Math.min(cMax, oldValue + actualDelta));
    } else {
      return;
    }

    char[change.field] = newValue;

    var actualChange = newValue - oldValue;
    var logMsg = char.name + '.' + change.field + ': ' + oldValue.toFixed(1) + ' → ' + newValue.toFixed(1) +
                 ' (实际: ' + (actualChange >= 0 ? '+' : '') + actualChange.toFixed(1) + ') [' + change.description + ']';
    logs.push(logMsg);
    _dbg('[ChangeQueue] ' + logMsg);
  }

  function applyFactionChange(change, logs, multiplier) {
    var fac = GM.facs.find(function(f) { return f.name === change.target; });
    if (!fac) {
      console.warn('[ChangeQueue] 势力不存在: ' + change.target);
      return;
    }

    var oldValue = fac[change.field] || 0;
    var newValue;

    if (change.newValue !== undefined) {
      newValue = change.newValue;
    } else if (change.delta !== undefined) {
      var actualDelta = change.delta * multiplier;
      newValue = oldValue + actualDelta;
    } else {
      return;
    }

    fac[change.field] = newValue;

    var actualChange = newValue - oldValue;
    var logMsg = fac.name + '.' + change.field + ': ' + oldValue.toFixed(1) + ' → ' + newValue.toFixed(1) +
                 ' (实际: ' + (actualChange >= 0 ? '+' : '') + actualChange.toFixed(1) + ') [' + change.description + ']';
    logs.push(logMsg);
    _dbg('[ChangeQueue] ' + logMsg);
  }

  function applyProvinceChange(change, logs, multiplier) {
    // 省份变动（如果有地图系统）
    if (!P.map || !P.map.regions) return;

    var province = P.map.regions.find(function(r) { return r.id === change.target; });
    if (!province) {
      console.warn('[ChangeQueue] 省份不存在: ' + change.target);
      return;
    }

    var oldValue = province[change.field] || 0;
    var newValue;

    if (change.newValue !== undefined) {
      newValue = change.newValue;
    } else if (change.delta !== undefined) {
      var actualDelta = change.delta * multiplier;
      newValue = oldValue + actualDelta;
    } else {
      return;
    }

    province[change.field] = newValue;

    var actualChange = newValue - oldValue;
    var logMsg = province.name + '.' + change.field + ': ' + oldValue.toFixed(1) + ' → ' + newValue.toFixed(1) +
                 ' (实际: ' + (actualChange >= 0 ? '+' : '') + actualChange.toFixed(1) + ') [' + change.description + ']';
    logs.push(logMsg);
    _dbg('[ChangeQueue] ' + logMsg);
  }

  function applyNationChange(change, logs, multiplier) {
    // 国家级变动
    var oldValue = GM[change.field] || 0;
    var newValue;

    if (change.newValue !== undefined) {
      newValue = change.newValue;
    } else if (change.delta !== undefined) {
      var actualDelta = change.delta * multiplier;
      newValue = oldValue + actualDelta;
    } else {
      return;
    }

    GM[change.field] = newValue;

    var actualChange = newValue - oldValue;
    var logMsg = 'GM.' + change.field + ': ' + oldValue.toFixed(1) + ' → ' + newValue.toFixed(1) +
                 ' (实际: ' + (actualChange >= 0 ? '+' : '') + actualChange.toFixed(1) + ') [' + change.description + ']';
    logs.push(logMsg);
    _dbg('[ChangeQueue] ' + logMsg);
  }

  // 公开接口
  return {
    enqueue: enqueue,
    applyAll: applyAll,
    clear: clear,
    length: length,
    getStats: getStats,
    getAppliedChanges: getAppliedChanges
  };
})();

// ============================================================
// AccountingSystem - 会计系统
// ============================================================

/**
 * 会计系统
 * 借鉴 ChongzhenSim TypeScript 版本的财务记账系统
 *
 * 核心功能：
 * 1. 统一记录所有收入和支出
 * 2. 自动计算总额和净变化
 * 3. 提供清晰的财务报表
 */
/**
 * 会计系统 - 每回合收支明细
 * @namespace
 * @property {function():void} resetLedger
 * @property {function(string, number, string=):void} addIncome
 * @property {function(string, number, string=):void} addExpense
 * @property {function():Object} getLedger
 */
var AccountingSystem = (function() {
  var ledger = {
    items: [],
    totalIncome: 0,
    totalExpense: 0,
    netChange: 0,
    timestamp: Date.now()
  };

  /**
   * 重置账本
   */
  function resetLedger() {
    ledger = {
      items: [],
      totalIncome: 0,
      totalExpense: 0,
      netChange: 0,
      timestamp: Date.now()
    };
    _dbg('[Accounting] 账本已重置');
  }

  /**
   * 添加收入
   */
  function addIncome(name, amount, description) {
    if (isNaN(amount) || amount < 0) {
      console.error('[Accounting] 无效的收入金额:', amount);
      return;
    }

    ledger.items.push({
      name: name,
      amount: amount,
      type: 'income',
      description: description || ''
    });

    ledger.totalIncome += amount;
    ledger.netChange = ledger.totalIncome - ledger.totalExpense;

    _dbg('[Accounting] 收入: ' + name + ' +' + amount + ' (' + description + ')');
  }

  /**
   * 添加支出
   */
  function addExpense(name, amount, description) {
    if (isNaN(amount) || amount < 0) {
      console.error('[Accounting] 无效的支出金额:', amount);
      return;
    }

    ledger.items.push({
      name: name,
      amount: amount,
      type: 'expense',
      description: description || ''
    });

    ledger.totalExpense += amount;
    ledger.netChange = ledger.totalIncome - ledger.totalExpense;

    _dbg('[Accounting] 支出: ' + name + ' -' + amount + ' (' + description + ')');
  }

  /**
   * 获取账本（只读副本）
   */
  function getLedger() {
    return deepClone(ledger);
  }

  /**
   * 验证账本
   */
  function validateLedger() {
    var calculatedIncome = ledger.items
      .filter(function(item) { return item.type === 'income'; })
      .reduce(function(sum, item) { return sum + item.amount; }, 0);

    var calculatedExpense = ledger.items
      .filter(function(item) { return item.type === 'expense'; })
      .reduce(function(sum, item) { return sum + item.amount; }, 0);

    var calculatedNetChange = calculatedIncome - calculatedExpense;

    if (Math.abs(calculatedIncome - ledger.totalIncome) > 0.01 ||
        Math.abs(calculatedExpense - ledger.totalExpense) > 0.01 ||
        Math.abs(calculatedNetChange - ledger.netChange) > 0.01) {
      console.error('[Accounting] 账本计算错误！');
      return false;
    }

    _dbg('[Accounting] 账本验证通过');
    return true;
  }

  // 公开接口
  return {
    resetLedger: resetLedger,
    addIncome: addIncome,
    addExpense: addExpense,
    getLedger: getLedger,
    validateLedger: validateLedger
  };
})();

// ============================================================
// 数据监听系统 - 中国古代背景适配
// ============================================================

/**
 * 数据监听系统核心
 * 借鉴 KingOfIreland 的数据驱动架构，适配中国古代历史背景
 *
 * 核心特性：
 * 1. 属性变化自动触发相关计算（如：忠诚度变化 → 考课评估）
 * 2. 级联更新（如：领地税收 → 势力总收入 → 集权度调整）
 * 3. 时代感知（根据朝代阶段自动调整参数）
 * 4. 官制联动（任命/罢免自动触发权力重分配）
 */

function ensureReactiveQueueState() {
  if (typeof GM === 'undefined' || !GM) return false;
  if (!GM._listeners || typeof GM._listeners !== 'object' || Array.isArray(GM._listeners)) {
    GM._listeners = {};
  }
  if (!Array.isArray(GM._changeQueue)) {
    GM._changeQueue = [];
  }
  return true;
}

// 注册监听器
function registerListener(entityType, propertyName, callback, priority) {
  if (!ensureReactiveQueueState()) return;
  priority = priority || 5;
  var key = entityType + '.' + propertyName;
  if (!GM._listeners[key]) {
    GM._listeners[key] = [];
  }
  GM._listeners[key].push({
    callback: callback,
    priority: priority
  });
  // 按优先级排序（数字越小优先级越高）
  GM._listeners[key].sort(function(a, b) {
    return a.priority - b.priority;
  });
}

// 触发属性变化监听
function triggerPropertyChange(entityType, entity, propertyName, oldValue, newValue) {
  if (oldValue === newValue) return;
  if (!ensureReactiveQueueState()) return;

  var key = entityType + '.' + propertyName;
  var listeners = GM._listeners[key];
  if (!listeners || listeners.length === 0) return;

  // 添加到变化队列
  GM._changeQueue.push({
    entityType: entityType,
    entity: entity,
    propertyName: propertyName,
    oldValue: oldValue,
    newValue: newValue,
    listeners: listeners
  });
}

// 处理变化队列（批量处理，避免重复计算）
function processChangeQueue() {
  if (!ensureReactiveQueueState()) return;
  if (GM._changeQueue.length === 0) return;

  var queue = GM._changeQueue.slice();
  GM._changeQueue = [];

  queue.forEach(function(change) {
    change.listeners.forEach(function(listener) {
      // 守护：存档恢复后 listener.callback 可能已经丢失（函数不序列化）
      if (!listener || typeof listener.callback !== 'function') return;
      try {
        listener.callback(change.entity, change.propertyName, change.oldValue, change.newValue);
      } catch (e) {
        console.error('监听器执行失败:', e);
      }
    });
  });
}

// 创建响应式属性（自动触发监听）
function makeReactive(entity, entityType, propertyName, initialValue) {
  var _value = initialValue;
  var _internalKey = '_' + propertyName;
  entity[_internalKey] = _value;

  Object.defineProperty(entity, propertyName, {
    get: function() {
      return entity[_internalKey];
    },
    set: function(newValue) {
      var oldValue = entity[_internalKey];
      if (oldValue === newValue) return;
      entity[_internalKey] = newValue;
      triggerPropertyChange(entityType, entity, propertyName, oldValue, newValue);
    },
    enumerable: true,
    configurable: true
  });
}

// 批量创建响应式属性
function makeEntityReactive(entity, entityType, properties) {
  properties.forEach(function(prop) {
    if (entity.hasOwnProperty(prop)) {
      makeReactive(entity, entityType, prop, entity[prop]);
    }
  });
}

// ============================================================
// 监听器注册 - 中国古代背景特定逻辑
// ============================================================

// 安全事件日志：防止在 tm-game-engine.js 加载前调用 addEventLog
function _safeEventLog(msg) {
  if (typeof addEventLog === 'function') addEventLog(msg);
  else _dbg('[DataListener] ' + msg);
}

// 初始化所有数据监听器
function initDataListeners() {
  // 清空现有监听器
  GM._listeners = {};

  // 1. 角色忠诚度监听 - 触发考课和铨选
  registerListener('character', 'loyalty', function(char, prop, oldVal, newVal) {
    // 忠诚度大幅下降，触发警告
    if (newVal < 30 && oldVal >= 30) {
      _safeEventLog('⚠️ ' + char.name + '忠诚度过低（' + Math.round(newVal) + '），可能有反叛倾向');
    }
    // 忠诚度恢复，记录
    if (newVal >= 50 && oldVal < 50) {
      _safeEventLog('✓ ' + char.name + '忠诚度恢复（' + Math.round(newVal) + '）');
    }
  }, 1);

  // 2. 角色野心监听 - 影响行为决策
  registerListener('character', 'ambition', function(char, prop, oldVal, newVal) {
    if (newVal > 70 && oldVal <= 70) {
      _safeEventLog('📈 ' + char.name + '野心高涨（' + Math.round(newVal) + '），需要关注其动向');
    }
  }, 1);

  // 3. 势力财政监听 - 触发经济调整
  registerListener('faction', 'money', function(fac, prop, oldVal, newVal) {
    // 财政危机
    if (newVal < 0 && oldVal >= 0) {
      _safeEventLog('💰 ' + fac.name + '陷入财政赤字');
      // 自动降低经济繁荣度
      if (GM.eraState && GM.eraState.economicProsperity) {
        GM.eraState.economicProsperity = Math.max(0.1, GM.eraState.economicProsperity - 0.05);
      }
    }
    // 财政好转
    if (newVal > 10000 && oldVal <= 10000) {
      _safeEventLog('💰 ' + fac.name + '财政充裕');
      if (GM.eraState && GM.eraState.economicProsperity) {
        GM.eraState.economicProsperity = Math.min(1.0, GM.eraState.economicProsperity + 0.02);
      }
    }
  }, 2);

  // 4. 势力粮食监听 - 触发民心变化
  registerListener('faction', 'food', function(fac, prop, oldVal, newVal) {
    // 粮食短缺
    if (newVal < 0 && oldVal >= 0) {
      _safeEventLog('🌾 ' + fac.name + '粮食短缺，民心下降');
      if (fac.popularity) {
        fac._popularity = Math.max(0, fac._popularity - 10);
      }
    }
  }, 2);

  // 5. 势力民心监听 - 触发社会稳定度变化
  registerListener('faction', 'popularity', function(fac, prop, oldVal, newVal) {
    if (newVal < 30 && oldVal >= 30) {
      _safeEventLog('⚠️ ' + fac.name + '民心过低（' + Math.round(newVal) + '），社会不稳');
      if (GM.eraState && GM.eraState.socialStability) {
        GM.eraState.socialStability = Math.max(0.1, GM.eraState.socialStability - 0.05);
      }
    }
    if (newVal >= 70 && oldVal < 70) {
      _safeEventLog('✓ ' + fac.name + '民心高涨（' + Math.round(newVal) + '）');
      if (GM.eraState && GM.eraState.socialStability) {
        GM.eraState.socialStability = Math.min(1.0, GM.eraState.socialStability + 0.03);
      }
    }
  }, 2);

  // 6. 时代状态-集权度监听 - 自动调整贡奉比例
  registerListener('eraState', 'centralControl', function(state, prop, oldVal, newVal) {
    // 集权度变化，自动调整经济系统
    if (Math.abs(newVal - oldVal) > 0.1) {
      _safeEventLog('📊 中央集权度变化：' + Math.round(oldVal * 100) + '% → ' + Math.round(newVal * 100) + '%');
      // 触发经济系统重新计算
      if (typeof recalculateEconomy === 'function') {
        recalculateEconomy();
      }
    }
  }, 1);

  // 7. 时代状态-朝代阶段监听 - 触发历史事件
  registerListener('eraState', 'dynastyPhase', function(state, prop, oldVal, newVal) {
    if (oldVal !== newVal) {
      var phaseNames = {
        founding: '开国',
        expansion: '扩张',
        peak: '盛世',
        decline: '衰落',
        collapse: '崩溃'
      };
      _safeEventLog('🏛️ 朝代阶段转变：' + (phaseNames[oldVal] || oldVal) + ' → ' + (phaseNames[newVal] || newVal));
      // 触发对应的历史事件
      if (typeof triggerDynastyPhaseEvent === 'function') {
        triggerDynastyPhaseEvent(newVal);
      }
    }
  }, 1);

  // 8. 岗位政绩监听 - 触发考课评估
  registerListener('post', 'performance', function(post, prop, oldVal, newVal) {
    if (newVal >= 80 && oldVal < 80) {
      _safeEventLog('🎖️ ' + post.name + '政绩优秀（' + Math.round(newVal) + '）');
    }
    if (newVal < 40 && oldVal >= 40) {
      _safeEventLog('⚠️ ' + post.name + '政绩不佳（' + Math.round(newVal) + '），需要考虑调整');
    }
  }, 2);

  // 9. 军队士气监听 - 影响战斗力
  registerListener('army', 'morale', function(army, prop, oldVal, newVal) {
    if (newVal < 30 && oldVal >= 30) {
      _safeEventLog('⚔️ ' + army.name + '士气低落（' + Math.round(newVal) + '），战斗力下降');
    }
    if (newVal >= 70 && oldVal < 70) {
      _safeEventLog('⚔️ ' + army.name + '士气高昂（' + Math.round(newVal) + '）');
    }
  }, 2);

  // 10. 官制变化监听 - 触发权力重分配
  registerListener('character', 'position', function(char, prop, oldVal, newVal) {
    if (oldVal !== newVal) {
      if (newVal) {
        _safeEventLog('📜 ' + char.name + '就任' + newVal);
      } else if (oldVal) {
        _safeEventLog('📜 ' + char.name + '离任' + oldVal);
      }
      // 触发权力重分配
      if (typeof recalculatePowerStructure === 'function') {
        recalculatePowerStructure();
      }
    }
  }, 1);
}

// 为所有实体添加响应式属性
function makeEntitiesReactive() {
  // 1. 角色响应式属性
  if (GM.chars && GM.chars.length > 0) {
    GM.chars.forEach(function(char) {
      makeEntityReactive(char, 'character', [
        'loyalty', 'ambition', 'intelligence', 'valor', 'benevolence',
        'age', 'health', 'position', 'money', 'power'
      ]);
    });
  }

  // 2. 势力响应式属性
  if (GM.facs && GM.facs.length > 0) {
    GM.facs.forEach(function(fac) {
      makeEntityReactive(fac, 'faction', [
        'money', 'food', 'popularity', 'territory', 'military'
      ]);
    });
  }

  // 3. 时代状态响应式属性
  if (GM.eraState) {
    makeEntityReactive(GM.eraState, 'eraState', [
      'politicalUnity', 'centralControl', 'legitimacySource',
      'socialStability', 'economicProsperity', 'culturalVibrancy',
      'bureaucracyStrength', 'militaryProfessionalism', 'landSystemType',
      'dynastyPhase'
    ]);
  }

  // 4. 岗位响应式属性
  if (GM.posts && GM.posts.length > 0) {
    GM.posts.forEach(function(post) {
      makeEntityReactive(post, 'post', [
        'holder', 'performance', 'salary'
      ]);
    });
  }

  // 5. 军队响应式属性
  if (GM.armies && GM.armies.length > 0) {
    GM.armies.forEach(function(army) {
      makeEntityReactive(army, 'army', [
        'morale', 'soldiers', 'supplies', 'location'
      ]);
    });
  }
}

// 安全更新属性（支持响应式和非响应式）
function safeUpdateProperty(entity, propertyName, newValue) {
  if (!entity) return;

  var internalKey = '_' + propertyName;

  // 如果是响应式属性，使用内部键
  if (entity.hasOwnProperty(internalKey)) {
    entity[propertyName] = newValue; // 触发 setter
  } else {
    // 非响应式属性，直接赋值
    entity[propertyName] = newValue;
  }
}

// 为新创建的实体添加响应式属性
function makeNewEntityReactive(entity, entityType) {
  var properties = {
    'character': ['loyalty', 'ambition', 'intelligence', 'valor', 'benevolence', 'age', 'health', 'position', 'money', 'power'],
    'faction': ['money', 'food', 'popularity', 'territory', 'military'],
    'post': ['holder', 'performance', 'salary'],
    'army': ['morale', 'soldiers', 'supplies', 'location']
  };

  var props = properties[entityType];
  if (props) {
    makeEntityReactive(entity, entityType, props);
  }
}

var editingScenarioId=null;

