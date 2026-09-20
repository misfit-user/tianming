import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const dir='docs/endturn-final-closeout-20260919',base=JSON.parse(fs.readFileSync(dir+'/baseline.json','utf8')),changes=JSON.parse(fs.readFileSync(dir+'/changes.json','utf8'));
for(const [file,note]of [['web/scripts/verify-all.js','Reviewed five parallel UI/performance test registrations; preserve all existing entries.'],['web/phase8-formal-map.js','Preserve parallel retained-render changes; only add an explicit AI-geography read guard.']]){
 const bytes=fs.readFileSync(file),sha=crypto.createHash('sha256').update(bytes).digest('hex'),last=changes.filter(r=>r.file===file).at(-1),initial=base.files.find(r=>r.file===file),expected=last?last.after:initial&&initial.sha256;
 if(sha===expected)continue;
 const destination=dir+'/parallel-observed/'+file;fs.mkdirSync(path.dirname(destination),{recursive:true});if(fs.existsSync(destination))throw Error('Observed copy already exists; inspect');fs.writeFileSync(destination,bytes,{flag:'wx'});
 changes.push({file,before:expected,after:sha,at:new Date().toISOString(),externalAdoption:true,note,observedCopy:destination});console.log('Preserved parallel edit',file);
}
fs.writeFileSync(dir+'/changes.json',JSON.stringify(changes,null,2));
