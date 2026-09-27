'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto');
const digest=require('../../scripts/electron/full-graph-digest.cjs');
function serialize(value){const seen=new WeakMap();let id=0;return JSON.stringify(value,(_k,v)=>{if(v&&typeof v==='object'){if(seen.has(v))return {$ref:seen.get(v)};seen.set(v,id++);}return typeof v==='function'?String(v):v;});}
(async()=>{
 let checks=0;const same=(a,b)=>{assert.deepEqual(a,b);checks++;};
 const shared={value:7},root={unicode:'甲😀乙\ud800尾',shared,alias:shared,fn:function test(){return 1;}};root.self=root;
 for(const size of [2,3,7,16,1048576]){
  const full=serialize(root),result=JSON.parse(await digest(root,size)),parts=[];let start=0;
  same(result.codeUnits,full.length);
  for(const [end,hash]of result.chunks){const bytes=Buffer.from(full.slice(start,end),'utf8');assert.equal(hash,crypto.createHash('sha256').update(bytes).digest('hex'));parts.push(bytes);start=end;}
  same(Buffer.concat(parts),Buffer.from(full,'utf8'));same(start,full.length);
 }
 const first=await digest(root);same(await digest(root),first);
 shared.value=8;assert.notEqual(await digest(root),first);checks++;
 shared.value=7;root.alias={value:7};assert.notEqual(await digest(root),first);checks++;
 root.alias=shared;root.fn=function test(){return 2;};assert.notEqual(await digest(root),first);checks++;
 console.log('PASS full graph digest '+checks+' assertions: all bytes, references, functions and surrogate boundaries retained');
})().catch(e=>{console.error(e.stack);process.exitCode=1;});
