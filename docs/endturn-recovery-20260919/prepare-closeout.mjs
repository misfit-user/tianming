import fs from 'node:fs';
const dir='docs/endturn-recovery-20260919',previous='docs/endturn-reliability-20260918';
for(const name of ['sync-manifest.mjs','check-diff.mjs']){
  const target=dir+'/'+name;
  if(!fs.existsSync(target))fs.writeFileSync(target,fs.readFileSync(previous+'/'+name,'utf8').replaceAll(previous,dir),{flag:'wx'});
}
console.log('Scoped manifest and byte-diff checks prepared.');
