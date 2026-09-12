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

  function trimUserMessage(body, options, initialReport) {
    var userIndex = userMessageIndex(body);
    if (userIndex < 0) {
      var missingUser = new Error('SC1 request has no trimmable user message');
      missingUser.code = 'mandatory_context_overflow';
      throw missingUser;
    }
    var original = String(body.messages[userIndex].content || '');
    var omission = '\n\n【上下文硬上限·已省略中段；保留玩家输入、权威状态首部与最终硬规则尾部】\n\n';
    var suffixMarkers = ['\n\n=== sc1q 硬性要求', '\n\n=== 输出格式强约束'];
    var mandatoryStart = -1;
    suffixMarkers.forEach(function(marker) {
      var index = original.indexOf(marker);
      if (index >= 0 && (mandatoryStart < 0 || index < mandatoryStart)) mandatoryStart = index;
    });
    var mandatorySuffix = mandatoryStart >= 0 ? original.slice(mandatoryStart) : '';
    var trimmable = mandatoryStart >= 0 ? original.slice(0, mandatoryStart) : original;
    var low = 0;
    var high = trimmable.length;
    var best = null;
    var bestReport = null;
    while (low <= high) {
      var keep = Math.floor((low + high) / 2);
      var head = Math.ceil(keep * 0.55);
      var tail = keep - head;
      var candidate = cloneRequestBody(body);
      candidate.messages[userIndex].content = trimmable.slice(0, head)
        + omission
        + (tail > 0 ? trimmable.slice(trimmable.length - tail) : '')
        + mandatorySuffix;
      var report = measureRequest(candidate, options);
      if (report.ok) {
        best = candidate;
        bestReport = report;
        low = keep + 1;
      } else {
        high = keep - 1;
      }
    }
    if (!best) {
      var overflow = new Error('SC1 mandatory system/schema/final-rule context exceeds the hard request ceiling');
      overflow.code = 'mandatory_context_overflow';
      overflow.rawTokenEstimate = initialReport.inputTokens;
      overflow.inputTokenLimit = initialReport.inputTokenLimit;
      throw overflow;
    }
    return {
      body:best,
      report:bestReport,
      omittedChars:Math.max(0, trimmable.length
        - (best.messages[userIndex].content.length - omission.length - mandatorySuffix.length))
    };
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
        trimmed:trimmed.omittedChars > 0,
        emergency:options.emergency === true
      }
    };
  }

  function createContextOverflowReducer(options) {
    options = Object.assign({}, options || {});
    return function(body) {
      var compact = cloneRequestBody(body);
      if (compact.response_format && compact.response_format.type === 'json_schema') {
        compact.response_format = { type:'json_object' };
      }
      var before = measureRequest(compact, options);
      var emergencyLimit = Math.max(256, Math.floor(before.inputTokens * 0.55));
      return finalizeRequestBody(compact, Object.assign({}, options, {
        inputTokenLimit:emergencyLimit,
        emergency:true
      })).body;
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
      if (diagnostics && diagnostics.trimmed && typeof global.toast === 'function') {
        global.toast('[SC1] 最终请求超预算·已在完整组装后压缩至硬上限内');
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
