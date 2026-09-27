// Map-only R3 migration from the current R2 official source, preserving all original records.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import vm from 'node:vm';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),clone=structuredClone;
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(path.join(work,f),'utf8'));
const bytes=fs.readFileSync(path.join(work,'source-before.json')),before=JSON.parse(bytes),out=clone(before),geo=read('r3-geometry.json');
const oldMap=before.map,oldById=new Map(oldMap.regions.map(r=>[r.id,r])),nodes=new Map();
function walk(n){nodes.set(n.id,n);(n.children||[]).forEach(walk);}Object.values(out.adminHierarchy).forEach(v=>(v.divisions||[]).forEach(walk));
const groups=out.map.circuitRegistry,splitParents=['ming-28','ming2-34'];
for(const pid of splitParents){
 const group=groups.find(g=>g.sourceRegionId===pid),parent=nodes.get(group.sourceAdminId);assert.ok(parent?.children?.length);
 delete parent.mapAccounting;parent.mappedRegions=geo.filter(r=>r.parentId===pid).map(r=>r.id);
 for(const g of geo.filter(r=>r.parentId===pid)){
  const members=g.accountIds.map(id=>nodes.get(id));assert.ok(members.every(Boolean));
  for(const n of members){n.sourceMapRegionId=pid;n.mapRegionId=g.id;n.mappedRegions=[g.id];n.mapAccounting={schema:'source-partition-v1',sourceAccountId:n.id,logicalRegionId:g.id,weight:1};}
  if(members.length>1){
   const item={id:'map-group-'+g.id,name:g.name+'·原账分项',type:'地域核算组',mapRegionId:g.id,mapAccounting:{schema:'source-partition-v1',logicalRegionId:g.id,group:true},children:members};
   const at=parent.children.findIndex(n=>n.id===members[0].id);assert.ok(at>=0);parent.children=parent.children.filter(n=>!g.accountIds.includes(n.id));parent.children.splice(at,0,item);nodes.set(item.id,item);
  }
 }
}
function aggregate(members){
 if(members.length===1){const value=clone(members[0]);delete value.children;return value;}
 const ratios=new Set(['ratio','sexRatio','compliance','skimmingRate','autonomy','autonomyLevel','commerceCoefficient','roadQuality','climate','currentLoad','minxin','minxinLocal','corruption','corruptionLocal','prosperity','unrest']);
 const weights=members.map(n=>n.populationDetail?.mouths||1),total=weights.reduce((a,b)=>a+b,0);
 function add(values,key){if(values.every(v=>typeof v==='number'))return ratios.has(key)?values.reduce((s,v,i)=>s+v*weights[i],0)/total:values.reduce((a,b)=>a+b,0);if(values.every(v=>v&&typeof v==='object'&&!Array.isArray(v))){const target={};for(const k of new Set(values.flatMap(Object.keys)))if(!['children','mapAccounting'].includes(k))target[k]=add(values.map(v=>v[k]),k);return target;}return clone(values.find(v=>v!==undefined)??null);}
 return add(members,'');
}
function svg(g){const ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;return ps.flatMap(p=>p.map(r=>'M'+r.map(v=>v.map(n=>Number(n.toFixed(7))).join(' ')).join(' L')+' Z')).join(' ');}
const rows=geo.map(g=>{
 const existing=oldById.get(g.id),template=existing||oldById.get(g.parentId);assert.ok(template,g.id);
 const r=clone(template),d=svg(g.geometry),ps=g.geometry.type==='Polygon'?[g.geometry.coordinates]:g.geometry.coordinates;
 const outline=ps.reduce((best,p)=>p[0].length>best.length?p[0]:best,[]);
 Object.assign(r,{id:g.id,name:g.name,sourceId:g.parentId,sourceProvinceId:g.parentId,mapRegionId:g.id,geometry:g.geometry,path:d,d,points:outline,coords:outline,polygon:outline,center:g.center,centroid:g.center,referenceSeat:g.referenceSeat||null,neighbors:g.neighbors,coarse:g.coarse});
 if(!existing){
  const memberNodes=g.accountIds.map(id=>nodes.get(id)),parent=nodes.get(groups.find(x=>x.sourceRegionId===g.parentId).sourceAdminId),pop=memberNodes.reduce((s,n)=>s+(n.populationDetail?.mouths||0),0);
  r.data=aggregate(memberNodes);r.data.accountingLeafIds=g.accountIds;r.data.accountingLeafNames=memberNodes.map(n=>n.name);r.data.legacyFiscalWeight=(template.data?.legacyFiscalWeight??1)*pop/(template.population||template.data?.populationDetail?.mouths||1);
  r.adminBinding=memberNodes.length===1?memberNodes[0].id:'map-group-'+g.id;r.accountingLeafIds=g.accountIds;r.accountingLeafNames=memberNodes.map(n=>n.name);r.data.id=r.adminBinding;r.data.name=g.name;
  r.population=pop;r.troops=Math.round((template.troops||0)*pop/(template.population||template.data?.populationDetail?.mouths||1));r.aliases=[];
 }
 const group=groups.find(x=>x.sourceRegionId===g.parentId);r.parentId=r.circuitId=group.id;r.circuitName=group.name;r.level='prefecture';
 if(splitParents.includes(g.parentId)||g.parentId==='ming2-36'){
  r.geometryPrecision=g.parentId==='ming-28'?'documented-defense-sector-and-modern-island-outline':'same-owner-geographic-subdivision';
  r.geometryNote=g.parentId==='ming-28'?'关宁陆路与东江海岛分离；防区界线为概化推定，海岛采用现代物理岸线，不是1627年测绘。':'在原察哈尔控制区内按地域参照细分；不声称完成蒙古诸部真实国界复原。';
 }
 if(g.id==='ming-28-p08'){r.aliases=['东江镇','皮岛'];r.geometryNote+='铁山、镇江堡、鸭绿江口原账作为东江分项保留，不把这些大陆地点涂为明朝稳控领土。';r.theaterAccountIds=g.accountIds.slice(1);}
 if(g.id==='ming-28-p07')r.geometryNote+='保留原账与战争状态，不据新岛形推定岛上建筑、军民已恢复。';
 return r;
});
for(const pid of splitParents){const a=rows.filter(r=>r.sourceProvinceId===pid),old=oldById.get(pid);a[0].troops+=(old.troops||0)-a.reduce((s,r)=>s+r.troops,0);}
const map=out.map;map.regions=rows;map.locationBindingContract.exactAreaPriority=true;
for(const g of groups){g.memberRegionIds=rows.filter(r=>r.sourceProvinceId===g.sourceRegionId).map(r=>r.id);const parent=nodes.get(g.sourceAdminId);if(parent)parent.mappedRegions=g.memberRegionIds.slice();if(['ming-28','ming2-34','ming2-36'].includes(g.sourceRegionId))g.note='R3府州并集生成省道；关宁防线与海岛按战区校正，察哈尔只改原国界内分区。';}
map.provinceMigration=groups.map(g=>({id:g.sourceRegionId,name:g.name,adminId:g.sourceAdminId,memberRegionIds:g.memberRegionIds}));
map.accountingContract.logicalRegions=rows.length;map.source.logicalRegionCount=rows.length;map.authoringRevision='chongzhen-prefecture-r3';map.id='tianqi-prefecture-refined-r3';
const cellByAccount=new Map(rows.flatMap(r=>r.accountingLeafIds.map(id=>[id,r])));
map.localityLayer=map.localityLayer.map(l=>({...l,regionId:cellByAccount.get(l.localityId)?.id||l.regionId}));
const byName=new Map(rows.map(r=>[r.name,r])),byId=new Map(rows.map(r=>[r.id,r]));
map.roads=(oldMap.roads||[]).filter(r=>byId.has(r.from)&&byId.has(r.to));
function sea(a,b,label){const x=byName.get(a),y=byName.get(b);assert.ok(x&&y,label);map.roads.push({id:'r3-sea-'+x.id+'-'+y.id,from:x.id,to:y.id,type:'sea',distance:Math.hypot(x.center[0]-y.center[0],x.center[1]-y.center[1]),hasPostRoad:false,name:label,note:'游戏化海路，不是陆桥；不表示逐段历史航路已考定。'});}
sea('登州府','皮岛','登莱—东江海路');sea('登州府','宁远城','登莱—宁远海路');sea('宁远城','觉华岛','宁远—觉华岛');sea('觉华岛','皮岛','觉华—东江海路');sea('皮岛','平安道','东江—朝鲜海上联络');
for(const road of map.roads){const a=byId.get(road.from),b=byId.get(road.to);assert.ok(a&&b);a.neighbors=[...new Set(a.neighbors.concat(b.id))];b.neighbors=[...new Set(b.neighbors.concat(a.id))];}
map.locationAliases=(oldMap.locationAliases||[]).filter(a=>byId.has(a.regionId));
function alias(text,id){if(!map.locationAliases.some(a=>a.text===text&&a.regionId===id))map.locationAliases.push({text,regionId:id,source:'R3-original-place-to-current-map'});}
for(const r of rows.filter(r=>splitParents.includes(r.sourceProvinceId))){
 for(const id of r.accountingLeafIds){const name=nodes.get(id).name;if(r.id==='ming-28-p08'&&name!=='皮岛')continue;alias(name,r.id);if(/[城堡]$/.test(name))alias(name.slice(0,-1),r.id);}
}
for(const [text,name]of [['东江','皮岛'],['东江镇','皮岛'],['椵岛','皮岛'],['宁远','宁远城'],['锦州','锦州城'],['山海卫','山海关'],['山海关城','山海关']])alias(text,byName.get(name).id);
map.locationAreas=(oldMap.locationAreas||[]).filter(a=>!a.regionIds.some(id=>!byId.has(id)));
for(const pid of splitParents){const g=groups.find(g=>g.sourceRegionId===pid);for(const text of [g.name,g.sourceRegionId])map.locationAreas.push({text,regionIds:g.memberRegionIds,precision:'area'});}
for(const text of ['铁山','镇江堡','鸭绿江口'])map.locationAreas.push({text,regionIds:['ming-28-p08'],precision:'theater-reference-not-mainland-control'});
map.geographicReferences=(oldMap.geographicReferences||[]).concat(read('geometry-report.json').reports.filter(r=>r.operation==='physical-island').map(r=>({name:r.name,source:r.source,lonLat:r.centroidLonLat,accepted:true,purpose:'physical-island-position'})));
map.refinementNotes={...(oldMap.refinementNotes||{}),revision:'R3',sourceSnapshotSha256:hash(bytes),unchangedCountryCoverage:false,operations:read('geometry-report.json').reports,notSurveyed:true,limits:['土默特及部分蒙古西域政权边界仍沿用原图，不冒充已经全面考定','铁山等东江原账保留，但不附会成朝鲜大陆稳定领土']};
out.mapData=clone(map);
const lean={...map,regions:rows.map(r=>({id:r.id,name:r.name,aliases:r.aliases,factionId:r.factionId}))};const game={mapData:lean,chars:out.characters,armies:out.military.initialTroops,facs:out.factions};
const ctx={GM:game};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(work,'runtime-after/tm-map-locations.js'),'utf8'),ctx);
const locationStats={characters:{},armies:{}};
for(const [kind,key,entities]of [['character','characters',out.characters],['army','armies',out.military.initialTroops]])for(const e of entities){const r=ctx.TMMapLocations.sync(e,kind,game);locationStats[key][r.status]=(locationStats[key][r.status]||0)+1;}
for(const city of out.cities||[]){const r=ctx.TMMapLocations.resolveText(city.name,lean,{factionId:out.factions.find(f=>f.name==='明朝廷').id},'city',game);if(r.regionId)city.mapRegionId=r.regionId;else if(city.mapRegionId&&!byId.has(city.mapRegionId))delete city.mapRegionId;}
map.source.id='tianqi-prefecture-r3-guanning-steppe';map.source.precision='inferred-defense-corridor-modern-island-outline-and-same-owner-subdivision';out.mapData=clone(map);
const legacy=read('legacy-source.json'),allowedTop=new Set(['map','mapData','adminHierarchy','characters','military','cities']);
for(const k of Object.keys(before))if(!allowedTop.has(k))assert.deepEqual(out[k],before[k],k);
for(const key of ['characters','cities'])legacy[key].forEach((c,i)=>{for(const k of Object.keys(c))assert.deepEqual(out[key][i][k],c[k],key+' '+i+' '+k);});
legacy.military.initialTroops.forEach((a,i)=>{for(const k of Object.keys(a))assert.deepEqual(out.military.initialTroops[i][k],a[k],a.name+' '+k);});
function flat(tree){const index=new Map();function scan(n){index.set(n.id,n);(n.children||[]).forEach(scan);}Object.values(tree).forEach(r=>(r.divisions||[]).forEach(scan));return index;}
const current=flat(out.adminHierarchy),old=flat(before.adminHierarchy);
for(const [id,n]of old){const after=current.get(id);assert.ok(after,id);for(const k of Object.keys(n))if(!['children','mapRegionId','mappedRegions','mapAccounting','sourceMapRegionId'].includes(k))assert.deepEqual(after[k],n[k],n.name+' '+k);}
const leafCount=[...current.values()].filter(n=>n.populationDetail&&!n.children?.length).length;assert.equal(leafCount,382);assert.equal(rows.length,307);assert.deepEqual(out.map,out.mapData);
const candidate=JSON.stringify(out)+'\n';fs.writeFileSync(path.join(work,'candidate.json'),candidate);
const neutral={id:map.id,width:map.width,height:map.height,projection:read('calibration.json'),regions:rows.map(r=>({id:r.id,name:r.name,level:r.level,parentId:r.parentId,geometry:r.geometry,center:r.center,referenceSeat:r.referenceSeat,neighbors:r.neighbors,precision:r.geometryPrecision,coarse:r.coarse})),provinceGroups:groups.map(g=>({id:g.id,name:g.name,memberRegionIds:g.memberRegionIds}))};
fs.writeFileSync(path.join(work,'neutral-map.json'),JSON.stringify(neutral)+'\n');
fs.writeFileSync(path.join(work,'map-bindings.json'),JSON.stringify({scenarioId:out.id,mapId:map.id,regions:rows.map(r=>({id:r.id,parentId:r.parentId,owner:r.owner,adminBinding:r.adminBinding,accountingLeafIds:r.accountingLeafIds})),locationAliases:map.locationAliases,locationAreas:map.locationAreas},null,2));
const report={createdAt:new Date().toISOString(),sourceSha256:hash(bytes),candidateSha256:hash(candidate),regions:rows.length,groups:groups.length,accounts:leafCount,mappedAccountIds:new Set(rows.flatMap(r=>r.accountingLeafIds)).size,coarse:rows.filter(r=>r.coarse).map(r=>r.name),locationStats,originalFieldsPreserved:true};
fs.writeFileSync(path.join(work,'candidate-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
