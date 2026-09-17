'use strict';
const assert=require('node:assert/strict'),N=require('../battle/terrain-navigation.js');
for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]])for(const side of ['ming','jin']){
 const world={w:32000,h:24000,deployment:s=>({x:16000+(s==='ming'?-1:1)*dx*8000,y:12000+(s==='ming'?-1:1)*dy*6000})},p=N.deploymentPolygon(world,side),a=world.deployment(side),b=world.deployment(side==='ming'?'jin':'ming'),x=b.x-a.x,y=b.y-a.y;
 assert.equal(p.length,4);assert(p.every(q=>(q.x-16000)*x+(q.y-12000)*y<=-Math.hypot(x,y)*180+.001));assert(p.some(q=>q.x===0||q.x===32000));console.log('PASS deployment overlay '+dx+','+dy+' '+side);
}
