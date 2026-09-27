import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js', (s, r) => r(s, 'function _aiCreateRetryBudget(opts) {', fs.readFileSync('docs/endturn-reliability-20260918/stream-scope.fragment.txt','utf8').replace('root.GM !== gm || root.P !== player', '(root.GM || null) !== gm || (root.P || null) !== player') + '\nfunction _aiCreateRetryBudget(opts) {'));
edit('web/tm-ai-infra.js', (s, r) => {
  s = r(s, 'async function callAIMessagesStream(messages, maxTok, opts) {', 'async function _callAIMessagesStreamQueued(messages, maxTok, opts) {');
  s = r(s, 'async function callAIBodyStream(finalizedBody, opts) {', 'async function _callAIBodyStreamQueued(finalizedBody, opts) {');
  const old = "  }, opts.priority || 'normal');\n}\n\n// 已经通过最终物理预算";
  s = r(s, old, "  }, opts.priority || 'normal', { signal: opts.signal, timeoutMs: opts.timeoutMs || 180000 });\n}\n\n// 已经通过最终物理预算");
  s = r(s, "  return _aiQueue.enqueue(run, opts.priority || 'normal');", "  return _aiQueue.enqueue(run, opts.priority || 'normal', { signal: opts.signal, timeoutMs: opts.timeoutMs || 180000 });");
  const anchor = 'async function _callAIMessagesStreamQueued(messages, maxTok, opts) {';
  s = r(s, anchor, `async function callAIMessagesStream(messages, maxTok, opts) {
  return _aiWithStreamScope(opts, function(scoped) { return _callAIMessagesStreamQueued(messages, maxTok, scoped); });
}
async function callAIBodyStream(finalizedBody, opts) {
  return _aiWithStreamScope(opts, function(scoped) { return _callAIBodyStreamQueued(finalizedBody, scoped); });
}
` + anchor);
  const start = s.indexOf('async function _callAIMessagesStreamDirect('), end = s.indexOf('async function callAIMessagesStream(', start);
  let fn = s.slice(start, end);
  fn = fn.replace('if (_isAINetworkError(e))', "if (_isAINetworkError(e) && !_finalizedBody && !_aiErrorIsTerminal(e))");
  fn = fn.replace("  var timer = setTimeout(function() { ctrl.abort(); }, (opts.timeoutMs != null ? opts.timeoutMs : 180000));", "  var streamReject, streamPhase = 'headers';\n  var streamDeadline = new Promise(function(_resolve, reject) { streamReject = reject; }); streamDeadline.catch(function() {});\n  var streamTimeout = _aiComputeTimeout(maxTok, opts.timeoutMs || 180000);\n  var timer = setTimeout(function() { var e = new Error('流式请求超时'); e.code = 'AI_TIMEOUT'; e.name = 'TimeoutError'; e.phase = streamPhase; streamReject(e); ctrl.abort(e); }, streamTimeout);");
  fn = fn.replace("throw new Error('Aborted');", 'throw _aiCancelledError(opts.signal);');
  fn = fn.replace('var onExternalAbort = function() { ctrl.abort(); };', 'var onExternalAbort = function() { var e = _aiCancelledError(opts.signal); streamReject(e); ctrl.abort(e); };');
  fn = fn.replace('  try {\n    // M4', '  try {\n    if (opts._streamGuard) opts._streamGuard();\n    var diag = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability; if (diag) diag.requestPhase(opts._requestTicket, "request");\n    // M4');
  fn = fn.replace("var resp = await (typeof _tmAIFetch === 'function' ? _tmAIFetch : fetch)(url, {", "var resp = await Promise.race([(typeof _tmAIFetch === 'function' ? _tmAIFetch : fetch)(url, {");
  fn = fn.replace('      signal: ctrl.signal\n    });', '      signal: ctrl.signal, timeoutMs: streamTimeout\n    }), streamDeadline]);\n    if (opts._streamGuard) opts._streamGuard();\n    streamPhase = "body"; if (diag) diag.requestPhase(opts._requestTicket, "body");');
  fn = fn.replace("if (!resp.ok) throw new Error('HTTP ' + resp.status);", "if (!resp.ok) { var httpError = new Error('HTTP ' + resp.status); httpError.status = resp.status; throw httpError; }");
  fn = fn.replace('var data = await resp.json();', 'var data = await Promise.race([resp.json(), streamDeadline]);\n      if (opts._streamGuard) opts._streamGuard();');
  fn = fn.replace('var _r = await reader.read();', 'var _r = await Promise.race([reader.read(), streamDeadline]);\n      if (opts._streamGuard) opts._streamGuard();');
  fn = fn.replace('    clearTimeout(timer);\n    if (opts.signal', '    clearTimeout(timer);\n    if (reader) { try { var cancelReader = reader.cancel(); if (cancelReader && cancelReader.catch) cancelReader.catch(function() {}); reader.releaseLock(); } catch (_) {} }\n    if (opts.signal');
  return r(s, s.slice(start, end), fn);
});
