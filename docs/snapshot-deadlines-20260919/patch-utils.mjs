import fs from 'node:fs';
import crypto from 'node:crypto';
import path from 'node:path';
const dir = 'docs/snapshot-deadlines-20260919';
const logPath = dir + '/changes.json';
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function offset(raw, normalizedOffset) {
  let index = 0, count = 0;
  while (index < raw.length && count < normalizedOffset) {
    if (raw[index] === '\r' && raw[index + 1] === '\n') index++;
    index++; count++;
  }
  return index;
}
export function edit(file, transform) {
  const original = fs.readFileSync(file);
  const baseline = JSON.parse(fs.readFileSync(dir + '/baseline.json', 'utf8'));
  const changes = fs.existsSync(logPath) ? JSON.parse(fs.readFileSync(logPath, 'utf8')) : [];
  const prior = changes.filter(x => x.file === file).at(-1), base = baseline.files.find(x => x.file === file);
  if ((prior || base) && sha(original) !== (prior ? prior.after : base.sha256)) throw Error('Concurrent edit: ' + file);
  const backup = baseline.backup + '/' + file;
  fs.mkdirSync(path.dirname(backup), { recursive: true });
  if (!fs.existsSync(backup)) fs.writeFileSync(backup, original, { flag: 'wx' });
  const replace = (text, from, to) => {
    const normalized = text.replace(/\r\n/g, '\n'), wanted = from.replace(/\r\n/g, '\n');
    if (normalized.split(wanted).length !== 2) throw Error('Non-unique patch in ' + file + ': ' + wanted.slice(0, 100));
    const at = normalized.indexOf(wanted), start = offset(text, at), end = offset(text, at + wanted.length);
    const old = text.slice(start, end), eol = old.includes('\r\n') ? '\r\n' : '\n';
    return text.slice(0, start) + to.replace(/\r?\n/g, eol) + text.slice(end);
  };
  const next = transform(original.toString('utf8'), replace);
  if (sha(fs.readFileSync(file)) !== sha(original)) throw Error('Concurrent write: ' + file);
  fs.writeFileSync(file, next, 'utf8');
  changes.push({ file, before: sha(original), after: sha(Buffer.from(next)), at: new Date().toISOString() });
  fs.writeFileSync(logPath, JSON.stringify(changes, null, 2));
  console.log('Patched ' + file);
}
