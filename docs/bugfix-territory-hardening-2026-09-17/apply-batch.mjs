import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {functionSource} from '../../web/scripts/lib-perf-round1.js';
const here=path.dirname(fileURLToPath(import.meta.url)),web=path.resolve(here,'../../web');
if(os.hostname()!=='LAPTOP-AV4J1O7I')throw Error('wrong device');
const files=['tm-faction-membership.js','tm-map-system.js','map-integration.js','tm-ai-change-narrative.js'];
const before={},code={};
for(const f of files){const target=path.join(web,f),backup=path.join(here,'originals',f);
 if(!fs.existsSync(backup))fs.copyFileSync(target,backup,fs.constants.COPYFILE_EXCL);
 before[f]=fs.readFileSync(backup);if(!fs.readFileSync(target).equals(before[f]))throw Error('concurrent edit '+f);code[f]=before[f].toString('utf8');}
function edit(f,a,b){if(code[f].split(a).length!==2)throw Error('nonunique patch '+f+' '+a.slice(0,60));code[f]=code[f].replace(a,b);}
function fn(f,n,s){const old=functionSource(code[f],n);edit(f,old,s.replace(/\r?\n/g,old.includes('\r\n')?'\r\n':'\n'));}
const member='tm-faction-membership.js';
let refresh=functionSource(code[member],'_refreshIndex');
fn(member,'_refreshIndex',refresh.replace('_refreshIndex(facName)','_refreshIndex(facName, strict)').replaceAll('catch(_){}','catch(error){if(strict)throw error;}'));
let assign=functionSource(code[member],'assignProvince');
assign=assign.replace('var rec = _provinceTransferRecord(g, provName);','var rec = opts._record || _provinceTransferRecord(g, provName);');
assign=assign.replace('    if (oldName) _stamp(oldName); if (newName) _stamp(newName);','    if (opts._deferEffects) return true;\n    if (oldName) _stamp(oldName); if (newName) _stamp(newName);');
fn(member,'assignProvince',assign);
let batch=fs.readFileSync(path.join(here,'province-batch.txt'),'utf8');
batch=batch.replace('if(!plans.length)return','if(!plans.length && typeof options.mutate!==\'function\')return');
batch=batch.replace('    try{\n      plans.forEach',"    (options.records || []).forEach(remember);\n    try{\n      plans.forEach");
batch=batch.replace('      if(dirty){',"      if(typeof options.mutate==='function'){var extra=options.mutate();if(extra && typeof extra.then==='function')throw new Error('地图变更必须同步');if(extra!==false)dirty=true;}\n      if(dirty){");
edit(member,'  function bulkReassignProvinces(',batch+'\n  function bulkReassignProvinces(');
edit(member,'    assignProvince: assignProvince,','    assignProvince: assignProvince,\n    applyProvinceTransfers: applyProvinceTransfers,');
let record=functionSource(code[member],'_provinceTransferRecord');
record=record.replace("    var binding = region && (region.adminBinding || region.mapRegionId || region.id);","    var binding = region && (region.adminBinding || region.mapRegionId || region.id);\n    if(binding && typeof binding==='object')binding=binding.id || binding.divisionId || binding.regionId;");
record=record.replace('region && region.adminBinding, division && division.id','binding, division && division.id');
record=record.replace("    return { map:map, region:region, division:division, aliases:aliases, name:","    var uniqueName=!region || regions.filter(function(r){return r && r.name===region.name;}).length===1;\n    if(!uniqueName)aliases=aliases.filter(function(k){return k!==region.name;});\n    return { key:uniqueName ? (region && region.name || division && division.name || String(ref)) : region.id, map:map, region:region, division:division, aliases:aliases, name:");
fn(member,'_provinceTransferRecord',record);
assign=functionSource(code[member],'assignProvince');
assign=assign.replace("if (k!==rec.name && !Object.prototype.hasOwnProperty.call(table,k)) return;","if (k!==rec.key && k!==rec.id && !Object.prototype.hasOwnProperty.call(table,k)) return;");
assign=assign.replace('if (!Object.prototype.hasOwnProperty.call(table,rec.name)) { table[rec.name]=newName;','if (!Object.prototype.hasOwnProperty.call(table,rec.key)) { table[rec.key]=newName;');
assign=assign.replace("list(f,'territories',rec.name)","list(f,'territories',rec.key)").replace("list(f,'territory',rec.name)","list(f,'territory',rec.key)");
fn(member,'assignProvince',assign);
let migrate=functionSource(code[member],'migrateProvinceOwnership');
migrate=migrate.replace('owner && !pToF[name]','owner && !Object.prototype.hasOwnProperty.call(pToF,name)').replace('pid && !pToF[pid]','pid && !Object.prototype.hasOwnProperty.call(pToF,pid)');
const repair=`    var map=g.mapData || g.map;
    var repairs=((map && map.regions) || []).filter(Boolean).map(function(r){
      var key=Object.prototype.hasOwnProperty.call(pToF,r.id)?r.id:r.name;
      if(!Object.prototype.hasOwnProperty.call(pToF,key))return null;
      var owner=pToF[key];if(owner && !_findFac(owner) && !_findFacById(owner))return null;
      return {regionRef:r.id || r.name,newOwner:owner,reason:'运行态归属对账'};
    }).filter(Boolean);
    if(repairs.length)applyProvinceTransfers(repairs,{silent:true});
`;
migrate=migrate.replace('    return { adopted: sourceCounts.total, sourceCounts: sourceCounts };',repair+'    return { adopted: sourceCounts.total, sourceCounts: sourceCounts };');fn(member,'migrateProvinceOwnership',migrate);
let provinces=functionSource(code[member],'getProvinces');
provinces=provinces.replace('      var r=index.get(k), identity=',"      if(index.has(k) && index.get(k)===null)return;\n      var r=index.get(k), identity=");
provinces=provinces.replace('out.push(r && r.name || k);',"out.push(r ? (index.get(r.name)===null ? r.id : r.name) : k);");fn(member,'getProvinces',provinces);
fn('tm-map-system.js','applyRuntimeAIMapChanges',fs.readFileSync(path.join(here,'runtime-plan.txt'),'utf8').trim());
let find=functionSource(code['tm-map-system.js'],'findMapRegion');
const start=find.indexOf('  return mapData.regions.find(');
if(start<0)throw Error('findMapRegion anchor missing');
find=find.slice(0,start)+`  var exact=mapData.regions.filter(function(r){return r && String(r.id)===String(regionRef);});
  if(exact.length>1)throw new Error('地块 ID 不唯一：'+regionRef);
  if(exact.length)return exact[0];
  var matches=mapData.regions.filter(function(r){if(!r)return false;var binding=r.adminBinding;if(binding && typeof binding==='object')binding=binding.id || binding.divisionId;return [r.name,binding,r.mapRegionId].some(function(v){return v!=null && String(v)===String(regionRef);});});
  if(matches.length>1)throw new Error('地块引用不唯一，请使用稳定 ID：'+regionRef);
  return matches[0] || null;
}`;fn('tm-map-system.js','findMapRegion',find);
let setter=functionSource(code['tm-map-system.js'],'setMapRegionOwner');
setter=setter.replace('  // One live-world transaction owns administration, countries and both map views.',`  if(typeof TM!=='undefined' && TM.FactionMembership && typeof TM.FactionMembership.applyProvinceTransfers==='function'){
    TM.FactionMembership.applyProvinceTransfers([{regionRef:region.id || region.name,newOwner:opts.targetFactionId || newOwner,reason:opts.reason}],opts);
    return region;
  }
  // One live-world transaction owns administration, countries and both map views.`);fn('tm-map-system.js','setMapRegionOwner',setter);
let fields=functionSource(code['tm-map-system.js'],'updateMapRegionFields');
fields=fields.replace('  opts = opts || {};',`  var ownerFields=['owner','currentOwner','controller','ownerKey','currentOwnerKey','controllerKey','factionId','factionKey','factionName','ownerName','ownerFactionId','controllerFactionId','sovereignFactionId','groupKey','stableOwnerKey','stableFactionId','mapFactionId'];
  if(patch && [patch,patch.data].some(function(obj){return obj && ownerFields.some(function(k){return Object.prototype.hasOwnProperty.call(obj,k);});}))throw new Error('归属字段必须通过统一易主接口写入');
  opts = opts || {};`);fn('tm-map-system.js','updateMapRegionFields',fields);
edit('map-integration.js','        TMMapRuntime.applyAIMapChanges(aiResponse);','        return TMMapRuntime.applyAIMapChanges(aiResponse);');
fn('tm-ai-change-narrative.js','_setRegionOwnerMirrors',`function _setRegionOwnerMirrors(G, rec, fac, reason) {
    if(!G || !rec || !fac)return false;
    if(G!==global.GM)throw new Error('叙事易主不能修改非当前世界');
    var membership=global.TM && TM.FactionMembership;
    if(!membership || typeof membership.applyProvinceTransfers!=='function')throw new Error('叙事易主缺少统一领地写入模块');
    var result=membership.applyProvinceTransfers([{regionRef:rec.mapRegion && rec.mapRegion.id || rec.adminDiv && rec.adminDiv.id || rec.id || rec.name,newOwner:fac.id || fac.name,reason:reason || '叙事地块归属补录'}],{silent:true});
    return result.changed;
  }`);
// Public single-transfer calls share the same preflight, journal and post-commit effects.
let core=functionSource(code[member],'assignProvince');
fn(member,'assignProvince',core.replace('function assignProvince(', 'function _assignProvinceCore('));
edit(member,'  function applyProvinceTransfers(changes, options) {',`  function assignProvince(provName,newFacName,opts){
    if(!provName)return false;opts=opts || {};
    return applyProvinceTransfers([{regionRef:provName,newOwner:opts.targetFactionId || newFacName,reason:opts.reason}],opts).changed || false;
  }
  function applyProvinceTransfers(changes, options) {`);
edit(member,'var changed=assignProvince(rec.id,p.name,{reason:p.reason,silent:true,_deferEffects:true,_record:rec});','var changed=_assignProvinceCore(rec.id,p.name,{reason:p.reason,silent:true,targetFactionId:p.id,byTurn:options.byTurn,_deferEffects:true,_record:rec});');
// Preserve missing references instead of recreating explicit unowned land from old hints.
for(const f of files){new vm.Script(code[f],{filename:f});if(!fs.readFileSync(path.join(web,f)).equals(before[f]))throw Error('concurrent edit '+f);}
console.log('PREPARED',files.map(f=>({file:f,bytes:Buffer.byteLength(code[f])})));
if(process.argv.includes('--check'))process.exit(0);
const written=[];
try{
  for(const f of files){
    const data=Buffer.from(code[f],'utf8'),target=path.join(web,f);
    if(!fs.readFileSync(target).equals(before[f]))throw Error('concurrent edit '+f);
    const fd=fs.openSync(target,'r+');
    try{let pos=0;while(pos<data.length)pos+=fs.writeSync(fd,data,pos,data.length-pos,pos);fs.ftruncateSync(fd,data.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
    written.push(f);if(!fs.readFileSync(target).equals(data))throw Error('readback failed '+f);
  }
}catch(error){for(const f of written)fs.writeFileSync(path.join(web,f),before[f]);throw error;}
console.log('BATCH_PATCH_READBACK_OK',written);
