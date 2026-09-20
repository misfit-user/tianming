import fs from 'node:fs';import crypto from 'node:crypto';
const d='docs/endturn-final-closeout-20260919',file='web/phase8-formal-map.js',rows=JSON.parse(fs.readFileSync(d+'/changes.json','utf8')),last=rows.filter(r=>r.file===file).at(-1);
const bytes=fs.readFileSync(file),text=bytes.toString('utf8'),sha=b=>crypto.createHash('sha256').update(b).digest('hex');
if(sha(bytes)===last.after){console.log('Already recorded');process.exit(0);}
const added=' if (window.TMShanheRuntime) TMShanheRuntime.invalidate();';
if(text.split(added).length!==2||sha(Buffer.from(text.replace(added,'')))!==last.after)throw Error('Additional parallel edits require review');
const snapshot=d+'/parallel-observed/map-invalidation-'+Date.now()+'.js';fs.writeFileSync(snapshot,bytes,{flag:'wx'});
rows.push({file,before:last.after,after:sha(bytes),at:new Date().toISOString(),externalAdoption:true,note:'Reviewed single-line invalidation of the parallel 2.5D renderer; preserve it without modifying the memory or turn pipeline.',observedCopy:snapshot});
fs.writeFileSync(d+'/changes.json',JSON.stringify(rows,null,2));console.log('Preserved the parallel renderer invalidation; no source rewritten.');
