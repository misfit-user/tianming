import {edit} from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js',(s,r)=>{
 s=r(s,'  var method = String(options.method || \'GET\').toUpperCase(), signal = options.signal;',"  var method = String(options.method || 'GET').toUpperCase(), signal = options.signal;\n  var completeWait = options.waitForCompleteResponse === true;\n  var explicitTotal = completeWait ? _aiWaitSetting(options.totalResponseTimeoutMs, '完整响应最大等待') : 0;");
 s=r(s,"readTimeout: timeoutMs,","readTimeout: completeWait ? explicitTotal : timeoutMs,");
 const a=s.indexOf('    timer = setTimeout(function() {',s.indexOf('async function _tmAIFetch(')),b=s.indexOf('    if (signal)',a);let fragment=s.slice(a,b);
 fragment=fragment.replace('    timer = setTimeout(function() {','    if (!completeWait || explicitTotal > 0) timer = setTimeout(function() {').replace('    }, timeoutMs);','    }, completeWait ? explicitTotal : timeoutMs);');
 return r(s,s.slice(a,b),fragment);
});
edit('web/tm-endturn-ai.js',(s,r)=>{
 const line=s.split('\n').find(l=>l.includes('totalTimeoutMs: (Number(opts.timeoutMs)'));
 if(!line)throw Error('Shared stage timeout initializer missing');
 return r(s,line.trimEnd(),'        totalTimeoutMs: typeof _aiTotalResponseTimeout === "function" ? _aiTotalResponseTimeout(opts) : 0');
});
edit('web/tm-endturn-agent-mode.js',(s,r)=>r(s,'deadlineMs: _conf.agentModeDeadlineMs || 420000','deadlineMs: P.ai && P.ai.agentRunTimeoutMs != null ? Number(P.ai.agentRunTimeoutMs) : (Number(_conf.agentModeDeadlineMs) || 0)'));
edit('web/tm-memory-agent-tools.js',(s,r)=>r(s,'deadline = Date.now() + 65000','deadline = Number(ctx.deadlineMs) > 0 ? Date.now() + Number(ctx.deadlineMs) : Infinity'));
