import fs from 'node:fs';
import crypto from 'node:crypto';
const d = 'docs/api-wait-compatibility-20260920';
const changes = JSON.parse(fs.readFileSync(d + '/changes.json', 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const files = [...new Set(changes.map(r => r.file))];
console.log('OWN_FILES', files);
console.log('HASH_CONFLICTS', files.filter(f => hash(f) !== changes.filter(r => r.file === f).at(-1).after));
for (const name of ['baseline-tests.json', 'final-tests.json', 'browser-realtime-result.json']) {
  const r = JSON.parse(fs.readFileSync(d + '/' + name, 'utf8'));
  console.log(name, JSON.stringify(r.summary || r.outcome));
  if (Array.isArray(r.results)) for (const row of r.results.filter(x => x.pass === false)) console.log('FAIL', row.name, String(row.output).slice(-1700));
}
for (const name of ['final-architecture.log']) {
  const bytes = fs.readFileSync(d + '/' + name);
  const text = bytes.toString(bytes[0] === 255 && bytes[1] === 254 ? 'utf16le' : 'utf8');
  console.log(name, text);
}
const base = JSON.parse(fs.readFileSync(d + '/baseline.json', 'utf8'));
console.log('BASELINE', JSON.stringify({ at: base.at, head: base.head, backup: base.backup, fileCount: base.files.length }));
