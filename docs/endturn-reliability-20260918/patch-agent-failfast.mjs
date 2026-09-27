import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra.js', (s, r) => {
  s = r(s, '      var choiceRetried = false;', '      var choiceRetried = false, transportRetries = 0;\n      var toolRetryLimit = opts.maxRetries == null ? 1 : Math.max(0, Math.min(3, Number(opts.maxRetries) || 0));');
  return r(s, '          var choiceUnsupported = resp.status === 400', "          if ((resp.status === 429 || resp.status >= 500) && transportRetries < toolRetryLimit) {\n            await _aiBudgetedRetryWait(_aiRetryDelay(resp, transportRetries++), opts.signal, opts.retryBudget);\n            continue;\n          }\n          var choiceUnsupported = resp.status === 400");
});
edit('web/tm-endturn-agent-mode.js', (s, r) => {
  const anchor = "        if (!resp) { if (round === 1) return bail('Agent 无响应(首轮)'); break; }";
  return r(s, anchor, anchor + "\n        if (resp.error && !(Array.isArray(resp.toolCalls) && resp.toolCalls.length)) {\n          state.loopError = { code: resp.error.code || 'tool-call-failed', status: Number(resp.error.status) || 0 };\n          return bail('Agent 请求失败，已停止后续调用：' + state.loopError.code + (state.loopError.status ? ' / HTTP ' + state.loopError.status : ''));\n        }");
});
