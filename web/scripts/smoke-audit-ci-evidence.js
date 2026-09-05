'use strict';
const assert = require('assert'), fs = require('fs'), vm = require('vm'), path = require('path');
const { validateReport, assetExists, discover } = require('./lib-smoke-evidence');
const tests = ['smoke-audio-bgm.js', 'smoke-mapeditor-ui.js'];
const expected = { runId: 'this-run', head: 'this-head', tests, runnerExit: 0 };
function good() { return { version: 2, complete: true, runId: expected.runId, head: expected.head, expected: tests, skipped: [], results: tests.map(name => ({ name, pass: true, exit: 0, suspect: false, timedOut: false, waivers: [] })) }; }
assert.equal(validateReport(good(), expected).pass, 2);
const faults = [r => { r.complete = false; }, r => { r.runId = 'old-run'; }, r => { r.head = 'old-head'; }, r => { r.results = []; },
  r => { r.results.pop(); }, r => { r.results[1] = r.results[0]; }, r => { r.expected = [tests[0]]; }, r => { r.skipped = [tests[0]]; },
  r => { r.results[0].exit = 1; }, r => { r.results[0].suspect = true; }, r => { r.results[0].timedOut = true; }, r => { r.results[0].name = 'unknown'; }];
for (const fault of faults) { const r = good(); fault(r); assert.throws(() => validateReport(r, expected)); }
assert.throws(() => validateReport(null, expected));
assert.throws(() => validateReport(good(), { ...expected, runnerExit: 1 }));
assert.throws(() => validateReport(good(), { ...expected, tests: [] }));
const absent = { existsSync: () => false };
const waived = good(); waived.results[0].waivers = [{ code: 'optional-asset-absent', path: 'assets/audio/bgm/tianming-hegui.mp3' }];
assert.equal(validateReport(waived, expected, absent).waivedChecks, 1);
// An approved script's SyntaxError or other assertion must still fail, even with a valid asset waiver.
for (const exit of [1, -1]) { const r = structuredClone(waived); r.results[0].exit = exit; r.results[0].pass = false; assert.throws(() => validateReport(r, expected, absent)); }
assert.throws(() => validateReport(waived, expected, { existsSync: () => true }));
const invalid = structuredClone(waived); invalid.results[0].waivers[0].path = 'some-business-check'; assert.throws(() => validateReport(invalid, expected, absent));
assert.throws(() => assetExists(tests[0], 'assets/unapproved', absent));
assert(discover().includes(path.basename(__filename)));
const emptyRun = require('child_process').spawnSync(process.execPath,
  [path.join(__dirname, 'run-smokes.js'), '--grep', '__audit-no-matching-test__', '--all'], { encoding: 'utf8', windowsHide: true });
assert.equal(emptyRun.status, 1, 'standalone runner must not green an empty selection either');
assert.match(emptyRun.stderr, /没有匹配/);
// Execute the actual CI entry in a controlled FS/process surface: it must never consume a legacy report.
const source = fs.readFileSync(path.join(__dirname, 'ci-smokes.js'), 'utf8');
let serial = 0;
for (const mode of ['ok', 'spawn-error', 'crash', 'missing', 'empty', 'corrupt', 'stale', 'partial']) {
  const files = new Map([['legacy/smoke-report.json', JSON.stringify(good())]]);
  const io = { mkdirSync() {}, mkdtempSync: p => p + (++serial), readFileSync(p) { if (!files.has(p)) throw new Error('ENOENT'); return files.get(p); } };
  const cp = { execFileSync: () => 'this-head', spawnSync(exe, args) {
    assert(args.includes('--all') && args.includes('--no-retry'));
    if (mode === 'spawn-error') return { error: new Error('ENOENT'), status: null };
    if (mode === 'crash') return { status: 1 };
    const reportPath = args[args.indexOf('--report') + 1], runId = args[args.indexOf('--run-id') + 1];
    const r = good(); r.runId = runId;
    if (mode === 'stale') r.runId = 'old';
    if (mode === 'partial') r.results.pop();
    if (mode !== 'missing') files.set(reportPath, mode === 'empty' ? '' : mode === 'corrupt' ? '{broken' : JSON.stringify(r));
    return { status: 0 };
  } };
  const module = { exports: {} };
  const req = name => name === 'fs' ? io : name === 'child_process' ? cp : name === './lib-smoke-evidence' ? { discover: () => tests, validateReport } : require(name);
  vm.runInNewContext(source, { require: req, module, __dirname, process, console: { log() {} } });
  if (mode === 'ok') assert.equal(module.exports.main().pass, 2); else assert.throws(() => module.exports.main(), undefined, mode);
}
console.log('PASS CI fresh complete evidence, negative runner paths and granular asset waivers');
