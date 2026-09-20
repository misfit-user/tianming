// Tests actual Windows CMD parsing with a child-only npm stub. Never starts a real save.
import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';
const repo=path.resolve(import.meta.dirname,'../..'),file=path.join(repo,'启动天命-山河境实测.cmd');
const dir=path.join('D:/tianming-assistant-work/shanhe-b5-launch-repair-20260919','regression-'+Date.now());fs.mkdirSync(dir,{recursive:true});
const data=fs.readFileSync(file),text=data.toString('ascii'),checks=[];
function check(name,pass){checks.push({name,pass});if(!pass)throw Error(name);}
check('command-bytes-ASCII',data.every(b=>b<128));check('CRLF-only',!/(?<!\r)\n/.test(text));
check('no-startup-sync',!text.includes('dev-sync-latest'));check('keeps-errors-visible',text.includes('goto failed')&&text.includes('pause'));
const env={...process.env,Path:dir+';'+(process.env.Path||process.env.PATH)};delete env.PATH;
const run=()=>cp.spawnSync('cmd.exe',['/d','/c',file],{cwd:repo,windowsVerbatimArguments:true,windowsHide:true,env,encoding:'utf8',timeout:10000,input:'\r\n'});
fs.writeFileSync(path.join(dir,'npm.cmd'),'@echo off\r\necho SHANHE_LAUNCH_REACHED\r\nexit /b 0\r\n','ascii');
const good=run();check('actual-CMD-reaches-npm',good.status===0&&good.stdout.includes('SHANHE_LAUNCH_REACHED'));check('no-parser-errors',!good.stderr);
fs.writeFileSync(path.join(dir,'npm.cmd'),'@echo off\r\nexit /b 7\r\n','ascii');const bad=run();check('preserves-failure-exit',bad.status===7&&bad.stdout.includes('code 7'));
const result={checks,passed:checks.length,failed:0,scope:'real CMD parser with subprocess-local stub; full main/preload test recorded separately'};fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({dir,...result},null,2));
