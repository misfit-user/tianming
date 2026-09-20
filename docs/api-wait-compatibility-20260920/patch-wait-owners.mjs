import fs from 'node:fs';import {edit} from './patch-utils.mjs';
const helper=fs.readFileSync('docs/api-wait-compatibility-20260920/wait-policy.fragment.js','utf8');
edit('web/tm-ai-infra-retry.js',(s,r)=>{
 s=r(s,'async function _aiWithStreamScope(opts, execute) {',helper+'async function _aiWithStreamScope(opts, execute) {');
 s=r(s,'  var timeout = _aiComputeTimeout(12000, opts.timeoutMs);','  var timeout = _aiTotalResponseTimeout(opts);');
 s=r(s,"    timer = setTimeout(function() { var e = new Error('AI 任务总等待时间已到'); e.code = 'AI_REQUEST_DEADLINE'; e.name = 'TimeoutError'; abort(e); }, timeout);","    if (timeout > 0) timer = setTimeout(function() { var e = new Error('达到明确设置的完整响应最大等待时间'); e.code = 'AI_REQUEST_DEADLINE'; e.name = 'TimeoutError'; abort(e); }, timeout);");
 s=r(s,'  if (!Number.isFinite(duration) || duration <= 0) duration = 180000;','  if (!Number.isFinite(duration) || duration <= 0) duration = 0;');
 s=r(s,'deadlineAt: Date.now() + Math.min(900000, duration)','deadlineAt: duration ? Date.now() + Math.min(86400000, duration) : Infinity');
 s=r(s,'var timeout = _aiComputeTimeout(body && (body.max_completion_tokens || body.max_tokens), opts.timeoutMs);','var timeout = _aiFirstResponseTimeout(body && (body.max_completion_tokens || body.max_tokens), opts);');
 s=r(s,'totalTimeoutMs: timeout * (retries + 1) + 30000','totalTimeoutMs: _aiTotalResponseTimeout(opts)');
 s=r(s,'    var remaining = budget.deadlineAt - Date.now();','    var explicitTotal = _aiTotalResponseTimeout(opts);\n    var remaining = Math.min(budget.deadlineAt - Date.now(), explicitTotal > 0 ? explicitTotal : Infinity);');
 s=r(s,"    timer = setTimeout(function() { var e = new Error('AI 任务总等待时间已到'); e.code = 'AI_REQUEST_DEADLINE'; e.name = 'TimeoutError'; ctrl.abort(e); }, remaining);","    if (Number.isFinite(remaining)) timer = setTimeout(function() { var e = new Error('达到明确设置的完整响应最大等待时间'); e.code = 'AI_REQUEST_DEADLINE'; e.name = 'TimeoutError'; ctrl.abort(e); }, remaining);");
 return s;
});
edit('web/tm-utils.js',(s,r)=>{
 s=r(s,'      thinkingProtocol: _s.thinkingProtocol,','      thinkingProtocol: _s.thinkingProtocol,\n      firstResponseTimeoutMs: _s.firstResponseTimeoutMs, totalResponseTimeoutMs: _s.totalResponseTimeoutMs,');
 return r(s,'    thinkingProtocol: P.ai && P.ai.thinkingProtocol,','    thinkingProtocol: P.ai && P.ai.thinkingProtocol,\n    firstResponseTimeoutMs: P.ai && P.ai.firstResponseTimeoutMs, totalResponseTimeoutMs: P.ai && P.ai.totalResponseTimeoutMs,');
});
