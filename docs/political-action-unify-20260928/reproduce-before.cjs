'use strict';
// Reuse the five real-module regression cases; only the module loader reads baseline Git blobs.
const fs=require('fs'),path=require('path'),cp=require('child_process'),vm=require('vm'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),base='ae4ba9c15cc58c21cf5fb322a8c195bdf26c8cbe',cache=new Map(),{politicalFixture}=require('../../web/scripts/lib-political-action-fixture');
function source(file){if(!cache.has(file)){const r=cp.spawnSync('git',['show',base+':web/'+file],{cwd:root,encoding:'utf8',maxBuffer:32*1024*1024});if(r.status&&file!=='tm-political-actions.js')throw Error(r.stderr);cache.set(file,r.status?'':r.stdout);}return cache.get(file);}
const current=fs.readFileSync(path.join(root,'web/scripts/smoke-political-action-unification.js'),'utf8'),end=current.indexOf("test('an authorized person appoints");assert(end>0);const lines=[];
vm.runInNewContext(current.slice(0,end)+"\nif(passed!==0||failed!==5)throw Error('Expected all five original regressions to fail on baseline');",{require(name){return name==='./lib-political-action-fixture'?{politicalFixture:()=>politicalFixture({source})}:require(name);},console:{log:s=>lines.push(s),error:s=>lines.push(s)}});
console.log(lines.join('\n'));console.log('CONFIRMED baseline exhibits five defects; these failures are not acceptance passes');
