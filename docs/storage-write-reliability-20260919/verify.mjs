import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {parse} from 'acorn';
const dir='docs/storage-write-reliability-20260919',json=n=>JSON.parse(fs.readFileSync(dir+'/'+n,'utf8'));
const base=json('baseline.json'),changes=json('changes.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const created=['web/scripts/smoke-storage-write-reliability.js','web/scripts/smoke-save-codec-deadlines.js'];
const files=[...new Set(changes.map(r=>r.file).concat(created))].filter(f=>f.startsWith('web/')).sort();
const fileChecks=files.map(file=>{const b=fs.readFileSync(file),last=changes.filter(r=>r.file===file).at(-1);const syntax=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});return{file,sha256:sha(b),hashMatches:!last||last.after===sha(b),syntax:syntax.status,bytes:b.length};});
const quality=[];
for(const file of ['tm-endturn-ai.js','tm-endturn-agent-mode.js','tm-endturn-validity.js','tm-endturn-mode-contract.js','tm-endturn-pipeline-steps.js','tm-endturn-response-recovery.js','tm-ai-infra.js','tm-ai-infra-retry.js','tm-state-snapshot.js']){
  quality.push({check:file+' unchanged',ok:sha(fs.readFileSync('web/'+file))===base.files.find(r=>r.file==='web/'+file).sha256});
}
function funcs(source){const out=new Map();function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)out.set(n.id.name,source.slice(n.start,n.end).replace(/\r\n/g,'\n'));for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(parse(source,{ecmaVersion:'latest'}));return out;}
const names={
 'tm-storage.js':['createCanonicalPayload','saveManyAtomic','save','_toSaveMetadata','_saveIdentityFromGameState','_recoverLocalSaveBatchJournal','_migrateFromLocalStorage','_migrateFromOldDB','open','_boundedStorageRead'],
 'tm-endturn-core.js':['_tmCaptureEndTurnTransaction','_tmPrepareEndTurnBoundary','_tmFinalizeEndTurnTransaction'],
 'tm-endturn-render.js':['_endTurn_finalizeRecords','_endTurn_render','_endTurn_stageTurnData','_endTurn_publishStagedTurnData']
};
for(const [file,list]of Object.entries(names)){const before=funcs(fs.readFileSync(base.backup+'/web/'+file,'utf8')),after=funcs(fs.readFileSync('web/'+file,'utf8'));for(const name of list)quality.push({check:name+' unchanged',ok:before.has(name)&&before.get(name)===after.get(name)});}
function log(n){const b=fs.readFileSync(dir+'/'+n);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');}
const arch=n=>[...log(n).matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm)].map(m=>m[1]);
const before=json('baseline-tests.json'),after=json('final-tests.json'),extended=json('extended-tests.json'),oldArch=arch('baseline-architecture.log'),newArch=arch('final-architecture.log');
const own=json('own-diff-check.json'),diff=cp.spawnSync('git',['diff','--check','--',...files],{encoding:'utf8'});
const browser=json('browser-realtime-result.json');
const previous=json('baseline.json');
const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={at:new Date().toISOString(),head,baselineHead:base.head,branch:base.branch,files:fileChecks,qualityChecks:quality,baselineTests:before.summary,finalTests:after.summary,extendedTests:extended.summary,testsComplete:after.complete&&extended.complete,newTests:after.results.filter(t=>/^smoke-(storage-write-reliability|save-codec-deadlines)\.js$/.test(t.name)).map(t=>({name:t.name,pass:t.pass,detail:String(t.output).trim().split('\n').at(-1)})),failures:after.results.filter(t=>!t.pass).map(t=>t.name),extendedFailures:extended.results.filter(t=>!t.pass).map(t=>t.name),baselineArchitectureFailures:oldArch,architectureFailures:newArch,newArchitectureFailures:newArch.filter(x=>!oldArch.includes(x)),ownDiffClean:own.length>0&&own.every(r=>!r.output&&r.exit<=1),scopedDiff:{exit:diff.status,output:(diff.stdout||'')+(diff.stderr||'')},browser,browserCurrent:browser.sourceSHA===sha(fs.readFileSync('web/tm-storage.js')),reproduced:json('reproduced.json')};
fs.writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,files:fileChecks.map(f=>({file:f.file,hash:f.hashMatches,syntax:f.syntax})),browser:{ok:browser.outcome?.ok,checks:browser.outcome?.results.length,version:browser.version?.product}},null,2));
if(head!==base.head||fileChecks.some(f=>!f.hashMatches||f.syntax)||quality.some(q=>!q.ok)||!report.ownDiffClean||diff.status||!report.testsComplete||report.failures.length||report.newArchitectureFailures.length||report.extendedFailures.some(x=>x!=='smoke-startup-phase-observability.js')||!report.browserCurrent||!browser.outcome?.ok)process.exitCode=1;
