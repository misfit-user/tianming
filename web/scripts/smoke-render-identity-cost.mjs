import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import lib from './lib-perf-round1.js';
const source = fs.readFileSync(process.env.TM_MAP_SOURCE || new URL('../phase8-formal-map.js', import.meta.url), 'utf8');
const c = {}; vm.createContext(c);
for (const name of ['pushUniqueValue','regionNameKeys','hasValue','ownerFromRecord','firstValue','liveRegionOwner']) vm.runInContext(lib.functionSource(source, name), c);
let passed=0, failed=0;
function check(name, fn) { try { fn(); passed++; console.log('PASS '+name); } catch(e) { failed++; console.error('FAIL '+name+': '+e.message); } }
function expected(r) {
  const d=Object.assign({},r?.admin||{},r?.data||{}),out=[];
  const raw=r?.sourceProvinceId&&r.id!==r.sourceProvinceId&&Array.isArray(r.accountingLeafIds)?[r.id,r.adminBinding,r.name,d.id,d.name]:[r?.id,r?.name,r?.title,r?.officialName,r?.sourceId,r?.mapRegionId,r?.adminBinding,d.id,d.name,d.title,d.officialName,d.province,d.provinceName,d.adminName,d.regionName];
  raw.forEach(v=>c.pushUniqueValue(out,v));return out;
}
const fixtures=[null,{}, {id:'a',name:'同名',data:{name:'同名',province:'省'}},{admin:{name:'旧',province:'旧省'},data:{name:undefined,province:null}},{id:'leaf',name:'县',sourceProvinceId:'p',accountingLeafIds:[],adminBinding:'bound',data:{province:'不可回退'}}];
for(const r of fixtures) check('identity parity '+JSON.stringify(r),()=>assert.deepEqual(Array.from(c.regionNameKeys(r)),expected(r)));
check('mutations and duplicate IDs remain visible',()=>{
 const a={id:'x',data:{name:'before'}},b={id:'x',data:{name:'other'}};
 c.regionNameKeys(a);a.data.name='after';assert.deepEqual(Array.from(c.regionNameKeys(a)),expected(a));assert.deepEqual(Array.from(c.regionNameKeys(b)),expected(b));
});
check('unrelated payload is not copied during identity lookup',()=>{
 let reads=0;const data={name:'城'};
 Object.defineProperty(data,'unused',{enumerable:true,get(){reads++;return 'payload';}});
 for(let i=0;i<60;i++)c.regionNameKeys({id:'x',data});assert.equal(reads,0);
});
check('inherited and hidden values preserve merge semantics',()=>{
 const data=Object.create({name:'inherited'});Object.defineProperty(data,'province',{value:'hidden'});
 const r={admin:{name:'own',province:'visible'},data};assert.deepEqual(Array.from(c.regionNameKeys(r)),expected(r));
});
for(const value of ['',null,undefined,0,false,'owner'])check('owner precedence '+String(value),()=>{
 c.liveOwnerFromProvinceMap=()=>value;c.findLiveProvinceStats=()=>({owner:'fallback'});c.findLiveAdminDivision=()=>({owner:'admin'});
 assert.equal(c.liveRegionOwner({}),c.firstValue(value,'fallback','admin'));
});
check('resolved owner does not query unused fallbacks',()=>{
 c.liveOwnerFromProvinceMap=()=> 'owner';c.findLiveProvinceStats=()=>{throw Error('unused stats');};c.findLiveAdminDivision=()=>{throw Error('unused hierarchy');};assert.equal(c.liveRegionOwner({}),'owner');
});
for(const name of ['天启七年·九月（官方）.json','绍宋·建炎元年八月（官方）.json','晚唐·开成五年（官方）.json'])check('official identity parity '+name,()=>{
 const s=JSON.parse(fs.readFileSync(new URL('../../scenarios/'+name,import.meta.url),'utf8')),m=s.mapData?.regions?.length?s.mapData:s.map;
 assert(m.regions.length);for(const r of m.regions)assert.deepEqual(Array.from(c.regionNameKeys(r)),expected(r));
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
