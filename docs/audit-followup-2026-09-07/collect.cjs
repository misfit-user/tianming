'use strict';
// Explicit small text evidence only. Never includes userData, key material, assets,
// node_modules or old staging. Sanitized display copies have original/published hashes.
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..');
function sanitize(value) {
  return String(value).replace(/C:(?:\\\\|\\|\/)Users(?:\\\\|\\|\/)37814/g, '<USER_HOME>').replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
}
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
function copy(src, relative) {
  const raw = fs.readFileSync(src), text = sanitize(raw);
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{25,}/.test(text)) throw new Error('Possible secret in evidence');
  const dest = path.join(__dirname, relative); fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest, text);
  return { path: relative, originalSha256: sha(raw), publishedSha256: sha(text), redacted: !raw.equals(Buffer.from(text)) };
}
const [mode, id] = process.argv.slice(2);
if (mode === 'electron') {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error('Expected actual run UUID');
  const dir = path.join(root, 'web/dev-tools/electron-bridge', id), report = JSON.parse(fs.readFileSync(path.join(dir, 'report.json')));
  const files = ['report.json', ...report.results.flatMap(r => [r.mode + '.json', r.mode + '.log'])].filter(name => fs.existsSync(path.join(dir, name)));
  const rows = files.map(name => copy(path.join(dir, name), 'electron/' + id + '/' + name.replace(/\.log$/, '.txt')));
  fs.writeFileSync(path.join(__dirname, 'electron', id, 'provenance.json'), JSON.stringify(rows, null, 2) + '\n');
} else if (mode === 'smoke') {
  if (!/^ci-[A-Za-z0-9]+$/.test(id)) throw new Error('Expected actual smoke report directory');
  const row = copy(path.join(root, 'web/dev-tools/arch-guard', id, 'smoke-report.json'), 'evidence/full-smoke-report.json');
  fs.writeFileSync(path.join(__dirname, 'evidence/full-smoke-provenance.json'), JSON.stringify(row, null, 2) + '\n');
} else if (mode === 'redact') {
  // Mechanical presentation normalization of this turn's command outputs only.
  for (const name of fs.readdirSync(path.join(__dirname, 'evidence'))) {
    if (!/\.(txt|json)$/.test(name)) continue;
    const file = path.join(__dirname, 'evidence', name); fs.writeFileSync(file, sanitize(fs.readFileSync(file, 'utf8')));
  }
} else throw new Error('Expected electron UUID | smoke ci-ID | redact');
