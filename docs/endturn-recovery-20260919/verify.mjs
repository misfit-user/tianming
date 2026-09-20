import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { parse } from 'acorn';
const dir='docs/endturn-recovery-20260919';
const json=name=>JSON.parse(fs.readFileSync(dir+'/'+name,'utf8'));
const base=json('baseline.json'),changes=json('changes.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const created=['web/tm-endturn-response-recovery.js','web/scripts/lib-turn-response-recovery.js','web/scripts/smoke-turn-response-recovery.js','web/scripts/smoke-turn-recovery-quality.js'];
const files=[...new Set(changes.map(r=>r.file).concat(created))].filter(f=>f.startsWith('web/')).sort();
const fileChecks=files.map(file=>{const b=fs.readFileSync(file),last=changes.filter(r=>r.file===file).at(-1),syntax=file.endsWith('.js')?cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'}):{status:0};return {file,sha256:sha(b),hashMatches:!last||last.after===sha(b),syntax:syntax.status,created:created.includes(file),bytes:b.length};});
const quality=[];
for(const file of ['web/tm-endturn-ai.js','web/tm-endturn-validity.js','web/tm-endturn-mode-contract.js','web/tm-endturn-pipeline-steps.js']){
  const before=base.files.find(r=>r.file===file);quality.push({check:file+' unchanged',ok:sha(fs.readFileSync(file))===before.sha256});
}
function functions(source){const out=new Map();function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id)out.set(node.id.name,source.slice(node.body.start,node.body.end).replace(/\r\n/g,'\n'));for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}}walk(parse(source,{ecmaVersion:'latest'}));return out;}
const agent='web/tm-endturn-agent-mode.js',oldAgent=functions(fs.readFileSync(base.backup+'/'+agent,'utf8')),newAgent=functions(fs.readFileSync(agent,'utf8'));
for(const name of ['_depthGate','_selfCheck','_buildSystemPrompt','_buildTurnPrompt'])quality.push({check:'Agent '+name+' unchanged',ok:oldAgent.has(name)&&oldAgent.get(name)===newAgent.get(name)});
const oldRetry=functions(fs.readFileSync(base.backup+'/web/tm-ai-infra-retry.js','utf8')),newRetry=functions(fs.readFileSync('web/tm-ai-infra-retry.js','utf8'));
for(const name of ['_aiWithStreamScope','_aiComputeTimeout','_aiErrorIsTerminal'])quality.push({check:'Transport '+name+' unchanged',ok:oldRetry.has(name)&&oldRetry.get(name)===newRetry.get(name)});
quality.push({check:'Uncached request policy unchanged',ok:oldRetry.get('_aiFetchWithRetry')===newRetry.get('_aiFetchWithRetryUncached')});
function log(name){const bytes=fs.readFileSync(dir+'/'+name);return bytes.toString(bytes[0]===255&&bytes[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');}
const failures=name=>[...log(name).matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm)].map(m=>m[1]);
const before=json('baseline-tests.json'),after=json('final-tests.json');
const oldFailed=before.results.filter(r=>!r.pass).map(r=>r.name),nowFailed=after.results.filter(r=>!r.pass).map(r=>r.name);
const oldArch=failures('baseline-architecture.log'),nowArch=failures('final-architecture.log');
const ownDiff=json('own-diff-check.json');
const diff=cp.spawnSync('git',['diff','--check','--',...files],{encoding:'utf8'});
const tests=after.results.filter(r=>/^smoke-turn-(response-recovery|recovery-quality)\.js$/.test(r.name)).map(r=>({name:r.name,pass:r.pass,detail:String(r.output).trim().split('\n').at(-1)}));
const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const report={at:new Date().toISOString(),head,baselineHead:base.head,branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),files:fileChecks,qualityChecks:quality,baselineTests:before.summary,finalTests:after.summary,testsComplete:after.complete,newTests:tests,previousFailures:oldFailed,failures:nowFailed,newFailures:nowFailed.filter(n=>!oldFailed.includes(n)),baselineArchitectureFailures:oldArch,architectureFailures:nowArch,newArchitectureFailures:nowArch.filter(n=>!oldArch.includes(n)),ownDiffClean:ownDiff.length>0&&ownDiff.every(r=>!r.output&&r.exit<=1),scopedDiff:{exit:diff.status,output:(diff.stdout||'')+(diff.stderr||'')},manifest:json('manifest-check.json'),benchmark:json('benchmark.json')};
fs.writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify({...report,files:fileChecks.map(r=>({file:r.file,hash:r.hashMatches,syntax:r.syntax})),benchmark:report.benchmark.summary},null,2));
if(head!==base.head||fileChecks.some(r=>!r.hashMatches||r.syntax!==0)||quality.some(r=>!r.ok)||!report.ownDiffClean||diff.status!==0||!after.complete||report.newFailures.length||report.newArchitectureFailures.length||report.manifest.exit!==0)process.exitCode=1;
