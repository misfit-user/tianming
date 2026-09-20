// Read-only source comparison; writes this task's report, never the game source.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.');
const work=path.join(root,'docs/shaosong-map-integration-20260917');
const rel='scenarios/绍宋·建炎元年八月（官方）.json';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const originalRaw=fs.readFileSync(path.join(work,'backup-reconnected',rel));
const actualRaw=fs.readFileSync(path.join(root,rel));
const original=JSON.parse(originalRaw),actual=JSON.parse(actualRaw);
const log=JSON.parse(fs.readFileSync(path.join(work,'rename-applied.json'),'utf8'));
const expected=structuredClone(original);
for(const e of log.edits){let obj=expected;for(const k of e.path.slice(0,-1))obj=obj[k];const key=e.path.at(-1);if(e.isKey){assert.ok(Object.hasOwn(obj,key));assert.ok(!Object.hasOwn(obj,e.to));obj[e.to]=obj[key];delete obj[key];}else {assert.equal(obj[key],e.from);obj[key]=e.to;}}
assert.deepEqual(actual,expected,'Unexpected edit beyond the audited polity-label changes');
assert.equal(hash(originalRaw),log.beforeSha256);
assert.equal(hash(actualRaw),log.afterSha256);
const leaves=[];function walk(n,owner){if(Array.isArray(n))return n.forEach(x=>walk(x,owner));if(!n||typeof n!=='object')return;if(n.children?.length)return walk(n.children,owner);if(n.divisions)return walk(n.divisions,owner);if(n.mapRegionId)leaves.push({owner,node:n});}
for(const[k,v]of Object.entries(actual.adminHierarchy))walk(v,k==='player'?'fac_song':k);
assert.equal(leaves.length,182);
const mapRaw=fs.readFileSync(path.join(work,'input-r6-map/shaosong-r6.map-only.json'));
const map=JSON.parse(mapRaw),manifest=JSON.parse(fs.readFileSync(path.join(work,'input-r6-map/manifest.json'),'utf8'));
assert.equal(hash(mapRaw),manifest.mapPayloadSha256);
assert.equal(map.regions.length,566);assert.equal(map.circuitRegistry.length,101);
const ids=new Set(map.regions.map(r=>r.id)),owners=new Set(actual.factions.map(f=>f.id)),seen=new Set();
assert.equal(ids.size,566);for(const c of map.circuitRegistry)for(const id of c.memberRegionIds){assert.ok(ids.has(id));assert.ok(!seen.has(id));seen.add(id);}assert.equal(seen.size,566);
for(const r of map.regions){assert.ok(owners.has(r.owner));for(const n of r.neighbors||[])assert.ok(ids.has(n));}
const byFaction=Object.entries(actual.adminHierarchy).map(([key])=>{const id=key==='player'?'fac_song':key;const source=leaves.filter(x=>x.owner===id);return {factionId:id,originalAccounts:source.length,newMapCells:map.regions.filter(r=>r.owner===id).length,sourceAccounts:source.map(x=>({id:x.node.mapRegionId,name:x.node.name}))};});
const totals=leaves.reduce((s,{node:n})=>{s.mouths+=n.populationDetail.mouths;s.zhizao+=n.economyBase.imperialAssets.zhizao||0;s.kuangchang+=n.economyBase.imperialAssets.kuangchang||0;s.yuyao+=n.economyBase.imperialAssets.yuyao||0;return s;},{mouths:0,zhizao:0,kuangchang:0,yuyao:0});
const report={checkedAt:new Date().toISOString(),status:'polity-labels-applied-map-not-applied',newMapApplied:false,officialSource:rel,beforeSha256:hash(originalRaw),afterSha256:hash(actualRaw),verifiedLabelChanges:log.edits.length,nativeFactionResolutions:log.nativeResolved,originalAccounts:leaves.length,sourceCharacters:actual.characters.length,sourceArmies:actual.military.initialTroops.length,sourceEvents:actual.events.length,originalMapRegions:actual.map.regions.length,polities:actual.factions.filter(f=>['fac_song','fac_jin','fac_xixia'].includes(f.id)).map(({id,name})=>({id,name})),accountTotals:totals,mapInput:{sha256:hash(mapRaw),regions:map.regions.length,circuits:map.circuitRegistry.length,allOwnersResolve:true,allCircuitsResolve:true},mappingAssessment:{complete:false,reason:'New geometry and original accounting are not one-to-one. Some polities have fewer new map cells than original accounts. Direct attachment to the current single-division transfer function is not accepted as a preservation proof.',byFaction},notRun:['new map migration','new map gameplay integration','complete client launch','save/read round trip','AI campaign']};
fs.writeFileSync(path.join(work,'reconnected-verification.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,mappingAssessment:{...report.mappingAssessment,byFaction:undefined}},null,2));
