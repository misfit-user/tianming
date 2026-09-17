#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const {functionSource}=require('./lib-perf-round1');
const root=path.resolve(__dirname,'../..'),at=process.argv.indexOf('--source-ref'),ref=at>=0?process.argv[at+1]:null;
const read=p=>ref?cp.execFileSync('git',['show',ref+':web/'+p],{cwd:root,encoding:'utf8',maxBuffer:2e6}):fs.readFileSync(path.join(root,'web',p),'utf8');
const json=read('tm-ai-infra-json.js'),retry=ref?'':read('tm-ai-infra-retry.js'),infra=read('tm-ai-infra.js'),cal=read('tm-party-class-llm-calibrator.js');
let pass=0,fail=0;async function test(name,fn){try{await fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+': '+e.message);}}
function fixture(message,finish='stop'){
 const sent=[],c={console:{warn(){},log(){},error(){}},AbortController,setTimeout,clearTimeout,P:{ai:{key:'synthetic-only',url:'https://fixture.invalid/v1',model:'fixture'},conf:{}},GM:{turn:2},localStorage:{getItem(){return null;}},
 _buildAIUrl:()=> 'https://fixture.invalid/v1',fetch:async(_u,opts)=>{sent.push(JSON.parse(opts.body));return{ok:true,status:200,headers:{get(){return null;}},json:async()=>({choices:[{message,finish_reason:finish}]})};}};
 c.global=c;c.window=c;vm.createContext(c);vm.runInContext(json+'\n'+retry+'\n'+infra,c);c._aiQueue.enqueue=fn=>fn();vm.runInContext(functionSource(cal,'callCalibrationLlm')+'\n'+functionSource(cal,'extractJson'),c);
 return{c,sent,call:()=>c.callCalibrationLlm([{role:'system',content:'完整规则'},{role:'user',content:'完整原文😀'}],{tier:'primary',maxTokens:1800})};
}
(async()=>{
 await test('complete string JSON and prompt/output settings remain unchanged',async()=>{const raw='{"notes":["原文😀"]}',f=fixture({content:raw});const r=await f.call();assert.equal(r.text,raw);assert.equal(f.sent.length,1);assert.equal(f.sent[0].max_tokens,1800);assert.equal(f.sent[0].messages[0].content,'完整规则');assert.equal(f.sent[0].messages[1].content,'完整原文😀');assert.equal(f.c.extractJson(r.text).notes[0],'原文😀');});
 await test('valid segmented text JSON is decoded without including thought blocks',async()=>{const f=fixture({content:[{type:'thinking',text:'不可用于修改的思考'},{type:'text',text:'{"notes":['},{type:'output_text',text:'"分段结果"]}'}]});const r=await f.call();assert.equal(r.text,'{"notes":["分段结果"]}');assert.equal(f.c.extractJson(r.text).notes[0],'分段结果');assert.equal(f.sent.length,1);});
 for(const [name,message,finish,code]of [['reasoning only',{content:'',reasoning_content:'尚未决定'},'stop','ai-text-reasoning-only'],['truncated but syntactically valid JSON',{content:'{"notes":[]}'},'length','ai-text-truncated'],['refusal',{content:'{"notes":[]}',refusal:'refused'},'stop','ai-text-refused']])await test(name+' cannot become a completed calibration',async()=>{const f=fixture(message,finish);await assert.rejects(f.call(),e=>e.code===code);assert.equal(f.sent.length,1);});
 await test('real prose remains a JSON validation failure rather than invented decisions',async()=>{const f=fixture({content:'这次没有提供修改 JSON。'});const r=await f.call();assert.equal(f.c.extractJson(r.text),null);});
 console.log(JSON.stringify({PASS:pass,FAIL:fail,SKIP:0,WAIVED:0,sourceRef:ref||'worktree'}));process.exitCode=fail?1:0;
})();
