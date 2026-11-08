'use strict';
// Local targeted/static evidence only. Run after the separate Electron gate is idle:
// node docs/npc-stable-candidate-20261021/run-final-gates.cjs --run --expected-head <full SHA>
// Optional: --temp-root E:\tianming-npc-candidate-temp (default remains D:).
// With no --run, print the plan without creating files or running any gate.
const fs = require('node:fs'), path = require('node:path'), cp = require('node:child_process');
const crypto = require('node:crypto'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const branch = 'codex/npc-composite-r123-20261011';
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true });
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const rel = file => path.relative(root, file).replaceAll('\\', '/');
const arg = name => { const i = process.argv.indexOf(name); return i < 0 ? '' : process.argv[i + 1]; };
const tempRootArg = arg('--temp-root');
if (process.argv.includes('--temp-root') && (!tempRootArg || tempRootArg.startsWith('--'))) throw Error('--temp-root requires a path');
const tempRoot = path.resolve(tempRootArg || 'D:\\tianming-npc-candidate-temp');
const smokeNames = [
  'ai-atomic-snapshot-contract', 'calendar-contract',
  'security-trust-boundary', 'security-ipc-hardening',
  'autosave-text-bridge', 'desktop-autosave-reliability', 'desktop-save-async-load',
  'preload-ipc-disposers', 'preload-online-request-limit', 'startup-autosave-opt-in',
  'npc-action-entrypoints', 'npc-action-logic', 'npc-action-loop', 'npc-ai-routing',
  'npc-composite-diagnostics', 'npc-composite-model-fixture', 'npc-composite-official', 'npc-composite-waits', 'npc-daily-activities',
  'npc-daily-boundaries', 'npc-daily-lifecycle', 'npc-entry-feature-barrier', 'npc-life-opportunities', 'npc-local-ai',
  'npc-meeting-events-boundaries', 'npc-meeting-events', 'npc-meeting-office', 'npc-travel',
  'office-duty-accounting', 'office-duty-evidence', 'office-duty-integration',
  'office-duty-local', 'office-duty-reliability', 'office-holder-stable-identities', 'office-tenure',
  'public-treasury-a3', 'public-treasury-custody', 'public-treasury-scale', 'treasury-account-books',
  'runtime-save-consistency', 'save-codec-deadlines', 'save-commit-boundary', 'save-export-parts',
  'save-finite-validation', 'save-integrity-audit', 'save-load-guard', 'save-map-aliases',
  'save-project-text-bridge', 'save-saved-clone', 'save-slim',
  'full-turn-flow', 'turn-response-recovery', 'recovery-vault', 'recovery-settings-restore', 'round19-cross-system-rollback',
  'territory-batch-resolution', 'storage-atomic-batch', 'final-save-reconcile', 'turn-capture-work-count',
  'endturn-transaction-failures', 'postturn-court-deferred-finalize', 'emergency-recovery-review',
  'round20-performance-isolation', 'desktop-autosave-committed-world', 'postturn-critical-failures',
  'start-game-data-integrity', 'perf-canonical-utf8'
].map(name => 'smoke-' + name + '.js').sort();
const runId = crypto.randomUUID(), startedAt = new Date().toISOString();
const outDir = path.join(__dirname, 'final-gates', startedAt.replace(/[:.]/g, '-') + '-' + runId);
const smokeReport = path.join(outDir, 'targeted-smoke-report.json');
const officialDir = path.join(outDir, 'other-officials');
const version = JSON.parse(fs.readFileSync(path.join(root, 'web/version.json'), 'utf8')).version;
const commands = [
  { id: 'targeted-smokes', args: ['web/scripts/run-smokes.js', '--all', '--no-retry', '--jobs', '1',
    '--run-id', runId, '--report', smokeReport, ...smokeNames.flatMap(name => ['--grep', name])] },
  { id: 'other-officials', args: ['docs/npc-stable-candidate-20261021/check-other-officials.cjs', '--output-dir', officialDir] },
  { id: 'architecture', args: ['web/scripts/lint-arch-all.js'] },
  { id: 'official-parity', args: ['web/scripts/verify-official-scenario-parity.js'] },
  { id: 'native-manifest', args: ['scripts/build-native-preparation-manifest.cjs', '--check'] },
  { id: 'startup-manifest', args: ['web/scripts/build-startup-phase-manifest.js', '--check'] },
  { id: 'release-contract', args: ['scripts/verify-release-contract.js'] },
  { id: 'hot-baseline', args: ['scripts/sync-hot-baseline.js', '--check', '--version', version, '--temp-root', tempRoot] }
];
const envOverrides = { TMP: tempRoot, TEMP: tempRoot, TMPDIR: tempRoot, TIANMING_RELEASE_TEMP_ROOT: tempRoot };
const scope = 'Fresh local targeted regressions and static contracts only. No Electron, full smoke total, package, version change, deployment or overall milestone acceptance.';
function fileRow(file) {
  const absolute = path.join(root, file);
  if (!fs.existsSync(absolute)) return { file, missing: true };
  const bytes = fs.readFileSync(absolute);
  return { file, bytes: bytes.length, sha256: sha(bytes) };
}
function snapshot() {
  const tracked = git('ls-files', '-z').split('\0').filter(Boolean);
  const changed = git('diff', 'HEAD', '--name-only', '-z').split('\0').filter(Boolean);
  const untracked = git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean);
  const source = file => !file.startsWith('docs/') && !file.startsWith('web/dev-tools/');
  const inputs = new Set(tracked.filter(file => source(file) && /\.(?:[cm]?js|json|html|css|ya?ml)$/.test(file)));
  [...changed, ...untracked].filter(source).forEach(file => inputs.add(file));
  [rel(__filename), ...commands.map(command => command.args[0])].forEach(file => inputs.add(file));
  for (const name of fs.readdirSync(path.join(root, 'web/bundled-scenarios'))) {
    if (name.endsWith('（官方）.json')) inputs.add('web/bundled-scenarios/' + name);
  }
  const identity = { head: git('rev-parse', 'HEAD').trim(), branch: git('branch', '--show-current').trim(),
    changedSourcePaths: [...new Set([...changed, ...untracked].filter(source))].sort(),
    files: [...inputs].sort().map(fileRow) };
  return { ...identity, sha256: sha(JSON.stringify(identity)) };
}
function checkTargeted(report, head, runnerExit) {
  const { validateReport } = require(path.join(root, 'web/scripts/lib-smoke-evidence.js'));
  const result = validateReport(report, { runId, head, tests: smokeNames, runnerExit });
  assert.equal(result.waived, 0, 'targeted regressions cannot use waivers');
  assert(report.results.every(row => !row.flaky && row.waivers.length === 0), 'no retries or waivers');
  const output = name => report.results.find(row => row.name === 'smoke-' + name + '.js').output;
  function suite(name, expectedSuite, expectedPassed) {
    const rows = output(name).split(/\r?\n/).flatMap(line => { try { return [JSON.parse(line)]; } catch (_) { return []; } });
    const summary = rows.find(row => row.suite === expectedSuite);
    assert(summary, name + ': missing suite summary');
    assert.equal(summary.passed, expectedPassed, name + ': group count'); assert.equal(summary.failed, 0);
  }
  suite('npc-meeting-office', 'npc-meeting-office', 21);
  suite('npc-meeting-events-boundaries', 'meeting-event-boundaries', 15);
  assert.match(output('npc-meeting-events'), /^PASS npc-meeting-events 6 groups\r?$/m);
  return result;
}
function main() {
  assert.equal(new Set(smokeNames).size, smokeNames.length);
  [...commands.map(command => command.args[0]), ...smokeNames.map(name => 'web/scripts/' + name)]
    .forEach(file => assert(fs.existsSync(path.join(root, file)), 'missing entry: ' + file));
  if (!process.argv.includes('--run')) {
    console.log(JSON.stringify({ scope, root, branch, tempRoot, smokeNames, commands, runRequires: '--run --expected-head <full SHA>' }, null, 2));
    return;
  }
  const expectedHead = arg('--expected-head');
  assert.match(expectedHead || '', /^[0-9a-f]{40}$/, 'provide the authorized full candidate SHA');
  assert.equal(root.toLowerCase(), 'c:\\users\\37814\\.codex\\worktrees\\npc-composite-r123-20261011');
  assert.equal(git('branch', '--show-current').trim(), branch, 'wrong candidate branch');
  assert.equal(git('rev-parse', 'HEAD').trim(), expectedHead, 'candidate HEAD changed');
  fs.mkdirSync(outDir, { recursive: true }); fs.mkdirSync(tempRoot, { recursive: true });
  const reportFile = path.join(outDir, 'final-gates.json');
  const report = { schemaVersion: 1, runId, scope, status: 'running', complete: false, startedAt,
    command: [process.execPath, ...process.argv.slice(1)], expectedHead,
    environment: { node: process.version, platform: process.platform, arch: process.arch, root,
      overrides: envOverrides, inheritedNodeOptions: process.env.NODE_OPTIONS || null },
    policy: { smokeTimeoutMs: 120000, smokeTimeoutOwner: 'unchanged web/scripts/run-smokes.js default',
      otherOfficialTimeoutMsPerCase: 150000, retries: 0, allowedWaivers: 0, sequential: true },
    externalEvidence: { formalElectronM3: 'separate evidence required', fullSmoke: 'separate actual remote CI evidence required; no prior totals imported' },
    commands, before: snapshot(), results: [], validationErrors: [] };
  const save = () => fs.writeFileSync(reportFile, JSON.stringify(report, null, 2) + '\n');
  save();
  try {
    for (const command of commands) {
      assert.equal(git('rev-parse', 'HEAD').trim(), expectedHead, 'HEAD changed during run');
      const logPath = path.join(outDir, command.id + '.log'), fd = fs.openSync(logPath, 'wx');
      const start = new Date().toISOString(), clock = process.hrtime.bigint();
      console.log('[final-gates] START ' + command.id);
      let child;
      try { child = cp.spawnSync(process.execPath, command.args, { cwd: root, env: { ...process.env, ...envOverrides },
        windowsHide: true, stdio: ['ignore', fd, fd] }); } finally { fs.closeSync(fd); }
      const log = fs.readFileSync(logPath), text = log.toString('utf8');
      const result = { id: command.id, command: [process.execPath, ...command.args], cwd: root,
        startedAt: start, finishedAt: new Date().toISOString(), elapsedMs: Number(process.hrtime.bigint() - clock) / 1e6,
        exit: child.status, signal: child.signal, spawnError: child.error ? String(child.error) : null,
        pass: child.status === 0 && !child.signal && !child.error && !/^\s*FAIL\b/m.test(text),
        log: rel(logPath), logSha256: sha(log), entry: fileRow(command.args[0]) };
      report.results.push(result);
      if (command.id === 'targeted-smokes' && fs.existsSync(smokeReport)) {
        const targeted = JSON.parse(fs.readFileSync(smokeReport, 'utf8'));
        report.targeted = { report: rel(smokeReport), sha256: sha(fs.readFileSync(smokeReport)),
          results: targeted.results.map(row => ({ ...row, output: undefined,
            command: [process.execPath, path.join(root, 'web/scripts', row.name)],
            cwd: path.join(root, 'web/scripts'), entry: fileRow('web/scripts/' + row.name) })) };
        try { report.targeted.validated = checkTargeted(targeted, expectedHead, child.status); }
        catch (error) { result.pass = false; report.validationErrors.push(String(error)); }
      } else if (command.id === 'targeted-smokes') {
        result.pass = false; report.validationErrors.push('targeted smoke report missing');
      }
      save(); console.log('[final-gates] ' + (result.pass ? 'PASS ' : 'FAIL ') + command.id + ' ' + Math.round(result.elapsedMs) + 'ms');
    }
  } catch (error) { report.validationErrors.push(error.stack || String(error)); }
  finally {
    try { report.after = snapshot(); report.sourceUnchanged = report.before.sha256 === report.after.sha256; }
    catch (error) { report.sourceUnchanged = false; report.validationErrors.push(String(error)); }
    report.finishedAt = new Date().toISOString(); report.elapsedMs = Date.parse(report.finishedAt) - Date.parse(startedAt);
    report.complete = report.results.length === commands.length;
    report.status = report.complete && report.sourceUnchanged && report.validationErrors.length === 0 && report.results.every(row => row.pass) ? 'passed' : 'failed';
    save(); console.log('[final-gates] ' + report.status.toUpperCase() + ' ' + reportFile);
    process.exitCode = report.status === 'passed' ? 0 : 1;
  }
}
if (require.main === module) { try { main(); } catch (error) { console.error(error.stack || error); process.exitCode = 1; } }
