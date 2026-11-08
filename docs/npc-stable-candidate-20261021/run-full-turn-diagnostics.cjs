'use strict';
const fs = require('fs'), path = require('path'), cp = require('child_process');
const root = path.resolve(__dirname, '../..');
const baseline = 'e6d5a592fc258f3328fd810c91b61ed0a24599cf';
const head = cp.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
// Fetch once in the parent, before either original 120-second child deadline starts.
const prefetchStart = Date.now();
const changed = cp.execFileSync('git', ['diff', '--name-only', '-z', baseline, 'HEAD', '--', 'web', 'package.json', 'package-lock.json'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
const cachedFiles = changed.map(file => {
  const result = cp.spawnSync('git', ['show', baseline + ':' + file], { cwd: root, maxBuffer: 64 * 1024 * 1024, windowsHide: true });
  return { path: file, base64: result.status === 0 ? result.stdout.toString('base64') : null };
});
const cachePath = path.join(root, 'web/dev-tools/arch-guard/full-turn-baseline-cache-e6d5a592.json');
const prefetchMs = Date.now() - prefetchStart;
fs.writeFileSync(cachePath, JSON.stringify({ baseline, prefetchMs, files: cachedFiles }));
const results = [];
for (const label of ['current', 'baseline']) {
  const trace = path.join(__dirname, 'full-turn-trace-' + label + '.jsonl');
  fs.writeFileSync(trace, '');
  const startedAt = new Date().toISOString(), start = Date.now();
  const args = ['--require', path.join(__dirname, 'trace-full-turn-preload.cjs'), path.join(root, 'web/scripts/smoke-full-turn-flow.js')];
  const result = cp.spawnSync(process.execPath, args, {
    cwd: path.join(root, 'web/scripts'), encoding: 'utf8', maxBuffer: 4 * 1024 * 1024,
    timeout: 120000, windowsHide: true,
    env: { ...process.env, TM_FULL_TURN_TRACE: trace, TM_FULL_TURN_BASELINE: label === 'baseline' ? baseline : '', TM_FULL_TURN_BASELINE_CACHE: cachePath }
  });
  const output = (result.stdout || '') + (result.stderr || '');
  fs.writeFileSync(path.join(__dirname, 'full-turn-output-' + label + '.log'), output);
  const rows = fs.readFileSync(trace, 'utf8').split(/\r?\n/).filter(Boolean).map(line => JSON.parse(line));
  const record = { label, head: label === 'baseline' ? baseline : head, startedAt, ms: Date.now() - start,
    exit: result.status, signal: result.signal, error: result.error && result.error.message,
    trace: path.basename(trace), output: 'full-turn-output-' + label + '.log', lastEvents: rows.slice(-10),
    slowVmCalls: rows.filter(r => r.event === 'vm_return' && r.elapsedMs >= 100).map(r => ({ stage: r.stage, ms: r.elapsedMs, at: r.ms })) };
  results.push(record);
  console.log(JSON.stringify({ label, ms: record.ms, exit: record.exit, signal: record.signal, lastEvent: rows.at(-1) }, null, 2));
  fs.writeFileSync(path.join(__dirname, 'full-turn-baseline-comparison.json'), JSON.stringify({
    currentHead: head, baseline, prefetchMsOutsideChild: prefetchMs, command: 'node --require docs/.../trace-full-turn-preload.cjs web/scripts/smoke-full-turn-flow.js',
    hardTimeoutMs: 120000, assertionsAndTestSourceUnchanged: true,
    methodology: 'External VM timing, periodic state observation and call-through save observers. Git blobs are prefetched by the parent outside both 120-second child deadlines; baseline child only reads cached changed web/package bytes. No working-tree runtime file is replaced. This is diagnostic evidence, not a replacement CI gate.',
    results
  }, null, 2) + '\n');
}
