import {edit} from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js',(s,r)=>{
 s=r(s,'  var timeout = _aiTotalResponseTimeout(opts);',"  var userLimit = _aiTotalResponseTimeout(opts);\n  var timeout = Math.min(userLimit > 0 ? userLimit : Infinity, opts.retryBudget ? opts.retryBudget.deadlineAt - Date.now() : Infinity);\n  if (timeout <= 0) throw _aiRetryBudgetError();");
 s=r(s,"    if (timeout > 0) timer = setTimeout", "    if (Number.isFinite(timeout)) timer = setTimeout");
 s=r(s,'e.timeoutMs = ms; e.phase = row.phase; stop(); fail(e);','e.timeoutMs = ms; e.phase = row.phase; if (row.httpStatus) e.status = row.httpStatus; stop(); fail(e);');
 s=r(s,'headers: function(ok) {','headers: function(ok, status) {');
 s=r(s,'if (!ok) { row.phase = "error-body"; return; }','if (!ok) { row.phase = "error-body"; row.httpStatus = status; return; }');
 s=r(s,'    responseWait.headers(resp.ok);','    responseWait.headers(resp.ok, resp.status);');
 s=r(s,'// 默认按输出体量取 30–200s；显式子调用策略优先。本轮不改变时限/输出质量，\n// 只保证同一个时限覆盖响应头与完整正文，而不是拿到响应头就提前清掉。','// 默认按输出体量取 30–200s 首响应期限；收到成功响应头即清除。\n// 完整正文由取消信号与明确配置的总上限约束，不缩减生成内容。');
 return s;
});
edit('web/tm-ai-infra.js',(s)=>s.replaceAll('responseWait.headers(resp.ok);','responseWait.headers(resp.ok, resp.status);'));
edit('web/tm-endturn-agent-mode.js',(s,r)=>r(s,'deadlineMs: P.ai && P.ai.agentRunTimeoutMs != null ? Number(P.ai.agentRunTimeoutMs) : (Number(_conf.agentModeDeadlineMs) || 0)',"deadlineMs: _aiWaitSetting(P.ai && P.ai.agentRunTimeoutMs != null ? P.ai.agentRunTimeoutMs : _conf.agentModeDeadlineMs, 'Agent 回合总时限')"));
