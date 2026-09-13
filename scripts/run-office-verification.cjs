'use strict';
// Isolated E-drive test data and immutable command receipts; no player configuration.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process'), crypto = require('node:crypto');
const root = path.resolve(__dirname, '..'), [label, script, ...args] = process.argv.slice(2);
if (!/^[a-z0-9-]{1,70}$/.test(label || '') || !script) throw Error('A bounded label and script are required');
const base = path.join(root, 'web/dev-tools/office-writeback'); fs.mkdirSync(base, { recursive: true });
const dir = path.join(base, label + '-' + crypto.randomUUID()); fs.mkdirSync(dir);
// Keep temporary fixture roots short and outside web: path-boundary tests must
// really exercise an untrusted location, and Python/Windows still has MAX_PATH consumers.
const tempBase = path.join(root, '_codex_tmp'); fs.mkdirSync(tempBase, { recursive: true });
const temp = fs.mkdtempSync(path.join(tempBase, 'ov-'));
const started = Date.now();
const run = cp.spawnSync(process.execPath, [script, ...args], { cwd: root, env: { ...process.env, TEMP: temp, TMP: temp }, encoding: 'utf8', windowsHide: true, timeout: 1200000, maxBuffer: 24 * 1024 * 1024 });
fs.writeFileSync(path.join(dir, 'output.log'), (run.stdout || '') + (run.stderr || ''));
fs.writeFileSync(path.join(dir, 'result.json'), JSON.stringify({ head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  command: [process.execPath, script, ...args], temporaryRoot: temp, at: new Date(started).toISOString(), elapsedMs: Date.now() - started,
  exitCode: run.status, signal: run.signal, error: run.error && run.error.message }, null, 2));
console.log(run.stdout || ''); console.error(run.stderr || ''); console.log('RECEIPT ' + path.relative(root, dir));
process.exitCode = run.status === 0 && !run.error && !run.signal ? 0 : 1;
