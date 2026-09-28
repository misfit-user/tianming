'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),base=require('./installation.json'),snap=require('./source-snapshot.json');
const source=base.source,candidate=base.candidate,docs=path.join(source,'docs/edict-feedback-fix-20260926');
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const entries=new Map(base.files.map(r=>[r.path,r.sha256]));for(const r of ['web/startup-script-phases.json','web/scripts/smoke-startup-phase-observability.js'])entries.set(r,snap.files[r]||null);
const updates=[...entries].map(([rel,before])=>({path:rel,before,after:hash(path.join(candidate,rel))})).filter(r=>r.before!==r.after);
for(const r of updates)if(hash(path.join(source,r.path))!==r.before)throw Error('Concurrent source change: '+r.path);
for(const r of updates){const target=path.join(source,r.path),backup=path.join(docs,'before-install',r.path+'.bak');if(!fs.existsSync(backup)&&r.before){fs.mkdirSync(path.dirname(backup),{recursive:true});fs.copyFileSync(target,backup);}fs.copyFileSync(path.join(candidate,r.path),target);if(hash(target)!==r.after)throw Error('Readback '+r.path);}
const logPath=path.join(docs,'installed-full-smokes.log'),log=fs.readFileSync(logPath,'utf8'),header=log.match(/report=([^\r\n]+)/);
fs.copyFileSync(logPath,path.join(docs,'installed-initial-full-smokes.log'));if(header)fs.copyFileSync(header[1],path.join(docs,'installed-initial-ci-report.json'));
const index=path.resolve(source,cp.execFileSync('git',['rev-parse','--git-path','index'],{cwd:source,encoding:'utf8'}).trim());
const out={installedAt:new Date().toISOString(),source,candidate,updates,files:[...entries].map(([rel])=>({path:rel,sha256:hash(path.join(source,rel))})),indexUnchanged:hash(index)===base.indexBefore,published:false};
fs.writeFileSync(path.join(__dirname,'installation-addendum.json'),JSON.stringify(out,null,2));
for(const name of fs.readdirSync(__dirname)){const p=path.join(__dirname,name);if(fs.statSync(p).isFile()&&name!=='setup.cjs'&&name!=='installation.json')fs.copyFileSync(p,path.join(docs,name));}
console.log(JSON.stringify({updated:updates.length,total:out.files.length,indexUnchanged:out.indexUnchanged}));
