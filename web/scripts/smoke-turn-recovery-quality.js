'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm'),acorn=require('acorn');
const {fixture,copy,pause,load,ROOT}=require('./lib-turn-response-recovery');
const tests=[];const test=(name,run)=>tests.push({name,run});
test('finalized SC1 stream content is restored without shortening or changing the wire budget',async()=>{
  const f=fixture(),wire=[],text='完整正文：人物动机、制度约束和决策后果。\n'.repeat(500);let chunks=0;
  try{
    f.c.fetch=async(_url,opts)=>{wire.push(JSON.parse(opts.body));return f.okay(f.response(text));};
    const body=f.body(),before=JSON.stringify(body),a=await f.begin();
    assert.equal(await f.c.callAIBodyStream(body,{timeoutMs:500,onChunk(){chunks++;}}),text);
    f.rollback(a);await f.begin();assert.equal(await f.c.callAIBodyStream(body,{timeoutMs:500,onChunk(){chunks++;}}),text);
    assert.equal(wire.length,1);assert.equal(JSON.stringify(body),before);assert.equal(wire[0].max_tokens,body.max_tokens);assert.equal(chunks,2);
    delete wire[0].stream;assert.equal(JSON.stringify(wire[0]),before);
  }finally{f.dispose();}
});
function sse(f,finish,done=true){
  const content='完整中文叙事。';const lines=['data: '+JSON.stringify({choices:[{delta:{content}}]})+'\n'];
  if(finish)lines.push('data: '+JSON.stringify({choices:[{delta:{},finish_reason:finish}]})+'\n');
  if(done)lines.push('data: [DONE]\n');let index=0;
  return {ok:true,status:200,headers:{get:()=> 'text/event-stream'},body:{getReader:()=>({read:async()=>index<lines.length?{done:false,value:new TextEncoder().encode(lines[index++])}:{done:true},cancel:async()=>{},releaseLock(){}})}};
}
test('unconfirmed or truncated SSE output is never reused as a complete answer',async()=>{
  for(const [finish,done] of [[null,false],['length',true]]){const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return sse(f,finish,done);};const a=await f.begin();await f.c.callAIBodyStream(f.body(),{timeoutMs:500});
    f.rollback(a);await f.begin();await f.c.callAIBodyStream(f.body(),{timeoutMs:500});assert.equal(calls,2);
  }finally{f.dispose();}}
});
test('confirmed SSE output and normal non-finalized message streams retain all text',async()=>{
  const f=fixture();let calls=0;try{
    f.c.fetch=async()=>{calls++;return sse(f,'stop',true);};const a=await f.begin();
    const first=await f.c.callAIMessagesStream([{role:'user',content:'Complete narrative'}],2048,{timeoutMs:500});
    f.rollback(a);await f.begin();const second=await f.c.callAIMessagesStream([{role:'user',content:'Complete narrative'}],2048,{timeoutMs:500});
    assert.equal(second,first);assert.equal(calls,1);
  }finally{f.dispose();}
});
test('reused proposals require completed main narrative while optional prose may be deferred',async()=>{
  const f=fixture();let validations=0;try{
    load(f.c,'tm-endturn-validity.js');f.c.fetch=async()=>f.okay(f.response('{"turn_summary":"valid structured proposal"}'));
    const a=await f.begin();await f.request();f.rollback(a);await f.begin();const result=await f.request();
    const parsed=JSON.parse(result.choices[0].message.content);validations++;
    const check=f.c.TM.Endturn.Validity.validateBeforeCommit({results:{sc1:parsed,aiResult:{shizhengji:'完整时政记',zhengwen:''}}});
    assert.equal(check.status,'degraded');assert(check.warnings.some(w=>w.includes('辅助正文未完成')));assert.equal(validations,1);
    const missing=f.c.TM.Endturn.Validity.validateBeforeCommit({results:{sc1:parsed,aiResult:{shizhengji:'',zhengwen:''}}});assert.equal(missing.status,'failed');assert(missing.reasons.includes('时政记为空或为失败文本'));
  }finally{f.dispose();}
});
test('cancellation or configuration change during lookup cannot publish a stale cache hit',async()=>{
  const f=fixture();try{
    f.c.fetch=async()=>f.okay(f.response());const a=await f.begin();await f.request();f.rollback(a);await f.begin();
    const real=f.c.crypto.subtle;f.c.crypto={subtle:{digest:async(...args)=>{const answer=await real.digest(...args);f.c.P.ai.model='changed-during-lookup';return answer;}}};
    await assert.rejects(f.request(),e=>e.code==='AI_STALE_WORLD');
  }finally{f.dispose();}
});
function installFunction(c,file,name){const text=fs.readFileSync(path.join(ROOT,file),'utf8');const ast=acorn.parse(text,{ecmaVersion:'latest'});const node=ast.body.find(n=>n.type==='FunctionDeclaration'&&n.id.name===name);assert(node,name);vm.runInContext(text.slice(node.start,node.end),c,{filename:file+':'+name});}
test('actual core rollback/retry reruns validators and commits a mutation only once',async()=>{
  const f=fixture(),c=f.c;let mainCalls=0,proseCalls=0,validations=0,saves=0,applies=0,rendered='';
  try{
    c.GM.treasury=100;
    c._$=()=>null;c.toast=()=>{};c.showLoading=()=>{};c.hideLoading=()=>{};
    c._tmRequestEndTurnDesktopAutoSaveFlush=()=>{};c.EndTurnHooks={execute:async()=>{}};
    c._tmCaptureEndTurnTransaction=()=>f.capture();c._tmCapturePreEndTurnCommittedState=t=>({GM:t.gm.data,P:t.p.data});
    c._tmPrepareEndTurnBoundary=async()=>true;c._buildSaveState=()=>({});c._endTurn_aiInfer=async()=>{};
    c._tmRollbackEndTurnTransaction=(t,e)=>{f.rollback(t,e,false);return true;};
    c._tmEndTurnTransactionCurrent=t=>!t.rolledBack&&!t.committed&&c.GM===t.gmRef&&c.P===t.pRef;
    c._tmRunEndTurnDeterministicTail=async()=>{c.GM.turn++;};
    c._endTurn_saveSnapshot=async()=>{saves++;assert.equal(c.GM.treasury,107);return true;};
    c._endTurn_render=p=>{rendered=p.zhengwen;};
    load(c,'tm-endturn-validity.js');
    c.fetch=async(_url,options)=>{const prompt=JSON.parse(options.body).messages[0].content;
      if(prompt==='main'){mainCalls++;return f.okay(f.response('{"treasuryDelta":7,"reason":"approved calculation"}'));}
      proseCalls++;if(proseCalls===1)return {ok:false,status:503,headers:{get:()=>null},text:async()=> 'temporary fixture outage'};
      return f.okay(f.response('完整长正文：不省略人物心理、因果与事件结果。'));
    };
    c.TM.Endturn.Pipeline={buildCtx:()=>({meta:{},results:{}}),run:async ctx=>{
      const raw=await f.request({model:c.P.ai.model,messages:[{role:'user',content:'main'}],max_tokens:4096});
      const sc1=JSON.parse(raw.choices[0].message.content);c.GM.treasury+=sc1.treasuryDelta;applies++;
      const prose=await f.request({model:c.P.ai.model,messages:[{role:'user',content:'prose'}],max_tokens:4096});
      const text=prose.choices[0].message.content;ctx.results={sc1,aiResult:{shizhengji:'完整时政记',zhengwen:text}};
      validations++;const check=c.TM.Endturn.Validity.validateBeforeCommit(ctx);if(check.status==='failed')throw new c.TM.Endturn.Validity.EndturnInvalidResultError(check);
      ctx.meta.turnPresentation=ctx.results.aiResult;
    }};
    for(const name of ['_tmCommitEndTurnTransaction','_tmFinalizeEndTurnTransaction','_endTurnCore'])installFunction(c,'tm-endturn-core.js',name);
    await c._endTurnCore({});assert.equal(c.GM.treasury,100);assert.equal(c.GM.turn,1);assert.equal(saves,0);assert.equal(f.R.status().available,1);
    await c._endTurnCore({});assert.equal(c.GM.treasury,107);assert.equal(c.GM.turn,2);assert.equal(saves,1);
    assert.equal(mainCalls,1);assert.equal(proseCalls,2);assert.equal(applies,2);assert.equal(validations,1);
    assert.equal(rendered,'完整长正文：不省略人物心理、因果与事件结果。');assert.equal(f.R.status().state,'committed');
  }finally{f.dispose();}
});
test('cache status exposes counts rather than prompts, answers or credentials',async()=>{
  const f=fixture();try{
    f.c.fetch=async()=>f.okay(f.response('PRIVATE_ANSWER'));const a=await f.begin();await f.request();f.rollback(a);
    const out=JSON.stringify(f.R.status());assert(!out.includes('PRIVATE_ANSWER'));assert(!out.includes('fixture-only'));assert(!out.includes('Full world reasoning'));
  }finally{f.dispose();}
});
test('cached stream callbacks stop when onChunk changes the world',async()=>{
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
test('a request edited during asynchronous lookup uses the edited request instead of stale cache',async()=>{
  const f=fixture();let calls=0;try{
    f.c.fetch=async(_url,opts)=>{calls++;return f.okay(f.response(JSON.parse(opts.body).messages[1].content));};
    const a=await f.begin();await f.request();f.rollback(a);await f.begin();const body=f.body(),real=f.c.crypto.subtle;
    f.c.crypto={subtle:{digest:async(...args)=>{const hash=await real.digest(...args);body.messages[1].content='New complete player instruction.';return hash;}}};
    const result=await f.request(body);assert.equal(result.choices[0].message.content,'New complete player instruction.');assert.equal(calls,2);
  }finally{f.dispose();}
});
(async()=>{let pass=0,fail=0;for(const t of tests){try{await t.run();pass++;console.log('PASS '+t.name);}catch(e){fail++;console.error('FAIL '+t.name+'\n'+e.stack);}}console.log(JSON.stringify({pass,fail,total:tests.length}));if(fail)process.exitCode=1;})();
