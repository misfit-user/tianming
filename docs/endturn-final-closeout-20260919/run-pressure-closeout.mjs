import fs from 'node:fs';import cp from 'node:child_process';
const d='docs/endturn-final-closeout-20260919',workspace=JSON.parse(fs.readFileSync(d+'/validation-workspace.json','utf8'));
process.env.TEMP=workspace.temp;process.env.TMP=workspace.temp;
const cases=[['save-pressure','smoke-perf-save-preparation.js',300000],['opening-integrity','smoke-start-game-data-integrity.js',120000],['tang-opening','smoke-tang840-opening-ledgers.js',120000]];
const results=[];
for(const [name,file,timeout]of cases){const fd=fs.openSync(d+'/bounded-'+name+'.log','w'),at=Date.now();const r=cp.spawnSync(process.execPath,['web/scripts/'+file],{stdio:['ignore',fd,fd],timeout});fs.closeSync(fd);const output=fs.readFileSync(d+'/bounded-'+name+'.log','utf8');results.push({name,file,exit:r.status,signal:r.signal,error:r.error&&r.error.message,ms:Date.now()-at,outputTail:output.slice(-3500)});console.log(name,'exit',r.status,'ms',Date.now()-at);if(r.status)console.log(output.slice(-2000));}
fs.writeFileSync(d+'/pressure-closeout.json',JSON.stringify({at:new Date().toISOString(),results},null,2));if(results.some(r=>r.exit!==0))process.exitCode=1;
