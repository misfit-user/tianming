'use strict';
// Offline evidence export only. Does not operate the UI, read saves or upload.
const fs=require('fs'),path=require('path'),os=require('os'),crypto=require('crypto'),assert=require('assert/strict');
const root=path.resolve(__dirname,'../..'),base=path.join(root,'web/dev-tools/perf-round1'),args=process.argv.slice(2);
const arg=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const out=path.join(root,'docs/performance-panels');fs.mkdirSync(out,{recursive:true});
const read=p=>JSON.parse(fs.readFileSync(p,'utf8')),sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function safe(v){if(typeof v==='string')return v.replaceAll(os.homedir().replace(/\\/g,'\\\\'),'<user-profile>').replaceAll(os.homedir(),'<user-profile>').replaceAll(os.homedir().replace(/\\/g,'/'),'<user-profile>');if(Array.isArray(v))return v.map(safe);return v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,k==='temporaryUserData'?'<isolated-test-data>':safe(x)])):v;}
function write(name,v){fs.writeFileSync(path.join(out,name),JSON.stringify(safe(v),null,2)+'\n');}
const mouse=arg('--mouse');assert(mouse,'--mouse directory required');
const trace=read(path.join(mouse,'trace.json'));assert(trace.complete,'mouse session must be normally finished');
const source=read(path.join(mouse,'source.json'));
for(const [file,hash] of Object.entries(source.sourceHashes))assert.equal(sha(path.join(root,file)),hash,'mouse-tested source changed: '+file);
const clicks=trace.trace.events.filter(e=>e.type==='click').map(e=>{
  const n=trace.trace.eventTiming.find(n=>n.name==='click'&&Math.abs(n.start-e.eventAt)<1);
  const panel=/^zhao-btn(?:-[23])?$/.test(e.control)||e.control==='tm-action-close tm-floating-close'&&/^tm-action-(edict|memorial|letter)-overlay$/.test(e.overlayBefore);
  return {at:e.at,eventAt:e.eventAt,control:e.control,from:e.overlayBefore,to:e.overlayAfter,trusted:e.trusted,
    panelOpenClose:panel,durationMs:n?.duration,inputDelayMs:n?n.processingStart-n.start:null,handlerMs:n?n.processingEnd-n.processingStart:null,secondFrameMs:e.secondFrameMs,
    note:e.control==='zhao-btn-3'&&e.at<1300000?'Double-click retry; following contact click confounds the first opening timing.':undefined};
});
assert.equal(clicks.filter(e=>e.panelOpenClose).length,14);assert(clicks.filter(e=>e.panelOpenClose).every(e=>e.trusted));
write('mouse.json',{sourceHashes:source.sourceHashes,head:source.head,traceSha256:sha(path.join(mouse,'trace.json')),sourceDirectory:path.relative(root,mouse),
  method:'Real computer-use mouse events; 3 edict, 2 memorial, 2 letter open/close cycles visually confirmed. No scripted click or keyboard activation substitutes in this session. Native Event Timing duration is rounded to 8ms; a 16ms threshold applies. Cold/warm observations on one candidate, NOT before/after speedup.',
  limitations:['Partial pointerdown-only attempts are retained in raw trace, not counted as successful clicks.','First letter retry was a double-click whose second click selected a contact.','Extra renwu-tuzhi clicks followed detected user input; not attributed to the assistant.','Startup long task/input queueing remains unattributed.'],clicks});
write('mouse-raw.json',{source,report:read(path.join(mouse,'report.json')),trace});
const executions=[],logs={},experiments=[];
for(const e of fs.readdirSync(base,{withFileTypes:true})){
  if(!e.isDirectory())continue;const d=path.join(base,e.name),run=path.join(d,'run.json');
  if(e.name.startsWith('panel-')&&fs.existsSync(run)){
    const r=read(run);executions.push({...r,directory:path.relative(root,d)});logs[e.name]={};
    for(const n of ['stdout.log','stderr.log']){const text=safe(fs.readFileSync(path.join(d,n),'utf8'));logs[e.name][n]={sourceSha256:sha(path.join(d,n)),exportedTextSha256:crypto.createHash('sha256').update(text).digest('hex'),text};}
  }
  if(e.name.startsWith('panels-')&&fs.existsSync(path.join(d,'execution.json')))experiments.push({directory:path.relative(root,d),execution:read(path.join(d,'execution.json')),report:fs.existsSync(path.join(d,'report.json'))?read(path.join(d,'report.json')):null});
}
write('executions.json',executions.sort((a,b)=>a.startedAt.localeCompare(b.startedAt)));write('logs.json',logs);write('experiments.json',experiments);
const smokePath=arg('--smoke'),smoke=read(smokePath);assert(smoke.complete);assert.equal(smoke.summary.fail,0);assert.equal(new Set(smoke.results.map(r=>r.name)).size,smoke.expected.length);assert.deepEqual(smoke.results.map(r=>r.name).sort(),smoke.expected.slice().sort());
write('smoke.json',{source:smokePath,sourceSha256:sha(smokePath),report:smoke});
const bridgePath=arg('--bridge'),bridge=read(bridgePath);assert(bridge.complete&&bridge.ok);write('electron-bridge.json',{source:bridgePath,sourceSha256:sha(bridgePath),report:bridge});
console.log('PANEL_EVIDENCE_EXPORTED',out,'executions',executions.length,'experiments',experiments.length,'mousePanelEvents',clicks.filter(e=>e.panelOpenClose).length);
