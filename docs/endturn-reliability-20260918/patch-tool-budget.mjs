import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra.js', (s, r) => {
  s = r(s, '    var result = await _callAIWithToolsScoped(prompt, tools, scoped);', '    scoped.retryBudget = scoped.retryBudget || _aiCreateRetryBudget({ maxAttempts: 3 + (Number(scoped.maxRetries) || 0), totalTimeoutMs: _aiComputeTimeout(scoped.maxTok, scoped.timeoutMs || 180000) });\n    var result = await _callAIWithToolsScoped(prompt, tools, scoped);');
  s = r(s, "if (failure.code === 'aborted' || failure.code === 'tool-timeout' || _aiErrorIsTerminal(e)", "if (failure.code === 'aborted' || failure.code === 'tool-timeout' || (failure.status !== 400 && _aiErrorIsTerminal(e)) || (e && e.code === 'context_length_exceeded')");
  const start = s.indexOf('async function _callAIWithToolsScoped('), end = s.indexOf('async function callAISmart(', start);
  let fn = s.slice(start,end);
  fn = r(fn, '        if (opts._streamGuard) opts._streamGuard();\n        var diag', '        if (opts._streamGuard) opts._streamGuard();\n        _aiClaimRetryAttempt(opts.retryBudget);\n        var diag');
  fn = r(fn, '          err.status = resp.status;', "          err.status = resp.status;\n          if (_isContextLengthResponse(resp.status, errT)) err.code = 'context_length_exceeded';");
  const old = "{ priority: opts.priority || 'normal', timeoutMs: opts.timeoutMs, maxRetries: opts.maxRetries }";
  if (!fn.includes(old)) throw Error('Tool JSON fallback options missing');
  fn = fn.replaceAll(old, "{ priority: opts.priority || 'normal', timeoutMs: opts.timeoutMs, maxRetries: opts.maxRetries, retryBudget: opts.retryBudget, id: opts.id }");
  s = r(s, s.slice(start,end), fn);
  for (const name of ['fetchOpts','fetchOpts2']) s = r(s, "var " + name + " = { apiKey: key, priority: opts.priority || 'normal' };", "var " + name + " = { apiKey: key, priority: opts.priority || 'normal', retryBudget: opts.retryBudget, id: opts.id };");
  return s;
});
