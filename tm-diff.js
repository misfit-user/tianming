// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-diff.js — 对象差异工具
 *
 * 目的：对比两个对象（通常是 TM.state 快照），输出增/删/改字段清单。
 *      为合并前后 GM 状态对比、存档新旧版本对比、AI 输出前后对比提供工具。
 *
 * 用法：
 *   var a = TM.state.snapshot('before');
 *   // ... 做一些事 ...
 *   var b = TM.state.snapshot('after');
 *   var d = TM.diff(a.summary, b.summary);
 *
 *   d.added      [{path, value}]      仅 b 有
 *   d.removed    [{path, value}]      仅 a 有
 *   d.changed    [{path, from, to}]   两者都有但不同
 *   d.summary    统计信息
 *
 *   TM.diff.print(a.summary, b.summary)   控制台打印
 *   TM.diff(a, b, { ignore: ['_perf','_errors'] })  排除某些路径
 *   TM.diff(a, b, { onlyPath: 'chars.*' })  只看 chars 相关
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.diff && typeof window.TM.diff === 'function') return;

  var MAX_DEPTH = 8;
  var MAX_CHANGES = 500;

  function _typeOf(v) {
    if (v === null) return 'null';
    if (Array.isArray(v)) return 'array';
    return typeof v;
  }

  function _isLeaf(v) {
    var t = _typeOf(v);
    return t === 'null' || t === 'undefined' || t === 'number' || t === 'string' || t === 'boolean';
  }

  function _pathMatch(path, pattern) {
    // 支持 * 通配符：chars.* 匹配 chars.foo/chars.bar
    if (!pattern) return true;
    if (pattern === path) return true;
    if (pattern.indexOf('*') < 0) return path.indexOf(pattern) === 0;
    var re = new RegExp('^' + pattern.replace(/\./g, '\\.').replace(/\*/g, '[^.]*') + '(\\..+)?$');
    return re.test(path);
  }

  function _shouldIgnore(path, ignoreList) {
    if (!ignoreList || !ignoreList.length) return false;
    for (var i = 0; i < ignoreList.length; i++) {
      if (_pathMatch(path, ignoreList[i])) return true;
    }
    return false;
  }

  function _walk(a, b, path, result, opts, depth) {
    if (depth > MAX_DEPTH) return;
    if (result.changed.length + result.added.length + result.removed.length >= MAX_CHANGES) {
      result._truncated = true;
      return;
    }
    if (opts.onlyPath && !_pathMatch(path, opts.onlyPath) && path) {
      // path 为空是根，继续走
      if (path && !(opts.onlyPath + '.').indexOf(path + '.') === 0) return;
    }
    if (_shouldIgnore(path, opts.ignore)) return;

    var ta = _typeOf(a), tb = _typeOf(b);

    if (ta === 'undefined' && tb === 'undefined') return;
    if (ta === 'undefined') { result.added.push({ path: path, value: b }); return; }
    if (tb === 'undefined') { result.removed.push({ path: path, value: a }); return; }

    if (ta !== tb) {
      result.changed.push({ path: path, from: a, to: b, typeChange: ta + '→' + tb });
      return;
    }

    if (_isLeaf(a)) {
      if (a !== b) result.changed.push({ path: path, from: a, to: b });
      return;
    }

    if (ta === 'array') {
      // 数组：按长度+每项对比
      if (a.length !== b.length) {
        result.changed.push({ path: path + '.length', from: a.length, to: b.length });
      }
      var maxLen = Math.max(a.length, b.length);
      for (var i = 0; i < maxLen; i++) {
        _walk(a[i], b[i], path + '[' + i + ']', result, opts, depth + 1);
      }
      return;
    }

    // 对象
    var allKeys = {};
    Object.keys(a).forEach(function(k){ allKeys[k] = true; });
    Object.keys(b).forEach(function(k){ allKeys[k] = true; });
    Object.keys(allKeys).forEach(function(k){
      var sub = path ? path + '.' + k : k;
      _walk(a[k], b[k], sub, result, opts, depth + 1);
    });
  }

  function diff(a, b, opts) {
    opts = opts || {};
    var result = {
      added: [],
      removed: [],
      changed: [],
      _truncated: false
    };
    _walk(a, b, '', result, opts, 0);
    result.summary = {
      addedCount: result.added.length,
      removedCount: result.removed.length,
      changedCount: result.changed.length,
      total: result.added.length + result.removed.length + result.changed.length,
      truncated: result._truncated
    };
    return result;
  }

  function _short(v) {
    if (v === null) return 'null';
    if (v === undefined) return 'undef';
    if (typeof v === 'string') return '"' + v.slice(0, 40) + (v.length > 40 ? '…' : '') + '"';
    if (typeof v === 'number') return String(v);
    if (typeof v === 'boolean') return String(v);
    try {
      var s = JSON.stringify(v);
      return s.length > 60 ? s.slice(0, 60) + '…' : s;
    } catch(e) { return '[复杂]'; }
  }

  /** 控制台树形打印 */
  function print(a, b, opts) {
    var d = diff(a, b, opts);
    console.log('%c[diff] ' + d.summary.changedCount + ' 改 / ' + d.summary.addedCount + ' 增 / ' + d.summary.removedCount + ' 删'
      + (d._truncated ? '（已截断）' : ''),
      'color:#e8c66e;font-weight:bold');
    if (d.changed.length) {
      console.log('%c— 改动 —', 'color:#d99');
      d.changed.slice(0, 20).forEach(function(c){
        console.log('  ~ ' + c.path + ': ' + _short(c.from) + ' → ' + _short(c.to));
      });
      if (d.changed.length > 20) console.log('  … +' + (d.changed.length - 20) + ' 更多');
    }
    if (d.added.length) {
      console.log('%c— 新增 —', 'color:#7a7');
      d.added.slice(0, 20).forEach(function(a){
        console.log('  + ' + a.path + ' = ' + _short(a.value));
      });
      if (d.added.length > 20) console.log('  … +' + (d.added.length - 20) + ' 更多');
    }
    if (d.removed.length) {
      console.log('%c— 删除 —', 'color:#c66');
      d.removed.slice(0, 20).forEach(function(r){
        console.log('  - ' + r.path + ' = ' + _short(r.value));
      });
      if (d.removed.length > 20) console.log('  … +' + (d.removed.length - 20) + ' 更多');
    }
    return d;
  }

  /** 便捷：对比两个快照名 */
  function bySnapshot(nameA, nameB, opts) {
    if (!window.TM || !TM.state) { console.warn('[diff] TM.state 未加载'); return null; }
    var a = TM.state.get(nameA);
    var b = TM.state.get(nameB);
    if (!a || !b) { console.warn('[diff] 快照不存在'); return null; }
    return diff(a, b, opts);
  }

  // 让 TM.diff 本身既可作函数又挂子方法
  var fn = function(a, b, opts) { return diff(a, b, opts); };
  fn.print = print;
  fn.bySnapshot = bySnapshot;
  fn.printBySnapshot = function(nameA, nameB, opts) {
    var a = TM.state && TM.state.get(nameA);
    var b = TM.state && TM.state.get(nameB);
    if (!a || !b) { console.warn('[diff] 快照不存在'); return null; }
    return print(a, b, opts);
  };

  window.TM.diff = fn;
})();
