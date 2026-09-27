import fs from 'node:fs';
const file='docs/snapshot-deadlines-20260919/patch-open.mjs';let s=fs.readFileSync(file,'utf8');
const line=s.split('\n').find(l=>l.includes("s=r(s,'            cursorReq.onsuccess"));
if(!line)throw Error('Patch anchor not found');
const old='            cursorReq.onsuccess = function() {\n              var cursor = cursorReq.result;\n              if (!cursor) return;';
const next='            cursorReq.onsuccess = function() {\n              if (settled || _openOwner !== owner) return;\n              var cursor = cursorReq.result;\n              if (!cursor) return;';
s=s.replace(line,'  s=r(s,'+JSON.stringify(old)+','+JSON.stringify(next)+');');fs.writeFileSync(file,s,'utf8');
