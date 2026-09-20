// Verify the installed bytes and collect completed local test evidence only.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]),doc=path.join(root,'docs/map-deep-zoom-20260918');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(path.join(w,f),'utf8'));
const base=read('baseline.json'),plan=read('patch-plan.json'),applied=read('applied.json'),unit=read('unit-installed.json');
assert.equal(applied.complete,true);assert.equal(unit.failed,0);assert.equal(unit.installed,true);
for(const p of plan)assert.equal(hash(fs.readFileSync(path.join(root,p.file))),p.after,p.file+' changed after verification');
const sources=base.sources.map(p=>{assert.equal(hash(fs.readFileSync(path.join(root,p.file))),p.sha256,p.file+' changed');return {...p,unchanged:true};});
const fixture=read('viewport-test-update.json');assert.equal(hash(fs.readFileSync(path.join(root,fixture.file))),fixture.after);
const uiTags=['reconnected-final-sc-tianqi7-1627','cross-scenario-final-sc-jianyan1-1127-shaosong'];
const ui=uiTags.map(tag=>{const r=read(tag+'/report.json'),process=read(tag+'/process-result.json');assert.equal(r.complete,true,tag);assert.equal(r.exitCode,0,tag);assert.equal(process.status,0,tag);assert.equal(process.signal,null);assert.ok(r.checks.every(c=>c.passed),tag);return {tag,data:r};});
const reg=read('reconnected-checks/results.json');assert.equal(reg.complete,true);assert.ok(reg.results.filter(r=>r.name!=='lint-arch-all.js').every(r=>r.passed));
const arch=reg.results.find(r=>r.name==='lint-arch-all.js');
const extra=read('tang-start-diagnostic-sc-tang840-840/report.json');assert.equal(extra.complete,false);assert.equal(extra.startResult.ok,false);
const mapReportFile='D:/tianming-assistant-work/chongzhen-map-r3-20260918/native-installed-verification.json';
const mapReport=JSON.parse(fs.readFileSync(mapReportFile,'utf8'));assert.equal(mapReport.failed,0);assert.equal(mapReport.candidateSha256,sources.find(s=>s.file.includes('天启七年')).sha256);
const old=read('before-sc-tianqi7-1627/report.json');assert.equal(old.complete,true);assert.equal(old.maximum.scale,4.2);
for(const d of ['screenshots','reports'])fs.mkdirSync(path.join(doc,d),{recursive:true});
const photos=[['before-sc-tianqi7-1627/old-maximum.png','皮岛_原4.2倍上限.png'],[uiTags[0]+'/new-maximum-128.png','皮岛_新128倍.png'],[uiTags[0]+'/small-target-clicked.png','皮岛_128倍实际点击.png'],[uiTags[0]+'/whole-map-after-deep-zoom.png','深度缩放后复位全图.png'],[uiTags[1]+'/small-target-autofocus.png','绍宋_小岛自动聚焦.png']];
const screenshots=photos.map(([file,name])=>{const b=fs.readFileSync(path.join(w,file));assert.ok(b.length>10000);assert.equal(b.subarray(1,4).toString(),'PNG');const dest=path.join(doc,'screenshots',name);fs.writeFileSync(dest,b);assert.equal(hash(fs.readFileSync(dest)),hash(b));return {file:path.relative(root,dest).replaceAll('\\','/'),sha256:hash(b),width:b.readUInt32BE(16),height:b.readUInt32BE(20)};});
fs.copyFileSync(path.join(w,'tang-start-diagnostic-sc-tang840-840/report.json'),path.join(doc,'reports/tang-start-blocker.json'));
for(const item of ui)fs.copyFileSync(path.join(w,item.tag,'report.json'),path.join(doc,'reports',item.data.sid+'-ui.json'));
for(const name of ['baseline.json','patch-plan.json','applied.json','unit-installed.json','projection-followup.json','viewport-test-update.json'])fs.copyFileSync(path.join(w,name),path.join(doc,'reports',name));
fs.copyFileSync(mapReportFile,path.join(doc,'reports/map-adaptation-recheck.json'));
fs.copyFileSync(path.join(w,'reconnected-checks/results.json'),path.join(doc,'reports/regressions.json'));
fs.copyFileSync(path.join(w,'before-checks/lint-arch-all.js.log'),path.join(doc,'reports/architecture-before.log'));
fs.copyFileSync(path.join(w,'reconnected-checks/lint-arch-all.js.log'),path.join(doc,'reports/architecture-after.log'));
fs.copyFileSync(path.join(w,'reconnected-checks/verify-official-scenario-parity.js.log'),path.join(doc,'reports/official-parity.log'));
const archFailures=f=>fs.readFileSync(f,'utf8').split(/\r?\n/).filter(l=>/^\[lint-arch-all\] FAIL /.test(l)).map(l=>l.replace(/ \([\d.]+s\)$/,''));
const beforeArch=archFailures(path.join(w,'before-checks/lint-arch-all.js.log')),afterArch=archFailures(path.join(w,'reconnected-checks/lint-arch-all.js.log'));
const b=old.maximum,a=ui[0].data.maximum;
const result={verifiedAt:new Date().toISOString(),applied:true,releaseReady:false,sourceScope:'shared native map presentation only',sources,files:plan,testFixture:fixture,
 zoom:{minimum:.72,maximum:128,previousWheelAndPinchMax:3.4,previousButtonMax:4.2,linearGainOverOldButton:128/4.2,rendering:'vector viewport above 4.2; reusable compositor below',focus:'small target adaptive; never edits geometry'},
 pixelComparison:{sameScenario:true,targetId:old.targetId,before:{scale:b.scale,width:b.width,height:b.height},after:{scale:a.scale,width:a.width,height:a.height},unit:'browser CSS pixels in identical test viewport'},
 additionalScenarioCheck:{scenarioId:extra.sid,passed:false,stage:'before-map-world-start',error:extra.startResult,report:'reports/tang-start-blocker.json'},
 tests:{mapAdaptation:{passed:mapReport.passed,failed:mapReport.failed},unit:{passed:unit.passed,failed:unit.failed},nativePages:ui.map(i=>({scenarioId:i.data.sid,regions:i.data.source.regions,passed:i.data.checks.length,failed:0,elapsedMs:i.data.ms})),regressions:reg.results},
 architecture:{passed:arch.passed,beforeFailures:beforeArch,afterFailures:afterArch,sameFailingGroups:JSON.stringify(beforeArch)===JSON.stringify(afterArch)},screenshots,
 limits:['Desktop Electron verified. Two-finger input emulated through browser debugging protocol; no physical phone performance certification.','No story, map polygon, faction, army, character, finance, game-save or release version writes.','Full repository architecture guard is not green; no commit, push, build or release.','Earlier projection and native-input test failures are retained in the work directory. Cross-scenario generated-test syntax error was corrected before successful reruns.','Zoom exposes existing geometry; it does not manufacture historical map detail or repair coarse borders.']};
fs.writeFileSync(path.join(w,'final-verification.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(doc,'验收结果.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(doc,'work-location.json'),JSON.stringify({work:w,state:'applied-verified',report:'验收结果.json',runtimeFiles:plan.map(p=>p.file),scenarioDataUnchanged:true},null,2));
console.log(JSON.stringify({applied:result.applied,additionalScenarioCheck:result.additionalScenarioCheck,zoom:result.zoom,pixelComparison:result.pixelComparison,tests:result.tests,architecture:result.architecture,screenshots:result.screenshots},null,2));
// Check whitespace without converting the repository's frozen CRLF bytes.
const {spawnSync}=await import('node:child_process');
const scope=plan.map(p=>p.file).concat(fixture.file,'docs/map-deep-zoom-20260918');
const rawDiff=spawnSync('git',['diff','--check','--',...scope],{cwd:root,encoding:'utf8',timeout:15000});
const awareDiff=spawnSync('git',['-c','core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol','diff','--check','--',...scope],{cwd:root,encoding:'utf8',timeout:15000});
assert.equal(awareDiff.status,0,awareDiff.stdout+awareDiff.stderr);
result.diffCheck={rawExit:rawDiff.status,crlfPreservingExit:awareDiff.status,perCommandOnly:true,persistentGitConfigChanged:false,explanation:'Original and edited stylesheet both retain CRLF. Default whitespace mode reports the existing carriage return on the edited line.'};
fs.writeFileSync(path.join(doc,'reports/diff-check-default.log'),rawDiff.stdout+rawDiff.stderr);
fs.writeFileSync(path.join(doc,'reports/diff-check-crlf-preserving.log'),awareDiff.stdout+awareDiff.stderr);
fs.writeFileSync(path.join(w,'final-verification.json'),JSON.stringify(result,null,2));
fs.writeFileSync(path.join(doc,'验收结果.json'),JSON.stringify(result,null,2));
console.log('CRLF-preserving diff check: '+awareDiff.status+'; default mode: '+rawDiff.status);
