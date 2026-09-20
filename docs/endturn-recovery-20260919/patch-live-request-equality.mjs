import { edit } from './patch-utils.mjs';
edit('web/tm-endturn-response-recovery.js',(s,r)=>{
  s=r(s,'    if (Date.now() < s.at || Date.now() - s.at > LIMITS.ttlMs) s.reuse = null;',`    var stillMatches = true;
    try { if (policy.matches) stillMatches = policy.matches(); } catch (_) { stillMatches = false; }
    if (!stillMatches) { s.skipped++; return execute(); }
    if (Date.now() < s.at || Date.now() - s.at > LIMITS.ttlMs) s.reuse = null;`);
  s=r(s,'    var next = Object.assign({}, opts || {}, { _responseRecoveryReceipt: receipt });','    var next = Object.assign({}, opts || {}, { _responseRecoveryReceipt: receipt });\n    var originalOptions = JSON.stringify(optionKey(opts));');
  s=r(s,'      complete: function(value) { return receipt.request === request && jsonComplete(value); }','      matches: function() { return JSON.stringify(body) === request && JSON.stringify(optionKey(opts)) === originalOptions; },\n      complete: function(value) { return receipt.request === request && jsonComplete(value); }');
  s=r(s,"    return run('tools', [prompt, tools, optionKey(opts), compression], opts.signal, function() { return execute(opts); }, {", "    var descriptor = [prompt, tools, optionKey(opts), compression], encodedDescriptor = JSON.stringify(descriptor);\n    return run('tools', descriptor, opts.signal, function() { return execute(opts); }, {\n      matches: function() { return JSON.stringify([prompt, tools, optionKey(opts), typeof root.getCompressionParams === 'function' ? root.getCompressionParams() : null]) === encodedDescriptor; },");
  return r(s,"    return run('stream', [kind, payload, maxTokens, optionKey(opts), compression], opts.signal, function() { return execute(next); }, {", "    var descriptor = [kind, payload, maxTokens, optionKey(opts), compression], encodedDescriptor = JSON.stringify(descriptor);\n    return run('stream', descriptor, opts.signal, function() { return execute(next); }, {\n      matches: function() { return JSON.stringify([kind, payload, maxTokens, optionKey(opts), typeof root.getCompressionParams === 'function' ? root.getCompressionParams() : null]) === encodedDescriptor; },");
});
edit('web/scripts/smoke-turn-recovery-quality.js',(s,r)=>r(s,'(async()=>{',`test('a request edited during asynchronous lookup uses the edited request instead of stale cache',async()=>{
  const f=fixture();let calls=0;try{
    f.c.fetch=async(_url,opts)=>{calls++;return f.okay(f.response(JSON.parse(opts.body).messages[1].content));};
    const a=await f.begin();await f.request();f.rollback(a);await f.begin();const body=f.body(),real=f.c.crypto.subtle;
    f.c.crypto={subtle:{digest:async(...args)=>{const hash=await real.digest(...args);body.messages[1].content='New complete player instruction.';return hash;}}};
    const result=await f.request(body);assert.equal(result.choices[0].message.content,'New complete player instruction.');assert.equal(calls,2);
  }finally{f.dispose();}
});
(async()=>{`));
