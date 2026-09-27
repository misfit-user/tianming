'use strict';
const fs=require('fs'),path=require('path'),crypto=require('crypto'),cp=require('child_process');
const candidate=path.resolve(__dirname,'../..'),inventoryFile=path.join(__dirname,'change-inventory.json');
if(!process.argv.includes('--apply'))throw Error('Explicit --apply required after validation');
const inventory=JSON.parse(fs.readFileSync(inventoryFile)),target=path.resolve(inventory.source);
if(target!=='C:\\Users\\37814\\Desktop\\tianming'||path.resolve(inventory.candidate)!==candidate)throw Error('Unexpected roots');
const hash=p=>fs.existsSync(p)?crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'):null;
const index=cp.execFileSync('git',['rev-parse','--path-format=absolute','--git-path','index'],{cwd:target,encoding:'utf8'}).trim(),indexBefore=hash(index);
const reviewed=inventory.files.map(row=>({...row,from:path.resolve(candidate,row.path),to:path.resolve(target,row.path)}));
for(const row of reviewed){if(!row.from.startsWith(candidate+path.sep)||!row.to.startsWith(target+path.sep))throw Error('Path escaped');if(hash(row.to)!==row.before)throw Error('Concurrent source edit: '+row.path);if(hash(row.from)!==row.after)throw Error('Unreviewed candidate edit: '+row.path);}
const backupDir=path.join(target,'docs/fiscal-satisfaction-fix-20260926/before-install');fs.mkdirSync(backupDir,{recursive:true});
for(const row of reviewed){const backup=path.join(backupDir,row.path+'.bak');if(row.before){fs.mkdirSync(path.dirname(backup),{recursive:true});if(fs.existsSync(backup)&&hash(backup)!==row.before)throw Error('Existing backup differs');if(!fs.existsSync(backup))fs.copyFileSync(row.to,backup);}}
const installed=[];for(const row of reviewed){if(hash(row.to)!==row.before)throw Error('Concurrent change before write: '+row.path);fs.mkdirSync(path.dirname(row.to),{recursive:true});fs.copyFileSync(row.from,row.to);if(hash(row.to)!==row.after)throw Error('Readback failed '+row.path);installed.push({path:row.path,sha256:row.after,bytes:row.bytes});}
const indexAfter=hash(index);if(indexAfter!==indexBefore)throw Error('Index changed during install');
const receipt={at:new Date().toISOString(),candidate,target,indexBefore,indexAfter,installed};
fs.writeFileSync(path.join(__dirname,'installation.json'),JSON.stringify(receipt,null,2));
console.log(JSON.stringify({installed:installed.length,indexUnchanged:true,target}));
