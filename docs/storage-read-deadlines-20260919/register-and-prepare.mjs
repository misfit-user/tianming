import fs from 'node:fs';
import { edit } from './patch-utils.mjs';
const dir='docs/storage-read-deadlines-20260919',previous='docs/snapshot-deadlines-20260919';
edit('web/scripts/verify-all.js',(s,r)=>r(s,
"  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }",
"  { name: 'storage-read-deadlines', file: 'smoke-storage-read-deadlines.js', estSec: 3, expectExit: 0 },\n  { name: 'memory-manifest', file: 'smoke-memory-manifest.js', estSec: 1, expectExit: 0 }"));
if(!fs.existsSync(dir+'/check-diff.mjs'))fs.writeFileSync(dir+'/check-diff.mjs',fs.readFileSync(previous+'/check-diff.mjs','utf8').replaceAll(previous,dir),{flag:'wx'});
