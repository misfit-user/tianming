'use strict';
const assert=require('node:assert/strict'),Cache=require('../battle/terrain-frame-cache.js'),World=require('../battle/terrain-world.js');
assert.equal(Cache.create({getExtension:()=>null},()=>{throw Error('unsupported cache must not compile');}),null);
assert.equal(Cache.create({getExtension:()=>({}),getShaderPrecisionFormat:()=>({precision:0})},()=>{throw Error('low precision must retain direct rendering');}),null);
let checked=0;const random=World.rng(9813);
for(const profile of [{biome:'plain'},{biome:'wetland',coast:true,provinceMeta:{neighborDir:'W',oceanSide:'left'}},{biome:'desert',island:true}]){
  const world=World.create(1722,profile),original=(x,y)=>world.seaDepth(x,y)>0||(world.riverInfo(x,y).distance<world.riverW*.5&&!world.crossingAt(x,y));
  const points=Array.from({length:15000},()=>({x:(random()*1.2-.1)*world.w,y:(random()*1.2-.1)*world.h}));
  for(const p of world.river)for(const r of [-.501,-.5,-.499,0,.499,.5,.501])points.push({x:p.x,y:p.y+world.riverW*r},{x:p.x+world.riverW*r,y:p.y});
  for(const b of world.crossings)for(let i=-20;i<=20;i++)points.push({x:b.x+b.tx*i*20,y:b.y+b.ty*i*20});
  for(const p of points){assert.equal(world.isWater(p.x,p.y),original(p.x,p.y),JSON.stringify({profile,p}));checked++;}
}
console.log('PASS frame-cache capability fallback and '+checked+' exact river/coast/crossing broad-phase comparisons');
