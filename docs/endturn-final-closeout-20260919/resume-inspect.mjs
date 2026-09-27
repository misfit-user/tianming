import fs from 'node:fs';import crypto from 'node:crypto';
const d='docs/endturn-final-closeout-20260919',cs=JSON.parse(fs.readFileSync(d+'/changes.json','utf8'));
const rows=[...new Set(cs.map(r=>r.file))].map(f=>cs.filter(r=>r.file===f).at(-1));
console.log('LAST',cs.at(-1));
console.log('CHANGED',rows.filter(r=>!fs.existsSync(r.file)||crypto.createHash('sha256').update(fs.readFileSync(r.file)).digest('hex')!==r.after).map(r=>r.file));
console.log('FILES',rows.map(r=>r.file));
for(const name of ['review-all.json','baseline-full-tests.json']){
const report=JSON.parse(fs.readFileSync(d+'/'+name,'utf8'));console.log(name,report.summary);
console.log('FAILURES',report.results.filter(r=>!r.pass).map(r=>r.name));}
