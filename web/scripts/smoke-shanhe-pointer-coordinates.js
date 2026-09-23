'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {functionSource}=require('./lib-perf-round1');
const source=fs.readFileSync(path.join(__dirname,'../tm-shanhe-runtime.js'),'utf8');
let passed=0,rect;
const regions=[{id:'jingzhou',box:[390,260,430,300]},{id:'jian',box:[510,340,560,390]}];
const items=regions.map(r=>({...r,path:r.box,node:{dataset:{regionId:r.id}}})),byCell=new Map();
for(const it of items)for(let x=Math.floor(it.box[0]/100);x<=Math.floor(it.box[2]/100);x++)for(let y=Math.floor(it.box[1]/100);y<=Math.floor(it.box[3]/100);y++){
  const key=x+':'+y;if(!byCell.has(key))byCell.set(key,[]);byCell.get(key).push(it);
}
const c=vm.createContext({active:()=>true,canvas:{getBoundingClientRect:()=>rect},renderer:{width:1200,height:720},current:{rec:{byCell,step:100}},screenToGame:p=>p,picker:{isPointInPath:(b,x,y)=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]}});
vm.runInContext(['clientToScreen','pick'].map(n=>functionSource(source,n)).join('\n'),c);
for(const [sx,sy] of [[.35,.35],[.67,.67],[1,1],[1.25,1.25],[1.8,1.8],[1.25,.8]])for(const dpr of [1,1.5,2]){
  c.devicePixelRatio=dpr;rect={left:37,top:91,width:1200*sx,height:720*sy};
  for(const r of regions){const x=(r.box[0]+r.box[2])/2,y=(r.box[1]+r.box[3])/2;
    assert.equal(c.pick({clientX:rect.left+x*sx,clientY:rect.top+y*sy})?.dataset.regionId,r.id,'rendered land must match pick regardless of CSS scale or DPR');passed++;
  }
}
rect={left:25,top:60,width:1200,height:720};
assert.equal(c.pick({clientX:25+405,clientY:60+280})?.dataset.regionId,'jingzhou');passed++;
rect={left:88,top:113,width:600,height:360};
assert.equal(c.pick({clientX:88+405*.5,clientY:113+280*.5})?.dataset.regionId,'jingzhou','read the current canvas bounds after resize');passed++;
for(const e of [null,{clientX:NaN,clientY:20},{clientX:20,clientY:Infinity},{clientX:rect.left-1,clientY:200},{clientX:rect.left+rect.width+1,clientY:200}]){assert.equal(c.pick(e),null);passed++;}
rect={left:0,top:0,width:0,height:0};assert.equal(c.pick({clientX:405,clientY:280}),null);passed++;
const mapSource=fs.readFileSync(path.join(__dirname,'../phase8-formal-map.js'),'utf8');
const tooltipContext=vm.createContext({window:{innerWidth:1280,innerHeight:900}});
vm.runInContext(functionSource(mapSource,'positionMapTip'),tooltipContext);
for(const scale of [.35,.67,1,1.5])for(const edge of [false,true]){
  const parent={offsetWidth:1200,offsetHeight:800,clientLeft:2,clientTop:3,scrollLeft:17,scrollTop:11,getBoundingClientRect:()=>({left:37,top:83,width:1200*scale,height:800*scale})};
  const tip={style:{},offsetParent:parent,getBoundingClientRect:()=>({width:260*scale,height:190*scale})};
  const e=edge?{clientX:1250,clientY:870}:{clientX:400,clientY:320};
  tooltipContext.positionMapTip(tip,e);
  const left=37+(parseFloat(tip.style.left)+2-17)*scale,top=83+(parseFloat(tip.style.top)+3-11)*scale;
  assert(Math.abs(left-(edge?e.clientX-260*scale-14:e.clientX+14))<1e-8);
  assert(Math.abs(top-(edge?e.clientY-190*scale-14:e.clientY+14))<1e-8);
  assert(left>=0&&top>=0&&left+260*scale<=1280&&top+190*scale<=900);passed++;
}
console.log('PASS '+passed+' 2.5D pointer and tooltip coordinate assertions');
