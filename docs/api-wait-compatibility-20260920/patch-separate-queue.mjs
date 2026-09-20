import {edit} from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js',(s,r)=>{
 s=r(s,'function _aiFirstResponseTimeout(maxTok, opts) {',"function _aiQueueWaitTimeout(opts) {\n  opts = opts || {}; var cfg = _aiWaitConfig(opts);\n  return _aiWaitSetting(opts.queueTimeoutMs != null ? opts.queueTimeoutMs : cfg.queueTimeoutMs, '排队最大等待');\n}\nfunction _aiFirstResponseTimeout(maxTok, opts) {");
 return r(s,'{ signal: ctrl.signal, timeoutMs: Math.min(timeout, remaining) }','{ signal: ctrl.signal, timeoutMs: _aiQueueWaitTimeout(opts) }');
});
edit('web/tm-ai-infra.js',(s,r)=>{
 const old="{ signal: opts.signal, timeoutMs: opts.timeoutMs || 180000 }";
 if(s.split(old).length!==4)throw Error('Expected tool and both streaming queue options');
 s=s.replaceAll(old,"{ signal: opts.signal, timeoutMs: _aiQueueWaitTimeout(opts) }");
 return s.replaceAll('firstResponseTimeoutMs: opts.firstResponseTimeoutMs, totalResponseTimeoutMs: opts.totalResponseTimeoutMs,','firstResponseTimeoutMs: opts.firstResponseTimeoutMs, totalResponseTimeoutMs: opts.totalResponseTimeoutMs, queueTimeoutMs: opts.queueTimeoutMs,');
});
edit('web/tm-utils.js',(s,r)=>{
 s=r(s,'firstResponseTimeoutMs: _s.firstResponseTimeoutMs,','queueTimeoutMs: _s.queueTimeoutMs, firstResponseTimeoutMs: _s.firstResponseTimeoutMs,');
 return r(s,'firstResponseTimeoutMs: P.ai && P.ai.firstResponseTimeoutMs,','queueTimeoutMs: P.ai && P.ai.queueTimeoutMs, firstResponseTimeoutMs: P.ai && P.ai.firstResponseTimeoutMs,');
});
edit('web/tm-api-settings.js',(s,r)=>{
 s=r(s,"var firstWait = durationField('首响应等待（秒，0 = 自动）'","var queueWait = durationField('排队最大等待（秒，0 = 不设）', 'queue-wait', cfg.queueTimeoutMs);\n    var firstWait = durationField('发送后的首响应等待（秒，0 = 自动）'");
 s=r(s,'var firstMs = readDuration(firstWait), totalMs = readDuration(totalWait),','var queueMs = readDuration(queueWait), firstMs = readDuration(firstWait), totalMs = readDuration(totalWait),');
 return r(s,'      target.firstResponseTimeoutMs = firstMs;','      target.queueTimeoutMs = queueMs; target.firstResponseTimeoutMs = firstMs;');
});
edit('web/scripts/smoke-turn-request-reliability.js',(s,r)=>r(s,'f.request({ timeoutMs: 12 })','f.request({ timeoutMs: 200, queueTimeoutMs: 12 })'));
