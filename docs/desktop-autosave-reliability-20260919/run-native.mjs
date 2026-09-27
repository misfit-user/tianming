import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';
const dir=path.resolve('docs/desktop-autosave-reliability-20260919'),source=fs.readFileSync('web/tm-save-lifecycle.js','utf8');
const start=source.indexOf('var _autoSaveInFlight=false;'),end=source.indexOf('if(_tmHasNativeFs()){',start);if(start<0||end<start)throw Error('Renderer fixture boundary not found');
fs.writeFileSync(path.join(dir,'native-renderer-copy.js'),source.slice(start,end));
const target=path.join(dir,'native-result.json');if(fs.existsSync(target))fs.renameSync(target,path.join(dir,'native-result-previous-'+Date.now()+'.json'));
const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
const p=cp.spawnSync(path.resolve('node_modules/electron/dist/electron.exe'),[path.join(dir,'native-main.cjs')],{env,encoding:'utf8',timeout:45000,maxBuffer:2000000});
fs.writeFileSync(path.join(dir,'native-console.log'),(p.stdout||'')+'\n'+(p.stderr||''));
const result=fs.existsSync(target)?JSON.parse(fs.readFileSync(target,'utf8')):null;
const cleanup=[];
if(result&&result.profile){const profile=path.resolve(result.profile);if(path.dirname(profile)!==dir||!path.basename(profile).startsWith('.isolated-autosave-'))throw Error('Unexpected fixture profile');try{fs.rmSync(profile,{recursive:true,force:true,maxRetries:3,retryDelay:200});cleanup.push({profile,removed:true});}catch(e){cleanup.push({profile,removed:false,error:e.message});}}
fs.writeFileSync(path.join(dir,'native-cleanup.json'),JSON.stringify(cleanup,null,2));
console.log(JSON.stringify({exit:p.status,error:p.error&&p.error.message,result},null,2));
if(p.status!==0||!result||!result.outcome.ok)process.exitCode=1;
