import fs from 'node:fs';
import path from 'node:path';
const dir = 'docs/api-wait-compatibility-20260920';
const status = JSON.parse(fs.readFileSync(dir + '/resumed-run-status.json', 'utf8'));
if (!status.complete) throw Error('Prior validation is still running; do not overwrite evidence');
const target = dir + '/before-history-fixture-fix';
fs.mkdirSync(target, { recursive: true });
const names = ['resumed-run-status.json', 'resumed-tested-inputs.json', 'resumed-full-tests.json', 'resumed-full-tests.log', 'resumed-architecture.log', 'resumed-browser.log', 'browser-realtime-result.json'];
for (const name of names) {
  const source = path.join(dir, name), backup = path.join(target, name);
  if (fs.existsSync(source) && !fs.existsSync(backup)) fs.copyFileSync(source, backup);
}
console.log('Preserved the intermediate regression and its original input fingerprints.');
