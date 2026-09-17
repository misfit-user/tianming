'use strict';
// Reuses the real production bridge gate and its external-network-denied ownership boundary.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const root = path.resolve(__dirname, '../..'), args = process.argv.slice(2), arg = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const baseline = path.resolve(arg('--baseline', '../tianming-perf-baseline')), repeats = Number(arg('--repeats', 3));
if (!Number.isInteger(repeats) || repeats < 1 || repeats > 10 || baseline === root) throw new Error('distinct baseline and 1..10 repeats required');
const id = crypto.randomUUID(), out = path.join(root, 'web/dev-tools/perf-round1/electron-' + id);
const tempRoot = path.resolve(arg('--temp-root', os.tmpdir())); fs.mkdirSync(tempRoot, { recursive: true });
const temporary = fs.mkdtempSync(path.join(tempRoot, 'tm-perf-round1-'));
const focusedAutosave = args.includes('--autosave');
const sampleDir = path.resolve(arg('--samples', path.join(temporary, 'shared-samples')));
fs.mkdirSync(out, { recursive: true });
const runtime = require('electron'); if (!fs.existsSync(runtime)) throw new Error('locked Electron runtime missing');
const report = { runId: id, platform: process.platform, node: process.version, cpu: os.cpus()[0].model, logicalCpus: os.cpus().length,
  totalMemoryBytes: os.totalmem(), window: { width: 1280, height: 800, visible: true },
  repeats, warmState: 'new temporary userData each process; OS filesystem cache is not cleared; first and subsequent launches separately recorded',
  notMeasured: ['real Chinese IME candidate selection', 'AI network/first-token/stream (no API calls)', 'complete AI end-turn', 'GC pause attribution', 'signed installer'], results: [] };
launches: for (let i = 0; i < repeats; i++) for (const side of (i % 2 ? ['after', 'before'] : ['before', 'after'])) {
  const repo = side === 'before' ? baseline : root, file = path.join(out, `${side}-${i}.json`), userData = path.join(temporary, side + '-' + i);
  const env = { ...process.env, TM_BRIDGE_TEST_ROOT: repo, TM_BRIDGE_TEST_MODE: focusedAutosave ? 'performance-autosave' : 'performance', TM_BRIDGE_TEST_REPORT: file,
    TM_BRIDGE_TEST_USERDATA: userData, TM_PERF_SAMPLE_DIR: sampleDir, TM_PERF_ITERATION: String(i),
    TM_PERF_SCENARIO: arg('--scenario', ''), TM_PERF_MAIN_PROFILE: args.includes('--main-profile') ? '1' : '' };
  delete env.ELECTRON_RUN_AS_NODE; delete env.TIANMING_TEST_EXPORTS;
  const start = performance.now();
  const run = cp.spawnSync(runtime, [path.join(root, 'scripts/electron/bridge-main.cjs')], { cwd: repo, env, windowsHide: true, encoding: 'utf8', timeout: 260000, maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(out, `${side}-${i}.log`), (run.stdout || '') + (run.stderr || ''));
  const detail = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
  const record = { side, iteration: i, head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
    sourceHashes: Object.fromEntries(['web/tm-storage.js', 'web/phase8-formal-map.js', 'web/tm-save-lifecycle.js', ...(focusedAutosave ? ['preload-impl.js', 'main-impl.js'] : [])].map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, p))).digest('hex')])),
    processElapsedMs: performance.now() - start, exitCode: run.status, error: run.error?.message, detail,
    ok: run.status === 0 && detail?.ok === true && !!detail.performance };
  report.results.push(record); console.log(side, i, record.ok ? 'PASS' : 'FAIL', record.processElapsedMs, detail?.failures || run.error?.message);
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  if (!record.ok) { process.exitCode = 1; break launches; }
}
report.complete = report.results.length === repeats * 2;
report.ok = report.complete && report.results.every(r => r.ok);
fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('PERF_ELECTRON_REPORT ' + out); if (!report.ok) process.exitCode = 1;
