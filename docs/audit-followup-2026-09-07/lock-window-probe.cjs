'use strict';
// Equivalent reproduction from the user's written steps; not the unavailable ZIP.
// Original implementation is required from --repo and never copied/replaced/stubbed.
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process'), crypto = require('crypto');
const args = process.argv.slice(2), value = name => args[args.indexOf(name) + 1];
const repo = args.includes('--repo') ? path.resolve(value('--repo')) : path.resolve(__dirname, '../..');
function tx(base, crash) {
  const io = Object.create(fs), root = path.join(base, 'workshop');
  io.openSync = (file, flags, ...rest) => {
    const fd = fs.openSync(file, flags, ...rest);
    if (crash && flags === 'wx' && path.basename(file) === (crash === 'owner' ? '.transaction.lock' : '.lock-recovery')) {
      console.log('INTERRUPTED ' + path.basename(file)); process.exit(86);
    }
    return fd;
  };
  return require(path.join(repo, 'main-workshop-transaction.js')).createWorkshopTransactions({ fs: io, path, crypto, root,
    packsRoot: path.join(root, 'packs'), indexFile: path.join(root, 'index.json'), writeJsonAtomic() { throw new Error('read must not write index'); },
    normalizeId: id => id, validate() { throw new Error('read must not install'); }, publicInfo() {} });
}
if (args.includes('--child')) { tx(value('--base'), value('--child')).read(); process.exit(2); }
const base = fs.mkdtempSync(path.join(os.tmpdir(), 'tm-lock-baseline-'));
const results = [];
try {
  const root = path.join(base, 'workshop'); fs.mkdirSync(root);
  const index = path.join(root, 'index.json'); const bytes = '{"packs":[{"id":"old-package"}]}'; fs.writeFileSync(index, bytes);
  const dead = cp.spawnSync(process.execPath, ['-e', 'console.log(process.pid)'], { encoding: 'utf8', windowsHide: true });
  const deadPid = Number(dead.stdout.trim()); if (dead.status !== 0 || deadPid < 1) throw new Error('HARNESS_ERROR dead PID');
  for (const window of ['owner', 'recovery']) {
    if (window === 'recovery') fs.writeFileSync(path.join(root, '.transaction.lock'), String(deadPid));
    const child = cp.spawnSync(process.execPath, [__filename, '--repo', repo, '--base', base, '--child', window], { encoding: 'utf8', windowsHide: true });
    if (child.status !== 86 || !child.stdout.includes('INTERRUPTED')) throw new Error('HARNESS_ERROR interruption did not happen');
    const retries = [];
    for (let i = 0; i < 2; i++) { try { tx(base).read(); retries.push({ ok: true }); } catch (error) { retries.push({ ok: false, error: error.message }); } }
    results.push({ window, childExit: child.status, marker: child.stdout.trim(), retries, indexUnchanged: fs.readFileSync(index, 'utf8') === bytes });
    // Only remove explicitly named synthetic locks in this disposable probe directory.
    for (const name of ['.transaction.lock', '.lock-recovery']) fs.rmSync(path.join(root, name), { force: true });
  }
  results.push({ control: 'ordinary-read-release', ok: tx(base).read().packs[0].id === 'old-package' && !fs.existsSync(path.join(root, '.transaction.lock')) });
  fs.writeFileSync(path.join(root, '.transaction.lock'), String(deadPid));
  results.push({ control: 'proven-dead-pid', ok: tx(base).read().packs[0].id === 'old-package' });
  fs.writeFileSync(path.join(root, '.transaction.lock'), String(process.pid));
  try { tx(base).read(); results.push({ control: 'live-pid', ok: false }); } catch (error) { results.push({ control: 'live-pid', ok: /in-progress/.test(error.message) && fs.readFileSync(path.join(root, '.transaction.lock'), 'utf8') === String(process.pid) }); }
  console.log(JSON.stringify({ repo, moduleBlob: cp.execFileSync('git', ['hash-object', 'main-workshop-transaction.js'], { cwd: repo, encoding: 'utf8' }).trim(), results }, null, 2));
  process.exitCode = results.some(row => row.retries && row.retries.some(r => !r.ok) || row.control && !row.ok) ? 1 : 0;
} finally { fs.rmSync(base, { recursive: true, force: true }); }
