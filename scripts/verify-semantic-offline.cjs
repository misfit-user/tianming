'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '..');
fs.mkdirSync(path.join(root, '_codex_tmp'), { recursive: true });
const output = fs.mkdtempSync(path.join(root, '_codex_tmp/semantic-offline-'));
const env = { ...process.env, TM_SEMANTIC_OFFLINE_OUTPUT: output };
delete env.ELECTRON_RUN_AS_NODE;
const run = cp.spawnSync(require('electron'), [path.join(__dirname, 'electron/semantic-offline-main.cjs')], {
  cwd: root, env, windowsHide: true, encoding: 'utf8', timeout: 120000, maxBuffer: 1024 * 1024
});
fs.writeFileSync(path.join(output, 'runtime.log'), String(run.stdout || '') + String(run.stderr || ''));
const reportFile = path.join(output, 'report.json');
const report = fs.existsSync(reportFile) ? JSON.parse(fs.readFileSync(reportFile, 'utf8')) : null;
const ok = !run.error && !run.signal && run.status === 0 && report && report.ok === true;
console.log(JSON.stringify({ ok: !!ok, exitCode: run.status, error: run.error && run.error.message, reportFile, report }, null, 2));
process.exitCode = ok ? 0 : 1;
