'use strict';
const fs=require('fs'),path=require('path'),cp=require('child_process');
const root=path.resolve(__dirname,'../..'),[name,...args]=process.argv.slice(2);
if(!name || !args.length)throw Error('name and node script arguments required');
const log=path.join(__dirname,name+'.log'),fd=fs.openSync(log,'w'),started=new Date().toISOString();
const child=cp.spawn(process.execPath,args,{cwd:root,stdio:['ignore',fd,fd],windowsHide:true});
child.on('error',e=>{fs.closeSync(fd);console.error(e);process.exitCode=1;});
child.on('exit',(code,signal)=>{fs.closeSync(fd);const result={name,args,started,finished:new Date().toISOString(),code,signal,log};fs.writeFileSync(path.join(__dirname,name+'.result.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));process.exitCode=code==null?1:code;});
