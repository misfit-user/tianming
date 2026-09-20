import fs from 'node:fs';
import cp from 'node:child_process';
import { edit } from './patch-utils.mjs';
const dir = 'docs/desktop-bridge-reliability-20260919';
const base = JSON.parse(fs.readFileSync(dir + '/baseline.json','utf8'));
const changes = JSON.parse(fs.readFileSync(dir + '/changes.json','utf8'));
const files = [...new Set(changes.map(row=>row.file))].filter(file=>file.startsWith('web/'));
const results = [];
for (const file of files) {
  const backup = base.backup + '/' + file; if (!fs.existsSync(backup)) continue;
  const check = () => cp.spawnSync('git',['diff','--no-index','--check','--',backup,file],{encoding:'utf8'});
  const before = check(), output = (before.stdout || '') + (before.stderr || '');
  const lines = [...output.matchAll(/:(\d+): trailing whitespace\./g)].map(match=>Number(match[1]));
  if (lines.length) edit(file, text => {
    const rows = text.split('\n');
    for (const n of lines) {
      if (!rows[n-1].endsWith('\r')) throw Error('Non-newline whitespace requires explicit review: ' + file + ':' + n);
      rows[n-1] = rows[n-1].slice(0,-1);
    }
    return rows.join('\n');
  });
  const after = check(); results.push({file,normalizedNewLines:lines.length,exit:after.status,output:(after.stdout||'')+(after.stderr||'')});
}
fs.writeFileSync(dir + '/own-diff-check.json',JSON.stringify(results,null,2));
console.log(JSON.stringify(results.map(row=>({file:row.file,clean:!row.output,correctedNewLines:row.normalizedNewLines})),null,2));
if(results.some(row=>row.output || row.exit>1))process.exitCode=1;
