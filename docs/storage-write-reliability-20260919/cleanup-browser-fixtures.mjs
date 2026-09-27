import fs from 'node:fs';
import path from 'node:path';
const dir=path.resolve('docs/storage-write-reliability-20260919'),results=[];
for(const name of ['browser-result.json','browser-realtime-result.json']){
  const file=path.join(dir,name);if(!fs.existsSync(file))continue;
  const record=JSON.parse(fs.readFileSync(file,'utf8')),profile=path.resolve(record.isolatedProfile||'');
  if(path.dirname(profile)!==dir||!/^\.(isolated-edge|edge-realtime)-\d+$/.test(path.basename(profile)))throw Error('Not an owned test profile');
  try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:100});results.push({profile,removed:true});}
  catch(error){results.push({profile,removed:false,reason:error.code});}
}
fs.writeFileSync(path.join(dir,'browser-cleanup.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
