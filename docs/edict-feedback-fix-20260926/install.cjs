'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process'),inventory=require('./change-inventory.json'),snap=require('./source-snapshot.json');
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
if(inventory.conflicts.length)throw Error('Unresolved concurrent modifications');
const source=path.resolve(inventory.source),candidate=path.resolve(inventory.root),docs=path.join(source,'docs/edict-feedback-fix-20260926');
const index=path.resolve(source,cp.execFileSync('git',['rev-parse','--git-path','index'],{cwd:source,encoding:'utf8'}).trim()),indexBefore=hash(index);
for(const row of inventory.files){const from=path.join(candidate,row.path),to=path.join(source,row.path);if(hash(from)!==row.after||hash(to)!==row.before)throw Error('Concurrent change: '+row.path);}
for(const row of inventory.files){const to=path.join(source,row.path),backup=path.join(docs,'before-install',row.path+'.bak');if(row.before){fs.mkdirSync(path.dirname(backup),{recursive:true});if(fs.existsSync(backup)&&hash(backup)!==row.before)throw Error('Backup conflict');if(!fs.existsSync(backup))fs.copyFileSync(to,backup);}}
const installed=[];for(const row of inventory.files){const from=path.join(candidate,row.path),to=path.join(source,row.path);if(hash(to)!==row.before)throw Error('Concurrent change before install: '+row.path);fs.mkdirSync(path.dirname(to),{recursive:true});fs.copyFileSync(from,to);if(hash(to)!==row.after)throw Error('Readback failure');installed.push({path:row.path,sha256:row.after});}
const result={installedAt:new Date().toISOString(),source,candidate,files:installed,indexBefore,indexAfter:hash(index),indexUnchanged:indexBefore===hash(index),previousIndexUnchanged:indexBefore===snap.indexHash,published:false};
if(!result.indexUnchanged)throw Error('Index changed while installing');
fs.writeFileSync(path.join(__dirname,'installation.json'),JSON.stringify(result,null,2));fs.mkdirSync(docs,{recursive:true});
for(const name of fs.readdirSync(__dirname)){const p=path.join(__dirname,name);if(fs.statSync(p).isFile()&&name!=='setup.cjs')fs.copyFileSync(p,path.join(docs,name));}
console.log(JSON.stringify({installed:installed.length,indexUnchanged:result.indexUnchanged,source,published:false}));
