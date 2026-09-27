import {edit} from './patch-utils.mjs';
edit('web/tm-ai-infra.js',(s,r)=>{
 s=r(s,'totalTimeoutMs: _aiComputeTimeout(scoped.maxTok, scoped.timeoutMs || 180000)','totalTimeoutMs: _aiTotalResponseTimeout(scoped)');
 s=r(s,"    var timer = setTimeout(function() { timedOut = true; var e = new Error('AI tool request timed out'); e.code = 'tool-timeout'; toolReject(e); ctrl.abort(e); }, _aiComputeTimeout(maxTok, opts.timeoutMs || 180000));","    var timer = null, responseWait = null;");
 s=r(s,'        _aiClaimRetryAttempt(opts.retryBudget);',`        _aiClaimRetryAttempt(opts.retryBudget);
        if (responseWait) responseWait.dispose();
        responseWait = _aiStartResponseWait(opts, _aiFirstResponseTimeout(maxTok, opts), function(e) { timedOut = e.name === 'TimeoutError'; toolReject(e); ctrl.abort(e); });
        timer = responseWait.headerTimer;`);
 s=r(s,'signal: ctrl.signal, timeoutMs: opts.timeoutMs || 180000 }), toolDeadline]);','signal: ctrl.signal, timeoutMs: _aiFirstResponseTimeout(maxTok, opts), waitForCompleteResponse: true, totalResponseTimeoutMs: _aiTotalResponseTimeout(opts) }), toolDeadline]);');
 s=r(s,"        if (diag) diag.requestPhase(opts._requestTicket, 'body');","        responseWait.headers(resp.ok);\n        if (diag) diag.requestPhase(opts._requestTicket, 'body');");
 s=r(s,'    } finally {\n      clearTimeout(timer);\n      if (opts.signal', '    } finally {\n      if (responseWait) responseWait.dispose();\n      clearTimeout(timer);\n      if (opts.signal');
 return s;
});
edit('web/tm-ai-infra-retry.js',(s,r)=>{
 s=r(s,'    if (!Number.isFinite(_exactMax) || _exactMax <= 0) throw new Error(\'流式 finalizedBody.max_tokens 非法\');\n    maxTok = Math.floor(_exactMax);',`    var hasOutputLimit = _finalizedBody.max_completion_tokens != null || _finalizedBody.max_tokens != null;
    if (hasOutputLimit && (!Number.isFinite(_exactMax) || _exactMax <= 0)) throw new Error('流式 finalizedBody.max_tokens 非法');
    maxTok = hasOutputLimit ? Math.floor(_exactMax) : undefined;`);
 s=r(s,'  var streamTimeout = _aiComputeTimeout(maxTok, opts.timeoutMs || 180000);','  var streamTimeout = _aiFirstResponseTimeout(maxTok, opts);');
 s=r(s,"  var timer = setTimeout(function() { var e = new Error('流式请求超时'); e.code = 'AI_TIMEOUT'; e.name = 'TimeoutError'; e.phase = streamPhase; streamReject(e); ctrl.abort(e); }, streamTimeout);","  var responseWait = _aiStartResponseWait(opts, streamTimeout, function(e) { streamReject(e); ctrl.abort(e); });\n  var timer = responseWait.headerTimer;");
 s=r(s,'if (opts.signal && opts.signal.aborted) { clearTimeout(timer); throw _aiCancelledError(opts.signal); }','if (opts.signal && opts.signal.aborted) { clearTimeout(timer); responseWait.dispose(); throw _aiCancelledError(opts.signal); }');
 s=r(s,'signal: ctrl.signal, timeoutMs: streamTimeout','signal: ctrl.signal, timeoutMs: streamTimeout, waitForCompleteResponse: true, totalResponseTimeoutMs: _aiTotalResponseTimeout(opts)');
 s=r(s,'    streamPhase = "body";','    responseWait.headers(resp.ok);\n    streamPhase = "body";');
 s=r(s,'  } finally {\n    clearTimeout(timer);','  } finally {\n    responseWait.dispose();\n    clearTimeout(timer);');
 return s;
});
