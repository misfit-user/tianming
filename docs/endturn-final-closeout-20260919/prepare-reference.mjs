import fs from 'node:fs';
const target='web/scripts/fixtures/memory-hybrid-reference.js';
if(fs.existsSync(target))throw Error('Reference fixture already exists');
fs.writeFileSync(target,fs.readFileSync('.bak-endturn-final-closeout-20260919/web/tm-memory-hybrid.js'),{flag:'wx'});
console.log('Stored immutable pre-optimization scoring reference');
