'use strict';
const assert=require('assert/strict');
const {fixture,copy,pause}=require('./lib-turn-response-recovery');
const tests=[];const test=(name,run)=>tests.push({name,run});
test('full JSON is reused after confirmed rollback without a second paid request',async()=>{
  const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return f.okay(f.response());};
    const a=await f.begin();assert.equal(f.R.status().state,'running');const first=await f.request();
    f.rollback(a);assert.equal(f.R.status().available,1);await f.begin();const second=await f.request();
    assert.equal(calls,1);assert.equal(JSON.stringify(second.choices),JSON.stringify(first.choices));assert.equal(second.usage,undefined);
    assert.equal(second._tmRecoveredResponse,true);assert.equal(f.R.status().hits,1);
  }finally{f.dispose();}
});
test('consumer mutations cannot damage the preserved response',async()=>{
  const f=fixture();try{
    f.c.fetch=async()=>f.okay(f.response('原始内容：任命官员，但数值仍需校验。'));
    const a=await f.begin();const first=await f.request();first.choices[0].message.content='consumer rewrite';
    f.rollback(a);await f.begin();assert.equal((await f.request()).choices[0].message.content,'原始内容：任命官员，但数值仍需校验。');
  }finally{f.dispose();}
});
test('successful calls in the same attempt are never merged into one response',async()=>{
  const f=fixture();let calls=0;try{
    f.c.fetch=async()=>f.okay(f.response('独立意见'+(++calls)));
    const a=await f.begin();const one=await f.request(),two=await f.request();assert.equal(calls,2);
    f.rollback(a);await f.begin();assert.equal(JSON.stringify((await f.request()).choices),JSON.stringify(one.choices));assert.equal(JSON.stringify((await f.request()).choices),JSON.stringify(two.choices));
    await f.request();assert.equal(calls,3);
  }finally{f.dispose();}
});
test('any change to prompt, output budget, schema or endpoint prevents reuse',async()=>{
  const changes=[b=>b.messages[1].content+=' Changed instruction.',b=>b.max_tokens++,b=>b.response_format={type:'json_object'},b=>b.tools=[{type:'function',function:{name:'new-tool'}}]];
  for(const change of changes){const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return f.okay(f.response());};const a=await f.begin();await f.request();f.rollback(a);await f.begin();
    const next=f.body();change(next);await f.request(next);assert.equal(calls,2);
  }finally{f.dispose();}}
});
test('changed world, model, mode or player options invalidate the entire recovery set',async()=>{
  const edits=[c=>{c.GM.treasury=999;},c=>{c.P.ai.model='other';},c=>{c.P.conf.agentModeEnabled=true;},c=>{c.P.conf.style='new style';}];
  for(const edit of edits){const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return f.okay(f.response());};const a=await f.begin();await f.request();f.rollback(a);edit(f.c);await f.begin();await f.request();assert.equal(calls,2);
  }finally{f.dispose();}}
});
test('a newly loaded identical world is not treated as the rolled-back instance',async()=>{
  const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return f.okay(f.response());};const a=await f.begin();await f.request();f.rollback(a);
    f.c.GM=copy(f.c.GM);await f.begin();await f.request();assert.equal(calls,2);
  }finally{f.dispose();}
});
test('validation errors, cancellations and uncertain persistence never arm recovery',async()=>{
  const errors=[Object.assign(Error('bad world'),{validity:{status:'failed'}}),Object.assign(Error('cancelled'),{code:'AI_ABORTED'}),Error('save returned false'),Object.assign(Error('bad JSON'),{name:'SyntaxError'})];
  for(const error of errors){const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return f.okay(f.response());};const a=await f.begin();await f.request();f.rollback(a,error);
    assert.equal(f.R.status().available,0);await f.begin();await f.request();assert.equal(calls,2);
  }finally{f.dispose();}}
});
test('length-truncated, filtered, refused and unconfirmed completions are not reusable',async()=>{
  for(const finish of ['length','content_filter',null]){const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return f.okay(f.response('未确认完整的内容',finish));};const a=await f.begin();await f.request();f.rollback(a);await f.begin();await f.request();assert.equal(calls,2);
  }finally{f.dispose();}}
});
test('long Chinese narrative is replayed byte-for-byte with no shortening',async()=>{
  const f=fixture(),text='完整因果、人物心理与历史叙事。🙂\n'.repeat(3000);try{
    f.c.fetch=async()=>f.okay(f.response(text));const a=await f.begin();await f.request();f.rollback(a);await f.begin();
    assert.equal((await f.request()).choices[0].message.content,text);
  }finally{f.dispose();}
});
test('oversized checkpoint is skipped rather than truncating the live response',async()=>{
  const f=fixture();let calls=0;const text='长'.repeat(f.R.limits.responseChars+1);try{
    f.c.fetch=async()=>{calls++;return f.okay(f.response(text));};const a=await f.begin();assert.equal((await f.request()).choices[0].message.content,text);
    f.rollback(a);await f.begin();assert.equal((await f.request()).choices[0].message.content,text);assert.equal(calls,2);
  }finally{f.dispose();}
});
test('lack of SHA-256 support leaves the original full request path intact',async()=>{
  const f=fixture();let calls=0;try{
    f.c.crypto=undefined;f.c.fetch=async()=>{calls++;return f.okay(f.response());};await f.begin();await f.request();await f.request();assert.equal(calls,2);
  }finally{f.dispose();}
});
test('committed turns and unconfirmed rollbacks cannot be replayed',async()=>{
  for(const outcome of ['committed','failed']){const f=fixture();try{
    f.c.fetch=async()=>f.okay(f.response());const a=await f.begin();await f.request();a.committed=outcome==='committed';f.R.finish(a,outcome,Object.assign(Error('timeout'),{code:'AI_TIMEOUT'}));
    assert.equal(f.R.status().available,0);
  }finally{f.dispose();}}
});
test('expiry, explicit discard and changed post-court choice prevent reuse',async()=>{
  for(const mode of ['expiry','discard','postCourt']){const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return f.okay(f.response());};const a=await f.begin({postTurnCourt:false});await f.request();f.rollback(a);
    if(mode==='expiry')f.c.Date={now:()=>Date.now()+f.R.limits.ttlMs+1000};
    if(mode==='discard')f.R.clear();
    await f.begin({postTurnCourt:mode==='postCourt'});await f.request();assert.equal(calls,2);
  }finally{f.dispose();}}
});
test('a changed wire request after context repair is not cached under the original prompt',async()=>{
  const f=fixture();let calls=0;try{
    f.c._aiRetryDelay=()=>1;f.c.fetch=async()=>++calls===1?{ok:false,status:400,headers:{get:()=>null},text:async()=> 'context_length_exceeded'}:f.okay(f.response());
    const a=await f.begin();await f.request(f.body(),{contextOverflowReducer:()=>({messages:[],max_tokens:8})});f.rollback(a);await f.begin();await f.request();assert.equal(calls,3);
  }finally{f.dispose();}
});
test('native Agent tool arguments survive recovery unchanged, without executing tools early',async()=>{
  const f=fixture();let calls=0;try{
    const defs=[{name:'adjust',parameters:{type:'object',properties:{amount:{type:'number'}}}}];
    f.c.fetch=async()=>{calls++;return f.okay({choices:[{message:{tool_calls:[{function:{name:'adjust',arguments:'{"amount":7}'}}]},finish_reason:'tool_calls'}]});};
    const a=await f.begin();const first=await f.c.callAIWithTools('Complete reasoning required.',defs,{maxTok:1000,timeoutMs:500});
    f.rollback(a,Object.assign(Error('agent failed'),{code:'agent-run-failed',meta:{transportFailure:{code:'tool-timeout'}}}));await f.begin();
    const second=await f.c.callAIWithTools('Complete reasoning required.',defs,{maxTok:1000,timeoutMs:500});assert.deepEqual(second,first);assert.equal(calls,1);
    assert.equal(f.c.GM.treasury,undefined);
  }finally{f.dispose();}
});
test('non-finite tool arguments are never silently converted into reusable null values',async()=>{
  const f=fixture();let calls=0;try{
    const defs=[{name:'inspect',parameters:{type:'object'}}];f.c.fetch=async()=>{calls++;return f.okay({choices:[{message:{tool_calls:[{function:{name:'inspect',arguments:'{"amount":1e999}'}}]},finish_reason:'tool_calls'}]});};
    const a=await f.begin();const original=await f.c.callAIWithTools('test',defs,{timeoutMs:500});assert.equal(original.toolCalls[0].input.amount,Infinity);
    f.rollback(a);await f.begin();const next=await f.c.callAIWithTools('test',defs,{timeoutMs:500});assert.equal(next.toolCalls[0].input.amount,Infinity);assert.equal(calls,2);
  }finally{f.dispose();}
});
test('uncacheable optional metadata does not suppress or repeat a normal request',async()=>{
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
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
