// @ts-check
// ============================================================
// tm-state-snapshot.js — Swipe 快照与 timeTravel 回溯（2026-04-30 Phase 2.1）
//
// 设计来源：ST-Prompt-Template 的 chat[msg_id].variables[swipe_id] 范式
//
// 核心：每回合 endTurn 完成后·对关键 GM 子树做深拷贝·存入 IndexedDB
// 用途：玩家可以"穿越"回任意历史回合·重新颁布诏令·重玩
// 不存：shijiHistory 自身（append-only 历史）·_aiMemory（可重建）·临时 _turnAiResults
// ============================================================

(function(global) {
  'use strict';

  var DB_NAME = 'tianming_snapshots';
  var STORE = 'snapshots';
  var DB_VERSION = 1;
  var MAX_SNAPSHOTS = 200; // 200 回合保留·之后 LRU 淘汰

  var _dbPromise = null;
  function _openDB() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise(function(resolve, reject) {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB 不可用'));
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'turn' });
        }
      };
      req.onsuccess = function(e) { resolve(e.target.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
    return _dbPromise;
  }

  // 深拷贝（结构化克隆等价物·函数会被丢弃）
  function _deepClone(obj) {
    if (obj == null || typeof obj !== 'object') return obj;
    try {
      if (typeof structuredClone === 'function') return structuredClone(obj);
    } catch(_se){}
    try { return JSON.parse(JSON.stringify(obj)); } catch(_e){ return null; }
  }

  // 取 GM 中需要快照的字段（不含 shijiHistory/evtLog/临时态）
  function _captureCriticalState() {
    if (typeof GM === 'undefined' || !GM) return null;
    return {
      turn: GM.turn || 0,
      ts: Date.now(),
      vars: _deepClone(GM.vars || {}),
      chars: _deepClone(GM.chars || []),
      finance: _deepClone(GM.finance || {}),
      provinceStats: _deepClone(GM.provinceStats || {}),
      activeSchemes: _deepClone(GM.activeSchemes || []),
      _edictTracker: _deepClone(GM._edictTracker || []),
      _epitaphs: _deepClone(GM._epitaphs || []),
      _foreshadows: _deepClone(GM._foreshadows || []),
      _npcCognition: _deepClone(GM._npcCognition || {}),
      _memTables: _deepClone(GM._memTables || {}),
      _historicalDeviations: _deepClone(GM._historicalDeviations || []),
      _authorityPrev: _deepClone(GM._authorityPrev || {}),
      // 国势变量（authority-engines 持有的对象类型）
      huangquan: _deepClone(GM.huangquan),
      huangwei: _deepClone(GM.huangwei),
      minxin: _deepClone(GM.minxin),
      lizhi: _deepClone(GM.lizhi),
      // 自定义字段
      _energy: GM._energy,
      _tyrantDecadence: GM._tyrantDecadence,
      // 玩家档案侧信息
      sid: GM.sid,
      _capital: GM._capital
    };
  }

  function _applyCapturedState(snap) {
    if (!snap || typeof GM === 'undefined') return false;
    // 只覆盖快照里有的键·避免误删运行时字段
    Object.keys(snap).forEach(function(k) {
      if (k === 'ts') return;
      if (k === 'turn') { GM.turn = snap.turn; return; }
      // structuredClone 出来的字段直接赋值
      GM[k] = snap[k];
    });
    return true;
  }

  // ────── 持久化 ──────
  function saveSnapshot(turn) {
    var curGM = (typeof GM !== 'undefined') ? GM : null;
    turn = turn || (curGM && curGM.turn) || 0;
    var data = _captureCriticalState();
    if (!data) return Promise.resolve({ ok: false, reason: 'no GM' });
    return _openDB().then(function(db) {
      return new Promise(function(resolve) {
        try {
          var tx = db.transaction(STORE, 'readwrite');
          var store = tx.objectStore(STORE);
          store.put(data);
          tx.oncomplete = function() {
            // LRU 清理
            _enforceLRU(MAX_SNAPSHOTS).then(function() {
              resolve({ ok: true, turn: turn });
            });
          };
          tx.onerror = function(e) { resolve({ ok: false, error: e.target.error }); };
        } catch(e) { resolve({ ok: false, error: e }); }
      });
    }).catch(function(e) { return { ok: false, error: e }; });
  }

  function loadSnapshot(turn) {
    return _openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).get(turn);
        req.onsuccess = function(e) { resolve(e.target.result || null); };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function listSnapshots() {
    return _openDB().then(function(db) {
      return new Promise(function(resolve, reject) {
        var tx = db.transaction(STORE, 'readonly');
        var req = tx.objectStore(STORE).getAll();
        req.onsuccess = function(e) {
          var arr = e.target.result || [];
          arr.sort(function(a, b) { return a.turn - b.turn; });
          // 只返回元数据·避免一次性把所有快照载入内存
          resolve(arr.map(function(s) { return { turn: s.turn, ts: s.ts }; }));
        };
        req.onerror = function(e) { reject(e.target.error); };
      });
    });
  }

  function deleteSnapshot(turn) {
    return _openDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(turn);
        tx.oncomplete = function() { resolve({ ok: true }); };
      });
    });
  }

  function _enforceLRU(max) {
    return _openDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction(STORE, 'readwrite');
        var store = tx.objectStore(STORE);
        store.getAllKeys().onsuccess = function(e) {
          var keys = e.target.result || [];
          if (keys.length <= max) { resolve(); return; }
          keys.sort(function(a, b) { return a - b; });
          var del = keys.slice(0, keys.length - max);
          del.forEach(function(k) { store.delete(k); });
          tx.oncomplete = function() { resolve(); };
        };
      });
    });
  }

  // ────── 穿越回溯 ──────
  function timeTravel(targetTurn, opts) {
    opts = opts || {};
    if (typeof GM === 'undefined' || !GM) return Promise.resolve({ ok: false, reason: 'no GM' });
    return loadSnapshot(targetTurn).then(function(snap) {
      if (!snap) return { ok: false, reason: 'no snapshot for turn ' + targetTurn };
      // 先保存当前回合作为"穿越前点"·允许返航
      var currentTurn = (typeof GM !== 'undefined' && GM && GM.turn) || 0;
      return saveSnapshot(currentTurn).then(function() {
        // 恢复目标快照状态
        _applyCapturedState(snap);
        // shijiHistory 回滚到 targetTurn（保留 0..targetTurn 段）
        if (Array.isArray(GM.shijiHistory) && !opts.keepShijiHistory) {
          GM.shijiHistory = GM.shijiHistory.filter(function(s) { return s && (s.turn || 0) <= targetTurn; });
        }
        // evtLog 同理
        if (Array.isArray(GM.evtLog) && !opts.keepEvtLog) {
          GM.evtLog = GM.evtLog.filter(function(e) { return e && (e.turn || 0) <= targetTurn; });
        }
        // 清掉临时态
        delete GM._turnAiResults;
        delete GM._postTurnJobs;
        // 标记
        GM._timeTravelHistory = GM._timeTravelHistory || [];
        GM._timeTravelHistory.push({ from: currentTurn, to: targetTurn, ts: Date.now() });
        // 保存游戏（如果有保存系统）
        if (typeof saveGame === 'function') {
          try { saveGame(); } catch(_se){}
        }
        return { ok: true, restoredTurn: targetTurn, savedFromTurn: currentTurn };
      });
    });
  }

  // ────── 自动钩子（接到 endTurn after 链末尾） ──────
  function registerAutoSnapshot() {
    if (typeof EndTurnHooks === 'undefined' || !EndTurnHooks || !EndTurnHooks.register) return false;
    EndTurnHooks.register('after', function() {
      // 异步保存·不阻塞玩家
      try {
        var t = (typeof GM !== 'undefined' && GM && GM.turn) ? GM.turn : 0;
        if (t > 0) saveSnapshot(t);
      } catch(_e){}
    }, 'StateSnapshot.autoSave');
    return true;
  }

  // 立即注册（脚本加载时·EndTurnHooks 已在更早脚本里就绪）
  // 如果 EndTurnHooks 还没有·延迟到 DOMContentLoaded
  function _tryRegister() {
    if (registerAutoSnapshot()) return;
    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', function() {
        registerAutoSnapshot();
      });
    }
  }
  _tryRegister();

  // ────── 暴露 API ──────
  global.StateSnapshot = {
    save: saveSnapshot,
    load: loadSnapshot,
    list: listSnapshots,
    delete: deleteSnapshot,
    timeTravel: timeTravel
  };
  // GM.timeTravel 便利入口（参考 ST-Prompt-Template 的 setvar/getvar 风格）
  Object.defineProperty(global, '_timeTravel', { value: timeTravel, writable: false, configurable: true });
})(typeof window !== 'undefined' ? window : this);
