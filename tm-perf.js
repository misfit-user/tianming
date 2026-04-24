// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-perf.js — 性能采样器（Profiler Lite）
 *
 * 目的：为 Corruption/Guoku/endTurn 等核心 tick 提供耗时采样，
 *      给未来"合并前 vs 合并后"性能对比提供基准数据。
 *
 * 非侵入设计：
 *   - 不自动包装任何函数
 *   - 调用方自己用 TM.perf.mark(name)+TM.perf.measure(name) 成对包
 *   - 或者用 TM.perf.wrap(obj, 'method') 一次性挂上时长采样
 *
 * 主要用法：
 *   // 方式 1：手工 mark
 *   TM.perf.mark('corruption.tick');
 *   CorruptionEngine.tick(ctx);
 *   TM.perf.measure('corruption.tick');
 *
 *   // 方式 2：一次性包装
 *   TM.perf.wrap(CorruptionEngine, 'tick', 'corruption.tick');
 *   // 之后每次 CorruptionEngine.tick(...) 自动记录耗时
 *
 *   // 查报告
 *   TM.perf.report()               // 所有 sample 的 p50/p95/max
 *   TM.perf.reportByName('corruption.tick')  // 单指标
 *   TM.perf.reset()                // 清空
 *
 * UI：Ctrl+Shift+P 打开浮层（同 TM.errors 面板设计）
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.perf) return;

  var samples = {};   // name → array of ms
  var marks = {};     // name → start time
  var thresholds = {}; // name → { ms, handler, triggeredCount }
  var MAX_PER_NAME = 500;
  var enabled = true;

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  }

  function mark(name) {
    if (!enabled || !name) return;
    marks[name] = now();
  }

  function measure(name) {
    if (!enabled || !name) return 0;
    var start = marks[name];
    if (typeof start !== 'number') return 0;
    var dt = now() - start;
    delete marks[name];
    _record(name, dt);
    return dt;
  }

  /** 一次性包装某对象的方法，后续调用自动采样 */
  function wrap(obj, methodName, sampleName) {
    if (!obj || typeof obj[methodName] !== 'function') {
      console.warn('[perf.wrap] 方法不存在:', methodName);
      return false;
    }
    var key = '__perfOrig_' + methodName;
    if (obj[key]) {
      console.warn('[perf.wrap] 已包装过:', methodName);
      return false;
    }
    var orig = obj[methodName];
    obj[key] = orig;
    var tag = sampleName || methodName;
    obj[methodName] = function() {
      if (!enabled) return orig.apply(this, arguments);
      var t0 = now();
      try {
        var ret = orig.apply(this, arguments);
        // 支持 Promise
        if (ret && typeof ret.then === 'function') {
          return ret.then(function(v){
            _record(tag, now() - t0);
            return v;
          }, function(e){
            _record(tag, now() - t0);
            throw e;
          });
        }
        _record(tag, now() - t0);
        return ret;
      } catch(e) {
        _record(tag, now() - t0);
        throw e;
      }
    };
    return true;
  }

  function _record(name, dt) {
    if (!samples[name]) samples[name] = [];
    samples[name].push(dt);
    if (samples[name].length > MAX_PER_NAME) samples[name].shift();
    // 阈值告警
    _checkThreshold(name, dt);
  }

  function _checkThreshold(name, dt) {
    var th = thresholds[name];
    if (!th || typeof th.ms !== 'number') return;
    if (dt <= th.ms) return;
    th.triggeredCount = (th.triggeredCount || 0) + 1;
    // 默认行为：TM.errors.capture + 浮层闪烁提示
    if (th.handler) {
      try { th.handler(name, dt, th.ms); }
      catch(e) { if (window.TM && TM.errors) TM.errors.capture(e, 'perf.threshold.' + name); }
    } else {
      _defaultThresholdHandler(name, dt, th.ms);
    }
  }

  function _defaultThresholdHandler(name, dt, threshold) {
    // 记录到 TM.errors 作为可观测
    if (window.TM && TM.errors) {
      TM.errors.capture(
        new Error('[perf] ' + name + ' 超阈值: ' + dt.toFixed(2) + 'ms > ' + threshold + 'ms'),
        'perf.threshold',
        { name: name, ms: dt, threshold: threshold }
      );
    }
    // UI 闪烁（若面板已开，高亮该行一瞬间）
    var panel = document.getElementById(panelId);
    if (panel && panel.style && !panel._blinking) {
      panel._blinking = true;
      var origBg = panel.style.background;
      panel.style.background = '#2a1010';
      setTimeout(function(){
        if (panel && panel.style) panel.style.background = origBg;
        panel._blinking = false;
        renderPanel(); // 刷新数据
      }, 200);
    }
  }

  /** 注册阈值：超过 ms 自动告警
   *  setThreshold('corruption.tick', 500)         默认 handler
   *  setThreshold('corruption.tick', 500, fn)     自定义 handler(name,dt,threshold)
   *  setThreshold('corruption.tick', null)        移除阈值
   */
  function setThreshold(name, ms, handler) {
    if (!name) return false;
    if (ms == null) {
      delete thresholds[name];
      return true;
    }
    thresholds[name] = { ms: ms, handler: handler || null, triggeredCount: 0 };
    return true;
  }

  function getThresholds() {
    var out = {};
    Object.keys(thresholds).forEach(function(k){
      out[k] = { ms: thresholds[k].ms, triggeredCount: thresholds[k].triggeredCount || 0 };
    });
    return out;
  }

  /** 手动记录一次时长（用于已经有 start/end 的场景） */
  function record(name, ms) {
    if (!enabled || !name || typeof ms !== 'number') return;
    _record(name, ms);
  }

  function _stats(arr) {
    if (!arr || arr.length === 0) return null;
    var sorted = arr.slice().sort(function(a,b){return a-b;});
    var n = sorted.length;
    var sum = 0;
    for (var i = 0; i < n; i++) sum += sorted[i];
    return {
      count: n,
      sum: Math.round(sum * 100) / 100,
      avg: Math.round((sum/n) * 100) / 100,
      min: Math.round(sorted[0] * 100) / 100,
      p50: Math.round(sorted[Math.floor(n*0.5)] * 100) / 100,
      p95: Math.round(sorted[Math.min(n-1, Math.floor(n*0.95))] * 100) / 100,
      p99: Math.round(sorted[Math.min(n-1, Math.floor(n*0.99))] * 100) / 100,
      max: Math.round(sorted[n-1] * 100) / 100
    };
  }

  function report() {
    var out = {};
    Object.keys(samples).forEach(function(k){ out[k] = _stats(samples[k]); });
    return out;
  }

  function reportByName(name) {
    return _stats(samples[name]);
  }

  function reset(name) {
    if (name) {
      delete samples[name];
      delete marks[name];
    } else {
      samples = {};
      marks = {};
    }
  }

  /** 打印表格到控制台 */
  function print() {
    var r = report();
    var rows = Object.keys(r).map(function(k){
      var s = r[k];
      return { name: k, count: s.count, avg: s.avg, p50: s.p50, p95: s.p95, max: s.max };
    }).sort(function(a,b){ return b.p95 - a.p95; });
    if (typeof console.table === 'function') console.table(rows);
    else console.log(JSON.stringify(rows, null, 2));
    return rows;
  }

  /** 下载采样 JSON（给合并前后对比用） */
  function downloadJSON() {
    var data = {
      when: new Date().toISOString(),
      turn: (typeof GM !== 'undefined' && GM.turn) || 0,
      samples: samples,
      report: report()
    };
    try {
      var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tm-perf-' + Date.now() + '.json';
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    } catch(e) { console.warn('[perf] 下载失败', e); }
  }

  // ─── UI 浮层（Ctrl+Shift+P） ───
  var panelId = 'tm-perf-panel';
  var isOpen = false;
  function openPanel() {
    if (isOpen) return;
    isOpen = true;
    var el = document.createElement('div');
    el.id = panelId;
    el.style.cssText = 'position:fixed;right:20px;bottom:20px;width:720px;max-width:92vw;max-height:76vh;overflow:hidden;'
      + 'background:#0f0c08;border:1px solid #5a3a1a;border-radius:6px;box-shadow:0 8px 28px rgba(0,0,0,0.7);'
      + 'z-index:99991;color:#ddd;font-family:sans-serif';
    document.body.appendChild(el);
    renderPanel();
  }
  function closePanel() {
    var el = document.getElementById(panelId);
    if (el) el.remove();
    isOpen = false;
  }
  function togglePanel() { isOpen ? closePanel() : openPanel(); }
  function renderPanel() {
    var el = document.getElementById(panelId);
    if (!el) return;
    var r = report();
    var names = Object.keys(r).sort(function(a,b){ return r[b].p95 - r[a].p95; });
    var rows = names.map(function(n){
      var s = r[n];
      return '<tr>'
        + '<td style="padding:4px 8px;color:#e8c66e">' + n + '</td>'
        + '<td style="padding:4px 8px;text-align:right">' + s.count + '</td>'
        + '<td style="padding:4px 8px;text-align:right">' + s.avg + 'ms</td>'
        + '<td style="padding:4px 8px;text-align:right;color:#7a7">' + s.p50 + '</td>'
        + '<td style="padding:4px 8px;text-align:right;color:#d99">' + s.p95 + '</td>'
        + '<td style="padding:4px 8px;text-align:right;color:#c66">' + s.max + '</td>'
        + '</tr>';
    }).join('') || '<tr><td colspan="6" style="padding:14px;text-align:center;color:#666">尚无采样数据</td></tr>';
    el.innerHTML =
      '<div style="display:flex;align-items:center;padding:10px 14px;border-bottom:1px solid #3a2a10;background:#1a1410">'
      + '<b style="color:#e8c66e;font-size:14px">性能采样 · TM.perf</b>'
      + '<span style="color:#888;font-size:11px;margin-left:10px">Ctrl+Shift+P 关闭</span>'
      + '<div style="margin-left:auto;display:flex;gap:8px">'
      +   '<button onclick="TM.perf.reset();TM.perf._renderPanel();" style="background:#2a1a1a;color:#d99;border:1px solid #5a3a3a;padding:4px 10px;cursor:pointer;font-size:11px">重置</button>'
      +   '<button onclick="TM.perf.downloadJSON()" style="background:#1a1a2a;color:#9cd;border:1px solid #3a3a5a;padding:4px 10px;cursor:pointer;font-size:11px">下载</button>'
      +   '<button onclick="TM.perf._renderPanel()" style="background:#1a2a1a;color:#9c9;border:1px solid #3a5a3a;padding:4px 10px;cursor:pointer;font-size:11px">刷新</button>'
      +   '<button onclick="TM.perf._closePanel()" style="background:#2a2a2a;color:#ccc;border:1px solid #4a4a4a;padding:4px 10px;cursor:pointer;font-size:11px">关闭</button>'
      + '</div></div>'
      + '<div style="overflow:auto;max-height:calc(76vh - 50px)">'
      + '<table style="width:100%;border-collapse:collapse;font-size:12px">'
      + '<thead><tr style="background:#1a1410;color:#9ac870"><th style="padding:6px 8px;text-align:left">sample</th><th style="padding:6px 8px;text-align:right">count</th><th style="padding:6px 8px;text-align:right">avg</th><th style="padding:6px 8px;text-align:right">p50</th><th style="padding:6px 8px;text-align:right">p95</th><th style="padding:6px 8px;text-align:right">max</th></tr></thead>'
      + '<tbody>' + rows + '</tbody>'
      + '</table></div>';
  }

  function installHotkey() {
    if (window._tmPerfHotkey) return;
    window._tmPerfHotkey = true;
    document.addEventListener('keydown', function(e){
      if (e.ctrlKey && e.shiftKey && (e.key === 'P' || e.key === 'p')) {
        e.preventDefault();
        togglePanel();
      }
    });
  }
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installHotkey);
    else installHotkey();
  }

  // ─── Baseline Lock（合并前/后 p95 对比） ───
  var baseline = null;

  /** 锁定当前 report() 作为基准（合并前调一次） */
  function lockBaseline() {
    baseline = {
      when: new Date().toISOString(),
      turn: (typeof GM !== 'undefined' && GM.turn) || 0,
      report: report()
    };
    try { localStorage.setItem('tm_perf_baseline', JSON.stringify(baseline)); } catch(e){}
    console.log('[perf] baseline 已锁定:', Object.keys(baseline.report).length, '项');
    return baseline;
  }

  /** 从 localStorage 恢复（跨 session） */
  function loadBaseline() {
    try {
      var s = localStorage.getItem('tm_perf_baseline');
      if (s) { baseline = JSON.parse(s); return baseline; }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-perf');}catch(_){}}
    return null;
  }

  /** 清除基准 */
  function clearBaseline() {
    baseline = null;
    try { localStorage.removeItem('tm_perf_baseline'); } catch(e){}
  }

  /** 对比当前 vs baseline，返回 regressions 列表 */
  function compareToBaseline(thresholdPct) {
    thresholdPct = thresholdPct || 20; // 默认 p95 涨超 20% 算回归
    if (!baseline) {
      var loaded = loadBaseline();
      if (!loaded) return { ok: false, error: '无 baseline，先调 TM.perf.lockBaseline()' };
    }
    var current = report();
    var regressions = [];
    var improvements = [];
    var untouched = [];
    Object.keys(current).forEach(function(name) {
      var cur = current[name];
      var base = baseline.report[name];
      if (!base) {
        // baseline 里没有 → 新指标，跳过
        return;
      }
      var pctChange = base.p95 > 0 ? ((cur.p95 - base.p95) / base.p95 * 100) : 0;
      var entry = {
        name: name,
        basePercentile95: base.p95,
        curPercentile95: cur.p95,
        pctChange: Math.round(pctChange * 10) / 10,
        baseCount: base.count,
        curCount: cur.count
      };
      if (pctChange > thresholdPct) regressions.push(entry);
      else if (pctChange < -thresholdPct) improvements.push(entry);
      else untouched.push(entry);
    });
    return {
      ok: regressions.length === 0,
      baseline: baseline.when,
      baselineTurn: baseline.turn,
      thresholdPct: thresholdPct,
      regressions: regressions,
      improvements: improvements,
      untouched: untouched
    };
  }

  /** 打印对比报告到控制台 */
  function printCompare(thresholdPct) {
    var r = compareToBaseline(thresholdPct);
    if (r.error) { console.warn('[perf]', r.error); return r; }
    console.log('%c[perf] baseline: ' + r.baseline + ' (T' + r.baselineTurn + ')', 'color:#6a9');
    if (r.regressions.length > 0) {
      console.error('[perf] 性能回归 ' + r.regressions.length + ' 项:');
      console.table(r.regressions);
    }
    if (r.improvements.length > 0) {
      console.log('%c[perf] 性能改善 ' + r.improvements.length + ' 项:', 'color:#7a7');
      console.table(r.improvements);
    }
    console.log('[perf] 持平 ' + r.untouched.length + ' 项');
    return r;
  }

  TM.perf = {
    mark: mark,
    measure: measure,
    wrap: wrap,
    record: record,
    report: report,
    reportByName: reportByName,
    reset: reset,
    print: print,
    downloadJSON: downloadJSON,
    openPanel: openPanel,
    closePanel: closePanel,
    togglePanel: togglePanel,
    setThreshold: setThreshold,
    getThresholds: getThresholds,
    lockBaseline: lockBaseline,
    loadBaseline: loadBaseline,
    clearBaseline: clearBaseline,
    compareToBaseline: compareToBaseline,
    printCompare: printCompare,
    getBaseline: function(){ return baseline; },
    _renderPanel: renderPanel,
    _closePanel: closePanel,
    get enabled() { return enabled; },
    set enabled(v) { enabled = !!v; },
    _samples: samples,
    _marks: marks,
    _thresholds: thresholds
  };

  // 启动时尝试恢复 baseline（跨 session）
  loadBaseline();

  // 自动接入核心 tick（若引擎已加载）
  function autoWrap() {
    try {
      if (typeof CorruptionEngine !== 'undefined' && CorruptionEngine.tick && !CorruptionEngine.__perfOrig_tick) {
        wrap(CorruptionEngine, 'tick', 'corruption.tick');
      }
      if (typeof GuokuEngine !== 'undefined' && GuokuEngine.tick && !GuokuEngine.__perfOrig_tick) {
        wrap(GuokuEngine, 'tick', 'guoku.tick');
      }
      if (typeof AuthorityEngines !== 'undefined' && AuthorityEngines.tick && !AuthorityEngines.__perfOrig_tick) {
        wrap(AuthorityEngines, 'tick', 'authority.tick');
      }
      // 默认阈值（基于经验值，可通过 TM.perf.setThreshold 覆盖）
      setThreshold('corruption.tick', 500);   // 腐败 tick > 500ms 告警
      setThreshold('guoku.tick', 800);        // 国库 5 层叠加·宽松
      setThreshold('authority.tick', 400);    // 权威 tick > 400ms 告警
    } catch(e) { if (window.TM && TM.errors) TM.errors.capture(e, 'perf.autoWrap'); }
  }
  // 延迟 1s 自动挂（保证 LAYERED 链的终版已安装）
  if (typeof setTimeout === 'function') setTimeout(autoWrap, 1000);
  TM.perf._autoWrap = autoWrap;

})();
