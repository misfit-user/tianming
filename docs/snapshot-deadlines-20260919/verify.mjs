import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {parse} from 'acorn';
const dir='docs/snapshot-deadlines-20260919',json=n=>JSON.parse(fs.readFileSync(dir+'/'+n,'utf8'));
const base=json('baseline.json'),changes=json('changes.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const created=['web/scripts/lib-snapshot-deadlines.js','web/scripts/smoke-snapshot-deadlines.js'];
const files=[...new Set(changes.map(r=>r.file).concat(created))].filter(f=>f.startsWith('web/')).sort();
const checks=files.map(file=>{const b=fs.readFileSync(file),prior=changes.filter(r=>r.file===file).at(-1),syntax=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});return {file,sha256:sha(b),hashMatches:!prior||prior.after===sha(b),syntax:syntax.status,bytes:b.length};});
const quality=base.files.filter(r=>r.file!=='web/tm-state-snapshot.js'&&r.file!=='web/scripts/verify-all.js').map(r=>({check:r.file+' unchanged',ok:sha(fs.readFileSync(r.file))===r.sha256}));
function funcs(s){const out=new Map();function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)out.set(n.id.name,s.slice(n.start,n.end));for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}visit(parse(s,{ecmaVersion:'latest'}));return out;}
const beforeSource=fs.readFileSync(base.backup+'/web/tm-state-snapshot.js','utf8'),afterSource=fs.readFileSync('web/tm-state-snapshot.js','utf8');
const beforeFns=funcs(beforeSource),afterFns=funcs(afterSource);
for(const name of ['_captureFullState','_saveSnapshotFrom','saveSnapshot','_recordId','_lineageRecordFromGM','_collectAccessibleSnapshotRecords','_restoreFullState','timeTravel'])quality.push({check:name+' unchanged',ok:beforeFns.has(name)&&beforeFns.get(name)===afterFns.get(name)});
for(const name of ['DB_VERSION','MAX_SNAPSHOTS']){const re=new RegExp('var '+name+' = (\\d+)');quality.push({check:name+' unchanged',ok:beforeSource.match(re)[1]===afterSource.match(re)[1]});}
function log(name){const b=fs.readFileSync(dir+'/'+name);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');}
const arch=name=>[...log(name).matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm)].map(m=>m[1]);
const baseline=json('baseline-tests.json'),final=json('final-tests.json'),extended=json('extended-tests.json');
const previous=JSON.parse(fs.readFileSync('docs/endturn-recovery-20260919/verification.json','utf8'));
const failed=extended.results.filter(r=>!r.pass).map(r=>r.name),oldArch=arch('baseline-architecture.log'),newArch=arch('final-architecture.log');
const diff=cp.spawnSync('git',['diff','--check','--',...files],{encoding:'utf8'}),own=json('own-diff-check.json');
const report={at:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineHead:base.head,branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),files:checks,qualityChecks:quality,baselineTests:baseline.summary,finalTests:final.summary,extendedTests:extended.summary,complete:final.complete&&extended.complete,newTests:final.results.filter(r=>r.name==='smoke-snapshot-deadlines.js').map(r=>({name:r.name,pass:r.pass,detail:String(r.output).trim().split('\n').at(-1)})),failures:failed,newFailures:failed.filter(n=>!previous.failures.includes(n)),baselineArchitectureFailures:oldArch,architectureFailures:newArch,newArchitectureFailures:newArch.filter(n=>!oldArch.includes(n)),ownDiffClean:own.length>0&&own.every(r=>!r.output&&r.exit<=1),scopedDiff:{exit:diff.status,output:diff.stdout+diff.stderr},reproduced:json('reproduced.json')};
fs.writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(checks.some(r=>!r.hashMatches||r.syntax)||quality.some(r=>!r.ok)||report.head!==base.head||!report.complete||!report.ownDiffClean||diff.status||final.summary.fail||report.newFailures.length||report.newArchitectureFailures.length)process.exitCode=1;
