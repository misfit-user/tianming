// Install the verified province/leaf transfer adapter; do not touch scenario content.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex'),read=f=>JSON.parse(fs.readFileSync(path.join(work,f),'utf8'));
const plan=read('membership-plan.json'),tests=read('native-verification.json');assert.equal(tests.failed,0);assert.equal(tests.passed,22);
const target=path.join(root,plan.file),before=fs.readFileSync(target),after=fs.readFileSync(path.join(work,'runtime-after/tm-faction-membership.js'));
assert.equal(hash(after),plan.after);assert.equal(hash(before),plan.before,'Concurrent runtime change; stop');
const sources=fs.readdirSync(path.join(root,'scenarios')).filter(n=>n.endsWith('（官方）.json')).map(name=>({name,sha256:hash(fs.readFileSync(path.join(root,'scenarios',name)))}));
const backup=path.join(work,'membership-applied-backup.js');assert.ok(!fs.existsSync(backup),'Existing journal must be reviewed');fs.writeFileSync(backup,before);assert.equal(hash(fs.readFileSync(backup)),plan.before);
const journal={started:new Date().toISOString(),complete:false,file:plan.file,before:plan.before,after:plan.after,sources,writeMode:'rename'};
const tmp=target+'.chongzhen-membership.tmp';assert.ok(!fs.existsSync(tmp));const fd=fs.openSync(tmp,'wx');try{fs.writeFileSync(fd,after);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}assert.equal(hash(fs.readFileSync(tmp)),plan.after);
try{
 assert.equal(hash(fs.readFileSync(target)),plan.before);
 try{fs.renameSync(tmp,target);}catch(error){
  if(!['EPERM','EACCES','EBUSY'].includes(error.code))throw error;
  assert.equal(hash(fs.readFileSync(target)),plan.before,'Concurrent edit during lock');
  const fd=fs.openSync(target,'r+');
  try{let pos=0;while(pos<after.length){const n=fs.writeSync(fd,after,pos,after.length-pos,pos);assert.ok(n>0);pos+=n;}fs.ftruncateSync(fd,after.length);fs.fsyncSync(fd);}
  catch(e){fs.writeSync(fd,before,0,before.length,0);fs.ftruncateSync(fd,before.length);fs.fsyncSync(fd);throw e;}
  finally{fs.closeSync(fd);}
  journal.writeMode='verified-backup-in-place-for-Windows-shared-handle';fs.unlinkSync(tmp);
 }
 assert.equal(hash(fs.readFileSync(target)),plan.after);
 for(const s of sources)assert.equal(hash(fs.readFileSync(path.join(root,'scenarios',s.name))),s.sha256,'Scenario changed during runtime-only application');
 journal.complete=true;console.log(JSON.stringify({complete:true,file:plan.file,sha256:plan.after,writeMode:journal.writeMode}));
}catch(error){journal.error=String(error.stack||error);process.exitCode=1;console.error(journal.error);}
fs.writeFileSync(path.join(work,'membership-applied.json'),JSON.stringify(journal,null,2));
