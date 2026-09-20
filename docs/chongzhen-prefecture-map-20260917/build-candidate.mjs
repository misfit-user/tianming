// Build from the untouched official narrative/account records; never from a generated bundle.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import vm from 'node:vm';import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),clone=x=>structuredClone(x);
const raw=fs.readFileSync(path.join(work,'source-before.json')),before=JSON.parse(raw),out=clone(before);
const geometry=JSON.parse(fs.readFileSync(path.join(work,'prefecture-geometry.json'),'utf8'));
const oldParents=new Map(before.map.regions.map(r=>[r.id,r])),parents=new Map(),leaves=new Map(),rootByLeaf=new Map();
function scan(node,rootKey,parent){if(node.children?.length){if(oldParents.has(node.mapRegionId))parents.set(node.mapRegionId,node);for(const child of node.children)scan(child,rootKey,node);}else{leaves.set(node.id,node);rootByLeaf.set(node.id,rootKey);}}
for(const [key,value]of Object.entries(out.adminHierarchy))for(const n of value.divisions||[])scan(n,key,null);
assert.equal(leaves.size,382);assert.equal(geometry.length,284);
const accountMap=new Map(),logicalAdmin=new Map();
for(const r of geometry){
 const parent=parents.get(r.parentId),nodes=r.accountIds.map(id=>leaves.get(id));assert.ok(parent&&nodes.every(Boolean),r.name);
 for(const n of nodes){n.sourceMapRegionId=n.mapRegionId;n.mapRegionId=r.id;n.mappedRegions=[r.id];accountMap.set(n.id,r.id);}
 if(r.coarse){parent.mapAccounting={schema:'source-partition-v1',logicalRegionId:r.id,group:true};logicalAdmin.set(r.id,parent);}
 else if(nodes.length===1){nodes[0].mapAccounting={schema:'source-partition-v1',sourceAccountId:nodes[0].id,logicalRegionId:r.id,weight:1};logicalAdmin.set(r.id,nodes[0]);}
 else {
  const group={id:'map-group-'+r.id,name:r.name+'·原账分项',type:'地域核算组',mapRegionId:r.id,mapAccounting:{schema:'source-partition-v1',logicalRegionId:r.id,group:true},children:nodes};
  const first=parent.children.findIndex(n=>n.id===nodes[0].id);parent.children=parent.children.filter(n=>!nodes.some(x=>x.id===n.id));parent.children.splice(Math.max(0,first),0,group);logicalAdmin.set(r.id,group);
 }
}
const registry=before.map.regions.map(r=>({id:'cz-province-'+r.id,key:'cz-province-'+r.id,name:r.name,level:'province',kind:'inherited-province-or-regional-group',sourceRegionId:r.id,sourceAdminId:parents.get(r.id)?.id,memberRegionIds:geometry.filter(g=>g.parentId===r.id).map(g=>g.id),accounting:'derived-view-only',geometrySource:'exact-union-of-subdivided-source-outline',note:'继承原官方省道轮廓；不改写原剧本政治控制与财政。'}));
for(const [id,parent]of parents){parent.mappedRegions=geometry.filter(r=>r.parentId===id).map(r=>r.id);}
const rates=new Set(['ratio','sexRatio','compliance','skimmingRate','autonomy','autonomyLevel','commerceCoefficient','roadQuality','climate','currentLoad','minxin','minxinLocal','corruption','corruptionLocal','prosperity','unrest']);
function aggregate(nodes){
 if(nodes.length===1){const v=clone(nodes[0]);delete v.children;return v;}
 const pop=nodes.map(n=>n.populationDetail?.mouths||n.population||1),sum=pop.reduce((a,b)=>a+b,0);
 function fold(values,key){if(values.every(v=>typeof v==='number'))return rates.has(key)?values.reduce((s,v,i)=>s+v*pop[i],0)/sum:values.reduce((s,v)=>s+v,0);
  if(values.every(v=>v&&typeof v==='object'&&!Array.isArray(v))){const result={};for(const k of new Set(values.flatMap(v=>Object.keys(v)))){if(k==='children'||k==='mapAccounting')continue;result[k]=fold(values.map(v=>v[k]),k);}return result;}return clone(values.find(v=>v!==undefined)??null);}
 return fold(nodes,'');
}
function pathFor(g){const ps=g.type==='Polygon'?[g.coordinates]:g.coordinates;return ps.flatMap(p=>p.map(r=>'M'+r.map(q=>q.map(v=>Number(v.toFixed(7))).join(' ')).join(' L')+' Z')).join(' ');}
const rows=geometry.map(g=>{
 const old=oldParents.get(g.parentId),nodes=g.accountIds.map(id=>leaves.get(id)),data=aggregate(nodes),parent=parents.get(g.parentId),reg=registry.find(p=>p.sourceRegionId===g.parentId);
 const ps=g.geometry.type==='Polygon'?[g.geometry.coordinates]:g.geometry.coordinates;const outline=ps.reduce((a,p)=>p[0].length>a.length?p[0]:a,[]);const d=pathFor(g.geometry);
 const ownerFields=Object.fromEntries(Object.entries(old).filter(([k])=>/^(owner|initialOwner|currentOwner|controller|ownerKey|initialOwnerKey|currentOwnerKey|controllerKey|stableFactionId|factionId|factionName|ownerName|factionColor|color)$/.test(k)));
 const parentPop=geometry.filter(x=>x.parentId===g.parentId).flatMap(x=>x.accountIds).reduce((sum,id)=>sum+(leaves.get(id).populationDetail?.mouths||leaves.get(id).population||0),0)||1,pop=data.populationDetail?.mouths||data.population||0;
 data.accountingLeafIds=g.accountIds;data.accountingLeafNames=nodes.map(n=>n.name);data.legacyFiscalWeight=pop/parentPop;data.name=g.name;data.id=logicalAdmin.get(g.id).id;
 return {id:g.id,sourceId:old.id,sourceProvinceId:old.id,name:g.name,type:'poly',level:'prefecture',parentId:reg.id,circuitId:reg.id,circuitName:reg.name,geometry:g.geometry,path:d,d,points:outline,coords:outline,polygon:outline,center:g.center,centroid:g.center,referenceSeat:g.referenceSeat||null,neighbors:g.neighbors,...ownerFields,terrain:old.terrain,resources:clone(old.resources||[]),development:data.prosperity??old.development,prosperity:data.prosperity??old.prosperity,troops:Math.round((old.troops||0)*pop/parentPop),population:pop,mood:data.minxinLocal??old.mood,unrest:data.unrest??old.unrest,taxPressure:old.taxPressure,armyPressure:old.armyPressure,officeRisk:old.officeRisk,mutable:true,mutableFields:clone(old.mutableFields||[]),ownerHistory:[],adminBinding:logicalAdmin.get(g.id).id,mapRegionId:g.id,accountingLeafIds:g.accountIds,accountingLeafNames:nodes.map(n=>n.name),data,geometryPrecision:g.coarse?'inherited-regional-outline':'geographic-constraint-inference',coarse:g.coarse,geometryNote:g.reason||'治所及概化山系约束分区；不是测绘府界。',aliases:g.originalName&&g.originalName!==g.name?[g.originalName]:[]};
});
// Reconcile static display troop allocation per parent; this never creates or changes a unit.
for(const old of before.map.regions){const group=rows.filter(r=>r.sourceProvinceId===old.id);const delta=(old.troops||0)-group.reduce((s,r)=>s+r.troops,0);if(group.length)group[0].troops+=delta;}
const newmap={...clone(before.map),regions:rows,circuitRegistry:registry,hierarchyPresentation:{version:1,levels:['realm','region','prefecture'],leafLevel:'prefecture',provinceMode:'circuitRegistry-union',regionAccounting:'original-account-leaves',ownershipPolicy:'partition-by-current-owner'}};
newmap.sourceBudgetModel='source-partition-v1';newmap.accountingContract={schema:'source-partition-v1',sourceAccounts:382,logicalRegions:rows.length,requiresRuntimeSupport:true,sourceSha256:hash(raw)};
newmap.provinceMigration=registry.map(p=>({id:p.sourceRegionId,name:p.name,adminId:p.sourceAdminId,memberRegionIds:p.memberRegionIds}));
newmap.source={id:'tianqi-prefecture-inherited-provinces-v1',sourceScenario:'scenarios/天启七年·九月（官方）.json',sourceSha256:hash(raw),sourceProvinceCount:43,logicalRegionCount:rows.length,precision:'original-province-unions-and-inferred-prefecture-boundaries'};
newmap.localityLayer=(before.map.localityLayer||[]).map(row=>({...row,sourceProvinceId:row.regionId,regionId:accountMap.get(row.localityId)||row.regionId}));
const ming=before.factions.find(f=>f.name==='明朝廷'),emperor=before.characters.find(c=>c.name==='朱由检');
const byName=new Map(rows.map(r=>[r.name,r]));const aliases=[];
newmap.roads=[];
for(const [a,b,label]of [['雷州府','琼州府','琼州海峡'],['登州府','辽东（明·关宁东江）','登莱—辽西海路'],['泉州府','大员','闽台海路'],['大坂','阿波','纪淡海峡'],['京都','小仓','濑户内—关门海路'],['仙台','松前','津轻海峡'],['松前','苦兀（野人女真）','北方沿海航段']]){
 const x=byName.get(a),y=byName.get(b);if(!x||!y)continue;
 x.neighbors=[...new Set(x.neighbors.concat(y.id))];y.neighbors=[...new Set(y.neighbors.concat(x.id))];
 newmap.roads.push({id:'sea-'+x.id+'-'+y.id,from:x.id,to:y.id,type:'sea',distance:3,hasPostRoad:false,name:label,note:'游戏化航段，不是陆桥或精确历史航线'});
}
function alias(text,name,factionId){const r=byName.get(name);if(r)aliases.push({text,regionId:r.id,...(factionId?{factionId}:{}),source:'original-gazetteer-correspondence'});}
for(const r of rows)for(const id of r.accountingLeafIds)alias(leaves.get(id).name,r.name);
for(const r of rows){for(const id of r.accountingLeafIds){const n=leaves.get(id).name;if(/[府州城镇卫]$/.test(n)&&n.length>=3&&!byName.has(n.slice(0,-1)))alias(n.slice(0,-1),r.name);}}
for(const text of ['京师','北京','紫禁城','乾清宫','坤宁宫','慈宁宫','京城','司礼监'])alias(text,'顺天府',ming.id);
for(const [text,name]of [['蓟州','顺天府'],['通州','顺天府'],['天津三卫','河间府'],['固原','平凉府'],['山海卫','辽东（明·关宁东江）'],['南京','应天府'],['登莱','登州府'],['榆林','榆林镇'],['延绥','榆林镇'],['大员城','大员'],['汉城','京畿道'],['平壤','平安道'],['江户城','江户'],['大阪','大坂']])alias(text,name);
newmap.locationBindingContract={schema:'source-text-location-v2',revision:1,courtFactionId:ming.id,courtCharacterId:emperor.id,courtStartRegionId:byName.get('顺天府').id,policy:'原文保留，现居与目的地分离；粗区不是精确城址。'};
newmap.locationAliases=aliases;
newmap.locationAreas=registry.flatMap(p=>[p.name,parents.get(p.sourceRegionId)?.name,p.sourceRegionId].filter(Boolean).map(text=>({text,regionIds:p.memberRegionIds,precision:'province'})));
for(const [text,pid]of [['福建沿海','ming-04'],['广东沿海','ming-05'],['台海','ming-30'],['辽东','ming-28']]){const p=registry.find(r=>r.sourceRegionId===pid);newmap.locationAreas.push({text,regionIds:p.memberRegionIds,precision:'area'});}
newmap.authoringRevision='chongzhen-prefecture-v1';newmap.enabled=true;
out.map=newmap;out.mapData=clone(newmap);
const lean={...newmap,regions:rows.map(r=>({id:r.id,name:r.name,aliases:r.aliases,owner:r.owner,factionId:r.factionId})),basemap:null};
const game={mapData:lean,chars:out.characters,armies:out.military.initialTroops,facs:out.factions};
const ctx={GM:game};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(root,'web/tm-map-locations.js'),'utf8'),ctx);
const locStats={characters:{},armies:{}};const locations=[];
for(const [kind,key,entities]of [['character','characters',out.characters],['army','armies',out.military.initialTroops]])for(const entity of entities){const result=ctx.TMMapLocations.sync(entity,kind,game);locStats[key][result.status]=(locStats[key][result.status]||0)+1;locations.push({kind,name:entity.name,text:result.sourceText,status:result.status,regionId:result.regionId||null,candidates:result.candidateRegionIds});}
for(const city of out.cities||[]){const match=ctx.TMMapLocations.resolveText(city.name,lean,{factionId:ming.id},'city',game);if(match.regionId)city.mapRegionId=match.regionId;}
const allowed=new Set(['map','mapData','adminHierarchy','characters','military','cities']);for(const k of Object.keys(before))if(!allowed.has(k))assert.deepEqual(out[k],before[k],k);
for(const key of ['characters','cities'])for(let i=0;i<(before[key]||[]).length;i++)for(const k of Object.keys(before[key][i]))assert.deepEqual(out[key][i][k],before[key][i][k],key+' '+i+' '+k);
for(let i=0;i<48;i++)for(const k of Object.keys(before.military.initialTroops[i]))assert.deepEqual(out.military.initialTroops[i][k],before.military.initialTroops[i][k],i+' army '+k);
assert.deepEqual(out.map,out.mapData);
const bytes=JSON.stringify(out)+'\n';fs.writeFileSync(path.join(work,'candidate.json'),bytes);
const neutral={id:'tianqi-prefecture-base-v1',width:newmap.width,height:newmap.height,projection:JSON.parse(fs.readFileSync(path.join(work,'calibration.json'),'utf8')),regions:rows.map(r=>({id:r.id,name:r.name,level:r.level,parentId:r.parentId,geometry:r.geometry,center:r.center,referenceSeat:r.referenceSeat,neighbors:r.neighbors,precision:r.geometryPrecision,coarse:r.coarse})),provinceGroups:registry.map(p=>({id:p.id,name:p.name,memberRegionIds:p.memberRegionIds}))};
fs.writeFileSync(path.join(work,'neutral-map.json'),JSON.stringify(neutral)+'\n');
fs.writeFileSync(path.join(work,'map-bindings.json'),JSON.stringify({scenarioId:out.id,mapId:neutral.id,regions:rows.map(r=>({id:r.id,parentId:r.parentId,owner:r.owner,adminBinding:r.adminBinding,accountingLeafIds:r.accountingLeafIds})),locationAliases:aliases,locationAreas:newmap.locationAreas},null,2));
const report={sourceSha256:hash(raw),candidateSha256:hash(bytes),bytes:Buffer.byteLength(bytes),regions:rows.length,provinces:registry.length,accounts:382,mappedAccounts:accountMap.size,unmappedAccounts:[...leaves.values()].filter(n=>!accountMap.has(n.id)).map(n=>({id:n.id,name:n.name})),locStats,locations};fs.writeFileSync(path.join(work,'candidate-report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,locations:undefined,unmappedAccounts:report.unmappedAccounts.length},null,2));
