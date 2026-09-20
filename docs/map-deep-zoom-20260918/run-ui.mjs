import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||'.'),work=path.resolve(process.argv[3]),mode=process.argv[4]||'after',sid=process.argv[5]||'sc-tianqi7-1627';
if(!/^[a-z0-9-]+$/.test(mode+sid))throw Error('Invalid test tag');
const dir=path.join(work,mode+'-'+sid);fs.mkdirSync(dir,{recursive:true});
const out=fs.openSync(path.join(dir,'stdout.log'),'w'),err=fs.openSync(path.join(dir,'stderr.log'),'w');
const env={...process.env,ZOOM_REPO:root,ZOOM_WORK:work,ZOOM_MODE:mode,ZOOM_SID:sid};delete env.ELECTRON_RUN_AS_NODE;
console.log('Isolated native game '+mode+' '+sid);
const r=spawnSync(path.join(root,'node_modules/electron/dist/electron.exe'),[path.join(root,'docs/map-deep-zoom-20260918/verify-zoom-ui.mjs')],{cwd:root,env,stdio:['ignore',out,err],timeout:230000,windowsHide:true});
fs.closeSync(out);fs.closeSync(err);const result={status:r.status,signal:r.signal,error:r.error?.message||null};fs.writeFileSync(path.join(dir,'process-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));process.exitCode=r.status===0&&!r.error?0:1;
