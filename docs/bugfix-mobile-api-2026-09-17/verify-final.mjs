import fs from 'node:fs';import path from 'node:path';import vm from 'node:vm';import cp from 'node:child_process';import os from 'node:os';import crypto from 'node:crypto';import {fileURLToPath} from 'node:url';
const here=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(here,'../..');
if(os.hostname()!=='LAPTOP-AV4J1O7I')throw Error('wrong device');
const read=n=>fs.readFileSync(path.join(here,n),'utf8');const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const record=JSON.parse(read('patch-record.json')),report=JSON.parse(read('final-smokes.json'));
if(!report.complete||report.summary.fail||report.summary.suspect||report.summary.skipped||report.summary.waived)throw Error('targeted regression incomplete or failed');
const tests=report.results.filter(r=>/^smoke-mobile-api-/.test(r.name));if(tests.length!==2||tests.some(r=>!r.pass||r.exit!==0))throw Error('mobile test evidence missing');
const suites=tests.map(r=>{const lines=r.output.trim().split('\n');return JSON.parse(lines.findLast(l=>l.startsWith('{"suite":')));});
if(suites.reduce((sum,r)=>sum+r.passed,0)!==22||suites.some(r=>r.failed))throw Error('unexpected test totals');
const files=record.files.map(entry=>{
 const bytes=fs.readFileSync(path.join(root,entry.file)),backup=fs.readFileSync(path.join(here,'originals',path.basename(entry.file)+'.bak'));
 if(sha(backup)!==entry.before)throw Error('backup mismatch: '+entry.file);new vm.Script(bytes.toString('utf8'),{filename:entry.file});
 return {file:entry.file,before:sha(backup),after:sha(bytes),backupMatches:true,bytes:bytes.length};
});
const testFiles=['web/scripts/smoke-mobile-api-transport.js','web/scripts/smoke-mobile-api-integration.js'];
for(const name of testFiles)new vm.Script(fs.readFileSync(path.join(root,name),'utf8'),{filename:name});
const git=(args)=>{const r=cp.spawnSync('C:/Program Files/Git/cmd/git.exe',['--no-optional-locks','-C',root,...args],{encoding:'utf8',windowsHide:true});if(r.status!==0)throw Error('git verification failed: '+r.stderr);return r.stdout.trim();};
const diffArgs=['diff','--check','--',...files.map(f=>f.file),...testFiles];
const defaultDiff=cp.spawnSync('C:/Program Files/Git/cmd/git.exe',['--no-optional-locks','-C',root,...diffArgs],{encoding:'utf8',windowsHide:true});
fs.writeFileSync(path.join(here,'diff-check-default.log'),String(defaultDiff.stdout||'')+String(defaultDiff.stderr||''));
// Keep the repository's frozen CRLF bytes; recognize CR as a line ending only.
// All normal end-of-line spaces, end-of-file blanks and space-before-tab checks remain enabled.
git(['-c','core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol',...diffArgs]);
const before=read('arch-before.log'),after=read('arch-final.log');
if(!after.includes('[lint-arch-all] FAIL —')&&!after.includes('[lint-arch-all] PASS —'))throw Error('architecture run unfinished');
const failures=s=>Array.from(s.matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]*)/gm),m=>m[1]).sort();
const oldFailures=failures(before),newFailures=failures(after),added=newFailures.filter(n=>!oldFailures.includes(n));
if(added.length)throw Error('new architecture failure: '+added.join(','));
const vendor=JSON.parse(read('vendor-comparison.json'));
const result={status:'SCOPED_MOBILE_API_FIX_VERIFIED_WITH_EXISTING_GUARD_FAILURES',device:os.hostname(),directory:root,verifiedAt:new Date().toISOString(),
 head:git(['rev-parse','HEAD']),branch:git(['branch','--show-current']),files,
 tests:suites,relatedSmokes:report.summary,vendorComparison:vendor,
 architecture:{beforeFailures:oldFailures,afterFailures:newFailures,newFailureCategories:added,heapFailureBefore:/Native stack trace|heap out of memory/.test(before),heapFailureAfter:/Native stack trace|heap out of memory/.test(after)},
 diffCheckExitCode:0,defaultDiffCheckExitCode:defaultDiff.status,diffCheckMode:'standard whitespace checks plus CRLF recognition; process-local only',installedSoftware:false,realAPIInvoked:false,realPhoneTested:false,phoneUpdated:false,commitCreated:false,pushed:false,released:false};
fs.writeFileSync(path.join(here,'FINAL-RESULT.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({status:result.status,device:result.device,head:result.head,runtimeFiles:files.length,tests:suites,related:result.relatedSmokes,architecture:result.architecture,diffCheckExitCode:0},null,2));
