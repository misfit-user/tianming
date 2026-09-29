'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');const root=path.resolve(__dirname,'../..');
const git=args=>cp.execFileSync('git',['-c','core.quotepath=false',...args],{cwd:root,encoding:'utf8',maxBuffer:8*1024*1024});
const extras=['web/tm-political-actions.js',...fs.readdirSync(path.join(root,'web/scripts')).filter(f=>/^(?:lib|smoke)-political-.*\.js$/.test(f)).map(f=>'web/scripts/'+f)];
const file=path.join(__dirname,'frozen-inputs.json');const files=process.argv.includes('--write')?[...new Set(git(['diff','HEAD','--name-only','-z']).split('\0').filter(Boolean).concat(extras))].sort():JSON.parse(fs.readFileSync(file)).files.map(f=>f.path);const hashes=files.map(p=>({path:p,bytes:fs.statSync(path.join(root,p)).size,sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(root,p))).digest('hex')}));
if(process.argv.includes('--write')){fs.writeFileSync(file,JSON.stringify({head:git(['rev-parse','HEAD']).trim(),branch:git(['branch','--show-current']).trim(),files:hashes},null,2)+'\n');console.log('Frozen '+files.length+' inputs');}
else{const old=JSON.parse(fs.readFileSync(file));if(JSON.stringify(old.files)!==JSON.stringify(hashes))throw Error('Source bytes changed after freeze');console.log('PASS frozen '+files.length+' input hashes');}
