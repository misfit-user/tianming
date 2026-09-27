// Reproduce the extra cross-scenario startup failure, without bypassing its guards.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
const root=path.resolve(process.argv[2]||'.'),w=path.resolve(process.argv[3]);
let text=fs.readFileSync(path.join(root,'docs/map-deep-zoom-20260918/verify-zoom-ui.mjs'),'utf8');
const needle=" await js(`doActualStart('${sid}')`);mark('native-start');";
assert.equal(text.split(needle).length,2);
text=text.replace(needle," const startResult=await js(`(async()=>{try{await doActualStart('${sid}');return {ok:true};}catch(e){return {ok:false,message:String(e.message||e),stack:String(e.stack||e)};}})()`);report.startResult=startResult;check('native-startup-contract',startResult.ok,startResult);mark('native-start');");
const needle2=" win.webContents.on('render-process-gone',(_,d)=>finish(1,'renderer exited '+JSON.stringify(d)));";assert.equal(text.split(needle2).length,2);
text=text.replace(needle2,needle2+"\n win.webContents.on('console-message',(_,level,message)=>{if(level>=2){report.console=report.console||[];if(report.console.length<25)report.console.push(String(message).slice(0,1500));}});");
const file=path.join(w,'diagnostic-tang-ui.mjs');fs.writeFileSync(file,text);assert.equal(spawnSync(process.execPath,['--check',file]).status,0);
const mode='tang-start-diagnostic',sid='sc-tang840-840',dir=path.join(w,mode+'-'+sid);fs.mkdirSync(dir,{recursive:true});
const out=fs.openSync(path.join(dir,'stdout.log'),'w'),err=fs.openSync(path.join(dir,'stderr.log'),'w');
const env={...process.env,ZOOM_REPO:root,ZOOM_WORK:w,ZOOM_MODE:mode,ZOOM_SID:sid};delete env.ELECTRON_RUN_AS_NODE;
const r=spawnSync(path.join(root,'node_modules/electron/dist/electron.exe'),[file],{cwd:root,env,stdio:['ignore',out,err],timeout:230000,windowsHide:true});fs.closeSync(out);fs.closeSync(err);
const result={status:r.status,signal:r.signal,error:r.error?.message||null};fs.writeFileSync(path.join(dir,'process-result.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
const reportFile=path.join(dir,'report.json');if(fs.existsSync(reportFile)){const rep=JSON.parse(fs.readFileSync(reportFile,'utf8'));console.log(JSON.stringify({complete:rep.complete,startResult:rep.startResult,console:rep.console},null,2));}process.exitCode=r.status===0?0:1;
