'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),A=require('../battle/unit-assets.js'),I=require('../battle/unit-impostors.js');
assert.equal(I.create({getExtension:()=>null},()=>{throw Error('unsupported GPU must keep meshes');}),null);
assert(I.COLS*I.TILE*Math.ceil(A.kinds.length*I.VIEWS*I.POSES/I.COLS)*I.TILE*10<40*1024*1024);
let points=0;
for(const kind of A.kinds){const m=A.generate(kind,1),s=I.shape(m);assert(s.w>0&&s.h>0);for(let view=0;view<I.VIEWS;view++){const yaw=view/I.VIEWS*Math.PI*2,b=I.matrix(s,yaw);assert(b.every(Number.isFinite));assert(Math.abs(b[6]*0+b[10]*s.z+b[14])<1e-6);for(let k=0;k<m.vertices.length;k+=11){const x=m.vertices[k],y=-m.vertices[k+2],z=m.vertices[k+1];for(let j=0;j<3;j++){const v=b[j]*x+b[4+j]*y+b[8+j]*z+b[12+j];assert(Math.abs(v)<=1.00001,kind+' atlas clips its source mesh');}points++;}}}
for(let i=-100;i<100;i++){assert(I.viewIndex(Math.cos(i),Math.sin(i),i/3)>=0&&I.viewIndex(Math.cos(i),Math.sin(i),i/3)<8);assert.equal(I.poseIndex(i,0),0);assert(I.poseIndex(i,.28)>=1&&I.poseIndex(i,.28)<=4);assert(I.poseIndex(i,.9)>=5&&I.poseIndex(i,.9)<=8);}
const scope={window:{TMBattleUnitAssets:A,TMBattleShadows:{}},console};vm.runInNewContext(fs.readFileSync(require.resolve('../battle/unit-render.js'),'utf8'),scope);
const units=A.kinds.filter(k=>k!=='dead').map((sub,i)=>({id:i,sub,_hero:sub==='general',alive:true,side:'ming',x:100+i*10,y:100,facing:0,soldiers:500,_men:[{x:100+i*10,y:100,ph:1}]}));
const options={impostors:true,cam:{x:100,y:100,zoom:.2},W:1000,H:700,quality:'balanced',EX:1,now:1000,project:(x,y,h)=>({x,y:100-(h||0)*.2}),heightAt:()=>5};
const far=scope.window.TMBattleUnitRenderer.instances(units,options);assert(Object.entries(far).filter(([,v])=>v.length).every(([k])=>k.endsWith(':4')));assert.equal(Object.values(far).reduce((n,a)=>n+a.length,0),13); // 11单兵 + 500人炮队对应2炮，仍是同12个阵列。
const close=scope.window.TMBattleUnitRenderer.instances(units,{...options,cam:{...options.cam,zoom:1},project:(x,y,h)=>({x,y:100-(h||0)})});assert(Object.entries(close).filter(([,v])=>v.length).every(([k])=>k.endsWith(':0')));assert.equal(Object.values(close).reduce((n,a)=>n+a.length,0),13);
const legacy=scope.window.TMBattleUnitRenderer.instances(units,{...options,impostors:false});assert(Object.entries(legacy).filter(([,v])=>v.length).every(([k])=>!k.endsWith(':4')));
console.log('PASS directional impostors: '+points+' source vertices fit all views; color-depth atlas bounded; idle/walk/melee poses; same 13 figures from 12 cohorts and full near meshes');
