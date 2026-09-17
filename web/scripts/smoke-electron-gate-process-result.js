#!/usr/bin/env node
'use strict';
// Execute the actual gate CLI against controlled process/filesystem adapters.
// No Electron or game implementation is replaced in the real-runtime suite.
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm'), cp = require('child_process');
const root = path.resolve(__dirname, '../..'), refAt = process.argv.indexOf('--source-ref'), ref = refAt < 0 ? null : process.argv[refAt + 1];
const source = ref ? cp.execFileSync('git', ['show', ref + ':scripts/verify-electron-bridge.js'], { cwd: root, encoding: 'utf8' }) : fs.readFileSync(path.join(root, 'scripts/verify-electron-bridge.js'), 'utf8');
function run(options = {}) {
  const files = new Map(), runtime = path.join(root, 'virtual-electron'), proc = { argv: ['node', 'gate', '--authoring-boundaries'], env: {}, platform: process.platform, version: process.version };
  const virtualFs = { mkdirSync() {}, mkdtempSync: p => p + 'isolated', existsSync: p => p === runtime ? !options.missingRuntime : files.has(p), readFileSync: p => files.get(p), writeFileSync: (p, data) => files.set(p, data) };
  const child = { execFileSync: () => 'test-head', spawnSync: (_file, _args, opts) => {
    if (!options.noReport) files.set(opts.env.TM_BRIDGE_TEST_REPORT, JSON.stringify({ complete: true, ok: true, mode: opts.env.TM_BRIDGE_TEST_MODE, ...options.detail }));
    return { status: 0, stdout: '', stderr: '', ...options.process };
  } };
  const c = { __dirname: path.join(root, 'scripts'), process: proc, console: { log() {}, error() {} },
    require: name => name === 'fs' ? virtualFs : name === 'child_process' ? child : name === 'electron' ? runtime : require(name) };
  vm.runInNewContext(source, c, { filename: 'actual-verify-electron-bridge.js' });
  const report = [...files.entries()].find(([p]) => path.basename(p) === 'report.json');
  return { code: proc.exitCode, report: JSON.parse(report[1]) };
}
let pass = 0, fail = 0;
for (const [name, options, expected] of [
  ['healthy process and complete current-mode report pass', {}, 0],
  ['timeout cannot pass even when status is zero and report is complete', { process: { error: new Error('ETIMEDOUT') } }, 1],
  ['signal cannot pass even when status is zero and report is complete', { process: { signal: 'SIGTERM' } }, 1],
  ['nonzero exit with passing report fails', { process: { status: 1 } }, 1],
  ['missing report fails', { noReport: true }, 1],
  ['incomplete report fails', { detail: { complete: false } }, 1],
  ['failed business report fails', { detail: { ok: false } }, 1],
  ['another mode report fails', { detail: { mode: 'wrong-mode' } }, 1],
  ['missing runtime fails', { missingRuntime: true }, 1]
]) {
  try { const r = run(options); assert.equal(r.code, expected); assert.equal(r.report.ok, expected === 0); pass++; console.log('PASS ' + name); }
  catch (e) { fail++; console.error('FAIL ' + name + '\n' + e.stack); }
}
console.log(JSON.stringify({ pass, fail, skip: 0, waived: 0, sourceRef: ref || 'worktree' })); process.exitCode = fail ? 1 : 0;
