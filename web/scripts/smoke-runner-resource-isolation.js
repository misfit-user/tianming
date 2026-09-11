#!/usr/bin/env node
'use strict';
// Executes the real runner with controlled child processes, not a copy of its scheduler.
const fs=require('fs'),path=require('path'),vm=require('vm'),cp=require('child_process'),assert=require('assert/strict'),{EventEmitter}=require('events');
const root=path.resolve(__dirname,'../..'),at=process.argv.indexOf('--source-ref'),ref=at>=0?process.argv[at+1]:null;
const source=ref?cp.execFileSync('git',['show',ref+':web/scripts/run-smokes.js'],{cwd:root,encoding:'utf8'}):fs.readFileSync(path.join(__dirname,'run-smokes.js'),'utf8');
const names=['smoke-a-normal.js','smoke-b-normal.js','smoke-full-turn-flow.js','smoke-workshop-lock-recovery.js'];
async function run(failName){
 const active=new Set(),seen=[],overlaps=[],watchdogs=[];let saved,normalPeak=0;
 return new Promise((resolve,reject)=>{
  const c={console:{log(){},error(){}},Date,Map,Set,Promise,JSON,__dirname,process:{argv:['node','run-smokes.js','--all','--no-retry'],execPath:process.execPath,exit(code){resolve({code,saved,seen,overlaps,normalPeak,watchdogs});}},
   setTimeout(fn,ms){watchdogs.push(ms);return setTimeout(fn,ms);},clearTimeout,
   require(name){
    if(name==='./lib-arch-guard')return{BASELINE_DIR:__dirname,REPORT_DIR:__dirname,loadJSON(){return{};},saveJSON(_p,report){saved=report;},rel:x=>x};
    if(name==='fs')return{readdirSync:()=>names.slice()};
    if(name==='os')return{cpus:()=>Array(10).fill({})};
    if(name==='child_process')return{execFileSync:()=> 'controlled-head',spawn(_cmd,args){
     const file=path.basename(args[0]),heavy=names.slice(2).includes(file);if((heavy&&active.size)||[...active].some(x=>names.slice(2).includes(x)))overlaps.push({file,active:[...active]});
     active.add(file);seen.push(file);if(!heavy)normalPeak=Math.max(normalPeak,active.size);
     const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>child.emit('close',1);
     setTimeout(()=>{active.delete(file);child.emit('close',file===failName?1:0);},heavy?4:12);return child;
    }};
    return require(name);
   }};
  try{vm.runInNewContext(source,c,{filename:'run-smokes.js'});}catch(e){reject(e);}
 });
}
(async()=>{
 const good=await run();assert.equal(good.code,0);assert.deepEqual(good.seen.slice().sort(),names);assert.deepEqual(good.overlaps,[],'hard-deadline checks must never overlap another smoke');assert.equal(good.normalPeak,2,'ordinary jobs must still run concurrently');assert.equal(good.saved.summary.selected,4);assert.equal(good.saved.summary.pass,4);assert.equal(good.saved.summary.skipped,0);assert(good.watchdogs.every(ms=>ms===120000),'original per-script hard deadline retained');
 console.log('PASS complete discovery, ordinary parallelism, exclusive barriers and original deadlines');
 const bad=await run(names[3]);assert.equal(bad.code,1);assert.equal(bad.saved.summary.fail,1);assert.equal(bad.seen.length,4,'no hidden retry under --no-retry');assert.equal(bad.saved.results.find(r=>r.name===names[3]).pass,false);assert.deepEqual(bad.overlaps,[]);
 console.log('PASS isolated failure remains red and is neither skipped nor silently retried');
})().catch(e=>{console.error(e);process.exitCode=1;});
