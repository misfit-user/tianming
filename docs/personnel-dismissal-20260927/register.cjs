'use strict';
const fs=require('fs'),path=require('path');const root=path.resolve(__dirname,'../..');
const rel='web/scripts/verify-all.js',p=path.join(root,rel),s=fs.readFileSync(p,'utf8');
const needle="  { name: 'edict-outcomes', file: 'smoke-edict-outcomes.js', estSec: 2, expectExit: 0 },";
if(!s.includes(needle))throw Error('registry anchor');const backup=path.join(__dirname,'before',rel);fs.mkdirSync(path.dirname(backup),{recursive:true});if(!fs.existsSync(backup))fs.copyFileSync(p,backup);
const nl=s.slice(s.indexOf(needle)+needle.length).startsWith('\r\n')?'\r\n':'\n';
fs.writeFileSync(p,s.replace(needle,()=>["  { name: 'personnel-dismissal-writeback', file: 'smoke-personnel-dismissal-writeback.js', estSec: 2, expectExit: 0 },","  { name: 'personnel-dismissal-official', file: 'smoke-personnel-dismissal-official.js', estSec: 60, expectExit: 0 },",needle].join(nl)));
