import fs from 'node:fs';
import cp from 'node:child_process';
import { edit } from './patch-utils.mjs';
const dir = 'docs/ai-memory-upgrade-r2-20260918';
const baseline = JSON.parse(fs.readFileSync(dir + '/baseline.json','utf8'));
const changes = JSON.parse(fs.readFileSync(dir + '/changes.json','utf8'));
const files = Array.from(new Set(changes.map(c=>c.file))).filter(f=>f.startsWith('web/'));
const result = [];
for (const file of files) {
  const backup = baseline.backup + '/' + file; if (!fs.existsSync(backup)) continue;
  const diff = cp.spawnSync('git',['diff','--no-index','--check','--',backup,file],{encoding:'utf8'});
  const output = (diff.stdout || '') + (diff.stderr || '');
  const lines = Array.from(output.matchAll(/:(\d+): trailing whitespace\./g), match=>Number(match[1]));
  if (lines.length) {
    edit(file, text => { const rows = text.split('\n'); for (const n of lines) { if (!rows[n-1].endsWith('\r')) throw Error('Not a task newline: ' + file + ':' + n); rows[n-1] = rows[n-1].slice(0,-1); } return rows.join('\n'); });
  }
  const after = cp.spawnSync('git',['diff','--no-index','--check','--',backup,file],{encoding:'utf8'});
  result.push({file, correctedNewlines:lines.length, exit:after.status, output:(after.stdout||'')+(after.stderr||'')});
}
fs.writeFileSync(dir + '/own-diff-check.json',JSON.stringify(result,null,2));
console.log(JSON.stringify(result.map(r=>({file:r.file,corrected:r.correctedNewlines,clean:r.output.length===0})),null,2));
if(result.some(r=>r.output.length>0 || r.exit>1))process.exitCode=1;
