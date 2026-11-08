'use strict';
// Evidence wrapper only: run the existing strict CI entry without altering it.
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const os = require('os');
const root = path.resolve(__dirname, '../..');
const git = (...args) => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8' });
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const write = (name, value) => fs.writeFileSync(path.join(__dirname, name), JSON.stringify(value, null, 2) + '\n');
function snapshot() {
  const paths = new Set(git('diff', 'HEAD', '--name-only', '-z').split('\0').filter(Boolean));
  git('ls-files', '--others', '--exclude-standard', '-z').split('\0').filter(Boolean).forEach(p => paths.add(p));
  const changedFiles = [...paths].filter(p => /^(?:web\/|scripts\/|\.github\/|package(?:-lock)?\.json$)/.test(p)).sort().map(p => {
    const absolute = path.join(root, p);
    return fs.existsSync(absolute) ? { path: p, bytes: fs.statSync(absolute).size, sha256: sha(fs.readFileSync(absolute)) } : { path: p, deleted: true };
  });
  const head = git('rev-parse', 'HEAD').trim();
  const smokeNames = fs.readdirSync(path.join(root, 'web/scripts')).filter(n => /^smoke-.*\.js$/.test(n)).sort();
  const generatedTestData = ['天启七年·九月（官方）.json', '绍宋·建炎元年八月（官方）.json', '晚唐·开成五年（官方）.json'].map(name => {
    const relative = 'web/bundled-scenarios/' + name, absolute = path.join(root, relative);
    return fs.existsSync(absolute) ? { path: relative, bytes: fs.statSync(absolute).size, sha256: sha(fs.readFileSync(absolute)) } : { path: relative, missing: true };
  });
  return { head, branch: git('branch', '--show-current').trim(), treeSha256: sha(JSON.stringify({ head, changedFiles })), changedFiles, smokeNames, generatedTestData };
}
const before = snapshot();
const startedAt = new Date().toISOString();
write('runtime-tested.json', {
  schemaVersion: 1, startedAt, command: ['node', 'web/scripts/ci-smokes.js', '--jobs', '2'],
  environment: { platform: process.platform, arch: process.arch, node: process.version, osRelease: os.release(), root },
  identityMeaning: 'HEAD plus exact changed/new runtime, test, workflow and package file bytes; unchanged files retain HEAD identity. Documentation is excluded from this runtime tree hash.',
  ...before
});
write('full-smoke-run.json', { status: 'running', complete: false, startedAt, testedHead: before.head, treeSha256: before.treeSha256 });
write('full-smoke-report.json', { status: 'awaiting_existing_ci_runner_report', complete: false, head: before.head, expected: before.smokeNames });
const logFile = path.join(__dirname, 'full-smoke.log');
const log = fs.createWriteStream(logFile);
const child = cp.spawn(process.execPath, ['web/scripts/ci-smokes.js', '--jobs', '2'], { cwd: root, windowsHide: true });
let stdout = '', reportFile = null;
child.stdout.on('data', chunk => {
  log.write(chunk); process.stdout.write(chunk); stdout += chunk;
  if (!reportFile) { const match = stdout.match(/\[ci-smokes\].* report=([^\r\n]+)/); if (match) reportFile = match[1]; }
  if (stdout.length > 32768) stdout = stdout.slice(-16384);
});
child.stderr.on('data', chunk => { log.write(chunk); process.stderr.write(chunk); });
child.on('error', error => { log.write(String(error) + '\n'); process.stderr.write(String(error) + '\n'); });
child.on('close', (code, signal) => {
  log.end();
  const after = snapshot();
  const runtimeUnchanged = before.treeSha256 === after.treeSha256;
  const discoveryUnchanged = JSON.stringify(before.smokeNames) === JSON.stringify(after.smokeNames);
  const generatedTestDataUnchanged = JSON.stringify(before.generatedTestData) === JSON.stringify(after.generatedTestData);
  let report = null;
  if (reportFile && fs.existsSync(reportFile)) {
    report = JSON.parse(fs.readFileSync(reportFile, 'utf8'));
    fs.copyFileSync(reportFile, path.join(__dirname, 'full-smoke-report.json'));
  }
  write('full-smoke-run.json', {
    schemaVersion: 1, startedAt, finishedAt: new Date().toISOString(), exitCode: code, signal,
    command: ['node', 'web/scripts/ci-smokes.js', '--jobs', '2'],
    runtimeUnchanged, discoveryUnchanged, generatedTestDataUnchanged, beforeTreeSha256: before.treeSha256, afterTreeSha256: after.treeSha256,
    testedHead: before.head, reportFile: reportFile ? path.relative(root, reportFile).replaceAll('\\', '/') : null,
    retainedReport: report ? 'docs/npc-stable-candidate-20261021/full-smoke-report.json' : null,
    log: 'docs/npc-stable-candidate-20261021/full-smoke.log',
    reportSummary: report && { summary: report.summary, runId: report.runId, head: report.head }
  });
  write('runtime-after-smoke.json', after);
  process.exitCode = code === 0 && runtimeUnchanged && discoveryUnchanged && generatedTestDataUnchanged ? 0 : 1;
});
