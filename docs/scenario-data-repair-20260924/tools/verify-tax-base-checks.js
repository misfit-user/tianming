// 委任状 E 指定的专项检查，严格串行；不调用全量 smoke 或热更基线。
'use strict';
const fs=require('fs'),path=require('path'),{spawnSync}=require('child_process');
const ROOT=path.resolve(__dirname,'../../..'),DIR=path.resolve(__dirname,'..');
const TMP='E:/tianming-tmp/codex-taxbase';
fs.mkdirSync(path.join(TMP,'checks'),{recursive:true});fs.mkdirSync(path.join(TMP,'scratch'),{recursive:true});
const names=fs.readdirSync(path.join(ROOT,'web/scripts')).filter(f=>/^smoke-.*\.(?:[cm]?js)$/.test(f)&&(/fiscal|guoku|neitang|tax|salt|tang840|tianqi|shaosong|ledger|treasury|revenue/.test(f)||/^(smoke-start-game-data-integrity|smoke-production-authored|smoke-armory(?:-readiness)?)\.(?:[cm]?js)$/.test(f))).sort();
const failedOnly=process.argv.includes('--failed-only'),missingOnly=process.argv.includes('--missing-only');
const checks=failedOnly||missingOnly?JSON.parse(fs.readFileSync(path.join(DIR,'reports/tax-base-checks.json'),'utf8')).checks:[];
const selected=failedOnly?new Set(checks.filter(x=>x.status!==0).map(x=>x.name)):missingOnly?new Set(names.filter(name=>!checks.some(x=>x.name===name))):null;
for(const name of names){
  if(selected&&!selected.has(name))continue;
  console.log('START '+name);const start=Date.now();
  const r=spawnSync(process.execPath,['--max-old-space-size=1792',path.join(ROOT,'web/scripts',name)],{cwd:ROOT,encoding:'utf8',maxBuffer:8*1024*1024,timeout:900000,
    env:{...process.env,TEMP:path.join(TMP,'scratch'),TMP:path.join(TMP,'scratch')}});
  const log=(r.stdout||'')+'\n'+(r.stderr||'')+(r.error?'\n'+r.error.stack:'');fs.writeFileSync(path.join(TMP,'checks',name+'.log'),log);
  const entry={name,status:r.status,signal:r.signal||null,seconds:Math.round((Date.now()-start)/1000)};
  const idx=checks.findIndex(c=>c.name===name);if(idx>=0)checks[idx]=entry;else checks.push(entry);
  fs.writeFileSync(path.join(DIR,'reports/tax-base-checks.json'),JSON.stringify({serial:true,maxOldSpaceMiB:1792,excludes:['full smoke','sync-hot-baseline'],checks},null,2)+'\n');
  console.log((r.status===0?'PASS ':'FAIL ')+name+' '+entry.seconds+'s');
}
const failed=checks.filter(r=>r.status!==0),missing=names.filter(name=>!checks.some(x=>x.name===name));console.log('RESULT '+(checks.length-failed.length)+'/'+names.length+' PASS');if(failed.length||missing.length)process.exitCode=1;
