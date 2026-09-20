import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import cp from 'node:child_process';
const dir = 'D:/tianming-task-artifacts-20260919/launch-reentry-20260920';
fs.mkdirSync(dir, {recursive:true});
if (fs.existsSync(dir + '/baseline.json')) throw Error('Existing baseline: inspect rather than overwrite');
const files = ['web/tm-launch.js','web/tm-player-core.js','web/tm-patches-start.js','web/tm-home-ui.js','web/phase8-formal-bridge.js','web/tm-pause-fab.js','web/tm-office-editor.js','web/tm-save-lifecycle.js','web/tm-world-identity.js','web/tm-native-start.js','web/index.html','web/startup-script-phases.json','web/tm-start-runtime-manifest.json','web/scripts/verify-all.js'];
const records = files.filter(f=>fs.existsSync(f)).map(file=>{
 const bytes=fs.readFileSync(file),dest=path.join(dir,'backup',file);
 fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,bytes,{flag:'wx'});
 return {file,bytes:bytes.length,sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
});
const baseline={at:new Date().toISOString(),repo:process.cwd(),backup:dir+'/backup',files:records,
 head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),
 branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),
 status:cp.execFileSync('git',['status','--porcelain'],{encoding:'utf8'})};
fs.writeFileSync(dir+'/baseline.json',JSON.stringify(baseline,null,2));
const prior='D:/tianming-task-artifacts-20260919/player-error-fixes-20260920';
fs.writeFileSync(dir+'/patch-utils.mjs',fs.readFileSync(prior+'/patch-utils.mjs','utf8').replaceAll(prior,dir));
console.log('Source-only baseline protected:',records.length,dir);
