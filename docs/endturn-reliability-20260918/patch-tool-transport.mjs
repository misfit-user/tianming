import { edit } from './patch-utils.mjs';
edit('web/tm-ai-infra.js', (s, r) => {
  s = r(s, 'async function callAIWithTools(prompt, tools, opts) {', `async function callAIWithTools(prompt, tools, opts) {
  try { return await _aiWithStreamScope(Object.assign({ id: 'tool-call' }, opts || {}), async function(scoped) {
    var result = await _callAIWithToolsScoped(prompt, tools, scoped);
    if (result && result.error && !(result.toolCalls && result.toolCalls.length)) { var e = new Error('AI tool result unavailable'); e.code = result.error.code; e.status = result.error.status; e._toolResult = result; throw e; }
    return result;
  }); }
  catch (e) { return e && e._toolResult || { text: '', toolCalls: [], error: { code: e && e.code === 'AI_ABORTED' ? 'aborted' : /TIMEOUT|DEADLINE/.test(e && e.code || '') ? 'tool-timeout' : e && e.code === 'AI_STALE_WORLD' ? 'tool-stale' : 'tool-call-failed', status: Number(e && e.status) || 0 } }; }
}
async function _callAIWithToolsScoped(prompt, tools, opts) {`);
  const start = s.indexOf('  async function _toolFetchQueued() {'), end = s.indexOf('  if (data && data.usage', start);
  let fn = s.slice(start,end);
  fn = r(fn, "    var timer = setTimeout(function() { timedOut = true; ctrl.abort(); }, (opts.timeoutMs != null ? opts.timeoutMs : 180000));", "    var toolReject; var toolDeadline = new Promise(function(_resolve, reject) { toolReject = reject; }); toolDeadline.catch(function() {});\n    var timer = setTimeout(function() { timedOut = true; var e = new Error('AI tool request timed out'); e.code = 'tool-timeout'; toolReject(e); ctrl.abort(e); }, _aiComputeTimeout(maxTok, opts.timeoutMs || 180000));");
  fn = r(fn, "var onExternalAbort = function() { ctrl.abort(); };", 'var onExternalAbort = function() { var e = _aiCancelledError(opts.signal); toolReject(e); ctrl.abort(e); };');
  fn = r(fn, "        if (ctrl.signal.aborted) throw new Error('Aborted');", '        if (ctrl.signal.aborted) throw _aiCancelledError(opts.signal);\n        if (opts._streamGuard) opts._streamGuard();\n        var diag = window.TM && window.TM.Endturn && window.TM.Endturn.Reliability; if (diag) diag.requestPhase(opts._requestTicket, "request");');
  fn = r(fn, "var resp = await (typeof _tmAIFetch === 'function' ? _tmAIFetch : fetch)(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal });", "var resp = await Promise.race([(typeof _tmAIFetch === 'function' ? _tmAIFetch : fetch)(url, { method: 'POST', headers: headers, body: JSON.stringify(body), signal: ctrl.signal, timeoutMs: opts.timeoutMs || 180000 }), toolDeadline]);\n        if (opts._streamGuard) opts._streamGuard();\n        if (diag) diag.requestPhase(opts._requestTicket, 'body');");
  fn = r(fn, 'try { errT = await resp.text(); } catch(_){ }', 'try { errT = await Promise.race([resp.text(), toolDeadline]); } catch(_){ if (ctrl.signal.aborted) throw _aiCancelledError(opts.signal); }');
  fn = r(fn, '        return await resp.json();', '        var parsedToolResponse = await Promise.race([resp.json(), toolDeadline]);\n        if (opts._streamGuard) opts._streamGuard();\n        return parsedToolResponse;');
  fn = r(fn, "data = await _aiQueue.enqueue(_toolFetchQueued, opts.priority || 'normal');", "data = await _aiQueue.enqueue(_toolFetchQueued, opts.priority || 'normal', { signal: opts.signal, timeoutMs: opts.timeoutMs || 180000 });");
  fn = r(fn, "if (failure.code === 'aborted' || failure.code === 'tool-timeout')", "if (failure.code === 'aborted' || failure.code === 'tool-timeout' || _aiErrorIsTerminal(e) || (e && e._tmNativeTransport) || failure.status === 429 || failure.status >= 500)");
  return r(s, s.slice(start,end), fn);
});
edit('web/tm-ai-infra-retry.js', (s, r) => r(s, "new Error('流式 AI 任务总等待时间已到')", "new Error('AI 任务总等待时间已到')"));
