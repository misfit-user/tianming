// Map migration candidate builder. This script does not replace the official file.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {anchors,quantityRoots,quantityNames,ratioNames,deployment} from './mapping-spec.mjs';
const root=path.resolve(process.argv[2]||'.');
const work=process.env.SHAOSONG_STAGE || path.join(root,'docs/shaosong-map-integration-20260917/map-stage');
const sourcePath=process.env.SHAOSONG_SOURCE || path.join(root,'scenarios/绍宋·建炎元年八月（官方）.json');
const input=process.env.SHAOSONG_MAP || path.join(root,'docs/shaosong-map-integration-20260917/input-r6-map/shaosong-r6.map-only.json');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex'), clone=x=>structuredClone(x);
const raw=fs.readFileSync(sourcePath), original=JSON.parse(raw), out=clone(original), mapRaw=fs.readFileSync(input), map=JSON.parse(mapRaw);
assert.equal(map.regions.length,566); assert.equal(original.map.regions.length,182,'Use preserved original, not a migrated map.');
assert.equal(hash(mapRaw),'96bc2fee63879aa5c51619bd1ab6436a9c6462fe65612303babcf429c8816925');
const facs=new Map(out.factions.map(f=>[f.id,f])), cells=new Map(map.regions.map(r=>[r.id,r]));
const accounts=[];
function scan(n,owner,parent){if(n.children?.length){n.children.forEach(x=>scan(x,owner,n));return;}if(n.populationDetail)accounts.push({id:n.id||n.mapRegionId,owner,node:n,parent,targets:[]});}
Object.entries(original.adminHierarchy).forEach(([key,v])=>(v.divisions||[]).forEach(n=>scan(n,key==='player'?'fac_song':key,null)));
assert.equal(accounts.length,182); assert.equal(new Set(accounts.map(a=>a.id)).size,182);
const coordinate=r=>r.referenceSeat||r.center;
const distance=(a,b)=>{const x=coordinate(a),y=coordinate(b);return (x[0]-y[0])**2+(x[1]-y[1])**2;};
for(const a of accounts){const owned=map.regions.filter(r=>r.factionId===a.owner),target=anchors[a.node.name];
 const hits=target?owned.filter(r=>r.name===target):owned.filter(r=>a.node.name.endsWith(r.name)||a.node.name.includes(r.name)||r.name.includes(a.node.name));
 hits.sort((x,y)=>y.name.length-x.name.length||x.id.localeCompare(y.id));
 assert.ok(hits.length,'Missing reviewed anchor: '+a.node.name);a.anchor=hits[0];a.anchorMethod=target?'reviewed-correspondence':'same-owner-name';}
const japanCircuit={'畿内':'畿内','东海道':'东海道','东山道':'东山道·陆奥','北陆道':'北陆道','山阴道':'山阳道·山阴道','山阳道':'山阳道·山阴道','南海道':'南海道·四国','西海道':'西海道·大宰府'};
for(const r of map.regions){let candidates=accounts.filter(a=>a.owner===r.factionId);assert.ok(candidates.length,'Missing original owner '+r.factionId);
 const exact=candidates.filter(a=>a.anchor.id===r.id);if(exact.length)candidates=exact;
 else if(r.factionId==='fac_song'){const matching=candidates.filter(a=>a.node.name.startsWith(r.circuitName+'·'));if(matching.length)candidates=matching;
 else if(/^淮南/.test(r.circuitName))candidates=candidates.filter(a=>a.node.name==='京东两路·东平济南青州');}
 else if(r.factionId==='fac_japan'&&japanCircuit[r.circuitName])candidates=candidates.filter(a=>a.node.name===japanCircuit[r.circuitName]);
 candidates.sort((a,b)=>distance(r,a.anchor)-distance(r,b.anchor)||a.id.localeCompare(b.id));candidates[0].targets.push(r.id);}
for(const a of accounts)if(!a.targets.length)a.targets.push(a.anchor.id);
function area(r){const ps=r.geometry.type==='Polygon'?[r.geometry.coordinates]:r.geometry.coordinates;
 const ring=x=>Math.abs(x.reduce((s,p,i)=>{const q=x[(i+1)%x.length];return s+p[0]*q[1]-p[1]*q[0];},0))/2;
 return ps.reduce((s,p)=>s+ring(p[0])-p.slice(1).reduce((t,h)=>t+ring(h),0),0);}
function additive(p){const k=p.at(-1);return quantityRoots.includes(p[0])||p.length===1&&quantityNames.has(k)||['fiscalDetail','economyBase','armyDetail','militaryDetail'].includes(p[0])&&!ratioNames.has(k);}
function precision(p){return p[0]==='economyBase'&&!p.includes('imperialAssets')&&!['postRelays','kejuQuota'].includes(p.at(-1))?1e6:1;}
function allocate(value,weights,scale){const sign=value<0?-1:1,total=Math.round(Math.abs(value)*scale),sum=weights.reduce((a,b)=>a+b,0);
 const ideal=weights.map(w=>total*w/sum),res=ideal.map(Math.floor);let left=total-res.reduce((a,b)=>a+b,0);
 ideal.map((n,i)=>({i,f:n-res[i]})).sort((a,b)=>b.f-a.f||a.i-b.i).slice(0,left).forEach(x=>res[x.i]++);
 return res.map(n=>sign*n/scale);}
const parts=new Map(map.regions.map(r=>[r.id,[]])), allocations=[];
for(const a of accounts){a.targets.sort();const weights=a.targets.map(id=>Math.max(1e-8,area(cells.get(id)))),sum=weights.reduce((x,y)=>x+y,0);
 const nodes=a.targets.map(()=>clone(a.node));
 function split(v,p=[]){if(typeof v==='number'&&additive(p)){const values=allocate(v,weights,precision(p));values.forEach((x,i)=>{let dest=nodes[i];for(const k of p.slice(0,-1))dest=dest[k];dest[p.at(-1)]=x;});}
 else if(v&&typeof v==='object'&&!Array.isArray(v))Object.entries(v).forEach(([k,x])=>split(x,p.concat(k)));}
 split(a.node);
 nodes.forEach((n,i)=>{const rid=a.targets[i],r=cells.get(rid),weight=weights[i]/sum;n.id=rid+'::'+a.id;n.name=r.name+'·'+a.node.name+'核算项';n.mapRegionId=rid;
 n.owner=n.currentOwner=n.controller=facs.get(a.owner).name;n.factionId=n.ownerFactionId=n.controllerFactionId=a.owner;
 n.mapAccounting={schema:'source-partition-v1',sourceAccountId:a.id,sourceAccountName:a.node.name,logicalRegionId:rid,weight,anchor:a.anchor.id,method:a.anchorMethod};
 parts.get(rid).push(n);allocations.push({sourceId:a.id,sourceName:a.node.name,sourceFactionId:a.owner,targetId:rid,targetName:r.name,weight,anchorMethod:a.anchorMethod});});}
function sumField(parts,p){return parts.reduce((total,n)=>{let v=n;for(const k of p)v=v?.[k];return total+(typeof v==='number'?v:0);},0);}
function summary(ns,r){const d=clone(ns[0]);delete d.mapAccounting;delete d.children;
 function fold(v,p=[]){if(p[0]==='mapAccounting')return;if(typeof v==='number'){let dst=d;for(const k of p.slice(0,-1))dst=dst[k];if(additive(p))dst[p.at(-1)]=sumField(ns,p);
 else{const pop=sumField(ns,['populationDetail','mouths']);dst[p.at(-1)]=ns.reduce((s,n)=>{let x=n;for(const k of p)x=x?.[k];return s+Number(x||0)*n.populationDetail.mouths;},0)/Math.max(1,pop);}}
 else if(v&&typeof v==='object'&&!Array.isArray(v))Object.entries(v).forEach(([k,x])=>fold(x,p.concat(k)));}fold(ns[0]);
 d.id=r.id;d.name=r.name;d.mapRegionId=r.id;d.aliases=clone(r.aliases||[]);d.accountingLeafIds=ns.map(n=>n.id);d.accountingLeafNames=ns.map(n=>n.name);
 d.accountingNote='依原地区逐项分配；多个原账在子项分别保留，不以全国均值替代。分配份额是地图适配参数，非新增历史统计。';return d;}
for(const [key,rootNode]of Object.entries(out.adminHierarchy)){const owner=key==='player'?'fac_song':key;
 const container=clone(rootNode.divisions[0]);delete container.population;delete container.populationDetail;delete container.economyBase;delete container.publicTreasuryInit;
 container.children=map.regions.filter(r=>r.factionId===owner).map(r=>{const ns=parts.get(r.id);assert.ok(ns.length);
 if(ns.length===1){const n=ns[0];n.id=r.id;n.name=r.name;n.aliases=clone(r.aliases||[]);return n;}
 return {id:r.id,name:r.name,type:'地域核算组',mapRegionId:r.id,owner:facs.get(owner).name,currentOwner:facs.get(owner).name,factionId:owner,ownerFactionId:owner,controllerFactionId:owner,mapAccounting:{schema:'source-partition-v1',logicalRegionId:r.id,group:true},children:ns};});
 rootNode.divisions=[container];}
map.factions={};for(const f of out.factions){const old=Object.values(original.map.factions||{}).find(x=>x.id===f.id||x.scenarioFactionName===f.name)||{};
 map.factions[f.id]={...clone(old),id:f.id,key:f.id,label:f.name,name:f.name,short:f.name,scenarioFactionName:f.name,color:old.color||f.color||'#808080'};}
for(const r of map.regions){const ns=parts.get(r.id),d=summary(ns,r),owner=facs.get(r.factionId);r.data=d;r.adminBinding=r.id;r.mapRegionId=r.id;
 r.factionName=r.ownerName=owner.name;r.color=r.factionColor=map.factions[owner.id].color;r.mutable=true;
 r.accountingLeafIds=ns.map(n=>n.id);r.accountingLeafNames=ns.map(n=>n.name);r.accountingSourceIds=ns.map(n=>n.mapAccounting.sourceAccountId);
 r.data.accountingLeafIds=clone(r.accountingLeafIds);r.data.accountingLeafNames=clone(r.accountingLeafNames);r.data.legacyFiscalWeight=ns.reduce((s,n)=>s+n.mapAccounting.weight,0);
 r.population=d.population;r.populationDetail=clone(d.populationDetail);r.troops=d.troops;r.mood=d.minxinLocal;r.development=d.prosperity;
 r.prosperity=d.prosperity;r.unrest=d.unrest;r.armyPressure=d.armyPressure;r.taxBurden=d.taxBurden;r.ownerHistory=[];}
map.runtimeContract=clone(original.map.runtimeContract||{});map.sourceBudgetModel='source-partition-v1';
map.accountingContract={schema:'source-partition-v1',sourceSha256:hash(raw),sourceAccounts:accounts.length,logicalRegions:map.regions.length,requiresRuntimeSupport:true};
map.source='shaosong-r6-geometry-original-account-preserving';delete map._integrationContract;
out.map=map;out.mapData=clone(map);
// Preserve original literary locations/deployment strings. Never fill unknown characters at faction centres.
const aliases={'汴京':'开封府','东京':'开封府','南京应天府':'应天府','应天府(南京)':'应天府','亳州':'亳州','明道宫':'亳州','九龙井':'亳州','临安府':'杭州','建康府':'江宁府','建康':'江宁府','襄阳':'襄阳府','太原':'太原府','大同府':'云州','燕山府':'燕京','中兴府':'兴庆府','大理国':'大理','平江':'平江府','越州(绍兴府)':'越州','明州(庆元)':'明州'};
const refs=[],ambiguous=[];
function locate(text){if(typeof text!=='string')return null;const clean=text.replace(/[（]/g,'(').replace(/[）]/g,')');
 let found=map.regions.filter(r=>r.id===clean||r.name===clean);if(found.length===1)return {region:found[0],method:'exact-name'};
 const hints=[...Object.entries(aliases).filter(([a])=>a.length>=2&&clean.includes(a)).map(([a,n])=>({key:a,name:n})),...map.regions.filter(r=>r.name.length>=2&&clean.includes(r.name)).map(r=>({key:r.name,name:r.name}))];
 hints.sort((a,b)=>b.key.length-a.key.length);if(!hints.length)return null;const top=hints.filter(h=>h.key.length===hints[0].key.length);const names=new Set(top.map(h=>h.name));
 if(names.size!==1)return null;found=map.regions.filter(r=>r.name===[...names][0]);return found.length===1?{region:found[0],method:'original-text-alias'}:null;}
for(const c of out.characters){const hit=locate(c.location);if(hit&&!c.regionId){c.regionId=c.mapRegionId=hit.region.id;c.mapLocationBinding={method:hit.method,originalText:c.location};refs.push({kind:'character',id:c.id,name:c.name,text:c.location,target:hit.region.id});}
 else if(!hit)ambiguous.push({kind:'character',id:c.id,name:c.name,text:c.location||'',reason:'原文没有唯一可定位地名；未移至势力中心'});}
for(const a of out.military.initialTroops){const representative=deployment[a.garrison];const hit=representative?{region:map.regions.find(r=>r.name===representative),method:'explicit-regional-representative-not-exact-camp'}:locate(a.garrison);if(hit){a.regionId=a.garrisonRegionId=hit.region.id;a.mapLocationBinding={method:hit.method,originalText:a.garrison};refs.push({kind:'army',name:a.name,text:a.garrison,target:hit.region.id});}
 else ambiguous.push({kind:'army',name:a.name,text:a.garrison,reason:'宽泛或多点驻地，保留原文，不虚构单点'});}
for(const c of out.cities||[]){const hit=locate(c.name);if(hit&&!c.regionId)c.regionId=hit.region.id;}
for(const ref of refs.filter(r=>r.kind==='army')){const r=cells.get(ref.target);r.data.aliases=[...new Set([...(r.data.aliases||[]),ref.text])];map.localityLayer.push({id:'alias-'+ref.target+'-'+map.localityLayer.length,regionId:ref.target,localityName:ref.text,x:r.center[0],y:r.center[1],source:'original-garrison-text'});}
out.mapData=clone(map);
for(const force of out.externalForces||[])for(const row of force.territorySummary?.keyRegions||[]){const a=accounts.find(x=>x.id===row.id);if(a){row.originalMapRegionId=row.id;row.id=a.anchor.id;row.mapRegionIds=clone(a.targets);}}
const exactKeys=Object.keys(original).filter(k=>!['map','mapData','adminHierarchy','characters','military','cities','externalForces'].includes(k));
for(const k of exactKeys)assert.deepEqual(out[k],original[k],k+' changed');
for(const k of ['characters','cities'])for(let i=0;i<(original[k]||[]).length;i++)for(const field of Object.keys(original[k][i]))assert.deepEqual(out[k][i][field],original[k][i][field],k+'.'+i+'.'+field);
for(let i=0;i<original.military.initialTroops.length;i++)for(const k of Object.keys(original.military.initialTroops[i]))assert.deepEqual(out.military.initialTroops[i][k],original.military.initialTroops[i][k],'army '+i+' '+k);
for(const a of accounts){const ns=[...parts.values()].flat().filter(n=>n.mapAccounting.sourceAccountId===a.id);
 function verify(v,p=[]){if(typeof v==='number'&&additive(p))assert.ok(Math.abs(sumField(ns,p)-v)<1e-5,a.id+' '+p.join('.')+' quantity changed');
 else if(v&&typeof v==='object'&&!Array.isArray(v))Object.entries(v).forEach(([k,x])=>verify(x,p.concat(k)));
 else if(p.length&&!['name','id','mapRegionId'].includes(p.join('.'))){for(const n of ns){let got=n;for(const k of p)got=got?.[k];assert.deepEqual(got,v,a.id+' '+p.join('.')+' state changed');}}}verify(a.node);}
fs.mkdirSync(work,{recursive:true});const candidate=JSON.stringify(out)+'\n';
fs.writeFileSync(path.join(work,'candidate.json'),candidate);fs.writeFileSync(path.join(work,'source-before.json'),raw);
const report={state:'candidate-not-applied',sourceSha256:hash(raw),candidateSha256:hash(candidate),mapSha256:hash(mapRaw),logicalRegions:map.regions.length,circuits:map.circuitRegistry.length,sourceAccounts:accounts.length,
 accountingLeaves:[...parts.values()].flat().length,multiAccountRegions:[...parts.values()].filter(a=>a.length>1).length,characters:out.characters.length,armies:out.military.initialTroops.length,events:out.events.length,
 originalTopLevelValuesPreserved:exactKeys,allocations,locationReferences:refs,unresolvedLocations:ambiguous};
fs.writeFileSync(path.join(work,'migration-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,allocations:allocations.length,locationReferences:refs.length,unresolvedLocations:ambiguous.reduce((o,x)=>(o[x.kind]=(o[x.kind]||0)+1,o),{})},null,2));
