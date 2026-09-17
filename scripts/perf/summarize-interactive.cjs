'use strict';
// Offline export of this narrow experiment. Never reads player data or uploads.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..'), args = process.argv.slice(2);
const values = flag => args.flatMap((v, i) => v === flag ? [args[i + 1]] : []);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const sanitize = (v, key) => {
  if (key === 'temporaryUserData') return '<isolated-user-data>';
  if (typeof v === 'string') return v.replaceAll(os.homedir().replace(/\\/g, '\\\\'), '<user-profile>').replaceAll(os.homedir(), '<user-profile>').replaceAll(os.homedir().replace(/\\/g, '/'), '<user-profile>');
  if (Array.isArray(v)) return v.map(x => sanitize(x));
  return v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k,x])=>[k,sanitize(x,k)])) : v;
};
const out = path.join(root, 'docs/performance-interactive'); fs.mkdirSync(out, { recursive: true });
const write = (name, value) => fs.writeFileSync(path.join(out, name), JSON.stringify(sanitize(value), null, 2) + '\n');
const dist = values => { const a = values.slice().sort((a,b)=>a-b); assert(a.length && a.every(Number.isFinite));
  return { n:a.length, min:a[0], p50:a[Math.floor(a.length/2)], p95:a[Math.ceil(a.length*.95)-1], max:a.at(-1), raw:values }; };
const reports = values('--paired').map(p => ({ source:p, sha256:sha(p), data:read(p) }));
assert(reports.length, '--paired report required');
const groups = {}, identities = {};
for (const {data:r} of reports) {
  assert(r.ok && r.complete && r.results.length === r.repeats * 2, 'incomplete pair must not enter successful timing summary');
  for (const run of r.results) {
    assert(run.ok && run.exitCode === 0 && run.detail.ok);
    const hashes = run.sourceHashes;
    if (identities[run.side]) assert.deepEqual(hashes, identities[run.side].sourceHashes); else identities[run.side]={head:run.head,sourceHashes:hashes};
    for (const s of run.detail.performance.samples) {
      assert(s.result.value.ok && s.result.textBridge === (run.side === 'after'));
      const g = groups[s.scenario] ||= { hash:s.sampleHash, bytes:s.bytes, before:[], after:[] };
      assert.equal(g.hash,s.sampleHash); assert.equal(g.bytes,s.bytes); g[run.side].push(s);
    }
  }
}
function stats(rows) { return {
  wallMs:dist(rows.map(r=>r.wallMs)),
  rendererLongestTaskMs:dist(rows.map(r=>Math.max(0,...r.renderer.longTasks.map(t=>t.duration)))),
  rendererLongestFrameIntervalMs:dist(rows.map(r=>Math.max(0,...r.renderer.frames))),
  mainEventLoopMaxMs:dist(rows.map(r=>r.mainLoop.maxMs)),
  mainStringifyMaxMs:dist(rows.map(r=>Math.max(0,...r.mainStringify)))
}; }
write('paired-raw.json',reports);
write('summary.json',{ identities, method:'Each process: same public long-history input, actual new-game + fullLoadGame, three forced production autosave ticks, real IPC/disk generation/session and full saved-GM SHA comparison. Separate temporary userData; same-volume source trees; no external network. No slow sample removed. Small n; p95 is descriptive, not an inferred population tail.',
  environment:{ platform:reports[0].data.platform,node:reports[0].data.node,cpu:reports[0].data.cpu,logicalCpus:reports[0].data.logicalCpus,memoryBytes:reports[0].data.totalMemoryBytes,window:reports[0].data.window,versions:reports[0].data.results[0].detail.versions },
  scenarios:Object.fromEntries(Object.entries(groups).map(([sid,g])=>[sid,{hash:g.hash,bytes:g.bytes,before:stats(g.before),after:stats(g.after)}])) });
const evidenceRoot=path.join(root,'web/dev-tools/perf-round1'), executions=[],logs={};
for (const e of fs.readdirSync(evidenceRoot,{withFileTypes:true})) {
  if(!e.isDirectory()||!fs.existsSync(path.join(evidenceRoot,e.name,'run.json')))continue;
  const dir=path.join(evidenceRoot,e.name),r=read(path.join(dir,'run.json'));
  if(!/^(interactive-|autosave-|text-bridge-)/.test(r.label))continue;
  logs[e.name]={};
  executions.push({...r,directory:path.relative(root,dir),logs:Object.fromEntries(['stdout.log','stderr.log'].map(n=>{
    const file=path.join(dir,n),text=sanitize(fs.readFileSync(file,'utf8'));logs[e.name][n]=text;
    return [n,{sourceSha256:sha(file),exportedTextSha256:crypto.createHash('sha256').update(text).digest('hex'),key:[e.name,n]}];
  }))});
}
write('execution-index.json',executions.sort((a,b)=>a.startedAt.localeCompare(b.startedAt)));write('logs.json',logs);
for(const flag of ['--inspect-before','--inspect-after']) {
  const dir=values(flag)[0];if(!dir)continue;const label=flag.slice(2);
  for(const name of ['trace.json','source.json','report.json'])write(label+'-'+name,{source:path.join(dir,name),sourceSha256:sha(path.join(dir,name)),data:read(path.join(dir,name))});
  const cpu=[];
  for(const e of fs.readdirSync(dir).filter(n=>/^cpu-\d+\.json$/.test(n))) {
    const p=read(path.join(dir,e)),byId=new Map(p.nodes.map(n=>[n.id,n.callFrame])),weights=new Map();
    p.samples.forEach((id,i)=>weights.set(id,(weights.get(id)||0)+(p.timeDeltas[i]||0)));
    cpu.push({file:e,sourceSha256:sha(path.join(dir,e)),startTime:p.startTime,endTime:p.endTime,samples:p.samples.length,
      // Raw statistical samples, not exact elapsed time or GC pause measurements.
      sampledSelf: [...weights].sort((a,b)=>b[1]-a[1]).map(([id,us])=>({frame:byId.get(id),sampledSelfMs:us/1000}))});
  }
  write(label+'-cpu-summary.json',cpu);
}
for(const [flag,name] of [['--smoke','smoke-final.json'],['--failed-smoke','smoke-failed.json'],['--bridge','electron-bridge-final.json']]) {
  const file=values(flag)[0];if(!file)continue;const r=read(file);assert(r.complete);
  if(flag==='--smoke'||flag==='--failed-smoke'){
    if(flag==='--smoke')assert.equal(r.summary.fail,0);else assert(r.summary.fail>0,'failure evidence must really contain a failure');
    assert.deepEqual(r.results.map(x=>x.name).sort(),r.expected.slice().sort());assert.equal(new Set(r.expected).size,r.expected.length);
  }else assert(r.ok);
  write(name,{source:file,sourceSha256:sha(file),data:r});
}
console.log('INTERACTIVE_EVIDENCE_EXPORTED',out,'executions='+executions.length);
