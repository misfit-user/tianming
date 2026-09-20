import fs from 'node:fs';
import cp from 'node:child_process';
import crypto from 'node:crypto';
const dir = 'docs/endturn-reliability-20260918';
const backup = '.bak-endturn-reliability-20260918';
if (fs.existsSync(dir + '/baseline.json')) throw Error('Do not replace an existing baseline');
const files = fs.readdirSync('web').filter(f => /^tm-(endturn|memory|ai-infra|agent|post-turn|save|start|battle-contract)/.test(f) && /\.(js|json)$/.test(f)).map(f => 'web/' + f);
files.push('web/index.html', 'web/scripts/verify-all.js', 'web/scripts/smoke-startup-phase-observability.js');
const records = files.map(file => {
  const bytes = fs.readFileSync(file), target = backup + '/' + file;
  fs.mkdirSync(target.slice(0, target.lastIndexOf('/')), { recursive: true });
  fs.writeFileSync(target, bytes, { flag: 'wx' });
  return { file, bytes: bytes.length, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
const baseline = { at: new Date().toISOString(), head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(), status: cp.execFileSync('git', ['status', '--porcelain=v1'], { encoding: 'utf8' }), backup, files: records };
fs.writeFileSync(dir + '/baseline.json', JSON.stringify(baseline, null, 2));
const helper = fs.readFileSync('docs/ai-memory-upgrade-r2-20260918/patch-utils.mjs', 'utf8');
fs.writeFileSync(dir + '/patch-utils.mjs', helper.replaceAll('docs/ai-memory-upgrade-r2-20260918', dir));
console.log('Protected current source baseline:', records.length, 'files.');
