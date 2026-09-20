import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
const root=path.resolve(process.argv[2]||'.');
const work=path.join(root,'docs/shaosong-map-integration-20260917/map-stage');
const jobs=['smoke-map-live-vitals.js','smoke-map-realm-layout.js','smoke-ledger-consistency.js','smoke-start-hierarchy-immutability.js','smoke-native-fiscal-consumers.js','smoke-stable-id-reference-integrity.js','lint-arch-all.js'];
const results=[];fs.mkdirSync(path.join(work,'regression'),{recursive:true});
for(const job of jobs){const start=Date.now();const run=cp.spawnSync(process.execPath,[path.join(root,'web/scripts',job)],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:16*1024*1024,windowsHide:true});
 const stdout=run.stdout||'',stderr=run.stderr||'';fs.writeFileSync(path.join(work,'regression',job+'.log'),stdout+stderr);
 const row={job,passed:run.status===0&&!run.error&&!run.signal,exitCode:run.status,error:run.error?.message,signal:run.signal,ms:Date.now()-start,tail:(stdout+stderr).slice(-1800)};
 results.push(row);console.log(JSON.stringify(row));fs.writeFileSync(path.join(work,'regression.json'),JSON.stringify({complete:results.length===jobs.length,results},null,2));
}
if(results.some(x=>!x.passed))process.exitCode=1;
