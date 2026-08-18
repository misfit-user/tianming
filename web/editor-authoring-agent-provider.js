// @ts-check
// ═══ 巨石拆分(20260706)：editor-authoring-agent Provider 簇(D·原行992-1343) ═══
// 从 editor-authoring-agent.js 迁出·须在其【之前】装载(填 TM.__aaParts bucket)。
// origin 顶部 require 本片(node)/editor.html+preview 按序装载(浏览器)。装载序契约见 lint-split-contracts。
(function(global) {
  'use strict';
  var TM = global.TM = global.TM || {};
  var P = TM.__aaParts = TM.__aaParts || {};
  // 反向依赖 shim(运行时活查·迁出体零改字节)——loadEditorApiConfig 定义在 origin
  function loadEditorApiConfig() { return P.loadEditorApiConfig.apply(null, arguments); }

  function _isAnthropic(url) {
    return url.indexOf('anthropic.com') >= 0 || url.indexOf('api.anthropic') >= 0;
  }

  // OpenAI 兼容端点规整：裸域名→/v1/chat/completions·.../v1→/chat/completions·完整端点原样。
  // 让第三方中转的各种 URL 写法都能拼对（成功调用中转的常见坑）。
  function _openaiEndpoint(url) {
    if (/\/(chat\/completions|messages|responses)(\?|#|$)/.test(url)) return url;
    if (/\/v\d+(beta)?$/.test(url)) return url + '/chat/completions';
    if (/^https?:\/\/[^/]+\/?$/.test(url)) return url.replace(/\/+$/, '') + '/v1/chat/completions';
    return url + '/chat/completions';
  }

  // 把调用失败归类成可操作的中文提示（中转最常见的 CORS/网络/鉴权/路径错误）。
  function _classifyApiError(e) {
    if (!e) return '未知错误';
    if (!e.status && ((e.name === 'TypeError') || /failed to fetch|networkerror|err_|load failed/i.test(e.message || ''))) {
      return '无法连接到 API：网络不通、地址错误，或第三方中转未开启 CORS 跨域。桌面客户端内一般不受 CORS 限制；浏览器内需中转支持跨域。';
    }
    if (e.status === 401 || e.status === 403) return 'API Key 无效或无权限（HTTP ' + e.status + '）。';
    if (e.status === 404) return 'API 地址不对（HTTP 404）：检查 URL 是否缺 /v1 或 /chat/completions。';
    if (e.status === 429) return 'API 限流（HTTP 429），已自动重试仍失败，请稍后再试。';
    if (e.status >= 500) return 'API 服务端错误（HTTP ' + e.status + '）。';
    return (e.message || String(e));
  }

  // ── 抽象 conversation → provider 消息 ──
  // conversation 项：{role:'user',text,images?:[dataURL]} | {role:'assistant',text,toolCalls:[{id,name,input}]} | {role:'tool',toolResults:[{id,name,content}]}
  function _genId(i) { return 'call_' + Date.now().toString(36) + '_' + i; }
  // S2 · 视觉附件：user 消息可带 images[](dataURL)——三家 provider 各自映射为多模态 content
  function _imgParts(images) { return (Array.isArray(images) ? images : []).filter(function (u) { return /^data:image\//.test(String(u || '')); }).slice(0, 4); }
  function _splitDataUrl(u) { var m = String(u).match(/^data:(image\/[a-z+.-]+);base64,(.*)$/i); return m ? { mime: m[1], b64: m[2] } : null; }

  function _toAnthropic(conversation, system, tools, maxTok, model) {
    var messages = conversation.map(function(turn) {
      if (turn.role === 'user') {
        var imgs = _imgParts(turn.images);
        if (imgs.length) {
          var blocks = [];
          imgs.forEach(function (u) { var p = _splitDataUrl(u); if (p) blocks.push({ type: 'image', source: { type: 'base64', media_type: p.mime, data: p.b64 } }); });
          blocks.push({ type: 'text', text: turn.text || '' });
          return { role: 'user', content: blocks };
        }
        return { role: 'user', content: turn.text || '' };
      }
      if (turn.role === 'assistant') {
        var content = [];
        if (turn.text) content.push({ type: 'text', text: turn.text });
        (turn.toolCalls || []).forEach(function(tc) { content.push({ type: 'tool_use', id: tc.id, name: tc.name, input: tc.input || {} }); });
        return { role: 'assistant', content: content.length ? content : (turn.text || '') };
      }
      return { role: 'user', content: (turn.toolResults || []).map(function(tr) { return { type: 'tool_result', tool_use_id: tr.id, content: String(tr.content == null ? '' : tr.content) }; }) };
    });
    var body = {
      model: model, max_tokens: maxTok, messages: messages,
      tools: tools.map(function(t) { return { name: t.name, description: t.description || '', input_schema: t.parameters || { type: 'object', properties: {} } }; }),
      tool_choice: { type: 'auto' }
    };
    // prompt caching：稳定的 system（规则+schema 速查）打 cache_control
    if (system) body.system = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }];
    return body;
  }

  function _toOpenAI(conversation, system, tools, maxTok, model, temp) {
    var messages = [];
    if (system) messages.push({ role: 'system', content: system });
    conversation.forEach(function(turn) {
      if (turn.role === 'user') {
        var imgs = _imgParts(turn.images);
        if (imgs.length) {
          var parts = [{ type: 'text', text: turn.text || '' }];
          imgs.forEach(function (u) { parts.push({ type: 'image_url', image_url: { url: u } }); });
          messages.push({ role: 'user', content: parts });
        } else messages.push({ role: 'user', content: turn.text || '' });
      }
      else if (turn.role === 'assistant') {
        var m = { role: 'assistant', content: turn.text || null };
        if (turn.toolCalls && turn.toolCalls.length) {
          m.tool_calls = turn.toolCalls.map(function(tc) { return { id: tc.id, type: 'function', function: { name: tc.name, arguments: JSON.stringify(tc.input || {}) } }; });
        }
        messages.push(m);
      } else {
        (turn.toolResults || []).forEach(function(tr) { messages.push({ role: 'tool', tool_call_id: tr.id, content: String(tr.content == null ? '' : tr.content) }); });
      }
    });
    return {
      model: model, temperature: temp, max_tokens: maxTok, messages: messages,
      tools: tools.map(function(t) { return { type: 'function', function: { name: t.name, description: t.description || '', parameters: t.parameters || { type: 'object', properties: {} } } }; }),
      tool_choice: 'auto'
    };
  }

  // 刀H1(CC max_tokens 动态调整对照) · 三 provider parse 层 surfacing 输出截断:
  //   truncated=输出被 maxTok 腰斩(finish_reason)·badToolJson=toolCall 入参 JSON 被斩断解析失败
  //   (此前 catch{} 吞成空入参静默执行——比"没调工具"更糟)。loop 据此提升输出上限重试本轮。
  function _parseAnthropic(data) {
    var text = '', toolCalls = [];
    if (Array.isArray(data.content)) {
      data.content.forEach(function(b, i) {
        if (b.type === 'text' && b.text) text += b.text;
        else if (b.type === 'tool_use' && b.name) toolCalls.push({ id: b.id || _genId(i), name: b.name, input: b.input || {} });
      });
    }
    return { text: text, toolCalls: toolCalls, truncated: data.stop_reason === 'max_tokens' };
  }

  function _parseOpenAI(data) {
    var text = '', toolCalls = [], badToolJson = false;
    if (data.choices && data.choices[0] && data.choices[0].message) {
      var msg = data.choices[0].message;
      if (msg.content) text = msg.content;
      (msg.tool_calls || []).forEach(function(tc, i) {
        var fn = tc.function || {}, input = {}, parsedOk = true;
        try { input = JSON.parse(fn.arguments || '{}'); } catch (e) { parsedOk = false; badToolJson = true; }
        if (fn.name && parsedOk) toolCalls.push({ id: tc.id || _genId(i), name: fn.name, input: input });   // 斩断的调用不执行(勿以空入参乱跑)
      });
    }
    if (!toolCalls.length && !badToolJson && Array.isArray(data.content)) return _parseAnthropic(data); // 代理直吐 anthropic content[]
    var fr = data.choices && data.choices[0] && (data.choices[0].finish_reason || data.choices[0].stop_reason);
    return { text: text, toolCalls: toolCalls, truncated: fr === 'length' || fr === 'max_tokens', badToolJson: badToolJson };
  }

  // ── 刀C · gemini 原生 provider（对标游戏 tm-ai-infra·第三方中转走 openai-compat 不受影响） ──
  function _isGeminiNative(url) {
    return /generativelanguage\.googleapis\.com/i.test(url) && !/\/v1beta\/openai\//i.test(url);
  }
  function _geminiEndpoint(url, model) {
    if (/:generate(Content|Message)/i.test(url)) return url;
    return url.replace(/\/+$/, '') + '/models/' + (model || 'gemini-1.5-pro') + ':generateContent';
  }
  function _toGemini(conversation, system, tools, maxTok, temp) {
    var contents = conversation.map(function(turn) {
      if (turn.role === 'user') {
        var uParts = [{ text: turn.text || '' }];
        _imgParts(turn.images).forEach(function (u) { var p = _splitDataUrl(u); if (p) uParts.push({ inline_data: { mime_type: p.mime, data: p.b64 } }); });
        return { role: 'user', parts: uParts };
      }
      if (turn.role === 'assistant') {
        var parts = [];
        if (turn.text) parts.push({ text: turn.text });
        (turn.toolCalls || []).forEach(function(tc) { parts.push({ functionCall: { name: tc.name, args: tc.input || {} } }); });
        return { role: 'model', parts: parts.length ? parts : [{ text: turn.text || '' }] };
      }
      return { role: 'user', parts: (turn.toolResults || []).map(function(tr) { return { functionResponse: { name: tr.name, response: { result: String(tr.content == null ? '' : tr.content) } } }; }) };
    });
    var body = {
      contents: contents,
      tools: [{ functionDeclarations: tools.map(function(t) { return { name: t.name, description: t.description || '', parameters: t.parameters || { type: 'object', properties: {} } }; }) }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { temperature: temp, maxOutputTokens: maxTok }
    };
    if (system) body.systemInstruction = { parts: [{ text: system }] };
    return body;
  }
  function _parseGemini(data) {
    var text = '', toolCalls = [];
    var cand = data && data.candidates && data.candidates[0];
    var parts = cand && cand.content && cand.content.parts;
    if (Array.isArray(parts)) {
      parts.forEach(function(p, i) {
        if (p.text) text += p.text;
        if (p.functionCall && p.functionCall.name) toolCalls.push({ id: _genId(i), name: p.functionCall.name, input: p.functionCall.args || {} });
      });
    }
    return { text: text, toolCalls: toolCalls, truncated: !!(cand && cand.finishReason === 'MAX_TOKENS') };   // 刀H1 · 截断 surfacing
  }

  // 抠掉 ```json``` 围栏 / <json> 标签，便于从被包裹文本里解析工具调用（中转/模型常这么吐）。
  function _stripJsonWrappers(text) {
    var s = String(text || '');
    var fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fence) s = fence[1];
    var tag = s.match(/<json>\s*([\s\S]*?)<\/json>/i);
    if (tag) s = tag[1];
    return s;
  }

  // 从纯文本抠 {tool_calls:[{name,input}]}（端点忽略 tools 直接吐 JSON 时兜底）
  function _parseJsonToolCalls(text) {
    if (!text) return [];
    var parsed = null;
    try {
      var unwrapped = _stripJsonWrappers(text);
      parsed = (typeof extractJSON === 'function') ? extractJSON(unwrapped) : JSON.parse(unwrapped);
    } catch (e) { return []; }
    var calls = [];
    if (parsed && Array.isArray(parsed.tool_calls)) {
      parsed.tool_calls.forEach(function(c, i) { if (c && c.name) calls.push({ id: _genId(i), name: c.name, input: c.input || c.arguments || {} }); });
    } else if (parsed && parsed.name) {
      calls.push({ id: _genId(0), name: parsed.name, input: parsed.input || {} });
    }
    return calls;
  }

  function _flattenConversation(system, conversation, tools) {
    var lines = [];
    if (system) lines.push(system);
    conversation.forEach(function(turn) {
      if (turn.role === 'user') lines.push('【用户】' + (turn.text || ''));
      else if (turn.role === 'assistant') {
        if (turn.text) lines.push('【助手】' + turn.text);
        (turn.toolCalls || []).forEach(function(tc) { lines.push('【助手调用】' + tc.name + ' ' + JSON.stringify(tc.input || {})); });
      } else {
        (turn.toolResults || []).forEach(function(tr) { lines.push('【结果】' + tr.name + ': ' + tr.content); });
      }
    });
    lines.push('\n可用工具: ' + tools.map(function(t) { return t.name + '(' + Object.keys((t.parameters && t.parameters.properties) || {}).join(',') + ')'; }).join(' / '));
    lines.push('只返回纯 JSON（不要 markdown）：{"tool_calls":[{"name":"<工具>","input":{...}}]}');
    return lines.join('\n');
  }

  function _abortError(reason) {
    var e = new Error(String(reason || '请求已取消'));
    e.name = 'AbortError'; e.aborted = true;
    return e;
  }
  function _delay(ms, signal) {
    return new Promise(function(resolve, reject) {
      if (signal && signal.aborted) return reject(_abortError(signal.reason));
      var timer = setTimeout(done, ms);
      function cleanup() { if (signal && signal.removeEventListener) signal.removeEventListener('abort', onAbort); }
      function done() { cleanup(); resolve(); }
      function onAbort() { clearTimeout(timer); cleanup(); reject(_abortError(signal && signal.reason)); }
      if (signal && signal.addEventListener) signal.addEventListener('abort', onAbort, { once: true });
    });
  }

  // 带重试/超时的 fetch（429 Retry-After·5xx/网络错误指数退避·AbortController 超时）
  function _fetchJSON(url, options, opts) {
    opts = opts || {};
    var maxRetries = opts.maxRetries != null ? opts.maxRetries : 3;
    var timeoutMs = opts.timeoutMs || 180000;
    var base = opts.retryBaseMs || 1000;
    var outerSignal = opts.signal || null;
    function attempt(n) {
      if (outerSignal && outerSignal.aborted) return Promise.reject(_abortError(outerSignal.reason));
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timedOut = false;
      var timer = ctrl ? setTimeout(function() { timedOut = true; ctrl.abort('timeout'); }, timeoutMs) : null;
      var onOuterAbort = null;
      if (ctrl && outerSignal && outerSignal.addEventListener) {
        onOuterAbort = function() { try { ctrl.abort(outerSignal.reason || 'aborted'); } catch (_) {} };
        outerSignal.addEventListener('abort', onOuterAbort, { once: true });
      }
      var fopt = Object.assign({}, options);
      if (ctrl) fopt.signal = ctrl.signal;
      else if (outerSignal) fopt.signal = outerSignal;
      function cleanup() {
        if (timer) clearTimeout(timer);
        if (onOuterAbort && outerSignal && outerSignal.removeEventListener) outerSignal.removeEventListener('abort', onOuterAbort);
      }
      return global.fetch(url, fopt).then(function(r) {
        cleanup();
        if (r.status === 429 && n < maxRetries) {
          var ra = parseInt((r.headers && r.headers.get && r.headers.get('Retry-After')) || '0', 10);
          return _delay(ra > 0 ? ra * 1000 : Math.min(30000, base * Math.pow(2, n)), outerSignal).then(function() { return attempt(n + 1); });
        }
        if (!r.ok) {
          return r.text().then(function(t) {
            var err = new Error('HTTP ' + r.status + ': ' + String(t).slice(0, 200));
            err.status = r.status;
            if (r.status >= 500 && n < maxRetries) return _delay(base * Math.pow(2, n), outerSignal).then(function() { return attempt(n + 1); });
            throw err;
          });
        }
        return r.json();
      }).catch(function(e) {
        cleanup();
        if (outerSignal && outerSignal.aborted) throw _abortError(outerSignal.reason);
        if (e && e.status) throw e;               // 已分类的 HTTP 错误
        if (n < maxRetries && (timedOut || !(e && e.aborted))) return _delay(base * Math.pow(2, n), outerSignal).then(function() { return attempt(n + 1); }); // 网络/超时
        throw e;
      });
    }
    return attempt(0);
  }

  // 刀G8(CC context-overflow 对照) · 超限识别:各 provider 的"上下文超窗"400 文案(OpenAI兼容/DeepSeek/Anthropic/Gemini)
  var _OVERFLOW_RE = /context[_\s-]?length|maximum context|context limit|context window|prompt is too long|input (length|token count)|exceeds? the maximum number of tokens|too many total tokens|max.?input.?tokens/i;

  /**
   * 自包含 tool-calling 调用（多轮 conversation·retry·无-tool 端点 JSON 兜底·system 缓存）。
   * @param {string|Array} conversation - 字符串(单轮)或抽象消息数组
   * @param {Array} tools
   * @param {{cfg?,maxTok?,system?,maxRetries?,timeoutMs?}} [opts]
   * @returns {Promise<{text, toolCalls:Array<{id,name,input}>, fallback?:boolean}>}
   */
  function callWithTools(conversation, tools, opts) {
    opts = opts || {};
    if (typeof conversation === 'string') conversation = [{ role: 'user', text: conversation }];
    var cfg = opts.cfg || loadEditorApiConfig();
    var maxTok = opts.maxTok || 3000;
    var system = opts.system || '';
    if (!cfg.key) return Promise.reject(new Error('API Key 未配置（请先在设置面板配置 API）'));
    if (!cfg.url) return Promise.reject(new Error('API 地址未配置'));
    if (!Array.isArray(tools) || !tools.length) return Promise.reject(new Error('callWithTools 需要 tools'));

    // 三路 provider：gemini 原生 / anthropic 原生(api.anthropic.com) / openai-compat（含一切第三方中转）
    var gemini = _isGeminiNative(cfg.url);
    var anthropic = !gemini && _isAnthropic(cfg.url);
    var endpoint, headers, body;
    if (gemini) {
      endpoint = _geminiEndpoint(cfg.url, cfg.model);
      headers = { 'Content-Type': 'application/json' };
      if (!/[?&]key=/i.test(endpoint)) headers['x-goog-api-key'] = cfg.key;
      body = _toGemini(conversation, system, tools, maxTok, cfg.temp);
    } else if (anthropic) {
      endpoint = cfg.url.indexOf('/messages') < 0 ? cfg.url + '/v1/messages' : cfg.url;
      headers = { 'Content-Type': 'application/json', 'x-api-key': cfg.key, 'anthropic-version': '2023-06-01' };
      body = _toAnthropic(conversation, system, tools, maxTok, cfg.model);
    } else {
      endpoint = _openaiEndpoint(cfg.url);
      headers = { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + cfg.key };
      body = _toOpenAI(conversation, system, tools, maxTok, cfg.model, cfg.temp);
    }
    function _parseResp(data) { return gemini ? _parseGemini(data) : (anthropic ? _parseAnthropic(data) : _parseOpenAI(data)); }

    function fallbackTextCall() {
      var prompt = _flattenConversation(system, conversation, tools);
      var fbBody = gemini
        ? { contents: [{ role: 'user', parts: [{ text: prompt }] }], generationConfig: { temperature: cfg.temp, maxOutputTokens: maxTok } }
        : anthropic
          ? { model: cfg.model, max_tokens: maxTok, messages: [{ role: 'user', content: prompt }] }
          : { model: cfg.model, temperature: cfg.temp, max_tokens: maxTok, messages: [{ role: 'user', content: prompt }] };
      return _fetchJSON(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(fbBody) }, opts).then(function(data) {
        var parsed = _parseResp(data);
        var calls = parsed.toolCalls.length ? parsed.toolCalls : _parseJsonToolCalls(parsed.text);
        return { text: parsed.text, toolCalls: calls, fallback: true };
      });
    }

    return _fetchJSON(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body) }, opts).then(function(data) {
      var parsed = _parseResp(data);
      if (parsed.toolCalls.length) return parsed;
      var fromText = _parseJsonToolCalls(parsed.text); // 端点忽略 tools 但吐了 JSON
      if (fromText.length) return { text: parsed.text, toolCalls: fromText, fallback: true };
      return parsed; // 纯文本无工具 → 交给 loop 判 noToolCalls
    }).catch(function(e) {
      // 玩家停止属于控制流，不做文本兜底、不重试、不改写成“网络抖动”。
      if ((opts.signal && opts.signal.aborted) || (e && e.aborted)) throw _abortError((opts.signal && opts.signal.reason) || (e && e.message));
      // 刀G8 · 超限识别:400+超窗文案 → 不做注定失败的文本兜底(更长)·标 overflow 供 loop 压缩自救
      var _msg0 = String((e && e.message) || '');
      var _ovf0 = !!(e && e.status === 400 && _OVERFLOW_RE.test(_msg0));
      if (e && e.status === 400 && !_ovf0) {
        return fallbackTextCall().catch(function (e2) {   // 兜底自身撞超限(拍平后更长)也标 overflow
          var _m2 = String((e2 && e2.message) || '');
          if (e2 && e2.status === 400 && _OVERFLOW_RE.test(_m2)) { var ef = new Error('上下文超限（对话+工具已超过模型窗口）：' + _m2.slice(0, 160)); ef.status = 400; ef.overflow = true; ef.cause = e2; throw ef; }
          throw e2;
        });
      }
      var err = new Error(_ovf0 ? ('上下文超限（对话+工具已超过模型窗口）：' + _msg0.slice(0, 160)) : _classifyApiError(e));   // 网络/CORS/鉴权/路径 → 可操作中文提示
      err.status = e && e.status; err.cause = e;
      err.overflow = _ovf0;
      // 韧性：标记可重试的瞬态错误（429/5xx/网络/超时）；鉴权(401/403)/路径(404)等非瞬态不重试
      var s = err.status;
      var networkish = !s && e && (e.name === 'TypeError' || /failed to fetch|networkerror|err_|load failed|aborted|timeout/i.test(String(e.message || '')));
      err.transient = (s === 429) || (s >= 500) || !!networkish;
      throw err;
    });
  }

  /**
   * 中转连通性自检：用最小 ping 工具做一次真实调用，返回 {ok, detail}。
   * 给"成功调用中转第三方 api"一个可点验证入口（区分 CORS/鉴权/路径错误）。
   * @returns {Promise<{ok:boolean, detail:string, provider?:string, model?:string, status?:number}>}
   */
  function testConnection(opts) {
    opts = opts || {};
    var cfg = opts.cfg || loadEditorApiConfig();
    if (!cfg.key) return Promise.resolve({ ok: false, detail: '未配置 API Key（请先在设置面板填写）' });
    if (!cfg.url) return Promise.resolve({ ok: false, detail: '未配置 API 地址' });
    var ping = [{ name: 'ping', description: '连通性测试·回声', parameters: { type: 'object', properties: { ok: { type: 'boolean', description: '固定填 true' } }, required: ['ok'] } }];
    return callWithTools('调用 ping 工具，参数 ok=true，确认连通。', ping, { cfg: cfg, maxTok: 64, maxRetries: 1, timeoutMs: 30000, signal: opts.signal })
      .then(function(r) {
        return {
          ok: true,
          provider: _isAnthropic(cfg.url) ? 'anthropic' : 'openai-compat',
          model: cfg.model,
          detail: '连通成功 · ' + (r.fallback ? '端点不支持原生 tools，已用文本兜底（仍可用）' : '原生 tool-calling 可用')
        };
      })
      .catch(function(e) {
        return { ok: false, status: e && e.status, detail: (e && e.message) || String(e) };
      });
  }
  // 发布 origin 保留区需要的 11 符号
  P._toAnthropic=_toAnthropic; P._toOpenAI=_toOpenAI; P._toGemini=_toGemini;
  P._parseAnthropic=_parseAnthropic; P._parseOpenAI=_parseOpenAI; P._parseGemini=_parseGemini;
  P._OVERFLOW_RE=_OVERFLOW_RE; P._delay=_delay; P._fetchJSON=_fetchJSON;
  P.callWithTools=callWithTools; P.testConnection=testConnection;
  if (typeof module !== 'undefined' && module.exports) module.exports = P;
})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
