'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const candidate=path.resolve(__dirname,'../..'),snap=require('./snapshot.json'),source=snap.source,dir='docs/personnel-dismissal-20260927';
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const files=['web/modules/ai-change-applier/core.js','web/modules/ai-change-applier/validators.js','web/generated/tm-ai-change-applier.bundle.js','web/tm-office-system.js','web/scripts/verify-all.js','web/scripts/smoke-personnel-dismissal-writeback.js','web/scripts/smoke-personnel-dismissal-official.js','web/index.html'];
const indexPath=path.resolve(source,cp.execFileSync('git',['rev-parse','--git-path','index'],{cwd:source,encoding:'utf8'}).trim());
if(hash(indexPath)!==snap.indexHash)throw Error('Git index changed since snapshot');
const htmlPath=path.join(candidate,'web/index.html');let html=fs.readFileSync(htmlPath,'utf8');
for(const name of ['tm-office-system.js','generated/tm-ai-change-applier.bundle.js']){
 const re=new RegExp('(src=["\u0027]'+name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')(?:\\?v=[^"\u0027]*)?(["\u0027])','g');let count=0;
 html=html.replace(re,(_,a,b)=>{count++;return a+'?v=20260927-personnel-dismissal'+b;});if(count!==1)throw Error('cache anchor '+name+' '+count);
}
fs.writeFileSync(htmlPath,html);
const rows=files.map(rel=>({path:rel,before:hash(path.join(source,rel)),expected:snap.files[rel]||null,after:hash(path.join(candidate,rel))}));
for(const r of rows)if(r.before!==r.expected)throw Error('Source changed concurrently: '+r.path);
for(const r of rows){const from=path.join(source,r.path),backup=path.join(source,dir,'before',r.path);if(fs.existsSync(from)){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(from,backup);}fs.copyFileSync(path.join(candidate,r.path),from);if(hash(from)!==r.after)throw Error('Install hash mismatch '+r.path);}
for(const f of fs.readdirSync(__dirname)){if(f==='before'||f==='snapshot.json')continue;const from=path.join(__dirname,f);if(fs.statSync(from).isFile()&&f.endsWith('.cjs'))fs.copyFileSync(from,path.join(source,dir,f));}
const result={installedAt:new Date().toISOString(),files:rows,indexUnchanged:hash(indexPath)===snap.indexHash,published:false};fs.writeFileSync(path.join(source,dir,'installation.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({files:rows.length,indexUnchanged:result.indexUnchanged}));
