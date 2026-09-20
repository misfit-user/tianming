import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { parse } from 'acorn';
const dir='docs/storage-read-deadlines-20260919',json=name=>JSON.parse(fs.readFileSync(dir+'/'+name,'utf8'));
const base=json('baseline.json'),changes=json('changes.json'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const created=['web/scripts/lib-storage-read-deadlines.js','web/scripts/smoke-storage-read-deadlines.js'];
const files=[...new Set(changes.map(c=>c.file).concat(created))].filter(f=>f.startsWith('web/')).sort();
const checked=files.map(file=>{const b=fs.readFileSync(file),last=changes.filter(c=>c.file===file).at(-1),syntax=cp.spawnSync(process.execPath,['--check',file],{encoding:'utf8',timeout:10000});return {file,sha256:sha(b),hashMatches:!last||last.after===sha(b),syntaxExit:syntax.status,bytes:b.length};});
const quality=base.files.filter(r=>!['web/tm-storage.js','web/scripts/verify-all.js'].includes(r.file)).map(r=>({check:r.file+' unchanged',ok:sha(fs.readFileSync(r.file))===r.sha256}));
function functions(source){const out=new Map();function walk(node){if(!node||typeof node!=='object')return;if(node.type==='FunctionDeclaration'&&node.id)out.set(node.id.name,source.slice(node.body.start,node.body.end).replace(/\r\n/g,'\n'));for(const value of Object.values(node)){if(Array.isArray(value))value.forEach(walk);else if(value&&typeof value==='object')walk(value);}}walk(parse(source,{ecmaVersion:'latest'}));return out;}
const before=functions(fs.readFileSync(base.backup+'/web/tm-storage.js','utf8')),after=functions(fs.readFileSync('web/tm-storage.js','utf8'));
for(const name of ['createCanonicalPayload','_checksumJson','_putSaveRecord','_putSaveRecordsAtomic','_put','_putManyAtomic','_del','_deleteSaveRecord','_deleteMany','save','saveManyAtomic','clearPendingTurnDataPublishAtomic','_migrateFromLocalStorage','_migrateFromOldDB'])quality.push({check:'Storage '+name+' unchanged',ok:before.has(name)&&before.get(name)===after.get(name)});
const source=fs.readFileSync('web/tm-storage.js','utf8');quality.push({check:'DB_VERSION remains 6',ok:/var DB_VERSION = 6;/.test(source)});
function readLog(name){const b=fs.readFileSync(dir+'/'+name);return b.toString(b[0]===255&&b[1]===254?'utf16le':'utf8').replace(/^\uFEFF/,'');}
const arch=name=>[...readLog(name).matchAll(/^\[lint-arch-all\] FAIL\s+([a-z][a-z-]+)/gm)].map(m=>m[1]);
const baseline=json('baseline-tests.json'),final=json('final-tests.json'),extended=json('extended-tests.json');
const oldArch=arch('baseline-architecture.log'),nowArch=arch('final-architecture.log');
const prior=JSON.parse(fs.readFileSync('docs/snapshot-deadlines-20260919/extended-tests.json','utf8'));
const oldFailures=prior.results.filter(r=>!r.pass).map(r=>r.name),newFailures=extended.results.filter(r=>!r.pass).map(r=>r.name);
const own=json('own-diff-check.json');const diff=cp.spawnSync('git',['diff','--check','--',...files],{encoding:'utf8'});
const head=cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const tests=final.results.filter(r=>r.name==='smoke-storage-read-deadlines.js').map(r=>({name:r.name,pass:r.pass,detail:String(r.output).trim().split('\n').at(-1)}));
const report={at:new Date().toISOString(),head,baselineHead:base.head,branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),files:checked,quality,baseline:baseline.summary,final:final.summary,extended:extended.summary,testsComplete:final.complete&&extended.complete,newTests:tests,extendedFailures:newFailures,priorExtendedFailures:oldFailures,newFailures:newFailures.filter(n=>!oldFailures.includes(n)),baselineArchitectureFailures:oldArch,architectureFailures:nowArch,newArchitectureFailures:nowArch.filter(n=>!oldArch.includes(n)),ownDiffClean:own.length>0&&own.every(r=>!r.output&&r.exit<=1),diff:{exit:diff.status,output:(diff.stdout||'')+(diff.stderr||'')},reproduced:json('reproduced.json')};
fs.writeFileSync(dir+'/verification.json',JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(head!==base.head||checked.some(f=>!f.hashMatches||f.syntaxExit)||quality.some(q=>!q.ok)||!report.ownDiffClean||diff.status||!report.testsComplete||final.summary.fail||report.newFailures.length||report.newArchitectureFailures.length)process.exitCode=1;
