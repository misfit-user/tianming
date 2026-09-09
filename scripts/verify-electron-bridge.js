'use strict';
// A mandatory real-runtime gate: no mock bridge and no missing-runtime waiver.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const repo = argv.includes('--repo') ? path.resolve(argv[argv.indexOf('--repo') + 1]) : root;
const reportDir = path.join(root, 'web/dev-tools/electron-bridge', crypto.randomUUID());
fs.mkdirSync(reportDir, { recursive: true });
const temporary = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tm-bridge-series-'));
const modes = argv.includes('--character-actions') ? ['character-actions'] : argv.includes('--edict-clarity') ? ['edict-clarity'] : argv.includes('--relief-inspect') || argv.includes('--relief-inspect-small') ? ['relief-inspect'] : argv.includes('--relief-pilot') ? ['relief-pilot'] : argv.includes('--authoring-regions') ? ['authoring-regions'] : argv.includes('--edict-polish') ? ['edict-polish'] : argv.includes('--building-appraisal') ? ['building-appraisal'] : argv.includes('--baseline') ? ['production', 'test-exports'] : ['production', 'test-exports', 'restart'];
const report = { runId: path.basename(reportDir), repo, head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  status: cp.execFileSync('git', ['status', '--short'], { cwd: repo, encoding: 'utf8' }).trim(), platform: process.platform, node: process.version,
  baseline: argv.includes('--baseline'), complete: false, results: [] };
try {
  const runtime = require('electron');
  if (!fs.existsSync(runtime)) throw new Error('electron-runtime-missing: run node node_modules/electron/install.js after npm ci --ignore-scripts');
  for (const mode of modes) {
    const file = path.join(reportDir, mode + '.json');
    const userData = path.join(temporary, mode === 'test-exports' ? 'exports' : 'production');
    fs.mkdirSync(userData, { recursive: true });
    const env = { ...process.env, TM_BRIDGE_TEST_ROOT: repo, TM_BRIDGE_TEST_REPORT: file, TM_BRIDGE_TEST_MODE: mode, TM_BRIDGE_TEST_BASELINE: report.baseline ? '1' : '0', TM_BRIDGE_TEST_USERDATA: userData };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.TIANMING_TEST_EXPORTS;
    if (argv.includes('--scenario')) env.TM_RELIEF_SCENARIO = argv[argv.indexOf('--scenario') + 1];
    if (argv.includes('--relief-inspect-small')) env.TM_RELIEF_SMALL_FIXTURE = '1';
    const run = cp.spawnSync(runtime, [path.join(__dirname, 'electron/bridge-main.cjs')], { cwd: repo, env, encoding: 'utf8', windowsHide: true, timeout: mode === 'relief-inspect' ? 1860000 : mode === 'relief-pilot' ? 210000 : 90000, maxBuffer: 8 * 1024 * 1024 });
    fs.writeFileSync(path.join(reportDir, mode + '.log'), (run.stdout || '') + (run.stderr || ''));
    const detail = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    const ok = run.status === 0 && detail && detail.complete === true && detail.ok === true && detail.mode === mode;
    report.results.push({ mode, ok, exitCode: run.status, error: run.error && run.error.message, detail });
    console.log(JSON.stringify(report.results[report.results.length - 1]));
  }
  report.complete = true;
} catch (error) { report.error = error.stack; console.error(error); }
report.ok = report.complete && report.results.length === modes.length && report.results.every(row => row.ok);
fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('ELECTRON_REPORT ' + path.relative(root, path.join(reportDir, 'report.json')));
process.exitCode = report.ok ? 0 : 1;
