// Verify the installed local application, not a detached candidate or preview.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),doc=path.join(root,'docs/chongzhen-prefecture-map-20260917');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(path.join(work,f),'utf8'));
const source=path.join(root,'scenarios/天启七年·九月（官方）.json'),raw=fs.readFileSync(source),now=JSON.parse(raw),old=read('source-before.json'),checks=[];
function check(name,fn){try{const detail=fn();checks.push({name,passed:true,detail});}catch(e){checks.push({name,passed:false,error:String(e.stack||e).slice(0,1800)});}}
function nodes(tree){const result=[];function walk(n){result.push(n);(n.children||[]).forEach(walk);}Object.values(tree).forEach(v=>(v.divisions||[]).forEach(walk));return result;}
const oldNodes=nodes(old.adminHierarchy),nowNodes=nodes(now.adminHierarchy),byId=new Map(nowNodes.map(n=>[n.id,n]));
const leaves=nowNodes.filter(n=>!n.children?.length&&n.populationDetail),oldLeaves=oldNodes.filter(n=>!n.children?.length&&n.populationDetail);
check('installed-source-equals-candidate',()=>assert.equal(hash(raw),read('candidate-report.json').candidateSha256));
check('original-story-configuration-and-events',()=>{const allowed=new Set(['map','mapData','adminHierarchy','characters','military','cities']);for(const k of Object.keys(old))if(!allowed.has(k))assert.deepEqual(now[k],old[k],k);assert.equal(now.events.length,62);});
check('original-character-and-army-fields',()=>{assert.equal(now.characters.length,203);assert.equal(now.military.initialTroops.length,48);for(const [before,after]of [[old.characters,now.characters],[old.military.initialTroops,now.military.initialTroops]])before.forEach((row,i)=>{for(const k of Object.keys(row))assert.deepEqual(after[i][k],row[k],row.name+' '+k);});});
check('all-original-admin-records-preserved',()=>{for(const n of oldNodes){const current=byId.get(n.id);assert.ok(current,n.id);for(const k of Object.keys(n))if(!['children','mapRegionId','mappedRegions'].includes(k))assert.deepEqual(current[k],n[k],n.name+' '+k);}assert.equal(leaves.length,382);assert.deepEqual(leaves.map(n=>n.id).sort(),oldLeaves.map(n=>n.id).sort());return {originalNodes:oldNodes.length,leafAccounts:leaves.length};});
check('284-cells-43-province-closure',()=>{assert.equal(now.map.regions.length,284);assert.equal(now.map.circuitRegistry.length,43);assert.deepEqual(now.map,now.mapData);const members=now.map.circuitRegistry.flatMap(p=>p.memberRegionIds);assert.equal(members.length,284);assert.equal(new Set(members).size,284);assert.deepEqual(members.slice().sort(),now.map.regions.map(r=>r.id).sort());});
check('359-on-map-accounts-no-duplicates',()=>{const refs=now.map.regions.flatMap(r=>r.accountingLeafIds);assert.equal(refs.length,359);assert.equal(new Set(refs).size,359);refs.forEach(id=>assert.ok(byId.has(id),id));});
check('neutral-map-and-binding-delivered',()=>{for(const [f,local]of [['neutral-map.json','geometry.json'],['map-bindings.json','scenario-bindings.json']])assert.equal(hash(fs.readFileSync(path.join(work,f))),hash(fs.readFileSync(path.join(root,'web/data/maps/chongzhen-prefecture-v1',local))));});
check('installed-membership-matches-tested-runtime',()=>assert.equal(hash(fs.readFileSync(path.join(root,'web/tm-faction-membership.js'))),read('membership-plan.json').after));
check('live-page-required-services-registered',()=>{const html=fs.readFileSync(path.join(root,'web/index.html'),'utf8');for(const name of ['tm-map-locations.js','tm-public-treasury.js'])assert.equal(html.split('src="'+name).length,2,name);});
const ui=read('native-ui-delivery/report.json'),native=read('native-installed-verification.json'),geometry=read('geometry-verification.json'),regression=read('regressions-final.json'),arch=read('architecture-final.json');
check('installed-functions-and-geometry-passed',()=>{assert.equal(native.failed,0);assert.equal(native.candidateSha256,hash(raw));assert.equal(geometry.failed,0);return {native:native.passed,geometry:geometry.passed};});
check('native-game-three-panorama-and-live-actions',()=>{assert.equal(ui.complete,true);assert.equal(ui.exitCode,0);assert.equal(ui.sourceSha256,hash(raw));ui.checks.forEach(c=>assert.equal(c.passed,true,c.name));assert.equal(ui.liveTransfers.failed,0);return {pageChecks:ui.checks.length,liveActionChecks:ui.liveTransfers.passed,elapsedMs:ui.elapsedMs};});
check('existing-nine-regressions-passed',()=>{assert.equal(regression.complete,true);assert.equal(regression.results.length,9);regression.results.forEach(r=>assert.equal(r.passed,true,r.name));});
const screenshots=[];fs.mkdirSync(path.join(doc,'screenshots'),{recursive:true});
check('screenshots-current-and-complete',()=>{
 for(const [tier,name]of [['realm','崇祯_天下级全景.png'],['region','崇祯_省道级全景.png'],['prefecture','崇祯_府州级全景.png']]){
  const file=path.join(work,'native-ui-delivery','map-'+tier+'.png'),bytes=fs.readFileSync(file),entry=ui.checks.find(c=>c.name==='screenshot-'+tier);
  assert.equal(hash(bytes),entry.sha256);assert.equal(bytes.subarray(1,4).toString(),'PNG');assert.ok(bytes.length>10000);
  const dest=path.join(doc,'screenshots',name);fs.copyFileSync(file,dest);assert.equal(hash(fs.readFileSync(dest)),hash(bytes));
  screenshots.push({tier,file:path.relative(root,dest).replace(/\\/g,'/'),bytes:bytes.length,width:bytes.readUInt32BE(16),height:bytes.readUInt32BE(20),sha256:hash(bytes)});
 }
 assert.equal(new Set(screenshots.map(s=>s.sha256)).size,3);
});
const geomReport=read('geometry-report.json'),coarse=geomReport.reports.filter(r=>r.mode==='retained-coarse').map(r=>({id:r.id,name:r.name,reason:r.reason}));
const records={complete:checks.every(c=>c.passed),checkedAt:new Date().toISOString(),officialMapApplied:true,releaseReady:false,sourceFile:'scenarios/天启七年·九月（官方）.json',sourceSha256:hash(raw),sourceBytes:raw.length,
 counts:{logicalRegions:284,provinceGroups:43,subdividedParents:29,subdividedRegions:270,retainedCoarseRegions:14,originalAccounts:382,mappedAccounts:359,unchangedOffMapAccounts:23,originalCharacters:203,originalArmies:48,events:62},
 checks,passed:checks.filter(c=>c.passed).length,failed:checks.filter(c=>!c.passed).length,screenshots,coarseRegions:coarse,
 sourcePopulation:oldLeaves.reduce((v,n)=>v+Number(n.populationDetail.mouths||0),0),mappedPopulation:leaves.reduce((v,n)=>v+Number(n.populationDetail.mouths||0),0),
 fiscalComparison:native.fiscal,geometryChecks:{passed:geometry.passed,failed:geometry.failed},nativeFunctionChecks:{passed:native.passed,failed:native.failed},nativePage:{checks:ui.checks.length,liveActions:ui.liveTransfers,world:ui.world},
 regressionScripts:regression.results.map(r=>({name:r.name,passed:r.passed})),architecture:{passed:arch.passed,exitCode:arch.exitCode,summary:arch.summary},
 limitations:['府州界为地理约束推定，不是1627年测绘疆界','13个原轮廓存在地名位置冲突的地域暂保留粗区，澳门因范围小保留一块','原有跨省轮廓交叠和年代政治地理未被暗中重写','截图为隔离Electron中的真实新局，使用固定全图相机，不是用户存档','联网AI、完整长局、移动端和旧存档迁移未验收','全仓架构门禁仍有5项失败，不可视为正式发布通过','本次未提交、推送、打包、发布或更改用户存档']};
fs.writeFileSync(path.join(doc,'验收结果.json'),JSON.stringify(records,null,2));
fs.writeFileSync(path.join(work,'delivery-verification.json'),JSON.stringify(records,null,2));
fs.writeFileSync(path.join(doc,'work-location.json'),JSON.stringify({work,source:records.sourceFile,sourceSha256:records.sourceSha256,state:'applied-local-specialty-verified-not-release',verification:'验收结果.json'},null,2));
console.log(JSON.stringify({complete:records.complete,passed:records.passed,failed:records.failed,sourceSha256:records.sourceSha256,counts:records.counts,screenshots,architecturePassed:arch.passed,failures:checks.filter(c=>!c.passed)},null,2));
if(!records.complete)process.exitCode=1;
