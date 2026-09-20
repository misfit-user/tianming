import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js', (s, r) => {
  const start = s.indexOf('async function _aiFetchWithRetry('), end = s.indexOf('// 默认按输出体量', start);
  if (start < 0 || end < 0) throw Error('Retry wrapper boundaries missing');
  s = r(s, s.slice(start, end), fs.readFileSync('docs/endturn-reliability-20260918/request-scope.fragment.txt','utf8') + '\n');
  s = r(s, '  if (optsTimeoutMs != null) return optsTimeoutMs;', '  if (optsTimeoutMs != null && Number.isFinite(Number(optsTimeoutMs)) && Number(optsTimeoutMs) > 0) return Math.min(900000, Number(optsTimeoutMs));');
  s = r(s, "  var error = new Error('AI 请求已取消');", "  if (signal && signal.reason && typeof signal.reason === 'object' && /^AI_(REQUEST_DEADLINE|RETRY_BUDGET|STALE_WORLD)$/.test(signal.reason.code || '')) return signal.reason;\n  var error = new Error('AI 请求已取消');");
  s = r(s, "return !!(error && (error.code === 'AI_TIMEOUT'", "return !!(error && (error._aiRetryExhausted === true || /^AI_(QUEUE_TIMEOUT|REQUEST_DEADLINE|RETRY_BUDGET|STALE_WORLD)$/.test(error.code || '') || error.code === 'AI_TIMEOUT'");
  return s;
});
edit('web/tm-ai-infra.js', (s, r) => {
  s = r(s, '  var seqCounter = 0;', '  var seqCounter = 0;\n  var pumpTimer = null;');
  s = r(s, '  function recordResult(ok, err) {', "  function recordResult(ok, err) {\n    if (!ok && err && (err.code === 'AI_ABORTED' || err.code === 'AI_STALE_WORLD')) return;");
  s = r(s, '        setTimeout(pump, wait + 10);', '        if (!pumpTimer) pumpTimer = setTimeout(function() { pumpTimer = null; pump(); }, wait + 10);');
  s = r(s, '      if (!item) return;\n      var itemPriority', '      if (!item) return;\n      if (item.cancelled) continue;\n      item.started = true; if (item.cleanupQueue) item.cleanupQueue();\n      var itemPriority');
  const start = s.indexOf('    enqueue: function(task, priority) {'), end = s.indexOf('    stats: function()', start);
  if (start < 0 || end < 0) throw Error('Queue entry boundaries missing');
  s = r(s, s.slice(start,end), fs.readFileSync('docs/endturn-reliability-20260918/queue-enqueue.fragment.txt','utf8'));
  s = r(s, '  for (var attempt = 0; attempt <= maxRetries; attempt++) {', '  var protocolReplay = false;\n  for (var attempt = 0; attempt <= maxRetries || protocolReplay; attempt++) {\n    protocolReplay = false;\n    if (signal && signal.aborted) throw _aiCancelledError(signal);\n    if (typeof _aiClaimRetryAttempt === "function") _aiClaimRetryAttempt(opts.retryBudget);\n    if (opts.retryBudget) timeoutMs = Math.min(timeoutMs, Math.max(1, opts.retryBudget.deadlineAt - Date.now()));\n    var reliability = typeof window !== "undefined" && window.TM && window.TM.Endturn && window.TM.Endturn.Reliability;\n    if (reliability) reliability.requestPhase(opts._requestTicket, "request");');
  s = r(s, "      requestPhase = 'body';", "      requestPhase = 'body';\n      if (reliability) reliability.requestPhase(opts._requestTicket, 'body');");
  s = r(s, '                _contextReduced = true;', '                _contextReduced = true;\n                protocolReplay = true;');
  s = r(s, '          _ccStripped = true;', '          _ccStripped = true;\n          protocolReplay = true;');
  return s;
});
edit('web/tm-ai-infra.js', (s, r) => {
  const delay = s.split('\n').find(l => l.includes('var delay429 ='));
  s = r(s, delay.trimEnd(), '        var delay429 = _aiRetryDelay(resp, attempt);');
  s = r(s, 'await _aiWaitForRetry(delay429, signal);', 'await _aiBudgetedRetryWait(delay429, signal, opts.retryBudget);');
  s = r(s, 'await _aiWaitForRetry(1000 * Math.pow(2, attempt), signal);', 'await _aiBudgetedRetryWait(_aiRetryDelay(null, attempt), signal, opts.retryBudget);');
  s = r(s, 'var delayRetry = 1000 * Math.pow(2, attempt);', 'var delayRetry = _aiRetryDelay(null, attempt);');
  s = r(s, 'await _aiWaitForRetry(delayRetry, signal);', 'await _aiBudgetedRetryWait(delayRetry, signal, opts.retryBudget);');
  return s;
});
edit('web/tm-endturn-ai.js', (s, r) => {
  s = r(s, "      var label = opts.label || 'endturn';", "      if (!opts.retryBudget && typeof _aiCreateRetryBudget === 'function') opts.retryBudget = _aiCreateRetryBudget({\n        maxAttempts: Math.min(8, 4 + (Number(opts.maxRetries) || 0) + (Number(opts.repairMaxRetries) || 0)),\n        totalTimeoutMs: (Number(opts.timeoutMs) || 90000) + (opts.expectedKeys ? (Number(opts.repairTimeoutMs) || 45000) : (Number(opts.timeoutMs) || 90000) * (Number(opts.maxRetries) || 0)) + 45000\n      });\n      var label = opts.label || 'endturn';");
  s = r(s, '            contextOverflowReducer: opts.contextOverflowReducer\n', '            contextOverflowReducer: opts.contextOverflowReducer,\n            retryBudget: opts.retryBudget, id: opts.id\n');
  s = r(s, '            repairMaxRetries: opts.repairMaxRetries\n', '            repairMaxRetries: opts.repairMaxRetries,\n            retryBudget: opts.retryBudget, signal: opts.signal, id: opts.id\n');
  s = r(s, '          maxRetries: opts.repairMaxRetries != null ? opts.repairMaxRetries : 1\n', '          maxRetries: opts.repairMaxRetries != null ? opts.repairMaxRetries : 1,\n          retryBudget: opts.retryBudget, id: (opts.id || "json") + ":repair"\n');
  s = r(s, 'repairMaxRetries:1, subcallRetries:1 };', 'repairMaxRetries:1, subcallRetries:0 };');
  s = r(s, 'subcallRetries:subcallRetries == null ? 1 : subcallRetries', 'subcallRetries:subcallRetries == null ? 0 : subcallRetries');
  return s;
});
