'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');const root=path.resolve(__dirname,'../..'),receipt=require('./installation.json'),snapshot=require('./snapshot.json');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const counts=b=>{const s=b.toString('utf8');return {bytes:b.length,crlf:(s.match(/\r\n/g)||[]).length,lf:(s.match(/(?<!\r)\n/g)||[]).length,cjk:(s.match(/[\u4e00-\u9fff]/g)||[]).length};};
const files=receipt.files.map(r=>r.path).concat(['web/tm-start-runtime-manifest.json','web/.hot-update-manifest.json']);
const rows=files.map(rel=>{const before=path.join(__dirname,'before',rel),after=fs.readFileSync(path.join(root,rel)),b=fs.existsSync(before)?fs.readFileSync(before):null;const installed=receipt.files.find(r=>r.path===rel);if(installed&&sha(after)!==installed.after)throw Error('Changed after installation: '+rel);return {path:rel,before:b?sha(b):null,after:sha(after),beforeCounts:b?counts(b):null,afterCounts:counts(after)};});
const index=path.resolve(root,cp.execFileSync('git',['rev-parse','--git-path','index'],{cwd:root,encoding:'utf8'}).trim()),indexUnchanged=sha(fs.readFileSync(index))===snapshot.indexHash;if(!indexUnchanged)throw Error('Git index differs');
fs.writeFileSync(path.join(__dirname,'verified-files.json'),JSON.stringify({files:rows,indexUnchanged},null,2));console.log(JSON.stringify({files:rows.length,indexUnchanged}));
