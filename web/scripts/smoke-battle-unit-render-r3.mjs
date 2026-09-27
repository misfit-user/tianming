import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import assert from 'node:assert/strict';import {fileURLToPath} from 'node:url';
const root=process.env.TM_RENDER_TEST_ROOT||path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=fs.readFileSync(process.env.TM_UNIT_CANDIDATE||path.join(root,'web/battle/unit-render.js'),'utf8');
// Reconstruct the immediately preceding algorithm for differential verification.
const reference=source.replace('function add(kind,lod,x,y,angle,scale,tint,phase,am,cf,sf){','function add(kind,lod,x,y,angle,scale,tint,phase,am){')
 .replace('const z=ex*o.heightAt(x,y);if(cf===undefined){cf=Math.cos(angle-Math.PI/2);sf=Math.sin(angle-Math.PI/2);}','const z=ex*o.heightAt(x,y),cf=Math.cos(angle-Math.PI/2),sf=Math.sin(angle-Math.PI/2);')
 .replace('instance.x=x;instance.y=y;instance.z=z;instance.cf=cf;instance.sf=sf;instance.s=scale;instance.t=tint;instance.ph=phase;instance.am=am;','Object.assign(instance,{x,y,z,cf,sf,s:scale,t:tint,ph:phase,am});')
 .replace('const cf=Math.cos(u.facing-Math.PI/2),sf=Math.sin(u.facing-Math.PI/2);\n      ','')
 .replace('38*zMul,tint,now*.005,am,cf,sf);','38*zMul,tint,now*.005,am);')
 .replace('tint,now*.0065+(m.ph||i)*1.3,am,cf,sf);','tint,now*.0065+(m.ph||i)*1.3,am);');
assert.notEqual(source,reference,'optimized implementation must be present');
let passed=0,failed=0;function check(name,fn){try{fn();passed++;console.log('PASS '+name);}catch(e){failed++;console.error('FAIL '+name+': '+e.stack);}}
const kinds=['spear','bow','musket','heavy','horse','general','cannon'];
function fixture(n=36,men=30){return Array.from({length:n},(_,i)=>({id:i,alive:i%13!==12,hidden:i%9===8,side:i%2?'jin':'ming',kind:kinds[i%7],_hero:i%11===0,emperor:i===0,x:i*17-50,y:i*7,facing:i*.123,soldiers:350+i*25,tx:i%3?null:0,ty:0,_inMelee:i%5===4,state:i%6===5?'rout':'stand',_men:Array.from({length:men},(_,j)=>({x:i*17-50+j*.17,y:i*7+j*.3,ph:j*.2}))}));}
function harness(code){const counts={sin:0,cos:0},math=Object.create(Math);for(const k of ['sin','cos'])math[k]=x=>{counts[k]++;return Math[k](x);};
 const window={TMBattleUnitAssets:{kindFor:u=>u.kind,generate:()=>({})},TMBattleShadows:{},TMBattleUnitVisibility:{bounds:()=>({x:.5,y:1,z:.2,r:2}),visible:(f,x,y,z,r)=>!f.clip||(x+r>0&&x-r<300&&y+r>0&&z-r<100)}};
 vm.runInNewContext(code,{window,Math:math,Map,Object,Number});return{api:window.TMBattleUnitRenderer,counts};}
function options(extra={}){return{quality:'balanced',EX:1.37,cam:{x:100,y:100,zoom:.2},now:1500,W:800,H:600,project:(x,y,z=0)=>({x:x+100,y:y+100-z*.25}),heightAt:(x,y)=>Math.sin(x*.01)*Math.cos(y*.01)*20,corpses:[{x:5,y:9,a:.2}],dying:[{x:20,y:7,ff:1}],...extra};}
const plain=v=>JSON.parse(JSON.stringify(v));
check('all generated instance fields and ordering match across LOD, frustum, quality and animation states',()=>{
 for(const zoom of [.02,.08,.2,.8,1.3])for(const quality of ['low','balanced','high'])for(const impostors of [false,true])for(const frustum of [null,{clip:false},{clip:true}]){
 const a=harness(reference),b=harness(source),u=fixture(),before=JSON.stringify(u),o=options({quality,impostors,frustum,cam:{x:100,y:100,zoom}});assert.deepEqual(plain(b.api.instances(u,o)),plain(a.api.instances(u,o)));assert.equal(JSON.stringify(u),before);assert.deepEqual(plain(b.api.lastInstances),plain(a.api.lastInstances));}
});
check('second frame refreshes every pooled field after movement, casualties, facing and side changes',()=>{
 const a=harness(reference),b=harness(source),u=fixture(),o=options();a.api.instances(u,o);b.api.instances(u,o);for(const v of u){v.x+=31;v.y-=20;v.facing+=1;v.side=v.side==='ming'?'jin':'ming';v._men.pop();v._men.forEach(m=>{m.x+=7;m.y-=11;});}o.now+=437;assert.deepEqual(plain(b.api.instances(u,o)),plain(a.api.instances(u,o)));
});
check('global live/dead visual budgets, leader priority and large rosters remain identical',()=>{
 const u=fixture(180,80),o=options({frustum:{clip:false},corpses:Array.from({length:2400},(_,i)=>({x:100,y:100,a:i*.02})),dying:[]}),a=harness(reference),b=harness(source);
 assert.deepEqual(plain(b.api.instances(u,o)),plain(a.api.instances(u,o)));assert.equal(b.api.lastInstances.count,8000);
});
check('unchanged frames reuse the same allocated instance objects',()=>{
 const b=harness(source),u=fixture(),o=options(),first=b.api.instances(u,o),refs=Object.fromEntries(Object.entries(first).map(([k,v])=>[k,v.slice()]));const second=b.api.instances(u,o);
 for(const [k,arr]of Object.entries(refs))arr.forEach((v,i)=>assert.equal(second[k][i],v));
});
check('shared troop facing replaces per-soldier trigonometry without reducing troop count',()=>{
 const u=Array.from({length:100},(_,i)=>({id:i,alive:true,side:'ming',kind:'spear',x:10,y:10,facing:i*.03,soldiers:1000,_men:Array.from({length:60},(_,j)=>({x:10+j*.1,y:10,ph:j*.2}))})),o=options({frustum:{clip:false},corpses:[],dying:[]}),a=harness(reference),b=harness(source);
 assert.deepEqual(plain(b.api.instances(u,o)),plain(a.api.instances(u,o)));assert.equal(b.api.lastInstances.count,6000);assert.deepEqual(a.counts,{sin:6000,cos:6000});assert.deepEqual(b.counts,{sin:100,cos:100});console.log('FACING_TRIG '+JSON.stringify({soldiers:6000,old:a.counts,next:b.counts}));
});
console.log(JSON.stringify({passed,failed}));process.exitCode=failed?1:0;
