import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),work=path.join(root,'docs/shaosong-map-integration-20260917/location-stage');
const raw=fs.readFileSync(path.join(work,'source-before.json')),s=JSON.parse(raw);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const regions=s.map.regions,named=new Map(regions.map(r=>[r.name,r]));
const beforeRegionHash=hash(JSON.stringify(regions)),changes=[];
const contract={schema:'source-text-location-v2',revision:1,courtFactionId:'fac_song',courtCharacterId:'char_jianyan1_01',courtStartRegionId:named.get('亳州').id,policy:'保留原所在地文字；区分明确地块、地区范围、原部署参考点与未定位；不能把目的地当当前位置。'};
const aliases=[];
function alias(text,name,factionId){const r=named.get(name);assert.ok(r,'Unknown map name '+name);aliases.push({text,regionId:r.id,...(factionId?{factionId}:{}),source:'original-location-map-name-correspondence'});}
for(const pair of `汴京=开封府;汴梁=开封府;东京=开封府;南京应天府=应天府;应天=应天府;临安府=杭州;临安=杭州;钱塘=杭州;建康府=江宁府;建康=江宁府;大同府=云州;大同=云州;云中=云州;东京辽阳=辽阳府;东京辽阳府=辽阳府;上京会宁府=会宁;上京=会宁;会宁府=会宁;中兴府=兴庆府;善阐=鄯阐府;鄯阐=鄯阐府;札布让=扎不让;怛逻斯=怛罗斯;捕鱼儿海=捕鱼儿海子;土拉河黑林=土兀剌河;克鲁伦河=怯绿连河;混同江下游=黑水下游诸部;宿务岛=宿务诸邦;班乃岛=班乃诸邦`.split(';')){const [text,name]=pair.split('=');alias(text,name);}
for(const text of ['京','京都','鳥羽殿','鸟羽殿','内里'])alias(text,'山城国','fac_japan');
for(const r of regions){if(r.factionId==='fac_japan'&&r.name.endsWith('国')&&r.name.length>=3)alias(r.name.slice(0,-1),r.name,'fac_japan');else if(r.name.endsWith('府')&&r.name.length>=3){const text=r.name.slice(0,-1);if(!named.has(text))alias(text,r.name);}}
const areas=[];function area(text,filter){const ids=regions.filter(filter).map(r=>r.id);if(ids.length>1)areas.push({text,regionIds:ids,precision:'area'});}
for(const name of new Set(regions.map(r=>r.circuitName).filter(Boolean)))area(name,r=>r.circuitName===name);
const groups={河北:/^河北/,河东:/^河东/,京东:/^京东/,淮南:/^淮南/,江淮:/^(淮南|江南东)/,京西:/^京西/,江西:/^江南西/,江南:/^江南/,两浙:/^两浙/,福建:/^福建/,荆湖:/^荆湖/,川峡:/^(成都府|潼川府|利州|夔州)/,四川:/^(成都府|潼川府|利州|夔州)/,陕西:/^(永兴军|秦凤|泾原|环庆|鄜延|熙河)/,关陕:/^(永兴军|秦凤|泾原|环庆|鄜延|熙河)/,川陕:/^(成都府|潼川府|利州|夔州|永兴军|秦凤|泾原|环庆|鄜延|熙河)/,泾原:/^泾原/,熙河:/^熙河/,山东:/^京东/};
for(const [name,re]of Object.entries(groups))area(name,r=>re.test(r.circuitName||''));
area('流求',r=>r.factionId==='fac_liuqiu');area('吕宋',r=>r.factionId==='fac_nanhai');
for(const map of [s.map,s.mapData]){map.locationBindingContract=structuredClone(contract);map.locationAliases=structuredClone(aliases);map.locationAreas=structuredClone(areas);}
const leanMap={...s.map,regions:regions.map(r=>({id:r.id,name:r.name,factionId:r.factionId,aliases:r.aliases})),basemap:null};
const game={mapData:leanMap,chars:s.characters,armies:s.military.initialTroops,facs:s.factions};
const ctx={console,GM:game};ctx.window=ctx;vm.createContext(ctx);vm.runInContext(fs.readFileSync(path.join(work,'after/tm-map-locations.js'),'utf8'),ctx);
const stats={character:{},army:{}};
for(const [kind,rows]of [['character',s.characters],['army',s.military.initialTroops]])for(const entity of rows){
 const previous={regionId:entity.regionId||null,garrisonRegionId:entity.garrisonRegionId||null};
 const result=ctx.TMMapLocations.sync(entity,kind,game);
 stats[kind][result.status]=(stats[kind][result.status]||0)+1;
 changes.push({kind,id:entity.id||null,name:entity.name,text:entity.location||entity.garrison,old:previous,regionId:result.regionId||null,status:result.status,method:result.method,candidates:result.candidateRegionIds});
}
assert.equal(hash(JSON.stringify(s.map.regions)),beforeRegionHash,'Geometry/data changed');
const original=JSON.parse(fs.readFileSync(path.join(root,'docs/shaosong-map-integration-20260917/map-stage/source-before.json'),'utf8'));
for(const key of ['characters','cities'])for(let i=0;i<(original[key]||[]).length;i++)for(const k of Object.keys(original[key][i]))assert.deepEqual(s[key][i][k],original[key][i][k],key+' '+i+' '+k);
for(let i=0;i<original.military.initialTroops.length;i++)for(const k of Object.keys(original.military.initialTroops[i]))assert.deepEqual(s.military.initialTroops[i][k],original.military.initialTroops[i][k],'army '+i+' '+k);
const previous=JSON.parse(raw);for(const k of Object.keys(previous))if(!['characters','military','map','mapData'].includes(k))assert.deepEqual(s[k],previous[k],k);
assert.deepEqual(s.map,s.mapData,'Map mirrors');
const bytes=JSON.stringify(s)+'\n';fs.writeFileSync(path.join(work,'candidate.json'),bytes);
const report={createdAt:new Date().toISOString(),sourceSha256:hash(raw),candidateSha256:hash(bytes),stats,aliases:aliases.length,areas:areas.length,changes,originalFieldsPreserved:true,geometryAndAccountsUnchanged:true};
fs.writeFileSync(path.join(work,'migration-report.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,changes:changes.filter(r=>r.regionId!==r.old.regionId).slice(0,24)},null,2));
