// @ts-check
// ============================================================
// tm-semantic-recall.js — 本地语义检索（2026-04-30 Phase 2.2）
//
// 设计来源：memos 插件的 RAG 思路·但完全本地化
//
// 模型：bge-small-zh-v1.5（中文专精·体积 ~96MB·首次加载缓存到 IndexedDB）
// 通过 transformers.js（@xenova/transformers）的 ESM 动态 import 加载
// 索引：shijiHistory 句级 + ChronicleTracker 全部 + _foreshadows 全部 + 12 表 eventHistory
// 查询：top-K 余弦相似度·阈值 0.55
//
// 启动策略：
//   · 不主动加载（避免冷启动 96MB 流量）
//   · 玩家在编辑器开启"启用语义检索"开关后才下载模型
//   · 模型 OK 后·EndTurn 钩子末尾增量索引本回合新事件
//   · SC_RECALL 调用时·若模型未就绪·静默跳过该源·不阻断
// ============================================================

(function(global) {
  'use strict';

  var STATE = {
    enabled: false,        // 玩家开关
    modelReady: false,     // 模型加载完成
    modelLoading: false,   // 加载中（防止重复加载）
    pipeline: null,        // transformers.js feature-extraction pipeline
    index: [],             // [{ id, source, turn, text, vec }]
    lastIndexedTurn: 0,    // 上次索引到的 turn
    modelName: 'Xenova/bge-small-zh-v1.5',
    threshold: 0.55,
    error: null
  };

  // ────── 模型加载 ──────
  async function ensureModel() {
    if (STATE.modelReady) return true;
    if (STATE.modelLoading) {
      // 等已有加载完成
      while (STATE.modelLoading) await new Promise(function(r){ setTimeout(r, 200); });
      return STATE.modelReady;
    }
    STATE.modelLoading = true;
    try {
      // 加载顺序：本地 vendor → jsdelivr → esm.sh（参见 vendor/transformers/README.md）
      var transformers;
      try {
        transformers = await import('./vendor/transformers/transformers.esm.js');
      } catch (e0) {
        try {
          transformers = await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm');
        } catch (e1) {
          try {
            transformers = await import('https://esm.sh/@xenova/transformers@2.17.2');
          } catch (e2) {
            throw new Error('transformers.js 加载失败·本地 + 两个 CDN 全部失败：' + e0.message + ' / ' + e1.message + ' / ' + e2.message);
          }
        }
      }
      // 设置缓存到 IndexedDB（Electron 默认走 disk·这里显式启用 browserCache）
      transformers.env.allowLocalModels = true;
      transformers.env.useBrowserCache = true;
      var pipe = await transformers.pipeline('feature-extraction', STATE.modelName, {
        quantized: true
      });
      STATE.pipeline = pipe;
      STATE.modelReady = true;
      STATE.modelLoading = false;
      STATE.error = null;
      return true;
    } catch(e) {
      STATE.modelLoading = false;
      STATE.modelReady = false;
      STATE.error = String(e && e.message || e);
      return false;
    }
  }

  function enable() {
    STATE.enabled = true;
    // 后台启动加载（不阻塞）
    setTimeout(function() { ensureModel(); }, 100);
  }
  function disable() {
    STATE.enabled = false;
  }
  function status() {
    return {
      enabled: STATE.enabled,
      modelReady: STATE.modelReady,
      modelLoading: STATE.modelLoading,
      indexSize: STATE.index.length,
      lastIndexedTurn: STATE.lastIndexedTurn,
      error: STATE.error
    };
  }

  // ────── 嵌入计算 ──────
  async function _embed(text) {
    if (!STATE.modelReady) return null;
    if (!text || typeof text !== 'string') return null;
    text = text.slice(0, 512); // bge-small 最大 512 tokens
    var out = await STATE.pipeline(text, { pooling: 'mean', normalize: true });
    // 转成 Float32Array 存储
    return Array.from(out.data);
  }

  function _cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    var dot = 0;
    for (var i = 0; i < a.length; i++) dot += a[i] * b[i];
    // 已归一化·dot 即 cosine
    return dot;
  }

  // ────── 增量索引 ──────
  // 收集本回合新增 + 历史未索引内容
  async function buildIndex(opts) {
    opts = opts || {};
    if (!STATE.enabled) return { ok: false, reason: 'disabled' };
    if (!await ensureModel()) return { ok: false, reason: 'model not ready: ' + STATE.error };
    if (typeof GM === 'undefined' || !GM) return { ok: false, reason: 'no GM' };
    var turn = (GM.turn || 0);
    var since = STATE.lastIndexedTurn;
    var added = 0;

    // shijiHistory 增量
    if (Array.isArray(GM.shijiHistory)) {
      var newSj = GM.shijiHistory.filter(function(sh) { return sh && (sh.turn || 0) > since; });
      for (var i = 0; i < newSj.length; i++) {
        var sh = newSj[i];
        var combined = (sh.shilu || sh.shizhengji || sh.zhengwen || '');
        var sentences = combined.split(/[。！？\n]/).filter(function(s) { return s && s.length > 8; });
        for (var j = 0; j < sentences.length && j < 30; j++) {
          var vec = await _embed(sentences[j]);
          if (vec) {
            STATE.index.push({
              id: 'sj_T' + sh.turn + '_' + j,
              source: 'shiji',
              turn: sh.turn,
              text: sentences[j].slice(0, 200),
              vec: vec
            });
            added++;
          }
        }
      }
    }

    // ChronicleTracker 增量
    if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAll) {
      try {
        var allChron = ChronicleTracker.getAll({}) || [];
        for (var k = 0; k < allChron.length; k++) {
          var c = allChron[k];
          if (!c || (c.startTurn || 0) <= since) continue;
          var txt = (c.title || '') + '·' + (c.description || c.summary || '');
          var vec2 = await _embed(txt);
          if (vec2) {
            STATE.index.push({
              id: 'ch_' + (c.id || k),
              source: 'chronicle',
              turn: c.startTurn || 0,
              text: txt.slice(0, 200),
              vec: vec2
            });
            added++;
          }
        }
      } catch(_ce){}
    }

    // _foreshadows 增量
    if (Array.isArray(GM._foreshadows)) {
      for (var f = 0; f < GM._foreshadows.length; f++) {
        var fs = GM._foreshadows[f];
        if (!fs || (fs.turn || 0) <= since) continue;
        var ft = (fs.content || fs.text || '');
        if (!ft) continue;
        var vec3 = await _embed(ft);
        if (vec3) {
          STATE.index.push({
            id: 'fs_' + (fs.turn || 0) + '_' + f,
            source: 'foreshadow',
            turn: fs.turn || 0,
            text: ft.slice(0, 200),
            vec: vec3
          });
          added++;
        }
      }
    }

    // 12 表 eventHistory 增量
    if (GM._memTables && GM._memTables.eventHistory && Array.isArray(GM._memTables.eventHistory.rows)) {
      for (var e = 0; e < GM._memTables.eventHistory.rows.length; e++) {
        var row = GM._memTables.eventHistory.rows[e];
        if (!row) continue;
        var rTurn = parseInt(row[1], 10) || 0;
        if (rTurn <= since) continue;
        var et = (row[2] || '') + ' ' + (row[5] || '');
        if (!et.trim()) continue;
        var vec4 = await _embed(et);
        if (vec4) {
          STATE.index.push({
            id: 'eh_' + (row[0] || (rTurn + '_' + e)),
            source: 'eventHistory',
            turn: rTurn,
            text: et.slice(0, 200),
            vec: vec4
          });
          added++;
        }
      }
    }

    STATE.lastIndexedTurn = turn;
    return { ok: true, added: added, total: STATE.index.length };
  }

  // ────── 检索 ──────
  async function search(query, opts) {
    opts = opts || {};
    if (!STATE.enabled || !STATE.modelReady) return [];
    if (!query) return [];
    var qVec = await _embed(query);
    if (!qVec) return [];
    var topK = opts.topK || 6;
    var threshold = opts.threshold != null ? opts.threshold : STATE.threshold;
    var scored = [];
    for (var i = 0; i < STATE.index.length; i++) {
      var item = STATE.index[i];
      var sim = _cosineSim(qVec, item.vec);
      if (sim >= threshold) scored.push({ item: item, sim: sim });
    }
    scored.sort(function(a, b) { return b.sim - a.sim; });
    return scored.slice(0, topK).map(function(s) {
      return {
        source: 'vector',
        sub: s.item.source,
        turn: s.item.turn,
        text: s.item.text,
        sim: Math.round(s.sim * 100) / 100
      };
    });
  }

  // 同步入口·若模型未就绪返回空（不阻塞 SC_RECALL 主流程）
  function searchSyncSafe(query, opts) {
    if (!STATE.enabled || !STATE.modelReady) return Promise.resolve([]);
    return search(query, opts).catch(function(e) { return []; });
  }

  // ────── EndTurn 钩子 ──────
  function _registerHook() {
    if (typeof EndTurnHooks === 'undefined' || !EndTurnHooks || !EndTurnHooks.register) return false;
    EndTurnHooks.register('after', function() {
      if (!STATE.enabled || !STATE.modelReady) return;
      // 异步索引·不阻塞
      buildIndex().catch(function(e){ /* 静默 */ });
    }, 'SemanticRecall.autoIndex');
    return true;
  }
  if (!_registerHook()) {
    if (typeof window !== 'undefined') {
      window.addEventListener('DOMContentLoaded', _registerHook);
    }
  }

  // ────── 持久化（IndexedDB） ──────
  // 索引可以很大·走单独 DB
  var _idxDbPromise = null;
  function _openIdxDB() {
    if (_idxDbPromise) return _idxDbPromise;
    _idxDbPromise = new Promise(function(resolve, reject) {
      if (typeof indexedDB === 'undefined') return reject(new Error('IndexedDB 不可用'));
      var req = indexedDB.open('tianming_semantic_idx', 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('idx')) db.createObjectStore('idx', { keyPath: 'id' });
      };
      req.onsuccess = function(e) { resolve(e.target.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
    return _idxDbPromise;
  }
  function persistIndex() {
    return _openIdxDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction('idx', 'readwrite');
        var s = tx.objectStore('idx');
        s.clear();
        STATE.index.forEach(function(it) { s.put(it); });
        tx.oncomplete = function(){ resolve({ ok: true, count: STATE.index.length }); };
      });
    });
  }
  function loadIndex() {
    return _openIdxDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction('idx', 'readonly');
        tx.objectStore('idx').getAll().onsuccess = function(e) {
          STATE.index = e.target.result || [];
          if (STATE.index.length > 0) {
            STATE.lastIndexedTurn = STATE.index.reduce(function(m, it) { return Math.max(m, it.turn || 0); }, 0);
          }
          resolve({ ok: true, count: STATE.index.length });
        };
      });
    });
  }

  // ────── 暴露 API ──────
  global.SemanticRecall = {
    enable: enable,
    disable: disable,
    status: status,
    ensureModel: ensureModel,
    buildIndex: buildIndex,
    search: search,
    searchSyncSafe: searchSyncSafe,
    persistIndex: persistIndex,
    loadIndex: loadIndex
  };
})(typeof window !== 'undefined' ? window : this);
