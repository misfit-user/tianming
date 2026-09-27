'use strict';
const assert=require('assert/strict'),fs=require('fs'),path=require('path'),vm=require('vm');
function load(file){const c={console,GM:{},Map,Set};c.window=c;vm.runInNewContext(fs.readFileSync(file,'utf8'),c);return {api:c.TM.MemoryHybrid,c};}
const before=load(path.join(__dirname,'fixtures/memory-hybrid-reference.js')),after=load(path.join(__dirname,'../tm-memory-hybrid.js'));
let seed=81731;function random(){seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;}
const words=['黄河','赋税','军粮','承诺','战事','land','canal','tax','population','粮价','三年前','🙂'];
let cases=0;
for(let round=0;round<80;round++){
 const hits=Array.from({length:30+round%50},(_,i)=>({id:'id-'+i,source:'s'+i%4,text:Array.from({length:30},()=>words[Math.floor(random()*words.length)]).join(' '),turn:i%10,entities:['人物'+i%7]}));
 const query=words[round%words.length];const a=before.api.lexical(hits,query,40),b=after.api.lexical(hits,query,40);
 assert.equal(JSON.stringify(b),JSON.stringify(a),'lexical result changed at '+round);
 const vector=hits.filter(()=>random()<0.4).reverse();
 assert.equal(JSON.stringify(after.api.fuse(b,vector,20)),JSON.stringify(before.api.fuse(a,vector,20)),'fusion changed at '+round);cases+=2;
 hits[0].text='黄河相关证据被纠正 '+round;hits[0].entities=['new entity'];
 assert.equal(JSON.stringify(after.api.lexical(hits,'黄河',40)),JSON.stringify(before.api.lexical(hits,'黄河',40)));cases++;
 if(round%10===0)after.c.GM={};
}
for(const query of ['', '不存在', '黄', '😀'])assert.equal(JSON.stringify(after.api.lexical([],query,10)),JSON.stringify(before.api.lexical([],query,10)));
console.log(JSON.stringify({pass:cases+4,fail:0,seed:81731,mode:'exact JSON equality, unchanged scores and ordered evidence'}));
