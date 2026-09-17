'use strict';
// Free final verification only. Real-provider acceptance is a separate opt-in
// runner and must never appear in this command list or CI.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..'),runId=crypto.randomUUID(),dir=path.join(root,'web/dev-tools/native-workbench',runId);
const releaseVersion=JSON.parse(fs.readFileSync(path.join(root,'mobile/release-version.json'),'utf8')).version;
fs.mkdirSync(dir,{recursive:true});
const commands=[
 ['architecture','web/scripts/lint-arch-all.js'],
 ['official-parity','web/scripts/verify-official-scenario-parity.js'],
 ['release-contract','scripts/verify-release-contract.js'],
 ['resource-baseline','scripts/sync-hot-baseline.js','--check','--version',releaseVersion],
 ['native-source-manifest','scripts/build-native-preparation-manifest.cjs','--check'],
 ...['--native-start-entry','--native-start-faults','--native-workbench-assets','--native-workbench-tasks','--native-workbench-permissions','--native-workbench-flow','--native-map-hits','--native-legacy-official','--authoring-autoapply','--native-start-core'].map(flag=>[flag.slice(2),'scripts/verify-electron-bridge.js',flag])
];
const at=process.argv.indexOf('--neutral-atlas');if(at>=0)commands.push(['neutral-atlas','scripts/verify-electron-bridge.js','--neutral-atlas',path.resolve(process.argv[at+1])]);
const files=['package.json','main-impl.js','preload-impl.js','main-artifact-export.js','web/index.html','web/tm-start-runtime-manifest.json','web/.hot-update-manifest.json','web/preview/scenario-editor-reset-preview.html','web/preview/scenario-editor-reset-app.js','web/editor-authoring-agent-ui.js','web/tm-workbench-ui.js'];
function hashes(){return Object.fromEntries(files.map(file=>[file,crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')]))}
const report={schema:'tm-native-workbench-acceptance/1',runId,startedAt:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim(),fileHashes:hashes(),realApiCalls:0,complete:false,results:[]};
for(const [name,...args] of commands){
 const start=Date.now(),run=cp.spawnSync(process.execPath,args,{cwd:root,env:process.env,encoding:'utf8',windowsHide:true,timeout:300000,maxBuffer:20*1024*1024});
 const log=(run.stdout||'')+(run.stderr||'');fs.writeFileSync(path.join(dir,name+'.log'),log);
 const refs=[...log.matchAll(/ELECTRON_REPORT (.+)/g)].map(m=>m[1].trim().replace(/\\/g,'/'));
 const result={name,command:[process.execPath,...args],exitCode:run.status,signal:run.signal||null,error:run.error?.message||null,elapsedMs:Date.now()-start,ok:run.status===0&&!run.signal&&!run.error,evidence:refs};report.results.push(result);
 console.log(JSON.stringify(result));fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));
}
report.finishedAt=new Date().toISOString();report.complete=true;report.sourceUnchanged=JSON.stringify(report.fileHashes)===JSON.stringify(hashes());report.ok=report.sourceUnchanged&&report.results.every(r=>r.ok);
fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2)+'\n');fs.writeFileSync(path.join(root,'docs/native-start-workbench/final-verification.json'),JSON.stringify(report,null,2)+'\n');
console.log('NATIVE_FINAL_REPORT '+path.relative(root,path.join(dir,'report.json')));process.exitCode=report.ok?0:1;
