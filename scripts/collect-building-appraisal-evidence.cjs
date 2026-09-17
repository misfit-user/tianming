'use strict';
// Offline export of this task's actual run.cjs logs and reports; no game/network calls.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..'), args = process.argv.slice(2);
const arg = name => args[args.indexOf(name) + 1];
for (const name of ['--smoke', '--electron']) assert(args.includes(name), name + ' is required');
const out = path.join(root, 'docs/bugfix-building-appraisal');
const base = path.join(root, 'web/dev-tools/perf-round1');
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function redact(value) {
  if (typeof value === 'string') return value.replaceAll(os.homedir().replace(/\\/g, '\\\\'), '<user-profile>').replaceAll(os.homedir(), '<user-profile>').replaceAll(os.homedir().replace(/\\/g, '/'), '<user-profile>');
  if (Array.isArray(value)) return value.map(redact);
  return value && typeof value === 'object' ? Object.fromEntries(Object.entries(value).map(([key, v]) => [key, redact(v)])) : value;
}
const executions = [];
for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
  if (!entry.isDirectory() || !entry.name.startsWith('building-')) continue;
  const dir = path.join(base, entry.name), runFile = path.join(dir, 'run.json');
  if (!fs.existsSync(runFile)) continue;
  const run = read(runFile);
  if (run.head !== '6e02f7f34fcd0ea93600a69a3cfe1d473a840074') continue;
  const logs = Object.fromEntries(['stdout.log', 'stderr.log'].map(name => {
    const file = path.join(dir, name), text = redact(fs.readFileSync(file, 'utf8'));
    return [name, { sourceSha256: sha(file), exportedSha256: crypto.createHash('sha256').update(text).digest('hex'), text }];
  }));
  executions.push({ directory: path.relative(root, dir), run, logs });
}
const smokeFile = path.resolve(root, arg('--smoke')), smoke = read(smokeFile);
assert(smoke.complete && smoke.summary.fail === 0);
assert.deepEqual(smoke.results.map(r => r.name).sort(), smoke.expected.slice().sort());
assert.equal(new Set(smoke.results.map(r => r.name)).size, smoke.expected.length);
const electronFile = path.resolve(root, arg('--electron')), electron = read(electronFile);
assert(electron.complete && electron.ok);
const sourceFiles = ['web/tm-ai-infra-json.js', 'web/tm-ai-infra.js', 'web/tm-custom-build-agent.js', 'web/tm-player-core.js', 'web/index.html', 'web/startup-script-phases.json', 'web/.hot-update-manifest.json', 'web/scripts/smoke-building-appraisal-compat.js', 'scripts/electron/building-appraisal-cases.cjs'];
const sourceHashes = Object.fromEntries(sourceFiles.map(file => [file, sha(path.join(root, file))]));
const finalSmokeRun = executions.find(e => e.run.label === 'building-final-smoke-v2');
assert(finalSmokeRun && finalSmokeRun.run.complete && finalSmokeRun.run.exitCode === 0);
assert(smoke.runId && finalSmokeRun.logs['stdout.log'].text.includes(smoke.runId), 'smoke report does not belong to the recorded final run');
for (const [file, hash] of Object.entries(sourceHashes)) assert.equal(finalSmokeRun.run.dirtyFileHashes[file], hash, 'tested file changed: ' + file);
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'executions.json'), JSON.stringify(redact({ baseline: finalSmokeRun.run.head, sourceHashes, executions: executions.sort((a, b) => a.run.startedAt.localeCompare(b.run.startedAt)) }), null, 2) + '\n');
fs.writeFileSync(path.join(out, 'smoke.json'), JSON.stringify(redact({ source: path.relative(root, smokeFile), sourceSha256: sha(smokeFile), report: smoke }), null, 2) + '\n');
fs.writeFileSync(path.join(out, 'electron.json'), JSON.stringify(redact({ source: path.relative(root, electronFile), sourceSha256: sha(electronFile), report: electron }), null, 2) + '\n');
console.log(JSON.stringify({ output: path.relative(root, out), executions: executions.length, sourceHashes: 'MATCH', smoke: smoke.summary }));
