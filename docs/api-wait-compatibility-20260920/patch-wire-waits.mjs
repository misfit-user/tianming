import {edit} from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js',(s,r)=>r(s,'  return { headers: function(ok) {','  return { headerTimer: headerTimer, headers: function(ok) {'));
edit('web/tm-ai-infra.js',(s,r)=>{
 const start=s.indexOf('async function _aiFetchWithRetryInner('),end=s.indexOf('\n// ===',start);let fn=s.slice(start,end);
 fn=r(fn,'var timeoutMs = _aiComputeTimeout(body && (body.max_completion_tokens || body.max_tokens), opts.timeoutMs);','var timeoutMs = _aiFirstResponseTimeout(body && (body.max_completion_tokens || body.max_tokens), opts);');
 const a=fn.indexOf('    var timeoutAborter = function() {'),b=fn.indexOf('    var externalAborter',a);
 fn=r(fn,fn.slice(a,b),`    var timeoutAborter = function(error) {
      timedOut = error.name === 'TimeoutError'; timeoutError = error;
      rejectDeadline(error); ctrl.abort(error);
    };
`);
 fn=r(fn,'    var timer = setTimeout(timeoutAborter, timeoutMs);','    deadline.catch(function() {});\n    var responseWait = _aiStartResponseWait(opts, timeoutMs, timeoutAborter);\n    var timer = responseWait.headerTimer;');
 fn=r(fn,'if (signal.aborted) { clearTimeout(timer); throw _aiCancelledError(signal); }','if (signal.aborted) { clearTimeout(timer); responseWait.dispose(); throw _aiCancelledError(signal); }');
 fn=r(fn,'signal: ctrl.signal, timeoutMs: timeoutMs','signal: ctrl.signal, timeoutMs: timeoutMs, waitForCompleteResponse: true, totalResponseTimeoutMs: _aiTotalResponseTimeout(opts)');
 fn=r(fn,"      requestPhase = 'body';","      responseWait.headers(resp.ok);\n      requestPhase = 'body';");
 fn=r(fn,'    } finally {\n      clearTimeout(timer);','    } finally {\n      responseWait.dispose();\n      clearTimeout(timer);');
 s=r(s,s.slice(start,end),fn);
 s=r(s,"var fetchOpts = { apiKey: key, priority: opts.priority || 'normal', retryBudget: opts.retryBudget, id: opts.id };","var fetchOpts = { apiKey: key, tier: tier, firstResponseTimeoutMs: opts.firstResponseTimeoutMs, totalResponseTimeoutMs: opts.totalResponseTimeoutMs, priority: opts.priority || 'normal', retryBudget: opts.retryBudget, id: opts.id };");
 return r(s,"var fetchOpts2 = { apiKey: key, priority: opts.priority || 'normal', retryBudget: opts.retryBudget, id: opts.id };","var fetchOpts2 = { apiKey: key, tier: tier, firstResponseTimeoutMs: opts.firstResponseTimeoutMs, totalResponseTimeoutMs: opts.totalResponseTimeoutMs, priority: opts.priority || 'normal', retryBudget: opts.retryBudget, id: opts.id };");
});
