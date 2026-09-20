// Apply the verified location slice to the user's local project; no Git or release actions.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),work=path.join(root,'docs/shaosong-map-integration-20260917/location-stage');
const read=n=>JSON.parse(fs.readFileSync(path.join(work,n),'utf8'));
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const migration=read('migration-report.json'),plan=read('runtime-plan.json'),tests=read('verification.json');
assert.equal(tests.failed,0);assert.ok(tests.passed>=28);
assert.equal(tests.candidateSha256,migration.candidateSha256,'Tests must cover the final candidate');
for(const row of plan)assert.equal(tests.runtimeSha256[row.name],row.after,'Untested runtime: '+row.name);
const target=path.join(root,'scenarios/绍宋·建炎元年八月（官方）.json'),candidate=fs.readFileSync(path.join(work,'candidate.json'));
assert.equal(hash(candidate),migration.candidateSha256);
assert.equal(hash(fs.readFileSync(target)),migration.sourceSha256,'Concurrent source modification');
for(const row of plan){const p=path.join(root,'web',row.name);if(row.before)assert.equal(hash(fs.readFileSync(p)),row.before,row.name);else assert.ok(!fs.existsSync(p),'New file already exists');assert.equal(hash(fs.readFileSync(path.join(work,'after',row.name))),row.after);}
const generator=(await import(pathToFileURL(path.join(root,'web/scripts/sync-official-scenarios.js')))).default;
const otherSources=generator.ENTRIES.filter(e=>e.filename!=='绍宋·建炎元年八月（官方）.json').map(e=>({filename:e.filename,sha256:hash(fs.readFileSync(path.join(root,'scenarios',e.filename)))}));
const backup=path.join(work,'apply-backup-02');assert.ok(!fs.existsSync(backup),'Prior apply exists; inspect its journal');fs.mkdirSync(backup,{recursive:true});
const journal={started:new Date().toISOString(),complete:false,sourceBefore:migration.sourceSha256,sourceAfter:migration.candidateSha256,files:[],otherSources,steps:[]};
const journalPath=path.join(work,'applied.json');
function save(){fs.writeFileSync(journalPath,JSON.stringify(journal,null,2));}
function atomic(file,bytes){const temp=file+'.shaosong-location.tmp';assert.ok(!fs.existsSync(temp),'Temporary file exists');const fd=fs.openSync(temp,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}assert.equal(hash(fs.readFileSync(temp)),hash(bytes));try { fs.renameSync(temp,file); }
 catch(err) {
  // Some readers deny renaming but allow ordinary editor writes. Do not kill them.
  // Only small, backed-up runtime .js files may use this guarded editor-style path.
  if(err.code!=='EPERM'||!file.endsWith('.js')||bytes.length>1024*1024)throw err;
  const row=[...journal.files].reverse().find(r=>path.join(root,r.relative)===file);
  if(!row||!row.existed)throw err;
  const expected=hash(bytes)===row.after?row.before:row.after;
  const handle=fs.openSync(file,'r+'),old=fs.readFileSync(handle);
  try {
   assert.equal(hash(old),expected,'Concurrent change blocks editor write');
   let offset=0;while(offset<bytes.length)offset+=fs.writeSync(handle,bytes,offset,bytes.length-offset,offset);
   fs.ftruncateSync(handle,bytes.length);fs.fsyncSync(handle);
   assert.equal(hash(fs.readFileSync(file)),hash(bytes));
  }catch(writeError){
   if(hash(old)===expected){let offset=0;while(offset<old.length)offset+=fs.writeSync(handle,old,offset,old.length-offset,offset);fs.ftruncateSync(handle,old.length);fs.fsyncSync(handle);}
   throw writeError;
  }finally{fs.closeSync(handle);}
  row.writeMode='hash-checked-backed-up-editor-write';fs.unlinkSync(temp);
 }
 assert.equal(hash(fs.readFileSync(file)),hash(bytes));}
function replace(file,bytes){const rel=path.relative(root,file),dest=path.join(backup,rel);assert.ok(!rel.startsWith('..'));const exists=fs.existsSync(file),before=exists?hash(fs.readFileSync(file)):null;
 if(exists){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(file,dest);assert.equal(hash(fs.readFileSync(dest)),before);}
 const row={relative:rel,existed:exists,before,after:hash(bytes),applied:false};journal.files.push(row);save();atomic(file,bytes);row.applied=true;save();}
try{
 for(const row of plan){const file=path.join(root,'web',row.name);if(row.before)assert.equal(hash(fs.readFileSync(file)),row.before,'Concurrent runtime change');replace(file,fs.readFileSync(path.join(work,'after',row.name)));}
 assert.equal(hash(fs.readFileSync(target)),migration.sourceSha256);replace(target,candidate);journal.steps.push('source-and-runtime-applied');save();
 // Generate via the canonical synchronizer, but atomically replace only changed artifacts.
 const built=generator.buildArtifacts();
 for(const [file,content]of built.files){const bytes=Buffer.isBuffer(content)?content:Buffer.from(content);if(fs.existsSync(file)&&hash(fs.readFileSync(file))===hash(bytes))continue;replace(file,bytes);}
 generator.sync({check:true});journal.steps.push('canonical-derived-parity-pass');
 for(const row of otherSources)assert.equal(hash(fs.readFileSync(path.join(root,'scenarios',row.filename))),row.sha256,'Other official source changed');
 journal.complete=true;journal.otherOfficialSourcesUnchanged=true;journal.finished=new Date().toISOString();save();
 console.log(JSON.stringify({complete:true,files:journal.files.length,sourceSha256:hash(fs.readFileSync(target)),otherOfficialSourcesUnchanged:true}));
}catch(e){
 journal.error=String(e.stack||e);journal.rollback=[];
 for(const row of [...journal.files].reverse()){
  const file=path.join(root,row.relative);try{const current=fs.existsSync(file)?hash(fs.readFileSync(file)):null;if(current===row.before){journal.rollback.push({file:row.relative,status:'unchanged'});continue;}assert.equal(current,row.after,'Concurrent change: not overwritten');
   if(row.existed)atomic(file,fs.readFileSync(path.join(backup,row.relative)));else fs.unlinkSync(file);
   journal.rollback.push({file:row.relative,status:'restored'});
  }catch(err){journal.rollback.push({file:row.relative,status:'requires-review',error:err.message});}
 }
 save();console.error(journal.error);process.exitCode=1;
}
