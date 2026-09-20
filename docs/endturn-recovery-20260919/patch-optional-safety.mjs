import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,"        if (diagnostics) { var ticket = diagnostics.requestStart('checkpoint:' + kind); diagnostics.requestPhase(ticket, 'reused'); diagnostics.requestEnd(ticket, null); }","        try { if (diagnostics) { var ticket = diagnostics.requestStart('checkpoint:' + kind); diagnostics.requestPhase(ticket, 'reused'); diagnostics.requestEnd(ticket, null); } } catch (_) { /* Diagnostics must not invalidate a complete response. */ }");
  s=r(s,'var encoded = policy.complete && policy.complete(value) ? lossless(value) : null;','var encoded = (!policy.matches || policy.matches()) && policy.complete && policy.complete(value) ? lossless(value) : null;');
  s=r(s,'    var receipt = {}, request;\n    try { request = JSON.stringify(body); } catch (_) { return execute(opts); }','    var receipt = {}, request, originalOptions;\n    try { request = JSON.stringify(body); originalOptions = JSON.stringify(optionKey(opts)); } catch (_) { return execute(opts); }');
  s=r(s,'    var originalOptions = JSON.stringify(optionKey(opts));\n','');
  s=r(s,"    var compression = typeof root.getCompressionParams === 'function' ? root.getCompressionParams() : null;\n    var descriptor = [prompt, tools, optionKey(opts), compression], encodedDescriptor = JSON.stringify(descriptor);", "    var compression, descriptor, encodedDescriptor;\n    try { compression = typeof root.getCompressionParams === 'function' ? root.getCompressionParams() : null; descriptor = [prompt, tools, optionKey(opts), compression]; encodedDescriptor = JSON.stringify(descriptor); } catch (_) { return execute(opts); }");
  return r(s,"    var descriptor = [kind, payload, maxTokens, optionKey(opts), compression], encodedDescriptor = JSON.stringify(descriptor);", "    var descriptor, encodedDescriptor;\n    try { descriptor = [kind, payload, maxTokens, optionKey(opts), compression]; encodedDescriptor = JSON.stringify(descriptor); } catch (_) { return execute(opts); }");
});
edit('web/scripts/smoke-turn-response-recovery.js',(s,r)=>r(s,'(async()=>{',`test('uncacheable optional metadata does not suppress or repeat a normal request',async()=>{
  const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return f.okay(f.response());};await f.begin();const circular={};circular.self=circular;
    assert.equal((await f.request(f.body(),{diagnosticMetadata:circular})).choices[0].message.content,'完整叙事与有效状态提案。');assert.equal(calls,1);
  }finally{f.dispose();}
});
test('tool definitions changed during inference do not populate the old request checkpoint',async()=>{
  const f=fixture();let calls=0;try{
    const defs=[{name:'inspect',description:'original',parameters:{type:'object'}}];f.c.fetch=async()=>{calls++;defs[0].description='changed';return f.okay({choices:[{message:{tool_calls:[{function:{name:'inspect',arguments:'{}'}}]},finish_reason:'tool_calls'}]});};
    const a=await f.begin();await f.c.callAIWithTools('test',defs,{timeoutMs:500});f.rollback(a);defs[0].description='original';await f.begin();await f.c.callAIWithTools('test',defs,{timeoutMs:500});assert.equal(calls,2);
  }finally{f.dispose();}
});
(async()=>{`));
