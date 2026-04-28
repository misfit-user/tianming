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
  _data: { promptTokens: 0, completionTokens: 0, totalCalls: 0, turnStart: 0 },
  /** 记录一次API调用的token消耗 */
  record: function(usage) {
    if (!usage) return;
    this._data.promptTokens += (usage.prompt_tokens || 0);
    this._data.completionTokens += (usage.completion_tokens || 0);
    this._data.totalCalls++;
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
  /** 重置（新游戏） */
  reset: function() { this._data = { promptTokens: 0, completionTokens: 0, totalCalls: 0, turnStart: 0 }; }
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
  var lastDispatch = 0;
  var seqCounter = 0;
  function getConf() {
    var p = (typeof P !== 'undefined' && P.ai) ? P.ai : {};
    return {
      maxConcurrent: Math.max(1, parseInt(p.maxConcurrent) || 3),
      minInterval: Math.max(0, parseInt(p.minInterval) || 300)
    };
  }
  var priorityRank = { critical: 0, high: 1, normal: 2, low: 3 };
  function pump() {
    var conf = getConf();
    while (queue.length > 0 && inflight < conf.maxConcurrent) {
      var now = Date.now();
      var wait = lastDispatch + conf.minInterval - now;
      if (wait > 0) {
        setTimeout(pump, wait + 10);
        return;
      }
      // 按 priority 然后 seq 排序
      queue.sort(function(a, b) {
        var pa = priorityRank[a.priority] != null ? priorityRank[a.priority] : 2;
        var pb = priorityRank[b.priority] != null ? priorityRank[b.priority] : 2;
        if (pa !== pb) return pa - pb;
        return a.seq - b.seq;
      });
      var item = queue.shift();
      inflight++;
      lastDispatch = Date.now();
      Promise.resolve().then(item.task).then(function(res) {
        inflight--;
        item.resolve(res);
        pump();
      }).catch(function(err) {
        inflight--;
        item.reject(err);
        pump();
      });
    }
  }
  return {
    enqueue: function(task, priority) {
      return new Promise(function(resolve, reject) {
        queue.push({ task: task, priority: priority || 'normal', resolve: resolve, reject: reject, seq: seqCounter++ });
        pump();
      });
    },
    stats: function() { return { inflight: inflight, queued: queue.length, conf: getConf() }; }
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
function getAICacheStats() { return _aiCacheStats; }

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
/**
 * XML 片段构建：<tag attr="v">content</tag>
 * content 为数组时每项包成 <item>·对象时按 key 嵌套
 */
function xmlTag(name, attrs, content) {
  var attrStr = '';
  if (attrs && typeof attrs === 'object') {
    for (var k in attrs) {
      if (attrs[k] == null || attrs[k] === '') continue;
      attrStr += ' ' + k + '="' + _escXML(attrs[k]) + '"';
    }
  }
  if (content == null || content === '') return '<' + name + attrStr + '/>';
  if (typeof content === 'string') return '<' + name + attrStr + '>' + content + '</' + name + attrStr.replace(/\s.*/, '') + '>';
  if (Array.isArray(content)) {
    return '<' + name + attrStr + '>\n' + content.join('\n') + '\n</' + name.split(' ')[0] + '>';
  }
  return '<' + name + attrStr + '>' + String(content) + '</' + name.split(' ')[0] + '>';
}
/** 快速构建 <tag>body</tag> */
function xml(name, body) { return '<' + name + '>' + (body == null ? '' : body) + '</' + name + '>'; }

// ============================================================
//  1.7.48 时间三位一体（方向 15）
//  所有记忆条目自动携带 turn + eraLabel + relativeToNow
// ============================================================
function buildTimeTriad(turn) {
  if (turn == null) turn = (typeof GM !== 'undefined' && GM.turn) || 0;
  var curT = (typeof GM !== 'undefined' && GM.turn) || turn;
  var eraLabel = '';
  try {
    if (typeof getTSText === 'function') eraLabel = getTSText(turn) || '';
  } catch(_e) {}
  var delta = curT - turn;
  var rel = '';
  if (delta === 0) rel = '本回合';
  else if (delta === 1) rel = '上回合';
  else if (delta < 5) rel = delta + '回合前';
  else if (delta < 15) rel = '近' + delta + '回合前';
  else rel = '久远·' + delta + '回合前';
  return { turn: turn, eraLabel: eraLabel, relativeToNow: rel };
}

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

async function _aiFetchWithRetryInner(url, body, signal, opts) {
  opts = opts || {};
  var maxRetries = (opts.maxRetries != null) ? opts.maxRetries : 3;
  var timeoutMs = opts.timeoutMs || 180000;
  // M3·优先用 opts.apiKey（次 API 调用传入）·否则回退 primary
  var key = opts.apiKey || P.ai.key;
  var lastError = null;
  // 粗估 token 预算（仅警告，不截断：截断是调用方的职责）
  try {
    if (body && body.messages && typeof checkPromptTokenBudget === 'function') {
      var _combined = body.messages.map(function(m) { return (m && m.content) || ''; }).join('\n');
      checkPromptTokenBudget(_combined);
    }
  } catch(_tkE) {}
  for (var attempt = 0; attempt <= maxRetries; attempt++) {
    var ctrl = new AbortController();
    var aborter = function() { ctrl.abort(); };
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
      // 超时或网络错误——重试
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

/**
 * 基础 AI 调用
 * @param {string} prompt - 提示词
 * @param {number} [maxTok=2000] - 最大 token
 * @param {AbortSignal} [signal] - 中断信号
 * @returns {Promise<string>} AI 响应文本
 */
async function callAI(prompt,maxTok,signal,tier){
  // M3·按 tier 取配置·secondary 未配回退 primary·防御 _getAITier 未定义
  var _aiCfg = null;
  try { if (typeof _getAITier === 'function') _aiCfg = _getAITier(tier); } catch(_){}
  if (!_aiCfg) _aiCfg = { key: (P.ai&&P.ai.key)||'', url: (P.ai&&P.ai.url)||'', model: (P.ai&&P.ai.model)||'gpt-4o' };
  var key=_aiCfg.key || (P.ai&&P.ai.key) || '';if(!key)throw new Error("API\u672A\u914D\u7F6E");
  var url = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(tier) : _buildAIUrl();
  if(!url)throw new Error("API\u5730\u5740\u672A\u914D\u7F6E");
  var _scaledTok = Math.round((maxTok||2000) * ((typeof getCompressionParams==='function') ? Math.max(1.0, getCompressionParams().scale) : 1.0));
  var body = { model: _aiCfg.model || (P.ai&&P.ai.model) || "gpt-4o", messages:[{role:"user",content:prompt}], temperature: P.ai.temp||0.8, max_tokens: _scaledTok };
  var data = await _aiFetchWithRetry(url, body, signal, { apiKey: key });
  if(data.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data.usage);
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
    var _t0 = await callAI(prompt, opts.maxTok || 2000, opts.signal, opts.tier);
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
      var raw = await callAI(_fallbackPromptWithSchema(), maxTok, opts.signal, opts.tier);
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
  var ctrl = new AbortController();
  var timer = setTimeout(function() { ctrl.abort(); }, 180000);
  if (opts.signal) opts.signal.addEventListener('abort', function() { ctrl.abort(); });
  var data;
  try {
    var resp = await fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal });
    clearTimeout(timer);
    if (!resp.ok) {
      var errT = '';
      try { errT = await resp.text(); } catch(_){ }
      console.warn('[callAIWithTools] HTTP ' + resp.status + ' (parseMode=' + parseMode + '): ' + errT.substring(0, 200));
      // 4xx 多数是不支持 tools 字段·走 fallback；5xx/网络异常也 fallback 而非抛错·避免破坏 endturn
      return await _runFallback();
    }
    data = await resp.json();
  } catch(e) {
    clearTimeout(timer);
    console.warn('[callAIWithTools] fetch 异常·走 fallback:', e && e.message || e);
    return await _runFallback();
  }
  if (data && data.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data.usage);
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
  return { text: text, toolCalls: toolCalls };
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
  var maxRetries = options.maxRetries || 3;
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
      var result = await callAI(currentPrompt, maxTok, signal, options.tier);

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
async function callAIMessages(messages,maxTok,signal,tier){
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
  var data = await _aiFetchWithRetry(url, body, signal, { apiKey: key });
  if(data.usage && typeof TokenUsageTracker !== 'undefined') TokenUsageTracker.record(data.usage);
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
async function callAIMessagesStream(messages, maxTok, opts) {
  opts = opts || {};
  // M3·按 tier 取 API 配置·默认 primary·secondary 未配自动回退（带 try 兜底以防万一）
  var _aiCfg = null;
  try { if (typeof _getAITier === 'function') _aiCfg = _getAITier(opts.tier); } catch(_){}
  if (!_aiCfg) _aiCfg = { key: (P.ai&&P.ai.key)||'', url: (P.ai&&P.ai.url)||'', model: (P.ai&&P.ai.model)||'gpt-4o', tier: 'primary' };
  var key = _aiCfg.key || (P.ai && P.ai.key) || ''; if (!key) throw new Error('API未配置');
  var url = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(opts.tier) : _buildAIUrl();
  if (!url) throw new Error('API地址未配置');
  var ctrl = new AbortController();
  var timer = setTimeout(function() { ctrl.abort(); }, 180000);
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
      var dailyCtx = { timeRatio: batchDays / 365, turn: baseCtx.turn, day: d * dailyBatchSize + 1, batchDays: batchDays, isSubTick: true };
      totalReport = totalReport.concat(SettlementPipeline.runBySchedule('daily', dailyCtx));
    }

    // Phase 2: monthly 步骤（每月一次）
    for (var m = 0; m < ticks.months; m++) {
      var monthCtx = { timeRatio: 1 / 12, turn: baseCtx.turn, month: m + 1, totalMonths: ticks.months, isSubTick: true };
      totalReport = totalReport.concat(SettlementPipeline.runBySchedule('monthly', monthCtx));
    }

    // Phase 3: perturn 步骤（回合末一次）
    totalReport = totalReport.concat(SettlementPipeline.runBySchedule('perturn', { timeRatio: baseCtx.timeRatio, turn: baseCtx.turn, isSubTick: false }));

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
    }
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
function calcDateFromTurn(turn){
  if(!P.time) return {adYear:0,solarMonth:1,solarDay:1,lunarMonth:1,lunarDay:1,season:'春',gzYearStr:'',gzDayStr:''};
  var t=P.time;
  var perTurn=t.perTurn||'1s';
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
  var tpy=(perTurn==='1y'?1:perTurn==='1m'?12:perTurn==='1s'?4:1);
  var reignYear=(t.reignY||1)+Math.floor((turn-1)/tpy);

  return {
    adYear:sy, solarMonth:sm, solarDay:sd,
    lunarMonth:lm, lunarDay:ld, season:season,
    eraInfo:eraInfo, gzYearStr:gzY, gzDayStr:gzD,
    reignYear:reignYear
  };
}

/** 生成完整日期显示字符串 */
function getFullDateStr(y,mo,dy){
  var t=P.time;var parts=[];
  if(t.enableEraName&&GM.eraNames&&GM.eraNames.length){
    var ed=getEraDisplay(y,mo,dy);
    if(ed) parts.push(ed.era+ed.ryStr+lunarMonthName(mo)+lunarDayName(dy));
    else parts.push(y+"年"+lunarMonthName(mo)+lunarDayName(dy));
  } else {
    var ay=Math.abs(y);
    var ystr=(y<0?(t.prefix||"")+ay:ay)+(t.suffix||"");
    parts.push(ystr+lunarMonthName(mo)+lunarDayName(dy));
  }
  parts.push(gzYear(y)+"年");
  parts.push(gzDay(y,mo,dy)+"日");
  return parts.join(" ");
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

/** 构建 NPC 时空约束提示词·注入任意 NPC 对话/奏疏/书信 prompt 前
 * 防 AI 使用未来史实知识（如 NPC 说"某人已死"但在游戏时间中此人还活着） */
function _buildTemporalConstraint(ch) {
  var t = (typeof getTSText === 'function') ? getTSText(GM.turn || 1) : ('T' + (GM.turn || 1));
  var y = (GM.year || (P.time && P.time.year) || '?');
  var lines = ['\n\n【★ 时空约束·AI 严格遵守 ★】'];
  lines.push('当前游戏时间：' + t + '（公元 ' + y + ' 年）·第 ' + (GM.turn || 1) + ' 回合');
  // 活人名单（防 AI 说还活着的人已死）
  var aliveSample = (GM.chars || []).filter(function(c){ return c && c.alive !== false; }).slice(0, 30).map(function(c){ return c.name; }).join('、');
  if (aliveSample) lines.push('当前在世人物（节选）：' + aliveSample + (GM.chars && GM.chars.length > 30 ? '…等' : ''));
  // 已故名单
  var deadList = (GM.chars || []).filter(function(c){ return c && (c.alive === false || c.dead); }).slice(0, 12).map(function(c){
    return c.name + (c.deathTurn ? '(T' + c.deathTurn + ')' : '');
  }).join('、');
  if (deadList) lines.push('已故人物：' + deadList);
  lines.push('★ 绝对禁止：');
  lines.push('  · 讨论游戏当前时间之后才发生的史实事件（如游戏在天启七年·不得提及崇祯朝将发生之事为既成事实）');
  lines.push('  · 说在世人物已死·或说已故人物仍活·生死以上述名单+GM 数据为准·非历史上的卒年');
  lines.push('  · 以"历史上某年某人做了 X"作为此时此事的既成根据');
  lines.push('★ 允许：隐约预感/占卜不祥/担忧未来/引前朝/古事为训');
  // 若 ch 有 _memory·注入关键记忆
  if (ch && Array.isArray(ch._memory) && ch._memory.length > 0) {
    var memLines = ch._memory.slice(-5).map(function(m) {
      return '  · T' + (m.turn || 0) + '·' + (m.event || '') + (m.emotion ? '(' + m.emotion + ')' : '');
    }).join('\n');
    lines.push('本 NPC 关键记忆（时序）：\n' + memLines);
  }
  return lines.join('\n');
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
    lines.push('\n【旅程在途】');
    travelers.forEach(function(c) {
      lines.push('  · ' + c.name + '·自' + (c._travelFrom || '?') + '→' + c._travelTo + '·' + (c._travelReason || '') + (c._travelArrival ? '·预计 T' + c._travelArrival + ' 抵' : ''));
    });
  }
  return lines.length > 0 ? lines.join('\n') : '';
}
function renderEraNamesList(){var t=P.time;var el=_$("t-era-list");if(!el)return;var eraList=(t.eraNames||[]);if(!eraList.length){el.innerHTML="<div style=\"color:var(--txt-d);font-size:12px;\">\u6682\u65E0</div>";return;}el.innerHTML=eraList.map(function(e,i){return "<div style=\"display:flex;gap:6px;align-items:center;margin-bottom:3px;\">"+"<input id=\"t-era-n-"+i+"\" value=\""+((e&&e.name)||"")+"\" placeholder=\"\u5E74\u53F7\u540D\" style=\"width:80px\">"+"<input type=\"number\" id=\"t-era-y-"+i+"\" value=\""+((e&&e.startYear)||0)+"\" placeholder=\"\u5E74\" style=\"width:60px\">"+"<input type=\"number\" id=\"t-era-m-"+i+"\" value=\""+((e&&e.startMonth)||1)+"\" placeholder=\"\u6708\" style=\"width:44px\">"+"<input type=\"number\" id=\"t-era-d-"+i+"\" value=\""+((e&&e.startDay)||1)+"\" placeholder=\"\u65e5\" style=\"width:44px\">"+"<button class=\"bd bsm\" onclick=\"_eraUpd("+i+")\">\u4FDD</button>"+"<button class=\"bd bsm\" onclick=\"_eraDel("+i+")\">\u5220</button>"+"</div>";}).join("");}window._eraAdd=function(){if(!P.time.eraNames)P.time.eraNames=[];P.time.eraNames.push({name:"",startYear:P.time.year,startMonth:1,startDay:1});renderEraNamesList();};window._eraDel=function(i){if(!P.time.eraNames)return;P.time.eraNames.splice(i,1);renderEraNamesList();};window._eraUpd=function(i){var e=P.time.eraNames[i];if(!e)return;var n=document.getElementById("t-era-n-"+i);if(n)e.name=n.value;var y=document.getElementById("t-era-y-"+i);if(y)e.startYear=+y.value||P.time.year;var m=document.getElementById("t-era-m-"+i);if(m)e.startMonth=+m.value||1;var d=document.getElementById("t-era-d-"+i);if(d)e.startDay=+d.value||1;saveT();};function saveT(){var t=P.time;var ids=["t-year","t-prefix","t-suffix","t-per-turn","t-seasons","t-start-s","t-reign","t-reign-y","t-display","t-template","t-start-month","t-start-day"];ids.forEach(function(id){var el=_$(id);if(!el)return;var v=el.value;if(id==="t-year")t.year=+v;else if(id==="t-prefix")t.prefix=v;else if(id==="t-suffix")t.suffix=v;else if(id==="t-per-turn")t.perTurn=v;else if(id==="t-seasons")t.seasons=v.split(",").map(function(s){return s.trim();});else if(id==="t-start-s")t.startS=+v;else if(id==="t-reign")t.reign=v;else if(id==="t-reign-y")t.reignY=+v;else if(id==="t-display")t.display=v;else if(id==="t-template")t.template=v;else if(id==="t-start-month")t.startMonth=+v||1;else if(id==="t-start-day")t.startDay=+v||1;});var egz=_$("t-enable-ganzhi");if(egz)t.enableGanzhi=egz.checked;var egzd=_$("t-enable-ganzhi-day");if(egzd)t.enableGanzhiDay=egzd.checked;var een=_$("t-enable-era-name");if(een)t.enableEraName=een.checked;toast("\u5DF2\u4FDD\u5B58");}
function loadT(){var t=P.time;var map={"t-year":t.year,"t-prefix":t.prefix||"","t-suffix":t.suffix||"","t-per-turn":t.perTurn||"1s","t-seasons":(t.seasons||[]).join(","),"t-start-s":t.startS||0,"t-reign":t.reign||"","t-reign-y":t.reignY||1,"t-display":t.display||"year_season","t-template":t.template||"","t-start-month":t.startMonth||1,"t-start-day":t.startDay||1};Object.keys(map).forEach(function(id){var el=_$(id);if(el)el.value=map[id];});var egz=_$("t-enable-ganzhi");if(egz)egz.checked=!!t.enableGanzhi;var egzd=_$("t-enable-ganzhi-day");if(egzd)egzd.checked=!!t.enableGanzhiDay;var een=_$("t-enable-era-name");if(een)een.checked=!!t.enableEraName;renderEraNamesList();}

// ============================================================
// 模型上下文窗口自动探测系统
// 三层探测：API查询 → AI自报 → 实测推断
// 结果缓存在 P.conf._detectedContextK，跨回合/存档持久化
// ============================================================

/**
 * 探测当前模型的上下文窗口大小（K tokens）
 * @returns {Promise<number>} 上下文窗口大小（单位K）
 */
// ── 已知模型上下文窗口白名单 ──
// 按匹配优先级排序（长前缀先匹配），覆盖主流模型族
// 白名单条目：p=模型前缀，k=上下文窗口(K tokens)，o=单次最大输出(K tokens)
// 各模型输出上限根据官方文档：OpenAI多为16K、Claude多为8-64K、Gemini 8K、DeepSeek 8K、GPT-4/3.5多为4K
var _MODEL_CTX_MAP = [
  // === OpenAI ===
  {p:'gpt-4.1-mini',k:1024,o:32},{p:'gpt-4.1-nano',k:1024,o:32},{p:'gpt-4.1',k:1024,o:32},
  {p:'o4-mini-high',k:200,o:64},{p:'o4-mini',k:200,o:64},
  {p:'o3-pro',k:200,o:100},{p:'o3-mini',k:200,o:64},{p:'o3',k:200,o:100},
  {p:'o1-pro',k:200,o:100},{p:'o1-mini',k:128,o:64},{p:'o1-preview',k:128,o:32},{p:'o1',k:200,o:100},
  {p:'gpt-4.5-preview',k:128,o:16},{p:'gpt-4.5',k:128,o:16},
  {p:'gpt-4o-mini',k:128,o:16},{p:'gpt-4o-audio',k:128,o:16},{p:'gpt-4o-realtime',k:128,o:4},{p:'gpt-4o',k:128,o:16},
  {p:'gpt-4-turbo-preview',k:128,o:4},{p:'gpt-4-turbo',k:128,o:4},{p:'gpt-4-vision',k:128,o:4},
  {p:'gpt-4-1106',k:128,o:4},{p:'gpt-4-0125',k:128,o:4},{p:'gpt-4-32k',k:32,o:4},{p:'gpt-4',k:8,o:4},
  {p:'gpt-3.5-turbo-16k',k:16,o:4},{p:'gpt-3.5-turbo-1106',k:16,o:4},{p:'gpt-3.5-turbo-0125',k:16,o:4},{p:'gpt-3.5',k:4,o:4},

  // === Anthropic Claude ===
  {p:'claude-opus-4-6',k:1024,o:64},{p:'claude-sonnet-4-6',k:1024,o:64},
  {p:'claude-opus-4-5',k:200,o:32},{p:'claude-sonnet-4-5',k:200,o:64},{p:'claude-haiku-4-5',k:200,o:64},
  {p:'claude-opus-4-7',k:200,o:32},{p:'claude-opus-4',k:200,o:32},{p:'claude-sonnet-4',k:200,o:64},
  {p:'claude-3-7-sonnet',k:200,o:64},{p:'claude-3-5-sonnet',k:200,o:8},{p:'claude-3-5-haiku',k:200,o:8},
  {p:'claude-3-opus',k:200,o:4},{p:'claude-3-sonnet',k:200,o:4},{p:'claude-3-haiku',k:200,o:4},
  {p:'claude-2.1',k:200,o:4},{p:'claude-2',k:100,o:4},{p:'claude-instant',k:100,o:4},

  // === DeepSeek ===
  {p:'deepseek-r1-0528',k:128,o:64},{p:'deepseek-r1',k:128,o:64},
  {p:'deepseek-v3-0324',k:128,o:8},{p:'deepseek-v3',k:128,o:8},
  {p:'deepseek-chat',k:64,o:8},{p:'deepseek-coder',k:128,o:8},{p:'deepseek-reasoner',k:64,o:64},{p:'deepseek',k:64,o:8},

  // === Google Gemini ===
  {p:'gemini-2.5-pro',k:1024,o:64},{p:'gemini-2.5-flash',k:1024,o:64},{p:'gemini-2.5',k:1024,o:64},
  {p:'gemini-2.0-flash',k:1024,o:8},{p:'gemini-2.0',k:1024,o:8},
  {p:'gemini-1.5-pro',k:1024,o:8},{p:'gemini-1.5-flash',k:1024,o:8},{p:'gemini-1.5',k:1024,o:8},
  {p:'gemini-pro-vision',k:32,o:2},{p:'gemini-pro',k:32,o:8},{p:'gemini-ultra',k:32,o:8},

  // === Qwen (通义千问) ===
  {p:'qwen3-235b',k:128,o:8},{p:'qwen3-30b',k:128,o:8},{p:'qwen3',k:128,o:8},
  {p:'qwen2.5-coder',k:128,o:8},{p:'qwen2.5-72b',k:128,o:8},{p:'qwen2.5-32b',k:128,o:8},{p:'qwen2.5-14b',k:128,o:8},{p:'qwen2.5-7b',k:32,o:8},{p:'qwen2.5',k:32,o:8},
  {p:'qwen-max-longcontext',k:1024,o:8},{p:'qwen-max',k:32,o:8},{p:'qwen-plus',k:128,o:8},{p:'qwen-turbo',k:128,o:8},
  {p:'qwen-long',k:1024,o:8},{p:'qwen-vl',k:32,o:2},{p:'qwen',k:32,o:8},

  // === GLM (智谱) ===
  {p:'glm-4-plus',k:128,o:4},{p:'glm-4-long',k:1024,o:4},{p:'glm-4-airx',k:8,o:4},{p:'glm-4-air',k:128,o:4},
  {p:'glm-4-flash',k:128,o:4},{p:'glm-4-0520',k:128,o:4},{p:'glm-4v',k:8,o:2},{p:'glm-4',k:128,o:4},
  {p:'glm-3-turbo',k:128,o:4},{p:'glm-3',k:8,o:2},

  // === Yi (零一万物) ===
  {p:'yi-lightning',k:16,o:4},{p:'yi-large-turbo',k:16,o:4},{p:'yi-large',k:32,o:4},{p:'yi-medium-200k',k:200,o:4},{p:'yi-medium',k:16,o:4},{p:'yi',k:16,o:4},

  // === Moonshot (月之暗面/Kimi) ===
  {p:'moonshot-v1-128k',k:128,o:4},{p:'moonshot-v1-32k',k:32,o:4},{p:'moonshot-v1-8k',k:8,o:2},{p:'moonshot',k:32,o:4},
  {p:'kimi',k:128,o:4},

  // === Baichuan (百川) ===
  {p:'baichuan4',k:128,o:2},{p:'baichuan3-turbo',k:32,o:2},{p:'baichuan2',k:8,o:2},{p:'baichuan',k:8,o:2},

  // === MiniMax (稀宇) ===
  {p:'abab6.5s',k:245,o:8},{p:'abab6.5',k:8,o:2},{p:'abab5.5',k:16,o:2},{p:'minimax',k:245,o:8},

  // === Spark (讯飞星火) ===
  {p:'spark-4.0-ultra',k:128,o:8},{p:'spark-max',k:128,o:8},{p:'spark-pro',k:8,o:4},{p:'spark-lite',k:4,o:2},{p:'spark',k:8,o:4},

  // === Hunyuan (混元) ===
  {p:'hunyuan-pro',k:32,o:4},{p:'hunyuan-standard',k:32,o:2},{p:'hunyuan-lite',k:8,o:2},{p:'hunyuan',k:32,o:4},

  // === SenseChat (商汤) ===
  {p:'sensechat-5',k:128,o:4},{p:'sensechat',k:32,o:4},

  // === Mistral ===
  {p:'mistral-large-latest',k:128,o:8},{p:'mistral-large',k:128,o:8},{p:'mistral-medium',k:32,o:8},{p:'mistral-small',k:32,o:8},
  {p:'pixtral-large',k:128,o:8},{p:'codestral',k:256,o:8},{p:'mixtral-8x22b',k:64,o:8},{p:'mixtral-8x7b',k:32,o:8},
  {p:'open-mistral-nemo',k:128,o:8},{p:'mistral-nemo',k:128,o:8},{p:'ministral-8b',k:128,o:8},{p:'mistral',k:32,o:8},

  // === Meta Llama ===
  {p:'llama-4-maverick',k:1024,o:8},{p:'llama-4-scout',k:1024,o:8},{p:'llama-4',k:1024,o:8},
  {p:'llama-3.3-70b',k:128,o:8},{p:'llama-3.3',k:128,o:8},
  {p:'llama-3.2-90b',k:128,o:8},{p:'llama-3.2-11b',k:128,o:8},{p:'llama-3.2-3b',k:128,o:8},{p:'llama-3.2-1b',k:128,o:8},{p:'llama-3.2',k:128,o:8},
  {p:'llama-3.1-405b',k:128,o:8},{p:'llama-3.1-70b',k:128,o:8},{p:'llama-3.1-8b',k:128,o:8},{p:'llama-3.1',k:128,o:8},
  {p:'llama-3-70b',k:8,o:2},{p:'llama-3-8b',k:8,o:2},{p:'llama-3',k:8,o:2},{p:'llama-2',k:4,o:2},{p:'llama',k:4,o:2},

  // === Cohere ===
  {p:'command-r-plus',k:128,o:4},{p:'command-r',k:128,o:4},{p:'command-light',k:4,o:4},{p:'command',k:4,o:4},

  // === 其他开源 ===
  {p:'phi-4',k:16,o:4},{p:'phi-3',k:128,o:4},{p:'phi',k:4,o:2},
  {p:'gemma-2',k:8,o:8},{p:'gemma',k:8,o:4},
  {p:'internlm2',k:200,o:4},{p:'internlm',k:8,o:4},
  {p:'chatglm',k:8,o:4}
];

/** 按白名单匹配模型名 → 上下文K */
function _matchModelCtx(modelName) {
  var lower = (modelName || '').toLowerCase();
  for (var i = 0; i < _MODEL_CTX_MAP.length; i++) {
    if (lower.indexOf(_MODEL_CTX_MAP[i].p) >= 0) return _MODEL_CTX_MAP[i].k;
  }
  // 从URL推断提供商，给一个合理默认值
  var url = (P && P.ai && P.ai.url || '').toLowerCase();
  if (url.indexOf('anthropic') >= 0) return 200;
  if (url.indexOf('deepseek') >= 0) return 64;
  if (url.indexOf('moonshot') >= 0 || url.indexOf('kimi') >= 0) return 128;
  if (url.indexOf('dashscope') >= 0 || url.indexOf('tongyi') >= 0) return 128;
  if (url.indexOf('bigmodel') >= 0 || url.indexOf('zhipu') >= 0) return 128;
  if (url.indexOf('generativelanguage.googleapis') >= 0 || url.indexOf('vertex') >= 0) return 1024;
  if (url.indexOf('openrouter') >= 0) return 128; // OpenRouter多数模型≥128K
  return 0;
}

/** 按白名单匹配模型名 → 单次最大输出K tokens */
function _matchModelOutput(modelName) {
  var lower = (modelName || '').toLowerCase();
  for (var i = 0; i < _MODEL_CTX_MAP.length; i++) {
    if (lower.indexOf(_MODEL_CTX_MAP[i].p) >= 0) return _MODEL_CTX_MAP[i].o || 0;
  }
  var url = (P && P.ai && P.ai.url || '').toLowerCase();
  if (url.indexOf('anthropic') >= 0) return 8;
  if (url.indexOf('deepseek') >= 0) return 8;
  if (url.indexOf('moonshot') >= 0) return 4;
  if (url.indexOf('openrouter') >= 0) return 8;
  return 0;
}

/** 将token数或K数标准化为K */
function _normalizeToK(val) {
  if (val <= 0) return 0;
  if (val < 2048) return Math.round(val);   // 已经是K
  return Math.round(val / 1024);            // token数→K
}

/** 探测日志（供设置面板显示） */
var _ctxDetectLog = [];
function _ctxLog(msg) {
  console.log('[CtxDetect] ' + msg);
  _ctxDetectLog.push({ time: new Date().toLocaleTimeString(), msg: msg });
  if (_ctxDetectLog.length > 20) _ctxDetectLog.shift();
}

/**
 * 从API JSON响应中深度提取上下文窗口字段
 * 支持各种嵌套格式（capabilities, limits, model_info, pricing等）
 */
function _extractCtxFromJson(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  var fields = [
    'context_length', 'context_window', 'max_context_tokens',
    'max_model_len', 'context_size', 'max_input_tokens',
    'max_total_tokens', 'token_limit', 'max_context_length',
    'max_prompt_tokens', 'context_length_limit', 'input_token_limit'
  ];
  // 顶层
  for (var i = 0; i < fields.length; i++) {
    var v = obj[fields[i]];
    if (v && typeof v === 'number' && v > 100) return v;
  }
  // 嵌套层（常见格式）
  var nests = ['capabilities', 'limits', 'model_info', 'pricing', 'metadata', 'config', 'properties', 'top_provider'];
  for (var n = 0; n < nests.length; n++) {
    var sub = obj[nests[n]];
    if (sub && typeof sub === 'object') {
      for (var j = 0; j < fields.length; j++) {
        var v2 = sub[fields[j]];
        if (v2 && typeof v2 === 'number' && v2 > 100) return v2;
      }
    }
  }
  // OpenRouter 特殊格式: context_length 在 top_provider.context_length
  if (obj.top_provider && obj.top_provider.context_length) return obj.top_provider.context_length;
  // max_tokens 放最后（有些API的max_tokens是输出上限不是上下文窗口）
  if (obj.max_tokens && typeof obj.max_tokens === 'number' && obj.max_tokens > 4000) return obj.max_tokens;
  return 0;
}

/**
 * 从API JSON响应中提取单次最大输出token上限
 * 不同API命名：max_output_tokens / max_completion_tokens / max_tokens / output_token_limit
 */
function _extractMaxOutputFromJson(obj) {
  if (!obj || typeof obj !== 'object') return 0;
  var fields = [
    'max_output_tokens', 'max_completion_tokens', 'output_token_limit',
    'max_response_tokens', 'max_generation_tokens', 'completion_limit'
  ];
  // 顶层
  for (var i = 0; i < fields.length; i++) {
    var v = obj[fields[i]];
    if (v && typeof v === 'number' && v > 0 && v < 1000000) return v;
  }
  // 嵌套层
  var nests = ['capabilities', 'limits', 'model_info', 'pricing', 'metadata', 'config', 'properties', 'top_provider'];
  for (var n = 0; n < nests.length; n++) {
    var sub = obj[nests[n]];
    if (sub && typeof sub === 'object') {
      for (var j = 0; j < fields.length; j++) {
        var v2 = sub[fields[j]];
        if (v2 && typeof v2 === 'number' && v2 > 0 && v2 < 1000000) return v2;
      }
    }
  }
  // Anthropic 的 max_tokens 字段在 /models 返回中常作输出上限用
  // 这里只在响应来自anthropic域时这样判断，否则max_tokens可能是上下文
  // （由调用方决定是否取此回退）
  return 0;
}

/**
 * 探测当前模型的上下文窗口大小（K tokens）
 * 五层探测：白名单 → API元数据 → 响应头 → AI自报 → 渐进实测
 * @param {{force?:boolean, onProgress?:function}} [opts]
 * @returns {Promise<number>} K tokens
 */
async function detectModelContextSize(opts) {
  opts = opts || {};
  var _prog = opts.onProgress || function(){};
  var _tier = opts.tier || 'primary';
  var _sfx = _tier === 'secondary' ? '_secondary' : '';
  var _aiCfgDet = _getAITier(_tier);

  // 用户手动设置优先
  var _manualCtx = P.conf['contextSizeK' + _sfx];
  if (!opts.force && _manualCtx && _manualCtx > 0) {
    _ctxLog('[' + _tier + '] 使用用户手动设置: ' + _manualCtx + 'K');
    return _manualCtx;
  }

  var model = (_aiCfgDet.model || '').trim();
  if (!model) { _ctxLog('[' + _tier + '] 无模型名，默认32K'); return 32; }

  // 缓存检查
  var _cacheKey = model + '@' + (_aiCfgDet.url || '');
  var _cachedK = P.conf['_detectedContextK' + _sfx];
  if (!opts.force && _cachedK && P.conf['_ctxCacheKey' + _sfx] === _cacheKey) {
    _ctxLog('[' + _tier + '] 命中缓存: ' + model + ' = ' + _cachedK + 'K');
    return _cachedK;
  }

  _ctxDetectLog = []; // 清空日志
  var detectedK = 0;
  var detectedLayer = '';
  var detectedOutputTok = 0;  // 单次最大输出token（0=未知，将由白名单回退）
  var key = _aiCfgDet.key;
  var baseUrl = (_aiCfgDet.url || '').replace(/\/+$/, '');

  // ═══ 层0：白名单匹配 ═══
  _prog('白名单匹配...');
  var whitelistK = _matchModelCtx(model);
  if (whitelistK > 0) _ctxLog('层0 白名单: ' + model + ' → ' + whitelistK + 'K');

  if (!key || !baseUrl) {
    detectedK = whitelistK || 32;
    detectedLayer = whitelistK ? 'L0白名单' : '默认';
    _finishDetect(detectedK, detectedLayer, _cacheKey, 0, _tier);
    return detectedK;
  }

  // ═══ 层1：API /models 元数据查询 ═══
  _prog('查询API元数据...');
  try {
    var modelsBase = baseUrl.replace(/\/chat\/completions\/?$/,'').replace(/\/messages\/?$/,'');
    var vm = modelsBase.match(/(.*\/v\d+)/);
    if (vm) modelsBase = vm[1];

    // 1a: /models/{id}
    var modelUrl = modelsBase + '/models/' + encodeURIComponent(model);
    _ctxLog('层1a: GET ' + modelUrl);
    var resp1 = await fetch(modelUrl, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + key, 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
    });
    if (resp1.ok) {
      var mData = await resp1.json();
      var rawVal = _extractCtxFromJson(mData);
      if (rawVal > 0) {
        detectedK = _normalizeToK(rawVal);
        detectedLayer = 'L1 API(/models/' + model + ')';
        _ctxLog('层1a成功: 原始值=' + rawVal + ' → ' + detectedK + 'K');
      }
      // 同步提取输出上限
      var rawOut = _extractMaxOutputFromJson(mData);
      if (rawOut > 0) {
        detectedOutputTok = rawOut;
        _ctxLog('层1a: 输出上限=' + rawOut + ' tokens');
      }
    }

    // 1b: /models 列表
    if (!detectedK) {
      var listUrl = modelsBase + '/models';
      _ctxLog('层1b: GET ' + listUrl);
      var resp1b = await fetch(listUrl, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + key, 'x-api-key': key },
        signal: AbortSignal.timeout ? AbortSignal.timeout(8000) : undefined
      });
      if (resp1b.ok) {
        var listData = await resp1b.json();
        var modelList = (listData.data && Array.isArray(listData.data)) ? listData.data : (Array.isArray(listData) ? listData : []);
        var lower = model.toLowerCase();
        var target = modelList.find(function(m) { return (m.id || '').toLowerCase() === lower; })
          || modelList.find(function(m) { return (m.id || '').toLowerCase().indexOf(lower) >= 0; });
        if (target) {
          var rawVal2 = _extractCtxFromJson(target);
          if (rawVal2 > 0) {
            detectedK = _normalizeToK(rawVal2);
            detectedLayer = 'L1b API列表';
            _ctxLog('层1b成功: ' + (target.id || model) + ' 原始值=' + rawVal2 + ' → ' + detectedK + 'K');
          }
          if (!detectedOutputTok) {
            var rawOut2 = _extractMaxOutputFromJson(target);
            if (rawOut2 > 0) {
              detectedOutputTok = rawOut2;
              _ctxLog('层1b: 输出上限=' + rawOut2 + ' tokens');
            }
          }
        }
      }
    }
  } catch(e1) { _ctxLog('层1失败: ' + (e1.message || e1)); }

  // ═══ 层2：从实际chat请求的响应中提取usage信息 ═══
  if (!detectedK) {
    _prog('分析API响应头...');
    try {
      var chatUrl2 = _buildAIUrl();
      _ctxLog('层2: 发送探测请求提取usage');
      var resp2 = await fetch(chatUrl2, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({ model: model, messages: [{ role: 'user', content: 'Hi' }], temperature: 0, max_tokens: 5 }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
      });
      if (resp2.ok) {
        var j2 = await resp2.json();
        // 一些API在响应中返回模型元数据
        if (j2.model_info && j2.model_info.context_length) {
          detectedK = _normalizeToK(j2.model_info.context_length);
          detectedLayer = 'L2 响应model_info';
          _ctxLog('层2成功: model_info.context_length=' + j2.model_info.context_length + ' → ' + detectedK + 'K');
        }
        // 从system_fingerprint或model名推断
        if (!detectedK && j2.model) {
          var respModelK = _matchModelCtx(j2.model);
          if (respModelK > 0 && !whitelistK) {
            whitelistK = respModelK;
            _ctxLog('层2: 从响应model字段 "' + j2.model + '" 白名单匹配 → ' + respModelK + 'K');
          }
        }
        // 从usage.prompt_tokens_details推断（有些API返回上下文窗口相关字段）
        if (!detectedK && j2.usage) {
          var u = j2.usage;
          if (u.context_window || u.model_context_length) {
            detectedK = _normalizeToK(u.context_window || u.model_context_length);
            detectedLayer = 'L2 usage字段';
            _ctxLog('层2成功: usage上下文=' + (u.context_window || u.model_context_length) + ' → ' + detectedK + 'K');
          }
        }
      }
    } catch(e2) { _ctxLog('层2失败: ' + (e2.message || e2)); }
  }

  // ═══ 层3：询问AI模型自身 ═══
  if (!detectedK) {
    _prog('询问模型自身...');
    try {
      var chatUrl3 = _buildAIUrl();
      _ctxLog('层3: 双语询问模型');
      var resp3 = await fetch(chatUrl3, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: model,
          messages: [{
            role: 'user',
            content: 'What is your maximum context window size in tokens? Reply ONLY a single integer. Example: 131072\n你的上下文窗口最大能容纳多少个token？只回答一个整数。例如：131072'
          }],
          temperature: 0, max_tokens: 30
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(12000) : undefined
      });
      if (resp3.ok) {
        var j3 = await resp3.json();
        var answer = (j3.choices && j3.choices[0] && j3.choices[0].message) ? j3.choices[0].message.content : '';
        _ctxLog('层3: 模型回复 "' + answer.slice(0, 60) + '"');
        // 提取所有数字
        var nums = answer.match(/[\d,_.]+/g);
        if (nums) {
          var candidates = nums.map(function(n) { return parseInt(n.replace(/[,_.]/g, ''), 10); }).filter(function(n) { return n >= 2000; });
          if (candidates.length > 0) {
            // 取最合理的数字（接近2的幂次或常见上下文值）
            var bestNum = candidates.reduce(function(best, n) {
              var nK = _normalizeToK(n);
              var bK = _normalizeToK(best);
              // 偏好已知的常见上下文窗口值
              var commonSizes = [4, 8, 16, 32, 64, 128, 200, 256, 1024];
              var nClose = commonSizes.reduce(function(min, s) { return Math.min(min, Math.abs(nK - s)); }, 99999);
              var bClose = commonSizes.reduce(function(min, s) { return Math.min(min, Math.abs(bK - s)); }, 99999);
              return nClose < bClose ? n : best;
            });
            var selfK = _normalizeToK(bestNum);
            // 交叉验证
            if (whitelistK > 0 && (selfK > whitelistK * 4 || selfK < whitelistK / 4)) {
              _ctxLog('层3: AI自报' + selfK + 'K vs 白名单' + whitelistK + 'K 差距过大，采用白名单');
              detectedK = whitelistK;
              detectedLayer = 'L0白名单(L3偏差修正)';
            } else {
              detectedK = selfK;
              detectedLayer = 'L3 AI自报';
              _ctxLog('层3成功: ' + bestNum + ' → ' + detectedK + 'K');
            }
          }
        }
      }
    } catch(e3) { _ctxLog('层3失败: ' + (e3.message || e3)); }
  }

  // ═══ 层4：渐进式实测（二分法探测实际容量上界）═══
  if (!detectedK) {
    _prog('渐进式实测...');
    _ctxLog('层4: 渐进实测');
    var chatUrl4 = _buildAIUrl();
    // 从大到小测试：32K → 8K → 2K
    var probes = [
      { tokens: 30000, label: '~30K', passK: 32 },
      { tokens: 6000,  label: '~6K',  passK: 8 },
      { tokens: 2000,  label: '~2K',  passK: 4 }
    ];
    for (var pi = 0; pi < probes.length; pi++) {
      var probe = probes[pi];
      try {
        // 每个汉字约1.5-2 token，每次重复19字 ≈ 30 token
        var repeats = Math.ceil(probe.tokens / 30);
        var testBody = '这是一段用于检测AI模型上下文窗口容量的测试文本。'.repeat(repeats);
        var resp4 = await fetch(chatUrl4, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model: model, messages: [{ role: 'user', content: testBody + '\nReply OK.' }], temperature: 0, max_tokens: 5 }),
          signal: AbortSignal.timeout ? AbortSignal.timeout(20000) : undefined
        });
        if (resp4.ok) {
          _ctxLog('层4: ' + probe.label + ' 通过 → ≥' + probe.passK + 'K');
          detectedK = whitelistK || probe.passK;
          detectedLayer = 'L4 实测(≥' + probe.passK + 'K)';
          break;
        } else {
          var errBody = '';
          try { errBody = (await resp4.text()).slice(0, 100); } catch(_) {}
          _ctxLog('层4: ' + probe.label + ' 失败 HTTP' + resp4.status + ' ' + errBody);
          // 检查是否是上下文超限的错误
          var isCtxErr = resp4.status === 413 || resp4.status === 400
            || errBody.indexOf('context') >= 0 || errBody.indexOf('token') >= 0 || errBody.indexOf('length') >= 0;
          if (!isCtxErr) {
            // 不是上下文相关错误（可能是其他API错误），不继续测试
            _ctxLog('层4: 非上下文错误，停止测试');
            break;
          }
        }
      } catch(_e4) { _ctxLog('层4: ' + probe.label + ' 异常 ' + (_e4.message || _e4)); }
    }
  }

  // ═══ 回退 ═══
  if (!detectedK && whitelistK > 0) {
    detectedK = whitelistK;
    detectedLayer = 'L0白名单(回退)';
    _ctxLog('回退到白名单: ' + detectedK + 'K');
  }
  if (!detectedK || detectedK < 2) {
    detectedK = 32;
    detectedLayer = '默认兜底';
  }

  // 输出上限：API未返回时回退白名单
  if (!detectedOutputTok) {
    var wlOutK = _matchModelOutput(model);
    if (wlOutK > 0) {
      detectedOutputTok = wlOutK * 1024;
      _ctxLog('输出上限回退白名单: ' + wlOutK + 'K → ' + detectedOutputTok + ' tokens');
    } else {
      // 再兜底：取上下文的1/8作为保守估计，最低2048
      detectedOutputTok = Math.max(2048, Math.round(detectedK * 1024 / 8));
      _ctxLog('输出上限兜底: ' + detectedOutputTok + ' tokens (上下文1/8)');
    }
  }

  _finishDetect(detectedK, detectedLayer, _cacheKey, detectedOutputTok, _tier);
  return detectedK;
}

function _finishDetect(k, layer, cacheKey, maxOutputTok, tier) {
  // M3·tier 特化·次 API 用 _secondary 后缀字段·不污染主
  var _sfx = (tier === 'secondary') ? '_secondary' : '';
  P.conf['_detectedContextK' + _sfx] = k;
  P.conf['_ctxCacheKey' + _sfx] = cacheKey;
  P.conf['_ctxDetectLayer' + _sfx] = layer;
  if (maxOutputTok && maxOutputTok > 0) P.conf['_detectedMaxOutput' + _sfx] = maxOutputTok;
  _ctxLog('最终结果[' + (tier||'primary') + ']: 上下文' + k + 'K, 输出上限' + (maxOutputTok||0) + ' tokens (' + layer + ')');
}

// ============================================================
//  防欺骗·实测输出上限 (层5)
//  做法：请求 AI 生成"正好 N 个汉字"的长文本·比较实际输出与要求
//  连续二分：若 8K 请求只出 4K·说明真实上限在 4K 附近
// ============================================================
async function detectModelOutputLimit(opts) {
  opts = opts || {};
  var _prog = opts.onProgress || function(){};
  var _tier = opts.tier || 'primary';
  var _sfx = _tier === 'secondary' ? '_secondary' : '';
  var _aiCfgO = _getAITier(_tier);
  var key = _aiCfgO.key;
  if (!key) return 0;
  var chatUrl = _buildAIUrlForTier(_tier);
  if (!chatUrl) return 0;

  // 测试梯度：请求这些 token 目标·看实际输出
  var tests = opts.tests || [32768, 16384, 8192, 4096];
  var results = [];
  var realLimit = 0;

  for (var ti = 0; ti < tests.length; ti++) {
    var target = tests[ti];
    _prog('实测输出 ' + Math.round(target/1024) + 'K tokens...');
    try {
      var resp = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: _aiCfgO.model || '',
          messages: [{ role: 'user', content:
            'Generate a long continuous story of approximately ' + target + ' tokens. Keep writing narrative details without stopping. Do not ask clarifying questions.\n' +
            '请连续生成约 ' + target + ' tokens 的长篇故事叙事·中途不要停顿不要反问·尽情铺陈细节。'
          }],
          temperature: 0.7,
          max_tokens: target,
          stream: false
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(60000) : undefined
      });
      if (!resp.ok) {
        var _errTxt = ''; try { _errTxt = (await resp.text()).slice(0,200); } catch(_){}
        _ctxLog('[output测] 请求' + target + ' HTTP' + resp.status + ' ' + _errTxt);
        results.push({ request: target, actual: 0, error: 'HTTP' + resp.status, finishReason: '' });
        continue;
      }
      var data = await resp.json();
      var actualTokens = 0;
      var finishReason = '';
      if (data.usage && data.usage.completion_tokens) actualTokens = data.usage.completion_tokens;
      if (data.choices && data.choices[0]) {
        finishReason = data.choices[0].finish_reason || data.choices[0].stop_reason || '';
        if (!actualTokens && data.choices[0].message && data.choices[0].message.content) {
          // 无 usage 时粗估：英文/中文混合约 2.5 字/token
          actualTokens = Math.round(data.choices[0].message.content.length / 2.5);
        }
      }
      _ctxLog('[output测] 请求' + target + ' → 实际' + actualTokens + ' (' + finishReason + ')');
      results.push({ request: target, actual: actualTokens, error: '', finishReason: finishReason });
      // 若 finish_reason=='length'·说明用满了·realLimit 至少是此数字
      // 若 finish_reason=='stop'·说明是自然结束·realLimit ≥ actual
      if (finishReason === 'length' || finishReason === 'max_tokens') {
        realLimit = Math.max(realLimit, actualTokens);
        // 被截断·跳过更大的请求（更大也只会到这里）
        break;
      } else {
        realLimit = Math.max(realLimit, actualTokens);
        // 自然结束·若没达到 target 的 50%·降一档继续测
        if (actualTokens < target * 0.5) continue;
        // 达到目标·不再测小的
        break;
      }
    } catch(_e) {
      _ctxLog('[output测] 请求' + target + ' 异常 ' + (_e.message||_e));
      results.push({ request: target, actual: 0, error: String(_e.message||_e), finishReason: '' });
    }
  }

  // 存入 P.conf·tier 特化
  if (!P.conf._probeHistory) P.conf._probeHistory = {};
  var _phKey = _tier === 'secondary' ? 'outputLimit_secondary' : 'outputLimit';
  P.conf._probeHistory[_phKey] = {
    tests: results,
    realLimitTokens: realLimit,
    timestamp: Date.now(),
    model: _aiCfgO.model || '',
    tier: _tier
  };
  if (realLimit > 0) P.conf['_measuredMaxOutput' + _sfx] = realLimit;
  _ctxLog('[output测·' + _tier + '] 最终实测: ' + realLimit + ' tokens');
  return realLimit;
}

// ============================================================
//  防欺骗·AI 自报交叉验证 (增强层3)
//  做法：同一问题问 3 次·与白名单交叉验证
// ============================================================
async function probeModelSelfReport(opts) {
  opts = opts || {};
  var _prog = opts.onProgress || function(){};
  var _tierP = opts.tier || 'primary';
  var _sfxP = _tierP === 'secondary' ? '_secondary' : '';
  var _aiCfgP = _getAITier(_tierP);
  var key = _aiCfgP.key; var chatUrl = _buildAIUrlForTier(_tierP);
  if (!key || !chatUrl) return null;

  var questions = [
    { q: '你能处理的最大输入 token 数（上下文窗口）是多少？只答一个整数·例如 131072。', expect: 'ctx' },
    { q: '你单次回复能生成的最大 token 数是多少？只答一个整数·例如 8192。', expect: 'out' },
    { q: 'What is your exact model name/version as you understand it? Reply in 10 words.', expect: 'model' }
  ];
  var answers = [];
  for (var qi = 0; qi < questions.length; qi++) {
    _prog('询问模型 ' + (qi+1) + '/' + questions.length + '...');
    try {
      var resp = await fetch(chatUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
        body: JSON.stringify({
          model: _aiCfgP.model || '',
          messages: [{ role:'user', content: questions[qi].q }],
          temperature: 0, max_tokens: 50
        }),
        signal: AbortSignal.timeout ? AbortSignal.timeout(15000) : undefined
      });
      if (!resp.ok) { answers.push({ q: questions[qi].q, a: '', err: 'HTTP'+resp.status }); continue; }
      var j = await resp.json();
      var a = (j.choices && j.choices[0] && j.choices[0].message) ? j.choices[0].message.content : '';
      answers.push({ q: questions[qi].q, a: a, kind: questions[qi].expect });
    } catch(_e) { answers.push({ q: questions[qi].q, a: '', err: _e.message||String(_e) }); }
  }

  // 解析数字
  function _extractNum(str) {
    if (!str) return 0;
    var m = (str+'').match(/[\d,_.]+/g);
    if (!m) return 0;
    var cands = m.map(function(n){ return parseInt(n.replace(/[,_.]/g,''),10); }).filter(function(n){ return n>=1000; });
    return cands.length ? Math.max.apply(null, cands) : 0;
  }
  var ctxClaimed = _extractNum(answers[0] && answers[0].a);
  var outClaimed = _extractNum(answers[1] && answers[1].a);
  var modelClaimed = (answers[2] && answers[2].a) || '';
  // 白名单基准
  var wlCtx = (typeof _matchModelCtx === 'function') ? _matchModelCtx(_aiCfgP.model||'') : 0;
  var wlOut = (typeof _matchModelOutput === 'function') ? _matchModelOutput(_aiCfgP.model||'') : 0;
  // 欺骗检测
  var warnings = [];
  if (wlCtx > 0 && ctxClaimed > 0) {
    var ctxClaimedK = _normalizeToK(ctxClaimed);
    if (ctxClaimedK > wlCtx * 2) warnings.push('上下文声称' + ctxClaimedK + 'K·白名单仅' + wlCtx + 'K·疑虚报');
    else if (ctxClaimedK < wlCtx / 2) warnings.push('上下文声称' + ctxClaimedK + 'K·白名单为' + wlCtx + 'K·疑缩水代理');
  }
  if (wlOut > 0 && outClaimed > 0) {
    var outClaimedK = _normalizeToK(outClaimed);
    if (outClaimedK > wlOut * 2) warnings.push('输出声称' + outClaimedK + 'K·白名单仅' + wlOut + 'K·疑虚报');
  }
  if (modelClaimed && _aiCfgP.model) {
    var lowerC = modelClaimed.toLowerCase(), lowerR = (_aiCfgP.model||'').toLowerCase();
    // 截取前部的模型家族主词做粗匹（例如 "claude" / "gpt" / "gemini"）
    var _fams = ['claude','gpt','deepseek','gemini','qwen','glm','llama','mistral','moonshot','kimi','yi','baichuan'];
    var reqFam = _fams.find(function(f){ return lowerR.indexOf(f)>=0; });
    var claimFam = _fams.find(function(f){ return lowerC.indexOf(f)>=0; });
    if (reqFam && claimFam && reqFam !== claimFam) warnings.push('声称家族' + claimFam + ' 不匹配请求的 ' + reqFam + '·疑中转代理替换');
  }

  var report = {
    answers: answers,
    contextClaimedTokens: ctxClaimed, contextClaimedK: _normalizeToK(ctxClaimed),
    outputClaimedTokens: outClaimed, outputClaimedK: _normalizeToK(outClaimed),
    modelClaimedName: modelClaimed,
    whitelistCtxK: wlCtx, whitelistOutK: wlOut,
    warnings: warnings,
    timestamp: Date.now(),
    model: _aiCfgP.model || '',
    tier: _tierP
  };
  if (!P.conf._probeHistory) P.conf._probeHistory = {};
  var _srKey = _tierP === 'secondary' ? 'selfReport_secondary' : 'selfReport';
  P.conf._probeHistory[_srKey] = report;
  return report;
}

// ============================================================
//  新·列出 API 可用模型（GET /models）
// ============================================================
async function listAvailableModels(opts) {
  opts = opts || {};
  var _tier = opts.tier || 'primary';
  var _aiCfgL = _getAITier(_tier);
  var key = _aiCfgL.key;
  if (!key) throw new Error('未配置 API key');
  var baseUrl = (_aiCfgL.url || '').replace(/\/+$/, '').replace(/\/chat\/completions\/?$/,'').replace(/\/messages\/?$/,'');
  var vm = baseUrl.match(/(.*\/v\d+)/);
  if (vm) baseUrl = vm[1];
  var listUrl = baseUrl + '/models';
  try {
    var resp = await fetch(listUrl, {
      method: 'GET',
      headers: { 'Authorization': 'Bearer ' + key, 'x-api-key': key, 'anthropic-version': '2023-06-01' },
      signal: AbortSignal.timeout ? AbortSignal.timeout(10000) : undefined
    });
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    var data = await resp.json();
    var models = [];
    if (Array.isArray(data)) models = data;
    else if (Array.isArray(data.data)) models = data.data;
    else if (Array.isArray(data.models)) models = data.models;
    // 归一化：每条 {id, ctx, out, matched}
    return models.map(function(m){
      var id = (m.id || m.name || m.model || '') + '';
      var wlCtx = (typeof _matchModelCtx === 'function') ? _matchModelCtx(id) : 0;
      var wlOut = (typeof _matchModelOutput === 'function') ? _matchModelOutput(id) : 0;
      return {
        id: id,
        contextK: wlCtx,
        outputK: wlOut,
        matched: wlCtx > 0,
        ownedBy: m.owned_by || m.organization || '',
        created: m.created || 0
      };
    }).filter(function(m){ return m.id; }).sort(function(a,b){
      // 有白名单匹配的在前·按 contextK 降序
      if (a.matched !== b.matched) return a.matched ? -1 : 1;
      return (b.contextK||0) - (a.contextK||0);
    });
  } catch(e) {
    throw new Error('列出模型失败：' + (e.message||e));
  }
}

/**
 * 获取当前模型的上下文窗口大小（同步版本，使用缓存）
 * 如果尚未探测，返回保守默认值32K
 * @returns {number} K tokens
 */
function getModelContextSizeK() {
  if (P.conf.contextSizeK && P.conf.contextSizeK > 0) return P.conf.contextSizeK;
  if (P.conf._detectedContextK) return P.conf._detectedContextK;
  return 32; // 未探测时的保守默认值
}

/**
 * 根据上下文窗口大小计算压缩参数
 * @param {number} [ctxK] - 上下文窗口大小(K)，不传则自动获取
 * @returns {Object} 压缩参数
 */
// ============================================================
//  AI生成字数统一取值系统
//  所有prompt中不再硬编码字数，统一通过此函数获取
// ============================================================
var _charRangeDefaults = {
  shilu:    [200, 400],    // 实录（文言史官体，仿资治通鉴/实录）
  szj:      [600, 1200],   // 时政记（朝政纪要体，因果链完整）
  houren:   [2500, 6000],  // 后人戏说（场景叙事，完整生活进程）
  zw:       [400, 800],    // 兼容——旧"二次叙事"，逐步废弃
  memLoyal: [400, 600],    // 奏疏（谏章/忠臣）
  memNormal:[200, 350],    // 奏疏（普通）
  memSecret:[150, 250],    // 奏疏（密折）
  wd:       [120, 250],    // 问对回复
  cy:       [120, 250],    // 朝议发言
  chronicle:[800, 1500],   // 编年史记
  comment:  [80, 200]      // 太史公评语
};

/**
 * 获取指定类别的字数范围 [min, max]
 * @param {string} category - 类别键名
 * @returns {number[]} [min, max]
 */
function _getCharRange(category) {
  var base = _charRangeDefaults[category] || [100, 300];
  var v = (P && P.conf && P.conf.verbosity) ? P.conf.verbosity : 'standard';
  if (v === 'custom') {
    var minKey = category + 'Min', maxKey = category + 'Max';
    return [
      (P.conf[minKey] !== undefined && P.conf[minKey] > 0) ? P.conf[minKey] : base[0],
      (P.conf[maxKey] !== undefined && P.conf[maxKey] > 0) ? P.conf[maxKey] : base[1]
    ];
  }
  var presetScale = v === 'concise' ? 0.6 : v === 'detailed' ? 1.5 : 1.0;
  // 与模型上下文窗口联动
  var cp = (typeof getCompressionParams === 'function') ? getCompressionParams() : { scale: 1.0 };
  var modelScale = Math.max(0.8, Math.min(cp.scale, 1.8));
  // M3: 模式影响字数——严格史实文言更长，演义可稍短
  var modeScale = 1.0;
  if (P && P.conf && P.conf.gameMode === 'strict_hist') modeScale = 1.15;
  var finalScale = presetScale * modelScale * modeScale;
  return [Math.round(base[0] * finalScale), Math.round(base[1] * finalScale)];
}

/**
 * 返回 "min-max字" 字符串，可直接嵌入prompt
 * @param {string} category
 * @returns {string}
 */
function _charRangeText(category) {
  var r = _getCharRange(category);
  return r[0] + '-' + r[1] + '字';
}

/**
 * 获取指定类别的缩略字数范围（按比例缩小，用于简短回应等）
 * @param {string} category
 * @param {number} ratio - 缩放比例，如0.5表示减半
 * @returns {string}
 */
function _charRangeScaled(category, ratio) {
  var r = _getCharRange(category);
  return Math.round(r[0] * ratio) + '-' + Math.round(r[1] * ratio) + '字';
}

function getCompressionParams(ctxK) {
  var k = ctxK || getModelContextSizeK();

  // 连续缩放而非阶梯式——任何上下文大小都能得到合理参数
  // 基准：32K = scale 1.0
  // 公式：scale = log2(ctxK / 8) / log2(32 / 8) = log2(ctxK/8) / 2
  // 这样 8K→0.0, 16K→0.5, 32K→1.0, 64K→1.32, 128K→1.61, 256K→1.86, 1M→2.32
  var rawScale = Math.log2(Math.max(k, 4) / 8) / 2;
  var scale = Math.max(0.2, Math.min(rawScale, 3.0)); // 限制在 0.2 ~ 3.0

  return {
    contextK: k,
    scale: scale,
    // 记忆压缩阈值
    memCompressThreshold: Math.round(60 * scale),       // 32K:60, 128K:97, 8K:12
    foreCompressThreshold: Math.round(35 * scale),       // 32K:35, 128K:56, 8K:7
    convCompressThreshold: Math.round(40 * scale),       // 32K:40, 128K:64, 8K:8
    // 压缩后保留的最近条目数
    memKeepRecent: Math.max(5, Math.round(20 * scale)),  // 32K:20, 128K:32, 8K:5
    foreKeepRecent: Math.max(3, Math.round(10 * scale)), // 32K:10, 128K:16, 8K:3
    // 压缩摘要目标字数
    summaryLen: Math.round(400 * scale) + '-' + Math.round(600 * scale),
    foreSummaryLen: String(Math.round(300 * scale)),
    // 每回合注入AI记忆条数
    memInjectCount: Math.max(3, Math.round(15 * scale)), // 32K:15, 128K:24, 8K:3
    // 硬上限（超过此值直接截断作为兜底）
    memHardLimit: Math.round(100 * scale),
    foreHardLimit: Math.round(60 * scale),
    // buildAIContext的截断因子
    contextTruncFactor: scale,
    // A3 NPC 心声注入参数（模型越好·纳入越多角色·每角色更多条·门槛更低）
    // 8K:3人/1条/阈8  32K:8人/2条/阈6  128K:13人/3条/阈5  256K:15人/3条/阈4  1M:15人/4条/阈3
    heartsMaxChars: Math.max(3, Math.min(20, Math.round(8 * scale))),
    heartsPerChar: Math.max(1, Math.min(4, Math.round(2 * scale))),
    heartsImportanceMin: Math.max(3, Math.min(9, Math.round(8 - scale * 2))),
    heartsTotalCap: Math.max(6, Math.min(80, Math.round(16 * scale))),
    // D2 对话摘要注入参数
    // 8K:8条  32K:16条  128K:25条  256K:30条  1M:40条
    dialogueTotalCap: Math.max(6, Math.min(50, Math.round(16 * scale))),
    dialogueRecentTurns: Math.max(2, Math.min(8, Math.round(3 * scale)))
  };
}

// 1.7: 自测函数——控制台运行 runSelfTests()
function runSelfTests() {
  var pass = 0, fail = 0;
  function assert(name, condition) {
    if (condition) { pass++; }
    else { fail++; console.error('[FAIL] ' + name); }
  }
  // 基础函数存在性（阶段一）
  assert('CORE_METRIC_LABELS exists', typeof CORE_METRIC_LABELS === 'object');
  assert('buildCoreMetricLabels exists', typeof buildCoreMetricLabels === 'function');
  assert('turnsForDuration exists', typeof turnsForDuration === 'function');
  assert('turnsForDuration year > 0', typeof turnsForDuration === 'function' && turnsForDuration('year') > 0);
  assert('getTimeRatio exists', typeof getTimeRatio === 'function');
  assert('findOfficeByFunction null safe', typeof findOfficeByFunction === 'function' && findOfficeByFunction('不存在的职能xyz') === null);
  assert('escHtml exists', typeof escHtml === 'function');
  assert('escHtml works', typeof escHtml === 'function' && escHtml('<b>') === '&lt;b&gt;');
  assert('NpcMemorySystem.addMemory exists', typeof NpcMemorySystem !== 'undefined' && typeof NpcMemorySystem.addMemory === 'function');
  assert('NpcMemorySystem.remember exists', typeof NpcMemorySystem !== 'undefined' && typeof NpcMemorySystem.remember === 'function');

  // 阶段1.5: 架构基础设施
  assert('1A.1 createAction exists', typeof createAction === 'function');
  assert('1A.1 createAction works', (function() {
    var a = createAction({ id:'test', execute: function(){return 42;}, canExecute: function(){return {ok:true};} });
    return a && a.execute && a.execute().ok === true;
  })());
  assert('1A.2 ChangeLog exists', typeof ChangeLog !== 'undefined' && typeof ChangeLog.record === 'function');
  assert('1A.2 ChangeLog works', (function() {
    ChangeLog.record('test', 'x', 'y', 0, 1, 'selftest');
    var r = ChangeLog.getRecent(1);
    return r.length > 0 && r[r.length-1].category === 'test';
  })());
  assert('1A.3 BALANCE_CONFIG exists', typeof BALANCE_CONFIG === 'object' && BALANCE_CONFIG.coupling && BALANCE_CONFIG.execution && BALANCE_CONFIG.edict);
  assert('1A.3 getBalanceVal works', typeof getBalanceVal === 'function' && getBalanceVal('execution.floor') === 0.35);
  assert('1A.4 robustParseJSON exists', typeof robustParseJSON === 'function');
  assert('1A.4 robustParseJSON basic', (function() {
    var r = robustParseJSON('{"a":1}');
    return r && r.a === 1;
  })());
  assert('1A.4 robustParseJSON trailing comma', (function() {
    var r = robustParseJSON('{"a":1, "b":2,}');
    return r && r.a === 1 && r.b === 2;
  })());
  assert('1A.4 robustParseJSON chinese quotes', (function() {
    var r = robustParseJSON('{\u201ca\u201d: 1}');
    return r && r.a === 1;
  })());
  assert('1A.4 sanitizeNumericDelta works', sanitizeNumericDelta(999, -10, 10) === 10 && sanitizeNumericDelta('abc') === 0);
  assert('1A.5 DebugLog exists', typeof DebugLog !== 'undefined' && typeof DebugLog.enable === 'function');
  assert('1A.5 DebugLog.status works', typeof DebugLog.status() === 'string');

  // 阶段二: 核心机制增强
  assert('2.6 GameEventBus exists', typeof GameEventBus !== 'undefined' && typeof GameEventBus.emit === 'function');
  assert('2.6 GameEventBus on/emit works', (function() {
    var received = false;
    GameEventBus.on('_selftest', function(d) { received = d.ok; });
    GameEventBus.emit('_selftest', { ok: true });
    GameEventBus.off('_selftest');
    return received === true;
  })());
  assert('2.1 stateCoupling registered', typeof SettlementPipeline !== 'undefined' && SettlementPipeline.list().some(function(s) { return s.id === 'stateCoupling'; }));
  assert('2.2 processEdictEffects exists', typeof processEdictEffects === 'function');
  assert('2.3 computeExecutionPipeline exists', typeof computeExecutionPipeline === 'function');
  assert('2.5 calculateBuildingOutput exists', typeof calculateBuildingOutput === 'function');

  // 阶段三
  assert('3.1 computeNpcIntents exists', typeof computeNpcIntents === 'function');
  assert('3.1 npcIntentAnalysis registered', typeof SettlementPipeline !== 'undefined' && SettlementPipeline.list().some(function(s) { return s.id === 'npcIntentAnalysis'; }));
  assert('3.3 AISubCallRegistry exists', typeof AISubCallRegistry !== 'undefined' && typeof AISubCallRegistry.register === 'function');
  assert('3.3 AISubCallRegistry runPipeline exists', typeof AISubCallRegistry !== 'undefined' && typeof AISubCallRegistry.runPipeline === 'function');

  // 阶段四
  assert('4.2 calculateProvinceEconomy exists', typeof calculateProvinceEconomy === 'function');
  assert('4.3 enhancedResolveBattle exists', typeof enhancedResolveBattle === 'function');
  assert('4.3 calculateSiegeProgress exists', typeof calculateSiegeProgress === 'function');
  assert('4.4 healthDecay registered', typeof SettlementPipeline !== 'undefined' && SettlementPipeline.list().some(function(s) { return s.id === 'healthDecay'; }));
  assert('4.5 resolveHeir supports successionLaw', typeof resolveHeir === 'function');
  assert('4.6 DecisionRegistry exists', typeof DecisionRegistry !== 'undefined' && typeof DecisionRegistry.register === 'function');
  assert('4.6 DecisionRegistry scanNpcDecisions exists', typeof DecisionRegistry !== 'undefined' && typeof DecisionRegistry.scanNpcDecisions === 'function');

  // AI推演质量提升
  assert('1.1 PromptLayerCache exists', typeof PromptLayerCache !== 'undefined' && typeof PromptLayerCache.getFixedLayer === 'function');
  assert('1.2 ModelAdapter exists', typeof ModelAdapter !== 'undefined' && typeof ModelAdapter.detectFamily === 'function');
  assert('1.2 ModelAdapter detects openai', ModelAdapter.detectFamily('gpt-4o') === 'openai');
  assert('1.2 ModelAdapter detects anthropic', ModelAdapter.detectFamily('claude-sonnet-4-20250514') === 'anthropic');
  assert('1.6 TokenUsageTracker exists', typeof TokenUsageTracker !== 'undefined' && typeof TokenUsageTracker.record === 'function');
  assert('1.6 TokenUsageTracker records', (function() {
    var _savedData = JSON.parse(JSON.stringify(TokenUsageTracker._data));
    TokenUsageTracker.record({prompt_tokens:10,completion_tokens:5});
    var s = TokenUsageTracker.getStats();
    var ok = s.totalTokens >= 15;
    TokenUsageTracker._data = _savedData; // 恢复，不污染累计数据
    return ok;
  })());
  assert('1.7 PromptTemplate exists', typeof PromptTemplate !== 'undefined' && typeof PromptTemplate.render === 'function');
  assert('1.7 PromptTemplate renders', (function() {
    PromptTemplate.register('_test', 'Hello {{name}}!');
    return PromptTemplate.render('_test', {name:'World'}) === 'Hello World!';
  })());

  // 代码架构
  assert('8.2 TM namespace exists', typeof TM !== 'undefined' && typeof TM.utils === 'object');
  assert('8.6 ErrorMonitor exists', typeof ErrorMonitor !== 'undefined' && typeof ErrorMonitor.capture === 'function');

  // GM状态完整性
  if (typeof GM !== 'undefined' && GM.running) {
    assert('GM.chars is array', Array.isArray(GM.chars));
    assert('GM.facs is array', Array.isArray(GM.facs));
    assert('GM._mutableFacts is array', Array.isArray(GM._mutableFacts));
    assert('GM.eraProgress exists', GM.eraProgress && typeof GM.eraProgress.collapse === 'number');
    assert('GM.borderThreat is number', typeof GM.borderThreat === 'number');
    assert('findCharByName works', typeof findCharByName === 'function' && GM.chars.length > 0 && findCharByName(GM.chars[0].name) !== null);
    // mechanicsConfig
    assert('P.mechanicsConfig exists', typeof P !== 'undefined' && P.mechanicsConfig && Array.isArray(P.mechanicsConfig.chronicleWhitelist));
    assert('P.mechanicsConfig.couplingRules exists', typeof P !== 'undefined' && P.mechanicsConfig && Array.isArray(P.mechanicsConfig.couplingRules));
    assert('P.mechanicsConfig.executionPipeline exists', typeof P !== 'undefined' && P.mechanicsConfig && Array.isArray(P.mechanicsConfig.executionPipeline));
  }
  console.log('[SelfTest] ' + pass + ' passed, ' + fail + ' failed');
  return fail === 0;
}

// ============================================================
//  8.2 TM 统一命名空间
// ============================================================
//  全局图片生成API（独立于主文本API，编辑器和游戏通用）
// ============================================================
var ImageAPI = {
  /** 获取生图API配置 */
  getConfig: function() {
    var imgCfg = {};
    try { imgCfg = JSON.parse(localStorage.getItem('tm_api_image') || '{}'); } catch(e) {}
    if (imgCfg.key && imgCfg.url) return {supported: true, key: imgCfg.key, url: imgCfg.url, model: imgCfg.model || 'dall-e-3'};
    // 回退到主API
    var mainCfg = {};
    try { mainCfg = JSON.parse(localStorage.getItem('tm_api') || '{}'); } catch(e) {}
    if (typeof P !== 'undefined' && P.ai) mainCfg = P.ai;
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
//  原因：tm-error-collector.js 先于 tm-utils.js 加载后会设置 TM.errors，
//  若此处整体覆盖 TM 会把 errors 字段抹掉。改为 merge 模式。
// ============================================================
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

