import fs from 'node:fs';
const d='docs/endturn-final-closeout-20260919';
if(fs.existsSync(d+'/browser-realtime-result.json')&&!fs.existsSync(d+'/browser-initial-result.json'))fs.copyFileSync(d+'/browser-realtime-result.json',d+'/browser-initial-result.json');
let source=fs.readFileSync(d+'/browser-test.mjs','utf8');
source=source.replace('const report={at:new Date().toISOString(),sourceSHA:',"const report={at:new Date().toISOString(),vaultSHA:crypto.createHash('sha256').update(fs.readFileSync('web/tm-endturn-recovery-vault.js')).digest('hex'),sourceSHA:");
source=source.replace("fs.writeFileSync(path.join(dir,'browser-realtime-result.json'),", "await sleep(800);\ntry { if (!fs.lstatSync(profile).isSymbolicLink() && path.dirname(profile) === dir) { fs.rmSync(profile,{recursive:true,force:true,maxRetries:5,retryDelay:200});report.profileRemoved=true; } } catch (e) { report.profileRemoved=false;report.cleanupError=String(e.message); }\nfs.writeFileSync(path.join(dir,'browser-realtime-result.json'),");
fs.writeFileSync(d+'/browser-final-test.mjs',source);console.log('Prepared isolated native IndexedDB reload test on the final sources.');
