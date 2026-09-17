'use strict';
// Local evidence only. Never uploads logs or includes environment variables/data bodies.
const fs = require('fs'), path = require('path'), cp = require('child_process'), os = require('os'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..'), args = process.argv.slice(2), split = args.indexOf('--');
if (split < 1) throw new Error('usage: node scripts/perf/run.cjs LABEL -- COMMAND ARGS');
const label = args[0].replace(/[^a-z0-9_-]/gi, '_'), command = args.slice(split + 1);
const dir = path.join(root, 'web/dev-tools/perf-round1', label + '-' + crypto.randomUUID());
fs.mkdirSync(dir, { recursive: true });
const git = argv => cp.execFileSync('git', argv, { cwd: root, encoding: 'utf8' }).trim();
const report = { label, command, head: git(['rev-parse', 'HEAD']), status: git(['status', '--short']), platform: process.platform,
  arch: process.arch, node: process.version, cpu: os.cpus()[0].model, logicalCpus: os.cpus().length, memoryBytes: os.totalmem(),
  startedAt: new Date().toISOString(), sourceHashes: Object.fromEntries(['web/tm-storage.js', 'web/phase8-formal-map.js', 'web/tm-save-lifecycle.js'].map(file => [file, crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex')])) };
const dirtyPaths = new Set([...git(['diff', '--name-only', '-z']).split('\0'), ...git(['ls-files', '--others', '--exclude-standard', '-z']).split('\0')].filter(Boolean));
report.dirtyFileHashes = Object.fromEntries([...dirtyPaths].sort().map(file => [file, fs.existsSync(path.join(root, file)) ? crypto.createHash('sha256').update(fs.readFileSync(path.join(root, file))).digest('hex') : null]));
const stdout = fs.createWriteStream(path.join(dir, 'stdout.log'), { flags: 'wx' }), stderr = fs.createWriteStream(path.join(dir, 'stderr.log'), { flags: 'wx' });
const start = performance.now();
const child = cp.spawn(command[0], command.slice(1), { cwd: root, shell: process.platform === 'win32' && /^(npm|powershell)$/.test(command[0]), windowsHide: true });
child.stdout.on('data', data => { stdout.write(data); process.stdout.write(data); });
child.stderr.on('data', data => { stderr.write(data); process.stderr.write(data); });
child.on('error', e => { report.error = String(e); });
child.on('close', (code, signal) => {
  stdout.end(); stderr.end(); report.exitCode = code; report.signal = signal; report.elapsedMs = performance.now() - start; report.complete = true;
  fs.writeFileSync(path.join(dir, 'run.json'), JSON.stringify(report, null, 2) + '\n');
  console.log('EVIDENCE ' + path.relative(root, dir)); process.exitCode = code === 0 ? 0 : 1;
});
