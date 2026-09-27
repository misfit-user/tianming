import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
const dir='docs/endturn-final-closeout-20260919',base=JSON.parse(fs.readFileSync(dir+'/baseline.json','utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
for(const [command,file] of [['web/scripts/build-renderer-modules.js','web/generated/tm-ai-change-applier.bundle.js'],['web/scripts/build-startup-phase-manifest.js','web/startup-script-phases.json'],['scripts/build-native-preparation-manifest.cjs','web/tm-start-runtime-manifest.json']]){
 const log=fs.existsSync(dir+'/changes.json')?JSON.parse(fs.readFileSync(dir+'/changes.json','utf8')):[];
 const before=fs.readFileSync(file),last=log.filter(r=>r.file===file).at(-1),first=base.files.find(r=>r.file===file);
 if((last||first)&&sha(before)!==(last?last.after:first.sha256))throw Error('Concurrent generated file edit: '+file);
 if(!fs.existsSync(base.backup+'/'+file))fs.writeFileSync(base.backup+'/'+file,before,{flag:'wx'});
 cp.execFileSync(process.execPath,[command].concat(command.includes('build-native-preparation')?['--write']:[]),{stdio:'inherit'});
 log.push({file,before:sha(before),after:sha(fs.readFileSync(file)),generator:command,at:new Date().toISOString()});fs.writeFileSync(dir+'/changes.json',JSON.stringify(log,null,2));
}
