import {edit} from './patch-utils.mjs';
edit('web/tm-ai-infra-retry.js',(s,r)=>r(s,'    if (!ok || closed) return;','    if (closed) return;\n    if (!ok) { row.phase = "error-body"; return; }'));
edit('web/scripts/smoke-ai-transport-deadlines.js',(s,r)=>{
 s=r(s,"test('deadline covers response body after successful headers'","test('explicit maximum covers response body after successful headers'");
 s=r(s,"assert.rejects(f.request(),e=>e.code==='AI_TIMEOUT'&&e.phase==='body'&&e.timeoutMs===15)","assert.rejects(f.request({totalResponseTimeoutMs:15}),e=>e.code==='AI_REQUEST_DEADLINE'&&e.phase==='body'&&e.timeoutMs===15)");
 s=r(s,"assert.rejects(f.request(),e=>e.code==='AI_TIMEOUT');await new Promise(r=>setTimeout(r,55))","assert.rejects(f.request({totalResponseTimeoutMs:15}),e=>e.code==='AI_REQUEST_DEADLINE');await new Promise(r=>setTimeout(r,55))");
 return r(s,"e=>e.code==='AI_TIMEOUT'&&e.phase==='body');}finally","e=>e.code==='AI_TIMEOUT'&&e.phase==='error-body');}finally");
});
edit('web/scripts/smoke-turn-stream-reliability.js',(s,r)=>{
 s=r(s,'{ timeoutMs: 15, onDone()','{ timeoutMs: 15, totalResponseTimeoutMs: 15, onDone()');
 return r(s,'toolDefs, { timeoutMs: 15 });','toolDefs, { timeoutMs: 15, totalResponseTimeoutMs: 15 });');
});
edit('web/scripts/verify-all.js',(s,r)=>r(s,"  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }","  { name: 'api-wait-compatibility', file: 'smoke-api-wait-compatibility.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"));
