import fs from 'node:fs';
const dir='docs/snapshot-deadlines-20260919';
fs.writeFileSync(dir+'/check-diff.mjs',fs.readFileSync('docs/endturn-commit-reliability-20260919/check-diff.mjs','utf8').replaceAll('docs/endturn-commit-reliability-20260919',dir));
