import fs from 'node:fs';import crypto from 'node:crypto';import {edit} from './patch-utils.mjs';
const d='docs/endturn-final-closeout-20260919',file='web/index.html',b=fs.readFileSync(file),s=b.toString('utf8'),manifest=JSON.parse(fs.readFileSync('web/startup-script-phases.json','utf8'));
const names=[...s.matchAll(/<script\b[^>]*\bsrc=["']([^"']+\.js)(?:[?#][^"']*)?["'][^>]*>/gi)].map(m=>m[1].replace(/^\.\//,'')),old=manifest.scripts.map(r=>r.script),extra=names.filter(n=>!old.includes(n));
if(JSON.stringify(names.filter(n=>old.includes(n)))!==JSON.stringify(old)||JSON.stringify(extra)!=='["tm-shanhe-runtime.js"]')throw Error('Unexpected loader changes; do not overwrite');
const changes=JSON.parse(fs.readFileSync(d+'/changes.json','utf8')),last=changes.filter(r=>r.file===file).at(-1),hash=crypto.createHash('sha256').update(b).digest('hex');
if(last.after!==hash){fs.writeFileSync(d+'/parallel-observed/index-shanhe.html',b,{flag:'wx'});changes.push({file,before:last.after,after:hash,at:new Date().toISOString(),externalAdoption:true,note:'Preserve the explicitly added 2.5D map adapter from the other window; every previous script and order is retained.'});fs.writeFileSync(d+'/changes.json',JSON.stringify(changes,null,2));}
edit('web/scripts/smoke-startup-phase-observability.js',(source,r)=>{
 source=r(source,'assert.strictEqual(manifest.scriptCount,417+nativeModules.length+fiscalModules.length+recoveryModules.length,',"const visualAdapters=['tm-shanhe-runtime.js'];\nvisualAdapters.forEach(name=>assert.strictEqual(scriptNames.filter(src=>src===name).length,1,name+' loads once'));\nassert.strictEqual(manifest.scriptCount,417+nativeModules.length+fiscalModules.length+recoveryModules.length+visualAdapters.length,");
 return source;
});console.log('Preserved one visual adapter without changing any prior loader requirements.');
