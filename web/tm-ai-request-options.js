// Explicit, per-API thinking preferences. Unset means byte-for-byte provider default.
// Kept outside transport: finalized SC1 requests must include these options BEFORE budgeting.
(function(global) {
  'use strict';
  function configError(message) {
    var e = new Error(message + '；请在 API 设置中调整 thinking，或恢复模型默认。');
    e.code = 'AI_THINKING_CONFIG'; e.status = 400; return e;
  }
  function protocol(cfg, wire) {
    if (cfg.thinkingProtocol && cfg.thinkingProtocol !== 'auto') return cfg.thinkingProtocol;
    var host = ''; try { host = new URL(cfg.url).hostname.toLowerCase(); } catch (_) {}
    var model = String(cfg.model || '').toLowerCase().replace(/^.*\//, '');
    if (host === 'openrouter.ai') return 'openrouter';
    if (wire === 'anthropic') return 'anthropic';
    if (wire === 'gemini') return 'gemini';
    if (/deepseek/.test(model) || host === 'api.deepseek.com') return 'deepseek';
    if (/^(qwen|qwq)/.test(model)) return 'qwen';
    if (/^gemini/.test(model)) return 'gemini';
    if (/^(gpt-|o[134](?:-|$))/.test(model)) return 'openai';
    return 'unknown';
  }
  function apply(body, cfg, wire) {
    cfg = cfg || {}; wire = wire || 'openai';
    if (typeof cfg.thinking !== 'boolean') return body;
    var on = cfg.thinking, mode = protocol(Object.assign({}, cfg, { model: body.model || cfg.model }), wire);
    var model = String(body.model || cfg.model || '').toLowerCase().replace(/^.*\//, '');
    var out = Object.assign({}, body);
    if (mode === 'unknown') throw configError('无法从模型 ID 判断思考协议，请按服务商文档选择协议');
    if (wire !== 'openai' && mode !== wire) throw configError('所选思考协议与当前原生 API 不一致');
    if (mode === 'deepseek') {
      out.thinking = { type: on ? 'enabled' : 'disabled' };
    } else if (mode === 'qwen') {
      if (!on && /thinking|^qwq/.test(model)) throw configError('该模型是专用思考模型，不能关闭思考');
      if (on && /instruct|^qwen2/.test(model)) throw configError('该模型不是可切换的思考模型');
      out.enable_thinking = on;
    } else if (mode === 'openrouter') {
      out.reasoning = Object.assign({}, out.reasoning, { enabled: on });
      delete out.reasoning.effort; delete out.reasoning.max_tokens;
    } else if (mode === 'openai') {
      if (/^gpt-[34]/.test(model)) {
        if (on) throw configError('该 GPT 模型没有可开启的推理模式');
        return body; // A non-reasoning model is already off; do not send unsupported fields.
      }
      if (!on && (/^o[134](?:-|$)/.test(model) || /^gpt-5(?:-|$)/.test(model) || /^gpt-6/.test(model))) {
        throw configError('该模型不支持 reasoning_effort=none，不能关闭思考');
      }
      out.reasoning_effort = on ? 'high' : 'none';
      // Same total output allowance, modern field name; reasoning is included in this allowance.
      if (out.max_tokens != null && out.max_completion_tokens == null) {
        out.max_completion_tokens = out.max_tokens; delete out.max_tokens;
      }
      if (on) { delete out.temperature; delete out.top_p; }
    } else if (mode === 'gemini') {
      if (!/^gemini-/.test(model)) throw configError('Gemini 思考设置需要真实的 Gemini 模型 ID');
      if (!on && !/^gemini-2\.5-flash/.test(model)) throw configError('该 Gemini 型号不支持完全关闭思考');
      var is3 = /^gemini-3/.test(model);
      if (!is3 && !/^gemini-2\.5-/.test(model)) throw configError('尚未识别此 Gemini 型号的思考参数');
      if (wire === 'gemini') {
        out.generationConfig = Object.assign({}, body.generationConfig);
        out.generationConfig.thinkingConfig = is3 ? { thinkingLevel: 'high' } : { thinkingBudget: on ? -1 : 0 };
      } else {
        out.extra_body = Object.assign({}, body.extra_body);
        out.extra_body.google = Object.assign({}, out.extra_body.google);
        out.extra_body.google.thinking_config = is3 ? { thinking_level: 'high' } : { thinking_budget: on ? -1 : 0 };
        delete out.reasoning_effort;
      }
    } else if (mode === 'anthropic') {
      if (wire !== 'anthropic') throw configError('Claude 中转的思考参数由中转站定义，请选择其兼容协议');
      if (!on && /mythos|fable/.test(model)) throw configError('该 Claude 型号不能关闭思考');
      if (on && !/claude-(?:opus|sonnet)-4-[6789]/.test(model)) {
        throw configError('此 Claude 型号需专用思考预算，暂请保留模型默认');
      }
      out.thinking = { type: on ? 'adaptive' : 'disabled' };
      if (on) {
        if (out.tool_choice && out.tool_choice.type !== 'auto' && out.tool_choice.type !== 'none') {
          throw configError('Claude 思考不能与当前强制工具调用同时使用');
        }
        delete out.temperature; delete out.top_p;
      }
    } else throw configError('未识别的思考协议');
    return out;
  }
  function inheritForRepair(body, original) {
    var out = Object.assign({}, body);
    ['thinking','reasoning','reasoning_effort','enable_thinking','extra_body'].forEach(function(key) {
      if (original[key] !== undefined) out[key] = JSON.parse(JSON.stringify(original[key]));
    });
    if (original.reasoning_effort && original.reasoning_effort !== 'none') { delete out.temperature; delete out.top_p; }
    if (original.max_completion_tokens != null && out.max_tokens != null) {
      out.max_completion_tokens = out.max_tokens; delete out.max_tokens;
    }
    return out;
  }
  global.TM = global.TM || {};
  global.TM.AIOptions = { apply: apply, protocol: protocol, inheritForRepair: inheritForRepair };
})(typeof window !== 'undefined' ? window : globalThis);
