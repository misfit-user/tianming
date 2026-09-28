import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import crypto from 'node:crypto';import cp from 'node:child_process';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(here,'../..'),web=path.join(repo,'web');
if(os.hostname()!=='LAPTOP-AV4J1O7I')throw Error('wrong device');
const read=name=>fs.readFileSync(path.join(here,name),'utf8');
const hash=buf=>crypto.createHash('sha256').update(buf).digest('hex');
const git=(...args)=>cp.spawnSync('C:/Program Files/Git/cmd/git.exe',['--no-optional-locks','-C',repo,...args],{encoding:'utf8',windowsHide:true});
const runtime=['tm-endturn-apply.js','tm-faction-membership.js','tm-map-system.js','map-integration.js','tm-ai-change-narrative.js'];
const changed=runtime.concat(['scripts/smoke-tianqi-map-runtime.js','scripts/smoke-territory-hardening.js']);
const files=changed.map(name=>{
 const file=path.join(web,name),bytes=fs.readFileSync(file),backup=path.join(here,'originals',name);
 const syntax=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8',windowsHide:true});
 if(syntax.status!==0)throw Error('syntax: '+name+' '+syntax.stderr);
 const old=fs.existsSync(backup)?fs.readFileSync(backup):null;
 const count=b=>({crlf:(b.toString('utf8').match(/\r\n/g)||[]).length,lf:(b.toString('utf8').match(/(?<!\r)\n/g)||[]).length});
 return {path:'web/'+name,sha256:hash(bytes),before:old?hash(old):null,bytes:bytes.length,syntaxExitCode:syntax.status,lineEndings:{before:old?count(old):null,after:count(bytes)}};
});
const untouched=['tm-three-systems-ext.js','tm-endturn-prompt.js','phase8-formal-map.js'];
const preserved=untouched.map(name=>({path:'web/'+name,unchanged:fs.readFileSync(path.join(web,name)).equals(fs.readFileSync(path.join(here,'originals',name)))}));
if(preserved.some(f=>!f.unchanged))throw Error('previous scoped file concurrently changed');
const check=git('diff','--check','--',...changed.map(f=>'web/'+f));
if(check.status!==0)throw Error('diff check: '+check.stdout+check.stderr);
const report=JSON.parse(read('final-smokes.json'));
if(!report.complete || report.results.length!==report.summary.selected)throw Error('incomplete smoke report');
const expectedFailures=['smoke-runtime-save-consistency.js','smoke-shaosong-target-map-regions.js'];
const failures=report.results.filter(r=>!r.pass);
if(JSON.stringify(failures.map(x=>x.name).sort())!==JSON.stringify(expectedFailures))throw Error('new regression failures');
const baselineEvidence={
 'smoke-runtime-save-consistency.js':{log:'baseline-save.log',marker:'读档以显式 Promise 屏障等待编年 hydration 和 receipt 恢复后才开放玩法'},
 'smoke-shaosong-target-map-regions.js':{log:'baseline-scenario.log',marker:'Western Xia external force summary not synced'}
};
for(const failure of failures){const evidence=baselineEvidence[failure.name];if(!read(evidence.log).includes(evidence.marker)||!failure.output.includes(evidence.marker))throw Error('baseline failure does not match');}
const diagnostics=text=>text.split('\n').filter(s=>/FAIL|unapproved duplicate provider|^      TM\.|^      tm-ai-infra/.test(s)).map(s=>s.replace(/\s*\(\d+(?:\.\d+)?s\)/g,'').trim());
const archBefore=diagnostics(read('arch-before.log')),archAfter=diagnostics(read('arch-final.log'));
if(JSON.stringify(archBefore)!==JSON.stringify(archAfter))throw Error('new architecture diagnostic');
const suites=report.results.filter(r=>/^smoke-territory-/.test(r.name)).map(r=>{
 const rows=r.output.trim().split('\n').filter(s=>s.startsWith('{"suite":'));if(!rows.length||!r.pass)throw Error('territory suite did not pass '+r.name);
 return JSON.parse(rows[rows.length-1]);
});
const result={status:'SCOPED_FIX_VERIFIED_WITH_BASELINE_FAILURES',device:os.hostname(),directory:repo,verifiedAt:new Date().toISOString(),
 head:git('rev-parse','HEAD').stdout.trim(),branch:git('branch','--show-current').stdout.trim(),commitCreated:false,pushed:false,published:false,
 files,preserved,tests:suites,relatedSmokes:report.summary,unrelatedFailures:failures.map(r=>({name:r.name,baselineEvidence:baselineEvidence[r.name]})),
 architecture:{newDiagnostics:false,failedGuards:5,totalGuards:13,diagnostics:archAfter},diffCheckExitCode:check.status,
 verificationScope:'Production functions in isolated Node fixtures on the actual device; no real save loaded; no external AI request; no full game GUI end-to-end run.'};
fs.writeFileSync(path.join(here,'FINAL-RESULT.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(here,'status-after.txt'),git('status','--porcelain=v1','-uall').stdout);
console.log(JSON.stringify({status:result.status,device:result.device,head:result.head,runtimeFiles:runtime.length,tests:suites,related:result.relatedSmokes,newArchitectureDiagnostics:false,diffCheckExitCode:check.status},null,2));
