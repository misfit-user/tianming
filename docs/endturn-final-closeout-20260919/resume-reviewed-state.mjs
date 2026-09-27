import fs from 'node:fs';import path from 'node:path';import crypto from 'node:crypto';
const d='docs/endturn-final-closeout-20260919',file=d+'/changes.json',changes=JSON.parse(fs.readFileSync(file,'utf8'));const stamp=Date.now();
const explanations={'web/scripts/verify-all.js':'Retain the four new parallel rendering regression registrations and our recovery registrations.','web/phase8-formal-map.js':'Retain parallel 2.5D map integration and retained-render optimizations; own AI-geography guard is intact.','web/startup-script-phases.json':'Generated manifest was empty at interrupted generator boundary; regenerate from the current index without changing source load order.'};
for(const [p,note]of Object.entries(explanations)){
 const bytes=fs.readFileSync(p),hash=crypto.createHash('sha256').update(bytes).digest('hex'),previous=changes.filter(r=>r.file===p).at(-1);if(hash===previous?.after)continue;
 if(p.endsWith('phase8-formal-map.js')&&!bytes.toString('utf8').includes('if (window.GM && GM._useAIGeo === true) return null;'))throw Error('Own geography guard disappeared');
 const copy=d+'/resume-observed-'+stamp+'/'+p;fs.mkdirSync(path.dirname(copy),{recursive:true});fs.writeFileSync(copy,bytes,{flag:'wx'});
 changes.push({file:p,before:previous?.after,after:hash,at:new Date().toISOString(),externalAdoption:true,note,observedCopy:copy});console.log('Reviewed and preserved',p);
}
fs.writeFileSync(file,JSON.stringify(changes,null,2));
fs.writeFileSync(d+'/resume-state.json',JSON.stringify({at:new Date().toISOString(),stamp,changes:changes.length},null,2));
