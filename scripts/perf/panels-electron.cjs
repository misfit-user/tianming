'use strict';
// Focused panel experiment, using the existing production-main/bridge gate.
const fs=require('fs'),path=require('path'),cp=require('child_process'),os=require('os'),crypto=require('crypto');
const args=process.argv.slice(2),arg=(k,d)=>args.includes(k)?args[args.indexOf(k)+1]:d;
const root=path.resolve(__dirname,'../..'),repo=path.resolve(arg('--repo',root));
const id=crypto.randomUUID(),out=path.join(root,'web/dev-tools/perf-round1/panels-'+id);
fs.mkdirSync(out,{recursive:true});const tempRoot=path.resolve(arg('--temp-root',os.tmpdir()));fs.mkdirSync(tempRoot,{recursive:true});
const temp=fs.mkdtempSync(path.join(tempRoot,'tm-panels-'));
const env={...process.env,TM_BRIDGE_TEST_ROOT:repo,TM_BRIDGE_TEST_MODE:'performance-panels',TM_BRIDGE_TEST_REPORT:path.join(out,'report.json'),TM_BRIDGE_TEST_USERDATA:temp,
  TM_PERF_SCENARIO:arg('--scenario','sc-jianyan1-1127-shaosong'),TM_PERF_PANEL_TRACE:args.includes('--trace')?'1':'',
  TM_PERF_PANEL:arg('--panel','edict'),TM_PERF_PANEL_CYCLES:arg('--cycles','3'),TM_PERF_PANEL_HISTORY:arg('--history','800'),TM_PERF_PANEL_CONTRACTS:args.includes('--contracts')?'1':'',TM_PERF_PANEL_SAMPLE:arg('--sample','')};
delete env.ELECTRON_RUN_AS_NODE;delete env.TIANMING_TEST_EXPORTS;
const source={runId:id,head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim(),
  platform:process.platform,node:process.version,cpu:os.cpus()[0].model,memoryBytes:os.totalmem(),window:{width:1280,height:800},
  sampleSha256:env.TM_PERF_PANEL_SAMPLE?crypto.createHash('sha256').update(fs.readFileSync(env.TM_PERF_PANEL_SAMPLE)).digest('hex'):null,
  hashes:Object.fromEntries(['web/phase8-formal-drafts.js','web/phase8-formal-bridge.js','web/phase8-formal-modules.js','web/phase8-formal-drafts-message-panels.js','web/tm-save-lifecycle.js','preload-impl.js'].map(p=>[p,crypto.createHash('sha256').update(fs.readFileSync(path.join(repo,p))).digest('hex')]))};
fs.writeFileSync(path.join(out,'source.json'),JSON.stringify(source,null,2));console.log('PANEL_EVIDENCE',out);
const start=performance.now(),r=cp.spawnSync(require('electron'),[path.join(root,'scripts/electron/bridge-main.cjs')],{cwd:repo,env,windowsHide:true,encoding:'utf8',timeout:260000,maxBuffer:16*1024*1024});
fs.writeFileSync(path.join(out,'stdout.log'),r.stdout||'');fs.writeFileSync(path.join(out,'stderr.log'),r.stderr||'');
source.exitCode=r.status;source.elapsedMs=performance.now()-start;source.error=r.error?.message;
fs.writeFileSync(path.join(out,'execution.json'),JSON.stringify(source,null,2));
console.log(r.stdout||'',r.stderr||'');console.log('PANEL_EXIT',r.status,source.error||'');process.exitCode=r.status===0?0:1;
