// Explicit local integration; no publication.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.');
const work=path.join(root,'docs/shaosong-map-integration-20260917/map-stage');
const hash=x=>crypto.createHash('sha256').update(x).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(work,n),'utf8'));
const migration=read('migration-report.json'), plan=read('runtime-plan.json');
const tests=read('native-verification.json'), tiers=read('tier-verification.json');
assert.equal(tests.failed,0);assert.equal(tiers.failed,0);
assert.equal(tests.candidateSha256,migration.candidateSha256);
const target=path.join(root,'scenarios/绍宋·建炎元年八月（官方）.json');
const candidate=fs.readFileSync(path.join(work,'candidate.json'));
assert.equal(hash(fs.readFileSync(target)),migration.sourceSha256,'Canonical source changed');
assert.equal(hash(candidate),migration.candidateSha256);
for(const row of plan){
 assert.equal(hash(fs.readFileSync(path.join(root,'web',row.name))),row.before,'Concurrent code change: '+row.name);
 assert.equal(hash(fs.readFileSync(path.join(work,'runtime-after',row.name))),row.after);
}
const generator=(await import(pathToFileURL(path.join(root,'web/scripts/sync-official-scenarios.js')))).default;
const derived=[...generator.buildArtifacts().files.keys()], backup=path.join(work,'apply-backup');
assert.ok(!fs.existsSync(backup),'Backup exists; review journal.');fs.mkdirSync(backup,{recursive:true});
const files=[target,...plan.map(r=>path.join(root,'web',r.name)),...derived];
const snapshots=files.map(file=>({file,relative:path.relative(root,file),exists:fs.existsSync(file),bytes:fs.existsSync(file)?fs.readFileSync(file):null}));
const otherSources=generator.ENTRIES.filter(x=>x.key!=='shaosong').map(x=>({file:path.join(root,'scenarios',x.filename),sha:hash(fs.readFileSync(path.join(root,'scenarios',x.filename)))}));
for(const row of snapshots)if(row.exists){const b=path.join(backup,row.relative);fs.mkdirSync(path.dirname(b),{recursive:true});fs.writeFileSync(b,row.bytes);assert.equal(hash(fs.readFileSync(b)),hash(row.bytes));}
fs.writeFileSync(path.join(work,'apply-backup-manifest.json'),JSON.stringify(snapshots.map(r=>({relative:r.relative,exists:r.exists,sha256:r.exists?hash(r.bytes):null})),null,2));
function atomic(file,bytes){const tmp=file+'.shaosong-map.tmp';assert.ok(!fs.existsSync(tmp));const fd=fs.openSync(tmp,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}assert.equal(hash(fs.readFileSync(tmp)),hash(bytes));fs.renameSync(tmp,file);assert.equal(hash(fs.readFileSync(file)),hash(bytes));}
const applied=[];const result={started:new Date().toISOString(),complete:false,officialMapApplied:false,files:[],otherScenarioSourcesUnchanged:false};
try{
 for(const row of plan){const file=path.join(root,'web',row.name);assert.equal(hash(fs.readFileSync(file)),row.before);atomic(file,fs.readFileSync(path.join(work,'runtime-after',row.name)));applied.push({file,after:row.after});}
 assert.equal(hash(fs.readFileSync(target)),migration.sourceSha256);atomic(target,candidate);applied.push({file:target,after:migration.candidateSha256});result.officialMapApplied=true;
 generator.sync({check:false});generator.sync({check:true});
 for(const row of otherSources)assert.equal(hash(fs.readFileSync(row.file)),row.sha,'Other official source changed');result.otherScenarioSourcesUnchanged=true;
 const installed=JSON.parse(fs.readFileSync(target,'utf8'));assert.equal(installed.map.regions.length,566);assert.equal(installed.id,'sc-jianyan1-1127-shaosong');
 result.complete=true;result.sourceSha256=hash(fs.readFileSync(target));
 result.files=snapshots.filter(r=>fs.existsSync(r.file)&&(!r.bytes||hash(fs.readFileSync(r.file))!==hash(r.bytes))).map(r=>({relative:r.relative,sha256:hash(fs.readFileSync(r.file))}));
}catch(e){result.error=String(e.stack||e);result.appliedBeforeFailure=applied.map(x=>path.relative(root,x.file));process.exitCode=1;}
fs.writeFileSync(path.join(work,'applied.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
