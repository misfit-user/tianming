import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import vm from 'node:vm';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const dir=path.dirname(fileURLToPath(import.meta.url)),root=path.resolve(dir,'../..');
if(os.hostname()!=='LAPTOP-AV4J1O7I')throw Error('Unexpected device');
const manifests=['patch-manifest.json','context-patch-manifest.json'].flatMap(f=>JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).files);
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const files=manifests.map(entry=>{
  const bytes=fs.readFileSync(path.join(root,entry.path)),actual=hash(bytes);
  if(actual!==entry.after)throw Error('Source changed after tested patch: '+entry.path);
  new vm.Script(bytes.toString('utf8'),{filename:entry.path});
  const backup=fs.readFileSync(path.join(dir,'originals',path.basename(entry.path)+'.bak'));
  if(hash(backup)!==entry.before)throw Error('Backup mismatch: '+entry.path);
  return {...entry,readbackMatches:true,backupMatches:true};
});
const tests=['web/scripts/smoke-territory-ownership-sync.js','web/scripts/smoke-territory-context-sync.js','web/scripts/smoke-territory-render-economy.js'];
const git=args=>spawnSync('git',['--no-optional-locks','-C',root,...args],{encoding:'utf8',windowsHide:true});
const diff=git(['diff','--check','--',...files.map(f=>f.path),...tests]);
if(diff.status!==0)throw Error('Whitespace verification failed: '+diff.stdout+diff.stderr);
const report=JSON.parse(fs.readFileSync(path.join(dir,'final-smokes.json'),'utf8'));
const failureLines=name=>fs.readFileSync(path.join(dir,name),'utf8').split(/\r?\n/).filter(s=>/^\[lint-arch-all\] FAIL|^    \[lint-[^\]]+\] (FAIL|unapproved)/.test(s)).map(s=>s.replace(/ \([\d.]+s\)/g,''));
const before=failureLines('arch-before.log'),after=failureLines('arch-final.log');
const unchanged=JSON.stringify(before)===JSON.stringify(after);
if(!unchanged)throw Error('Architecture failure diagnostics changed');
if(!report.complete || report.summary.fail || report.summary.pass!==67 || report.summary.flaky || report.summary.suspect)throw Error('Final smoke evidence is not a clean pass');
const suites=tests.map(f=>{
  const row=report.results.find(r=>r.name===path.basename(f));
  if(!row || row.exit!==0 || !row.pass)throw Error('Missing successful test: '+f);
  const last=row.output.trim().split(/\r?\n/).reverse().find(s=>s.startsWith('{"suite":'));
  if(!last)throw Error('Missing suite counters: '+f);
  const result=JSON.parse(last);if(result.failed)throw Error('Failed suite '+f);
  return result;
});
const head=git(['rev-parse','HEAD']),branch=git(['branch','--show-current']);
if(head.status!==0 || branch.status!==0)throw Error('Cannot confirm repository identity');
const result={status:'TARGETED_TESTS_PASS_WITH_EXISTING_ARCH_FAILURES',device:os.hostname(),directory:root,
  verifiedAt:new Date().toISOString(),head:head.stdout.trim(),branch:branch.stdout.trim(),commitCreated:false,
  files,tests:suites,relatedSmokes:report.summary,diffCheckExitCode:diff.status,
  architecture:{preexistingFailuresUnchanged:unchanged,failures:after},
  validation:{productionWriterAndPromptExecuted:true,productionSvgAndBoundaryFunctionsExecuted:true,realFiscalProfileCalculationExecuted:true,
    storageValidation:'Synthetic JSON round-trip and world replacement rollback; not user save-file persistence',
    installedClientClicked:false,externalAiRequests:false,userSavesModified:false,dependenciesInstalled:false,globalSettingsChanged:false,pushed:false,released:false}};
fs.writeFileSync(path.join(dir,'FINAL-RESULT.json'),JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({status:result.status,head:result.head,files:files.length,tests:suites,related:report.summary,architectureFailuresUnchanged:unchanged,diffCheckExitCode:diff.status},null,2));
