import fs from 'node:fs';import cp from 'node:child_process';import crypto from 'node:crypto';import {createRequire} from 'node:module';import path from 'node:path';const {parse}=createRequire(path.resolve('package.json'))('acorn');
const d='docs/endturn-final-closeout-20260919',read=n=>JSON.parse(fs.readFileSync(d+'/'+n,'utf8')),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const base=read('baseline.json'),changes=read('changes.json');
const added=['web/tm-endturn-recovery-vault.js','web/tm-endturn-save-reconcile.js','web/modules/ai-change-applier/policy-format.js','web/scripts/lib-recovery-vault-fixture.js','web/scripts/smoke-recovery-vault.js','web/scripts/smoke-final-save-reconcile.js','web/scripts/smoke-final-recovery-races.js','web/scripts/smoke-memory-scoring-equivalence.js','web/scripts/fixtures/memory-hybrid-reference.js'];
const files=[...new Set(changes.map(r=>r.file).concat(added))].filter(f=>f.startsWith('web/')).sort();
const fileChecks=files.map(file=>{const b=fs.readFileSync(file),last=changes.filter(r=>r.file===file).at(-1),syntax=file.endsWith('.js')?cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:15000}):{status:0};return {file,sha256:sha(b),expectedHashMatches:!last||last.after===sha(b),syntax:syntax.status,bytes:b.length,created:!base.files.some(r=>r.file===file)};});
const quality=[];
for(const file of ['web/tm-endturn-validity.js','web/tm-endturn-mode-contract.js','web/tm-endturn-agent-mode.js','web/tm-endturn-ai-infer.js','web/tm-endturn-prompt.js','web/tm-endturn-pipeline-steps.js','web/tm-endturn-pipeline-executor.js','web/tm-ai-infra.js','web/tm-ai-infra-retry.js','web/tm-memory-envelope.js','web/tm-memory-retrieval.js','web/tm-memory-context-compiler.js','main-impl.js','preload-impl.js','main-turn-data-commit.js']){
 const before=base.files.find(r=>r.file===file);quality.push({check:'unchanged '+file,ok:!!before&&sha(fs.readFileSync(file))===before.sha256});
}
function funcs(source){const m=new Map();function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)m.set(n.id.name,source.slice(n.start,n.end).replace(/\r\n/g,'\n'));for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}visit(parse(source,{ecmaVersion:'latest',sourceType:'module'}));return m;}
for(const row of read('moved-functions.json'))quality.push({check:'exact relocated function '+row.name,ok:funcs(fs.readFileSync(row.to,'utf8')).get(row.name)===row.text.replace(/\r\n/g,'\n')});
for(const [file,names]of [['web/tm-save-lifecycle.js',['_buildSaveState','_prepareGMForSave']],['web/tm-endturn-core.js',['_tmCommitEndTurnTransaction','_tmRollbackEndTurnTransaction']]]){
 const before=funcs(fs.readFileSync(base.backup+'/'+file,'utf8')),after=funcs(fs.readFileSync(file,'utf8'));for(const name of names)quality.push({check:'unchanged function '+name,ok:before.has(name)&&before.get(name)===after.get(name)});
}
const baseline=read('baseline-full-tests.json'),full=read('final-full-tests.json'),run=read('final-run-status.json'),browser=read('browser-realtime-result.json');
const archText=fs.readFileSync(d+'/final-architecture.log','utf8');
const archPass=[...archText.matchAll(/^\[lint-arch-all\] PASS\s+(\S+)/gm)].map(m=>m[1]);
const archFail=[...archText.matchAll(/^\[lint-arch-all\] FAIL\s+(\S+)/gm)].map(m=>m[1]);
const caseNames=['smoke-recovery-vault.js','smoke-final-save-reconcile.js','smoke-memory-scoring-equivalence.js','smoke-final-recovery-races.js'];
const caseResults=caseNames.map(name=>{const row=full.results.find(r=>r.name===name);return{name,pass:row&&row.pass,detail:row&&row.output.trim().split('\n').at(-1)};});
const own=read('own-diff-check.json'),diff=cp.spawnSync('git',['diff','--check','--',...files],{encoding:'utf8'});
const legacy=read('archive-relocation.json');const archives={count:legacy.files.length,preserved:legacy.files.every(r=>{const f=legacy.destination+'/'+r.file;return fs.existsSync(f)&&sha(fs.readFileSync(f))===r.sha256;}),destination:legacy.destination};
const benchmark=read('memory-benchmark.json');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const manifest=JSON.parse(fs.readFileSync('web/startup-script-phases.json','utf8'));
const proof={at:new Date().toISOString(),head,baselineHead:base.head,branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),files:fileChecks,quality,baseline:baseline.summary,full:full.summary,fullComplete:full.complete,failures:full.results.filter(r=>!r.pass).map(r=>({name:r.name,output:r.output.slice(-1500)})),commands:run.commands,changedDuringRun:run.changedDuringRun,architecture:{passed:archPass,failed:archFail},caseResults,ownDiffClean:own.length>0&&own.every(r=>!r.output&&r.exit<=1),scopedDiff:{exit:diff.status,output:diff.stdout+diff.stderr},archiveRelocation:archives,installedDependency:read('yaml-sync.json'),scriptCount:manifest.scriptCount,browser,memoryBenchmark:benchmark};
proof.browserSourcesMatch=browser.sourceSHA===sha(fs.readFileSync('web/tm-endturn-response-recovery.js'))&&browser.vaultSHA===sha(fs.readFileSync('web/tm-endturn-recovery-vault.js'));
proof.benchmarkSourceMatches=benchmark.results.after.sourceSha256===sha(fs.readFileSync('web/tm-memory-hybrid.js'));
proof.ok=head===base.head&&fileChecks.every(r=>r.expectedHashMatches&&r.syntax===0)&&quality.every(r=>r.ok)&&full.complete&&full.summary.fail===0&&run.commands.every(r=>r.exit===0)&&run.changedDuringRun.length===0&&archFail.length===0&&archPass.length===13&&proof.ownDiffClean&&diff.status===0&&archives.preserved&&proof.browserSourcesMatch&&browser.outcome&&browser.outcome.ok&&proof.benchmarkSourceMatches&&benchmark.exactOutput;
fs.writeFileSync(d+'/verification.json',JSON.stringify(proof,null,2));console.log(JSON.stringify({ok:proof.ok,head,files:fileChecks.length,quality:quality.filter(r=>!r.ok),baseline:proof.baseline,full:proof.full,changedDuringRun:run.changedDuringRun,arch:proof.architecture,commands:run.commands,diff:proof.scopedDiff,caseResults,browser:browser.outcome},null,2));if(!proof.ok)process.exitCode=1;
