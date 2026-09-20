'use strict';
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {functionSource}=require('./lib-perf-round1');
const root=path.resolve(__dirname,'../..');
const source=fs.readFileSync(path.join(root,'web/phase8-formal-map.js'),'utf8');
let passed=0,failed=0;
function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.message);}}
const context={console};vm.createContext(context);
vm.runInContext(['pushUniqueValue','regionNameKeys','firstValue','hasValue','liveRegionOwner'].map(n=>functionSource(source,n)).join('\n'),context);
function reference(r){
 const data=Object.assign({},r&&r.admin||{},r&&r.data||{}),out=[];
 const keys=r&&r.sourceProvinceId&&r.id!==r.sourceProvinceId&&Array.isArray(r.accountingLeafIds)?[r.id,r.adminBinding,r.name,data.id,data.name]:[r&&r.id,r&&r.name,r&&r.title,r&&r.officialName,r&&r.sourceId,r&&r.mapRegionId,r&&r.adminBinding,data.id,data.name,data.title,data.officialName,data.province,data.provinceName,data.adminName,data.regionName];
 keys.forEach(v=>context.pushUniqueValue(out,v));return out;
}
check('lookup precedence and empty values remain unchanged',()=>{
 const cases=[null,{}, {id:0,name:false}, {id:'a',name:'a',data:{name:' A ',province:'省'}}, {admin:{id:'admin',name:'甲'},data:{id:undefined,name:null}}, {data:Object.create({id:'inherited'})}, {admin:Object.defineProperty({name:'乙'},'id',{value:'hidden'})}, {id:'leaf',name:'县',sourceProvinceId:'parent',accountingLeafIds:[],adminBinding:'live',admin:{id:'a',name:'甲',province:'省'}}];
 for(const r of cases)assert.deepEqual(Array.from(context.regionNameKeys(r)),reference(r));
});
check('official scenario lookup results match the previous rule',()=>{
 for(const file of fs.readdirSync(path.join(root,'scenarios')).filter(n=>n.endsWith('（官方）.json'))){
  const sc=JSON.parse(fs.readFileSync(path.join(root,'scenarios',file),'utf8')),map=sc.mapData?.regions?.length?sc.mapData:sc.map;
  for(const r of map?.regions||[])assert.deepEqual(Array.from(context.regionNameKeys(r)),reference(r),file+':'+r.id);
 }
});
check('unrelated data fields are not read during name lookup',()=>{
 let reads=0;const data={id:'x',name:'县'};
 Object.defineProperty(data,'largeLedger',{enumerable:true,get(){reads++;return [];}});
 for(let i=0;i<100;i++)assert.deepEqual(Array.from(context.regionNameKeys({data})),['x','县']);assert.equal(reads,0);
});
check('owner precedence and sentinel values remain unchanged',()=>{
 for(const a of ['',null,undefined,0,false,'first'])for(const b of ['',null,undefined,0,false,'second'])for(const c of ['',null,undefined,0,false,'third']){
  let bCalls=0,cCalls=0;context.liveOwnerFromProvinceMap=()=>a;context.ownerFromRecord=r=>r.value;
  context.findLiveProvinceStats=()=>{bCalls++;return{value:b};};context.findLiveAdminDivision=()=>{cCalls++;return{value:c};};
  assert.equal(context.liveRegionOwner({}),context.firstValue(a,b,c));
  if(context.hasValue(a)){assert.equal(bCalls,0);assert.equal(cCalls,0);}else if(context.hasValue(b))assert.equal(cCalls,0);
 }
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
