// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-pollution-guard.js — 全局命名空间污染守卫
 *
 * 目的：在游戏运行过程中监视 window.* 的新增/覆盖，
 *      对可疑动作立即告警，防止新引入的脚本静默冲突。
 *
 * 设计：
 *   - 加载时刻 (DOMContentLoaded)  → 对 window 拍快照（basline）
 *   - 可选轮询（TM.guard.start() 开启）→ 每 5s 扫一次 diff
 *   - 发现**新增**全局：console.info + 记录
 *   - 发现**覆盖**（已存在但 value 变了，且原 value 是函数）→ console.error + TM.errors.capture
 *
 * 用法：
 *   TM.guard.snapshot()           // 手动拍快照
 *   TM.guard.diffSince()          // 对比自快照以来新增/覆盖
 *   TM.guard.start()              // 开启 5s 自动巡检
 *   TM.guard.stop()               // 停止巡检
 *   TM.guard.getLog()             // 累计告警日志
 *   TM.guard.report()             // 打印当前污染数统计
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.guard) return;

  var baseline = null;
  var overrideLog = [];
  var addLog = [];
  var timer = null;
  var MAX_LOG = 100;

  // 这些 key 是浏览器原生/第三方，不纳入监视
  var IGNORE_PREFIXES = [
    'webkit', 'moz', 'chrome', 'on',    // 事件 + vendor prefix
    '__', '_webpack', '_react',          // 构建工具
  ];
  var IGNORE_KEYS = {
    '0': 1, '1': 1, '2': 1, '3': 1, '4': 1, '5': 1, '6': 1, '7': 1, '8': 1, '9': 1,
    'length': 1, 'top': 1, 'parent': 1, 'self': 1, 'window': 1, 'document': 1,
    'location': 1, 'navigator': 1, 'history': 1, 'frames': 1, 'screen': 1,
    'performance': 1, 'console': 1, 'localStorage': 1, 'sessionStorage': 1,
    'indexedDB': 1, 'fetch': 1, 'origin': 1, 'crypto': 1,
    // 天命自身的顶级 — 已知合法
    'GM': 1, 'P': 1, 'DA': 1, 'TM': 1, 'SaveManager': 1, 'SaveMigrations': 1, 'SAVE_VERSION': 1,
    'CorruptionEngine': 1, 'GuokuEngine': 1, 'AuthorityEngines': 1, 'AuthorityComplete': 1,
    'HistoricalPresets': 1, 'IntegrationBridge': 1, 'FiscalCascade': 1,
    'HujiEngine': 1, 'EnvCapacityEngine': 1, 'NpcMemorySystem': 1, 'CharEconEngine': 1,
    'CharFullSchema': 1, 'TokenUsageTracker': 1, 'ErrorMonitor': 1, 'NotificationSystem': 1,
    'CY': 1, 'GameHooks': 1, 'SettlementPipeline': 1, 'TM_AI_SCHEMA': 1,
    'EDICT_TYPES': 1, 'REFORM_PHASES': 1, 'RESISTANCE_SOURCES': 1,
    'DEFAULT_PROMPT': 1, 'DEFAULT_RULES': 1
  };

  function _shouldTrack(key) {
    if (IGNORE_KEYS[key]) return false;
    for (var i = 0; i < IGNORE_PREFIXES.length; i++) {
      if (key.indexOf(IGNORE_PREFIXES[i]) === 0) return false;
    }
    return true;
  }

  function _typeOf(v) {
    if (v === null) return 'null';
    if (typeof v === 'function') return 'function';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  function snapshot() {
    baseline = {};
    Object.keys(window).forEach(function(k) {
      if (!_shouldTrack(k)) return;
      baseline[k] = { type: _typeOf(window[k]), ref: window[k] };
    });
    return Object.keys(baseline).length;
  }

  function diffSince() {
    if (!baseline) snapshot();
    var added = [];
    var overridden = [];
    Object.keys(window).forEach(function(k) {
      if (!_shouldTrack(k)) return;
      var v = window[k];
      if (!(k in baseline)) {
        added.push({ key: k, type: _typeOf(v) });
      } else if (baseline[k].ref !== v) {
        // 只关心函数覆盖（数据字段常规变化不算）
        if (baseline[k].type === 'function' || _typeOf(v) === 'function') {
          overridden.push({ key: k, oldType: baseline[k].type, newType: _typeOf(v) });
        }
      }
    });
    return { added: added, overridden: overridden };
  }

  function _reportDiff(diff) {
    diff.added.forEach(function(a) {
      if (addLog.length < MAX_LOG) addLog.push({ t: Date.now(), key: a.key, type: a.type });
      // 新增常见无害：不打 warn，只 info
      console.info('[guard] 新全局: ' + a.key + ' (' + a.type + ')');
    });
    diff.overridden.forEach(function(o) {
      if (overrideLog.length < MAX_LOG) overrideLog.push({ t: Date.now(), key: o.key, oldType: o.oldType, newType: o.newType });
      console.error('[guard] ⚠ 可疑覆盖: ' + o.key + ' (' + o.oldType + ' → ' + o.newType + ')');
      if (window.TM && TM.errors) {
        TM.errors.capture(
          new Error('window.' + o.key + ' 被覆盖 (' + o.oldType + ' → ' + o.newType + ')'),
          'pollution-guard',
          { key: o.key, oldType: o.oldType, newType: o.newType }
        );
      }
    });
    if (diff.overridden.length === 0 && diff.added.length === 0) return;
    // 报告后重置 baseline，避免重复告警
    snapshot();
  }

  function scan() {
    var diff = diffSince();
    _reportDiff(diff);
    return diff;
  }

  function start(intervalMs) {
    if (timer) return;
    if (!baseline) snapshot();
    timer = setInterval(scan, intervalMs || 5000);
  }
  function stop() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function getLog() {
    return { adds: addLog.slice(), overrides: overrideLog.slice() };
  }
  function clearLog() {
    addLog.length = 0;
    overrideLog.length = 0;
  }

  function report() {
    if (!baseline) snapshot();
    var total = Object.keys(baseline).length;
    var byType = {};
    Object.keys(baseline).forEach(function(k) {
      var t = baseline[k].type;
      byType[t] = (byType[t] || 0) + 1;
    });
    console.log('[guard] 当前 window 可追踪全局: ' + total);
    console.log('  按类型:', byType);
    console.log('  自启动累计新增:', addLog.length);
    console.log('  自启动累计覆盖警告:', overrideLog.length);
    return { total: total, byType: byType, addCount: addLog.length, overrideCount: overrideLog.length };
  }

  TM.guard = {
    snapshot: snapshot,
    diffSince: diffSince,
    scan: scan,
    start: start,
    stop: stop,
    getLog: getLog,
    clearLog: clearLog,
    report: report,
    _baseline: function(){ return baseline; }
  };

  // 默认：DOMContentLoaded 后 2s 拍基线快照（等所有 tm-*.js 加载完）
  function _initialSnapshot() {
    setTimeout(function() {
      snapshot();
      // 不默认开启巡检，只记录基线
    }, 2000);
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', _initialSnapshot);
    else _initialSnapshot();
  }
})();
