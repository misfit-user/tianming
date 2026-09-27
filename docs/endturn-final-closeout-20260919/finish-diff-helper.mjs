import fs from 'node:fs';
const p='docs/endturn-final-closeout-20260919/check-diff.mjs';let s=fs.readFileSync(p,'utf8');
const old="      if (!rows[n-1].endsWith('\\r')) throw Error('Non-newline whitespace requires explicit review: ' + file + ':' + n);\n      rows[n-1] = rows[n-1].slice(0,-1);";
const next="      if (/^[ \\t]*\\r?$/.test(rows[n-1])) rows[n-1] = '';\n      else if (rows[n-1].endsWith('\\r')) rows[n-1] = rows[n-1].slice(0,-1);\n      else throw Error('Review non-blank added whitespace: ' + file + ':' + n);";
if(s.split(old).length!==2)throw Error('Unexpected diff helper');s=s.replace(old,next);fs.writeFileSync(p,s);console.log('Blank remnants of function extraction may be removed without touching source tokens.');
