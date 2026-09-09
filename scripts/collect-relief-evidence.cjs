'use strict';
// Local-only evidence export. Logs are explicitly scoped and home paths redacted.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),os=require('os'),cp=require('child_process'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'web/dev-tools/perf-round1');
const baseline='14d477945f5ef78b913ed5f249b51c2002167d0f';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function redact(v){if(typeof v==='string')return v.replaceAll(os.homedir().replace(/\\/g,'\\\\'),'<user-profile>').replaceAll(os.homedir(),'<user-profile>').replaceAll(os.homedir().replace(/\\/g,'/'),'<user-profile>');if(Array.isArray(v))return v.map(redact);return v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,redact(x)])):v;}
const executions=[],incomplete=[];
for(const name of fs.readdirSync(base).filter(x=>x.startsWith('relief-')&&!x.startsWith('relief-evidence-export-'))){
  const dir=path.join(base,name),file=path.join(dir,'run.json');
  if(!fs.existsSync(file)){incomplete.push({directory:name,reason:'no completed execution record'});continue;}
  const run=read(file);if(run.head!==baseline||!run.complete){incomplete.push({directory:name,run});continue;}
  const logs=Object.fromEntries(['stdout.log','stderr.log'].map(name=>{const p=path.join(dir,name),text=redact(fs.readFileSync(p,'utf8'));return[name,{originalSha256:hash(p),redactedSha256:crypto.createHash('sha256').update(text).digest('hex'),text}];}));
  executions.push({directory:path.relative(root,dir),run,logs});
}
const final=executions.filter(e=>e.run.label==='relief-full-final').sort((a,b)=>a.run.startedAt.localeCompare(b.run.startedAt)).pop();
assert(final&&final.run.exitCode===0,'a completed final full suite is required');
const sourceFiles=cp.execFileSync('git',['diff','--name-only',baseline],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(p=>p&&(p.startsWith('web/')||p.startsWith('scripts/electron/')||p==='scripts/verify-electron-bridge.js'||p==='.github/workflows/ci.yml'));
for(const p of ['web/tm-relief-governance.js','web/tm-relief-governance-ui.js','web/scripts/smoke-relief-governance.js','web/scripts/smoke-relief-adjudication.js','scripts/electron/relief-pilot-cases.cjs'])if(!sourceFiles.includes(p))sourceFiles.push(p);
const sourceHashes=Object.fromEntries(sourceFiles.map(p=>[p,hash(path.join(root,p))]));
for(const[p,h]of Object.entries(sourceHashes))assert.equal(final.run.dirtyFileHashes[p],h,'code changed after the full run: '+p);
const args=process.argv.slice(2),smoke=read(path.resolve(root,args[args.indexOf('--smoke')+1]));
assert(smoke.complete&&smoke.head===baseline&&smoke.summary.fail===0);
assert.equal(new Set(smoke.results.map(r=>r.name)).size,smoke.expected.length);
assert.deepEqual(smoke.results.map(r=>r.name).sort(),smoke.expected.slice().sort());
assert(final.logs['stdout.log'].text.includes(smoke.runId));
const electron=[];
for(const label of ['relief-electron-shaosong-final','relief-electron-tianqi-final2','relief-electron-standard-final']){
  const e=executions.filter(e=>e.run.label===label).sort((a,b)=>a.run.startedAt.localeCompare(b.run.startedAt)).pop();
  assert(e&&e.run.exitCode===0,label+' must pass');
  const raw=fs.readFileSync(path.join(root,e.directory,'stdout.log'),'utf8'),m=/ELECTRON_REPORT (.+)/.exec(raw);assert(m);
  const file=path.resolve(root,m[1].trim()),report=read(file);assert(report.complete&&report.ok);
  for(const[p,h]of Object.entries(sourceHashes).filter(([p])=>!p.includes('/scripts/')&&!p.endsWith('.json')&&!p.startsWith('.github/')))assert.equal(e.run.dirtyFileHashes[p],h,'Electron source mismatch: '+p);
  electron.push({label,reportPath:path.relative(root,file),report,sha256:hash(file)});
}
const out=path.join(root,'docs/gameplay-relief-pilot');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(redact({baseline,branch:'codex/gameplay-relief-pilot',sourceHashes,executions,incomplete,electron,
  smoke:{runId:smoke.runId,head:smoke.head,complete:smoke.complete,expected:smoke.expected.length,unique:new Set(smoke.results.map(r=>r.name)).size,summary:smoke.summary,waivers:smoke.results.filter(r=>r.waivers.length).map(r=>({name:r.name,checks:r.waivers}))},
  nativeMouse:{status:'PARTIAL_INTERMEDIATE_IMPLEMENTATION',confirmed:['enable pilot','open form','enter budget 100'],unexecuted:['fund','reassign','cancel'],limits:['before final lazy-loading and cent-edge closure','official-new-game guide/not-responding observations','Windows low battery PickerHost modal; non-target input rejected'],notAFullGameplayOrPerformanceBenchmark:true},
  limits:['controlled AI responses, not model-quality evaluation','real unpackaged Windows Electron, not installer/release verification','existing freeform edicts are not automatically migrated into pilot cases']}),null,2)+'\n');
console.log(JSON.stringify({executions:executions.length,incomplete:incomplete.length,hashes:'MATCH',smoke:smoke.summary,electron:electron.map(e=>({label:e.label,checks:e.report.results.reduce((n,r)=>n+r.detail.results.length,0)}))}));
