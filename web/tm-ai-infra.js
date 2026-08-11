// @ts-check
/// <reference path="types.d.ts" />
// ============================================================
// tm-ai-infra.js — AI 调用基础设施 (R135 从 tm-utils.js L955-end 拆出)
// 姊妹: tm-utils.js (基础工具·RNG·时间·通知)
// 包含:
//   1.1 Prompt 分层压缩·1.2 模型适配层·1.6 调用成本监控·1.7 模板化引擎·
//   1.7.4 请求队列 (C1/C2)·1.7.46 Provider 检测+缓存 (S4)·1.7.47 XML Prompt·
//   1.7.48 时间三位一体·1.7.45 Token 粗估·1.7.5 AI 调用基础 (重试/超时/429)·
//   GameHooks·月结流水线·子回合调度·事件总线·原子操作·变更日志·Balance 配置·
//   robustParseJSON·调试日志·AI Sub-call 管线·重大决策注册表·模型上下文自动探测
//
// R159 章节导航 (2802 行) — 章节号与文件内 // 1.X.Y 注释对应：
//   §1 [L15]   1.1 Prompt 分层压缩 (固定层缓存·速变层限长)
//   §2 [L150]  1.2 模型适配层 (openai/anthropic/gemini provider 检测)
//   §3 [L380]  1.6 调用成本监控 (TokenBudget·429 重试)
//   §4 [L700]  1.7 模板化引擎 + GameHooks
//   §5 [L900]  事件总线 + 原子操作 + 变更日志
//   §6 [L1500] 1.7.5 callAI 主入口 (重试/超时/流式)
//   §7 [L2000] 1.7.45/47 Token 粗估 + XML Prompt 工具
//   §8 [L2400] 1.7.48 时间三位一体 + Sub-call 管线
// ============================================================

// ============================================================
//  1.1 Prompt分层压缩系统
//  固定层（朝代设定/官制/规则）缓存 + 缓变层差异描述 + 速变层限500字
// ============================================================
// 探测结果落 P.conf 后须持久化(2026-07-04 p:conf 收口)——探测烧真金 API·不存则重启蒸发每会话重烧
function _persistProbeConf() {
  try { if (typeof saveP === 'function') saveP(); } catch (_e) {}
}

var PromptLayerCache = (function() {
  var cache = { hash: '', fixedLayer: '', lastTurn: -1, slowLayer: '' };
  return {
    /** 计算固定层hash——仅当官制/规则/角色列表结构变化时重建 */
    computeHash: function() {
      // 简易djb2 hash——对内容取hash而非仅长度，避免false cache hit
      function _h(s) { var h = 5381; for (var i = 0; i < s.length; i++) h = ((h << 5) + h) + s.charCodeAt(i); return (h >>> 0).toString(36); }
      var parts = [];
      if (typeof P !== 'undefined') {
        parts.push(P.dynasty || '', P.era || '');
        if (P.officeTree) parts.push(_h(JSON.stringify(P.officeTree).substring(0, 2000)));
        if (P.rules) parts.push(_h((P.rules.base || '').substring(0, 500)));
        if (P.government) parts.push((P.government.name || '') + (P.government.nodes || []).length);
      }
      if (typeof GM !== 'undefined' && GM.chars) {
        // 用存活角色名hash而非仅数量
        var _aliveNames = GM.chars.filter(function(c){return c.alive!==false;}).map(function(c){return c.name;}).join(',');
        parts.push(_h(_aliveNames));
      }
      return parts.join('|');
    },
    /** 获取固定层（如果hash未变则返回缓存） */
    getFixedLayer: function(buildFn) {
      var newHash = this.computeHash();
      if (newHash === cache.hash && cache.fixedLayer) return cache.fixedLayer;
      cache.hash = newHash;
      cache.fixedLayer = (typeof buildFn === 'function') ? buildFn() : '';
      return cache.fixedLayer;
    },
    /** 获取缓变层——每回合重建但只描述与上回合的差异 */
    getSlowLayer: function(buildFn) {
      if (typeof GM === 'undefined') return '';
      cache.slowLayer = (typeof buildFn === 'function') ? buildFn() : '';
      cache.lastTurn = GM.turn || 0;
      return cache.slowLayer;
    },
    /** 7.2: 预加载——预构建固定层hash，下回合调用getFixedLayer时直接命中缓存 */
    preload: function() {
      this._preloadedTurn = (typeof GM !== 'undefined') ? GM.turn : -1;
      this.computeHash(); // 预计算hash，触发内部缓存
      if (typeof _dbg === 'function') _dbg('[PromptCache] preloaded for turn ' + this._preloadedTurn);
    },
    /** 清空缓存（新游戏时调用） */
    clear: function() { cache = { hash: '', fixedLayer: '', lastTurn: -1, slowLayer: '' }; }
  };
})();

// ============================================================
//  1.2 模型适配层
//  根据 P.ai.model 自动选择 prompt 格式和参数
// ============================================================
var ModelAdapter = {
  /** 检测模型家族 */
  detectFamily: function(modelStr) {
    if (!modelStr) return 'openai';
    var m = modelStr.toLowerCase();
    if (m.indexOf('claude') >= 0) return 'anthropic';
    if (m.indexOf('gemini') >= 0 || m.indexOf('google') >= 0) return 'google';
    if (m.indexOf('llama') >= 0 || m.indexOf('qwen') >= 0 || m.indexOf('deepseek') >= 0 || m.indexOf('yi-') >= 0) return 'local';
    return 'openai'; // GPT系列及兼容API
  },
  /** 获取适配参数 */
  getConfig: function() {
    var family = this.detectFamily((typeof P !== 'undefined' && P.ai) ? P.ai.model : '');
    var configs = {
      openai:    { jsonWrap: 'markdown', tempDefault: 0.8, jsonInstruction: '返回JSON（用```json代码块包裹）：', maxRetry: 2 },
      anthropic: { jsonWrap: 'xml', tempDefault: 0.7, jsonInstruction: '返回JSON（用<json>标签包裹）：', maxRetry: 2 },
      google:    { jsonWrap: 'plain', tempDefault: 0.8, jsonInstruction: '返回严格JSON格式：', maxRetry: 3 },
      local:     { jsonWrap: 'plain', tempDefault: 0.6, jsonInstruction: '返回JSON，不要添加任何额外文字：', maxRetry: 3 }
    };
    var cfg = configs[family] || configs.openai;
    // 7.2: 流式渲染支持标记
    cfg.supportsStreaming = family === 'openai' || family === 'anthropic';
    return cfg;
  },
  /** 包裹JSON指令（根据模型家族调整格式） */
  wrapJsonInstruction: function(schema) {
    var cfg = this.getConfig();
    if (cfg.jsonWrap === 'xml') return '<json_schema>' + schema + '</json_schema>';
    if (cfg.jsonWrap === 'markdown') return '```json\n' + schema + '\n```';
    return schema;
  },
  /** 获取默认温度 */
  getDefaultTemp: function() { return this.getConfig().tempDefault; }
};

// 1.5: Sub-call并行化已集成到 AISubCallRegistry.runPipeline 中
// 使用 parallelGroup 属性标记可并行的Sub-call，同组内自动 Promise.all

// ============================================================
//  1.6 AI调用成本监控
//  解析 API 返回的 usage 字段，累计 token 消耗
// ============================================================
var TokenUsageTracker = {
  _data: { promptTokens: 0, completionTokens: 0, totalCalls: 0, turnStart: 0, byId: {} },
  /** 记录一次API调用的token消耗·Phase 7·加 id 参数·便于按 subcall 拆分 */
  record: function(usage, id) {
    if (!usage) return;
    var pt = usage.prompt_tokens || 0;
    var ct = usage.completion_tokens || 0;
    this._data.promptTokens += pt;
    this._data.completionTokens += ct;
    this._data.totalCalls++;
    if (id) {
      if (!this._data.byId) this._data.byId = {};
      var b = this._data.byId[id] = this._data.byId[id] || { promptTokens: 0, completionTokens: 0, calls: 0 };
      b.promptTokens += pt;
      b.completionTokens += ct;
      b.calls++;
    }
  },
  /** 记录回合开始（用于计算单回合消耗） */
  markTurnStart: function() {
    this._data.turnStart = this._data.promptTokens + this._data.completionTokens;
  },
  /** 获取当前回合消耗 */
  getTurnUsage: function() {
    var total = this._data.promptTokens + this._data.completionTokens;
    return total - this._data.turnStart;
  },
  /** 获取累计统计 */
  getStats: function() {
    var total = this._data.promptTokens + this._data.completionTokens;
    // 估算费用（按GPT-4o价格：input $2.5/M, output $10/M）
    var estCost = (this._data.promptTokens * 2.5 + this._data.completionTokens * 10) / 1000000;
    return {
      promptTokens: this._data.promptTokens,
      completionTokens: this._data.completionTokens,
      totalTokens: total,
      totalCalls: this._data.totalCalls,
      estimatedCostUSD: Math.round(estCost * 1000) / 1000
    };
  },
  /** Phase 7·按 id 拆分快照·用于成本面板 byId 渲染 */
  getSnapshot: function() {
    var stats = this.getStats();
    var byId = {};
    if (this._data.byId) {
      Object.keys(this._data.byId).forEach(function(id) {
        var b = this._data.byId[id] || {};
        var pt = b.promptTokens || 0, ct = b.completionTokens || 0;
        byId[id] = { promptTokens: pt, completionTokens: ct, calls: b.calls || 0, estimatedCostUSD: Math.round((pt*2.5 + ct*10)/1000) / 1000 };
      }, this);
    }
    return Object.assign({}, stats, { byId: byId });
  },
  /** 重置（新游戏） */
  reset: function() { this._data = { promptTokens: 0, completionTokens: 0, totalCalls: 0, turnStart: 0, byId: {} }; }
};

// ============================================================
//  1.7 Prompt模板化引擎
//  占位符模板替代字符串拼接
// ============================================================
var PromptTemplate = {
  _templates: {},
  /** 注册模板 */
  register: function(id, template) { this._templates[id] = template; },
  /** 渲染模板——替换 {{key}} 占位符 */
  render: function(id, data) {
    var tpl = this._templates[id];
    if (!tpl) return '';
    // 支持编辑器覆盖
    if (typeof P !== 'undefined' && P.promptOverrides && P.promptOverrides[id]) {
      tpl = P.promptOverrides[id];
    }
    return tpl.replace(/\{\{([^}]+)\}\}/g, function(match, key) {
      if (data.hasOwnProperty(key)) {
        var val = data[key];
        return (val === null || val === undefined) ? '' : String(val);
      }
      return ''; // 未提供的占位符替换为空
    });
  },
  /** 条件段——仅当condition为真时包含内容 */
  conditional: function(condition, content) {
    return condition ? content : '';
  },
  /** 列出所有已注册模板 */
  list: function() { return Object.keys(this._templates); }
};

// ============================================================
//  1.7.4 AI 请求队列（C1/C2：并发控制 + 节流 + 优先级）
// ============================================================
//   同一时刻最多 maxConcurrent 个请求在途，相邻请求间至少间隔 minInterval ms
//   优先级：critical > high > normal > low（数值越小越优先）
//   外部通过 _aiQueue.enqueue(task, priority) 提交，返回 Promise
var _aiQueue = (function() {
  var queue = []; // [{task, priority, resolve, reject, seq}]
  var inflight = 0;
  var inflightByPriority = { critical: 0, high: 0, normal: 0, low: 0, background: 0 };
  var lastDispatch = 0;
  var seqCounter = 0;
  var _aiQueueHealth = {
    recent: [],
    cooldownUntil: 0,
    lastFailureAt: 0,
    successes: 0,
    failures: 0
  };
  function recordResult(ok, err) {
    var now = Date.now();
    _aiQueueHealth.recent.push({ ok: !!ok, at: now, status: err && (err.status || err.statusCode || 0) });
    if (_aiQueueHealth.recent.length > 20) _aiQueueHealth.recent.shift();
    if (ok) _aiQueueHealth.successes++;
    else {
      _aiQueueHealth.failures++;
      _aiQueueHealth.lastFailureAt = now;
      var status = err && (err.status || err.statusCode || 0);
      if (status === 429 || status === 503 || status === 529 || status === 500 || !status) {
        _aiQueueHealth.cooldownUntil = Math.max(_aiQueueHealth.cooldownUntil || 0, now + 45000);
      }
    }
  }
  function _recentFailureRate() {
    var recent = _aiQueueHealth.recent;
    if (!recent.length) return 0;
    var fails = recent.filter(function(x) { return !x.ok; }).length;
    return fails / recent.length;
  }
  function _adaptiveMaxConcurrent(base, p) {
    var raw = parseInt(p.adaptiveMaxConcurrent, 10);
    if (isNaN(raw)) raw = 8;   // 速度批一2026-07-21·自适应并发默认开(健康时3→8·失败率>15%/429冷却自动回落base)·显式设0=关闭
    if (!raw || raw <= base) return base;
    var cap = Math.max(base, Math.min(raw, 8));
    var now = Date.now();
    if ((_aiQueueHealth.cooldownUntil || 0) > now) return base;
    if (_recentFailureRate() > 0.15) return base;
    if (_aiQueueHealth.recent.length < 6) return Math.min(cap, base + 1);
    return cap;
  }
  function getConf() {
    var p = (typeof P !== 'undefined' && P.ai) ? P.ai : {};
    var baseMax = Math.max(1, parseInt(p.maxConcurrent) || 3);
    return {
      maxConcurrent: _adaptiveMaxConcurrent(baseMax, p),
      backgroundMaxConcurrent: Math.max(1, parseInt(p.backgroundMaxConcurrent) || 1),
      minInterval: Math.max(0, parseInt(p.minInterval) || 300)
    };
  }
  var priorityRank = { critical: 0, high: 1, normal: 2, low: 3, background: 4 };
  function _priorityOf(item) {
    return item && priorityRank[item.priority] != null ? item.priority : 'normal';
  }
  function _isBackgroundPriority(priority) {
    return priority === 'low' || priority === 'background';
  }
  function _backgroundInflight() {
    return (inflightByPriority.low || 0) + (inflightByPriority.background || 0);
  }
  function _hasForegroundWaiting() {
    return queue.some(function(item) {
      return !_isBackgroundPriority(_priorityOf(item));
    });
  }
  function _canStartQueuedItem(item, conf) {
    var pri = _priorityOf(item);
    if (!_isBackgroundPriority(pri)) return true;
    if (_backgroundInflight() >= conf.backgroundMaxConcurrent) return false;
    // Keep at least one lane open when foreground work is waiting.
    if (_hasForegroundWaiting() && inflight >= Math.max(0, conf.maxConcurrent - 1)) return false;
    return true;
  }
  function _aiQueuePickNext(conf) {
    queue.sort(function(a, b) {
      var pa = priorityRank[_priorityOf(a)];
      var pb = priorityRank[_priorityOf(b)];
      if (pa !== pb) return pa - pb;
      return a.seq - b.seq;
    });
    for (var i = 0; i < queue.length; i++) {
      if (_canStartQueuedItem(queue[i], conf)) {
        return queue.splice(i, 1)[0];
      }
    }
    return null;
  }
  function pump() {
    var conf = getConf();
    while (queue.length > 0 && inflight < conf.maxConcurrent) {
      var now = Date.now();
      var wait = lastDispatch + conf.minInterval - now;
      if (wait > 0) {
        setTimeout(pump, wait + 10);
        return;
      }
      var item = _aiQueuePickNext(conf);
      if (!item) return;
      var itemPriority = _priorityOf(item);
      inflight++;
      inflightByPriority[itemPriority] = (inflightByPriority[itemPriority] || 0) + 1;
      lastDispatch = Date.now();
      (function(activeItem, activePriority) {
        Promise.resolve().then(activeItem.task).then(function(res) {
          recordResult(true);
          inflight--;
          inflightByPriority[activePriority] = Math.max(0, (inflightByPriority[activePriority] || 1) - 1);
          activeItem.resolve(res);
          pump();
        }).catch(function(err) {
          recordResult(false, err);
          inflight--;
          inflightByPriority[activePriority] = Math.max(0, (inflightByPriority[activePriority] || 1) - 1);
          activeItem.reject(err);
          pump();
        });
      })(item, itemPriority);
    }
  }
  return {
    enqueue: function(task, priority) {
      return new Promise(function(resolve, reject) {
        queue.push({ task: task, priority: priority || 'normal', resolve: resolve, reject: reject, seq: seqCounter++ });
        pump();
      });
    },
    stats: function() { return { inflight: inflight, byPriority: Object.assign({}, inflightByPriority), queued: queue.length, conf: getConf(), health: Object.assign({}, _aiQueueHealth, { recent: _aiQueueHealth.recent.slice() }) }; }
  };
})();

// ============================================================
//  1.7.46 Provider 检测 + 通用 API 缓存适配（S4）
//  支持 8+ 家 API 的 prompt caching：Anthropic/OpenAI/DeepSeek/Qwen/Moonshot/GLM/Gemini/OpenRouter
// ============================================================
function _detectAIProvider() {
  var url = ((typeof P !== 'undefined' && P.ai && P.ai.url) || '').toLowerCase();
  var model = ((typeof P !== 'undefined' && P.ai && P.ai.model) || '').toLowerCase();
  if (url.indexOf('anthropic') >= 0 || /claude/.test(model)) return 'anthropic';
  if (url.indexOf('deepseek') >= 0) return 'deepseek';
  if (url.indexOf('dashscope') >= 0 || url.indexOf('aliyuncs') >= 0 || /^qwen/.test(model)) return 'qwen';
  if (url.indexOf('moonshot') >= 0 || /kimi|moonshot/.test(model)) return 'moonshot';
  if (url.indexOf('bigmodel') >= 0 || url.indexOf('zhipu') >= 0 || /^glm/.test(model)) return 'glm';
  if (url.indexOf('generativelanguage') >= 0 || url.indexOf('vertex') >= 0 || /gemini/.test(model)) return 'gemini';
  if (url.indexOf('openrouter') >= 0) return 'openrouter';
  if (url.indexOf('openai') >= 0 || /gpt-/.test(model)) return 'openai';
  return 'openai_compat';
}

// 缓存命中统计
var _aiCacheStats = { hits: 0, misses: 0, savedTokens: 0, writeTokens: 0 };
function _recordCacheStats(usage) {
  if (!usage) return;
  var cached = usage.cache_read_input_tokens || (usage.prompt_tokens_details && usage.prompt_tokens_details.cached_tokens) || usage.prompt_cache_hit_tokens || 0;
  var written = usage.cache_creation_input_tokens || 0;
  if (cached > 0) { _aiCacheStats.hits++; _aiCacheStats.savedTokens += cached; }
  else _aiCacheStats.misses++;
  _aiCacheStats.writeTokens += written;
}

// 2026-06-16·走中转的 Claude 也打 cache_control 后的安全网：
//   个别代理不认 cache_control 字段会回 400。撞到就由 _aiFetchWithRetryInner 脱字段重试一次，
//   并把本会话停用闸置位（_maybeCacheSys / buildCachedMessages 读它），之后整局不再打标记，自愈不复发。
var _aiCacheCtrlDisabled = false;
// 把 body.messages 里「带 cache_control 的数组型 content」拍回纯字符串·返回是否真剥离了（仅动含 cache_control 的，真·多模态数组不碰）
function _stripCacheControlFromBody(body) {
  if (!body || !Array.isArray(body.messages)) return false;
  var stripped = false;
  for (var i = 0; i < body.messages.length; i++) {
    var m = body.messages[i];
    if (m && Array.isArray(m.content) && m.content.some(function(b){ return b && b.cache_control; })) {
      m.content = m.content.map(function(b){ return (b && typeof b.text === 'string') ? b.text : ''; }).join('');
      stripped = true;
    }
  }
  return stripped;
}

/**
 * 构建缓存友好的 messages：字节级前缀稳定·变动内容在尾部
 * @param {string} sysStable - 稳定的 system prompt（整局几乎不变·世界设定/官制等）
 * @param {string} sysVariable - 本回合变动的 system prompt（日期/数值/directives）
 * @param {string|Array} userContent - 用户消息
 * @returns {Array} messages 数组
 */
function buildCachedMessages(sysStable, sysVariable, userContent) {
  var provider = _detectAIProvider();
  sysStable = sysStable || '';
  sysVariable = sysVariable || '';
  // Anthropic：显式 cache_control
  if (provider === 'anthropic') {
    var sysBlocks = [];
    if (sysStable) sysBlocks.push({ type: 'text', text: sysStable, cache_control: { type: 'ephemeral' } });
    if (sysVariable) sysBlocks.push({ type: 'text', text: sysVariable });
    return [
      { role: 'system', content: sysBlocks.length ? sysBlocks : '' },
      { role: 'user', content: userContent }
    ];
  }
  // 其他（OpenAI/DeepSeek/Qwen/Moonshot/GLM/OpenRouter）：自动前缀缓存·字节级一致即可
  return [
    { role: 'system', content: sysStable + (sysVariable ? '\n\n' + sysVariable : '') },
    { role: 'user', content: userContent }
  ];
}

// sysStable 字节稳定性保证：同回合所有 sub-call 共享相同实例
var _cachedSysStableMap = { hash: '', content: '', turn: -1 };
function getCachedSysStable(buildFn) {
  var curTurn = (typeof GM !== 'undefined' && GM.turn) || 0;
  // 同回合直接命中
  if (_cachedSysStableMap.turn === curTurn && _cachedSysStableMap.content) return _cachedSysStableMap.content;
  // 重建
  var content = '';
  try { content = buildFn ? buildFn() : ''; } catch(_e) { content = ''; }
  _cachedSysStableMap = { hash: '', content: content, turn: curTurn };
  return content;
}

// ============================================================
//  1.7.47 XML Prompt 构建器（方向 14）
//  结构化记忆/NPC心声/墓志铭等注入·AI 解析速度 3-5x
// ============================================================
function _escXML(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}
/** 快速构建 <tag>body</tag> */
function xml(name, body) { return '<' + name + '>' + (body == null ? '' : body) + '</' + name + '>'; }

// ============================================================
//  1.7.48 时间三位一体（方向 15）
//  所有记忆条目自动携带 turn + eraLabel + relativeToNow
// ============================================================

// ============================================================
//  1.7.45 Token 粗估计数（C3：中英文混合）
//  中文字符 ≈ 1.3 token/字，英文/数字/符号 ≈ 0.25 token/字符
//  Claude/GPT 的真实 tokenization 不同，此函数用于预警而非精确计量
// ============================================================
function estimateTokens(text) {
  if (!text) return 0;
  var s = String(text);
  var cjk = 0, other = 0;
  for (var i = 0; i < s.length; i++) {
    var code = s.charCodeAt(i);
    if (code >= 0x4E00 && code <= 0x9FFF) cjk++;
    else if (code >= 0x3040 && code <= 0x30FF) cjk++;
    else other++;
  }
  return Math.ceil(cjk * 1.3 + other * 0.25);
}
/**
 * 根据模型上下文窗口估算可用 prompt token 预算
 * 返回 { contextK, budget, warn80, warn95 }
 */
function getPromptBudget() {
  var cp = (typeof getCompressionParams === 'function') ? getCompressionParams() : { contextK: 32 };
  var contextK = cp.contextK || 32;
  // 留 1/4 给响应+缓冲
  var budget = Math.floor(contextK * 1024 * 0.75);
  return { contextK: contextK, budget: budget, warn80: Math.floor(budget * 0.8), warn95: Math.floor(budget * 0.95) };
}
/**
 * 检查 prompt 是否接近预算，超 80% 返回 'warn'，超 95% 返回 'critical'，否则返回 'ok'
 * 可选的 onWarn 回调用于 UI 反馈
 */
function checkPromptTokenBudget(promptText, onWarn) {
  var tokens = estimateTokens(promptText);
  var bg = getPromptBudget();
  var status = 'ok';
  if (tokens > bg.warn95) status = 'critical';
  else if (tokens > bg.warn80) status = 'warn';
  if (status !== 'ok' && typeof onWarn === 'function') {
    try { onWarn(status, tokens, bg); } catch(_e) {}
  }
  if (status !== 'ok' && typeof console !== 'undefined') {
    console.warn('[TokenBudget] ' + status + ' estimated=' + tokens + ' budget=' + bg.budget + ' contextK=' + bg.contextK);
  }
  return { status: status, tokens: tokens, budget: bg };
}

// ============================================================
//  TM.tokens·诊断/查看接口·控制台与 UI 用
//  TM.tokens.last() / TM.tokens.estimate(text) / TM.tokens.budget()
// ============================================================
(function(g) {
  if (typeof g === 'undefined') return;
  g.TM = g.TM || {};
  g.TM.tokens = g.TM.tokens || {
    /** 估算任意字符串 token 数·中英混合启发式 */
    estimate: function(text) { return estimateTokens(text); },
    /** 查询当前 prompt 预算 */
    budget: function() { return getPromptBudget(); },
    /** 查看上次推演各 sub-call 的 token 估算 */
    last: function() {
      var L = (g.TM && g.TM.lastPromptTokens) || {};
      var keys = Object.keys(L);
      if (!keys.length) return { _empty: '尚未运行推演·先 endTurn 一次' };
      var out = {};
      keys.forEach(function(k) {
        var r = L[k] || {};
        var pct = r.budget > 0 ? (r.tokens / r.budget * 100).toFixed(1) : '?';
        out[k] = r.tokens + ' tokens·' + pct + '%·' + (r.status || 'ok') + (r.ts ? '·' + new Date(r.ts).toLocaleTimeString() : '');
      });
      return out;
    },
    /** 直接 check 一段文本是否超预算 */
    check: function(text) { return checkPromptTokenBudget(text); },
    /** 注册 toast 之外的额外通知 sink·自动接管 onWarn 回调 */
    onWarn: null
  };
})(typeof window !== 'undefined' ? window : this);

// ============================================================
//  1.7.5 AI 调用基础设施（重试 + 超时 + 429 处理 + raw 保留）
// ============================================================
var _aiLastRaw = { url: '', body: null, response: null, error: null, ts: 0 };
/**
 * 统一的 AI fetch 包装：3 次指数退避重试、180s 超时、429 读取 Retry-After、原始响应保留供 debug。
 * 返回已解析的 JSON。抛出时 error.lastRaw 含现场信息。
 */
async function _aiFetchWithRetry(url, body, signal, opts) {
  opts = opts || {};
  var priority = opts.priority || 'normal';
  // 所有 AI 调用走队列，受全局 maxConcurrent + minInterval 约束
  return _aiQueue.enqueue(function() {
    return _aiFetchWithRetryInner(url, body, signal, opts);
  }, priority);
}

// 第三刀·超时按输出体量分级：只放宽不收紧（小请求维持 180s 零回归，大输出 sc1 等放宽到 600s 上限）。
// 依据：生成 N 个 output token 约需 N×(20~40ms)，2 万 token 的 sc1 在慢模型/高负载第三方代理下 180s 根本不够，
// 一超时就被原样重发，正是 retry 风暴的根源。调用方显式传 opts.timeoutMs 时一律尊重。
function _aiComputeTimeout(maxTok, optsTimeoutMs) {
  if (optsTimeoutMs != null) return optsTimeoutMs;
  var t = Number(maxTok) || 2000;
  return Math.min(200000, Math.max(30000, Math.round(t * 15)));
}

async function _aiFetchWithRetryInner(url, body, signal, opts) {
  opts = opts || {};
  var maxRetries = (opts.maxRetries != null) ? opts.maxRetries : 3;
  var timeoutMs = _aiComputeTimeout(body && body.max_tokens, opts.timeoutMs);
  // M3·优先用 opts.apiKey（次 API 调用传入）·否则回退 primary
  var key = opts.apiKey || P.ai.key;
  var lastError = null;
  var _ccStripped = false;   // cache_control 撞 400 脱字段重试·每请求只脱一次
  // 粗估 token 预算（仅警告，不截断：截断是调用方的职责）
  try {
    if (body && body.messages && typeof checkPromptTokenBudget === 'function') {
      var _combined = body.messages.map(function(m) { return (m && m.content) || ''; }).join('\n');
      checkPromptTokenBudget(_combined);
    }
  } catch(_tkE) {}
  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    var ctrl = new AbortController();
    var timedOut = false;
    var aborter = function() { timedOut = true; ctrl.abort(); };
    var timer = setTimeout(aborter, timeoutMs);
    if (signal) {
      if (signal.aborted) { clearTimeout(timer); throw new Error('Aborted'); }
      signal.addEventListener('abort', aborter);
    }
    try {
      var resp = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify(body),
        signal: ctrl.signal
      });
      clearTimeout(timer);
      // 429 速率限制：读 Retry-After 延迟
      if (resp.status === 429 && attempt < maxRetries) {
        var retryAfter = parseInt(resp.headers.get('Retry-After') || '0', 10);
        var delay429 = (retryAfter > 0) ? retryAfter * 1000 : Math.min(30000, 1000 * Math.pow(2, attempt));
        console.warn('[AI] 429 速率限制，等待 ' + delay429 + 'ms 后重试 (' + (attempt+1) + '/' + maxRetries + ')');
        await new Promise(function(r) { setTimeout(r, delay429); });
        continue;
      }
      if (!resp.ok) {
        var errText = '';
        try { errText = await resp.text(); } catch(_e) {}
        lastError = new Error('HTTP ' + resp.status + (errText ? ': ' + errText.substring(0, 300) : ''));
        lastError.status = resp.status;
        _aiLastRaw = { url: url, body: body, response: errText, error: lastError.message, ts: Date.now() };
        // 400 且本请求带了 cache_control → 大概率中转代理不认该字段：脱掉 cache_control 就地重试一次，
        //   并本会话停用缓存标记（防每回合都先撞一次 400）。仅脱一次，避免无限重试。
        if (resp.status === 400 && !_ccStripped && _stripCacheControlFromBody(body)) {
          _ccStripped = true;
          _aiCacheCtrlDisabled = true;
          console.warn('[AI] 400 且请求含 cache_control·疑代理不认·已脱字段重试并本会话停用 prompt 缓存标记');
          continue;
        }
        // 5xx 可重试；4xx（除 429）不重试
        if (resp.status >= 500 && attempt < maxRetries) {
          await new Promise(function(r) { setTimeout(r, 1000 * Math.pow(2, attempt)); });
          continue;
        }
        throw lastError;
      }
      var data = await resp.json();
      _aiLastRaw = { url: url, body: body, response: data, error: null, ts: Date.now() };
      // 记录缓存命中统计
      if (data && data.usage && typeof _recordCacheStats === 'function') _recordCacheStats(data.usage);
      return data;
    } catch(e) {
      clearTimeout(timer);
      lastError = e;
      // 外部 signal 主动中断——不重试
      if (signal && signal.aborted) throw e;
      // 第三刀·防重试风暴：本地超时（timer 触发）原样重发大概率再次超时，白等一整个超时周期 + 翻倍 token 费用。
      //   大请求（maxTok>8000，如 sc1）超时 → 立即放弃，不在 fetch 层重发；小请求最多再试一次。
      if (timedOut) {
        var _bigReq = !!(body && body.max_tokens && body.max_tokens > 8000);
        if (_bigReq || attempt >= 1) {
          if (!e.lastRaw) e.lastRaw = _aiLastRaw;
          throw e;
        }
      }
      // 网络错误 / 小请求首次超时——指数退避重试
      if (attempt < maxRetries) {
        var delayRetry = 1000 * Math.pow(2, attempt);
        console.warn('[AI] 第 ' + (attempt+1) + ' 次尝试失败: ' + (e.message || e) + '，' + delayRetry + 'ms 后重试');
        await new Promise(function(r) { setTimeout(r, delayRetry); });
      } else {
        // 挂载最后的原始响应
        if (!e.lastRaw) e.lastRaw = _aiLastRaw;
        throw e;
      }
    }
  }
  throw lastError || new Error('_aiFetchWithRetry: 重试耗尽');
}

// ============================================================
// 失败态人话化（2026-07-02）：把 AI 调用的技术性报错翻成「哪坏了 + 该去哪修」的人话。
//   此前过回合/探测失败直接把 error.message 甩给玩家（HTTP 401: {"error"...}），新手无从下手。
//   分类不出返回 null → 调用方回退原文（不吞信息）。挂 window 供过回合/设置探测等出错兜底共用。
// ============================================================
function _tmAiErrHuman(err) {
  try {
    var msg = String((err && err.message) || err || '');
    var m = msg.match(/HTTP (\d{3})/);
    var status = (err && err.status) || (m ? +m[1] : 0);
    if (/API未配置|API地址未配置|未配置可用 API|未配置 API key/.test(msg)) return '尚未配置 AI 密钥或接口地址——请到「设置 → AI · 模型」填写 API 地址、模型名与密钥。';
    if (status === 401 || /invalid[ _]?api[ _]?key|incorrect api key|unauthorized|authentication/i.test(msg)) return 'AI 密钥无效或已过期（401）——请到「设置 → AI · 模型」核对密钥是否填对、是否仍有效。';
    if (status === 402 || /insufficient_quota|insufficient balance|exceeded your current quota|欠费|余额不足|quota/i.test(msg)) return 'AI 账户额度不足或欠费——请前往所用 API 平台查看余额充值，或更换密钥。';
    if (status === 403) return 'AI 接口拒绝访问（403）——密钥无权调用该模型，或所在网络/中转不被允许；请核对模型权限或更换中转。';
    if (status === 404 || /model.{0,20}(not.{0,8}found|does not exist)|无此模型/i.test(msg)) return '接口路径或模型名不存在（404）——请到「设置 → AI · 模型」核对 API 地址与模型名拼写。';
    if (status === 429 || /rate.?limit|too many requests/i.test(msg)) return 'AI 接口限速（429）且重试后仍被拒——稍候片刻再试；频繁出现可换中转或升级所用平台套餐。';
    if (status >= 500) return 'AI 服务端故障（' + status + '）——对方服务器暂时不稳，稍候重试；反复出现可更换中转或改用官方接口。';
    if ((err && err.name === 'AbortError') || /\babort/i.test(msg) || /timeout|超时/i.test(msg)) return 'AI 响应超时——网络不稳或模型推理过慢；可稍候重试，或到「设置」换更快的模型/中转。';
    if (!status && /failed to fetch|networkerror|network error|load failed/i.test(msg)) return '网络不可达——连不上 AI 接口；请检查网络连接与「设置」中的 API 地址（部分接口需中转可达）。';
    if (/unexpected token|unexpected end of json|json 解析|截断/i.test(msg)) return 'AI 返回内容解析失败——多为模型太弱或输出被截断；建议换更强模型（本作主推演需单次输出 ≥8K）。';
    return null;
  } catch (_e) { return null; }
}
if (typeof window !== 'undefined') window._tmAiErrHuman = _tmAiErrHuman;

// ============================================================
// M3.1·次 API(secondary) 网络不可达 → 自动回退主 API(primary)
//   规则(owner)：这几个子系统「优先次要 API，没有/不可用则走主 API」。
//   _getAITier 已处理「secondary 未配 → 用 primary」；这里补「secondary 配了但连不上」一档。
//   仅对「网络层不可达」(连接拒绝/DNS/Failed to fetch) 触发；不对 HTTP 4xx/5xx 或主动 abort 触发——
//   那类失败换主 API 未必能解，且会掩盖真实配置错误。
// ============================================================
function _isAINetworkError(e) {
  if (!e) return false;
  if (e.name === 'AbortError') return false;   // 主动中断，不回退
  if (e.status) return false;                  // 有 HTTP 状态码 = 服务器已应答，不回退
  var msg = String((e && e.message) || e || '');
  return e.name === 'TypeError' ||             // fetch 网络层失败典型为 TypeError: Failed to fetch
    /Failed to fetch|NetworkError|ERR_CONNECTION|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|fetch failed/i.test(msg);
}
// 本次 tier 参数是否「实际解析为 secondary」(secondary 已配置且启用)·只有此时回退才有意义
function _aiEffectiveTierIsSecondary(tier) {
  if (tier !== 'secondary') return false;
  try { if (typeof _getAITier === 'function') return _getAITier('secondary').tier === 'secondary'; } catch(_) {}
  return false;
}

/**
 * 基础 AI 调用
 * @param {string} prompt - 提示词
 * @param {number} [maxTok=2000] - 最大 token
 * @param {AbortSignal} [signal] - 中断信号
 * @returns {Promise<string>} AI 响应文本
 */
async function callAI(prompt,maxTok,signal,tier,opts){
  if (tier && typeof tier === 'object') {
    opts = tier;
    tier = opts.tier;
  }
  opts = opts || {};
  // M3.1·次 API 走 secondary 且网络不可达 → 自动回退主 API 重试一次（_noSecFallback 防递归）
  if (_aiEffectiveTierIsSecondary(tier) && !opts._noSecFallback) {
    var _o = Object.assign({}, opts, { _noSecFallback: true });
    try { return await callAI(prompt, maxTok, signal, 'secondary', _o); }
    catch (e) {
      if (_isAINetworkError(e)) { console.warn('[AI] 次 API 不可达·回退主 API: ' + ((e && e.message) || e)); return await callAI(prompt, maxTok, signal, 'primary', _o); }
      throw e;
    }
  }
  // M3·按 tier 取配置·secondary 未配回退 primary·防御 _getAITier 未定义
  var _aiCfg = null;
  try { if (typeof _getAITier === 'function') _aiCfg = _getAITier(tier); } catch(_){}
  if (!_aiCfg) _aiCfg = { key: (P.ai&&P.ai.key)||'', url: (P.ai&&P.ai.url)||'', model: (P.ai&&P.ai.model)||'gpt-4o' };
  var key=_aiCfg.key || (P.ai&&P.ai.key) || '';if(!key)throw new Error("API\u672A\u914D\u7F6E");
  var url = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(tier) : _buildAIUrl();
  if(!url)throw new Error("API\u5730\u5740\u672A\u914D\u7F6E");
  var _scaledTok = Math.round((maxTok||2000) * ((typeof getCompressionParams==='function') ? Math.max(1.0, getCompressionParams().scale) : 1.0));
  var body = { model: _aiCfg.model || (P.ai&&P.ai.model) || "gpt-4o", messages:[{role:"user",content:prompt}], temperature: P.ai.temp||0.8, max_tokens: _scaledTok };
  var fetchOpts = { apiKey: key, priority: opts.priority || 'normal' };
  if (opts.timeoutMs != null) fetchOpts.timeoutMs = opts.timeoutMs;
  if (opts.maxRetries != null) fetchOpts.maxRetries = opts.maxRetries;
  var data = await _aiFetchWithRetry(url, body, signal, fetchOpts);
  // Phase 7·补 id 参数·byId 拆分
  if(data.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data.usage, opts.id || 'callAI:generic');
  if(data.choices&&data.choices[0]&&data.choices[0].message)return data.choices[0].message.content;
  if(data.content&&Array.isArray(data.content))return data.content.map(function(b){return b.text||"";}).join("");
  return "";
}

/**
 * Wave 2 · tool_use 强约束调用·全 API 兼容
 * 让 AI 必须以结构化 tool_call 输出·消除"narrative 与 JSON 不一致"根因
 *
 * 兼容策略 (3 路径)：
 *   1. Anthropic 原生 (api.anthropic.com)            → tools[].input_schema + tool_choice
 *   2. Gemini 原生 (generativelanguage·非 OpenAI 兼容) → tools[].functionDeclarations
 *   3. OpenAI 兼容 (其他全部·含 OpenAI/DeepSeek/Qwen/Moonshot/GLM/OpenRouter/Gemini-OAI 兼容路径)
 *      → tools[{type:'function',function:{name,description,parameters}}] + tool_choice
 *   X. 任意路径失败 → 自动 fallback：将 schema 注入 prompt·让 AI 直接返回 JSON·解析后映射回 toolCalls
 *
 * @param {string} prompt - 提示词
 * @param {Array<{name:string, description:string, parameters:object}>} tools - 工具定义（JSON Schema parameters）
 * @param {{maxTok?:number, signal?:AbortSignal, tier?:string, forceTool?:string, allowText?:boolean}} [opts]
 * @returns {Promise<{text:string, toolCalls:Array<{name:string,input:object}>, fallback?:boolean}>}
 *   - text: AI 文本输出（如有）
 *   - toolCalls: 解析后的工具调用列表·每项 {name, input(parsed object)}
 *   - fallback: true 表示走了文本→JSON 解析路径
 */
async function callAIWithTools(prompt, tools, opts) {
  opts = opts || {};
  if (!Array.isArray(tools) || tools.length === 0) {
    var _t0 = await callAI(prompt, opts.maxTok || 2000, opts.signal, opts.tier, { priority: opts.priority || 'normal', timeoutMs: opts.timeoutMs, maxRetries: opts.maxRetries });
    return { text: _t0 || '', toolCalls: [] };
  }
  // 取 tier 配置
  var _aiCfg = null;
  try { if (typeof _getAITier === 'function') _aiCfg = _getAITier(opts.tier); } catch(_){}
  if (!_aiCfg) _aiCfg = { key: (P.ai&&P.ai.key)||'', url: (P.ai&&P.ai.url)||'', model: (P.ai&&P.ai.model)||'gpt-4o' };
  var key = _aiCfg.key || (P.ai&&P.ai.key) || '';
  if (!key) throw new Error('API未配置');
  var url = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(opts.tier) : _buildAIUrl();
  if (!url) throw new Error('API地址未配置');
  var provider = (typeof _detectAIProvider === 'function') ? _detectAIProvider() : 'openai_compat';
  var userUrl = (P.ai && P.ai.url) || '';
  // 主次错配修(2026-07-04 审查定罪)：url/key/model 均取自 opts.tier·而族判定曾只看主 API——
  // 主次不同族(如主=Anthropic原生·次=OAI兼容中转)时组错 body/headers 必发一次注定失败的请求再走文本兜底。
  // 次 API 在手即按次 API 的 url/model 判族(中转 claude 语义保留:族=anthropic 但非官方域→仍走 OAI 兼容分支)。
  if (opts.tier === 'secondary' && _aiCfg && (_aiCfg.url || _aiCfg.model)) {
    userUrl = _aiCfg.url || userUrl;
    var _tierModel = String(_aiCfg.model || '');
    if (/api\.anthropic\.com/i.test(userUrl) || /^claude/i.test(_tierModel)) provider = 'anthropic';
    else if (/generativelanguage\.googleapis\.com/i.test(userUrl) || /^gemini/i.test(_tierModel)) provider = 'gemini';
    else provider = 'openai_compat';
  }
  var isAnthropicNative = provider === 'anthropic' && /api\.anthropic\.com/i.test(userUrl);
  // Gemini 原生：用 generateContent 接口（非 /v1beta/openai/）
  var isGeminiNative = provider === 'gemini' && /generativelanguage\.googleapis\.com/i.test(userUrl) && !/\/v1beta\/openai\//i.test(userUrl);
  var maxTok = opts.maxTok || 2000;
  var _scaledTok = Math.round(maxTok * ((typeof getCompressionParams === 'function') ? Math.max(1.0, getCompressionParams().scale) : 1.0));

  // ─── fallback：把 schema 注入 prompt → 普通 callAI → 解析 JSON 映射回 toolCalls ───
  function _fallbackPromptWithSchema() {
    var schemaDesc = '【工具定义】API 不支持 tool_use·请按以下 JSON Schema 直接返回纯 JSON·必须包含 tool_call 字段:\n';
    schemaDesc += '可用工具:\n';
    tools.forEach(function(t) {
      schemaDesc += '- ' + t.name + ': ' + (t.description || '') + '\n';
      schemaDesc += '  参数: ' + JSON.stringify(t.parameters || {}) + '\n';
    });
    schemaDesc += '\n返回格式（必须是纯 JSON·不要 markdown 包裹）:\n';
    schemaDesc += '{"tool_calls":[{"name":"<工具名>","input":{<符合 schema 的参数>}}]}\n';
    if (opts.forceTool) schemaDesc += '\n本次必须使用工具: ' + opts.forceTool + '\n';
    return prompt + '\n\n' + schemaDesc;
  }
  async function _runFallback() {
    try {
      var raw = await callAI(_fallbackPromptWithSchema(), maxTok, opts.signal, opts.tier, { priority: opts.priority || 'normal', timeoutMs: opts.timeoutMs, maxRetries: opts.maxRetries });
      var parsed = null;
      try {
        if (typeof robustParseJSON === 'function') parsed = robustParseJSON(raw);
        else { var m = String(raw||'').match(/\{[\s\S]*\}/); if (m) parsed = JSON.parse(m[0]); }
      } catch(_pe) { console.warn('[callAIWithTools/fallback] JSON 解析失败:', _pe); }
      var calls = [];
      if (parsed && Array.isArray(parsed.tool_calls)) {
        parsed.tool_calls.forEach(function(c) {
          if (c && c.name) calls.push({ name: c.name, input: c.input || c.arguments || {} });
        });
      } else if (parsed && parsed.name && parsed.input) {
        // 兼容单调用形式
        calls.push({ name: parsed.name, input: parsed.input });
      }
      return { text: String(raw||''), toolCalls: calls, fallback: true };
    } catch(_fe) {
      console.warn('[callAIWithTools] fallback 也失败:', _fe);
      return { text: '', toolCalls: [], fallback: true };
    }
  }

  // ─── 构建请求体 + headers·三路径分支 ───
  var body, headers, parseMode;
  if (isAnthropicNative) {
    body = {
      model: _aiCfg.model || (P.ai && P.ai.model) || 'claude-3-5-sonnet-latest',
      max_tokens: _scaledTok,
      messages: [{ role: 'user', content: prompt }],
      tools: tools.map(function(t) {
        return { name: t.name, description: t.description || '', input_schema: t.parameters || { type: 'object', properties: {} } };
      }),
      temperature: (P.ai && P.ai.temp) || 0.7
    };
    body.tool_choice = opts.forceTool ? { type: 'tool', name: opts.forceTool } : { type: 'any' };
    headers = { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' };
    parseMode = 'anthropic';
  } else if (isGeminiNative) {
    // Gemini 原生：URL 通常已带 :generateContent·key 在 query 串
    body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      tools: [{ functionDeclarations: tools.map(function(t) {
        return { name: t.name, description: t.description || '', parameters: t.parameters || { type: 'object', properties: {} } };
      })}],
      generationConfig: { temperature: (P.ai && P.ai.temp) || 0.7, maxOutputTokens: _scaledTok }
    };
    if (opts.forceTool) {
      body.toolConfig = { functionCallingConfig: { mode: 'ANY', allowedFunctionNames: [opts.forceTool] } };
    } else {
      body.toolConfig = { functionCallingConfig: { mode: 'ANY' } };
    }
    headers = { 'Content-Type': 'application/json' };
    // Gemini key 通常在 URL ?key=···否则用 x-goog-api-key header
    if (!/[?&]key=/i.test(url)) headers['x-goog-api-key'] = key;
    parseMode = 'gemini';
  } else {
    // OpenAI 兼容（含 OpenRouter / DeepSeek / Qwen / Moonshot / GLM / Gemini-OAI 兼容路径）
    body = {
      model: _aiCfg.model || (P.ai && P.ai.model) || 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
      temperature: (P.ai && P.ai.temp) || 0.7,
      max_tokens: _scaledTok,
      tools: tools.map(function(t) {
        return {
          type: 'function',
          function: {
            name: t.name,
            description: t.description || '',
            parameters: t.parameters || { type: 'object', properties: {} }
          }
        };
      })
    };
    if (opts.forceTool) body.tool_choice = { type: 'function', function: { name: opts.forceTool } };
    else body.tool_choice = 'auto';  // 多数兼容 API 不识别 'required'·用 auto + 内 prompt 强调
    headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key };
    parseMode = 'openai';
  }
  // ─── 调用（自带 abort+timeout·不走 _aiFetchWithRetry 因为 header 不一定 Bearer） ───
  var data;
  async function _toolFetchQueued() {
    var ctrl = new AbortController();
    var timer = setTimeout(function() { ctrl.abort(); }, (opts.timeoutMs != null ? opts.timeoutMs : 180000));
    if (opts.signal && opts.signal.aborted) { clearTimeout(timer); throw new Error('Aborted'); } // 已置位的 signal 监听器永不触发·排队期被取消的请求曾照常发出白烧token(2026-07-04 审查定罪)
    if (opts.signal) opts.signal.addEventListener('abort', function() { ctrl.abort(); });
    try {
      var resp = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal });
      if (!resp.ok) {
        var errT = '';
        try { errT = await resp.text(); } catch(_){ }
        console.warn('[callAIWithTools] HTTP ' + resp.status + ' (parseMode=' + parseMode + '): ' + errT.substring(0, 200));
        var err = new Error('HTTP ' + resp.status);
        err.status = resp.status;
        err.toolFallback = true;
        throw err;
      }
      return await resp.json();
    } finally {
      clearTimeout(timer);
    }
  }
  try {
    if (typeof _aiQueue !== 'undefined' && _aiQueue && typeof _aiQueue.enqueue === 'function') {
      data = await _aiQueue.enqueue(_toolFetchQueued, opts.priority || 'normal');
    } else {
      data = await _toolFetchQueued();
    }
  } catch(e) {
    try { if (typeof timer !== 'undefined') clearTimeout(timer); } catch(_) {}
    console.warn('[callAIWithTools] fetch 异常·走 fallback:', e && e.message || e);
    return await _runFallback();
  }
  if (data && data.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data.usage, (opts && opts.id) || 'callAIWithTools');
  // ─── 解析响应·三路径分支 ───
  var text = '';
  var toolCalls = [];
  try {
    if (parseMode === 'anthropic') {
      if (Array.isArray(data.content)) {
        data.content.forEach(function(b) {
          if (b.type === 'text' && b.text) text += b.text;
          else if (b.type === 'tool_use' && b.name) toolCalls.push({ name: b.name, input: b.input || {} });
        });
      }
    } else if (parseMode === 'gemini') {
      // data.candidates[0].content.parts = [{text}, {functionCall:{name,args}}]
      if (data.candidates && data.candidates[0] && data.candidates[0].content && Array.isArray(data.candidates[0].content.parts)) {
        data.candidates[0].content.parts.forEach(function(p) {
          if (p.text) text += p.text;
          if (p.functionCall && p.functionCall.name) toolCalls.push({ name: p.functionCall.name, input: p.functionCall.args || {} });
        });
      }
    } else {
      // OpenAI 兼容
      if (data.choices && data.choices[0] && data.choices[0].message) {
        var msg = data.choices[0].message;
        if (msg.content) text = msg.content;
        if (Array.isArray(msg.tool_calls)) {
          msg.tool_calls.forEach(function(tc) {
            var fn = tc.function || {};
            var input = {};
            try { input = JSON.parse(fn.arguments || '{}'); }
            catch(_pe) { console.warn('[callAIWithTools] tool_call arguments JSON 解析失败:', fn.arguments); }
            if (fn.name) toolCalls.push({ name: fn.name, input: input });
          });
        }
        // 兼容某些代理把 function_call (单数·OpenAI 旧字段) 当作 tool_use 返回
        if (toolCalls.length === 0 && msg.function_call && msg.function_call.name) {
          var _inp = {};
          try { _inp = JSON.parse(msg.function_call.arguments || '{}'); } catch(_pe2) {}
          toolCalls.push({ name: msg.function_call.name, input: _inp });
        }
      }
      // 兼容某些代理直接返回 anthropic 风格 content[]·尝试解析
      if (toolCalls.length === 0 && Array.isArray(data.content)) {
        data.content.forEach(function(b) {
          if (b.type === 'text' && b.text) text += b.text;
          else if (b.type === 'tool_use' && b.name) toolCalls.push({ name: b.name, input: b.input || {} });
        });
      }
    }
  } catch(_parseE) {
    console.warn('[callAIWithTools] 响应解析异常·走 fallback:', _parseE);
    return await _runFallback();
  }
  // 如果完全没有 toolCalls 且有 text·尝试从 text 抽取 JSON 作为兜底
  if (toolCalls.length === 0 && text) {
    try {
      var maybeJson = null;
      if (typeof robustParseJSON === 'function') maybeJson = robustParseJSON(text);
      else { var mm = String(text).match(/\{[\s\S]*\}/); if (mm) maybeJson = JSON.parse(mm[0]); }
      if (maybeJson && Array.isArray(maybeJson.tool_calls)) {
        maybeJson.tool_calls.forEach(function(c) { if (c && c.name) toolCalls.push({ name: c.name, input: c.input || {} }); });
      }
    } catch(_textParseE) {}
  }
  // 刀H2(2026-07-02·CC max_tokens 动态调整对照) · 纯增量字段:输出是否被 maxTok 截断(finish_reason)。
  //   调用方(如回合推演 agent)可据此提升输出上限重试;不读该字段的调用方一切如旧。
  var _truncH2 = false;
  try {
    _truncH2 = !!((data.choices && data.choices[0] && (data.choices[0].finish_reason === 'length' || data.choices[0].stop_reason === 'length' || data.choices[0].finish_reason === 'max_tokens'))
      || data.stop_reason === 'max_tokens'
      || (data.candidates && data.candidates[0] && data.candidates[0].finishReason === 'MAX_TOKENS'));
  } catch (_tH2E) {}
  return { text: text, toolCalls: toolCalls, truncated: _truncH2 };
}

/**
 * 智能 AI 调用（自动重试 + 验证）
 * @param {string} prompt
 * @param {number} [maxTok]
 * @param {{minLength?:number, maxRetries?:number, validator?:Function, signal?:AbortSignal}} [options]
 * @returns {Promise<string>}
 */
async function callAISmart(prompt, maxTok, options) {
  options = options || {};
  var minLength = options.minLength || 0; // 期望的最小字符长度
  var maxRetries = (options.maxRetries != null) ? options.maxRetries : 3;
  var validator = options.validator;
  var signal = options.signal;
  var allContent = '';
  var attemptCount = 0;

  async function attemptCall() {
    attemptCount++;
    var currentPrompt = prompt;

    // If we already have some content, tell AI to continue
    if (allContent.length > 0) {
      currentPrompt += '\n\n【已生成内容】\n' + allContent.substring(0, 800) + '...\n\n';
      currentPrompt += '以上内容已生成，请继续补充更多内容（不要重复已有内容，直接继续写）。';
    }

    try {
      var result = await callAI(currentPrompt, maxTok, signal, options.tier, {
        priority: options.priority || 'normal',
        timeoutMs: options.timeoutMs,
        maxRetries: (options.fetchMaxRetries != null) ? options.fetchMaxRetries : 1
      });

      // Append to existing content
      if (allContent.length > 0) {
        allContent += '\n\n' + result;
      } else {
        allContent = result;
      }

      // Check if we have enough content
      if (minLength > 0 && allContent.length < minLength && attemptCount < maxRetries) {
        _dbg('[AI Smart] 内容长度不足 (' + allContent.length + '/' + minLength + ' 字符)，继续调用 AI...');
        return await attemptCall();
      }

      // Custom validator — 兼容 boolean 和 {valid, reason} 两种返回格式
      if (validator) {
        var vResult = validator(allContent);
        var isValid = (typeof vResult === 'boolean') ? vResult : (vResult && vResult.valid);
        if (!isValid && attemptCount < maxRetries) {
          var vReason = (typeof vResult === 'object' && vResult && vResult.reason) ? vResult.reason : '验证未通过';
          _dbg('[AI Smart] 验证失败: ' + vReason + '，重试中...');
          return await attemptCall();
        }
      }

      return allContent;
    } catch(e) {
      if (attemptCount < maxRetries) {
        console.warn('[AI Smart] 调用失败，重试中... (' + attemptCount + '/' + maxRetries + ')');
        await new Promise(function(resolve) { setTimeout(resolve, 1000); }); // Wait 1s before retry
        return await attemptCall();
      } else {
        throw e;
      }
    }
  }

  return await attemptCall();
}
/**
 * 多轮对话 AI 调用
 * @param {Array<{role:string, content:string}>} messages
 * @param {number} [maxTok=500]
 * @param {AbortSignal} [signal]
 * @returns {Promise<string>}
 */
async function callAIMessages(messages,maxTok,signal,tier,opts){
  if (tier && typeof tier === 'object') {
    opts = tier;
    tier = opts.tier;
  }
  opts = opts || {};
  // M3.1·次 API 走 secondary 且网络不可达 → 自动回退主 API 重试一次（_noSecFallback 防递归）
  if (_aiEffectiveTierIsSecondary(tier) && !opts._noSecFallback) {
    var _oM = Object.assign({}, opts, { _noSecFallback: true });
    try { return await callAIMessages(messages, maxTok, signal, 'secondary', _oM); }
    catch (e) {
      if (_isAINetworkError(e)) { console.warn('[AI] 次 API 不可达·回退主 API: ' + ((e && e.message) || e)); return await callAIMessages(messages, maxTok, signal, 'primary', _oM); }
      throw e;
    }
  }
  // M3·按 tier 取配置·secondary 未配回退 primary·防御 _getAITier 未定义
  var _aiCfgM = null;
  try { if (typeof _getAITier === 'function') _aiCfgM = _getAITier(tier); } catch(_){}
  if (!_aiCfgM) _aiCfgM = { key: (P.ai&&P.ai.key)||'', url: (P.ai&&P.ai.url)||'', model: (P.ai&&P.ai.model)||'gpt-4o' };
  var key=_aiCfgM.key || (P.ai&&P.ai.key) || '';if(!key)throw new Error("API\u672A\u914D\u7F6E");
  var url = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(tier) : _buildAIUrl();
  if(!url)throw new Error("API\u5730\u5740\u672A\u914D\u7F6E");
  var _scaledTok2 = Math.round((maxTok||500) * ((typeof getCompressionParams==='function') ? Math.max(1.0, getCompressionParams().scale) : 1.0));
  // S4：Anthropic 自动 cache_control——仅对"原生 Anthropic API"应用数组 content
  //   第三方 Claude 代理（openrouter 等走 /chat/completions）多数要求 content 为字符串·数组格式会 400
  //   故只在 URL 明确为 api.anthropic.com 时才包装数组
  var _provider = (typeof _detectAIProvider === 'function') ? _detectAIProvider() : 'openai_compat';
  var _isNativeAnthropic = (P.ai && P.ai.url && /api\.anthropic\.com/i.test(P.ai.url));
  var _msgs = messages;
  if (_provider === 'anthropic' && _isNativeAnthropic && messages && messages.length > 0) {
    var firstSys = messages[0];
    if (firstSys && firstSys.role === 'system' && typeof firstSys.content === 'string' && firstSys.content.length > 1500) {
      _msgs = messages.slice();
      _msgs[0] = {
        role: 'system',
        content: [{ type: 'text', text: firstSys.content, cache_control: { type: 'ephemeral' } }]
      };
    }
  }
  var body = { model: _aiCfgM.model || (P.ai&&P.ai.model) || "gpt-4o", messages: _msgs, temperature: 0.8, max_tokens: _scaledTok2 };
  var fetchOpts2 = { apiKey: key, priority: opts.priority || 'normal' };
  if (opts.timeoutMs != null) fetchOpts2.timeoutMs = opts.timeoutMs;
  if (opts.maxRetries != null) fetchOpts2.maxRetries = opts.maxRetries;
  var data = await _aiFetchWithRetry(url, body, signal, fetchOpts2);
  if(data.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data.usage, opts.id || 'callAIMessages');
  if(data.choices&&data.choices[0]&&data.choices[0].message)return data.choices[0].message.content;
  if(data.content&&Array.isArray(data.content))return data.content.map(function(b){return b.text||"";}).join("");
  return "";
}

/**
 * 流式 AI 调用（SSE）
 * @param {Array<{role:string, content:string}>} messages
 * @param {number} [maxTok=500]
 * @param {{signal?:AbortSignal, onChunk?:function(string):void, onDone?:function(string):void}} [opts]
 * @returns {Promise<string>} 完整回复
 */
async function _callAIMessagesStreamDirect(messages, maxTok, opts) {
  opts = opts || {};
  // M3.1·次 API 走 secondary 且网络不可达 → 自动回退主 API 重试一次（_noSecFallback 防递归）
  if (_aiEffectiveTierIsSecondary(opts.tier) && !opts._noSecFallback) {
    var _oS = Object.assign({}, opts, { _noSecFallback: true });
    try { return await _callAIMessagesStreamDirect(messages, maxTok, _oS); }
    catch (e) {
      if (_isAINetworkError(e)) { console.warn('[AI] 次 API 不可达·回退主 API: ' + ((e && e.message) || e)); return await _callAIMessagesStreamDirect(messages, maxTok, Object.assign({}, _oS, { tier: 'primary' })); }
      throw e;
    }
  }
  // M3·按 tier 取 API 配置·默认 primary·secondary 未配自动回退（带 try 兜底以防万一）
  var _aiCfg = null;
  try { if (typeof _getAITier === 'function') _aiCfg = _getAITier(opts.tier); } catch(_){}
  if (!_aiCfg) _aiCfg = { key: (P.ai&&P.ai.key)||'', url: (P.ai&&P.ai.url)||'', model: (P.ai&&P.ai.model)||'gpt-4o', tier: 'primary' };
  var key = _aiCfg.key || (P.ai && P.ai.key) || ''; if (!key) throw new Error('API未配置');
  var url = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(opts.tier) : _buildAIUrl();
  if (!url) throw new Error('API地址未配置');
  var ctrl = new AbortController();
  var timer = setTimeout(function() { ctrl.abort(); }, (opts.timeoutMs != null ? opts.timeoutMs : 180000));
  if (opts.signal && opts.signal.aborted) { clearTimeout(timer); throw new Error('Aborted'); } // 同 _toolFetchQueued·已置位预检(2026-07-04 审查定罪)
  if (opts.signal) opts.signal.addEventListener('abort', function() { ctrl.abort(); });
  var _scaledTok = Math.round((maxTok || 500) * ((typeof getCompressionParams === 'function') ? Math.max(1.0, getCompressionParams().scale) : 1.0));
  try {
    // M4·Anthropic cache_control：原生 Anthropic API + sys 足够长 → 加 cache_control 享 90% 折扣
    var _msgsStream = messages;
    try {
      var _providerS = (typeof _detectAIProvider === 'function') ? _detectAIProvider() : '';
      var _isNativeS = (P.ai && P.ai.url && /api\.anthropic\.com/i.test(P.ai.url));
      if (_providerS === 'anthropic' && _isNativeS && messages && messages.length > 0) {
        var _firstS = messages[0];
        if (_firstS && _firstS.role === 'system' && typeof _firstS.content === 'string' && _firstS.content.length > 1500) {
          _msgsStream = messages.slice();
          _msgsStream[0] = { role: 'system', content: [{ type: 'text', text: _firstS.content, cache_control: { type: 'ephemeral' } }] };
        }
      }
    } catch(_cE) {}
    var _bodyCore = {
      model: (_aiCfg && _aiCfg.model) || (P.ai && P.ai.model) || 'gpt-4o', messages: _msgsStream,
      temperature: (opts.temperature !== undefined) ? opts.temperature : (P.ai.temp || 0.8),
      max_tokens: _scaledTok, stream: true
    };
    if (opts.extraBody) Object.assign(_bodyCore, opts.extraBody);
    var resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
      body: JSON.stringify(_bodyCore),
      signal: ctrl.signal
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    // 非流式回退（部分代理不支持stream）
    var ct = resp.headers.get('content-type') || '';
    if (ct.indexOf('application/json') >= 0) {
      var data = await resp.json();
      var txt = '';
      if (data.choices && data.choices[0] && data.choices[0].message) txt = data.choices[0].message.content;
      if (opts.onChunk) opts.onChunk(txt);
      if (opts.onDone) opts.onDone(txt);
      return txt;
    }
    // SSE 流式读取
    var reader = resp.body.getReader();
    var decoder = new TextDecoder();
    var buffer = '';
    var full = '';
    while (true) {
      var _r = await reader.read();
      if (_r.done) break;
      buffer += decoder.decode(_r.value, { stream: true });
      var lines = buffer.split('\n');
      buffer = lines.pop() || '';
      for (var i = 0; i < lines.length; i++) {
        var line = lines[i].trim();
        if (!line || !line.startsWith('data:')) continue;
        var payload = line.slice(5).trim();
        if (payload === '[DONE]') continue;
        try {
          var chunk = JSON.parse(payload);
          var delta = '';
          // OpenAI / compatible format
          if (chunk.choices && chunk.choices[0] && chunk.choices[0].delta) {
            delta = chunk.choices[0].delta.content || '';
          }
          if (delta) {
            full += delta;
            if (opts.onChunk) opts.onChunk(full);
          }
        } catch (_e) { /* ignore malformed chunks */ }
      }
    }
    if (opts.onDone) opts.onDone(full);
    return full;
  } finally { clearTimeout(timer); }
}

async function callAIMessagesStream(messages, maxTok, opts) {
  opts = opts || {};
  if (opts.skipQueue || typeof _aiQueue === 'undefined' || !_aiQueue || typeof _aiQueue.enqueue !== 'function') {
    return _callAIMessagesStreamDirect(messages, maxTok, opts);
  }
  var queuedOpts = Object.assign({}, opts, { skipQueue: true });
  return _aiQueue.enqueue(function() {
    return _callAIMessagesStreamDirect(messages, maxTok, queuedOpts);
  }, opts.priority || 'normal');
}

// ============================================================
// GameHooks — 统一钩子系统，替代猴子补丁链
// 用法：GameHooks.on('enterGame:after', fn)  注册回调
//       GameHooks.run('enterGame:after')       触发所有回调
// ============================================================
/**
 * 统一钩子系统 - 替代猴子补丁链
 * @namespace
 * @property {function(string, Function, number=):void} on - 注册回调
 * @property {function(string, ...any):void} run - 触发回调
 * @property {function(string=):void} clear - 清空
 * @property {function(string):number} count - 计数
 */
var GameHooks = (function() {
  var hooks = {};
  return {
    on: function(event, fn, priority) {
      if (!hooks[event]) hooks[event] = [];
      hooks[event].push({ fn: fn, pri: priority || 0 });
      hooks[event].sort(function(a, b) { return a.pri - b.pri; });
    },
    run: function(event) {
      var args = Array.prototype.slice.call(arguments, 1);
      var list = hooks[event];
      if (!list) return;
      for (var i = 0; i < list.length; i++) {
        try { list[i].fn.apply(null, args); }
        catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'GameHooks') : console.error('[GameHooks] ' + event + ' 钩子异常:', e); }
      }
    },
    clear: function(event) { if (event) delete hooks[event]; else hooks = {}; },
    count: function(event) { return hooks[event] ? hooks[event].length : 0; }
  };
})();

// ============================================================
// 月结流水线（借鉴晚唐风云 settlement pipeline）
// 各模块自行注册结算步骤，endTurn 按优先级顺序执行
// ============================================================
/**
 * 月结流水线 - 各模块注册结算步骤，endTurn 按优先级执行
 * @namespace
 * @property {function(string, string, Function, number=, string=):void} register - 注册步骤
 * @property {function(string, boolean):void} setEnabled - 启用/禁用
 * @property {function(string, Object):Array} runBySchedule - 按schedule执行
 * @property {function(Object):Array} runAll - 执行全部
 * @property {function():Array} list - 列出所有步骤
 */
var SettlementPipeline = (function() {
  var steps = []; // [{id, name, fn, priority, enabled, schedule}]
  return {
    /**
     * 注册结算步骤
     * @param {string} id - 唯一标识
     * @param {string} name - 显示名
     * @param {Function} fn - 执行函数(ctx)
     * @param {number} priority - 优先级（越小越先，默认50）
     * @param {string} schedule - 执行频率：'daily'|'monthly'|'perturn'(默认)
     *   daily: 每日子tick都执行（行军/围城/士气）
     *   monthly: 每月子tick执行（经济/人事/评估）
     *   perturn: 每回合执行一次（AI推演后，兼容旧行为）
     */
    register: function(id, name, fn, priority, schedule) {
      for (var i = 0; i < steps.length; i++) {
        if (steps[i].id === id) { steps[i].fn = fn; steps[i].priority = priority || 50; steps[i].schedule = schedule || 'perturn'; return; }
      }
      steps.push({ id: id, name: name, fn: fn, priority: priority || 50, enabled: true, schedule: schedule || 'perturn' });
      steps.sort(function(a, b) { return a.priority - b.priority; });
    },
    /** 启用/禁用 */
    setEnabled: function(id, enabled) {
      for (var i = 0; i < steps.length; i++) {
        if (steps[i].id === id) { steps[i].enabled = enabled; return; }
      }
    },
    /** 执行指定 schedule 的步骤 */
    runBySchedule: function(schedule, context) {
      var report = [];
      for (var i = 0; i < steps.length; i++) {
        var step = steps[i];
        if (!step.enabled || step.schedule !== schedule) continue;
        var t0 = Date.now();
        try {
          step.fn(context);
          report.push({ id: step.id, name: step.name, ok: true, ms: Date.now() - t0 });
        } catch(e) {
          console.error('[Settlement:' + schedule + '] ' + step.name + ' 失败:', e);
          report.push({ id: step.id, name: step.name, ok: false, ms: Date.now() - t0, error: e.message });
        }
      }
      return report;
    },
    /** 执行全部已启用步骤（兼容旧调用方式，运行所有 schedule） */
    runAll: function(context) {
      var report = [];
      for (var i = 0; i < steps.length; i++) {
        var step = steps[i];
        if (!step.enabled) continue;
        var t0 = Date.now();
        try {
          step.fn(context);
          report.push({ id: step.id, name: step.name, ok: true, ms: Date.now() - t0 });
        } catch(e) {
          console.error('[Settlement] ' + step.name + ' 失败:', e);
          report.push({ id: step.id, name: step.name, ok: false, ms: Date.now() - t0, error: e.message });
        }
      }
      _dbg('[Settlement] 执行完成，' + report.length + ' 步');
      return report;
    },
    /** 异步版本 */
    runAllAsync: async function(context) {
      var report = [];
      for (var i = 0; i < steps.length; i++) {
        var step = steps[i];
        if (!step.enabled) continue;
        var t0 = Date.now();
        try {
          await step.fn(context);
          report.push({ id: step.id, name: step.name, ok: true, ms: Date.now() - t0 });
        } catch(e) {
          console.error('[Settlement] ' + step.name + ' 失败:', e);
          report.push({ id: step.id, name: step.name, ok: false, ms: Date.now() - t0, error: e.message });
        }
      }
      _dbg('[Settlement] 异步执行完成，' + report.length + ' 步');
      return report;
    },
    list: function() { return steps.map(function(s) { return { id: s.id, name: s.name, priority: s.priority, enabled: s.enabled, schedule: s.schedule }; }); },
    clear: function() { steps = []; }
  };
})();

// ============================================================
// 子回合结算调度器（借鉴晚唐风云 daily/monthly tick）
//
// 设计原则：天命是"AI 推演 → 系统验证"模式，每回合 AI 生成一次叙事，
// 系统数值必须与 AI 叙事一致。因此默认每回合所有步骤只执行一次。
//
// schedule 元数据保留供将来扩展（如"快速推进N回合"模式下可分层tick）。
// ============================================================
/**
 * 子回合结算调度器
 * @namespace
 * @property {function():{{days:number, months:number}}} calcSubTicks - 计算本回合天/月数
 * @property {function(Object):Array} run - 默认模式（每回合一次）
 * @property {function(Object):Array} runMultiTick - 多tick模式（拆分执行）
 */
var SubTickRunner = {
  /**
   * 计算本回合包含的天数和月数（供 AI prompt 和显示用）
   */
  calcSubTicks: function() {
    var days = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
    var months = Math.max(days < 15 ? 0 : 1, Math.round(days / 30));
    return { days: days, months: months };
  },

  /**
   * 默认模式：每回合所有步骤执行一次（与 AI 叙事节奏同步）
   * 所有 schedule（daily/monthly/perturn）统一执行，timeRatio 由回合粒度决定
   */
  run: function(baseCtx) {
    var ticks = SubTickRunner.calcSubTicks();
    baseCtx.days = ticks.days;
    baseCtx.months = ticks.months;
    if (typeof baseCtx.monthRatio !== 'number' || !isFinite(baseCtx.monthRatio)) {
      baseCtx.monthRatio = ticks.days / 30;
    }
    baseCtx._monthRatio = baseCtx.monthRatio;
    var report = SettlementPipeline.runAll(baseCtx);
    _dbg('[SubTick] 回合结算完成（' + ticks.days + '天/' + ticks.months + '月），' + report.length + ' 步');
    return report;
  },

  /**
   * 多tick模式：将一个回合拆分为多次子结算（仅在"快速推进"或"无AI自动演化"时使用）
   * 调用方需自行确保不与 AI 叙事冲突
   */
  runMultiTick: function(baseCtx) {
    var ticks = SubTickRunner.calcSubTicks();
    var totalReport = [];

    // Phase 1: daily 步骤（每7天一批）
    var dailyBatchSize = 7;
    var dailyBatches = Math.ceil(ticks.days / dailyBatchSize);
    for (var d = 0; d < dailyBatches; d++) {
      var batchDays = Math.min(dailyBatchSize, ticks.days - d * dailyBatchSize);
      var dailyCtx = { timeRatio: batchDays / 365, monthRatio: batchDays / 30, _monthRatio: batchDays / 30, turn: baseCtx.turn, day: d * dailyBatchSize + 1, batchDays: batchDays, isSubTick: true };
      totalReport = totalReport.concat(SettlementPipeline.runBySchedule('daily', dailyCtx));
    }

    // Phase 2: monthly 步骤（每月一次）
    for (var m = 0; m < ticks.months; m++) {
      var monthCtx = { timeRatio: 1 / 12, monthRatio: 1, _monthRatio: 1, turn: baseCtx.turn, month: m + 1, totalMonths: ticks.months, isSubTick: true };
      totalReport = totalReport.concat(SettlementPipeline.runBySchedule('monthly', monthCtx));
    }

    // Phase 3: perturn 步骤（回合末一次）
    totalReport = totalReport.concat(SettlementPipeline.runBySchedule('perturn', { timeRatio: baseCtx.timeRatio, monthRatio: ticks.days / 30, _monthRatio: ticks.days / 30, turn: baseCtx.turn, isSubTick: false }));

    _dbg('[SubTick] 多tick模式完成: ' + ticks.days + '天/' + ticks.months + '月, ' + totalReport.length + '步');
    return totalReport;
  }
};

// ============================================================
//  1A.6 事件总线（阶段二 2.6）
//  插入位置：GameHooks 之后、SettlementPipeline 之前
//  设计：纯 pub/sub，不涉及数值计算，与 addEB 并行（渐进迁移）
// ============================================================
var GameEventBus = (function() {
  var handlers = {}; // { eventName: [{fn, once}] }
  return {
    on: function(event, fn) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push({ fn: fn, once: false });
    },
    once: function(event, fn) {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push({ fn: fn, once: true });
    },
    off: function(event, fn) {
      if (!handlers[event]) return;
      if (!fn) { delete handlers[event]; return; }
      handlers[event] = handlers[event].filter(function(h) { return h.fn !== fn; });
    },
    emit: function(event, data) {
      var list = handlers[event];
      if (!list || !list.length) return;
      var keep = [];
      for (var i = 0; i < list.length; i++) {
        try { list[i].fn(data); } catch(e) { (window.TM && TM.errors && TM.errors.capture) ? TM.errors.capture(e, 'EventBus') : console.error('[EventBus] ' + event + ' handler error:', e); }
        if (!list[i].once) keep.push(list[i]);
      }
      handlers[event] = keep;
    },
    clear: function() { handlers = {}; },
    /** 列出所有已注册事件（调试用） */
    listEvents: function() {
      var result = {};
      for (var k in handlers) { if (handlers.hasOwnProperty(k)) result[k] = handlers[k].length; }
      return result;
    }
  };
})();

// ============================================================
//  1A.1 原子操作保护模式
//  createAction(def) 工厂——每个操作有 canExecute + execute
//  execute 内部先二次校验 canExecute，通过后才写状态
// ============================================================
function createAction(def) {
  if (!def || typeof def.execute !== 'function') {
    console.error('[createAction] 缺少 execute 函数');
    return null;
  }
  return {
    id: def.id || 'unnamed',
    name: def.name || '未命名操作',
    /** 前置条件校验——返回 {ok:boolean, reason?:string} */
    canExecute: function(ctx) {
      if (typeof def.canExecute === 'function') {
        try { return def.canExecute(ctx); }
        catch(e) { return { ok: false, reason: '校验异常: ' + e.message }; }
      }
      return { ok: true };
    },
    /** 带二次校验的安全执行 */
    execute: function(ctx) {
      var check = this.canExecute(ctx);
      if (!check.ok) {
        console.warn('[Action:' + this.id + '] 二次校验失败: ' + (check.reason || ''));
        if (typeof toast === 'function') toast('操作未执行：' + (check.reason || '条件不满足'));
        return { ok: false, reason: check.reason };
      }
      try {
        var result = def.execute(ctx);
        DebugLog.log('action', '[Action:' + this.id + '] 执行成功');
        return { ok: true, result: result };
      } catch(e) {
        console.error('[Action:' + this.id + '] 执行异常:', e);
        return { ok: false, reason: '执行异常: ' + e.message };
      }
    }
  };
}

// ============================================================
//  1A.2 变更日志系统
//  ChangeLog.record(category, target, field, oldVal, newVal, reason)
//  Delta 面板和调试审计从此读取
// ============================================================
var ChangeLog = (function() {
  var entries = []; // [{turn, category, target, field, oldVal, newVal, reason, ts}]
  return {
    record: function(category, target, field, oldVal, newVal, reason) {
      var turn = (typeof GM !== 'undefined' && GM.turn) ? GM.turn : 0;
      entries.push({
        turn: turn,
        category: category, // 'metric'|'character'|'faction'|'office'|'economy'
        target: target,     // 对象名称（如角色名、势力名、变量名）
        field: field,       // 字段名
        oldVal: oldVal,
        newVal: newVal,
        reason: reason || '',
        ts: Date.now()
      });
      // 内存上限：保留最近3000条
      if (entries.length > 3000) entries = entries.slice(-2000);
    },
    /** 获取指定回合的记录 */
    getByTurn: function(turn) {
      return entries.filter(function(e) { return e.turn === turn; });
    },
    /** 获取指定分类的记录 */
    getByCategory: function(category, turn) {
      return entries.filter(function(e) {
        return e.category === category && (!turn || e.turn === turn);
      });
    },
    /** 获取最近N条 */
    getRecent: function(n) {
      return entries.slice(-(n || 50));
    },
    /** 清空（新游戏时调用） */
    clear: function() { entries = []; },
    /** 当前条目数 */
    count: function() { return entries.length; }
  };
})();

// ============================================================
//  1A.3 Balance 配置集中化
//  所有平衡参数集中管理，编辑器可通过 P.balanceOverrides 覆盖
// ============================================================
var BALANCE_CONFIG = {
  // --- 耦合系统 ---
  coupling: {
    maxDeltaPerTurn: 15,   // 耦合单回合变化上限（±）
    enabled: true
  },
  // --- 执行率 ---
  execution: {
    floor: 0.35,           // 最终执行率下限（35%）
    emptyDeptRate: 0.30    // 空缺部门通过率
  },
  // --- 诏令 ---（效果完全由AI判断，此处仅保留执行率下限参考）
  // --- SoftFloor ---
  softFloor: {
    threshold: 20,
    damping: 0.5
  },
  // --- 建筑 ---
  building: {
    maxOutputPerTurn: {    // 单建筑单回合产出上限
      money: 5000,
      grain: 3000,
      militaryStrength: 10
    }
  },
  // --- 阴谋 ---
  scheme: {
    maxPhasesAllowed: 5,   // 最大阶段数
    minProgressPerMonth: 3 // 最小月进度（防止永远完不成）
  }
};
/** 获取Balance配置值（优先用编辑器覆盖） */
function getBalanceVal(path, defaultVal) {
  // 先查 P.balanceOverrides
  if (typeof P !== 'undefined' && P.balanceOverrides) {
    var parts = path.split('.');
    var obj = P.balanceOverrides;
    for (var i = 0; i < parts.length; i++) {
      if (obj && typeof obj === 'object' && parts[i] in obj) obj = obj[parts[i]];
      else { obj = undefined; break; }
    }
    if (obj !== undefined) return obj;
  }
  // 再查 BALANCE_CONFIG
  var parts2 = path.split('.');
  var obj2 = BALANCE_CONFIG;
  for (var j = 0; j < parts2.length; j++) {
    if (obj2 && typeof obj2 === 'object' && parts2[j] in obj2) obj2 = obj2[parts2[j]];
    else return (defaultVal !== undefined) ? defaultVal : undefined;
  }
  return obj2;
}

// ============================================================
//  1A.4 错误恢复增强——robustParseJSON
//  4层修复链替代 extractJSON（extractJSON 保留为别名）
// ============================================================
function robustParseJSON(raw) {
  if (!raw) return null;

  // 2026-06-07·超大响应 OOM 护栏。
  // 下面的多层修复每步都对整段 raw 做正则 .replace()(全量复制字符串·一次解析约 10~15× raw 的瞬时分配)。
  // 模型复读/代理失控可吐出数 MB 的 raw·回合「深度推演」阶段 20+ 个 AI 子调用并发各跑一遍·
  // 瞬时分配叠加可把 Electron 渲染进程内存撑爆 → 深推时突然黑屏、必须重启 App。
  // 合法子调用响应 ≤8000 tokens(数十 KB)·故超过上限者一律视为失控:只做一次零/低拷贝直解·失败即放弃(交上层截断重修)·绝不进多拷贝修复风暴。
  // 2026-06-11·安卓 WebView 小堆·解析上限同步收紧(多层正则修复每步全量复制 raw·安卓上更易爆)。合法子调用仅几十 KB。
  var _rpjIsCap = (function(){ try { if (typeof window !== 'undefined' && window.TM && window.TM.platform && window.TM.platform.kind) return window.TM.platform.kind === 'capacitor'; return !!(typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()); } catch(_) { return false; } })();
  var MAX_PARSE_LEN = _rpjIsCap ? 262144 : 500000; // 安卓~256KB·桌面~500KB·均远超任何合法子调用·远低于致 OOM 量级
  if (raw.length > MAX_PARSE_LEN) {
    try { if (typeof _dbg === 'function') _dbg('[robustParseJSON] 响应过大 ' + raw.length + ' 字符·跳过多层修复防 OOM'); } catch (_) {}
    try { return JSON.parse(raw); } catch (_e0) {}
    try {
      var _s = raw.indexOf('{'), _e = raw.lastIndexOf('}');
      if (_s >= 0 && _e > _s) return JSON.parse(raw.slice(_s, _e + 1));
    } catch (_e1) {}
    return null;
  }

  // Layer 1: 去掉 markdown 代码块后直接解析
  var cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  try { return JSON.parse(cleaned); } catch(e) {}

  // Layer 2: 提取最外层 { } 或 [ ] 块
  var objStart = cleaned.indexOf('{');
  var arrStart = cleaned.indexOf('[');
  var start = -1, openChar = '', closeChar = '';
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) { start = objStart; openChar = '{'; closeChar = '}'; }
  else if (arrStart >= 0) { start = arrStart; openChar = '['; closeChar = ']'; }
  if (start >= 0) {
    var depth = 0, end = -1, inStr = false, esc = false;
    for (var i = start; i < cleaned.length; i++) {
      var c = cleaned[i];
      if (esc) { esc = false; continue; }
      if (c === '\\') { esc = true; continue; }
      if (c === '"') { inStr = !inStr; continue; }
      if (inStr) continue;
      if (c === openChar) depth++;
      if (c === closeChar) depth--;
      if (depth === 0) { end = i; break; }
    }
    if (end > start) {
      var substr = cleaned.substring(start, end + 1);
      // Layer 2a: 直接尝试
      try { return JSON.parse(substr); } catch(e2) {}
      // Layer 2b: 修复尾逗号
      var fixed = substr.replace(/,\s*([}\]])/g, '$1');
      try { return JSON.parse(fixed); } catch(e3) {}
      // Layer 2c: 修复中文引号
      fixed = fixed.replace(/\u201c|\u201d/g, '"').replace(/\u2018|\u2019/g, "'").replace(/'/g, '"');
      try { return JSON.parse(fixed); } catch(e4) {}
      // Layer 2d: 修复未转义换行符
      fixed = fixed.replace(/(?<!\\)\n/g, '\\n').replace(/(?<!\\)\r/g, '\\r').replace(/(?<!\\)\t/g, '\\t');
      try { return JSON.parse(fixed); } catch(e5) {}
      // Phase 1 C-1·Layer 2.5·jsonrepair-style 强化 (项目零依赖·内嵌实现)
      // 应对·max_tokens 截断的尾部不完整 / 字符串内部含未转义引号 / 缺逗号 / 多余逗号
      try {
        var rep = fixed;
        // 1·删 ASCII 控制字符 (除 \t \n \r 已 escape)
        rep = rep.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
        // 2·`}{` / `]{` / `}[` / `][` 之间缺逗号·插入
        rep = rep.replace(/\}(\s*)\{/g, '},$1{').replace(/\](\s*)\[/g, '],$1[').replace(/\}(\s*)\[/g, '},$1[').replace(/\](\s*)\{/g, '],$1{');
        // 3·删重复逗号 `,,` 与 `,]` `,}`·已在 Layer 2b 部分处理·再扫一遍
        rep = rep.replace(/,\s*,+/g, ',').replace(/,\s*([}\]])/g, '$1');
        try { return JSON.parse(rep); } catch(e6) {}
        // 4·闭合不匹配的 } / ]·扫从前到后括号深度·结尾补 missing closers
        var stack25 = [], inStr25 = false, esc25 = false;
        for (var j = 0; j < rep.length; j++) {
          var ch = rep[j];
          if (esc25) { esc25 = false; continue; }
          if (ch === '\\') { esc25 = true; continue; }
          if (ch === '"') { inStr25 = !inStr25; continue; }
          if (inStr25) continue;
          if (ch === '{' || ch === '[') stack25.push(ch);
          else if (ch === '}' || ch === ']') stack25.pop();
        }
        var tail25 = rep;
        if (inStr25) tail25 += '"';  // 截断在字符串中间·闭合
        while (stack25.length) {
          var open25 = stack25.pop();
          tail25 += (open25 === '{') ? '}' : ']';
        }
        // 修补 trailing comma 后再 parse
        tail25 = tail25.replace(/,\s*([}\]])/g, '$1');
        try { return JSON.parse(tail25); } catch(e7) {}
      } catch(e25) {}
    }
  }

  // Layer 2.6·Layer 2 完全失败 (end<0·没闭合 brace)·从 start 截到末尾·按栈补全
  // 应对·AI 完全没写收尾·`{"events":[{"type":"war"` 这种最严重的 max_tokens 截断
  if (start >= 0) {
    try {
      var trunc = cleaned.substring(start);
      var stack26 = [], inStr26 = false, esc26 = false;
      for (var k = 0; k < trunc.length; k++) {
        var c26 = trunc[k];
        if (esc26) { esc26 = false; continue; }
        if (c26 === '\\') { esc26 = true; continue; }
        if (c26 === '"') { inStr26 = !inStr26; continue; }
        if (inStr26) continue;
        if (c26 === '{' || c26 === '[') stack26.push(c26);
        else if (c26 === '}' || c26 === ']') stack26.pop();
      }
      var tail26 = trunc;
      if (inStr26) tail26 += '"';
      // 若最后是 `,` 或 `:` 后无值·补 null
      tail26 = tail26.replace(/,\s*$/, '').replace(/:\s*$/, ':null');
      while (stack26.length) {
        var open26 = stack26.pop();
        tail26 += (open26 === '{') ? '}' : ']';
      }
      tail26 = tail26.replace(/,\s*([}\]])/g, '$1');
      try { return JSON.parse(tail26); } catch(e26b) {}
    } catch(e26a) {}
  }

  // Layer 3: 按关键字段分段提取（适用于 AI 返回的半结构化文本）
  try {
    var result = {};
    var fieldPatterns = [
      { key: 'shizhengji', pattern: /["']?shizhengji["']?\s*[:：]\s*["']([\s\S]*?)["']\s*[,}\n]/ },
      { key: 'zhengwen', pattern: /["']?zhengwen["']?\s*[:：]\s*["']([\s\S]*?)["']\s*[,}\n]/ },
      { key: 'player_status', pattern: /["']?player_status["']?\s*[:：]\s*["']([\s\S]*?)["']\s*[,}\n]/ },
      { key: 'player_inner', pattern: /["']?player_inner["']?\s*[:：]\s*["']([\s\S]*?)["']\s*[,}\n]/ }
    ];
    var found = false;
    fieldPatterns.forEach(function(fp) {
      var m = cleaned.match(fp.pattern);
      if (m && m[1]) { result[fp.key] = m[1].trim(); found = true; }
    });
    if (found) return result;
  } catch(e){try{window.TM&&TM.errors&&TM.errors.captureSilent(e,'tm-utils');}catch(_){}}

  // Layer 4: 纯文本回退
  if (cleaned.length > 20) {
    console.warn('[robustParseJSON] 所有修复层级失败，使用纯文本回退');
    return { zhengwen: cleaned.substring(0, 2000), shizhengji: '', player_status: '' };
  }

  return null;
}
/** 数值约束：确保AI返回的delta在合理范围内 */
function sanitizeNumericDelta(val, min, max) {
  var n = parseFloat(val);
  if (isNaN(n)) return 0;
  if (min !== undefined && n < min) return min;
  if (max !== undefined && n > max) return max;
  return n;
}

// ============================================================
//  1A.5 调试日志分级
//  按系统分类过滤日志：DebugLog.enable('ai') 只显示AI相关
// ============================================================
var DebugLog = (function() {
  var enabled = {}; // { category: true/false }
  var allEnabled = false;
  var categories = ['ai', 'settlement', 'npc', 'combat', 'economy', 'ui', 'action', 'coupling', 'edict', 'event', 'building', 'scheme'];
  return {
    categories: categories,
    /** 启用某分类（或 'all'） */
    enable: function(cat) {
      if (cat === 'all') { allEnabled = true; return; }
      enabled[cat] = true;
    },
    /** 禁用某分类（或 'all'） */
    disable: function(cat) {
      if (cat === 'all') { allEnabled = false; enabled = {}; return; }
      delete enabled[cat];
    },
    /** 日志输出（仅在分类启用或全局debugLog时输出） */
    log: function(category) {
      if (!allEnabled && !enabled[category] && !(typeof P !== 'undefined' && P.conf && P.conf.debugLog)) return;
      var args = Array.prototype.slice.call(arguments, 1);
      args.unshift('[' + category.toUpperCase() + ']');
      console.log.apply(console, args);
    },
    /** 警告级别（始终输出） */
    warn: function(category) {
      var args = Array.prototype.slice.call(arguments, 1);
      args.unshift('[' + category.toUpperCase() + ']');
      console.warn.apply(console, args);
    },
    /** 查看当前启用状态 */
    status: function() {
      if (allEnabled) return 'ALL enabled';
      var on = [];
      for (var k in enabled) { if (enabled[k]) on.push(k); }
      return on.length ? on.join(', ') : 'none (use DebugLog.enable("ai") to start)';
    }
  };
})();

// ============================================================
//  3.3 AI Sub-call 管线注册表
//  将 endTurn 中 11+ 个 Sub-call 提取为注册表模式
//  每个 Sub-call 可独立测试/禁用/retry/fallback
// ============================================================
var AISubCallRegistry = (function() {
  var subcalls = []; // [{id, name, order, minDepth, build, process, fallback, retryCount, enabled}]
  return {
    /**
     * 注册一个 Sub-call
     * @param {Object} def
     * @param {string} def.id - 唯一标识（如 'subcall0', 'subcall1'）
     * @param {string} def.name - 显示名（如 '深度思考', '结构化数据'）
     * @param {number} def.order - 执行顺序（越小越先）
     * @param {string} def.minDepth - 最低AI深度：'lite'|'standard'|'full'（默认'lite'，即始终执行）
     * @param {function(ctx):Promise<string>} def.build - 构建prompt的函数，返回prompt字符串
     * @param {function(ctx, rawResponse):void} def.process - 处理AI返回的函数
     * @param {function(ctx):void} def.fallback - AI失败时的最小数据填充（不产出替代叙事）
     * @param {number} def.retryCount - 失败重试次数（默认1）
     */
    register: function(def) {
      if (!def || !def.id) return;
      // 去重：同id覆盖
      for (var i = 0; i < subcalls.length; i++) {
        if (subcalls[i].id === def.id) { subcalls[i] = def; subcalls.sort(function(a,b){return a.order-b.order;}); return; }
      }
      def.retryCount = def.retryCount || 1;
      def.minDepth = def.minDepth || 'lite';
      def.enabled = def.enabled !== false;
      subcalls.push(def);
      subcalls.sort(function(a, b) { return a.order - b.order; });
    },
    /** 禁用/启用某个 Sub-call */
    setEnabled: function(id, enabled) {
      for (var i = 0; i < subcalls.length; i++) {
        if (subcalls[i].id === id) { subcalls[i].enabled = enabled; return; }
      }
    },
    /**
     * 执行管线——按 order 顺序逐个执行注册的 Sub-call
     * @param {Object} ctx - 共享上下文（含 sysP, tp, edicts, p1 等）
     * @param {string} currentDepth - 当前AI深度 ('lite'|'standard'|'full')
     * @returns {Promise<Object>} 执行报告
     */
    runPipeline: async function(ctx, currentDepth) {
      var depthOrder = { lite: 0, standard: 1, full: 2 };
      var curLevel = depthOrder[currentDepth] || 0;
      var report = [];

      // 收集可执行的subcall并按parallelGroup分组
      var eligible = subcalls.filter(function(sc) {
        return sc.enabled && (depthOrder[sc.minDepth] || 0) <= curLevel;
      });

      // 1.5: 分组——连续的同parallelGroup的subcall归为一组
      var groups = []; var curGroup = null;
      for (var gi = 0; gi < eligible.length; gi++) {
        var esc = eligible[gi];
        if (esc.parallelGroup && curGroup && curGroup.gid === esc.parallelGroup) {
          curGroup.items.push(esc);
        } else {
          curGroup = { gid: esc.parallelGroup || null, items: [esc] };
          groups.push(curGroup);
        }
      }

      var self = this;
      for (var gj = 0; gj < groups.length; gj++) {
        var g = groups[gj];
        if (g.items.length > 1 && g.gid) {
          // 并行执行同组
          var results = await Promise.all(g.items.map(function(sc) { return self._execOne(sc, ctx); }));
          report = report.concat(results);
        } else {
          // 顺序执行
          for (var gk = 0; gk < g.items.length; gk++) {
            report.push(await self._execOne(g.items[gk], ctx));
          }
        }
      }
      return report;
    },
    /** 执行单个Sub-call（含retry和fallback） @private */
    _execOne: async function(sc, ctx) {
        var success = false;
        var lastErr = null;
        for (var attempt = 0; attempt <= (sc.retryCount || 1); attempt++) {
          try {
            if (typeof sc.build === 'function') {
              var prompt = await sc.build(ctx);
              if (prompt && typeof sc.process === 'function') {
                await sc.process(ctx, prompt);
              }
            }
            success = true;
            return { id: sc.id, name: sc.name, ok: true, attempt: attempt };
          } catch(e) {
            lastErr = e;
            DebugLog.warn('ai', '[SubCall:' + sc.id + '] 第' + (attempt + 1) + '次尝试失败:', e.message);
          }
        }
        // 所有重试失败
        if (typeof sc.fallback === 'function') {
          try { sc.fallback(ctx); } catch(fe) { DebugLog.warn('ai', '[SubCall:' + sc.id + '] fallback也失败:', fe.message); }
        }
        if (typeof toast === 'function') toast(sc.name + '生成失败，请检查网络或API密钥');
        return { id: sc.id, name: sc.name, ok: false, error: lastErr ? lastErr.message : 'unknown' };
    },
    /** 列出所有注册的 Sub-call */
    list: function() {
      return subcalls.map(function(sc) {
        return { id: sc.id, name: sc.name, order: sc.order, minDepth: sc.minDepth, enabled: sc.enabled };
      });
    },
    /** 获取注册数量 */
    count: function() { return subcalls.length; },
    /** 清空（测试用） */
    clear: function() { subcalls = []; }
  };
})();

// ============================================================
//  4.6 重大决策注册表
//  决策类型由编辑器在 P.mechanicsConfig.decisions[] 中定义
//  canExecute 结果注入 AI prompt 作为参考，AI 决定是否触发
// ============================================================
var DecisionRegistry = (function() {
  var decisions = []; // [{id, name, canShowExpr, canExecuteExpr, description}]
  return {
    /** 从编辑器配置加载决策定义 */
    loadFromConfig: function() {
      decisions = [];
      var mc = (typeof P !== 'undefined' && P.mechanicsConfig) ? P.mechanicsConfig : {};
      var defs = mc.decisions || [];
      defs.forEach(function(d) {
        if (d && d.id && d.name) decisions.push(d);
      });
    },
    /** 手动注册一个决策 */
    register: function(def) {
      if (!def || !def.id) return;
      for (var i = 0; i < decisions.length; i++) {
        if (decisions[i].id === def.id) { decisions[i] = def; return; }
      }
      decisions.push(def);
    },
    /** 检查某个决策对某个角色是否可显示 */
    canShow: function(decisionId, char) {
      var d = decisions.find(function(x) { return x.id === decisionId; });
      if (!d || !d.canShowExpr) return true; // 无条件则默认可见
      try { return TM.safeEval(d.canShowExpr, { char: char, GM: GM, P: P }); }
      catch(e) { return false; }
    },
    /** 检查某个决策对某个角色是否可执行——返回 {ok, reason} */
    canExecute: function(decisionId, char) {
      var d = decisions.find(function(x) { return x.id === decisionId; });
      if (!d) return { ok: false, reason: '决策不存在' };
      if (!d.canExecuteExpr) return { ok: true };
      try {
        var result = TM.safeEval(d.canExecuteExpr, { char: char, GM: GM, P: P });
        return { ok: !!result, reason: result ? '' : '条件不满足' };
      } catch(e) { return { ok: false, reason: '条件评估失败: ' + e.message }; }
    },
    /** 获取玩家可见的所有决策 */
    getAvailableForPlayer: function() {
      var pc = (typeof GM !== 'undefined' && GM.chars) ? GM.chars.find(function(c) { return c.isPlayer; }) : null;
      if (!pc) return [];
      return decisions.filter(function(d) {
        return DecisionRegistry.canShow(d.id, pc);
      }).map(function(d) {
        var exec = DecisionRegistry.canExecute(d.id, pc);
        return { id: d.id, name: d.name, description: d.description || '', canExecute: exec.ok, reason: exec.reason };
      });
    },
    /** 扫描所有NPC，返回满足决策条件的列表——供AI prompt注入 */
    scanNpcDecisions: function() {
      if (!GM.chars || !decisions.length) return [];
      var results = [];
      GM.chars.forEach(function(c) {
        if (c.isPlayer || c.alive === false) return;
        decisions.forEach(function(d) {
          var exec = DecisionRegistry.canExecute(d.id, c);
          if (exec.ok) {
            results.push({ charName: c.name, decisionId: d.id, decisionName: d.name });
          }
        });
      });
      return results;
    },
    /** 列出所有注册的决策 */
    list: function() { return decisions.slice(); },
    count: function() { return decisions.length; }
  };
})();

// 时间
function toChineseReignYear(n){if(n<=0)return n+"年";if(n===1)return"元年";var units=["","一","二","三","四","五","六","七","八","九"];var s="";var h=Math.floor(n/100);if(h>0){s+=units[h]+"百";n=n%100;}var t2=Math.floor(n/10);var o=n%10;if(t2>0){s+=(t2===1&&!h?"十":units[t2]+"十");if(o>0)s+=units[o];}else if(o>0){s+=units[o];}return s+"年";}
var _GZ_STEMS=["甲","乙","丙","丁","戊","己","庚","辛","壬","癸"];
var _GZ_BRANCHES=["子","丑","寅","卯","辰","巳","午","未","申","酉","戌","亥"];
var _LUNAR_MONTHS=["正月","二月","三月","四月","五月","六月","七月","八月","九月","十月","冬月","腊月"];
var _LUNAR_DAYS=["初一","初二","初三","初四","初五","初六","初七","初八","初九","初十","十一","十二","十三","十四","十五","十六","十七","十八","十九","二十","廿一","廿二","廿三","廿四","廿五","廿六","廿七","廿八","廿九","三十"];
var _SEASON_FROM_MONTH={1:'春',2:'春',3:'春',4:'夏',5:'夏',6:'夏',7:'秋',8:'秋',9:'秋',10:'冬',11:'冬',12:'冬'};

function gzYear(adYear){
  var n=(adYear>=1)?((adYear-4)%60+60)%60:((adYear-3)%60+60)%60;
  return _GZ_STEMS[n%10]+_GZ_BRANCHES[n%12];
}
function adToJdn(y,m,d){
  var a=Math.floor((14-m)/12);var yr=y+4800-a;var mo=m+12*a-3;
  return d+Math.floor((153*mo+2)/5)+365*yr+Math.floor(yr/4)-Math.floor(yr/100)+Math.floor(yr/400)-32045;
}
var _GZ_DAY_EPOCH=adToJdn(1984,2,4);
function gzDay(adYear,m,d){
  var jdn=adToJdn(adYear,m,d);
  var n=((jdn-_GZ_DAY_EPOCH)%60+60)%60;
  return _GZ_STEMS[n%10]+_GZ_BRANCHES[n%12];
}
/** 农历月名 */
function lunarMonthName(m){ return _LUNAR_MONTHS[(m-1)%12]||('第'+m+'月'); }
/** 农历日名 */
function lunarDayName(d){ return _LUNAR_DAYS[(d-1)%30]||('第'+d+'日'); }

function getEraDisplay(y,mo,dy){
  var eraList=(GM.eraNames||[]);var best=null;
  eraList.forEach(function(e){
    if(!e||!e.name)return;
    var ey=e.startYear||0;var em=e.startMonth||1;var ed=e.startDay||1;
    if(y>ey||(y===ey&&mo>em)||(y===ey&&mo===em&&dy>=ed)){
      if(!best||ey>best.startYear||(ey===best.startYear&&em>best.startMonth)||(ey===best.startYear&&em===best.startMonth&&(ed>=(best.startDay||1))))best=e;
    }
  });
  if(!best)return null;
  var ry=(y===best.startYear)?1:(y-best.startYear+1);
  return {era:best.name,ry:ry,ryStr:toChineseReignYear(ry),month:mo,day:dy};
}

/**
 * 从回合号计算完整日期信息
 *
 * 关键设计：同时追踪公历（阳历）和农历日期
 * - 公历日期用于干支日计算（天文学精确）
 * - 农历日期用于游戏显示（历史感）
 * - P.time.startMonth/startDay = 公历起始日期（用于推算）
 * - P.time.startLunarMonth/startLunarDay = 对应的农历日期（用于显示）
 *   若未设置，默认按公历月-1近似
 *
 * @returns {{adYear,solarMonth,solarDay,lunarMonth,lunarDay,season,eraInfo,gzYearStr,gzDayStr,reignYear}}
 */
/** 取当前游戏自开局累计天数·跨剧本统一时间标尺
 *  · 用于鸿雁/驿递/续问/自愈等"按真实时间"判定的逻辑
 *  · 与 calcDateFromTurn 内部的 (turn-1)*dpv 计算一致
 *  · 开局 turn=1 → day=0
 */
function getCurrentGameDay(){
  var dpv = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  return ((GM.turn || 1) - 1) * dpv;
}

function calcDateFromTurn(turn){
  if(!P.time) return {adYear:0,solarMonth:1,solarDay:1,lunarMonth:1,lunarDay:1,season:'春',gzYearStr:'',gzDayStr:''};
  var t=P.time;
  // 公历起始日期（用于干支计算）
  var solarM=t.startMonth||1, solarD=t.startDay||1;
  // 农历起始日期（用于显示；未设置则从公历近似推算）
  var lunarM=t.startLunarMonth||(solarM>1?solarM-1:12);
  var lunarD=t.startLunarDay||solarD;
  var baseYear=t.year||1;

  // 每回合推进天数（统一用 _getDaysPerTurn）
  var daysPer = (typeof _getDaysPerTurn === 'function') ? _getDaysPerTurn() : 30;
  var totalDays=(turn-1)*daysPer;

  // === 公历日期推进（用于干支计算）===
  // 使用精确的公历月天数
  var _solarDaysInMonth=[0,31,28,31,30,31,30,31,31,30,31,30,31];
  function _isLeap(y){return(y%4===0&&y%100!==0)||(y%400===0);}
  var sy=baseYear, sm=solarM, sd=solarD+totalDays;
  // 进位：日→月→年（精确公历）
  while(true){
    var dim=_solarDaysInMonth[sm]||30;
    if(sm===2&&_isLeap(sy))dim=29;
    if(sd<=dim)break;
    sd-=dim; sm++;
    if(sm>12){sm=1;sy++;}
  }

  // === 农历日期推进（用于显示）===
  // 农历简化：每月29或30日交替（平均29.53日）
  var ly=baseYear, lm=lunarM, ld=lunarD+totalDays;
  while(ld>30){ld-=30;lm++;}
  // 农历年份跟公历年份对齐（简化处理）
  while(lm>12){lm-=12;ly++;}
  // 注意：农历年份用公历年份（因为年号/干支年都基于公历）
  ly=sy;

  // 季节由农历月份决定
  var season=_SEASON_FROM_MONTH[lm]||'春';

  // 干支年：用公历年
  var gzY=gzYear(sy);
  // 干支日：用精确的公历日期（这是正确的！）
  var gzD=gzDay(sy,sm,sd);

  // 年号：用公历年+农历月日判断
  var eraInfo=null;
  if(t.enableEraName&&GM.eraNames&&GM.eraNames.length){
    eraInfo=getEraDisplay(sy,lm,ld);
  }

  // 年号年数
  var reignYear=(t.reignY||1)+Math.floor(totalDays/360);

  return {
    adYear:sy, solarMonth:sm, solarDay:sd,
    lunarMonth:lm, lunarDay:ld, season:season,
    eraInfo:eraInfo, gzYearStr:gzY, gzDayStr:gzD,
    reignYear:reignYear
  };
}

/** turn + P.time 是权威日期；GM.year/month/day 仅为旧读者兼容镜像。 */ function _tmSyncGMCalendar(targetGM, turn){
  var G = targetGM || ((typeof GM !== 'undefined' && GM) ? GM : null), timeConfig = null; try { timeConfig = (typeof P !== 'undefined' && P) ? P.time : null; } catch (_) {}
  if (!G || typeof calcDateFromTurn !== 'function' || !timeConfig) return null; // 缺 P.time 时保留旧档镜像，不写 adYear=0 占位
  var di = calcDateFromTurn(turn == null ? (G.turn || 1) : turn); if (!di || !isFinite(Number(di.adYear))) return null;
  G.year = Number(di.adYear); G.month = isFinite(Number(di.solarMonth)) ? Number(di.solarMonth) : 1; G.day = isFinite(Number(di.solarDay)) ? Number(di.solarDay) : 1; return { year: G.year, month: G.month, day: G.day };
}

/**
 * 获取回合时间显示（主显示函数）
 * @returns {string} HTML字符串，包含tooltip
 */
function getTS(turn){
  if(!P.time) return '第'+turn+'回合';
  var di=calcDateFromTurn(turn);
  var t=P.time;

  // === 主格式：年号X年·季·月·干支日 ===
  var main='';
  // 年份部分
  if(di.eraInfo){
    main+=di.eraInfo.era+di.eraInfo.ryStr;
  } else if(t.display==='reign'&&t.reign){
    main+=t.reign+toChineseReignYear(di.reignYear);
  } else {
    var ay=Math.abs(di.adYear);
    main+=(di.adYear<0?(t.prefix||'')+ay:ay)+(t.suffix||'');
  }
  // 季节+月份（冬月/腊月已含季节，不重复"冬"字）
  var _mn=lunarMonthName(di.lunarMonth);
  if(di.lunarMonth===11||di.lunarMonth===12){
    main+=_mn; // 冬月、腊月本身暗含冬季
  } else {
    main+=di.season+_mn; // 春正月、夏六月、秋八月等
  }
  // 干支日（始终显示）
  main+=di.gzDayStr+'日';

  // === 副格式（tooltip）===
  var tipParts=[];
  // 公元日期（精确公历）
  var adStr=(di.adYear<0?'公元前'+Math.abs(di.adYear):('公元'+di.adYear))+'年'+di.solarMonth+'月'+di.solarDay+'日';
  tipParts.push(adStr);
  // 农历日期（中文）
  tipParts.push(lunarMonthName(di.lunarMonth)+lunarDayName(di.lunarDay));
  // 干支年
  tipParts.push(di.gzYearStr+'年');

  return '<span title="'+tipParts.join(' | ')+'" style="cursor:help;border-bottom:1px dotted var(--gold-d);">'+main+'</span>';
}

/**
 * 获取纯文本时间（用于日志/存档等不需要HTML的场景）
 * @returns {string}
 */
function getTSText(turn){
  if(!P.time) return '第'+turn+'回合';
  var di=calcDateFromTurn(turn);
  var t=P.time;
  var main='';
  if(di.eraInfo) main+=di.eraInfo.era+di.eraInfo.ryStr;
  else { var ay=Math.abs(di.adYear); main+=(di.adYear<0?(t.prefix||'')+ay:ay)+(t.suffix||''); }
  var _mn2=lunarMonthName(di.lunarMonth);
  if(di.lunarMonth===11||di.lunarMonth===12) main+=_mn2;
  else main+=di.season+_mn2;
  main+=di.gzDayStr+'日';
  return main;
}
function getSE(turn){var si=(P.time.startS+(turn-1))%(P.time.seasons||[]).length;return(P.time.sEffects||[])[si]||"";}

/** 构建 NPC 时空约束提示词·注入任意 NPC 对话/奏疏/书信/决策 prompt 前
 * 防 AI 使用未来史实知识（如 NPC 说"某人已死"但在游戏时间中此人还活着）。
 * @param {object} [ch] 当前 NPC（有 _memory 则附注其关键记忆）
 * @param {object} [opts]
 * @param {string[]} [opts.mentionedNames] 议题所涉人名·必入名单且逐人标生死
 * @param {boolean}  [opts.clauseOnly] 只注入总纲条款·不带在世大名单（供 JSON 决策类入口省 token 防干扰） */
function _buildTemporalConstraint(ch, opts) {
  opts = opts || {};
  var t = (typeof getTSText === 'function') ? getTSText(GM.turn || 1) : ('T' + (GM.turn || 1));
  var y = (GM.year || (P.time && P.time.year) || '?');
  var lines = [];
  _tcPreamble(lines, opts.clauseOnly ? 'clause' : 'full');
  lines.push('\n【★ 时空约束·AI 严格遵守 ★】');
  lines.push('当前游戏时间：' + t + '（公元 ' + y + ' 年）·第 ' + (GM.turn || 1) + ' 回合');

  // clauseOnly：只给总纲条款·省 token·防大名单干扰结构化 JSON 输出（文案自洽·不引用「下列名单」）
  if (opts.clauseOnly) {
    _tcAppendMentioned(lines, opts.mentionedNames);   // 议题所涉人仍逐人标生死（少量·不干扰）
    if (typeof _tcAppendDivergence === 'function') _tcAppendDivergence(lines, true); // 分歧账·clause 模式压成一句总纲(不列名单·省 token)
    lines.push('★ 绝对禁止：说在世人物已死·或说已故人物仍活·生死一律以本 prompt 游戏态与 GM 数据为准·非历史上的卒年。');
    lines.push('★ 允许：隐约预感/占卜不祥/担忧未来/引前朝/古事为训。');
    return lines.join('\n');
  }

  // 在世名单·按重要度排序后取前 30（真实字段打分：官职关键词分层＋本朝在职＋rankLevel 兜底·而非数组序·防要人被采样漏掉被 AI 当死）
  var allAlive = (GM.chars || []).filter(function(c){ return c && c.alive !== false && !c.dead; });
  var ranked = allAlive.slice().sort(function(a, b){ return _tcImportanceScore(b) - _tcImportanceScore(a); });
  var aliveSample = ranked.slice(0, 30).map(function(c){ return c.name; }).join('、');
  if (aliveSample) lines.push('当前在世人物（按要位择要·节选，非全名单）：' + aliveSample + (allAlive.length > 30 ? '…等' : ''));
  // 已故名单·带卒于回合（截取部分·全部生死以 GM 为准）
  var deadList = (GM.chars || []).filter(function(c){ return c && (c.alive === false || c.dead); }).slice(0, 12).map(function(c){
    var dt = (c.deathTurn != null) ? c.deathTurn : c._deathTurn;
    return c.name + (dt != null ? '（卒于第' + dt + '回合）' : '');
  }).join('、');
  if (deadList) lines.push('以下为部分已故人物（本局全部生死以 GM 为准）：' + deadList);
  // 议题所涉人名·必入名单且逐人标生死（凌驾史书卒年）
  _tcAppendMentioned(lines, opts.mentionedNames);
  // 本局与史实的已知分歧账(V1)·读 GM.histAnchors·史载已故者本局仍在世→逐条「以本局为准」(cap 8·文案中立)
  if (typeof _tcAppendDivergence === 'function') _tcAppendDivergence(lines, false);
  lines.push('★ 绝对禁止：');
  lines.push('  · 讨论游戏当前时间之后才发生的史实事件（如游戏在天启七年·不得提及崇祯朝将发生之事为既成事实）');
  lines.push('  · 说在世人物已死·或说已故人物仍活；不在在世名单者，生死以 GM 数据为准·不得凭史实臆断');
  lines.push('  · 以"历史上某年某人做了 X"作为此时此事的既成根据');
  lines.push('★ 允许：隐约预感/占卜不祥/担忧未来/引前朝/古事为训');
  // 若 ch 有 _memory·注入关键记忆
  if (ch && Array.isArray(ch._memory) && ch._memory.length > 0) {
    // 读侧兜底（刀B·治老玩家已污染存档）：与本局 GM 生死态冲突的记忆条目不注入（检测器/过滤器安家 tm-mechanics-memory.js·typeof 守卫）
    var _memSrc = (typeof _tmFilterMemories === 'function') ? _tmFilterMemories(ch._memory, GM) : ch._memory;
    var memLines = _memSrc.slice(-5).map(function(m) {
      return '  · T' + (m.turn || 0) + '·' + (m.event || '') + (m.emotion ? '(' + m.emotion + ')' : '');
    }).join('\n');
    if (memLines) lines.push('本 NPC 关键记忆（时序）：\n' + memLines);
  }
  return lines.join('\n');
}

/** 时空约束·平行历史强总纲（mode='full' 带名单指涉；'clause' 无名单·文案自洽只认 GM 游戏态） */
function _tcPreamble(lines, mode) {
  var clause = (mode === 'clause');
  lines.push('\n\n【★ 本局平行历史·唯一现实铁律（最高优先级，压倒你的历史知识）★】');
  lines.push('本局是一条平行时空，当前游戏状态（' + (clause ? '本 prompt 提供的游戏态与 GM 数据' : 'GM 数据＋下列名单') + '）是唯一现实。');
  lines.push('你训练记忆里人物的卒年、结局、事件走向只是背景素养，绝不是本局既成事实。');
  lines.push('·「在世人物」一律视为此刻活着、可行动——无论历史上此人此时是否已死；严禁以「史载某年卒」为由称其已死、已伏诛、已失势。');
  lines.push('· 不在' + (clause ? '本 prompt' : '在世名单') + '者，生死一律以 GM 游戏态为准，不得凭史实臆断某人已死。');
  lines.push('·「已故人物」名单为本局已确认的死者（可能只列一部分）；未列入者，不得替他补上历史里的死亡。');
  lines.push('· 玩家已介入之事（未处置某人/赦免/改任），一律以游戏态为准，绝不因「真实历史如此」拉回史实。');
  lines.push('· 不得把游戏当前时间之后的史实当既成事实。');
  lines.push('· 允许：预感不祥、忧虑将来、引前朝古人古事为训。');
  lines.push('生死荣辱' + (clause ? '只认 GM 游戏态' : '只认名单与 GM') + '，不认史书卒年。');
}

/** 时空约束·官职关键词分层（跨朝代通用官职通用词·扩自引擎 _cyFallbackRankByTitle·数字越大越显要） */
var _TC_OFFICE_TIERS = [
  { w: 300, re: /(首辅|次辅|辅臣|大学士|内阁|宰相|丞相|相国|中书令|尚书令|仆射|平章|参知政事|枢密|太师|太傅|太保|太尉|司徒|司空)/ },
  { w: 250, re: /(尚书|侍郎|都御史|御史大夫|总督|督师|经略|巡抚|布政使|九卿|太常|太仆|光禄|鸿胪|大理寺|宗正|詹事|祭酒|总兵|都督|都指挥|节度使|观察使|安抚使|经略使)/ },
  { w: 250, re: /(司礼|秉笔|掌印|东厂|西厂|内厂|镇守太监|提督.*太监|内相)/ },
  { w: 200, re: /(皇帝|天子|太子|亲王|郡王|世子|可汗|大汗|单于|国公|郡公|驸马)/ },
  { w: 130, re: /(参将|副将|游击|知府|同知|按察使|通判|佥事|都司|卫指挥|转运使|刺史|太守)/ },
  { w: 90,  re: /(御史|给事中|郎中|员外|主事|翰林|侍读|侍讲|编修|检讨|中书|舍人|博士|监生)/ },
  { w: 45,  re: /(知州|知县|县令|县丞|主簿|典史|教谕|训导|巡检)/ }
];
/** 官职文本·归一空/无（officialTitle 与 title 合并·'无/白身/未仕/布衣/平民' 视为无官） */
function _tcTitleText(c) {
  var raw = ((c && c.officialTitle != null) ? String(c.officialTitle) : '') + ' ' + ((c && c.title != null) ? String(c.title) : '');
  raw = raw.trim();
  if (raw === '无' || raw === '白身' || raw === '未仕' || raw === '布衣' || raw === '平民') return '';
  return raw;
}
function _tcOfficeTier(title) {
  if (!title) return 0;
  for (var i = 0; i < _TC_OFFICE_TIERS.length; i++) { if (_TC_OFFICE_TIERS[i].re.test(title)) return _TC_OFFICE_TIERS[i].w; }
  return 0;
}
/** 是否本朝（faction === 玩家 faction） */
function _tcIsOwnCourt(c) {
  try {
    var pf = (typeof P !== 'undefined' && P.playerInfo && P.playerInfo.factionName) || '';
    return !!(pf && c && c.faction && c.faction === pf);
  } catch (_) { return false; }
}
/** 时空约束·在世名单重要度打分（真实字段：官职关键词分层为主·本朝在职大幅优先·外邦君主降权不挤本朝·rankLevel 仅兜底 keyword-less 者·而非虚构 rank 字段） */
function _tcImportanceScore(c) {
  if (!c) return -1;
  if (c.isPlayer) return 100000;                    // 玩家角色必首
  var s = 0;
  var title = _tcTitleText(c);
  var tier = _tcOfficeTier(title);
  var hasOffice = tier > 0 || (title && title.length > 0);
  var own = _tcIsOwnCourt(c);
  s += tier;
  if (tier === 0) {                                 // 无可识别官职关键词→退用真实 rankLevel 兜底（品越高越靠前·脏 18/缺省=0·仅救 keyword-less 的清品级者·不动已分层者）
    var rl = (typeof c.rankLevel === 'number' && c.rankLevel >= 1 && c.rankLevel <= 18) ? c.rankLevel : 18;
    s += (18 - rl) * 6;
  }
  if (own) { s += 220; if (hasOffice) s += 80; }    // 本朝显著优先·在职再加（本朝在职权重远高于 isHistorical）
  else { s -= 260; }                                // 外邦大幅降权·不得挤掉本朝重臣
  if (c.isHistorical) s += own ? 20 : 5;
  var imp = c.importance;
  if (imp === '关键') s += 30; else if (imp === '重要') s += 15;
  else if (typeof imp === 'number') s += Math.min(Math.max(imp, 0), 100) * 0.3;   // 'regional' 等异构值不计
  if (typeof c.loyalty === 'number' && (c.loyalty < 20 || c.loyalty > 90)) s += 10;
  if (typeof c.ambition === 'number' && c.ambition > 80) s += 8;
  return s;
}

/** 时空约束·把议题所涉人名逐人纳入并标生死（凌驾史书卒年·防 AI 把在世涉议人说死） */
function _tcAppendMentioned(lines, mentionedNames) {
  if (!Array.isArray(mentionedNames) || mentionedNames.length === 0) return;
  var seen = {}, out = [];
  mentionedNames.forEach(function(nm) {
    if (!nm || typeof nm !== 'string') return;
    nm = nm.trim();
    if (!nm || seen[nm]) return;
    seen[nm] = 1;
    var c = null;
    if (typeof findCharByName === 'function') { try { c = findCharByName(nm); } catch (_) {} }
    if (!c) c = (GM.chars || []).filter(function(x){ return x && x.name === nm; })[0] || null;
    if (!c) { out.push(nm + '（不在人物册·如系历史人物·其生死仍以本局 GM 为准·勿据史书断其存殁）'); return; }
    var dt = (c.deathTurn != null) ? c.deathTurn : c._deathTurn;
    if (c.alive === false || c.dead) out.push(c.name + '（已故·卒于第' + (dt != null ? dt : '?') + '回合）');
    else out.push(c.name + '（在世·此刻活着可行动）');
  });
  if (out.length) lines.push('★ 本议题所涉人物·生死以此为准（凌驾史书卒年）：' + out.join('；'));
}
// 分歧账(V1)·_tcAppendDivergence 的本体移出至 tm-history-events.js(史实域·避免本巨石破 3000 行阈)·此处运行时按 window 全局调用。

/** 时空约束·从议题/上下文文本里有界扫描 GM.chars 已知人名（indexOf 命中·去重·hit 上限 cap≈10），种子名（如发言人）恒保留·供四入口作 mentionedNames */
function _tcScanMentionedNames(text, seedNames, cap) {
  cap = (typeof cap === 'number' && cap > 0) ? cap : 10;
  var out = [], seen = {};
  function add(nm) { if (!nm || typeof nm !== 'string') return; nm = nm.trim(); if (!nm || seen[nm]) return; seen[nm] = 1; out.push(nm); }
  (seedNames || []).forEach(add);                    // 发言人等种子先入·恒保留
  var t = (text == null) ? '' : String(text);
  if (t) {
    var chars = (typeof GM !== 'undefined' && GM.chars) || [];
    var hits = 0;
    for (var i = 0; i < chars.length; i++) {
      if (hits >= cap) break;
      var c = chars[i];
      if (!c || !c.name || c.name.length < 2 || seen[c.name]) continue;
      if (t.indexOf(c.name) >= 0) { add(c.name); hits++; }   // 至少 2 字·防单字误命中
    }
  }
  return out;
}

/** 构建长期行动/长期诏书/长期政策摘要·注入推演 sysP
 * 读 GM._edictTracker 长期条目 + GM.biannianItems 进行中项 + 今日起居注标 长期 tag */
function _buildLongTermActionsDigest() {
  var lines = [];
  // 1. 长期诏书（已颁布但持续影响·或跨回合诏书）
  var longLivingEdicts = (GM._edictTracker || []).filter(function(e) {
    if (!e) return false;
    // 跨回合存活 or 长期影响标记
    if (e._longTerm || e.status === 'executing' || e.status === 'partial') return true;
    // 超过 1 回合未结
    if (e.turn && GM.turn && (GM.turn - e.turn) >= 1 && e.status !== 'completed' && e.status !== 'withdrawn') return true;
    return false;
  });
  if (longLivingEdicts.length > 0) {
    lines.push('【长期诏书·仍在生效】（AI 每回合须重估其此刻效果·不可遗忘）');
    longLivingEdicts.slice(0, 20).forEach(function(e) {
      var dur = GM.turn - e.turn;
      lines.push('  · T' + e.turn + '(已 ' + dur + ' 回合)·' + (e.category || '政令') + '·' + String(e.content || '').slice(0, 100) + (e.feedback ? '·上回合反馈：' + e.feedback.slice(0, 60) : '') + (e.progressPercent != null ? '·进度 ' + e.progressPercent + '%' : ''));
      // 效果曲线（如有记录）
      if (e.effectCurve && Array.isArray(e.effectCurve) && e.effectCurve.length > 0) {
        var recent = e.effectCurve.slice(-3);
        lines.push('    近期效应：' + recent.map(function(pt) { return 'T' + pt.turn + (pt.note ? '=' + String(pt.note).slice(0, 40) : ''); }).join(' → '));
      }
    });
  }
  // 2. 进行中编年项（biannianItems·未 _resolved）
  var activeBN = (GM.biannianItems || []).filter(function(b) { return b && !b._resolved; });
  if (activeBN.length > 0) {
    lines.push('\n【进行中大事·编年长期项】');
    activeBN.slice(0, 12).forEach(function(b) {
      var startT = b.startTurn || b.turn || 0;
      var dur = startT ? (GM.turn - startT) : '?';
      lines.push('  · T' + startT + '(已 ' + dur + ' 回合)·' + (b.title || b.name || '') + '·' + String(b.content || b.desc || '').slice(0, 120));
    });
  }
  // 3. 旅程在途（远地 NPC 未到）
  var travelers = (GM.chars || []).filter(function(c) { return c && c._travelTo; }).slice(0, 8);
  if (travelers.length > 0) {
    lines.push('\n【旅程在途·此处所列角色不可被推演为在京任事·已在路上】');
    travelers.forEach(function(c) {
      // 优先显示剩余天数（新版天数制·_travelRemainingDays）·回退到 _travelArrival（旧版回合制）
      var etaText = '';
      if (typeof c._travelRemainingDays === 'number' && c._travelRemainingDays >= 0) {
        etaText = '·剩 ' + c._travelRemainingDays + ' 日抵';
      } else if (c._travelArrival) {
        etaText = '·预计 T' + c._travelArrival + ' 抵';
      }
      var postText = c._travelAssignPost ? '·待就任 ' + c._travelAssignPost.replace('/', ' ') : '';
      lines.push('  · ' + c.name + '·自' + (c._travelFrom || '?') + '→' + c._travelTo + '·' + (c._travelReason || '') + etaText + postText);
    });
    lines.push('  ※ 已在途者·不得在 char_updates 重复 travelTo（会重置剩余天数）·若需调整目的地请用 reason 说明');
  }
  // 4. 进行中工程/商队/学堂（GM.activeProjects·status=active|planning）
  var activeProjs = (GM.activeProjects || []).filter(function(p){
    return p && (p.status === 'active' || p.status === 'planning');
  }).slice(0, 10);
  if (activeProjs.length > 0) {
    lines.push('\n【进行中工程/项目·必须在 project_updates 中续推 progress·不可重复 status=planning 卡死】');
    activeProjs.forEach(function(p) {
      var elapsed = (p.startTurn ? (GM.turn - p.startTurn) : '?');
      var etaText = (p.endTurn && p.endTurn > GM.turn) ? '·目标 T' + p.endTurn + ' 完工' : '';
      lines.push('  · 【' + (p.type || '工程') + '】' + p.name + '·' + p.status + '·进度 ' + (p.progress || 0) + '%·已 ' + elapsed + ' 回合' + (p.leader ? '·' + p.leader + '督办' : '') + etaText);
    });
    lines.push('  ※ 续推须给新 progress（高于上次）·或写 status=completed/abandoned·不写则系统判为停滞');
  }
  return lines.length > 0 ? lines.join('\n') : '';
}
function renderEraNamesList(){var t=P.time;var el=_$("t-era-list");if(!el)return;var eraList=(t.eraNames||[]);if(!eraList.length){el.innerHTML="<div style=\"color:var(--txt-d);font-size:12px;\">\u6682\u65E0</div>";return;}el.innerHTML=eraList.map(function(e,i){return "<div style=\"display:flex;gap:6px;align-items:center;margin-bottom:3px;\">"+"<input id=\"t-era-n-"+i+"\" value=\""+((e&&e.name)||"")+"\" placeholder=\"\u5E74\u53F7\u540D\" style=\"width:80px\">"+"<input type=\"number\" id=\"t-era-y-"+i+"\" value=\""+((e&&e.startYear)||0)+"\" placeholder=\"\u5E74\" style=\"width:60px\">"+"<input type=\"number\" id=\"t-era-m-"+i+"\" value=\""+((e&&e.startMonth)||1)+"\" placeholder=\"\u6708\" style=\"width:44px\">"+"<input type=\"number\" id=\"t-era-d-"+i+"\" value=\""+((e&&e.startDay)||1)+"\" placeholder=\"\u65e5\" style=\"width:44px\">"+"<button class=\"bd bsm\" onclick=\"_eraUpd("+i+")\">\u4FDD</button>"+"<button class=\"bd bsm\" onclick=\"_eraDel("+i+")\">\u5220</button>"+"</div>";}).join("");}window._eraAdd=function(){if(!P.time.eraNames)P.time.eraNames=[];P.time.eraNames.push({name:"",startYear:P.time.year,startMonth:1,startDay:1});renderEraNamesList();};window._eraDel=function(i){if(!P.time.eraNames)return;P.time.eraNames.splice(i,1);renderEraNamesList();};window._eraUpd=function(i){var e=P.time.eraNames[i];if(!e)return;var n=document.getElementById("t-era-n-"+i);if(n)e.name=n.value;var y=document.getElementById("t-era-y-"+i);if(y)e.startYear=+y.value||P.time.year;var m=document.getElementById("t-era-m-"+i);if(m)e.startMonth=+m.value||1;var d=document.getElementById("t-era-d-"+i);if(d)e.startDay=+d.value||1;saveT();};function saveT(){var t=P.time;var ids=["t-year","t-prefix","t-suffix","t-per-turn","t-seasons","t-start-s","t-reign","t-reign-y","t-display","t-template","t-start-month","t-start-day"];ids.forEach(function(id){var el=_$(id);if(!el)return;var v=el.value;if(id==="t-year")t.year=+v;else if(id==="t-prefix")t.prefix=v;else if(id==="t-suffix")t.suffix=v;else if(id==="t-per-turn")t.perTurn=v;else if(id==="t-seasons")t.seasons=v.split(",").map(function(s){return s.trim();});else if(id==="t-start-s")t.startS=+v;else if(id==="t-reign")t.reign=v;else if(id==="t-reign-y")t.reignY=+v;else if(id==="t-display")t.display=v;else if(id==="t-template")t.template=v;else if(id==="t-start-month")t.startMonth=+v||1;else if(id==="t-start-day")t.startDay=+v||1;});var egz=_$("t-enable-ganzhi");if(egz)t.enableGanzhi=egz.checked;var egzd=_$("t-enable-ganzhi-day");if(egzd)t.enableGanzhiDay=egzd.checked;var een=_$("t-enable-era-name");if(een)t.enableEraName=een.checked;toast("\u5DF2\u4FDD\u5B58");}
function loadT(){var t=P.time;var map={"t-year":t.year,"t-prefix":t.prefix||"","t-suffix":t.suffix||"","t-per-turn":t.perTurn||"1s","t-seasons":(t.seasons||[]).join(","),"t-start-s":t.startS||0,"t-reign":t.reign||"","t-reign-y":t.reignY||1,"t-display":t.display||"year_season","t-template":t.template||"","t-start-month":t.startMonth||1,"t-start-day":t.startDay||1};Object.keys(map).forEach(function(id){var el=_$(id);if(el)el.value=map[id];});var egz=_$("t-enable-ganzhi");if(egz)egz.checked=!!t.enableGanzhi;var egzd=_$("t-enable-ganzhi-day");if(egzd)egzd.checked=!!t.enableGanzhiDay;var een=_$("t-enable-era-name");if(een)een.checked=!!t.enableEraName;renderEraNamesList();}

// ============================================================
//  模型上下文/输出探测系统 + 压缩参数 + runSelfTests —— 第二十三拆迁出
//  → tm-ai-infra-model-detect.js（顶层函数型中段切·保序切割·sibling 紧随本文件之后装载·函数全局可见）
// ============================================================

// ============================================================
//  8.2 TM 统一命名空间
// ============================================================
//  全局图片生成API（独立于主文本API，编辑器和游戏通用）
// ============================================================
var ImageAPI = {
  /** 生图端点归一化（2026-07-10 治「填基址→POST 到基址→404」）：
      既收基址(https://api.x.com 或 …/v1 → 自动补 /v1/images/generations)·也收完整端点(…/images/generations 原样用)。
      ★editor-authoring-agent.js generateImage 有同规镜像·改此处须同步。 */
  normalizeUrl: function(u) {
    u = String(u || '').trim().replace(/\/+$/, '');
    if (!u) return u;
    if (/\/images\/(generations|edits|variations)$/i.test(u)) return u;
    if (!/\/v\d+(beta)?$/i.test(u)) u += '/v1';
    return u + '/images/generations';
  },
  /** 获取生图API配置 */
  getConfig: function() {
    var imgCfg = {};
    try { imgCfg = JSON.parse(localStorage.getItem('tm_api_image') || '{}'); } catch(e) {}
    var mainCfg = {};
    try { mainCfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) {}
    if (typeof P !== 'undefined' && P.ai) mainCfg = P.ai;
    // 填了生图 URL 就以它为准；Key 留空复用主 API 的 Key（设置页 2026-07-10 指引承诺·此前 Key 留空时 URL 被整个无视→落主API推断→404）
    if (imgCfg.url) {
      var _ik = imgCfg.key || mainCfg.key || '';
      if (_ik) return {supported: true, key: _ik, url: this.normalizeUrl(imgCfg.url), model: imgCfg.model || 'dall-e-3', keyInherited: !imgCfg.key};
    }
    // 回退到主API
    var mainUrl = (mainCfg.url || '').toLowerCase();
    if (mainUrl.indexOf('openai.com') >= 0 && mainCfg.key) {
      return {supported: true, key: mainCfg.key, url: 'https://api.openai.com/v1/images/generations', model: 'dall-e-3', inferred: true};
    }
    if (mainCfg.key && mainUrl) {
      var baseUrl = mainUrl.replace(/\/chat\/completions.*$/, '').replace(/\/v1\/.*$/, '').replace(/\/+$/, '');
      return {supported: true, key: mainCfg.key, url: baseUrl + '/v1/images/generations', model: 'dall-e-3', inferred: true, uncertain: true};
    }
    return {supported: false};
  },
  /** 生成图片（返回Promise<dataUrl>） */
  generate: function(prompt, options) {
    var cfg = this.getConfig();
    if (!cfg.supported) return Promise.reject(new Error('\u672A\u914D\u7F6E\u751F\u56FEAPI'));
    options = options || {};
    return fetch(cfg.url, {
      method: 'POST',
      headers: {'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key},
      body: JSON.stringify({
        model: cfg.model || 'dall-e-3',
        prompt: 'STYLE: Ultra-photorealistic photograph, NOT illustration/cartoon/anime/painting/3D render. Must look like a real person photographed by a camera. ' + prompt,
        n: 1,
        size: options.size || '1024x1024',
        quality: options.quality || 'hd',
        style: 'natural',
        response_format: 'b64_json'
      })
    }).then(function(resp) {
      if (!resp.ok) return resp.json().catch(function(){ return {}; }).then(function(e) { throw new Error((e.error && e.error.message) || resp.status + ' ' + resp.statusText); });
      return resp.json();
    }).then(function(data) {
      if (data.data && data.data[0]) {
        if (data.data[0].b64_json) return 'data:image/png;base64,' + data.data[0].b64_json;
        if (data.data[0].url) return data.data[0].url;
      }
      throw new Error('\u56FE\u7247\u751F\u6210\u8FD4\u56DE\u683C\u5F0F\u5F02\u5E38');
    });
  }
};

//  将散落的全局函数归入命名空间，保持旧全局名向后兼容
//  R114 (2026-04-24): 改 "var TM = {...}" 为 "Object.assign(TM, {...})"
//  原因：tm-diagnostics-foundation.js 先于 tm-utils.js 加载后会设置 TM.errors，
//  若此处整体覆盖 TM 会把 errors 字段抹掉。改为 merge 模式。
// ============================================================
// ============================================================
//  End-turn AI diagnostics ledger
// ============================================================
function memoryEntryText(entry) {
  if (entry == null) return '';
  if (typeof entry === 'string') return entry;
  return String(entry.content || entry.text || entry.summary || entry.title || entry.description || '');
}

function normalizeGlobalMemoryEntry(entry, defaults) {
  defaults = defaults || {};
  var obj = (entry && typeof entry === 'object') ? entry : { text: entry };
  return {
    turn: obj.turn || defaults.turn || ((typeof GM !== 'undefined' && GM && GM.turn) || 0),
    type: obj.type || defaults.type || 'note',
    text: memoryEntryText(obj),
    source: obj.source || defaults.source || '',
    priority: obj.priority || defaults.priority || '',
    raw: obj
  };
}

function buildMemoryDiagnosticSnapshot(G) {
  G = G || ((typeof GM !== 'undefined') ? GM : null);
  if (!G) return null;
  function _arr(v) { return Array.isArray(v) ? v : []; }
  function _blankCount(arr) {
    return _arr(arr).filter(function(x) { return !memoryEntryText(x); }).length;
  }
  function _countType(arr, type) {
    return _arr(arr).filter(function(x) { return x && x.type === type; }).length;
  }
  var recall = (G._turnAiResults && Array.isArray(G._turnAiResults.recallResults)) ? G._turnAiResults.recallResults : [];
  var recallHits = recall.reduce(function(sum, r) { return sum + ((r && Array.isArray(r.hits)) ? r.hits.length : 0); }, 0);
  var sem = null;
  try {
    if (typeof SemanticRecall !== 'undefined' && SemanticRecall && typeof SemanticRecall.status === 'function') sem = SemanticRecall.status();
  } catch(_) {}
  var ML = G._memoryLayers || {};
  return {
    turn: G.turn || 0,
    aiMemory: { total: _arr(G._aiMemory).length, compressed: _countType(G._aiMemory, 'compressed'), blank: _blankCount(G._aiMemory) },
    foreshadows: { total: _arr(G._foreshadows).length, compressed: _countType(G._foreshadows, 'compressed'), blank: _blankCount(G._foreshadows) },
    consolidated: { total: _arr(G._consolidatedMemory).length },
    layers: { L1: _arr(ML.L1).length, L2: _arr(ML.L2).length, L3: _arr(ML.L3).length },
    personalArchive: { total: _arr(G._memoryArchiveFull).length },
    recall: { queries: recall.length, hits: recallHits },
    semantic: sem ? { enabled: !!sem.enabled, modelReady: !!sem.modelReady, indexSize: sem.indexSize || 0, error: sem.error || '' } : null,
    postTurnJobs: (G._postTurnJobs && Array.isArray(G._postTurnJobs.pending)) ? { pending: G._postTurnJobs.pending.length, turn: G._postTurnJobs.turn || G.turn || 0 } : null
  };
}

function ensureAIDiagnostics(turn) {
  var G = (typeof GM !== 'undefined') ? GM : null;
  if (!G) return null;
  var t = turn || G.turn || 0;
  var d = G._lastAIDiagnostics;
  if (!d || d.turn !== t) {
    d = G._lastAIDiagnostics = {
      turn: t,
      main: 'pending',
      branches: {},
      calls: [],
      warnings: [],
      hints: [],
      repairedJson: [],
      failedWrites: [],
      memory: { events: [], snapshots: [] },
      generatedAt: Date.now()
    };
  }
  d.branches = d.branches || {};
  d.calls = Array.isArray(d.calls) ? d.calls : [];
  d.warnings = Array.isArray(d.warnings) ? d.warnings : [];
  d.hints = Array.isArray(d.hints) ? d.hints : [];
  d.repairedJson = Array.isArray(d.repairedJson) ? d.repairedJson : [];
  d.failedWrites = Array.isArray(d.failedWrites) ? d.failedWrites : [];
  // Phase 1 Q2·subcallErrors[]·按 subcall id 分组的错误日志·诊断面板可见
  d.subcallErrors = Array.isArray(d.subcallErrors) ? d.subcallErrors : [];
  // Phase 7·"全部历史" 持久化到 localStorage·避免 turn 切换丢失·容量 200
  try {
    if (typeof localStorage !== 'undefined' && d.subcallErrors.length > 0 && d._lastPersistLen !== d.subcallErrors.length) {
      var existing = [];
      try { existing = JSON.parse(localStorage.getItem('tianming_subcallErrors_history') || '[]'); } catch(_) {}
      var merged = existing.concat(d.subcallErrors.slice(d._lastPersistLen || 0));
      if (merged.length > 200) merged = merged.slice(-200);
      localStorage.setItem('tianming_subcallErrors_history', JSON.stringify(merged));
      d._lastPersistLen = d.subcallErrors.length;
    }
  } catch(_persistE) {}
  d.memory = d.memory || { events: [], snapshots: [] };
  d.memory.events = Array.isArray(d.memory.events) ? d.memory.events : [];
  d.memory.snapshots = Array.isArray(d.memory.snapshots) ? d.memory.snapshots : [];
  return d;
}

// Phase 7·完整 4 区成本面板·读 GM._costHistory + TokenUsageTracker.getSnapshot + GM._turnAiResults
// 调用方·设置面板"AI 成本面板"按钮·或 TM.ai.showCostPanel()
function _escForCostPanel(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _formatCostMoney(n) {
  if (typeof n !== 'number' || !isFinite(n)) return '$0';
  return '$' + (n < 0.01 ? n.toFixed(4) : n.toFixed(3));
}
function _formatCostTime(ms) {
  if (typeof ms !== 'number' || !isFinite(ms) || ms < 0) return '0ms';
  if (ms < 1000) return Math.round(ms) + 'ms';
  return (ms / 1000).toFixed(1) + 's';
}
function _buildAICostPanelHTML() {
  var G = (typeof GM !== 'undefined') ? GM : null;
  var costHistory = (G && Array.isArray(G._costHistory)) ? G._costHistory : [];
  var stats = (typeof TokenUsageTracker !== 'undefined' && TokenUsageTracker.getSnapshot) ? TokenUsageTracker.getSnapshot() : null;
  var d = (typeof ensureAIDiagnostics === 'function') ? ensureAIDiagnostics() : null;
  var currentTurn = G ? (G.turn || 0) : 0;
  var P_ = (typeof P !== 'undefined') ? P : null;
  var aiCfg = (P_ && P_.ai) || {};
  var conf = (P_ && P_.conf) || {};
  var depth = conf.aiCallDepth || 'full';
  var depthCalls = depth === 'lite' ? 8 : (depth === 'standard' ? 11 : 17);
  var depthEst = depth === 'lite' ? 0.10 : (depth === 'standard' ? 0.15 : 0.21);
  var html = '';
  html += '<div id="ai-cost-panel-backdrop" style="position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.55);z-index:9998;display:flex;align-items:center;justify-content:center;" onclick="if(event.target===this){var el=document.getElementById(\'ai-cost-panel-backdrop\');if(el)el.remove();}">';
  html += '<div style="background:var(--ink-900,#1a1812);color:var(--ink-50,#e8e0d0);border:1px solid var(--ink-700,#4a4030);border-radius:6px;padding:1rem 1.2rem;max-width:680px;width:96vw;max-height:88vh;overflow:auto;font-family:inherit;font-size:0.85rem;" onclick="event.stopPropagation();">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:0.6rem;border-bottom:1px solid var(--ink-700,#4a4030);padding-bottom:0.4rem;"><strong style="font-size:1rem;">AI 成本面板·诊断</strong><button onclick="document.getElementById(\'ai-cost-panel-backdrop\').remove()" style="background:transparent;color:var(--ink-300,#aaa);border:none;cursor:pointer;font-size:1.2rem;">×</button></div>';
  // ─── 区1·智能档位 ───
  html += '<details open style="margin-bottom:0.6rem;border-left:3px solid #8b6914;padding-left:0.6rem;"><summary style="cursor:pointer;font-weight:600;color:#d4a843;">区1·智能档位</summary>';
  html += '<div style="padding:0.4rem 0;line-height:1.6;">';
  html += '当前深度·<strong>' + _escForCostPanel(depth) + '</strong>·预估 <strong>' + depthCalls + '</strong> 调用·~<strong>' + _formatCostMoney(depthEst) + '</strong>/回合<br/>';
  html += '模型档位·<strong>' + _escForCostPanel(conf.modelTier || 'auto') + '</strong><br/>';
  html += '<span style="color:var(--ink-300,#aaa);font-size:0.78rem;">改档位请用设置面板·此面板为只读总览</span>';
  html += '</div></details>';
  // ─── 区2·推演深度细调 (折叠) ───
  html += '<details style="margin-bottom:0.6rem;border-left:3px solid #5a6e3a;padding-left:0.6rem;"><summary style="cursor:pointer;font-weight:600;color:#8fae5a;">区2·推演深度细调 (高级)</summary>';
  html += '<div style="padding:0.4rem 0;line-height:1.6;font-size:0.78rem;">';
  html += '· sc1q 对话回看·<strong>' + (conf.dialogueRecallTurns || 3) + '</strong> 回合<br/>';
  html += '· strictSchema·<strong>' + (conf.strictSchemaEnabled ? '启用' : '关') + '</strong> (P.conf.strictSchemaEnabled)<br/>';
  html += '· stream_sc1·<strong>' + (aiCfg.stream_sc1 === true ? '开' : '关') + '</strong>·sc1OwnedBySc1b·<strong>' + (aiCfg.sc1OwnedBySc1b !== false ? '开' : '关') + '</strong>·sc1OwnedBySc1c·<strong>' + (aiCfg.sc1OwnedBySc1c !== false ? '开' : '关') + '</strong><br/>';
  html += '· sc17Skip·<strong>' + (aiCfg.sc17Skip !== false ? '开' : '关') + '</strong>·sc25cEnabled·<strong>' + (aiCfg.sc25cEnabled !== false ? '开' : '关') + '</strong>·sc15nEnabled·<strong>' + (aiCfg.sc15nEnabled === true ? '开' : '关') + '</strong><br/>';
  html += '· sc16Lite·<strong>' + (aiCfg.sc16Lite === true ? '开' : '关') + '</strong>·sc18Lite·<strong>' + (aiCfg.sc18Lite === true ? '开' : '关') + '</strong>·sc2Pipeline·<strong>' + _escForCostPanel(aiCfg.sc2Pipeline || 'legacy') + '</strong>·openaiStrict·<strong>' + (aiCfg.openaiStrict === true ? '开' : '关') + '</strong>';
  html += '</div></details>';
  // ─── 区3·性能成本控制 ───
  html += '<details open style="margin-bottom:0.6rem;border-left:3px solid #8b3a4a;padding-left:0.6rem;"><summary style="cursor:pointer;font-weight:600;color:#d4768a;">区3·性能成本控制</summary>';
  html += '<div style="padding:0.4rem 0;line-height:1.7;">';
  if (stats) {
    var alertTh = conf.costAlertThreshold || 0.5;
    var curUsage = TokenUsageTracker.getTurnUsage ? TokenUsageTracker.getTurnUsage() : 0;
    var curCost = (curUsage * 5 / 1000000);  // 粗估·avg $5/M
    var costFlag = curCost > alertTh ? ' <span style="color:#ff7766;">⚠ 超阈值</span>' : '';
    html += '本回合·<strong>' + curUsage + '</strong> tokens·~<strong>' + _formatCostMoney(curCost) + '</strong>' + costFlag + '<br/>';
    html += '累计·<strong>' + stats.totalTokens + '</strong> tokens·<strong>' + stats.totalCalls + '</strong> 调用·~<strong>' + _formatCostMoney(stats.estimatedCostUSD) + '</strong><br/>';
    html += '<span style="color:var(--ink-300,#aaa);font-size:0.78rem;">阈值·' + _formatCostMoney(alertTh) + '/回合</span>';
  } else {
    html += '<span style="color:var(--ink-300,#aaa);">TokenUsageTracker 未加载</span>';
  }
  // 成本历史·折叠
  if (costHistory.length > 0) {
    var maxCalls = costHistory.reduce(function(m, e) { return Math.max(m, e.totalCalls || 0); }, 1);
    html += '<details style="margin-top:0.5rem;"><summary style="cursor:pointer;color:#d4a843;font-size:0.82rem;">成本历史·最近 ' + costHistory.length + ' 回合 (点开)</summary>';
    html += '<div style="margin-top:0.3rem;font-family:monospace;font-size:0.74rem;line-height:1.4;">';
    costHistory.slice(-15).forEach(function(e) {
      var bar = '█'.repeat(Math.max(1, Math.round(((e.totalCalls || 0) / maxCalls) * 12)));
      var costEst = e.tokenUsage ? (e.tokenUsage.totalTokens * 5 / 1000000) : 0;
      html += 'T' + (e.turn || '?') + '·' + bar.padEnd(13) + '·' + (e.totalCalls || 0) + ' 调用·' + _formatCostTime(e.totalTimeMs || 0) + (costEst > 0 ? '·~' + _formatCostMoney(costEst) : '') + (e.errors ? '·错' + e.errors : '') + (e.sc1StrictFallback ? '·strict↓' : '') + '<br/>';
    });
    html += '</div></details>';
  }
  // 按 subcall 拆分
  if (stats && stats.byId && Object.keys(stats.byId).length > 0) {
    html += '<details style="margin-top:0.4rem;"><summary style="cursor:pointer;color:#d4a843;font-size:0.82rem;">按 subcall 拆分</summary>';
    html += '<div style="margin-top:0.3rem;font-family:monospace;font-size:0.74rem;line-height:1.4;">';
    var sortedIds = Object.keys(stats.byId).sort(function(a, b) { return (stats.byId[b].estimatedCostUSD || 0) - (stats.byId[a].estimatedCostUSD || 0); });
    sortedIds.slice(0, 15).forEach(function(id) {
      var b = stats.byId[id];
      html += _escForCostPanel(id).padEnd(20) + ' ' + (b.calls || 0) + '次·' + (b.promptTokens + b.completionTokens) + ' tok·' + _formatCostMoney(b.estimatedCostUSD) + '<br/>';
    });
    html += '</div></details>';
  }
  // 导出按钮
  html += '<div style="margin-top:0.6rem;"><button onclick="if(window.TM&&TM.ai&&TM.ai.exportDiagnostics){TM.ai.exportDiagnostics();}else if(typeof exportAIDiagnosticsJSON===\'function\'){exportAIDiagnosticsJSON();}" style="background:#5a3520;color:#e8e0d0;border:1px solid #8b5028;padding:0.3rem 0.8rem;border-radius:3px;cursor:pointer;font-size:0.82rem;">↓ 导出 AI 诊断 JSON</button></div>';
  html += '</div></details>';
  // ─── 区4·诊断 (debug) ───
  html += '<details style="margin-bottom:0.3rem;border-left:3px solid #4a5a8a;padding-left:0.6rem;"><summary style="cursor:pointer;font-weight:600;color:#8aa8d8;">区4·诊断 (debug·错误日志)</summary>';
  html += '<div style="padding:0.4rem 0;font-size:0.78rem;line-height:1.5;">';
  // GM 状态摘要
  if (G) {
    html += 'sc28 snapshot·' + (G._lastSc28Snapshot ? 'T' + G._lastSc28Snapshot.turn : '无') + '<br/>';
    html += 'sc25c·' + (G._turnAiResults && G._turnAiResults.subcall25c ? (G._turnAiResults.subcall25c._dualCallSucceeded ? '双调用成功' : '部分') : '无') + '<br/>';
    html += 'sc1q·' + (G._turnAiResults && G._turnAiResults.subcall1q ? ((G._turnAiResults.subcall1q.dialogue_commitments||[]).length + ' 承诺') : '无') + '·missed·' + ((G._sc1qMissedLastTurn||[]).length) + '<br/>';
    html += 'strict fallback·' + (G._turnAiResults && G._turnAiResults._sc1StrictFallback ? '本回合触发' : '未触发') + '<br/>';
    html += 'sysP cache·' + _escForCostPanel(G._sysCacheMode || 'none') + '<br/>';
  }
  // 错误日志
  if (d && Array.isArray(d.subcallErrors) && d.subcallErrors.length > 0) {
    html += '<div style="margin-top:0.5rem;color:#d4a843;font-weight:600;font-size:0.78rem;">subcall 错误 (最近 ' + Math.min(10, d.subcallErrors.length) + '·共 ' + d.subcallErrors.length + ')·</div>';
    html += '<div style="margin-top:0.2rem;font-family:monospace;font-size:0.72rem;line-height:1.4;max-height:120px;overflow:auto;">';
    d.subcallErrors.slice(-10).forEach(function(e) {
      html += '[' + _escForCostPanel(e.subcall) + ':' + _escForCostPanel(e.phase) + '] ' + _escForCostPanel(String(e.err).slice(0, 150)) + '<br/>';
    });
    html += '</div>';
  }
  html += '</div></details>';
  html += '<div style="text-align:right;margin-top:0.5rem;font-size:0.72rem;color:var(--ink-400,#888);">T' + currentTurn + ' · ' + new Date().toLocaleString() + '</div>';
  html += '</div></div>';
  return html;
}
function showAICostPanel() {
  if (typeof document === 'undefined') return;
  var prev = document.getElementById('ai-cost-panel-backdrop');
  if (prev) prev.remove();
  var html = _buildAICostPanelHTML();
  var div = document.createElement('div');
  div.innerHTML = html;
  document.body.appendChild(div.firstChild);
}

// Phase 7.5 D·sysP cache 失效·P.ai.prompt / P.ai.rules / summaryRule 改后清 GM._lastSysPHash
// 让下回合 _maybeCacheSys 知道 sys 变了·不再走 anthropic cache_control (避免无效命中)
function clearSysPCacheHash() {
  try {
    if (typeof GM !== 'undefined' && GM) {
      delete GM._lastSysPHash;
      GM._sysCacheInvalidatedAt = Date.now();
    }
    if (typeof toast === 'function') toast('sysP cache 已清·下回合首次调用多花 ~$0.004');
  } catch(_) {}
}

// Phase 7·导出本回合 AI 诊断 JSON·便于玩家上报 bug 时附数据
// 调用方·设置面板"导出 AI 日志"按钮·UI 触发 window.exportAIDiagnosticsJSON()
function exportAIDiagnosticsJSON() {
  var G = (typeof GM !== 'undefined') ? GM : null;
  var d = (typeof ensureAIDiagnostics === 'function') ? ensureAIDiagnostics() : null;
  var payload = {
    exportedAt: new Date().toISOString(),
    turn: G ? (G.turn || 0) : 0,
    diagnostics: d || null,
    costHistory: G ? (Array.isArray(G._costHistory) ? G._costHistory.slice(-20) : []) : [],
    // Phase 7·"全部历史"·从 localStorage 读
    persistedErrorHistory: (function(){ try { return JSON.parse(localStorage.getItem('tianming_subcallErrors_history') || '[]'); } catch(_){ return []; } })(),
    subcallTimings: G ? (G._subcallTimings || {}) : {},
    aiDispatchStats: G ? (G._aiDispatchStats || {}) : {},
    lastSc28Snapshot: G ? (G._lastSc28Snapshot || null) : null,
    sc1qMissedLastTurn: G ? (G._sc1qMissedLastTurn || []) : [],
    sysCacheMode: G ? (G._sysCacheMode || 'none') : 'none',
    // 当前 P.ai opt-in flags
    flags: (typeof P !== 'undefined' && P && P.ai) ? {
      stream_sc1: P.ai.stream_sc1,
      sc1OwnedBySc1b: P.ai.sc1OwnedBySc1b,
      sc1OwnedBySc1c: P.ai.sc1OwnedBySc1c,
      sc17Skip: P.ai.sc17Skip,
      sc16Lite: P.ai.sc16Lite,
      sc25cEnabled: P.ai.sc25cEnabled,
      sc15nEnabled: P.ai.sc15nEnabled,
      sc2Pipeline: P.ai.sc2Pipeline,
      openaiStrict: P.ai.openaiStrict
    } : null
  };
  var blob = null;
  try { blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }); } catch(_) {}
  if (blob && typeof URL !== 'undefined' && URL.createObjectURL) {
    try {
      var url = URL.createObjectURL(blob);
      if (typeof document !== 'undefined') {
        var a = document.createElement('a');
        a.href = url;
        a.download = 'tianming-ai-diagnostics-T' + payload.turn + '-' + Date.now() + '.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
      }
      if (typeof toast === 'function') toast('AI 诊断 JSON 已导出');
      return payload;
    } catch(_e) { try { console.warn('[exportAIDiagnostics] download fail·return payload', _e); } catch(_){} }
  }
  // fallback·返回 payload object·控制台显示
  if (typeof console !== 'undefined' && console.log) console.log('[AI Diagnostics Export]', JSON.stringify(payload, null, 2));
  return payload;
}

// Phase 1 Q2 + Phase 7·把 ctx.meta.errors 集中 push 到诊断面板·按 subcall id + category 分组
// category·parse (JSON 解析失败) / timeout (超时) / http_4xx / http_5xx / network / validate (schema 校验失败) / other
function _classifySubcallError(err) {
  var msg = String((err && err.message) || err || '').toLowerCase();
  if (/timeout|aborted|timed out/.test(msg)) return 'timeout';
  if (/http\s*4\d{2}/.test(msg) || /\b400\b|\b401\b|\b403\b|\b404\b|\b429\b/.test(msg)) return 'http_4xx';
  if (/http\s*5\d{2}/.test(msg) || /\b500\b|\b502\b|\b503\b|\b504\b/.test(msg)) return 'http_5xx';
  if (/network|fetch|failed to fetch/.test(msg)) return 'network';
  if (/parse|json|expected|unterminated|repair/.test(msg)) return 'parse';
  if (/schema|validate|strict/.test(msg)) return 'validate';
  return 'other';
}
function recordSubcallError(subcall, phase, err) {
  var d = (typeof ensureAIDiagnostics === 'function') ? ensureAIDiagnostics() : null;
  if (!d) return null;
  var msg = (err && err.message) || String(err || 'unknown');
  var category = _classifySubcallError(err);
  d.subcallErrors.push({
    subcall: String(subcall || 'unknown'),
    phase: String(phase || ''),
    category: category,
    err: msg.slice(0, 280),
    at: Date.now()
  });
  // 容量保护·只保留最近 60 项
  if (d.subcallErrors.length > 60) d.subcallErrors = d.subcallErrors.slice(-60);
  // 按 category 累计·便于 dashboard 显示
  d.errorsByCategory = d.errorsByCategory || {};
  d.errorsByCategory[category] = (d.errorsByCategory[category] || 0) + 1;
  d.errorsBySubcall = d.errorsBySubcall || {};
  var sk = String(subcall || 'unknown');
  d.errorsBySubcall[sk] = (d.errorsBySubcall[sk] || 0) + 1;
  return d;
}

function recordAIDiagnostic(kind, payload) {
  var d = ensureAIDiagnostics();
  if (!d) return null;
  payload = payload || {};
  payload.kind = kind || 'note';
  payload.at = Date.now();
  if (kind === 'call') d.calls.push(payload);
  else if (kind === 'write_gate') d.failedWrites.push(payload);
  else if (kind === 'write_hint') d.hints.push(payload);
  else if (kind === 'json_repair') d.repairedJson.push(payload);
  else d.warnings.push(payload);
  if (d.calls.length > 80) d.calls = d.calls.slice(-80);
  if (d.warnings.length > 80) d.warnings = d.warnings.slice(-80);
  if (d.hints.length > 80) d.hints = d.hints.slice(-80);
  if (d.repairedJson.length > 80) d.repairedJson = d.repairedJson.slice(-80);
  if (d.failedWrites.length > 80) d.failedWrites = d.failedWrites.slice(-80);
  return d;
}

function recordMemoryDiagnostic(kind, payload) {
  var d = ensureAIDiagnostics();
  if (!d) return null;
  var G = (typeof GM !== 'undefined') ? GM : null;
  payload = payload || {};
  payload.kind = kind || 'memory';
  payload.at = Date.now();
  d.memory = d.memory || { events: [], snapshots: [] };
  d.memory.events = Array.isArray(d.memory.events) ? d.memory.events : [];
  d.memory.snapshots = Array.isArray(d.memory.snapshots) ? d.memory.snapshots : [];
  d.memory.events.push(payload);
  if (payload.snapshot) d.memory.snapshots.push(payload.snapshot);
  if (G) {
    G._memoryDiagnosticsLog = Array.isArray(G._memoryDiagnosticsLog) ? G._memoryDiagnosticsLog : [];
    G._memoryDiagnosticsLog.push(payload);
    if (G._memoryDiagnosticsLog.length > 120) G._memoryDiagnosticsLog = G._memoryDiagnosticsLog.slice(-120);
  }
  if (d.memory.events.length > 80) d.memory.events = d.memory.events.slice(-80);
  if (d.memory.snapshots.length > 20) d.memory.snapshots = d.memory.snapshots.slice(-20);
  return d;
}

function openMemoryDiagnostics() {
  var snap = (typeof buildMemoryDiagnosticSnapshot === 'function') ? buildMemoryDiagnosticSnapshot() : null;
  var d = (typeof ensureAIDiagnostics === 'function') ? ensureAIDiagnostics() : null;
  var events = d && d.memory && Array.isArray(d.memory.events) ? d.memory.events.slice(-30) : [];
  var log = (typeof GM !== 'undefined' && GM && Array.isArray(GM._memoryDiagnosticsLog)) ? GM._memoryDiagnosticsLog.slice(-50) : [];
  var esc = (typeof escHtml === 'function') ? escHtml : function(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function(ch) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch];
    });
  };
  var payload = { snapshot: snap, recentEvents: events, recentLog: log };
  var text = JSON.stringify(payload, null, 2);
  if (typeof openGenericModal === 'function') {
    openGenericModal('记忆诊断', '<pre style="white-space:pre-wrap;max-height:60vh;overflow:auto;font-size:12px;line-height:1.5;">' + esc(text) + '</pre>');
  } else {
    if (typeof console !== 'undefined' && console.log) console.log('[MemoryDiagnostics]', payload);
    if (typeof toast === 'function') toast('记忆诊断已输出到控制台');
  }
  return payload;
}

function setAIBranchDiagnostic(branch, status, detail) {
  var d = ensureAIDiagnostics();
  if (!d || !branch) return null;
  d.branches[branch] = {
    status: status || 'unknown',
    detail: detail || '',
    at: Date.now()
  };
  if (branch === 'main') d.main = status || d.main;
  return d;
}

if (typeof window !== 'undefined') window.TM = window.TM || {};
else if (typeof globalThis !== 'undefined') globalThis.TM = globalThis.TM || {};
Object.assign(TM, {
  // --- 核心工具 ---
  utils: {
    clamp: typeof clamp === 'function' ? clamp : function(v,min,max){return Math.max(min,Math.min(max,v));},
    uid: typeof uid === 'function' ? uid : null,
    escHtml: typeof escHtml === 'function' ? escHtml : null,
    random: typeof random === 'function' ? random : Math.random,
    deepClone: typeof deepClone === 'function' ? deepClone : null,
    toast: typeof toast === 'function' ? toast : null,
    robustParseJSON: typeof robustParseJSON === 'function' ? robustParseJSON : null,
    sanitizeNumericDelta: typeof sanitizeNumericDelta === 'function' ? sanitizeNumericDelta : null
  },
  // --- 时间系统 ---
  time: {
    getDaysPerTurn: typeof _getDaysPerTurn === 'function' ? _getDaysPerTurn : null,
    turnsForDuration: typeof turnsForDuration === 'function' ? turnsForDuration : null,
    getTimeRatio: typeof getTimeRatio === 'function' ? getTimeRatio : null,
    calcDateFromTurn: typeof calcDateFromTurn === 'function' ? calcDateFromTurn : null,
    getTSText: typeof getTSText === 'function' ? getTSText : null
  },
  // --- 经济系统（函数在tm-economy-military.js中定义，加载后填充） ---
  economy: {},
  // --- 军事系统（同上） ---
  military: {},
  // --- NPC系统（函数在tm-endturn.js/tm-npc-engine.js中定义） ---
  npc: {},
  // --- 角色/势力查找 ---
  find: {
    char: typeof findCharByName === 'function' ? findCharByName : null,
    faction: typeof findFacByName === 'function' ? findFacByName : null,
    office: typeof findOfficeByFunction === 'function' ? findOfficeByFunction : null
  },
  // --- AI系统 ---
  ai: {
    call: typeof callAI === 'function' ? callAI : null,
    callSmart: typeof callAISmart === 'function' ? callAISmart : null,
    callMessages: typeof callAIMessages === 'function' ? callAIMessages : null,
    subCallRegistry: typeof AISubCallRegistry !== 'undefined' ? AISubCallRegistry : null,
    modelAdapter: typeof ModelAdapter !== 'undefined' ? ModelAdapter : null,
    tokenTracker: typeof TokenUsageTracker !== 'undefined' ? TokenUsageTracker : null,
    ensureDiagnostics: typeof ensureAIDiagnostics === 'function' ? ensureAIDiagnostics : null,
    recordDiagnostic: typeof recordAIDiagnostic === 'function' ? recordAIDiagnostic : null,
    setBranchDiagnostic: typeof setAIBranchDiagnostic === 'function' ? setAIBranchDiagnostic : null,
    // Phase 7·诊断 export 公开 API
    exportDiagnostics: typeof exportAIDiagnosticsJSON === 'function' ? exportAIDiagnosticsJSON : null,
    recordSubcallError: typeof recordSubcallError === 'function' ? recordSubcallError : null,
    // Phase 7·4 区成本面板·设置面板按钮 + 控制台直接调
    showCostPanel: typeof showAICostPanel === 'function' ? showAICostPanel : null,
    // Phase 7.5 D·sysP cache hash 失效·prompt 编辑后调
    clearSysPCacheHash: typeof clearSysPCacheHash === 'function' ? clearSysPCacheHash : null,
    memoryEntryText: typeof memoryEntryText === 'function' ? memoryEntryText : null,
    normalizeGlobalMemoryEntry: typeof normalizeGlobalMemoryEntry === 'function' ? normalizeGlobalMemoryEntry : null,
    buildMemoryDiagnosticSnapshot: typeof buildMemoryDiagnosticSnapshot === 'function' ? buildMemoryDiagnosticSnapshot : null,
    recordMemoryDiagnostic: typeof recordMemoryDiagnostic === 'function' ? recordMemoryDiagnostic : null,
    openMemoryDiagnostics: typeof openMemoryDiagnostics === 'function' ? openMemoryDiagnostics : null,
    promptTemplate: typeof PromptTemplate !== 'undefined' ? PromptTemplate : null,
    promptCache: typeof PromptLayerCache !== 'undefined' ? PromptLayerCache : null
  },
  // --- 基础设施 ---
  infra: {
    pipeline: typeof SettlementPipeline !== 'undefined' ? SettlementPipeline : null,
    eventBus: typeof GameEventBus !== 'undefined' ? GameEventBus : null,
    changeLog: typeof ChangeLog !== 'undefined' ? ChangeLog : null,
    debugLog: typeof DebugLog !== 'undefined' ? DebugLog : null,
    errorMonitor: typeof ErrorMonitor !== 'undefined' ? ErrorMonitor : null,
    balanceConfig: typeof BALANCE_CONFIG !== 'undefined' ? BALANCE_CONFIG : null,
    decisionRegistry: typeof DecisionRegistry !== 'undefined' ? DecisionRegistry : null
  },
  // --- 版本信息 ---
  version: '2.0.0-alpha',
  buildDate: '2026-04-15'
});

