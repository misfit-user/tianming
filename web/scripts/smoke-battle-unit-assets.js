'use strict';
const assert=require('node:assert/strict'),A=require('../battle/unit-assets.js');let n=0;
for(const kind of A.kinds){let previous=Infinity;for(let lod=0;lod<3;lod++){
  const m=A.generate(kind,lod);assert.equal(m.count*11,m.vertices.length);assert.equal(m.count%3,0);assert(m.triangles<=previous,kind+' lod monotonic');previous=m.triangles;assert(m.triangles<3000,kind+' geometry budget '+m.triangles);assert(m.vertices.every(Number.isFinite));assert.strictEqual(A.generate(kind,lod),m);
  for(let i=0;i<m.vertices.length;i+=11){assert(Math.abs(Math.hypot(...m.vertices.subarray(i+3,i+6))-1)<1e-5);assert(m.vertices[i+9]>=0&&m.vertices[i+9]<=9);}
  n++;console.log('PASS '+kind+' LOD'+lod+' '+m.triangles+' triangles');
}}
for(const [k,f] of [['sword','round-shield'],['spear','long-shaft'],['halberd','halberd-blade'],['bow','curved-bow'],['crossbow','crossbow-limbs'],['musket','gun-barrel'],['heavy','horse-armour'],['general','commander-cape'],['cannon','wheels']])assert(A.generate(k,0).features.includes(f));
assert.equal(A.kindFor({_hero:true,sub:'shock'}),'general');assert.equal(A.kindFor({sub:'crossbow'}),'crossbow');console.log('PASS unit assets '+n+' geometry and 11 identity checks');
