// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-hooks-tracker.js — GameHooks 查询/追踪工具
 *
 * 原 GameHooks 的 hooks 内部状态在闭包里，外部无法查询。
 * 此模块通过**拦截** on/run 调用，自己维护一份镜像，提供：
 *   - TM.hooks.list()           列出所有 event 名 + 注册数
 *   - TM.hooks.listHandlers(ev) 查某 event 的所有 handler（带 priority）
 *   - TM.hooks.trace(ev, bool)  开/关某 event 的调用追踪（记录每次 run）
 *   - TM.hooks.getTrace(ev)     查看追踪历史
 *   - TM.hooks.discover()       扫描所有 tm-*.js 文件抽取 hook 名字（静态）
 *
 * 不修改 GameHooks 任何行为，完全透明。
 * 如果 GameHooks 未加载，本模块空操作。
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.hooks) return;

  // 镜像：event → [{fn, pri, addedAt, stack}]
  var mirror = {};
  // 追踪标志
  var traceFlags = {};
  var traceLog = [];
  var MAX_TRACE_LOG = 200;

  /** 包装 GameHooks（若已加载） */
  function installMirror() {
    if (typeof GameHooks === 'undefined' || !GameHooks) return false;
    if (GameHooks._tmMirrorInstalled) return true;
    GameHooks._tmMirrorInstalled = true;

    var origOn = GameHooks.on;
    var origRun = GameHooks.run;
    var origClear = GameHooks.clear;

    GameHooks.on = function(event, fn, priority) {
      if (!mirror[event]) mirror[event] = [];
      mirror[event].push({
        fn: fn,
        pri: priority || 0,
        addedAt: Date.now(),
        fnName: (fn && fn.name) || '(anonymous)'
      });
      mirror[event].sort(function(a, b){ return a.pri - b.pri; });
      return origOn.apply(this, arguments);
    };

    GameHooks.run = function(event) {
      if (traceFlags[event] || traceFlags['*']) {
        var args = Array.prototype.slice.call(arguments, 1);
        var entry = {
          event: event,
          t: Date.now(),
          turn: (typeof GM !== 'undefined' && GM.turn) || 0,
          argsPreview: args.slice(0, 3).map(function(a){
            if (a === null || a === undefined) return String(a);
            if (typeof a === 'object') return '[obj]';
            return String(a).slice(0, 40);
          }),
          handlerCount: (mirror[event] || []).length
        };
        traceLog.push(entry);
        if (traceLog.length > MAX_TRACE_LOG) traceLog.shift();
      }
      return origRun.apply(this, arguments);
    };

    GameHooks.clear = function(event) {
      if (event) delete mirror[event];
      else mirror = {};
      return origClear.apply(this, arguments);
    };

    return true;
  }

  /** 列出所有 event 及其 handler 数 */
  function list() {
    return Object.keys(mirror).map(function(ev){
      return { event: ev, handlerCount: mirror[ev].length };
    }).sort(function(a,b){ return b.handlerCount - a.handlerCount; });
  }

  /** 查看某 event 的所有 handler */
  function listHandlers(event) {
    return (mirror[event] || []).map(function(h){
      return { fnName: h.fnName, priority: h.pri, addedAt: new Date(h.addedAt).toISOString() };
    });
  }

  /** 开启/关闭某 event 追踪（'*' = 所有） */
  function trace(event, on) {
    traceFlags[event] = !!on;
    return traceFlags[event];
  }

  /** 查看追踪历史 */
  function getTrace(event) {
    if (event) return traceLog.filter(function(e){ return e.event === event; });
    return traceLog.slice();
  }

  /** 清空追踪 */
  function clearTrace() {
    traceLog.length = 0;
  }

  /** 打印当前 hook 分布 */
  function report() {
    var l = list();
    console.log('%c[hooks] 共 ' + l.length + ' 个 event，' + l.reduce(function(s,x){return s+x.handlerCount;}, 0) + ' 个 handler', 'color:#e8c66e');
    if (typeof console.table === 'function') console.table(l);
    return l;
  }

  /** 静态发现：grep tm-*.js 里所有 GameHooks.run('xxx') 调用的名字
   *  这是通过 window 访问不到的，仅能返回已注册的镜像中 event 名
   *  真正的"所有可能 event 名"需要运行时收集或静态 grep
   */
  function discover() {
    // 运行时角度：只能返回已注册+已追踪的
    var registered = Object.keys(mirror);
    var tracked = {};
    traceLog.forEach(function(e){ tracked[e.event] = (tracked[e.event] || 0) + 1; });
    return {
      registered: registered,
      everSeen: Object.keys(tracked),
      seenCounts: tracked,
      note: '真正的完整 hook 名单需要静态 grep tm-*.js 中所有 GameHooks.run/on 的字符串字面量'
    };
  }

  // 尝试安装（GameHooks 可能还没加载）
  var ok = installMirror();
  if (!ok && typeof setTimeout === 'function') {
    // 延迟重试
    var tries = 0;
    var timer = setInterval(function(){
      tries++;
      if (installMirror() || tries > 20) clearInterval(timer);
    }, 500);
  }

  TM.hooks = {
    list: list,
    listHandlers: listHandlers,
    trace: trace,
    getTrace: getTrace,
    clearTrace: clearTrace,
    report: report,
    discover: discover,
    installMirror: installMirror,
    _mirror: mirror,
    _traceLog: traceLog,
    _traceFlags: traceFlags
  };
})();
