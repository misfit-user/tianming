import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const dir = 'docs/ai-memory-upgrade-20260918';
const logPath = dir + '/changes.json';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
export function edit(file, transform) {
  const original = fs.readFileSync(file);
  const baseline = JSON.parse(fs.readFileSync(dir + '/baseline.json', 'utf8'));
  const changes = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
  const prior = changes.filter(x => x.file === file).at(-1);
  const base = baseline.files.find(x => x.file === file);
  if ((prior || base) && sha(original) !== (prior ? prior.after : base.sha256)) throw Error('Concurrent edit: ' + file);
  const backup = baseline.backup + '/' + file;
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, { flag: 'wx' });
  const eol = original.includes(Buffer.from('\r\n')) ? '\r\n' : '\n';
  const replace = (text, from, to) => {
    from = from.replace(/\r?\n/g, eol); to = to.replace(/\r?\n/g, eol);
    if (text.split(from).length !== 2) throw Error('Non-unique patch in ' + file + ': ' + from.slice(0, 100));
    return text.replace(from, to);
  };
  const next = transform(original.toString('utf8'), replace);
  if (sha(fs.readFileSync(file)) !== sha(original)) throw Error('Concurrent write: ' + file);
  fs.writeFileSync(file, next, 'utf8');
  changes.push({ file, before: sha(original), after: sha(Buffer.from(next)), at: new Date().toISOString() });
  fs.writeFileSync(logPath, JSON.stringify(changes, null, 2));
  console.log('Patched ' + file);
}
