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

  var _semanticScriptUrl = global.document && global.document.currentScript && global.document.currentScript.src;
  function semanticAssetURL(relative) {
    var base = _semanticScriptUrl || (global.document && global.document.baseURI) || (global.location && global.location.href);
    if (!base) return relative;
    try { return new URL(relative, base).href; } catch (_) { return relative; }
  }

  var STATE = {
    enabled: false,        // 玩家开关
    modelReady: false,     // 模型加载完成
    modelLoading: false,   // 加载中（防止重复加载）
    pipeline: null,        // transformers.js feature-extraction pipeline
    index: [],             // [{ id, source, turn, text, vec }]
    existingIds: new Set(),// source|sourceId; load once, append only after durable commit
    lastIndexedTurn: 0,    // 上次索引到的 turn
    cursors: Object.create(null),
    worldKey: '',
    worldRef: null,
    pRef: null,
    worldGeneration: 0,
    loadGeneration: 0,
    sessionToken: '',
    _idxLoadTried: false,
    modelVersion: 'bge-small-zh-v1.5:index-v2',
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
  var _buildFlights = Object.create(null);
  var _loadFlights = Object.create(null);

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
      try { w = new Worker(semanticAssetURL('./tm-semantic-worker.js'), { type: 'module' }); }
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
      var localModelRoot = semanticAssetURL('./vendor/models/');
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
      var wasm = transformers.env.backends && transformers.env.backends.onnx && transformers.env.backends.onnx.wasm;
      if (!wasm) throw new Error('bundled ONNX WASM configuration unavailable');
      wasm.wasmPaths = semanticAssetURL('./vendor/transformers/');
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
    if (typeof GM !== 'undefined' && GM) _ensureWorldState();
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

  function _perfCount(name, delta) {
    if (global.TM && global.TM.perf && typeof global.TM.perf.count === 'function') global.TM.perf.count(name, delta);
  }

  function _perfWithSpan(name, fn, metadata) {
    if (global.TM && global.TM.perf && typeof global.TM.perf.withSpan === 'function') {
      return global.TM.perf.withSpan(name, fn, metadata);
    }
    return fn();
  }

  function _loadGeneration() {
    var value = Number(global && global._tmLoadGen);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  }

  function _sessionToken() {
    try {
      if (global && typeof global._tmGetDesktopAutoSaveSessionToken === 'function') {
        return String(global._tmGetDesktopAutoSaveSessionToken() || '');
      }
    } catch (error) {
      if (global.TM && global.TM.errors && typeof global.TM.errors.capture === 'function') {
        global.TM.errors.capture(error, 'SemanticRecall.sessionToken');
      }
    }
    return '';
  }

  function _worldIdentity(gm) {
    gm = gm || (typeof GM !== 'undefined' && GM ? GM : null);
    var campaignId = String(gm && (gm._campaignId || gm._runId) || '');
    var timelineId = String(gm && gm._timelineId || '');
    return {
      campaignId: campaignId,
      timelineId: timelineId,
      modelVersion: STATE.modelVersion,
      key: campaignId + '|' + timelineId + '|' + STATE.modelVersion
    };
  }

  function _ensureWorldState() {
    var gm = typeof GM !== 'undefined' && GM ? GM : null;
    var p = typeof P !== 'undefined' && P ? P : null;
    var identity = _worldIdentity(gm);
    var loadGeneration = _loadGeneration();
    var sessionToken = _sessionToken();
    if (STATE.worldKey !== identity.key || STATE.worldRef !== gm || STATE.pRef !== p
        || STATE.loadGeneration !== loadGeneration || STATE.sessionToken !== sessionToken) {
      STATE.worldKey = identity.key;
      STATE.worldRef = gm;
      STATE.pRef = p;
      STATE.worldGeneration += 1;
      STATE.loadGeneration = loadGeneration;
      STATE.sessionToken = sessionToken;
      STATE.index = [];
      STATE.existingIds = new Set();
      STATE.cursors = Object.create(null);
      STATE.lastIndexedTurn = 0;
      STATE._idxLoadTried = false;
    }
    return identity;
  }

  function _emptyCursor(source) {
    return {
      source: source,
      lastStableId: '',
      lastSeq: 0,
      lastArrayOffset: 0,
      lastTurn: 0,
      revision: 0
    };
  }

  function _cloneCursors(cursors) {
    var out = Object.create(null);
    Object.keys(cursors && typeof cursors === 'object' ? cursors : {}).forEach(function(source) {
      if (!source || source === '__proto__' || source === 'prototype' || source === 'constructor') return;
      var cursor = cursors[source] || {};
      out[source] = {
        source: source,
        lastStableId: String(cursor.lastStableId || ''),
        lastSeq: Number.isFinite(Number(cursor.lastSeq)) && Number(cursor.lastSeq) >= 0 ? Math.floor(Number(cursor.lastSeq)) : 0,
        lastArrayOffset: Number.isFinite(Number(cursor.lastArrayOffset)) && Number(cursor.lastArrayOffset) >= 0 ? Math.floor(Number(cursor.lastArrayOffset)) : 0,
        lastTurn: Number.isFinite(Number(cursor.lastTurn)) && Number(cursor.lastTurn) >= 0 ? Number(cursor.lastTurn) : 0,
        revision: Number.isFinite(Number(cursor.revision)) && Number(cursor.revision) >= 0 ? Math.floor(Number(cursor.revision)) : 0
      };
    });
    return out;
  }

  function _cursorIn(cursors, source) {
    if (!cursors[source]) cursors[source] = _emptyCursor(source);
    return cursors[source];
  }

  function _captureWorldLease(identity) {
    return {
      campaignId: identity.campaignId,
      timelineId: identity.timelineId,
      modelVersion: identity.modelVersion,
      worldKey: identity.key,
      worldGeneration: STATE.worldGeneration,
      loadGeneration: STATE.loadGeneration,
      sessionToken: STATE.sessionToken,
      gmRef: STATE.worldRef,
      pRef: STATE.pRef,
      token: identity.key + '#g' + STATE.worldGeneration
    };
  }

  function _isLeaseCurrent(lease) {
    if (!lease) return false;
    var gm = typeof GM !== 'undefined' && GM ? GM : null;
    var p = typeof P !== 'undefined' && P ? P : null;
    return gm === lease.gmRef && p === lease.pRef
      && _worldIdentity(gm).key === lease.worldKey
      && _loadGeneration() === lease.loadGeneration
      && _sessionToken() === lease.sessionToken
      && STATE.worldKey === lease.worldKey
      && STATE.worldGeneration === lease.worldGeneration
      && STATE.worldRef === lease.gmRef;
  }

  function _assertLeaseCurrent(lease, stage) {
    if (_isLeaseCurrent(lease)) return;
    var error = new Error('semantic index world lease expired at ' + String(stage || 'async boundary'));
    error.code = 'semantic_world_changed';
    throw error;
  }

  function _stableFingerprint(value) {
    var text;
    try { text = typeof value === 'string' ? value : JSON.stringify(value); }
    catch (error) { text = String(value == null ? '' : value); }
    if (text == null) text = '';
    var first = 2166136261;
    var second = 2246822519;
    for (var index = 0; index < text.length; index++) {
      var code = text.charCodeAt(index);
      first ^= code;
      first = Math.imul(first, 16777619);
      second ^= code + index;
      second = Math.imul(second, 3266489917);
    }
    return 'h' + (first >>> 0).toString(36) + (second >>> 0).toString(36) + 'l' + text.length.toString(36);
  }

  // ────── 嵌入计算 ──────
  async function _embedBatch(texts) {
    if (!STATE.modelReady || !Array.isArray(texts) || !texts.length) return [];
    texts = texts.map(function(text) { return String(text || '').slice(0, 512); });
    _perfCount('semantic.embedRpcCount', 1);
    _perfCount('semantic.embedTextCount', texts.length);
    return _perfWithSpan('semantic.embed', async function() {
      if (STATE.workerReady) {
        var response = await _workerRpc({ cmd: 'embedBatch', texts: texts }, 120000);
        return (response && response.ok && Array.isArray(response.vecs)) ? response.vecs : [];
      }
      if (!STATE.pipeline) return [];
      var input = texts.length === 1 ? texts[0] : texts;
      var out = await STATE.pipeline(input, { pooling: 'mean', normalize: true });
      if (!out || !out.data) return [];
      if (texts.length === 1) return [Array.from(out.data)];
      var width = Math.floor(out.data.length / texts.length);
      if (!width || width * texts.length !== out.data.length) throw new Error('semantic batch embedding shape mismatch');
      var vectors = [];
      for (var i = 0; i < texts.length; i++) {
        vectors.push(Array.from(out.data.slice(i * width, (i + 1) * width)));
      }
      return vectors;
    }, { texts: texts.length });
  }

  async function _embed(text) {
    if (!text || typeof text !== 'string') return null;
    var vectors = await _embedBatch([text]);
    return vectors[0] || null;
  }

  function _cosineSim(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    var dot = 0;
    for (var i = 0; i < a.length; i++) dot += a[i] * b[i];
    // 已归一化·dot 即 cosine
    return dot;
  }

  // ────── 增量索引 ──────
  // 收集本回合新增 + 历史未索引内容。所有 cursor/index 修改先进入局部 staged
  // 状态，只有 embedding 完整且 IndexedDB 事务提交后才发布到 STATE。
  function _rowScanStart(rows, cursor, identify) {
    if (!rows.length || !cursor.lastStableId) return 0;
    var offset = Number(cursor.lastArrayOffset);
    if (Number.isSafeInteger(offset) && offset > 0 && offset <= rows.length
        && identify(rows[offset - 1]) === cursor.lastStableId) return offset;
    for (var index = rows.length - 1; index >= 0; index--) {
      if (identify(rows[index]) === cursor.lastStableId) return index + 1;
    }
    // 源被裁剪、迁移或重排；有界重扫当前窗口，existingIds 会过滤已提交项。
    return 0;
  }

  function _validateEmbeddingBatch(vectors, batchLength, expectedDimension) {
    if (!Array.isArray(vectors) || vectors.length !== batchLength) {
      throw new Error('semantic embedding batch returned ' + (Array.isArray(vectors) ? vectors.length : 0)
        + ' vectors for ' + batchLength + ' texts');
    }
    var dimension = expectedDimension || 0;
    vectors.forEach(function(vector) {
      if (!Array.isArray(vector) || !vector.length) throw new Error('semantic embedding vector is missing or empty');
      if (!dimension) dimension = vector.length;
      if (vector.length !== dimension) throw new Error('semantic embedding vector dimension mismatch');
      for (var component = 0; component < vector.length; component++) {
        if (!Number.isFinite(Number(vector[component]))) throw new Error('semantic embedding vector contains non-finite values');
      }
    });
    return dimension;
  }

  async function _buildIndexForLease(opts, identity, lease) {
    _assertLeaseCurrent(lease, 'build-start');
    if (!STATE._idxLoadTried) {
      try {
        await loadIndex(identity, lease);
        _assertLeaseCurrent(lease, 'load-index');
      } catch (loadError) {
        if (loadError && loadError.code === 'semantic_world_changed') throw loadError;
        if (!_isLeaseCurrent(lease)) throw loadError;
        STATE.error = 'semantic index load failed: ' + (loadError.message || String(loadError));
        if (global.TM && global.TM.errors && typeof global.TM.errors.capture === 'function') {
          global.TM.errors.capture(loadError, 'SemanticRecall.loadIndex');
        } else if (global.console && console.warn) console.warn('[SemanticRecall] index load failed:', loadError);
        throw loadError;
      }
    }

    var gm = lease.gmRef;
    var turn = Number(gm.turn) || 0;
    var pending = [];
    var pendingIds = new Set();
    var nextCursors = _cloneCursors(STATE.cursors);
    var cursorChanged = false;
    var sourceRowsVisited = 0;

    function visitRows(source, rows, identify, project) {
      rows = Array.isArray(rows) ? rows : [];
      var cursor = _cursorIn(nextCursors, source);
      var start = _rowScanStart(rows, cursor, identify);
      var newestTurn = cursor.lastTurn || 0;
      for (var offset = start; offset < rows.length; offset++) {
        sourceRowsVisited += 1;
        _perfCount('semantic.sourceRowsVisited', 1);
        var rowStableId = identify(rows[offset]);
        var projected = project(rows[offset], rowStableId) || [];
        if (!Array.isArray(projected)) projected = [projected];
        projected.forEach(function(item) {
          if (!item || !item.sourceId || !item.text) return;
          var dedupeKey = source + '|' + item.sourceId;
          if (STATE.existingIds.has(dedupeKey) || pendingIds.has(dedupeKey)) return;
          pendingIds.add(dedupeKey);
          pending.push({
            source: source,
            sourceId: String(item.sourceId),
            turn: Number(item.turn) || 0,
            text: String(item.text).slice(0, 200)
          });
          newestTurn = Math.max(newestTurn, Number(item.turn) || 0);
        });
      }
      var nextStableId = rows.length ? identify(rows[rows.length - 1]) : '';
      if (cursor.lastArrayOffset !== rows.length || cursor.lastStableId !== nextStableId || start < rows.length) {
        cursorChanged = true;
      }
      cursor.lastArrayOffset = rows.length;
      cursor.lastSeq = (cursor.lastSeq || 0) + Math.max(0, rows.length - start);
      cursor.lastStableId = nextStableId;
      cursor.lastTurn = newestTurn;
      cursor.revision = (cursor.revision || 0) + Math.max(0, rows.length - start);
    }

    await _perfWithSpan('semantic.scan', function() {
      visitRows('shiji', gm.shijiHistory, function(sh) {
        if (!sh) return '';
        return String(sh.id || ('fp:' + _stableFingerprint([
          Number(sh.turn) || 0, sh.shilu || '', sh.shizhengji || '', sh.zhengwen || '', sh.shilu_text || ''
        ])));
      }, function(sh, stable) {
        if (!sh) return [];
        var combined = sh.shilu || sh.shizhengji || sh.zhengwen || sh.shilu_text || '';
        var sentences = String(combined).split(/[。！？\n]/).filter(function(sentence) { return sentence && sentence.length > 8; });
        return sentences.slice(0, 30).map(function(sentence, sentenceIndex) {
          return { sourceId: stable + ':s' + sentenceIndex, turn: sh.turn, text: sentence };
        });
      });

      if (typeof ChronicleTracker !== 'undefined' && ChronicleTracker.getAll) {
        var allChron = Array.isArray(gm._chronicleTracks) ? gm._chronicleTracks : (ChronicleTracker.getAll({}) || []);
        visitRows('chronicle', allChron, function(entry) {
          if (!entry) return '';
          return String(entry.id || ('fp:' + _stableFingerprint([
            Number(entry.startTurn) || 0, entry.title || '', entry.description || '', entry.summary || ''
          ])));
        }, function(entry, stable) {
          if (!entry) return null;
          return { sourceId: stable, turn: entry.startTurn, text: (entry.title || '') + '·' + (entry.description || entry.summary || '') };
        });
      }

      visitRows('foreshadow', gm._foreshadows, function(entry) {
        if (!entry) return '';
        return String(entry.id || ('fp:' + _stableFingerprint([
          Number(entry.turn) || 0, entry.content || '', entry.text || '', entry.type || ''
        ])));
      }, function(entry, stable) {
        if (!entry) return null;
        return { sourceId: stable, turn: entry.turn, text: entry.content || entry.text || '' };
      });

      var eventRows = gm._memTables && gm._memTables.eventHistory && gm._memTables.eventHistory.rows;
      visitRows('eventHistory', eventRows, function(row) {
        if (!row) return '';
        return String(row[0] || ('fp:' + _stableFingerprint(row)));
      }, function(row, stable) {
        if (!row) return null;
        var rowTurn = Number.parseInt(row[1], 10);
        if (!Number.isFinite(rowTurn)) rowTurn = 0;
        return { sourceId: stable, turn: rowTurn, text: String(row[2] || '') + ' ' + String(row[5] || '') };
      });
    }, { world: identity.key });

    _assertLeaseCurrent(lease, 'scan');
    _perfCount('semantic.newRows', pending.length);
    if (!pending.length && !cursorChanged) {
      return { ok: true, added: 0, total: STATE.index.length, visited: sourceRowsVisited, reused: true };
    }

    var addedItems = [];
    var batchSize = Number(opts.batchSize);
    if (!Number.isSafeInteger(batchSize) || batchSize < 16 || batchSize > 64) batchSize = 32;
    var expectedDimension = STATE.index.length && Array.isArray(STATE.index[0].vec) ? STATE.index[0].vec.length : 0;
    for (var batchAt = 0; batchAt < pending.length; batchAt += batchSize) {
      var batch = pending.slice(batchAt, batchAt + batchSize);
      var vectors = await _embedBatch(batch.map(function(item) { return item.text; }));
      _assertLeaseCurrent(lease, 'embedding-batch');
      expectedDimension = _validateEmbeddingBatch(vectors, batch.length, expectedDimension);
      for (var vectorIndex = 0; vectorIndex < batch.length; vectorIndex++) {
        var pendingItem = batch[vectorIndex];
        addedItems.push({
          id: identity.campaignId + ':' + identity.timelineId + ':' + pendingItem.source + ':' + pendingItem.sourceId,
          sourceId: pendingItem.sourceId,
          campaignId: identity.campaignId,
          timelineId: identity.timelineId,
          modelVersion: identity.modelVersion,
          source: pendingItem.source,
          turn: pendingItem.turn,
          text: pendingItem.text,
          vec: vectors[vectorIndex]
        });
      }
    }

    var staged = {
      cursors: nextCursors,
      newItems: addedItems,
      count: STATE.index.length + addedItems.length,
      lastIndexedTurn: (pending.length || cursorChanged) ? turn : STATE.lastIndexedTurn
    };
    await _persistStagedIndex(identity, staged, lease);
    _assertLeaseCurrent(lease, 'persist-complete');
    addedItems.forEach(function(item) {
      STATE.index.push(item);
      STATE.existingIds.add(item.source + '|' + (item.sourceId || item.id));
    });
    STATE.cursors = nextCursors;
    STATE.lastIndexedTurn = staged.lastIndexedTurn;
    return { ok: true, added: addedItems.length, total: STATE.index.length, visited: sourceRowsVisited };
  }

  async function buildIndex(opts) {
    opts = opts || {};
    _perfCount('semantic.idbClearCount', 0);
    if (!STATE.enabled) return { ok: false, reason: 'disabled' };
    if (!await ensureModel()) return { ok: false, reason: 'model not ready: ' + STATE.error };
    if (typeof GM === 'undefined' || !GM) return { ok: false, reason: 'no GM' };
    var identity = _ensureWorldState();
    if (!identity.campaignId || !identity.timelineId) return { ok: false, reason: 'world identity unavailable' };
    var lease = _captureWorldLease(identity);
    if (_buildFlights[lease.token]) return _buildFlights[lease.token];
    var flight = _buildIndexForLease(opts, identity, lease);
    _buildFlights[lease.token] = flight;
    return flight.finally(function() {
      if (_buildFlights[lease.token] === flight) delete _buildFlights[lease.token];
    });
  }

  // ────── 检索 ──────
  async function search(query, opts) {
    opts = opts || {};
    if (!STATE.enabled || !STATE.modelReady) return [];
    if (!query) return [];
    var identity = _ensureWorldState();
    var lease = _captureWorldLease(identity);
    var qVec = await _embed(query);
    if (!qVec || !_isLeaseCurrent(lease)) return [];
    var topK = Number(opts.topK);
    if (!Number.isSafeInteger(topK) || topK <= 0 || topK > 100) topK = 6;
    var threshold = opts.threshold != null ? Number(opts.threshold) : STATE.threshold;
    if (!Number.isFinite(threshold)) threshold = STATE.threshold;
    function worse(left, right) {
      return left.sim < right.sim || (left.sim === right.sim && left.order > right.order);
    }
    function heapPush(heap, entry) {
      heap.push(entry);
      var at = heap.length - 1;
      while (at > 0) {
        var parent = Math.floor((at - 1) / 2);
        if (!worse(heap[at], heap[parent])) break;
        var swap = heap[parent]; heap[parent] = heap[at]; heap[at] = swap; at = parent;
      }
    }
    function heapReplaceWorst(heap, entry) {
      heap[0] = entry;
      var at = 0;
      while (true) {
        var left = at * 2 + 1;
        var right = left + 1;
        var worst = at;
        if (left < heap.length && worse(heap[left], heap[worst])) worst = left;
        if (right < heap.length && worse(heap[right], heap[worst])) worst = right;
        if (worst === at) break;
        var swap = heap[worst]; heap[worst] = heap[at]; heap[at] = swap; at = worst;
      }
    }
    var scored = await _perfWithSpan('semantic.search', function() {
      var heap = [];
      for (var i = 0; i < STATE.index.length; i++) {
        var item = STATE.index[i];
        var sim = _cosineSim(qVec, item.vec);
        _perfCount('semantic.vectorComparisons', 1);
        if (sim < threshold) continue;
        var entry = { item: item, sim: sim, order: i };
        if (heap.length < topK) heapPush(heap, entry);
        else if (worse(heap[0], entry)) heapReplaceWorst(heap, entry);
      }
      return heap.sort(function(a, b) { return (b.sim - a.sim) || (a.order - b.order); });
    }, { candidates: STATE.index.length, topK: topK });
    return scored.map(function(s) {
      return {
        source: 'vector',
        sub: s.item.source,
        id: s.item.sourceId || s.item.id,
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
      buildIndex().catch(function(error){
        if (error && error.code === 'semantic_world_changed') return;
        STATE.error = String(error && (error.message || error) || 'semantic index failure');
        if (global.TM && global.TM.errors && typeof global.TM.errors.capture === 'function') {
          global.TM.errors.capture(error, 'SemanticRecall.autoIndex');
        } else if (global.console && console.warn) console.warn('[SemanticRecall] auto index failed:', error);
      });
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
      var req = indexedDB.open('tianming_semantic_idx', 2);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        var store;
        if (!db.objectStoreNames.contains('idx')) store = db.createObjectStore('idx', { keyPath: 'id' });
        else store = e.target.transaction.objectStore('idx');
        try {
          if (!store.indexNames || !store.indexNames.contains('worldModel')) {
            store.createIndex('worldModel', ['campaignId', 'timelineId', 'modelVersion'], { unique: false });
          }
        } catch (indexError) {
          STATE.error = 'semantic index schema upgrade failed: ' + (indexError.message || String(indexError));
          throw indexError;
        }
      };
      req.onsuccess = function(e) { resolve(e.target.result); };
      req.onerror = function(e) { reject(e.target.error); };
    });
    return _idxDbPromise;
  }
  function _semanticMetaId(identity) {
    return '__meta__:' + encodeURIComponent(identity.campaignId) + ':'
      + encodeURIComponent(identity.timelineId) + ':' + encodeURIComponent(identity.modelVersion);
  }

  function _persistStagedIndex(identity, staged, lease) {
    staged = staged || {};
    var newItems = Array.isArray(staged.newItems) ? staged.newItems : [];
    _assertLeaseCurrent(lease, 'persist-open');
    return _perfWithSpan('semantic.persist', function() { return _openIdxDB().then(function(db) {
      _assertLeaseCurrent(lease, 'persist-transaction');
      return new Promise(function(resolve, reject) {
        var tx = db.transaction('idx', 'readwrite');
        var s = tx.objectStore('idx');
        var meta = {
          id: _semanticMetaId(identity),
          campaignId: identity.campaignId,
          timelineId: identity.timelineId,
          modelVersion: identity.modelVersion,
          savedAt: Date.now(),
          count: Number(staged.count) || 0,
          lastIndexedTurn: Number(staged.lastIndexedTurn) || 0,
          cursors: _cloneCursors(staged.cursors)
        };
        try {
          s.put(meta);
          _perfCount('semantic.idbPutCount', 1);
          newItems.forEach(function(item) {
            s.put(item);
            _perfCount('semantic.idbPutCount', 1);
          });
        } catch (putError) {
          try { if (typeof tx.abort === 'function') tx.abort(); }
          catch (abortError) {
            if (global.TM && global.TM.errors && typeof global.TM.errors.capture === 'function') {
              global.TM.errors.capture(abortError, 'SemanticRecall.persistAbort');
            }
          }
          reject(putError);
          return;
        }
        tx.oncomplete = function(){ resolve({ ok: true, count: meta.count }); };
        tx.onerror = function(e) { reject((e.target && e.target.error) || tx.error || new Error('semantic index persist failed')); };
        tx.onabort = function(e) { reject((e.target && e.target.error) || tx.error || new Error('semantic index persist aborted')); };
      });
    }); }, { added: newItems.length, world: identity.key });
  }

  // Compatibility entry point for diagnostics/manual persistence. Production
  // buildIndex uses _persistStagedIndex and never mutates STATE before commit.
  function persistIndex(newItems) {
    var identity = _ensureWorldState();
    var lease = _captureWorldLease(identity);
    newItems = Array.isArray(newItems) ? newItems : [];
    return _persistStagedIndex(identity, {
      newItems: newItems,
      count: STATE.index.length,
      lastIndexedTurn: STATE.lastIndexedTurn,
      cursors: _cloneCursors(STATE.cursors)
    }, lease);
  }

  function _loadIndexData(identity, lease) {
    _assertLeaseCurrent(lease, 'load-open');
    return _openIdxDB().then(function(db) {
      _assertLeaseCurrent(lease, 'load-query');
      return new Promise(function(resolve, reject) {
        var tx = db.transaction('idx', 'readonly');
        var store = tx.objectStore('idx');
        var req;
        var loadedResult = null;
        var requestDone = false;
        var transactionDone = false;
        var settled = false;
        function finishIfReady() {
          if (!settled && requestDone && transactionDone) {
            settled = true;
            resolve(loadedResult);
          }
        }
        function fail(error) {
          if (settled) return;
          settled = true;
          reject(error);
        }
        try {
          var index = typeof store.index === 'function' ? store.index('worldModel') : null;
          req = index ? index.getAll([identity.campaignId, identity.timelineId, identity.modelVersion]) : store.getAll();
        } catch (queryError) {
          req = store.getAll();
        }
        req.onsuccess = function(e) {
          try { _assertLeaseCurrent(lease, 'load-result'); }
          catch (leaseError) { fail(leaseError); return; }
          var rows = e.target.result || [];
          var metaId = _semanticMetaId(identity);
          var meta = null, items = [], legacyMeta = null;
          rows.forEach(function(row) {
            if (!row) return;
            if (row.id === metaId) meta = row;
            else if (row.id === '__meta__') legacyMeta = row;
            else if (row.campaignId === identity.campaignId
                && row.timelineId === identity.timelineId
                && row.modelVersion === identity.modelVersion) items.push(row);
          });
          if (!meta) {
            loadedResult = {
              ok: false,
              reason: legacyMeta ? 'legacy-index-rebuild' : 'world index missing',
              items: [],
              cursors: Object.create(null),
              lastIndexedTurn: 0
            };
            requestDone = true;
            finishIfReady();
            return;
          }
          loadedResult = {
            ok: true,
            items: items,
            cursors: _cloneCursors(meta.cursors),
            lastIndexedTurn: Number(meta.lastIndexedTurn) || 0
          };
          requestDone = true;
          finishIfReady();
        };
        req.onerror = function(e) { fail(e.target.error || new Error('semantic index load failed')); };
        tx.oncomplete = function() {
          transactionDone = true;
          finishIfReady();
        };
        tx.onerror = function(e) { fail((e.target && e.target.error) || tx.error || new Error('semantic index load failed')); };
        tx.onabort = function(e) { fail((e.target && e.target.error) || tx.error || new Error('semantic index load aborted')); };
      });
    });
  }

  function _applyLoadedIndex(loaded, lease) {
    _assertLeaseCurrent(lease, 'load-apply');
    var items = Array.isArray(loaded && loaded.items) ? loaded.items : [];
    var existingIds = new Set();
    items.forEach(function(item) {
      _perfCount('semantic.existingIdVisits', 1);
      if (!item || !item.source) return;
      existingIds.add(item.source + '|' + (item.sourceId || item.id));
    });
    STATE.index = items;
    STATE.existingIds = existingIds;
    STATE.cursors = _cloneCursors(loaded && loaded.cursors);
    STATE.lastIndexedTurn = Number(loaded && loaded.lastIndexedTurn) || 0;
    STATE._idxLoadTried = true;
    return { ok: !!(loaded && loaded.ok), reason: loaded && loaded.reason || '', count: items.length };
  }

  function loadIndex(identity, lease) {
    identity = identity || _ensureWorldState();
    lease = lease || _captureWorldLease(identity);
    if (_loadFlights[lease.token]) return _loadFlights[lease.token];
    var flight = _loadIndexData(identity, lease).then(function(loaded) {
      return _applyLoadedIndex(loaded, lease);
    });
    _loadFlights[lease.token] = flight;
    return flight.finally(function() {
      if (_loadFlights[lease.token] === flight) delete _loadFlights[lease.token];
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
