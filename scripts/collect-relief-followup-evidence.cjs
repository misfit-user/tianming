'use strict';
// Export only this local follow-up's logs. No environment/key/save dumps.
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto'),os=require('os'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),base=path.join(root,'web/dev-tools/perf-round1');
const baseline='a26665904802debc41a5068411dd5ff28d8002a4';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
const hash=p=>digest(fs.readFileSync(p));
const git=args=>cp.execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:10e6}).trim();
function redact(v){if(typeof v==='string')return v.replaceAll(os.homedir().replace(/\\/g,'\\\\'),'<user-profile>').replaceAll(os.homedir(),'<user-profile>').replaceAll(os.homedir().replace(/\\/g,'/'),'<user-profile>');if(Array.isArray(v))return v.map(redact);return v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,redact(x)])):v;}
const runs=[];
for(const name of fs.readdirSync(base).filter(n=>/^(relief-channel-|relief-followup-)/.test(n))){
  const dir=path.join(base,name),file=path.join(dir,'run.json');if(!fs.existsSync(file))continue;
  const run=read(file),logs={};
  for(const name of ['stdout.log','stderr.log']){const p=path.join(dir,name);logs[name]={sha256:hash(p),text:fs.readFileSync(p,'utf8')};}
  runs.push({directory:path.relative(root,dir),run,logs});
}
function last(label){const r=runs.filter(r=>r.run.label===label).sort((a,b)=>a.run.startedAt.localeCompare(b.run.startedAt)).pop();assert(r&&r.run.complete,label+' missing completion');return r;}
function testedHash(r,file){return Object.prototype.hasOwnProperty.call(r.run.dirtyFileHashes,file)?r.run.dirtyFileHashes[file]:digest(cp.execFileSync('git',['show',r.run.head+':'+file],{cwd:root,maxBuffer:10e6}));}
const final=last('relief-channel-quiet-full');assert.equal(final.run.exitCode,0);
const args=process.argv.slice(2);assert(args.includes('--smoke'));
const smokePath=path.resolve(root,args[args.indexOf('--smoke')+1]),smoke=read(smokePath);
assert(smoke.complete&&smoke.summary.fail===0);assert(final.logs['stdout.log'].text.includes(smoke.runId));
assert.deepEqual(smoke.results.map(r=>r.name).sort(),smoke.expected.slice().sort());assert.equal(new Set(smoke.results.map(r=>r.name)).size,smoke.expected.length);
const files=git(['diff','--name-only',baseline]).split('\n').filter(p=>/^(web\/.*\.(js|json|html)|scripts\/electron\/.*\.cjs|package(-lock)?\.json)$/.test(p));
for(const p of ['web/scripts/lib-relief-channel-test.js','web/scripts/smoke-production-dependencies.js'])if(!files.includes(p))files.push(p);
const sourceHashes=Object.fromEntries(files.map(p=>[p,hash(path.join(root,p))]));
for(const [p,h] of Object.entries(sourceHashes))assert.equal(testedHash(final,p),h,'source changed since full smoke: '+p);
const gates=['relief-channel-final-arch','relief-channel-final-release','relief-channel-final-parity','relief-channel-final-builder','relief-channel-final-tls','relief-followup-audit-final','relief-followup-deps-final','relief-channel-source-final','relief-channel-adjudication-final'];
gates.forEach(label=>assert.equal(last(label).run.exitCode,0,label));
const electron=[];
for(const label of ['relief-channel-verified-shaosong','relief-channel-verified-tianqi','relief-channel-standard-electron']){
  const run=last(label);assert.equal(run.run.exitCode,0,label);
  const m=/ELECTRON_REPORT (.+)/.exec(run.logs['stdout.log'].text);assert(m);
  const p=path.resolve(root,m[1].trim()),report=read(p);assert(report.complete&&report.ok);
  for(const [file,h] of Object.entries(sourceHashes).filter(([p])=>p.startsWith('web/')&&!p.includes('/scripts/')&&p.endsWith('.js')))assert.equal(testedHash(run,file),h,label+' source mismatch '+file);
  electron.push({label,path:path.relative(root,p),sha256:hash(p),report});
}
const auditText=last('relief-followup-audit-final').logs['stdout.log'].text,audit=JSON.parse(auditText.slice(auditText.indexOf('{')));assert.equal(audit.metadata.vulnerabilities.total,0);
const out=path.join(root,'docs/relief-channel-followup');fs.mkdirSync(out,{recursive:true});
const summary={baseline,branch:git(['branch','--show-current']),capturedHead:git(['rev-parse','HEAD']),sourceHashes,
  scope:'local source/test only; original worktree preserved; no push/merge/version/release',runs,
  smoke:{path:path.relative(root,smokePath),runId:smoke.runId,head:smoke.head,complete:smoke.complete,expected:smoke.expected.length,summary:smoke.summary,waivers:smoke.results.filter(r=>r.waivers&&r.waivers.length).map(r=>({name:r.name,checks:r.waivers}))},
  electron,audit:audit.metadata.vulnerabilities,
  limits:['Unpackaged Windows Electron; no signed installer or live AI quality test','Computer Use initialization failed twice with kernel-assets path not found; no native mouse result claimed','capturePage PNGs showed an old compositor frame and are not accepted as visual proof; layout and hit tests are separate','Previous independent-case tests were replaced because that workflow was explicitly withdrawn, not to claim unchanged gameplay','Development dependency audit still contains upstream findings; production closure is zero']};
fs.writeFileSync(path.join(out,'evidence.json'),JSON.stringify(redact(summary),null,2)+'\n');
console.log(JSON.stringify({executions:runs.length,hashes:'MATCH',smoke:smoke.summary,electron:electron.map(e=>({label:e.label,checks:e.report.results.reduce((n,r)=>n+r.detail.results.length,0)})),productionAudit:summary.audit}));
