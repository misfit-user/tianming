import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const evidence=path.dirname(fileURLToPath(import.meta.url)), root=path.resolve(evidence,'../..');
const files=['web/tm-faction-membership.js','web/tm-map-system.js','web/tm-three-systems-ext.js'];
const original=new Map(files.map(f=>[f,fs.readFileSync(path.join(root,f))]));
const updated=new Map([...original].map(([f,b])=>[f,b.toString('utf8')]));
function once(file,oldText,newText){
  const text=updated.get(file), at=text.indexOf(oldText);
  if(at<0 || text.indexOf(oldText,at+oldText.length)>=0)throw Error('Patch anchor not unique: '+file+' / '+oldText.slice(0,60));
  updated.set(file,text.slice(0,at)+newText+text.slice(at+oldText.length));
}
const member=files[0], map=files[1], ext=files[2];
const text=updated.get(member), start=text.indexOf('  function assignProvince('), end=text.indexOf('  function bulkReassignProvinces(',start);
if(start<0||end<0)throw Error('Missing transfer boundaries');
const eol=text.includes('\r\n')?'\r\n':'\n';
const replacement=fs.readFileSync(path.join(evidence,'province-transfer.txt'),'utf8').replace(/\r?\n/g,eol);
once(member,text.slice(start,end),replacement+eol);
once(member,'    assignProvince: assignProvince,','    assignProvince: assignProvince,'+eol+'    getProvinces: getProvinces,');
once(map,'  var resolved = findScenarioFactionByMapValue(newOwner, mapData);',
`  // One live-world transaction owns administration, countries and both map views.
  if (typeof TM !== 'undefined' && TM.FactionMembership && TM.FactionMembership.assignProvince) {
    TM.FactionMembership.assignProvince(region.id || region.name, newOwner, opts);
    return region;
  }
  var resolved = findScenarioFactionByMapValue(newOwner, mapData) || { id:'', key:'', name:'', color:'' };`.replace(/\n/g,updated.get(map).includes('\r\n')?'\r\n':'\n'));
const meol=updated.get(map).includes('\r\n')?'\r\n':'\n';
once(map,'function setMapRegionOwner(regionRef, newOwner, opts) {',
  'function setMapRegionOwner(regionRef, newOwner, opts) {'+meol+'  if (newOwner === undefined) return null;'+meol+"  if (newOwner === null) newOwner = '';");
once(map,'  var oldOwnerKey = region.ownerKey;',
  '  var oldOwnerKey = region.ownerKey;'+meol+'  if (oldOwner === resolved.id && oldOwnerKey === resolved.key) return region;');
const eeol=updated.get(ext).includes('\r\n')?'\r\n':'\n';
const extext=updated.get(ext), gs=extext.indexOf('  function getFactionProvinces('), ge=extext.indexOf('  // [Slice H',gs);
if(gs<0||ge<0)throw Error('Missing province reader boundaries');
const getOld=extext.slice(gs,ge);
const getNew=getOld.replace('    var out = [];',
  "    if (global.TM && global.TM.FactionMembership && global.TM.FactionMembership.getProvinces) return global.TM.FactionMembership.getProvinces(factionName);"+eeol+'    var out = [];');
once(ext,getOld,getNew);
once(ext,'  function buildProvinceOwnerIndex() {',
  '  function buildProvinceOwnerIndex() {'+eeol+'    if (global.TM && global.TM.FactionMembership && global.TM.FactionMembership.migrateProvinceOwnership) return global.TM.FactionMembership.migrateProvinceOwnership();');
once(ext,"      var ok = global.TM.FactionMembership.assignProvince(provinceName, newOwnerName || '', { reason: reason || '', silent: true });",
  "      var previousOwner = GM._provinceToFaction[provinceName] || '';"+eeol+"      var ok = global.TM.FactionMembership.assignProvince(provinceName, newOwnerName || '', { reason: reason || '', silent: true });");
once(ext,'from: GM._provinceToFaction[provinceName], to: newOwnerName','from: previousOwner, to: newOwnerName');
for(const [f,s] of updated)new vm.Script(s,{filename:f});
for(const [f,b] of original)if(!fs.readFileSync(path.join(root,f)).equals(b))throw Error('Concurrent edit: '+f);
const backups=path.join(evidence,'originals');fs.mkdirSync(backups,{recursive:true});
for(const [f,b] of original)fs.writeFileSync(path.join(backups,path.basename(f)+'.bak'),b,{flag:'wx'});
function writeExact(f,b){
  const fd=fs.openSync(path.join(root,f),'r+');
  try{let n=0;while(n<b.length)n+=fs.writeSync(fd,b,n,b.length-n,n);fs.ftruncateSync(fd,b.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  if(!fs.readFileSync(path.join(root,f)).equals(b))throw Error('Readback mismatch: '+f);
}
const written=[];
try{for(const [f,s] of updated){written.push(f);writeExact(f,Buffer.from(s,'utf8'));}}
catch(error){for(const f of written.reverse())writeExact(f,original.get(f));throw error;}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const report={updatedAt:new Date().toISOString(),files:files.map(f=>({path:f,before:hash(original.get(f)),after:hash(fs.readFileSync(path.join(root,f)))}))};
fs.writeFileSync(path.join(evidence,'patch-manifest.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log('PATCH_READBACK_OK '+JSON.stringify(report));
