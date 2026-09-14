'use strict';
// A mandatory real-runtime gate: no mock bridge and no missing-runtime waiver.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const argv = process.argv.slice(2);
const repo = argv.includes('--repo') ? path.resolve(argv[argv.indexOf('--repo') + 1]) : root;
const reportDir = path.join(root, 'web/dev-tools/electron-bridge', crypto.randomUUID());
fs.mkdirSync(reportDir, { recursive: true });
const temporary = fs.mkdtempSync(path.join(require('os').tmpdir(), 'tm-bridge-series-'));
const modes = argv.includes('--player-feedback') ? ['player-feedback'] : argv.includes('--workshop-hierarchy') ? ['workshop-hierarchy'] : argv.includes('--authoring-continuation') ? ['authoring-continuation'] : argv.includes('--memorial-reading') ? ['memorial-reading'] : argv.includes('--authoring-efficiency') ? ['authoring-efficiency'] : argv.includes('--authoring-recovery') ? ['authoring-recovery'] : argv.includes('--authoring-boundaries') ? ['authoring-boundaries'] : argv.includes('--authoring-stream') ? ['authoring-stream'] : argv.includes('--rail-badges') ? ['rail-badges'] : argv.includes('--character-actions') ? ['character-actions'] : argv.includes('--edict-clarity') ? ['edict-clarity'] : argv.includes('--relief-inspect') || argv.includes('--relief-inspect-small') ? ['relief-inspect'] : argv.includes('--relief-pilot') ? ['relief-pilot'] : argv.includes('--authoring-regions') ? ['authoring-regions'] : argv.includes('--edict-polish') ? ['edict-polish'] : argv.includes('--building-appraisal') ? ['building-appraisal'] : argv.includes('--baseline') ? ['production', 'test-exports'] : ['production', 'test-exports', 'restart'];
const report = { runId: path.basename(reportDir), repo, head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  status: cp.execFileSync('git', ['status', '--short'], { cwd: repo, encoding: 'utf8' }).trim(), platform: process.platform, node: process.version,
  baseline: argv.includes('--baseline'), complete: false, results: [] };
try {
  if (argv.includes('--authoring-autoapply')) modes.splice(0, modes.length, 'authoring-autoapply');
  if (argv.includes('--seven-ui')) modes.splice(0, modes.length, 'seven-ui');
  if (argv.includes('--office-writeback')) modes.splice(0, modes.length, 'office-writeback');
  if (argv.includes('--startup-autosave')) modes.splice(0, modes.length, 'startup-autosave');
  if (argv.includes('--personal-campaign')) modes.splice(0, modes.length, 'personal-campaign');
  if (argv.includes('--tactical-terrain')) modes.splice(0, modes.length, 'tactical-terrain');
  if (argv.includes('--tactical-phase2')) modes.splice(0, modes.length, 'tactical-phase2');
  if (argv.includes('--tactical-units')) modes.splice(0, modes.length, 'tactical-units');
  const runtime = require('electron');
  if (!fs.existsSync(runtime)) throw new Error('electron-runtime-missing: run node node_modules/electron/install.js after npm ci --ignore-scripts');
  for (const mode of modes) {
    const file = path.join(reportDir, mode + '.json');
    const userData = path.join(temporary, mode === 'test-exports' ? 'exports' : 'production');
    fs.mkdirSync(userData, { recursive: true });
    const env = { ...process.env, TM_BRIDGE_TEST_ROOT: repo, TM_BRIDGE_TEST_REPORT: file, TM_BRIDGE_TEST_MODE: mode, TM_BRIDGE_TEST_BASELINE: report.baseline ? '1' : '0', TM_BRIDGE_TEST_USERDATA: userData };
    delete env.ELECTRON_RUN_AS_NODE;
    delete env.TIANMING_TEST_EXPORTS;
    if (argv.includes('--trace-gpu')) env.TM_BRIDGE_TACTICAL_TRACE = '1';
    if (argv.includes('--foreground')) env.TM_BRIDGE_TACTICAL_FOREGROUND = '1';
    if (argv.includes('--profile-tactical')) env.TM_BRIDGE_TACTICAL_PROFILE = '1';
    if (argv.includes('--scenario')) env.TM_RELIEF_SCENARIO = argv[argv.indexOf('--scenario') + 1];
    if (argv.includes('--relief-inspect-small')) env.TM_RELIEF_SMALL_FIXTURE = '1';
    // Full ES-driver stress is distinct from Chromium's ordinary software WebGL fallback.
    const electronArgs = argv.includes('--software-gpu') ? ['--use-gl=angle', '--use-angle=swiftshader'] : argv.includes('--software-webgl') ? ['--disable-gpu'] : [];
    const run = cp.spawnSync(runtime, [...electronArgs, path.join(__dirname, 'electron/bridge-main.cjs')], { cwd: repo, env, encoding: 'utf8', windowsHide: true, timeout: mode === 'relief-inspect' ? 1860000 : mode === 'relief-pilot' ? 210000 : 90000, maxBuffer: 8 * 1024 * 1024 });
    fs.writeFileSync(path.join(reportDir, mode + '.log'), (run.stdout || '') + (run.stderr || ''));
    const detail = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
    const ok = !run.error && !run.signal && run.status === 0 && detail && detail.complete === true && detail.ok === true && detail.mode === mode;
    report.results.push({ mode, ok, exitCode: run.status, signal: run.signal || null, error: run.error && run.error.message, detail });
    console.log(JSON.stringify(report.results[report.results.length - 1]));
  }
  report.complete = true;
} catch (error) { report.error = error.stack; console.error(error); }
report.ok = report.complete && report.results.length === modes.length && report.results.every(row => row.ok);
fs.writeFileSync(path.join(reportDir, 'report.json'), JSON.stringify(report, null, 2) + '\n');
console.log('ELECTRON_REPORT ' + path.relative(root, path.join(reportDir, 'report.json')));
process.exitCode = report.ok ? 0 : 1;
