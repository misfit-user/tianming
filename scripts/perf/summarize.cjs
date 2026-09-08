'use strict';
// Offline evidence assembly; no game data, production writes, or network access.
const fs = require('fs'), path = require('path'), os = require('os'), crypto = require('crypto'), assert = require('assert/strict');
const root = path.resolve(__dirname, '../..'), args = process.argv.slice(2);
const arg = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback;
const electronPath = path.resolve(arg('--electron', 'missing-electron-report.json'));
const microPath = path.resolve(arg('--micro', 'web/dev-tools/perf-round1/microbench-final.json'));
const read = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const sha = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const electron = read(electronPath), micro = read(microPath);
assert(electron.ok && electron.complete && micro.complete, 'complete successful measurements required');
for (const run of electron.results) {
  assert.deepEqual(run.sourceHashes, run.side === 'before' ? micro.baseline.sourceHashes : micro.candidate.sourceHashes,
    'Electron and microbench must measure the same production bytes');
}
function dist(values) {
  const a = values.filter(Number.isFinite).sort((x, y) => x - y);
  return a.length ? { n: a.length, min: a[0], p50: a[Math.floor(a.length / 2)], p95: a[Math.ceil(a.length * .95) - 1], max: a[a.length - 1] } : { n: 0 };
}
const sum = a => a.reduce((n, v) => n + v, 0), max = a => a.length ? Math.max(...a) : 0;
function sanitize(value, key) {
  if (key === 'temporaryUserData') return '<isolated-user-data>';
  if (typeof value === 'string') return value.replaceAll(os.homedir().replace(/\\/g, '\\\\'), '<user-profile>').replaceAll(os.homedir(), '<user-profile>').replaceAll(os.homedir().replace(/\\/g, '/'), '<user-profile>');
  if (Array.isArray(value)) return value.map(v => sanitize(v));
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, sanitize(v, k)]));
  return value;
}
const groups = {}, sampleHashes = {};
for (const run of electron.results) for (const row of run.detail.performance.samples) {
  const name = row.name.replace(/-[0-2]$/, '');
  ((groups[name] ||= { before: [], after: [] })[run.side]).push(row);
  if (row.value?.sampleSha256) (sampleHashes[name] ||= new Set()).add(row.value.sampleSha256);
}
for (const hashes of Object.values(sampleHashes)) assert.equal(hashes.size, 1, 'all launches must load identical public sample bytes');
function summarizeRows(rows) {
  const values = fn => dist(rows.map(fn));
  return {
    wallMs: values(r => r.wallMs),
    stringifyMs: values(r => sum(r.renderer.timings['JSON.stringify'] || [])),
    utf8Ms: values(r => sum(r.renderer.timings['UTF8.encode'] || [])),
    utf8Calls: values(r => r.renderer.calls['UTF8.encode'] || 0),
    snapshotMs: values(r => sum(r.renderer.timings._buildSaveState || [])),
    preparationMs: values(r => sum(r.renderer.timings._prepareGMForSave || [])),
    defaultsMs: values(r => sum(r.renderer.timings._ensureGMDefaults || []) + sum(r.renderer.timings._ensurePDefaults || [])),
    compressionWallMs: values(r => r.renderer.perf['save.compress']?.sum),
    checksumWallMs: values(r => r.renderer.perf['save.checksum']?.sum),
    mainStringifyTotalMs: values(r => sum(r.mainIo.filter(x => x.operation === 'JSON.stringify').map(x => x.ms))),
    mainStringifyMaxMs: values(r => max(r.mainIo.filter(x => x.operation === 'JSON.stringify').map(x => x.ms))),
    mainFileOperationsMs: Object.fromEntries(['writeFileSync', 'fsyncSync', 'renameSync'].map(name => [name, values(r => sum(r.mainIo.filter(x => x.operation === name).map(x => x.ms)))])),
    mainEventLoopMaxMs: values(r => r.mainLoopDelay.maxMs),
    mainSampledRssPeakBytes: values(r => r.mainRssSampledPeakBytes),
    rendererHeapBytes: values(r => r.metricsAfter.JSHeapUsedSize),
    rendererTaskMs: values(r => (r.metricsAfter.TaskDuration - r.metricsBefore.TaskDuration) * 1000),
    rendererLayoutMs: values(r => (r.metricsAfter.LayoutDuration - r.metricsBefore.LayoutDuration) * 1000),
    rendererLayoutCount: values(r => r.metricsAfter.LayoutCount - r.metricsBefore.LayoutCount),
    domNodeDelta: values(r => r.metricsAfter.Nodes - r.metricsBefore.Nodes),
    gcInnerHtmlRebuilds: values(r => r.renderer.rebuilds.gc || 0),
    longTaskCount: values(r => r.renderer.longTasks.length),
    longTaskMaxMs: values(r => max(r.renderer.longTasks.map(t => t.duration))),
    longTaskDurationsMs: dist(rows.flatMap(r => r.renderer.longTasks.map(t => t.duration))),
    rafIntervalsMs: dist(rows.flatMap(r => r.renderer.frames)),
    syntheticInputNextFrameMs: values(r => r.value?.inputToNextFrameMs)
  };
}
const summary = {
  measuredCode: { baseline: micro.baseline, candidate: micro.candidate },
  method: electron.repeats + ' alternating before/after Electron process pairs; 3 snapshot/canonical/map repetitions per process. Other operations n=' + electron.repeats + ' per side. Module microbench: ' + micro.warmupsPerVariant + ' warmups + ' + micro.repeats + ' alternating measurements per side. Small samples: p95 is descriptive, not a confident tail estimate.',
  environment: { cpu: electron.cpu, logicalCpus: electron.logicalCpus, memoryBytes: electron.totalMemoryBytes, node: electron.node, platform: electron.platform, window: electron.window, versions: electron.results[0].detail.versions },
  sampleHashes: Object.fromEntries(Object.entries(sampleHashes).map(([k, v]) => [k, [...v][0]])),
  startup: Object.fromEntries(['before', 'after'].map(side => [side, electron.results.filter(r => r.side === side).map(r => ({ iteration: r.iteration, navigation: r.detail.performance.startup.navigation }))])),
  endOfRunRendererMemoryKiB: Object.fromEntries(['before', 'after'].map(side => [side, electron.results.filter(r => r.side === side).map(r => ({ iteration: r.iteration, ...r.detail.performance.rendererProcessMemory }))])),
  microbench: micro.samples.map(r => ({ name: r.name, before: r.summary.before, after: r.summary.after, metadata: Object.fromEntries(Object.entries(r).filter(([k]) => !['before', 'after', 'summary'].includes(k))) })),
  electron: Object.fromEntries(Object.entries(groups).map(([name, rows]) => [name, { before: summarizeRows(rows.before), after: summarizeRows(rows.after) }])),
  notMeasured: [...electron.notMeasured, 'pure IPC transport vs structured-clone cost in isolation', 'continuous paint/GPU or GC pause attribution', 'visible/hidden subtree classification for every rebuild (avoids instrumentation-induced layout)', 'full ignored artwork/audio decode: these assets are absent in the isolated checkout'],
  rawSources: { microbench: { file: path.relative(root, microPath), sha256: sha(microPath) }, electron: { file: path.relative(root, electronPath), sha256: sha(electronPath) } }
};
const out = path.join(root, 'docs/performance-round1'); fs.mkdirSync(out, { recursive: true });
for (const [name, value] of [['summary.json', summary], ['microbench-raw.json', micro], ['electron-raw.json', electron]]) fs.writeFileSync(path.join(out, name), JSON.stringify(sanitize(value), null, 2) + '\n');
const evidenceRoot = path.join(root, 'web/dev-tools/perf-round1');
const exportedLogs = {};
const executions = fs.readdirSync(evidenceRoot, { withFileTypes: true }).filter(e => e.isDirectory() && fs.existsSync(path.join(evidenceRoot, e.name, 'run.json'))).map(e => {
  const dir = path.join(evidenceRoot, e.name), run = read(path.join(dir, 'run.json'));
  exportedLogs[e.name] = {};
  return { ...run, evidenceDirectory: path.relative(root, dir), logs: Object.fromEntries(['stdout.log', 'stderr.log'].map(name => {
    const source = path.join(dir, name), exportedText = sanitize(fs.readFileSync(source, 'utf8'));
    exportedLogs[e.name][name] = exportedText;
    return [name, { sha256: sha(source), bytes: fs.statSync(source).size, exported: 'logs.json', key: [e.name, name], exportedTextSha256: crypto.createHash('sha256').update(exportedText).digest('hex') }];
  })) };
}).sort((a, b) => a.startedAt.localeCompare(b.startedAt));
fs.writeFileSync(path.join(out, 'execution-index.json'), JSON.stringify(sanitize(executions), null, 2) + '\n');
// JSON preserves original newlines/trailing whitespace without making them source-code diff errors.
fs.writeFileSync(path.join(out, 'logs.json'), JSON.stringify(exportedLogs, null, 2) + '\n');
const additionalEvidence = {};
for (const [flag, name] of [['--smoke', 'smoke-final.json'], ['--bridge', 'electron-bridge-final.json']]) {
  if (!arg(flag)) continue;
  const source = path.resolve(arg(flag)), value = read(source);
  assert.equal(value.complete, true, name + ' must be complete');
  if (flag === '--smoke') {
    assert.equal(value.summary.fail, 0);
    assert.equal(value.results.length, value.expected.length);
    assert.equal(new Set(value.results.map(row => row.name)).size, value.expected.length);
    assert.deepEqual(value.results.map(row => row.name).sort(), value.expected.slice().sort());
  } else assert.equal(value.ok, true);
  fs.writeFileSync(path.join(out, name), JSON.stringify(sanitize(value), null, 2) + '\n');
  additionalEvidence[name] = { source: path.relative(root, source), sourceSha256: sha(source), exportedSha256: sha(path.join(out, name)) };
}
if (arg('--inspect')) {
  const dir = path.resolve(arg('--inspect'));
  for (const name of ['trace.json', 'source.json', 'report.json']) {
    const source = path.join(dir, name), exported = path.join(out, 'computer-use-' + name);
    fs.writeFileSync(exported, JSON.stringify(sanitize(read(source)), null, 2) + '\n');
    additionalEvidence[path.basename(exported)] = { source: path.relative(root, source), sourceSha256: sha(source), exportedSha256: sha(exported) };
  }
}
fs.writeFileSync(path.join(out, 'additional-evidence.json'), JSON.stringify(sanitize(additionalEvidence), null, 2) + '\n');
console.log('PERF_EVIDENCE ' + out + ' runs=' + executions.length + ' operationGroups=' + Object.keys(groups).length);
