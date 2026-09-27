// Guarded local application. No Git operations, publication, or user-save changes.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(work,n),'utf8'));
const base=read('baseline.json'),audit=read('candidate-report.json'),geo=read('geometry-verification.json'),native=read('native-verification.json'),location=read('location-runtime-plan.json');
const candidate=fs.readFileSync(path.join(work,'candidate.json'));
assert.equal(geo.failed,0);assert.equal(native.failed,0);assert.equal(hash(candidate),audit.candidateSha256);assert.equal(geo.candidateSha256,audit.candidateSha256);assert.equal(native.candidateSha256,audit.candidateSha256);
for(const row of base.otherSources)assert.equal(hash(fs.readFileSync(path.join(root,row.file))),row.sha256,'Concurrent source edit '+row.file);
assert.equal(hash(fs.readFileSync(path.join(root,location.file))),location.before,'Concurrent location runtime edit');
const backup=path.join(work,'applied-backup');assert.ok(!fs.existsSync(backup),'Existing application journal requires review');fs.mkdirSync(backup,{recursive:true});
const journal={started:new Date().toISOString(),complete:false,sourceBefore:base.sourceSha256,sourceAfter:audit.candidateSha256,files:[],steps:[]};
const save=()=>fs.writeFileSync(path.join(work,'applied.json'),JSON.stringify(journal,null,2));
function write(file,bytes,item){
 const tmp=file+'.cz-r3.tmp';assert.ok(!fs.existsSync(tmp),'Unexpected temporary file');const staged=path.join(work,'staged-'+item.after);if(!fs.existsSync(staged))fs.writeFileSync(staged,bytes);assert.equal(hash(fs.readFileSync(staged)),item.after);fs.copyFileSync(staged,tmp,fs.constants.COPYFILE_EXCL);assert.equal(hash(fs.readFileSync(tmp)),item.after);
 try{fs.renameSync(tmp,file);}catch(error){
  if(!['EPERM','EACCES','EBUSY'].includes(error.code)||!item.before)throw error;
  const old=fs.readFileSync(path.join(backup,item.file));assert.equal(hash(old),item.before);assert.equal(hash(fs.readFileSync(file)),item.before,'Concurrent locked file edit');
  const h=fs.openSync(file,'r+');try{let offset=0;while(offset<bytes.length){const n=fs.writeSync(h,bytes,offset,bytes.length-offset,offset);assert.ok(n>0);offset+=n;}fs.ftruncateSync(h,bytes.length);fs.fsyncSync(h);}
  catch(e){fs.writeSync(h,old,0,old.length,0);fs.ftruncateSync(h,old.length);fs.fsyncSync(h);throw e;}finally{fs.closeSync(h);}
  fs.unlinkSync(tmp);item.writeMode='verified-backup-in-place-for-shared-Windows-handle';
 }
 assert.equal(hash(fs.readFileSync(file)),item.after);
}
function replace(file,bytes){
 if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);const old=fs.existsSync(file)?fs.readFileSync(file):null;if(old&&old.equals(bytes))return;
 const relative=path.relative(root,file);assert.ok(!relative.startsWith('..'));const dest=path.join(backup,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});if(old)fs.writeFileSync(dest,old);
 const item={file:relative,before:old?hash(old):null,after:hash(bytes),applied:false};journal.files.push(item);save();fs.mkdirSync(path.dirname(file),{recursive:true});write(file,bytes,item);item.applied=true;save();
}
try{
 replace(path.join(root,location.file),fs.readFileSync(path.join(work,'runtime-after/tm-map-locations.js')));
 replace(path.join(root,base.source),candidate);
 replace(path.join(root,'web/data/maps/chongzhen-prefecture-r3/geometry.json'),fs.readFileSync(path.join(work,'neutral-map.json')));
 replace(path.join(root,'web/data/maps/chongzhen-prefecture-r3/scenario-bindings.json'),fs.readFileSync(path.join(work,'map-bindings.json')));
 const smoke=path.join(root,'web/scripts/smoke-tianqi-map-runtime.js'),oldSmoke=fs.readFileSync(smoke,'utf8');assert.ok(/\b296\b/.test(oldSmoke),'Expected R2 smoke baseline');replace(smoke,oldSmoke.replace(/\b296\b/g,'307'));
 const generator=(await import(pathToFileURL(path.join(root,'web/scripts/sync-official-scenarios.js')))).default;
 for(const [file,bytes] of generator.buildArtifacts().files)replace(file,bytes);
 generator.sync({check:true});journal.steps.push('official-derived-parity');
 for(const row of base.otherSources)if(row.file!==base.source)assert.equal(hash(fs.readFileSync(path.join(root,row.file))),row.sha256,'Other scenario edited concurrently');
 assert.equal(hash(fs.readFileSync(path.join(root,base.source))),audit.candidateSha256);journal.complete=true;save();
 console.log(JSON.stringify({complete:true,files:journal.files.length,sourceSha256:audit.candidateSha256}));
}catch(error){
 journal.error=String(error.stack||error);journal.rollback=[];
 for(const item of [...journal.files].reverse()){
  const file=path.join(root,item.file);
  try{if(!fs.existsSync(file))continue;const current=hash(fs.readFileSync(file));if(current===item.before)continue;if(current!==item.after){journal.rollback.push({file:item.file,status:'changed-concurrently-needs-review'});continue;}if(item.before){fs.copyFileSync(path.join(backup,item.file),file);assert.equal(hash(fs.readFileSync(file)),item.before);}else fs.unlinkSync(file);journal.rollback.push({file:item.file,status:'restored'});}
  catch(e){journal.rollback.push({file:item.file,error:String(e)});}
 }
 save();console.error(journal.error);process.exitCode=1;
}
