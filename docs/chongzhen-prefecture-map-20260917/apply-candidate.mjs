// Apply only the reviewed map adaptation. No Git operations or publication.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');const read=n=>JSON.parse(fs.readFileSync(path.join(work,n),'utf8'));
const source=path.join(root,'scenarios/天启七年·九月（官方）.json'),candidate=fs.readFileSync(path.join(work,'candidate.json')),audit=read('candidate-report.json'),test=read('native-verification.json');
assert.equal(test.failed,0);assert.equal(test.candidateSha256,audit.candidateSha256);assert.equal(hash(candidate),audit.candidateSha256);assert.equal(hash(fs.readFileSync(source)),audit.sourceSha256,'Canonical source changed concurrently');
const generator=(await import(pathToFileURL(path.join(root,'web/scripts/sync-official-scenarios.js')))).default;
const otherSources=generator.ENTRIES.filter(e=>e.key!=='tianqi7').map(e=>({file:path.join(root,'scenarios',e.filename),sha256:hash(fs.readFileSync(path.join(root,'scenarios',e.filename)))}));
const backup=path.join(work,'applied-backup');assert.ok(!fs.existsSync(backup),'Existing application journal must be reviewed');fs.mkdirSync(backup,{recursive:true});
const journal={started:new Date().toISOString(),complete:false,sourceBefore:audit.sourceSha256,sourceAfter:audit.candidateSha256,files:[],otherSources:otherSources.map(r=>({relative:path.relative(root,r.file),sha256:r.sha256})),steps:[]};
const journalPath=path.join(work,'applied.json');function save(){fs.writeFileSync(journalPath,JSON.stringify(journal,null,2));}
function atomic(file,bytes){const tmp=file+'.chongzhen-map.tmp';assert.ok(!fs.existsSync(tmp),'Unexpected temporary file');const fd=fs.openSync(tmp,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}assert.equal(hash(fs.readFileSync(tmp)),hash(bytes));try { fs.renameSync(tmp,file); }
 catch(error) {
  if(!['EPERM','EACCES','EBUSY'].includes(error.code)||!fs.existsSync(file))throw error;
  const row=journal.files.findLast(r=>path.resolve(root,r.relative)===path.resolve(file));
  assert.ok(row&&row.before,'A verified backup is required');
  assert.equal(hash(fs.readFileSync(file)),row.before,'Concurrent file modification');
  const fd=fs.openSync(file,'r+');
  try { let offset=0;while(offset<bytes.length){const n=fs.writeSync(fd,bytes,offset,bytes.length-offset,offset);assert.ok(n>0);offset+=n;}fs.ftruncateSync(fd,bytes.length);fs.fsyncSync(fd); }
  catch(writeError){const old=fs.readFileSync(path.join(backup,row.relative));fs.writeSync(fd,old,0,old.length,0);fs.ftruncateSync(fd,old.length);fs.fsyncSync(fd);throw writeError;}
  finally{fs.closeSync(fd);}
  row.writeMode='verified-backup-in-place-windows-shared-handle';
  assert.equal(hash(fs.readFileSync(file)),hash(bytes));fs.unlinkSync(tmp);
 }
 assert.equal(hash(fs.readFileSync(file)),hash(bytes));}
function replace(file,bytes){if(!Buffer.isBuffer(bytes))bytes=Buffer.from(bytes);const existed=fs.existsSync(file),before=existed?fs.readFileSync(file):null;if(before&&before.equals(bytes))return;
 const relative=path.relative(root,file);assert.ok(!relative.startsWith('..'),'Outside project');const dest=path.join(backup,relative);fs.mkdirSync(path.dirname(dest),{recursive:true});if(before)fs.writeFileSync(dest,before);
 const item={relative,existed,before:before?hash(before):null,after:hash(bytes),applied:false};journal.files.push(item);save();fs.mkdirSync(path.dirname(file),{recursive:true});atomic(file,bytes);item.applied=true;save();}
try{
 replace(source,candidate);journal.steps.push('canonical-map-written');save();
 const base=path.join(root,'web/data/maps/chongzhen-prefecture-v1');
 replace(path.join(base,'geometry.json'),fs.readFileSync(path.join(work,'neutral-map.json')));
 replace(path.join(base,'scenario-bindings.json'),fs.readFileSync(path.join(work,'map-bindings.json')));
 const artifacts=generator.buildArtifacts();for(const [file,bytes]of artifacts.files)replace(file,Buffer.isBuffer(bytes)?bytes:Buffer.from(bytes));
 generator.sync({check:true});journal.steps.push('official-derived-parity');
 for(const row of otherSources)assert.equal(hash(fs.readFileSync(row.file)),row.sha256,'Other official source changed during operation');
 assert.equal(hash(fs.readFileSync(source)),audit.candidateSha256);journal.complete=true;journal.otherSourcesUnchanged=true;save();console.log(JSON.stringify({complete:true,changed:journal.files.length,sourceSha256:audit.candidateSha256}));
}catch(e){journal.error=String(e.stack||e);save();console.error(journal.error);process.exitCode=1;}
