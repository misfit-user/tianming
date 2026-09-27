import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';import cp from 'node:child_process';
const d='docs/endturn-final-closeout-20260919',parent='D:/tianming-task-artifacts-20260919/prior-evidence-'+Date.now();
const names=['ai-memory-upgrade-r2-20260918','endturn-reliability-20260918','endturn-recovery-20260919','endturn-commit-reliability-20260919','snapshot-deadlines-20260919','storage-read-deadlines-20260919','storage-write-reliability-20260919','desktop-bridge-reliability-20260919','desktop-autosave-reliability-20260919'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function scan(root,rel=''){let out=[];for(const e of fs.readdirSync(path.join(root,rel),{withFileTypes:true})){const sub=path.join(rel,e.name);if(e.isSymbolicLink())throw Error('Unexpected link within task evidence');if(e.isDirectory())out=out.concat(scan(root,sub));else{const bytes=fs.readFileSync(path.join(root,sub));out.push({file:sub,bytes:bytes.length,sha256:sha(bytes)});}}return out;}
fs.mkdirSync(parent,{recursive:true});const moved=[];
for(const name of names){const src=path.resolve('docs',name),dest=path.join(parent,name);if(!fs.existsSync(src)||fs.lstatSync(src).isSymbolicLink())continue;
 const before=scan(src);fs.cpSync(src,dest,{recursive:true,errorOnExist:true,force:false});if(JSON.stringify(before)!==JSON.stringify(scan(dest))||JSON.stringify(before)!==JSON.stringify(scan(src)))throw Error('Evidence mismatch; original remains intact');
 fs.writeFileSync(path.join(parent,name+'.verified.json'),JSON.stringify({source:src,destination:dest,files:before},null,2));
 fs.rmSync(src,{recursive:true});const link=cp.spawnSync('cmd.exe',['/d','/c','mklink','/J',src,dest],{encoding:'utf8'});if(link.status!==0)throw Error('Verified evidence at '+dest+'; link failed');
 if(JSON.stringify(before)!==JSON.stringify(scan(src)))throw Error('Evidence link mismatch');moved.push({name,source:src,destination:dest,bytes:before.reduce((n,r)=>n+r.bytes,0),files:before.length});
}
fs.writeFileSync(d+'/prior-evidence-relocation.json',JSON.stringify({at:new Date().toISOString(),moved,verified:true},null,2));
const recovery=JSON.parse(fs.readFileSync(d+'/pressure-source-recovery.json','utf8')),bytes=fs.readFileSync(recovery.recoveredPath);
if(sha(bytes)!==recovery.sha256||fs.statSync(recovery.target).size!==0)throw Error('Restoration precondition changed');
fs.writeFileSync(recovery.target,bytes);if(sha(fs.readFileSync(recovery.target))!==recovery.sha256)throw Error('Restored file hash mismatch');
fs.writeFileSync(d+'/disk-interruption-restored.json',JSON.stringify({at:new Date().toISOString(),file:recovery.target,sha256:recovery.sha256,restored:true,movedBytes:moved.reduce((n,r)=>n+r.bytes,0)},null,2));console.log('Exact source restored; only generated task evidence moved with verified original-path links:',moved.length,'directories.');
