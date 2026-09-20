// @ts-check
// tm-endturn-ai-sc1-budget.js — SC1 final request physical-context guard.
// Loaded before tm-endturn-ai.js; exposes pure request finalization helpers on
// TM.Endturn.AI.subcalls without owning any world-state mutation.
(function(global) {
  if (!global.TM || !global.TM.Endturn || !global.TM.Endturn.AI) {
    throw new Error('SC1 final-budget parent namespace missing: tm-endturn-prompt.js must load first');
  }
  if (typeof global.TM.Endturn.AI.subcalls === 'undefined') global.TM.Endturn.AI.subcalls = {};

  var ns = global.TM.Endturn.AI.subcalls;

  function finitePositive(value, fallback) {
    var n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
    var fb = Number(fallback);
    return Number.isFinite(fb) && fb > 0 ? fb : 0;
  }

  function estimateRequestTokens(value) {
    var text = typeof value === 'string' ? value : JSON.stringify(value == null ? '' : value);
    if (typeof global.estimateTokens === 'function') return global.estimateTokens(text);
    var cjk = 0;
    var other = 0;
    for (var i = 0; i < text.length; i++) {
      var code = text.charCodeAt(i);
      if ((code >= 0x4E00 && code <= 0x9FFF) || (code >= 0x3040 && code <= 0x30FF)) cjk++;
      else other++;
    }
    return Math.ceil(cjk * 1.3 + other * 0.25);
  }

  function cloneRequestBody(body) {
    var out = Object.assign({}, body || {});
    out.messages = Array.isArray(body && body.messages) ? body.messages.map(function(message) {
      return Object.assign({}, message || {});
    }) : [];
    if (body && body.response_format) out.response_format = JSON.parse(JSON.stringify(body.response_format));
    if (body && body.tools) out.tools = JSON.parse(JSON.stringify(body.tools));
    return out;
  }

  function requestBudget(body, options) {
    options = options || {};
    var configured = null;
    try {
      if (typeof global.getPromptBudget === 'function') configured = global.getPromptBudget();
    } catch (budgetError) {
      configured = null;
    }
    var contextTokens = finitePositive(options.contextTokens,
      configured && finitePositive(configured.contextK, 0) * 1024);
    if (!contextTokens) contextTokens = 32768;
    var completionTokens = finitePositive(options.completionTokens,
      finitePositive(body && (body.max_completion_tokens != null ? body.max_completion_tokens : body.max_tokens), Math.floor(contextTokens * 0.25)));
    completionTokens = Math.min(completionTokens, Math.max(1, contextTokens - 1));
    var protocolReserve = Math.max(128, Math.ceil((body && body.messages && body.messages.length || 0) * 8));
    var contextInputLimit = contextTokens - completionTokens;
    var configuredInputLimit = configured && finitePositive(configured.budget, 0);
    var inputLimit = configuredInputLimit
      ? Math.min(contextInputLimit, configuredInputLimit)
      : contextInputLimit;
    var override = finitePositive(options.inputTokenLimit, 0);
    if (override) inputLimit = Math.min(inputLimit, override);
    if (inputLimit <= protocolReserve) {
      var impossible = new Error('SC1 mandatory context cannot fit beside the reserved completion budget');
      impossible.code = 'mandatory_context_overflow';
      impossible.contextTokens = contextTokens;
      impossible.completionTokens = completionTokens;
      throw impossible;
    }
    return {
      contextTokens:Math.floor(contextTokens),
      completionTokens:Math.floor(completionTokens),
      inputTokenLimit:Math.floor(inputLimit),
      protocolReserve:protocolReserve
    };
  }

  function measureRequest(body, options) {
    var budget = requestBudget(body, options);
    var messages = Array.isArray(body && body.messages) ? body.messages : [];
    var messageTokens = messages.reduce(function(total, message) {
      return total + estimateRequestTokens(String(message && message.role || ''))
        + estimateRequestTokens(message && message.content != null ? message.content : '');
    }, 0);
    var schemaTokens = estimateRequestTokens({
      response_format:body && body.response_format,
      tools:body && body.tools,
      tool_choice:body && body.tool_choice,
      functions:body && body.functions
    });
    var thinkingFields = {};
    ['thinking','reasoning','reasoning_effort','enable_thinking','extra_body'].forEach(function(key) {
      if (body && body[key] !== undefined) thinkingFields[key] = body[key];
    });
    var thinkingTokens = Object.keys(thinkingFields).length ? estimateRequestTokens(thinkingFields) : 0;
    var inputTokens = messageTokens + schemaTokens + thinkingTokens + budget.protocolReserve;
    return {
      inputTokens:inputTokens,
      messageTokens:messageTokens,
      schemaTokens:schemaTokens,
      completionTokens:budget.completionTokens,
      totalTokens:inputTokens + budget.completionTokens,
      contextTokens:budget.contextTokens,
      inputTokenLimit:budget.inputTokenLimit,
      protocolReserve:budget.protocolReserve,
      ok:inputTokens <= budget.inputTokenLimit
        && inputTokens + budget.completionTokens <= budget.contextTokens
    };
  }

  function userMessageIndex(body) {
    var messages = Array.isArray(body && body.messages) ? body.messages : [];
    for (var i = messages.length - 1; i >= 0; i--) {
      if (messages[i] && messages[i].role === 'user' && typeof messages[i].content === 'string') return i;
    }
    return -1;
  }

  function assertMandatoryPrefix(system, completionTokens) {
    // This is only a lower-bound preflight. It never trims instructions, alters
    // output capacity, or replaces the final fully assembled request guard.
    var report = measureRequest({ messages:[{role:'system',content:system || ''},{role:'user',content:''}] }, {completionTokens:completionTokens});
    if (!report.ok) {
      var error = new Error('SC1 mandatory system prefix exceeds configured context before inference');
      error.code = 'mandatory_context_overflow'; error.contextTokens = report.contextTokens;
      error.requiredInputTokens = report.inputTokens; error.inputTokenLimit = report.inputTokenLimit;
      error.completionTokens = report.completionTokens;
      throw error;
    }
    return report;
  }

  function compactJsonFormatting(text) {
    if (!/^[\s]*[\[{]/.test(text)) return text;
    try { JSON.parse(text); } catch (_) { return text; }
    var output = '', quoted = false, escaped = false;
    for (var i=0; i<text.length; i++) {
      var ch=text.charAt(i);
      if (quoted) { output+=ch; if (escaped) escaped=false; else if(ch==='\\') escaped=true; else if(ch==='"') quoted=false; }
      else if(ch==='"') { quoted=true;output+=ch; }
      else if(!/[\t\n\r ]/.test(ch)) output+=ch;
    }
    return output;
  }
  function compactMessageFormatting(text) {
    // Only syntactically complete JSON: retain every prose character, literal, numeric digit and rule.
    var whole=compactJsonFormatting(text);
    if(whole!==text) return whole;
    return text.replace(/(```json[^\S\r\n]*\r?\n)([\s\S]*?)(\r?\n```)/g,function(_,head,body,tail){ return head+compactJsonFormatting(body)+tail; });
  }
  function trimUserMessage(body, options, initialReport) {
    var candidate=cloneRequestBody(body), removed=0;
    candidate.messages.forEach(function(message) {
      if(message.role!=='user'||typeof message.content!=='string') return;
      var original=message.content, compact=compactMessageFormatting(original);
      removed+=original.length-compact.length;message.content=compact;
    });
    var report=measureRequest(candidate,options);
    if(report.ok) return {body:candidate,report:report,omittedChars:0,formattingCharsRemoved:removed};
    var overflow=new Error('SC1 完整上下文需要约 '+report.inputTokens+' tokens，可用输入为 '+report.inputTokenLimit+' tokens（另保留输出 '+report.completionTokens+'）；未截断指令或记忆。请核对端点实际容量或使用更大窗口模型。');
    overflow.code='mandatory_context_overflow';overflow.requiredInputTokens=report.inputTokens;overflow.inputTokenLimit=report.inputTokenLimit;
    overflow.contextTokens=report.contextTokens;overflow.completionTokens=report.completionTokens;overflow.rawTokenEstimate=initialReport.inputTokens;overflow.preservedAllContent=true;throw overflow;
  }

  function finalizeRequestBody(body, options) {
    options = options || {};
    var working = cloneRequestBody(body);
    if (global.TM && global.TM.perf && typeof global.TM.perf.count === 'function') {
      global.TM.perf.count('sc1.finalBodyCloneCount', 1);
    }
    var rawReport = measureRequest(working, options);
    var trimmed = { body:working, report:rawReport, omittedChars:0 };
    if (!rawReport.ok) trimmed = trimUserMessage(working, options, rawReport);
    if (!trimmed.report.ok) {
      var overflow = new Error('SC1 final request still exceeds the hard context ceiling');
      overflow.code = 'mandatory_context_overflow';
      throw overflow;
    }
    return {
      body:trimmed.body,
      diagnostics:{
        rawInputTokens:rawReport.inputTokens,
        finalInputTokens:trimmed.report.inputTokens,
        completionTokens:trimmed.report.completionTokens,
        finalTotalTokens:trimmed.report.totalTokens,
        contextTokens:trimmed.report.contextTokens,
        inputTokenLimit:trimmed.report.inputTokenLimit,
        schemaTokens:trimmed.report.schemaTokens,
        omittedChars:trimmed.omittedChars,
        trimmed:false,
        lossless:true,
        formattingCharsRemoved:trimmed.formattingCharsRemoved || 0,
        emergency:options.emergency === true
      }
    };
  }

  function createContextOverflowReducer(options) {
    options=Object.assign({},options||{});
    return function(body) {
      var current=measureRequest(body,options),compact=trimUserMessage(body,options,current);
      if(!compact.formattingCharsRemoved) { var error=new Error('服务端上下文不足，无法在保留全部内容的条件下进一步缩短请求');error.code='mandatory_context_overflow';error.preservedAllContent=true;throw error; }
      return compact.body;
    };
  }

  var EXPECTED_KEYS = ['turn_summary', 'shizhengji_basis', 'events', 'resource_changes', 'char_updates', 'edict_feedback', 'fiscal_adjustments', 'changes'];
  function productionCallOptions(label, reducer) {
    return {
      id:'sc1',
      label:label || '结构化数据',
      expectedKeys:EXPECTED_KEYS.slice(),
      priority:'critical',
      contextOverflowReducer:reducer
    };
  }

  function recordDiagnostics(diagnostics) {
    try {
      global.TM.lastPromptTokens = global.TM.lastPromptTokens || {};
      global.TM.lastPromptTokens.sc1 = global.TM.lastPromptTokens.sc1 || {};
      global.TM.lastPromptTokens.sc1.finalRequest = diagnostics;
      if (diagnostics && diagnostics.formattingCharsRemoved > 0 && typeof global.toast === 'function') {
        global.toast('[SC1] 已精简 JSON 排版空白，指令、记忆与数值完整保留');
      }
    } catch (error) {
      if (global.TM && global.TM.errors && typeof global.TM.errors.captureSilent === 'function') {
        global.TM.errors.captureSilent(error, 'tm-sc1-final-budget-diagnostics');
      } else if (global.console && typeof global.console.warn === 'function') {
        global.console.warn('[SC1] final request diagnostics failed:', error);
      }
    }
  }

  ns.measureSc1Request = measureRequest;
  ns.assertSc1MandatoryPrefix = assertMandatoryPrefix;
  ns.finalizeSc1RequestBody = finalizeRequestBody;
  ns.createSc1ContextOverflowReducer = createContextOverflowReducer;
  ns.sc1ProductionCallOptions = productionCallOptions;
  ns.recordSc1FinalDiagnostics = recordDiagnostics;
})(typeof window !== 'undefined' ? window : globalThis);

// Pure wire schemas retained without field or requirement changes.
(function(root) {
  var ns = root.TM.Endturn.AI.subcalls;
function _buildSc1JsonSchema() {
    return {
      name: 'sc1_main',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          turn_summary: { type: 'string' },
          shizhengji_basis: { type: 'string' },
          shilu_text: { type: 'string' },
          szj_title: { type: 'string' },
          shizhengji: { type: 'string' },
          szj_summary: { type: 'string' },
          player_status: { type: 'string' },
          player_inner: { type: 'string' },
          events: { type: 'array', items: { type: 'object', additionalProperties: true } },
          resource_changes: { type: 'object', additionalProperties: true },
          variable_changes: { type: 'object', additionalProperties: true },
          char_updates: { type: 'array', items: { type: 'object', additionalProperties: true } },
          character_deaths: { type: 'array', items: { type: 'object', additionalProperties: true } },
          npc_actions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          character_memory_updates: { type: 'array', items: { type: 'object', additionalProperties: true } },
          long_term_memory_updates: { type: 'array', items: { type: 'object', additionalProperties: true } },
          edict_feedback: { type: 'array', items: { type: 'object', additionalProperties: true } },
          building_decisions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          dialogue_commitment_feedback: { type: 'array', items: { type: 'object', additionalProperties: true } },
          court_resolution_feedback: { type: 'array', items: { type: 'object', additionalProperties: true } },
          fiscal_adjustments: { type: 'array', items: { type: 'object', additionalProperties: true } },
          currency_adjustments: { type: 'array', items: { type: 'object', additionalProperties: true } },
          population_adjustments: { type: 'array', items: { type: 'object', additionalProperties: true } },
          central_local_actions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          environment_actions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          institution_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          personnel_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          office_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_ai_outcomes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_relation_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_relation_shift: { type: 'array', items: { type: 'object', additionalProperties: true } },
          party_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          army_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          armory_procurement: { type: 'array', items: { type: 'object', additionalProperties: true } },
          province_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          economic_advice: { type: 'string' },
          table_updates: { type: 'array', items: { type: 'object', additionalProperties: true } },
          suggestions: { type: 'array', items: { type: 'string' } }
        },
        required: ['turn_summary']
      }
    };
  }
  ns._buildSc1JsonSchema = _buildSc1JsonSchema;
function _buildSc1bJsonSchema() {
    return {
      name: 'sc1b_letters',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          cultural_works: { type: 'array', items: { type: 'object', additionalProperties: true } },
          npc_letters: { type: 'array', items: { type: 'object', additionalProperties: true } },
          npc_correspondence: { type: 'array', items: { type: 'object', additionalProperties: true } },
          npc_interactions: { type: 'array', items: { type: 'object', additionalProperties: true } }
        },
        required: []
      }
    };
  }
  ns._buildSc1bJsonSchema = _buildSc1bJsonSchema;
function _buildSc1cJsonSchema() {
    return {
      name: 'sc1c_factions',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          faction_events: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_ai_outcomes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_interactions_advanced: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_relation_changes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          faction_succession: { type: 'array', items: { type: 'object', additionalProperties: true } },
          npc_schemes: { type: 'array', items: { type: 'object', additionalProperties: true } },
          hidden_moves: { type: 'array', items: { type: 'string' } },
          scheme_actions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          fengwen_snippets: { type: 'array', items: { type: 'object', additionalProperties: true } }
        },
        required: []
      }
    };
  }
  ns._buildSc1cJsonSchema = _buildSc1cJsonSchema;
function _buildSc1qJsonSchema() {
    return {
      name: 'sc1q_dialogue',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: true,
        properties: {
          dialogue_commitments: { type: 'array', items: { type: 'object', additionalProperties: true } },
          collective_resolutions: { type: 'array', items: { type: 'object', additionalProperties: true } },
          npc_dialogue_intent: { type: 'array', items: { type: 'object', additionalProperties: true } },
          required_sc1_actions: { type: 'array', items: { type: 'string' } }
        },
        required: []
      }
    };
  }
  ns._buildSc1qJsonSchema = _buildSc1qJsonSchema;
})(typeof window !== "undefined" ? window : globalThis);
