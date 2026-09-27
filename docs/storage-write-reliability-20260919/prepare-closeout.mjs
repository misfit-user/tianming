import fs from 'node:fs';
const dir='docs/storage-write-reliability-20260919',previous='docs/storage-read-deadlines-20260919';
if(!fs.existsSync(dir+'/check-diff.mjs'))fs.writeFileSync(dir+'/check-diff.mjs',fs.readFileSync(previous+'/check-diff.mjs','utf8').replaceAll(previous,dir),{flag:'wx'});
console.log('Own-diff verifier prepared');
