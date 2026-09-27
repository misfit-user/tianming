// Final read-only code guards. Does not generate release metadata or alter code.
import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const dir=path.join(work,'final-guards');fs.mkdirSync(dir,{recursive:true});
const names=['lint-arch-all.js','verify-official-scenario-parity.js'];const results=[];
for(const name of names){const fd=fs.openSync(path.join(dir,name+'.log'),'w');const started=Date.now();console.log('START '+name);
 const r=spawnSync(process.execPath,[path.join(root,'web/scripts',name)],{cwd:root,timeout:150000,stdio:['ignore',fd,fd],windowsHide:true});fs.closeSync(fd);
 const row={name,passed:r.status===0&&!r.error,status:r.status,signal:r.signal,error:r.error?.message||null,elapsedMs:Date.now()-started};results.push(row);console.log(JSON.stringify(row));
 fs.writeFileSync(path.join(work,'final-guards.json'),JSON.stringify({checkedAt:new Date().toISOString(),complete:results.length===names.length,results},null,2));
}
if(results.some(r=>!r.passed))process.exitCode=1;
