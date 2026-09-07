'use strict';
// Review-only evidence collection. Never deploys or changes application data.
const fs = require('fs'), path = require('path'), cp = require('child_process'), crypto = require('crypto'), os = require('os');
const root = path.resolve(__dirname, '../..');
const sha = data => crypto.createHash('sha256').update(data).digest('hex');
const git = args => cp.execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, maxBuffer: 8 * 1024 * 1024 });
function sanitize(text) {
  // Render logs with portable whitespace; original bytes remain in the local logs and hashes.
  return String(text).replace(/C:(?:\\\\|\\|\/)Users(?:\\\\|\\|\/)37814/g, '<USER_HOME>')
    .replace(/E:(?:\\\\|\\|\/)MovedFromC/g, '<MOVED_WORKSPACES>')
    .replace(/\r\n/g, '\n').replace(/[ \t]+$/gm, '').replace(/\s*$/, '') + '\n';
}
function rejectSecrets(text) {
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{25,}|github_pat_[A-Za-z0-9_]{25,}|sk-[A-Za-z0-9]{30,}/.test(text)) throw new Error('Potential secret in evidence; stop for inspection');
}
function write(relative, data) {
  const dest = path.join(__dirname, relative);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const text = sanitize(typeof data === 'string' ? data : JSON.stringify(data, null, 2) + '\n');
  rejectSecrets(text); fs.writeFileSync(dest, text);
}
function historic(source) {
  source = path.resolve(source);
  const logs = ['baseline-fixture', 'baseline-repo', 'repro-current-original', 'delivery-repro', 'handoff-repro',
    'delivery-smokes', 'delivery-arch', 'delivery-release', 'targeted-ten-final', 'official-sync', 'parity-final',
    'hot-gates-final', 'module-reproducible', 'dependencies-audit', 'npm-ci', 'full-smoke-first',
    'committed-targeted', 'release-before-baseline', 'hot-baseline-sync', 'committed-baseline-check',
    'committed-generated-check', 'handoff-diff', 'mobile-dry-run', 'mobile-stage-final', 'mobile-verify-final',
    'workshop-transactions', 'workshop-transactions-retest', 'save-files', 'save-files-retest', 'safe-remote', 'safe-remote-retest'];
  const index = { provenance: 'Previous local execution, not a remote CI run', platform: 'win32', node: 'v24.14.0',
    workspaceStatus: 'Not captured per historical command. Do not infer clean status from HEAD alone.',
    privacy: 'Workstation user paths redacted; display line endings/trailing whitespace normalized. Original and published SHA256 included; original fixtures untouched.', files: [] };
  function copy(src, dest, redact = true) {
    const data = fs.readFileSync(src); rejectSecrets(data.toString('utf8'));
    const target = path.join(__dirname, dest); fs.mkdirSync(path.dirname(target), { recursive: true });
    const published = redact ? Buffer.from(sanitize(data.toString('utf8'))) : data;
    fs.writeFileSync(target, published);
    index.files.push({ path: dest, originalSha256: sha(data), publishedSha256: sha(published), redacted: !data.equals(published) });
  }
  logs.forEach(name => copy(path.join(source, name + '.log'), 'historical/' + name + '.txt'));
  for (const name of ['runs.jsonl', 'repro-adapted-results.json', 'targeted-ten-final-report.json']) copy(path.join(source, name), 'historical/' + name);
  const original = path.join(source, 'repro-original');
  for (const file of ['audit-repro.cjs', 'manifest.json', 'fixtures/ci-smokes.js', 'fixtures/main-excerpts.js', 'fixtures/main-turn-data-commit.js', 'fixtures/renderer-excerpts.js']) copy(path.join(original, file), 'original/' + file, false);
  copy(path.resolve(source, '../arch-guard/ci-QrYrBT/smoke-report.json'), 'historical/full-smoke-report.json');
  const diff = cp.spawnSync('git', ['diff', '--no-index', '--', path.join(original, 'audit-repro.cjs'), path.join(root, 'web/scripts/audit-repro.cjs')], { encoding: 'utf8', windowsHide: true });
  if (diff.status !== 1) throw new Error('Expected adapter diff, got ' + diff.status);
  write('adapter.diff.txt', diff.stdout);
  write('adapter.diff.json', { purpose: 'Exact diff text (except user path redaction), escaped to preserve whitespace',
    text: diff.stdout.replaceAll(source.replace(/\\/g, '/'), '<LOCAL_EVIDENCE>') });
  write('historical/index.json', index);
  console.log('Collected ' + index.files.length + ' explicit historical evidence files');
}
function baseline() {
  const audit = '3f8065cb9cf09b414cf35dc3deccca59560f733b', start = '6ce797ae032857ff99722482768844c2e6d4a4c9', finish = '5ed032afe65cc041dd4d890227ada23e736b4713';
  const base = git(['rev-parse', 'origin/main']).trim();
  const records = { inspectedAt: new Date().toISOString(), actualRemoteBase: base, originalAudit: audit, originalStart: start, originalFinish: finish,
    reviewCodeHead: git(['rev-parse', 'HEAD']).trim(), commonAncestor: git(['merge-base', base, start]).trim(),
    prerequisiteCommits: git(['log', '--format=%H %s', '--left-right', base + '...' + start]),
    prerequisiteDiff: git(['diff', base, start]),
    originalFixCommits: git(['log', '--reverse', '--format=%H %s', start + '..' + finish]),
    originalFixFiles: git(['diff', '--numstat', start, finish]),
    reviewCommits: git(['log', '--reverse', '--format=%H %s', base + '..HEAD']),
    reviewFiles: git(['diff', '--numstat', base, 'HEAD']),
    originalToReviewDiff: git(['diff', finish, 'HEAD']) };
  write('baseline-comparison.json', records);
  write('hash-sync.diff.txt', git(['show', 'da13419118801552f270387e9708e526af18eca0', '--', 'web/.hot-update-manifest.json']));
  const before = JSON.parse(git(['show', start + ':web/.hot-update-manifest.json']));
  const after = JSON.parse(git(['show', finish + ':web/.hot-update-manifest.json']));
  const bm = new Map(before.files.map(f => [f.path, f])), am = new Map(after.files.map(f => [f.path, f]));
  write('hash-sync.json', { beforeVersion: before.version, afterVersion: after.version, beforeCount: bm.size, afterCount: am.size,
    removed: [...bm.keys()].filter(p => !am.has(p)), added: [...am.keys()].filter(p => !bm.has(p)),
    changed: [...am.values()].filter(f => JSON.stringify(f) !== JSON.stringify(bm.get(f.path))),
    officialSourceAndVersionDiff: git(['diff', start, finish, '--', 'scenarios', 'web/scenarios', 'web/bundled-scenarios', 'mobile/release-version.json', 'web/version.json', 'web/index.html']),
    packageDiff: git(['diff', start, finish, '--', 'package.json', 'package-lock.json']) });
}
function current() {
  const log = fs.readFileSync(path.join(__dirname, 'current/review-smokes.txt'), 'utf8');
  const match = log.match(/report=([^\r\n]+smoke-report\.json)/);
  if (!match) throw new Error('Full smoke report path not found');
  const suffix = match[1].replace(/\\/g, '/').split('/web/')[1];
  write('current/full-smoke-report.json', JSON.parse(fs.readFileSync(path.join(root, 'web', suffix), 'utf8')));
  for (const [src, dst] of [['web/dev-tools/audit-review/targeted-report.json', 'targeted-report.json'], ['web/dev-tools/audit-2026-09-05/repro-adapted-results.json', 'repro-results.json']]) {
    write('current/' + dst, JSON.parse(fs.readFileSync(path.join(root, src), 'utf8')));
  }
}
function refreshPresentation() {
  for (const name of fs.readdirSync(path.join(__dirname, 'current')).filter(f => f.endsWith('.json'))) {
    const meta = JSON.parse(fs.readFileSync(path.join(__dirname, 'current', name), 'utf8'));
    if (!meta.command) continue;
    const raw = path.join(root, 'web/dev-tools/audit-review', name.replace(/\.json$/, '.raw.txt'));
    if (!fs.existsSync(raw)) throw new Error('Original local output missing: ' + name);
    const data = fs.readFileSync(raw, 'utf8');
    if (sha(data) !== meta.rawSha256) throw new Error('Original local output changed: ' + name);
    meta.publishedSha256 = sha(sanitize(data));
    const header = { ...meta }; delete header.rawSha256; delete header.publishedSha256;
    write('current/' + name.replace(/\.json$/, '.txt'), JSON.stringify(header) + '\n' + data);
    write('current/' + name, meta);
  }
}
function record(name, executable, args) {
  if (!/^[a-z0-9-]+$/.test(name) || !executable) throw new Error('record NAME EXECUTABLE ARGS required');
  const started = Date.now(), head = git(['rev-parse', 'HEAD']).trim();
  const metadata = { command: [executable, ...args], cwd: root, head, tree: git(['rev-parse', 'HEAD^{tree}']).trim(),
    statusBefore: git(['status', '--short']), platform: process.platform, release: os.release(), arch: process.arch, node: process.version, startedAt: new Date().toISOString() };
  const dir = path.join(root, 'web/dev-tools/audit-review'); fs.mkdirSync(dir, { recursive: true });
  const raw = path.join(dir, name + '.raw.txt'), fd = fs.openSync(raw, 'w');
  const child = cp.spawn(executable, args, { cwd: root, stdio: ['ignore', fd, fd], windowsHide: true });
  child.on('error', error => fs.writeSync(fd, String(error)));
  child.on('close', (exitCode, signal) => {
    fs.closeSync(fd);
    Object.assign(metadata, { exitCode, signal, durationMs: Date.now() - started, statusAfter: git(['status', '--short']) });
    const data = fs.readFileSync(raw, 'utf8');
    write('current/' + name + '.txt', JSON.stringify(metadata) + '\n' + data);
    write('current/' + name + '.json', { ...metadata, rawSha256: sha(data), publishedSha256: sha(sanitize(data)) });
    console.log(JSON.stringify({ name, head, exitCode, signal, durationMs: metadata.durationMs }));
    process.exitCode = exitCode === 0 ? 0 : 1;
  });
}
const [mode, ...args] = process.argv.slice(2);
if (mode === 'historic') historic(args[0]);
else if (mode === 'baseline') baseline();
else if (mode === 'current') current();
else if (mode === 'refresh-presentation') refreshPresentation();
else if (mode === 'record') record(args[0], args[1], args.slice(2));
else throw new Error('Expected historic SOURCE | baseline | record NAME EXECUTABLE ARGS');
