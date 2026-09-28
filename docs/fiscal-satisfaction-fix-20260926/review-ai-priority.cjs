'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..');
const {transport,load,okay}=require(path.join(root,'web/scripts/lib-turn-reliability.js'));
(async()=>{
 const f=transport(),queued=[],fetches=[];try{
  load(f.c,'tm-call-retry-policy.js');
  load(f.c,'tm-endturn-response-recovery.js');
  load(f.c,'tm-emergency-recovery-adapters.js');
  f.c._buildAIUrl=()=> 'https://fixture.invalid/v1/chat/completions';
  f.c.fetch=async(url,opts)=>{fetches.push({url,body:JSON.parse(opts.body)});return okay({choices:[{message:{content:'offline fixture'},finish_reason:'stop'}]});};
  const enqueue=f.c._aiQueue.enqueue.bind(f.c._aiQueue);
  f.c._aiQueue.enqueue=(task,priority,options)=>{queued.push({priority,signal:!!options?.signal,timeoutMs:options?.timeoutMs});return enqueue(task,priority,options);};
  const results=[];
  for(const [helper,priority,overload] of [['callAI','high',false],['callAIMessages','critical',false],['callAI','background',true],['callAIMessages','low',true],['callAI',undefined,false],['callAIMessages',undefined,false]]){
   const opts={maxRetries:0,timeoutMs:500,priority},args=helper==='callAI'?['test prompt',32,null]:[[{role:'user',content:'test message'}],32,null];
   if(overload)args.push({...opts,tier:'primary'});else args.push('primary',opts);
   const out=await f.c[helper](...args);assert.equal(out,'offline fixture');assert.equal(queued.at(-1).priority,priority||'normal');results.push({helper,requested:priority||'(default)',overload,queued:queued.at(-1).priority});
  }
  assert.equal(fetches.length,6);
  const infra=fs.readFileSync(path.join(root,'web/tm-ai-infra-retry.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'web/tm-ai-infra.js'),'utf8');
  const report={existingRegexMatches:/priority:\s*opts\.priority/.test(infra),results,fetches:fetches.length,network:'fetch is an in-memory synthetic response; no network call'};
  fs.writeFileSync(path.join(__dirname,'review-ai-priority.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
 }finally{f.dispose();}
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
