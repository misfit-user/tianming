// @ts-check
/// <reference path="types.d.ts" />
/* ============================================================
 * tm-state.js — GameState 快照系统
 *
 * 目的：冻结 GM 核心字段的瞬时状态，供未来合并/重构时对比前后
 *      （配合 R71 TM.diff 和 R61 TM.perf.baseline 形成完整护栏）
 *
 * 用法：
 *   TM.state.snapshot('before-corruption-merge')   // 命名保存
 *   // ... 执行合并 / 游戏继续 ...
 *   TM.state.snapshot('after-corruption-merge')
 *   TM.state.list()                                // 列出所有快照
 *   TM.state.get('before-corruption-merge')        // 取某快照
 *   TM.diff(TM.state.get('before-...'), TM.state.get('after-...'))
 *
 * 存储：
 *   - 快照默认存 TM.state._store 内存
 *   - 可持久化 TM.state.persist(name)/restore(name) 到 localStorage（跨 session）
 *   - 上限 20 个内存快照（FIFO）
 *
 * 冻结什么：
 *   不做深拷贝整个 GM（可能 MB 级），只冻结**关键摘要**：
 *   - turn/date/running
 *   - chars 数组 map 成 {name, alive, faction, loyalty, officialTitle}
 *   - guoku 三账 stock
 *   - authority 三值（huangquan/huangwei/minxin）
 *   - 时局要务 count / pending count
 *   - 官制 holder 数
 *   - 行政区划 count
 *   - TM.perf.report() 当前
 *   - TM.errors.getSummary() 当前
 * ============================================================ */
(function(){
  'use strict';
  if (typeof window === 'undefined') return;
  window.TM = window.TM || {};
  if (window.TM.state) return;

  var store = {};
  var orderList = [];
  var MAX_MEMORY = 20;

  function _safeClone(v) {
    try { return JSON.parse(JSON.stringify(v)); }
    catch(e) { return null; }
  }

  /** 从 GM 提取摘要（不深拷贝整对象，只抽关键指标） */
  function _extractSummary() {
    var G = (typeof GM !== 'undefined') ? GM : {};
    var summary = {
      _meta: {
        capturedAt: Date.now(),
        turn: G.turn || 0,
        date: G.date || '',
        running: !!G.running
      }
    };

    // 角色摘要（不保存全字段，只留关键指标）
    if (Array.isArray(G.chars)) {
      summary.chars = {
        total: G.chars.length,
        alive: 0,
        byFaction: {},
        byLocation: {}
      };
      G.chars.forEach(function(c){
        if (!c) return;
        if (c.alive !== false) summary.chars.alive++;
        var f = c.faction || '无';
        summary.chars.byFaction[f] = (summary.chars.byFaction[f] || 0) + 1;
        var loc = c.location || '无';
        summary.chars.byLocation[loc] = (summary.chars.byLocation[loc] || 0) + 1;
      });
    }

    // 势力数
    if (Array.isArray(G.facs)) summary.factionCount = G.facs.length;
    if (Array.isArray(G.parties)) summary.partyCount = G.parties.length;
    if (Array.isArray(G.classes)) summary.classCount = G.classes.length;

    // 国库
    if (G.guoku && G.guoku.ledgers) {
      summary.guoku = {
        money: (G.guoku.ledgers.money && G.guoku.ledgers.money.stock) || 0,
        grain: (G.guoku.ledgers.grain && G.guoku.ledgers.grain.stock) || 0,
        cloth: (G.guoku.ledgers.cloth && G.guoku.ledgers.cloth.stock) || 0
      };
    }

    // 权威
    if (G.authority) {
      summary.authority = {
        huangquan: (typeof G.authority.huangquan === 'number') ? G.authority.huangquan : (G.authority.huangquan && G.authority.huangquan.value) || 0,
        huangwei: (typeof G.authority.huangwei === 'number') ? G.authority.huangwei : (G.authority.huangwei && G.authority.huangwei.value) || 0,
        minxin: (typeof G.authority.minxin === 'number') ? G.authority.minxin : (G.authority.minxin && G.authority.minxin.value) || 0
      };
    }

    // 时局要务
    if (Array.isArray(G.currentIssues)) {
      summary.issues = {
        total: G.currentIssues.length,
        pending: G.currentIssues.filter(function(i){return i && i.status === 'pending';}).length,
        resolved: G.currentIssues.filter(function(i){return i && i.status === 'resolved';}).length
      };
    }

    // 官制 holder 数
    if (Array.isArray(G.officeTree)) {
      var holders = 0, empty = 0;
      (function _walk(nodes){
        (nodes||[]).forEach(function(n){
          if (!n) return;
          (n.positions||[]).forEach(function(p){
            if (p && p.holder && p.holder !== '空缺') holders++;
            else empty++;
          });
          if (n.subs) _walk(n.subs);
        });
      })(G.officeTree);
      summary.officeTree = { filledPositions: holders, emptyPositions: empty };
    }

    // 行政区划
    if (G.adminHierarchy) {
      var divs = 0;
      (function _walkDiv(n){
        if (!n) return;
        var arr = Array.isArray(n) ? n : Object.values(n);
        arr.forEach(function(node){
          if (!node) return;
          divs++;
          if (node.children) _walkDiv(node.children);
        });
      })(G.adminHierarchy);
      summary.adminDivisions = divs;
    }

    // 军队
    if (Array.isArray(G.armies)) {
      summary.armies = {
        count: G.armies.length,
        totalTroops: G.armies.reduce(function(s, a){ return s + ((a && (a.troops || a.size || a.soldiers)) || 0); }, 0)
      };
    }

    // perf/errors 诊断快照
    try {
      if (window.TM && TM.perf && TM.perf.report) {
        var perfR = TM.perf.report();
        var perfSum = {};
        Object.keys(perfR).forEach(function(k){ perfSum[k] = { p95: perfR[k].p95, count: perfR[k].count }; });
        summary._perf = perfSum;
      }
      if (window.TM && TM.errors && TM.errors.getSummary) {
        summary._errors = TM.errors.getSummary();
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-state');}catch(_){}}

    return summary;
  }

  /** 保存一个快照 */
  function snapshot(name) {
    name = name || ('snap-' + Date.now());
    var sum = _extractSummary();
    store[name] = sum;
    // FIFO 管理内存
    var idx = orderList.indexOf(name);
    if (idx >= 0) orderList.splice(idx, 1);
    orderList.push(name);
    while (orderList.length > MAX_MEMORY) {
      var oldest = orderList.shift();
      delete store[oldest];
    }
    return { name: name, summary: sum };
  }

  /** 取某快照 */
  function get(name) {
    return store[name] || null;
  }

  /** 列出所有快照 */
  function list() {
    return orderList.map(function(name){
      return {
        name: name,
        turn: store[name] && store[name]._meta && store[name]._meta.turn,
        date: store[name] && store[name]._meta && store[name]._meta.date,
        capturedAt: store[name] && store[name]._meta && store[name]._meta.capturedAt
      };
    });
  }

  /** 清除内存快照 */
  function clear(name) {
    if (name) {
      delete store[name];
      var i = orderList.indexOf(name);
      if (i >= 0) orderList.splice(i, 1);
    } else {
      store = {};
      orderList.length = 0;
    }
  }

  /** 持久化到 localStorage（跨 session） */
  function persist(name) {
    var s = store[name];
    if (!s) return false;
    try {
      localStorage.setItem('tm_state_' + name, JSON.stringify(s));
      return true;
    } catch(e) { return false; }
  }

  /** 从 localStorage 恢复 */
  function restore(name) {
    try {
      var s = localStorage.getItem('tm_state_' + name);
      if (!s) return false;
      store[name] = JSON.parse(s);
      if (orderList.indexOf(name) < 0) orderList.push(name);
      return true;
    } catch(e) { return false; }
  }

  /** 列出 localStorage 里已持久化的快照名 */
  function listPersisted() {
    var out = [];
    try {
      for (var i = 0; i < localStorage.length; i++) {
        var k = localStorage.key(i);
        if (k && k.indexOf('tm_state_') === 0) out.push(k.substring(9));
      }
    } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-state');}catch(_){}}
    return out;
  }

  /** 删除持久化 */
  function removePersisted(name) {
    try { localStorage.removeItem('tm_state_' + name); return true; }
    catch(e) { return false; }
  }

  /** 下载快照为 JSON */
  function downloadJSON(name) {
    var s = store[name];
    if (!s) return false;
    try {
      var blob = new Blob([JSON.stringify(s, null, 2)], { type: 'application/json' });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = 'tm-state-' + name + '-' + Date.now() + '.json';
      a.click();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
      return true;
    } catch(e) { return false; }
  }

  TM.state = {
    snapshot: snapshot,
    get: get,
    list: list,
    clear: clear,
    persist: persist,
    restore: restore,
    listPersisted: listPersisted,
    removePersisted: removePersisted,
    downloadJSON: downloadJSON,
    _extractSummary: _extractSummary,
    _store: store
  };
})();
