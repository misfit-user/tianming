// Read-only comparison of installed runtime and original scenario byte hashes.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const read=f=>JSON.parse(fs.readFileSync(path.join(w,f),'utf8'));
const plan=read('patch-plan.json'),base=read('baseline.json');
const runtime=plan.map(p=>({file:p.file,expected:p.after,actual:hash(fs.readFileSync(path.join(root,p.file)))}));
const sources=base.sources.map(p=>({file:p.file,expected:p.sha256,actual:hash(fs.readFileSync(path.join(root,p.file))),scenarioId:JSON.parse(fs.readFileSync(path.join(root,p.file),'utf8')).id}));
const fixture=read('viewport-test-update.json');
const fixtureHash=hash(fs.readFileSync(path.join(root,fixture.file)));
const result={at:new Date().toISOString(),runtime,sources,fixtureUnchanged:fixtureHash===fixture.after,allMatch:runtime.concat(sources).every(p=>p.actual===p.expected)};
fs.writeFileSync(path.join(w,'current-inspection.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));if(!result.allMatch||!result.fixtureUnchanged)process.exitCode=1;
