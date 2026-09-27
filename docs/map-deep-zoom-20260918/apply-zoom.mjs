// Install the tested view-only patch with exact-byte concurrency checks and rollback.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';import vm from 'node:vm';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=n=>JSON.parse(fs.readFileSync(path.join(work,n),'utf8'));
const base=read('baseline.json'),plan=read('patch-plan.json'),tests=read('unit-staged.json');assert.equal(tests.failed,0);
assert.ok(plan.length===2&&plan.every(p=>['web/phase8-formal-map.js','web/tm-map-label-collide.js'].includes(p.file)));
for(const p of base.sources)assert.equal(hash(fs.readFileSync(path.join(root,p.file))),p.sha256,'Scenario changed concurrently: '+p.file);
for(const p of plan){assert.equal(hash(fs.readFileSync(path.join(root,p.file))),p.before,'Runtime changed concurrently');const b=fs.readFileSync(path.join(work,'after',path.basename(p.file)));assert.equal(hash(b),p.after);new vm.Script(b.toString('utf8'),{filename:p.file});}
const journalPath=path.join(work,'applied.json');assert.ok(!fs.existsSync(journalPath),'Review existing application journal first');
const journal={time:new Date().toISOString(),complete:false,scope:'view only; no map geometry, scenario, account, save, API, version or release writes',files:[]};
function save(){fs.writeFileSync(journalPath,JSON.stringify(journal,null,2));}
function durable(file,bytes){const fd=fs.openSync(file,'r+');try{let pos=0;while(pos<bytes.length){const n=fs.writeSync(fd,bytes,pos,bytes.length-pos,pos);assert.ok(n>0);pos+=n;}fs.ftruncateSync(fd,bytes.length);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}}
try{
 for(const p of plan){const file=path.join(root,p.file),bytes=fs.readFileSync(path.join(work,'after',path.basename(p.file))),tmp=file+'.deep-zoom.tmp';
  assert.equal(hash(fs.readFileSync(file)),p.before);assert.ok(!fs.existsSync(tmp),'Unexpected temp file');
  const row={...p,applied:false};journal.files.push(row);save();
  const fd=fs.openSync(tmp,'wx');try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}
  try{fs.renameSync(tmp,file);row.mode='rename';}catch(e){if(!['EPERM','EACCES','EBUSY'].includes(e.code))throw e;assert.equal(hash(fs.readFileSync(file)),p.before);row.writeStarted=true;save();durable(file,bytes);fs.unlinkSync(tmp);row.mode='verified-backup-in-place-Windows-shared-handle';}
  assert.equal(hash(fs.readFileSync(file)),p.after);row.applied=true;save();
 }
 for(const p of base.sources)assert.equal(hash(fs.readFileSync(path.join(root,p.file))),p.sha256);
 journal.complete=true;journal.sourcesUnchanged=true;save();console.log(JSON.stringify(journal,null,2));
}catch(e){journal.error=String(e.stack||e);for(const row of [...journal.files].reverse()){if(!row.applied&&!row.writeStarted)continue;const file=path.join(root,row.file),backup=fs.readFileSync(path.join(work,'before',path.basename(row.file)));assert.equal(hash(backup),row.before);durable(file,backup);row.restored=hash(fs.readFileSync(file))===row.before;}save();throw e;}
