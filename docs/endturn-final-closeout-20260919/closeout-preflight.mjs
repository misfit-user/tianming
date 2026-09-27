import fs from 'node:fs';import crypto from 'node:crypto';import {edit} from './patch-utils.mjs';
const d='docs/endturn-final-closeout-20260919',file='web/scripts/verify-all.js';
const changes=JSON.parse(fs.readFileSync(d+'/changes.json','utf8')),last=changes.filter(r=>r.file===file).at(-1),bytes=fs.readFileSync(file),hash=crypto.createHash('sha256').update(bytes).digest('hex');
if(last.after!==hash){
  const line="  { name: 'render-performance-r2', file: 'smoke-render-performance-r2.mjs', estSec: 2, expectExit: 0 },\n";
  const restored=bytes.toString('utf8').replace(line,'');
  if(crypto.createHash('sha256').update(restored).digest('hex')!==last.after)throw Error('Unexpected parallel test edits; inspect');
  fs.writeFileSync(d+'/parallel-observed/verify-all-r2.js',bytes,{flag:'wx'});
  changes.push({file,before:last.after,after:hash,at:new Date().toISOString(),externalAdoption:true,note:'Preserve the independently added render-performance-r2 test.'});fs.writeFileSync(d+'/changes.json',JSON.stringify(changes,null,2));
}
edit('web/scripts/run-smokes.js',(s,r)=>{
 const anchor="'smoke-perf-save-preparation.js', 'smoke-start-game-data-integrity.js'];";
 return r(s,anchor,"'smoke-perf-save-preparation.js', 'smoke-start-game-data-integrity.js', 'smoke-tang840-opening-ledgers.js'];");
});
const previous='docs/endturn-recovery-20260919';
if(!fs.existsSync(d+'/check-diff.mjs'))fs.writeFileSync(d+'/check-diff.mjs',fs.readFileSync(previous+'/check-diff.mjs','utf8').replaceAll(previous,d),{flag:'wx'});
console.log('Preserved parallel registration; heavy official scenario test is isolated without changing timeouts or assertions.');
