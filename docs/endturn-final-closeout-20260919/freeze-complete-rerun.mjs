import fs from 'node:fs';import crypto from 'node:crypto';import cp from 'node:child_process';
const d='docs/endturn-final-closeout-20260919',pressure=JSON.parse(fs.readFileSync(d+'/pressure-closeout.json','utf8'));
if(pressure.results.length!==3||pressure.results.some(r=>r.exit!==0))throw Error('All three original bounded cases must pass first');
const changes=JSON.parse(fs.readFileSync(d+'/changes.json','utf8')),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const conflicts=[...new Set(changes.map(r=>r.file))].filter(f=>fs.existsSync(f)&&sha(f)!==changes.filter(r=>r.file===f).at(-1).after);
if(conflicts.length)throw Error('Concurrent file changes require review: '+conflicts.join(', '));
for(const name of ['final-full-tests.json','final-full-tests.log','final-run-status.json','final-tested-inputs.json','verification.json']){const from=d+'/'+name,to=d+'/before-pressure-resolution-'+name;if(fs.existsSync(from)&&!fs.existsSync(to))fs.copyFileSync(from,to);}
const workspace=JSON.parse(fs.readFileSync(d+'/validation-workspace.json','utf8'));process.env.TEMP=workspace.temp;process.env.TMP=workspace.temp;
function run(args){const r=cp.spawnSync(process.execPath,args,{stdio:'inherit'});if(r.status!==0)process.exit(r.status||1);}
run([d+'/check-diff.mjs']);
run(['web/scripts/build-startup-phase-manifest.js','--check']);
run([d+'/run-final-validation.mjs']);
run([d+'/verify-final.mjs']);
run([d+'/write-closeout-report.mjs']);
