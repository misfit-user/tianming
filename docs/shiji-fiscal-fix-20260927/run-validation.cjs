'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const mode = process.argv[2];
const commands = mode === 'full' ? [
  ['full-smokes', 'web/scripts/ci-smokes.js', '--jobs', process.argv[3] || '4']
] : mode === 'changed' ? [
  ['native-manifest', 'scripts/build-native-preparation-manifest.cjs', '--check'],
  ['native-preparation', 'web/scripts/smoke-native-start-preparation.js'],
  ['release-contract', 'scripts/verify-release-contract.js'],
  ['hot-baseline', 'scripts/sync-hot-baseline.js', '--check', '--version', '1.3.5.2']
] : [
  ['architecture', 'web/scripts/lint-arch-all.js'],
  ['official-parity', 'web/scripts/verify-official-scenario-parity.js'],
  ['release-contract', 'scripts/verify-release-contract.js'],
  ['hot-baseline', 'scripts/sync-hot-baseline.js', '--check', '--version', '1.3.5.2'],
  ['renderer-bundle', 'web/scripts/build-renderer-modules.js', '--check']
];
const results = [];
for (const [name, ...args] of commands) {
  const file = path.join(__dirname, name + '.log'), fd = fs.openSync(file, 'w'), started = Date.now();
  console.log('START ' + name);
  const r = cp.spawnSync(process.execPath, args, { cwd: root, stdio: ['ignore', fd, fd], windowsHide: true });
  fs.closeSync(fd);
  const entry = { name, command: 'node ' + args.join(' '), exitCode: r.status, signal: r.signal, elapsedSeconds: (Date.now() - started) / 1000, log: path.basename(file) };
  results.push(entry);
  fs.writeFileSync(path.join(__dirname, mode + '-validation.json'), JSON.stringify(results, null, 2) + '\n');
  console.log(JSON.stringify(entry));
  console.log(fs.readFileSync(file, 'utf8').trim().split(/\r?\n/).slice(-5).join('\n'));
}
process.exitCode = results.every(r => r.exitCode === 0) ? 0 : 1;
