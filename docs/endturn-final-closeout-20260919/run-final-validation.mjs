import fs from 'node:fs';import cp from 'node:child_process';import crypto from 'node:crypto';
const d='docs/endturn-final-closeout-20260919',base=JSON.parse(fs.readFileSync(d+'/baseline.json','utf8'));
const sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const sourceFiles=base.files.map(r=>r.file).filter(f=>fs.existsSync(f)&&!f.startsWith('web/backups/'));
for(const f of ['web/tm-endturn-recovery-vault.js','web/tm-endturn-save-reconcile.js','web/modules/ai-change-applier/policy-format.js','web/scripts/smoke-recovery-vault.js','web/scripts/smoke-final-save-reconcile.js','web/scripts/smoke-final-recovery-races.js','web/scripts/smoke-memory-scoring-equivalence.js'])if(!sourceFiles.includes(f))sourceFiles.push(f);
for(const folder of ['web','web/scripts']) for(const f of fs.readdirSync(folder)) { const file=folder+'/'+f; if(/\.(?:js|mjs)$/.test(f)&&!sourceFiles.includes(file))sourceFiles.push(file); }
const workspace=JSON.parse(fs.readFileSync(d+'/validation-workspace.json','utf8'));process.env.TEMP=workspace.temp;process.env.TMP=workspace.temp;
const before=sourceFiles.map(file=>({file,sha256:sha(file)}));fs.writeFileSync(d+'/final-tested-inputs.json',JSON.stringify({at:new Date().toISOString(),files:before},null,2));
function run(name,args,timeout){const out=fs.openSync(d+'/'+name+'.log','w'),start=Date.now();const r=cp.spawnSync(process.execPath,args,{stdio:['ignore',out,out],timeout});fs.closeSync(out);console.log(name,'exit',r.status,'ms',Date.now()-start);return{name,exit:r.status,signal:r.signal,ms:Date.now()-start,error:r.error&&r.error.message};}
const commands=[];
commands.push(run('final-architecture',['web/scripts/lint-arch-all.js'],180000));
commands.push(run('final-browser',['docs/endturn-final-closeout-20260919/browser-final-test.mjs'],120000));
commands.push(run('final-full-tests',['web/scripts/run-smokes.js','--all','--jobs','2','--no-retry','--report',d+'/final-full-tests.json'],1800000));
const mjs=fs.readdirSync('web/scripts').filter(f=>/^smoke-.*\.mjs$/.test(f));for(const file of mjs)commands.push(run('extra-'+file.slice(0,-4),['web/scripts/'+file],120000));
commands.push(run('final-official-parity',['web/scripts/verify-official-scenario-parity.js'],180000));
const changed=before.filter(r=>!fs.existsSync(r.file)||sha(r.file)!==r.sha256).map(r=>r.file);
fs.writeFileSync(d+'/final-run-status.json',JSON.stringify({at:new Date().toISOString(),commands,changedDuringRun:changed},null,2));console.log('SOURCE_CHANGES_DURING_RUN',JSON.stringify(changed));
if(commands.some(r=>r.exit!==0))process.exitCode=1;
