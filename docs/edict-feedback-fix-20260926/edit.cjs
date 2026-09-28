'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..');
let started=!process.argv[2];
function edit(rel,fn){if(!started){if(rel!==process.argv[2])return;started=true;}const p=path.join(root,rel),raw=fs.readFileSync(p),s=raw.toString('utf8'),next=fn(s);if(next===s)return;const b=path.join(__dirname,'before',rel+'.bak');fs.mkdirSync(path.dirname(b),{recursive:true});if(!fs.existsSync(b))fs.writeFileSync(b,raw);fs.writeFileSync(p,next);console.log(rel+' '+crypto.createHash('sha256').update(next).digest('hex'));}
function replace(s,old,value){const options=[old,old.replace(/\r?\n/g,'\r\n'),old.replace(/\r?\n/g,'\n')];const found=options.find(x=>s.split(x).length===2);if(found==null)throw Error('Expected one match: '+old.slice(0,110));const at=s.indexOf(found),eol=found.includes('\n')?(found.includes('\r\n')?'\r\n':'\n'):(s.slice(at+found.length,at+found.length+2)==='\r\n'?'\r\n':'\n');value=value.replace(/\r?\n/g,eol);return s.replace(found,()=>value);}
module.exports={root,edit,replace};
