// @ts-check
// ============================================================
// tm-semantic-recall.js — 本地语义检索（2026-04-30 Phase 2.2）
//
// 设计来源：memos 插件的 RAG 思路·但完全本地化
//
// 模型：bge-small-zh-v1.5（中文专精·体积 ~23 MB·首次加载缓存到 IndexedDB）
// 通过 transformers.js（@xenova/transformers）的 ESM 动态 import 加载
// 索引：shijiHistory 句级 + ChronicleTracker 全部 + _foreshadows 全部 + 12 表 eventHistory
// 查询：top-K 余弦相似度·阈值 0.55
//
// 启动策略：
//   · 不主动加载（避免冷启动 23 MB 流量）
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
    threshold: 0.45, // S1(2026-06-03): 0.55->0.45 放松(bge-small-zh 0.55 偏严·ST 建议 0.3-0.5)·call-site 可经 P.conf.semanticRecallThreshold 覆盖

    error: null,
    // P9.2 加载源/进度可见性
    loadSource: '',        // 'local-vendor' / 'hf-mirror' / 'hf-fallback'（带 '+worker' 后缀=跑在独立线程）
    downloadProgress: 0,   // 0-100
    downloadFile: '',      // 当前下载的文件名
    // perf round5 (2026-06-10): 模型加载+推理优先走独立 Worker·主线程零阻塞
    worker: null,          // Worker 实例（成功启动后）
    workerReady: false     // worker 模型就绪
  };

  // ────── Worker RPC（perf round5） ──────
  // 模型初始化在主线程有 ~10s 长任务·每条嵌入 ~160ms·全部挪进
  // tm-semantic-worker.js。worker 启动失败（环境不支持等）则回退
  // 下方原主线程路径·行为与旧版完全一致。
  var _rpcSeq = 0;
  var _rpcPending = {};

  function _workerOnMessage(ev) {
    var m = ev.data || {};
    if (m.kind === 'progress') {
      if (typeof m.progress === 'number') STATE.downloadProgress = m.progress;
      if (m.file) STATE.downloadFile = m.file;
      return;
    }
    if (m.id != null && _rpcPending[m.id]) {
      var cb = _rpcPending[m.id];
      delete _rpcPending[m.id];
      clearTimeout(cb.timer);
      cb.resolve(m);
    }
  }

  function _workerRpc(msg, timeoutMs) {
    return new Promise(function (resolve) {
      if (!STATE.worker || !STATE.workerReady) return resolve({ ok: false, err: 'worker not ready' });
      var id = 'r' + (++_rpcSeq);
      msg.id = id;
      _rpcPending[id] = {
        resolve: resolve,
        timer: setTimeout(function () {
          delete _rpcPending[id];
          resolve({ ok: false, err: 'worker rpc timeout' });
        }, timeoutMs || 120000)
      };
      try { STATE.worker.postMessage(msg); } catch (e) {
        delete _rpcPending[id];
        resolve({ ok: false, err: String(e && e.message || e) });
      }
    });
  }

  function _workerDown(reason) {
    if (STATE.worker) { try { STATE.worker.terminate(); } catch (_) {} }
    STATE.worker = null;
    STATE.workerReady = false;
    Object.keys(_rpcPending).forEach(function (id) {
      var cb = _rpcPending[id];
      delete _rpcPending[id];
      clearTimeout(cb.timer);
      cb.resolve({ ok: false, err: 'worker down: ' + reason });
    });
  }

  // 尝试启动 worker 并在其中完成模型加载·成功返回 loadSource·失败返回 null
  function _tryStartWorker(initOpts) {
    return new Promise(function (resolve) {
      var w;
      try { w = new Worker('./tm-semantic-worker.js', { type: 'module' }); }
      catch (e) { return resolve(null); }
      var settled = false;
      var aliveTimer = setTimeout(function () { finish(null, 'alive timeout'); }, 15000);
      function finish(src, why) {
        if (settled) return;
        settled = true;
        clearTimeout(aliveTimer);
        if (!src) { try { w.terminate(); } catch (_) {} }
        resolve(src || null);
      }
      w.onerror = function (e) { finish(null, 'onerror'); };
      w.onmessage = function (ev) {
        var m = ev.data || {};
        if (m.kind === 'alive') {
          clearTimeout(aliveTimer);
          w.postMessage({ cmd: 'init', id: '__init__', opts: initOpts });
          return;
        }
        if (m.kind === 'progress') {
          if (typeof m.progress === 'number') STATE.downloadProgress = m.progress;
          if (m.file) STATE.downloadFile = m.file;
          return;
        }
        if (m.id === '__init__') {
          if (m.ok) {
            STATE.worker = w;
            STATE.workerReady = true;
            w.onmessage = _workerOnMessage;
            w.onerror = function () { _workerDown('runtime error'); };
            finish(m.loadSource || 'worker', 'ok');
          } else {
            finish(null, m.err);
          }
        }
      };
    });
  }

  async function probeSemanticAsset(path) {
    if (typeof fetch !== 'function') return false;
    try {
      var head = await fetch(path, { method: 'HEAD', cache: 'no-store' });
      if (head && head.ok) return true;
    } catch(_) {}
    try {
      var get = await fetch(path, { cache: 'no-store' });
      return !!(get && get.ok);
    } catch(_) {
      return false;
    }
  }

  function semanticRemoteFallbackAllowed() {
    try {
      return !!(typeof P !== 'undefined' && P && P.conf && P.conf.semanticRecallRemoteFallback === true);
    } catch(_) {
      return false;
    }
  }

  function setSemanticUnavailable(message) {
    STATE.modelLoading = false;
    STATE.modelReady = false;
    STATE.pipeline = null;
    STATE.error = String(message || 'semantic recall model unavailable');
    STATE.loadSource = 'unavailable';
    return false;
  }

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
      // P9.1·P9.2 模型加载策略
      // (a) Electron 端·若本地预打包 vendor/models 存在·优先用本地
      // (b) 网页端·首选 hf-mirror.com（CN 友好）·失败回退 huggingface.co
      var localModelRoot = './vendor/models/';
      var localModelPath = localModelRoot + STATE.modelName + '/';
      var hasLocalModel = await probeSemanticAsset(localModelPath + 'config.json') &&
                           await probeSemanticAsset(localModelPath + 'tokenizer.json') &&
                           await probeSemanticAsset(localModelPath + 'onnx/model_quantized.onnx');
      if (!hasLocalModel && !semanticRemoteFallbackAllowed()) {
        return setSemanticUnavailable('local semantic model assets not reachable; remote fallback disabled');
      }

      // perf round5 (2026-06-10): 优先在独立 Worker 内加载模型+推理
      // 模型初始化主线程长任务 ~10s + 每条嵌入 ~160ms 全部离开主线程
      var workerSrc = await _tryStartWorker({
        modelName: STATE.modelName,
        hasLocalModel: hasLocalModel,
        localModelRoot: localModelRoot,
        remoteFallbackAllowed: semanticRemoteFallbackAllowed()
      });
      if (workerSrc) {
        STATE.modelReady = true;
        STATE.modelLoading = false;
        STATE.error = null;
        STATE.loadSource = workerSrc + '+worker';
        return true;
      }

      // —— worker 不可用（环境不支持等）·回退原主线程路径·行为与旧版一致 ——
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
      // Cache API 的 put 仅支持 http/https 请求·file://（桌面 Electron）/capacitor:// 等非 http 协议下
      // 启用 useBrowserCache 会令 transformers 反复抛 "Failed to execute 'put' on 'Cache': scheme 'file' unsupported"·
      // 拖住主线程致过回合动画冻结(模型反复加载失败重试)·故仅在 http(s) 下启用浏览器缓存(2026-06-14)
      var _tmCacheOk = (typeof location !== 'undefined' && location && (location.protocol === 'http:' || location.protocol === 'https:'));
      transformers.env.useBrowserCache = _tmCacheOk;
      if (hasLocalModel) {
        // 完全离线·从本地 vendor 加载
        transformers.env.localModelPath = localModelRoot;
        transformers.env.allowLocalModels = true;
        transformers.env.allowRemoteModels = false;
        STATE.loadSource = 'local-vendor';
      } else {
        transformers.env.allowLocalModels = false;
        if (!semanticRemoteFallbackAllowed()) {
          return setSemanticUnavailable('local semantic model assets not reachable; remote fallback disabled');
        }
        // 网页端·优先 hf-mirror·失败再回退 hf 主站
        transformers.env.allowRemoteModels = true;
        transformers.env.remoteHost = 'https://hf-mirror.com';
        STATE.loadSource = 'hf-mirror';
      }
      // 进度回调·让 UI 能看到下载进度
      var pipeOpts = {
        quantized: true,
        progress_callback: function(progress) {
          if (progress && typeof progress.progress === 'number') {
            STATE.downloadProgress = progress.progress;
            STATE.downloadFile = progress.file || '';
          }
          if (progress && progress.status === 'done') {
            STATE.downloadProgress = 100;
          }
        }
      };
      var pipe;
      try {
        pipe = await transformers.pipeline('feature-extraction', STATE.modelName, pipeOpts);
      } catch (mirrorErr) {
        // mirror 失败·回退 hf 主站
        if (!hasLocalModel) {
          STATE.loadSource = 'hf-fallback';
          transformers.env.remoteHost = 'https://huggingface.co';
          try {
            pipe = await transformers.pipeline('feature-extraction', STATE.modelName, pipeOpts);
          } catch (hfErr) {
            throw new Error('模型加载失败·hf-mirror: ' + mirrorErr.message + ' / huggingface.co: ' + hfErr.message);
          }
        } else {
          throw mirrorErr;
        }
      }
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

  // P6.4 修：游戏开始后自动启用 + 后台加载模型
  // 不在脚本加载时立即启用·避免菜单/启动屏被 23 MB 下载拖慢
  // 改为：等到 GM.running=true（即玩家选剧本进入游戏）后再启动·此时可在游戏过程中静默下载
  function autoEnableAfterGameStart() {
    if (STATE.enabled) return;
    if (typeof GM !== 'undefined' && GM && GM.running) {
      // 玩家配置开关·默认开·若显式禁用则不自动启用
      if (typeof P !== 'undefined' && P && P.conf && P.conf.semanticRecallAutoload === false) return;
      STATE.enabled = true;
      // 延迟 5 秒再加载·让游戏 UI 先稳定
      setTimeout(function() { ensureModel().catch(function(){}); }, 5000);
    }
  }
  function status() {
    return {
      enabled: STATE.enabled,
      modelReady: STATE.modelReady,
      modelLoading: STATE.modelLoading,
      indexSize: STATE.index.length,
      lastIndexedTurn: STATE.lastIndexedTurn,
      error: STATE.error,
      loadSource: STATE.loadSource,
      downloadProgress: STATE.downloadProgress,
      downloadFile: STATE.downloadFile,
      workerActive: !!STATE.workerReady   // perf round5: 推理是否跑在独立线程
    };
  }

  // ────── 嵌入计算 ──────
  async function _embed(text) {
    if (!STATE.modelReady) return null;
    if (!text || typeof text !== 'string') return null;
    text = text.slice(0, 512); // bge-small 最大 512 tokens
    // perf round5: worker 路径·推理在独立线程·主线程只等消息
    if (STATE.workerReady) {
      var r = await _workerRpc({ cmd: 'embedBatch', texts: [text] }, 120000);
      return (r && r.ok && r.vecs && r.vecs[0]) ? r.vecs[0] : null;
    }
    if (!STATE.pipeline) return null;
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
    // perf round5: 本会话首次索引前·先尝试吃上一会话的持久化索引（同 campaign 才吃）
    // 不吃则 lastIndexedTurn=0·老存档会全量重嵌一遍（worker 内·不卡主线程但白烧几分钟）
    if (!STATE._idxLoadTried) {
      STATE._idxLoadTried = true;
      try { await loadIndex(); } catch (_li) {}
    }
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
    // perf round5: 有新增才落盘·失败静默（IDB 不可用等）
    if (added > 0) { try { persistIndex().catch(function () {}); } catch (_pi) {} }
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
        id: s.item.id,                 // S6(2026-06-03): 保留 origin 稳定 id，供向量 hit 进 dedup/lineage 治理
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

  // P6.4：游戏开始后自动启用·首次 23 MB 模型静默缓存到 IndexedDB·之后秒开
  // 不在脚本加载时立即启用·避免菜单/启动屏被 23 MB 下载拖慢
  if (typeof window !== 'undefined') {
    var _autoTriesLeft = 90; // 90 秒窗口（玩家从开剧本到第一回合通常 30-60 秒）
    var _autoTimer = setInterval(function() {
      _autoTriesLeft--;
      if (_autoTriesLeft <= 0) { clearInterval(_autoTimer); return; }
      if (typeof GM !== 'undefined' && GM && GM.running) {
        autoEnableAfterGameStart();
        clearInterval(_autoTimer);
      }
    }, 1000);
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
  // perf round5 (2026-06-10): 持久化按 campaign(GM._runId) 隔离·防跨存档索引污染
  // GM._runId 与 keju v7.1·D5 同一字段同一惯用法·懒生成后随存档持久
  function _campaignId() {
    try {
      if (typeof GM !== 'undefined' && GM) {
        if (!GM._runId) GM._runId = 'r' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
        return GM._runId;
      }
    } catch (_) {}
    return '';
  }
  function persistIndex() {
    var campaign = _campaignId();
    return _openIdxDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction('idx', 'readwrite');
        var s = tx.objectStore('idx');
        s.clear();
        s.put({ id: '__meta__', campaign: campaign, savedAt: Date.now(), count: STATE.index.length });
        STATE.index.forEach(function(it) { s.put(it); });
        tx.oncomplete = function(){ resolve({ ok: true, count: STATE.index.length }); };
      });
    });
  }
  function loadIndex() {
    var campaign = _campaignId();
    return _openIdxDB().then(function(db) {
      return new Promise(function(resolve) {
        var tx = db.transaction('idx', 'readonly');
        tx.objectStore('idx').getAll().onsuccess = function(e) {
          var rows = e.target.result || [];
          var meta = null, items = [];
          rows.forEach(function(r) { if (r && r.id === '__meta__') meta = r; else if (r) items.push(r); });
          // 无 meta（旧库）或 campaign 不匹配（别的存档）→ 不吃
          if (!meta || !campaign || meta.campaign !== campaign) {
            resolve({ ok: false, reason: 'campaign mismatch', count: 0 });
            return;
          }
          STATE.index = items;
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
