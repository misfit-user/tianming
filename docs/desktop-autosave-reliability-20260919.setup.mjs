import fs from 'node:fs'; import path from 'node:path'; import cp from 'node:child_process'; import crypto from 'node:crypto';
const dir='docs/desktop-autosave-reliability-20260919',backup='.bak-desktop-autosave-reliability-20260919';
if(fs.existsSync(dir+'/baseline.json'))throw Error('Existing baseline must not be overwritten');fs.mkdirSync(dir,{recursive:true});
const files=['preload-impl.js','main-impl.js','main-turn-data-commit.js','web/tm-save-lifecycle.js','web/tm-save-close-flush.js','web/tm-storage.js','web/tm-state-snapshot.js','web/tm-endturn-ai.js','web/tm-endturn-agent-mode.js','web/tm-endturn-core.js','web/tm-endturn-render.js','web/tm-endturn-validity.js','web/tm-endturn-pipeline-steps.js','web/tm-endturn-mode-contract.js','web/tm-endturn-response-recovery.js','web/tm-ai-infra.js','web/tm-ai-infra-retry.js','web/tm-endturn-reliability.js','web/index.html','web/scripts/verify-all.js'];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const records=files.map(file=>{const b=fs.readFileSync(file),to=backup+'/'+file;fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,b,{flag:'wx'});return {file,sha256:sha(b),bytes:b.length};});
fs.writeFileSync(dir+'/baseline.json',JSON.stringify({at:new Date().toISOString(),head:cp.execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),branch:cp.execFileSync('git',['branch','--show-current'],{encoding:'utf8'}).trim(),status:cp.execFileSync('git',['status','--porcelain=v1'],{encoding:'utf8'}),backup,files:records},null,2));
fs.writeFileSync(dir+'/patch-utils.mjs',fs.readFileSync('docs/desktop-bridge-reliability-20260919/patch-utils.mjs','utf8').replaceAll('docs/desktop-bridge-reliability-20260919',dir));
console.log('Current baseline protected:',files.length,'files');
