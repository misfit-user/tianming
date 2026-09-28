'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const source=path.resolve(__dirname,'../..'),candidate='D:/Codex-Deliverables/edict-feedback-fix-20260926/tianming',dir='docs/personnel-dismissal-20260927';
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const paths=[...new Set(cp.execFileSync('git',['ls-files','-z','--cached','--others','--exclude-standard'],{cwd:source,maxBuffer:32e6}).toString().split('\0').filter(Boolean))];
const files={};
for(const rel of paths){
 if(!/^(web\/|scripts\/|scenarios\/|package\.json$|package-lock\.json$|release-excludes\.json$|AGENTS\.md$|CLAUDE\.md$|CONTRIBUTING\.md$)/.test(rel)||/^(web\/(assets|vendor|dev-tools|output)\/)/.test(rel))continue;
 const from=path.join(source,rel),to=path.join(candidate,rel);if(!fs.existsSync(from)||!fs.statSync(from).isFile())continue;
 const h=hash(from);if(hash(to)!==h){fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);}if(hash(to)!==h)throw Error('Copy mismatch '+rel);files[rel]=h;
}
fs.mkdirSync(path.join(candidate,dir),{recursive:true});for(const name of ['probe.cjs','task_plan.md','findings.md','progress.md'])fs.copyFileSync(path.join(__dirname,name),path.join(candidate,dir,name));
const index=path.resolve(source,cp.execFileSync('git',['rev-parse','--git-path','index'],{cwd:source,encoding:'utf8'}).trim());
const result={source,candidate,createdAt:new Date().toISOString(),indexHash:hash(index),files};fs.writeFileSync(path.join(__dirname,'snapshot.json'),JSON.stringify(result,null,2));fs.writeFileSync(path.join(candidate,dir,'snapshot.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({files:Object.keys(files).length,candidate,indexHash:result.indexHash}));
