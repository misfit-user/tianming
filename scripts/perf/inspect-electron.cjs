'use strict';
// Interactive Computer Use companion, not a replacement for the fixed paired benchmark.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto');
const root = path.resolve(__dirname, '../..'), args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const repo = path.resolve(arg('--repo', root));
const tempRoot = path.resolve(arg('--temp-root', require('os').tmpdir()));
fs.mkdirSync(tempRoot, { recursive: true });
const temporary = fs.mkdtempSync(path.join(tempRoot, 'tm-perf-inspect-'));
const out = path.join(root, 'web/dev-tools/perf-round1/inspect-' + crypto.randomUUID()); fs.mkdirSync(out, { recursive: true });
const env = { ...process.env, TM_BRIDGE_TEST_ROOT: repo, TM_BRIDGE_TEST_MODE: 'performance-inspect',
  TM_BRIDGE_TEST_REPORT: path.join(out, 'report.json'), TM_BRIDGE_TEST_USERDATA: temporary,
  TM_PERF_INSPECT_SAMPLE: arg('--sample', ''), TM_PERF_INSPECT_TRACE: path.join(out, 'trace.json'),
  TM_PERF_INSPECT_SCENARIO: arg('--scenario', 'sc-jianyan1-1127-shaosong'),
  TM_PERF_INSPECT_CPU: args.includes('--cpu-profile') ? '1' : '' };
delete env.ELECTRON_RUN_AS_NODE; delete env.TIANMING_TEST_EXPORTS;
fs.writeFileSync(path.join(out, 'source.json'), JSON.stringify({ head: cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repo, encoding: 'utf8' }).trim(),
  sourceHashes: Object.fromEntries(['web/tm-storage.js','web/tm-save-lifecycle.js','web/phase8-formal-map.js','web/phase8-formal-drafts.js','web/index.html'].map(p => [p, crypto.createHash('sha256').update(fs.readFileSync(path.join(repo, p))).digest('hex')])) }, null, 2));
console.log('INTERACTIVE_EVIDENCE ' + out);
const child = cp.spawn(require('electron'), [path.join(root, 'scripts/electron/bridge-main.cjs')], { cwd: repo, env, windowsHide: true, stdio: ['ignore','pipe','pipe'] });
for (const [stream, name] of [[child.stdout,'stdout.log'],[child.stderr,'stderr.log']]) stream.pipe(fs.createWriteStream(path.join(out, name)));
child.on('error', error => { console.error(error); process.exitCode = 1; });
child.on('exit', code => { console.log('INTERACTIVE_EXIT ' + code); process.exitCode = code === 0 ? 0 : 1; });
