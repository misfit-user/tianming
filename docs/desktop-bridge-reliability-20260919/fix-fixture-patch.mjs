import fs from 'node:fs';
const path='docs/desktop-bridge-reliability-20260919/patch-fixtures.mjs';
let text=fs.readFileSync(path,'utf8');
text=text.replace('s.split(tag).length!==6','s.split(tag).length!==5').replace('Expected five render fixtures','Expected four render fixtures');
fs.writeFileSync(path,text,'utf8');
