// 语义对比大JSON，确认完整重建没有改动人口、税表、官俸、承载、人物或地图几何。
'use strict';
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../../..'),DIR=path.resolve(__dirname,'..');
const fields=new Set(['saltProduction','mineralProduction','horseProduction','fishingProduction','maritimeTradeVolume','imperialFarmland']);
const files=['天启七年·九月（官方）.json','绍宋·建炎元年八月（官方）.json','晚唐·开成五年（官方）.json'];
const reports=[];
for(const name of files){
 const rel='scenarios/'+name;
 const before=JSON.parse(execFileSync('git',['show','c9ad8e6f:'+rel],{cwd:ROOT,maxBuffer:256*1024*1024}).toString('utf8'));
 const after=JSON.parse(fs.readFileSync(path.join(ROOT,rel),'utf8'));
 const report={scenario:name,changes:0,unexpected:[]};
 function allowed(parts){
   const inScope=(parts[0]==='adminHierarchy'&&parts[1]==='player')||((parts[0]==='map'||parts[0]==='mapData')&&parts[1]==='regions');
   if(!inScope)return false;
   return parts.at(-2)==='economyBase'&&fields.has(parts.at(-1)) || parts.at(-2)==='tags'&&['saltRegion','mineralRegion'].includes(parts.at(-1));
 }
 function walk(a,b,p){
   if(a===b)return;
   if((a===undefined||a&&typeof a==='object')&&(b===undefined||b&&typeof b==='object')){
     const keys=[...new Set(Object.keys(a||{}).concat(Object.keys(b||{})))];
     if(keys.length){for(const k of keys)walk(a&&a[k],b&&b[k],p.concat(k));return;}
     if(a&&b&&Array.isArray(a)===Array.isArray(b))return; // 两边同为空数组/对象
     if(p.at(-1)==='economyBase')return; // 缺席与空对象都由初始化补齐
   }
   report.changes++;
   if(!allowed(p))report.unexpected.push({path:p.join('/'),before:a,after:b});
 }
 walk(before,after,[]);reports.push(report);
 console.log(name+': changes='+report.changes+' unexpected='+report.unexpected.length);
}
fs.writeFileSync(path.join(DIR,'reports/p1b2-scope.json'),JSON.stringify(reports,null,2)+'\n');
if(reports.some(r=>r.unexpected.length)){console.error(JSON.stringify(reports.flatMap(r=>r.unexpected).slice(0,10),null,2));process.exitCode=1;}
else console.log('PASS changes confined to production fields and resource tags');
