'use strict';
// Export this local task's recorded runs only; never connects to game/API services.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..'), args = process.argv.slice(2), out = path.join(root, 'docs/bugfix-edict-polish');
const baseline = '2aba473385c9346bfc9905ee5019520f84a23c80';
const arg = name => { const i = args.indexOf(name); assert(i >= 0 && args[i + 1], name + ' required'); return path.resolve(root, args[i + 1]); };
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const hash = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function redact(value) {
  if (typeof value === 'string') return value.replaceAll(os.homedir().replace(/\\/g, '\\\\'), '<user-profile>').replaceAll(os.homedir(), '<user-profile>').replaceAll(os.homedir().replace(/\\/g, '/'), '<user-profile>');
  if (Array.isArray(value)) return value.map(redact);
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([k, v]) => [k, redact(v)])) : value;
}
const executions = [], base = path.join(root, 'web/dev-tools/perf-round1');
for (const dir of fs.readdirSync(base)) {
  const file = path.join(base, dir, 'run.json');
  if (!dir.startsWith('edict-') || !fs.existsSync(file)) continue;
  const run = read(file);
  if (run.head !== baseline || !run.complete) continue;
  const logs = Object.fromEntries(['stdout.log', 'stderr.log'].map(name => {
    const file = path.join(base, dir, name);
    return [name, { sourceSha256: hash(file), text: redact(fs.readFileSync(file, 'utf8')) }];
  }));
  executions.push({ directory: path.relative(root, path.join(base, dir)), run, logs });
}
const final = executions.find(e => e.run.label === 'edict-full-final');
assert(final && final.run.exitCode === 0, 'final full run missing');
const sourceFiles = ['web/tm-ai-infra.js', 'web/tm-ai-infra-json.js', 'web/tm-hongyan-edict-ui.js', 'web/index.html', 'web/startup-script-phases.json', 'web/.hot-update-manifest.json', 'web/scripts/smoke-edict-polish-results.js', 'scripts/verify-electron-bridge.js', 'scripts/electron/bridge-main.cjs', 'scripts/electron/edict-polish-cases.cjs', '.github/workflows/ci.yml'];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, hash(path.join(root, file))]));
for (const [file, sha] of Object.entries(sourceHashes)) assert.equal(final.run.dirtyFileHashes[file], sha, 'changed after final smoke: ' + file);
const smokeFile = arg('--smoke'), smoke = read(smokeFile), electronFile = arg('--electron'), electron = read(electronFile);
assert(smoke.complete && smoke.summary.fail === 0);
assert.equal(new Set(smoke.results.map(r => r.name)).size, smoke.expected.length);
assert.deepEqual(smoke.results.map(r => r.name).sort(), smoke.expected.slice().sort());
assert(final.logs['stdout.log'].text.includes(smoke.runId), 'report/run mismatch');
assert(electron.complete && electron.ok && electron.results[0].mode === 'edict-polish');
const targeted = executions.find(e => e.run.label === 'edict-target-v2'), before = executions.find(e => e.run.label === 'edict-baseline-final');
assert(targeted && targeted.run.exitCode === 0 && before && before.run.exitCode === 1, 'baseline/current pair missing');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'executions.json'), JSON.stringify(redact({ baseline, sourceHashes, executions }), null, 2) + '\n');
for (const [name, file, report] of [['smoke', smokeFile, smoke], ['electron', electronFile, electron]]) fs.writeFileSync(path.join(out, name + '.json'), JSON.stringify(redact({ source: path.relative(root, file), sourceSha256: hash(file), report }), null, 2) + '\n');
const images = electron.results[0].detail.temporaryUserData;
for (const [src, dst] of [['edict-success.png', 'success.png'], ['edict-empty.png', 'empty.png']]) fs.copyFileSync(path.join(images, src), path.join(out, dst));
console.log(JSON.stringify({ output: path.relative(root, out), executions: executions.length, sourceHashes: 'MATCH', smoke: smoke.summary, electronChecks: electron.results[0].detail.results.length }));
