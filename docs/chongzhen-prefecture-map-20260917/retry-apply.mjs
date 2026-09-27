// Review the failed rename attempt, then retry with a backed-up locked-file writer.
import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const prior=JSON.parse(fs.readFileSync(path.join(work,'applied.json'),'utf8'));
assert.equal(prior.complete,false);assert.ok(prior.files.every(r=>!r.applied));
for(const row of prior.files)assert.equal(hash(fs.readFileSync(path.join(root,row.relative))),row.before,'Source must still match failed attempt baseline');
const archive=path.join(work,'failed-rename-attempt');assert.ok(!fs.existsSync(archive));fs.mkdirSync(archive);
for(const row of prior.files){const tmp=path.join(root,row.relative)+'.chongzhen-map.tmp';if(fs.existsSync(tmp)){assert.equal(hash(fs.readFileSync(tmp)),row.after);fs.copyFileSync(tmp,path.join(archive,'candidate.tmp'));fs.unlinkSync(tmp);}}
fs.renameSync(path.join(work,'applied.json'),path.join(archive,'applied.json'));fs.renameSync(path.join(work,'applied-backup'),path.join(archive,'applied-backup'));
const file=path.join(root,'docs/chongzhen-prefecture-map-20260917/apply-candidate.mjs');let text=fs.readFileSync(file,'utf8');
const needle='fs.renameSync(tmp,file);assert.equal(hash(fs.readFileSync(file)),hash(bytes));';assert.equal(text.split(needle).length,2);
const replacement=`try { fs.renameSync(tmp,file); }
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
 assert.equal(hash(fs.readFileSync(file)),hash(bytes));`;
text=text.replace(needle,replacement);fs.writeFileSync(file,text);
console.log('Failed rename preserved; source verified unchanged; guarded retry.');
await import(pathToFileURL(file));
