'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),s=require('./source-snapshot.json');
const candidate=path.resolve(s.candidate),archive=path.resolve(candidate,'../remote-base-only');
const files=cp.execFileSync('git',['ls-files','-z'],{cwd:candidate}).toString().split('\0').filter(r=>r&&!s.files[r]&&!r.startsWith('web/assets/')&&!fs.existsSync(path.join(s.source,r)));
for(const rel of files){const from=path.resolve(candidate,rel),to=path.resolve(archive,rel);if(!from.startsWith(candidate+path.sep)||!to.startsWith(archive+path.sep))throw Error('outside candidate');if(!fs.existsSync(from))continue;if(!fs.statSync(from).isFile())throw Error('Not a file');fs.mkdirSync(path.dirname(to),{recursive:true});fs.renameSync(from,to);}
fs.writeFileSync(path.join(__dirname,'remote-extras.json'),JSON.stringify({reason:'Origin checkout files absent from actual user working tree; preserved outside candidate',files},null,2));console.log('Preserved '+files.length+' remote-only files outside current-source candidate.');
