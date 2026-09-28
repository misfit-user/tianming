import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import os from 'node:os';import {fileURLToPath} from 'node:url';
import {functionSource} from '../../web/scripts/lib-perf-round1.js';
const here=path.dirname(fileURLToPath(import.meta.url)),web=path.resolve(here,'../../web');
if(os.hostname()!=='LAPTOP-AV4J1O7I')throw Error('wrong device');
const files=['tm-map-system.js','tm-faction-membership.js'],before={},code={};
for(const f of files){before[f]=fs.readFileSync(path.join(web,f));code[f]=before[f].toString('utf8');fs.writeFileSync(path.join(here,'before-refine-'+f+'.bak'),before[f],{flag:'wx'});}
function edit(f,a,b){if(code[f].split(a).length!==2)throw Error('nonunique edit '+f);code[f]=code[f].replace(a,b);}
function fn(f,n,s){const old=functionSource(code[f],n);edit(f,old,s);}
const map='tm-map-system.js',member='tm-faction-membership.js';
let apply=functionSource(code[map],'applyRuntimeAIMapChanges');
const split=apply.indexOf('  var membership='),begin=apply.indexOf('\n')+1;
if(split<0)throw Error('preflight split anchor missing');
const prepare='function _prepareRuntimeAIMapChanges(aiResponse,mapData) {\n'+apply.slice(begin,split)+'  return {source:source,owners:owners,extras:extras,total:total};\n}';
const writer='function applyRuntimeAIMapChanges(aiResponse,mapData) {\n  var plan=_prepareRuntimeAIMapChanges(aiResponse,mapData);\n  if(!plan.total)return {ok:true,applied:0,ownershipChanges:0};\n  var source=plan.source,owners=plan.owners,extras=plan.extras;\n'+apply.slice(split);
fn(map,'applyRuntimeAIMapChanges',prepare+'\n\n'+writer);
edit(map,'    if(GM.mapData!==oldMap){if(hadMap)GM.mapData=oldMap;else delete GM.mapData;}','    if(GM.mapData!==oldMap){if(hadMap)GM.mapData=oldMap;else delete GM.mapData;} // arch-ok: the map owner restores its own binding when the AI write transaction is rejected.');
let core=functionSource(code[member],'_assignProvinceCore');
core=core.replace("      var next=(Array.isArray(old)?old:[]).filter(function(v) { return rec.aliases.indexOf(String(v))<0; });",`      var retained=false;
      var next=(Array.isArray(old)?old:[]).filter(function(v) {
        if(rec.aliases.indexOf(String(v))<0)return true;
        if(f.name===newName && v===value && !retained){retained=true;return true;}
        return false;
      });`);fn(member,'_assignProvinceCore',core);
// Migration must not apply an ambiguous display-name alias to both regions.
let migrate=functionSource(code[member],'migrateProvinceOwnership');
migrate=migrate.replace('    var map=g.mapData || g.map;',`    var map=g.mapData || g.map,nameCounts=new Map();
    ((map && map.regions) || []).forEach(function(r){if(r && r.name)nameCounts.set(r.name,(nameCounts.get(r.name)||0)+1);});`);
migrate=migrate.replace("      var key=Object.prototype.hasOwnProperty.call(pToF,r.id)?r.id:r.name;",`      var key=Object.prototype.hasOwnProperty.call(pToF,r.id)?r.id:r.name;
      if(key===r.name && nameCounts.get(r.name)>1)return null;`);
fn(member,'migrateProvinceOwnership',migrate);
for(const f of files){new vm.Script(code[f],{filename:f});if(!fs.readFileSync(path.join(web,f)).equals(before[f]))throw Error('concurrent edit '+f);}
for(const f of files){
  const target=path.join(web,f),data=Buffer.from(code[f],'utf8');
  const fd=fs.openSync(target,'r+');
  try{let n=0;while(n<data.length)n+=fs.writeSync(fd,data,n,data.length-n,n);fs.ftruncateSync(fd,data.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  if(!fs.readFileSync(target).equals(data))throw Error('readback mismatch '+f);
}
console.log('BOUNDARY_REFINEMENT_READBACK_OK',files);
