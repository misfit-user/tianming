import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),log=path.join(work,'architecture.log');
const fd=fs.openSync(log,'w'),start=Date.now();
const r=spawnSync(process.execPath,[path.join(root,'web/scripts/lint-arch-all.js')],{cwd:root,stdio:['ignore',fd,fd],timeout:150000,windowsHide:true});fs.closeSync(fd);
const text=fs.readFileSync(log,'utf8');const report={passed:r.status===0&&!r.error,exitCode:r.status,error:r.error?.message||null,elapsedMs:Date.now()-start,summary:text.split(/\r?\n/).filter(l=>l.startsWith('[lint-arch-all]'))};
fs.writeFileSync(path.join(work,'architecture.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));process.exitCode=report.passed?0:1;
