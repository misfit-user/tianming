import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {parse} from 'acorn';
const dir='docs/endturn-commit-reliability-20260919',json=n=>JSON.parse(fs.readFileSync(dir+'/'+n,'utf8'));
const base=json('baseline.json'),changes=json('changes.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const created=['web/scripts/lib-save-commit-boundary.js','web/scripts/smoke-save-commit-boundary.js'];
const files=[...new Set(changes.map(r=>r.file).concat(created))].filter(f=>f.startsWith('web/')).sort();
const checks=files.map(file=>{const b=fs.readFileSync(file),last=changes.filter(r=>r.file===file).at(-1),syntax=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});return {file,sha256:sha(b),hashMatches:!last||sha(b)===last.after,syntaxExit:syntax.status,created:created.includes(file)};});
const quality=[];
for(const file of ['web/tm-state-snapshot.js','web/tm-endturn-ai.js','web/tm-endturn-validity.js','web/tm-endturn-mode-contract.js','web/tm-endturn-pipeline-steps.js','web/tm-endturn-agent-mode.js','web/tm-endturn-response-recovery.js','web/tm-ai-infra.js','web/tm-ai-infra-retry.js']){
  quality.push({check:file+' unchanged',ok:sha(fs.readFileSync(file))===base.files.find(r=>r.file===file).sha256});
}
function functions(file){const source=fs.readFileSync(file,'utf8'),map=new Map();function walk(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)map.set(n.id.name,source.slice(n.body.start,n.body.end).replace(/\r\n/g,'\n'));for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(walk);else if(v&&typeof v==='object')walk(v);}}walk(parse(source,{ecmaVersion:'latest'}));return map;}
for(const [file,names] of [['web/tm-storage.js',['createCanonicalPayload']],['web/tm-endturn-render.js',['_endTurn_stageTurnData','_endTurn_publishStagedTurnData','_endTurn_render']],['web/tm-endturn-core.js',['_tmCaptureEndTurnTransaction','_tmPrepareEndTurnBoundary']]]){
  const old=functions(base.backup+'/'+file),now=functions(file);for(const name of names)quality.push({check:name+' unchanged',ok:old.has(name)&&old.get(name)===now.get(name)});
}
function textLog(name){const b=fs.readFileSync(dir+'/'+name);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');}
const arch=n=>[...textLog(n).matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm)].map(m=>m[1]);
const before=json('baseline-tests.json'),after=json('final-tests.json');
const beforeFailures=before.results.filter(r=>!r.pass).map(r=>r.name),afterFailures=after.results.filter(r=>!r.pass).map(r=>r.name);
const beforeArch=arch('baseline-architecture.log'),afterArch=arch('final-architecture.log');
const diff=cp.spawnSync('git',['diff','--check','--',...files],{encoding:'utf8'}),own=json('own-diff-check.json');
const newTests=after.results.filter(r=>r.name==='smoke-save-commit-boundary.js').map(r=>({name:r.name,pass:r.pass,detail:String(r.output).trim().split('\n').at(-1)}));
const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={at:new Date().toISOString(),head,baselineHead:base.head,branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),files:checks,qualityChecks:quality,baselineTests:before.summary,finalTests:after.summary,testsComplete:after.complete,newTests,failures:afterFailures,newFailures:afterFailures.filter(x=>!beforeFailures.includes(x)),baselineArchitectureFailures:beforeArch,architectureFailures:afterArch,newArchitectureFailures:afterArch.filter(x=>!beforeArch.includes(x)),ownDiffClean:own.length>0&&own.every(r=>!r.output&&r.exit<=1),scopedDiff:{exit:diff.status,output:(diff.stdout||'')+(diff.stderr||'')},benchmark:json('benchmark.json'),reproduced:json('reproduced.json')};
fs.writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,benchmark:report.benchmark.summary},null,2));
if(head!==base.head||checks.some(c=>!c.hashMatches||c.syntaxExit)||quality.some(c=>!c.ok)||!report.ownDiffClean||diff.status||!after.complete||report.newFailures.length||report.newArchitectureFailures.length||newTests.length!==1||!newTests[0].pass)process.exitCode=1;
