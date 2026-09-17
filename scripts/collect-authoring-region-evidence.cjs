'use strict';
// Export scoped command logs and summaries, never the user's scenario body.
const fs = require('fs'), path = require('path'), crypto = require('crypto'), os = require('os'), assert = require('assert/strict');
const root = path.resolve(__dirname, '..'), base = path.join(root, 'web/dev-tools/perf-round1');
const baseline = '12942b78fe64d20f4eb9ee01827a2c3567b38bf1';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function redact(x) {
  if (typeof x === 'string') return x.replaceAll(os.homedir().replace(/\\/g, '\\\\'), '<user-profile>').replaceAll(os.homedir(), '<user-profile>').replaceAll(os.homedir().replace(/\\/g, '/'), '<user-profile>');
  if (Array.isArray(x)) return x.map(redact);
  return x && typeof x === 'object' ? Object.fromEntries(Object.entries(x).map(([k, v]) => [k, redact(v)])) : x;
}
const executions = [], incomplete = [];
for (const dir of fs.readdirSync(base).filter(d => d.startsWith('authoring-region-'))) {
  const file = path.join(base, dir, 'run.json');
  if (!fs.existsSync(file)) { incomplete.push({ directory: dir, reason: 'no finalized runner metadata; initial npm.cmd spawn EINVAL is documented' }); continue; }
  const run = read(file);
  if (run.head !== baseline || !run.complete) { incomplete.push({ directory: dir, run }); continue; }
  const logs = Object.fromEntries(['stdout.log', 'stderr.log'].map(name => {
    const p = path.join(base, dir, name); return [name, { sha256: hash(p), text: fs.readFileSync(p, 'utf8') }];
  }));
  executions.push({ directory: path.relative(root, path.dirname(file)), run, logs });
}
const final = executions.find(e => e.run.label === 'authoring-region-full-locked');
assert(final && final.run.exitCode === 0, 'final full run required');
const files = ['web/editor-authoring-agent.js', 'web/editor.html', 'web/preview/scenario-editor-reset-preview.html', 'web/.hot-update-manifest.json', 'web/scripts/smoke-authoring-region-paths.js', 'scripts/verify-electron-bridge.js', 'scripts/electron/bridge-main.cjs', 'scripts/electron/authoring-region-cases.cjs', '.github/workflows/ci.yml'];
const sourceHashes = Object.fromEntries(files.map(p => [p, hash(path.join(root, p))]));
for (const [p, h] of Object.entries(sourceHashes)) assert.equal(final.run.dirtyFileHashes[p], h, 'source changed after full suite: ' + p);
const args = process.argv.slice(2), smoke = read(path.resolve(root, args[args.indexOf('--smoke') + 1]));
assert(smoke.complete && smoke.head === baseline && smoke.summary.fail === 0);
assert.equal(new Set(smoke.results.map(r => r.name)).size, smoke.expected.length);
assert.deepEqual(smoke.results.map(r => r.name).sort(), smoke.expected.slice().sort());
assert(final.logs['stdout.log'].text.includes(smoke.runId), 'smoke run identity mismatch');
const electron = executions.filter(e => ['authoring-region-standard-locked', 'authoring-region-editor-locked', 'authoring-region-player-locked'].includes(e.run.label)).map(e => {
  assert.equal(e.run.exitCode, 0);
  const m = /ELECTRON_REPORT (.+)/.exec(e.logs['stdout.log'].text); assert(m);
  const p = path.resolve(root, m[1].trim()), report = read(p); assert(report.complete && report.ok);
  return { label: e.run.label, source: path.relative(root, p), sha256: hash(p), report };
});
assert.equal(electron.length, 3);
const out = path.join(root, 'docs/bugfix-authoring-region-paths'); fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(redact({ baseline, sourceHashes, executions, incomplete, electron, smoke: { runId: smoke.runId, head: smoke.head, complete: smoke.complete, expected: smoke.expected.length, uniqueResults: new Set(smoke.results.map(r => r.name)).size, summary: smoke.summary, waivers: smoke.results.filter(r => r.waivers.length).map(r => ({ name: r.name, checks: r.waivers })) } }), null, 2) + '\n');
console.log(JSON.stringify({ executions: executions.length, incomplete: incomplete.length, hashes: 'MATCH', smoke: smoke.summary, electron: electron.map(e => ({ label: e.label, checks: e.report.results.reduce((n, r) => n + r.detail.results.length, 0) })) }));
