import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>r(s,"function failed(code) { var e = new Error('回合恢复对应的操作已取消或世界已改变'); e.code = code || 'AI_STALE_WORLD'; return e; }","function failed(code) { var e = new Error('回合恢复对应的操作已取消或世界已改变'); e.code = code || 'AI_STALE_WORLD'; if (e.code === 'AI_ABORTED') e.name = 'AbortError'; return e; }"));
edit('web/tm-ai-infra.js',(s,r)=>r(s,'  return recovery ? recovery.toolRequest(prompt, tools, opts, execute) : execute(opts);',`  try { return await (recovery ? recovery.toolRequest(prompt, tools, opts, execute) : execute(opts)); }
  catch (e) { return { text: '', toolCalls: [], error: { code: e && e.code === 'AI_ABORTED' ? 'aborted' : e && e.code === 'AI_STALE_WORLD' ? 'tool-stale' : 'tool-call-failed', status: Number(e && e.status) || 0 } }; }`));
edit('web/scripts/verify-all.js',(s,r)=>r(s,"  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }","  { name: 'turn-response-recovery', file: 'smoke-turn-response-recovery.js', estSec: 3, expectExit: 0 },\n  { name: 'turn-recovery-quality', file: 'smoke-turn-recovery-quality.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"));
edit('web/scripts/smoke-turn-recovery-quality.js',(s,r)=>r(s,'(async()=>{',`test('cached stream callbacks stop when onChunk changes the world',async()=>{
  const f=fixture();let done=0;try{
    f.c.fetch=async()=>f.okay(f.response('完整正文'));const a=await f.begin();await f.c.callAIBodyStream(f.body(),{timeoutMs:500});f.rollback(a);await f.begin();
    await assert.rejects(f.c.callAIBodyStream(f.body(),{timeoutMs:500,onChunk(){f.c.GM={turn:99};},onDone(){done++;}}),e=>e.code==='AI_STALE_WORLD');assert.equal(done,0);
  }finally{f.dispose();}
});
test('cancelled cached tool requests retain the structured tool-error API',async()=>{
  const f=fixture();try{
    const defs=[{name:'inspect',parameters:{type:'object'}}];f.c.fetch=async()=>f.okay({choices:[{message:{tool_calls:[{function:{name:'inspect',arguments:'{}'}}]},finish_reason:'tool_calls'}]});
    const a=await f.begin();await f.c.callAIWithTools('test',defs,{timeoutMs:500});f.rollback(a);await f.begin();
    const ctrl=new AbortController();ctrl.abort();const out=await f.c.callAIWithTools('test',defs,{timeoutMs:500,signal:ctrl.signal});assert.equal(out.error.code,'aborted');assert.equal(out.toolCalls.length,0);
  }finally{f.dispose();}
});
(async()=>{`));
