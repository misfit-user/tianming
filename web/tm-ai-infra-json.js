// @ts-check
/// <reference path="types.d.ts" />
// tm-ai-infra-json.js — strict bounded JSON recovery shared by all AI transports.
// Loaded after tm-utils and before the ordered retry/infra family.

// Tool JSON uses the same recovery and whitelist in native-text and fallback
// responses. Pure helpers only: no requests, live-world writes or configuration.
var _tmAIToolJSON = {
  decode: function(raw) {
    try { return JSON.parse(raw || '{}'); }
    catch (error) { console.warn('[callAIWithTools] tool_call arguments JSON 解析失败'); return null; }
  },
  omitChoice: function(body, forceTool) {
    delete body.tool_choice;
    // Default auto choice, restricted declarations and response validation keep
    // forceTool meaningful without changing the model's thinking mode.
    if (forceTool) {
      body.tools = body.tools.filter(function(t) { return t.function.name === forceTool; });
      body.messages[0].content += '\n\n本次仅调用 ' + forceTool + ' 提交完整结构化结果，不要改用其他工具。';
    }
  },
  prompt: function(prompt, tools, forceTool) {
    var schemaDesc = '【工具定义】API 不支持 tool_use·请按以下 JSON Schema 直接返回纯 JSON·必须包含 tool_call 字段:\n';
    schemaDesc += '可用工具:\n';
    tools.forEach(function(t) {
      schemaDesc += '- ' + t.name + ': ' + (t.description || '') + '\n';
      schemaDesc += '  参数: ' + JSON.stringify(t.parameters || {}) + '\n';
    });
    schemaDesc += '\n返回格式（必须是纯 JSON·不要 markdown 包裹）:\n';
    schemaDesc += '{"tool_calls":[{"name":"<工具名>","input":{<符合 schema 的参数>}}]}\n';
    if (forceTool) schemaDesc += '\n本次必须使用工具: ' + forceTool + '\n';
    return prompt + '\n\n' + schemaDesc;
  },
  parse: function(raw) {
    var parsed = null, calls = [];
    try { parsed = robustParseJSON(raw); }
    catch (error) { console.warn('[callAIWithTools] 工具 JSON 解析失败'); }
    if (parsed && Array.isArray(parsed.tool_calls)) {
      parsed.tool_calls.forEach(function(c) {
        if (c && c.name) calls.push({ name: c.name, input: c.input || c.arguments || {} });
      });
    } else if (parsed && parsed.name && parsed.input) {
      calls.push({ name: parsed.name, input: parsed.input });
    }
    return calls;
  },
  filter: function(calls, tools, forceTool) {
    return calls.filter(function(call) {
      return call && typeof call.input === 'object' && call.input !== null && !Array.isArray(call.input) &&
        (!forceTool || call.name === forceTool) && tools.some(function(t) { return t && t.name === call.name; });
    });
  }
};

// Opt-in final-text contract: never promote reasoning/refusal/partial text to a
// publishable document. Legacy callAI/callAIMessages return values stay unchanged.
function _tmAITextResult(data, strict, maxTokens) {
  var choice = data && data.choices && data.choices[0];
  var message = choice && choice.message;
  if (!strict) {
    if (message) return message.content;
    if (data && Array.isArray(data.content)) return data.content.map(function(b) { return b.text || ''; }).join('');
    return '';
  }
  var raw = message ? message.content : data && data.content;
  var finish = (choice && choice.finish_reason) || (data && data.stop_reason) || '';
  var reasoning = !!(message && (message.reasoning_content || message.reasoning));
  var refused = !!(message && message.refusal) || /^(content_filter|refusal|safety)$/i.test(finish);
  var text = typeof raw === 'string' ? raw : '';
  if (Array.isArray(raw)) {
    text = raw.map(function(part) {
      if (!part || typeof part !== 'object') return '';
      if (part.type === 'thinking' || part.type === 'reasoning') reasoning = true;
      if (part.type === 'refusal') refused = true;
      return (part.type === 'text' || part.type === 'output_text') && typeof part.text === 'string' ? part.text : '';
    }).join('');
  }
  var code = refused ? 'ai-text-refused' : /^(length|max_tokens|max_output_tokens)$/i.test(finish) ? 'ai-text-truncated' :
    (raw != null && typeof raw !== 'string' && !Array.isArray(raw)) ? 'ai-text-format' :
    !text.trim() ? (reasoning ? 'ai-text-reasoning-only' : 'ai-text-empty') : '';
  if (code) {
    var error = new Error(code);
    error.code = code;
    error.maxTokens = maxTokens;
    error.reasoningOnly = reasoning && !text.trim();
    throw error; // No response body, thought text, URL or credential in this error.
  }
  return text;
}

