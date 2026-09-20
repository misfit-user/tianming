import fs from 'node:fs';import {edit} from './patch-utils.mjs';
edit('web/scripts/verify-all.js',(s,r)=>r(s,"  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }","  { name: 'desktop-autosave-reliability', file: 'smoke-desktop-autosave-reliability.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"));
const dir='docs/desktop-autosave-reliability-20260919',previous='docs/desktop-bridge-reliability-20260919';
if(!fs.existsSync(dir+'/check-diff.mjs')){
 let code=fs.readFileSync(previous+'/check-diff.mjs','utf8').replaceAll(previous,dir);
 code=code.replace(/\.filter\(file\s*=>\s*file\.startsWith\('web\/'\)\)/g,'').replace(/\.filter\(f\s*=>\s*f\.startsWith\('web\/'\)\)/g,'');
 fs.writeFileSync(dir+'/check-diff.mjs',code,{flag:'wx'});
}
