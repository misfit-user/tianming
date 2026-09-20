import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||'.');
const dir=fs.realpathSync(path.join(root,'docs/shaosong-map-integration-20260917/location-stage'));
const logs=path.join(dir,'regressions');fs.mkdirSync(logs,{recursive:true});
const jobs=['smoke-army-march-order.js','smoke-army-march-viz.js','smoke-army-panel-lag-guards.js','smoke-army-recruit-cost.js','smoke-phase8-map-live-panels.js','smoke-wentian-hardchange.js','smoke-map-live-vitals.js','smoke-map-realm-layout.js','smoke-stable-id-reference-integrity.js','lint-arch-all.js'];
const report={started:new Date().toISOString(),complete:false,results:[]};
for(const job of jobs){
 const file=path.join(root,'web/scripts',job);if(!fs.existsSync(file))throw Error('Missing test '+job);
 const start=Date.now();console.log('START '+job);
 const result=spawnSync(process.execPath,[file],{cwd:root,encoding:'utf8',timeout:180000,maxBuffer:4*1024*1024,windowsHide:true});
 const output=(result.stdout||'')+(result.stderr||'');fs.writeFileSync(path.join(logs,job+'.log'),output);
 const row={job,passed:result.status===0&&!result.error,status:result.status,signal:result.signal,error:result.error?.message||null,ms:Date.now()-start,tail:output.split(/\r?\n/).slice(-14).join('\n')};
 report.results.push(row);fs.writeFileSync(path.join(dir,'regression.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...row,tail:undefined}));
}
report.complete=true;report.passed=report.results.filter(r=>r.passed).length;report.failed=report.results.length-report.passed;
fs.writeFileSync(path.join(dir,'regression.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({passed:report.passed,failed:report.failed}));if(report.failed)process.exitCode=1;
