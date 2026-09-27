import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import {parse} from 'acorn';
const dir='docs/desktop-bridge-reliability-20260919',json=name=>JSON.parse(fs.readFileSync(dir+'/'+name,'utf8'));
const base=json('baseline.json'),changes=json('changes.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const created=['web/scripts/lib-desktop-bridge-reliability.js','web/scripts/smoke-desktop-bridge-reliability.js'];
const files=[...new Set(changes.map(r=>r.file).concat(created))].filter(f=>f.startsWith('web/')).sort();
const checks=files.map(file=>{const bytes=fs.readFileSync(file),last=changes.filter(r=>r.file===file).at(-1),syntax=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8'});return {file,sha256:sha(bytes),hashMatches:!last||last.after===sha(bytes),syntax:syntax.status};});
const quality=[];
for(const r of base.files.filter(r=>!files.includes(r.file)))quality.push({name:r.file+' unchanged',ok:sha(fs.readFileSync(r.file))===r.sha256});
function functions(text){const out=new Map();function visit(n){if(!n||typeof n!=='object')return;if(n.type==='FunctionDeclaration'&&n.id)out.set(n.id.name,text.slice(n.body.start,n.body.end).replace(/\r\n/g,'\n'));for(const v of Object.values(n)){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')visit(v);}}visit(parse(text,{ecmaVersion:'latest'}));return out;}
const targets={
 'web/tm-endturn-render.js':['_endTurn_stateChecksum','_endTurn_saveSnapshot','_endTurn_finalizeRecords','_endTurn_render'],
 'web/tm-storage.js':['_runStorageWrite','createCanonicalPayload','saveManyAtomic','_putSaveRecordsAtomic','save','load','_get','_boundedStorageRead'],
 'web/tm-save-lifecycle.js':['_buildSaveState','_fullLoadGameApplyImpl','fullLoadGame','_autoSaveSnapshotGM']
};
for(const [file,names]of Object.entries(targets)){const a=functions(fs.readFileSync(base.backup+'/'+file,'utf8')),b=functions(fs.readFileSync(file,'utf8'));for(const name of names)quality.push({name:file+':'+name,ok:a.has(name)&&a.get(name)===b.get(name)});}
function log(name){const b=fs.readFileSync(dir+'/'+name);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');}
const arch=name=>[...log(name).matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm)].map(m=>m[1]);
const baseline=json('baseline-tests.json'),final=json('final-tests.json'),extended=json('extended-tests.json');
const prior=JSON.parse(fs.readFileSync('docs/storage-write-reliability-20260919/extended-tests.json','utf8')).results.filter(r=>!r.pass).map(r=>r.name);
const failures=extended.results.filter(r=>!r.pass).map(r=>r.name),oldArch=arch('baseline-architecture.log'),newArch=arch('final-architecture.log');
const native=json('electron-result.json'),nativeCurrent=native.sourceSHA===sha(fs.readFileSync('web/tm-endturn-reliability.js'))&&native.mainSHA===sha(fs.readFileSync('main-turn-data-commit.js'));
const diff=cp.spawnSync('git',['diff','--check','--',...files],{encoding:'utf8'}),own=json('own-diff-check.json');
const result={at:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),baselineHead:base.head,branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),files:checks,qualityChecks:quality,baseline:baseline.summary,final:final.summary,extended:extended.summary,complete:final.complete&&extended.complete,newTests:final.results.filter(r=>r.name==='smoke-desktop-bridge-reliability.js').map(r=>({name:r.name,pass:r.pass,detail:String(r.output).trim().split('\n').at(-1)})),failures,newFailures:failures.filter(f=>!prior.includes(f)),baselineArchitectureFailures:oldArch,architectureFailures:newArch,newArchitectureFailures:newArch.filter(f=>!oldArch.includes(f)),ownDiffClean:own.length>0&&own.every(r=>!r.output&&r.exit<=1),scopedDiff:{exit:diff.status,output:(diff.stdout||'')+(diff.stderr||'')},nativeCurrent,native:{ok:native.outcome.ok,checks:native.outcome.results.length,versions:native.versions},reproduced:json('reproduced.json')};
fs.writeFileSync(dir+'/verification.json',JSON.stringify(result,null,2));
console.log(JSON.stringify({...result,files:checks.map(r=>({file:r.file,hash:r.hashMatches,syntax:r.syntax})),reproduced:undefined},null,2));
if(!result.complete||checks.some(r=>!r.hashMatches||r.syntax!==0)||quality.some(r=>!r.ok)||!result.ownDiffClean||diff.status!==0||result.newFailures.length||result.newArchitectureFailures.length||!nativeCurrent||!native.outcome.ok||result.head!==base.head)process.exitCode=1;
