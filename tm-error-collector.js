// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-error-collector.js — 全局错误收集器
 *
 * 目的：捕获未 catch 的异常、Promise rejection、手工 capture 点，
 *      集中记录到 TM.errors._log 供玩家和开发者事后诊断。
 *
 * 提供两种手工捕获接口：
 *   capture(e, 'module')          → 记录 + console.warn（可见警告）
 *   captureSilent(e, 'module')    → 仅记录，不 console.warn（后台监测）
 *
 * 空 catch 块迁移约定（R86 约定）：
 *   catch(e){}       → 已批量迁移为 captureSilent，默认静默
 *   catch(_){}       → 显式"不关心"标记，约定**保留**不迁移
 *   catch(e1/e2/_e){}→ JSON 多重回退链的一环，约定**保留**不迁移
 *   localStorage/JSON.parse 回退 catch → 约定**保留**不迁移（可预期失败）
 *
 * 查看：
 *   TM.errors.getLog()           → 所有捕获记录
 *   TM.errors.getLogLoud()       → 非 silent 记录（值得注意的）
 *   TM.errors.getLogSilent()     → silent 记录（例行防御捕获）
 *   TM.errors.getSummary()       → 按 module 汇总
 *   TM.errors.clear()            → 清空
 *   TM.errors.byModule('ai')     → 过滤
 *
 * 配置：
 *   TM.errors.maxLog = 500       → 改上限
 *   TM.errors.consoleMirror = true → 每次 capture 也 console.warn（默认 true，silent 恒不 mirror）
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.errors) return;

  var log = [];
  var MAX = 200;
  var mirror = true;

  function normalize(e) {
    if (!e) return { message: 'nil', stack: null };
    if (typeof e === 'string') return { message: e, stack: null };
    return {
      message: e.message || String(e),
      stack: e.stack || null,
      name: e.name || null
    };
  }

  function capture(e, moduleName, extra) {
    var entry = {
      t: Date.now(),
      module: moduleName || 'unknown',
      turn: (typeof GM !== 'undefined' && GM.turn) || 0,
      error: normalize(e),
      extra: extra || null
    };
    log.push(entry);
    if (log.length > (TM.errors.maxLog || MAX)) log.shift();
    if (mirror && !(extra && extra.silent)) {
      console.warn('[' + entry.module + '] 捕获:', entry.error.message);
      if (entry.error.stack) {
        var lines = String(entry.error.stack).split('\n').slice(0, 3);
        console.warn('  ' + lines.join('\n  '));
      }
    }
    return entry;
  }

  function captureSilent(e, moduleName, extra) {
    var merged = extra ? Object.assign({}, extra, { silent: true }) : { silent: true };
    return capture(e, moduleName, merged);
  }

  function captureUnhandled(event) {
    var e = event.error || event.reason || event;
    var mod = 'uncaught';
    if (event.filename) {
      var m = String(event.filename).match(/\/(tm-[^/?]+)/);
      if (m) mod = m[1];
    }
    capture(e, mod, { filename: event.filename, lineno: event.lineno, colno: event.colno });
  }

  // 全局监听（仅一次）
  if (!window._tmErrorsInstalled) {
    window._tmErrorsInstalled = true;
    try {
      window.addEventListener('error', function(ev){ try { captureUnhandled(ev); } catch(_){} });
      window.addEventListener('unhandledrejection', function(ev){ try { captureUnhandled(ev); } catch(_){} });
    } catch(_e) {}
  }

  TM.errors = {
    capture: capture,
    captureSilent: captureSilent,
    getLog: function() { return log.slice(); },
    getLogSilent: function() { return log.filter(function(e){ return e.extra && e.extra.silent; }); },
    getLogLoud: function() { return log.filter(function(e){ return !(e.extra && e.extra.silent); }); },
    clear: function() { log.length = 0; },
    byModule: function(moduleFilter) {
      return log.filter(function(e){ return e.module && e.module.indexOf(moduleFilter) >= 0; });
    },
    getSummary: function() {
      var byMod = {};
      log.forEach(function(e){
        if (!byMod[e.module]) byMod[e.module] = { count: 0, messages: {} };
        byMod[e.module].count++;
        var msg = (e.error && e.error.message) || 'nil';
        byMod[e.module].messages[msg] = (byMod[e.module].messages[msg] || 0) + 1;
      });
      return byMod;
    },
    get maxLog() { return MAX; },
    set maxLog(v) { MAX = Math.max(10, v | 0); },
    get consoleMirror() { return mirror; },
    set consoleMirror(v) { mirror = !!v; }
  };
})();
