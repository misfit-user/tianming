'use strict';
const fs=require('fs'),path=require('path'),assert=require('assert/strict'),vm=require('vm');
const root=path.resolve(__dirname,'../..'),keys=['仁','义','礼','智','信'];
// 人物数随剧本修复变动：人物一刀补开局在任的节帅、观察使与府尹 32 人（均为史实人物）
const PEOPLE=466,HISTORICAL=113;
const scenario=JSON.parse(fs.readFileSync(path.join(root,'scenarios/晚唐·开成五年（官方）.json'),'utf8'));
const archive=JSON.parse(fs.readFileSync(path.join(root,'web/assets/reference/tang840-wuchang.json'),'utf8'));
const ui=fs.readFileSync(path.join(root,'web/tm-renwu-tuzhi.js'),'utf8');
const fn=ui.match(/^function _wuchangOf\(c\).*$/m);assert(fn,'production getter exists');
const ctx={};vm.createContext(ctx);vm.runInContext(fn[0],ctx);
let checks=0;
assert.equal(scenario.characters.length,PEOPLE);assert.equal(Object.keys(archive.characters).length,PEOPLE);checks+=2;
const ids=new Set();
for(const c of scenario.characters){
 assert(!ids.has(c.id),c.id);ids.add(c.id);
 const a=archive.characters[c.id];assert(a&&a.name===c.name,c.name+' reference');
 assert.deepEqual(Object.keys(c.wuchangOverride),keys,c.name+' five canonical keys');
 for(const k of keys)assert(Number.isInteger(c.wuchangOverride[k])&&c.wuchangOverride[k]>=0&&c.wuchangOverride[k]<=100,c.name+' '+k);
 assert.deepEqual(ctx._wuchangOf(c),c.wuchangOverride,c.name+' production UI gets canonical values');
 assert.deepEqual(a.initialScores,c.wuchangOverride,c.name+' editorial audit matches initial scores');
 assert.equal(c.wuchangAssessment.key,c.id);assert.equal(c.wuchangAssessment.reference,'assets/reference/tang840-wuchang.json');
 assert(a.note.length>20&&keys.every(k=>/^[HMLF]$/.test(a.confidence[k])));
 if(!c.isHistorical){assert.equal(a.kind,'fictional-authoring');assert.deepEqual(a.sources,[]);}
 checks+=12;
}
const reload=JSON.parse(JSON.stringify(scenario.characters));assert.deepEqual(reload,scenario.characters);checks++;
assert.deepEqual(ctx._wuchangOf({wuchang:{},wuchangOverride:{仁:0,义:1,礼:2,智:3,信:4}}),{仁:0,义:1,礼:2,智:3,信:4});checks++;
assert.equal(scenario.characters.filter(c=>c.isHistorical).length,HISTORICAL);checks++;
console.log('PASS tang840-wuchang '+checks+' assertions; '+PEOPLE+' people, '+PEOPLE*keys.length+' configured values');
