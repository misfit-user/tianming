'use strict';
const assert=require('node:assert/strict'),path=require('node:path');
const terrain=require(path.join(__dirname,'../battle/terrain-world.js'));
let checks=0;
function test(name,fn){fn();checks++;console.log('PASS '+name);}
for(const biome of ['plain','verdant','snow','desert','wetland'])for(const dir of ['N','E','S','W']){
  const p={biome,provinceMeta:{neighborDir:dir}},w=terrain.create(1701,p);
  test(biome+'/'+dir+' deterministic landscape and finite shared heightfield',()=>{
    const again=terrain.create(1701,p);assert.deepEqual(w.heights,again.heights);assert.deepEqual(w.props,again.props);
    assert(w.heights.length<=65535);assert(w.heights.every(Number.isFinite));assert(w.props.length<8000);
    assert(w.w>=30000&&w.h>=22000);assert(Math.max(...w.heights)-Math.min(...w.heights)>250);
  });
  test(biome+'/'+dir+' deployment fronts stay dry, open and inside the map',()=>{
    for(const side of ['ming','jin'])for(let i=-6;i<=6;i++){
      const c=w.deployment(side),x=c.x+(dir==='E'||dir==='W'?0:i*1080),y=c.y+(dir==='E'||dir==='W'?i*1080:0);
      assert(x>0&&y>0&&x<w.w&&y<w.h);assert.equal(w.surfaceAt(x,y),'plain');
    }
  });
  test(biome+'/'+dir+' crossings really traverse water and are not decorative',()=>{
    if(w.river.length){assert(w.crossings.length>=2);for(const b of w.crossings){assert.equal(w.surfaceAt(b.x,b.y),b.kind==='bridge'?'plain':'river');assert(w.heightAt(b.x,b.y)>=w.waterLevel-2.1);}}
    for(const p of w.props){assert(!w.isWater(p.x,p.y),'prop in water');assert(w.heightAt(p.x,p.y)>w.waterLevel+10,'submerged prop');}
    assert(!w.isWater(w.objective.x,w.objective.y));
  });
}
test('seed variation changes terrain without global random calls',()=>{
  const random=Math.random;Math.random=()=>{throw Error('global random mutated');};try{
    assert.notDeepEqual(terrain.create(123).heights,terrain.create(124).heights);
  }finally{Math.random=random;}
});
test('ray intersection follows a raised terrain point, not the sea-level plane',()=>{
  const w=terrain.create(123,{biome:'verdant'}),x=w.objective.x,y=w.objective.y,z=w.heightAt(x,y)*1.7;
  const hit=terrain.raycast([x,y+800,z+3000],[x,y-800,z-3000],(a,b)=>w.heightAt(a,b)*1.7);
  assert(hit&&Math.abs(hit.x-x)<1&&Math.abs(hit.y-y)<2);
});
test('grid ray cannot skip a narrow ridge between coarse samples',()=>{
  const g={w:1000,h:1000,nx:101,ny:101,heights:new Float32Array(10201)};for(let y=0;y<101;y++)g.heights[y*101+50]=300;
  const hit=terrain.raycast([0,500,200],[70000,500,-100],()=>0,g,1);assert(hit&&hit.x>490&&hit.x<510);
});
test('real hill objective remains pickable at grazing view and long far plane',()=>{
  const w=terrain.create(1701,{biome:'verdant',weather:'clear'}),p=w.objective,z=w.heightAt(p.x,p.y)*1.7,dist=(400/Math.tan(.41))/.18,dh=dist*Math.cos(.6),dv=dist*Math.sin(.6),a=[p.x,p.y+dh,z+dv],b=[p.x,p.y-dh*20,z-dv*20];
  const hit=terrain.raycast(a,b,w.heightAt,w,1.7);assert(hit&&Math.hypot(hit.x-p.x,hit.y-p.y)<1);
});
test('background points obscured by a ridge hit the foreground, never shoot through it',()=>{
  const g={w:1000,h:1000,nx:101,ny:101,heights:new Float32Array(10201)};for(let y=0;y<101;y++)g.heights[y*101+50]=300;
  const hit=terrain.raycast([0,500,200],[1000,500,0],()=>0,g,1);assert(hit&&hit.x<510);
});
for(let i=0;i<24;i++)test('seed '+(i*719+41)+' coastal and island landscape remains bounded and aligned',()=>{
  const w=terrain.create(i*719+41,{biome:i%2?'wetland':'verdant',coast:true,island:i%3===0,dens:i%2?.52:.18,fort:true,provinceMeta:{neighborDir:['N','E','S','W'][i%4],oceanSide:i%2?'left':'right'}});
  assert(w.props.length<8000);assert(w.props.every(p=>!w.isWater(p.x,p.y)));assert(w.heights.every(Number.isFinite));assert(!w.isWater(w.objective.x,w.objective.y));
  for(const side of ['leftX','rightX'])if(w.coast[side]!=null){const x=w.coastX(side,w.h*.4),sign=side==='leftX'?-1:1;assert(w.isWater(x+sign*25,w.h*.4));}
});
console.log('PASS battle terrain world '+checks+' checks');
