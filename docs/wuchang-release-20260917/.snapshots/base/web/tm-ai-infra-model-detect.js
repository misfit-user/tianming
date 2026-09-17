// @ts-check
/// <reference path="types.d.ts" />
// tm-ai-infra-model-detect.js — 模型上下文/输出上限自动探测 + 各探针 + 压缩参数 + 自检
//   (第二十三拆·从 tm-ai-infra.js 中段切出·保序切割 sibling·排 origin 之后)
// 装载序：必须紧接 tm-ai-infra.js 之后装载（index.html · ?v=20260706-split23）——
//   与拆前逐字节等价靠此邻接。本片装载期无顶层函数调用，仅数据字面量(_MODEL_CTX_MAP/
//   _charRangeDefaults/_ctxDetectLog)与顶层 function 声明(挂全局)。
// 跨文件词法可见性：origin 与本片同为经典 <script>(非 module)，顶层 var/function 皆全局属性，互可见。
//   origin 对本片函数(getCompressionParams/getModelContextSizeK 等)的引用全在函数体内(运行时·带 typeof 守卫)，
//   故本片载于 origin 之后安全。业务体与原文逐字节一致(仅本头注释为新增)。
// 内容：_MODEL_CTX_MAP 白名单 + detectModelContextSize/detectModelOutputLimit + probeModel*(自报/举证/速查) +
//   listAvailableModels + getModelContextSizeK + 角色字数区间(_charRange*/getCompressionParams) + runSelfTests

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
      var chatUrl2 = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_tier) : _buildAIUrl();
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
      var chatUrl3 = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_tier) : _buildAIUrl();
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
    var chatUrl4 = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_tier) : _buildAIUrl();
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
  _persistProbeConf();
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
  _persistProbeConf();
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
  _persistProbeConf();
  return report;
}

// ============================================================
//  新·列出 API 可用模型（GET /models）
// ============================================================
// ============================================================
//  客观证据校验：不相信模型自报，改用可判分任务验证
//  覆盖：JSON 遵循、上下文回读、持续输出、响应元数据家族比对
// ============================================================
function _tmProbeJsonParse(text) {
  if (!text) return null;
  var s = String(text).trim();
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/```$/i, '').trim();
  try { return JSON.parse(s); } catch(_) {}
  var a = s.indexOf('{'), b = s.lastIndexOf('}');
  if (a >= 0 && b > a) {
    try { return JSON.parse(s.slice(a, b + 1)); } catch(_) {}
  }
  return null;
}

function _tmProbeFamily(name) {
  var s = String(name || '').toLowerCase();
  var fams = ['claude','gpt','openai','deepseek','gemini','qwen','glm','llama','mistral','moonshot','kimi','yi','baichuan'];
  for (var i = 0; i < fams.length; i++) {
    if (s.indexOf(fams[i]) >= 0) return fams[i] === 'openai' ? 'gpt' : fams[i];
  }
  return '';
}

async function probeModelEvidenceAudit(opts) {
  opts = opts || {};
  var _prog = opts.onProgress || function(){};
  var _tier = opts.tier || 'primary';
  var _sfx = _tier === 'secondary' ? '_secondary' : '';
  var _aiCfg = _getAITier(_tier);
  var key = _aiCfg.key;
  var chatUrl = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_tier) : _buildAIUrl();
  if (!key || !chatUrl) throw new Error('未配置可用 API');

  var startedAt = Date.now();
  var report = {
    tier: _tier,
    profile: 'tm-realistic-evidence-v2',
    model: _aiCfg.model || '',
    responseModel: '',
    checks: [],
    warnings: [],
    score: 0,
    weightedScore: 0,
    reliability: 'unknown',
    timestamp: Date.now(),
    elapsedMs: 0
  };

  function _addCheck(id, label, ok, detail, extra) {
    extra = extra || {};
    var weight = Number(extra.weight || 10);
    var row = {
      id: id,
      label: label,
      ok: !!ok,
      weight: weight,
      detail: String(detail || '').slice(0, 240)
    };
    Object.keys(extra).forEach(function(k){
      if (k !== 'weight') row[k] = extra[k];
    });
    report.checks.push(row);
    if (!row.ok) report.warnings.push(label + '未通过：' + row.detail);
  }

  function _sleep(ms) {
    return new Promise(function(resolve){ setTimeout(resolve, ms); });
  }

  async function _chat(label, messages, maxTokens, timeoutMs) {
    var attempt = 0;
    var lastErr = null;
    while (attempt < 2) {
      attempt += 1;
      var t0 = Date.now();
      try {
        _prog(label + (attempt > 1 ? '（重试）' : ''));
        var resp = await fetch(chatUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key },
          body: JSON.stringify({ model:_aiCfg.model || '', messages:messages, temperature:0, max_tokens:maxTokens || 256, stream:false }),
          signal: (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(timeoutMs || 30000) : undefined
        });
        if (!resp.ok) {
          var errTxt = ''; try { errTxt = (await resp.text()).slice(0, 200); } catch(_) {}
          var httpErr = new Error('HTTP ' + resp.status + ' ' + errTxt);
          httpErr.retryable = resp.status === 429 || resp.status >= 500;
          throw httpErr;
        }
        var data = await resp.json();
        if (data && data.model && !report.responseModel) report.responseModel = String(data.model);
        var ch = data && data.choices && data.choices[0];
        var msg = ch && ch.message;
        var text = '';
        if (typeof msg === 'string') text = msg;
        else if (msg && typeof msg.content === 'string') text = msg.content;
        else if (ch && typeof ch.text === 'string') text = ch.text;
        text = text || '';
        return {
          data: data,
          text: text,
          finishReason: (ch && (ch.finish_reason || ch.stop_reason)) || '',
          usage: (data && data.usage) || null,
          latencyMs: Date.now() - t0,
          responseChars: text.length,
          attempts: attempt
        };
      } catch(e) {
        lastErr = e;
        var retryable = !!(e && (e.retryable || e.name === 'TypeError' || /network|fetch|aborted|timeout/i.test(String(e.message || e))));
        if (!retryable || attempt >= 2) throw e;
        await _sleep(700);
      }
    }
    throw lastErr || new Error('模型调用失败');
  }

  try {
    var r1 = await _chat('证据校验 1/6：基础 JSON 遵循', [
      { role:'user', content:'Return ONLY strict JSON. No markdown. Object must be exactly: {"probe":"tm-evidence-v1","sum":1213,"reverse":"gnimnait","items":[2,4,6,8],"truth":true}' }
    ], 160, 20000);
    var j1 = _tmProbeJsonParse(r1.text);
    var ok1 = !!(j1 && j1.probe === 'tm-evidence-v1' && j1.sum === 1213 && j1.reverse === 'gnimnait' && Array.isArray(j1.items) && j1.items.length === 4 && j1.truth === true);
    _addCheck('json_schema', '基础严格 JSON/算术/字段', ok1, ok1 ? '字段与数值正确' : (r1.text || '').slice(0, 160), { weight:12, finishReason:r1.finishReason, latencyMs:r1.latencyMs, responseChars:r1.responseChars, attempts:r1.attempts });
  } catch(e1) { _addCheck('json_schema', '基础严格 JSON/算术/字段', false, e1.message || e1, { weight:12 }); }

  try {
    var endturnPrompt = '你正在接受《天命》回合推演结构化小样测试。Return ONLY strict JSON, no markdown. 必须返回完全可 JSON.parse 的对象：' +
      '{"probe":"tm-endturn-mini-v1","turn":"天启七年九月","variable_changes":[{"key":"huangquan","delta":-2,"reason":"赈灾诏令动用内帑"}],"character_changes":[{"name":"袁崇焕","field":"loyalty","delta":5,"reason":"升任辽东督师"}],"faction_actions":[{"faction":"后金","action":"整军","target":"辽东"}],"memory_entries":[{"owner":"袁崇焕","text":"因升任辽东督师而忠诚上升"}]}';
    var r2 = await _chat('证据校验 2/6：天命结构小样', [{ role:'user', content:endturnPrompt }], 420, 25000);
    var j2 = _tmProbeJsonParse(r2.text);
    var ok2 = !!(j2 && j2.probe === 'tm-endturn-mini-v1' &&
      Array.isArray(j2.variable_changes) && j2.variable_changes[0] && j2.variable_changes[0].key === 'huangquan' && j2.variable_changes[0].delta === -2 &&
      Array.isArray(j2.character_changes) && j2.character_changes[0] && j2.character_changes[0].name === '袁崇焕' && j2.character_changes[0].delta === 5 &&
      Array.isArray(j2.faction_actions) && j2.faction_actions[0] && j2.faction_actions[0].faction === '后金' &&
      Array.isArray(j2.memory_entries) && j2.memory_entries[0] && /忠诚上升/.test(j2.memory_entries[0].text || ''));
    _addCheck('endturn_schema', '天命回合结构化小样', ok2, ok2 ? '结构化变更字段可用' : (r2.text || '').slice(0, 180), { weight:24, finishReason:r2.finishReason, latencyMs:r2.latencyMs, responseChars:r2.responseChars, attempts:r2.attempts });
  } catch(e2) { _addCheck('endturn_schema', '天命回合结构化小样', false, e2.message || e2, { weight:24 }); }

  try {
    var repairPrompt = '把下面坏 JSON 修成严格 JSON。只输出 JSON，不解释，不加 markdown。坏 JSON：{probe:"tm-repair-mini-v1",edict_relations:[{edict:"命户部赈灾",result:"民心+3",},],resource_changes:[{pool:"guoku",delta:-5000,reason:"赈灾"},],note:"keep"}。输出必须保留 probe、edict_relations、resource_changes、note。';
    var r3 = await _chat('证据校验 3/6：坏 JSON 修复', [{ role:'user', content:repairPrompt }], 320, 25000);
    var j3 = _tmProbeJsonParse(r3.text);
    var ok3 = !!(j3 && j3.probe === 'tm-repair-mini-v1' && Array.isArray(j3.edict_relations) && j3.edict_relations[0] && /赈灾/.test(j3.edict_relations[0].edict || '') && Array.isArray(j3.resource_changes) && j3.resource_changes[0] && j3.resource_changes[0].delta === -5000);
    _addCheck('repair_resilience', '坏 JSON 修复能力', ok3, ok3 ? '可修复常见结构错误' : (r3.text || '').slice(0, 180), { weight:14, finishReason:r3.finishReason, latencyMs:r3.latencyMs, responseChars:r3.responseChars, attempts:r3.attempts });
  } catch(e3) { _addCheck('repair_resilience', '坏 JSON 修复能力', false, e3.message || e3, { weight:14 }); }

  try {
    var nHead = 'TMH' + Math.random().toString(36).slice(2, 8).toUpperCase();
    var nTail = 'TMT' + Math.random().toString(36).slice(2, 8).toUpperCase();
    var fillerUnit = '天命回合资料：朝臣争执、军费奏报、边镇情报、地方灾荒、人物记忆、势力活动。';
    var filler = fillerUnit.repeat(Math.max(100, Math.floor((opts.contextChars || 10000) / fillerUnit.length)));
    var contextPrompt = 'HEAD_SECRET=' + nHead + '\n旧情报：朝议主题=加税，处理方向=严征。\n' + filler + '\n最新诏令：本回合最终采用 朝议主题=赈灾，处理方向=缓征。TAIL_SECRET=' + nTail + '\nReturn ONLY JSON: {"head":"<HEAD_SECRET>","tail":"<TAIL_SECRET>","latestTopic":"赈灾","discardedTopic":"加税"}';
    var r4 = await _chat('证据校验 4/6：长上下文与新旧信息', [{ role:'user', content:contextPrompt }], 180, 35000);
    var j4 = _tmProbeJsonParse(r4.text);
    var ok4 = !!(j4 && j4.head === nHead && j4.tail === nTail && j4.latestTopic === '赈灾' && j4.discardedTopic === '加税');
    _addCheck('context_recall', '长上下文首尾与新旧信息', ok4, ok4 ? '首尾口令与最新指令一致' : (r4.text || '').slice(0, 180), { weight:20, finishReason:r4.finishReason, latencyMs:r4.latencyMs, responseChars:r4.responseChars, payloadChars:filler.length, attempts:r4.attempts });
  } catch(e4) { _addCheck('context_recall', '长上下文首尾与新旧信息', false, e4.message || e4, { weight:20 }); }

  try {
    var recordPrompt = '你正在接受《天命》时政记/实录生成小样测试。Return ONLY strict JSON, no markdown. 返回对象字段必须为 probe,title,summary,shiluText,shizhengji。probe 固定为 tm-record-mini-v1。正文必须自然提到 袁崇焕、辽东、赈灾 三个词，shiluText 至少两句，shizhengji 至少一句。';
    var r5 = await _chat('证据校验 5/6：时政记与实录样本', [{ role:'user', content:recordPrompt }], 520, 35000);
    var j5 = _tmProbeJsonParse(r5.text);
    var bundle = j5 ? [j5.title, j5.summary, j5.shiluText, j5.shizhengji].join('\n') : '';
    var ok5 = !!(j5 && j5.probe === 'tm-record-mini-v1' && j5.title && j5.summary && /袁崇焕/.test(bundle) && /辽东/.test(bundle) && /赈灾/.test(bundle) && String(j5.shiluText || '').length >= 40 && String(j5.shizhengji || '').length >= 20);
    _addCheck('narrative_record', '时政记/实录叙事样本', ok5, ok5 ? '叙事字段与关键词完整' : (r5.text || '').slice(0, 180), { weight:18, finishReason:r5.finishReason, latencyMs:r5.latencyMs, responseChars:r5.responseChars, attempts:r5.attempts });
  } catch(e5) { _addCheck('narrative_record', '时政记/实录叙事样本', false, e5.message || e5, { weight:18 }); }

  try {
    var nonce = 'TML' + Math.random().toString(36).slice(2, 7).toUpperCase();
    var r6 = await _chat('证据校验 6/6：持续输出', [
      { role:'user', content:'Return exactly 60 lines. Each line format: TM-PROBE-001-' + nonce + ' through TM-PROBE-060-' + nonce + '. No prose, no markdown.' }
    ], 1200, 45000);
    var re = new RegExp('TM-PROBE-\\d{3}-' + nonce, 'g');
    var matches = (r6.text.match(re) || []);
    var ok6 = matches.length >= 50 && r6.text.indexOf('TM-PROBE-050-' + nonce) >= 0;
    _addCheck('output_sustain', '持续输出可控文本', ok6, ok6 ? ('生成 ' + matches.length + '/60 行') : ('仅生成 ' + matches.length + '/60 行'), { weight:12, finishReason:r6.finishReason, usage:r6.usage || null, latencyMs:r6.latencyMs, responseChars:r6.responseChars, attempts:r6.attempts });
  } catch(e6) { _addCheck('output_sustain', '持续输出可控文本', false, e6.message || e6, { weight:12 }); }

  var reqFam = _tmProbeFamily(_aiCfg.model || '');
  var respFam = _tmProbeFamily(report.responseModel || '');
  if (report.responseModel && reqFam && respFam && reqFam !== respFam) {
    report.warnings.push('响应元数据模型家族疑似不匹配：请求 ' + reqFam + '，响应 ' + respFam + '（' + report.responseModel + '）');
  }
  var passed = report.checks.filter(function(c){ return c.ok; }).length;
  var totalWeight = report.checks.reduce(function(sum, c){ return sum + (Number(c.weight) || 0); }, 0);
  var passedWeight = report.checks.reduce(function(sum, c){ return sum + (c.ok ? (Number(c.weight) || 0) : 0); }, 0);
  report.weightedScore = totalWeight ? Math.round(passedWeight / totalWeight * 100) : 0;
  report.score = report.weightedScore;
  report.passed = passed;
  report.total = report.checks.length;
  report.elapsedMs = Date.now() - startedAt;
  report.reliability = report.score >= 90 ? 'high' : report.score >= 65 ? 'medium' : 'low';
  if (!P.conf._probeHistory) P.conf._probeHistory = {};
  var keyName = _tier === 'secondary' ? 'evidence_secondary' : 'evidence';
  P.conf._probeHistory[keyName] = report;
  P.conf['_evidenceScore' + _sfx] = report.score;
  P.conf['_evidenceReliability' + _sfx] = report.reliability;
  _persistProbeConf();
  return report;
}

// ============================================================
//  连接快检（2026-07-04·「测试连接」时自动跑·轻量三小调用）
//  ①连通/延迟/模型回声(防中转偷换)/usage字段 ②流式SSE ③严格JSON mini(天命结算命门)
//  重项（证据校验6调·实测输出长篇）不自动·由报告卡按钮转交既有探测
// ============================================================
async function probeModelQuickCheck(opts) {
  opts = opts || {};
  var _prog = opts.onProgress || function(){};
  var _tier = opts.tier || 'primary';
  var _aiCfg = _getAITier(_tier);
  var key = _aiCfg.key;
  var chatUrl = (typeof _buildAIUrlForTier === 'function') ? _buildAIUrlForTier(_tier) : _buildAIUrl();
  if (!key || !chatUrl) throw new Error('未配置可用 API');
  var _hdrs = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + key };
  var _sig = function(ms){ return (typeof AbortSignal !== 'undefined' && AbortSignal.timeout) ? AbortSignal.timeout(ms) : undefined; };
  var report = {
    tier: _tier, model: _aiCfg.model || '', responseModel: '',
    latencyMs: 0, usageSeen: false, echo: 'unknown',
    stream: { ok: false, detail: '' }, json: { ok: false, detail: '' },
    warnings: [], timestamp: Date.now()
  };

  // 1/3 连通·延迟·模型回声·usage
  _prog('快检 1/3：连通与模型回声…');
  var t0 = Date.now();
  var r1 = await fetch(chatUrl, { method: 'POST', headers: _hdrs, signal: _sig(20000),
    body: JSON.stringify({ model: _aiCfg.model || '', messages: [{ role: 'user', content: 'Reply with exactly: OK' }], temperature: 0, max_tokens: 8, stream: false }) });
  if (!r1.ok) { var _et = ''; try { _et = (await r1.text()).slice(0, 200); } catch(_) {} var _he = new Error('HTTP ' + r1.status + (_et ? ' · ' + _et : '')); _he.httpStatus = r1.status; throw _he; }
  var d1 = await r1.json();
  report.latencyMs = Date.now() - t0;
  report.responseModel = (d1 && d1.model) ? String(d1.model) : '';
  report.usageSeen = !!(d1 && d1.usage && (d1.usage.total_tokens || d1.usage.completion_tokens || d1.usage.prompt_tokens));
  if (report.responseModel && report.model) {
    var _a = report.model.toLowerCase(), _b = report.responseModel.toLowerCase();
    if (_b.indexOf(_a) >= 0 || _a.indexOf(_b) >= 0) report.echo = 'match';
    else {
      var _fa = (typeof _tmProbeFamily === 'function') ? _tmProbeFamily(_a) : '', _fb = (typeof _tmProbeFamily === 'function') ? _tmProbeFamily(_b) : '';
      report.echo = (_fa && _fb) ? (_fa === _fb ? 'family' : 'mismatch') : 'unknown';
    }
  }
  if (report.echo === 'mismatch') report.warnings.push('响应模型「' + report.responseModel + '」与标称「' + report.model + '」家族不符，疑中转偷换模型');
  if (!report.usageSeen) report.warnings.push('响应缺 usage 用量字段，成本统计与预算档位可能失准');
  if (report.latencyMs > 8000) report.warnings.push('单次往返 ' + Math.round(report.latencyMs / 1000) + ' 秒，偏慢，过回合体感会拖长');

  // 2/3 流式 SSE
  _prog('快检 2/3：流式支持…');
  try {
    var t1 = Date.now();
    var r2 = await fetch(chatUrl, { method: 'POST', headers: _hdrs, signal: _sig(20000),
      body: JSON.stringify({ model: _aiCfg.model || '', messages: [{ role: 'user', content: 'Count: 1 2 3' }], temperature: 0, max_tokens: 16, stream: true }) });
    if (r2.ok && r2.body && r2.body.getReader) {
      var _rd = r2.body.getReader(); var _dec = new TextDecoder(); var _buf = ''; var _saw = false; var _reads = 0;
      while (_reads < 40) {
        var _it = await _rd.read();
        if (_it.done) break;
        _buf += _dec.decode(_it.value, { stream: true }); _reads++;
        if (/data:\s*[\[{]/.test(_buf)) { _saw = true; break; }
      }
      try { _rd.cancel(); } catch(_) {}
      report.stream.ok = _saw;
      report.stream.detail = _saw ? ('首包 ' + (Date.now() - t1) + 'ms') : '未见 SSE 数据帧（或以整包返回）';
    } else {
      report.stream.detail = r2.ok ? '环境不支持流式读取' : ('HTTP ' + r2.status);
    }
  } catch(_es) { report.stream.detail = _es.message || String(_es); }
  if (!report.stream.ok) report.warnings.push('流式不可用：' + report.stream.detail + '（不碍推演，问天等逐字显示退化为整段）');

  // 3/3 严格 JSON mini（回合结算依赖结构化输出·此项不过=大雷）
  _prog('快检 3/3：严格 JSON 遵循…');
  try {
    var t2 = Date.now();
    var r3 = await fetch(chatUrl, { method: 'POST', headers: _hdrs, signal: _sig(25000),
      body: JSON.stringify({ model: _aiCfg.model || '', messages: [{ role: 'user', content: 'Return ONLY strict JSON. No markdown. Object must be exactly: {"probe":"tm-quick-v1","sum":407,"tags":["shi","nong","gong","shang"],"ok":true}' }], temperature: 0, max_tokens: 120, stream: false }) });
    if (r3.ok) {
      var d3 = await r3.json();
      var _ch = d3 && d3.choices && d3.choices[0];
      var _tx = (_ch && _ch.message && typeof _ch.message.content === 'string') ? _ch.message.content : ((_ch && typeof _ch.text === 'string') ? _ch.text : '');
      var _j = (typeof _tmProbeJsonParse === 'function') ? _tmProbeJsonParse(_tx) : null;
      var _okj = !!(_j && _j.probe === 'tm-quick-v1' && _j.sum === 407 && Array.isArray(_j.tags) && _j.tags.length === 4 && _j.ok === true);
      report.json.ok = _okj;
      report.json.detail = _okj ? ('通过 · ' + (Date.now() - t2) + 'ms') : (_tx || '(空响应)').slice(0, 120);
      if (!_okj) report.warnings.push('严格 JSON 未通过——天命回合结算依赖结构化输出，建议跑深度证据校验或换模型');
    } else {
      report.json.detail = 'HTTP ' + r3.status;
      report.warnings.push('JSON 遵循测试调用失败（HTTP ' + r3.status + '）');
    }
  } catch(_ej) {
    report.json.detail = _ej.message || String(_ej);
    report.warnings.push('JSON 遵循测试调用异常：' + report.json.detail);
  }

  try {
    if (!P.conf._probeHistory) P.conf._probeHistory = {}; // arch-ok 探测史缓存·与既有 selfReport/evidence 同容器同性质
    P.conf._probeHistory[_tier === 'secondary' ? 'quickCheck_secondary' : 'quickCheck'] = report; // arch-ok 探测史缓存
    if (typeof _persistProbeConf === 'function') _persistProbeConf();
  } catch(_) {}
  return report;
}

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
  if (P.conf.contextSizeK && P.conf.contextSizeK > 0) return P.conf.contextSizeK; // 手动覆写最高
  // 自动路径:取「探测值」与「按当前模型名查白名单」的较大值——
  //   不同玩家用不同模型·各取其真实窗口;无须先跑探测即可享受模型真实窗口;
  //   取较大值防探测自报层偏低(如模型谎报 64K 而实为 128K)。手动覆写仍可强制压低(应对受限代理)。
  var k = (P.conf._detectedContextK && P.conf._detectedContextK > 0) ? P.conf._detectedContextK : 0;
  try {
    if (typeof _matchModelCtx === 'function') {
      var _mk = _matchModelCtx((P.ai && P.ai.model) || '');
      if (_mk && _mk > k) k = _mk;
    }
  } catch (_mkE) {}
  return k > 0 ? k : 32; // 全未知模型的保守默认
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
    // 有效覆盖 NPC 数 = min(heartsMaxChars, floor(heartsTotalCap/heartsPerChar))·下为实际值:
    // 8K:3人/1条/阈8  32K:8人/2条/阈6  64K:12人/3条/阈5  128K:12-16人/4条/阈4  256K:15-20人/4条/阈3  1M:18-20人/4条/阈3
    // ★2026-07-03 修:旧 totalCap=16*scale 在 64-128K 被 perChar 反噬·把覆盖饿死到~8人(公式本意 maxChars 人)·
    //   与 NPC 记忆⇄推演连通性"方向A 名额饥饿"对应·系数 16→24 令 floor(totalCap/perChar) 逼近 maxChars(见 proj 记忆)。
    heartsMaxChars: Math.max(3, Math.min(20, Math.round(8 * scale))),
    heartsPerChar: Math.max(1, Math.min(4, Math.round(2 * scale))),
    heartsImportanceMin: Math.max(3, Math.min(9, Math.round(8 - scale * 2))),
    heartsTotalCap: Math.max(6, Math.min(80, Math.round(24 * scale))),
    // D2 对话摘要注入参数
    // 8K:8条  32K:16条  128K:25条  256K:30条  1M:40条
    dialogueTotalCap: Math.max(6, Math.min(50, Math.round(16 * scale))),
    dialogueRecentTurns: Math.max(2, Math.min(8, Math.round(3 * scale))),
    // P6.6 时政记分层全读（用户需求"超出读取回合范围的自动纳入压缩之中"）
    // 近端·完整全文回合数：8K:2  32K:5  128K:8  256K:10  1M:12
    fullReadTurns: Math.max(2, Math.min(15, Math.round(5 * scale))),
    // 中端·400 字摘要回合数（fullReadTurns 之外、压缩层之内的窗口）
    briefReadTurns: Math.max(6, Math.min(25, Math.round(12 * scale)))
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
  // 修谎言断言·TM.utils 全仓从未定义·此检查项此前恒 FAIL·改为忠实检查 TM 命名空间本体
  assert('8.2 TM namespace exists', typeof TM === 'object' && TM !== null);
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
