'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const source=path.resolve(__dirname,'../..'),candidate=path.resolve(process.argv[2]||'');
if(!process.argv[2]||!candidate.startsWith('D:\\Codex-Deliverables\\edict-feedback-fix-20260926'))throw Error('Unexpected candidate');
const git=(args,cwd=source)=>cp.execFileSync('git',args,{cwd,maxBuffer:32*1024*1024});
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const paths=[...new Set(git(['ls-files','-z','--cached','--others','--exclude-standard']).toString('utf8').split('\0').filter(Boolean))];
const files={},skipped=[];
for(const rel of paths){
  const from=path.join(source,rel),to=path.join(candidate,rel);
  if(rel.startsWith('web/assets/')){skipped.push(rel);continue;}
  if(!fs.existsSync(from)){if(fs.existsSync(to)&&fs.lstatSync(to).isFile())fs.unlinkSync(to);continue;}
  if(!fs.statSync(from).isFile())continue;
  const before=hash(from);fs.mkdirSync(path.dirname(to),{recursive:true});if(!fs.existsSync(to)||hash(to)!==before)fs.copyFileSync(from,to);
  if(hash(to)!==before||hash(from)!==before)throw Error('Snapshot race: '+rel);files[rel]=before;
}
for(const rel of ['node_modules','web/node_modules','web/assets']){
 const target=path.join(candidate,rel);if(fs.existsSync(target)){if(fs.realpathSync(target)===fs.realpathSync(path.join(source,rel)))continue;throw Error('Dependency target already exists: '+target);}
 fs.symlinkSync(path.join(source,rel),target,'junction');
}
const indexPath=path.resolve(source,git(['rev-parse','--git-path','index']).toString().trim());
const out={source,candidate,head:git(['rev-parse','HEAD']).toString().trim(),originMain:git(['rev-parse','origin/main']).toString().trim(),createdAt:new Date().toISOString(),indexHash:hash(indexPath),files,skippedAssetFiles:skipped.length};
fs.writeFileSync(path.join(candidate,'docs/edict-feedback-fix-20260926/source-snapshot.json'),JSON.stringify(out,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'work-location.json'),JSON.stringify({candidate,source,createdAt:out.createdAt},null,2)+'\n');
console.log(JSON.stringify({candidate,files:Object.keys(files).length,skippedAssetFiles:skipped.length,indexHash:out.indexHash}));
