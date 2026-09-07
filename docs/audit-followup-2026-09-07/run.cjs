'use strict';
// Evidence recorder only. Never changes the program under test or its exit status.
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const [label, command, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]+$/.test(label || '') || !command) throw new Error('usage: run.cjs label command [args]');
const git = (...a) => cp.execFileSync('git', a, { cwd: root, encoding: 'utf8' }).trim();
function sanitize(text) {
  let value = String(text);
  const home = process.env.USERPROFILE;
  if (home) for (const variant of [home.replaceAll('\\', '\\\\'), home, home.replaceAll('\\', '/')]) value = value.replaceAll(variant, '<USER_HOME>');
  return value.replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '');
}
const before = { head: git('rev-parse', 'HEAD'), tree: git('rev-parse', 'HEAD^{tree}'), status: git('status', '--short') };
const start = Date.now();
const result = cp.spawnSync(command, args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 32 * 1024 * 1024 });
const raw = (result.stdout || '') + (result.stderr || '') + (result.error ? '\n' + result.error.stack : '');
const output = sanitize(raw);
const rawPath = path.join(root, 'web/dev-tools/audit-followup', label + '.raw.txt');
fs.mkdirSync(path.dirname(rawPath), { recursive: true }); fs.writeFileSync(rawPath, raw);
const dir = path.join(__dirname, 'evidence'); fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, label + '.txt'), output);
fs.writeFileSync(path.join(dir, label + '.json'), sanitize(JSON.stringify({ label, command, args, before, after: { head: git('rev-parse', 'HEAD'), status: git('status', '--short') },
  platform: process.platform, os: require('os').release(), node: process.version, startedAt: new Date(start).toISOString(), durationMs: Date.now() - start,
  rawPath: path.relative(root, rawPath), rawSha256: require('crypto').createHash('sha256').update(raw).digest('hex'),
  exitCode: result.status, signal: result.signal, error: result.error && result.error.message }, null, 2)) + '\n');
process.stdout.write(output); process.exitCode = result.status === 0 ? 0 : 1;
