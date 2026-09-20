import fs from 'node:fs';
import cp from 'node:child_process';
const dir = 'docs/ai-memory-upgrade-r2-20260918';
const commands = [
  ['generatedManifest', 'web/scripts/build-startup-phase-manifest.js', '--check'],
  ['startupContract', 'web/scripts/smoke-startup-phase-observability.js']
];
const results = commands.map(([name, ...args]) => {
  const result = cp.spawnSync(process.execPath, args, { encoding: 'utf8', timeout: 15000 });
  const output = (result.stdout || '') + (result.stderr || '');
  fs.writeFileSync(dir + '/' + name + '-retest.log', output, 'utf8');
  return { name, exit: result.status, signal: result.signal, output };
});
fs.writeFileSync(dir + '/startup-retest.json', JSON.stringify({ at: new Date().toISOString(), results }, null, 2));
const path = dir + '/verify-round2.mjs';
let source = fs.readFileSync(path, 'utf8');
const anchor = "fs.writeFileSync(dir + '/verification.json'";
if (source.split(anchor).length !== 2) throw Error('Verification insertion anchor not unique');
source = source.replace(anchor, "report.startupRetest = json('startup-retest.json');\nreport.extendedFailures = extended?.results.filter(r=>!r.pass).map(r=>({name:r.name,exit:r.exit,timedOut:r.timedOut,ms:r.ms,output:r.output.slice(-1500)}));\n" + anchor);
fs.writeFileSync(path, source, 'utf8');
console.log(JSON.stringify(results.map(r=>({name:r.name,exit:r.exit})), null, 2));
