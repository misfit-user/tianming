// Apply the verified refinement; never commits, pushes, publishes, or edits a save.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=n=>JSON.parse(fs.readFileSync(path.join(w,n),'utf8'));
const base=read('baseline.json'),audit=read('refinement-verification.json'),native=read('native-verification.json'),view=read('view-plan.json'),candidate=fs.readFileSync(path.join(w,'candidate.json'));
assert.equal(audit.failed,0);assert.equal(native.failed,0);assert.equal(hash(candidate),audit.candidateSha256);assert.equal(native.candidateSha256,audit.candidateSha256);
for(const f of base.officialSources)assert.equal(hash(fs.readFileSync(path.join(root,f.file))),f.sha256,'Concurrent source change: '+f.file);
assert.equal(hash(fs.readFileSync(path.join(root,view.file))),view.before,'Concurrent renderer edit');
const backup=path.join(w,'applied-backup');assert.ok(!fs.existsSync(backup),'Existing application requires review');fs.mkdirSync(backup,{recursive:true});
const journal={started:new Date().toISOString(),complete:false,sourceBefore:base.sourceSha256,sourceAfter:audit.candidateSha256,files:[],steps:[]};
const save=()=>fs.writeFileSync(path.join(w,'applied.json'),JSON.stringify(journal,null,2));
function write(file,bytes,item){
 const tmp=file+'.cz-r2.tmp';assert.ok(!fs.existsSync(tmp),'Unexpected temporary file');fs.writeFileSync(tmp,bytes,{flag:'wx'});
 try{fs.renameSync(tmp,file);}
 catch(e){
  if(!['EPERM','EACCES','EBUSY'].includes(e.code)||!item.before)throw e;
  const original=fs.readFileSync(path.join(backup,item.file));assert.equal(hash(original),item.before);assert.equal(hash(fs.readFileSync(file)),item.before,'Concurrent file write');
  const fd=fs.openSync(file,'r+');
  try{let off=0;while(off<bytes.length){const n=fs.writeSync(fd,bytes,off,bytes.length-off,off);assert.ok(n>0);off+=n;}fs.ftruncateSync(fd,bytes.length);fs.fsyncSync(fd);}
  catch(err){fs.writeSync(fd,original,0,original.length,0);fs.ftruncateSync(fd,original.length);fs.fsyncSync(fd);throw err;}
  finally{fs.closeSync(fd);}fs.unlinkSync(tmp);item.writeMode='verified-backup-shared-handle';
 }
 assert.equal(hash(fs.readFileSync(file)),item.after);
}
function replace(file,bytes){
 if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);const old=fs.existsSync(file)?fs.readFileSync(file):null;if(old&&old.equals(bytes))return;
 const relative=path.relative(root,file);assert.ok(!relative.startsWith('..'));const dest=path.join(backup,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});if(old)fs.writeFileSync(dest,old);
 const item={file:relative,before:old?hash(old):null,after:hash(bytes),applied:false};journal.files.push(item);save();fs.mkdirSync(path.dirname(file),{recursive:true});write(file,bytes,item);item.applied=true;save();
}
try{
 replace(path.join(root,view.file),fs.readFileSync(path.join(w,'runtime-after/phase8-formal-map.js')));
 replace(path.join(root,base.source),candidate);
 replace(path.join(root,'web/data/maps/chongzhen-prefecture-r2/geometry.json'),fs.readFileSync(path.join(w,'neutral-map.json')));
 replace(path.join(root,'web/data/maps/chongzhen-prefecture-r2/scenario-bindings.json'),fs.readFileSync(path.join(w,'map-bindings.json')));
 const generator=(await import(pathToFileURL(path.join(root,'web/scripts/sync-official-scenarios.js')))).default;
 const built=generator.buildArtifacts();for(const [f,bytes]of built.files)replace(f,bytes);
 generator.sync({check:true});journal.steps.push('official-derived-parity');
 for(const f of base.officialSources)if(f.file!==base.source)assert.equal(hash(fs.readFileSync(path.join(root,f.file))),f.sha256,'Other official source changed');
 assert.equal(hash(fs.readFileSync(path.join(root,base.source))),audit.candidateSha256);journal.complete=true;save();
 console.log(JSON.stringify({complete:true,files:journal.files.length,sourceSha256:audit.candidateSha256}));
}catch(e){
 journal.error=String(e.stack||e);journal.rollback=[];
 for(const item of [...journal.files].reverse()){
  const file=path.join(root,item.file);try{
   if(!fs.existsSync(file)){journal.rollback.push({file:item.file,state:'missing'});continue;}
   const live=hash(fs.readFileSync(file));if(live===item.before)continue;
   if(live!==item.after){journal.rollback.push({file:item.file,state:'concurrent-or-partial-requires-review'});continue;}
   if(item.before)fs.writeFileSync(file,fs.readFileSync(path.join(backup,item.file)));else fs.unlinkSync(file);
   journal.rollback.push({file:item.file,state:'restored'});
  }catch(err){journal.rollback.push({file:item.file,error:String(err)});}
 }
 save();console.error(journal.error);process.exitCode=1;
}
