import fs from 'node:fs';
import path from 'node:path';
import {spawn} from 'node:child_process';
const dir=path.resolve('docs/desktop-bridge-reliability-20260919');
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const child=spawn(path.resolve('node_modules/electron/dist/electron.exe'),[path.join(dir,'electron-test-main.cjs')],{env,stdio:['ignore','pipe','pipe']});
let output='';child.stdout.on('data',b=>{output+=b;});child.stderr.on('data',b=>{output+=b;});
const timer=setTimeout(()=>child.kill(),40000);
const outcome=await new Promise(resolve=>{child.on('error',e=>resolve({error:e.message}));child.on('exit',(code,signal)=>resolve({code,signal}));});
clearTimeout(timer);fs.writeFileSync(path.join(dir,'electron-console.log'),output,'utf8');
console.log(JSON.stringify(outcome));
const resultFile=path.join(dir,'electron-result.json');
if(fs.existsSync(resultFile)){const r=JSON.parse(fs.readFileSync(resultFile,'utf8'));console.log(JSON.stringify(r,null,2));if(outcome.code===0&&path.dirname(r.isolatedProfile)===dir&&path.basename(r.isolatedProfile).startsWith('.isolated-electron-')){fs.rmSync(r.isolatedProfile,{recursive:true,force:true,maxRetries:3,retryDelay:200});fs.writeFileSync(path.join(dir,'electron-cleanup.json'),JSON.stringify({profile:r.isolatedProfile,removed:!fs.existsSync(r.isolatedProfile)},null,2));}}
if(outcome.code!==0)process.exitCode=1;
