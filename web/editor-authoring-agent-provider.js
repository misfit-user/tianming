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
      return '未收到完整 API 响应：连接可能被中转关闭、网络中断，或地址/跨域配置异常。请检查中转可用性；这不是“模型未调用工具”。';
    }
    if (e.status === 401 || e.status === 403) return 'API Key 无效或无权限（HTTP ' + e.status + '）。';
    if (e.status === 404) return 'API 地址不对（HTTP 404）：检查 URL 是否缺 /v1 或 /chat/completions。';
    if (e.status === 429) return 'API 限流（HTTP 429），已自动重试仍失败，请稍后再试。';
    if (e.status >= 500) return 'API 服务端错误（HTTP ' + e.status + '）。';
    return (e.message || String(e));
  }

  // ── 抽象 conversation → provider 消息 ──
  // conversation 项：{role:'user',text,images?:[dataURL]} | {role:'assistant',text,reasoningContent?,toolCalls:[{id,name,input}]} | {role:'tool',toolResults:[{id,name,content}]}
  // reasoningContent 是模型返回的续接字段，不是正文或工具指令；仅原样回传，不展示/写诊断。
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
        // 思考模型的工具续轮需要完整 reasoning_content（空串也有字段语义）。
        // 无 tools 的文本兼容请求不回传；其他 provider 的序列化器亦不混用此字段。
        if (tools.length && typeof turn.reasoningContent === 'string') m.reasoning_content = turn.reasoningContent;
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

  function _toolInput(value) {
    var input = value === undefined ? {} : (typeof value === 'string' ? JSON.parse(value) : value);
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('tool-input-not-object');
    return input;
  }
  function _parseOpenAI(data) {
    var text = '', toolCalls = [], badToolJson = false, reasoningContent;
    if (data.choices && data.choices[0] && data.choices[0].message) {
      var msg = data.choices[0].message;
      if (typeof msg.reasoning_content === 'string') reasoningContent = msg.reasoning_content;
      if (typeof msg.content === 'string') text = msg.content;
      else if (Array.isArray(msg.content)) text = msg.content.filter(function(b) { return b && b.type === 'text' && typeof b.text === 'string'; }).map(function(b) { return b.text; }).join('');
      if (msg.tool_calls != null && !Array.isArray(msg.tool_calls)) badToolJson = true;
      var nativeCalls = Array.isArray(msg.tool_calls) ? msg.tool_calls : (msg.function_call ? [{ function: msg.function_call }] : []);
      nativeCalls.forEach(function(tc, i) {
        var fn = tc && tc.function || {}, input = {}, parsedOk = true;
        try { input = _toolInput(fn.arguments); } catch (e) { parsedOk = false; badToolJson = true; }
        if (typeof fn.name !== 'string' || !fn.name) { parsedOk = false; badToolJson = true; }
        if (fn.name && parsedOk) toolCalls.push({ id: tc.id || _genId(i), name: fn.name, input: input });   // 斩断的调用不执行(勿以空入参乱跑)
      });
    }
    if (!toolCalls.length && !badToolJson && Array.isArray(data.content)) return _parseAnthropic(data); // 代理直吐 anthropic content[]
    var fr = data.choices && data.choices[0] && (data.choices[0].finish_reason || data.choices[0].stop_reason);
    return { text: text, toolCalls: toolCalls, reasoningContent: reasoningContent, truncated: fr === 'length' || fr === 'max_tokens', badToolJson: badToolJson };
  }

  // 可复制的响应诊断只含固定枚举/计数；不带原文、思考正文、工具参数、URL 或凭据。
  function _responseInfo(data, parsed) {
    var choice = data && data.choices && data.choices[0], msg = choice && choice.message;
    var cand = data && data.candidates && data.candidates[0];
    var protocol = msg ? 'openai' : (cand ? 'gemini' : (Array.isArray(data && data.content) ? 'anthropic' : 'unknown'));
    var fr = (choice && (choice.finish_reason || choice.stop_reason)) || (cand && cand.finishReason) || (data && data.stop_reason);
    var allowed = ['stop', 'tool_calls', 'function_call', 'length', 'max_tokens', 'content_filter', 'end_turn', 'tool_use', 'stop_sequence', 'STOP', 'MAX_TOKENS', 'SAFETY'];
    var reasoningChars = typeof parsed.reasoningContent === 'string' ? parsed.reasoningContent.length : 0;
    var textChars = typeof parsed.text === 'string' ? parsed.text.length : 0;
    var kind = protocol === 'unknown' ? 'unsupported-response' : parsed.truncated ? 'truncated' : parsed.badToolJson ? 'invalid-tool-arguments'
      : (msg && msg.refusal || fr === 'content_filter' || fr === 'SAFETY') ? 'refusal'
      : parsed.toolCalls.length ? 'native-tools' : textChars ? 'text-only' : reasoningChars ? 'reasoning-only' : 'empty';
    return { protocol: protocol, kind: kind, finishReason: allowed.indexOf(fr) >= 0 ? fr : 'unknown',
      textChars: textChars, reasoningChars: reasoningChars, toolCalls: parsed.toolCalls.length, format: 'native' };
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
    var s = String(text || '').trim();
    var fence = s.match(/^```(?:json)?\s*([\s\S]*?)```$/i);
    if (fence) s = fence[1];
    var tag = s.match(/^<json>\s*([\s\S]*?)<\/json>$/i);
    if (tag) s = tag[1];
    return s;
  }

  // 从纯文本抠 {tool_calls:[{name,input}]}（端点忽略 tools 直接吐 JSON 时兜底）
  function _parseJsonToolCalls(text) {
    if (!text) return [];
    // 仅接受完整命令信封；说明文字中的 JSON 示例不是待执行指令。
    try {
      var parsed = JSON.parse(_stripJsonWrappers(text));
      var entries = parsed && Array.isArray(parsed.tool_calls) ? parsed.tool_calls
        : (parsed && typeof parsed.name === 'string' && Object.prototype.hasOwnProperty.call(parsed, 'input') ? [parsed] : []);
      return entries.map(function(c, i) {
        var fn = c && (c.function || c);
        if (!fn || typeof fn.name !== 'string' || !fn.name) throw new Error('tool-name-missing');
        var input = _toolInput(Object.prototype.hasOwnProperty.call(fn, 'input') ? fn.input : fn.arguments);
        return { id: c.id || _genId(i), name: fn.name, input: input };
      }); // 任一坏参数使整批失效，不能先执行前半批。
    } catch (e) { return []; }
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
    lines.push('\n本轮可用工具及参数契约（不得调用清单之外的工具）: ' + JSON.stringify(tools));
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

  function _responseError(code, message) {
    var e = new Error(message); e.code = 'authoring-response-' + code;
    return e; // 不把响应正文/工具参数（可能含私密剧本内容）带进错误卡。
  }
  function _responseJSON(text) {
    try { return JSON.parse(text); }
    catch (_) { throw _responseError('invalid-json', 'API 返回内容不符合 JSON 格式，本轮工具未执行；请重试或检查中转响应格式。'); }
  }
  // 某些中转忽略非流式请求，成功响应实际为 SSE。只在收齐完整响应后交给现有工具解析器。
  function _decodeResponse(text) {
    var raw = String(text || '').replace(/^\uFEFF/, '').trim();
    if (/^[\[{]/.test(raw)) {
      var data = _responseJSON(raw);
      if (data && data.error) throw _responseError('provider-error', 'API 返回错误结果，本轮工具未执行；请检查服务状态后重试。');
      return data;
    }
    if (!/^(?:data:|event:|id:|retry:|:)/.test(raw)) throw _responseError('invalid-json', 'API 未返回有效 JSON 或事件流，本轮工具未执行；请检查中转响应格式。');
    var kind = '', seen = false, done = false, finish = null, usage = null;
    var message = { role: 'assistant', content: '', tool_calls: [] }, tools = new Map(), blocks = new Map(), parts = [];
    function select(value) {
      if (kind && kind !== value) throw _responseError('mixed-stream', 'API 混用了不同事件协议，本轮工具未执行。');
      kind = value; seen = true;
    }
    function index(value) {
      if (!Number.isInteger(value) || value < 0 || value > 1023) throw _responseError('invalid-index', 'API 工具片段序号无效，本轮工具未执行。');
      return value;
    }
    function string(value) {
      if (typeof value !== 'string') throw _responseError('invalid-fragment', 'API 工具片段格式无效，本轮工具未执行。');
      return value;
    }
    function input(text) {
      var value = _responseJSON(text);
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw _responseError('invalid-tool-input', 'API 工具参数不是完整对象，本轮工具未执行。');
      return value;
    }
    function accept(payload, eventName) {
      if (payload === '[DONE]') { done = true; return; }
      if (done) throw _responseError('after-completion', 'API 在结束标记后仍返回内容，本轮工具未执行。');
      var d = _responseJSON(payload);
      if (!d || typeof d !== 'object') throw _responseError('invalid-event', 'API 事件格式无效，本轮工具未执行。');
      if (d.error || d.type === 'error' || eventName === 'error') throw _responseError('provider-error', 'API 流中返回错误，本轮工具未执行；请检查服务状态后重试。');
      if (Array.isArray(d.choices)) {
        select('openai'); if (d.usage) usage = d.usage;
        d.choices.forEach(function(c, pos) {
          if ((c.index == null ? pos : c.index) !== 0) return; // 与原解析器一致，只消费第一候选。
          var delta = c.delta || c.message || {};
          if (delta.content != null) message.content += string(delta.content);
          if (delta.reasoning_content != null) message.reasoning_content = (message.reasoning_content || '') + string(delta.reasoning_content);
          if (delta.tool_calls != null && !Array.isArray(delta.tool_calls)) throw _responseError('invalid-tools', 'API 工具列表格式无效，本轮工具未执行。');
          (delta.tool_calls || []).forEach(function(tc, i) {
            var key = index(tc.index == null && c.message ? i : tc.index), old = tools.get(key);
            if (!old) { old = { id: '', type: 'function', function: { name: '', arguments: '' } }; tools.set(key, old); }
            if (tc.id != null) { if (old.id && old.id !== tc.id) throw _responseError('changed-tool-id', 'API 工具片段身份不一致，本轮工具未执行。'); old.id = string(tc.id); }
            var fn = tc.function || {};
            if (fn.name != null) old.function.name += string(fn.name);
            if (fn.arguments != null) old.function.arguments += string(fn.arguments);
          });
          if (c.finish_reason != null || c.stop_reason != null) finish = c.finish_reason || c.stop_reason;
        });
      } else if (Array.isArray(d.candidates)) {
        select('gemini'); var candidate = d.candidates[0];
        if (candidate && candidate.content && Array.isArray(candidate.content.parts)) parts = parts.concat(candidate.content.parts);
        if (candidate && candidate.finishReason) finish = candidate.finishReason;
        if (d.usageMetadata) usage = d.usageMetadata;
      } else {
        var type = d.type || eventName;
        if (type === 'ping') return;
        if (!/^(message_start|message_delta|message_stop|content_block_start|content_block_delta|content_block_stop)$/.test(type)) throw _responseError('unsupported-stream', 'API 事件协议不受当前端点支持，本轮工具未执行。');
        select('anthropic');
        if (type === 'message_start') usage = d.message && d.message.usage;
        if (type === 'content_block_start') {
          var k = index(d.index);
          if (blocks.has(k)) throw _responseError('duplicate-block', 'API 重复开启同一工具片段，本轮工具未执行。');
          blocks.set(k, { value: d.content_block || {}, json: '', stopped: false });
        } else if (type === 'content_block_delta' || type === 'content_block_stop') {
          var block = blocks.get(index(d.index));
          if (!block || block.stopped) throw _responseError('invalid-block', 'API 工具片段顺序无效，本轮工具未执行。');
          if (type === 'content_block_stop') block.stopped = true;
          else if (d.delta && d.delta.type === 'input_json_delta') block.json += string(d.delta.partial_json);
          else if (d.delta && d.delta.type === 'text_delta') block.value.text = (block.value.text || '') + string(d.delta.text);
          // thinking/signature 片段不是工具参数，不交给写入层。
        } else if (type === 'message_delta') { finish = d.delta && d.delta.stop_reason; if (d.usage) usage = Object.assign({}, usage || {}, d.usage); }
        else if (type === 'message_stop') done = true;
      }
    }
    var fields = [], eventName = '';
    function flush() { if (fields.length) accept(fields.join('\n'), eventName); fields = []; eventName = ''; }
    raw.split(/\r\n|\r|\n/).forEach(function(line) {
      if (!line) { flush(); return; }
      if (line[0] === ':') return;
      var at = line.indexOf(':'), key = at < 0 ? line : line.slice(0, at), value = at < 0 ? '' : line.slice(at + 1).replace(/^ /, '');
      if (key === 'data') fields.push(value); else if (key === 'event') eventName = value;
    });
    flush();
    if (!seen || (!done && (!finish || kind === 'anthropic'))) throw _responseError('incomplete-stream', 'API 事件流未完整结束，本轮工具未执行；请重试。');
    if (kind === 'openai') {
      message.tool_calls = Array.from(tools.keys()).sort(function(a, b) { return a - b; }).map(function(k) {
        var t = tools.get(k);
        if (finish !== 'length' && finish !== 'max_tokens') { if (!t.function.name) throw _responseError('invalid-tool-name', 'API 工具名称不完整，本轮工具未执行。'); input(t.function.arguments || '{}'); }
        return t;
      });
      return { choices: [{ message: message, finish_reason: finish }], usage: usage };
    }
    if (kind === 'gemini') return { candidates: [{ content: { parts: parts }, finishReason: finish }], usageMetadata: usage };
    var content = Array.from(blocks.keys()).sort(function(a, b) { return a - b; }).map(function(k) {
      var b = blocks.get(k);
      if (finish !== 'max_tokens') {
        if (!b.stopped) throw _responseError('incomplete-tool', 'API 工具片段未结束，本轮工具未执行。');
        if (b.value.type === 'tool_use' && b.json) b.value.input = input(b.json);
      }
      return b.value;
    });
    return { content: content, stop_reason: finish, usage: usage };
  }
  function _readResponse(r, signal) {
    // 原有模拟/桥接 Response 可只提供 json()；真实 Fetch Response 走受控正文读取。
    if (typeof r.text !== 'function') return Promise.resolve().then(function() { return r.json(); });
    var maxBytes = 64 * 1024 * 1024; // 兼容图像工具响应；避免损坏/无界中转把整个编辑器撑满。
    if (!r.body || !r.body.getReader || typeof TextDecoder === 'undefined') return r.text().then(function(text) {
      if (signal && signal.aborted) throw _abortError(signal.reason);
      if (text.length > maxBytes) throw _responseError('too-large', 'API 返回内容过大，本轮工具未执行。');
      return _decodeResponse(text);
    });
    var reader = r.body.getReader(), decoder = new TextDecoder(), chunks = [], bytes = 0, tail = '';
    function terminal(text) {
      if (!/\[DONE\]|message_stop/.test(text)) return false;
      var events = text.replace(/\r\n|\r/g, '\n').split('\n\n'); events.pop(); // 只接受已结束的事件，不猜半个终止标记。
      return events.some(function(event) {
        var data = event.split('\n').filter(function(line) { return line.indexOf('data:') === 0; }).map(function(line) { return line.slice(5).replace(/^ /, ''); }).join('\n');
        if (data === '[DONE]') return true;
        try { return JSON.parse(data).type === 'message_stop'; } catch (_) { return false; }
      });
    }
    return new Promise(function(resolve, reject) {
      var settled = false;
      function end(error, value, stopBody) {
        if (settled) return; settled = true;
        if (signal && signal.removeEventListener) signal.removeEventListener('abort', abort);
        if (error || stopBody) { try { Promise.resolve(reader.cancel()).catch(function() {}); } catch (_) {} }
        try { reader.releaseLock(); } catch (_) {} // 清理失败不覆盖原始读取错误。
        chunks = []; if (error) reject(error); else resolve(value);
      }
      function abort() { end(_abortError(signal && signal.reason)); }
      function read() {
        reader.read().then(function(row) {
          if (settled) return;
          try {
            if (row.done) { chunks.push(decoder.decode()); end(null, _decodeResponse(chunks.join(''))); return; }
            bytes += row.value.byteLength;
            if (bytes > maxBytes) throw _responseError('too-large', 'API 返回内容过大，本轮工具未执行。');
            var piece = decoder.decode(row.value, { stream: true }); chunks.push(piece);
            var probe = tail + piece;
            if (terminal(probe)) { end(null, _decodeResponse(chunks.join('')), true); return; }
            tail = probe.slice(-2048); read();
          } catch (e) { end(e); }
        }, function(e) { end(e); });
      }
      if (signal && signal.aborted) return abort();
      if (signal && signal.addEventListener) signal.addEventListener('abort', abort, { once: true });
      read();
    });
  }

  function _reportedUsage(data) {
    var u = data && (data.usage || data.usageMetadata);
    if (!u) return null;
    function value(v) { return typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null; }
    var input = value(u.prompt_tokens != null ? u.prompt_tokens : (u.input_tokens != null ? u.input_tokens : u.promptTokenCount));
    var output = value(u.completion_tokens != null ? u.completion_tokens : (u.output_tokens != null ? u.output_tokens : u.candidatesTokenCount));
    var total = value(u.total_tokens != null ? u.total_tokens : u.totalTokenCount);
    if (input === null && output === null && total === null) return null;
    return { inputTokens: input, outputTokens: output, totalTokens: total, source: 'provider' };
  }
  function _telemetry(opts, event) { if (typeof opts.onTelemetry === 'function') { try { opts.onTelemetry(event); } catch (_) {} } }
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
      return Promise.resolve().then(function() { _telemetry(opts, { type: 'request', retry: n > 0 }); return global.fetch(url, fopt); }).then(function(r) {
        if (!r.ok) {
          return r.text().then(function(t) {
            var err = new Error('HTTP ' + r.status + ': ' + String(t).slice(0, 200));
            err.status = r.status;
            var ra = parseInt((r.headers && r.headers.get && r.headers.get('Retry-After')) || '0', 10);
            if (r.status === 429 && ra > 0) err.retryAfterMs = ra * 1000;
            throw err;
          });
        }
        return _readResponse(r, fopt.signal);
      }).then(function(data) {
        cleanup();
        if (outerSignal && outerSignal.aborted) throw _abortError(outerSignal.reason);
        if (timedOut) throw _abortError('timeout');
        _telemetry(opts, { type: 'response', usage: _reportedUsage(data) });
        return data;
      }).catch(function(e) {
        cleanup();
        if (outerSignal && outerSignal.aborted) throw _abortError(outerSignal.reason);
        if (timedOut) { e = new Error('API 请求超时，完整响应未收到，请稍后重试。'); e.name = 'TimeoutError'; e.transient = true; }
        if (e && /^authoring-response-/.test(e.code || '')) throw e; // 已确定的协议损坏不能当网络抖动反复调用。
        var retryable = e && e.status ? (e.status === 429 || e.status >= 500) : (timedOut || !(e && e.aborted));
        if (n < maxRetries && retryable) return _delay((e && e.retryAfterMs) || Math.min(30000, base * Math.pow(2, n)), outerSignal).then(function() { return attempt(n + 1); });
        if (e && retryable) { e.retriesExhausted = true; e.attempts = n + 1; }
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
    function _parseResp(data) {
      var parsed = gemini ? _parseGemini(data) : (anthropic ? _parseAnthropic(data) : _parseOpenAI(data));
      parsed.usage = _reportedUsage(data);
      if (parsed.truncated || parsed.badToolJson) parsed.toolCalls = []; // 整轮丢弃；由既有 loop 输出预算修复接手，不能执行半轮写入。
      parsed.responseInfo = _responseInfo(data, parsed);
      return parsed;
    }

    function fallbackTextCall() {
      var prompt = _flattenConversation('', conversation, tools), flat = [];
      conversation.forEach(function(turn, i) {
        var images = turn.role === 'user' ? _imgParts(turn.images) : [];
        if (images.length) flat.push({ role: 'user', text: '第 ' + (i + 1) + ' 条用户消息的图片附件：' + (turn.text || ''), images: images });
      });
      flat.push({ role: 'user', text: prompt }); // 各轮图片保留各自上限及归属，不能合并后只留下前四张。
      var fbBody = gemini ? _toGemini(flat, system, [], maxTok, cfg.temp)
        : anthropic ? _toAnthropic(flat, system, [], maxTok, cfg.model)
        : _toOpenAI(flat, system, [], maxTok, cfg.model, cfg.temp);
      delete fbBody.tools; delete fbBody.tool_choice; delete fbBody.toolConfig;
      return _fetchJSON(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(fbBody) }, opts).then(function(data) {
        var parsed = _parseResp(data);
        parsed.fallback = true; parsed.responseInfo.format = 'json-compat';
        if (parsed.truncated || parsed.badToolJson) { parsed.fallback = true; return parsed; }
        var calls = parsed.toolCalls.length ? parsed.toolCalls : _parseJsonToolCalls(parsed.text);
        if (!parsed.toolCalls.length && calls.length) parsed.responseInfo.kind = 'text-json';
        parsed.toolCalls = calls; parsed.responseInfo.toolCalls = calls.length;
        return parsed;
      });
    }

    var usedTextFallback = !!opts.textToolFallback;
    return (usedTextFallback ? fallbackTextCall() : _fetchJSON(endpoint, { method: 'POST', headers: headers, body: JSON.stringify(body) }, opts).then(function(data) {
      var parsed = _parseResp(data);
      if (parsed.truncated || parsed.badToolJson) return parsed;
      if (parsed.toolCalls.length) return parsed;
      var fromText = _parseJsonToolCalls(parsed.text); // 端点忽略 tools 但吐了 JSON
      if (fromText.length) {
        parsed.toolCalls = fromText; parsed.fallback = true;
        parsed.responseInfo.kind = 'text-json'; parsed.responseInfo.toolCalls = fromText.length;
        return parsed;
      }
      return parsed; // 纯文本无工具 → 交给 loop 判 noToolCalls
    })).catch(handleFailure);
    function handleFailure(e) {
      // 玩家停止属于控制流，不做文本兜底、不重试、不改写成“网络抖动”。
      if ((opts.signal && opts.signal.aborted) || (e && e.aborted)) throw _abortError((opts.signal && opts.signal.reason) || (e && e.message));
      // 刀G8 · 超限识别:400+超窗文案 → 不做注定失败的文本兜底(更长)·标 overflow 供 loop 压缩自救
      var _msg0 = String((e && e.message) || '');
      var _ovf0 = !!(e && e.status === 400 && _OVERFLOW_RE.test(_msg0));
      if (e && e.status === 400 && !_ovf0 && !usedTextFallback) {
        usedTextFallback = true;
        return fallbackTextCall().catch(handleFailure); // 文本兜底同样保留取消/超窗/重试耗尽语义，且只试一次。
      }
      var err = new Error(_ovf0 ? ('上下文超限（对话+工具已超过模型窗口）：' + _msg0.slice(0, 160)) : _classifyApiError(e));   // 网络/CORS/鉴权/路径 → 可操作中文提示
      err.status = e && e.status; err.code = e && e.code; err.cause = e;
      err.retriesExhausted = !!(e && e.retriesExhausted); err.attempts = e && e.attempts;
      if (err.retriesExhausted) err.message += '（本轮已尝试 ' + err.attempts + ' 次，已停止自动重试；已完成的草稿保留，可待连接恢复后继续。）';
      err.overflow = _ovf0;
      // 韧性：标记可重试的瞬态错误（429/5xx/网络/超时）；鉴权(401/403)/路径(404)等非瞬态不重试
      var s = err.status;
      var networkish = !s && e && (e.name === 'TypeError' || /failed to fetch|networkerror|err_|load failed|aborted|timeout/i.test(String(e.message || '')));
      err.transient = !!(e && e.transient) || (s === 429) || (s >= 500) || !!networkish;
      throw err;
    }
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
        if (!r || r.truncated || r.badToolJson || !r.toolCalls || r.toolCalls.length !== 1 || r.toolCalls[0].name !== 'ping' || r.toolCalls[0].input.ok !== true) {
          return { ok: false, model: cfg.model, detail: 'API 已响应，但未返回有效的 ping 工具调用；普通聊天可用不代表国师工具调用可用，请核对中转和模型的工具支持。' };
        }
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
