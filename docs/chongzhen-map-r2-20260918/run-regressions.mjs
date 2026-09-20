import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]);
const dir=path.join(work,'regressions');fs.mkdirSync(dir,{recursive:true});
const jobs=['smoke-map-realm-layout.js','smoke-map-live-vitals.js','smoke-phase8-map-live-panels.js','smoke-army-march-order.js','smoke-army-march-viz.js','smoke-tianqi-map-runtime.js','smoke-tianqi-official-cache-recovery.js','smoke-stable-id-reference-integrity.js','lint-arch-all.js','verify-official-scenario-parity.js'];
const results=[];
for(const name of jobs){const file=path.join(root,'web/scripts',name),fd=fs.openSync(path.join(dir,name+'.log'),'w'),start=Date.now();
 console.log('START '+name);
 const r=spawnSync(process.execPath,[file],{cwd:root,stdio:['ignore',fd,fd],timeout:150000,windowsHide:true});fs.closeSync(fd);
 const row={name,passed:r.status===0&&!r.error,status:r.status,signal:r.signal,error:r.error?.message||null,ms:Date.now()-start};results.push(row);console.log(JSON.stringify(row));
 fs.writeFileSync(path.join(work,'regressions.json'),JSON.stringify({complete:results.length===jobs.length,results},null,2));
}
process.exitCode=results.some(r=>!r.passed)?1:0;
