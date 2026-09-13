#!/usr/bin/env node
'use strict';
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict');
const {functionSource}=require('./lib-perf-round1');
const root=path.resolve(__dirname,'../..'),at=process.argv.indexOf('--source-ref'),ref=at>=0?process.argv[at+1]:null;
const source=ref?cp.execFileSync('git',['show',ref+':web/tm-ai-infra-model-detect.js'],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(root,'web/tm-ai-infra-model-detect.js'),'utf8');
const fn=functionSource(source,'getModelContextSizeK');let pass=0,fail=0;
function test(name,fn){try{fn();pass++;console.log('PASS '+name);}catch(e){fail++;console.error('FAIL '+name+': '+e.message);}}
function read(conf={},model='relay-new',url='https://relay.invalid/v1',known=0){const c={P:{conf,ai:{model,url}},_matchModelCtx:()=>known};vm.createContext(c);vm.runInContext(fn,c);const before=JSON.stringify(c.P);const result=c.getModelContextSizeK();assert.equal(JSON.stringify(c.P),before,'query must not modify settings');return result;}
test('manual low window remains authoritative, not silently enlarged',()=>assert.equal(read({contextSizeK:4,_detectedContextK:128},undefined,undefined,128),4));
test('manual numeric strings normalize without altering persisted settings',()=>assert.equal(read({contextSizeK:'64'}),64));
test('current model and endpoint may use their own detected small window',()=>assert.equal(read({_detectedContextK:4,_ctxCacheKey:'relay-new@https://relay.invalid/v1'}),4));
test('switching an unknown relay model cannot inherit old 4K detection',()=>assert.equal(read({_detectedContextK:4,_ctxCacheKey:'relay-old@https://relay.invalid/v1'}),32));
test('same model on another endpoint cannot inherit old capacity',()=>assert.equal(read({_detectedContextK:1024,_ctxCacheKey:'relay-new@https://other.invalid/v1'}),32));
test('legacy unowned detection is not treated as current model evidence',()=>assert.equal(read({_detectedContextK:4}),32));
test('valid identified detection and catalog retain the existing larger-known-window rule',()=>{assert.equal(read({_detectedContextK:64,_ctxCacheKey:'relay-new@https://relay.invalid/v1'},undefined,undefined,128),128);assert.equal(read({_detectedContextK:200,_ctxCacheKey:'relay-new@https://relay.invalid/v1'},undefined,undefined,128),200);});
test('invalid nonfinite and negative values cannot poison prompt/compression budgets',()=>{for(const value of [Infinity,'Infinity',NaN,-4,'bad'])assert.equal(read({contextSizeK:value,_detectedContextK:value,_ctxCacheKey:'relay-new@https://relay.invalid/v1'}),32);});
test('secondary detections never become primary prompt capacity',()=>assert.equal(read({_detectedContextK_secondary:4,_ctxCacheKey_secondary:'relay-new@https://relay.invalid/v1'}),32));
test('a new context-only probe cannot relabel the previous model output cap',()=>{const c={P:{conf:{_ctxCacheKey:'old@url',_detectedMaxOutput:1000,_detectedMaxOutput_secondary:2000}},_ctxLog(){},_persistProbeConf(){}};vm.createContext(c);vm.runInContext(functionSource(source,'_finishDetect'),c);c._finishDetect(128,'catalog','new@url',0,'primary');assert.equal(c.P.conf._detectedMaxOutput,0);assert.equal(c.P.conf._detectedMaxOutput_secondary,2000);c._finishDetect(128,'probe','new@url',8192,'primary');c._finishDetect(128,'catalog','new@url',0,'primary');assert.equal(c.P.conf._detectedMaxOutput,8192);});
test('end-turn output uses only current model detection and preserves manual output',()=>{const file='web/tm-endturn-ai.js',src=ref?cp.execFileSync('git',['show',ref+':'+file],{cwd:root,encoding:'utf8',maxBuffer:2e6}):fs.readFileSync(path.join(root,file),'utf8');const c={P:{conf:{_detectedMaxOutput:1000,_ctxCacheKey:'old@url'},ai:{model:'new',url:'url'}},_tokCp:{contextK:128}};vm.createContext(c);vm.runInContext(functionSource(src,'_getEffectiveOutputLimit'),c);assert.equal(c._getEffectiveOutputLimit(),16384);c.P.conf._ctxCacheKey='new@url';assert.equal(c._getEffectiveOutputLimit(),1000);c.P.conf.maxOutputTokens='8000';assert.equal(c._getEffectiveOutputLimit(),8000);});
console.log(JSON.stringify({PASS:pass,FAIL:fail,SKIP:0,WAIVED:0,sourceRef:ref||'worktree'}));process.exitCode=fail?1:0;
