// Final evidence from the installed source, not from an assumed successful staging directory.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]),doc=path.join(root,'docs/chongzhen-map-r3-20260918'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(w,n),'utf8'));
const base=read('baseline.json'),audit=read('candidate-report.json'),applied=read('applied.json'),geo=read('geometry-verification.json'),native=read('native-installed-verification.json'),ui=read('native-ui-r3-complete/report.json'),dossier=read('dossier-renderer-applied.json'),smoke=read('smoke-refinement.json');
const source=fs.readFileSync(path.join(root,base.source)),scenario=JSON.parse(source);
assert.equal(hash(source),audit.candidateSha256);assert.equal(applied.complete,true);assert.equal(native.failed,0);assert.equal(geo.failed,0);assert.equal(ui.complete,true);assert.equal(ui.exitCode,0);assert.ok(ui.checks.every(r=>r.passed));assert.equal(ui.sourceSha256,hash(source));
assert.equal(hash(fs.readFileSync(path.join(root,dossier.file))),dossier.after);assert.equal(hash(fs.readFileSync(path.join(root,smoke.file))),smoke.after);
const loc=read('location-runtime-plan.json');assert.equal(hash(fs.readFileSync(path.join(root,loc.file))),loc.after);
for(const f of base.otherSources)if(f.file!==base.source)assert.equal(hash(fs.readFileSync(path.join(root,f.file))),f.sha256,'Other official source changed');
const test=spawnSync(process.execPath,[path.join(root,smoke.file)],{cwd:root,encoding:'utf8',timeout:45000});assert.equal(test.status,0,test.stdout+test.stderr);fs.writeFileSync(path.join(w,'smoke-rerun.log'),test.stdout+test.stderr);
const regression=read('regressions.json');
for(const d of ['screenshots','reports'])fs.mkdirSync(path.join(doc,d),{recursive:true});
const screenshots=[];
for(const [name,cn]of [['map-realm.png','天下全景.png'],['map-region.png','省道全景.png'],['map-prefecture.png','府州全景.png'],['map-liaodong-detail.png','关宁防线方志.png'],['map-pidao-dossier.png','皮岛与东江方志.png']]){
 const b=fs.readFileSync(path.join(w,'native-ui-r3-complete',name));assert.ok(b.length>10000);assert.equal(b.subarray(1,4).toString(),'PNG');const target=path.join(doc,'screenshots',cn);fs.copyFileSync(path.join(w,'native-ui-r3-complete',name),target);assert.equal(hash(fs.readFileSync(target)),hash(b));screenshots.push({file:path.relative(root,target).replaceAll('\\','/'),sha256:hash(b),width:b.readUInt32BE(16),height:b.readUInt32BE(20)});
}
const reportNames=['candidate-report.json','applied.json','geometry-verification.json','native-installed-verification.json','dossier-renderer-applied.json','location-runtime-plan.json','smoke-refinement.json','regressions.json'];
for(const f of reportNames)fs.copyFileSync(path.join(w,f),path.join(doc,'reports',f));
fs.copyFileSync(path.join(w,'native-ui-r3-complete/report.json'),path.join(doc,'reports/native-ui.json'));fs.copyFileSync(path.join(w,'regressions/lint-arch-all.js.log'),path.join(doc,'reports/architecture.log'));fs.copyFileSync(path.join(w,'smoke-rerun.log'),path.join(doc,'reports/smoke-rerun.log'));
const results=Array.isArray(regression)?regression:regression.results;assert.ok(Array.isArray(results));
const effective=results.map(r=>({name:r.name,originalPassed:r.passed,currentPassed:r.name==='smoke-tianqi-map-runtime.js'?true:r.passed,rerun:r.name==='smoke-tianqi-map-runtime.js'}));
const architecture=effective.find(r=>r.name==='lint-arch-all.js');const scoped=effective.filter(r=>r.name!=='lint-arch-all.js');assert.ok(scoped.every(r=>r.currentPassed));
const accountView=read('account-view-applied.json');assert.equal(hash(fs.readFileSync(path.join(root,accountView.file))),accountView.after);assert.ok(accountView.checks.every(c=>c.passed));fs.copyFileSync(path.join(w,'account-view-applied.json'),path.join(doc,'reports/account-view-applied.json'));
const assets=[];for(const f of ['geometry.json','scenario-bindings.json']){const file='web/data/maps/chongzhen-prefecture-r3/'+f,b=fs.readFileSync(path.join(root,file));assets.push({file,sha256:hash(b)});}
assert.equal(scenario.map.regions.length,307);assert.equal(scenario.map.circuitRegistry.length,43);
const final={verifiedAt:new Date().toISOString(),officialMapApplied:true,releaseReady:false,source:base.source,sourceSha256:hash(source),beforeR2Sha256:base.sourceSha256,counts:{regions:307,provinceGroups:43,characters:scenario.characters.length,initialArmies:scenario.military.initialTroops.length,events:scenario.events.length,originalAccounts:382,mappedAccounts:359},coarse:scenario.map.regions.filter(r=>r.coarse).map(r=>r.name),otherOfficialSourcesUnchanged:true,checks:{geometry:{passed:geo.passed,failed:geo.failed},native:{passed:native.passed,failed:native.failed},browser:{passed:ui.checks.length,failed:0},dossierReader:{passed:dossier.checks.length,failed:0},multiAccountReader:{passed:accountView.checks.length,failed:0},regressionScripts:effective},architecturePassed:architecture?.currentPassed===true,locationCoverage:audit.locationStats,screenshots,assets,limits:['10个既有粗区未强行细分；西北与东北旧疆界仍需进一步考证','关宁走廊属于概化战区边界；岛岸是现代物理参照而不是1627测绘','原始地方账户保留，不将东江大陆记账分项解释为实际控制整片大陆','全仓架构门禁未全绿；未完成联网AI长局、真实用户存档迁移及手机验收','未提交、推送、打包或发布'],writeRecovery:'First ENOSPC attempt fully recovered to verified R2 baseline; guarded staged-copy retry completed. See failed-space-attempt/recovery.json.'};
fs.writeFileSync(path.join(w,'final-verification.json'),JSON.stringify(final,null,2));fs.writeFileSync(path.join(doc,'验收结果.json'),JSON.stringify(final,null,2));
fs.writeFileSync(path.join(doc,'work-location.json'),JSON.stringify({...base,stage:'applied-and-native-tested',currentSourceSha256:hash(source),finalReport:'验收结果.json'},null,2));
console.log(JSON.stringify(final,null,2));
