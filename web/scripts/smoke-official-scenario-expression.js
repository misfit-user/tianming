'use strict';
const assert=require('assert/strict'),vm=require('vm');
const {serializeScenarioExpression:serialize}=require('./official-scenario-expression.js');
let count=0;
const fixtures=[{id:'a',map:{regions:[{id:'甲',data:{zero:0,empty:null,text:'引号"与换行\n'}}]},mapData:{regions:[{id:'甲',data:{zero:0,empty:null,text:'引号"与换行\n'}}]},characters:[{name:'郑肃',wuchangOverride:{仁:76,义:89,礼:93,智:82,信:87}}]},
 {mapData:{regions:[{id:2}]},map:{regions:[{id:2}]},other:[false,0,'']},
 {map:{regions:[{id:1}]},mapData:{regions:[{id:2}]}},
 {map:{regions:[]},mapData:{regions:[]}}, {map:null,mapData:null}, {name:'无地图'},null];
for(const input of fixtures){
 const before=JSON.stringify(input),out=vm.runInNewContext('('+serialize(input)+')');
 assert.equal(JSON.stringify(out),before);assert.equal(JSON.stringify(input),before);count+=2;
 if(input&&input.map&&input.mapData){
  assert.notEqual(out.map,out.mapData);count++;
  if(out.map.regions.length){out.map.regions[0].id='mutated';assert.notEqual(out.mapData.regions[0].id,'mutated');count++;}
 }
}
const big={regions:[{outline:Array.from({length:1000},(_,i)=>[i,i*2])}]};
const input={map:big,mapData:JSON.parse(JSON.stringify(big))};
assert(serialize(input).length<JSON.stringify(input).length*.6);count++;
assert.equal(serialize({map:{a:1},mapData:{a:2}}),JSON.stringify({map:{a:1},mapData:{a:2}}));count++;
console.log('PASS official-scenario-expression '+count+' assertions');
