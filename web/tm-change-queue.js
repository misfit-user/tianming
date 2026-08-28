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
  var deadLetters = [];
  var sequence = 0;
  var limits = { soft: 512, hard: 1024, maxAttempts: 3, deadLetters: 200 };
  var unsafeFields = { '__proto__': true, 'prototype': true, 'constructor': true };

  function _nowTurn() {
    return (typeof GM !== 'undefined' && GM && Number.isFinite(Number(GM.turn))) ? Number(GM.turn) : 0;
  }

  function _failure(code, message, retryable, change) {
    return {
      ok: false,
      code: String(code || 'change-failed'),
      message: String(message || code || 'change failed'),
      retryable: retryable === true,
      target: change && change.target,
      field: change && change.field
    };
  }

  function _finite(value) {
    var number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function _validField(change) {
    var field = change && typeof change.field === 'string' ? change.field.trim() : '';
    return field && !unsafeFields[field] ? field : null;
  }

  function _resolveByStableIdOrUniqueName(rows, target, kind) {
    if (!Array.isArray(rows)) return _failure(kind + '-collection-unavailable', kind + ' collection unavailable', true, { target: target });
    var ref = String(target == null ? '' : target).trim();
    if (!ref) return _failure(kind + '-target-missing', kind + ' target missing', false, { target: target });
    var byId = rows.filter(function(row){ return row && String(row.id || '') === ref; });
    if (byId.length === 1) return { ok: true, value: byId[0] };
    if (byId.length > 1) return _failure(kind + '-id-ambiguous', kind + ' id is not unique: ' + ref, false, { target: target });
    var byName = rows.filter(function(row){ return row && String(row.name || '').trim() === ref; });
    if (byName.length === 1) return { ok: true, value: byName[0], migratedFromName: true };
    if (byName.length > 1) return _failure(kind + '-name-ambiguous', kind + ' name is ambiguous: ' + ref, false, { target: target });
    return _failure(kind + '-not-found', kind + ' not found: ' + ref, false, { target: target });
  }

  function _numericMutation(change, target, field, min, max, label, appliedRecord) {
    var oldValue = _finite(target[field]);
    if (oldValue === null) return _failure('invalid-existing-numeric-value', label + ' existing value is not finite', false, change);
    var next;
    if (change.newValue !== undefined) next = _finite(change.newValue);
    else if (change.delta !== undefined) {
      var delta = _finite(change.delta);
      if (delta === null) return _failure('invalid-numeric-value', label + ' delta is not finite', false, change);
      next = oldValue + delta;
    } else return _failure('numeric-operation-missing', label + ' requires delta or newValue', false, change);
    if (next === null || !Number.isFinite(next)) return _failure('invalid-numeric-value', label + ' result is not finite', false, change);
    if (min !== null && next < min) next = min;
    if (max !== null && next > max) next = max;
    target[field] = next;
    var actualDelta = next - oldValue;
    return {
      ok: true,
      changed: actualDelta !== 0,
      log: label + ': ' + oldValue.toFixed(1) + ' → ' + next.toFixed(1) +
        ' (实际: ' + (actualDelta >= 0 ? '+' : '') + actualDelta.toFixed(1) + ') [' + change.description + ']',
      applied: Object.assign({
        type: change.type, target: change.target, field: field, delta: actualDelta,
        description: change.description, source: change.source
      }, appliedRecord || {}),
      undo: function(){ target[field] = oldValue; }
    };
  }

  function _handlerTreasury(change) {
    var field = _validField(change);
    if (!field) return _failure('invalid-field', 'treasury field is invalid', false, change);
    var delta = _finite(change.delta);
    if (delta === null) return _failure('invalid-numeric-value', 'treasury delta is not finite', false, change);
    return {
      ok: true, changed: false,
      log: '国库' + field + ': ' + (delta >= 0 ? '+' : '') + delta + ' [' + change.description + ']',
      applied: { type:'treasury', field:field, delta:delta, originalDelta:delta, description:change.description, source:change.source },
      undo: function(){}
    };
  }

  function _handlerVariable(change) {
    if (typeof GM === 'undefined' || !GM || !GM.vars || typeof GM.vars !== 'object' || Array.isArray(GM.vars)) {
      return _failure('variable-collection-unavailable', 'GM.vars unavailable', true, change);
    }
    var variable = GM.vars[change.target];
    if (!variable || typeof variable !== 'object') return _failure('variable-not-found', 'variable not found: ' + change.target, false, change);
    var min = variable.min == null ? 0 : _finite(variable.min);
    var max = variable.max == null ? 999999999 : _finite(variable.max);
    if (min === null || max === null || min > max) return _failure('invalid-variable-bounds', 'variable bounds are invalid: ' + change.target, false, change);
    return _numericMutation(change, variable, 'value', min, max, String(change.target));
  }

  function _handlerCharacter(change) {
    if (typeof GM === 'undefined' || !GM) return _failure('world-unavailable', 'GM unavailable', true, change);
    var resolved = _resolveByStableIdOrUniqueName(GM.chars, change.target, 'character');
    if (!resolved.ok) return resolved;
    var field = _validField(change);
    if (!field) return _failure('invalid-field', 'character field is invalid', false, change);
    var min = change.min == null ? 0 : _finite(change.min);
    var max = change.max == null ? 100 : _finite(change.max);
    if (min === null || max === null || min > max) return _failure('invalid-character-bounds', 'character bounds are invalid', false, change);
    return _numericMutation(change, resolved.value, field, min, max, resolved.value.name + '.' + field, { targetId: resolved.value.id || '' });
  }

  function _handlerFaction(change) {
    if (typeof GM === 'undefined' || !GM) return _failure('world-unavailable', 'GM unavailable', true, change);
    var resolved = _resolveByStableIdOrUniqueName(GM.facs, change.target, 'faction');
    if (!resolved.ok) return resolved;
    var field = _validField(change);
    if (!field) return _failure('invalid-field', 'faction field is invalid', false, change);
    return _numericMutation(change, resolved.value, field, null, null, resolved.value.name + '.' + field, { targetId: resolved.value.id || '' });
  }

  function _runtimeMap() {
    if (typeof ensureWritableRuntimeMap === 'function') return ensureWritableRuntimeMap();
    if (typeof GM !== 'undefined' && GM && GM.mapData && Array.isArray(GM.mapData.regions)) return GM.mapData;
    return null;
  }

  function _handlerProvince(change) {
    var map = _runtimeMap();
    if (!map || !Array.isArray(map.regions)) return _failure('runtime-map-unavailable', 'writable runtime map unavailable', true, change);
    var resolved = _resolveByStableIdOrUniqueName(map.regions, change.target, 'region');
    if (!resolved.ok) return resolved;
    var field = _validField(change);
    if (!field) return _failure('invalid-field', 'region field is invalid', false, change);
    return _numericMutation(change, resolved.value, field, null, null, resolved.value.name + '.' + field, { targetId: resolved.value.id || '' });
  }

  function _handlerNation(change) {
    if (typeof GM === 'undefined' || !GM || typeof GM !== 'object') return _failure('world-unavailable', 'GM unavailable', true, change);
    var field = _validField(change);
    if (!field) return _failure('invalid-field', 'nation field is invalid', false, change);
    return _numericMutation(change, GM, field, null, null, 'GM.' + field);
  }

  var handlers = {
    treasury: _handlerTreasury,
    variable: _handlerVariable,
    character: _handlerCharacter,
    faction: _handlerFaction,
    province: _handlerProvince,
    nation: _handlerNation
  };

  function _deadLetter(change, failure) {
    deadLetters.push({
      change: Object.assign({}, change),
      attempts: change.attempts || 0,
      reason: failure.code,
      message: failure.message,
      droppedAtTurn: _nowTurn(),
      droppedAt: Date.now()
    });
    if (deadLetters.length > limits.deadLetters) deadLetters = deadLetters.slice(-limits.deadLetters);
  }

  function _finalizeQueuedFailure(originalQueue, failedChange, failure, index) {
    failure = failure && failure.ok === false
      ? failure
      : _failure(failure && failure.code || 'apply-exception', failure && failure.message || 'change application failed', failure && failure.retryable === true, failedChange);
    var targets = [];
    if (failedChange && failedChange.id) {
      var matched = originalQueue.find(function(row){ return row && row.id === failedChange.id; });
      if (matched) targets.push(matched);
    }
    // A preprocessing exception has no single owner; every queued item is blocked by
    // the same batch-level failure and must progress toward the retry ceiling.
    if (!targets.length) targets = originalQueue.slice();
    var dropped = Object.create(null);
    var settled = [];
    targets.forEach(function(original) {
      if (!original || typeof original !== 'object') return;
      var priorAttempts = Number(original.attempts);
      original.attempts = (Number.isFinite(priorAttempts) && priorAttempts >= 0 ? Math.floor(priorAttempts) : 0) + 1;
      original.lastErrorCode = failure.code;
      original.lastErrorAt = Date.now();
      if (!failure.retryable || original.attempts >= limits.maxAttempts) {
        _deadLetter(original, failure);
        if (original.id) dropped[original.id] = true;
      }
      settled.push(Object.assign({
        index: Number.isInteger(index) ? index : originalQueue.indexOf(original),
        id: original.id,
        attempts: original.attempts
      }, failure));
    });
    queue = originalQueue.filter(function(row){ return !(row && row.id && dropped[row.id]); });
    if (!settled.length) settled.push(Object.assign({ index:Number.isInteger(index) ? index : null, attempts:0 }, failure));
    return settled;
  }

  function enqueue(change) {
    if (!change || typeof change !== 'object') return { ok:false, code:'invalid-change' };
    var explicitId = change.id == null ? '' : String(change.id);
    if (explicitId && queue.some(function(row){ return row.id === explicitId; })) return { ok:true, duplicate:true, id:explicitId };
    if (queue.length >= limits.hard) {
      console.error('[ChangeQueue] hard capacity reached:', limits.hard);
      return { ok:false, code:'queue-capacity-exceeded', capacity:limits.hard };
    }
    var turn = _nowTurn();
    var previous = queue.length ? queue[queue.length - 1] : null;
    var mergeable = previous && change.newValue === undefined && previous.newValue === undefined &&
      previous.type === change.type && previous.target === change.target && previous.field === change.field &&
      previous.source === (change.source || 'unknown') && previous.queuedTurn === turn;
    if (mergeable) {
      var previousDelta = _finite(previous.delta), nextDelta = _finite(change.delta);
      if (previousDelta !== null && nextDelta !== null) {
        previous.delta = previousDelta + nextDelta;
        previous.description = change.description || previous.description;
        return { ok:true, merged:true, id:previous.id };
      }
    }
    sequence += 1;
    var request = {
      id: explicitId || ('cq_' + Date.now() + '_' + sequence),
      type: change.type,
      target: change.target,
      field: change.field,
      delta: change.delta,
      newValue: change.newValue,
      min: change.min,
      max: change.max,
      description: change.description || '未知变动',
      source: change.source || 'unknown',
      timestamp: Date.now(),
      firstQueuedAt: Date.now(),
      queuedTurn: turn,
      attempts: Number.isInteger(change.attempts) && change.attempts >= 0 ? change.attempts : 0,
      lastErrorCode: change.lastErrorCode || '',
      lastErrorAt: change.lastErrorAt || 0
    };
    queue.push(request);
    if (queue.length === limits.soft) console.warn('[ChangeQueue] soft capacity reached:', limits.soft);
    _dbg('[ChangeQueue] 已加入待结算队列: ' + request.description + ' (队列长度: ' + queue.length + ')');
    return { ok:true, id:request.id, pendingCount:queue.length };
  }

  function applyAll() {
    if (isApplying) return { logs:[], appliedCount:0, failedCount:queue.length, errors:['applyAll reentry'], failures:[{code:'apply-reentry'}], ok:false, pendingCount:queue.length };
    isApplying = true;
    appliedChanges = [];
    var logs = [], localApplied = [], undos = [];
    var originalQueue = queue.slice();
    var processedQueue;
    try {
      processedQueue = (typeof SoftFloorSystem !== 'undefined' && SoftFloorSystem && typeof SoftFloorSystem.processChanges === 'function')
        ? SoftFloorSystem.processChanges(originalQueue.slice()) : originalQueue.slice();
      if (!Array.isArray(processedQueue)) throw new Error('SoftFloorSystem returned non-array changes');
      for (var i=0;i<processedQueue.length;i++) {
        var change = processedQueue[i];
        var handler = change && handlers[change.type];
        var result = handler ? handler(change) : _failure('unsupported-change-type', 'unsupported change type: ' + (change && change.type), false, change);
        if (!result || result.ok !== true) {
          var failure = result && result.ok === false ? result : _failure('handler-result-invalid', 'handler returned no explicit result', false, change);
          for (var u=undos.length-1;u>=0;u--) undos[u]();
          var settledFailures = _finalizeQueuedFailure(originalQueue, change, failure, i);
          appliedChanges = [];
          console.error('[ChangeQueue] batch rolled back:', failure.code, failure.message);
          return {
            logs:[], appliedCount:0, failedCount:1, errors:[failure.message],
            failures:settledFailures,
            ok:false, rolledBack:true, pendingCount:queue.length, deadLetterCount:deadLetters.length,
            executionRate:0
          };
        }
        undos.push(typeof result.undo === 'function' ? result.undo : function(){});
        if (result.log) logs.push(result.log);
        if (result.applied) localApplied.push(result.applied);
      }
      appliedChanges = localApplied;
      return {
        logs:logs, appliedCount:processedQueue.length, failedCount:0, errors:[], failures:[],
        ok:true, pendingCount:queue.length, deadLetterCount:deadLetters.length,
        executionRate:processedQueue.length ? 100 : 0
      };
    } catch (error) {
      for (var j=undos.length-1;j>=0;j--) {
        try { undos[j](); } catch (undoError) { console.error('[ChangeQueue] rollback failed:', undoError); }
      }
      appliedChanges = [];
      console.error('[ChangeQueue] apply failed:', error);
      var exceptionFailure = _failure('apply-exception', error && error.message || String(error), true, change);
      var exceptionFailures = _finalizeQueuedFailure(originalQueue, change, exceptionFailure, i);
      return { logs:[], appliedCount:0, failedCount:exceptionFailures.length, errors:[exceptionFailure.message], failures:exceptionFailures, ok:false, rolledBack:true, pendingCount:queue.length, deadLetterCount:deadLetters.length, executionRate:0 };
    } finally {
      isApplying = false;
    }
  }

  function clear() { var count=queue.length;queue=[];_dbg('[ChangeQueue] 已清空 '+count+' 个变动'); }
  function length() { return queue.length; }
  function getStats() {
    var stats={ total:queue.length, byType:{}, deadLetterCount:deadLetters.length, limits:Object.assign({},limits) };
    queue.forEach(function(change){stats.byType[change.type]=(stats.byType[change.type]||0)+1;});
    return stats;
  }
  function getAppliedChanges() { return appliedChanges.slice(); }
  function getDeadLetters() { return deadLetters.map(function(row){ return Object.assign({}, row, { change:Object.assign({},row.change) }); }); }

  return {
    enqueue:enqueue, applyAll:applyAll, clear:clear, length:length,
    getStats:getStats, getAppliedChanges:getAppliedChanges, getDeadLetters:getDeadLetters
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
   * 还原账本到指定快照（供 agent 回滚·撤销引擎结算对本 module 单例账本的累加）。
   * 账本活在 GM 之外的闭包·deepClone(GM) 的回滚盖不到它·不还原则 LLM 模式重跑结算会二次 push → 本回合收支双记。
   */
  function restoreLedger(snap) {
    if (snap && typeof snap === 'object') {
      ledger = deepClone(snap);
    }
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
    restoreLedger: restoreLedger,
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

var REACTIVE_QUEUE_BATCH_LIMIT = 1000;
var REACTIVE_QUEUE_HARD_LIMIT = 4096;
var REACTIVE_CASCADE_MAX_EVENTS = 10000;
var REACTIVE_CASCADE_MAX_BATCHES = 64;
var REACTIVE_CASCADE_MAX_SAME_KEY = 64;
var REACTIVE_CASCADE_DIAGNOSTIC_LIMIT = 128;
var REACTIVE_YIELD_EVERY_BATCHES = 4;
var _reactiveCascadeSequence = 0;

function ensureReactiveQueueState(targetGM) {
  var G = targetGM || ((typeof GM !== 'undefined' && GM) ? GM : null);
  if (!G) return false;
  if (!G._listeners || typeof G._listeners !== 'object' || Array.isArray(G._listeners)) G._listeners = {};
  if (!Array.isArray(G._changeQueue)) G._changeQueue = [];
  return G;
}

function _reactiveQueueScheduled(G) {
  return !!(G && G._changeQueueScheduled);
}

function _setReactiveQueueScheduled(G, value) {
  if (!G) return;
  try {
    Object.defineProperty(G, '_changeQueueScheduled', { value:!!value, writable:true, configurable:true, enumerable:false });
  } catch (error) {
    G._changeQueueScheduled = !!value;
  }
}

function _setReactiveHiddenState(G, propertyName, value) {
  if (!G) return;
  try {
    Object.defineProperty(G, propertyName, { value:value, writable:true, configurable:true, enumerable:false });
  } catch (error) {
    G[propertyName] = value;
  }
}

function _reactiveQueueProcessing(G) {
  return !!(G && G._reactiveQueueProcessing);
}

function _setReactiveQueueProcessing(G, value) {
  _setReactiveHiddenState(G, '_reactiveQueueProcessing', !!value);
}

function _getReactiveCascade(G, create) {
  var cascade = G && G._reactiveCascade;
  if (cascade && typeof cascade === 'object') return cascade;
  if (!create || !G) return null;
  cascade = {
    id:'reactive-cascade-' + (++_reactiveCascadeSequence),
    batches:0,
    processedEvents:0,
    startedAt:Date.now(),
    perKeyCounts:Object.create(null),
    trace:[],
    nextEntityId:0,
    entityIds:typeof WeakMap === 'function' ? new WeakMap() : null
  };
  _setReactiveHiddenState(G, '_reactiveCascade', cascade);
  return cascade;
}

function _clearReactiveCascade(G) {
  _setReactiveHiddenState(G, '_reactiveCascade', null);
}

function _reactiveChangeKey(cascade, change) {
  var entity = change && change.entity;
  var identity = '';
  if (entity && typeof entity === 'object') {
    if (entity.id !== undefined && entity.id !== null && String(entity.id)) identity = 'id:' + String(entity.id);
    else if (cascade.entityIds) {
      identity = cascade.entityIds.get(entity);
      if (!identity) {
        identity = 'object:' + (++cascade.nextEntityId);
        cascade.entityIds.set(entity, identity);
      }
    }
  }
  if (!identity) identity = 'value:' + String(entity);
  return String(change && change.entityType || '') + '|' + identity + '|' + String(change && change.propertyName || '');
}

function _recordReactiveCascadeDiagnostics(G, cascade, reason, pending) {
  var diagnostics = Array.isArray(G._reactiveCascadeDiagnostics) ? G._reactiveCascadeDiagnostics : [];
  (pending.length ? pending : [null]).forEach(function(change) {
    diagnostics.push({
      cascadeId:cascade.id,
      reason:reason,
      entityType:change && change.entityType || '',
      propertyName:change && change.propertyName || '',
      droppedAt:Date.now()
    });
  });
  if (diagnostics.length > REACTIVE_CASCADE_DIAGNOSTIC_LIMIT) {
    diagnostics.splice(0, diagnostics.length - REACTIVE_CASCADE_DIAGNOSTIC_LIMIT);
  }
  _setReactiveHiddenState(G, '_reactiveCascadeDiagnostics', diagnostics);
}

function _abortReactiveCascade(G, cascade, reason, pending, listenerFailures) {
  pending = Array.isArray(pending) ? pending : [];
  _recordReactiveCascadeDiagnostics(G, cascade, reason, pending);
  G._changeQueue.length = 0;
  _setReactiveQueueScheduled(G, false);
  _setReactiveQueueProcessing(G, false);
  _clearReactiveCascade(G);
  var trace = cascade.trace.slice(-64);
  var error = new Error('响应式属性级联超过安全上限: ' + reason);
  error.code = 'reactive-cascade-limit';
  try {
    if (typeof TM !== 'undefined' && TM && TM.errors && typeof TM.errors.capture === 'function') {
      TM.errors.capture(error, 'reactive-property-cascade', {
        cascadeId:cascade.id,
        reason:reason,
        batches:cascade.batches,
        processedEvents:cascade.processedEvents,
        droppedEvents:pending.length,
        propertyChain:trace
      });
    }
  } catch (_captureError) {
    if (typeof _dbg === 'function') _dbg('[ReactivePropertyQueue] diagnostic capture failed:', _captureError);
  }
  console.error('[ReactivePropertyQueue] cascade aborted:', reason, trace.join(' -> '));
  return {
    ok:false,
    code:'reactive-cascade-limit',
    reason:reason,
    cascadeId:cascade.id,
    batches:cascade.batches,
    processedEvents:cascade.processedEvents,
    listenerFailures:listenerFailures || 0,
    droppedEvents:pending.length,
    pendingCount:0
  };
}

function getReactiveQueueDiagnostics(targetGM) {
  var G = ensureReactiveQueueState(targetGM);
  if (!G || !Array.isArray(G._reactiveCascadeDiagnostics)) return [];
  return G._reactiveCascadeDiagnostics.map(function(row) {
    return {
      cascadeId:row.cascadeId,
      reason:row.reason,
      entityType:row.entityType,
      propertyName:row.propertyName,
      droppedAt:row.droppedAt
    };
  });
}

function _scheduleReactiveQueue(G, useMacrotask) {
  if (!G || _reactiveQueueScheduled(G) || _reactiveQueueProcessing(G)) return;
  _getReactiveCascade(G, true);
  _setReactiveQueueScheduled(G, true);
  var schedule = useMacrotask && typeof setTimeout === 'function'
    ? function(fn){ setTimeout(fn, 0); }
    : (typeof queueMicrotask === 'function' ? queueMicrotask : function(fn){ Promise.resolve().then(fn); });
  schedule(function(){
    _setReactiveQueueScheduled(G, false);
    processChangeQueue(G);
  });
}

// 注册监听器
function registerListener(entityType, propertyName, callback, priority) {
  var G = ensureReactiveQueueState();
  if (!G || typeof callback !== 'function') return { ok:false, code:'invalid-listener' };
  priority = priority || 5;
  var key = entityType + '.' + propertyName;
  if (!G._listeners[key]) G._listeners[key] = [];
  G._listeners[key].push({ callback:callback, priority:priority });
  G._listeners[key].sort(function(a,b){ return a.priority-b.priority; });
  return { ok:true };
}

// 触发属性变化监听；同一微任务内同对象同字段只保留最早旧值与最终新值。
function triggerPropertyChange(entityType, entity, propertyName, oldValue, newValue) {
  if (oldValue === newValue) return { ok:true, changed:false };
  var G = ensureReactiveQueueState();
  if (!G) return { ok:false, code:'world-unavailable' };
  var key = entityType + '.' + propertyName;
  var listeners = G._listeners[key];
  if (!Array.isArray(listeners) || listeners.length === 0) return { ok:true, changed:false };
  var existing = null;
  for (var i=G._changeQueue.length-1;i>=0;i--) {
    var row=G._changeQueue[i];
    if (row && row.entity === entity && row.propertyName === propertyName && row.entityType === entityType) { existing=row; break; }
  }
  if (existing) existing.newValue = newValue;
  else {
    if (G._changeQueue.length >= REACTIVE_QUEUE_HARD_LIMIT) {
      console.error('[ReactivePropertyQueue] hard capacity reached:', REACTIVE_QUEUE_HARD_LIMIT);
      return { ok:false, code:'reactive-queue-capacity-exceeded' };
    }
    G._changeQueue.push({
      entityType:entityType, entity:entity, propertyName:propertyName,
      oldValue:oldValue, newValue:newValue, listeners:listeners.slice()
    });
  }
  _scheduleReactiveQueue(G);
  return { ok:true, changed:true, merged:!!existing };
}

// 独立消费响应式属性事件；从不读取或调用 ChangeQueue 的闭包队列。
function processChangeQueue(targetGM) {
  var G = ensureReactiveQueueState(targetGM);
  if (!G || G._changeQueue.length === 0) {
    if (G) _clearReactiveCascade(G);
    return { ok:true, processedEvents:0, listenerFailures:0, pendingCount:0 };
  }
  if (_reactiveQueueProcessing(G)) {
    return { ok:false, code:'reactive-queue-reentrant', processedEvents:0, listenerFailures:0, pendingCount:G._changeQueue.length };
  }
  var cascade = _getReactiveCascade(G, true);
  if (cascade.batches >= REACTIVE_CASCADE_MAX_BATCHES) {
    return _abortReactiveCascade(G, cascade, 'max-batches', G._changeQueue.slice(), 0);
  }
  cascade.batches++;
  var batch = G._changeQueue.splice(0, REACTIVE_QUEUE_BATCH_LIMIT);
  var listenerFailures = 0;
  _setReactiveQueueProcessing(G, true);
  try {
    for (var batchIndex=0;batchIndex<batch.length;batchIndex++) {
      var change = batch[batchIndex];
      if (cascade.processedEvents >= REACTIVE_CASCADE_MAX_EVENTS) {
        return _abortReactiveCascade(G, cascade, 'max-events', batch.slice(batchIndex).concat(G._changeQueue), listenerFailures);
      }
      var cascadeKey = _reactiveChangeKey(cascade, change);
      var sameKeyCount = cascade.perKeyCounts[cascadeKey] || 0;
      if (sameKeyCount >= REACTIVE_CASCADE_MAX_SAME_KEY) {
        return _abortReactiveCascade(G, cascade, 'max-same-key', batch.slice(batchIndex).concat(G._changeQueue), listenerFailures);
      }
      cascade.perKeyCounts[cascadeKey] = sameKeyCount + 1;
      cascade.processedEvents++;
      cascade.trace.push(String(change.entityType || '') + '.' + String(change.propertyName || ''));
      if (cascade.trace.length > 128) cascade.trace.splice(0, cascade.trace.length - 128);
      (Array.isArray(change.listeners) ? change.listeners : []).forEach(function(listener) {
        if (!listener || typeof listener.callback !== 'function') return;
        try {
          listener.callback(change.entity, change.propertyName, change.oldValue, change.newValue);
        } catch (error) {
          listenerFailures++;
          console.error('[ReactivePropertyQueue] listener failed:', error);
        }
      });
    }
  } catch (error) {
    console.error('[ReactivePropertyQueue] internal processing failed:', error);
    return _abortReactiveCascade(
      G,
      cascade,
      'internal-exception',
      batch.slice(batchIndex).concat(G._changeQueue),
      listenerFailures
    );
  } finally {
    if (_reactiveQueueProcessing(G)) _setReactiveQueueProcessing(G, false);
  }
  if (G._changeQueue.length > 0) {
    _scheduleReactiveQueue(G, cascade.batches % REACTIVE_YIELD_EVERY_BATCHES === 0);
  } else {
    _clearReactiveCascade(G);
  }
  return {
    ok:listenerFailures===0,
    processedEvents:batch.length,
    cascadeProcessedEvents:cascade.processedEvents,
    cascadeBatches:cascade.batches,
    listenerFailures:listenerFailures,
    pendingCount:G._changeQueue.length
  };
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

var editingScenarioId=null;

