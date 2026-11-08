// @ts-check
// ═══ 国师改动账（2026-10-15 国师重做 S2）═══
//   每次把国师的改动应用到剧本，记一笔：改了哪些路径、每处改前改后。存 IndexedDB（库 tm-guoshi / 表 ledger），按案卷分开，
//   刷新、关页都还在。撤销 = 把那一笔的反向差异落回当前剧本：只动国师改过的那几处，别处的手工编辑原样保留；
//   那几处后来又被手工改过的，会被认出来（冲突），默认不覆盖。撤销较早的一笔会连带它之后的几笔（从新到旧依次撤），
//   免得留下新旧混着的半截状态。
//   纯逻辑（反向差异、连带链、重放）不碰 DOM，node 里可直接测；落库失败时退回页内内存，不影响应用本身。
(function (global) {
  'use strict';
  var DB_NAME = 'tm-guoshi', DB_VER = 1, STORE = 'ledger';
  var KEEP_PER_FILE = 200;
  function AA() {
    var a = global.TM && global.TM.AuthoringAgent;
    if (!a && typeof require === 'function') { try { a = require('./editor-authoring-agent.js'); } catch (e) {} }   // node 里测
    return a;
  }
  function clone(o) { return o === undefined ? undefined : JSON.parse(JSON.stringify(o)); }
  function segs(path) { return String(path || '').split('.').filter(function (s) { return s !== ''; }); }

  // ── 纯函数 ──
  // 只留 path/type/before/after（diff 上挂的 __idx 等 UI 记号不进账）
  function strip(diffs) {
    return (diffs || []).map(function (d) {
      var o = { path: String(d.path || ''), type: d.type };
      if (d.type !== 'added') o.before = clone(d.before);
      if (d.type !== 'removed') o.after = clone(d.after);
      return o;
    });
  }
  // 反向差异：新增↔删除互换，修改前后对调
  function invert(diffs) {
    return (diffs || []).map(function (d) {
      if (d.type === 'added') return { path: d.path, type: 'removed', before: clone(d.after) };
      if (d.type === 'removed') return { path: d.path, type: 'added', after: clone(d.before) };
      return { path: d.path, type: 'changed', before: clone(d.after), after: clone(d.before) };
    }).reverse();   // 数组下标从大到小撤，删除留洞再收拢时前面的下标不漂
  }
  // 一笔账的实体级计数与名单（给人看：新增 2 · 修改 1；人物「袁崇焕」…）
  function summarize(diffs, scenarioAfter, scenarioBefore) {
    var ents = {}, order = [];
    (diffs || []).forEach(function (d) {
      var ss = segs(d.path), top = ss[0] || '', key, idx = null, rest;
      var arr = (scenarioAfter && Array.isArray(scenarioAfter[top])) || (scenarioBefore && Array.isArray(scenarioBefore[top]));
      if (arr && /^\d+$/.test(ss[1] || '')) { idx = +ss[1]; key = top + '.' + idx; rest = ss.slice(2); } else { key = top; rest = ss.slice(1); }
      if (!ents[key]) { ents[key] = { top: top, idx: idx, n: 0, whole: null }; order.push(key); }
      ents[key].n++;
      if (!rest.length) ents[key].whole = d.type;
    });
    var counts = { add: 0, chg: 0, rm: 0 }, names = [];
    order.forEach(function (k) {
      var e = ents[k];
      var op = e.n === 1 && e.whole ? (e.whole === 'added' ? 'add' : (e.whole === 'removed' ? 'rm' : 'chg')) : 'chg';
      counts[op]++;
      var obj = null;
      if (e.idx != null) {
        var a = scenarioAfter && Array.isArray(scenarioAfter[e.top]) ? scenarioAfter[e.top][e.idx] : null;
        var b = scenarioBefore && Array.isArray(scenarioBefore[e.top]) ? scenarioBefore[e.top][e.idx] : null;
        obj = op === 'rm' ? (b || a) : (a || b);
        if (!obj) { var hit = (diffs || []).filter(function (d) { return d.path === k; })[0]; obj = hit ? (hit.after || hit.before) : null; }
      }
      var nm = obj && typeof obj === 'object' ? (obj.name || obj.title || obj.id || '') : '';
      names.push({ op: op, top: e.top, idx: e.idx, name: nm ? String(nm) : '' });
    });
    return { counts: counts, names: names.slice(0, 24), total: (diffs || []).length };
  }
  // 撤销 target 要连带哪些：同一案卷里比它晚、还没撤销的（从新到旧），最后是它自己
  function chainFor(entries, target) {
    if (!target) return [];
    return (entries || []).filter(function (e) {
      return e && !e.undone && e.fileKey === target.fileKey && (e.ts > target.ts || e.id === target.id);
    }).sort(function (a, b) { return b.ts - a.ts; });
  }
  // 从新到旧依次落反向差异；有冲突（那处后来又被改过）就停下报出来，除非 force
  function applyChain(scenario, chain, opts) {
    opts = opts || {};
    var A = AA();
    if (!A || typeof A.applySelectedDiffs !== 'function') throw new Error('国师核心没载入，没法撤销');
    var cur = scenario, conflicts = [];
    for (var i = 0; i < chain.length; i++) {
      try { cur = A.applySelectedDiffs(cur, null, invert(chain[i].diffs), null, { allowConflicts: !!opts.force }); }
      catch (e) {
        if (e && e.code === 'edit-conflict') { conflicts = (e.conflicts || []).map(function (c) { return { path: c.path, entry: chain[i].id }; }); return { ok: false, conflicts: conflicts, at: chain[i] }; }
        throw e;
      }
    }
    return { ok: true, scenario: cur, conflicts: [] };
  }
  // 恢复（重做）：从旧到新依次落正向差异
  function redoChain(scenario, chain, opts) {
    opts = opts || {};
    var A = AA();
    if (!A || typeof A.applySelectedDiffs !== 'function') throw new Error('国师核心没载入，没法恢复');
    var cur = scenario, list = chain.slice().sort(function (a, b) { return a.ts - b.ts; });
    for (var i = 0; i < list.length; i++) {
      try { cur = A.applySelectedDiffs(cur, null, list[i].diffs, null, { allowConflicts: !!opts.force }); }
      catch (e) {
        if (e && e.code === 'edit-conflict') return { ok: false, conflicts: (e.conflicts || []).map(function (c) { return { path: c.path, entry: list[i].id }; }), at: list[i] };
        throw e;
      }
    }
    return { ok: true, scenario: cur, conflicts: [] };
  }

  // ── 存储（IndexedDB；不可用时退回内存） ──
  var mem = [], dbPromise = null;
  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      try {
        var idb = global.indexedDB;
        if (!idb) { resolve(null); return; }
        var req = idb.open(DB_NAME, DB_VER);
        req.onupgradeneeded = function () {
          var db = req.result;
          if (!db.objectStoreNames.contains(STORE)) { var st = db.createObjectStore(STORE, { keyPath: 'id' }); st.createIndex('fileKey', 'fileKey', { unique: false }); }
        };
        req.onsuccess = function () { resolve(req.result); };
        req.onerror = function () { resolve(null); };
        req.onblocked = function () { resolve(null); };
      } catch (e) { resolve(null); }
    });
    return dbPromise;
  }
  function tx(mode, fn) {
    return openDb().then(function (db) {
      if (!db) return fn(null);
      return new Promise(function (resolve, reject) {
        var t; try { t = db.transaction(STORE, mode); } catch (e) { resolve(fn(null)); return; }
        var out = fn(t.objectStore(STORE));
        t.oncomplete = function () { resolve(out && out.__result !== undefined ? out.__result : out); };
        t.onerror = function () { reject(t.error || new Error('改动账写入失败')); };
        t.onabort = function () { reject(t.error || new Error('改动账写入被中止')); };
      });
    });
  }
  function getAll() {
    return openDb().then(function (db) {
      if (!db) return mem.slice();
      return new Promise(function (resolve) {
        try {
          var r = db.transaction(STORE, 'readonly').objectStore(STORE).getAll();
          r.onsuccess = function () { resolve(r.result || []); };
          r.onerror = function () { resolve(mem.slice()); };
        } catch (e) { resolve(mem.slice()); }
      });
    });
  }
  function record(entry) {
    var e = clone(entry);
    e.id = e.id || ('L' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7));
    e.ts = e.ts || Date.now();
    e.undone = false;
    return tx('readwrite', function (store) {
      if (!store) { mem.push(e); return e; }
      store.put(e);
      return e;
    }).then(function () { return prune(e.fileKey).then(function () { return e; }); }, function () { mem.push(e); return e; });
  }
  function update(id, patch) {
    return getAll().then(function (all) {
      var e = all.filter(function (x) { return x && x.id === id; })[0];
      if (!e) return null;
      Object.keys(patch || {}).forEach(function (k) { e[k] = patch[k]; });
      return tx('readwrite', function (store) {
        if (!store) { mem = mem.map(function (x) { return x.id === id ? e : x; }); return e; }
        store.put(e); return e;
      }).then(function () { return e; });
    });
  }
  function remove(id) {
    return tx('readwrite', function (store) {
      if (!store) { mem = mem.filter(function (x) { return x.id !== id; }); return true; }
      store.delete(id); return true;
    });
  }
  function prune(fileKey) {
    return getAll().then(function (all) {
      var mine = all.filter(function (x) { return x && x.fileKey === fileKey; }).sort(function (a, b) { return b.ts - a.ts; });
      var drop = mine.slice(KEEP_PER_FILE);
      if (!drop.length) return 0;
      return tx('readwrite', function (store) {
        if (!store) { var ids = {}; drop.forEach(function (d) { ids[d.id] = 1; }); mem = mem.filter(function (x) { return !ids[x.id]; }); return drop.length; }
        drop.forEach(function (d) { store.delete(d.id); }); return drop.length;
      });
    });
  }
  // 列出：本案卷的（新→旧）；另附同名剧本的旧记录（未入库剧本每次载入身份不同，按名字找回来，撤销照样走冲突检查）
  function list(fileKey, fileLabel) {
    return getAll().then(function (all) {
      all = all.filter(Boolean).sort(function (a, b) { return b.ts - a.ts; });
      var mine = all.filter(function (x) { return x.fileKey === fileKey; });
      var kin = fileLabel ? all.filter(function (x) { return x.fileKey !== fileKey && x.fileLabel === fileLabel; }) : [];
      return { mine: mine, kin: kin };
    });
  }

  var api = { strip: strip, invert: invert, summarize: summarize, chainFor: chainFor, applyChain: applyChain, redoChain: redoChain,
    record: record, update: update, remove: remove, list: list, _getAll: getAll, _mem: function () { return mem; } };
  var TM = global.TM = global.TM || {};
  TM.AuthoringLedger = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
