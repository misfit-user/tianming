// ============================================================
// tm-semantic-worker.js — 语义检索专用 Worker（2026-06-10 perf round5）
//
// 背景：bge-small-zh 模型经 transformers.js 在「调用线程」跑 WASM 推理。
// 原先 tm-semantic-recall.js 直接在主线程加载+推理：
//   · 模型初始化 ≈ 20s 墙钟·其中主线程长任务 ≈ 10s（秒级整块冻结）
//   · 每条嵌入 ≈ 160ms 主线程占用（回合末增量索引成批跑）
// → 玩家体感「点什么都卡一下」。
//
// 本 worker 把 transformers 加载、模型初始化、嵌入推理全部挪到
// 独立线程；主线程只收发消息。tm-semantic-recall.js 先尝试本
// worker·失败（如环境不支持 module worker）则回退原主线程路径。
//
// 协议（postMessage）：
//   主→worker: {cmd:'init', id, opts:{modelName, hasLocalModel, localModelRoot, remoteFallbackAllowed}}
//              {cmd:'embedBatch', id, texts:[...]}
//              {cmd:'ping', id}
//   worker→主: {kind:'alive'}                          — worker 脚本就绪
//              {kind:'progress', progress, file}        — 模型下载进度
//              {id, ok:true, ...} / {id, ok:false, err} — RPC 应答
// ============================================================

'use strict';

var _pipe = null;
var _loadSource = '';

function _post(o) { try { self.postMessage(o); } catch (_) {} }

async function _loadTransformers() {
  // 加载顺序与 tm-semantic-recall.js 主线程路径一致：本地 vendor → jsdelivr → esm.sh
  var e0, e1;
  try {
    return { mod: await import('./vendor/transformers/transformers.esm.js'), src: 'local-vendor' };
  } catch (errLocal) { e0 = errLocal; }
  try {
    return { mod: await import('https://cdn.jsdelivr.net/npm/@xenova/transformers@2.17.2/+esm'), src: 'jsdelivr' };
  } catch (errJsd) { e1 = errJsd; }
  try {
    return { mod: await import('https://esm.sh/@xenova/transformers@2.17.2'), src: 'esm.sh' };
  } catch (e2) {
    throw new Error('transformers.js 加载失败·本地 + 两个 CDN 全部失败：' + (e0 && e0.message) + ' / ' + (e1 && e1.message) + ' / ' + (e2 && e2.message));
  }
}

async function _init(opts) {
  opts = opts || {};
  var loaded = await _loadTransformers();
  var transformers = loaded.mod;
  _loadSource = loaded.src;
  // Cache API 的 put 仅支持 http/https 请求·file:///capacitor:// 等非 http 协议下启用会反复抛错并拖住线程·仅 http(s) 启用(2026-06-14)
  var _tmCacheOk = (typeof location !== 'undefined' && location && (location.protocol === 'http:' || location.protocol === 'https:'));
  transformers.env.useBrowserCache = _tmCacheOk;
  var wasm = transformers.env.backends && transformers.env.backends.onnx && transformers.env.backends.onnx.wasm;
  if (!wasm) throw new Error('bundled ONNX WASM configuration unavailable');
  var localWasmRoot = './vendor/transformers/';
  try { if (self.location && self.location.href) localWasmRoot = new URL(localWasmRoot, self.location.href).href; } catch (_) {}
  wasm.wasmPaths = localWasmRoot;
  if (opts.hasLocalModel) {
    transformers.env.localModelPath = opts.localModelRoot || './vendor/models/';
    transformers.env.allowLocalModels = true;
    transformers.env.allowRemoteModels = false;
  } else {
    transformers.env.allowLocalModels = false;
    if (!opts.remoteFallbackAllowed) throw new Error('local semantic model assets not reachable; remote fallback disabled');
    transformers.env.allowRemoteModels = true;
    transformers.env.remoteHost = 'https://hf-mirror.com';
    _loadSource = 'hf-mirror';
  }
  var pipeOpts = {
    quantized: true,
    progress_callback: function (p) {
      if (p && typeof p.progress === 'number') _post({ kind: 'progress', progress: p.progress, file: p.file || '' });
      else if (p && p.status === 'done') _post({ kind: 'progress', progress: 100, file: p.file || '' });
    }
  };
  var modelName = opts.modelName || 'Xenova/bge-small-zh-v1.5';
  try {
    _pipe = await transformers.pipeline('feature-extraction', modelName, pipeOpts);
  } catch (mirrorErr) {
    if (!opts.hasLocalModel) {
      _loadSource = 'hf-fallback';
      transformers.env.remoteHost = 'https://huggingface.co';
      try {
        _pipe = await transformers.pipeline('feature-extraction', modelName, pipeOpts);
      } catch (hfErr) {
        throw new Error('模型加载失败·hf-mirror: ' + mirrorErr.message + ' / huggingface.co: ' + hfErr.message);
      }
    } else {
      throw mirrorErr;
    }
  }
  return _loadSource;
}

self.onmessage = async function (ev) {
  var m = ev.data || {};
  try {
    if (m.cmd === 'init') {
      var src = await _init(m.opts);
      _post({ id: m.id, ok: true, loadSource: src });
    } else if (m.cmd === 'embedBatch') {
      if (!_pipe) { _post({ id: m.id, ok: false, err: 'pipeline not ready' }); return; }
      var texts = Array.isArray(m.texts) ? m.texts : [];
      var vecs = [];
      for (var i = 0; i < texts.length; i++) {
        var t = String(texts[i] || '').slice(0, 512); // bge-small 最大 512 tokens
        var out = await _pipe(t, { pooling: 'mean', normalize: true });
        vecs.push(Array.from(out.data));
      }
      _post({ id: m.id, ok: true, vecs: vecs });
    } else if (m.cmd === 'ping') {
      _post({ id: m.id, ok: true, pong: true });
    }
  } catch (e) {
    _post({ id: m.id, ok: false, err: String(e && e.message || e) });
  }
};

_post({ kind: 'alive' });
