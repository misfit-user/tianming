import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,'  function remember(s, key, encoded) {',`  function lossless(value) {
    var invalid = false;
    var encoded = JSON.stringify(value, function(k, v) {
      if (typeof v === 'number' && (!Number.isFinite(v) || Object.is(v, -0))) invalid = true;
      if (typeof v === 'undefined' || typeof v === 'function' || typeof v === 'symbol') invalid = true;
      var original = this && this[k];
      if (original && typeof original === 'object' && !Array.isArray(original) && Object.prototype.toString.call(original) !== '[object Object]') invalid = true;
      return v;
    });
    return invalid ? null : encoded;
  }
  function remember(s, key, encoded) {`);
  return r(s,'try { if (policy.complete && policy.complete(value)) remember(s, key, JSON.stringify(value)); else s.skipped++; } catch (_) { s.skipped++; }','try { var encoded = policy.complete && policy.complete(value) ? lossless(value) : null; if (encoded != null) remember(s, key, encoded); else s.skipped++; } catch (_) { s.skipped++; }');
});
edit('web/scripts/smoke-turn-response-recovery.js',(s,r)=>r(s,'(async()=>{',`test('non-finite tool arguments are never silently converted into reusable null values',async()=>{
  const f=fixture();let calls=0;try{
    const defs=[{name:'inspect',parameters:{type:'object'}}];f.c.fetch=async()=>{calls++;return f.okay({choices:[{message:{tool_calls:[{function:{name:'inspect',arguments:'{"amount":1e999}'}}]},finish_reason:'tool_calls'}]});};
    const a=await f.begin();const original=await f.c.callAIWithTools('test',defs,{timeoutMs:500});assert.equal(original.toolCalls[0].input.amount,Infinity);
    f.rollback(a);await f.begin();const next=await f.c.callAIWithTools('test',defs,{timeoutMs:500});assert.equal(next.toolCalls[0].input.amount,Infinity);assert.equal(calls,2);
  }finally{f.dispose();}
});
(async()=>{`));
