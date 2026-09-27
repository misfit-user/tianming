import fs from 'node:fs';
import path from 'node:path';
import cp from 'node:child_process';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
const dir=path.resolve('docs/storage-write-reliability-20260919');
const source=fs.readFileSync('web/tm-storage.js','utf8'),footer=source.indexOf('// 页面加载时立即打开数据库并迁移旧存档');
if(footer<0)throw Error('Storage boundary missing');
fs.writeFileSync(path.join(dir,'browser-storage-copy.js'),source.slice(0,footer));
const profile=path.join(dir,'.isolated-edge-'+Date.now());fs.mkdirSync(profile,{recursive:true});
const args=['--headless=new','--disable-gpu','--no-first-run','--no-default-browser-check','--disable-extensions','--disable-background-networking','--disable-component-update','--disable-sync','--user-data-dir='+profile,'--dump-dom','--virtual-time-budget=15000',pathToFileURL(path.join(dir,'browser-test.html')).href];
const run=cp.spawnSync('C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',args,{encoding:'utf8',timeout:45000,maxBuffer:2000000});
fs.writeFileSync(path.join(dir,'browser-dom.html'),run.stdout||'');fs.writeFileSync(path.join(dir,'browser-stderr.log'),run.stderr||'');
const match=(run.stdout||'').match(/<pre id="result">([\s\S]*?)<\/pre>/);
let outcome=null;try{outcome=JSON.parse(match[1].replaceAll('&quot;','"').replaceAll('&gt;','>').replaceAll('&lt;','<').replaceAll('&amp;','&'));}catch(_){}
const report={at:new Date().toISOString(),sourceSHA:crypto.createHash('sha256').update(source).digest('hex'),exit:run.status,error:run.error?String(run.error):null,isolatedProfile:profile,outcome};
fs.writeFileSync(path.join(dir,'browser-result.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
if(!outcome?.ok)process.exitCode=1;
