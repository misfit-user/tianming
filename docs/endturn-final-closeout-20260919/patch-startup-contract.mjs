import fs from 'node:fs';
import cp from 'node:child_process';
import path from 'node:path';
import crypto from 'node:crypto';
import {edit} from './patch-utils.mjs';
edit('web/index.html',(s,r)=>{
 const files=['libs/polygon-clipping-0.15.7.min.js','tm-map-workbench.js','tm-map-workbench-client.js','tm-start-compiler.js','tm-start-preparation-document.js','tm-start-preparation.js','tm-start-commit.js','tm-start-selector.js'];
 let block='';for(const f of files){const t=s.match(new RegExp('<script src="'+f.replaceAll('.','\\.')+'[^\"]*"><\\/script>'))[0];block+=t+'\n';s=r(s,t+'\n','');}
 const patches=s.match(/<script src="tm-patches\.js[^\"]*"><\/script>/)[0];return r(s,patches,block+patches);
});
edit('web/scripts/smoke-startup-phase-observability.js',(s,r)=>{
 const line=s.split('\n').find(l=>l.startsWith('assert.strictEqual(manifest.scriptCount, 417+'));
 if(!line)throw Error('Startup count contract changed');
 return r(s,line,"const recoveryModules=['tm-memory-adaptive.js','tm-memory-long-term.js','tm-memory-hybrid.js','tm-memory-mode-bridge.js','tm-endturn-reliability.js','tm-endturn-response-recovery.js','tm-endturn-recovery-vault.js'];\nrecoveryModules.forEach(name=>assert.strictEqual(scriptNames.filter(src=>src===name).length,1,name+' loads once'));\nassert.strictEqual(manifest.scriptCount,417+nativeModules.length+fiscalModules.length+recoveryModules.length,'retain every prior script and all seven explicit memory/recovery additions');");
});
const source='web/backups',destination='.bak-legacy-web-snapshots-20260919';
if(fs.existsSync(source)){
 if(fs.existsSync(destination)||cp.execFileSync('git',['ls-files',source],{encoding:'utf8'}).trim())throw Error('Archive move is not safe');
 const files=[];function scan(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const f=path.join(p,e.name);if(e.isSymbolicLink())throw Error('Archive symlink');if(e.isDirectory())scan(f);else files.push({file:path.relative(source,f),sha256:crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')});}}scan(source);
 fs.renameSync(source,destination);
 if(files.some(r=>crypto.createHash('sha256').update(fs.readFileSync(path.join(destination,r.file))).digest('hex')!==r.sha256))throw Error('Archive move hash mismatch');
 fs.writeFileSync('docs/endturn-final-closeout-20260919/archive-relocation.json',JSON.stringify({source,destination,files},null,2));console.log('Preserved archival snapshots outside runtime:',files.length);
}
